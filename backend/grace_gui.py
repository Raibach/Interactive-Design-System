"""
Grace — LLM query layer for the prompt-composer backend.

Single entry point: query_llm().
Providers are tried in priority order; DeepSeek drives all A2UI paths.
Assembly/chat hard-fail if ALL providers are down — no fake surfaces.
"""

import itertools
import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# ═══════════════════════════════════════════════════════════════════════════════
# Provider config — tried in priority order on every query_llm() call
# ═══════════════════════════════════════════════════════════════════════════════
MODEL_PROVIDERS = [
    {
        "name": "DeepSeek API",
        "base_url": "https://api.deepseek.com",
        # Verified against GET /models with the current key (2026-09-14):
        # available = ["deepseek-flash", "deepseek-v4-pro"].
        # deepseek-flash times out under the surface budget — deepseek-v4-pro is the only model used.
        "model": "deepseek-v4-pro",
        "api_key_env": "DEEPSEEK_API_KEY",
    },
]

LLM_TIMEOUT = 10  # HARD 10s cap. A2UI surfaces must render in <=10s or 503.

# Which modes are SURFACES. A surface is a canvas that has to appear now, and the
# 10s cap is its contract. Everything NOT in this set asks the model to WRITE, and
# writing gets room.
#
# Written as a set rather than as `mode == "prompt_output"` because that test WAS
# the bug. `chat` was not in it, so a person's question inherited the assembly cap
# and died as "DeepSeek API request failed: Request timed out" — while
# deepseek-v4-pro, a REASONING model, spends completion tokens thinking before it
# writes a word (18 reasoning tokens to answer "Say OK", measured). The first fix
# covered `prompt_output` and left `chat` on 10s. Naming the surface set means a new
# writing mode is safe by default, and one that IS a surface has to say so here.
SURFACE_MODES = {"console_assembly", "surface_assembly", "catalog_health_assembly"}

# The writing budget. The ENV VAR keeps its old name on purpose: an operator may
# already have set LLM_TIMEOUT_PROMPT_OUTPUT, and renaming the variable would
# silently fall back to the default on their machine.
WRITING_TIMEOUT_ENV = "LLM_TIMEOUT_PROMPT_OUTPUT"
LLM_TIMEOUT_WRITING = int(os.getenv(WRITING_TIMEOUT_ENV, "120"))

# ═══════════════════════════════════════════════════════════════════════════════
# A2UI MISSION HEADER — top-of-context anchor for maximum model attention
# ═══════════════════════════════════════════════════════════════════════════════
MISSION_HEADER = """
<critical_protocol>
ROLE: Silent A2UI Assembler.
CONSTRAINTS: NO HTML, NO Webpages, NO DOM manipulation, NO conversational preamble.
OUTPUT: ONLY <a2ui_surface>...</a2ui_surface> XML tags from the Registry.
IF DRIFTED: Discard conversational text immediately. Return to tag emission.
ERROR HANDLING: Use <error-banner message="..."/> only. Never create debug pages.
</critical_protocol>
"""

# ═══════════════════════════════════════════════════════════════════════════════
# ASSISTANT PROFILE — Grace in conversation.
#
# Kept SEPARATE from the assembler profile above on purpose: the assembler's
# no-invention rules bind generated payloads, never her. Grace is a
# collaborator — she proposes, asks, and never refuses because a value is
# missing. (2026-09-16: the repair rules leaked into her prompt and she
# refused to help; the split is the fix.)
# ═══════════════════════════════════════════════════════════════════════════════
ASSISTANT_PROFILE = """
YOUR PROFILE — you are the COLLABORATOR, not the assembler and not the repair applier.
The rule against inventing annotations, event names, data paths, states, and
accessibility labels binds the code that applies changes — never your conversation.
Never refuse to help because a value is missing. When a design value is absent,
PROPOSE one and say it is proposed: "I'll propose role-select — confirm it, or
paste the Figma value." Never write a proposed value into the surface as if it
came from the design.
"""


