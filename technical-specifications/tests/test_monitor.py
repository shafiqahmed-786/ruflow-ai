from datetime import datetime
from unittest.mock import patch

import pytest
from openpyxl import Workbook, load_workbook
from pypdf import PdfReader

from main import SHEETS, execute, make_pdf, write_workbook
from ts_monitor import (
    ATITINKA,
    NEATITINKA,
    OCR_MARKER,
    REIKIA_PATIKRINTI,
    cached_analysis,
    compare_document,
    compare_numeric,
    extract_requirements,
    initialize_database,
    is_allowed_schedule_time,
    parse_constraint,
    read_excel_urls,
    save_analysis,
    sha256_file,
    single_instance,
)


@pytest.mark.parametrize(
    ("requirement", "candidate", "expected"),
    [
        ("ne mažiau kaip 10 mm", "1 cm", ATITINKA),
        (">= 10 mm", "9 mm", NEATITINKA),
        ("ne daugiau kaip 50 W", "51 W", NEATITINKA),
        ("10–20 kg", "15 kg", ATITINKA),
        ("10–20 kg", "21 kg", NEATITINKA),
        ("tiksliai 230 V", "230 V", ATITINKA),
        ("tiksliai 230 V", "220 V", NEATITINKA),
        ("ne mažiau kaip 10 mm", "10 W", REIKIA_PATIKRINTI),
        ("ne mažiau kaip 10 mm", "nežinoma", REIKIA_PATIKRINTI),
        ("> 10 mm", "10 mm", NEATITINKA),
        ("< 10 mm", "10 mm", NEATITINKA),
        ("ne mažiau kaip 24 mėnesiai", "2 years", ATITINKA),
        ("ne mažiau kaip 24 mėnesiai", "24 m", REIKIA_PATIKRINTI),
        ("ne mažiau kaip 100 W", "iki 120 W", REIKIA_PATIKRINTI),
    ],
)
def test_numeric_constraints(requirement, candidate, expected):
    constraint = parse_constraint(requirement)
    assert constraint is not None
    assert compare_numeric(constraint, candidate) == expected


def test_exact_schedule_prevents_sleep_wake_catchup():
    times = ["08:40", "08:50", "12:40", "12:50", "16:40", "16:50"]
    assert is_allowed_schedule_time(datetime(2026, 1, 1, 8, 40), times)
    assert not is_allowed_schedule_time(datetime(2026, 1, 1, 8, 41), times)
    assert not is_allowed_schedule_time(datetime(2026, 1, 1, 9, 0), times)


def test_single_instance_lock_excludes_second_run(tmp_path):
    lock = tmp_path / "monitor.lock"
    with single_instance(lock):
        with pytest.raises(RuntimeError, match="jau vykdomas"):
            with single_instance(lock):
                pass
    with single_instance(lock):
        pass


def test_sha256_cache_deduplicates_unchanged_document(tmp_path):
    database = tmp_path / "state.sqlite3"
    document = tmp_path / "catalog.pdf"
    document.write_bytes(b"sample document")
    initialize_database(database)
    digest = sha256_file(document)
    result = {"pages": ["Galia: 100 W"]}
    save_analysis(database, "https://example.test/catalog.pdf", document, digest, result)
    assert cached_analysis(database, "https://example.test/catalog.pdf", digest) == result
    assert cached_analysis(database, "https://example.test/catalog.pdf", "different-hash") is None


def test_workbook_contains_all_required_report_sheets(tmp_path):
    report = tmp_path / "report.xlsx"
    write_workbook(report, {})
    workbook = load_workbook(report, read_only=True)
    assert workbook.sheetnames == list(SHEETS)
    assert all(workbook[name].max_row == 1 for name in SHEETS)


def test_real_xlsx_reads_text_hyperlinks_and_empty_cells(tmp_path):
    source = tmp_path / "links.xlsx"
    workbook = Workbook()
    workbook.active["A1"] = "https://example.com/a.pdf"
    workbook.active["C3"] = "Dokumentas"
    workbook.active["C3"].hyperlink = "https://example.com/b.pdf"
    workbook.save(source)
    assert read_excel_urls(source) == ["https://example.com/a.pdf", "https://example.com/b.pdf"]


