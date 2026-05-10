"""
backend/services/pattern_extractor.py

PatternExtractor — learns successful writing patterns from high-scoring
stored applications using only stdlib primitives (Counter, re, math).

No NLTK, spaCy, or transformer dependencies.

Design constraints:
  - All DB access via injected MemoryService (no new clients).
  - Deterministic extraction — same input always produces same output.
  - All async where I/O is involved; sync where computation-only.
"""

from __future__ import annotations

import asyncio
import logging
import math
import re
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.services.memory_service import MemoryService, get_memory_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass
class KeywordPattern:
    """A single keyword with frequency and average score context."""
    keyword:      str
    frequency:    int
    avg_score:    float
    contexts:     List[str] = field(default_factory=list)  # up to 3 sentence snippets


@dataclass
class TonePattern:
    """Markers that characterise writing tone and seniority signalling."""
    action_verbs:       List[str]
    quantifier_phrases: List[str]   # "reduced by X%", "saved $X"
    leadership_markers: List[str]
    passive_voice_count: int
    avg_sentence_length: float


@dataclass
class StructurePattern:
    """Structural characteristics of the resume."""
    bullet_count:        int
    quantified_bullets:  int          # bullets containing numbers
    avg_bullet_length:   float        # in words
    section_count:       int
    has_summary:         bool
    has_projects:        bool
    total_word_count:    int
    quantification_rate: float        # quantified_bullets / bullet_count


# ---------------------------------------------------------------------------
# Regex patterns (compiled once at module load)
# ---------------------------------------------------------------------------

# Numbers: integers, floats, percentages, dollar amounts, multipliers
_NUMBER_RE  = re.compile(r"""
    \$\s*[\d,]+(?:\.\d+)?[KkMmBb]?   # dollar amounts
    | [\d,]+(?:\.\d+)?\s*%            # percentages
    | [\d,]+[xX]                      # multipliers
    | \b\d{1,3}(?:,\d{3})*(?:\.\d+)? # plain numbers > 999
    | \b\d+(?:\.\d+)?[KkMmBb]\b      # shorthand (10K, 5M)
""", re.VERBOSE)

# Quantifier phrases in resume bullets
_QUANTIFIER_RE = re.compile(
    r"(?:"
    r"(?:reduc(?:ed|ing)|cut|decreas(?:ed|ing))\s+(?:by|from)?\s*[\d,.]+\s*%?"
    r"|(?:increas(?:ed|ing)|grew?|boost(?:ed|ing)|improv(?:ed|ing))\s+(?:by|from)?\s*[\d,.]+\s*%?"
    r"|saved?\s+\$[\d,.]+[KkMmBb]?"
    r"|(?:serving?|support(?:ing)?|process(?:ing)?|handl(?:ing)?)\s+[\d,.]+\+?\s*(?:users?|customers?|requests?|daily|monthly)?"
    r"|latency\s+(?:of\s+)?[\d,.]+\s*(?:ms|seconds?)"
    r"|[\d,.]+\+?\s*(?:users?|customers?|engineers?|services?|microservices?)"
    r")",
    re.IGNORECASE,
)

# Leadership / ownership language
_LEADERSHIP_RE = re.compile(
    r"\b(?:"
    r"led|lead(?:ing)?|owned?|own(?:ing)?|architected?|design(?:ed|ing)|"
    r"mentored?|manag(?:ed|ing)|founded?|built|drove?|driv(?:en|ing)|"
    r"established?|pioneered?|spearheaded?|oversee?|oversaw|"
    r"director?|principal|staff|cross-functional"
    r")\b",
    re.IGNORECASE,
)

# Strong action verbs at start of bullet
_ACTION_VERB_RE = re.compile(
    r"^[-•*·]?\s*([A-Z][a-z]{2,}(?:ed|ing)?)\b",
    re.MULTILINE,
)

# Passive voice markers
_PASSIVE_RE = re.compile(
    r"\b(?:was|were|been|be|is|are)\s+\w+ed\b",
    re.IGNORECASE,
)

