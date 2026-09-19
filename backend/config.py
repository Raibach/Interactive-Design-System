"""
Simple configuration module for Milvus and other settings
"""
import os


def available_memory_mb() -> float:
    """The memory this process can still use — the CONTAINER's budget, not the host's.

    psutil reads /proc/meminfo, and inside a container that is the HOST's memory: on
    production (Northflank nf-compute-20, 2026-09-19) it reported 2263MB available while
    the cgroup's memory.max was 512000000 bytes, so every "is there room for this?" guard
    passed and the kernel killed the process instead (exit 137, on a loop). The budget is
    the cgroup limit minus what the cgroup already holds, whichever is smaller than the
    host's available figure. Where no cgroup limit exists (a laptop), psutil is the truth.
    """
    try:
        import psutil

        budget = psutil.virtual_memory().available / 1048576.0
    except Exception:
        budget = float("inf")

    for limit_path, used_path in (
        ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory.current"),
        ("/sys/fs/cgroup/memory/memory.limit_in_bytes", "/sys/fs/cgroup/memory/memory.usage_in_bytes"),
    ):
        try:
            raw = open(limit_path).read().strip()
            if raw == "max":
                continue
            limit = float(raw) / 1048576.0
            try:
                used = float(open(used_path).read().strip()) / 1048576.0
            except Exception:
                used = 0.0
            budget = min(budget, max(limit - used, 0.0))
            break
        except Exception:
            continue

    return budget


# Milvus Configuration
MILVUS_MODE = os.getenv("MILVUS_MODE", "lite")
# LITE MODE'S PATH LIVES IN ITS OWN VARIABLE, and that is load-bearing: pymilvus's
# connection registry reads MILVUS_URI from the environment itself at import time and
# cannot parse a local file path ("Illegal uri … expected http[s]://…"), so a .db path
# placed under that name breaks every `import pymilvus`. Standalone/distributed (a real
# server or cloud endpoint) keeps the original name.
MILVUS_URI = (
    os.getenv("MILVUS_LITE_PATH", "./milvus.db")
    if MILVUS_MODE == "lite"
    else os.getenv("MILVUS_URI", "")
)
MILVUS_TOKEN = os.getenv("MILVUS_TOKEN", "")
# Matches the live Zilliz collections (384-dim FloatVector, COSINE) and the
# SentenceTransformer model actually used for embeddings (see ARCHITECTURE docs).
EMBEDDING_DIMENSION = 384
EMBEDDING_MODEL = "BAAI/bge-small-en"
EMBEDDING_MODEL_VERSION = "v1"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
COLLECTION_CONSISTENCY_LEVEL = "Eventually"
ENABLE_DYNAMIC_FIELDS = True

# Collection names
def get_collection_name(name):
    return name

def get_all_collections():
    # "governance" joined the store on 2026-09-19: the register, the corrections, the
    # catalog findings and every filed inspection report (backend/governance_vector.py).
    return ["default", "prompt_versions", "ai_actions", "prompt_sessions", "conversations", "memories", "files", "governance"]

# Create milvus_config submodule reference for imports
class MilvusConfig:
    MILVUS_MODE = MILVUS_MODE
    MILVUS_URI = MILVUS_URI
    MILVUS_TOKEN = MILVUS_TOKEN
    EMBEDDING_DIMENSION = EMBEDDING_DIMENSION
    COLLECTION_CONSISTENCY_LEVEL = COLLECTION_CONSISTENCY_LEVEL
    ENABLE_DYNAMIC_FIELDS = ENABLE_DYNAMIC_FIELDS
    get_collection_name = staticmethod(get_collection_name)
    get_all_collections = staticmethod(get_all_collections)

milvus_config = MilvusConfig()


# ─────────────────────────────────────────────────────────────────────────────
# Dev mode detection (caches are NEVER used in development)
# Set in backend/.env:
#   ENVIRONMENT=development
#   (also accepts: dev, local)
# Or set DEBUG=1 / true
# ─────────────────────────────────────────────────────────────────────────────
def is_development() -> bool:
    """
    Returns True when running in local development mode.
    In this mode all in-memory/TTL caches are bypassed so every request
    hits the real data sources (DB, Milvus, Figma, etc.).
    """
    env = (os.getenv("ENVIRONMENT") or "").strip().lower()
    if env in ("development", "dev", "local"):
        return True
    debug = (os.getenv("DEBUG") or "").strip().lower()
    if debug in ("1", "true", "yes", "on"):
        return True
    return False