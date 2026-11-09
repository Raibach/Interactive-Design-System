"""THE DESIGN SECTION'S SEARCH INDEX — MILVUS, DERIVED FROM THE DESIGN DATABASE.

The Design database is the record. Milvus is the index the Chat room searches: one entry per
conversation, per saved session or card, per design system, and per activity, with the user,
the section, the package, the room, the kind, and the record id carried beside the vector.
A hit is never the answer by itself; the record id is read back from the Design database.

The ordinary lists do not use this index. They are exact reads by room in Postgres. This
index is for the Chat room's search across all four rooms, and for nothing else.

Run from `backend/`:

    python3 -m design_db.index                 # report what would be indexed
    python3 -m design_db.index --apply         # build the collection
    python3 -m design_db.index --apply --rebuild  # drop and rebuild it

The embedding model is the app's own local model (BAAI/bge-small-en, 384 dimensions). It
spends no model tokens.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

COLLECTION = "design_items"
EMBEDDING_DIMENSION = 384
OUTPUT_FIELDS = [
    "kind", "ref_id", "title", "text", "user_id", "section",
    "package_id", "tab", "updated_at",
]


def _client():
    from milvus_client import get_milvus_client

    client = get_milvus_client()
    if client is None or client.client is None:
        raise RuntimeError("the vector store is not connected")
    return client


def _embedder():
    from memory_embedder import get_embedder

    embedder = get_embedder()
    if embedder is None:
        raise RuntimeError("the embedding model did not load — the Design search is off")
    return embedder


def ensure_collection(client, rebuild: bool = False) -> None:
    existing = client.client.list_collections()
    if rebuild and COLLECTION in existing:
        client.client.drop_collection(COLLECTION)
        existing = client.client.list_collections()
    if COLLECTION not in existing:
        client.create_collection(COLLECTION)
        print(f"[design_index] created collection: {COLLECTION}")


def text_of(payload: dict, title: str) -> str:
    """The words a person would search for — the title, then what the record says."""
    if not isinstance(payload, dict):
        return title
    description = str(payload.get("description") or "").strip()
    metadata = payload.get("metadata")
    if isinstance(metadata, dict):
        name = str(metadata.get("name") or metadata.get("element_key") or "").strip()
        if name and name not in title:
            description = f"{name}. {description}".strip()
    body = description or json.dumps(payload, default=str)
    body = " ".join(str(body).split())
    return f"{title}. {body}"[:6000]


def iter_items(design_cur, user_id: str):
    """Every item the Design section owns, in the order the rooms draw them."""
    design_cur.execute(
        """
        SELECT c.id::text AS ref_id, c.title, c.updated_at, t.key AS tab,
               p.id::text AS package_id,
               left(coalesce(string_agg(
                   m.role || ': ' || m.content, E'\n' ORDER BY m.created_at
               ), ''), 6000) AS messages
          FROM design_conversations c
          JOIN design_tabs t ON t.id = c.tab_id
          JOIN design_packages p ON p.id = t.package_id
          LEFT JOIN design_messages m ON m.conversation_id = c.id
         WHERE c.user_id = %s
         GROUP BY c.id, c.title, c.updated_at, t.key, p.id
         ORDER BY c.updated_at DESC
        """,
        (user_id,),
    )
    for row in design_cur.fetchall():
        row = dict(row)
        title = row["title"] or "(untitled)"
        text = f"{title}. {row['messages'] or ''}"[:6000]
        yield {
            "kind": "conversation",
            "ref_id": row["ref_id"],
            "title": title,
            "text": text,
            "tab": row["tab"],
            "package_id": row["package_id"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else "",
        }

    design_cur.execute(
        """
        SELECT r.id::text AS ref_id, r.title, r.kind, r.updated_at, r.payload,
               t.key AS tab, p.id::text AS package_id
          FROM design_records r
          JOIN design_tabs t ON t.id = r.tab_id
          JOIN design_packages p ON p.id = t.package_id
         WHERE r.user_id = %s
         ORDER BY r.updated_at DESC
        """,
        (user_id,),
    )
    for row in design_cur.fetchall():
        row = dict(row)
        title = row["title"] or "(untitled)"
        yield {
            "kind": row["kind"],
            "ref_id": row["ref_id"],
            "title": title,
            "text": text_of(row.get("payload") or {}, title),
            "tab": row["tab"],
            "package_id": row["package_id"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else "",
        }

    design_cur.execute(
        """
        SELECT r.id::text AS ref_id, r.title, r.kind, r.updated_at, r.payload,
               p.id::text AS package_id
          FROM design_package_records r
          JOIN design_packages p ON p.id = r.package_id
         WHERE r.user_id = %s
         ORDER BY r.updated_at DESC
        """,
        (user_id,),
    )
    for row in design_cur.fetchall():
        row = dict(row)
        title = row["title"] or "(untitled)"
        yield {
            "kind": "system",
            "ref_id": row["ref_id"],
            "title": title,
            "text": text_of(row.get("payload") or {}, title),
            "tab": "package",
            "package_id": row["package_id"],
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else "",
        }

    design_cur.execute(
        """
        SELECT e.id::text AS ref_id, e.kind, e.detail, e.at,
               t.key AS tab, p.id::text AS package_id
          FROM design_events e
          JOIN design_tabs t ON t.id = e.tab_id
          JOIN design_packages p ON p.id = t.package_id
         WHERE e.user_id = %s
         ORDER BY e.at DESC
        """,
        (user_id,),
    )
    for row in design_cur.fetchall():
        row = dict(row)
        detail = row.get("detail") or {}
        title = f"{row['kind']} in {row['tab']}"
        body = json.dumps(detail, default=str) if isinstance(detail, dict) else str(detail)
        yield {
            "kind": "activity",
            "ref_id": str(row["ref_id"]),
            "title": title,
            "text": f"{title}. {' '.join(body.split())}"[:6000],
            "tab": row["tab"],
            "package_id": row["package_id"],
            "updated_at": row["at"].isoformat() if row["at"] else "",
        }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Build the Design section's search index.")
    parser.add_argument("--user-id", default=os.getenv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001"))
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--batch", type=int, default=16)
    args = parser.parse_args(argv)

    with psycopg2.connect(os.environ["DESIGN_DATABASE_URL"]) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as design:
            design.execute("SELECT id::text AS id, display_name FROM design_users WHERE id = %s", (args.user_id,))
            user = design.fetchone()
            if not user:
                print(f"user {args.user_id} is not in the Design database", file=sys.stderr)
                return 1

            items = list(iter_items(design, args.user_id))
            print(f"user: {user['display_name']} ({user['id']})")
            by_kind: dict[str, int] = {}
            for item in items:
                by_kind[item["kind"]] = by_kind.get(item["kind"], 0) + 1
            print(f"items: {len(items)}  " + "  ".join(f"{k}={v}" for k, v in sorted(by_kind.items())))
            if not args.apply:
                print("read only. run with --apply to build the index.")
                return 0

    client = _client()
    ensure_collection(client, rebuild=args.rebuild)
    embedder = _embedder()

    payload = []
    for item in items:
        vector = embedder.generate_embedding(item["text"])
        if not vector:
            print(f"[design_index] no embedding for {item['kind']}:{item['ref_id']} — left unindexed", file=sys.stderr)
            continue
        payload.append({
            "vector": vector,
            "kind": item["kind"],
            "ref_id": item["ref_id"],
            "title": item["title"],
            "text": item["text"],
            "user_id": args.user_id,
            "section": "design",
            "package_id": item["package_id"],
            "tab": item["tab"],
            "updated_at": item["updated_at"],
        })

    for start in range(0, len(payload), args.batch):
        client.client.insert(COLLECTION, payload[start:start + args.batch])
    print(f"[design_index] indexed {len(payload)} items into {COLLECTION}")

    count = client.client.query(collection_name=COLLECTION, filter=f'user_id == "{args.user_id}"',
                                output_fields=["count(*)"])
    total = int(count[0].get("count(*)", 0)) if count else 0
    print(f"[design_index] {COLLECTION} holds {total} items for this user")
    return 0


def search(query: str, user_id: str, package_id: str = "", tab: str = "", kind: str = "", k: int = 8):
    """The Chat room's search: the person's own items, inside one Design package."""
    client = _client()
    if COLLECTION not in client.client.list_collections():
        raise RuntimeError(
            f"the Design search index is not built: collection {COLLECTION} is absent",
        )
    embedder = _embedder()
    vector = embedder.generate_embedding(query)
    if not vector:
        raise RuntimeError("the embedding model returned no vector for the Design search query")
    filters = [f'user_id == "{user_id}"']
    if package_id:
        filters.append(f'package_id == "{package_id}"')
    if tab:
        filters.append(f'tab == "{tab}"')
    if kind:
        filters.append(f'kind == "{kind}"')
    # NO CATCH. A dead index, a detached collection or a failed search raises to the caller;
    # an empty list is a result, not a failure.
    hits = client.client.search(
        collection_name=COLLECTION,
        data=[vector],
        filter=" and ".join(filters),
        limit=k,
        output_fields=OUTPUT_FIELDS,
    )
    out = []
    for hit in (hits[0] if hits else []):
        entity = hit.get("entity", {}) if isinstance(hit, dict) else {}
        out.append({**entity, "score": hit.get("distance") if isinstance(hit, dict) else None})
    return out


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
