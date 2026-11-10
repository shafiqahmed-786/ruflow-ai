"""Local technical-specification monitor. Automated conclusions remain evidence-bound."""

from __future__ import annotations

import contextlib
import fcntl
import hashlib
import ipaddress
import io
import json
import os
import re
import shutil
import socket
import sqlite3
import time
import urllib.parse
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator


ATITINKA = "ATITINKA"
NEATITINKA = "NEATITINKA"
REIKIA_PATIKRINTI = "REIKIA PATIKRINTI"
OCR_MARKER = "[OCR - REIKIA PATIKRINTI]"

_NUMBER = r"[-+]?\d+(?:[.,]\d+)?"
_UNIT = r"(?:mėnesiai|mėnesių|months|month|years|year|metai|metų|mėn|mm|cm|kg|kw|ma|°c|db|mhz|ghz|hz|m|g|w|v|a|c|%)"
_QUANTITY = re.compile(rf"({_NUMBER})(?:\s*({_UNIT})(?!\w))?", re.IGNORECASE)
_QUANTITY_FULL = re.compile(rf"\s*({_NUMBER})(?:\s*({_UNIT})(?!\w))?\s*", re.IGNORECASE)
_UNIT_FACTORS = {
    "mm": ("length", 0.001), "cm": ("length", 0.01), "m": ("length", 1.0),
    "g": ("mass", 0.001), "kg": ("mass", 1.0),
    "w": ("power", 1.0), "kw": ("power", 1000.0),
    "v": ("voltage", 1.0), "a": ("current", 1.0), "ma": ("current", 0.001),
    "°c": ("temperature", 1.0), "c": ("temperature", 1.0),
    "db": ("sound", 1.0), "hz": ("frequency", 1.0),
    "mhz": ("frequency", 1_000_000.0), "ghz": ("frequency", 1_000_000_000.0),
    "%": ("percent", 1.0), "metai": ("time", 12.0), "metų": ("time", 12.0),
    "year": ("time", 12.0), "years": ("time", 12.0), "mėn": ("time", 1.0),
    "mėnesiai": ("time", 1.0), "mėnesių": ("time", 1.0),
    "month": ("time", 1.0), "months": ("time", 1.0),
}


@dataclass
class Constraint:
    kind: str
    lower: float | None = None
    upper: float | None = None
    unit: str | None = None
    original: str = ""


@dataclass
class Requirement:
    name: str
    text: str
    constraint: dict[str, Any] | None = None
    page: int | None = None
    source: str = ""


class AlreadyRunningError(RuntimeError):
    pass


def parse_quantity(value: str) -> tuple[float, str | None] | None:
    match = _QUANTITY_FULL.fullmatch(value.replace("\u00a0", " "))
    if not match:
        return None
    number = float(match.group(1).replace(",", "."))
    unit = match.group(2)
    if unit:
        unit = unit.casefold().replace(" ", "")
        if unit in ("year", "years"):
            unit = "year" if unit == "year" else "years"
        elif unit.startswith("mėn"):
            unit = {"mėn": "mėn", "mėnesiai": "mėnesiai", "mėnesių": "mėnesių"}.get(unit, unit)
    return number, unit


def parse_constraint(text: str) -> Constraint | None:
    """Parse common exact, min, max and interval expressions without guessing."""
    normalized = text.casefold().strip().replace("\u00a0", " ").replace("–", "-").replace("—", "-")
    pair = re.fullmatch(rf"\s*({_NUMBER})\s*(?:-|iki|to)\s*({_NUMBER})(?:\s*({_UNIT})(?!\w))?\s*", normalized)
    if pair:
        low, high = float(pair.group(1).replace(",", ".")), float(pair.group(2).replace(",", "."))
        if low > high:
            return None
        return Constraint("range", low, high, pair.group(3).casefold() if pair.group(3) else None, text)
    op = re.match(r"^(>=|≥|<=|≤|>|<|ne mažiau kaip|mažiausiai|min(?:imum)?|ne daugiau kaip|daugiausiai|max(?:imum)?|tiksliai)\s*", normalized)
    qty = parse_quantity(normalized[op.end():] if op else normalized)
    if qty:
        token = op.group(1) if op else "tiksliai"
        if token in (">=", "≥", "ne mažiau kaip", "mažiausiai", "min", "minimum", ">"):
            return Constraint("gt" if token == ">" else "min", lower=qty[0], unit=qty[1], original=text)
        if token in ("<=", "≤", "ne daugiau kaip", "daugiausiai", "max", "maximum", "<"):
            return Constraint("lt" if token == "<" else "max", upper=qty[0], unit=qty[1], original=text)
        return Constraint("exact", lower=qty[0], upper=qty[0], unit=qty[1], original=text)
    return None


