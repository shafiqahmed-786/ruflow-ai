#!/usr/bin/env python3
"""Entry point for the local macOS technical-specification monitor."""

from __future__ import annotations

import argparse
from dataclasses import asdict
import html
import io
import json
import logging
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from ai_queue import (
    completed_extractions,
    enqueue_document,
    initialize_ai_queue,
    process_pending_jobs,
    queue_stats,
)
from discovery import discover_model
from ts_monitor import (
    ATITINKA,
    AlreadyRunningError,
    NEATITINKA,
    REIKIA_PATIKRINTI,
    Requirement,
    cached_analysis,
    compare_document,
    download_public_documents,
    document_models,
    document_title,
    extract_document_text,
    extract_requirements,
    initialize_database,
    is_allowed_schedule_time,
    read_excel_urls,
    save_analysis,
    search_public_web,
    sha256_file,
    single_instance,
)

SHEETS = {
    "Suvestinė": ["Rodiklis", "Reikšmė", "Pastaba"],
    "Techniniai reikalavimai": ["Nr.", "Reikalavimas", "Parametras", "Apribojimas", "Puslapis", "Specifikacijos URL", "Pastaba"],
    "Gamintojai ir modeliai": ["Pavadinimas", "Tipas", "Šalis", "Svetainė / dokumentas", "Įrodymas", "Patikros būsena"],
    "Tiekėjai ir kontaktai": ["Įmonė", "Šalis", "Svetainė", "Viešas kontaktas", "Modelis", "Įrodymas", "Patikros būsena"],
    "Atitikties matrica": ["Reikalavimas", "Gamintojas / modelis", "Statusas", "Dokumento reikšmė", "Paaiškinimas", "Dokumentas", "Puslapis", "Įrodymo URL", "Specifikacijos URL"],
    "PDF įrodymų nuorodos": ["Reikalavimas", "Dokumentas", "Puslapis", "Įrodymo URL", "Įrodymo tekstas", "Specifikacijos URL"],
    "Neatitikimai": ["Reikalavimas", "Modelis", "Statusas", "Paaiškinimas", "Dokumentas", "Puslapis"],
    "Tikrinimo istorija": ["Laikas", "Būsena", "Pranešimas"],
}
LINK_COLUMNS = {
    "Techniniai reikalavimai": {"Specifikacijos URL"},
    "Gamintojai ir modeliai": {"Svetainė / dokumentas"},
    "Tiekėjai ir kontaktai": {"Svetainė"},
    "Atitikties matrica": {"Įrodymo URL", "Specifikacijos URL"},
    "PDF įrodymų nuorodos": {"Įrodymo URL", "Specifikacijos URL"},
}


def unicode_pdf_font() -> tuple[str, str]:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    candidates = [
        (Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
         Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")),
        (Path("/Library/Fonts/Arial.ttf"), Path("/Library/Fonts/Arial Bold.ttf")),
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
         Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
    ]
    for regular, bold in candidates:
        if regular.is_file():
            if "TSUnicode" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("TSUnicode", str(regular)))
            if bold.is_file() and "TSUnicode-Bold" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("TSUnicode-Bold", str(bold)))
            return "TSUnicode", "TSUnicode-Bold" if bold.is_file() else "TSUnicode"
    return "Helvetica", "Helvetica-Bold"


def load_config(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as stream:
        config = yaml.safe_load(stream) or {}
    home = Path.home()
    paths = config.setdefault("paths", {})
    paths.setdefault("links_xlsx", str(home / "Desktop" / "TS_nuorodos.xlsx"))
    paths.setdefault("catalogs", str(home / "Desktop" / "Katalogai"))
    paths.setdefault("output", str(home / "Desktop" / "TS_rezultatai"))
    paths.setdefault("data", str(Path(__file__).parent / "data"))
    for key, value in list(paths.items()):
        resolved = Path(value).expanduser()
        if not resolved.is_absolute():
            resolved = path.expanduser().resolve().parent / resolved
        paths[key] = str(resolved)
    return config


def make_pdf(path: Path, title: str, rows: list[list[str]], subtitle: str = "") -> None:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    regular_font, bold_font = unicode_pdf_font()
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(path), pagesize=landscape(A4), rightMargin=30, leftMargin=30,
                            topMargin=35, bottomMargin=35)
    styles = getSampleStyleSheet()
    styles["Title"].fontName = bold_font
    styles["Normal"].fontName = regular_font
    styles["BodyText"].fontName = regular_font
    story = [Paragraph(html.escape(title), styles["Title"])]
    if subtitle:
        story.extend([Paragraph(html.escape(subtitle), styles["Normal"]), Spacer(1, 10)])
    for row in rows:
        story.append(Paragraph(html.escape(" • ".join(str(item) for item in row)), styles["BodyText"]))
        story.append(Spacer(1, 6))
    doc.build(story)