@pytest.mark.parametrize("value", ["ISO 9001", "230 V / 50 Hz", "iki 120 W", "100–200 W"])
def test_ambiguous_evidence_is_never_confirmed(value):
    requirements = extract_requirements(["Galia: ne mažiau kaip 100 W"])
    result = compare_document(requirements, [f"Galia: {value}"], "catalog.pdf", "https://example.com")
    assert result[0]["status"] == REIKIA_PATIKRINTI


def test_multiple_conflicting_values_are_not_confirmed():
    requirements = extract_requirements(["Galia: ne mažiau kaip 100 W"])
    result = compare_document(requirements, ["Galia: 120 W\nGalia: 80 W"], "catalog.pdf", "source")
    assert result[0]["status"] == REIKIA_PATIKRINTI


def test_multiple_models_do_not_get_unattributed_compliance():
    requirements = extract_requirements(["Galia: ne mažiau kaip 100 W"])
    result = compare_document(requirements, ["Modelis A123\nModelis B456\nGalia: 120 W"], "catalog.pdf", "source")
    assert result[0]["status"] == REIKIA_PATIKRINTI


def test_standards_and_ocr_need_review():
    assert parse_constraint("ISO 9001") is None
    ocr = extract_requirements([OCR_MARKER + "\nGalia: 100 W"])
    assert ocr[0].constraint is None
    standard = extract_requirements(["Galia: 100 W"])
    assert compare_document(standard, [OCR_MARKER + "\nGalia: 100 W"], "x.pdf", "x")[0]["status"] == REIKIA_PATIKRINTI


def test_real_pipeline_reuses_cached_docs_and_produces_reports(tmp_path):
    """Run non-demo path, including real XLSX, PDFs, persistent cache and report files."""
    spec = tmp_path / "spec.pdf"
    catalogs = tmp_path / "catalogs"
    catalogs.mkdir()
    product = catalogs / "catalog.pdf"
    make_pdf(spec, "Techninė specifikacija", [["Galia: ne mažiau kaip 100 W"]])
    make_pdf(product, "Modelis ABC-123", [["Galia: 120 W"]])
    workbook = Workbook()
    workbook.active["A1"] = "https://example.com/spec.pdf"
    links = tmp_path / "links.xlsx"
    workbook.save(links)
    config = {
        "paths": {"links_xlsx": str(links), "catalogs": str(catalogs),
                  "output": str(tmp_path / "output"), "data": str(tmp_path / "data")},
        "web_search_enabled": False,
        "ollama": {"enabled": False},
    }
    with patch("main.download_public_documents", return_value=[("https://example.com/spec.pdf", spec)]):
        first = execute(config)
        with patch("main.extract_document_text", side_effect=AssertionError("unchanged documents re-analyzed")), \
             patch("main.extract_requirements", side_effect=AssertionError("unchanged requirements re-analyzed")):
            second = execute(config)
    assert not first["errors"] and not second["errors"]
    assert first["requirements"] == 1
    assert first["matrix"][0]["status"] == ATITINKA
    assert first["matrix"][0]["model"] == "ABC-123"
    assert len(PdfReader(str(first["comments_pdf"])).pages) >= 2
    assert len(PdfReader(str(first["evidence_pdf"])).pages) == 1
    report = load_workbook(first["xlsx"], read_only=True, data_only=True)
    assert report.sheetnames == list(SHEETS)
    assert list(report["Atitikties matrica"].values)[1][2:4] == ("ATITINKA", "120 W")
    assert first["xlsx"] != second["xlsx"]


def test_missing_catalog_never_produces_an_empty_success_matrix(tmp_path):
    spec = tmp_path / "spec.pdf"
    make_pdf(spec, "Techninė specifikacija", [["Galia: ne mažiau kaip 100 W"]])
    workbook = Workbook()
    workbook.active["A1"] = "https://example.com/spec.pdf"
    links = tmp_path / "links.xlsx"
    workbook.save(links)
    config = {
        "paths": {"links_xlsx": str(links), "catalogs": str(tmp_path / "missing"),
                  "output": str(tmp_path / "output"), "data": str(tmp_path / "data")},
        "web_search_enabled": False,
        "ollama": {"enabled": False},
    }
    with patch("main.download_public_documents", return_value=[("https://example.com/spec.pdf", spec)]):
        result = execute(config)
    assert result["errors"]
    assert [item["status"] for item in result["matrix"]] == [REIKIA_PATIKRINTI]
    assert not result["evidence_pdf"].exists()
