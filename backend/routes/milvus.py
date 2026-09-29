"""Auto-extracted route module from main.py — zero behavior change."""
import sys
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from grace_gui import (
    milvus_get_versions,
    milvus_save_version,
)

router = APIRouter()

# ============================================
# MILVUS VECTOR DATABASE ENDPOINTS
# ============================================

@router.get("/api/milvus/info")
async def api_milvus_info():
    """The vector store's metadata and live collection stats.

    LOCAL NOW. These endpoints used the Zilliz-only REST client; the store is our own
    embedded milvus-lite file (see config.py), so they read it through the same client the
    app writes with — one store, one reader.
    """
    from config import MILVUS_MODE
    from milvus_client import get_milvus_client
    client = get_milvus_client()
    if client is None or client.client is None:
        raise HTTPException(status_code=503, detail="the vector store is not connected")
    collections = client.client.list_collections()
    stats = []
    for name in collections:
        entry: dict[str, Any] = {"name": name}
        try:
            info = client.get_collection_stats(name)
            entry["count"] = (info or {}).get("row_count", "unknown")
        except Exception as e:  # noqa: BLE001 — a stat that cannot be read is said
            entry["error"] = str(e)
        stats.append(entry)
    return {
        "exists": True,
        "mode": MILVUS_MODE,
        "uri": client.uri,
        "collection_count": len(collections),
        "collections": stats,
    }

@router.get("/api/milvus/collections")
async def api_milvus_collections():
    """List every collection in the local store (live)."""
    from milvus_client import get_milvus_client
    client = get_milvus_client()
    if client is None or client.client is None:
        raise HTTPException(status_code=503, detail="the vector store is not connected")
    collections = client.client.list_collections()
    stats = []
    for name in collections:
        entry: dict[str, Any] = {"name": name}
        try:
            desc = client.client.describe_collection(collection_name=name)
            entry["fields"] = [f.get("name") for f in (desc or {}).get("fields", [])]
        except Exception as e:  # noqa: BLE001
            entry["error"] = str(e)
        stats.append(entry)
    return {"collections": collections, "stats": stats}

@router.get("/api/milvus/vectors/{collection}")
async def api_milvus_vectors(collection: str, limit: int = 50, offset: int = 0):
    """Retrieve entities from a collection in the local store (live query)."""
    from milvus_client import get_milvus_client
    client = get_milvus_client()
    if client is None or client.client is None:
        raise HTTPException(status_code=503, detail="the vector store is not connected")
    entities = client.client.query(
        collection_name=collection,
        filter="",
        output_fields=["*"],
        limit=limit,
        offset=offset,
    )
    return {
        "collection": collection,
        "count": len(entities or []),
        "vectors": entities or [],
    }


class MilvusSaveRequest(BaseModel):
    prompt_config: str = ""
    output: str = ""
    session_id: str = ""


@router.post("/api/milvus/save")
async def api_milvus_save(request: MilvusSaveRequest):
    """Save prompt configuration + output as a Milvus version snapshot.
    
    Uses the new A2UI schema (prompt_versions collection).
    Returns HTTP 500 on failure so the frontend Debug Panel catches it.
    """
    try:
        workspace = (
            "=== PROMPT CONFIGURATION ===\n"
            f"{request.prompt_config}\n\n"
            "=== OUTPUT ===\n"
            f"{request.output}"
        )
        result = milvus_save_version(
            prompt_id=request.session_id or "unknown",
            content=workspace,
        )
        return {"status": "ok", "version": result}
    except Exception as e:
        print(f"[Milvus save] Error: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/milvus/versions")
async def api_milvus_versions(prompt_id: Optional[str] = None):
    """Return saved Milvus workspace versions, optionally filtered by prompt."""
    try:
        versions = milvus_get_versions(prompt_id)
        return {"status": "ok", "versions": versions}
    except Exception as e:
        print(f"[Milvus versions] Error: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


