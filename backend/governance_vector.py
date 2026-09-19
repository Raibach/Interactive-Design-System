"""governance_vector — the governance rows, in the local store.

WHAT LIVES HERE. The register (open-items.json), the corrections ledger, the catalog
findings, and every filed inspection report — the data the governance loop reads and
writes. The inspector used to hand the models the whole register and the whole report
every run; the point of this module is that a run retrieves the rows RELEVANT to the
question being asked, so the dossier shrinks and the model's context is a handful of
rows instead of a file. Token burn is the metric underneath every initiative here.

COST. Embeddings are made locally (BAAI/bge-small-en, cached weights) — no model tokens
are spent to write or read this store.

The store itself is the app's own: the embedded milvus-lite file (see config.py), reached
through the same client the rest of the app uses.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

COLLECTION = "governance"


def _embedder():
    from memory_embedder import get_embedder
    emb = get_embedder()
    if emb is None:
        raise RuntimeError("the embedding model did not load — governance vectors are off")
    return emb


def _client():
    from milvus_client import get_milvus_client
    client = get_milvus_client()
    if client is None or client.client is None:
        raise RuntimeError("the vector store is not connected")
    return client


def ensure_collection() -> None:
    """Create the collection if the store does not have it yet — the wrapper's own schema."""
    client = _client()
    if COLLECTION not in client.client.list_collections():
        client.create_collection(COLLECTION)
        print(f"[governance_vector] created collection: {COLLECTION}")


def _row_text(kind: str, row: Dict[str, Any]) -> str:
    """One row, as the sentence that gets embedded — the same words a reader sees."""
    if kind == "register":
        return f"{row.get('id', '')} [{row.get('status', '')}/{row.get('owner', '')}] {row.get('what', '')}"
    if kind == "correction":
        return f"{row.get('finding', '')} corrected by {row.get('corrected', '')}: {row.get('witness', '')}"
    if kind == "finding":
        return f"{row.get('check', '')} {row.get('component', '')} ({row.get('nodeId', '')}) {row.get('what', '')} FIX: {row.get('fix', '')}"
    if kind == "inspection":
        return row.get("text", "")
    return str(row.get("text", ""))


def index_rows(kind: str, rows: List[Dict[str, Any]]) -> int:
    """Embed and store a batch of governance rows. Returns how many landed.

    Every row carries its own identity in metadata, so a search hit can be cited
    (id, check, owner, file...), not merely recalled.
    """
    if not rows:
        return 0
    ensure_collection()
    client = _client()
    emb = _embedder()
    payload = []
    for row in rows:
        text = _row_text(kind, row).strip()
        if not text:
            continue
        vector = emb.generate_embedding(text)
        if not vector:
            print(f"[governance_vector] no embedding produced for {kind}:{row.get('id', '?')} — left unindexed, said so")
            continue
        payload.append({
            "vector": vector,
            "kind": kind,
            "ref_id": str(row.get("id") or row.get("finding") or row.get("at") or ""),
            "status": str(row.get("status", "")),
            "owner": str(row.get("owner", "")),
            "check": str(row.get("check", "")),
            "level": str(row.get("level", "")),
            "component": str(row.get("component", "")),
            "node_id": str(row.get("nodeId", "")),
            "file": str(row.get("file", "")),
            "at": str(row.get("at", "")),
            "text": text,
        })
    if not payload:
        return 0
    client.client.insert(COLLECTION, payload)
    return len(payload)


def search(query: str, k: int = 8, kind: Optional[str] = None) -> List[Dict[str, Any]]:
    """The closest governance rows to `query`, optionally one kind only."""
    client = _client()
    if COLLECTION not in client.client.list_collections():
        return []
    emb = _embedder()
    vector = emb.generate_embedding(query)
    if not vector:
        return []
    expr = f'kind == "{kind}"' if kind else ""
    try:
        hits = client.client.search(
            collection_name=COLLECTION,
            data=[vector],
            filter=expr,
            limit=k,
            output_fields=["kind", "ref_id", "status", "owner", "check", "level", "component", "file", "at", "text"],
        )
    except Exception as exc:  # noqa: BLE001 — a store that cannot answer says so
        print(f"[governance_vector] search failed: {type(exc).__name__}: {exc}")
        return []
    out = []
    for hit in (hits[0] if hits else []):
        entity = hit.get("entity", {}) if isinstance(hit, dict) else {}
        out.append({**entity, "score": hit.get("distance") if isinstance(hit, dict) else None})
    return out


def count(kind: Optional[str] = None) -> int:
    client = _client()
    if COLLECTION not in client.client.list_collections():
        return 0
    expr = f'kind == "{kind}"' if kind else ""
    try:
        result = client.client.query(collection_name=COLLECTION, filter=expr, output_fields=["count(*)"])
        return int(result[0].get("count(*)", 0)) if result else 0
    except Exception:  # noqa: BLE001
        return 0