def write_workbook(path: Path, rows_by_sheet: dict[str, list[list[Any]]]) -> None:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    workbook = Workbook()
    workbook.remove(workbook.active)
    for sheet_name, headers in SHEETS.items():
        sheet = workbook.create_sheet(sheet_name)
        sheet.append(headers)
        for row in rows_by_sheet.get(sheet_name, []):
            sheet.append([None if value is None else str(value) for value in row])
            for cell in sheet[sheet.max_row]:
                if cell.value is not None:
                    cell.data_type = "s"
            for column, header in enumerate(headers, 1):
                cell = sheet.cell(sheet.max_row, column)
                if header in LINK_COLUMNS.get(sheet_name, set()) and cell.value:
                    if cell.value.startswith(("https://", "http://", "file://")):
                        cell.hyperlink = cell.value
                        cell.style = "Hyperlink"
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for cell in sheet[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="243B53")
            cell.alignment = Alignment(wrap_text=True, vertical="top")
        for column in sheet.columns:
            length = min(58, max(14, max((len(str(cell.value or "")) for cell in column), default=12) + 2))
            sheet.column_dimensions[get_column_letter(column[0].column)].width = length
        for row in sheet.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(wrap_text=True, vertical="top")
    path.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(path)


def annotate_source_pdfs(
    sources: list[tuple[Path, list[Requirement]]], destination: Path,
    matrix: list[dict[str, Any]],
) -> bool:
    """Combine per-source annotated copies, retaining all original PDF pages."""
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.pdfgen import canvas
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    regular_font, bold_font = unicode_pdf_font()

    writer = PdfWriter()
    for source, requirements in sources:
        if source.suffix.casefold() != ".pdf":
            continue
        for number, page in enumerate(PdfReader(str(source)).pages, 1):
            page = writer.add_page(page)
            matching = [item for item in requirements if item.page == number]
            if matching:
                page_width, page_height = float(page.mediabox.width), float(page.mediabox.height)
                overlay_buffer = io.BytesIO()
                overlay = canvas.Canvas(overlay_buffer, pagesize=(page_width, page_height))
                outcomes = [item.get("status", REIKIA_PATIKRINTI) for item in matrix
                            if any(item.get("requirement") == req.text
                                   and item.get("requirement_source") == req.source for req in matching)]
                all_covered = all(any(item.get("requirement") == req.text
                                      and item.get("requirement_source") == req.source for item in matrix)
                                  for req in matching)
                outcome = (ATITINKA if all_covered and outcomes and all(value == ATITINKA for value in outcomes)
                           else NEATITINKA if NEATITINKA in outcomes else REIKIA_PATIKRINTI)
                background, foreground = {
                    ATITINKA: ("#d4edda", "#155724"),
                    NEATITINKA: ("#f8d7da", "#721c24"),
                    REIKIA_PATIKRINTI: ("#fff3cd", "#6b4f00"),
                }[outcome]
                overlay.setFillColor(colors.HexColor(background))
                overlay.rect(24, 20, page_width - 48, 52, fill=1, stroke=0)
                overlay.setFillColor(colors.HexColor(foreground))
                overlay.setFont(bold_font, 9)
                overlay.drawString(32, 55, f"{outcome} — automatizuotas preliminarus įvertinimas")
                overlay.setFont(regular_font, 8)
                labels = "; ".join(item.text[:65] for item in matching)
                overlay.drawString(32, 40, "Reikalavimai: " + labels[:140])
                overlay.save()
                overlay_buffer.seek(0)
                page.merge_page(PdfReader(overlay_buffer).pages[0])
    if writer.pages:
        appendix_buffer = io.BytesIO()
        styles = getSampleStyleSheet()
        styles["Title"].fontName = bold_font
        styles["BodyText"].fontName = regular_font
        body = styles["BodyText"]
        details = [
            [Paragraph("<b>Reikalavimas</b>", body), Paragraph("<b>Modelis</b>", body),
             Paragraph("<b>Statusas</b>", body), Paragraph("<b>Reikšmė / paaiškinimas</b>", body),
             Paragraph("<b>Šaltinis / puslapis</b>", body)],
        ]
        if matrix:
            for item in matrix:
                details.append([
                    Paragraph(html.escape(item["requirement"] + "\nSpecifikacija: " + item["requirement_source"]), body),
                    Paragraph(html.escape(item["model"]), body),
                    Paragraph(html.escape(item["status"]), body),
                    Paragraph(html.escape((item["candidate_value"] + " — " + item["explanation"]).strip(" —")), body),
                    Paragraph(html.escape(f"{item['url']} (p. {item['page'] or 'nenurodyta'})"), body),
                ])
        else:
            for _, requirements in sources:
                details.extend([[Paragraph(html.escape(req.text), body), Paragraph("—", body),
                                 Paragraph(REIKIA_PATIKRINTI, body),
                                 Paragraph("Nerasta patikimų palyginamų įrodymų; būtina žmogaus patikra.", body),
                                 Paragraph(f"{req.page or 'nenurodyta'} p.", body)] for req in requirements])
        doc = SimpleDocTemplate(appendix_buffer, pagesize=landscape(A4), rightMargin=24,
                                leftMargin=24, topMargin=28, bottomMargin=28)
        table = Table(details, colWidths=[175, 85, 100, 240, 240], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#243B53")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 1), (-1, -1), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
        ]))
        doc.build([Paragraph("Analizės įrodymų ir patikros priedas", styles["Title"]),
                   Paragraph("Ši automatinė analizė nėra atitikties patvirtinimas. Nepatvirtinti parametrai nelaikomi atitinkančiais.", body),
                   Spacer(1, 12), table])
        appendix_buffer.seek(0)
        for page in PdfReader(appendix_buffer).pages:
            writer.add_page(page)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as stream:
            writer.write(stream)
        return True
    return False


