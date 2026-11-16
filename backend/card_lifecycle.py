"""THE CARD'S LIFECYCLE — one state machine for every session card.

A card is a `prompt_sessions` row. Its lifecycle is read from the row, never invented by the
surface that draws it:

    Open                a live Tools working row, on screen now
    Closed              a completed or terminated visit, holding its permanent activity ledger
    Pending_Approval    submitted to the Supervisor Queue for approval
    Queued_For_Share    submitted to the Supervisor Queue for sharing

The two queued states are LOCKS. A card in either one is read-only to its owner until the
supervisor answers. The state is a single value; the routing mask on the row records where the
card was sent, which is a separate fact.
"""
from __future__ import annotations

import json
from enum import Enum
from typing import Any, Mapping


class CardState(str, Enum):
    OPEN = "Open"
    CLOSED = "Closed"
    PENDING_APPROVAL = "Pending_Approval"
    QUEUED_FOR_SHARE = "Queued_For_Share"


LOCKED_STATES = frozenset({CardState.PENDING_APPROVAL, CardState.QUEUED_FOR_SHARE})


def _metadata(row: Mapping[str, Any] | None) -> dict[str, Any]:
    """The row's metadata as a dict. A missing or malformed value is an empty mask, never a
    guessed lifecycle: the caller's state is decided by the keys that do exist."""
    if not isinstance(row, Mapping):
        return {}
    meta = row.get("metadata")
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except (json.JSONDecodeError, ValueError):
            return {}
    return dict(meta) if isinstance(meta, Mapping) else {}


def card_state_of(row: Mapping[str, Any] | None) -> CardState | None:
    """The lifecycle state of a session row, or None for a row that is not a session card.

    The routing stage is the truth, not a boolean left behind by an earlier queue: an approved
    card still carries the approval destination in its mask, and it is Closed, not pending.
    """
    meta = _metadata(row)
    kind = str(meta.get("session_type") or "")
    if kind == "design_tab" and str(meta.get("design_tab") or "") == "tools":
        return CardState.OPEN
    if kind != "design_session":
        return None
    if str(meta.get("share_stage") or "") == "queued":
        return CardState.QUEUED_FOR_SHARE
    if str(meta.get("review_stage") or "") == "in-review":
        return CardState.PENDING_APPROVAL
    return CardState.CLOSED


def is_card_locked(row: Mapping[str, Any] | None) -> bool:
    """True when the card has been SUBMITTED and its owner has lost mutation rights.

    PENDING IS THE DEFAULT, NOT A SUBMISSION (owner, 2026-11-16): *"we haven't built an approval
    queue. They're just supposed to be what happens by default when you ingest a Figma component
    and you don't approve it, so that they all default pending unless they're approved."* So the
    state alone cannot lock a card. Locking on the state meant every Figma card went read-only the
    moment it was saved — no re-save, no close, no re-ingest — and the refusal named a Supervisor
    Queue that does not exist yet.

    The lock belongs to a submission: the routing record that
    `POST /api/design/sessions/{id}/queue` writes when someone sends a card. A card with no such
    record is pending because nothing has approved it, and it stays editable.
    """
    state = card_state_of(row)
    if state not in LOCKED_STATES:
        return False
    routing = _metadata(row).get("routing")
    if not isinstance(routing, Mapping):
        return False
    return bool(str(routing.get("queued_at") or ""))


# THE WORD THE CARD PRINTS — ONE DEFINITION (owner, 2026-11-16).
#
# Every surface that draws a card prints the word from here: the Design room's grid, the Approve
# tab, and the main console. Two mappings is how one card came to read "active" on the main console
# while the same row read "Pending" in the room, which looked like two different lists of cards.
# A surface may choose its own colour; the word is the record's.
_STATE_WORDS: dict[CardState, str] = {
    CardState.PENDING_APPROVAL: "Pending",
    CardState.QUEUED_FOR_SHARE: "Queued for Share",
    CardState.OPEN: "Open",
    CardState.CLOSED: "Closed",
}


def card_status_word(row: Mapping[str, Any] | None) -> str:
    """The word a card's footer prints for this row.

    The lifecycle decides it. The review stage refines a closed card, because an approved card
    still carries the approval destination in its mask and is closed, not pending. A row that is
    not a session card keeps the word the record already holds.
    """
    state = card_state_of(row)
    if state is None:
        status = row.get("status") if isinstance(row, Mapping) else None
        return str(status or "Saved")
    if state is CardState.CLOSED:
        stage = str(_metadata(row).get("review_stage") or "")
        if stage == "approved":
            # ACTIVE IS THE WORD FOR AN APPROVED CARD (owner, 2026-11-16): *"the status changes to
            # active because it's officially added to the Lit catalogue and it is now a usable
            # component by the AI model when assembling the front end."* The word says what the
            # card now is — a component the model may use — not what act made it so.
            return "Active"
        if stage == "changes-requested":
            return "Changes Requested"
    return _STATE_WORDS[state]


def locked_state_message(state: CardState | None) -> str:
    """The refusal, in the state's own name. No soft synonym stands in for the state."""
    word = state.value if isinstance(state, CardState) else str(state or "unknown")
    return (
        f"This card is locked in the Supervisor Queue ({word}). It cannot be re-opened, "
        "re-ingested, edited, or closed until the supervisor approves or rejects it."
    )
