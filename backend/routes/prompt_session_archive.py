"""The HTTP door to a card's archive: archived by default, permanently removed only when the caller asks."""
from fastapi import APIRouter, Header, HTTPException, Query

import services as state
from deps import get_user_id_from_header

router = APIRouter()


@router.delete("/api/prompt-sessions/{session_id}")
async def delete_prompt_session(
    session_id: str,
    permanent: bool = Query(False),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Delete a prompt session: archived by default; a permanent removal only when asked."""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        # ⭐ THE OTHER DIRECTION OF "DELETE MEANS REMOVE IT" (owner, 2026-10-04: *"I deleted
        # product team cards from the console … they came back"*). A builder-backed card and
        # its project are ONE thing wearing two doors: deleting the card must delete the
        # PROJECT, or the console's sync (routes/builder_bridge.py) finds the orphaned
        # project and faithfully puts the card back — which is exactly what it did, twice.
        # THE ENGINE GOES FIRST: a project that cannot be removed keeps its card and the
        # refusal says why — a deleted card on a living project is a lie the next sync exposes.
        bridged_project_id = None
        try:
            session = state.prompt_sessions_api.get_session(session_id, uid)
            bridged_project_id = ((session or {}).get("metadata") or {}).get("builder_project_id")
        except Exception as read_error:  # noqa: BLE001 — an unreadable row deletes as it always did
            print(f"[builder] could not read session {session_id} before delete: {read_error}")
        if bridged_project_id:
            from routes import builder_bridge

            removal = builder_bridge.delete_builder_project(str(bridged_project_id))
            if not removal.get("ok"):
                raise HTTPException(
                    status_code=502,
                    detail=(
                        f"The builder's project '{bridged_project_id}' could not be removed, so the "
                        f"card was kept: {removal.get('error')}"
                    ),
                )
        success = state.prompt_sessions_api.delete_session(
            session_id=session_id, user_id=uid, permanent=permanent
        )
        if not success:
            raise HTTPException(status_code=404, detail="Prompt session not found")
        return {"success": True}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error deleting prompt session: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Delete prompt session error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting prompt session: {e!s}"
        )
