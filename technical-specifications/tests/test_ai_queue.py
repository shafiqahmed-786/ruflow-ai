import json
import plistlib
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock, patch

import pytest
import requests
from openpyxl import Workbook, load_workbook
from pypdf import PdfReader

from ai_queue import (
    completed_extractions,
    enqueue_document,
    initialize_ai_queue,
    ollama_extract,
    process_pending_jobs,
    queue_stats,
    validate_extraction,
)
from main import SHEETS, execute, write_workbook
from ts_monitor import REIKIA_PATIKRINTI, is_allowed_schedule_time


PAGE_TEXT = "Galia: 100 W\nGarantija: 24 mėnesiai\nSertifikatas: EN 1234"


class FakeResponse:
    def __init__(self, content, status_error=None):
        self.content = content
        self.status_error = status_error

    def raise_for_status(self):
        if self.status_error:
            raise self.status_error

    def json(self):
        return {"message": {"content": json.dumps(self.content, ensure_ascii=False)}}


def test_ai_queue_chunks_long_documents_and_keeps_source_pages(tmp_path):
    db = tmp_path / "jobs.sqlite3"
    text = ("Paragraph " + "x" * 550 + "\n") * 7
    count = enqueue_document(db, "https://example.test/a.pdf", "abc", tmp_path / "a.pdf",
                             "catalog", [PAGE_TEXT, text, PAGE_TEXT], chunk_pages=2, max_chars=1000)
    assert count > 2
    with sqlite3.connect(db) as connection:
        rows = connection.execute(
            "SELECT chunk_index,pages_json,status FROM ai_jobs ORDER BY chunk_index"
        ).fetchall()
    assert [row[0] for row in rows] == list(range(len(rows)))
    assert all(row[2] == "pending" for row in rows)
    assert all(json.loads(row[1]) for row in rows)
    assert {page["page"] for _, pages_json, _ in rows for page in json.loads(pages_json)} <= {1, 2, 3}
    assert enqueue_document(db, "https://example.test/a.pdf", "abc", tmp_path / "a.pdf",
                            "catalog", [PAGE_TEXT, text, PAGE_TEXT], chunk_pages=2, max_chars=1000) == 0
    assert enqueue_document(db, "https://example.test/a.pdf", "changed", tmp_path / "a.pdf",
                            "catalog", [PAGE_TEXT], chunk_pages=2, max_chars=1000) == 1


def test_ollama_request_uses_local_qwen_and_exact_page_evidence():
    pages = [{"page": 7, "text": PAGE_TEXT}]
    response = FakeResponse({"items": [{"page": 7, "quote": "Galia: 100 W"}]})
    with patch("ai_queue.requests.post", return_value=response) as post:
        result = ollama_extract(pages, "catalog", "http://127.0.0.1:11434", "qwen3.5:4b", 8192, 17)
    assert result == [{"page": 7, "quote": "Galia: 100 W"}]
    request = post.call_args.kwargs
    assert post.call_args.args[0] == "http://127.0.0.1:11434/api/chat"
    assert request["json"]["model"] == "qwen3.5:4b"
    assert request["json"]["options"]["num_ctx"] == 8192
    assert request["timeout"] == 17
    prompt = request["json"]["messages"][0]["content"]
    assert "[PDF puslapis 7]" in prompt and PAGE_TEXT in prompt
    assert "nekurk įrodymų" in prompt


def test_ai_cannot_invent_quote_page_or_parameters():
    pages = [{"page": 3, "text": PAGE_TEXT}]
    accepted = validate_extraction({"items": [
        {"page": 3, "quote": "Galia: 100 W"},
        {"page": 3, "quote": "Reikalavimas atitinka ISO"},
        {"page": 4, "quote": "Sertifikatas: EN 1234"},
        {"page": 3, "quote": "Galia ne mažiau kaip 900 W"},
    ]}, pages)
    assert accepted == [{"page": 3, "quote": "Galia: 100 W"}]
    with pytest.raises(ValueError, match="schemos"):
        validate_extraction({"items": "fake"}, pages)


