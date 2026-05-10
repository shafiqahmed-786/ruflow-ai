"""
backend/tools/pdf_parser.py

ResumeParser — extracts structured data from resume PDFs and raw text.

Dependencies:
    pip install pymupdf unstructured python-docx spacy
    python -m spacy download en_core_web_sm
"""

from __future__ import annotations

import io
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from backend.orchestrator.state import ParsedResume

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional heavyweight imports — graceful degradation if not installed
# ---------------------------------------------------------------------------

try:
    import fitz  # PyMuPDF
    _PYMUPDF_AVAILABLE = True
except ImportError:
    _PYMUPDF_AVAILABLE = False
    logger.warning("PyMuPDF not installed. PDF parsing will use fallback text extraction.")

try:
    import spacy
    _nlp = spacy.load("en_core_web_sm")
    _SPACY_AVAILABLE = True
except (ImportError, OSError):
    _nlp = None
    _SPACY_AVAILABLE = False
    logger.warning("spaCy en_core_web_sm not available. NER-based extraction disabled.")


# ---------------------------------------------------------------------------
# Section header patterns
# ---------------------------------------------------------------------------

_SECTION_PATTERNS: Dict[str, re.Pattern] = {
    "experience":      re.compile(
        r"^\s*(work\s+)?experience|employment(\s+history)?|professional\s+background",
        re.IGNORECASE | re.MULTILINE,
    ),
    "education":       re.compile(
        r"^\s*education|academic(\s+background)?|degrees?",
        re.IGNORECASE | re.MULTILINE,
    ),
    "skills":          re.compile(
        r"^\s*(technical\s+)?skills|technologies|core\s+competencies|proficiencies",
        re.IGNORECASE | re.MULTILINE,
    ),
    "projects":        re.compile(
        r"^\s*projects?|portfolio|open[\s-]source",
        re.IGNORECASE | re.MULTILINE,
    ),
    "certifications":  re.compile(
        r"^\s*certifications?|licenses?|credentials",
        re.IGNORECASE | re.MULTILINE,
    ),
    "summary":         re.compile(
        r"^\s*(professional\s+)?summary|profile|objective|about\s+me",
        re.IGNORECASE | re.MULTILINE,
    ),
    "languages":       re.compile(
        r"^\s*languages?",
        re.IGNORECASE | re.MULTILINE,
    ),
}

# Contact extraction patterns
_EMAIL_RE   = re.compile(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", re.IGNORECASE)
_PHONE_RE   = re.compile(r"(\+?\d[\d\s\-().]{7,}\d)")
_LINKEDIN_RE = re.compile(r"linkedin\.com/in/([\w\-]+)", re.IGNORECASE)
_GITHUB_RE  = re.compile(r"github\.com/([\w\-]+)", re.IGNORECASE)

# Date range pattern used for parsing experience / education blocks
_DATE_RANGE_RE = re.compile(
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|"
    r"dec(?:ember)?)[\s,]*(\d{4})\s*[-–—to]+\s*"
    r"(present|current|now|"
    r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|"
    r"dec(?:ember)?)[\s,]*(\d{4})?",
    re.IGNORECASE,
)

# Common tech skill keywords for extraction fallback
_TECH_SKILLS_VOCABULARY: List[str] = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust",
    "kotlin", "swift", "ruby", "php", "scala", "r", "matlab",
    "react", "vue", "angular", "nextjs", "fastapi", "django", "flask",
    "spring", "express", "rails", "laravel",
    "aws", "gcp", "azure", "kubernetes", "docker", "terraform", "ansible",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra",
    "kafka", "rabbitmq", "spark", "hadoop", "airflow",
    "pytorch", "tensorflow", "scikit-learn", "pandas", "numpy",
    "machine learning", "deep learning", "nlp", "llm", "langchain",
    "ci/cd", "git", "jenkins", "github actions", "graphql", "rest api",
    "microservices", "agile", "scrum", "devops", "mlops",
]