def annotate_evidence_pdfs(evidence: list[dict[str, Any]], output: Path) -> None:
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas
    regular_font, bold_font = unicode_pdf_font()

    writer = PdfWriter()
    for item in evidence:
        source_text, page_number = item.get("document"), item.get("page")
        if not source_text or not page_number:
            continue
        source = Path(source_text)
        if not source.is_file() or source.suffix.casefold() != ".pdf":
            continue
        source_reader = PdfReader(str(source))
        if page_number < 1 or page_number > len(source_reader.pages):
            continue
        page = writer.add_page(source_reader.pages[page_number - 1])
        page_width, page_height = float(page.mediabox.width), float(page.mediabox.height)
        buffer = io.BytesIO()
        overlay = canvas.Canvas(buffer, pagesize=(page_width, page_height))
        status = item.get("status", REIKIA_PATIKRINTI)
        color = {"ATITINKA": colors.HexColor("#d4edda"), "NEATITINKA": colors.HexColor("#f8d7da")}.get(
            status, colors.HexColor("#fff3cd"))
        overlay.setFillColor(color)
        overlay.rect(20, page_height - 72, page_width - 40, 53, fill=1, stroke=0)
        overlay.setFillColor(colors.black)
        overlay.setFont(bold_font, 9)
        overlay.drawString(28, page_height - 32, f"{status} — {item.get('requirement_name', '')[:90]}")
        overlay.setFont(bold_font, 6)
        overlay.drawString(28, page_height - 45, f"Įrodymas: {item.get('evidence', '')[:150]}")
        overlay.setFont(regular_font, 6)
        overlay.drawString(
            28, page_height - 60,
            f"Šaltinis: {item.get('url', '')[:150]} | PDF p. {page_number}",
        )
        overlay.save()
        buffer.seek(0)
        page.merge_page(PdfReader(buffer).pages[0])
    if writer.pages:
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("wb") as stream:
            writer.write(stream)


