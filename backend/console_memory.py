"""console_memory — the console's memory: what it remembers, and how it is written.

The console is not a chat with a search box. It remembers its work: every card, every turn, every
activity row, as a vector with metadata that can be filtered before it is ranked. This module owns
the write path and the read path over the app's own Milvus client (one client per process, because
the lite store cannot be opened twice).

TWO RULES
  · Postgres is the truth. A vector is how a row is found again; the row is re-read before anything
    is shown or acted on.
  · A write that fails is reported. `index_all` returns counts and errors; nothing is swallowed.
"""
from __future__ import annotations

import json
import os
from typing import Any

import psycopg2
import psycopg2.extras

from config import EMBEDDING_DIMENSION, EMBEDDING_MODEL_VERSION
from console_scope import ELIGIBILITY_SQL, ELIGIBILITY_VERSION
from memory_embedder import get_embedder
from milvus_client import get_milvus_client

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")
NAMESPACE = "console"
BATCH = 64

# bge-small is a retrieval model: a QUERY is embedded with this instruction, a DOCUMENT is not.
# Without it every short text lands in the same similarity band and ranking stops discriminating.
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

CARD_COLLECTION = "prompt_sessions"
TURN_COLLECTION = "conversations"


def _room(session_type: str, meta: dict[str, Any]) -> str:
    room = str(meta.get("room_domain") or "")
    if room:
        return room
    if session_type.startswith("design"):
        return "design"
    if session_type == "governance":
        return "governance"
    if session_type == "console":
        return "console"
    return "composer"


def _rows() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """Every card and every turn, with the text that will be embedded. Empty text is reported."""
    notes: list[str] = []
    cards: list[dict[str, Any]] = []
    turns: list[dict[str, Any]] = []

    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT id::text AS id, user_id::text AS user_id, title, description, category,
                       status, metadata, created_at, updated_at
                  FROM prompt_sessions ps
                 WHERE {ELIGIBILITY_SQL}
                   -- THE INDEX MUST BE ABLE TO SHOW WHAT IT FINDS. The predicate is the console's
                   -- own, from console_scope — one definition shared with every reader, so the
                   -- index and the surface cannot drift (measured once: 350 indexed, 23 drawable).
                   AND (metadata->>'draft') IS DISTINCT FROM 'true'
                """
            )
            for row in cur.fetchall():
                meta = row["metadata"] or {}
                if isinstance(meta, str):
                    meta = json.loads(meta) if meta.strip() else {}
                session_type = str(meta.get("session_type") or "")
                text = f"{row['title'] or ''}. {row['description'] or ''}".strip()
                if len(text) < 2:
                    notes.append(f"card {row['id']} has no text and was not embedded")
                    continue
                stamp = row["updated_at"] or row["created_at"]
                cards.append(
                    {
                        "text": text[:4000],
                        "card_id": row["id"],
                        "user_id": row["user_id"],
                        "room": _room(session_type, meta),
                        "type": session_type,
                        "state": str(row["status"] or ""),
                        "category": str(row["category"] or ""),
                        "at": stamp.isoformat() if stamp else "",
                        "namespace": NAMESPACE,
                        "source": "card",
                        "model_version": EMBEDDING_MODEL_VERSION,
                        "eligibility_version": ELIGIBILITY_VERSION,
                    }
                )

            cur.execute(
                """
                SELECT cm.id::text AS id, cm.conversation_id::text AS conversation_id,
                       cm.user_id::text AS user_id, cm.role, cm.content, cm.created_at,
                       c.session_id::text AS session_id
                  FROM conversation_messages cm
                  JOIN conversations c ON c.id = cm.conversation_id
                 WHERE cm.content IS NOT NULL AND length(btrim(cm.content)) > 0
                 ORDER BY cm.created_at
                """
            )
            for row in cur.fetchall():
                text = str(row["content"] or "").strip()
                if not text:
                    notes.append(f"message {row['id']} has no text and was not embedded")
                    continue
                turns.append(
                    {
                        "text": text[:4000],
                        "message_id": row["id"],
                        "conversation_id": row["conversation_id"],
                        "card_id": row["session_id"] or "",
                        "user_id": row["user_id"],
                        "role": str(row["role"] or ""),
                        "at": row["created_at"].isoformat() if row["created_at"] else "",
                        "namespace": NAMESPACE,
                        "source": "turn",
                        "model_version": EMBEDDING_MODEL_VERSION,
                        "eligibility_version": ELIGIBILITY_VERSION,
                    }
                )
    return cards, turns, notes


def _write(client, collection: str, items: list[dict[str, Any]], embedder) -> int:
    written = 0
    for start in range(0, len(items), BATCH):
        batch = items[start : start + BATCH]
        vectors = embedder.generate_embeddings_batch([item["text"] for item in batch])
        metadata = []
        for item in batch:
            row = {k: v for k, v in item.items() if k != "text"}
            row["text"] = item["text"][:512]
            metadata.append(row)
        client.insert(collection, vectors, metadata)
        written += len(batch)
    return written


def _reset(client, collection: str) -> None:
    """Drop and recreate a derived collection, with the metric search expects."""
    raw = client.client
    if raw is None:
        client.connect()
        raw = client.client
    if raw.has_collection(collection):
        raw.drop_collection(collection)
    raw.create_collection(
        collection_name=collection,
        dimension=EMBEDDING_DIMENSION,
        metric_type="COSINE",
        auto_id=True,
    )


def index_all(force: bool = False) -> dict[str, Any]:
    """Embed every card and every turn into the console's memory. Returns counts and errors."""
    embedder = get_embedder()
    if embedder is None:
        return {"ok": False, "error": "the embedder is unavailable; nothing was written"}

    client = get_milvus_client()
    if client is None:
        return {"ok": False, "error": "the Milvus client is unavailable; nothing was written"}

    cards, turns, notes = _rows()

    written = {}
    for collection, items in ((CARD_COLLECTION, cards), (TURN_COLLECTION, turns)):
        try:
            if force:
                _reset(client, collection)
            stats = client.get_collection_stats(collection)
            existing = int(stats.get("row_count") or 0)
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": f"{collection} could not be rebuilt: {exc}"}
        if existing > 0:
            notes.append(f"{collection} already holds {existing} vectors; this run appended nothing")
            written[collection] = 0
            continue
        try:
            written[collection] = _write(client, collection, items, embedder)
        except Exception as exc:  # noqa: BLE001 — the failure is the answer
            return {"ok": False, "error": f"{collection} write failed: {exc}", "notes": notes}

    return {
        "ok": True,
        "cards": len(cards),
        "turns": len(turns),
        "written": written,
        "notes": notes,
    }


