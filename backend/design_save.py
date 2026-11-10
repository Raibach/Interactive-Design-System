"""The design save's metadata: the kept card, the stored preview, and whether the card enters review."""
from __future__ import annotations

from datetime import datetime
from typing import Any


def apply_design_save_metadata(
    save_metadata: dict[str, Any],
    request: Any,
    uid: str,
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
    # THE RECORD IS `frontend/src/rooms/design/CHANGELOG.md`, 2026-11-08 (approval queue
    # paused; owner: *"we don't need to focus on these approval cues at the moment"*).
    # A save keeps the card Closed and editable; it no longer sends every saved card into
    # review. The queue is still built: `POST /api/design/sessions/{id}/queue` is the
    # explicit act that sends a card to the supervisor when the approval work resumes.