# ═══════════════════════════════════════════════════════════════════════════════
# Public API — one call that routes everything
# ═══════════════════════════════════════════════════════════════════════════════

# The REAL token spend of the most recent query_llm() call, captured from the
# provider's own response.usage. It lives here rather than as a second return
# value because query_llm returns a string and every existing caller expects
# one. Read it immediately after the call; the next call overwrites it.
LAST_USAGE: Dict[str, Any] = {}

# Every query_llm() call gets a monotonically increasing id so the client can
# tell one measured cost from the next. Without it, a surface that gets applied
# twice dispatches its usage twice and the running tally double-counts.
# itertools.count() is atomic in CPython — no lock, and no `global` needed.
_CALL_SEQ = itertools.count(1)


def query_llm(
    context: str = "",
    question: str = "",
    reasoning: bool = False,
    reasoning_style: str = "chain_of_thought",
    memory_context: str = "",
    temperature: float = 0.0,
    self_reflection: bool = False,
    editorial: Optional[Dict[str, Any]] = None,
    mode: str = "chat",
    prompt_id: str = "unknown",
    model: Optional[str] = None,
) -> str:
    """Query the LLM. Tries all providers in priority order.

    Modes:
        console_assembly  — lightweight JSON contract for A2UI console/composer
        surface_assembly  — full A2UI surface (composer, session)
        prompt_output     — execute the user's prompt, return raw output
        chat              — prompt engineering assistant
    """
    if not question.strip():
        return "Please provide a question to answer."

    # ── System prompt by mode ──────────────────────────────────────────
    if mode in ("console_assembly", "surface_assembly"):
        system_prompt = (
            "You are a strict JSON generator for A2UI surface contracts. "
            "Output ONLY the exact JSON object described in the user message. "
            "No preamble, no explanations, no markdown fences, no extra text. "
            "The entire response must be valid parseable JSON and nothing else."
        )

    elif mode == "prompt_output":
        system_prompt, question = _assemble_prompt_output(context, question)

    else:  # chat
        system_prompt = _build_chat_system(context, memory_context)

    # ── Message payload ───────────────────────────────────────────────
    # surface_assembly gets the SAME bare strict-JSON system prompt as
    # console_assembly. MISSION_HEADER (XML <a2ui_surface> mandate) is
    # chat-only — prepending it to assembly requests made the model drift
    # out of the JSON contract (verified live 2026-09-09: composer 503
    # KeyError 'components' with envelope-shaped response).
    messages = []
    if mode in ("console_assembly", "surface_assembly"):
        messages.append({"role": "system", "content": system_prompt})
    elif mode == "prompt_output":
        # RUN executes the USER'S prompt. The A2UI MISSION_HEADER must NOT be
        # prepended here: it mandates <a2ui_surface> XML, so the model replied
        # with an error-banner envelope instead of the requested output
        # (verified live: content = "<a2ui_surface><error-banner .../></a2ui_surface>").
        if system_prompt and system_prompt.strip():
            messages.append({"role": "system", "content": system_prompt})
        else:
            messages.append({"role": "system", "content": (
                "You are a production execution engine. Execute the user's request "
                "and return only the output they asked for. No preamble, no commentary."
            )})
    elif mode == "chat":
        # Chat is CONVERSATION, not assembly. Prepending MISSION_HEADER here
        # mandated "ONLY <a2ui_surface> XML", so a chat reply with nothing to
        # update returned the empty shell "<a2ui_surface></a2ui_surface>"
        # (29 chars, verified live 2026-09-16) and the person read a dead chat.
        # The frontend's context already carries Grace's persona; the tags in
        # it are TOOLS she may use, not her only allowed output.
        messages.append({"role": "system", "content": system_prompt or (
            "You are Grace, a helpful prompt-engineering assistant. "
            "Reply in plain prose."
        )})
    elif system_prompt and system_prompt.strip():
        messages.append({"role": "system", "content": MISSION_HEADER + system_prompt})
    else:
        messages.append({"role": "system", "content": MISSION_HEADER})
    messages.append({"role": "user", "content": question})

    # ── Token budget ─────────────────────────────────────────────────
    # deepseek-v4-pro is a REASONING model: it spends completion tokens thinking
    # BEFORE it writes anything (verified live — 18 reasoning tokens to answer
    # "Say OK"). Budgets must therefore cover reasoning + the actual output, or
    # `content` comes back empty with finish_reason="length".
    token_budgets = {
        "console_assembly": 4000,
        "surface_assembly": 8000,
        "prompt_output": 8000,
    }
    max_tokens = token_budgets.get(mode, 4000)
    request_temp = 0.0 if mode == "console_assembly" else temperature

    payload = {
        "messages": messages,
        "temperature": request_temp,
        "max_tokens": max_tokens,
        "stream": False,
    }

    if mode in ("console_assembly", "surface_assembly"):
        payload["response_format"] = {"type": "json_object"}

    # ── Provider fallback loop ───────────────────────────────────────
    last_error = "No providers configured."
    for provider in MODEL_PROVIDERS:
        api_key = os.getenv(provider.get("api_key_env", ""))
        if not api_key:
            print(f"[{provider['name']}] Skipped — no API key ({provider.get('api_key_env', '?')})")
            last_error = f"Error: {provider['name']} key is not configured."
            continue

        model_name = model or provider["model"]
        print(f"[{provider['name']}] Attempting {model_name}...")
        try:
            # Surfaces keep the tight cap; anything that writes gets room. See
            # SURFACE_MODES. `chat` is a writing mode — a person is waiting on an
            # answer, not on a canvas.
            client_timeout = (
                LLM_TIMEOUT if mode in SURFACE_MODES else LLM_TIMEOUT_WRITING
            )
            # One retry, not the SDK's two. This is a single blocking call on a
            # request a person is watching, and the SDK retries a TIMEOUT by
            # default — so a slow Run waits timeout × 3 before it can report
            # anything. Two attempts (one retry) is the whole budget: a call that
            # has already timed out once at 120s does not need a third try.
            client = OpenAI(
                base_url=provider["base_url"],
                api_key=api_key,
                timeout=client_timeout,
                max_retries=1,
            )
            response = client.chat.completions.create(**payload, model=model_name)
            message = response.choices[0].message
            # Capture what this actually cost. Providers report it; guessing it
            # would put an invented number above a real action.
            _usage = getattr(response, "usage", None)
            if _usage is not None:
                LAST_USAGE.clear()
                LAST_USAGE.update({
                    "call_id": next(_CALL_SEQ),
                    "provider": provider["name"],
                    "model": model_name,
                    "mode": mode,
                    "prompt_tokens": getattr(_usage, "prompt_tokens", None),
                    "completion_tokens": getattr(_usage, "completion_tokens", None),
                    "total_tokens": getattr(_usage, "total_tokens", None),
                })
            content = (message.content or "").strip()
            if not content and getattr(message, "reasoning_content", None):
                # The model ran out of budget mid-thought. Surfacing reasoning as
                # the answer is a last resort — say so, because the output column
                # would otherwise show the model's inner monologue as a result.
                print(
                    f"[{provider['name']}] ⚠️  empty content (finish_reason="
                    f"{response.choices[0].finish_reason}) — falling back to "
                    f"reasoning_content. Raise max_tokens for mode={mode}."
                )
                content = message.reasoning_content.strip()
            if not content:
                raise RuntimeError("Empty response")

            content = _process_backend_tags(content, context, prompt_id)
            print(f"[{provider['name']}] OK — {len(content)} chars")
            return content

        except Exception as exc:
            print(f"[{provider['name']}] Failed: {exc}")
            if "timed out" in str(exc).lower():
                # Say WHICH budget expired, and whether it is the one meant to be
                # tight. "Request timed out." alone sends a reader to the provider,
                # the network and the model — when the number at fault was a
                # constant in this file.
                if mode in SURFACE_MODES:
                    why = (
                        f"this is a SURFACE and {LLM_TIMEOUT}s is its contract: "
                        "the canvas has to appear now"
                    )
                else:
                    why = (
                        f"{mode} is a WRITING mode and {client_timeout}s was the budget — "
                        f"raise {WRITING_TIMEOUT_ENV} if a reasoning model needs longer"
                    )
                last_error = (
                    f"Error: {provider['name']} request failed: {exc} "
                    f"(waited {client_timeout}s; {why})"
                )
            else:
                last_error = f"Error: {provider['name']} request failed: {exc}"

    return last_error


