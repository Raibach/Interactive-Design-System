"""Auto-extracted route module from main.py — zero behavior change."""
import json
import traceback
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

import services as state
from deps import (
    get_user_id_from_header,
)
from grace_gui import (
    query_llm,
)

router = APIRouter()

# ============================================
# PROMPT SESSIONS ENDPOINTS
# ============================================


class CreatePromptSessionRequest(BaseModel):
    title: str = "Untitled Prompt Session"
    description: str | None = None
    # A PACKAGE'S ROOM (PRODUCT-ROOM.md §2): a package born in the Product room is
    # sent room_domain 'product'; the Composer's path sends 'composer'. ABSENT IS A
    # REAL ANSWER — every legacy package has no room and keeps belonging where it
    # always has. The writer ships with the reader.
    room_domain: str | None = None


class UpdatePromptSessionRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    left_column_content: str | None = None
    compiled_output: str | None = None
    conversation_id: str | None = None
    is_active: bool | None = None
    is_archived: bool | None = None
    metadata: dict[str, Any] | None = None
    category: str | None = None
    # Console card fields (agent-card-element, Figma 40000717:17091)
    status: str | None = None
    likes: int | None = None
    model_name: str | None = None
    team_name: str | None = None
    avatar_url: str | None = None


class SavePromptVersionRequest(BaseModel):
    left_column_content: str
    compiled_output: str | None = None
    change_description: str | None = None
    change_type: str = "manual"


class CreateSuggestionRequest(BaseModel):
    suggestion_type: str
    content: str
    context: str | None = None
    generated_by_model: str | None = None
    confidence_score: float = 1.0
    relevance_score: float = 1.0
    metadata: dict[str, Any] | None = None


class AddContextEntryRequest(BaseModel):
    context_type: str
    content: str
    source: str | None = None
    relevance_score: float = 1.0
    metadata: dict[str, Any] | None = None

@router.get("/api/prompts")
async def get_prompts(
    include_archived: bool = Query(False),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get all prompt sessions formatted as prompts list (for ConsolePage)"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        sessions = state.prompt_sessions_api.get_sessions(
            user_id=uid, include_archived=include_archived, limit=limit, offset=offset
        )
        # Transform to format ConsolePage expects: { prompts: [...] }
        # Every <agent-card-element> field is sourced from PostgreSQL:
        # category + category_color, description, author, version, status,
        # likes, model_name, team_name, avatar_url.
        prompts = []
        for s in sessions:
            author_email = s.get("author_email") or ""
            username = (s.get("metadata") or {}).get("username") or (
                author_email.split("@")[0] if author_email else ""
            )
            prompts.append(
                {
                    "id": s.get("id"),
                    "title": s.get("title", "Untitled Agent"),
                    "category": s.get("category", ""),
                    "category_color": s.get("category_color"),
                    "category_title_color": s.get("category_title_color"),
                    "category_text_color": s.get("category_text_color"),
                    "description": s.get("description", ""),
                    "status": s.get("status") or "Active",
                    "likes": s.get("likes") or 0,
                    "model_name": s.get("model_name") or "",
                    "team_name": s.get("team_name") or "",
                    "avatar_url": s.get("avatar_url") or "",
                    "username": username,
                    "author": (s.get("metadata") or {}).get("author")
                        or s.get("author_name")
                        or "You",
                    "current_version": s.get("current_version", 1),
                    "last_accessed_at": s.get("last_accessed_at"),
                    "metadata": {
                        "author": (s.get("metadata") or {}).get("author", "You"),
                        "score": (s.get("metadata") or {}).get("score"),
                    },
                    "message_count": s.get("version_count", 1),
                    "is_archived": s.get("is_archived", False),
                    "updated_at": s.get("updated_at"),
                    "created_at": s.get("created_at"),
                }
            )
        return {"prompts": prompts, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error getting prompts: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Get prompts error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error getting prompts: {e!s}"
        )


@router.get("/api/categories")
async def get_categories():
    """Category registry — name → card color. Drives agent-card-element tint."""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )
    try:
        categories = state.prompt_sessions_api.get_categories()
        return {"categories": categories, "error": None}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting categories: {e!s}"
        )


