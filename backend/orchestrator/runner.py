"""
backend/orchestrator/runner.py

run_workflow() — the single async entry point that executes the compiled
LangGraph StateGraph pipeline, wraps it in timeout + error protection,
and returns a fully populated AgentState.

Design decisions:
  - LangGraph's compiled workflow.invoke() is synchronous under the hood
    (LangGraph ≥0.1 does support ainvoke, but we add an executor fallback
    so the code is safe across both sync and async graph implementations).
  - asyncio.wait_for() enforces a hard wall-clock timeout so a stuck LLM
    call cannot block the FastAPI event loop indefinitely.
  - Session state is checkpointed to MongoDB before and after execution
    for fault tolerance and resumability.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Optional

from backend.config.settings import get_settings
from backend.orchestrator.state import AgentState, EvalStatus
from backend.services.memory_service import get_memory_service

logger = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# Lazy import of the compiled workflow
# ---------------------------------------------------------------------------
# We import lazily so that if graph.py fails to compile (e.g. missing deps
# in a test environment), it doesn't crash the entire module at import time.

_workflow = None


def _get_workflow():
    """Return the compiled LangGraph workflow, importing it on first call."""
    global _workflow
    if _workflow is None:
        from backend.orchestrator.graph import workflow as _compiled
        _workflow = _compiled
        logger.info("[runner] LangGraph workflow loaded.")
    return _workflow


# ---------------------------------------------------------------------------
# Timeout constant
# ---------------------------------------------------------------------------

# Default hard timeout for the entire pipeline (seconds).
# Overridable via PIPELINE_TIMEOUT_SECONDS env var if we add it to settings.
_PIPELINE_TIMEOUT: int = int(
    getattr(cfg.llm, "llm_timeout_seconds", 300) * 2.5
)
# Clamp between 120 and 600 seconds
_PIPELINE_TIMEOUT = max(120, min(600, _PIPELINE_TIMEOUT))


# ---------------------------------------------------------------------------
# Core runner
# ---------------------------------------------------------------------------


async def run_workflow(initial_state: AgentState) -> AgentState:
    """
    Execute the compiled LangGraph pipeline asynchronously.

    Execution strategy:
      1. Checkpoint the initial state to MongoDB (fire-and-forget).
      2. Try ``workflow.ainvoke()`` first (native async, LangGraph ≥0.1).
      3. If ainvoke is not available, fall back to running the synchronous
         ``workflow.invoke()`` inside ``asyncio.get_event_loop().run_in_executor()``
         so it never blocks the event loop.
      4. Wrap both paths in ``asyncio.wait_for`` with a hard timeout.
      5. On any exception, append to state["errors"] and return partial state.
      6. Checkpoint the final state to MongoDB.

    Args:
        initial_state: A fully-initialised AgentState from create_initial_state().

    Returns:
        The final AgentState after the pipeline has run (or failed).
        The "errors" key will contain any non-fatal errors.

    Raises:
        TimeoutError: If the pipeline exceeds _PIPELINE_TIMEOUT seconds.
                      (Caller — the FastAPI route — maps this to HTTP 504.)
    """
    session_id = initial_state["session_id"]
    logger.info(
        "[runner] START session=%s timeout=%ds",
        session_id, _PIPELINE_TIMEOUT,
    )
    t0 = time.monotonic()

    # ── Checkpoint initial state ────────────────────────────────────────
    await _checkpoint_state(initial_state, label="initial")

    # ── Execute pipeline ────────────────────────────────────────────────
    final_state: AgentState

    try:
        final_state = await asyncio.wait_for(
            _invoke_pipeline(initial_state),
            timeout=_PIPELINE_TIMEOUT,
        )
    except asyncio.TimeoutError:
        elapsed = round(time.monotonic() - t0, 1)
        logger.error(
            "[runner] TIMEOUT session=%s elapsed=%.1fs limit=%ds",
            session_id, elapsed, _PIPELINE_TIMEOUT,
        )
        # Return a partial state with timeout error so the API can respond 504
        error_state: AgentState = {
            **initial_state,  # type: ignore[misc]
            "eval_status": EvalStatus.FAILED.value,
            "errors": [
                *(initial_state.get("errors") or []),
                f"runner:timeout:Pipeline exceeded {_PIPELINE_TIMEOUT}s limit",
            ],
        }
        await _checkpoint_state(error_state, label="timeout")
        raise TimeoutError(
            f"Pipeline timed out after {_PIPELINE_TIMEOUT}s for session {session_id}"
        )

    except Exception as exc:
        elapsed = round(time.monotonic() - t0, 1)
        logger.exception(
            "[runner] UNHANDLED ERROR session=%s elapsed=%.1fs: %s",
            session_id, elapsed, exc,
        )
        error_state = {
            **initial_state,  # type: ignore[misc]
            "eval_status": EvalStatus.FAILED.value,
            "errors": [
                *(initial_state.get("errors") or []),
                f"runner:unhandled:{type(exc).__name__}:{exc}",
            ],
        }
        await _checkpoint_state(error_state, label="error")
        return error_state

    elapsed = round(time.monotonic() - t0, 1)
    overall = (final_state.get("eval_scores") or {}).get("overall", 0.0)
    logger.info(
        "[runner] DONE session=%s elapsed=%.1fs status=%s score=%.1f iter=%d errors=%d",
        session_id,
        elapsed,
        final_state.get("eval_status"),
        overall,
        final_state.get("iteration_count") or 0,
        len(final_state.get("errors") or []),
    )

    # ── Checkpoint final state ───────────────────────────────────────────
    await _checkpoint_state(final_state, label="final")

    return final_state


# ---------------------------------------------------------------------------
# Pipeline invocation helpers
# ---------------------------------------------------------------------------


async def _invoke_pipeline(state: AgentState) -> AgentState:
    """
    Attempt native ainvoke first; fall back to executor-wrapped invoke.

    This makes the runner compatible with both:
      - LangGraph versions that implement ainvoke natively (async-native)
      - Older builds where invoke() is synchronous
    """
    workflow = _get_workflow()

    # ── Path A: native async invocation ────────────────────────────────
    if hasattr(workflow, "ainvoke"):
        try:
            result = await workflow.ainvoke(state)
            return _ensure_agent_state(result, state)
        except NotImplementedError:
            logger.warning(
                "[runner] ainvoke raised NotImplementedError; "
                "falling back to executor"
            )
        except Exception:
            raise

    # ── Path B: synchronous invoke in thread pool ───────────────────────
    logger.debug("[runner] using run_in_executor for sync workflow.invoke()")
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, workflow.invoke, state)
    return _ensure_agent_state(result, state)


def _ensure_agent_state(result: Any, fallback: AgentState) -> AgentState:
    """
    Guarantee that the workflow output is a dict compatible with AgentState.

    LangGraph may return a plain dict, a StateSnapshot, or the raw TypedDict.
    This function normalises all cases.
    """
    if result is None:
        logger.warning("[runner] workflow returned None; returning fallback state")
        return {
            **fallback,  # type: ignore[misc]
            "eval_status": EvalStatus.FAILED.value,
            "errors": [
                *(fallback.get("errors") or []),
                "runner:null_output:Workflow returned None",
            ],
        }

    if isinstance(result, dict):
        # Merge result over fallback so any missing keys are filled in
        merged: AgentState = {**fallback, **result}  # type: ignore[misc]
        return merged

    # LangGraph StateSnapshot object — extract the values dict
    if hasattr(result, "values"):
        values = result.values
        if isinstance(values, dict):
            return {**fallback, **values}  # type: ignore[misc]

    # Unknown type — log and return fallback with error
    logger.error(
        "[runner] unexpected workflow output type: %s", type(result).__name__
    )
    return {
        **fallback,  # type: ignore[misc]
        "eval_status": EvalStatus.FAILED.value,
        "errors": [
            *(fallback.get("errors") or []),
            f"runner:bad_output:Unexpected type {type(result).__name__}",
        ],
    }


# ---------------------------------------------------------------------------
# Checkpointing (fire-and-forget)
# ---------------------------------------------------------------------------


async def _checkpoint_state(state: AgentState, label: str) -> None:
    """
    Persist a lightweight state snapshot to MongoDB.

    This is fire-and-forget — failures are logged but never propagate
    to the caller so they cannot interrupt the pipeline.

    Args:
        state: Current AgentState.
        label: Human-readable tag ("initial" | "final" | "error" | "timeout").
    """
    session_id = state.get("session_id", "unknown")
    try:
        # Build a serialisable snapshot — omit PDF bytes (not JSON-safe)
        snapshot = _serialisable_snapshot(state, label)
        memory = get_memory_service()
        await memory.checkpoint_session(session_id, snapshot)
        logger.debug("[runner] checkpoint=%s session=%s", label, session_id)
    except Exception as exc:
        logger.warning(
            "[runner] checkpoint failed label=%s session=%s: %s",
            label, session_id, exc,
        )


def _serialisable_snapshot(state: AgentState, label: str) -> dict:
    """
    Build a JSON-serialisable snapshot from AgentState.

    Excludes:
      - raw_resume_pdf_bytes  (binary, not JSON-safe)
      - retrieved_jd_context / retrieved_resume_chunks content
        (large; stored separately in ChromaDB)

    Includes all scoring, output, and meta fields.
    """
    return {
        "checkpoint_label":  label,
        "session_id":        state.get("session_id"),
        "created_at":        state.get("created_at"),
        "eval_status":       state.get("eval_status"),
        "eval_scores":       state.get("eval_scores") or {},
        "iteration_count":   state.get("iteration_count") or 0,
        "execution_plan":    state.get("execution_plan") or [],
        "focus_areas":       state.get("focus_areas") or [],
        "model_routing":     state.get("model_routing") or {},
        "parsed_jd":         state.get("parsed_jd") or {},
        "tailored_resume":   state.get("tailored_resume") or "",
        "cover_letter":      state.get("cover_letter") or "",
        "change_log":        state.get("change_log") or [],
        "errors":            state.get("errors") or [],
    }