def _analyze_cached(db_path: Path, source: str, path: Path) -> tuple[list[str], bool]:
    digest = sha256_file(path)
    cached = cached_analysis(db_path, source, digest)
    if cached:
        return cached["pages"], True
    pages = extract_document_text(path)
    save_analysis(db_path, source, path, digest, {"pages": pages})
    return pages, False


def _analyze_spec(db_path: Path, source: str, path: Path) -> tuple[list[str], list[Requirement]]:
    digest = sha256_file(path)
    cached = cached_analysis(db_path, source, digest)
    if cached and "requirements" in cached:
        return cached["pages"], [Requirement(**item) for item in cached["requirements"]]
    pages = cached["pages"] if cached else extract_document_text(path)
    requirements = extract_requirements(pages, source)
    save_analysis(db_path, source, path, digest,
                  {"pages": pages, "requirements": [asdict(item) for item in requirements]})
    return pages, requirements


def _queue_documents(db_path: Path, documents: list[tuple[str, Path, list[str], str]],
                     role_by_source: dict[str, str], ollama_config: dict[str, Any]) -> None:
    for source, path, pages, _ in documents:
        enqueue_document(
            db_path, source, sha256_file(path), path, role_by_source.get(source, "catalog"), pages,
            int(ollama_config.get("chunk_pages", 4)),
            int(ollama_config.get("chunk_max_chars", 18000)),
        )


def _process_ai(db_path: Path, config: dict[str, Any], errors: list[str]) -> None:
    if not config.get("enabled", True):
        return
    result = process_pending_jobs(
        db_path, base_url=str(config.get("base_url", "http://127.0.0.1:11434")),
        model=str(config.get("model", "qwen3.5:4b")),
        num_ctx=int(config.get("num_ctx", 8192)),
        timeout=int(config.get("request_timeout_seconds", 90)),
        max_jobs=int(config.get("max_jobs_per_run", 12)),
        retry_base_seconds=int(config.get("retry_base_seconds", 60)),
    )
    if result["error"]:
        errors.append(f"AI analizės eilė išsaugota SQLite ir bus kartojama: {result['error']}")


def _apply_verified_ai(
    db_path: Path,
    current: dict[str, tuple[Path, list[str], str]],
    requirements: list[Requirement],
    source_requirement_map: dict[Path, list[Requirement]],
    documents: list[tuple[str, Path, list[str], str]],
) -> tuple[list[tuple[str, Path, list[str], str]], list[tuple[str, str, int, str]]]:
    """Reuse only page quotes validated against the original text sent to Ollama."""
    catalog_quotes: list[tuple[str, str, int, str]] = []
    for extraction in completed_extractions(db_path):
        record = current.get(extraction["source"])
        if not record or sha256_file(record[0]) != extraction["sha256"]:
            continue
        path, pages, role = record
        for item in extraction["items"]:
            page_number, quote = item["page"], item["quote"]
            if not (1 <= page_number <= len(pages)) or " ".join(quote.split()) not in " ".join(pages[page_number - 1].split()):
                continue
            if role == "specification":
                found = extract_requirements([quote], extraction["source"])
                for requirement in found:
                    requirement.page = page_number
                    if not any(existing.source == requirement.source and existing.text.casefold() == requirement.text.casefold()
                               for existing in requirements):
                        requirements.append(requirement)
                        source_requirement_map.setdefault(path, []).append(requirement)
            elif role == "catalog":
                catalog_quotes.append((extraction["source"], quote, page_number, extraction["document_path"]))

    updated = []
    for source, path, pages, url in documents:
        relevant = [row for row in catalog_quotes if row[0] == source]
        if relevant:
            pages = list(pages)
            for _, quote, page_number, _ in relevant:
                marker = "[AI patikrinta šaltinio citata]"
                citation = marker + "\n" + quote
                page_lines = {" ".join(line.split()) for line in pages[page_number - 1].splitlines()} \
                    if 1 <= page_number <= len(pages) else set()
                if 1 <= page_number <= len(pages) and " ".join(quote.split()) not in page_lines:
                    pages[page_number - 1] += "\n" + citation
        updated.append((source, path, pages, url))
    return updated, catalog_quotes