def test_ollama_fails_over_to_pending_persistent_retry(tmp_path):
    db = tmp_path / "jobs.sqlite3"
    path = tmp_path / "catalog.pdf"
    path.write_bytes(b"fixture")
    enqueue_document(db, "https://example.test/catalog.pdf", "digest", path, "catalog", [PAGE_TEXT])
    with patch("ai_queue.requests.post", side_effect=requests.ConnectionError("Ollama down")):
        result = process_pending_jobs(db, max_jobs=3, retry_base_seconds=2)
    assert result["failed"] == 1 and not result["busy"]
    assert "Ollama down" in result["error"]
    assert queue_stats(db) == {"pending": 1}
    with sqlite3.connect(db) as connection:
        status, attempts, available_at, last_error = connection.execute(
            "SELECT status,attempts,available_at,last_error FROM ai_jobs"
        ).fetchone()
    assert status == "pending" and attempts == 1
    assert available_at > time.time() and "Ollama down" in last_error


def test_ollama_refuses_remote_or_cloud_endpoint():
    with pytest.raises(ValueError, match="veikti lokaliai"):
        ollama_extract([{"page": 1, "text": PAGE_TEXT}], "specification",
                       "https://api.example.com", "qwen3.5:4b", 8192, 1)


def test_only_one_ai_queue_worker_can_run_at_once(tmp_path):
    db = tmp_path / "queue.sqlite3"
    path = tmp_path / "catalog.pdf"
    path.write_bytes(b"catalog")
    enqueue_document(db, "source", "digest", path, "catalog", [PAGE_TEXT])
    entered, finish = threading.Event(), threading.Event()
    def blocked_extract(*args, **kwargs):
        entered.set()
        finish.wait(timeout=3)
        return []
    with patch("ai_queue.ollama_extract", side_effect=blocked_extract):
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(process_pending_jobs, db, max_jobs=1)
            assert entered.wait(timeout=3)
            second = pool.submit(process_pending_jobs, db, max_jobs=1)
            assert second.result(timeout=3)["busy"]
            finish.set()
            assert first.result(timeout=3)["processed"] == 1


def test_ollama_queue_completes_only_verified_results_and_retries_deterministically(tmp_path):
    db = tmp_path / "queue.sqlite3"
    path = tmp_path / "spec.pdf"
    path.write_bytes(b"spec")
    enqueue_document(db, "https://example.test/spec.pdf", "sha", path, "specification", [PAGE_TEXT])
    response = FakeResponse({"items": [
        {"page": 1, "quote": "Garantija: 24 mėnesiai"},
        {"page": 1, "quote": "fabricated requirement"},
    ]})
    with patch("ai_queue.requests.post", return_value=response) as post:
        result = process_pending_jobs(
            db, model="qwen3.5:4b", num_ctx=8192, max_jobs=2, retry_base_seconds=1,
        )
    assert result["processed"] == 1 and result["failed"] == 0
    assert post.call_count == 1
    extracted = completed_extractions(db, source="https://example.test/spec.pdf", digest="sha")
    assert extracted[0]["items"] == [{"page": 1, "quote": "Garantija: 24 mėnesiai"}]
    assert queue_stats(db) == {"completed": 1}


def test_ai_failure_does_not_stop_document_reports_and_keeps_queue(tmp_path):
    spec = tmp_path / "spec.pdf"
    catalog_dir = tmp_path / "catalogs"
    catalog_dir.mkdir()
    from main import make_pdf

    make_pdf(spec, "Specifikacija", [["Galia: ne mažiau kaip 100 W"]])
    make_pdf(catalog_dir / "catalog.pdf", "Modelis ABC-123", [["Galia: 120 W"]])
    wb = Workbook()
    wb.active["A1"] = "https://example.test/spec.pdf"
    links = tmp_path / "links.xlsx"
    wb.save(links)
    config = {
        "paths": {"links_xlsx": str(links), "catalogs": str(catalog_dir),
                  "output": str(tmp_path / "out"), "data": str(tmp_path / "data")},
        "web_search_enabled": False,
        "ollama": {"enabled": True, "base_url": "http://127.0.0.1:11434",
                   "model": "qwen3.5:4b", "num_ctx": 8192, "retry_base_seconds": 2},
    }
    with patch("main.download_public_documents", return_value=[("https://example.test/spec.pdf", spec)]), \
         patch("ai_queue.requests.post", side_effect=requests.ConnectionError("offline Ollama")):
        result = execute(config)
    assert result["xlsx"].is_file()
    assert result["comments_pdf"].is_file()
    assert result["matrix"] and result["matrix"][0]["status"] == "ATITINKA"
    assert any("offline Ollama" in error for error in result["errors"])
    assert queue_stats(tmp_path / "data" / "monitor.sqlite3") == {"pending": 2}