def compare_numeric(requirement: Constraint | dict[str, Any], candidate: str | float) -> str:
    """Compare a candidate value with a parsed requirement; incompatible units need review."""
    req = requirement if isinstance(requirement, Constraint) else Constraint(**requirement)
    if isinstance(candidate, (int, float)):
        value, unit = float(candidate), req.unit
    else:
        parsed = parse_quantity(candidate)
        if not parsed:
            return REIKIA_PATIKRINTI
        value, unit = parsed
    req_unit = (req.unit or "").casefold()
    cand_unit = (unit or "").casefold()
    if req_unit or cand_unit:
        left, right = _UNIT_FACTORS.get(req_unit), _UNIT_FACTORS.get(cand_unit)
        if not left or not right or left[0] != right[0]:
            return REIKIA_PATIKRINTI
        value *= right[1] / left[1]
    if req.kind == "min":
        meets = value >= float(req.lower)
    elif req.kind == "gt":
        meets = value > float(req.lower)
    elif req.kind == "max":
        meets = value <= float(req.upper)
    elif req.kind == "lt":
        meets = value < float(req.upper)
    elif req.kind == "range":
        meets = float(req.lower) <= value <= float(req.upper)
    elif req.kind == "exact":
        meets = abs(value - float(req.lower)) <= max(1e-8, abs(float(req.lower)) * 1e-8)
    else:
        return REIKIA_PATIKRINTI
    return ATITINKA if meets else NEATITINKA


def is_allowed_schedule_time(now: datetime, times: list[str]) -> bool:
    """Only permit exact configured minutes; delayed launchd wake-ups are rejected."""
    return now.strftime("%H:%M") in times