# ═══════════════════════════════════════════════════════════════════════════════
# System prompt builders
# ═══════════════════════════════════════════════════════════════════════════════

def _assemble_prompt_output(context: str, question: str) -> tuple:
    """Build system + user messages from structured JSON prompt config.

    Also carries the results of any tool call the prompt declared: routes/
    teacher.py executes those before the model runs and folds them into the
    config as `tool_context` / `tool_warnings`. They arrive as FIELDS so that
    the _json.loads() below cannot be broken by them.
    """
    try:
        import json as _json
        payload = _json.loads(context) if context and context.strip() else {}
        core = payload.get("core_roles", {})
        custom = payload.get("custom_roles", [])
        # The design the tool call actually read, and what it failed to read.
        # Empty on a prompt that declares no tool call.
        tool_context = payload.get("tool_context") or ""
        tool_warnings = payload.get("tool_warnings") or []

        system_role = core.get("System Role") or core.get("System") or ""
        user_role = core.get("User Role") or core.get("User") or "Execute the prompt configuration."
        agent_role = core.get("Agent Role") or core.get("Agent") or ""

        extras = []
        if agent_role:
            extras.append(f"AGENT ROLE:\n{agent_role}")
        if core.get("Constraints"):
            extras.append(f"CONSTRAINTS (follow strictly):\n{core['Constraints']}")
        if core.get("Context"):
            extras.append(f"CONTEXT:\n{core['Context']}")
        if core.get("Few Shot"):
            extras.append(f"EXAMPLES:\n{core['Few Shot']}")
        for cr in custom:
            if cr.get("name") and cr.get("content"):
                extras.append(f"{cr['name']}:\n{cr['content']}")
        if extras:
            system_role = system_role + "\n\n" + "\n\n".join(extras)

        if core.get("Tool Call"):
            tc = core["Tool Call"]
            if len(tc) > 3000:
                tc = tc[:3000] + "\n\n[...truncated...]"
            # This section is the run's DECLARED TOOL and its address; Figma's
            # own answer to it is in `tool_context`, injected below. Labeling
            # three lines of node ids "SOURCE CODE TO ANALYZE" only invited the
            # model to analyse the address instead of the fix it was asked for.
            user_role = user_role + "\n\n--- DECLARED TOOL FOR THIS RUN ---\n" + tc

        if tool_warnings:
            system_role = (
                "=== TOOL WARNING — READ THIS BEFORE ANSWERING ===\n"
                + "\n".join(f"- {w}" for w in tool_warnings)
                + "\n\nThe tool did not return the design. Do NOT invent it and do NOT "
                  "proceed as though it were here: name what is missing and ask for it.\n\n"
                + system_role
            )
        if tool_context:
            system_role = (
                system_role + "\n\n" + tool_context if system_role.strip() else tool_context
            )

        system = system_role or (
            "You are a production execution engine. Execute the user's request "
            "and return only the output they asked for. No preamble, no commentary."
        )
        return system, user_role

    except Exception:
        return context, "Execute the prompt configuration."