# Section headers
_SECTION_HEADER_RE = re.compile(
    r"^#{1,3}\s+\S|^[A-Z][A-Z\s]{3,}$",
    re.MULTILINE,
)

# Summary / profile section presence
_SUMMARY_RE = re.compile(
    r"summary|profile|objective|about me",
    re.IGNORECASE,
)

# Projects section presence
_PROJECTS_RE = re.compile(
    r"projects?|portfolio|open[\s-]source",
    re.IGNORECASE,
)

# Bullet line detection
_BULLET_RE = re.compile(r"^\s*[-•*·]\s+.+", re.MULTILINE)

# Stop-words for keyword filtering (minimal, no external dependency)
_STOP_WORDS: Set[str] = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "i", "you", "we", "they", "he",
    "she", "it", "my", "our", "your", "their", "this", "that", "these",
    "those", "as", "if", "so", "up", "out", "about", "into", "through",
    "during", "including", "also", "well", "while", "after", "before",
    "when", "where", "which", "who", "than", "more", "most", "other",
    "all", "both", "each", "few", "more", "some", "such", "no", "not",
    "only", "same", "too", "very", "just", "can", "us",
}

# Patterns stored in MongoDB collection name
_PATTERN_COLLECTION = "learned_patterns"


# ---------------------------------------------------------------------------
# PatternExtractor
# ---------------------------------------------------------------------------


