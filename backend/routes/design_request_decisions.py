"""The human decision on a queued design request: one state change and its ledger."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import services as state
from routes.design_reviews import _QUEUE_COLUMNS, _require_user, _row_to_request

router = APIRouter()


class RequestDecision(BaseModel):
    decision: str
    note: str | None = None


@router.post("/api/design/requests/{request_id}/decide")
def decide_request(
    request_id: int,
    body: RequestDecision,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """One decision, recorded once. A decided request cannot be decided again."""
    uid = _require_user(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        raise HTTPException(status_code=503, detail="Database not available.")
    decision = str(body.decision or "").strip().lower()
    if decision not in ("approve", "refuse"):
        raise HTTPException(status_code=422, detail="decision must be 'approve' or 'refuse'.")
    final = "approved" if decision == "approve" else "refused"
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute("SET app.current_user_id = %s", (uid,))
        cur.execute(
            f"""UPDATE design_requests
                   SET decision = %s, decided_by = %s, decided_at = NOW(), note = %s
                 WHERE id = %s AND decision = 'pending'
                 RETURNING {_QUEUE_COLUMNS}""",
            (final, uid, str(body.note or ""), request_id),
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(
            status_code=409,
            detail="That request is not waiting for a decision — it is unknown, or already decided.",
        )
    return _row_to_request(row)