# ---------------------------------------------------------------------------
# ResumeParser
# ---------------------------------------------------------------------------


class ResumeParser:
    """
    Parse resume content from PDF bytes or plain text into a structured
    ParsedResume TypedDict.

    Methods:
        parse_pdf(pdf_bytes) → ParsedResume
        parse_text(text)     → ParsedResume
        structure_resume(text) → ParsedResume
        extract_keywords(text, jd_keywords) → List[str]
    """

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def parse_pdf(self, pdf_bytes: bytes) -> ParsedResume:
        """
        Extract text from PDF bytes and structure it.

        Tries PyMuPDF first; falls back to naive byte decoding.

        Args:
            pdf_bytes: Raw binary PDF content.

        Returns:
            Structured ParsedResume dict.

        Raises:
            ValueError: If pdf_bytes is empty or not a valid PDF.
        """
        if not pdf_bytes:
            raise ValueError("pdf_bytes must not be empty")

        raw_text = self._extract_text_from_pdf(pdf_bytes)
        if not raw_text.strip():
            raise ValueError("PDF appears to contain no extractable text (may be image-based)")

        return self.structure_resume(raw_text)

    def parse_text(self, text: str) -> ParsedResume:
        """
        Structure a plain-text resume.

        Args:
            text: Raw resume as a string (any line ending convention).

        Returns:
            Structured ParsedResume dict.
        """
        if not text or not text.strip():
            raise ValueError("text must not be empty")
        return self.structure_resume(text)

    def structure_resume(self, raw_text: str) -> ParsedResume:
        """
        Convert raw resume text into a ParsedResume TypedDict by:
        1. Normalising whitespace.
        2. Extracting contact fields with regex.
        3. Splitting into sections via header detection.
        4. Parsing experience and education blocks.
        5. Extracting skills from skills section + body.

        Args:
            raw_text: Normalised plain text of the resume.

        Returns:
            Fully populated ParsedResume dict.
        """
        text = self._normalise_text(raw_text)
        sections = self._split_into_sections(text)

        full_name = self._extract_name(text)
        email     = self._extract_first(_EMAIL_RE, text)
        phone     = self._extract_phone(text)
        linkedin  = self._extract_first(_LINKEDIN_RE, text, group=1)
        github    = self._extract_first(_GITHUB_RE, text, group=1)
        location  = self._extract_location(text)

        summary        = sections.get("summary", "").strip()
        experience     = self._parse_experience(sections.get("experience", ""))
        education      = self._parse_education(sections.get("education", ""))
        skills         = self._parse_skills(sections.get("skills", ""), text)
        certifications = self._parse_certifications(sections.get("certifications", ""))
        projects       = self._parse_projects(sections.get("projects", ""))
        languages      = self._parse_languages(sections.get("languages", ""))

        return ParsedResume(
            full_name=full_name,
            email=email,
            phone=phone,
            linkedin_url=f"https://linkedin.com/in/{linkedin}" if linkedin else "",
            github_url=f"https://github.com/{github}" if github else "",
            location=location,
            summary=summary,
            experience=experience,
            education=education,
            skills=skills,
            certifications=certifications,
            projects=projects,
            languages=languages,
            raw_text=raw_text,
        )

    def extract_keywords(
        self,
        text: str,
        jd_keywords: Optional[List[str]] = None,
        top_n: int = 50,
    ) -> List[str]:
        """
        Extract relevant technical keywords from resume text.

        Strategy:
        1. Match against ``_TECH_SKILLS_VOCABULARY`` (exact + partial).
        2. If JD keywords are provided, also score by intersection.
        3. Return deduplicated, lowercased list sorted by relevance.

        Args:
            text: Resume text to analyse.
            jd_keywords: Optional list of target JD keywords to prioritise.
            top_n: Maximum keywords to return.

        Returns:
            Deduplicated list of keywords found in the text.
        """
        lower_text = text.lower()
        found: Dict[str, int] = {}

        # Vocabulary-based extraction
        for skill in _TECH_SKILLS_VOCABULARY:
            if skill.lower() in lower_text:
                found[skill] = found.get(skill, 0) + 2  # base score

        # JD keyword intersection bonus
        if jd_keywords:
            for kw in jd_keywords:
                if kw.lower() in lower_text:
                    found[kw.lower()] = found.get(kw.lower(), 0) + 5  # priority boost

        # spaCy noun-chunk extraction (if available)
        if _SPACY_AVAILABLE and _nlp is not None:
            try:
                doc = _nlp(text[:50_000])  # spaCy limit
                for chunk in doc.noun_chunks:
                    clean = chunk.text.strip().lower()
                    if 2 <= len(clean) <= 40 and clean not in found:
                        found[clean] = 1
            except Exception:
                pass

        sorted_kws = sorted(found, key=lambda k: found[k], reverse=True)
        return sorted_kws[:top_n]

    # ------------------------------------------------------------------
    # PDF text extraction
    # ------------------------------------------------------------------

    def _extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Extract all text from a PDF using PyMuPDF (fitz)."""
        if not _PYMUPDF_AVAILABLE:
            return self._fallback_pdf_extraction(pdf_bytes)

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            pages: List[str] = []
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                pages.append(page.get_text("text"))
            doc.close()
            return "\n".join(pages)
        except Exception as exc:
            logger.error("PyMuPDF extraction failed: %s", exc)
            return self._fallback_pdf_extraction(pdf_bytes)

    @staticmethod
    def _fallback_pdf_extraction(pdf_bytes: bytes) -> str:
        """
        Last-resort extraction: decode bytes as UTF-8/latin-1 and strip
        binary garbage.  This produces noisy output but is better than
        raising an exception.
        """
        try:
            text = pdf_bytes.decode("utf-8", errors="replace")
        except Exception:
            text = pdf_bytes.decode("latin-1", errors="replace")

        # Remove lines that look like binary noise (high ratio of non-printable)
        clean_lines = []
        for line in text.splitlines():
            printable = sum(1 for c in line if c.isprintable())
            if len(line) == 0 or printable / len(line) > 0.7:
                clean_lines.append(line)
        return "\n".join(clean_lines)

    # ------------------------------------------------------------------
    # Text normalisation
    # ------------------------------------------------------------------

    @staticmethod
    def _normalise_text(text: str) -> str:
        """
        Normalise unicode, strip non-printable characters, and
        collapse excessive whitespace while preserving paragraph breaks.
        """
        # Normalise unicode dashes and quotes
        text = text.replace("\u2013", "-").replace("\u2014", "-")
        text = text.replace("\u2018", "'").replace("\u2019", "'")
        text = text.replace("\u2022", "-").replace("\u00b7", "-")

        # Collapse 3+ blank lines into two
        text = re.sub(r"\n{3,}", "\n\n", text)

        # Strip trailing whitespace per line
        lines = [line.rstrip() for line in text.splitlines()]
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Section splitting
    # ------------------------------------------------------------------

    def _split_into_sections(self, text: str) -> Dict[str, str]:
        """
        Detect section boundaries using header patterns and return a dict
        mapping section name → section content.

        Unmatched leading text is stored under the key 'header' and used
        for contact extraction.
        """
        # Find all section header positions
        hits: List[Tuple[int, str]] = []
        for section_name, pattern in _SECTION_PATTERNS.items():
            for m in pattern.finditer(text):
                hits.append((m.start(), section_name))

        hits.sort(key=lambda x: x[0])

        sections: Dict[str, str] = {}
        if not hits:
            sections["header"] = text
            return sections

        # Text before the first section header
        sections["header"] = text[: hits[0][0]]

        for i, (pos, name) in enumerate(hits):
            end = hits[i + 1][0] if i + 1 < len(hits) else len(text)
            # Skip the header line itself
            body_start = text.find("\n", pos)
            body = text[body_start:end].strip() if body_start != -1 else ""
            # If same section appears twice, concatenate
            sections[name] = (sections.get(name, "") + "\n" + body).strip()

        return sections

    # ------------------------------------------------------------------
    # Contact field extractors
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_first(
        pattern: re.Pattern, text: str, group: int = 0
    ) -> str:
        m = pattern.search(text)
        return m.group(group).strip() if m else ""

    @staticmethod
    def _extract_phone(text: str) -> str:
        m = _PHONE_RE.search(text)
        if not m:
            return ""
        raw = m.group(1).strip()
        # Keep only if it's reasonably phone-like
        digits = re.sub(r"\D", "", raw)
        return raw if 7 <= len(digits) <= 15 else ""

    def _extract_name(self, text: str) -> str:
        """
        Heuristic: the full name is usually the first non-empty line.
        Validate with spaCy PERSON entity if available.
        """
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if not lines:
            return ""

        candidate = lines[0]

        # Reject if it looks like a URL, email, or section header
        if re.search(r"[@:/\\]", candidate):
            return ""
        if len(candidate.split()) > 6:
            return ""

        if _SPACY_AVAILABLE and _nlp is not None:
            try:
                doc = _nlp(candidate)
                persons = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
                if persons:
                    return persons[0]
            except Exception:
                pass

        # Fallback: return first line if it looks like a name (2–4 words, title case)
        words = candidate.split()
        if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
            return candidate

        return ""

    @staticmethod
    def _extract_location(text: str) -> str:
        """
        Extract city/state from the first ~5 lines using a loose pattern
        for "City, State" or "City, Country" formats.
        """
        header_text = "\n".join(text.splitlines()[:8])
        m = re.search(
            r"\b([A-Z][a-zA-Z\s]+),\s*([A-Z]{2}|[A-Z][a-zA-Z\s]+)\b",
            header_text,
        )
        return m.group(0).strip() if m else ""

    # ------------------------------------------------------------------
    # Section parsers
    # ------------------------------------------------------------------

    def _parse_experience(self, text: str) -> List[Dict[str, Any]]:
        """
        Parse the experience section into a list of role dicts.

        Each role dict contains:
            company, title, start, end, bullets
        """
        if not text.strip():
            return []

        roles: List[Dict[str, Any]] = []
        # Split on double-newlines to find role blocks
        blocks = re.split(r"\n{2,}", text.strip())

        for block in blocks:
            if not block.strip():
                continue

            lines = [l.strip() for l in block.splitlines() if l.strip()]
            if not lines:
                continue

            role: Dict[str, Any] = {
                "company": "",
                "title": "",
                "start": "",
                "end": "",
                "bullets": [],
            }

            # Date range detection
            date_match = _DATE_RANGE_RE.search(block)
            if date_match:
                role["start"] = f"{date_match.group(1)} {date_match.group(2)}"
                end_month = date_match.group(3)
                end_year  = date_match.group(4) or ""
                role["end"] = (
                    "Present"
                    if end_month.lower() in {"present", "current", "now"}
                    else f"{end_month} {end_year}".strip()
                )

            # Extract title and company from first 2 non-date lines
            non_date_lines = [
                l for l in lines if not _DATE_RANGE_RE.search(l)
            ]
            if non_date_lines:
                role["title"] = non_date_lines[0]
            if len(non_date_lines) > 1:
                role["company"] = non_date_lines[1]

            # Bullet points
            role["bullets"] = [
                re.sub(r"^[-•*·]\s*", "", l).strip()
                for l in lines
                if re.match(r"^[-•*·]\s+", l) or (l.startswith(" ") and len(l) > 10)
            ]

            if role["title"] or role["company"] or role["bullets"]:
                roles.append(role)

        return roles

    def _parse_education(self, text: str) -> List[Dict[str, Any]]:
        """
        Parse education section into list of dicts:
            institution, degree, field, graduation_year
        """
        if not text.strip():
            return []

        entries: List[Dict[str, Any]] = []
        degree_re = re.compile(
            r"(bachelor|master|phd|ph\.d|doctorate|b\.s|b\.a|m\.s|m\.a|mba|b\.e|m\.e|"
            r"associate|diploma|certificate)",
            re.IGNORECASE,
        )
        year_re = re.compile(r"\b(19|20)\d{2}\b")

        blocks = re.split(r"\n{2,}", text.strip())
        for block in blocks:
            if not block.strip():
                continue
            lines = [l.strip() for l in block.splitlines() if l.strip()]
            entry: Dict[str, Any] = {
                "institution": "",
                "degree": "",
                "field": "",
                "graduation_year": "",
            }

            year_m = year_re.findall(block)
            if year_m:
                entry["graduation_year"] = year_m[-1]  # last year = graduation

            deg_m = degree_re.search(block)
            if deg_m:
                entry["degree"] = deg_m.group(0)

            # First non-degree, non-year line → institution
            for line in lines:
                if not degree_re.search(line) and not year_re.search(line):
                    entry["institution"] = line
                    break

            if entry["institution"] or entry["degree"]:
                entries.append(entry)

        return entries

    def _parse_skills(self, skills_section: str, full_text: str) -> List[str]:
        """
        Extract a deduplicated list of technical skills.

        Combines:
        1. Items from the explicit skills section (comma/newline separated).
        2. Tech vocabulary matches from the full resume text.
        """
        found: List[str] = []

        # Parse skills section
        if skills_section:
            # Split on common delimiters
            items = re.split(r"[,|\n•\-/]", skills_section)
            for item in items:
                clean = item.strip().strip("()[]")
                if 1 < len(clean) < 50:
                    found.append(clean)

        # Vocabulary sweep over full text
        lower_text = full_text.lower()
        for skill in _TECH_SKILLS_VOCABULARY:
            if skill.lower() in lower_text and skill not in found:
                found.append(skill)

        # Deduplicate preserving order (case-insensitive)
        seen: set = set()
        unique: List[str] = []
        for s in found:
            key = s.lower()
            if key not in seen:
                seen.add(key)
                unique.append(s)

        return unique

    @staticmethod
    def _parse_certifications(text: str) -> List[str]:
        """Return a list of certification strings from the section text."""
        if not text.strip():
            return []
        return [
            re.sub(r"^[-•*·]\s*", "", l).strip()
            for l in text.splitlines()
            if l.strip() and len(l.strip()) > 3
        ]

    def _parse_projects(self, text: str) -> List[Dict[str, Any]]:
        """
        Parse projects section into list of dicts:
            name, description, tech_stack, url
        """
        if not text.strip():
            return []

        projects: List[Dict[str, Any]] = []
        blocks = re.split(r"\n{2,}", text.strip())
        url_re = re.compile(r"https?://\S+")

        for block in blocks:
            if not block.strip():
                continue
            lines = [l.strip() for l in block.splitlines() if l.strip()]
            if not lines:
                continue

            project: Dict[str, Any] = {
                "name": lines[0],
                "description": " ".join(lines[1:]) if len(lines) > 1 else "",
                "tech_stack": [],
                "url": "",
            }

            url_m = url_re.search(block)
            if url_m:
                project["url"] = url_m.group(0)

            # Extract tech from vocabulary
            block_lower = block.lower()
            project["tech_stack"] = [
                sk for sk in _TECH_SKILLS_VOCABULARY if sk in block_lower
            ]

            projects.append(project)

        return projects

    @staticmethod
    def _parse_languages(text: str) -> List[str]:
        """Return a list of spoken/written language strings."""
        if not text.strip():
            return []
        return [
            re.sub(r"^[-•*·]\s*", "", l).strip()
            for l in text.splitlines()
            if l.strip() and len(l.strip()) > 1
        ]