def execute(config: dict[str, Any], demo: bool = False) -> dict[str, Any]:
    started = datetime.now().astimezone()
    paths = config["paths"]
    data_dir = Path(paths["data"]).expanduser()
    output_dir = Path(paths["output"]).expanduser()
    database = data_dir / "monitor.sqlite3"
    initialize_database(database)
    ollama_config = config.get("ollama", {})
    download_dir = data_dir / "downloads"
    catalog_dir = Path(paths["catalogs"]).expanduser()
    source_urls: list[str] = []
    requirements: list[Requirement] = []
    source_records: list[tuple[str, Path, list[str]]] = []
    source_requirement_map: dict[Path, list[Requirement]] = {}
    errors: list[str] = []

    if demo:
        demo_dir = data_dir / "demo"
        demo_dir.mkdir(parents=True, exist_ok=True)
        spec_path = demo_dir / "demo-technine-specifikacija.pdf"
        product_path = demo_dir / "demo-gamintojo-katalogas.pdf"
        make_pdf(spec_path, "Demonstracinė techninė specifikacija", [
            ["Galia: ne mažiau kaip 100 W"], ["Garantija: ne mažiau kaip 24 mėnesiai"],
        ])
        make_pdf(product_path, "Modelis DEMO-100", [
            ["Galia: 120 W"], ["Garantija: 24 mėnesiai"],
        ])
        spec_pages = extract_document_text(spec_path)
        requirements = extract_requirements(spec_pages, "demo://specification")
        source_records.append(("demo://specification", spec_path, spec_pages))
        source_requirement_map[spec_path] = requirements[:]
        catalog_dir = demo_dir
    else:
        xlsx = Path(paths["links_xlsx"]).expanduser()
        if xlsx.is_file():
            try:
                source_urls = read_excel_urls(xlsx)
            except Exception as error:
                errors.append(f"Nepavyko nuskaityti Excel nuorodų: {error}")
        else:
            errors.append(f"Nerastas nuorodų Excel failas: {xlsx}")
        if xlsx.is_file() and not source_urls:
            errors.append(f"Excel faile nerasta viešų HTTP(S) nuorodų: {xlsx}")
        for url in source_urls:
            try:
                downloaded = download_public_documents(
                    url, download_dir, int(config.get("request_timeout_seconds", 25)),
                    int(config.get("max_download_bytes", 50 * 1024 * 1024)), errors,
                    bool(config.get("playwright_enabled", False)),
                )
                if not downloaded:
                    errors.append(f"Šaltinyje nerasta atsisiunčiamų PDF/DOCX dokumentų: {url}")
                for source, file_path in downloaded:
                    pages, found = _analyze_spec(database, source, file_path)
                    source_records.append((source, file_path, pages))
                    requirements.extend(found)
                    source_requirement_map[file_path] = found
            except Exception as error:
                errors.append(f"{url}: {error}")
        if not requirements:
            errors.append("Nepavyko ištraukti reikalavimų; reikalinga žmogaus patikra.")

    unique_requirements: dict[tuple[str, str], Requirement] = {}
    for req in requirements:
        unique_requirements.setdefault((req.source, req.text.casefold()), req)
    requirements = list(unique_requirements.values())

    documents: list[tuple[str, Path, list[str], str]] = []
    role_by_source = {source: "specification" for source, _, _ in source_records}
    if catalog_dir.is_dir():
        for document in sorted(catalog_dir.rglob("*.pdf")):
            if document in {record[1] for record in source_records}:
                continue
            try:
                pages, _ = _analyze_cached(database, str(document), document)
                documents.append((str(document), document, pages, document.resolve().as_uri()))
            except Exception as error:
                errors.append(f"{document}: {error}")
        for document in sorted(catalog_dir.rglob("*.docx")):
            try:
                pages, _ = _analyze_cached(database, str(document), document)
                documents.append((str(document), document, pages, document.resolve().as_uri()))
            except Exception as error:
                errors.append(f"{document}: {error}")
    else:
        errors.append(f"Nerastas katalogų aplankas: {catalog_dir}")

    local_sources = [(source, path, pages, source) for source, path, pages in source_records]
    for source, _, _, _ in documents:
        role_by_source.setdefault(source, "catalog")
    if ollama_config.get("enabled", True) and not demo:
        _queue_documents(database, local_sources + documents, role_by_source, ollama_config)
        _process_ai(database, ollama_config, errors)
        current = {source: (path, pages, "specification")
                   for source, path, pages in source_records}
        current.update({source: (path, pages, "catalog")
                        for source, path, pages, _ in documents})
        documents, ai_catalog_quotes = _apply_verified_ai(
            database, current, requirements, source_requirement_map, documents,
        )
    else:
        ai_catalog_quotes = []

    leads: list[dict[str, str]] = []
    if config.get("web_search_enabled", True) and requirements and not demo:
        search_limit = int(config.get("max_web_searches_per_run", 3))
        for req in requirements[:search_limit]:
            leads.extend(search_public_web(f'"{req.name}" gamintojas modelis ES tiekėjas', database))
    web_document_limit = int(config.get("max_web_downloads_per_run", 5))
    downloaded_web_urls: set[str] = set()
    for lead in leads:
        candidate_url = lead.get("url", "")
        if not candidate_url or candidate_url in downloaded_web_urls or len(downloaded_web_urls) >= web_document_limit:
            continue
        downloaded_web_urls.add(candidate_url)
        try:
            for source, document in download_public_documents(
                candidate_url, download_dir, int(config.get("request_timeout_seconds", 25)),
                int(config.get("max_download_bytes", 50 * 1024 * 1024)), errors,
                bool(config.get("playwright_enabled", False)),
            ):
                pages, _ = _analyze_cached(database, source, document)
                documents.append((str(document), document, pages, source))
                role_by_source[source] = "catalog"
        except Exception as error:
            errors.append(f"Paieškos šaltinis {candidate_url}: {error}")

    if ollama_config.get("enabled", True) and not demo:
        _queue_documents(database, documents, role_by_source, ollama_config)
        _process_ai(database, ollama_config, errors)
        current = {source: (path, pages, "specification")
                   for source, path, pages in source_records}
        current.update({source: (path, pages, role_by_source.get(source, "catalog"))
                        for source, path, pages, _ in documents})
        documents, later_quotes = _apply_verified_ai(
            database, current, requirements, source_requirement_map, documents,
        )
        ai_catalog_quotes.extend(later_quotes)
    else:
        initialize_ai_queue(database)

    model_candidates: list[dict[str, str]] = []
    if config.get("web_search_enabled", True) and config.get("model_search_enabled", True) and not demo:
        models: dict[str, str] = {}
        for _, _, pages, _ in documents:
            for model in document_models(pages):
                models.setdefault(model.casefold(), model)
        for model in list(models.values())[:max(0, int(config.get("max_models_per_run", 3)))]:
            found, discovery_errors = discover_model(
                model, database, timeout=int(config.get("request_timeout_seconds", 25)),
                use_playwright=bool(config.get("playwright_enabled", False)),
                max_results=max(0, int(config.get("max_model_pages_per_model", 4))),
            )
            model_candidates.extend(found)
            errors.extend(discovery_errors)

    matrix: list[dict[str, Any]] = []
    for document, _, pages, source in documents:
        matrix.extend(compare_document(requirements, pages, document, source))
    if requirements and not documents:
        errors.append("Nėra palyginamų katalogo dokumentų; kiekvienam reikalavimui būtina žmogaus patikra.")
        matrix.extend({
            "requirement": req.text, "requirement_name": req.name,
            "requirement_page": req.page, "model": "Nenustatytas",
            "status": REIKIA_PATIKRINTI, "candidate_value": "", "evidence": "",
            "document": "", "page": None, "url": "", "requirement_source": req.source,
            "explanation": "Nėra palyginamo gamintojo ar katalogo dokumento.",
        } for req in requirements)
    errors.extend(
        f"Internetinės paieškos užklausa nepavyko: {lead['snippet']}"
        for lead in leads if lead.get("title") == "Paieška nepavyko"
    )
    now_tag = started.strftime("%Y%m%d_%H%M%S_%f")
    output_dir.mkdir(parents=True, exist_ok=True)
    xlsx_out = output_dir / f"TS_ataskaita_{now_tag}.xlsx"
    comments_pdf = output_dir / f"TS_komentarai_{now_tag}.pdf"
    evidence_pdf = output_dir / f"PDF_irodymai_{now_tag}.pdf"

    history = [[started.isoformat(timespec="seconds"), "UŽBAIGTA" if not errors else "SU PASTABOMIS",
                " | ".join(errors) if errors else "Ataskaitos parengtos; išvados priklauso nuo pateiktų įrodymų."]]
    requirement_rows = [[i, req.text, req.name,
                         json.dumps(req.constraint, ensure_ascii=False) if req.constraint else "Nestruktūruota – tikrinti",
                         req.page, req.source, "Automatinis ištraukimas; patvirtinti žmogui."]
                        for i, req in enumerate(requirements, 1)]
    model_rows = [[document_title(doc, pages), "Katalogo dokumento modelis (nepatvirtintas)", "", source,
                   f"Dokumentas: {doc}", "REIKIA PATIKRINTI"] for doc, _, pages, source in documents]
    model_rows += [[lead["title"], "Nežinoma – tikrinti", "", lead["url"], lead["snippet"], "REIKIA PATIKRINTI"]
                   for lead in leads if lead.get("url")]
    model_rows += [[f'{candidate["name"]} / {candidate["model"]}', candidate["role"], candidate["country"],
                    candidate["website"], f'{candidate["source"]} | {candidate["evidence"]}', candidate["status"]]
                   for candidate in model_candidates if candidate["role"] in ("Gamintojas", "Nežinoma")]
    supplier_rows = [[lead["title"], "Nežinoma", lead["url"], "Nerastas – tikrinti įmonės svetainėje",
                      "Neidentifikuotas", lead["snippet"], lead["classification"]]
                     for lead in leads if lead.get("url")]
    supplier_rows += [[candidate["name"], candidate["country"], candidate["website"], candidate["contact"],
                       candidate["model"], f'{candidate["source"]} | {candidate["evidence"]}', candidate["status"]]
                      for candidate in model_candidates if candidate["role"] == "Tiekėjas"]
    matrix_rows = [[row["requirement"], row["model"], row["status"], row["candidate_value"],
                    row["explanation"], row["document"], row["page"], row["url"], row["requirement_source"]]
                   for row in matrix]
    proof_rows = [[row["requirement"], row["document"], row["page"], row["url"], row["evidence"],
                   row["requirement_source"]]
                  for row in matrix if row["evidence"]]
    mismatch_rows = [[row["requirement"], row["model"], row["status"], row["explanation"],
                      row["document"], row["page"]] for row in matrix if row["status"] != ATITINKA]
    counts = {status: sum(row["status"] == status for row in matrix) for status in
              (ATITINKA, NEATITINKA, REIKIA_PATIKRINTI)}
    overview = [
        ["Pradėta", started.isoformat(timespec="seconds"), ""],
        ["Reikalavimų kandidatų", len(requirements), "Automatinis ištraukimas nėra specifikacijos interpretavimo pakaitalas."],
        ["Patikrintų katalogo dokumentų", len(documents), ""],
        ["Atitinka įrodymais", counts[ATITINKA], "Tik parametrams su aiškiu pavadinimu, reikšme ir palyginamu vienetu."],
        ["Neatitinka įrodymais", counts[NEATITINKA], ""],
        ["Reikia patikrinti", counts[REIKIA_PATIKRINTI], "Nežinomi / neįvardyti duomenys nelaikomi atitinkančiais."],
        ["Internetinės paieškos rezultatų", len(leads), "Tik galimi kontaktai / paieškos užuominos; nepatvirtinta."],
        ["Modelių įmonių kandidatai", len(model_candidates), "Ryšius ir kontaktus būtina patikrinti pagal nurodytą šaltinį."],
        ["AI patikrintos katalogų citatos", len(ai_catalog_quotes),
         "Kiekviena citata patikrinta prieš tikslų originalaus puslapio tekstą."],
        ["Ollama", f'{ollama_config.get("model", "qwen3.5:4b")} / kontekstas {ollama_config.get("num_ctx", 8192)}',
         "Tik vietinis modelis; AI citatos tik po patikros pagal dokumento puslapį."],
        ["AI eilė", json.dumps(queue_stats(database), ensure_ascii=False),
         "Ollama klaidos sustabdo tik AI analizę; eilė lieka SQLite ir kartojama vėliau."],
        ["Pastabos", len(errors), " | ".join(errors)],
    ]
    with sqlite3.connect(database) as db:
        previous_runs = db.execute(
            "SELECT started_at,status,details FROM run_history ORDER BY id DESC LIMIT 50"
        ).fetchall()
    history.extend([[started_at, status, details] for started_at, status, details in reversed(previous_runs)])
    rows_by_sheet = {
        "Suvestinė": overview, "Techniniai reikalavimai": requirement_rows,
        "Gamintojai ir modeliai": model_rows, "Tiekėjai ir kontaktai": supplier_rows,
        "Atitikties matrica": matrix_rows, "PDF įrodymų nuorodos": proof_rows,
        "Neatitikimai": mismatch_rows, "Tikrinimo istorija": history,
    }
    write_workbook(xlsx_out, rows_by_sheet)

    source_pdfs = [(path, source_requirement_map.get(path, [])) for _, path, _ in source_records
                   if path.suffix.casefold() == ".pdf"]
    if not annotate_source_pdfs(source_pdfs, comments_pdf, matrix):
        summary_lines = [["Reikalavimas", req.text, f"Puslapis {req.page or 'nenurodytas'}", REIKIA_PATIKRINTI]
                         for req in requirements]
        summary_lines.extend([["Įspėjimas", "Automatinė analizė nėra teisinė ar techninė išvada.",
                              "Nepatvirtintas reikalavimas negali būti laikomas atitinkančiu."]])
        make_pdf(comments_pdf, "Techninės specifikacijos analizės komentarai", summary_lines,
                 "Sukurta lokaliai; kiekvieną teiginį patvirtinkite pagal originalų dokumentą.")
    annotate_evidence_pdfs(matrix, evidence_pdf)

    finished = datetime.now().astimezone()
    with sqlite3.connect(database) as db:
        db.execute(
            "INSERT INTO run_history(started_at,finished_at,status,details) VALUES(?,?,?,?)",
            (started.isoformat(), finished.isoformat(), "completed_with_notes" if errors else "completed",
             json.dumps({"requirements": len(requirements), "documents": len(documents), "errors": errors}, ensure_ascii=False)),
        )
    return {"xlsx": xlsx_out, "comments_pdf": comments_pdf, "evidence_pdf": evidence_pdf,
            "requirements": len(requirements), "documents": len(documents), "matrix": matrix, "errors": errors}