@contextlib.contextmanager
def single_instance(lock_path: Path) -> Iterator[None]:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise AlreadyRunningError("Tikrinimas jau vykdomas; naujas procesas nepradėtas.") from error
        yield
    finally:
        os.close(descriptor)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def initialize_database(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as db:
        db.execute("""CREATE TABLE IF NOT EXISTS documents(
            id INTEGER PRIMARY KEY, source TEXT NOT NULL, local_path TEXT NOT NULL,
            sha256 TEXT NOT NULL, analyzed_at TEXT NOT NULL, result_json TEXT NOT NULL,
            UNIQUE(source, sha256))""")
        db.execute("""CREATE TABLE IF NOT EXISTS run_history(
            id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
            status TEXT NOT NULL, details TEXT NOT NULL)""")
        db.execute("""CREATE TABLE IF NOT EXISTS search_cache(
            query TEXT PRIMARY KEY, checked_at REAL NOT NULL, result_json TEXT NOT NULL)""")


def cached_analysis(db_path: Path, source: str, digest: str) -> dict[str, Any] | None:
    with sqlite3.connect(db_path) as db:
        row = db.execute(
            "SELECT result_json FROM documents WHERE source=? AND sha256=?",
            (source, digest),
        ).fetchone()
    return json.loads(row[0]) if row else None


def save_analysis(db_path: Path, source: str, path: Path, digest: str, result: dict[str, Any]) -> None:
    with sqlite3.connect(db_path) as db:
        db.execute(
            """INSERT OR REPLACE INTO documents(source,local_path,sha256,analyzed_at,result_json)
               VALUES(?,?,?,?,?)""",
            (source, str(path), digest, datetime.now().astimezone().isoformat(), json.dumps(result, ensure_ascii=False)),
        )


def extract_pdf_pages(path: Path) -> list[str]:
    from pypdf import PdfReader

    pages = [page.extract_text() or "" for page in PdfReader(str(path)).pages]
    empty_pages = [index for index, text in enumerate(pages) if not text.strip()]
    if not empty_pages:
        return pages
    if not shutil.which("tesseract"):
        raise RuntimeError(
            "PDF turi nuskaitytų puslapių be teksto; įdiekite Tesseract OCR (brew install tesseract), "
            "kad būtų galima juos perskaityti."
        )
    import fitz
    import pytesseract

    pdf = fitz.open(path)
    for index in empty_pages:
        pixmap = pdf[index].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        from PIL import Image

        pages[index] = OCR_MARKER + "\n" + pytesseract.image_to_string(
            Image.open(io.BytesIO(pixmap.tobytes("png"))), lang="lit+eng"
        )
    return pages


def extract_document_text(path: Path) -> list[str]:
    suffix = path.suffix.casefold()
    if suffix == ".pdf":
        return extract_pdf_pages(path)
    if suffix == ".docx":
        from docx import Document

        doc = Document(str(path))
        lines = [p.text for p in doc.paragraphs]
        for table in doc.tables:
            lines.extend(" | ".join(cell.text for cell in row.cells) for row in table.rows)
        return ["\n".join(lines)]
    return [path.read_text(encoding="utf-8", errors="replace")]


_MODEL_PATTERN = re.compile(
    r"\b(?:model\s*(?:no\.?|number)\s*|model(?:is|io)?|model|tipas|type)\s*[:#-]?\s*"
    r"([A-Z0-9][A-Z0-9._/-]{1,40})",
    re.IGNORECASE,
)


def document_models(pages: list[str]) -> list[str]:
    models: dict[str, str] = {}
    for page in pages:
        for line in page.splitlines():
            for match in _MODEL_PATTERN.finditer(line.strip()):
                model = match.group(1).rstrip(".,;:")
                models.setdefault(model.casefold(), model)
    return list(models.values())


def document_title(path: str | Path, pages: list[str]) -> str:
    models = document_models(pages)
    return models[0] if len(models) == 1 else Path(path).stem


def extract_requirements(pages: list[str], source: str = "") -> list[Requirement]:
    """Extract clearly labelled numeric/standard/certificate/warranty candidates."""
    requirements: list[Requirement] = []
    seen: set[str] = set()
    for page_number, page in enumerate(pages, 1):
        for line in page.splitlines():
            clean = " ".join(line.split()).strip(" •\t-")
            if len(clean) < 8 or len(clean) > 400:
                continue
            looks_relevant = bool(_QUANTITY.search(clean)) or bool(
                re.search(r"standart|sertifikat|garantij|reikalavim|prival|atitikt", clean, re.I)
            )
            if not looks_relevant:
                continue
            label, sep, value = clean.partition(":")
            if not sep or len(label.strip()) < 2:
                label, value = clean, clean
            key = clean.casefold()
            if key in seen:
                continue
            seen.add(key)
            constraint = None if page.startswith(OCR_MARKER) else parse_constraint(value)
            requirements.append(Requirement(label.strip()[:120], clean, asdict(constraint) if constraint else None,
                                             page_number, source))
    return requirements


def compare_document(requirements: list[Requirement], pages: list[str], document: str, source: str) -> list[dict[str, Any]]:
    lines_by_page = [(number, " ".join(line.split())) for number, page in enumerate(pages, 1) for line in page.splitlines()]
    model = document_title(document, pages)
    multiple_models = len(document_models(pages)) > 1
    evidence_rows: list[dict[str, Any]] = []
    for req in requirements:
        exact_name = req.name.casefold().strip()
        matches = [(page, line) for page, line in lines_by_page
                   if exact_name and line.partition(":")[0].strip().casefold() == exact_name]
        if (req.constraint and len(matches) == 1 and not multiple_models
                and not pages[matches[0][0] - 1].startswith(OCR_MARKER)
                and parse_quantity(matches[0][1].partition(":")[2])):
            page_number, line = matches[0]
            value = line.partition(":")[2].strip()
            status = compare_numeric(req.constraint, value)
            explanation = ("Palyginta pagal dokumente aiškiai įvardytą parametrą ir jo skaitinę reikšmę."
                           if status != REIKIA_PATIKRINTI else "Reikšmės vienetai nesuderinami arba neaiškūs.")
        else:
            page_number, line = matches[0] if matches else (None, "")
            value = line.partition(":")[2].strip() if line else ""
            status = REIKIA_PATIKRINTI
            explanation = ("Dokumente yra keli modeliai; ryšį su reikšme turi patikrinti žmogus."
                           if multiple_models else
                           "Parametro reikšmė nerasta, dviprasmė arba pateikta keliuose įrašuose.")
        evidence_rows.append({
            "requirement": req.text, "requirement_name": req.name,
            "requirement_page": req.page, "model": model,
            "status": status, "candidate_value": value, "evidence": line,
            "document": document, "page": page_number, "url": source,
            "requirement_source": req.source,
            "explanation": explanation,
        })
    return evidence_rows


def read_excel_urls(path: Path) -> list[str]:
    from openpyxl import load_workbook

    workbook = load_workbook(path, read_only=False, data_only=True)
    urls: list[str] = []
    for sheet in workbook.worksheets:
        for row in sheet.iter_rows():
            for cell in row:
                candidates = [cell.hyperlink.target if cell.hyperlink else None, cell.value]
                for candidate in candidates:
                    if isinstance(candidate, str) and candidate.strip().startswith(("http://", "https://")):
                        if candidate.strip() not in urls:
                            urls.append(candidate.strip())
    workbook.close()
    return urls


def validate_public_url(target_url: str) -> None:
    parsed_url = urllib.parse.urlparse(target_url)
    if parsed_url.scheme not in ("http", "https") or not parsed_url.hostname or parsed_url.username or parsed_url.password:
        raise ValueError(f"Leidžiamos tik viešos HTTP(S) nuorodos be prisijungimo duomenų: {target_url}")
    try:
        addresses = [ipaddress.ip_address(parsed_url.hostname)]
    except ValueError:
        try:
            addresses = [
                ipaddress.ip_address(result[4][0])
                for result in socket.getaddrinfo(parsed_url.hostname, parsed_url.port or (443 if parsed_url.scheme == "https" else 80))
            ]
        except socket.gaierror as error:
            raise ValueError(f"Nepavyko nustatyti viešo šaltinio adreso: {target_url}") from error
    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError(f"Prie privačių ar lokalių adresų jungtis draudžiama: {target_url}")


def fetch_public_bytes(target_url: str, timeout: int = 25, max_bytes: int = 50 * 1024 * 1024) -> tuple[str, str, bytes]:
    import requests

    current_url = target_url
    for _ in range(6):
        validate_public_url(current_url)
        with requests.get(current_url, timeout=timeout,
                          headers={"User-Agent": "TS-spec-monitor/1.0"},
                          stream=True, allow_redirects=False) as response:
            if response.is_redirect:
                location = response.headers.get("Location")
                if not location:
                    raise ValueError(f"Peradresavime trūksta paskirties: {current_url}")
                current_url = urllib.parse.urljoin(current_url, location)
                continue
            response.raise_for_status()
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > max_bytes:
                raise ValueError(f"Dokumentas viršija atsisiuntimo ribą ({max_bytes} baitų): {current_url}")
            body = bytearray()
            for chunk in response.iter_content(chunk_size=64 * 1024):
                body.extend(chunk)
                if len(body) > max_bytes:
                    raise ValueError(f"Dokumentas viršija atsisiuntimo ribą ({max_bytes} baitų): {current_url}")
            return response.url, response.headers.get("Content-Type", "").casefold(), bytes(body)
    raise ValueError(f"Per daug peradresavimų: {target_url}")


def render_public_page(url: str, timeout: int = 25) -> tuple[str, str]:
    """Render a public page, blocking private network targets and browser persistence."""
    from playwright.sync_api import Error as PlaywrightError, sync_playwright

    validate_public_url(url)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                context = browser.new_context(service_workers="block", accept_downloads=False)
                def guard(route: Any) -> None:
                    try:
                        if route.request.method not in ("GET", "HEAD"):
                            raise ValueError("Leidžiamos tik skaitymo užklausos")
                        validate_public_url(route.request.url)
                    except (ValueError, OSError):
                        route.abort()
                    else:
                        route.continue_()
                context.route("**/*", guard)
                context.route_web_socket("**/*", lambda ws: ws.close())
                page = context.new_page()
                response = page.goto(url, wait_until="domcontentloaded", timeout=timeout * 1000)
                if response is None or response.status >= 400:
                    raise RuntimeError(f"Playwright puslapio HTTP klaida: {response.status if response else 'nėra atsakymo'}")
                page.wait_for_timeout(min(1500, timeout * 1000))
                validate_public_url(page.url)
                content = page.content()
                if len(content.encode("utf-8")) > 5 * 1024 * 1024:
                    raise ValueError("Playwright HTML viršijo 5 MB ribą")
                return page.url, content
            finally:
                browser.close()
    except PlaywrightError as error:
        raise RuntimeError(f"Playwright nepavyko: {error}. Patikrinkite Chromium diegimą.") from error


def download_public_documents(
    url: str, directory: Path, timeout: int = 25, max_bytes: int = 50 * 1024 * 1024,
    errors: list[str] | None = None, use_playwright: bool = False,
) -> list[tuple[str, Path]]:
    import requests
    from bs4 import BeautifulSoup

    final_url, content_type, body = fetch_public_bytes(url, timeout, max_bytes)
    directory.mkdir(parents=True, exist_ok=True)
    parsed = urllib.parse.urlparse(final_url)
    suffix = Path(parsed.path).suffix.casefold()
    downloaded: list[tuple[str, Path]] = []
    if suffix in (".pdf", ".docx") or "application/pdf" in content_type or "officedocument.wordprocessingml" in content_type:
        ext = ".pdf" if "pdf" in content_type or suffix == ".pdf" else ".docx"
        name = hashlib.sha256(final_url.encode()).hexdigest()[:16] + ext
        target = directory / name
        target.write_bytes(body)
        downloaded.append((final_url, target))
        return downloaded

    soup = BeautifulSoup(body, "html.parser")
    def document_links(soup: Any, base: str) -> list[str]:
        return list(dict.fromkeys(
            urllib.parse.urljoin(base, anchor["href"])
            for anchor in soup.find_all("a", href=True)
            if Path(urllib.parse.urlparse(urllib.parse.urljoin(base, anchor["href"])).path).suffix.casefold()
            in (".pdf", ".docx")
        ))
    links = document_links(soup, final_url)
    if not links and use_playwright:
        try:
            rendered_url, rendered_html = render_public_page(final_url, timeout)
            links = document_links(BeautifulSoup(rendered_html, "html.parser"), rendered_url)
        except (RuntimeError, ValueError, ImportError) as error:
            if errors is None:
                raise
            errors.append(f"Dinaminio puslapio {final_url} nepavyko perskaityti: {error}")
    for href in links:
        suffix = Path(urllib.parse.urlparse(href).path).suffix.casefold()
        try:
            final_doc_url, doc_content_type, doc_body = fetch_public_bytes(href, timeout, max_bytes)
        except (requests.RequestException, ValueError) as error:
            if errors is None:
                raise
            errors.append(f"Nepavyko atsisiųsti dokumento {href}: {error}")
            continue
        name = hashlib.sha256(final_doc_url.encode()).hexdigest()[:16] + suffix
        target = directory / name
        target.write_bytes(doc_body)
        downloaded.append((final_doc_url, target))
    return downloaded


def search_public_web(query: str, db_path: Path, days: int = 1) -> list[dict[str, str]]:
    """Use public DuckDuckGo results as unverified leads only; no AI or paid API."""
    with sqlite3.connect(db_path) as db:
        row = db.execute("SELECT checked_at,result_json FROM search_cache WHERE query=?", (query,)).fetchone()
    if row and time.time() - row[0] < days * 86400:
        return json.loads(row[1])
    try:
        from ddgs import DDGS

        results = [
            {"title": str(item.get("title", "")), "url": str(item.get("href", "")),
             "snippet": str(item.get("body", "")), "classification": "Nežinoma – gamintoją ar tiekėją patvirtinti rankiniu būdu"}
            for item in DDGS().text(query, max_results=8)
        ]
    except Exception as error:
        return [{"title": "Paieška nepavyko", "url": "", "snippet": str(error),
                 "classification": "REIKIA PATIKRINTI"}]
    with sqlite3.connect(db_path) as db:
        db.execute("INSERT OR REPLACE INTO search_cache VALUES(?,?,?)",
                   (query, time.time(), json.dumps(results, ensure_ascii=False)))
    return results
