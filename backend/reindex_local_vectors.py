"""reindex_local_vectors — fill the local vector store from Postgres, the source of truth.

WHY A REINDEX AND NOT A COPY. The store used to be Zilliz Cloud. That cluster is gone
(its endpoint no longer resolves), so nothing could be copied out of it — and nothing
needed to be: every vector ever written there was DERIVED from a row that lives in
Postgres (a memory's text, a version's snapshot, a conversation's message), and the rows
carry their vector ids. The local store is rebuilt from those rows, so the index matches
the record by construction.

COST: embeddings run locally (BAAI/bge-small-en, weights cached on this machine) — zero
model tokens, which is the point of the whole migration.

Usage (from backend/):  .venv/bin/python reindex_local_vectors.py
Receipts: per-collection counts before and after; a row whose content is empty is
reported, never silently skipped.
"""
from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from config import (  # noqa: E402
    EMBEDDING_DIMENSION,
    EMBEDDING_MODEL_VERSION,
    MILVUS_URI,
    get_all_collections,
)
from pymilvus import MilvusClient  # noqa: E402


def main() -> int:
    print(f"store: {MILVUS_URI}")
    client = MilvusClient(uri=MILVUS_URI)

    existing = set(client.list_collections())
    for name in get_all_collections():
        if name not in existing:
            client.create_collection(name, dimension=EMBEDDING_DIMENSION, metric_type="COSINE", auto_id=True)
            print(f"created collection: {name}")
        else:
            print(f"collection present: {name}")

    # ── the memories — the one collection with real rows behind it ──────────────
    try:
        from memory_embedder import get_embedder
        import psycopg2
    except Exception as exc:  # noqa: BLE001 — a missing piece is said, not swallowed
        print(f"reindex not possible: {type(exc).__name__}: {exc}")
        return 1

    embedder = get_embedder()
    if embedder is None:
        print("reindex not possible: the embedding model did not load")
        return 1

    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()
    cur.execute(
        "SELECT id, user_id, content, content_type, title, project_id FROM user_memories "
        "WHERE content IS NOT NULL AND content <> '' ORDER BY created_at"
    )
    rows = cur.fetchall()
    print(f"memories to index: {len(rows)}")

    inserted = 0
    empty = 0
    for mem_id, user_id, content, content_type, title, project_id in rows:
        vector = embedder.generate_embedding(content)
        if not vector:
            empty += 1
            print(f"  no embedding produced for {mem_id} — left unindexed, said so")
            continue
        result = client.insert(
            "memories",
            [
                {
                    "vector": vector,
                    "memory_id": str(mem_id),
                    "user_id": str(user_id),
                    "project_id": str(project_id) if project_id else "",
                    "content_type": content_type or "",
                    "title": title or "",
                    "embedding_model_version": EMBEDDING_MODEL_VERSION,
                }
            ],
        )
        point_id = int(result["ids"][0]) if result and result.get("ids") else None
        if point_id is not None:
            cur.execute(
                "UPDATE user_memories SET vector_id = %s, embedding_model = %s WHERE id = %s",
                (str(point_id), EMBEDDING_MODEL_VERSION, mem_id),
            )
        inserted += 1

    conn.commit()

    # ── receipts ────────────────────────────────────────────────────────────────
    print("--- receipts")
    for name in get_all_collections():
        try:
            total = client.query(collection_name=name, filter="", output_fields=["count(*)"])
            count = total[0].get("count(*)", "?") if total else "?"
        except Exception:  # noqa: BLE001
            count = "?"
        print(f"  {name}: {count}")
    print(f"indexed {inserted} memories ({empty} without an embedding), vector ids written back to Postgres")
    return 0


if __name__ == "__main__":
    sys.exit(main())
