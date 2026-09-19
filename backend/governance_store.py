"""governance_store — the governance rows in Postgres, their relational home.

WHY POSTGRES FIRST, VECTORS SECOND. The owner, 2026-09-19: "reevaluate and see if you can
optimize using the database." The register, the corrections, the findings and the filed
inspection reports are ROWS: they are counted, filtered, listed exactly, and joined — a
finding that concerns a package carries its package id, so the global view can link to the
package it is about. A SQL query costs no tokens and no model compute; the vector store is
only ever the DERIVED semantic index of these rows (governance_vector rebuilds from here).
Anything exact is answered here. The models never see a file dump.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor


def _conn():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def item_id(kind: str, row: Dict[str, Any]) -> str:
    """One stable id per row, so a re-seed updates instead of piling up.

    The register carries its own ids; the corrections are keyed by the finding they closed;
    a field report by the moment it was filed; and a finding by CATALOG + id — the same check
    fires in prompt-composer and ecommerce under the same id, and keying them together
    silently merged 64 rows into 35 (measured 2026-09-19).
    """
    if kind == "correction":
        return f"correction:{row.get('finding', '?')}"
    if kind == "inspection":
        return f"inspection:{row.get('at') or row.get('id') or '?'}"
    if kind == "finding":
        return f"finding:{row.get('catalog', '?')}:{row.get('id', '?')}"
    return str(row.get("id") or "?")


def clear_kinds(kinds: List[str]) -> int:
    """Drop the rows of the kinds a reseed is about to rewrite.

    The table MIRRORS the register/corrections files and the audit reports; a seed replaces
    what it re-derives (the same rule the vector store's reset follows). Without this, ids
    from an earlier scheme linger beside their replacements — measured 2026-09-19: 64
    findings written, 99 rows present.
    """
    if not kinds:
        return 0
    with _conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM governance_items WHERE kind = ANY(%s)", (kinds,))
        deleted = cur.rowcount
        conn.commit()
        return deleted


def upsert_items(kind: str, rows: List[Dict[str, Any]]) -> int:
    """Insert or update a batch of governance rows. Returns how many were written."""
    if not rows:
        return 0
    written = 0
    with _conn() as conn:
        cur = conn.cursor()
        for row in rows:
            cur.execute(
                """
                INSERT INTO governance_items
                    (id, kind, status, owner, check_name, level, component, node_id,
                     file_path, catalog, at, package_id, text, metadata, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, now())
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    owner = EXCLUDED.owner,
                    check_name = EXCLUDED.check_name,
                    level = EXCLUDED.level,
                    component = EXCLUDED.component,
                    node_id = EXCLUDED.node_id,
                    file_path = EXCLUDED.file_path,
                    catalog = EXCLUDED.catalog,
                    at = EXCLUDED.at,
                    package_id = EXCLUDED.package_id,
                    text = EXCLUDED.text,
                    metadata = EXCLUDED.metadata,
                    updated_at = now()
                """,
                (
                    item_id(kind, row),
                    kind,
                    row.get("status") or None,
                    row.get("owner") or None,
                    row.get("check") or None,
                    row.get("level") or None,
                    row.get("component") or None,
                    row.get("nodeId") or None,
                    row.get("file") or None,
                    row.get("catalog") or None,
                    row.get("at") or None,
                    row.get("package_id") or None,
                    (row.get("text") or row.get("what") or ""),
                    "{}",
                ),
            )
            written += 1
        conn.commit()
    return written


def query(
    kind: Optional[str] = None,
    check: Optional[str] = None,
    open_only: bool = False,
    package_id: Optional[str] = None,
    limit: int = 200,
) -> List[Dict[str, Any]]:
    """Exact reads — the questions a table answers better than a similarity search."""
    where, params = [], []
    if kind:
        where.append("kind = %s")
        params.append(kind)
    if check:
        where.append("check_name = %s")
        params.append(check)
    if open_only:
        where.append("status = 'open'")
    if package_id:
        where.append("package_id = %s")
        params.append(package_id)
    sql = "SELECT * FROM governance_items"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY updated_at DESC LIMIT %s"
    params.append(limit)
    with _conn() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]


def count(kind: Optional[str] = None, open_only: bool = False) -> int:
    where, params = [], []
    if kind:
        where.append("kind = %s")
        params.append(kind)
    if open_only:
        where.append("status = 'open'")
    sql = "SELECT count(*) AS n FROM governance_items"
    if where:
        sql += " WHERE " + " AND ".join(where)
    with _conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, params)
        return int(cur.fetchone()["n"])


def link_package(item_pk: str, package_id: Optional[str]) -> None:
    """Attach a governance row to the package it is about — the link the global view uses
    (owner, 2026-09-19: "the governance issue needs a link to the problematic prompt
    package"), so Approvals can open the package instead of describing it)."""
    with _conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE governance_items SET package_id = %s, updated_at = now() WHERE id = %s",
            (package_id, item_pk),
        )
        conn.commit()
