import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

import pytest
from openpyxl import Workbook, load_workbook

from discovery import discover_model, extract_model_candidates
from main import execute, make_pdf, write_workbook
from ts_monitor import download_public_documents, validate_public_url


def product_html(model="ABC-123"):
    product = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": f"Modelis {model}",
        "manufacturer": {
            "@type": "Organization", "name": "Gamintojas UAB",
            "url": "https://manufacturer.example", "address": {"addressCountry": "LT"},
            "email": "info@manufacturer.example",
        },
        "offers": {
            "@type": "Offer", "seller": {
                "@type": "Organization", "name": "Platintojas UAB",
                "url": "https://supplier.example", "address": {"addressCountry": "DE"},
                "telephone": "+49 1234",
            },
        },
    }
    return f'<script type="application/ld+json">{json.dumps(product)}</script>'


def test_structured_data_keeps_manufacturer_and_seller_separate_with_provenance():
    rows = extract_model_candidates(product_html(), "https://catalog.example/product", "ABC-123")
    assert [row["role"] for row in rows] == ["Gamintojas", "Tiekėjas"]
    assert rows[0]["name"] == "Gamintojas UAB"
    assert rows[0]["country"] == "LT"
    assert rows[0]["contact"] == "info@manufacturer.example"
    assert rows[1]["name"] == "Platintojas UAB"
    assert rows[1]["country"] == "DE"
    assert rows[1]["contact"] == "+49 1234"
    assert all(row["status"] == "KANDIDATAS – REIKIA PATIKRINTI" for row in rows)
    assert all(row["source"] == "https://catalog.example/product" for row in rows)
    assert "ABC-123" in rows[0]["evidence"]


def test_unrelated_model_brand_and_snippet_do_not_claim_manufacturer():
    assert extract_model_candidates(product_html("ABC-1234"), "https://example.com", "ABC-123") == []
    html = '<script type="application/ld+json">{"@type":"Product","sku":"ABC-123","brand":{"name":"Brand"}}</script>'
    assert extract_model_candidates(html, "https://example.com", "ABC-123") == []
    assert extract_model_candidates("ABC-123 official manufacturer Example", "https://example.com", "ABC-123") == []


def test_visible_label_with_model_is_only_an_unconfirmed_lead():
    rows = extract_model_candidates(
        "<h1>Modelis ABC-123</h1><p>Gamintojas: Firma UAB</p>",
        "https://example.com/product", "ABC-123",
    )
    assert len(rows) == 1 and rows[0]["name"] == "Firma UAB"
    assert rows[0]["role"] == "Gamintojas" and "REIKIA PATIKRINTI" in rows[0]["status"]
    assert "Ryšys tarp jų nepatvirtintas" in rows[0]["evidence"]
    assert rows[0]["website"] == rows[0]["country"] == rows[0]["contact"] == ""


def test_search_leads_are_not_upgraded_when_page_fetch_fails(tmp_path):
    lead = {"title": "Company", "url": "https://example.com/product", "snippet": "ABC-123 manufacturer"}
    with patch("discovery.search_public_web", return_value=[lead]), \
         patch("discovery.fetch_public_bytes", side_effect=ValueError("not reachable")):
        rows, errors = discover_model("ABC-123", tmp_path / "cache.sqlite3")
    assert len(rows) == 1 and rows[0]["role"] == "Nežinoma"
    assert rows[0]["country"] == rows[0]["contact"] == ""
    assert "REIKIA PATIKRINTI" in rows[0]["status"]
    assert errors and "not reachable" in errors[0]


def test_discovery_uses_both_manufacturer_and_supplier_searches(tmp_path):
    responses = [
        [{"title": "M", "url": "https://one.example", "snippet": ""}],
        [{"title": "S", "url": "https://two.example", "snippet": ""}],
    ]
    with patch("discovery.search_public_web", side_effect=responses) as search, \
         patch("discovery.fetch_public_bytes", side_effect=lambda url, *args: (url, "text/html", product_html().encode())):
        rows, errors = discover_model("ABC-123", tmp_path / "cache.sqlite3", max_results=2)
    assert search.call_count == 2 and not errors
    assert {row["source"] for row in rows} == {"https://one.example", "https://two.example"}