def _build_chat_system(context: str, memory_context: str) -> str:
    """Build the full chat-mode system prompt with A2UI protocol + tag registry."""
    a2ui_protocol = (
        "\n\nA2UI PROTOCOL — YOUR SURFACE TOOLS\n"
        "You are a conversational assistant FIRST: reply in plain prose.\n"
        "The XML tags below are TOOLS you MAY use to drive the workspace — they are\n"
        "not your only output, and you never wrap prose in them.\n"
        "CONSTRAINTS:\n"
        "1. NEVER output raw HTML tags (<div>, <script>, <style>).\n"
        "2. NEVER create new files, routes, or 'hidden pages' to fix errors.\n"
        "3. NEVER manipulate the DOM directly.\n"
        "4. If an error occurs, report it via the <error-banner> tag.\n"
        "5. When you change a component, wrap ONLY the component updates in\n"
        "   <a2ui_surface>...</a2ui_surface>. If you change nothing, say so in\n"
        "   plain prose — never emit an empty <a2ui_surface></a2ui_surface>.\n"
        "\n"
        "EXAMPLE INPUT: 'User clicks Console'\n"
        "EXAMPLE OUTPUT:\n"
        "<a2ui_surface>\n"
        "  <update_components component=\"chat-panel\" props='{\"status\": \"active\"}' />\n"
        "</a2ui_surface>\n"
    )

    tag_instructions = (
        a2ui_protocol
        + "\n\nYOUR IDENTITY\n"
        "You are a PROMPT ENGINEERING EXPERT. This is not optional.\n"
        "Every user who interacts with you expects you to be better at\n"
        "prompt engineering than they are. They come to you for\n"
        "expertise, guidance, and correction — not just execution.\n"
        "\n"
        "Your responsibilities:\n"
        "- The user provides objectives and ideas. YOU build the prompt.\n"
        "- YOU decide which content goes in which section. The user may\n"
        "  not know the difference between System Role, User Role, Context,\n"
        "  Constraints, Few Shot, or Tool Call. YOU do.\n"
        "- If the user puts content in the wrong section, CORRECT it.\n"
        "  Move it to the right section without being asked.\n"
        "- If sections are empty that should be filled, FILL them.\n"
        "  Don't wait for the user to say \"add to Constraints\" — if\n"
        "  you see what constraints should exist, ADD them.\n"
        "- If the user's prompt is weak, SAY so — and explain why.\n"
        "  Then offer to fix it, or just fix it.\n"
        "- Be direct. Don't hedge. Don't say \"you might want to.\"\n"
        "  Say \"This constraint is too loose. I'm tightening it.\"\n"
        "- The user is NOT a prompt engineer. They have domain\n"
        "  knowledge but may not know how to structure it. YOU bridge\n"
        "  that gap. You translate their ideas into engineering.\n"
        "\n\nYOUR WORKSPACE INTERFACE\n"
        "You have FULL control over the left column prompt sections.\n"
        "Use these XML tags to WRITE content — do not describe what should\n"
        "go there, WRITE it there immediately:\n\n"
        "<update_agent>TEXT</update_agent> — Write to the System Role section\n"
        "<update_user>TEXT</update_user> — Write to the User Role section\n"
        "<update_agent_role>TEXT</update_agent_role> — Write to the Agent Role section\n"
        "<update_tool>TEXT</update_tool> — Write to the Tool Call section\n"
        "<update_few_shot>TEXT</update_few_shot> — Write to the Few Shot section\n"
        "<update_context>TEXT</update_context> — Write to the Context section\n"
        "<update_constraints>TEXT</update_constraints> — Write to the Constraints section\n"
        "<add_role name=\"NAME\">CONTENT</add_role> — Create a new custom section\n"
        "<remove_role name=\"NAME\"/> — Delete ANY section by name, including the built-in System Role, User Role and Agent Role\n"
        "<run_prompt/> — Trigger prompt execution\n"
        "<switch_tab>trace|variables|chat</switch_tab> — Navigate right-column tabs\n"
        "<save/> — Save the current prompt\n"
        "<reassemble-console sort=\"category|title\"/> — Sort console cards\n"
        "<reassemble-console filter=\"Design System\"/> — Filter console by category\n"
        "\n\nLEXICAL EDITOR (Third Column Tool)\n"
        "You can open a full rich-text editor in the third column.\n"
        "Use these tags to launch and control it:\n\n"
        "<load_tool name=\"lexical-editor\"/> — Launch the editor\n"
        "<close_tool/> — Close editor, return to output view\n"
        "\n"
        "WHICH SECTION A TAG WRITES, AND WHAT MUST NOT GO IN A PROMPT\n"
        "Each tag above writes ONE seat of the left-column prompt, and the seat is\n"
        "found by its name. One seat answers to several spellings: System Role and\n"
        "System, User Role and User, Agent Role and Agent, Tool Call both ways.\n"
        "A repair prompt — the one the app assembles when a finding is repaired — has\n"
        "four seats, named System, User, Tool Call and Agent. Context, Few Shot and\n"
        "Constraints are not in it, so a tag for one of those has nowhere to land, and\n"
        "the column reports that rather than changing in silence.\n"
        "Never write an instruction, a question, or a list of possible answers into a\n"
        "prompt. A prompt is the text the model reads: a question you put in it is\n"
        "answered by the model, not by the person, who never opens that box. Everything\n"
        "you have to say TO the person — what is still missing, what you are about to\n"
        "do, a choice you need — goes in your reply, with buttons. When the app's own\n"
        "prompt is waiting on a person it already names the value it wants on the\n"
        "field's own label; your sentence is what asks for it, and when they answer,\n"
        "you write it in.\n"
        "\n"
        "Once the editor is open, control it with these tags.\n"
        "ALWAYS use the self-closing attribute form:\n\n"
        "<set_content content=\"TEXT\"/> — Replace all editor content\n"
        "<insert_text text=\"TEXT\"/> — Insert at cursor position\n"
        "<append_text text=\"TEXT\"/> — Append to end of document\n"
        "<format_text type=\"bold|italic|underline|strikethrough|code\"/> — Inline formatting\n"
        "<format_block type=\"h1|h2|h3|paragraph|quote|code|ul|ol|checklist\"/> — Block type\n"
        "<format_align type=\"left|center|right|justify\"/> — Alignment\n"
        "<format_font family=\"Inter\" size=\"16px\"/> — Font changes\n"
        "<clear_formating/> — Remove formatting from selection\n"
        "<insert_table rows=\"3\" cols=\"3\"/> — Insert a table\n"
        "<insert_link url=\"https://...\" text=\"label\"/> — Insert hyperlink\n"
        "<insert_horizontal_rule/> — Divider line\n"
        "<insert_code_block language=\"typescript\"/> — Code block\n"
        "<undo/> — Undo last edit\n"
        "<redo/> — Redo last undone edit\n"
        "<toggle_code_view/> — Switch between rich text and code view\n"
        "<toggle_lock/> — Lock/unlock editor (read-only mode)\n"
        "<export format=\"markdown|html|text\"/> — Export document\n"
        "<check_writing/> — Run grammar and style check\n"
        "\n\nCOMPONENT CATALOG (Storybook)\n"
        "All available UI components are documented in Storybook.\n"
        "Browse the A2UI Components section to find:\n"
        "- Surface Container: AI-controllable output rendering\n"
        "- Lexical Editor: 24-command rich text editor\n"
        "- Tag Catalog: All 40 registered XML tags with schemas\n"
        "- Status Indicator: Lit-based status component\n"
        "The Tag Catalog shows every tag the AI can emit — with\n"
        "surface (composer/console), column, and constraints.\n"
        "ALWAYS consult the catalog before emitting tags.\n"
        "\n"
        "IMPORTANT: When you know what belongs in a section,\n"
        "immediately emit the appropriate XML tag. Do NOT describe it.\n"
        "Do NOT ask permission. You are the expert — ACT like it.\n"
        "\n\nOPTIMIZATION ADVISOR\n"
        "After reviewing the user's prompt, if you see ways to improve it —\n"
        "clearer instructions, better constraints, missing context, stronger\n"
        "examples, tighter guardrails — TELL the user. Be specific.\n"
        "If the prompt already looks excellent, say so — don't invent problems.\n"
        "\n\nHOW YOU WRITE TO A PERSON (the chat panel draws your words as plain text)\n"
        "1. Plain sentences. No headings and no number-sign characters, no asterisks\n"
        "   or underscores for weight, no tables, no bullet stars, no backticks or\n"
        "   code fences, no lines of dashes or equals signs.\n"
        "2. Short. Say it the way you would say it out loud, then stop.\n"
        "3. When you had to decide something the user did not tell you, name the\n"
        "   decision in one short sentence so they can change it. Never label it,\n"
        "   never explain how you know, never describe your reasoning. A value you\n"
        "   did not get from the user is your own choice, and saying what you chose\n"
        "   is the whole of it.\n"
        "4. Never write out the choices of a button, and never ask the user to reply\n"
        "   with a word. The buttons are the ask.\n"
        "\n\nWHEN YOU HAVE ADVICE TO OFFER\n"
        "Put these three on the last line, once, and only when the user can actually\n"
        "take or leave what you said:\n\n"
        "[Accept Advice](action:accept_advice)\n"
        "[Reject Advice](action:reject_advice)\n"
        "[Explain More](action:explain_more)\n\n"
    )

    # The ASSISTANT PROFILE rides at the TOP of every chat, even when a repair
    # brief is in the room: conversation keeps its collaborator rules while the
    # assembler/repair strictness binds only the payloads she generates.
    if context and context.strip():
        system = ASSISTANT_PROFILE + context + tag_instructions
    else:
        system = ASSISTANT_PROFILE + (
            "You are Grace, the execution engine for this prompt engineering workspace.\n"
            "Your only interface is this chat panel.\n"
            "You are the AI, NOT the user. Execute the user's request directly.\n"
        ) + tag_instructions

    if memory_context and memory_context.strip():
        system += f"\n\nRelevant memory context:\n{memory_context}"

    return system


