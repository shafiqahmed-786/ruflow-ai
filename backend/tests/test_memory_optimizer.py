import asyncio
import os
import sys
import types
from unittest.mock import Mock

os.environ.setdefault("GEMINI_API_KEY", "test-key")

# sentence-transformers imports scipy/sklearn at module import time, which is
# blocked in this environment. Stub the package so we can exercise the cache
# logic without loading the heavy embedding model stack.
if "sentence_transformers" not in sys.modules:
    sentence_transformers = types.ModuleType("sentence_transformers")
    sentence_transformers.SentenceTransformer = object
    sys.modules["sentence_transformers"] = sentence_transformers

if "motor" not in sys.modules:
    motor = types.ModuleType("motor")
    motor_asyncio = types.ModuleType("motor.motor_asyncio")
    motor_asyncio.AsyncIOMotorClient = object
    motor.motor_asyncio = motor_asyncio
    sys.modules["motor"] = motor
    sys.modules["motor.motor_asyncio"] = motor_asyncio

if "pymongo" not in sys.modules:
    pymongo = types.ModuleType("pymongo")
    pymongo.DESCENDING = -1
    errors = types.ModuleType("pymongo.errors")
    errors.BulkWriteError = type("BulkWriteError", (Exception,), {})
    errors.ConnectionFailure = type("ConnectionFailure", (Exception,), {})
    errors.OperationFailure = type("OperationFailure", (Exception,), {})
    errors.ServerSelectionTimeoutError = type("ServerSelectionTimeoutError", (Exception,), {})
    pymongo.errors = errors
    sys.modules["pymongo"] = pymongo
    sys.modules["pymongo.errors"] = errors

if "chromadb" not in sys.modules:
    chromadb = types.ModuleType("chromadb")
    config = types.ModuleType("chromadb.config")
    config.Settings = object
    chromadb.config = config
    sys.modules["chromadb"] = chromadb
    sys.modules["chromadb.config"] = config

from backend.services.memory_optimizer import MemoryOptimizer
from backend.services.pattern_extractor import PatternExtractor


async def _run_cache_expiry_checks() -> None:
    optimizer = MemoryOptimizer(
        memory_service=Mock(),
        embedding_service=Mock(),
        cache_ttl_seconds=0.10,
        cache_max_size=8,
    )

    await optimizer.cache_set("warm-key", {"value": "keep"})
    assert await optimizer.cache_get("warm-key") == {"value": "keep"}

    await asyncio.sleep(0.06)
    assert await optimizer.cache_get("warm-key") == {"value": "keep"}

    await asyncio.sleep(0.06)
    assert await optimizer.cache_get("warm-key") == {"value": "keep"}

    await asyncio.sleep(0.12)
    assert await optimizer.cache_get("warm-key") is None

    await optimizer.cache_set("fresh-key", {"value": "fresh"})
    await asyncio.sleep(0.12)
    assert await optimizer.cache_get("fresh-key") is None


def test_cache_ttl_refreshes_on_hot_access() -> None:
    asyncio.run(_run_cache_expiry_checks())


def test_keyword_extraction_cache_reuses_results() -> None:
    extractor = PatternExtractor(memory_service=Mock())
    resume = """
    Summary: Led a cross-functional engineering team to reduce latency by 40% and
    deliver customer-facing features for 10,000+ users.

    - Built API services and improved release quality.
    - Managed stakeholder communication and technical design.
    """

    first = extractor.extract_keywords(resume, 90.0, top_n=5)
    second = extractor.extract_keywords(resume, 90.0, top_n=5)

    assert first == second
    assert len(extractor._keyword_cache) == 1


def test_tone_and_structure_analysis_cache_reuses_results() -> None:
    extractor = PatternExtractor(memory_service=Mock())
    resume = """
    Summary: Led a cross-functional product team that reduced latency by 40% and
    shipped 3 new APIs serving 10,000+ customers.

    - Architected resilient services and improved release quality.
    - Mentored engineers and partnered with stakeholders.
    """

    first_tone = extractor.extract_tone_markers(resume)
    second_tone = extractor.extract_tone_markers(resume)
    assert first_tone == second_tone
    assert len(extractor._tone_cache) == 1

    first_structure = extractor.extract_structure_patterns(resume)
    second_structure = extractor.extract_structure_patterns(resume)
    assert first_structure == second_structure
    assert len(extractor._structure_cache) == 1