def test_private_urls_remain_blocked():
    with pytest.raises(ValueError, match="privačių"):
        validate_public_url("http://127.0.0.1:8080/a.pdf")
    with pytest.raises(ValueError, match="be prisijungimo"):
        validate_public_url("https://name:password@example.com/")


def test_untrusted_spreadsheet_values_remain_literal(tmp_path):
    report = tmp_path / "report.xlsx"
    write_workbook(report, {"Tiekėjai ir kontaktai": [["=HYPERLINK(\"https://example.com\")", "", "", "+370 600"]]})
    row = list(load_workbook(report)["Tiekėjai ir kontaktai"].rows)[1]
    assert row[0].data_type == "s" and row[0].value.startswith("=")
    assert row[3].data_type == "s" and row[3].value == "+370 600"


def test_dynamic_model_page_is_rendered_when_static_page_has_no_product(tmp_path):
    lead = {"title": "Product", "url": "https://example.com/p", "snippet": ""}
    with patch("discovery.search_public_web", return_value=[lead]), \
         patch("discovery.fetch_public_bytes", return_value=(lead["url"], "text/html", b"<html></html>")), \
         patch("discovery.render_public_page", return_value=(lead["url"], product_html())) as render:
        rows, errors = discover_model("ABC-123", tmp_path / "db", use_playwright=True)
    assert render.call_count == 1 and not errors
    assert {row["role"] for row in rows} == {"Gamintojas", "Tiekėjas"}


def test_real_playwright_renders_js_link_and_downloads_document(tmp_path):
    pdf = tmp_path / "fixture.pdf"
    make_pdf(pdf, "Specification", [["Galia: 100 W"]])
    pdf_bytes = pdf.read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = (pdf_bytes if self.path == "/doc.pdf" else
                    b"<html><body><script>document.body.innerHTML='<a href=\"/doc.pdf\">PDF</a>'</script></body></html>")
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf" if self.path == "/doc.pdf" else "text/html")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_port}/"
        # A loopback fixture is allowed only in this test, never in the application.
        with patch("ts_monitor.validate_public_url"):
            result = download_public_documents(url, tmp_path / "downloads", timeout=10, use_playwright=True)
        assert len(result) == 1 and result[0][0] == url + "doc.pdf"
        assert result[0][1].read_bytes() == pdf_bytes
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def test_discovered_entities_reach_correct_workbook_sheets(tmp_path):
    spec = tmp_path / "spec.pdf"
    catalogs = tmp_path / "catalogs"
    catalogs.mkdir()
    make_pdf(spec, "Techninė specifikacija", [["Galia: ne mažiau kaip 100 W"]])
    make_pdf(catalogs / "catalog.pdf", "Modelis ABC-123", [["Galia: 120 W"]])
    wb = Workbook()
    wb.active["A1"] = "https://example.com/spec.pdf"
    links = tmp_path / "links.xlsx"
    wb.save(links)
    config = {"paths": {"links_xlsx": str(links), "catalogs": str(catalogs),
                        "output": str(tmp_path / "output"), "data": str(tmp_path / "data")},
              "web_search_enabled": True, "max_web_searches_per_run": 0,
              "ollama": {"enabled": False}}
    candidates = extract_model_candidates(product_html(), "https://product.example/page", "ABC-123")
    with patch("main.download_public_documents", return_value=[("https://example.com/spec.pdf", spec)]), \
         patch("main.discover_model", return_value=(candidates, [])) as discover:
        result = execute(config)
    assert discover.call_args.args[0] == "ABC-123"
    report = load_workbook(result["xlsx"], read_only=True, data_only=True)
    manufacturers = list(report["Gamintojai ir modeliai"].values)
    suppliers = list(report["Tiekėjai ir kontaktai"].values)
    manufacturer = next(row for row in manufacturers if row[1] == "Gamintojas")
    seller = next(row for row in suppliers if row[0] == "Platintojas UAB")
    assert manufacturer[2] == "LT" and "https://product.example/page" in manufacturer[4]
    assert seller[1:5] == ("DE", "https://supplier.example", "+49 1234", "ABC-123")
    assert all("REIKIA PATIKRINTI" in row[-1] for row in (manufacturer, seller))
