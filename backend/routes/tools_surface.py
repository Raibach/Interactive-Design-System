"""
THE TOOLS TAB'S OWN SURFACE — a file of its own, serving only the tool.

Owner, 2026-10-18, the work order verbatim: *"once you have established tools is in the right
place and it's loading the right files and it is saved from any other changes. Then you go get
the console code..."* — and before that: *"You cannot repurpose pieces. You're going to have to
build new ones. You're going to have to build new TS files. You're gonna have to load the same
components from the catalogue in different TS files."*

So this module is NEW. It does not borrow the design room's surface, it does not take a branch
inside `routes/ai.py`, and it does not touch either Figma component. It serves exactly one thing:
the component tree for the tool's own room — `figma-ingest-form` over `figma-layers-view` — and
the element rows those two components read, from the same table the room already records.

WHY A SEPARATE ENDPOINT, NOT ANOTHER INTENT: an intent inside `assemble-surface` is how the
design surface came to hold the tool and the chat in one tree. Its own endpoint means the tool's
surface cannot grow a chat by accident, and the design surface cannot quietly regain the tool.

WHAT IT DOES NOT DO: no model call, no assembly by an LLM, no writes. It answers with the two
components and the rows. If the database cannot be read, it says so and returns nothing — the
tool draws its own empty state, and the failure is said rather than dressed as an empty catalogue.
"""
from __future__ import annotations

import json
import os
from typing import Any

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Header, HTTPException

router = APIRouter()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")


def _design_element_rows(user_id: str) -> list[dict[str, Any]]:
    """The element rows `figma-layers-view` draws — one row per `design_master` of this user.

    The SAME row shape the design surface hands the same component today (`key`, `name`,
    `description`, `catalogs`, `removed`, `figma`, `last_ingest`, `id`, `title`, `status`), read
    here directly so the tool's room does not depend on the chat's surface to exist.
    """
    rows: list[dict[str, Any]] = []
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id::text AS id, title, description, is_archived, metadata
                  FROM prompt_sessions
                 WHERE user_id = %s AND metadata->>'session_type' = 'design_master'
                 ORDER BY metadata->>'element_key'
                """,
                (user_id,),
            )
            for row in cur.fetchall():
                meta = row.get("metadata") or {}
                if isinstance(meta, str):
                    meta = json.loads(meta) if meta.strip() else {}
                last_ingest = meta.get("last_ingest") or {}
                rows.append({
                    "key": meta.get("element_key"),
                    "name": row.get("title") or "",
                    "description": row.get("description") or "",
                    "catalogs": meta.get("catalogs") or "",
                    "removed": bool(row.get("is_archived")),
                    "figma": meta.get("figma") or {},
                    "last_ingest": last_ingest,
                    "id": meta.get("element_key"),
                    "title": row.get("title") or "",
                    "status": (
                        "Removed" if row.get("is_archived")
                        else (last_ingest.get("verdict") or ("Ingested" if last_ingest else "Not ingested"))
                    ),
                })
    return rows


@router.post("/api/tools/surface")
def tools_surface(x_user_id: str | None = Header(None, alias="X-User-ID")) -> dict[str, Any]:
    """The tool's room: the ingest form over the layers tree, and the rows they read."""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-ID is required: the rows are the user's own.")
    try:
        elements = _design_element_rows(x_user_id)
    except Exception as e:  # noqa: BLE001 — a failed read is said with its reason
        raise HTTPException(
            status_code=503,
            detail=f"TOOLS SURFACE FAILURE: the element rows could not be read — {type(e).__name__}: {e}",
        ) from e

    # THREE COLUMNS — THE FIGMA PROGRAM'S OWN SHAPE (owner, 2026-10-18: *"It uses three columns.
    # It is not a console. It has a very particular way of behaving."*):
    #   left   the ingest form over the layers tree, inside the tool's own panel
    #   middle the preview — the column a Submit opens
    #   right  the tool room's own conversation
    components = [
        {
            "id": "tools-root",
            "component": "workspace-layout",
            # THE THIRD COLUMN IS DECLARED, NOT REFERENCED — the program's own rule: a Submit
            # opens it. `tools-middle` exists in the list (inert until referenced) and the HOST
            # adds `children.middle = "tools-middle"` when a preview lands, exactly as the
            # approved design surface does with its own middle column.
            "children": {"left": "tools-left", "right": "tools-chat"},
        },
        {
            "id": "tools-left",
            "component": "tools-left-panel",
            "children": {"left": ["tools-form", "tools-layers"]},
        },
        {"id": "tools-form", "component": "figma-ingest-form"},
        {
            "id": "tools-layers",
            "component": "figma-layers-view",
            "items": {"path": "/session/elements"},
        },
        {
            "id": "tools-middle",
            "component": "component-preview",
            "preview": {"path": "/session/preview"},
            "busy": {"path": "/session/ingest/busy"},
            "message": {"path": "/session/ingest/message"},
        },
        {
            "id": "tools-chat",
            "component": "grace-tools-chat",
            "sessionId": {"path": "/session/id"},
        },
    ]
    # THE HOST WRITES THE LIVE VALUES: `id` is the tool room's session key, `preview` is what a
    # Submit's answer becomes, `ingest` is the form's busy/message pair. They exist here so the
    # bindings resolve, and they hold nothing until the host writes them — a path that is absent
    # would be a surface whose parts cannot be filled.
    data_model = {
        "session": {
            "id": "",
            "elements": elements,
            "preview": None,
            "ingest": {"busy": False, "message": ""},
        }
    }
    return {"components": components, "dataModel": data_model}
