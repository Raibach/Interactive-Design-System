"""reindex_console_memory — fill the console's memory (Milvus) from Postgres.

WHY DERIVED, NOT AUTHORITATIVE. Every vector here is made from a row that already exists
(`prompt_sessions`, `conversation_messages`). The row stays the truth; the vector is a way to find
it again. So a rebuild is a reset, and it is safe to run any time.

WHAT IT WRITES
  prompt_sessions  one vector per card, from title + description + the record's own words
  conversations    one vector per message, from its text

Every vector carries the owner, the seat namespace (`console` for now), the room, the type, the
state, the time and the embedding model version, so a query can scope before it ranks.

Usage (from backend/):  .venv/bin/python reindex_console_memory.py
Receipts: counts before and after, per source. A row whose text is empty is REPORTED, never
silently skipped.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402
from pymilvus import MilvusClient  # noqa: E402

from config import EMBEDDING_DIMENSION, EMBEDDING_MODEL_VERSION, MILVUS_URI  # noqa: E402
from memory_embedder import get_embedder  # noqa: E402

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")
NAMESPACE = "console"
BATCH = 64


def _reset(client: MilvusClient, name: str) -> None:
    if name in client.list_collections():
        client.drop_collection(name)
    client.create_collection(
        collection_name=name,
        dimension=EMBEDDING_DIMENSION,
        metric_type="COSINE",
        auto_id=True,
    )


def _count(client: MilvusClient, name: str) -> int:
    try:
        stats = client.get_collection_stats(name)
        return int(stats.get("row_count") or 0)
    except Exception:
        return -1


def _room(session_type: str, meta: dict) -> str:
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


def _cards(cur) -> list[dict]:
    cur.execute(
        """
        SELECT id::text AS id, user_id::text AS user_id, title, description, category, status,
               metadata, created_at, updated_at
          FROM prompt_sessions
         WHERE is_archived IS NOT TRUE
        """
    )
    rows = cur.fetchall()
    out, empty = [], 0
    for row in rows:
        meta = row["metadata"] or {}
        if isinstance(meta, str):
            import json

            meta = json.loads(meta) if meta.strip() else {}
        session_type = str(meta.get("session_type") or "")
        text = f"{row['title'] or ''}. {row['description'] or ''}".strip()
        if not text or text == ".":
            empty += 1
            continue
        out.append(
            {
                "text": text[:4000],
                "card_id": row["id"],
                "user_id": row["user_id"],
                "room": _room(session_type, meta),
                "type": session_type,
                "state": str(row["status"] or ""),
                "category": str(row["category"] or ""),
                "at": (row["updated_at"] or row["created_at"]).isoformat() if (row["updated_at"] or row["created_at"]) else "",
                "source": "card",
                "namespace": NAMESPACE,
                "model_version": EMBEDDING_MODEL_VERSION,
            }
        )
    return out, empty


def _turns(cur) -> list[dict]:
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
    rows = cur.fetchall()
    out, empty = [], 0
    for row in rows:
        text = str(row["content"] or "").strip()
        if not text:
            empty += 1
            continue
        out.append(
            {
                "text": text[:4000],
                "message_id": row["id"],
                "conversation_id": row["conversation_id"],
                "card_id": row["session_id"] or "",
                "user_id": row["user_id"],
                "role": str(row["role"] or ""),
                "at": row["created_at"].isoformat() if row["created_at"] else "",
                "source": "turn",
                "namespace": NAMESPACE,
                "model_version": EMBEDDING_MODEL_VERSION,
            }
        )
    return out, empty


def _write(client: MilvusClient, collection: str, items: list[dict], embedder) -> None:
    for start in range(0, len(items), BATCH):
        batch = items[start : start + BATCH]
        vectors = embedder.generate_embeddings_batch([item["text"] for item in batch])
        payload = []
        for vector, item in zip(vectors, batch):
            row = {k: v for k, v in item.items() if k != "text"}
            row["text"] = item["text"][:512]
            payload.append({"vector": vector, **row})
        client.insert(collection_name=collection, data=payload)
        print(f"  {collection}: {min(start + BATCH, len(items))}/{len(items)}")


def main() -> int:
    embedder = get_embedder()
    if embedder is None:
        print("reindex: the embedder is unavailable — nothing was written.", file=sys.stderr)
        return 1

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cards, empty_cards = _cards(cur)
    turns, empty_turns = _turns(cur)
    cur.close()
    conn.close()

    print(f"reindex: {len(cards)} cards, {len(turns)} turns to embed "
          f"(empty text reported: {empty_cards} cards, {empty_turns} turns)")

    client = MilvusClient(uri=MILVUS_URI)
    for name in ("prompt_sessions", "conversations"):
        _reset(client, name)
        print(f"reindex: {name} reset")

    _write(client, "prompt_sessions", cards, embedder)
    _write(client, "conversations", turns, embedder)

    for name in ("prompt_sessions", "conversations"):
        print(f"reindex: {name} now holds {_count(client, name)} vectors")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
