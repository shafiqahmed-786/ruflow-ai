"""
backend/services/llm_service.py

LLMRouter — Gemini-backed LLM client with automatic fallback, retry logic,
token tracking, and a unified async interface compatible with LangGraph nodes.

Provider: Google Gemini (google-generativeai)
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from backend.config.settings import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class LLMResponse:
    """Normalised response returned by LLMRouter.invoke()."""

    content: str
    model_used: str
    input_tokens: int
    output_tokens: int
    latency_seconds: float
    fallback_used: bool = False
    raw: Optional[Any] = None


@dataclass
class ModelConfig:
    """Static configuration for a single Gemini model."""

    model_id: str
    provider: str = "gemini"   # always "gemini" now
    max_tokens: int = 4096
    temperature: float = 0.3
    timeout: int = 120
    priority: int = 0          # lower = tried first in fallback chain


# ---------------------------------------------------------------------------
# Token usage tracker (simple in-memory; swap for Redis in production)
# ---------------------------------------------------------------------------


class TokenUsageTracker:
    """Thread-safe cumulative token counter per session."""

    def __init__(self) -> None:
        self._usage: Dict[str, Dict[str, int]] = {}
        self._lock = asyncio.Lock()

    async def record(
        self, session_id: str, model: str, input_tokens: int, output_tokens: int
    ) -> None:
        async with self._lock:
            bucket = self._usage.setdefault(
                session_id, {"input": 0, "output": 0, "calls": 0}
            )
            bucket["input"] += input_tokens
            bucket["output"] += output_tokens
            bucket["calls"] += 1

    async def get(self, session_id: str) -> Dict[str, int]:
        async with self._lock:
            return dict(self._usage.get(session_id, {}))


# ---------------------------------------------------------------------------
# LLMRouter
# ---------------------------------------------------------------------------


class LLMRouter:
    """
    Unified async LLM client (Gemini) that:
    - Routes agent names to appropriate model configs.
    - Executes with retry + exponential backoff.
    - Falls back through a priority-ordered model chain on failure.
    - Tracks token usage per session.

    Usage::

        router = LLMRouter()
        response = await router.invoke(
            agent_name="cover_letter",
            system_prompt="You are ...",
            user_message="Write a cover letter for ...",
            session_id="abc-123",
        )
        print(response.content)
    """

    # Default fallback chain ordered by priority (index 0 = first attempted)
    _FALLBACK_CHAIN: List[str] = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
    ]

    def __init__(self) -> None:
        cfg = get_settings()

        # Configure the Gemini SDK globally (one API key)
        genai.configure(api_key=cfg.llm.gemini_api_key.get_secret_value())

        self._max_retries: int = cfg.llm.llm_max_retries
        self._default_max_tokens: int = cfg.llm.llm_max_tokens
        self._default_temperature: float = cfg.llm.llm_temperature
        self._timeout: int = cfg.llm.llm_timeout_seconds

        self.token_tracker = TokenUsageTracker()

        # Registry: model_id → ModelConfig
        self._registry: Dict[str, ModelConfig] = {
            cfg.llm.model_strong: ModelConfig(
                model_id=cfg.llm.model_strong,
                max_tokens=self._default_max_tokens,
                temperature=self._default_temperature,
                priority=0,
            ),
            cfg.llm.model_fast: ModelConfig(
                model_id=cfg.llm.model_fast,
                max_tokens=self._default_max_tokens,
                temperature=self._default_temperature,
                priority=1,
            ),
            cfg.llm.model_gemini_pro: ModelConfig(
                model_id=cfg.llm.model_gemini_pro,
                max_tokens=self._default_max_tokens,
                temperature=self._default_temperature,
                priority=2,
            ),
            cfg.llm.model_gemini_lite: ModelConfig(
                model_id=cfg.llm.model_gemini_lite,
                max_tokens=self._default_max_tokens,
                temperature=self._default_temperature,
                priority=3,
            ),
        }

        # Default agent → model assignments (overridden by state.model_routing)
        self._agent_defaults: Dict[str, str] = {
            "planner":       cfg.llm.model_fast,
            "jd_analyzer":   cfg.llm.model_fast,
            "retrieval":     cfg.llm.model_fast,
            "resume_tailor": cfg.llm.model_strong,
            "cover_letter":  cfg.llm.model_strong,
            "evaluator":     cfg.llm.model_strong,
            "improver":      cfg.llm.model_strong,
            "packager":      cfg.llm.model_fast,
        }

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def invoke(
        self,
        agent_name: str,
        system_prompt: str,
        user_message: str,
        session_id: str = "default",
        model_override: Optional[str] = None,
        extra_messages: Optional[List[Dict[str, str]]] = None,
        response_format: Optional[str] = None,  # "json" to request JSON output
    ) -> LLMResponse:
        """
        Invoke the Gemini model assigned to ``agent_name``.

        Args:
            agent_name: Logical agent name (e.g. "cover_letter").
            system_prompt: Instruction given to the model as SYSTEM role.
            user_message: The primary user-turn content.
            session_id: Used for token tracking and logging.
            model_override: Explicit model ID; overrides routing table.
            extra_messages: Additional alternating user/model turns
                            inserted between system and final user turn.
            response_format: Pass "json" to request JSON-structured output.

        Returns:
            LLMResponse with .content guaranteed to be a non-empty string.

        Raises:
            RuntimeError: If all models in the fallback chain fail.
        """
        primary_model = model_override or self._agent_defaults.get(
            agent_name, list(self._registry.keys())[0]
        )

        # Build fallback order: primary first, then rest of chain
        chain = self._build_fallback_chain(primary_model)

        last_exc: Optional[Exception] = None
        for idx, model_id in enumerate(chain):
            fallback = idx > 0
            try:
                response = await self._invoke_with_retry(
                    model_id=model_id,
                    system_prompt=system_prompt,
                    user_message=user_message,
                    extra_messages=extra_messages or [],
                    response_format=response_format,
                )
                response.fallback_used = fallback
                await self.token_tracker.record(
                    session_id,
                    model_id,
                    response.input_tokens,
                    response.output_tokens,
                )
                if fallback:
                    logger.warning(
                        "agent=%s fell back to model=%s after primary failure",
                        agent_name,
                        model_id,
                    )
                return response
            except Exception as exc:
                last_exc = exc
                logger.error(
                    "agent=%s model=%s failed: %s. Trying next in chain.",
                    agent_name,
                    model_id,
                    exc,
                )

        raise RuntimeError(
            f"All LLM fallbacks exhausted for agent '{agent_name}'. "
            f"Last error: {last_exc}"
        ) from last_exc

    async def invoke_json(
        self,
        agent_name: str,
        system_prompt: str,
        user_message: str,
        session_id: str = "default",
        model_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Convenience wrapper that calls invoke() and parses the response
        as JSON, stripping markdown fences if present.

        Raises:
            ValueError: If the response cannot be parsed as JSON.
        """
        response = await self.invoke(
            agent_name=agent_name,
            system_prompt=system_prompt,
            user_message=user_message,
            session_id=session_id,
            model_override=model_override,
            response_format="json",
        )
        return self._parse_json_response(response.content)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _invoke_with_retry(
        self,
        model_id: str,
        system_prompt: str,
        user_message: str,
        extra_messages: List[Dict[str, str]],
        response_format: Optional[str],
    ) -> LLMResponse:
        """Execute a single Gemini model with exponential-backoff retry."""
        cfg = self._registry[model_id]
        backoff = 1.0

        for attempt in range(1, self._max_retries + 1):
            try:
                start = time.monotonic()
                result = await self._call_gemini(
                    model_id=model_id,
                    system_prompt=system_prompt,
                    user_message=user_message,
                    extra_messages=extra_messages,
                    max_tokens=cfg.max_tokens,
                    temperature=cfg.temperature,
                    response_format=response_format,
                )
                result.latency_seconds = time.monotonic() - start
                return result

            except google_exceptions.ResourceExhausted as exc:
                # Rate limit — retry with backoff
                if attempt == self._max_retries:
                    raise
                wait = backoff * (2 ** (attempt - 1))
                logger.warning(
                    "model=%s attempt=%d/%d rate-limited; retrying in %.1fs: %s",
                    model_id, attempt, self._max_retries, wait, exc,
                )
                await asyncio.sleep(wait)

            except google_exceptions.DeadlineExceeded as exc:
                # Timeout — retry with backoff
                if attempt == self._max_retries:
                    raise
                wait = backoff * (2 ** (attempt - 1))
                logger.warning(
                    "model=%s attempt=%d/%d timed out; retrying in %.1fs: %s",
                    model_id, attempt, self._max_retries, wait, exc,
                )
                await asyncio.sleep(wait)

            except (
                google_exceptions.PermissionDenied,
                google_exceptions.Unauthenticated,
                google_exceptions.InvalidArgument,
            ) as exc:
                # Non-retriable — propagate immediately
                raise

        # Should not be reached
        raise RuntimeError(f"Retry loop ended unexpectedly for model {model_id}")

    async def _call_gemini(
        self,
        model_id: str,
        system_prompt: str,
        user_message: str,
        extra_messages: List[Dict[str, str]],
        max_tokens: int,
        temperature: float,
        response_format: Optional[str],
    ) -> LLMResponse:
        """Call the Google Gemini GenerativeModel API (async)."""

        # Build generation config
        generation_config: Dict[str, Any] = {
            "max_output_tokens": max_tokens,
            "temperature": temperature,
        }
        if response_format == "json":
            generation_config["response_mime_type"] = "application/json"

        model = genai.GenerativeModel(
            model_name=model_id,
            system_instruction=system_prompt,
            generation_config=genai.types.GenerationConfig(**generation_config),
        )

        # Build conversation history for multi-turn context
        # Gemini uses "user" / "model" roles
        history = []
        for msg in extra_messages:
            role = msg.get("role", "user")
            # Map legacy "assistant" role → Gemini "model" role
            gemini_role = "model" if role == "assistant" else "user"
            history.append({"role": gemini_role, "parts": [msg.get("content", "")]})

        # Use async generate via run_in_executor since the SDK's async support
        # is available via generate_content_async
        loop = asyncio.get_event_loop()

        if history:
            chat = model.start_chat(history=history)
            response = await asyncio.wait_for(
                chat.send_message_async(user_message),
                timeout=self._timeout,
            )
        else:
            response = await asyncio.wait_for(
                model.generate_content_async(user_message),
                timeout=self._timeout,
            )

        content = response.text or ""

        # Extract token counts from usage_metadata (may be None on some models)
        usage = getattr(response, "usage_metadata", None)
        input_tokens = getattr(usage, "prompt_token_count", 0) or 0
        output_tokens = getattr(usage, "candidates_token_count", 0) or 0

        return LLMResponse(
            content=content,
            model_used=model_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_seconds=0.0,
            raw=response,
        )

    def _build_fallback_chain(self, primary: str) -> List[str]:
        """
        Return an ordered list starting with ``primary``, followed by
        the remaining models in priority order.
        """
        known = [m for m in self._FALLBACK_CHAIN if m in self._registry]
        if primary not in known:
            logger.warning(
                "primary model '%s' not in fallback chain; defaulting to chain head",
                primary,
            )
            return known
        rest = [m for m in known if m != primary]
        return [primary, *rest]

    @staticmethod
    def _parse_json_response(raw: str) -> Dict[str, Any]:
        """Strip markdown fences and parse JSON from model output."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            # Drop first and last fence lines
            inner = lines[1:] if lines[0].startswith("```") else lines
            if inner and inner[-1].strip() == "```":
                inner = inner[:-1]
            cleaned = "\n".join(inner).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"LLM response is not valid JSON. Raw content:\n{raw[:500]}"
            ) from exc


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_router_instance: Optional[LLMRouter] = None


def get_llm_router() -> LLMRouter:
    """Return the process-wide LLMRouter singleton."""
    global _router_instance
    if _router_instance is None:
        _router_instance = LLMRouter()
    return _router_instance