def test_ai_verified_quotes_flow_into_python_comparison_and_pdf_citations(tmp_path):
    from main import make_pdf

    spec_text = "Garantija: ne mažiau kaip 24 mėnesiai"
    catalog_text = "Garantija: 36 mėnesiai"
    spec = tmp_path / "spec.pdf"
    catalogs = tmp_path / "catalogs"
    catalogs.mkdir()
    make_pdf(spec, "Specifikacija", [[spec_text]])
    make_pdf(catalogs / "catalog.pdf", "Modelis ABC-123", [[catalog_text]])
    workbook = Workbook()
    workbook.active["A1"] = "https://example.test/spec.pdf"
    links = tmp_path / "links.xlsx"
    workbook.save(links)
    config = {
        "paths": {"links_xlsx": str(links), "catalogs": str(catalogs),
                  "output": str(tmp_path / "out"), "data": str(tmp_path / "data")},
        "web_search_enabled": False,
        "ollama": {"enabled": True, "model": "qwen3.5:4b", "num_ctx": 8192,
                   "max_jobs_per_run": 10, "retry_base_seconds": 1},
    }

    def fake_ollama(url, json, timeout):
        prompt = json["messages"][0]["content"]
        quote = spec_text if "privalomų reikalavimų" in prompt else catalog_text
        return FakeResponse({"items": [{"page": 1, "quote": quote}]})

    with patch("main.download_public_documents", return_value=[("https://example.test/spec.pdf", spec)]), \
         patch("ai_queue.requests.post", side_effect=fake_ollama) as post:
        result = execute(config)
    assert post.call_count == 2
    assert result["matrix"][0]["status"] == "ATITINKA"
    assert result["matrix"][0]["candidate_value"] == "36 mėnesiai"
    assert result["matrix"][0]["page"] == 1
    assert result["matrix"][0]["requirement_source"] == "https://example.test/spec.pdf"
    assert result["matrix"][0]["url"] == (catalogs / "catalog.pdf").resolve().as_uri()
    report = load_workbook(result["xlsx"], read_only=False, data_only=True)
    matrix = report["Atitikties matrica"]
    assert matrix["H2"].hyperlink.target == result["matrix"][0]["url"]
    assert matrix["I2"].hyperlink.target == "https://example.test/spec.pdf"
    assert queue_stats(tmp_path / "data" / "monitor.sqlite3") == {"completed": 2}
    proof_pdf = PdfReader(str(result["evidence_pdf"]))
    assert len(proof_pdf.pages) == 1
    pdf_text = proof_pdf.pages[0].extract_text()
    assert "ATITINKA" in pdf_text
    assert "catalog.pdf" in pdf_text and "PDF p. 1" in pdf_text


def test_evidence_and_source_columns_are_clickable_hyperlinks(tmp_path):
    path = tmp_path / "links.xlsx"
    write_workbook(path, {
        "Techniniai reikalavimai": [[1, "Galia", "Galia", "100 W", 1, "https://example.test/spec.pdf", "review"]],
        "Atitikties matrica": [["Galia", "Model A", REIKIA_PATIKRINTI, "", "review",
                                "catalog.pdf", 2, "https://vendor.test/catalog.pdf",
                                "https://example.test/spec.pdf"]],
    })
    workbook = load_workbook(path)
    assert workbook["Techniniai reikalavimai"]["F2"].hyperlink.target == "https://example.test/spec.pdf"
    matrix = workbook["Atitikties matrica"]
    assert matrix["H2"].hyperlink.target == "https://vendor.test/catalog.pdf"
    assert matrix["I2"].hyperlink.target == "https://example.test/spec.pdf"


def test_schedule_has_exact_18_ten_minute_slots():
    expected = [f"{hour:02d}:{minute:02d}" for hour in (8, 12, 16) for minute in range(0, 51, 10)]
    assert len(expected) == 18
    assert all(is_allowed_schedule_time(__import__("datetime").datetime.strptime(value, "%H:%M"), expected)
               for value in expected)
    assert not is_allowed_schedule_time(__import__("datetime").datetime(2026, 1, 1, 8, 55), expected)


def test_launchd_plist_matches_all_18_requested_times():
    plist = plistlib.loads((__import__("pathlib").Path(__file__).parent.parent /
                            "com.ruflow.ts-monitor.plist").read_bytes())
    actual = [(entry["Hour"], entry["Minute"]) for entry in plist["StartCalendarInterval"]]
    expected = [(hour, minute) for hour in (8, 12, 16) for minute in range(0, 51, 10)]
    assert actual == expected
