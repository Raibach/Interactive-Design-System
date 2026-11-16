"""The design save's metadata: the kept card, the stored preview, and whether the card enters review."""
from __future__ import annotations

from datetime import datetime
from typing import Any


def apply_design_save_metadata(
    save_metadata: dict[str, Any],
    request: Any,
    uid: str,
    previous_metadata: dict[str, Any] | None = None,
) -> None:
    """Write the design-session fields a save keeps. The caller decides it is a design save."""
    save_metadata["session_type"] = "design_session"
    save_metadata["kept_at"] = datetime.now().isoformat()
    save_metadata["kept_by"] = uid
    # THE RUN IS PART OF THE SESSION. The preview carries the compiled drawing, the facts,
    # the values, the steps and the measured tree; storing it is what lets the card open
    # on the work instead of an empty third column. A caller that does not send the field
    # keeps the preview already stored; a caller that sends null (the person discarded the
    # drawing) clears it, because then the session really has no drawing.
    _sent_fields = getattr(request, "model_fields_set", None)
    if _sent_fields is None:
        _sent_fields = getattr(request, "__fields_set__", set())
    if "preview" in _sent_fields:
        save_metadata["preview"] = (
            request.preview
            if isinstance(request.preview, dict) and request.preview
            else None
        )
    # ── THE APPROVAL GATE (owner, 2026-11-16) ────────────────────────────────────────────────
    #
    # *"those cards should be in a preapproval state"*, and *"every Figma card that is created
    # that has not been approved would end up in that tab"*. A card made by the Tools tab (the
    # Figma tool — `metadata.design_tab = 'tools'`) is therefore PENDING when it is saved: the
    # state is `review_stage = 'in-review'`, the one `card_lifecycle` reads as Pending_Approval,
    # and the one `POST /api/design/sessions/{id}/queue` writes.
    #
    # THE ONE EXCEPTION IS AN APPROVED CARD. Approving a card records `review_stage='approved'`;
    # a later save of that same card must not send it back to the gate, because it has already
    # been approved and entered the catalogue. This is the record that stood here until
    # 2026-11-08, when the queue was paused at the owner's word: *"we don't need to focus on
    # these approval cues at the moment."* The queue was never removed, and it is not new.
    #
    # A save from another room carries neither `design_tab` nor this card's kind of work, so
    # nothing here reaches it.
    meta = previous_metadata if isinstance(previous_metadata, dict) else {}
    is_figma_card = str(meta.get("design_tab") or "") == "tools"
    already_approved = str(meta.get("review_stage") or "") == "approved"
    if is_figma_card and not already_approved:
        save_metadata["review_stage"] = "in-review"
