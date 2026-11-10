"""Durable, evidence-validated local Ollama extraction queue."""

from __future__ import annotations

import fcntl
import hashlib
import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any
import urllib.parse

import requests

PROMPT_VERSION = "quoted-evidence-v1"
_LOCAL_AI_LOCK = threading.Lock()


def initialize_ai_queue(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as db:
        db.execute("""CREATE TABLE IF NOT EXISTS ai_jobs(
            id INTEGER PRIMARY KEY,
            job_key TEXT NOT NULL UNIQUE,
            source TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            document_path TEXT NOT NULL,
            role TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            pages_json TEXT NOT NULL,
            prompt_version TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            available_at REAL NOT NULL DEFAULT 0,
            last_error TEXT,
            result_json TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )""")
        db.execute("CREATE INDEX IF NOT EXISTS ai_jobs_ready ON ai_jobs(status, available_at, id)")


def _chunks(pages: list[str], chunk_pages: int, max_chars: int) -> list[list[dict[str, Any]]]:
    result: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    length = 0

    def flush() -> None:
        nonlocal current, length
        if current:
            result.append(current)
            current, length = [], 0

    for page_number, text in enumerate(pages, 1):
        remaining = text
        while remaining:
            capacity = max_chars - length
            if capacity <= 0 or len(current) >= chunk_pages:
                flush()
                capacity = max_chars
            piece = remaining[:capacity]
            if len(piece) < len(remaining):
                boundary = max(piece.rfind("\n"), piece.rfind(". "), piece.rfind("; "))
                if boundary > int(capacity * 0.6):
                    piece = piece[:boundary + (1 if remaining[boundary] == "\n" else 2)]
            current.append({"page": page_number, "text": piece})
            length += len(piece)
            remaining = remaining[len(piece):]
            if remaining:
                flush()
            elif len(current) >= chunk_pages:
                flush()
    flush()
    return result


def enqueue_document(
    db_path: Path, source: str, digest: str, document_path: Path, role: str,
    pages: list[str], chunk_pages: int = 4, max_chars: int = 18000,
) -> int:
    initialize_ai_queue(db_path)
    jobs = _chunks(pages, chunk_pages=max(1, chunk_pages), max_chars=max(1000, max_chars))
    with sqlite3.connect(db_path) as db:
        before = db.total_changes
        for index, chunk in enumerate(jobs):
            key = hashlib.sha256(
                f"{source}\0{digest}\0{role}\0{index}\0{PROMPT_VERSION}".encode()
            ).hexdigest()
            db.execute(
                """INSERT OR IGNORE INTO ai_jobs(
                    job_key,source,sha256,document_path,role,chunk_index,pages_json,prompt_version
                ) VALUES(?,?,?,?,?,?,?,?)""",
                (key, source, digest, str(document_path), role, index,
                 json.dumps(chunk, ensure_ascii=False), PROMPT_VERSION),
            )
        return db.total_changes - before


def _normalize(value: str) -> str:
    return " ".join(value.split())


def _prompt(role: str, pages: list[dict[str, Any]]) -> str:
    kind = "privalomų reikalavimų" if role == "specification" else "techninių parametrų"
    payload = "\n\n".join(f"[PDF puslapis {item['page']}]\n{item['text']}" for item in pages)
    return (
        f"Iš pateikto dokumento išrink tik aiškiai parašytas {kind} eilutes. "
        "Nedaryk išvadų, neperskaičiuok reikšmių, nepildyk trūkstamų duomenų ir nekurk įrodymų. "
        "Kiekvienas elementas privalo turėti tikslų, pažodinį quote fragmentą iš pateikto puslapio "
        "ir to fragmento PDF puslapio numerį. Jei nėra patikimos eilutės, grąžink tuščią items masyvą. "
        'Atsakyk tik JSON formatu {"items":[{"quote":"pažodinė eilutė","page":1}]}. '
        "Pateikti dokumento tekstai:\n" + payload
    )


def validate_extraction(value: Any, pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not isinstance(value, dict) or not isinstance(value.get("items"), list):
        raise ValueError("Ollama atsakymas neatitinka JSON {items:[...]} schemos.")
    source_pages = {int(item["page"]): _normalize(str(item["text"])) for item in pages}
    verified = []
    for item in value["items"]:
        if not isinstance(item, dict) or not isinstance(item.get("page"), int) or not isinstance(item.get("quote"), str):
            continue
        quote = _normalize(item["quote"])
        page = item["page"]
        if len(quote) < 8 or page not in source_pages or quote not in source_pages[page]:
            continue
        verified.append({"page": page, "quote": quote})
    return verified


def ollama_extract(
    pages: list[dict[str, Any]], role: str, base_url: str,
    model: str, num_ctx: int, timeout: int,
) -> list[dict[str, Any]]:
    parsed_url = urllib.parse.urlparse(base_url)
    if (parsed_url.scheme != "http" or parsed_url.hostname not in ("127.0.0.1", "localhost", "::1")
            or parsed_url.username or parsed_url.password):
        raise ValueError("Ollama turi veikti lokaliai (127.0.0.1/localhost); nuotoliniai AI galiniai taškai draudžiami.")
    prompt = _prompt(role, pages)
    response = requests.post(
        base_url.rstrip("/") + "/api/chat",
        json={
            "model": model,
            "stream": False,
            "think": False,
            "format": {"type": "object", "properties": {
                "items": {"type": "array", "items": {"type": "object", "properties": {
                    "quote": {"type": "string"}, "page": {"type": "integer"},
                }, "required": ["quote", "page"], "additionalProperties": False}},
            }, "required": ["items"], "additionalProperties": False},
            "options": {"num_ctx": num_ctx, "temperature": 0},
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload.get("message", {}).get("content")
    if not isinstance(content, str):
        raise ValueError("Ollama negrąžino message.content teksto.")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as error:
        raise ValueError(f"Ollama grąžino netaisyklingą JSON: {error}") from error
    return validate_extraction(parsed, pages)


def process_pending_jobs(
    db_path: Path, *, base_url: str = "http://127.0.0.1:11434",
    model: str = "qwen3.5:4b", num_ctx: int = 8192,
    timeout: int = 60, max_jobs: int = 20, retry_base_seconds: int = 60,
) -> dict[str, Any]:
    """Process jobs serially, keep failures durable, and back off on unavailable Ollama."""
    initialize_ai_queue(db_path)
    if not _LOCAL_AI_LOCK.acquire(blocking=False):
        return {"processed": 0, "failed": 0, "busy": True, "error": "AI užklausa jau vykdoma."}
    lock_fd = None
    try:
        lock_path = db_path.with_name("ollama-analysis.lock")
        lock_fd = lock_path.open("a+")
        try:
            fcntl.flock(lock_fd.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {"processed": 0, "failed": 0, "busy": True, "error": "Kitas procesas naudoja vietinį Ollama."}
        processed = 0
        failed = 0
        first_error = ""
        for _ in range(max(0, max_jobs)):
            with sqlite3.connect(db_path) as db:
                row = db.execute(
                    """SELECT id,role,pages_json,attempts FROM ai_jobs
                       WHERE status='pending' AND available_at<=? ORDER BY id LIMIT 1""",
                    (time.time(),),
                ).fetchone()
            if not row:
                break
            job_id, role, pages_json, attempts = row
            pages = json.loads(pages_json)
            try:
                result = ollama_extract(pages, role, base_url, model, num_ctx, timeout)
            except Exception as error:
                failed += 1
                first_error = str(error)
                delay = min(12 * 60 * 60, max(1, retry_base_seconds) * (2 ** min(attempts, 10)))
                with sqlite3.connect(db_path) as db:
                    db.execute(
                        """UPDATE ai_jobs SET attempts=attempts+1,available_at=?,last_error=?,
                           updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'""",
                        (time.time() + delay, first_error[:2000], job_id),
                    )
                break
            with sqlite3.connect(db_path) as db:
                db.execute(
                    """UPDATE ai_jobs SET status='completed',attempts=attempts+1,
                       result_json=?,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?""",
                    (json.dumps(result, ensure_ascii=False), job_id),
                )
            processed += 1
        return {"processed": processed, "failed": failed, "busy": False, "error": first_error}
    finally:
        if lock_fd:
            lock_fd.close()
        _LOCAL_AI_LOCK.release()


def completed_extractions(db_path: Path, *, source: str | None = None,
                          digest: str | None = None) -> list[dict[str, Any]]:
    initialize_ai_queue(db_path)
    filters, values = ["status='completed'"], []
    if source is not None:
        filters.append("source=?")
        values.append(source)
    if digest is not None:
        filters.append("sha256=?")
        values.append(digest)
    with sqlite3.connect(db_path) as db:
        rows = db.execute(
            f"SELECT source,sha256,document_path,role,chunk_index,pages_json,result_json FROM ai_jobs "
            f"WHERE {' AND '.join(filters)} ORDER BY id", values,
        ).fetchall()
    return [{
        "source": source, "sha256": sha, "document_path": document_path,
        "role": role, "chunk_index": index, "pages": json.loads(pages_json),
        "items": json.loads(result_json or "[]"),
    } for source, sha, document_path, role, index, pages_json, result_json in rows]


def queue_stats(db_path: Path) -> dict[str, int]:
    initialize_ai_queue(db_path)
    with sqlite3.connect(db_path) as db:
        rows = db.execute("SELECT status,COUNT(*) FROM ai_jobs GROUP BY status").fetchall()
    return {status: count for status, count in rows}