# ═══════════════════════════════════════════════════════════════════════════════
# Backend XML tag interception (<save/>, <get_versions/>, <load_version>)
# ═══════════════════════════════════════════════════════════════════════════════

def _process_backend_tags(response_text: str, workspace_context: str = "", prompt_id: str = "unknown") -> str:
    """Intercept backend XML command tags in model responses.
    Frontend tags (update_agent, etc.) pass through untouched."""
    import re

    if "<save/>" in response_text:
        try:
            result = milvus_save_version(prompt_id, workspace_context)
            msg = f"\n\n[SYSTEM: Saved as version {result['version_number']}. {result['saved_at']}]\n"
        except Exception as e:
            msg = f"\n\n[SYSTEM: Save failed — {e}]\n"
        response_text = response_text.replace("<save/>", msg)

    if "<get_versions/>" in response_text:
        try:
            versions = milvus_get_versions(prompt_id)
            if versions:
                lines = [f"\n\n[VERSION HISTORY — {len(versions)} entries]\n"]
                for v in versions:
                    lines.append(f"  v{v.get('id','?')}: [{v.get('saved_at','?')}] {v.get('content_preview','')}...")
                msg = "\n".join(lines) + "\n[/VERSION HISTORY]\n"
            else:
                msg = "\n\n[SYSTEM: No saved versions yet.]\n"
        except Exception as e:
            msg = f"\n\n[SYSTEM: Version query failed — {e}]\n"
        response_text = response_text.replace("<get_versions/>", msg)

    load_match = re.search(r"<load_version>(\d+)</load_version>", response_text)
    if load_match:
        vnum = int(load_match.group(1))
        try:
            versions = milvus_get_versions(prompt_id)
            if versions and vnum <= len(versions):
                entry = versions[vnum - 1]
                content = (
                    f"\n\n[SYSTEM: Loaded version {vnum} from {entry.get('saved_at', 'unknown')}]\n"
                    f"{entry.get('content_preview', '')}\n"
                    f"[/LOADED VERSION {vnum}]\n"
                )
            else:
                available = len(versions) if versions else 0
                content = f"\n\n[SYSTEM: Version {vnum} not found. Available: 1-{available}]\n"
        except Exception as e:
            content = f"\n\n[SYSTEM: Load failed — {e}]\n"
        response_text = response_text.replace(load_match.group(0), content)

    return response_text


