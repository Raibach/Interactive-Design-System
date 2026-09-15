"""Auto-extracted route module from main.py — zero behavior change."""
import asyncio
import json
import os
import sentry_sdk
import sys
import time
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import AliasChoices, BaseModel, Field

import services as state
from deps import (
    DEFAULT_USER_ID, REASONING_TRACE_PATH, A2UI_CATALOG_ID,
    a2ui_catalog, validate_a2ui_components, user_is_admin,
    get_user_id_from_header,
)
from grace_gui import (
    evaluate_source, query_llm, retrieve_memory_context, search_news,
    summarize_pdfs, milvus_save_version, milvus_get_versions,
)
from agent_rpc_handler import AgentRpcHandler
from figma_service import (
    get_file, get_file_versions, get_component, get_node,
    get_dev_resources, search_file,
)
from milvus_rest import MilvusREST

router = APIRouter()

# ============================================
# TEACHER MODEL ENDPOINTS
# ============================================


class TeacherQueryRequest(BaseModel):
    question: str
    context: Optional[str] = None
    conversation_id: Optional[str] = None
    # The prompt package this chat belongs to. Conversations roll up under it
    # (conversations.session_id is NOT NULL), so it is required to persist chat.
    session_id: Optional[str] = None
    project_id: Optional[str] = None
    reasoning: bool = False
    # These three arrive camelCase from the browser and snake_case from everyone else,
    # and Pydantic IGNORES a name it does not know — silently, with no error and no log.
    # So `includeMemory: true` was dropped on every chat turn: the client turned memory
    # ON, the server kept `include_memory = False`, and Grace was retrieved no memory at
    # all. Nothing anywhere said so. Both spellings are accepted now, so neither sender
    # can be ignored again; the field name is the first choice, so snake_case callers
    # are unaffected.
    reasoning_style: str = Field("chain_of_thought", validation_alias=AliasChoices("reasoning_style", "reasoningStyle"))
    include_memory: bool = Field(False, validation_alias=AliasChoices("include_memory", "includeMemory"))
    temperature: float = 0.45
    self_reflection: bool = Field(False, validation_alias=AliasChoices("self_reflection", "selfReflection"))
    editorial: Optional[Dict[str, Any]] = None
    mode: str = "chat"
    metadata: Optional[Dict[str, Any]] = None
    # Tool calls the PROMPT declares. Not a suggestion to the model: these are
    # executed here, server-side, BEFORE it is called — so the design is IN the
    # prompt rather than something the model is asked to imagine. The browser
    # cannot make these calls (the desktop MCP has no CORS and needs a session
    # handshake), which is why a declared tool call becomes a real one here.
    tool_calls: Optional[List[Dict[str, Any]]] = None


class EnsureModelRequest(BaseModel):
    model_type: str = "grace"  # "grace" (Z.ai GLM-4.7), "karen", "lm_studio", or "zai"


def _with_tool_results(context: str, blocks: List[str], warnings: List[str]) -> str:
    """Fold executed tool results into the structured prompt config.

    prompt_output mode hands grace_gui._assemble_prompt_output a JSON config and
    that function json.loads() it. Prepending prose to that string makes the
    parse throw, and its `except` substitutes a generic system prompt — so the
    design and the warning have to arrive as FIELDS, never as a prefix. A
    context that is not the structured config is returned untouched rather than
    mangled, because a chat-mode context is prose by design.
    """
    try:
        payload = json.loads(context) if context and context.strip() else {}
        if not isinstance(payload, dict):
            return context
    except Exception:
        return context

    if blocks:
        payload["tool_context"] = "\n\n".join(blocks)
    if warnings:
        payload["tool_warnings"] = list(warnings)
    return json.dumps(payload)