def search_cards(
    text: str,
    user_id: str,
    limit: int = 200,
    card_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Cards nearest to a phrase, for this owner only. Ids are re-read from Postgres by the caller.

    `card_ids` narrows the vector search to an already-built set — the active tab's cards. A tab
    search must run over that tab's cards, not over the whole library and then be intersected
    afterwards; the nearest library card can be in another tab and the real match never surfaces.
    """
    embedder = get_embedder()
    client = get_milvus_client()
    if embedder is None or client is None:
        return []
    filter_expr = f'user_id == "{user_id}"'
    if card_ids is not None:
        allowed = [str(card_id) for card_id in card_ids if card_id]
        if not allowed:
            return []
        filter_expr += f" and card_id in {json.dumps(allowed)}"
    vector = embedder.generate_embedding(QUERY_PREFIX + text)
    hits = client.search(
        CARD_COLLECTION,
        [vector],
        filter_expr=filter_expr,
        limit=limit,
        output_fields=["card_id"],
    )
    rows = hits[0] if hits else []
    out = []
    for hit in rows or []:
        entity = hit.get("entity") or {}
        card_id = hit.get("card_id") or entity.get("card_id")
        if card_id:
            out.append({"card_id": str(card_id), "score": float(hit.get("distance") or 0.0)})
    return out


def search_turns(text: str, limit: int = 20, filter_expr: str = "") -> list[dict[str, Any]]:
    """Nearest turns to a text. The caller re-reads the rows before anything is shown."""
    embedder = get_embedder()
    client = get_milvus_client()
    if embedder is None or client is None:
        return []
    vector = embedder.generate_embedding(QUERY_PREFIX + text)
    hits = client.search(TURN_COLLECTION, [vector], limit=limit, filter_expr=filter_expr or None)
    return (hits[0] if hits else []) or []

def index_turn(turn: dict[str, Any]) -> bool:
    """Write one stored turn into the console's memory. The caller has already committed it."""
    text = str(turn.get("content") or "").strip()
    if not text:
        return False
    embedder = get_embedder()
    client = get_milvus_client()
    if embedder is None or client is None:
        return False
    vector = embedder.generate_embedding(text[:4000])
    metadata = {
        "message_id": str(turn.get("message_id") or ""),
        "conversation_id": str(turn.get("conversation_id") or ""),
        "card_id": str(turn.get("card_id") or ""),
        "user_id": str(turn.get("user_id") or ""),
        "role": str(turn.get("role") or ""),
        "at": str(turn.get("at") or ""),
        "namespace": NAMESPACE,
        "source": "turn",
        "model_version": EMBEDDING_MODEL_VERSION,
        "text": text[:512],
    }
    client.insert(TURN_COLLECTION, [vector], [metadata])
    return True