# ═══════════════════════════════════════════════════════════════════════════════
# Zilliz-backed version storage (uses shared milvus_client, not raw pymilvus)
# ═══════════════════════════════════════════════════════════════════════════════

def milvus_save_version(
    prompt_id: str,
    content: str,
    ai_metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    """Save a workspace snapshot to prompt_versions via Zilliz Cloud.

    Returns {version_number, saved_at, prompt_id} or raises RuntimeError.
    """
    from milvus_client import get_milvus_client
    from memory_embedder import get_embedder
    from datetime import datetime
    import json as json_module

    client = get_milvus_client()
    if not client or not client.client:
        raise RuntimeError("Zilliz not connected")

    embedder = get_embedder()
    if not embedder:
        raise RuntimeError("Embedding model not loaded")

    vector = embedder.generate_embedding(content)
    now = datetime.utcnow().isoformat()

    doc = {
        "vector": vector,
        "prompt_id": prompt_id,
        "content": content,
        "saved_at": now,
    }
    if ai_metadata:
        doc["meta_json"] = json_module.dumps(ai_metadata)
        doc["ai_title"] = ai_metadata.get("suggested_title", "")[:200]
        doc["ai_description"] = ai_metadata.get("description", "")[:500]
        tags = ai_metadata.get("tags", [])
        doc["tags"] = ",".join(tags) if isinstance(tags, list) else str(tags)

    client.insert("prompt_versions", [doc])
    stats = client.get_collection_stats("prompt_versions")
    count = stats.get("row_count", 0) if stats else 0

    return {"version_number": count, "saved_at": now, "prompt_id": prompt_id}


def milvus_get_versions(prompt_id: Optional[str] = None) -> list:
    """Get saved versions from Zilliz, optionally filtered by prompt_id."""
    from milvus_client import get_milvus_client

    client = get_milvus_client()
    if not client or not client.client:
        return []

    filter_expr = f'prompt_id == "{prompt_id}"' if prompt_id else "id >= 0"
    results = client.client.query(
        collection_name="prompt_versions",
        filter=filter_expr,
        output_fields=["id", "prompt_id", "saved_at", "content"],
        limit=20,
    )
    return [
        {
            "id": r.get("id"),
            "prompt_id": r.get("prompt_id"),
            "saved_at": r.get("saved_at", ""),
            "content_preview": (r.get("content", "") or "")[:200],
        }
        for r in (results or [])
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# Lightweight convenience wrappers (called from routes)
# ═══════════════════════════════════════════════════════════════════════════════

def search_news(query: str, reasoning: bool = False, memory: str = "") -> str:
    """Search news using the LLM."""
    prompt = f"""Search for news about: {query}

Memory context: {memory[:500] if memory else "None"}

Please provide a summary of relevant news articles."""
    return query_llm(context="You are a news research assistant.", question=prompt, reasoning=reasoning)


def summarize_pdfs(files: List[Any], reasoning: bool = False) -> str:
    """Summarize PDFs using the LLM."""
    return "PDF summarization requires actual PDF processing. This feature will be implemented when PDF files are provided."


def retrieve_memory_context(query: str) -> str:
    """Retrieve memory context for a query."""
    return ""


def evaluate_source(url: str, title: str = "", content: str = "") -> Dict[str, Any]:
    """Evaluate a source using the LLM."""
    evaluation_prompt = (
        f"Evaluate the credibility and relevance of this source:\n\n"
        f"URL: {url}\n"
        f"Title: {title}\n"
        f"Content preview: {content[:500] if content else 'No content provided'}\n\n"
        "Provide: credibility score (0–1), relevance score (0–1), a brief summary, "
        "and a recommendation (use / use_with_caution / avoid)."
    )
    evaluation_text = query_llm(
        context="You are a source credibility evaluator.",
        question=evaluation_prompt,
    )
    return {
        "credibility": 0.8,
        "relevance": 0.7,
        "summary": f"Evaluation of {url}",
        "recommendation": "use_with_caution",
        "full_evaluation": evaluation_text,
    }


def load_logs_to_vectorstore() -> None:
    """Placeholder — called at startup from main.py."""
    pass
