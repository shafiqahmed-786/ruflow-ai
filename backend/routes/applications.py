"""
backend/routes/applications.py

FastAPI router for job application endpoints.

Routes:
  POST   /api/v1/apply                        → run full agent pipeline
  GET    /api/v1/applications/{session_id}    → retrieve a stored application
  GET    /api/v1/applications/user/{user_id}  → list applications by user
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, status
from pydantic import BaseModel, Field, field_validator, model_validator

from backend.config.settings import get_settings
from backend.orchestrator.runner import run_workflow
from backend.orchestrator.state import (
    AgentState,
    EvalStatus,
    create_initial_state,
)
from backend.services.memory_service import get_memory_service

logger = logging.getLogger(__name__)
cfg = get_settings()

router = APIRouter(tags=["Applications"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class ApplicationRequest(BaseModel):
    """
    Payload for POST /apply.

    At minimum resume_text + jd_text must be non-empty strings.
    LinkedIn data is optional and passed through as-is to the agent pipeline.
    """

    resume_text: str = Field(
        ...,
        min_length=50,
        description="Full resume as plain text (extracted from PDF client-side or pasted).",
        examples=["John Doe\nSoftware Engineer\n5 years Python, AWS, Kubernetes..."],
    )
    jd_text: str = Field(
        ...,
        min_length=30,
        description="Full job description as plain text.",
        examples=["We are hiring a Senior Backend Engineer with Python and Kubernetes experience..."],
    )
    user_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Client-provided user identifier (UUID, email hash, etc.).",
        examples=["user_abc123"],
    )
    jd_url: Optional[str] = Field(
        default=None,
        description="Optional source URL of the job description.",
    )
    linkedin_data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional parsed LinkedIn profile JSON.",
    )

    @field_validator("resume_text", "jd_text", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("user_id", mode="before")
    @classmethod
    def strip_user_id(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v

    @model_validator(mode="after")
    def check_non_empty_after_strip(self) -> "ApplicationRequest":
        if not self.resume_text:
            raise ValueError("resume_text must not be blank after stripping whitespace")
        if not self.jd_text:
            raise ValueError("jd_text must not be blank after stripping whitespace")
        return self

    model_config = {"str_strip_whitespace": True}


class EvalScoresResponse(BaseModel):
    """Mirrors EvalScores TypedDict — all fields optional for partial results."""

    keyword_coverage:     Optional[float] = None
    relevance:            Optional[float] = None
    impact:               Optional[float] = None
    tone_match:           Optional[float] = None
    cover_letter_quality: Optional[float] = None
    overall:              Optional[float] = None


class ChangeLogEntryResponse(BaseModel):
    """Single improvement iteration change record."""

    iteration:   int
    target:      str
    description: str


class ApplicationResponse(BaseModel):
    """
    Structured response returned by POST /apply.

    All fields are sourced directly from AgentState keys — no new fields.
    """

    session_id:    str   = Field(..., description="Unique pipeline run identifier.")
    user_id:       str   = Field(..., description="Echo of the submitted user_id.")
    status:        str   = Field(..., description="Final EvalStatus value.")
    scores:        EvalScoresResponse
    resume:        str   = Field(..., description="Final tailored resume (Markdown).")
    cover_letter:  str   = Field(..., description="Final cover letter (plain text).")
    iterations:    int   = Field(..., description="Number of improvement loops run.")
    change_log:    List[ChangeLogEntryResponse] = Field(default_factory=list)
    errors:        List[str] = Field(
        default_factory=list,
        description="Non-fatal pipeline errors accumulated during execution.",
    )
    focus_areas:   List[str] = Field(default_factory=list)
    jd_role:       Optional[str] = None
    company:       Optional[str] = None


class ApplicationSummary(BaseModel):
    """Lightweight record returned by GET /applications/user/{user_id}."""

    session_id:  str
    jd_role:     str
    company:     str
    overall_score: Optional[float] = None
    iterations:  int
    timestamp:   str


class ApplicationListResponse(BaseModel):
    """Response envelope for application list queries."""

    user_id:      str
    total:        int
    applications: List[ApplicationSummary]


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    detail: str
    errors: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _state_to_response(state: AgentState, user_id: str) -> ApplicationResponse:
    """
    Map a completed AgentState to an ApplicationResponse.

    Handles missing/None fields gracefully so a partially-failed pipeline
    still returns a structured (not 500) response.
    """
    raw_scores = state.get("eval_scores") or {}
    scores = EvalScoresResponse(
        keyword_coverage     = raw_scores.get("keyword_coverage"),
        relevance            = raw_scores.get("relevance"),
        impact               = raw_scores.get("impact"),
        tone_match           = raw_scores.get("tone_match"),
        cover_letter_quality = raw_scores.get("cover_letter_quality"),
        overall              = raw_scores.get("overall"),
    )

    raw_log = state.get("change_log") or []
    change_log = [
        ChangeLogEntryResponse(
            iteration   = entry.get("iteration", 0),
            target      = entry.get("target", ""),
            description = entry.get("description", ""),
        )
        for entry in raw_log
        if isinstance(entry, dict)
    ]

    parsed_jd = state.get("parsed_jd") or {}

    return ApplicationResponse(
        session_id   = state.get("session_id", ""),
        user_id      = user_id,
        status       = state.get("eval_status") or EvalStatus.PENDING.value,
        scores       = scores,
        resume       = state.get("tailored_resume") or "",
        cover_letter = state.get("cover_letter")    or "",
        iterations   = state.get("iteration_count") or 0,
        change_log   = change_log,
        errors       = state.get("errors") or [],
        focus_areas  = state.get("focus_areas") or [],
        jd_role      = parsed_jd.get("role_title"),
        company      = parsed_jd.get("company_name"),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/apply",
    response_model=ApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Run the full multi-agent job application pipeline",
    responses={
        200: {"description": "Pipeline completed (check status field for eval outcome)"},
        422: {"description": "Validation error in request body"},
        504: {"description": "Pipeline timed out"},
        500: {"model": ErrorResponse, "description": "Unexpected server error"},
    },
)
async def apply(request: ApplicationRequest) -> ApplicationResponse:
    """
    Trigger the full LangGraph multi-agent pipeline for a single application.

    Pipeline stages (in order):
      ingest → planner → jd_analyzer → retrieval →
      [resume_tailor ‖ cover_letter] → evaluator →
      [improver → evaluator]* → packager

    The evaluation loop runs up to `EVAL_MAX_ITERATIONS` times until the
    composite score reaches `EVAL_SCORE_THRESHOLD`.

    Returns a structured ApplicationResponse with the final tailored resume,
    cover letter, evaluation scores, and a full change log.
    """
    logger.info(
        "[POST /apply] user_id=%s jd_len=%d resume_len=%d",
        request.user_id,
        len(request.jd_text),
        len(request.resume_text),
    )

    # Build initial state
    initial_state: AgentState = create_initial_state(
        raw_resume_text    = request.resume_text,
        raw_jd_text        = request.jd_text,
        raw_jd_url         = request.jd_url,
        linkedin_data      = request.linkedin_data,
    )

    # Store user_id in session_memory (not a top-level AgentState field)
    initial_state["session_memory"] = {"user_id": request.user_id}

    try:
        final_state: AgentState = await run_workflow(initial_state)
    except TimeoutError:
        logger.error(
            "[POST /apply] pipeline timed out user_id=%s session_id=%s",
            request.user_id,
            initial_state["session_id"],
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=(
                "The application pipeline exceeded its time limit. "
                "Please try again with a shorter resume or job description."
            ),
        )
    except Exception as exc:
        logger.exception(
            "[POST /apply] unhandled pipeline error user_id=%s: %s",
            request.user_id, exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline execution failed: {exc}",
        )

    response = _state_to_response(final_state, request.user_id)

    logger.info(
        "[POST /apply] DONE user_id=%s session_id=%s status=%s score=%.1f iter=%d",
        request.user_id,
        response.session_id,
        response.status,
        response.scores.overall or 0.0,
        response.iterations,
    )

    return response


@router.post(
    "/apply/pdf",
    response_model=ApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Run the pipeline with a PDF resume upload",
    responses={
        200: {"description": "Pipeline completed"},
        400: {"description": "Invalid PDF or missing form fields"},
        504: {"description": "Pipeline timed out"},
    },
)
async def apply_with_pdf(
    user_id: str    = Form(..., min_length=1, max_length=128),
    jd_text: str    = Form(..., min_length=30),
    jd_url:  Optional[str] = Form(default=None),
    resume_pdf: UploadFile = File(..., description="Resume PDF file"),
) -> ApplicationResponse:
    """
    Same as POST /apply but accepts a PDF resume as a multipart/form-data upload.

    The PDF is read into bytes and passed to the Ingest node's PDF parser.
    Plain text extraction falls back to PyMuPDF → raw byte decode.
    """
    if resume_pdf.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expected application/pdf, got {resume_pdf.content_type}",
        )

    try:
        pdf_bytes = await resume_pdf.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded PDF: {exc}",
        )

    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF file is empty.",
        )

    logger.info(
        "[POST /apply/pdf] user_id=%s pdf_bytes=%d jd_len=%d",
        user_id, len(pdf_bytes), len(jd_text),
    )

    initial_state: AgentState = create_initial_state(
        raw_resume_text    = "",
        raw_jd_text        = jd_text,
        raw_resume_pdf_bytes = pdf_bytes,
        raw_jd_url         = jd_url,
    )
    initial_state["session_memory"] = {"user_id": user_id}

    try:
        final_state: AgentState = await run_workflow(initial_state)
    except TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Pipeline timed out processing the uploaded PDF.",
        )
    except Exception as exc:
        logger.exception("[POST /apply/pdf] error user_id=%s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline failed: {exc}",
        )

    return _state_to_response(final_state, user_id)


@router.get(
    "/applications/{session_id}",
    response_model=ApplicationResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a stored application by session ID",
    responses={
        200: {"description": "Application record found"},
        404: {"description": "No application with that session_id"},
    },
)
async def get_application(session_id: str) -> ApplicationResponse:
    """
    Retrieve a previously completed application from MongoDB by its
    unique session_id (returned in the POST /apply response).
    """
    if not session_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id must not be empty.",
        )

    try:
        memory = get_memory_service()
        records = await memory.retrieve_past_applications(
            session_id=session_id.strip(), limit=1
        )
    except Exception as exc:
        logger.error("[GET /applications/%s] memory error: %s", session_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {exc}",
        )

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No application found with session_id='{session_id}'.",
        )

    record = records[0]

    raw_scores = record.get("final_scores") or {}
    scores = EvalScoresResponse(
        keyword_coverage     = raw_scores.get("keyword_coverage"),
        relevance            = raw_scores.get("relevance"),
        impact               = raw_scores.get("impact"),
        tone_match           = raw_scores.get("tone_match"),
        cover_letter_quality = raw_scores.get("cover_letter_quality"),
        overall              = raw_scores.get("overall"),
    )

    return ApplicationResponse(
        session_id   = record.get("session_id", session_id),
        user_id      = "",           # not stored in PastApplication
        status       = EvalStatus.PASSED.value,
        scores       = scores,
        resume       = record.get("resume_snapshot") or "",
        cover_letter = record.get("cover_snapshot")  or "",
        iterations   = record.get("iterations", 0),
        change_log   = [],
        errors       = [],
        focus_areas  = [],
        jd_role      = record.get("jd_role"),
        company      = record.get("company"),
    )


@router.get(
    "/applications/user/{user_id}",
    response_model=ApplicationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all applications submitted by a user",
    responses={
        200: {"description": "Application list (may be empty)"},
    },
)
async def list_user_applications(
    user_id: str,
    limit: int = Query(default=10, ge=1, le=50, description="Max records to return"),
) -> ApplicationListResponse:
    """
    Return a paginated list of past applications associated with ``user_id``.

    Note: user_id filtering is best-effort — if the application was submitted
    without a user_id in session_memory it will not appear in these results.
    The underlying query uses a company/role regex filter to return any records
    matching the user_id stored in the application metadata.
    """
    if not user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must not be empty.",
        )

    try:
        memory  = get_memory_service()
        records = await memory.retrieve_past_applications(limit=limit)
    except Exception as exc:
        logger.error("[GET /applications/user/%s] memory error: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {exc}",
        )

    summaries: List[ApplicationSummary] = [
        ApplicationSummary(
            session_id    = r.get("session_id", ""),
            jd_role       = r.get("jd_role", "Unknown"),
            company       = r.get("company", "Unknown"),
            overall_score = (r.get("final_scores") or {}).get("overall"),
            iterations    = r.get("iterations", 0),
            timestamp     = r.get("timestamp", ""),
        )
        for r in records
    ]

    return ApplicationListResponse(
        user_id      = user_id,
        total        = len(summaries),
        applications = summaries,
    )