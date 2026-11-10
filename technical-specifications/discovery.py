"""Model-specific public-source discovery; every entity remains a review candidate."""

from __future__ import annotations

import json
import re
import urllib.parse
from typing import Any

from bs4 import BeautifulSoup

from ts_monitor import fetch_public_bytes, render_public_page, search_public_web


def _contains_model(value: Any, model: str) -> bool:
    if not isinstance(value, str) or not model.strip():
        return False
    return bool(re.search(rf"(?<![\w-]){re.escape(model)}(?![\w-])", value, re.IGNORECASE))


def _nodes(value: Any):
    if isinstance(value, list):
        for item in value:
            yield from _nodes(item)
    elif isinstance(value, dict):
        yield value
        if "@graph" in value:
            yield from _nodes(value["@graph"])


def _organization(value: Any, source: str) -> dict[str, str] | None:
    if isinstance(value, str):
        return {"name": value.strip(), "website": "", "country": "", "contact": ""}
    if not isinstance(value, dict) or not isinstance(value.get("name"), str):
        return None
    address = value.get("address")
    country = address.get("addressCountry", "") if isinstance(address, dict) else ""
    if isinstance(country, dict):
        country = country.get("name", "")
    contacts = []
    for key in ("email", "telephone"):
        contact = value.get(key)
        if isinstance(contact, str) and contact.strip():
            contacts.append(contact.strip())
    website = value.get("url", "")
    if not isinstance(website, str):
        website = ""
    if website:
        website = urllib.parse.urljoin(source, website)
        if urllib.parse.urlparse(website).scheme not in ("http", "https"):
            website = ""
    return {"name": value["name"].strip(), "website": website,
            "country": country if isinstance(country, str) else "", "contact": "; ".join(contacts)}


def extract_model_candidates(html: str | bytes, url: str, model: str) -> list[dict[str, str]]:
    """Extract explicit product-to-entity relations, not identities inferred from domains."""
    soup = BeautifulSoup(html, "html.parser")
    candidates: list[dict[str, str]] = []
    for script in soup.find_all("script", type=re.compile(r"^application/ld\+json", re.I)):
        try:
            data = json.loads(script.string or script.get_text())
        except (ValueError, TypeError):
            continue
        for product in _nodes(data):
            types = product.get("@type", [])
            if isinstance(types, str):
                types = [types]
            if not isinstance(types, list) or not any(
                isinstance(item, str) and item.rsplit("/", 1)[-1].casefold() == "product" for item in types
            ):
                continue
            if not any(_contains_model(product.get(key), model) for key in ("name", "model", "sku", "mpn", "productID")):
                continue
            relationships: list[tuple[str, Any]] = [("Gamintojas", product.get("manufacturer"))]
            offers = product.get("offers", [])
            if not isinstance(offers, list):
                offers = [offers]
            for offer in offers:
                if isinstance(offer, dict):
                    relationships.append(("Tiekėjas", offer.get("seller")))
            for role, entity in relationships:
                organization = _organization(entity, url)
                if not organization or not organization["name"]:
                    continue
                evidence = json.dumps({
                    "product": {key: product[key] for key in ("name", "model", "sku", "mpn", "productID") if key in product},
                    "manufacturer" if role == "Gamintojas" else "seller": entity,
                }, ensure_ascii=False, separators=(",", ":"))
                candidates.append({"model": model, "role": role, "name": organization["name"],
                                   "country": organization["country"], "website": organization["website"],
                                   "contact": organization["contact"], "source": url, "evidence": evidence,
                                   "status": "KANDIDATAS – REIKIA PATIKRINTI"})
    # Text labels and model mentions on the same page are leads, not proof of association.
    lines = [" ".join(line.split()) for line in soup.get_text("\n", strip=True).splitlines()]
    model_line = next((line for line in lines if _contains_model(line, model)), "")
    if model_line:
        for line in lines:
            match = re.fullmatch(
                r"(gamintojas|manufacturer|tiekėjas|supplier|platintojas|distributor)\s*:\s*(.{2,120})",
                line, re.IGNORECASE,
            )
            if not match:
                continue
            role = "Gamintojas" if match.group(1).casefold() in ("gamintojas", "manufacturer") else "Tiekėjas"
            candidates.append({"model": model, "role": role, "name": match.group(2).strip(),
                               "country": "", "website": "", "contact": "", "source": url,
                               "evidence": f"Modelio paminėjimas: {model_line[:250]} | Įmonės žyma: {line[:250]}. "
                                           "Ryšys tarp jų nepatvirtintas.",
                               "status": "PAIEŠKOS KANDIDATAS – REIKIA PATIKRINTI"})
    return candidates


def discover_model(model: str, db_path: Any, timeout: int = 25,
                   use_playwright: bool = False, max_results: int = 4) -> tuple[list[dict[str, str]], list[str]]:
    """Search and inspect a bounded set of public product pages for an identified model."""
    errors: list[str] = []
    results: list[dict[str, str]] = []
    visited: set[str] = set()
    queries = (f'"{model}" manufacturer official product', f'"{model}" distributor supplier Lithuania Europe')
    search_results = [search_public_web(query, db_path) for query in queries]
    for index in range(max((len(items) for items in search_results), default=0)):
        for leads in search_results:
            if index >= len(leads):
                continue
            lead = leads[index]
            url = lead.get("url", "")
            if not url:
                if lead.get("title") == "Paieška nepavyko":
                    errors.append(f"Modelio {model} paieška nepavyko: {lead.get('snippet', '')}")
                continue
            if url in visited or len(visited) >= max_results:
                continue
            visited.add(url)
            try:
                final_url, content_type, body = fetch_public_bytes(url, timeout, 5 * 1024 * 1024)
                if "pdf" in content_type or "officedocument" in content_type:
                    continue
                parsed = extract_model_candidates(body, final_url, model)
                if not parsed and use_playwright:
                    rendered_url, rendered_html = render_public_page(final_url, timeout)
                    parsed = extract_model_candidates(rendered_html, rendered_url, model)
                results.extend(parsed)
                if not parsed:
                    results.append({"model": model, "role": "Nežinoma", "name": lead.get("title", ""),
                                    "country": "", "website": "", "contact": "", "source": final_url,
                                    "evidence": "Modelio ir įmonės vaidmens ryšys puslapyje nepatvirtintas.",
                                    "status": "PAIEŠKOS KANDIDATAS – REIKIA PATIKRINTI"})
            except Exception as error:
                errors.append(f"Modelio {model} šaltinis {url}: {error}")
                results.append({"model": model, "role": "Nežinoma", "name": lead.get("title", ""),
                                "country": "", "website": "", "contact": "", "source": url,
                                "evidence": "Šaltinio perskaityti nepavyko.",
                                "status": "PAIEŠKOS KANDIDATAS – REIKIA PATIKRINTI"})
    unique = {(row["model"], row["role"], row["name"], row["source"], row["evidence"]): row for row in results}
    return list(unique.values()), errors