class PatternExtractor:
    """
    Extracts and stores successful resume writing patterns.

    Patterns are keyed by type ("keyword" | "tone" | "structure") and scored
    by the overall application score that produced them, enabling downstream
    agents to bias toward proven high-signal language.

    Args:
        memory_service: Injected MemoryService (provides Mongo access).
        high_score_threshold: Minimum score to treat a resume as a positive
                              example (default 75.0).
        max_keyword_length:   Maximum token count for a valid keyword phrase.
        min_keyword_freq:     Minimum frequency across corpus for a keyword
                              to be stored (default 2).
    """

    def __init__(
        self,
        memory_service:       Optional[MemoryService] = None,
        high_score_threshold: float = 75.0,
        max_keyword_length:   int   = 4,
        min_keyword_freq:     int   = 2,
    ) -> None:
        self._memory              = memory_service or get_memory_service()
        self._high_score          = high_score_threshold
        self._max_kw_length       = max_keyword_length
        self._min_freq            = min_keyword_freq

    # ------------------------------------------------------------------
    # Public synchronous extraction methods
    # ------------------------------------------------------------------

    def extract_keywords(
        self,
        resume: str,
        score:  float,
        top_n:  int = 50,
    ) -> List[KeywordPattern]:
        """
        Extract the most frequent meaningful tokens from a resume text,
        weighted by the application score.

        Algorithm:
          1. Tokenise to lowercase words; remove stop-words and short tokens.
          2. Build unigram + bigram Counter.
          3. Weight frequency by score (higher score → keywords more trusted).
          4. Return top_n KeywordPattern objects sorted by weighted_freq desc.

        Args:
            resume: Full resume text (Markdown or plain text).
            score:  Overall evaluation score for this resume (0–100).
            top_n:  Maximum keywords to return.

        Returns:
            Sorted list of KeywordPattern dataclasses.
        """
        if not resume or not resume.strip():
            return []

        score_weight = max(0.1, score / 100.0)
        text         = re.sub(r"[^\w\s\-/+#.]", " ", resume.lower())
        raw_tokens   = [t.strip("-./") for t in text.split() if t.strip("-./")]

        # Filter tokens
        tokens = [
            t for t in raw_tokens
            if len(t) >= 2
            and t not in _STOP_WORDS
            and not t.isdigit()
            and not re.match(r"^\d+[%$]?$", t)
        ]

        # Unigrams
        counter: Counter = Counter(tokens)

        # Bigrams (adjacent pairs)
        for i in range(len(tokens) - 1):
            bigram = f"{tokens[i]} {tokens[i + 1]}"
            # Only keep bigrams where both parts are meaningful
            if (
                tokens[i] not in _STOP_WORDS
                and tokens[i + 1] not in _STOP_WORDS
                and len(tokens[i]) >= 3
                and len(tokens[i + 1]) >= 3
            ):
                counter[bigram] += 1

        # Extract context snippets for top keywords
        sentences = re.split(r"[.\n]", resume)

        patterns: List[KeywordPattern] = []
        for kw, freq in counter.most_common(top_n * 2):
            if freq < self._min_freq:
                continue
            if len(kw.split()) > self._max_kw_length:
                continue

            # Find up to 3 sentence contexts
            contexts = [
                s.strip()[:120]
                for s in sentences
                if kw.lower() in s.lower() and len(s.strip()) > 10
            ][:3]

            patterns.append(
                KeywordPattern(
                    keyword   = kw,
                    frequency = freq,
                    avg_score = round(score_weight * freq, 3),
                    contexts  = contexts,
                )
            )

        # Sort by weighted score
        patterns.sort(key=lambda p: p.avg_score, reverse=True)
        return patterns[:top_n]

    def extract_tone_markers(self, text: str) -> TonePattern:
        """
        Identify tone and seniority signals in resume text using regex.

        Detects:
          - Strong action verbs (starts of bullet points)
          - Quantifier phrases ("reduced by 40%", "saved $2M")
          - Leadership markers ("led", "owned", "architected")
          - Passive voice occurrences
          - Average sentence length

        Args:
            text: Resume text to analyse.

        Returns:
            TonePattern dataclass.
        """
        if not text:
            return TonePattern([], [], [], 0, 0.0)

        # Action verbs
        action_verb_matches = _ACTION_VERB_RE.findall(text)
        verb_counter        = Counter(v.lower() for v in action_verb_matches)
        action_verbs        = [v for v, _ in verb_counter.most_common(15)]

        # Quantifier phrases
        quantifier_phrases = [
            m.group(0).strip()
            for m in _QUANTIFIER_RE.finditer(text)
        ][:20]

        # Leadership markers
        leadership_matches = _LEADERSHIP_RE.findall(text)
        leadership_markers = list(
            dict.fromkeys(m.lower() for m in leadership_matches)
        )[:15]

        # Passive voice
        passive_count = len(_PASSIVE_RE.findall(text))

        # Avg sentence length (in words)
        sentences = [
            s.strip() for s in re.split(r"[.!?\n]", text)
            if len(s.strip()) > 10
        ]
        if sentences:
            word_counts      = [len(s.split()) for s in sentences]
            avg_sentence_len = round(sum(word_counts) / len(word_counts), 2)
        else:
            avg_sentence_len = 0.0

        return TonePattern(
            action_verbs        = action_verbs,
            quantifier_phrases  = quantifier_phrases,
            leadership_markers  = leadership_markers,
            passive_voice_count = passive_count,
            avg_sentence_length = avg_sentence_len,
        )

    def extract_structure_patterns(self, resume: str) -> StructurePattern:
        """
        Analyse the structural properties of a resume.

        Metrics:
          - Total bullet count and quantified bullet ratio
          - Average bullet length (words)
          - Section header count
          - Presence of summary and projects sections
          - Total word count

        Args:
            resume: Full resume text.

        Returns:
            StructurePattern dataclass.
        """
        if not resume:
            return StructurePattern(0, 0, 0.0, 0, False, False, 0, 0.0)

        bullets = _BULLET_RE.findall(resume)
        bullet_count = len(bullets)

        quantified = [b for b in bullets if _NUMBER_RE.search(b)]
        quantified_count = len(quantified)

        if bullets:
            word_lengths     = [len(b.split()) for b in bullets]
            avg_bullet_len   = round(sum(word_lengths) / len(word_lengths), 2)
        else:
            avg_bullet_len   = 0.0

        section_count = len(_SECTION_HEADER_RE.findall(resume))
        has_summary   = bool(_SUMMARY_RE.search(resume))
        has_projects  = bool(_PROJECTS_RE.search(resume))
        word_count    = len(resume.split())

        quantification_rate = (
            round(quantified_count / bullet_count, 3) if bullet_count > 0 else 0.0
        )

        return StructurePattern(
            bullet_count        = bullet_count,
            quantified_bullets  = quantified_count,
            avg_bullet_length   = avg_bullet_len,
            section_count       = section_count,
            has_summary         = has_summary,
            has_projects        = has_projects,
            total_word_count    = word_count,
            quantification_rate = quantification_rate,
        )

    # ------------------------------------------------------------------
    # Async DB methods
    # ------------------------------------------------------------------

    async def store_pattern(
        self,
        pattern_type: str,
        payload:      Dict[str, Any],
        score:        float,
        session_id:   str,
        role:         Optional[str] = None,
        company:      Optional[str] = None,
    ) -> bool:
        """
        Persist a pattern observation to MongoDB.

        Each document represents one observed pattern from one session.
        The collection grows over time and is queried by get_top_patterns().

        Args:
            pattern_type: "keyword" | "tone" | "structure"
            payload:      JSON-serialisable pattern data.
            score:        Overall application score for this observation.
            session_id:   Source session identifier.
            role:         Optional JD role title.
            company:      Optional company name.

        Returns:
            True on success, False on any DB error.
        """
        try:
            await self._memory.mongo._ensure_connected()
            coll = self._memory.mongo._db[_PATTERN_COLLECTION]

            doc: Dict[str, Any] = {
                "pattern_type": pattern_type,
                "payload":      payload,
                "score":        score,
                "session_id":   session_id,
                "role":         role,
                "company":      company,
                "created_at":   datetime.utcnow().isoformat(),
            }
            await coll.insert_one(doc)
            return True
        except Exception as exc:
            logger.error(
                "[pattern_extractor] store_pattern failed type=%s session=%s: %s",
                pattern_type, session_id, exc,
            )
            return False

    async def get_top_patterns(
        self,
        pattern_type: str,
        top_n:        int = 20,
        min_score:    float = 75.0,
        role_filter:  Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the most valuable stored patterns of a given type.

        Aggregation strategy:
          - Filter by pattern_type and minimum score.
          - For "keyword" patterns: aggregate by keyword, sum frequency,
            average score, take top_n by frequency * avg_score.
          - For "tone" and "structure": return the top_n raw documents
            sorted by score descending.

        Args:
            pattern_type: "keyword" | "tone" | "structure"
            top_n:        Maximum records to return.
            min_score:    Minimum score filter.
            role_filter:  Optional JD role filter (substring match).

        Returns:
            List of pattern dicts from MongoDB (projection drops _id).
        """
        try:
            await self._memory.mongo._ensure_connected()
            coll = self._memory.mongo._db[_PATTERN_COLLECTION]
        except Exception as exc:
            logger.error("[pattern_extractor] get_top_patterns DB connect failed: %s", exc)
            return []

        match_filter: Dict[str, Any] = {
            "pattern_type": pattern_type,
            "score":        {"$gte": min_score},
        }
        if role_filter:
            match_filter["role"] = {
                "$regex": re.escape(role_filter),
                "$options": "i",
            }

        try:
            if pattern_type == "keyword":
                return await self._aggregate_keyword_patterns(
                    coll, match_filter, top_n
                )
            else:
                return await self._fetch_top_raw_patterns(
                    coll, match_filter, top_n
                )
        except Exception as exc:
            logger.error(
                "[pattern_extractor] get_top_patterns query failed type=%s: %s",
                pattern_type, exc,
            )
            return []

    async def learn_from_history(self, limit: int = 50) -> Dict[str, int]:
        """
        Convenience method: pull recent high-scoring applications from Mongo,
        extract all three pattern types, and persist them.

        Returns:
            Summary dict: {keywords_stored, tone_stored, structure_stored}
        """
        logger.info("[pattern_extractor] learn_from_history limit=%d", limit)
        counts = {"keywords_stored": 0, "tone_stored": 0, "structure_stored": 0}

        try:
            records = await self._memory.retrieve_past_applications(limit=limit)
        except Exception as exc:
            logger.error("[pattern_extractor] history retrieval failed: %s", exc)
            return counts

        high_scoring = [
            r for r in records
            if (r.get("final_scores") or {}).get("overall", 0) >= self._high_score
        ]

        logger.info(
            "[pattern_extractor] high_scoring=%d / total=%d",
            len(high_scoring), len(records),
        )

        for record in high_scoring:
            resume     = record.get("resume_snapshot") or ""
            session_id = record.get("session_id") or ""
            score      = (record.get("final_scores") or {}).get("overall", 0.0)
            role       = record.get("jd_role")
            company    = record.get("company")

            if not resume or not session_id:
                continue

            # Keywords
            kws = self.extract_keywords(resume, score, top_n=30)
            if kws:
                kw_payload = [
                    {
                        "keyword":   k.keyword,
                        "frequency": k.frequency,
                        "avg_score": k.avg_score,
                    }
                    for k in kws[:30]
                ]
                ok = await self.store_pattern(
                    "keyword", {"keywords": kw_payload},
                    score, session_id, role, company,
                )
                if ok:
                    counts["keywords_stored"] += 1

            # Tone
            tone = self.extract_tone_markers(resume)
            ok = await self.store_pattern(
                "tone", asdict(tone),
                score, session_id, role, company,
            )
            if ok:
                counts["tone_stored"] += 1

            # Structure
            structure = self.extract_structure_patterns(resume)
            ok = await self.store_pattern(
                "structure", asdict(structure),
                score, session_id, role, company,
            )
            if ok:
                counts["structure_stored"] += 1

        logger.info("[pattern_extractor] learn_from_history complete: %s", counts)
        return counts

    # ------------------------------------------------------------------
    # Internal aggregation helpers
    # ------------------------------------------------------------------

    async def _aggregate_keyword_patterns(
        self,
        coll: Any,
        match_filter: Dict[str, Any],
        top_n: int,
    ) -> List[Dict[str, Any]]:
        """
        Aggregate keyword patterns: unwind keyword list and group by keyword,
        summing frequency and averaging score, then sort by value score.
        """
        pipeline = [
            {"$match":   match_filter},
            {"$unwind":  "$payload.keywords"},
            {"$group": {
                "_id":        "$payload.keywords.keyword",
                "total_freq": {"$sum":  "$payload.keywords.frequency"},
                "avg_score":  {"$avg":  "$score"},
                "appearances": {"$sum": 1},
            }},
            {"$addFields": {
                "value_score": {
                    "$multiply": ["$total_freq", "$avg_score"]
                },
            }},
            {"$sort":    {"value_score": -1}},
            {"$limit":   top_n},
            {"$project": {"_id": 0, "keyword": "$_id", "total_freq": 1, "avg_score": 1, "appearances": 1, "value_score": 1}},
        ]

        results: List[Dict[str, Any]] = []
        async for doc in coll.aggregate(pipeline):
            results.append(doc)
        return results

    async def _fetch_top_raw_patterns(
        self,
        coll: Any,
        match_filter: Dict[str, Any],
        top_n: int,
    ) -> List[Dict[str, Any]]:
        """Return top_n raw pattern documents sorted by score descending."""
        cursor = (
            coll.find(match_filter, {"_id": 0})
            .sort("score", -1)
            .limit(top_n)
        )
        results: List[Dict[str, Any]] = []
        async for doc in cursor:
            results.append(doc)
        return results


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_extractor_instance: Optional[PatternExtractor] = None


def get_pattern_extractor() -> PatternExtractor:
    """Return the process-wide PatternExtractor singleton."""
    global _extractor_instance
    if _extractor_instance is None:
        _extractor_instance = PatternExtractor()
    return _extractor_instance