@router.post("/api/teacher/query")
async def api_teacher_query(request: TeacherQueryRequest):
    """Main AI query endpoint — context-aware with conversation persistence"""
    try:
        from grace_gui import query_llm

        query_start = time.time()
        uid = get_user_id_from_header()
        conv_id = request.conversation_id

        # ── Sentry AI monitoring: tag span with conversation + user ──
        sentry_sdk.set_user({"id": uid})
        if conv_id:
            sentry_sdk.set_tag("gen_ai.conversation.id", conv_id)
        sentry_sdk.set_tag("ai.model", "glm-4.7")
        sentry_sdk.set_tag("ai.provider", "zai")
        sentry_sdk.set_tag("ai.mode", request.mode)
        sentry_sdk.set_tag("ai.temperature", str(request.temperature))
        if request.project_id:
            sentry_sdk.set_tag("project.id", request.project_id)
        if request.reasoning:
            sentry_sdk.set_tag("ai.reasoning_style", request.reasoning_style)

        # ── Persistent conversation ──────────────────────────────────
        # Every chat turn must persist. `conversations.session_id` is NOT NULL,
        # so resolve the package's existing conversation for this prompt first
        # and only create one when there genuinely isn't one. Creating with a
        # null session_id was rejected by Postgres on every single call, so
        # nothing was ever saved.
        if state.conversation_api and not conv_id and request.session_id:
            try:
                existing = state.conversation_api.get_conversations_by_session(
                    request.session_id, uid
                )
                if existing:
                    conv_id = str(existing[0].get("id"))
                    print(f"✅ Reusing conversation {conv_id} for session {request.session_id}")
            except Exception as e:
                print(f"⚠️  Conversation lookup failed: {e}")

            if not conv_id:
                try:
                    title = request.question[:80] if request.question else "New Chat"
                    conv_id = state.conversation_api.create_conversation(
                        uid, request.project_id, title, session_id=request.session_id
                    )
                    print(f"✅ Created conversation {conv_id} for session {request.session_id}")
                except Exception as e:
                    print(f"⚠️  Failed to create conversation: {e}")
        elif state.conversation_api and not conv_id:
            print("ℹ️  No session_id supplied — this turn will not be persisted.")

        # Save user message to PostgreSQL
        if state.conversation_api and conv_id:
            try:
                state.conversation_api.add_message(conv_id, uid, "user", request.question)
            except Exception as e:
                print(f"⚠️  Failed to save user message: {e}")

        # ── Conversation context retrieval ──────────────────────────
        conversation_context = ""
        if state.conversation_api and conv_id:
            try:
                msgs = state.conversation_api.get_messages(conv_id, uid, limit=20)
                if msgs:
                    lines = []
                    for m in msgs:
                        role = "User" if m.get("type") == "question" else "Assistant"
                        lines.append(f"{role}: {m.get('content', '')}")
                    conversation_context = "\n".join(lines)
            except Exception as e:
                print(f"⚠️  Failed to retrieve conversation history: {e}")

        # ── Memory context ──────────────────────────────────────────
        memory_context = ""
        if request.include_memory:
            memory_context = retrieve_memory_context(request.question)

        # ── Full context assembly ───────────────────────────────────
        full_context = request.context or ""
        if conversation_context:
            full_context = (
                "=== CONVERSATION HISTORY ===\n"
                + conversation_context
                + "\n\n=== CURRENT WORKSPACE ===\n"
                + full_context
            )

        # ── Mode detection ──────────────────────────────────────────
        source = (request.metadata or {}).get("source", "")
        prompt_output_sources = {"ResponsivePromptBuilder", "prompt_builder", "PromptBuilder"}
        mode = "prompt_output" if (request.mode == "prompt_output" or source in prompt_output_sources) else "chat"

        # ── Tool calls: run them BEFORE the model ───────────────────
        # A tool call written into a prompt is only real if something executes it.
        # The repair prompt asks Figma for the design; this is where that happens.
        #
        # A failure is never swallowed: it is carried into the prompt as a WARNING
        # (so the model names what is missing instead of inventing it) AND returned
        # as `tool_warnings` (so the person sees it). A design-blind answer that
        # reads as authoritative is the exact outcome this prevents.
        tool_blocks: List[str] = []
        tool_warnings: List[str] = []
        if request.tool_calls:
            try:
                from figma_mcp import run_tool_calls

                # RUN IT OFF THE EVENT LOOP. `requests` is blocking, and this
                # handler is `async def`: calling it inline froze the ENTIRE server
                # for as long as Figma took to answer — every other request queued
                # behind it, so the app looked hung rather than busy.
                tool_blocks, tool_warnings = await asyncio.to_thread(
                    run_tool_calls, request.tool_calls
                )
                if tool_warnings:
                    print(f"⚠️  [tool_calls] {len(tool_warnings)} warning(s) — carried into the prompt")
            except Exception as e:  # noqa: BLE001 — reported, not raised
                tool_warnings = [f"Tool execution failed: {type(e).__name__}: {e}"]
                print(f"⚠️  [tool_calls] execution failed: {e}")

        # ── Deliver the tool results WITHOUT breaking the prompt config ─────
        # These used to be PREPENDED to `full_context`. In prompt_output mode
        # `full_context` IS the structured JSON config the frontend built, and
        # grace_gui._assemble_prompt_output runs json.loads() over it — so
        # prefixing the design (or a warning) made that parse throw, and its
        # `except` silently substituted a generic "Execute the prompt
        # configuration.". Every repair declares a tool call, so every repair
        # lost its System/User/Agent prompt at exactly the moment the design
        # arrived, and answered a generic question against a blob of raw Figma
        # JSON. Fold the results in as FIELDS so the load cannot be broken.
        if tool_blocks or tool_warnings:
            if mode == "prompt_output":
                full_context = _with_tool_results(full_context, tool_blocks, tool_warnings)
            else:
                # chat mode never parses the context, so the heading form is
                # still the clearest way to put the design in front of the model.
                if tool_blocks:
                    full_context = "\n\n".join(tool_blocks) + "\n\n" + full_context
                if tool_warnings:
                    full_context = (
                        "=== TOOL WARNING — READ THIS BEFORE ANSWERING ===\n"
                        + "\n".join(f"- {w}" for w in tool_warnings)
                        + "\n\nThe tool did not return the design. Do NOT invent it.\n\n"
                        + full_context
                    )

        # ── Call the LLM ────────────────────────────────────────────
        # Also off the event loop, for the same reason as the tool call above: this
        # is a synchronous SDK call and this handler is `async def`, so an inline
        # call blocked every other request for its whole duration. Pre-existing, and
        # invisible while the model answered in a couple of seconds — it stopped
        # being invisible the moment a run legitimately took a minute.
        result = await asyncio.to_thread(
            query_llm,
            context=full_context,
            question=request.question,
            reasoning=request.reasoning,
            reasoning_style=request.reasoning_style,
            memory_context=memory_context,
            temperature=request.temperature,
            self_reflection=request.self_reflection,
            editorial=request.editorial,
            mode=mode,
            # model intentionally omitted — use the enabled provider's default
            # (deepseek-v4-pro). Passing "glm-4.7" (a Z.ai model) here made
            # DeepSeek reject every prompt_output run with HTTP 400.
        )

        # ── Audit logging (fire-and-forget) ──────────────────────────
        try:
            if state.conversation_api:
                latency_ms = int((time.time() - query_start) * 1000)
                conn = state.conversation_api.get_db()
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata) VALUES (%s, %s, %s, %s, %s)",
                    (uid, "teacher_query", "conversation", conv_id, json.dumps({
                        "model": "glm-4.7",
                        "temperature": request.temperature,
                        "mode": mode,
                        "latency_ms": latency_ms,
                        "response_chars": len(result),
                    }))
                )
                conn.commit()
                cursor.close()
                conn.close()
        except Exception as e:
            print(f"⚠️  Audit log write failed (non-blocking): {e}")

        # ── Save assistant response to PostgreSQL ────────────────────
        if state.conversation_api and conv_id:
            try:
                state.conversation_api.add_message(conv_id, uid, "assistant", result)
            except Exception as e:
                print(f"⚠️  Failed to save assistant response: {e}")

        return {
            "content": result,
            "error": None,
            "conversation_id": conv_id,
            # What a declared tool call could not do. Empty on a clean run; the UI
            # shows it rather than letting a run look complete when the design was
            # never read.
            "tool_warnings": tool_warnings,
        }

    except Exception as e:
        import traceback
        error_detail = f"Error processing teacher query: {str(e)}\n{traceback.format_exc()}"
        print(f"❌ Teacher query error: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@router.post("/api/teacher/ensure-model")
async def api_ensure_model(request: EnsureModelRequest):
    """Ensure the specified model server is running (on-demand startup)"""
    try:
        # Import model_server_manager
        from model_server_manager import ensure_grace_server

        success = False
        mt = request.model_type.lower()
        if mt in ("grace", "zai", "glm", "karen", "lm_studio"):
            success = ensure_grace_server("zai")
            model_name = "GLM-4.7 (Z.ai)"
        else:
            raise HTTPException(
                status_code=400, detail=f"Unknown model type: {request.model_type}"
            )

        if success:
            return {
                "success": True,
                "message": f"{model_name} model server is running",
                "model_type": request.model_type,
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to start {model_name} model server. Check model server logs.",
            )

    except HTTPException:
        raise
    except Exception as e:
        import traceback

        error_detail = (
            f"Error ensuring model server: {str(e)}\n{traceback.format_exc()}"
        )
        print(f"❌ Ensure model error: {error_detail}")
        raise HTTPException(
            status_code=500, detail=f"Error ensuring model server: {str(e)}"
        )


# ============================================
# WHISPER TRANSCRIPTION ENDPOINT
# ============================================

# Whisper is optional — only used for the /api/transcribe endpoint.
# If whisper is not installed, the endpoint will return a 501 Not Implemented.

@router.post("/api/transcribe")
async def transcribe_audio(audio_file: UploadFile = File(...)):
    """
    Transcribe audio file using local Whisper model.
    Accepts WAV, MP3, WebM, and other audio formats supported by Whisper.
    """
    raise HTTPException(status_code=501, detail="Whisper not installed on this server")

