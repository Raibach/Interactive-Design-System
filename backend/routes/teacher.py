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
    LAST_USAGE,
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

        # ── A CLOSED CONVERSATION TAKES NO MORE TURNS ─────────────────────────
        #
        # A seat holds the id it adopted, and an update settles (closes) the conversation it
        # was made in — so the id a seat is still carrying is, by design, often the id of a
        # thread that is finished. Writing into it anyway would append to history that has
        # been marked done and would leave the package's live thread empty forever. The
        # closed id is therefore dropped here, and the resolution below starts a new one.
        if conv_id and state.conversation_api:
            try:
                live = state.conversation_api.get_conversation(str(conv_id), uid)
                if live and live.get("is_archived"):
                    print(f"ℹ️  Conversation {str(conv_id)[:8]}… is closed — starting a new one.")
                    conv_id = None
            except Exception as e:
                warnings.append(
                    f"This conversation's status could not be checked ({e}) — a reply may be written to a closed thread."
                )
                print(f"⚠️  Could not read conversation {conv_id}: {e}")

        # ── A CONVERSATION BELONGS TO ITS PACKAGE — ENFORCED HERE TOO (2026-09-18) ──
        # The id arrives from the client and the only check on it was ownership (user_id),
        # so a stale or foreign id the caller happens to own was written to: another
        # package's thread. The package is the container; the id must be one of ITS
        # conversations. If the check cannot be run, the turn is not written at all — an
        # unverifiable write is the thing this whole pass exists to stop.
        if conv_id and state.conversation_api and request.session_id:
            try:
                package_conversations = state.conversation_api.get_conversations_by_session(
                    request.session_id, uid
                )
                if str(conv_id) not in [str(c.get("id")) for c in (package_conversations or [])]:
                    warnings.append(
                        f"The conversation this seat named does not belong to this package; "
                        f"the turn was filed under the package's own thread."
                    )
                    print(f"ℹ️  Conversation {str(conv_id)[:8]}… is not package {str(request.session_id)[:8]}…'s — dropped.")
                    conv_id = None
            except Exception as e:
                persistence_error = (
                    f"The conversation could not be verified against its package ({e}), so your turn was NOT saved."
                )
                print(f"❌ Package check failed for conversation {conv_id}: {e}")
                conv_id = None

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
        # ── ONLY A CONVERSATION ATTACHES OR CREATES A CONVERSATION ────────────
        # A RUN carried a session_id like a chat does, so every Run attached (or created)
        # a conversation for the package and titled it "Execute the prompt
        # configuration." — four of them on one package, measured 2026-09-17. The seat
        # then binds the package's newest conversation, so what the chat drew was a RUN,
        # which is the owner's "it's putting the output into the chat panel".
        #
        # The OUTPUT column is a Run's home. A Run is not a conversation, so it starts
        # none and joins none.
        #
        # AND A FAILED LOOKUP IS NOT AN EMPTY PACKAGE (2026-09-18). The lookup used to fail
        # into a `print`, leave conv_id None, and fall through into the create branch — so a
        # database hiccup manufactured a SECOND conversation for a package that may already
        # have had one, and the caller saw a clean 200. The failure now refuses the write and
        # says so in the response (`persistence_error`), which the seat draws in the thread.
        persistence_error = None
        # WHAT THE TURN COULD NOT READ OR WRITE, SAID OUT LOUD (2026-09-18). Each of these
        # used to end in a `print` — a failure the answer was quietly missing — and the
        # caller got a clean 200. They ride the response now; the seat draws them and the
        # frontend logs them into the trace. check:error-suppression counts what still
        # swallows, and this list is the fix for the ones that used to be here.
        warnings: List[str] = []
        if request.mode != "chat":
            print(f"ℹ️  mode={request.mode} — not a conversation; no conversation attached or created.")
        elif state.conversation_api and not conv_id and request.session_id and persistence_error is None:
            existing = []
            lookup_failed = False
            try:
                existing = state.conversation_api.get_conversations_by_session(
                    request.session_id, uid
                )
            except Exception as e:
                lookup_failed = True
                print(f"❌ Conversation lookup failed for session {request.session_id}: {e}")
            if lookup_failed:
                persistence_error = (
                    "This package's conversations could not be read, so your turn was NOT saved — "
                    "creating one here would have manufactured a second thread for the package."
                )
            elif existing:
                conv_id = str(existing[0].get("id"))
                print(f"✅ Reusing conversation {conv_id} for session {request.session_id}")
            else:
                try:
                    title = request.question[:80] if request.question else "New Chat"
                    conv_id = state.conversation_api.create_conversation(
                        uid, request.project_id, title, session_id=request.session_id
                    )
                    print(f"✅ Created conversation {conv_id} for session {request.session_id}")
                except Exception as e:
                    persistence_error = f"The conversation for this package could not be created, so your turn was NOT saved: {e}"
                    print(f"❌ Failed to create conversation: {e}")
        elif state.conversation_api and not conv_id:
            # NOT AN ERROR: a turn spoken in a package that does not exist yet. It is held by
            # the seat and written when the first Save creates the package's conversation
            # (chat-panel.flushPendingTurns) — which is why this is printed, not reported.
            print("ℹ️  No session_id supplied — this turn will not be persisted.")

        # ── ONLY A CONVERSATION WRITES TO A CONVERSATION ─────────────────────
        # This persisted every call's question and answer into the package's chat,
        # whatever the call was for. A RUN is not a conversation: its prompt and its
        # answer belong in the OUTPUT column (`/session/middle_column/compiled_output`,
        # which the run writes), and writing them here as well is the duplication the
        # owner sees — the same text in the output column and in the thread beside it.
        # `chat` is the one mode where a turn is a turn.
        persist_turn = request.mode == "chat"
        if state.conversation_api and conv_id and persist_turn:
            try:
                state.conversation_api.add_message(conv_id, uid, "user", request.question)
            except Exception as e:
                persistence_error = f"Your message could not be written to this package's conversation: {e}"
                print(f"❌ Failed to save user message: {e}")
        elif state.conversation_api and conv_id:
            print(f"ℹ️  mode={request.mode} — not a conversation turn; not written to {str(conv_id)[:8]}…")

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
                warnings.append(
                    f"This package's history could not be read ({e}) — this answer was written without it."
                )
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

        # ── A GOVERNANCE REQUEST IS ANSWERED BY THE GOVERNANCE SYSTEM ────────────
        # The owner, 2026-09-18: "I should be able to engage the models and wake them up and ask
        # them for a governance report and I should be able to get something back in the chat
        # output." A message that NAMES governance runs the inspection and returns its report as
        # the reply, through this same turn — so the question and the report are stored in the
        # conversation like any other exchange. The trigger is deterministic, with no guessing:
        # the message begins with "governance" or "/governance", or it contains "governance
        # report". The tools load for the run and unload when it ends.
        _q = (request.question or "").strip().lower()
        result = None
        if request.mode == "chat" and (_q.startswith("governance") or _q.startswith("/governance") or "governance report" in _q):
            from governance_inspector import run_inspection

            print("[governance] a chat turn asked for a report — running the inspection")
            # file_message=False: THIS turn is the record (it is stored below like any other
            # exchange), so the inspector must not file a second copy of the same report.
            report = await run_inspection("asked-in-chat", file_message=False)
            governance_text = report.get("text") or (
                "The inspection did not complete: " + str((report.get("meta") or {}).get("error"))
            )
            result = governance_text

        if result is None:
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
                    # `conv_id or None` — NOT `conv_id`. A query is asked before a
                    # conversation exists on the composer's first turn, and on any
                    # turn the seat asks for on the person's behalf, and on those the
                    # id is the empty string. resource_id is a uuid column, so "" is a
                    # cast error and the whole audit row was lost — leaving a warning
                    # in the thread where the record should have been silent, and
                    # nothing anywhere recording that the call happened. The column
                    # accepts NULL and the audit is about the QUERY, so the row is
                    # still worth writing; it just has no conversation to point at yet.
                    (uid, "teacher_query", "conversation", conv_id or None, json.dumps({
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
            warnings.append(f"This turn's audit record could not be written ({e}).")
            print(f"⚠️  Audit log write failed (non-blocking): {e}")

        # ── Save the assistant response — only for a real conversation ────────
        # See the note at the user-message write: a Run's answer is the OUTPUT column's,
        # not a chat turn. Writing both is what put one answer in two places.
        if state.conversation_api and conv_id and request.mode == "chat":
            try:
                state.conversation_api.add_message(conv_id, uid, "assistant", result)
            except Exception as e:
                persistence_error = f"This reply could not be written to this package's conversation: {e}"
                print(f"❌ Failed to save assistant response: {e}")

        # The mirror writes (memory store, tag trigger) record their failures where they
        # happen; this is the caller that can say them (see ConversationAPI._MIRROR_WARNINGS).
        if state.conversation_api:
            try:
                warnings.extend(state.conversation_api.drain_mirror_warnings())
            except Exception as drain_error:
                # Not swallowed — a drain failure is itself said (the gate counts `pass`).
                warnings.append(f"the mirror-write warning list could not be read ({drain_error}).")

        # The measured cost of this call, attributed to the conversation it
        # served. A surface seat may only show its own conversation's numbers —
        # never session totals — so the usage that rides the envelope must say
        # which conversation it belongs to.
        if conv_id:
            LAST_USAGE["conversation_id"] = str(conv_id)

        return {
            "content": result,
            "error": None,
            "conversation_id": conv_id,
            # The measured cost of this call, so the surface seat's footer can
            # show its own conversation's numbers. LAST_USAGE was updated by
            # query_llm above and attributed to conv_id just before this.
            "usage": dict(LAST_USAGE),
            # What a declared tool call could not do. Empty on a clean run; the UI
            # shows it rather than letting a run look complete when the design was
            # never read.
            "tool_warnings": tool_warnings,
            # WHAT DID NOT PERSIST, SAID OUT LOUD. The writes above fail into a server-side
            # `print` and the caller used to get a clean 200 — the turn was drawn in the
            # thread and gone on reload, with nothing anywhere telling the person. The seat
            # draws this line in the thread (chat-panel._send). None on a clean turn.
            "persistence_error": persistence_error,
            # Everything this turn could not read or write — drawn by the seat, logged into
            # the trace. Empty on a clean turn.
            "warnings": warnings,
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

