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
    """True when the card is in a queue and its owner has lost mutation rights."""
    return card_state_of(row) in LOCKED_STATES


def locked_state_message(state: CardState | None) -> str:
    """The refusal, in the state's own name. No soft synonym stands in for the state."""
    word = state.value if isinstance(state, CardState) else str(state or "unknown")
    return (
        f"This card is locked in the Supervisor Queue ({word}). It cannot be re-opened, "
        "re-ingested, edited, or closed until the supervisor approves or rejects it."
    )
