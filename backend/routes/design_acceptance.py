"""The acceptance record for an ingest: one durable event naming the layer and the person."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import services as state
from deps import get_user_id_from_header

router = APIRouter()


class AcceptanceRequest(BaseModel):
    """The session the acceptance belongs to, and the layer name of the design accepted."""

    sessionId: str
    layer: str


def _row(row: Any, names: tuple[str, ...]) -> dict[str, Any]:
    return row if isinstance(row, dict) else dict(zip(names, row))


@router.post("/api/design/acceptance")
def record_acceptance(
    body: AcceptanceRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict[str, Any]:
    """Record one acceptance. Idempotent by session, layer name, and event."""
    uid = get_user_id_from_header(x_user_id)
    session_id = str(body.sessionId or "").strip()
    layer = str(body.layer or "").strip()
    if not session_id:
        raise HTTPException(
            status_code=422,
            detail="An acceptance needs the session it belongs to.",
        )
    if not layer:
        raise HTTPException(
            status_code=422,
            detail="An acceptance needs the layer name of the design that was accepted.",
        )
    api = state.prompt_sessions_api
    if not api:
        raise HTTPException(status_code=503, detail="Database not available.")
    if not api.get_session(session_id, uid):
        raise HTTPException(
            status_code=404,
            detail="No design session exists for this person.",
        )

    detail = json.dumps({"layer": layer, "by": uid})
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET app.current_user_id = %s", (uid,))
        cur.execute(
            """
            INSERT INTO design_surface_events (session_id, surface, event, detail, at)
            SELECT %s, 'ingest', 'accepted', %s::jsonb, NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM design_surface_events
                WHERE session_id = %s AND surface = 'ingest' AND event = 'accepted'
                  AND detail->>'layer' = %s
            )
            RETURNING id, at
            """,
            (session_id, detail, session_id, layer),
        )
        created = cur.fetchone()
        row = created
        if not row:
            cur.execute(
                """
                SELECT id, at FROM design_surface_events
                WHERE session_id = %s AND surface = 'ingest' AND event = 'accepted'
                  AND detail->>'layer' = %s
                ORDER BY at DESC LIMIT 1
                """,
                (session_id, layer),
            )
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(
            status_code=409,
            detail="The acceptance could not be recorded or read back.",
        )
    accepted = _row(row, ("id", "at"))
    return {
        "session_id": session_id,
        "layer": layer,
        "event": "accepted",
        "at": str(accepted.get("at") or ""),
        "created": bool(created),
    }