@router.get("/api/prompt-sessions")
async def get_prompt_sessions(
    include_archived: bool = Query(False),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get all prompt sessions for a user"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        sessions = state.prompt_sessions_api.get_sessions(
            user_id=uid, include_archived=include_archived, limit=limit, offset=offset
        )
        return {"sessions": sessions, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error getting prompt sessions: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Get prompt sessions error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error getting prompt sessions: {e!s}"
        )


@router.get("/api/prompt-sessions/console")
async def get_console_session(
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    The user's CONSOLE session — the owner of the console chat's conversations.

    Declared BEFORE /api/prompt-sessions/{session_id} so "console" is not captured
    as a session id. Get-or-create: the console is the entry point, so the first
    landing makes the session and every later landing returns the same one. The
    uniqueness is the database's (idx_prompt_sessions_console_per_user), not this
    handler's, so two tabs landing together cannot make two.
    """
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        session = state.prompt_sessions_api.get_or_create_console_session(user_id=uid)
        if not session:
            raise HTTPException(
                status_code=500, detail="Could not resolve the console session."
            )
        return {"session": session, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        error_detail = (
            f"Error resolving the console session: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Console session error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error resolving the console session: {e!s}"
        )


@router.get("/api/prompt-sessions/{session_id}")
async def get_prompt_session(
    session_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """Get a specific prompt session by ID"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        session = state.prompt_sessions_api.get_session(session_id, uid)
        if not session:
            raise HTTPException(status_code=404, detail="Prompt session not found")
        return {"session": session, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error getting prompt session: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Get prompt session error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error getting prompt session: {e!s}"
        )


@router.post("/api/prompt-sessions")
async def create_prompt_session(
    request: CreatePromptSessionRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Create a new prompt session"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        session = state.prompt_sessions_api.create_session(
            user_id=uid, title=request.title, description=request.description,
            room_domain=request.room_domain,
        )
        return {"session": session, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error creating prompt session: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Create prompt session error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error creating prompt session: {e!s}"
        )


@router.put("/api/prompt-sessions/{session_id}")
async def update_prompt_session(
    session_id: str,
    request: UpdatePromptSessionRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Update a prompt session"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)

        # The card draws this word ("Version 1 | active"), so closing has to change it: an
        # archived package whose chip still read "active" would be a distinction nobody can
        # see. Only filled in when the caller did not state a status of its own.
        close_status = request.status
        if request.is_archived is True and request.status is None:
            close_status = "Completed"

        session = state.prompt_sessions_api.update_session(
            session_id=session_id,
            user_id=uid,
            title=request.title,
            description=request.description,
            left_column_content=request.left_column_content,
            compiled_output=request.compiled_output,
            conversation_id=request.conversation_id,
            is_active=request.is_active,
            is_archived=request.is_archived,
            metadata=request.metadata,
            category=request.category,
            status=close_status,
            likes=request.likes,
            model_name=request.model_name,
            team_name=request.team_name,
            avatar_url=request.avatar_url,
        )

        # ── CLOSING A PACKAGE CLOSES ITS CONVERSATION ──────────────────────────
        # A closed prompt is finished work, and its conversation stops being the live
        # thread: it is archived here, so the seat's lookup (open conversations only)
        # finds none and the next turn spoken in this package starts a NEW one. The
        # count is returned rather than assumed — the caller can say what happened.
        closed_conversations = 0
        if request.is_archived is True and state.conversation_api:
            try:
                closed_conversations = state.conversation_api.close_conversations_for_session(
                    session_id, uid
                )
                print(f"✅ Closed {closed_conversations} conversation(s) with package {session_id}")
            except Exception as e:
                print(f"⚠️  Could not close conversations for {session_id}: {e}")

        return {"session": session, "error": None, "closed_conversations": closed_conversations}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error updating prompt session: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Update prompt session error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error updating prompt session: {e!s}"
        )


@router.delete("/api/prompt-sessions/{session_id}")
async def delete_prompt_session(
    session_id: str,
    permanent: bool = Query(False),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Delete a prompt session (soft delete by archiving or permanent)"""
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


@router.post("/api/prompt-sessions/{session_id}/versions")
async def save_prompt_version(
    session_id: str,
    request: SavePromptVersionRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Save a new version of a prompt"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        version = state.prompt_sessions_api.save_version(
            session_id=session_id,
            user_id=uid,
            left_column_content=request.left_column_content,
            compiled_output=request.compiled_output,
            change_description=request.change_description,
            change_type=request.change_type,
        )
        return {"version": version, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error saving prompt version: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Save prompt version error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error saving prompt version: {e!s}"
        )


@router.get("/api/prompt-sessions/{session_id}/versions")
async def get_prompt_versions(
    session_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("version", regex="^(version|score)$"),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get all versions for a prompt session.

    sort=version (default): newest version first.
    sort=score: highest overall_score first (nulls last).
    """
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        versions = state.prompt_sessions_api.get_versions(
            session_id=session_id, user_id=uid, limit=limit, offset=offset
        )
        if sort == "score":
            versions = sorted(
                versions,
                key=lambda v: (v.get("overall_score") is None, -(v.get("overall_score") or 0)),
            )
        return {"versions": versions, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error getting prompt versions: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Get prompt versions error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error getting prompt versions: {e!s}"
        )


class VersionScoreRequest(BaseModel):
    overall_score: float
    score_breakdown: dict | None = None


@router.patch("/api/prompt-sessions/{session_id}/versions/{version_number}/score")
async def patch_version_score(
    session_id: str,
    version_number: int,
    request: VersionScoreRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Write or update the quality score for a specific prompt version."""
    if not state.prompt_sessions_api:
        raise HTTPException(status_code=503, detail="Database not available.")

    try:
        uid = get_user_id_from_header(x_user_id)
        with state.prompt_sessions_api.get_db_context() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SET app.current_user_id = '{uid}'")
            cursor.execute(
                """
                UPDATE prompt_versions
                SET overall_score = %s, score_breakdown = %s
                WHERE session_id = %s AND version_number = %s
                RETURNING id, version_number, overall_score, score_breakdown
                """,
                (
                    request.overall_score,
                    json.dumps(request.score_breakdown) if request.score_breakdown else None,
                    session_id,
                    version_number,
                ),
            )
            row = cursor.fetchone()
            conn.commit()
            if not row:
                raise HTTPException(status_code=404, detail="Version not found")
            return {"success": True, "version": dict(row)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating score: {e!s}")


@router.get("/api/prompt-sessions/{session_id}/versions/{version_number}")
async def get_prompt_version(
    session_id: str,
    version_number: int,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get a specific version of a prompt"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        version = state.prompt_sessions_api.get_version(
            session_id=session_id, version_number=version_number, user_id=uid
        )
        if not version:
            raise HTTPException(status_code=404, detail="Prompt version not found")
        return {"version": version, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error getting prompt version: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Get prompt version error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error getting prompt version: {e!s}"
        )


@router.post("/api/prompt-sessions/{session_id}/versions/{version_number}/restore")
async def restore_prompt_version(
    session_id: str,
    version_number: int,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Restore a specific version as the current content"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        version = state.prompt_sessions_api.restore_version(
            session_id=session_id, version_number=version_number, user_id=uid
        )
        return {"version": version, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        # The version layer raises ValueError both for "no such version" and for
        # "not your session". With the 10-version cap, a listed version being gone
        # is an ordinary condition, not a server fault — answer 404, not 500.
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error restoring prompt version: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Restore prompt version error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error restoring prompt version: {e!s}"
        )


class RecordEvaluationRequest(BaseModel):
    verdict: str | None = None
    sentence: str | None = None
    trigger: str = "run"
    output: str | None = None
    ask: str | None = None


@router.get("/api/prompt-sessions/{session_id}/evaluations")
async def list_evaluations(session_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")):
    """The judged runs of one package, oldest first — the rail's Evals view reads this."""
    if not state.prompt_sessions_api:
        raise HTTPException(status_code=503, detail="Database not available.")

    try:
        rows = state.prompt_sessions_api.list_evaluations(session_id)
        return {"evaluations": rows, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        print(f"❌ List evaluations error: {e!s}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error listing evaluations: {e!s}")


@router.delete("/api/prompt-sessions/{session_id}/evaluations/{evaluation_id}")
async def delete_evaluation(
    session_id: str,
    evaluation_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Remove one judged run. 404 when there is no such row for this package."""
    if not state.prompt_sessions_api:
        raise HTTPException(status_code=503, detail="Database not available.")

    try:
        deleted = state.prompt_sessions_api.delete_evaluation(session_id, evaluation_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        return {"success": True, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        print(f"❌ Delete evaluation error: {e!s}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error deleting evaluation: {e!s}")


@router.post("/api/prompt-sessions/{session_id}/evaluations")
async def record_evaluation(
    session_id: str,
    request: RecordEvaluationRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    Judge one run and store it.

    A caller that already HAS a verdict (the repair path's catalog check) sends it and the
    row is stored as-is — the check IS the judge. A caller with only the run's output asks
    Qwen to judge it: the model reads what the prompt asked and what the run answered, and
    returns cleared or failed with one sentence. A judge that cannot be asked stores
    verdict 'error' with the model's raw answer as the sentence — a record of what
    happened, never a silent gap.
    """
    if not state.prompt_sessions_api:
        raise HTTPException(status_code=503, detail="Database not available.")

    try:
        if request.verdict in ("cleared", "failed") and request.sentence:
            row = state.prompt_sessions_api.record_evaluation(
                session_id, request.verdict, request.sentence, request.trigger
            )
            return {"evaluation": row, "error": None}

        if not (request.output or "").strip():
            raise HTTPException(status_code=400, detail="No verdict and no output to judge.")

        try:
            judged = _judge_run_output(request.ask or "", request.output or "")
        except Exception as e:
            judged = {"verdict": "error", "sentence": f"The judge could not be asked: {e!s}"}
        row = state.prompt_sessions_api.record_evaluation(
            session_id, judged["verdict"], judged.get("sentence"), request.trigger
        )
        return {"evaluation": row, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        print(f"❌ Record evaluation error: {e!s}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error recording evaluation: {e!s}")


def _judge_run_output(ask: str, output: str) -> dict[str, Any]:
    """
    Ask Qwen to judge a run's answer against what it was asked to do. The verdict is two
    words the app already speaks — cleared, failed — and one sentence of plain English. No
    JSON: a prose answer is parsed for the word the judge chose, and an answer that says
    neither is a failed judgment, recorded rather than invented.

    THE ASK IS THE QUESTION SHEET — without it the judge marks an answer it cannot compare
    to anything, which is how a good briefing came back 'failed' for not being a two-line
    evaluation (measured live, 2026-09-24). With the ask, 'cleared' means the answer did
    what the prompt said to do.
    """
    question = (
        f"What the prompt asked for:\n\n{ask}\n\n"
        f"The run's answer:\n\n{output[:6000]}"
        if ask.strip()
        else f"The run's answer:\n\n{output[:6000]}"
    )
    answer = query_llm(
        context=(
            "You are the evaluator of a prompt package. Judge whether the run's answer did "
            "what the prompt asked it to do. Reply with exactly two lines: the first line is "
            "one word, cleared or failed. The second line is one sentence saying why."
        ),
        question=question,
        reasoning=False,
        mode="writer",
        prompt_id="evaluation-judge",
    ).strip()
    lines = [line.strip() for line in answer.splitlines() if line.strip()]
    verdict_word = (lines[0] if lines else answer).lower()
    verdict = "cleared" if "cleared" in verdict_word else ("failed" if "failed" in verdict_word else "error")
    sentence = lines[1] if len(lines) > 1 else (answer or "The judge returned no sentence.")
    return {"verdict": verdict, "sentence": sentence}


@router.get("/api/prompt-sessions/{session_id}/context-for-ai")
async def get_prompt_context_for_ai(
    session_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """Get context for AI query (prompt history, suggestions, conversation)"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        context = state.prompt_sessions_api.get_context_for_ai(session_id, uid)
        return {"context": context, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error getting prompt context for AI: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Get prompt context for AI error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error getting prompt context for AI: {e!s}"
        )


@router.post("/api/prompt-sessions/{session_id}/suggestions")
async def create_ai_suggestion(
    session_id: str,
    request: CreateSuggestionRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Create an AI suggestion for a prompt session"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        suggestion = state.prompt_sessions_api.create_suggestion(
            session_id=session_id,
            user_id=uid,
            suggestion_type=request.suggestion_type,
            content=request.content,
            context=request.context,
            generated_by_model=request.generated_by_model,
            confidence_score=request.confidence_score,
            relevance_score=request.relevance_score,
            metadata=request.metadata,
        )
        return {"suggestion": suggestion, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error creating AI suggestion: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Create AI suggestion error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error creating AI suggestion: {e!s}"
        )


class GrantPermissionRequest(BaseModel):
    user_id: str
    role: str  # 'owner' | 'editor' | 'viewer'


class TransferOwnershipRequest(BaseModel):
    new_owner_id: str


@router.get("/api/prompt-sessions/{session_id}/permissions")
async def get_session_permissions(
    session_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """List all contributors on a package (owner-only view)."""
    if not state.prompt_sessions_api:
        raise HTTPException(status_code=503, detail="Database not available")
    uid = get_user_id_from_header(x_user_id)
    conn = state.prompt_sessions_api.get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SET app.current_user_id = %s", (uid,))
        cursor.execute("SELECT user_id FROM prompt_sessions WHERE id = %s", (session_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        if str(row["user_id"]) != uid:
            raise HTTPException(status_code=403, detail="Only the owner can view permissions")
        cursor.execute(
            """
            SELECT user_id, role, granted_by, created_at
            FROM session_permissions WHERE session_id = %s
            ORDER BY created_at ASC
            """,
            (session_id,),
        )
        perms = [dict(r) for r in cursor.fetchall()]
        for p in perms:
            if p.get("created_at"):
                p["created_at"] = p["created_at"].isoformat()
        return {"permissions": perms, "owner_id": str(row["user_id"])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/api/prompt-sessions/{session_id}/permissions")
async def grant_session_permission(
    session_id: str,
    request: GrantPermissionRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Grant a user a contributor role on the package (owner-only)."""
    # ⚠️ 'owner' IS NOT GRANTABLE (2026-10-04). Ownership is the row's `user_id`, and a
    # granted 'owner' ROW is a trap: `revoke` refuses owner rows by its own rule
    # ("transfer ownership first"), so a second owner could never be taken back, and a
    # later transfer would leave two owner rows behind. One owner, one door: transfer.
    if request.role not in ("editor", "viewer"):
        raise HTTPException(
            status_code=400,
            detail="Role must be 'editor' or 'viewer' — ownership moves through transfer",
        )
    if not state.prompt_sessions_api:
        raise HTTPException(status_code=503, detail="Database not available")
    uid = get_user_id_from_header(x_user_id)
    conn = state.prompt_sessions_api.get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SET app.current_user_id = %s", (uid,))
        cursor.execute("SELECT user_id FROM prompt_sessions WHERE id = %s", (session_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        if str(row["user_id"]) != uid:
            raise HTTPException(status_code=403, detail="Only the owner can grant permissions")
        # A PERMISSION ROW MUST NAME A REAL USER — `session_permissions.user_id` has an FK
        # to `users`, so a UUID that is not one answers an opaque 500; this answers by name.
        cursor.execute("SELECT 1 AS present FROM users WHERE id = %s", (request.user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"No user {request.user_id}")
        cursor.execute(
            """
            INSERT INTO session_permissions (session_id, user_id, role, granted_by)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (session_id, user_id) DO UPDATE SET role = EXCLUDED.role
            RETURNING id
            """,
            (session_id, request.user_id, request.role, uid),
        )
        granted = cursor.fetchone()
        conn.commit()
        return {"success": True, "permission_id": str(granted["id"]) if granted else None,
                "session_id": session_id, "user_id": request.user_id, "role": request.role}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/api/prompt-sessions/{session_id}/permissions/{target_user_id}")
async def revoke_session_permission(
    session_id: str,
    target_user_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Revoke a contributor's role on the package (owner-only; cannot revoke owner)."""
    if not state.prompt_sessions_api:
        raise HTTPException(status_code=503, detail="Database not available")
    uid = get_user_id_from_header(x_user_id)
    conn = state.prompt_sessions_api.get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SET app.current_user_id = %s", (uid,))
        cursor.execute("SELECT user_id FROM prompt_sessions WHERE id = %s", (session_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        if str(row["user_id"]) != uid:
            raise HTTPException(status_code=403, detail="Only the owner can revoke permissions")
        if target_user_id == uid:
            raise HTTPException(status_code=400, detail="Cannot revoke the owner's role — transfer ownership first")
        cursor.execute(
            """
            DELETE FROM session_permissions
            WHERE session_id = %s AND user_id = %s AND role != 'owner'
            RETURNING id
            """,
            (session_id, target_user_id),
        )
        deleted = cursor.fetchone()
        conn.commit()
        if not deleted:
            raise HTTPException(status_code=404, detail="Permission not found")
        return {"success": True, "session_id": session_id, "revoked_user_id": target_user_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/api/prompt-sessions/{session_id}/transfer")
async def transfer_session_ownership(
    session_id: str,
    request: TransferOwnershipRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Transfer package ownership to another user (owner-only). Previous owner keeps 'editor'.

    THE CONTENT POLICY A TRANSFER EMBODIES — REFERENCE POINTER (2026-10-04, the owner's
    assistant's decision matrix; the recommended strategy, and this is what the code
    already did): the row's metadata rides along UNTOUCHED — including
    `builder_project_id` for a bridged product package — so the tool's project stays
    where it is and the new owner's card opens the same workspace. Nothing is spread
    out: conversation, versions and permissions all hang off `session_id`.
    THE DEEP-COPY PATH IS A NAMED SEAM, NOT BUILT: it would call the tool's export/import
    (the transfer code the engine already produces), create a project of the new owner's
    own, and repoint `builder_project_id`/`builder_preview_url` — a cross-system
    transaction and a product decision, recorded here so it is not re-derived.
    """
    if not state.prompt_sessions_api:
        raise HTTPException(status_code=503, detail="Database not available")
    uid = get_user_id_from_header(x_user_id)
    conn = state.prompt_sessions_api.get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SET app.current_user_id = %s", (uid,))
        cursor.execute("SELECT user_id FROM prompt_sessions WHERE id = %s", (session_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        if str(row["user_id"]) != uid:
            raise HTTPException(status_code=403, detail="Only the owner can transfer ownership")
        # A TRANSFER MUST NAME A REAL USER (2026-10-04) — the FK answers a UUID that is not
        # one with an opaque 500; and handing a package to its own owner is a no-op that
        # should say so, not run three writes to change nothing.
        if request.new_owner_id == uid:
            raise HTTPException(status_code=400, detail="The package already belongs to that user")
        cursor.execute("SELECT 1 AS present FROM users WHERE id = %s", (request.new_owner_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"No user {request.new_owner_id}")
        # New owner takes over the row + gets owner permission
        cursor.execute(
            "UPDATE prompt_sessions SET user_id = %s, updated_at = NOW() WHERE id = %s",
            (request.new_owner_id, session_id),
        )
        cursor.execute(
            """
            INSERT INTO session_permissions (session_id, user_id, role, granted_by)
            VALUES (%s, %s, 'owner', %s)
            ON CONFLICT (session_id, user_id) DO UPDATE SET role = 'owner'
            """,
            (session_id, request.new_owner_id, uid),
        )
        # Previous owner drops to editor
        cursor.execute(
            """
            UPDATE session_permissions SET role = 'editor'
            WHERE session_id = %s AND user_id = %s
            """,
            (session_id, uid),
        )
        conn.commit()
        return {"success": True, "session_id": session_id,
                "previous_owner_id": uid, "new_owner_id": request.new_owner_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/api/prompt-sessions/{session_id}/conversations")
async def get_session_conversations(
    session_id: str,
    tab: str | None = Query(None),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get all conversations linked to a prompt session."""
    if not state.conversation_api:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        uid = get_user_id_from_header(x_user_id)
        conversations = state.conversation_api.get_conversations_by_session(session_id, uid)
        return {"conversations": conversations}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/prompt-sessions/{session_id}/suggestions")
async def get_ai_suggestions(
    session_id: str,
    used: bool | None = Query(None),
    suggestion_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get AI suggestions for a prompt session"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        suggestions = state.prompt_sessions_api.get_suggestions(
            session_id=session_id,
            user_id=uid,
            used=used,
            suggestion_type=suggestion_type,
            limit=limit,
            offset=offset,
        )
        return {"suggestions": suggestions, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error getting AI suggestions: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Get AI suggestions error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error getting AI suggestions: {e!s}"
        )


@router.post("/api/prompt-sessions/suggestions/{suggestion_id}/use")
async def mark_suggestion_used(
    suggestion_id: str,
    inserted_position: str | None = Query(None),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Mark an AI suggestion as used"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        suggestion = state.prompt_sessions_api.mark_suggestion_used(
            suggestion_id=suggestion_id,
            user_id=uid,
            inserted_position=inserted_position,
        )
        return {"suggestion": suggestion, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error marking suggestion as used: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Mark suggestion used error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error marking suggestion as used: {e!s}"
        )


@router.get("/api/prompt-sessions/{session_id}/context-entries")
async def get_context_entries(
    session_id: str,
    context_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get context entries for a prompt session"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        entries = state.prompt_sessions_api.get_context_entries(
            session_id=session_id,
            user_id=uid,
            context_type=context_type,
            limit=limit,
            offset=offset,
        )
        return {"entries": entries, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error getting context entries: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Get context entries error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error getting context entries: {e!s}"
        )


@router.post("/api/prompt-sessions/{session_id}/context-entries")
async def add_context_entry(
    session_id: str,
    request: AddContextEntryRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Add a context entry for a prompt session"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        entry = state.prompt_sessions_api.add_context_entry(
            session_id=session_id,
            user_id=uid,
            context_type=request.context_type,
            content=request.content,
            source=request.source,
            relevance_score=request.relevance_score,
            metadata=request.metadata,
        )
        return {"entry": entry, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = f"Error adding context entry: {e!s}\n{traceback.format_exc()}"
        print(f"❌ Add context entry error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error adding context entry: {e!s}"
        )


@router.delete("/api/prompt-sessions/context-entries/{context_id}")
async def delete_context_entry(
    context_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """Delete a context entry"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        success = state.prompt_sessions_api.delete_context_entry(context_id, uid)
        if not success:
            raise HTTPException(status_code=404, detail="Context entry not found")
        return {"success": True}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error deleting context entry: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Delete context entry error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting context entry: {e!s}"
        )


@router.get("/api/prompt-sessions/stats")
async def get_prompt_session_stats(
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get statistics for user's prompt sessions"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        stats = state.prompt_sessions_api.get_session_stats(uid)
        return {"stats": stats, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error getting prompt session stats: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Get prompt session stats error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error getting prompt session stats: {e!s}"
        )


@router.get("/api/prompt-sessions/search")
async def search_prompt_sessions(
    query: str = Query(..., min_length=1),
    include_content: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Search prompt sessions by title, description, or content"""
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        sessions = state.prompt_sessions_api.search_sessions(
            user_id=uid,
            query=query,
            include_content=include_content,
            limit=limit,
            offset=offset,
        )
        return {"sessions": sessions, "error": None}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error searching prompt sessions: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Search prompt sessions error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error searching prompt sessions: {e!s}"
        )