def main() -> int:
    parser = argparse.ArgumentParser(description="Lokali techninių specifikacijų analizė ir ataskaitos")
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("config.yaml"))
    parser.add_argument("--scheduled", action="store_true", help="Vykdymas iš macOS launchd")
    parser.add_argument("--demo", action="store_true", help="Sukurti neprisijungus veikiančią demonstraciją")
    parser.add_argument("--output-dir", type=Path, help="Perrašyti konfigūruotą rezultatų katalogą")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config = load_config(args.config)
    if args.output_dir:
        config["paths"]["output"] = str(args.output_dir.expanduser())
        config["paths"]["data"] = str(args.output_dir.expanduser() / "data")
    schedule_times = config.get("schedule_times", [
        f"{hour:02d}:{minute:02d}" for hour in (8, 12, 16) for minute in range(0, 51, 10)
    ])
    if args.scheduled and not is_allowed_schedule_time(datetime.now(), schedule_times):
        logging.info("Pavėluotas arba už suplanuoto laiko ribų esantis paleidimas praleistas.")
        return 0
    lock = Path(config["paths"].get("data", Path(__file__).parent / "data")).expanduser() / "monitor.lock"
    try:
        with single_instance(lock):
            result = execute(config, demo=args.demo)
    except AlreadyRunningError as error:
        logging.info("%s", error)
        return 0
    for key in ("xlsx", "comments_pdf", "evidence_pdf"):
        if result[key].exists():
            logging.info("%s: %s", key, result[key])
    logging.info("Reikalavimai: %s; katalogai: %s; pastabos: %s",
                 result["requirements"], result["documents"], len(result["errors"]))
    for error in result["errors"]:
        logging.warning("%s", error)
    return 0 if result["requirements"] else 1


if __name__ == "__main__":
    sys.exit(main())
