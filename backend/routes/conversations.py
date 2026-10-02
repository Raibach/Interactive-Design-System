"""Auto-extracted route module from main.py — zero behavior change."""
import json
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import BaseModel

import services as state
from deps import (
    get_user_id_from_header,
)

router = APIRouter()

# ============================================
# CONVERSATION ENDPOINTS
# ============================================


class CreateConversationRequest(BaseModel):
    project_id: str | None = None
    session_id: str | None = None   # required by the DB (conversations.session_id NOT NULL)
    title: str | None = None
    metadata: dict | None = None


class UpdateConversationRequest(BaseModel):
    title: str | None = None
    message_count: int | None = None
    project_id: str | None = None


class AddMessageRequest(BaseModel):
    role: str
    content: str
    metadata: dict[str, Any] | None = None


@router.get("/api/conversations")
async def get_conversations(
    projectId: str | None = Query(None),
    session_id: str | None = Query(None),
    include_archived: bool = Query(False),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get all conversations for a user, optionally for ONE package.

    `session_id` is the package a conversation is owned by — the same column the seat's own
    list is built from (`get_conversations_by_session`, what the console's assembly reads).
    Without it this answers for the whole USER, which is a different question: the console
    chat's count needs the package's conversations, not every conversation the user has.
    """
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        if session_id:
            # THE OWNERSHIP COLUMN IS `conversations.session_id`, AND get_all_conversations
            # DOES NOT READ IT — it takes the id and never filters on it (measured
            # 2026-09-19: asking for one package's conversations returned all 13 of the
            # user's). A package-scoped read therefore goes through the method that owns that
            # fact, the same one the console's assembly builds its own list from.
            conversations = state.conversation_api.get_conversations_by_session(
                session_id,
                uid,
                include_archived=include_archived,
            )
        else:
            conversations = state.conversation_api.get_all_conversations(
                uid,
                project_id=projectId,  # Use projectId from query param
                include_archived=include_archived,
            )
        return {"conversations": conversations}
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error loading conversations: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Conversations API error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error loading conversations: {e!s}"
        )


@router.get("/api/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """Get a specific conversation"""
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        conversation = state.conversation_api.get_conversation(conversation_id, uid)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = f"Error loading conversation: {e!s}\n{traceback.format_exc()}"
        print(f"❌ Get conversation error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error loading conversation: {e!s}"
        )


@router.post("/api/conversations")
async def create_conversation(
    request: CreateConversationRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Create a new conversation"""
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        # THE PACKAGE IS NOT A FREE PARAMETER (2026-09-18). `session_id` arrived from the
        # client and was written straight onto the row, so any caller could file a
        # conversation under a package they had nothing to do with. It may only name a
        # package the caller can write to — the same predicate every other package write uses.
        if request.session_id:
            owned = state.prompt_sessions_api.get_session(request.session_id, uid)
            if not owned:
                raise HTTPException(
                    status_code=403,
                    detail="That package does not exist, or you have no access to it.",
                )
        conversation_id = state.conversation_api.create_conversation(
            uid,
            project_id=request.project_id,
            title=request.title,
            metadata=request.metadata,
            session_id=request.session_id,
        )
        return {"id": conversation_id, "success": True}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = (
            f"Error creating conversation: {e!s}\n{traceback.format_exc()}"
        )
        print(f"❌ Create conversation error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error creating conversation: {e!s}"
        )


@router.put("/api/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    request: UpdateConversationRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Update a conversation"""
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        success = state.conversation_api.update_conversation(
            conversation_id,
            uid,
            title=request.title,
            message_count=request.message_count,
            project_id=request.project_id,
        )
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"success": True}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error saving conversation: {e!s}"
        )


@router.get("/api/conversations/{conversation_id}/draft")
async def get_conversation_draft(
    conversation_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """The drafting canvas's payload for this conversation (S2, wireframe-lab/PLAN.md).

    ABSENT IS A REAL ANSWER: `{"draft": null}` means nothing has been drafted in this thread yet,
    and the canvas draws its empty state. A read that FAILS is a 500 with the reason — never an
    empty draft standing in for a failure.
    """
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )
    try:
        uid = get_user_id_from_header(x_user_id)
        row = state.conversation_api.get_draft(conversation_id, uid)
        return {
            "conversation_id": conversation_id,
            "artifact_id": row["id"] if row else None,
            "savedAt": row["savedAt"] if row else None,
            "draft": row["draft"] if row else None,
        }
    except ValueError as refused:
        # The same refusal the messages route makes, in the same words — the check is one rule.
        raise HTTPException(status_code=404, detail=str(refused))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading the draft: {e!s}")


@router.put("/api/conversations/{conversation_id}/draft")
async def save_conversation_draft(
    conversation_id: str,
    request: Request,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Write the conversation's draft — ONE ROW, REPLACED (S2).

    One drag, one write: the drafting canvas's gesture end lands here, and the row it replaces is
    the same one the canvas was initialized from. The shape is checked here because a stored draft
    that is not a draft is a payload nothing can draw — and it would be found at LOAD time, in
    another room, long after the write that caused it.
    """
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )
    try:
        body = await request.json()
    except Exception as parse_error:
        raise HTTPException(status_code=400, detail=f"The draft is not valid JSON: {parse_error}")
    if not isinstance(body, dict) or not isinstance(body.get("nodes"), list):
        raise HTTPException(
            status_code=400,
            detail="A draft is an object with a 'nodes' list (and optionally 'label' and "
                   "'positions'); nothing was written",
        )
    try:
        uid = get_user_id_from_header(x_user_id)
        saved = state.conversation_api.save_draft(conversation_id, uid, body)
        return {"conversation_id": conversation_id, "artifact_id": saved["id"], "savedAt": saved["savedAt"]}
    except ValueError as refused:
        raise HTTPException(status_code=404, detail=str(refused))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving the draft: {e!s}")


@router.delete("/api/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """Delete a conversation"""
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        success = state.conversation_api.delete_conversation(conversation_id, uid)
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"success": True}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting conversation: {e!s}"
        )


@router.get("/api/conversations/{conversation_id}/surface-state")
async def get_surface_state(
    conversation_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """Get the A2UI surface state for a conversation"""
    if not state.conversation_api:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        uid = get_user_id_from_header(x_user_id)
        conv = state.conversation_api.get_conversation(conversation_id, uid)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {
            "surfaceState": json.loads(conv.get("surface_state_json"))
            if conv.get("surface_state_json")
            else None,
            "surfaceUpdatedAt": str(conv.get("surface_updated_at"))
            if conv.get("surface_updated_at")
            else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/conversations/{conversation_id}/surface-state")
async def save_surface_state(
    conversation_id: str,
    request: Request,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Save the A2UI surface state for a conversation"""
    if not state.conversation_api:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        body = await request.json()
        surface_state_json = json.dumps(body.get("surfaceStateJson", body))
        uid = get_user_id_from_header(x_user_id)
        success = state.conversation_api.update_conversation(
            conversation_id, uid, surface_state_json=surface_state_json
        )
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"success": True, "conversationId": conversation_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/conversations/{conversation_id}/archive")
async def archive_conversation(
    conversation_id: str,
    archived: bool = Query(True),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Archive or unarchive a conversation"""
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        success = state.conversation_api.archive_conversation(conversation_id, uid, archived)
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"success": True}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error archiving conversation: {e!s}"
        )


@router.get("/api/conversations/archived")
async def get_archived_conversations(
    projectId: str | None = Query(None),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get archived conversations"""
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        conversations = state.conversation_api.get_archived_conversations(uid, projectId)
        return {"conversations": conversations}
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error loading archived conversations: {e!s}"
        )


@router.get("/api/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    limit: int | None = Query(None),
    offset: int = Query(0),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Get messages for a conversation"""
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        messages = state.conversation_api.get_messages(conversation_id, uid, limit, offset)
        return {"messages": messages}
    except PermissionError as e:
        # The caller has no claim on the PACKAGE this conversation belongs to.
        # 403, not an empty list: a person who cannot read a conversation must
        # be told that, or they will read the empty result as "nothing was
        # ever said here".
        raise HTTPException(status_code=403, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading messages: {e!s}")


@router.post("/api/conversations/{conversation_id}/messages")
async def add_message(
    conversation_id: str,
    request: AddMessageRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Add a message to a conversation"""
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        message_id = state.conversation_api.add_message(
            conversation_id, uid, request.role, request.content, request.metadata
        )
        return {"id": message_id, "success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving message: {e!s}")


@router.delete("/api/messages/{message_id}")
async def delete_message(
    message_id: str, x_user_id: str | None = Header(None, alias="X-User-ID")
):
    """Delete a message"""
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        success = state.conversation_api.delete_message(message_id, uid)
        if not success:
            raise HTTPException(status_code=404, detail="Message not found")
        return {"success": True}
    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting message: {e!s}")


class ConfirmTagRequest(BaseModel):
    confirmed_tags: list[str] | None = None
    detected_entities: dict[str, Any]


@router.post("/api/conversation/confirm-tag")
async def confirm_tag(
    request: ConfirmTagRequest,
    conversation_id: str = Query(...),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    Confirm and store literary tags for a conversation

    Input:
    - conversation_id: Conversation UUID
    - confirmed_tags: Optional list of confirmed tag paths
    - detected_entities: ContextDetector entities (characters, work_focus, literary_elements, topics)

    Returns confirmation with stored tag paths
    """
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)

        # Get conversation to verify ownership and get content
        conversation = state.conversation_api.get_conversation(conversation_id, uid)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        # Get conversation messages for content
        messages = state.conversation_api.get_messages(conversation_id, uid, limit=1000)
        conversation_content = "\n".join(
            [
                f"{msg.get('role', 'unknown')}: {msg.get('content', '')}"
                for msg in messages
            ]
        )

        # Get project_id from conversation metadata
        project_id = conversation.get("project_id") or conversation.get(
            "metadata", {}
        ).get("project_id")

        # Get Milvus client and embedder if available
        milvus_client = None
        memory_embedder = None
        try:
            from memory_embedder import get_embedder
            from milvus_client import get_milvus_client

            milvus_client = get_milvus_client()
            if milvus_client:
                milvus_client.connect()
            memory_embedder = get_embedder()
        except Exception as e:
            print(f"⚠️ Milvus/Memory embedder not available: {e}")

        # Store tags using store_literary_tags function
        result = state.conversation_api.store_literary_tags(
            conversation_id=conversation_id,
            user_id=uid,
            detected_entities=request.detected_entities,
            conversation_content=conversation_content,
            project_id=project_id,
            milvus_client=milvus_client,
            memory_embedder=memory_embedder,
        )

        return {
            "success": True,
            "tag_paths": result["tag_paths"],
            "tag_ids": result["tag_ids"],
            "milvus_inserted": result["milvus_inserted"],
        }

    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        import traceback

        error_detail = f"Error confirming tags: {e!s}\n{traceback.format_exc()}"
        print(f"❌ Confirm tag error: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error confirming tags: {e!s}")


@router.post("/api/conversation/track-tag-suggestion")
async def track_tag_suggestion(
    conversation_id: str = Query(...),
    suggested_tags: list[str] = Query(...),
    confirmed: bool = Query(False),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    Track Grace's tag suggestions (for analytics and confirmation tracking)

    Input:
    - conversation_id: Conversation UUID
    - suggested_tags: List of suggested tag paths
    - confirmed: Whether user confirmed the suggestion

    Returns suggestion tracking ID
    """
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)

        # Get detected entities if available (optional)
        detected_entities = {}  # Can be enhanced to extract from conversation

        suggestion_id = state.conversation_api.track_tag_suggestion(
            conversation_id=conversation_id,
            user_id=uid,
            suggested_tags=suggested_tags,
            detected_entities=detected_entities,
            confirmed=confirmed,
        )

        return {"success": True, "suggestion_id": suggestion_id}

    except HTTPException:
        raise
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error tracking tag suggestion: {e!s}"
        )


@router.get("/api/conversation/tag-suggestion-stats")
async def get_tag_suggestion_stats(
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    Get tag suggestion statistics for a user

    Returns:
    - total_suggestions: Total number of tag suggestions
    - confirmed_suggestions: Number of confirmed suggestions
    - confirmation_rate: Rate of confirmation (0.0 to 1.0)
    """
    if not state.conversation_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    try:
        uid = get_user_id_from_header(x_user_id)
        stats = state.conversation_api.get_tag_suggestion_stats(uid)
        return stats
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting tag suggestion stats: {e!s}"
        )


