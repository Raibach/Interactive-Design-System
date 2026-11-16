"""THE PENDING CARD'S APPROVAL DOOR — the person approves, the application writes.

THE ACTION IS THE MODEL'S, THE WRITE IS THE APPLICATION'S. The chat offers the approval as an
action; the person presses it; this door performs the write from the CARD'S OWN RECORD and answers
with the FACTS. It does not write a sentence: the conversation's model does that, from these facts.

NO SECOND CONFIRMATION LIVES HERE. The layer name is the identity (owner, 2026-11-16), so an
approval whose layer name is already in the Lit catalogue replaces that element and an approval
whose layer name is not there adds it. A `confirmOverwrite` flag would be a second gate on one act,
and the act the person pressed is the approval.

A REFUSAL IS A VALUE WITH WORDS. Every failure answers with the layer, the code and what is
missing, so the conversation can say what happened instead of the column closing in silence.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import services as state
from card_approval import CardApprovalRefused, approve_card
from deps import get_user_id_from_header

router = APIRouter()


class CardApprovalRequest(BaseModel):
    """The note the person wrote with the approval, when there is one.

    The approval itself needs no payload: the card's record holds the drawing and the layer name.
    The note is carried so the conversation can say what the person said, not to gate the write.
    """

    note: str | None = None


# Where a refusal stands, by what it means rather than by one status for all of them.
_NOT_FOUND = {"CARD_NOT_FOUND"}
_UNPROCESSABLE = {"CARD_HAS_NO_DRAWING", "CARD_NAMES_NO_LAYER", "LAYER_NAME_UNUSABLE"}
_HALF_STATE = {
    "CARD_STAGE_NOT_WRITTEN",
    "CATALOGUE_UNVERIFIED",
    "CATALOGUE_MISMATCH",
    "CATALOGUE_NOT_WRITTEN",
}


def approval_status(code: str) -> int:
    if code in _NOT_FOUND:
        return 404
    if code in _UNPROCESSABLE:
        return 422
    if code in _HALF_STATE:
        return 502
    return 409


@router.post("/api/design/cards/{session_id}/approve")
def approve_design_card(
    session_id: str,
    body: CardApprovalRequest | None = None,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict[str, Any]:
    """Approve the card by its own record. The answer is the facts of the write."""

    uid = get_user_id_from_header(x_user_id)
    api = state.prompt_sessions_api
    if not api:
        raise HTTPException(status_code=503, detail="Database not available.")
    try:
        facts = approve_card(api, session_id, uid)
    except CardApprovalRefused as refusal:
        detail = refusal.as_detail()
        if body is not None and str(body.note or "").strip():
            detail["note"] = str(body.note or "").strip()
        raise HTTPException(status_code=approval_status(refusal.code), detail=detail)
    if body is not None and str(body.note or "").strip():
        facts["note"] = str(body.note or "").strip()
    return facts
