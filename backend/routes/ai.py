"""Auto-extracted route module from main.py — zero behavior change."""
import asyncio
import json
import os
import time
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

import services as state
from deps import (
    A2UI_CATALOG_ID,
    a2ui_catalog,
    a2ui_catalog_id,
    get_user_id_from_header,
    user_is_admin,
    a2ui_catalog_for,
    validate_a2ui_components,
)
from grace_gui import (
    LAST_USAGE,
    milvus_get_versions,
    milvus_save_version,
    query_llm,
)
from role_caps import get_filtered_manifest, get_role_capabilities, get_user_role
from tools import ToolError, categories, get_tool, list_tools, render_tools_block

router = APIRouter()

# The prompt block listing the tools is built by render_tools_block() at each
# assembly rather than cached here, so a tool added on screen is offered on the
# very next call instead of after a restart. If the table cannot be read the
# block is empty and the assembly continues — the failure shows on the tools
# screen, not on every prompt.


# ── THE MENU IS THE PLACE, AND THE SERVER WRITES IT ─────────────────────────────
#
# A rail's buttons say what THIS place has. A package offers its own tools, runs
# and evals; the console is the one global seat, and only it offers APPROVALS — the issues
# that span every package. The prompts ask the model for this list and the model drops it:
# measured 2026-09-18 in the running app, a fresh composer's rail drew all EIGHT buttons,
# including the console's Approvals.
#
# So the list is written HERE, onto the components the model returned — for the same reason
# the console's repair rows are composed here: a list like this is not something to be
# paraphrased by a model. The surfaces still decide; the model no longer does.
#
# 2026-09-18, the owner: "remove runs, evals, states and trace from the console chat vertical
# menu… add the repair dropdown and show all repairs." So the console's rail is this seat's
# own four — Chat, Evals, Tools, Approvals — plus REPAIRS, the one item only this seat can
# show: a finding belongs to the catalog, not to a package (the same reason Approvals is here
# and nowhere else). Trace, Runs and Evals leave this menu and stay where they mean something:
# a record of a RUN, which is a package's business.
PACKAGE_TABS = "chat,trace,tools,executions,eval,settings"
# REPAIRS LEFT THIS MENU on the owner's instruction, 2026-09-19: "remove the repairs from
# the tab — repairs live under the approvals." The findings VIEW still draws for the console
# (the repair-view below), but under Approvals, where a finding about the whole catalog
# belongs; the chat tab is the conversation and nothing else.
#
# `settings` joined both lists on the owner's instruction, 2026-09-19: "I'm missing my
# configuration icon." It was DRAWN but filtered out of every seat, because a rail tab only
# draws when the seat's list names it — the pinned foot button was in the rail's TABS and in
# no seat's menu, which is exactly the silent drop the rail's own note warns about ("a typo
# on the server is not an error anywhere — it is a button that quietly is not there"). The
# button is drawn unwired (see chat-navigation-bar: TODO(behavior), node 40001119:6600).
CONSOLE_TABS = "chat,eval,tools,approvals,settings"

# THE DESIGN ROOM'S RAIL. The model's own list for this seat plus the one button without which
# the check view cannot be reached: "repair". `chat-panel` draws the checker's findings in its
# "view" hole only on the tabs that hole is drawn for, and maps BOTH `repair` and `approvals` to
# `chat-repair-actions` (`_wantedViewTag`) — while the rail only draws a button for a tab the
# seat's list names ("a typo on the server is not an error anywhere — it is a button that quietly
# is not there"). So the list is stated here rather than left to the model: an answer that omits
# the tab would leave the check row in the tree and unreachable on screen, which is the hole this
# constant closes. `trace` stays because Design's seat is given a trace view; `approvals` does
# not, because approvals are the console's job.
DESIGN_TABS = "chat,trace,tools,executions,eval,repair,settings"


# ── WHO SHE IS IN EACH ROOM, STATED BY THE ROOM ───────────────────────────────────────────────
# THE OWNER, 2026-10-01: *"There are no fallbacks in the system."* Until this, only the design room
# supplied her words; the composer and the console were handed a script that lived in the CLIENT
# seat (`chat-panel._graceInstructions`), which meant any room that supplied nothing borrowed the
# COMPOSER's voice — and the design room did exactly that, introducing itself on the live site as
# *"your prompt engineer… deciding what goes in each section"* (owner: *"seems fake — did she say
# this?"*). A fallback does not fail, it ANSWERS, plausibly and wrongly, and the person cannot see
# the substitution happen. So each room states its own script here, the client's copy is gone, and a
# room that states nothing gets a defect in the thread instead of somebody else's voice.
#
# THESE ARE THE COMPOSER'S OWN WORDS, moved here verbatim (11,562 characters of them — the seven
# flow steps, how she writes to a person, the tool-name rules, the memory commands). They were
# written for this room and this room now holds them; the seat appends the LIVE workspace at the end
# of whichever script it is handed, because only the client has the person's unsaved edits.
COMPOSER_GRACE_INSTRUCTIONS = """\
You are Grace, the Agentic Flow Architect. You help users build multi-step agentic prompt pipelines. Each prompt entry field in the workspace represents a STEP in an agentic flow — they are not arbitrary text boxes. Your job is to map the user's ideas onto the correct steps in the flow.

HOW YOU WRITE TO A PERSON — they read every character you type:
1. Plain sentences. No headings and no number-sign characters, no asterisks or underscores for weight, no tables, no bullet stars, no backticks or code fences, no lines of dashes or equals signs.
2. Short. Say it the way you would say it out loud, then stop.
3. One sentence on which step you chose and where the content went.
4. When you had to decide something the user did not tell you, name the decision in one short sentence so they can change it.
5. Never write out the choices of a button, and never ask the user to reply with a word. The buttons are the ask.

AGENTIC FLOW STEPS — choose from these seven; do not invent new ones:
1. System Role — <update_agent> — the AI's identity, expertise and behavioural rules.
2. User Role — <update_user> — the user's request, task or query template.
3. Agent Role — <update_agent_role> — what THIS agent is and does.
4. Tool Call — <update_tool> — functions, APIs or tools the agent can invoke.

THE TOOL CALL STEP IS THE ONE YOU MAY NOT INVENT. Every other step is words you can
write from what the user told you. A tool call has to name something that EXISTS, and
the list of what exists is at the bottom of this message under TOOLS AVAILABLE. Use a
name from that list and no other. If nothing in it fits what the user asked for, say so
in one sentence and offer the closest thing — do not make a name up, because a prompt
naming a tool that does not exist is a flow that cannot run.

HOW A TOOL GOES IN. Not as prose, and not as <update_tool> — a tool has to go in the way
the seat's own Tools menu puts it in, which is its name on a line and then the tool's own
words under it. One tag does that, and the words come from the register:

<insert_tool>the-tools-name</insert_tool>

A button does the same thing, which is what to use when you are offering a choice:

[one or two words](action:write-tool:the-tools-name)

AND A TOOL LIVES IN THE TOOL CALL STEP, NEVER INSIDE ANOTHER STEP. Not appended to the
Agent Role, not written into the User Role, not pasted into whoever uses it: the Tool Call
step is the one place the flow reads a tool from and the one place it is drawn at. Measured
2026-09-23, on a prompt whose tool had been written into the Agent Role seat beside the
identity that uses it — the run fired no call and the drawing reported "the prompt names no
tool" over a prompt that named one, because the step that owns tools was empty.

WHEN A PROMPT NEEDS A TOOL AND NONE IS NAMED, ASK — DO NOT PICK. This is the step a person
has to choose, because a tool is what the flow is allowed to reach for. Offer the names
that fit as buttons, one per tool, and let them press one. Offering to "add a search tool"
and then not naming one is the answer that leaves them stuck: the button is the ask, so the
button has to carry the name.
5. Few Shot — <update_few_shot> — examples of the input and the output wanted.
6. Context — <update_context> — background, domain knowledge, reference material.
7. Constraints — <update_constraints> — hard rules the agent must never violate.

HOW YOU WORK:
1. ANALYZE the user's intent. MAP it to ONE of the seven steps above.
2. STATE your choice in ONE sentence.
3. EMIT the tag IMMEDIATELY — same message, right after your sentence. Write the content INSIDE the tag.
4. SUGGEST which step to fill next. Stay within the seven steps above.
5. USER has veto — if they say move it to a different step, do it.

CONFIRMATION BUTTONS
EVERY REPLY THAT PROPOSES SOMETHING ENDS WITH THESE TWO. If you ask the user anything,
suggest anything, or say what you would do next — anything that leaves them a choice —
the last line of your reply is exactly this, on its own line:

[Confirm](action:confirm) [Not now](action:not-now)

A suggestion is a question. "Next, I'd fill the System Role" is you proposing something
and waiting for an answer, whether or not it has a question mark — and without the two
buttons the user has to type a sentence to say yes or no to something you offered.
Offer it with buttons and it is one press.

That line IS the ask; do not also print the options underneath it. The words are
fixed: "Confirm" and "Not now". Not "Refuse", not "Cancel", not "Yes"/"No" — the
panel promises two answers, and a reply offering three, or different ones, breaks that.

The one exception: when you have already offered your own buttons (a set of things to
write into a prompt), those ARE the answers and this line would be a second question
stacked on the first — leave it off there.

A reply that only reports or explains, and proposes nothing, gets no buttons.

Never proceed with a destructive or irreversible action (save, clear, delete) without explicit user confirmation.

WHAT [confirm] MEANS — AND IT CREDITS THE PERSON
When the user answers with [confirm], they are saying yes to the ONE thing you proposed
in your previous message. Do it, now, in that same reply: write the step, then say in a
sentence what changed. Do not acknowledge and wait — "Great, I'll do that" and then
stopping is the most annoying answer this panel can give, because they already said yes.

AND THEN MOVE THE WORK FORWARD. A prompt is built step by step, and a confirmed step
leaves a next one. Work out what the next one is from where the prompt now stands, say
it in a sentence, and offer THAT. If they told you the task is searching the internet
and you have just placed it, the next step is the thing that does the searching — a
tool call that reaches out, or the skill that defines it. Name the concrete next thing
for THIS prompt, not the next row in a list.

When the user answers with [not-now], they are declining that one thing. Do not do it,
do not ask again, and do not offer it a different way. Ask what they would rather do,
or move to something else that is genuinely next — whichever the prompt calls for.

WHERE YOU ARE, AND WHAT YOU MAY DO THERE — this is the first thing to know:
  ON THE CONSOLE (the library) you are an INDEX. Nothing is open, there are no seats to write
  into, and your work is organisation: finding, filtering and sorting the packages they have
  built. What you have there is the library's own controls, and nothing else:
      <reassemble-console sort="recent|name|version" filter="words to match"/>
  It redraws the list sorted and filtered to what the person asked for — use it whenever they
  say "show me", "just the ones about", "newest first". Open a package by naming it when they
  ask for it; do not read one out loud on your own.
  IN A PACKAGE you are the builder: the seats, the tools, the description, the repairs below.

# CONTROL SURFACE (XML COMMAND TAGS)
WRITE TO STEPS:
<update_agent>text</update_agent>
<update_user>text</update_user>
<update_agent_role>text</update_agent_role>
<update_tool>text</update_tool>
<update_few_shot>text</update_few_shot>
<update_context>text</update_context>
<update_constraints>text</update_constraints>
A TOOL, BY NAME — inserts the tool the way the Tools menu does, name and words:
<insert_tool>the-tools-name</insert_tool>
TAKING A ROW OUT OF THE PROMPT — name it exactly as it is written in the prompt:
<remove_role name="The row's name"/>

THE ROWS ARE THE SCHEMATIC. Every row you write becomes a node in the drawing, and the order
they sit in is the order they run in. So the shape of the picture is not something you
describe to the person — it is what your writes make.

TWO ROWS FOR ONE STEP IS THE MISTAKE THIS IS FOR. A prompt with an "Agent Role" row and
another row called "agent_role" draws two agent nodes and sends two agent roles to the model,
and it happens because a person typed one and the menu made the other. THE MISTAKE IS THEIRS
TO MAKE — never refuse it, never say a person may not have two, and never tell them what they
typed is wrong. Say what you see in one sentence, and offer the repair as a button:

THESE ARE THE REPAIRS, AND THEIR EXACT NAMES. A button whose action is not on this list is a
button that does nothing — the app says so to the person, and the fix you offered does not
happen. Do not invent an action name; if the repair you want is not here, offer the closest
one that is, or ask the person to make the change themselves.

  [Combine the two Agent Roles](action:merge-seat:agent_role|Agent Role)
      one row's words into the other, and the emptied row goes. Moved, not retyped.
  [Move tool to Tool Call step](action:move-tool:search-the-internet|Tool Call)
      the tool's own block travels, wherever it sits now to wherever it is wanted.
  [Replace the Agent Role text](action:set-seat:Agent Role|the replacement words)
      THE ROW BECOMES these words. Use this to clear placeholder text or stray lines —
      it replaces, where write-seat adds. The words you write are the words that stay.
  [Remove the stray row](action:remove-seat:agent_role)
      takes the row out of the prompt. ASK FIRST — a person may want two roles.

And the same repairs as tags: <merge_role from="X" into="Y"/>, <move_tool name="X" into="Y"/>,
<set_seat name="X">the replacement words</set_seat>, <remove_role name="X"/>.

ASK BEFORE YOU REMOVE ANYTHING, and if they say they wanted two roles, leave both alone and
carry on: helping them see it is the whole job, not tidying them up.
THE PACKAGE'S NAME:
<set_title>text</set_title> — name this package. The title is the package's own name, shown
in the bar above the prompt; ask the user for it rather than inventing one, and write it
once they have said it.
THE PACKAGE'S DESCRIPTION:
<set_description>text</set_description> — one line saying what this package is for, shown on
its card in the library. A name and a description are both required before a Run is allowed,
so when a package has none, offer to add one.
AND THE PACKAGE HAS TO BE SAVED BEFORE IT CAN RUN — and a description is written AT SAVE, so a
package that has never been saved cannot be described yet. That is the order things happen in:
save first, then the description has somewhere to live. When somebody has built something and
not saved it, SAY SO AND ASK — this is on the requirements list as a blocker for a Run, and you
are the one who tells them. They can play on without saving, and that is allowed: nothing
refuses them, and you should not nag. Say the true thing once — that a Run is what needs it
saved — and let them decide. NEVER save without being asked; a save makes a package that did
not exist, in a library they have to look at later.
AND IF YOU OFFER THAT DESCRIPTION AS A BUTTON, THE BUTTON CARRIES REAL WORDS. The value after the
separator IS the description that gets written: [Add description](action:set-description|one line
saying what this package is for) writes that sentence, word for word, onto their card. So either
draft one line you would stand behind and put THAT in the button — or ask them what the package is
for and write what they say. A button carrying an instruction to itself ("Add a short description")
describes their package as an instruction, and the person has no way to see it happened.
MEMORY COMMANDS:
<save/>
<get_versions/>
<load_version>N</load_version>
DESTRUCTIVE:
<clear_all/> — ONLY if user says "clear", "reset", "wipe", or "nuke". MUST ask for confirmation with buttons first.


YOUR IDENTITY
You are a PROMPT ENGINEERING EXPERT. This is not optional.
Every user who interacts with you expects you to be better at
prompt engineering than they are. They come to you for
expertise, guidance, and correction — not just execution.

Your responsibilities:
- The user provides objectives and ideas. YOU build the prompt.
- YOU decide which content goes in which section. The user may
  not know the difference between System Role, User Role, Context,
  Constraints, Few Shot, or Tool Call. YOU do.
- If the user puts content in the wrong section, CORRECT it.
  Move it to the right section without being asked.
- If sections are empty that should be filled, FILL them.
  Don't wait for the user to say "add to Constraints" — if
  you see what constraints should exist, ADD them.
- If the user's prompt is weak, SAY so — and explain why.
  Then offer to fix it, or just fix it.
- Be direct. Don't hedge. Don't say "you might want to."
  Say "This constraint is too loose. I'm tightening it."
- The user is NOT a prompt engineer. They have domain
  knowledge but may not know how to structure it. YOU bridge
  that gap. You translate their ideas into engineering.


YOUR WORKSPACE INTERFACE
You have FULL control over the left column prompt sections.
Use these XML tags to WRITE content — do not describe what should
go there, WRITE it there immediately:

<update_agent>TEXT</update_agent> — Write to the System Role section
<update_user>TEXT</update_user> — Write to the User Role section
<update_agent_role>TEXT</update_agent_role> — Write to the Agent Role section
<update_tool>TEXT</update_tool> — Write to the Tool Call section
<update_few_shot>TEXT</update_few_shot> — Write to the Few Shot section
<update_context>TEXT</update_context> — Write to the Context section
<update_constraints>TEXT</update_constraints> — Write to the Constraints section
<add_role name="NAME">CONTENT</add_role> — Create a new custom section
<remove_role name="NAME"/> — Delete ANY section by name, including the built-in System Role, User Role and Agent Role
<run_prompt/> — Trigger prompt execution
<switch_tab>trace|variables|chat</switch_tab> — Navigate right-column tabs
<save/> — Save the current prompt
<reassemble-console sort="category|title"/> — Sort console cards
<reassemble-console filter="Design System"/> — Filter console by category


LEXICAL EDITOR (Third Column Tool)
You can open a full rich-text editor in the third column.
Use these tags to launch and control it:

<load_tool name="lexical-editor"/> — Launch the editor
<close_tool/> — Close editor, return to output view

WHICH SECTION A TAG WRITES, AND WHAT MUST NOT GO IN A PROMPT
Each tag above writes ONE seat of the left-column prompt, and the seat is
found by its name. One seat answers to several spellings: System Role and
System, User Role and User, Agent Role and Agent, Tool Call both ways.
A repair prompt — the one the app assembles when a finding is repaired — has
four seats, named System, User, Tool Call and Agent. Context, Few Shot and
Constraints are not in it, so a tag for one of those has nowhere to land, and
the column reports that rather than changing in silence.
Never write an instruction, a question, or a list of possible answers into a
prompt. A prompt is the text the model reads: a question you put in it is
answered by the model, not by the person, who never opens that box. Everything
you have to say TO the person — what is still missing, what you are about to
do, a choice you need — goes in your reply, with buttons. When the app's own
prompt is waiting on a person it already names the value it wants on the
field's own label; your sentence is what asks for it, and when they answer,
you write it in.

Once the editor is open, control it with these tags.
ALWAYS use the self-closing attribute form:

<set_content content="TEXT"/> — Replace all editor content
<insert_text text="TEXT"/> — Insert at cursor position
<append_text text="TEXT"/> — Append to end of document
<format_text type="bold|italic|underline|strikethrough|code"/> — Inline formatting
<format_block type="h1|h2|h3|paragraph|quote|code|ul|ol|checklist"/> — Block type
<format_align type="left|center|right|justify"/> — Alignment
<format_font family="Inter" size="16px"/> — Font changes
<clear_formating/> — Remove formatting from selection
<insert_table rows="3" cols="3"/> — Insert a table
<insert_link url="https://..." text="label"/> — Insert hyperlink
<insert_horizontal_rule/> — Divider line
<insert_code_block language="typescript"/> — Code block
<undo/> — Undo last edit
<redo/> — Redo last undone edit
<toggle_code_view/> — Switch between rich text and code view
<toggle_lock/> — Lock/unlock editor (read-only mode)
<export format="markdown|html|text"/> — Export document
<check_writing/> — Run grammar and style check


COMPONENT CATALOG (Storybook)
All available UI components are documented in Storybook.
Browse the A2UI Components section to find:
- Surface Container: AI-controllable output rendering
- Lexical Editor: 24-command rich text editor
- Tag Catalog: All 40 registered XML tags with schemas
- Status Indicator: Lit-based status component
The Tag Catalog shows every tag the AI can emit — with
surface (composer/console), column, and constraints.
ALWAYS consult the catalog before emitting tags.

IMPORTANT: When you know what belongs in a section,
immediately emit the appropriate XML tag. Do NOT describe it.
Do NOT ask permission. You are the expert — ACT like it.


OPTIMIZATION ADVISOR
After reviewing the user's prompt, if you see ways to improve it —
clearer instructions, better constraints, missing context, stronger
examples, tighter guardrails — TELL the user. Be specific.
If the prompt already looks excellent, say so — don't invent problems.


HOW YOU WRITE TO A PERSON (the chat panel draws your words as plain text)
1. Plain sentences. No headings and no number-sign characters, no asterisks
   or underscores for weight, no tables, no bullet stars, no backticks or
   code fences, no lines of dashes or equals signs.
2. Short. Say it the way you would say it out loud, then stop.
3. When you had to decide something the user did not tell you, name the
   decision in one short sentence so they can change it. Never label it,
   never explain how you know, never describe your reasoning. A value you
   did not get from the user is your own choice, and saying what you chose
   is the whole of it.
4. Never write out the choices of a button, and never ask the user to reply
   with a word. The buttons are the ask.


WHEN YOU HAVE ADVICE TO OFFER
Put these three on the last line, once, and only when the user can actually
take or leave what you said:

[Accept Advice](action:accept_advice)
[Reject Advice](action:reject_advice)
[Explain More](action:explain_more)
"""

# THE CONSOLE IS THE LIBRARY, AND SHE IS A PROMPT ENGINEER IN IT (owner, 2026-10-01: *"She's a
# prompt engineer on the console"*). What her console greeting already did — find, filter, sort,
# advise on the packages — is what this states, so the room stops being described by a script
# written for a different one.
CONSOLE_GRACE_INSTRUCTIONS = """\
You are Grace, the prompt engineer. The console is the index of every prompt package this person
has built — one card per package, with its name and what it does — and you advise on the prompts
in it: what each one says, what is loose, what is missing, which to work on next.

You do not write into a prompt from this room. Work on a prompt happens in the Composer, one
package at a time, and this room is how the person finds it.
"""


def _seat_tabs(components: list, tabs: str) -> None:
    """Set every chat seat's allowed-tabs. Idempotent, and it never adds a component."""
    for c in components:
        if isinstance(c, dict) and c.get("component") == "chat-panel":
            c["allowedTabs"] = tabs


def _seat_grace(components: list, base: str, live_context: bool) -> None:
    """Bind every chat seat in this surface to THIS ROOM's script — idempotent, never adds one.

    WHO SHE IS IS THE ROOM'S FACT. The words themselves live in the data model at
    `{base}/grace_instructions`, assembled by the room that is assembling (`CONSOLE_GRACE_INSTRUCTIONS`,
    `COMPOSER_GRACE_INSTRUCTIONS`, the design room's own database-backed script); this writes the
    binding, and the live-context flag with it.

    WHY THE ASSEMBLY WRITES THE BINDING RATHER THAN ASKING THE MODEL FOR IT. The contract prompts do
    tell the model to bind `instructions`, and for the design room that is how the script reached her
    seat — measured 2026-10-01 on the live `render-design` surface, where the binding was present only
    because the answer happened to reproduce the line. A room whose identity depends on a model
    remembering to include a line is a room that changes voice the day the model forgets, and the
    owner's rule is that a stated fact reaches the thing that needs it or the system says so.

    THE FLAG IS THE ROOM'S OWN ANSWER TO "DOES HER LIVE CONTEXT FOLLOW THE WORDS". The composer's and
    the console's scripts are identities — what she is in the room — so the seat's live workspace (the
    package, its seats, the tool register, the console's cards) is appended by the seat from the values
    the room bound. Design's script is composed WITH its live facts already in it, from the database,
    so nothing follows it. A literal here, not a bound path: it is the room's decision, like
    `tracePrompt` and `allowedTabs` beside it, and not a value any model produces.
    """
    for c in components:
        if isinstance(c, dict) and c.get("component") == "chat-panel":
            c["instructions"] = {"path": f"{base}/grace_instructions"}
            c["graceLiveContext"] = live_context


def _design_surface_components() -> list[dict[str, Any]]:
    """The Design room's frame — AUTHORED here, not taken from a model's answer.

    WHY THIS IS AUTHORED AND NOT DERIVED. The Design experience wore the Composer's container and
    got its tree by SUBTRACTING from the Composer's: `render-design` took the model's Composer
    tree and filtered out `control-bar`. Measured on screen 2026-09-30, with the ingest injected
    into the same slots, that left EVERY PANE HOLDING TWO THINGS and the second one off the
    bottom of the room:

        left   | prompt-section-editor, then the injected rail | panel ended y=382;
                 the rail started at 382 and ran 1672px, past a 664px-tall room
        middle | the injected Preview                         | y=75, h=207
        right  | chat-panel, then the ingest's Grace column   | the panel spanned 56→720
                 with Grace's column starting at 720 — off-screen

    The slot assignment was correct the whole time; the tree was wrong. A frame built by
    subtraction still carries the Composer's content, and content the Composer owns is not a fact
    about Design. (The same mistake is why "remove control-bar and seed no sections" was not
    enough earlier: `prompt-section-editor` draws System/User/Agent as ITS OWN defaults, so an
    empty list still painted three roles. Absence is the only thing that removes a component.)

    SO DESIGN'S FRAME IS A CONTRACT WRITTEN DOWN, which is also what the owner asked for —
    *"the same architectural structure that we currently use for composer"*, with the ingest
    ported in: *"you don't replace, you inject."* A fixed frame does not need a model to guess it,
    and a guess is exactly what made each pane hold two things. The container is the Composer's
    element, unmodified, so its behaviour is the Composer's by construction.

    WHAT THE PANES ARE FOR — THE INJECTION, NOT THIS TREE:

      left   (slot="left")    the ingest's rail, which arrives afterwards as a React portal
      middle (nothing loose)  the ingest's Preview, seated INSIDE `design-middle-container`
      right  (slot="right")   the ingest's Grace column

    The two panes therefore name NO child here. Their content is not a component the server
    assembles: it is the tool, injected after this container has rendered — *"the assembly
    happens. The render of this container happens and then the injection happens. It's in an
    order."* A tree that named something for those slots is the bug this function removes.

    WHAT IS DELIBERATELY NOT HERE, and each one is a component the Composer's tree carried:
    `prompt-section-editor` (the Composer's panel, and it has no `<slot>`, so its contents can
    never be anything but the Composer's), `compiled-output-viewer` (no slot either — that is why
    Design has `design-middle-container`), `chat-panel` (Design's Grace is the ingest's own
    column, which answers about what the left column is doing), and `control-bar` (undo, Save
    Template, RUN — Design runs nothing).

    THE MIDDLE COLUMN IS EMITTED, and it is the one element here that is Design's own:
    `design-middle-container` is the Composer's middle column WITH A HOLE (`<slot name="middle">`),
    and it is in `design-artifacts` and not in the Composer's catalogue, so no Composer surface
    can name it. It has to exist before the Preview can be seated inside it, which is why it is
    part of the frame rather than part of the injection.
    """
    return [
        {
            "id": "root",
            "component": "workspace-layout",
            # STATED, NOT LEFT OUT. A prop an assembly omits is not reset: the renderer re-assigns
            # what the tree carries and the element keeps everything else. The console — and a
            # Run's flow view — sets `isThirdOpen: false`, so a design tree that said nothing
            # would inherit a CLOSED column. Measured on the Composer 2026-09-18, the owner: "I'm
            # not sure why the chat's loading collapsed."
            "isThirdOpen": True,
            # THE PANES ARE NAMED SLOTS, so children is an OBJECT keyed by slot name — the array
            # form carries no slot and fills nothing. Only two slots are named; see the note on
            # the panes above.
            "children": {"left-header": "left-header", "middle": "design-middle"},
        },
        {
            "id": "left-header",
            "component": "left-column-header",
            # THE CATALOGUE, NOT "Design". The room's own name is in the page header and never
            # leaves it (the owner, 2026-09-30: *"I already know I'm in design because the header
            # at the top of the page tells me where I am"*), so this bar carries the catalogue you
            # are working in. That value arrives at /session/title from the resolved catalogue row
            # — one read, and the bar is not told a second time.
            "title": {"path": "/session/title"},
        },
        {
            "id": "design-middle",
            "component": "design-middle-container",
            # The header row's own drawn value — the design's example, as that element says of
            # its own `outputType`.
            "outputType": "Agent Flow",
        },
    ]


def _catalog_component_vocabulary() -> str:
    """The component list for a prompt, GENERATED from the catalog.

    Hand-typed lists drift, and this one had drifted badly: the prompts named
    three components while the catalog held thirty-five. The model was taught 8%
    of the design system and had no way to reach the rest — and because the same
    short list was maintained by hand in two separate prompts, it could only ever
    agree with the catalog by luck.

    Derived from the schema, the prompt and the validator cannot disagree: the
    model is never told about a component the server will reject, and never kept
    ignorant of one it will accept.

    Loud on an empty catalog rather than degrading to a shorter list. A prompt
    with no vocabulary invites invented components, and every invented component
    is a 503 at validation — a silent truncation here would turn a load failure
    into a stream of rejected surfaces.
    """
    components = (a2ui_catalog or {}).get("components") or {}
    if not components:
        raise RuntimeError(
            "A2UI catalog is empty — refusing to assemble a prompt with no component "
            "vocabulary. Every payload is validated against this catalog, so without it "
            "the model can only invent components that will be rejected with a 503."
        )

    lines: list[str] = []
    for name in sorted(components):
        spec = components[name] or {}
        props: list[str] = []
        # Properties live in the `allOf` branches (the component carries one or
        # more $refs), so walk those as well as the top level.
        for part in list(spec.get("allOf") or []) + [spec]:
            for prop, prop_spec in (part.get("properties") or {}).items():
                if prop == "component":
                    continue  # the discriminator, not an argument
                # A CONTAINER'S SLOTS COME FROM THE CATALOG TOO, and they did not until
                # 2026-09-23: the list named the `children` PROPERTY and nothing about the
                # slots inside it, so a prompt could only guess which names a container
                # fills by. The guess that was made — {flow, seat} for AgentCanvas, whose
                # element renders {header, flow, footer} and no seat at all — is the drift
                # the catalog check reported as blocking. The names are in the schema
                # (`children.properties`), so they are read from it here rather than
                # restated, and a container's slots can no longer be unknown to a prompt.
                if prop == "children" and isinstance(prop_spec, dict):
                    slots = list((prop_spec.get("properties") or {}).keys())
                    props.append(f"children {{{', '.join(slots)}}}" if slots else prop)
                    continue
                if prop not in props:
                    props.append(prop)
        lines.append(f"- {name}: {', '.join(props) if props else 'no properties'}")

    return f"COMPONENT CATALOG — all {len(components)} (only these; anything else is a 503):\n" + "\n".join(lines)

def _repair_rows(catalog: str = "prompt-composer") -> list[dict[str, Any]]:
    """
    The checker's open findings, as rows that arrive READY TO DRAW.

    `text` and `level` are composed HERE — not by the model, and not by the element that
    draws them. A row is a statement about the catalog, and a view that re-words it is a
    second author of it; the two would disagree the moment either changed. The source is
    the report the checker already wrote (frontend/catalog-audit/<catalog>.json), read
    through GET /api/catalog/audit's own reader. Nothing is inferred, merged or summarised.

    AN UNRUN CHECK IS NOT AN EMPTY LIST. When there is no readable report this returns
    one row that says so, because an empty list is the claim that the checker found
    nothing open — and a checker that never ran must never read as a clean catalog. That
    rule is the checker's own (`check-could-not-run` is blocking there), and it holds here.
    """
    from routes.misc import _read_catalog_audit

    try:
        audit = _read_catalog_audit(catalog)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        # THE FALLBACK HERE SAID THE CHECKER HAD BEEN REMOVED, AND THE CHECKER IS PRESENT. It runs
        # and writes a report; what is missing is a report for THIS pipeline, because the checker's
        # `CATALOG_NAME` names one and a deployed image builds only that one. `_read_catalog_audit`
        # carries the true remedy, so this is reached only if a detail arrives without one — and it
        # says the same thing rather than naming a deletion that never happened.
        remedy = detail.get("remedy") or (
            "No report has been produced for this pipeline; reports come from `npm run catalog:check`."
        )
        print(
            f"[A2UI Console] no catalog report for '{catalog}' — the repair list states that "
            f"rather than showing nothing. Remedy: {remedy}"
        )
        return [{
            "id": f"catalog-audit-unavailable:{catalog}",
            "text": f"The catalog check did not run, so there is nothing to repair from. Remedy: {remedy}",
            "level": "blocking",
        }]

    rows: list[dict[str, Any]] = []
    for f in audit.get("findings", []):
        if f.get("level") == "pass":
            continue
        subject = f.get("component") or f.get("file") or f.get("nodeId") or "catalog"
        where = f" ({f['nodeId']})" if f.get("nodeId") else ""
        rows.append({
            "id": f.get("id") or f"{f.get('check')}:{subject}",
            "text": f"{subject}{where} — {f.get('what', '')}",
            "level": f.get("level") or "advisory",
        })
    # Blocking first, then by id — the order the checker prints, so the list on screen
    # and the list in the report are read the same way.
    rows.sort(key=lambda r: (r["level"] != "blocking", str(r["id"])))
    return rows



def _activity_at_ms(at: Any) -> float:
    """An activity row's `at` as epoch milliseconds, for the trace feed's entry shape.

    The table hands it back as 'YYYY-MM-DDTHH:MM:SSZ' (see `_activity_from_db`) and the feed's
    entries carry `timestamp` as a NUMBER, so the conversion happens once, here. An unparseable
    value is 0 — the feed's own "unknown" — and never the current time, which would be a claim
    about when it happened that nothing measured.
    """
    from datetime import datetime, timezone

    if isinstance(at, (int, float)):
        return float(at)
    try:
        return (
            datetime.strptime(str(at), "%Y-%m-%dT%H:%M:%SZ")
            .replace(tzinfo=timezone.utc)
            .timestamp()
            * 1000
        )
    except Exception:
        return 0.0


def _extract_json_payload(response_text: str) -> Any:
    """Extract a JSON object/array from LLM output without relying on fenced-block parsing."""
    text = (response_text or "").strip()
    if not text:
        raise ValueError("empty response")

    if "```json" in text:
        text = text.split("```json", 1)[1]
    elif "```" in text:
        text = text.split("```", 1)[1]

    if "```" in text:
        text = text.split("```", 1)[0]

    text = text.strip()
    if not text:
        raise ValueError("empty JSON payload")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        decoder = json.JSONDecoder()
        for index, character in enumerate(text):
            if character not in "[{":
                continue
            try:
                value, _ = decoder.raw_decode(text[index:])
                return value
            except json.JSONDecodeError:
                continue
        raise


# Warnings collected while a handler runs, drained into that handler's response. One
# process-wide list on purpose: this server is single-process and every handler drains
# what it collected; a warning that lands in another handler's response is still SAID,
# which is the property that matters (nothing here is dropped silently).
_REQUEST_WARNINGS: list[str] = []


def _warn(message: str) -> None:
    """A DEGRADED RUN SAYS SO — print AND carry, never just print.

    The owner, 2026-09-18: "I need to know when there's a fallback; I need to know when
    there's error suppression — we need to report it in the console trace." Every `except`
    in this file that used to end in a `print` now records the failure here, and the
    handler it belongs to drains the list into its response (`warnings`) or its assembled
    model (`/warnings`); the frontend writes those into the trace (lib/trace-source
    subscribes to the app logger). A `print` alone is a failure nobody is told about —
    check:error-suppression counts what still swallows.
    """
    print(f"⚠️  {message}")
    _REQUEST_WARNINGS.append(message)


def _drain_warnings() -> list[str]:
    """Hand the warnings collected during THIS handler to its response, and reset."""
    out = list(_REQUEST_WARNINGS)
    _REQUEST_WARNINGS.clear()
    return out


def _compose_sections(sections: list[dict[str, Any]]) -> str:
    """Join a prompt's sections into one piece of text, in order, as written.

    This is what the output column holds when a Save carries no output at all:
    the sections themselves, labelled. It used to be whatever the save-time LLM
    wrote back inside its JSON envelope — a second, invented copy of text the row
    already had, and the field that pushed that reply past the token budget and
    left it unparseable (see the compile call in ai_save_surface).
    """
    parts: list[str] = []
    for s in sections or []:
        content = (s.get("content") or "").strip()
        if not content:
            continue
        name = s.get("section") or s.get("role") or "Section"
        parts.append(f"### {name}:\n{content}")
    return "\n\n".join(parts)


# ============================================
# AI MANIFEST ENDPOINT — P5 (2026-07-26)
# Serves the A2UI component catalog so the Python backend can inject it
# into the DeepSeek system prompt. Reads from frontend/dist/manifest.json.
# ============================================

@router.get("/api/ai/manifest")
async def ai_manifest(
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    Serve the AI playground component manifest for system prompt injection.

    FILTERED BY ROLE: The manifest is filtered by the user's departmental role
    (users.prompt_role). The AI literally cannot emit tags that aren't in its
    system prompt — role filtering happens here, before the LLM is called.

    See backend/role_caps.py and frontend/src/shared/role-caps.ts for the
    role-to-capability matrix.
    """
    uid = get_user_id_from_header(x_user_id)
    role = get_user_role(uid)

    manifest_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist", "manifest.json")
    alt_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "shared", "manifest.json")
    for path in [manifest_path, alt_path]:
        if os.path.exists(path):
            with open(path) as f:
                full_manifest = json.load(f)
            filtered = get_filtered_manifest(uid, full_manifest)
            return {
                "manifest": filtered["manifest"],
                "source": path,
                "role": role,
                "tabs": filtered["tabs"],
                "can_author": filtered["can_author"],
                "tag_count": filtered["tag_count"],
            }
    # No manifest file — return role-filtered tag list from role_caps
    caps = get_role_capabilities(role)
    return {
        "manifest": {},
        "source": "not found (role-filtered)",
        "role": role,
        "tabs": caps.get("tabs", ["chat"]),
        "allowed_tags": caps.get("allowed_tags", []),
        "can_author": caps.get("can_author", False),
    }

class AISurfaceContext(BaseModel):
    """Context from the current document state."""
    current_surface: str | None = None
    has_unsaved_changes: bool | None = False
    session_id: str | None = None
    session_title: str | None = None
    # THE RUN'S OWN IDS — see the render-run branch. A Run does not replace the surface;
    # it moves the third column, so the assembly has to land on the components that are
    # on screen: the layout's root and its other slots, and the component the layout
    # currently points at for the middle. A field the model does not declare is dropped
    # in silence, which is why this is written here and not only sent by the shell.
    run: dict | None = None


class AISurfaceRequest(BaseModel):
    """
    A2UI v0.9 Compliant Surface Assembly Request.

    Intents:
    - render-console: AI assembles console with cards
    - render-composer: AI assembles blank composer with greeting
    - render-session:{id}: AI assembles existing session
    - render-run[:{id}]: AI assembles the THIRD COLUMN a Run opens (the canvas)

    Context provides document state so AI can decide how to handle:
    - has_unsaved_changes: If true, AI should prompt user to save/discard
    """
    intent: str
    session_id: str | None = None  # For render-session intent
    context: AISurfaceContext | None = None  # Document state for AI decisions


@router.post("/api/ai/assemble-surface")
def ai_assemble_surface(
    request: AISurfaceRequest,
    # THE CEILING IS THE CONSOLE'S, NOT THE MODEL'S. It used to be 200 with a default of 10,
    # and the default was what a person actually got. The data model can carry a list this
    # size; the prompt no longer grows with it (see the console's sample).
    limit: int = Query(500, ge=1, le=1000),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    A2UI v0.9 Compliant Unified Surface Assembly.

    This is the SINGLE endpoint that controls ALL surface rendering.
    The AI is the Architect - it decides what to show.

    Response follows the A2UI v0.9 envelope structure — an array of
    protocol messages, each carrying exactly one operation key:
    [
        { "version": "v0.9.1", "createSurface": { "surfaceId": "main", "catalogId": "..." } },
        { "version": "v0.9.1", "updateComponents": { "surfaceId": "main", "components": [...] } },
        { "version": "v0.9.1", "updateDataModel": { "surfaceId": "main", "path": "/", "value": {...} } }
    ]
    """
    start_time = time.time()
    intent = request.intent
    context = request.context
    uid = get_user_id_from_header(x_user_id)

    # ═══════════════════════════════════════════════════════════════
    # A2UI v0.9: AI DECIDES HOW TO HANDLE UNSAVED CHANGES
    # If user is navigating away from composer with unsaved changes,
    # return a decision surface instead of the requested surface.
    # ═══════════════════════════════════════════════════════════════
    if context and context.has_unsaved_changes and context.current_surface == "composer":
        elapsed_ms = int((time.time() - start_time) * 1000)
        session_title = context.session_title or "Untitled"
        components = [
            {"id": "root", "component": "DecisionDialog", "children": ["message", "actions"]},
            {"id": "message", "component": "Text", "text": f"You have unsaved changes in \"{session_title}\"."},
            {"id": "actions", "component": "ActionGroup", "items": {"path": "/actions"}}
        ]
        validate_a2ui_components(components)
        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": A2UI_CATALOG_ID
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components
                }
            },
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "decision_type": "unsaved_changes",
                        "session_id": context.session_id,
                        "session_title": session_title,
                        "pending_intent": intent,  # What user wanted to do
                        "actions": [
                            {"id": "save", "label": "Save Changes", "variant": "primary"},
                            {"id": "discard", "label": "Discard Changes", "variant": "destructive"},
                            {"id": "cancel", "label": "Cancel", "variant": "secondary"}
                        ],
                        "ai_message": f"Hold on — you have unsaved work in \"{session_title}\". What would you like me to do?",
                        "assembly_time_ms": elapsed_ms
                    }
                }
            }
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: render-console
    # ═══════════════════════════════════════════════════════════════
    if intent == "render-console":
        if not state.prompt_sessions_api:
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: Database not available",
            )

        # ── THE CONSOLE'S OWN SESSION ──────────────────────────────────────────
        # The console chat binds the console's conversation — the one dashboard
        # conversation per user, created on first landing and enforced by
        # idx_prompt_sessions_console_per_user. Same get-or-create the shell's
        # /api/prompt-sessions/console serves, so there is ONE row, not two.
        #
        # NO FALLBACK. A2UI's seat rule (Core-Concept.md) requires a surface seat to
        # carry a conversation id and session id that are present and non-null, so a
        # console assembled without them is a surface whose chat cannot bind —
        # complete-looking output with a required piece missing. That is a 503 here,
        # like every other missing precondition in this branch.
        console_session = state.prompt_sessions_api.get_or_create_console_session(user_id=uid)
        if not console_session:
            raise HTTPException(
                status_code=503,
                detail=(
                    "A2UI FAILURE: the console session did not resolve (not created). "
                    "The console chat binds its conversation, so the surface cannot be "
                    "assembled without it."
                ),
            )
        console_session_id = str(console_session["id"])
        # ── THE CONSOLE'S CONVERSATION IS THE ONE IT ALREADY HAS ────────────────
        #
        # This used to call `open_console_conversation` on every landing, which INSERTS a row ("a
        # landing STARTS A VISIT"). The owner, 2026-09-23, having watched the console's list fill up
        # with threads nobody wrote in: "there's 23 conversations saved. I can't remove any of them.
        # There should not be any conversation saved unless the user saves it just on the console.
        # Just stop the conversations on the console." And, on what starts one: "there is no
        # conversation new until the user engages. The AI is not the conversation — it's a human
        # being that initiates the conversation."
        #
        # The count was in the database: 23 chat rows under the console session, 18 of them with
        # ZERO messages — one per visit, each one a place his history was not.
        #
        # SO A LANDING CREATES NOTHING AT ALL. It binds the conversation the console already owns
        # (the session row's own pointer — the one the chat writes into), or NOTHING, and nothing is
        # a true state: the seat's greeting is never written down (a turn the app asks for never
        # creates a conversation — see `person_turn` in routes/teacher.py), and the first thing the
        # PERSON says is what creates one. That is why this branch no longer refuses to bind an
        # empty id: with no conversation there is nothing to read, which is exactly what an
        # untouched console is.
        console_conversation_id = str(console_session.get("conversation_id") or "")
        if not console_conversation_id:
            print(
                f"[A2UI Console] {console_session_id[:8]}… has no conversation yet — the surface "
                f"binds none. One is created when the person speaks, not by looking."
            )

        # ── THE TABS' OWN CONVERSATIONS — one per process, under the same session ──
        #
        # Approvals is a different process from the chat: it reads what the inspection filed
        # and continues that thread. It hangs off the SAME console session
        # (conversations.tab — the column the schema always had), so a person returning to
        # Approvals lands exactly where that process left off, and the chat never carries its
        # noise. Created here so the binding always resolves; a failure is said, not hidden.
        approvals_conversation_id = ""
        try:
            approvals_conversation_id = state.prompt_sessions_api.get_or_create_console_tab_conversation(
                uid, "approvals"
            ) or ""
        except Exception as e:
            _warn(f"the approvals conversation could not be opened, so that tab has no seat of its own yet: {e}")

        # ── THE CONSOLE'S CONVERSATIONS — the Conversations dropdown's rows here ──
        #
        # Same ownership read the composer's seat uses (`conversations.session_id`),
        # pointed at the console's own package. Without it the console seat's dropdown —
        # the only conversation-reading control on the surface a person lands on —
        # carried nothing, so the console's own conversation could not be opened from
        # anywhere in the app.
        console_conversations = []
        if state.conversation_api:
            try:
                console_conversations = state.conversation_api.get_conversations_by_session(
                    console_session_id, uid
                )
            except Exception as e:
                _warn(f"the console's conversation list could not be read, so the console seat has none to offer: {e}")

        # ── PERFORMANCE TRACE: Milestone A (Database) ──
        t_a_start = time.perf_counter()

        # Fetch the FULL prompt package (not lightweight) so each console card is
        # a true index of its entire prompt — sections, output, versions, chat.
        sessions = state.prompt_sessions_api.get_sessions(
            user_id=uid,
            include_archived=False,
            limit=limit,
            offset=0,
            lightweight=False,
            exclude_drafts=True,  # unsigned composer drafts never litter the console
        )
        ms_a = (time.perf_counter() - t_a_start) * 1000

        # Initial console paint is DB-authoritative and does not block on model
        # inference. The A2UI contract remains intact: the surface still binds a
        # ConsoleCardGrid to /cards, but the card data comes straight from
        # PostgreSQL instead of waiting on an expensive reasoning model.
        # A card is a faithful read of its row. The title and description on the
        # card are the title and description in PostgreSQL, byte for byte. This
        # branch used to rewrite the title when the stored one looked like a
        # placeholder, and to synthesise a description from the first 180 chars
        # of section 1 when the row had none. Both were inventions attributed to
        # the user's own package: a card could carry text that appeared nowhere in
        # the database, and a row with no description could not be told apart from
        # one whose description the assembler had made up. Removed — an empty
        # description now renders as empty.
        cards = []
        for session in sessions:
            title = (session.get("title") or "").strip()
            description = (session.get("description") or "").strip()

            cards.append({
                "id": str(session.get("id")),
                "title": title,
                "description": description,
                "category": session.get("category") or "",
                "status": (session.get("status") or "Active").lower(),
                "version": session.get("current_version") or 1,
                "likes": session.get("likes") or 0,
                "model_name": session.get("model_name") or "",
                "team_name": session.get("team_name") or "",
                "avatar_url": session.get("avatar_url") or "",
                "category_color": session.get("category_color") or "",
                "category_title_color": session.get("category_title_color") or "",
                "category_text_color": session.get("category_text_color") or "",
                "username": session.get("author_name") or session.get("author_email") or "",
                "createdAt": session.get("created_at").isoformat() if session.get("created_at") else "",
                "lastUsed": session.get("last_accessed_at").isoformat() if session.get("last_accessed_at") else "",
                "message_count": session.get("version_count") or 0,
            })

        # ── TRUE A2UI: Model is the architect for the console surface ──
        # DB only supplies raw data. The model MUST return the components.
        # Hard-fail (503) if the model cannot assemble it. No DB skip, no fallbacks.
        # ── THE MODEL SEES A SAMPLE; THE GRID GETS EVERYTHING ──────────────────────
        #
        # The cards were dumped into the prompt whole, which meant the number of packages a
        # person could SEE was decided by what the model could be asked to read: the request's
        # limit, and the limit defaulted to TEN. The owner, looking at a console with 265
        # packages in it: "I don't see the pagination… you have a max count of 10 still in
        # place and I know there's more cards than 10."
        #
        # The model does not need every row — it needs to know the list exists, how big it is,
        # and what a card looks like, because it binds ConsoleCardGrid to /cards and the DATA
        # MODEL carries the list. So the prompt takes a sample and the count; the data model
        # takes everything the request asked for.
        SAMPLE = 12
        cards_for_prompt = json.dumps(cards[:SAMPLE])
        llm_prompt = f"""You are Grace, the A2UI surface assembler for the console.
{render_tools_block()}

The user opened the Console. There are {len(cards)} prompt packages. The first
{min(SAMPLE, len(cards))} are shown below as examples of the card shape; bind the grid to the
whole list at the path below, NOT to these samples.

Card data (bind ConsoleCardGrid to this):
{cards_for_prompt}

Assemble the FULL console surface using A2UI v0.9.1.

{_catalog_component_vocabulary()}

REQUIREMENTS:
1. id "root", component "workspace-layout" — the composer's own container. Its
   panes are NAMED slots, so "children" is an OBJECT keyed by slot name; the
   array form fills nothing.
2. "card-grid": ConsoleCardGrid in slot "left", items bound to {{"path": "/cards"}}
3. "console-chat": "chat-panel" in slot "right", bound to the console's own
   conversation: conversationId {{"path": "/console/conversation_id"}},
   sessionId {{"path": "/console/session_id"}}. There is no middle slot.
4. "isThirdOpen": false — the chat column loads CLOSED. This is the container's
   own state and it owns the column's width, so it is the only flag needed: at
   false the right pane sits at its designed 60px collapsed floor with the rail
   showing, and the container tells the panel it is collapsed so the rail's Chat
   button OPENS it on the first click. Do NOT send "collapsed" or "rightWidth" on
   the panel or the container — a payload flag is re-asserted on every assembly
   and would snap the column shut again after the operator opened it, and a pinned
   width jumped the column from 75px to half the screen. Open or closed belongs to
   the element that owns the width.
5. "console-chat" carries ONE child in its "view" slot: "repair-view". The panel's
   "view" slot is the design's ONE content hole ("chat-output-simple-slot-area"
   #40001085:2373, annotated "holds plain text output and inserted functions") and
   this seat fills it with the one view the console has.
   "repair-view" is "chat-repair-actions" bound to /findings. The repair rows are
   composed by the BACKEND from the report the catalog checker already wrote, and
   written into the data model there — the same reason: a list of what is wrong in
   the catalog is not something to be paraphrased by a model.
   It arrives COLLAPSED — the element's own default, and the owner's rule for the demo he is
   building: "I don't want blank chat to open up, so add it to the chat as well… just make
   sure it's collapsed by default." The panel draws this one view above her THREAD on the
   Chat tab as well as in the hole the rail's tabs use, so the console never opens on a blank
   chat; collapsed it is a header with a count on it, and opening it is one click.
   There is no "trace-view" in this assembly any more: Trace left this menu on the same
   instruction, and a view with no rail button would be a hole nothing can reach.
6. "console-chat" carries "allowedTabs": "chat,eval,tools,approvals,settings".
   THE MENU IS THE PLACE: the console is the ONE global seat, so it is the only one that
   offers APPROVALS — the issues that span every package — and the only one that offers
   REPAIRS, the findings of the catalog check. A package's seat omits both: a package can
   only approve, and only repair, what belongs to it. Emit the list exactly as written;
   an omitted allowedTabs shows every button the rail has.
7. Short friendly ai_message

Emit nothing else — no greeting, no header, no Text above them.

Output ONLY this exact JSON (no markdown, no extra text):
{{
  "components": [
    {{"id": "root", "component": "workspace-layout", "isThirdOpen": false, "children": {{"left": "card-grid", "right": "console-chat"}}}},
    {{"id": "card-grid", "component": "ConsoleCardGrid", "items": {{"path": "/cards"}}}},
    {{"id": "console-chat", "component": "chat-panel", "tracePrompt": false, "allowedTabs": "chat,eval,tools,approvals,settings", "conversationId": {{"path": "/console/conversation_id"}}, "conversations": {{"path": "/console/conversations"}}, "sessionId": {{"path": "/console/session_id"}}, "children": {{"view": "repair-view"}}}},
    {{"id": "repair-view", "component": "chat-repair-actions", "findings": {{"path": "/findings"}}, "stages": {{"path": "/repairs/stages"}}}}
  ],
  "ai_message": "Your message"
}}
"""

        ms_b = 0.0
        ms_c = 0.0
        t_b_start = time.perf_counter()
        llm_response = query_llm(
            question=llm_prompt,
            mode="console_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-console"
            # model intentionally omitted — use the enabled provider's default
        )
        ms_b = (time.perf_counter() - t_b_start) * 1000

        if not llm_response or not llm_response.strip():
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface."
            )
        if llm_response.strip().startswith("Error:"):
            raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

        t_c_start = time.perf_counter()
        response_text = llm_response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            # The console is the ONE global seat: the only one that offers approvals.
            _seat_tabs(components, CONSOLE_TABS)
            # AND HER WORDS, WHICH ARE THIS ROOM'S. The console is where she advises on the packages
            # in the index — see `CONSOLE_GRACE_INSTRUCTIONS`, and the console's cards below, which
            # the seat appends as her live context.
            _seat_grace(components, "/console", True)
            # The console is the ONE global seat, so it is the one that offers approvals.
            ai_message = parsed.get("ai_message", f"{len(cards)} packages ready.")
            if not isinstance(components, list) or len(components) == 0:
                raise ValueError("components must be non-empty array")
            ms_c = (time.perf_counter() - t_c_start) * 1000
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(
                f"[A2UI Console] AI RESPONSE PARSE FAILED:\n"
                f"  error_type: {type(e).__name__}\n"
                f"  error_message: {e}\n"
                f"  llm_response_length: {len(response_text)}\n"
                f"  llm_response_first_500: {response_text[:500]}\n"
                f"  timestamp: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}\n"
                f"  FIX: The LLM returned something that isn't valid A2UI JSON. Check the prompt or the model."
            )
            raise HTTPException(
                status_code=503, 
                detail=f"A2UI FAILURE: AI returned invalid JSON for render-console — {type(e).__name__}: {e!s}. Raw (first 300 chars): {response_text[:300]}"
            )

        elapsed_ms = int((time.time() - start_time) * 1000)
        print(f"\n{'='*60}")
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent=render-console | total={elapsed_ms}ms")
        print(f"  Milestone A (Database): {ms_a:8.1f}ms")
        print(f"  Milestone B (LLM):      {ms_b:8.1f}ms")
        print(f"  Milestone C (Parse):    {ms_c:8.1f}ms")
        print(f"{'='*60}\n")

        # The repair rows — the checker's own findings, composed for the panel's "view"
        # slot. A read of the report, never a model call, and it cannot fail the surface:
        # the report's absence is carried as a row rather than as an empty list.
        repair_rows = _repair_rows()
        validate_a2ui_components(components)
        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": A2UI_CATALOG_ID
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components
                }
            },
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "cards": cards,
                        # The console's OWN session and conversation — what the
                        # emitted chat-panel binds to. One console-typed session per
                        # user, one conversation under it.
                        "console": {
                            "session_id": console_session_id,
                            "conversation_id": console_conversation_id,
                            # ── WHO SHE IS HERE, WHICH IS THIS ROOM'S OWN SENTENCE ───────────────
                            #
                            # The seat binds this path (see `_seat_grace`), so the console's Grace is
                            # told what this room is — the index of the person's prompt packages, and
                            # her job of advising on what they say — instead of introducing herself in
                            # a composer's voice. The owner, 2026-10-01, on exactly that: *"she's
                            # saying the wrong thing… she's a different thing in each room."*
                            "grace_instructions": CONSOLE_GRACE_INSTRUCTIONS,
                            # EACH TAB HAS ITS OWN CONVERSATION — the panel switches between
                            # them by the tab column the dropdown rows carry; no new binding.
                            "tab_conversations": {
                                "chat": console_conversation_id,
                                "approvals": approvals_conversation_id or console_conversation_id,
                            },
                            # The dropdown's rows — same shape as the composer's seat, plus the
                            # tab each conversation belongs to (the label the dropdown shows).
                            "conversations": [
                                {
                                    "id": str(c.get("id")),
                                    "title": c.get("title") or "(untitled)",
                                    "tab": c.get("tab") or "chat",
                                }
                                for c in console_conversations
                            ],
                        },
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True,
                        "usage": dict(LAST_USAGE),  # measured, straight from the provider
                        "ai_message": ai_message,
                        # Anything this assembly could not read, said out loud — the frontend
                        # writes these into the trace (see _warn at the top of this file).
                        "warnings": _drain_warnings(),
                        # What the panel's "repair-view" draws. Composed by the writer
                        # above from the report the checker wrote — the model is told not
                        # to invent values for it, and the element re-words nothing.
                        "findings": repair_rows,
                        # A row's state while a repair is being made: "repair" (amber,
                        # in repair) and "done" (green, completed). WRITTEN BY THE CLIENT —
                        # a repair is started and settled in the browser — so the path exists
                        # here and holds nothing until a person starts one. A completed row
                        # is then simply absent from the next report: the checker re-derives
                        # the findings, and there is no history of repaired components.
                        "repairs": {"stages": {}}
                    }
                }
            }
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: catalog-health[:<index>] — the index's condition, assembled by Grace
    # ═══════════════════════════════════════════════════════════════
    # Grace reads the check HERSELF. The shell sends only the intent; the state is
    # hers to fetch — the same report GET /api/catalog/audit serves. If the shell
    # fetched it and passed it in, the shell would be deciding again.
    elif intent.startswith("catalog-health"):
        from routes.misc import _read_catalog_audit

        catalog = intent.split(":", 1)[1] if ":" in intent else "prompt-composer"
        # _read_catalog_audit raises 503 when the checker has not run, so an unrun
        # check can never be assembled into a surface that looks like a clean one.
        audit = _read_catalog_audit(catalog)
        # Figma is an import tool, not a runtime gate: a "partial" report (the live
        # Figma checks skipped because there is no token) still carries the findings
        # the shell paints, so it assembles like a "complete" one. _read_catalog_audit
        # already 503s when the checker has not run at all.
        if audit.get("status") not in ("complete", "partial"):
            raise HTTPException(
                status_code=503,
                detail=(
                    f"A2UI FAILURE: the catalog check for '{catalog}' reports "
                    f"'{audit.get('status')}' — the findings are not current, so it "
                    f"cannot be assembled as if they were."
                ),
            )

        findings = [f for f in audit.get("findings", []) if f.get("level") != "pass"]
        generated_at = audit.get("generatedAt", "")
        index_name = audit.get("catalog", catalog)
        findings_for_prompt = json.dumps(findings)

        llm_prompt = f"""You are Grace, the A2UI surface assembler for the catalog check.
{render_tools_block()}

The user's index is "{index_name}". The checker ran at {generated_at} and found
{len(findings)} open findings.

Findings — raw, from the checker. Do not invent, merge, reorder or drop any:
{findings_for_prompt}

Assemble the catalog-health surface in A2UI v0.9.1. This is YOUR assembly.

{_catalog_component_vocabulary()}

REQUIREMENTS:
1. One Column with id "root" at the top.
2. A Text header naming the index and the open count.
3. ONE ActionGroup bound to the findings. Do NOT emit a component per finding —
   the surface binds to data, it does not enumerate. The findings ride in the
   data model, where the shell paints them.
4. ai_message is what you SAY. This is the point of the whole thing: greet the
   user by time of day, tell them plainly how many of their Figma components have
   problems, and offer to take care of them. One short, warm paragraph — not a
   list, not a summary of every finding. The surface carries the detail.

Output ONLY JSON in exactly this shape (no markdown fences, no commentary):
{{
  "components": [
    {{"id": "root", "component": "Column", "children": ["header", "findings"]}},
    {{"id": "header", "component": "Text", "text": "Catalog check — {index_name}: {len(findings)} open", "variant": "h2"}},
    {{"id": "findings", "component": "ActionGroup", "items": {{"path": "/findings", "componentId": "finding-action"}}}},
    {{"id": "finding-action", "component": "Button", "child": "finding-action-label", "action": {{"name": "open-repair-composer"}}}},
    {{"id": "finding-action-label", "component": "Text", "text": "Repair"}}
  ],
  "ai_message": "Your greeting"
}}
"""

        llm_response = query_llm(
            question=llm_prompt,
            mode="catalog_health_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-catalog-health",
            # model intentionally omitted — use the enabled provider's default
        )

        if not llm_response or not llm_response.strip():
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface.",
            )
        if llm_response.strip().startswith("Error:"):
            raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

        response_text = llm_response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            # This place is a package: its own versions, tools, runs and evals — no approvals.
            _seat_tabs(components, PACKAGE_TABS)
            # A catalog-health surface is primitives — a header, a group of repair actions — and
            # carries no seat, so this is a no-op here. It is called anyway so that EVERY surface
            # that could hold a seat states her words rather than relying on which branch it is in:
            # see `_seat_grace`, which never adds a component.
            _seat_grace(components, "/session", True)
            ai_message = parsed.get("ai_message", f"{len(findings)} open in {index_name}.")
            if not isinstance(components, list) or len(components) == 0:
                raise ValueError("components must be non-empty array")
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(
                f"[A2UI CatalogHealth] AI RESPONSE PARSE FAILED:\n"
                f"  error_type: {type(e).__name__}\n"
                f"  error_message: {e}\n"
                f"  llm_response_first_500: {response_text[:500]}\n"
                f"  FIX: The LLM returned something that isn't valid A2UI JSON."
            )
            raise HTTPException(
                status_code=503,
                detail=(
                    f"A2UI FAILURE: AI returned invalid JSON for catalog-health — "
                    f"{type(e).__name__}: {e!s}. Raw (first 300 chars): {response_text[:300]}"
                ),
            )

        elapsed_ms = int((time.time() - start_time) * 1000)
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent=catalog-health | total={elapsed_ms}ms")

        # What this call ACTUALLY cost, from the provider's own usage report.
        # Measured, never estimated — an invented number above a real action is
        # worse than no number.
        usage = dict(LAST_USAGE)

        validate_a2ui_components(components)
        return [
            {"version": "v0.9.1", "createSurface": {"surfaceId": "main", "catalogId": A2UI_CATALOG_ID}},
            {"version": "v0.9.1", "updateComponents": {"surfaceId": "main", "components": components}},
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "catalog": index_name,
                        "generated_at": generated_at,
                        "counts": audit.get("counts", {}),
                        "findings": findings,
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True,
                        "ai_message": ai_message,
                        "warnings": _drain_warnings(),
                        "usage": usage,
                    },
                },
            },
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: render-composer, and render-section:<id>
    #
    # A SECTION IS A SURFACE LIKE EVERY SURFACE, and it wears the Composer's container. The
    # owner, 2026-09-30: *"No, no it's a surface. It's a surface just like every surface. I'm
    # not seeing assembly happening… why doesn't it feel like it's assembling to me?"* — and, on
    # what it should hold: *"I need you to reuse the same architectural structure that we
    # currently use for composer."*
    #
    # So a section assembles THE SAME TREE the Composer does — the same LAYOUT CONTRACT, the
    # same five slots, the same components — and adds no second prompt to keep in step. What
    # makes Design different from Product is what its slots HOLD, which is the part the owner
    # replaces; it is not a different container and must not become a second assembly path.
    #
    # BEFORE THIS the four section tabs hit the handler's fallback ("Other tabs - just switch
    # for now (TODO: wire to AI assembly)") and assembled NOTHING: no request, no spinner, no
    # surface — just a React re-render, which is why it read as a web page changing rather than
    # as a surface arriving.
    # ═══════════════════════════════════════════════════════════════
    elif intent == "render-composer" or intent.startswith(("render-section", "render-design")):
        # ── HONEST STATUS (2026-08-04): ──
        # FIGMA DISABLED — was causing 10s timeouts when the cached spec
        # was empty/stale (node 40000717:17091 deleted in Figma). The LLM
        # would choke on an empty spec and the frontend would abort.
        # Assembly now proceeds WITHOUT Figma. The model derives the
        # surface layout from its own knowledge of the A2UI catalog.
        ms_a = 0.0

        # ── A SECTION IS THE SAME CONTAINER WITH AN EMPTY LEFT COLUMN ────────────────
        # The owner, 2026-09-30, looking at the Composer's System/User/Agent roles showing up
        # inside Design: *"now you can remove this information from the left column"*. Those
        # roles are the Composer's STARTER SECTIONS — three prompt sections it seeds a new
        # prompt with — and a section seeds nothing. Its slots ARE the container, and what
        # fills them is the section's own business.
        #
        # THE ONE PROMPT BELOW SERVES BOTH, and this is the single line that differs. That is
        # deliberate: two prompts would be two contracts to keep in step, and the owner asked
        # for the Composer's architecture REUSED — *"I need you to reuse the same architectural
        # structure that we currently use for composer."* A container that drifts from the
        # Composer's is not the same architecture.
        #
        # Everything else about a section's assembly is the Composer's: the same root, the same
        # five slots, the same components, the same isThirdOpen rule — because the design is
        # meant to match before anything is put in it.
        is_section = intent.startswith("render-section") or intent.startswith("render-design")
        sections_requirement = (
            "[] — AN EMPTY CONTAINER, AND THIS IS THE ONE THING A SECTION DOES DIFFERENTLY. "
            "A section seeds NO prompt sections: System, User and Agent are the Composer's "
            "starter content and they do not belong in this container. Emit the empty list, so "
            "the left column is the container and nothing else."
            if is_section
            else 'exactly 3 starter prompt sections — System, User, Agent — each an object '
                 '{"name", "type", "content"} with short real content (User and Agent may be empty).'
        )

        llm_prompt = f"""You are Grace, the A2UI surface assembler for the Composer.
{render_tools_block()}

The user clicked "Composer". Assemble the FULL blank composer surface.

COMPONENT NAMES — use exactly these strings in each object's "component" field:
{json.dumps(list(a2ui_catalog.get("components", {}).keys()))}

LAYOUT CONTRACT — the container's NAMED slots, which you fill:
- left-header: left-column-header, title bound to {{"path": "/session/title"}}
  THE PROMPT'S OWN BAR, above the sections and NOT inside their scroller: it is the
  package's title, its version and its id, so it stays put while the sections scroll
  under it. Emit "left-column-header" (the tag) or "LeftColumnHeader" (the name) —
  both are in the catalog and both resolve to the same element. Bind "title" and
  nothing else: the version and the id come from the host, and the tags, author and
  score are drawn placeholders that take no props.
- left: prompt-section-editor, sections bound to {{"path": "/session/left_column/sections"}}
- left-footer: control-bar
  The design puts the "Left-column-ControlBar" at the BOTTOM of the left column
  (#40000954:23865), as that container's LAST child — it is the CONTAINER's slot, not a
  child of the editor, so the bar stays put while the prompt sections scroll above it.
  Emit it with NO props: the master carries three controls (undo, Save Template, RUN)
  and no version line, so there is no value to bind.
- middle: compiled-output-viewer, content ""
- right: chat-panel — HER SEAT, ASSEMBLED WITH ALL OF ITS BINDING, not just the conversation. The
  owner, 2026-09-30: *"This is an entire surface. Why are you not referencing the composer and the
  console to understand what this surface is? It's not different. This is runtime assembly."* The
  console's seat and the composer's seat are the same element assembled with the same wiring; a
  seat emitted with a conversation id alone cannot load her thread, her history or her trace, and
  draws no turn at all — measured in the running room. BIND ALL OF THESE, as the shape below shows:
    "conversationId"  {{"path": "/session/right_column/conversation_id"}}
    "conversations"   {{"path": "/session/right_column/conversations"}}
    "sessionId"       {{"path": "/session/id"}}
    "packageTitle"    {{"path": "/session/title"}}
    "packageDescription" {{"path": "/session/description"}}
    "leftColumnContent"  {{"path": "/session/left_column/sections"}}
    "compiledOutput"     {{"path": "/session/middle_column/compiled_output"}}
    "instructions"       {{"path": "/session/grace_instructions"}}
  "instructions" IS WHO SHE IS IN THIS ROOM — the surface assembles her words, so a seat in another
  room is not handed this room's script. Bind it; never write her a sentence inline.
  It carries one child in its "view" slot — "trace-view", a TraceFeed bound to
  /trace/entries and /trace/breadcrumbCount — because that slot is the room's content hole for
  every non-chat tab, and a panel emitted without it shows the Trace tab loading forever.
  Both paths are written by the client; do not invent values for them.

"root" IS "workspace-layout" — do not put a Column above it. Its panes are NAMED
slots, so its "children" is an OBJECT keyed by slot name ({{"left": ...,
"middle": ..., "right": ...}}), not an array: the array form carries no slot and
fills nothing.

REQUIREMENTS:
1. Component objects use key "component" (NOT "type"). Every object needs "id".
2. id "root", component "workspace-layout", children keyed by slot name.
3. initial_sections: {sections_requirement}
4. One short friendly ai_message and one short suggested_title.
   "isThirdOpen": true IS STATED, NOT LEFT OUT — and that is load-bearing. A prop an assembly
   OMITS is not reset: the renderer re-assigns what the tree carries, and the element keeps
   everything else. The console (and a Run's flow view) sets `isThirdOpen: false`, so a
   Composer that said nothing inherited a CLOSED column — measured 2026-09-18, the owner: "I'm
   not sure why the chat's loading collapsed." Two columns means the second one is OPEN, every
   time, so it is written down.
5. THE ROOT HAS NO "middle" CHILD. A prompt that has not been run shows TWO columns:
   the prompt and GRACE. The middle column is the one a Run produces — it holds the flow
   and the run's output, and until there is a run it is not drawn at all (owner,
   2026-09-18: "you should only see two columns. The third column is not visible until the
   user clicks run"; and, on seeing the middle drawn without her: "the middle column is
   open and Grace is gone"). "middle-column" is still EMITTED below — the shell moves the
   flow view into it at Run time — it is simply not in the layout's children yet, so the
   layout does not draw it.
5. "right-column" carries "allowedTabs": "chat,trace,tools,executions,eval,settings".
   THE MENU IS THE PLACE, not a filter over data: a rail button is a request to look at
   something THIS place has, so a package offers its own tools, its own runs and its own
   evals — and NOT approvals, because approvals are the console's job:
   the console approves across every package, and a package can only ever see its own.
   Emit the list EXACTLY as written; a missing allowedTabs shows every button the rail
   has, which is how a package ends up offering the console's global view.

Output ONLY this exact JSON shape — no markdown, no envelope wrapper, no array, no extra keys, no text after the JSON:
{{
  "components": [
    {{"id": "root", "component": "workspace-layout", "isThirdOpen": true, "children": {{"left-header": "left-header", "left": "left-column", "left-footer": "control-bar", "right": "right-column"}}}},
    {{"id": "left-header", "component": "left-column-header", "title": {{"path": "/session/title"}}, "version": {{"path": "/session/version"}}, "promptId": {{"path": "/session/id"}}}},
    {{"id": "left-column", "component": "prompt-section-editor", "sections": {{"path": "/session/left_column/sections"}}}},
    {{"id": "control-bar", "component": "control-bar", "isSaving": {{"path": "/session/left_column/saving"}}, "isRunning": {{"path": "/session/middle_column/running"}}}},
    {{"id": "middle-column", "component": "compiled-output-viewer", "content": ""}},
    {{"id": "right-column", "component": "chat-panel", "allowedTabs": "chat,trace,tools,executions,eval,settings", "conversationId": {{"path": "/session/right_column/conversation_id"}}, "conversations": {{"path": "/session/right_column/conversations"}}, "sessionId": {{"path": "/session/id"}}, "packageTitle": {{"path": "/session/title"}}, "packageDescription": {{"path": "/session/description"}}, "leftColumnContent": {{"path": "/session/left_column/sections"}}, "compiledOutput": {{"path": "/session/middle_column/compiled_output"}}, "children": {{"view": ["trace-view", "eval-view"]}}}},
    {{"id": "trace-view", "component": "TraceFeed", "entries": {{"path": "/trace/entries"}}, "breadcrumbCount": {{"path": "/trace/breadcrumbCount"}}}}
    {{"id": "eval-view", "component": "EvalFeed", "evaluations": {{"path": "/session/middle_column/evaluations"}}}}
  ],
  "initial_sections": [
    {{"name": "System", "type": "system", "content": "You are a precise, professional assistant."}},
    {{"name": "User", "type": "user", "content": ""}},
    {{"name": "Agent", "type": "agent", "content": ""}}
  ],
  "suggested_title": "Untitled Prompt",
  "ai_message": "Composer ready. Select a role and enter your prompt."
}}"""

        # ── PERFORMANCE TRACE: Milestone B (Network/LLM) ──
        ms_b = 0.0
        ms_c = 0.0
        t_b_start = time.perf_counter()
        llm_response = query_llm(
            question=llm_prompt,
            mode="surface_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-composer"
            # model intentionally omitted — use the single configured model's id
            # (LOCAL_ASSEMBLY_MODEL, Qwen3.5-9B), so the URL and the id stay one source
        )
        ms_b = (time.perf_counter() - t_b_start) * 1000

        # TRUE A2UI: Hard-fail if AI doesn't respond
        if not llm_response or not llm_response.strip():
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface."
            )
        if llm_response.strip().startswith("Error:"):
            raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

        # ── PERFORMANCE TRACE: Milestone C (Validation/Parse) ──
        t_c_start = time.perf_counter()
        response_text = llm_response.strip()
        
        # Strip markdown fences if present
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        # Parse and validate AI response - NO fallbacks
        try:
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            # This place is a package: its own versions, tools, runs and evals — no approvals.
            _seat_tabs(components, PACKAGE_TABS)
            # AND HER WORDS: this room's script, with the package's live workspace after it. Same
            # call in every branch that emits a package seat — see `_seat_grace`.
            _seat_grace(components, "/session", True)
            initial_sections = parsed["initial_sections"]
            ai_message = parsed["ai_message"]
            suggested_title = parsed["suggested_title"]
            
            # Validate required fields
            if not isinstance(components, list) or len(components) == 0:
                raise ValueError("components must be non-empty array")
            if not isinstance(initial_sections, list):
                raise ValueError("initial_sections must be array")
            if not isinstance(ai_message, str) or not ai_message.strip():
                raise ValueError("ai_message must be non-empty string")
            if not isinstance(suggested_title, str) or not suggested_title.strip():
                raise ValueError("suggested_title must be non-empty string")
                
            ms_c = (time.perf_counter() - t_c_start) * 1000
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(
                f"[A2UI Composer] AI RESPONSE PARSE FAILED:\n"
                f"  error_type: {type(e).__name__}\n"
                f"  error_message: {e}\n"
                f"  llm_response_length: {len(response_text)}\n"
                f"  llm_response_first_500: {response_text[:500]}\n"
                f"  timestamp: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}\n"
                f"  FIX: The LLM returned something that isn't valid A2UI JSON. Check the prompt or the model."
            )
            raise HTTPException(
                status_code=503, 
                detail=f"A2UI FAILURE: AI returned invalid JSON for render-composer — {type(e).__name__}: {e!s}. Raw (first 300 chars): {response_text[:300]}"
            )

        # No DB update here. suggested_title lives in the in-memory data model only.
        # Real title + session creation happens on explicit Save via /ai/save-surface.

        elapsed_ms = int((time.time() - start_time) * 1000)

        # ── PERFORMANCE TRACE: LOG BREAKDOWN ──
        print(f"\n{'='*60}")
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent={intent} | total={elapsed_ms}ms")
        print(f"  Milestone A (Database - draft create):      {ms_a:8.1f}ms")
        print(f"  Milestone B (Network/LLM - query_llm):     {ms_b:8.1f}ms")
        print(f"  Milestone C (Validation - JSON parse):      {ms_c:8.1f}ms")
        print(f"  Remainder (other):                          {elapsed_ms - ms_a - ms_b - ms_c:8.1f}ms")
        print(f"{'='*60}\n")

        # ═══════════════════════════════════════════════════════════════
        # A2UI v0.9.1 ENVELOPE RESPONSE
        # HONEST STATUS (2026-08-01):
        #   - components list: AI-generated (which prompt blocks, which data)
        #   - Data model SHAPE: slot contract is FIXED (left/middle/right)
        #     because slots are the foundational loading framework.
        #     The AI fills slots; it does not create or remove slots.
        #   - Sections within left_column: AI-generated (the prompt blocks)
        #   - Per owner: slots are pure AI-native loading contract.
        #     Scaling features = slot them in. No visible styling yet.
        # ═══════════════════════════════════════════════════════════════
        
        # ── WHICH CATALOGUE GATES THIS ASSEMBLY ─────────────────────────────────────────
        # The Composer's, as it always was — except for Design, whose surface is not the
        # model's tree: the branch below builds it and gates it THERE, against
        # `design-artifacts`. This call runs before that branch, so on a design intent it
        # would gate the model's answer — a tree this assembly does not draw — and fail a
        # Design surface over a name nobody renders.
        #
        # WHAT THAT GAP ACTUALLY COST, measured 2026-09-30: `design-middle-container` and
        # `design-left-panel` are in `design-artifacts` and in NO other catalogue, and they
        # are appended after this line — so the only two components that are Design's own
        # were the only two nothing checked. The gate below is what closes it, and it is
        # the owner's own rule that says so: a name has to be *"entered in composer, and
        # then ... re-entered into the design"* — which is only a rule if the design's
        # catalogue is the one that rejects it.
        if not intent.startswith("render-design"):
            validate_a2ui_components(components)

        # ── WHOSE SESSION IS THIS SURFACE FOR? ─────────────────────────────────────────────
        #
        # THE COMPOSER'S ASSEMBLY DRAFTS A PACKAGE: `id: None` and `is_unsaved: True`, saved
        # later by an explicit Save. That is right for the Composer and it is WRONG for the
        # Design experience — a section that adopts that draft is working on a prompt package,
        # which is the "connected to the wrong database" the owner measured on 2026-09-30:
        # *"every time you try to inject, you're just creating a prompt package."*
        #
        # A DESIGN ASSEMBLY NAMES ITS OWN CONTAINER. One per user, created on first use and made
        # race-safe by a partial unique index (`init_db.py`), with Grace's conversation hanging
        # off it (`prompt_sessions_api.py`). So the surface's data model is keyed to the Design
        # row from the first byte: no draft, no unsaved package, and no path by which a click in
        # Design can write one.
        #
        # The TREE is the same one the Composer's contract builds — that sharing is deliberate,
        # because the two experiences are meant to look alike. What differs here is the DATA.
        if intent.startswith("render-design"):
            # ── THE COMPOSER'S WORK IS NOT IN DESIGN'S SURFACE ───────────────────────────
            #
            # The owner, 2026-09-30, with the left column's contents marked out: the three role
            # sections (System, User, Agent) and the bar at its foot — the undo button, "Save
            # Template ⌘ S" and "RUN". *"These exact elements should not be rendering in design…
            # if you have indeed built a separate renderer for design, then you can remove these
            # from that renderer and it should not affect anything else. Then you'll have an empty
            # container in the renderer that you can then plug in your component catalog."*
            #
            # WHAT MAKES THIS SAFE NOW, AND DID NOT BEFORE: Design has its own renderer — its own
            # `<a2ui-renderer>` instance, drawing this tree, while the Composer's draws its own
            # (`WritingAreaIndex.tsx`, `designRendererRef`). So removing a component here changes
            # DESIGN'S SURFACE AND NOTHING ELSE. The same removal made against the shared renderer
            # was a change to the Composer's frame, which is why it was wrong then and is right now.
            #
            # SEEDING NO SECTIONS IS NOT ENOUGH, and that is why this is a filter and not a data
            # change: `prompt-section-editor` draws System/User/Agent as ITS OWN defaults, so an
            # empty list still paints three roles. The component has to be absent from the tree.
            #
            # AND ITS REFERENCE HAS TO GO WITH IT. A removed component whose id is still named by a
            # parent is a hole the renderer reports by name — correctly:
            #     left-column ?: No component with id "left-column". Referenced by root.
            # The owner on that report: *"we want errors. I like errors. Errors I can fix; error
            # suppression I cannot."* So the reference is removed with the component; the report is
            # never silenced.
            #
            # What fills the empty slot is the component catalogue and the Figma URL input, and
            # that is injected AFTER this container has rendered — the order: assembly, then the
            # container's render, then the injection.
            # ── THE LEFT COLUMN IS THE PANEL, WITH THE COMPOSER'S PROMPT TAKEN OUT OF IT ──
            #
            # THE PANEL STAYS; WHAT IT HELD DOES NOT. The owner, 2026-09-30, looking at the
            # running room: the Agent Role tile, the "Functions | Tools" button and the empty
            # textarea were drawn in Design's left column ABOVE the ingest's rail. Those are
            # `prompt-input-section` rows — what `prompt-section-editor` draws — and the panel
            # they sit in is the design's own "center-panel-3rd-col" (40001066:3888), which the
            # owner calls the left column's panel and which is part of the frame: *"it's the same
            # panel that we have the prompt / agent prompt inputs, and it's called left column."*
            #
            # SO THE FRAME IS KEPT AND ITS CONTENTS ARE REPLACED, which is the owner's own rule
            # for this whole exercise: *"I will just reuse the lit components for the composer. I
            # will just replace what they hold."* The frame is kept BY REUSING IT — the panel is
            # `prompt-container`, the Composer's own element (its 1px #C0BDCF border, its rounded
            # top-left 10px and its 40px format rail carrying the vertical "Agent Prompt" label
            # are the drawing's numbers, reused rather than restated here).
            #
            # WHAT THE REPLACEMENT NEEDS IS A HOLE, AND `prompt-container` HAS ONLY ITS DEFAULT
            # ONE. Content assigned to a slot is rendered by a slot of that NAME and by nothing
            # else — a light child whose `slot` attribute matches no slot in its host's shadow
            # tree is not rendered at all — and the ingest's left region carries `slot="left"`.
            # So Design's panel is its own element, `design-left-panel`: the Composer's frame
            # with a `<slot name="left">` inside it, which is the ONE thing `prompt-container`
            # cannot be asked for without changing the Composer's own panel. That element is why
            # the component is absent from this tree while the panel is not.
            #
            # AND ITS REFERENCE GOES WITH IT. A removed component whose id is still named by a
            # parent is a hole the renderer reports by name — correctly:
            #     left-column ?: No component with id "left-column". Referenced by root.
            # The owner on that report: *"we want errors. I like errors. Errors I can fix; error
            # suppression I cannot."* So the reference goes with the component and Design's own
            # panel takes that slot; the report is never silenced.
            #
            # The footer bar comes out for the reason it always did: it is the Composer's controls
            # (undo, Save Template, RUN) and Design runs nothing.
            # AND THE BAR ABOVE THE COLUMN GOES WITH IT (2026-09-30). The owner, on the title
            # reading "Raibach IDS" over Tags / Author / Score / Flip: *"you've got the wrong name
            # at the top. It says Raibach IDS — that's not the name of it, it's supposed to be the
            # catalog… There's a score up there and Flip, none of that. I gave you an image; I told
            # you this is what should be there."* The image is the ingest form, and its left column
            # starts at the Figma URL — no title bar, no tags, no score, no flip control. Those are
            # the composer's package chrome (a package has a version, a score and a flip; this
            # column is a catalogue), so `left-column-header` comes off this surface like the
            # composer's controls above it. The catalogue's NAME is not lost: it is drawn where the
            # ingest draws it, at the head of the tree block ("Raibach Prompt Composer Catalog").
            # AND THE COMPOSER'S OWN MIDDLE COLUMN GOES WITH THEM (2026-09-30). `middle-column` →
            # `compiled-output-viewer` came in on the model's Composer tree and belongs to a
            # prompt package's output. This room's middle column is `design-middle-container`
            # and its content is the preview, so the Composer's viewer is a component this
            # room does not name — and the owner's rule is one for one: what is not in the map
            # is not in the room.
            design_omits = {"control-bar", "prompt-section-editor", "compiled-output-viewer"}
            removed_ids = {c.get("id") for c in components if c.get("component") in design_omits}
            components = [c for c in components if c.get("component") not in design_omits]
            if removed_ids:
                for c in components:
                    kids = c.get("children")
                    if not isinstance(kids, dict):
                        continue
                    for slot, target in list(kids.items()):
                        if isinstance(target, str) and target in removed_ids:
                            del kids[slot]
                        elif isinstance(target, list):
                            kids[slot] = [t for t in target if t not in removed_ids]

            # ── AND THE PANEL DESIGN FILLS THAT SLOT WITH ───────────────────────────────
            #
            # Emitted only when the model did not name one itself, the same rule the middle
            # column follows below: a model that emits `design-left-panel` is left exactly as it
            # is. The ingest's rail is the ONLY thing that goes in it, and it arrives after this
            # container has rendered — assembly, then the render, then the injection — because
            # the rail is React and this surface is not.
            if not any(c.get("component") == "design-left-panel" for c in components):
                components.append({
                    "id": "design-left",
                    "component": "design-left-panel",
                })
                for c in components:
                    if c.get("id") != "root":
                        continue
                    kids = c.get("children")
                    if isinstance(kids, dict) and "left" not in kids:
                        kids["left"] = "design-left"
                    break

            # ── THE MIDDLE COLUMN, AND WHY IT IS THE DESIGN'S OWN ELEMENT ────────────────
            #
            # THE MIDDLE COLUMN IS PART OF THIS SURFACE. The Composer's root has NO "middle" child
            # at rest — a prompt that has not been run shows two columns, and the third is what a
            # Run draws (see the assembly prompt's requirement 5). Design's third column is the
            # ingest's output, so the column and its container belong to Design's surface from the
            # first byte. Nothing is removed to make room for it: the model's tree carries no
            # middle child at all, so this is an ADDITION to Design's surface and the Composer's
            # tree is not touched by it.
            #
            # WHY NOT `compiled-output-viewer`. The ingest's Preview has to be loaded INSIDE the
            # column, and the Composer's viewer owns its whole body with no slot: measured
            # 2026-09-30, no `<slot>` appears anywhere in that element, so nothing can be loaded
            # into it. The owner ruled on exactly this case: *"If you have to make a different
            # component because you can't figure out how to load something inside of it, then build
            # a different lit component for the design section."* So Design names its own container
            # — the Composer's own header row over a real slot named "middle" — and the ingest's
            # middle region (which already declares `slot="middle"`) lands in the hole.
            #
            # THE CONTAINER IS EMITTED ONLY WHEN THE MODEL DID NOT. A model that emits its own
            # middle child is left exactly as it is; its id is what the reference below would
            # otherwise overwrite.
            # ── THE CONTAINER IS DECLARED; WHETHER THE COLUMN IS DRAWN IS THE HOST'S ─────
            #
            # THE COMPONENT IS EMITTED AND THE LAYOUT DOES NOT REFERENCE IT, which is the
            # Composer's own contract for its middle column, word for word: "middle-column is
            # still EMITTED below — the shell moves the flow view into it at Run time — it is
            # simply not in the layout's children yet, so the layout does not draw it."
            #
            # WHY, IN THE OWNER'S WORDS (2026-09-30): *"the center column should be collapsed
            # until the user enters a link and click submit and then it opens and shows the
            # preview. If you need reference to that look at the composer."* Which panes exist is
            # the SURFACE's tree — `workspace-layout` draws a middle column when something is in
            # its middle slot and takes no width when nothing is — so a column that must start
            # collapsed is a column the tree does not reference yet, and opening it is the host
            # putting the reference in when the ingest reports its first draft.
            #
            # AND THE COMPONENT STAYS, not just the reference: the shell needs the element to
            # exist before it can be drawn, and an unreferenced entry in `components` is inert to
            # the renderer (the Composer ships one on every assembly).
            if not any(c.get("component") == "design-middle-container" for c in components):
                components.append({
                    "id": "design-middle",
                    "component": "design-middle-container",
                    # NO `outputType`: the column draws no header row of its own. It drew the
                    # Composer's `<output-controls>` — "Agent Flow" and a Models button — and the
                    # owner asked why a control that is not in the ingest pane is in this column
                    # (one for one). The column's head is the preview's own: "Preview", the
                    # component's name, its tag, and the two actions.
                })

            # ── WHAT A RUN LOADS, AND WHERE IT LANDS ────────────────────────────────────
            #
            # THE OWNER, 2026-09-30: *"the run function is supposed to launch the third column and
            # show the preview… submit is run, selecting one of those components in that list is a
            # run function. It's supposed to display it. It's basically a left navigation — you're
            # loading those components and all of their meta-data just like you are on the react
            # application for ingest."*
            #
            # So the middle column gets a component that DRAWS a run's result — the ingest's answer
            # for a Submit, or the row a person clicked. It is emitted here, referenced BY THE
            # CONTAINER below, and the column itself stays collapsed until the HOST references
            # `design-middle` in the layout — the Composer's own contract, word for word: "the shell
            # moves the flow view into it at Run time… it is simply not in the layout's children
            # yet, so the layout does not draw it."
            #
            # THE STATE IS THE SHELL'S AND TRAVELS AS BINDINGS. `preview` is written when a run
            # produces something (`/session/preview`), and `busy`/`message` ride the same channel the
            # ingest form uses, because it is the same fact: the room is working, or it refused.
            components.append({
                "id": "preview",
                "component": "component-preview",
                "preview": {"path": "/session/preview"},
                "busy": {"path": "/session/ingest/busy"},
                "message": {"path": "/session/ingest/message"},
            })
            for _c in components:
                if _c.get("id") != "design-middle":
                    continue
                _kids = _c.get("children")
                if not isinstance(_kids, dict):
                    _kids = {}
                    _c["children"] = _kids
                _kids["middle"] = "preview"
                break

            # ── THE CHECK, DRAWN IN HER CHAT OUTPUT — THE CONSOLE'S OWN FUNCTION ─────────
            #
            # THE OWNER, 2026-09-30: *"put it inside of the goddamn chat output… It already lives
            # there. It already existed."* The checker's list exists and renders two ways already:
            # the ingest shows a component's Catalog Check, and the CONSOLE draws the checker's
            # findings inside its seat's output hole. This is the console's function, matched: the
            # same element (`chat-repair-actions`), the same slot (the seat's "view"), the same
            # reader for the rows (`_repair_rows`, which composes them from the report the checker
            # wrote — never a model's paraphrase), and the catalogue this room announces.
            #
            # IT IS A SURFACE CHILD, NOT AN INJECTION. The component is in the components list and
            # the SEAT NAMES IT by id, which is the adjacency rule this repository runs on: the
            # renderer draws what the envelope references and nothing else is allowed in the room.
            # The rows ride in the data model (`/session/checks`) — structure in the components,
            # content in the data model, referenced as a path.
            #
            # THE SAME SOURCE THE INGEST ALREADY READS. The ingest's "Catalog Check" is
            # `npm run catalog:check` and the report it writes (`routes/figma.py`, `_catalog_check`);
            # the Console's list is composed from that same report. So this is `_repair_rows()`
            # with no catalogue named — the one report this repository produces — rather than a
            # second reader that could disagree with the first.
            #
            # A CHECK THAT DID NOT RUN IS NOT AN EMPTY LIST, and `_repair_rows` is where that rule
            # lives: with no readable report it returns one row saying so rather than nothing,
            # because an empty list would read as a clean catalogue.
            design_check_rows = _repair_rows()
            components.append({
                "id": "design-checks",
                "component": "chat-repair-actions",
                "findings": {"path": "/session/checks"},
            })
            for _c in components:
                if _c.get("component") != "chat-panel":
                    continue
                _kids = _c.get("children")
                if not isinstance(_kids, dict):
                    _kids = {}
                    _c["children"] = _kids
                _view = _kids.get("view")
                # The slot takes one child or a list of them (the Composer ships a list), so the
                # check is ADDED to whatever the seat already holds rather than replacing it.
                if isinstance(_view, list):
                    if "design-checks" not in _view:
                        _view.append("design-checks")
                elif isinstance(_view, str):
                    if _view != "design-checks":
                        _kids["view"] = [_view, "design-checks"]
                else:
                    _kids["view"] = "design-checks"
                break

            # ── AND THE RAIL MUST OFFER THE BUTTON THAT OPENS IT ────────────────────────
            #
            # "A view with no rail button would be a hole nothing can reach" — the rule the
            # console's own note states, and half of this change. The check child above rides in
            # the seat's "view" hole, and that hole is drawn on the tabs the seat OFFERS; the
            # element maps `repair` to the findings view and draws it there
            # (`.view-slot.tab-repair ::slotted(chat-repair-actions) { display: block }`), so the
            # list appears the moment the seat offers Repairs and a person clicks it.
            #
            # State the list rather than inherit it: an assembly that omitted the tab would put
            # the rows in the tree and leave them unreachable on screen, which is a silent hole of
            # exactly the kind this repository refuses. See `DESIGN_TABS`.
            _seat_tabs(components, DESIGN_TABS)
            # AND HER WORDS — THIS ROOM'S OWN, bound by the assembly rather than by the model. The
            # design room's script is composed here from the database (the catalogue's elements, its
            # sessions, its conversations — see `design_grace_context`), so its live facts are
            # already IN it: nothing follows it, which is what `False` states.
            _seat_grace(components, "/session", False)

            # AND THE TRACE TAB DOES NOT ASK HER A QUESTION. The console's seat carries
            # `tracePrompt: false` for a measured reason (routes/ai.py, render-console): the
            # automatic prompt asks for tokens, cost, latency and evaluation — properties of a
            # prompt PACKAGE's run — so every Trace click wrote a canned question and a canned
            # refusal into that conversation, which ended up holding nothing else. The same thing
            # happened here the moment this room got a trace to look at: measured 2026-09-30, one
            # click on Design's Trace wrote "Load the latest activity and report tokens, cost,
            # latency and evaluation for this prompt." and her refusal, both as rows in the Design
            # conversation. THIS ROOM'S TRACE IS THE INGEST'S RECORD — there is no package run
            # behind it to report on — so the question is not asked and the view still switches.
            for _c in components:
                if _c.get("component") == "chat-panel":
                    _c["tracePrompt"] = False

            # ── THE BAR ABOVE THE COLUMN: THE CATALOGUE'S NAME, AND NO PACKAGE CHROME ────
            #
            # The owner, with the ingest form as the map: *"The catalog name goes in the top where we
            # put the prompt name. We don't need a score. There's no score for the design system.
            # There's no flip for the design system."* So the header stays and two of its fields are
            # re-pointed at this surface's facts: the title reads the CATALOGUE's name rather than
            # the container's, and the package chrome (tags, author, score, flip) is not drawn —
            # `showMeta` false — because a catalogue has no performance to score and no columns to
            # flip. The version label is left as it is: it reads "Editing Version —" here, which is
            # true (a catalogue is not versioned).
            for _c in components:
                if _c.get("component") != "left-column-header":
                    continue
                _c["title"] = {"path": "/session/catalogue/name"}
                _c["showMeta"] = False
                break

            # ── THE INGESTION RAIL'S OWN TREE, IN THE LEFT PANE — REUSED, NOT REBUILT ─────
            #
            # THE OWNER, 2026-09-30: *"why is there nothing? Why is the component data tree not
            # there? I want to see the data called from the database… just bring anything from the
            # lit catalog."* And then, having said it for hours: *"I've been telling you all
            # morning long… you will not build it."*
            #
            # WHY IT WAS EMPTY. The left pane's content was the ingestion tool's rail, mounted
            # into `design-left-panel` by React — and that mount is gone, because a host mount
            # inside a surface is not allowed and it drew BENEATH the room. What replaces it is the
            # same information through the only door a surface has: a component named in the
            # envelope.
            #
            # ── AND IT IS THE INGESTION RAIL'S OWN ELEMENT, NOT A NEW ONE ────────────────
            #
            # A session went by that produced a new list component, and a pane of cards before it,
            # and both were wrong for the same reason: THE INGESTION APPLICATION IS THE TEMPLATE.
            # Its left column already draws this — the Figma URL and Notes over the catalogue
            # strip, the catalogue's head, and one row per declared component carrying its shape
            # (`allOf(3)` / `flat`), its Figma node, the file that DRAWS it, and a status dot from
            # the checker's audit (`IngestModal.tsx`, the `<figma-layers-view>` at the foot of the
            # rail). That element is `figma-layers-view`, it is built, and it needed exactly two
            # registrations to be legal in a surface — a catalogue entry and an allowlist entry.
            # Neither is a drawing: the element already exists, so NO COMPONENT WAS AUTHORED for
            # this column.
            #
            # `pipeline` IS A CATALOGUE FOLDER, NOT THE SESSION. The room's data model carries
            # `/session/catalogue/system`, and that value is `raibach-ids` — a design SYSTEM, not a
            # catalogue — so binding this prop to that path would name a catalogue that does not
            # exist and the tree would draw its "no catalogue named …" failure. `prompt-composer` is
            # the element's own default, it is what the ingest form shows, and it is the catalogue
            # the section's 58 rows are declared in (the rows at `/session/elements`, one
            # `design_master` row per component, written by `sync_design_elements.py`). The strip at
            # the top of the element switches catalogues from inside the element itself, so this is
            # a starting point and not a lock.
            #
            # WHAT IT DOES NOT YET DO, stated rather than implied: the tree DISPATCHES
            # `open-component`, `open-layer` and `open-function`, and nothing in this room answers
            # them — opening a component for review is the ingest tool's behaviour and it is not
            # wired here. It draws and it marks; it does not yet open.
            # ── THE RAIL'S TOP HALF: THE LINK AND THE NOTES ────────────────────────────
            #
            # THE OWNER, 2026-09-30, on a pane that held only the tree: *"where is the Figma input?
            # Why would you leave out the most important part the input field for the link and the
            # notes?"* The ingest rail is a FORM over a TREE, and only the tree was there. So the
            # form is emitted too — `figma-ingest-form`: the Figma URL field, the Notes field and
            # Submit, with the ingest's own words.
            #
            # IT IS A TRANSLATION, NOT A REBUILD, and the division is the repository's own: the
            # element draws the two fields and dispatches `ingest-submit` with the raw text; the
            # PARSING (`@/utils/figmaUrl`) and the CALL (`POST /api/figma/ingest`) already exist in
            # this application and are not reimplemented in an element. The shell answers the event
            # and runs the ingest.
            #
            # THE SLOT TAKES BOTH, IN THE RAIL'S OWN ORDER — the form above, the tree below — which
            # is how the ingest form stacks them in its own left column.
            components.append({
                "id": "left-form",
                "component": "figma-ingest-form",
                # ── THE HOST'S TWO VALUES TRAVEL IN THE DATA MODEL, NOT IN THE COMPONENTS ──
                #
                # THIS IS NOT DECORATION AND IT IS NOT A STYLE CHOICE — it is the only channel that
                # reaches an element that already exists. The renderer re-applies props on a
                # DATA-MODEL change and returns early on a COMPONENTS change
                # (`a2ui-renderer.ts` `updated()`: `if (!changed.has('dataModel') || changed.has(
                # 'components')) return`), so a shell that patches the emitted component to set
                # `busy` writes into a channel nothing reads: the form sat there with an empty
                # message while an ingest ran, which is exactly what the owner saw when he pressed
                # Submit. Bound paths are the channel that works, and they are this repository's own
                # rule anyway — structure in the components, content in the data model.
                "busy": {"path": "/session/ingest/busy"},
                "message": {"path": "/session/ingest/message"},
            })
            # ── THE RAIL'S SECOND FORM: ADD A DESIGN SYSTEM, BESIDE THE FIGMA ONE ────────
            #
            # THE OWNER, 2026-10-02: Design *"will manage the input and control of catalogs and
            # design system resources… we can add that ingest function to our current Figma ingest
            # function."* So the rail carries BOTH tools: the Figma form, then this one, then the
            # tree (see the `children` wiring below).
            #
            # THE SAME DIVISION AS THE FORM ABOVE, AND THE SAME TWO LAWS. The element draws the label
            # field, the archive field and Submit, and dispatches `catalog-ingest-submit`; the SHELL
            # posts `POST /api/catalog/ingest` and says what came back. Its two values travel as
            # BOUND PATHS for the same reason the Figma form's do — the renderer re-applies props on
            # a data-model change and returns early on a components change — under this form's OWN
            # keys, because two ingests in one rail must not write one message line.
            #
            # IT CANNOT NAME AN EXISTING CATALOGUE: the partition's name is the manifest's id, the
            # server refuses one that exists, and no field here offers a name to overwrite — the
            # system catalogues are not ingest targets by construction.
            components.append({
                "id": "left-system-form",
                "component": "catalog-ingest-form",
                "busy": {"path": "/session/design_system_ingest/busy"},
                "message": {"path": "/session/design_system_ingest/message"},
            })
            # ── THE FIRST TRANSLATION: THE CATALOGUE'S NAME, IN THE INGESTED CONTAINER ────
            #
            # THE OWNER, 2026-09-30: *"I want you to do your first transition — I want you to take
            # the catalog name and I want you to give it this container from the lit catalog that I
            # just added: f-40001207-3559."* It is the header row he ingested from Figma (node
            # 40001207:3559, "catalog-node-raibach-ids"): a caution mark, the catalogue icon, the
            # name over a second line, a chevron, and a description block. In the design that row IS
            # this component — so the name, the count and the catalogId are loaded into ITS slots
            # rather than drawn by a heading written in code. That is the whole exercise in one
            # place: the drawing comes from the catalogue, the values come from the data model, and
            # nothing here invents either.
            # (THE HEAD IS NOT EMITTED HERE — the tree draws it, because the tabs it must sit under
            # are drawn by the tree. See `_renderCatalog` in figma-layers-view: the element the owner
            # ingested from Figma is instantiated there, as the catalogue's own head. Emitting it
            # again from here would be a second copy of one fact.)
            components.append({
                "id": "left-rail",
                "component": "figma-layers-view",
                "inline": True,
                "pipeline": "prompt-composer",
                # The head above the rows IS the ingested element — drawn by this element's own
                # template, so `showHead` keeps its default (true) and the order is tabs, head, rows.

                # The re-read trigger, on the same channel and for the same reason: the shell bumps
                # this number after an ingest lands and the tree reads the layers back.
                "refresh": {"path": "/session/ingest/refresh"},
            })
            for _c in components:
                if _c.get("id") != "design-left":
                    continue
                _kids = _c.get("children")
                if not isinstance(_kids, dict):
                    _kids = {}
                    _c["children"] = _kids
                # A slot takes one child OR a list of them (the Composer ships a list), so both
                # halves are named rather than one replacing the other.
                _kids["left"] = ["left-form", "left-system-form", "left-rail"]
                break

            # ── AND THE GATE IS THIS SURFACE'S OWN ──────────────────────────────────────
            #
            # THE WHOLE TREE, AFTER EVERY COMPONENT IS IN IT, checked against the catalogue
            # DESIGN validates against (`design-artifacts`) — not the Composer's, and not
            # before the design's own elements have been added. Both halves of that matter:
            # `design-left-panel` and `design-middle-container` exist in `design-artifacts`
            # and in no other catalogue, so a gate that ran any earlier never saw them (see
            # the note where the shared call is skipped above), and a COMPOSER gate would
            # reject them by name the moment it did.
            #
            # The catalogue carries the Composer's names too — the owner's *"entered in
            # composer, and then ... re-entered into the design"* — which is why one gate is
            # enough for a surface that wears the Composer's container and holds Design's
            # own columns.
            validate_a2ui_components(components, "design-artifacts")

            design_container = state.prompt_sessions_api.get_or_create_design_container(
                user_id=uid,
                kind="design",
                title="Design",
                description="The Design experience's own session — a division, not a prompt package.",
            )
            design_conversation = state.prompt_sessions_api.get_or_create_design_conversation(user_id=uid)

            # ── THE CONVERSATIONS THAT HANG OFF THE DESIGN CONTAINER, READ ON ASSEMBLY ────
            #
            # Read the one way this codebase reads conversations (`conversations.session_id`),
            # never from a copy on a session row. This is the list her seat is given — and the
            # beginning of the metadata the assembly pulls from the database rather than guessing.
            design_conversations_list = []
            if state.conversation_api and design_container:
                try:
                    design_conversations_list = state.conversation_api.get_conversations_by_session(
                        str(design_container["id"]), uid
                    )
                except Exception as e:
                    _warn(f"the design section's conversation list could not be read: {e}")

            # ── WHO SHE IS IN THIS ROOM, GIVEN BY THE ROOM ───────────────────────────────
            #
            # The seat's script is the Composer's ("You are Grace, the Agentic Flow Architect…") and
            # it was sent as the context of every turn in every room — so in Design she reasoned
            # about prompt pipelines over a component tree. The owner, 2026-09-30: *"she's not
            # talking, she's not thinking, because some dumb ass AI has put a hardcoded mess in
            # there."* Her instructions belong to the ROOM, and the room is this surface.
            #
            # WHAT SHE IS HERE, in the ingest's own terms: she is the design-system assistant, the
            # one who answers about the component under review and the checks that did not pass —
            # the same job the ingest's ask endpoint already gives her.
            # HER WORDS ARE THE INGESTION'S OWN, VERBATIM IN SUBSTANCE — not a persona written
            # here. The owner, 2026-09-30: *"No, it should match ingestion. I've said it now four
            # times — look at your ingestion application. What does she say there?"* The ingest
            # tells her: *"You built the Lit component <tag> from Figma node … Its source is below,
            # followed by what the design measured and the checks that did not pass. Answer the
            # designer's question about it directly, in a few sentences, and say plainly what to
            # change when something is wrong."* That is who she is in this room; the component, its
            # source, the measured design and the failed checks arrive with the question.
            design_grace_instructions = (
                "You are the design system's assistant, and you are with the designer. You built the "
                "Lit components of this design system from Figma. The left column "
                "holds the catalogue and the ingest tool — what has been measured, what was "
                "written, and the checks that did not pass. The middle column shows the component "
                "being reviewed. Answer the designer's question about it directly, in a few "
                "sentences, and say plainly what to change when something is wrong."
            )
            # ── THE BAR'S TITLE IS THE CATALOGUE, NOT "Design" ───────────────────────────
            #
            # The owner, 2026-09-30: *"I already know I'm in design because the header at the top
            # of the page tells me where I am. It never goes away… when you take away navigation
            # or change navigation on a user they lose context, so in my designs you never lose
            # context because the navigation never goes anywhere."*
            #
            # So the section's own bar must not repeat the room's name — the room is already
            # on screen, permanently, in the header. Its title is THE CATALOGUE YOU ARE WORKING
            # IN, and the rest of that bar carries catalogue-level facts: its version, a
            # notification bell, whatever the customer needs to see. (Those fields are still the
            # Composer's package placeholders — version, tags, author, score, flip — and are the
            # next thing to replace; the owner: *"it might be anything."*)
            # ── WHICH CATALOGUE: THE INTENT CARRIES IT ───────────────────────────────────
            #
            # `render-design` works in the default catalogue; `render-design:<system>` works in
            # the one named — so the drop-down in the component tree can select a catalogue and
            # the room loads THAT one. The owner, 2026-09-30: *"you're gonna dynamically call the
            # catalogue when it's selected from the drop-down list… the exact same information I
            # want to see it here."*
            #
            # THE CATALOGUE IS A ROW, so "loading" it is resolving it: the same get-or-create the
            # container uses, one per user per design system, made race-safe by a partial unique
            # index. Nothing is copied and nothing is cached — the row IS the catalogue's record,
            # and the drawing still comes from its file.
            design_system = "raibach-ids"
            if ":" in intent:
                named = intent.split(":", 1)[1].strip()
                if named:
                    design_system = named
            catalogue_titles = {"raibach-ids": "Raibach IDS"}
            design_catalogue = state.prompt_sessions_api.get_or_create_design_container(
                user_id=uid,
                kind="design_catalogue",
                title=catalogue_titles.get(design_system, design_system.replace("-", " ").title()),
                description="The catalogue this design system's components are drawn from.",
                keys={"design_system": design_system},
            )
            design_title = (design_catalogue or {}).get("title") or "Design"
            # The room is told WHICH catalogue it is in, by id and by system name, so anything
            # that wants to show the same thing the component tree shows reads it from here
            # rather than knowing the default.
            design_catalogue_facts = {
                "system": design_system,
                "id": str(design_catalogue["id"]) if design_catalogue else None,
                "title": design_title,
                # ── AND THE CATALOGUE'S OWN NAME, WHICH IS NOT THE CONTAINER'S TITLE ─────────
                #
                # The owner, 2026-09-30, on the bar at the top of the room: *"The catalog name goes
                # in the top where we put the prompt name."* The container's title is "Raibach IDS"
                # (the design SYSTEM), and the label he wants is the catalogue's own `title` field,
                # read from the file that declares it — "Raibach Prompt Composer Catalog" — which is
                # the same string the tree block below draws at its head. One source, two readers.
                "name": (a2ui_catalog_for("prompt-composer") or {}).get("title") or "Catalog",
                # ── AND THE TWO NUMBERS THE HEAD'S OWN DRAWING HAS PLACES FOR ──────────────
                #
                # The head element (f-40001207-3559, measured from Figma node 40001207:3559)
                # draws a name line, a second line under it, and a description block. Those are the
                # fields the DESIGN has, so these are the facts that load into them: how many
                # components the catalogue declares, and the catalogId it is published at. Read from
                # the catalogue document itself — the same source the tree below reads — so the
                # number on screen and the number in the file cannot disagree.
                "count": f"{len((a2ui_catalog_for('prompt-composer') or {}).get('components') or {})} components",
                "catalogId": (a2ui_catalog_for("prompt-composer") or {}).get("catalogId") or "",
            }

            # ── THE COMPONENTS, READ ON ASSEMBLY AND DELIVERED IN THE TREE ───────────────
            #
            # The owner, 2026-09-30: *"the individual line items in the component data tree would be
            # delivered as metadata from the database… every single component in that list needs to
            # have a representation in the database, it needs to be related to its meta-data."* So
            # the assembly reads them and puts them IN THE DATA MODEL, where a surface can bind to
            # them — the list the room is about. There is no UI for it yet and none is invented
            # here: the items are delivered, with what we measured about each.
            design_elements_list = []
            if state.prompt_sessions_api:
                try:
                    with state.prompt_sessions_api.get_db() as conn:
                        cursor = conn.cursor()
                        cursor.execute(
                            """
                            SELECT title, description, is_archived, metadata
                              FROM prompt_sessions
                             WHERE user_id = %s AND metadata->>'session_type' = 'design_master'
                             ORDER BY metadata->>'element_key'
                            """,
                            (uid,),
                        )
                        for row in cursor.fetchall():
                            if isinstance(row, dict):
                                title, desc, archived, meta = (row.get("title"), row.get("description"),
                                                               row.get("is_archived"), row.get("metadata"))
                            else:
                                title, desc, archived, meta = row
                            if isinstance(meta, str):
                                meta = json.loads(meta) if meta.strip() else {}
                            meta = meta or {}
                            design_elements_list.append({
                                "key": meta.get("element_key"),
                                "name": title,
                                "description": desc or "",
                                "catalogs": meta.get("catalogs") or "",
                                "removed": bool(archived),
                                "figma": meta.get("figma") or {},
                                "last_ingest": meta.get("last_ingest") or {},
                                # ── AND THE SAME ROW IN THE SHAPE A CATALOG ELEMENT DRAWS ──
                                #
                                # The owner, 2026-09-30: *"I want to see the data called from the
                                # database. That's how that list should be assembled. The AI should
                                # be calling the fields from the database and injecting [them] into
                                # something… anything from the lit catalog."*
                                #
                                # So the row carries the fields the catalogue's own list element
                                # reads (`ConsoleCardGrid` → `agent-card`: id, title, description,
                                # status), composed HERE from the row the database holds — not
                                # re-worded by whoever draws it, and not a second list: the raw
                                # facts above stay exactly as they were for every other reader.
                                # The status is the ingestion workflow's own state — removed from
                                # the catalogue, or the verdict the last ingest recorded, or that
                                # nothing has been ingested yet — never a colour invented here.
                                "id": meta.get("element_key"),
                                "title": title,
                                "status": (
                                    "Removed" if archived
                                    else (meta.get("last_ingest") or {}).get("verdict")
                                    or ("Ingested" if meta.get("last_ingest") else "Not ingested")
                                ),
                            })
                        cursor.close()
                except Exception as e:
                    _warn(f"the design section's component list could not be read: {e}")

            # ── WHAT SHE KNOWS WHEN SHE SPEAKS: THE SECTION'S OWN RECORD ────────────────
            #
            # The owner, 2026-09-30: *"she's not talking about anything because she doesn't know
            # what the fuck is going on. She manages all of this — she can remove things, add
            # things, edit that list on the left-hand side — she has to be able to go through that
            # database to understand what the metadata is."*
            #
            # The Composer's seat fills her context from the package's workspace, built from the
            # values the surface bound. Design's metadata is not in a workspace: it is in the
            # elements, the sessions and the conversations, so THAT is what is handed to her —
            # assembled here, from the database, on every assembly. She is not told to guess.
            design_grace_context = design_grace_instructions
            if design_elements_list:
                lines = []
                for e in design_elements_list:
                    last = e.get("last_ingest") or {}
                    fig = e.get("figma") or {}
                    facts = [f"catalogs {e['catalogs']}"]
                    if fig.get("node_id"):
                        facts.append(f"figma node {fig['node_id']}")
                    if last.get("kind"):
                        facts.append(f"last {last['kind']}")
                    if last.get("verdict"):
                        facts.append(f"verdict {last['verdict']}")
                    if e.get("removed"):
                        facts.append("REMOVED from the catalogue")
                    lines.append(f"- {e['key']}: " + "; ".join(facts))
                design_grace_context += (
                    "\n\nTHE COMPONENTS IN THIS SECTION'S CATALOGUE (" + str(len(design_elements_list)) +
                    "), as the database holds them right now:\n" + "\n".join(lines[:60])
                )
            if design_conversations_list:
                design_grace_context += (
                    "\n\nTHE CONVERSATIONS IN THIS SECTION ("
                    + str(len(design_conversations_list)) + "): "
                    + ", ".join(str(c.get("title") or c.get("id")) for c in design_conversations_list[:20])
                )


            # ── THE PROCESSION, IN HER CHAT OUTPUT — FROM THE DATABASE, NOT FROM REACT ───
            #
            # THE INGEST'S OWN NOTE SAYS WHERE IT BELONGS. In its Grace column the record of what
            # this session did is drawn above her under a "Added in this session" toggle, and the
            # file says of itself: *"Eventually a slot in the chat output as part of the trace; for
            # now a section at the top of this column."* The owner, 2026-09-30: *"that is supposed
            # to be in the chat output."*
            #
            # SO IT GOES WHERE THE TRACE ALREADY GOES. The seat emitted in this tree already
            # carries `trace-view` — a TraceFeed bound to `/trace/entries` and
            # `/trace/breadcrumbCount` — and that slot is drawn in her chat output on the rail's
            # Trace tab. The ONE thing missing was that this room's model never carried `/trace`:
            # the shell writes that path for the console's and the composer's models only, and a
            # feed bound to a path that is not there shows its waiting state.
            #
            # AND THE ROWS COME FROM THE DATABASE. Not from the client, and not from a second
            # reader: `_activity_from_db` is the same source the ingest's own procession reads
            # (the activity table first, the log only as its fallback), and each row is put in the
            # feed's own entry shape here rather than by whoever draws it. One source, one author
            # of the sentence — the rule this repository states for every list it renders.
            #
            # A READ THAT FAILS IS REPORTED, NOT SWALLOWED: the warning goes to the backend log and
            # the feed draws its waiting state, which is the truth about a trace nobody could read.
            design_trace_entries: list[dict[str, Any]] = []
            try:
                from routes.figma import _activity_from_db

                _activity_rows = _activity_from_db(
                    # ── SCOPED TO THIS DESIGN TAB, NOT THE WHOLE TOOL ──────────────────────────
                    #
                    # THE OWNER, 2026-09-30: *"the database — remember that activity needs to be
                    # tied to this design tab, it's not global."* He is right, and it is now
                    # possible: the writer records the container.
                    #
                    # IT WAS NOT ALWAYS. A first cut of this scoped to the Design container and
                    # found nothing, because the rows carried an empty `session_id` — measured then:
                    # 255 of 318 rows, the most recent that afternoon. Scoping it was "inventing a
                    # relation the writer does not yet record", so the read was left unscoped and
                    # the comment said why.
                    #
                    # THE WRITER HAS SINCE BEEN FIXED, AND THE FIX IS THE FORM IN THIS ROOM. An
                    # ingest launched from the rail's own Submit sends `sessionId` — the Design
                    # CONTAINER — and the activity table stores it (`routes/figma.py`, the insert
                    # carries `session_id`/`session_title`). Measured again just now, the five most
                    # recent rows:
                    #
                    #   14:21:30  ingested  1d61cd4c-178d-4a53-b833-4b2f42959369  Raibach  40001207:3559
                    #   14:19:47  ingested  1d61cd4c-178d-4a53-b833-4b2f42959369  Raibach  40001207:3559
                    #   …
                    #
                    # and `1d61cd4c-178d-4a53-b833-4b2f42959369` is the `prompt_sessions` row whose
                    # title is `Design` — this tab's own container. The 299 rows that are still
                    # empty are the MODAL's history, written before that and belonging to no
                    # container: they are another tool's record, and this room no longer shows them.
                    #
                    # SO THE READ IS THE CONTAINER'S. A tab that has ingested nothing shows a trace
                    # of nothing — which is a true statement about that tab, and the honest
                    # alternative to showing it every other tab's work.
                    #
                    # ── AND THE PROCESSION, NOT ONLY ITS OUTCOMES ──────────────────────────────
                    #
                    # `outcomes=True` is the filter for a DIFFERENT question: "what was approved,
                    # what failed, what was rejected" — three kinds of event, and NOT the ingest
                    # itself. Measured with it set: the Design container has 5 rows and the read
                    # returned ZERO, because all five are plain `ingested` rows. That is the wrong
                    # list for a trace: this room's procession IS the ingesting, and a tab whose
                    # every ingest is filtered out shows an empty trace after doing real work.
                    # `outcomes=False` asks the container for everything it has, which is what a
                    # trace of this tab means.
                    50, str(design_container["id"]) if design_container else None, False
                ) or []
                for _i, _r in enumerate(_activity_rows):
                    _kind = str(_r.get("kind") or "ingested")
                    _subject = _r.get("tag") or _r.get("nodeName") or _r.get("nodeId") or "component"
                    _error = _r.get("error")
                    design_trace_entries.append({
                        "id": f"{_r.get('jobId') or _subject}:{_r.get('at')}:{_i}",
                        "timestamp": _activity_at_ms(_r.get("at")),
                        # An audit line: the feed's own kind for a record of what happened, and the
                        # level the checker's words carry when something went wrong.
                        "kind": "audit",
                        "level": "error" if _error else "info",
                        "message": f"{_kind} — {_subject}",
                        "detail": str(_error or _r.get("reason") or _r.get("note") or "")[:400],
                    })
            except Exception as e:
                _warn(f"the design room's activity could not be read for the trace: {e}")

            session_value = {
                "id": str(design_container["id"]) if design_container else None,
                "title": design_title,
                "catalogue": design_catalogue_facts,
                # A container is not a draft and has nothing to describe yet. Stated, rather than
                # left out, so the seat reads "none" from the value instead of guessing at a
                # missing key.
                "description": "",
                "is_unsaved": False,
                "left_column": {
                    "saving": False,
                    "sections": initial_sections,
                    "raw_content": json.dumps({"sections": initial_sections}),
                },
                "middle_column": {"compiled_output": "", "running": False},
                "grace_instructions": design_grace_context,
                "elements": design_elements_list,
                # THE CHECKER'S OWN ROWS, at the path the seat's check view binds — composed
                # above with the console's reader, so the list on screen and the list in the
                # report are the same list. Content lives in the data model; the component
                # references it as `/session/checks` and holds no rows of its own.
                "checks": design_check_rows,
                # ── THE INGEST FORM'S OWN STATE, WHICH THE HOST OWNS ────────────────────────
                #
                # `figma-ingest-form` refuses to decide two things — whether an ingest is running
                # and why Submit is blocked — because only the caller that made the call knows. The
                # host writes them HERE, and they reach the form because a bound path is re-applied
                # on every data-model change (see the note where the form is emitted: a COMPONENTS
                # change does not re-apply props, so patching the component is a write nothing
                # reads). `refresh` is the tree's re-read trigger, bumped after an ingest lands.
                "ingest": {"busy": False, "message": "", "refresh": 0},
                "right_column": {"conversation_id": design_conversation,
                                 "conversations": design_conversations_list},
            }
        else:
            session_value = {
                "id": None,  # in-memory only until explicit Save
                "title": suggested_title,  # AI-generated
                # A package being drafted has no description until someone writes
                # one; stated, so the seat reads "none" from the model rather than
                # from a missing key it has to interpret.
                "description": "",
                "is_unsaved": True,
                "left_column": {
                    "saving": False,
                    "sections": initial_sections,  # slot contract (fixed), sections are AI-generated
                    # The seat beside this column reads the workspace from
                    # raw_content (chat-panel.leftColumnContent). A fresh
                    # package has no row yet, so the writer supplies the same
                    # JSON shape the database stores — without it Grace is
                    # handed nothing and answers "the workspace is empty".
                    "raw_content": json.dumps({"sections": initial_sections}),
                },
                "middle_column": {"compiled_output": "", "running": False},  # slot contract (fixed)
                # ── WHO SHE IS HERE — A COMPOSER'S ROOM, AND SAID BY THE SERVER ────────────────
                #
                # This is the script that used to live only in the seat (`chat-panel.ts`), 11,562
                # characters of it, sent as every turn's context in every room the seat was put in.
                # The room owns her words now: the same script supplies them here, and the seat is
                # bound to this path by the assembly (`_seat_grace`), so a room that states nothing
                # cannot be answered in another room's voice. The owner, 2026-10-01: *"There are no
                # fallbacks in the system."*
                "grace_instructions": COMPOSER_GRACE_INSTRUCTIONS,
                "right_column": {"conversation_id": None, "conversations": []},      # slot contract (fixed), chat is mostly static
            }

        # ── WHICH CATALOGUE THE SURFACE SAYS IT IS DRAWN FROM ───────────────────────────
        #
        # A DESIGN SURFACE ANNOUNCES DESIGN'S CATALOGUE. This announced the Composer's for
        # every surface the branch builds, which was true while Design's tree came from the
        # Composer's contract — and stopped being true the moment the branch above started
        # emitting `design-left-panel` and `design-middle-container`, neither of which is in
        # that catalogue. Announcing a catalogue that does not contain the surface's own
        # components is a lie about where its names come from, and since the client resolves
        # names against its own tables (`tag-registry.ts`), the announcement is exactly how
        # the two halves are kept honest — see `a2ui_catalog_id` in deps.py.
        surface_catalog_id = (
            a2ui_catalog_id("design-artifacts")
            if intent.startswith("render-design")
            else A2UI_CATALOG_ID
        )

        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": surface_catalog_id
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components  # AI-generated, not hardcoded
                }
            },
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "session": session_value,
                        # THE ROOM'S OWN TRACE, FOR THE ROOM WHOSE TRACE IS THE INGEST'S RECORD.
                        # Console and composer models get this path from the shell (the app's own
                        # logger); Design's procession is what the ingest did to this catalogue, so
                        # it is composed above, from the database, and carried here — which is why
                        # nothing on the client writes it. Absent for every other intent, where the
                        # name is never evaluated (the conditional is lazy).
                        **(
                            {"trace": {"entries": design_trace_entries, "breadcrumbCount": 0}}
                            if intent.startswith("render-design")
                            else {}
                        ),
                        "ai_message": ai_message,  # AI-generated
                        "grace_greeting": True,
                        "suggested_title": suggested_title,  # AI-generated
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True,
                        "usage": dict(LAST_USAGE)  # measured, straight from the provider
                    }
                }
            }
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: render-session:{id}
    # ═══════════════════════════════════════════════════════════════
    elif intent.startswith("render-session:"):
        session_id = intent.split(":")[1] if ":" in intent else request.session_id

        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID required for render-session intent")

        if not state.prompt_sessions_api:
            raise HTTPException(status_code=503, detail="A2UI FAILURE: Database not available")

        # ── PERFORMANCE TRACE: Milestone A (Database) ──
        t_a_start = time.perf_counter()

        # Fetch session from PostgreSQL
        session = state.prompt_sessions_api.get_session(user_id=uid, session_id=session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Fetch Milvus versions
        milvus_versions = []
        try:
            milvus_versions = milvus_get_versions(prompt_id=session_id)
        except Exception as e:
            _warn(f"the version list could not be read from the vector store (the row's own versions are unaffected): {e}")

        ms_a = (time.perf_counter() - t_a_start) * 1000

        # Parse stored data
        sections = []
        try:
            if session.get("left_column_content"):
                parsed = json.loads(session["left_column_content"])
                sections = parsed.get("sections", [])
        except Exception:
            pass

        # Fetch actual conversation messages (for ChatPanel history on mount)
        #
        # ── THE PACKAGE'S CONVERSATION IS FOUND BY ITS OWNER, NOT BY A COPY ────
        # A conversation is owned by the package through `conversations.session_id` —
        # the frontend states the rule outright ("Conversations are package-owned: the
        # conversation row already carries session_id — prompt_sessions.conversation_id
        # was dropped"). This read used the dropped copy instead, so the surface bound
        # whatever that column held. Measured 2026-09-17: 8 conversations owned by 4
        # packages, and only 2 of 265 packages carry conversation_id — so a package with
        # a real conversation was told there was none, and the seat drew "No
        # conversations yet." over it. That is the same severed wire as the output column
        # and the repair list: the data existed, the read looked somewhere else.
        # ── THE PACKAGE'S CONVERSATIONS, AS A LIST — the Conversations dropdown's rows ──
        #
        # The dropdown at the top of the chat column binds its list to the package's
        # conversations (its `Data:` line), the element declares `conversations`, and this
        # payload had no such path — so the closed dropdown drew its empty sentence over a
        # package that owns a conversation with eight turns in it. The lookup below was
        # already being made; its result was used for `conv_id` and then thrown away, and
        # it was only made on the branch where the package had no `conversation_id`, so the
        # list existed as a side effect of a fallback rather than as data.
        #
        # It is one read, the owner's own (`conversations.session_id`), and both facts come
        # out of it: which conversation the seat is in, and the list to choose from.
        conversations_list = []
        if state.conversation_api:
            try:
                conversations_list = state.conversation_api.get_conversations_by_session(session_id, uid)
            except Exception as e:
                _warn(f"package {str(session_id)[:8]}…'s conversation list could not be read, so the seat has none to offer: {e}")

        conv_id = session.get("conversation_id")
        if not conv_id and conversations_list:
            conv_id = conversations_list[0].get("id")
            print(f"[A2UI Surface] {session_id} owns {len(conversations_list)} conversation(s) — "
                  f"bound {str(conv_id)[:8]}… (conversations.session_id, not the dropped column)")
        # NO SECOND FETCH (2026-09-18). Two hundred messages were read here on every assembly
        # to compute ONE number for the assembler's data summary — and then written to
        # /session/right_column/messages, a path NO component binds (the seat loads its own
        # history through _loadHistory). `get_session` above already carries them; the count
        # comes from there, and the catch that swallowed a PermissionError into a print went
        # with the fetch.
        message_count = len(session.get("messages") or [])

        # ── TRUE A2UI: MODEL IS THE ARCHITECT ──
        # DB supplies the data. The model MUST return the components (adjacency list).
        # Hard-fail (503) if the model cannot assemble the surface structure.
        # No hardcoded components. No greeting-only shortcut.
        session_info = {
            "title": session.get("title"),
            "sections_count": len(sections),
            "has_compiled": bool(session.get("compiled_output")),
            "milvus_count": len(milvus_versions),
            "message_count": message_count,
        }
        llm_prompt = f"""You are Grace, the A2UI surface assembler.
{render_tools_block()}

User is loading saved session: "{session.get('title') or 'Untitled'}".

Data summary:
{json.dumps(session_info)}

Assemble the FULL surface with A2UI v0.9.1.

CATALOG (use these):
- left-column-header (title: {{"path": "/session/title"}}) — the prompt's own bar, in the
  container's "left-header" slot, ABOVE the sections and outside their scroller, so the
  title and version stay put while the sections scroll under them
- prompt-section-editor (sections: {{"path": "/session/left_column/sections"}})
- control-bar (no props) — in the container's "left-footer" slot, at the bottom of the left column
- compiled-output-viewer (content: {{"path": "/session/middle_column/compiled_output"}})
- chat-panel (conversationId: {{"path": "/session/right_column/conversation_id"}})
- TraceFeed (entries: {{"path": "/trace/entries"}}, breadcrumbCount: {{"path": "/trace/breadcrumbCount"}}) — the chat panel's "view" slot child, for the rail's Trace tab
- workspace-layout (resizable host for the three panes)

REQUIREMENTS:
1. id "root", component "workspace-layout" — the host IS the root, with no Column
   above it. Its panes are NAMED slots, so "children" is an OBJECT keyed by slot
   name; the array form fills nothing.
2. Bind the panes to the paths above
3. Short ai_message that says what is on screen
4. "right-col" carries "allowedTabs": "chat,trace,tools,executions,eval,settings".
   THE MENU IS THE PLACE: this is a package's own seat, so it offers the tools,
   runs and evals THIS package has — and not approvals, which belong to the
   console, the one seat that sees every package at once. Emit it exactly as written.

The session IS the three panes: do NOT greet. Not "Welcome back", no time of day,
no return salutation — the operator is already in the session they opened.

Output ONLY this JSON (no markdown):
{{
  "components": [
    {{"id": "root", "component": "workspace-layout", "isThirdOpen": true, "children": {{"left-header": "left-hdr", "left": "left-col", "left-footer": "control-bar", "right": "right-col"}}}},
    {{"id": "left-hdr", "component": "left-column-header", "title": {{"path": "/session/title"}}, "version": {{"path": "/session/version"}}, "promptId": {{"path": "/session/id"}}}},
    {{"id": "left-col", "component": "prompt-section-editor", "sections": {{"path": "/session/left_column/sections"}}}},
    {{"id": "control-bar", "component": "control-bar", "isSaving": {{"path": "/session/left_column/saving"}}, "isRunning": {{"path": "/session/middle_column/running"}}}},
    {{"id": "middle-col", "component": "compiled-output-viewer", "content": {{"path": "/session/middle_column/compiled_output"}}}},
    {{"id": "right-col", "component": "chat-panel", "allowedTabs": "chat,trace,tools,executions,eval,settings", "conversationId": {{"path": "/session/right_column/conversation_id"}}, "conversations": {{"path": "/session/right_column/conversations"}}, "sessionId": {{"path": "/session/id"}}, "packageTitle": {{"path": "/session/title"}}, "packageDescription": {{"path": "/session/description"}}, "leftColumnContent": {{"path": "/session/left_column/sections"}}, "compiledOutput": {{"path": "/session/middle_column/compiled_output"}}, "children": {{"view": ["trace-view", "eval-view"]}}}},
    {{"id": "trace-view", "component": "TraceFeed", "entries": {{"path": "/trace/entries"}}, "breadcrumbCount": {{"path": "/trace/breadcrumbCount"}}}}
    {{"id": "eval-view", "component": "EvalFeed", "evaluations": {{"path": "/session/middle_column/evaluations"}}}}
  ],
  "ai_message": "Session open — your three panes are loaded."
}}
"""

        # ── PERFORMANCE TRACE: Milestone B (Network/LLM) ──
        ms_b = 0.0
        ms_c = 0.0
        t_b_start = time.perf_counter()
        llm_response = query_llm(
            question=llm_prompt,
            mode="surface_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-session"
            # model intentionally omitted — use the enabled provider's default
        )
        ms_b = (time.perf_counter() - t_b_start) * 1000

        if not llm_response or not llm_response.strip():
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface."
            )
        if llm_response.strip().startswith("Error:"):
            raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

        # ── PERFORMANCE TRACE: Milestone C (Validation/Parse) ──
        t_c_start = time.perf_counter()
        response_text = llm_response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            # This place is a package: its own versions, tools, runs and evals — no approvals.
            _seat_tabs(components, PACKAGE_TABS)
            # AND HER WORDS — the same script the composer room gets. A session's canvas and a run's
            # flow view are the same package room: the work is open and she writes into it.
            _seat_grace(components, "/session", True)
            ai_message = parsed.get("ai_message", f"{session.get('title') or 'Untitled'} is open.")
            if not isinstance(components, list) or len(components) == 0:
                raise ValueError("components must be non-empty array")
            ms_c = (time.perf_counter() - t_c_start) * 1000
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(f"[A2UI Session] AI response parse FAILED: {e}")
            print(f"[A2UI Session] Raw response: {response_text[:500]}")
            raise HTTPException(
                status_code=503, 
                detail=f"A2UI FAILURE: AI returned invalid JSON - {e!s}"
            )

        elapsed_ms = int((time.time() - start_time) * 1000)

        # ── PERFORMANCE TRACE: LOG BREAKDOWN ──
        print(f"\n{'='*60}")
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent=render-session | total={elapsed_ms}ms")
        print(f"  Milestone A (Database - get_session+milvus): {ms_a:8.1f}ms")
        print(f"  Milestone B (Network/LLM - query_llm):       {ms_b:8.1f}ms")
        print(f"  Milestone C (Validation - JSON parse):        {ms_c:8.1f}ms")
        print(f"  Remainder (other):                            {elapsed_ms - ms_a - ms_b - ms_c:8.1f}ms")
        print(f"{'='*60}\n")

        # ═══════════════════════════════════════════════════════════════
        # A2UI v0.9.1 ENVELOPE RESPONSE - AI-GENERATED COMPONENTS
        # ═══════════════════════════════════════════════════════════════
        validate_a2ui_components(components)
        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": A2UI_CATALOG_ID
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components
                }
            },
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "session": {
                            "id": str(session_id),
                            "title": session.get("title"),
                            # THE VERSION, SO THE BAR CAN STATE IT. The row carries
                            # current_version and nothing was putting it on the data model,
                            # so the prompt's bar had nothing to bind and drew its empty
                            # label. One value, one path, the same as the title.
                            "version": session.get("current_version") or 1,
                            # THE DESCRIPTION, WHICH SHE IS ASKED TO JUDGE. The review before a
                            # Run requires one, so the seat that asks for it has to be able to
                            # READ it — measured 2026-09-23: the description was written and she
                            # went on saying the package had none, because nothing ever put it
                            # in front of her. One value, one path, the same as the title.
                            "description": session.get("description") or "",
                            "is_unsaved": False,
                            "left_column": {
                                "sections": sections,
                                "raw_content": session.get("left_column_content"),
                                # The bottom bar's two busy flags. They start false and the
                                # client owns them from there: pressing Save Template or RUN
                                # sets one, the bar binds it by path, and the spinner the
                                # drawing asks for (state=Compiling / state=Running) appears
                                # on the button that was pressed.
                                "saving": False,
                            },
                            "middle_column": {
                                "compiled_output": session.get("compiled_output"),
                                "running": False,
                            },
                            # A SESSION IS THE SAME PACKAGE ROOM, so it is the same room's words —
                            # see the composer's own note where this value is written for a package
                            # that has not been saved yet.
                            "grace_instructions": COMPOSER_GRACE_INSTRUCTIONS,
                            "right_column": {
                                # THE RESOLVED ID, not the dropped column. Binding
                                # `session.conversation_id` here was why the seat had
                                # history it could not write to: with no id, every send
                                # created ANOTHER conversation for the package — measured
                                # 2026-09-17, this package owned four, two messages each,
                                # and no way to say which one it was looking at.
                                "conversation_id": str(conv_id) if conv_id else None,
                                # The Conversations dropdown's rows. Same read as the id
                                # above — the package's own conversations, newest first —
                                # bound to the element's `conversations` prop by the
                                # assembled surface.
                                "conversations": [
                                    {
                                        "id": str(c.get("id")),
                                        "title": c.get("title") or "(untitled)",
                                    }
                                    for c in conversations_list
                                ],
                                # (The messages themselves are not carried here: nothing binds
                                # /session/right_column/messages — see the note where the
                                # second fetch used to be.)
                            },
                        },
                        "milvus": {
                            "versions": milvus_versions,
                            "version_count": len(milvus_versions),
                        },
                        "metadata": {
                            "version": session.get("current_version"),
                            "created_at": str(session.get("created_at")) if session.get("created_at") else None,
                            "updated_at": str(session.get("updated_at")) if session.get("updated_at") else None,
                            "column_widths": session.get("metadata", {}).get("column_widths") if session.get("metadata") else None,
                            # The place as it was saved — the view applies it on opening a
                            # package (WritingAreaIndex), the same way column_widths is
                            # applied to the columns.
                            "workspace": session.get("metadata", {}).get("workspace") if session.get("metadata") else None,
                        },
                        "ai_message": ai_message,
                        "warnings": _drain_warnings(),
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True
                    }
                }
            }
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: render-run[:{id}] — THE THIRD COLUMN, ASSEMBLED
    # ═══════════════════════════════════════════════════════════════
    #
    # A RUN DOES NOT RESHAPE THE SURFACE BY HAND. The third column is a surface like the
    # console's cards and a package's three panes, so the model assembles it the same way —
    # against this catalog, in this endpoint — and the shell applies what it is given.
    #
    # WHAT THIS REPLACES, MEASURED 2026-09-23 (READ-ME/CONTINUE-HERE.md §00c): the host wrote
    # the components itself. `setOutputColumn('flow')` built `AgentCanvas` with its three
    # slots and pushed `AgentFlow`, `OutputControls` and `CanvasFooter` straight into the
    # live component list, in TypeScript, on the Run — so the one surface a person watches
    # most closely was the one the protocol did not build. The owner's charge: "if those
    # nodes are not being called from the A2UI library by a model, then you've not only
    # violated the protocol, you've created this jarring effect."
    #
    # AN UPDATE, NOT A REPLACEMENT, and that is what makes a Run different from opening a
    # package. `render-session` returns the whole tree and the whole model because the
    # package IS the surface. A Run changes ONE COLUMN of a surface that is already on
    # screen and already carries facts the server does not have — the rows as they stand in
    # the editor, the conversation on screen, the places nodes were dragged to. So the
    # caller states the ids the assembly must land on (`context.run`), the model returns the
    # components to add and update, and the shell applies them as an update. A run that
    # replaced the tree would revert a person's unsaved rows to the last saved ones, which
    # is the second-writer disease this repository has spent the week removing.
    #
    # THE OTHER SLOTS ARE CHECKED, NOT TRUSTED. The layout's left, left-header, left-footer
    # and right slots are stated to the model, and the root it returns must carry them back
    # byte for byte. An assembly that rewrote them would take the prompt or Grace off the
    # screen, and it would do it while a person was watching a Run — so it is a 503 with the
    # difference named, never a silent acceptance.
    elif intent == "render-run" or intent.startswith("render-run:"):
        run = request.context.run if (request.context and request.context.run) else None
        layout_id = str((run or {}).get("layoutId") or "").strip()
        middle_id = str((run or {}).get("middleId") or "").strip()
        slots = (run or {}).get("slots")
        if not layout_id or not isinstance(slots, dict) or not slots:
            raise HTTPException(
                status_code=503,
                detail=(
                    "A2UI FAILURE: a Run must state the surface it is assembling into — the "
                    "layout's root id, its other slots, and the component in the middle today "
                    "(context.run). Without them an assembled third column cannot land on the "
                    "screen that is already there, and the columns beside it would be replaced."
                ),
            )

        package = (run or {}).get("package") or {}
        run_info = {
            "package_title": package.get("title") or "Untitled",
            "package_saved": bool(package.get("id")),
            "rows_about_to_run": package.get("rows") or 0,
            "seats": package.get("seats") or [],
            "middle_component_today": middle_id or None,
        }

        t_b_start = time.perf_counter()
        llm_response = query_llm(
            question=f"""You are Grace, the A2UI surface assembler.

A person pressed RUN. The prompt column has folded back to its rail and the THIRD COLUMN —
the canvas — is opening in the room that appears between the columns. YOU assemble that
column. The renderer draws the components you return and nothing else, so a part you leave
out is a part of the screen that will not exist.

{_catalog_component_vocabulary()}

THE SESSION'S FACTS
{json.dumps(run_info)}

THE SURFACE YOU ARE UPDATING — read this as a fact, not as a suggestion:
- The layout's root is "{layout_id}" (workspace-layout). Its OTHER slots are already filled
  and MUST come back exactly as given here:
{json.dumps(slots, indent=2)}
- The component standing in the middle column today is "{middle_id or '(none yet)'}". It is
  where the canvas goes: keep that id, and give it the canvas's three slots.

REQUIREMENTS (a Run's column, drawn against the catalog):
1. The middle component becomes AgentCanvas with "theme": "dark" — a Run's picture is shown
   dark — and its "children" filled BY NAME: header, flow, footer. Those three slot names
   are the whole of it; this element renders no other slot.
2. header: OutputControls — the column's own controls, with "outputType": "Agent Flow".
3. flow: AgentFlow — THE DRAWING. Bind its "flow" to {{"path": "/session/middle_column/flow"}}
   and set "theme": "dark". THE NODES COME FROM THAT PATH: do not invent nodes, do not send a
   "flow" value, and do not describe the prompt's rows here. The shell derives them from the
   rows the person is running.
4. footer: CanvasFooter — the column's own foot, with "theme": "dark".
5. The first component in your list is the layout root: same id, its other slots EXACTLY as
   given above, plus "middle" pointing at the component from requirement 1.
6. Name the three children "{middle_id}-header", "{middle_id}-flow", "{middle_id}-footer" —
   ids a second Run can land on again.
7. One short ai_message that says the drawing is being assembled, in the app's own voice.
   No greeting, no salutation, no question.

Output ONLY this JSON (no markdown, no envelope wrapper, no text after it):
{{
  "components": [
    {{"id": "{layout_id}", "component": "workspace-layout", "children": {{...the slots above..., "middle": "{middle_id}"}}}},
    {{"id": "{middle_id}", "component": "AgentCanvas", "theme": "dark", "children": {{"header": "{middle_id}-header", "flow": "{middle_id}-flow", "footer": "{middle_id}-footer"}}}},
    {{"id": "{middle_id}-header", "component": "OutputControls", "outputType": "Agent Flow"}},
    {{"id": "{middle_id}-flow", "component": "AgentFlow", "theme": "dark", "flow": {{"path": "/session/middle_column/flow"}}}},
    {{"id": "{middle_id}-footer", "component": "CanvasFooter", "theme": "dark"}}
  ],
  "ai_message": "Assembling the drawing — the picture appears as it is built."
}}""",
            mode="surface_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-run"
            # model intentionally omitted — use the enabled provider's default
        )
        ms_b = (time.perf_counter() - t_b_start) * 1000

        if not llm_response or not llm_response.strip():
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface."
            )
        if llm_response.strip().startswith("Error:"):
            raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

        response_text = llm_response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            if not isinstance(components, list) or not components:
                raise ValueError("components must be a non-empty array")
            # A RUN REPLACES THE LAYOUT, so the seat in the new tree must state the same facts the
            # seat in the old one did — a run is still the same package room, and Grace judges the
            # prompt before it and reports on it after. See `_seat_grace`. The model's own answer is
            # not trusted to carry her script: measured 2026-10-01, that is exactly how the design
            # room's seat held the right words only when the answer happened to reproduce the line.
            _seat_grace(components, "/session", True)

            # THE LAYOUT COMES BACK WHOLE, OR NOTHING DOES. See the note above this branch:
            # the prompt and Grace are in those slots, and a Run may not take them away.
            root = next((c for c in components if isinstance(c, dict) and c.get("id") == layout_id), None)
            if root is None:
                raise ValueError(f"the layout root \"{layout_id}\" is not in the assembly")
            children = root.get("children")
            if not isinstance(children, dict):
                raise ValueError("the layout root came back with no children")
            beside = {k: v for k, v in children.items() if k != "middle"}
            if beside != slots:
                raise ValueError(
                    "the assembly rewrote the layout's other slots, which a Run may not do — "
                    f"given {json.dumps(slots)}, got {json.dumps(beside)}"
                )
            middle_target = children.get("middle")
            if not isinstance(middle_target, str) or not middle_target:
                raise ValueError("the layout root does not point its middle slot at the canvas")
            if not any(isinstance(c, dict) and c.get("id") == middle_target for c in components):
                raise ValueError(f"the middle slot points at \"{middle_target}\", which the assembly did not emit")

            # Every name and id is validated against the catalog with the same gate every
            # other assembly passes. A canvas that is not in the catalog draws an error
            # block in the middle of the picture, so it fails here instead.
            validate_a2ui_components(components)
            ai_message = str(parsed.get("ai_message") or "").strip() or "Assembling the drawing."
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(
                f"[A2UI Run] AI RESPONSE PARSE FAILED:\n"
                f"  error_type: {type(e).__name__}\n"
                f"  error_message: {e}\n"
                f"  llm_response_length: {len(response_text)}\n"
                f"  llm_response_first_500: {response_text[:500]}\n"
                f"  timestamp: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}"
            )
            raise HTTPException(
                status_code=503,
                detail=f"A2UI FAILURE: AI returned invalid JSON for render-run — {type(e).__name__}: {e!s}. Raw (first 300 chars): {response_text[:300]}"
            )

        elapsed_ms = int((time.time() - start_time) * 1000)
        print(f"\n{'='*60}")
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent=render-run | total={elapsed_ms}ms")
        print(f"  Milestone B (Network/LLM - query_llm):     {ms_b:8.1f}ms")
        print(f"{'='*60}\n")
        print(f"[A2UI Run] assembled the third column: {middle_target} — "
              f"{[c.get('component') for c in components if isinstance(c, dict)]}")

        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": A2UI_CATALOG_ID
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components  # AI-generated, not hardcoded
                }
            },
            {
                # A PATH, NOT THE ROOT. A Run updates a surface that is already carrying the
                # person's rows and their conversation, so the assembly writes only the box
                # it owns: a root write would replace the whole model with these few facts.
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/run",
                    "value": {
                        "ai_message": ai_message,
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True,
                        "usage": dict(LAST_USAGE),  # measured, straight from the provider
                    }
                }
            }
        ]

    else:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown intent: {intent}. Valid intents: render-console, render-composer, "
                f"render-design, render-section:{{id}}, render-session:{{id}}, render-run[:{{id}}]"
            )
        )


class AIConfirmExitRequest(BaseModel):
    """Request body for Grace's exit confirmation."""
    has_unsaved_changes: bool = True
    session_title: str | None = None
    content_preview: str | None = None  # First ~100 chars of content
    destination: str | None = None  # Where user is trying to go


@router.post("/api/ai/confirm-exit")
async def ai_confirm_exit(
    request: AIConfirmExitRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    STRICT A2UI: Grace asks the user about unsaved changes.

    When the user tries to navigate away from unsaved work,
    Grace speaks to them conversationally in the chat panel.
    """
    start_time = time.time()

    # Build context for Grace
    context = ""
    if request.session_title:
        context += f"Session title: {request.session_title}. "
    if request.content_preview:
        context += f"Content preview: {request.content_preview[:100]}... "
    if request.destination:
        context += f"User wants to go to: {request.destination}. "

    llm_prompt = f"""You are Grace, a friendly AI assistant in a prompt engineering workspace.
The user has unsaved work and is trying to navigate away.

{context}

Generate a warm, conversational message asking if they want to save their work.
Be friendly but not annoying. Keep it to 1-2 sentences.
Sound like a helpful friend, not a robot.

Output ONLY valid JSON:
{{"ai_message": "Your friendly message here"}}"""

    ai_message = "Hold on — you've got unsaved work here. Want me to save it before you go?"

    try:
        # Off the event loop, like the save-time summary call: this route is
        # `async def` and query_llm blocks for up to 10s per attempt, so an
        # inline call stalls every other request in the process behind a
        # sentence asking whether to save.
        llm_response = await asyncio.to_thread(
            query_llm,
            question=llm_prompt,
            mode="console_assembly",
            temperature=0.8,  # More personality
            prompt_id="confirm-exit",
        )

        if llm_response and llm_response.strip():
            response_text = llm_response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            try:
                parsed = _extract_json_payload(response_text)
                ai_message = parsed.get("ai_message", ai_message)
            except json.JSONDecodeError:
                ai_message = llm_response.strip()[:150]
    except Exception as e:
        _warn(f"the exit-confirmation sentence fell back to the default — the model did not answer: {e}")

    elapsed_ms = int((time.time() - start_time) * 1000)

    return {
        "status": "ok",
        "assembly_time_ms": elapsed_ms,
        "ai_message": ai_message,
        "warnings": _drain_warnings(),
        "grace_speaking": True,
        "actions": [
            {"label": "Save & Go", "intent": "save-and-navigate", "primary": True},
            {"label": "Don't Save", "intent": "discard-and-navigate", "destructive": True},
            {"label": "Stay Here", "intent": "cancel-navigation"},
        ]
    }


class AISaveSurfaceRequest(BaseModel):
    """Request body for AI-driven surface save."""
    session_id: str | None = None
    title: str | None = None
    left_column: dict | None = None  # sections, positions
    middle_column: dict | None = None  # compiled_output, model_used
    right_column: dict | None = None  # conversation_id, messages
    column_widths: dict | None = None  # { left: number|null, chat: number }
    # THE PLACE AS IT WAS LEFT — the state the ELEMENTS hold and a save reads off them:
    # { leftCollapsed, seat: {open, width}, flow: {zoom, panX, panY} }. Optional on purpose:
    # a save that does not know the arrangement must not erase one that does.
    workspace: dict | None = None


@router.post("/api/ai/save-surface")
async def ai_save_surface(
    request: AISaveSurfaceRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    AI-driven Surface Save command.

    When the user clicks Save, the AI:
    1. Analyzes the current surface state
    2. Compiles section content into a unified prompt
    3. Generates metadata (description, suggested title)
    4. Persists to PostgreSQL + Milvus atomically

    This is NOT a webpage form submission - it's an AI command.
    The AI captures and compiles the complete surface state before saving.
    """
    start_time = time.time()

    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    uid = get_user_id_from_header(x_user_id)

    try:
        # Build left_column_content JSON from sections
        sections = request.left_column.get("sections", []) if request.left_column else []
        left_column_content = json.dumps({
            "sections": sections,
            "metadata": {
                "savedAt": datetime.now().isoformat(),
                "sectionCount": len(sections),
            }
        })

        compiled_output = request.middle_column.get("compiled_output", "") if request.middle_column else ""
        conversation_id = request.right_column.get("conversation_id") if request.right_column else None
        # ══════════════════════════════════════════════════════════════════════
        # A2UI: AI COMPILES THE SURFACE STATE BEFORE SAVING
        # The AI analyzes all sections and generates:
        # - compiled_output: The unified prompt from all sections
        # - description: A semantic summary for search/categorization
        # - suggested_title: A better title if the current one is generic
        # ══════════════════════════════════════════════════════════════════════
        ai_compilation = None
        llm_used = False

        # Only call LLM if we have actual content to compile
        section_contents = [s.get("content", "") for s in sections if s.get("content", "").strip()]
        if section_contents:
            try:
                # Build the sections summary for the LLM
                sections_text = "\n\n".join([
                    f"### {s.get('section', s.get('role', 'Unknown'))}:\n{s.get('content', '')}"
                    for s in sections if s.get("content", "").strip()
                ])

                # What only a model can write is the SUMMARY the semantic index
                # needs. This call used to be asked for the whole compiled prompt
                # inside its JSON envelope as well — a second copy of text the row
                # already holds, produced at a 4000-token budget. It came back 4228
                # characters long and unparseable ("Expecting value: line 1 column
                # 1 (char 0)"), so ai_compilation stayed None and the caller was
                # told "AI compilation FAILED" about a save that had already been
                # written. The row's output column is not this call's business: it
                # is the caller's, or the sections joined (see _compose_sections).
                llm_prompt = f"""You are Grace, the AI assistant for a prompt engineering workspace.
The user is saving their prompt template. Read the sections and write down what the prompt is for.

Generate:

1. description: A 1-2 sentence semantic summary of what this prompt does.
   This will be used for SEMANTIC SEARCH — write it so that searching "prompt about X" will find it.

2. suggested_title: If the current title "{request.title or 'Untitled'}" is generic or doesn't
   describe the prompt well, suggest a better descriptive title (max 6 words). Otherwise, keep the current title.

3. tags: Extract 5-10 semantic keywords/tags that describe this prompt's purpose, domain, and techniques.
   These enable search like "find prompts about customer service" or "prompts using chain-of-thought".

Current sections:
{sections_text}

Output ONLY valid JSON:
{{"description": "Brief summary of the prompt's purpose", "suggested_title": "A descriptive title", "tags": ["tag1", "tag2", "tag3"]}}"""

                # OFF THE EVENT LOOP. `query_llm` is a BLOCKING call — up to 10s
                # per attempt, one retry — and this route is `async def`. Called
                # inline it froze every other request in the process for the whole
                # provider call: the next assemble, the catalog check, the chat,
                # the next Save. That is what "it is still saving, it is still
                # compiling" was, and why the app could not be touched while a
                # description was being written. A database write does not get to
                # hold the server while a model thinks.
                llm_response = await asyncio.to_thread(
                    query_llm,
                    question=llm_prompt,
                    mode="console_assembly",
                    temperature=0.3,  # Low creativity for consistent compilation
                    prompt_id="save-surface-compile",
                )

                if llm_response and llm_response.strip():
                    response_text = llm_response.strip()
                    # Extract JSON from code blocks if present
                    if "```json" in response_text:
                        response_text = response_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in response_text:
                        response_text = response_text.split("```")[1].split("```")[0].strip()

                    try:
                        ai_compilation = _extract_json_payload(response_text)
                        llm_used = True
                        print(
                            f"[AI Save] LLM summary: "
                            f"{len(ai_compilation.get('description', ''))} chars, "
                            f"{len(ai_compilation.get('tags') or [])} tags"
                        )
                    except (json.JSONDecodeError, ValueError) as e:
                        _warn(f"the model's summary was not valid JSON, so the save carries no summary: {e}")
            except Exception as e:
                _warn(f"the save summary could not be written by the model; the save continues without one: {e}")

        # The client's middle_column is authoritative whenever it carries a
        # compiled_output key at all: an explicit value — including an explicitly
        # EMPTY one — is the user's decision and is stored exactly as sent.
        #
        # Clearing the output column and then saving used to be silently undone
        # right here. An intentionally empty value was indistinguishable from
        # "this caller said nothing about output", so freshly compiled text was
        # written over the Clear — and the response still reported the save as a
        # success. The gap-fill below is kept for the case it was written for: a
        # Save that carries no output at all must not blank out the result of a
        # Run. What fills it is now the sections joined in order rather than a
        # model's second copy of them: same text it was written for, no tokens,
        # and no way for a model's formatting to decide what a saved row holds.
        output_was_sent = "compiled_output" in (request.middle_column or {})
        if not output_was_sent and not (compiled_output or "").strip():
            compiled_output = _compose_sections(sections)

        # Update title if AI suggested a better one
        if (ai_compilation and ai_compilation.get("suggested_title")
                and request.title in [None, "", "Untitled", "New Prompt Agent"]):
            request.title = ai_compilation["suggested_title"]

        # The row keeps the model's description, or none at all. There is
        # deliberately no fallback string: the caller used to receive
        # f"Prompt with {len(sections)} sections" whenever the model gave nothing,
        # which reads as a description of the package but describes only how many
        # sections it happens to contain. That literal is now written into no row.
        ai_description = ai_compilation.get("description", "") if ai_compilation else ""
        session_description = ai_description or ""

        # Build metadata including AI compilation info + column widths
        save_metadata = {
            "savedBy": "ai_save_surface",
            "llm_used": llm_used,
            "ai_compiled": ai_compilation is not None,
            "column_widths": request.column_widths,
            # A real Save un-drafts the package. Whole-column replacement used to produce
            # this by accident — the key simply was not in the new dict. update_session now
            # merges (see there), so the save must say it itself or drafts never surface.
            "draft": None,
        }
        if ai_description:
            save_metadata["ai_description"] = ai_description

        # WHERE THE PERSON LEFT OFF, kept with the package. Written ONLY when the caller sent
        # one — a client that cannot see the arrangement (an API caller, an older page) would
        # otherwise blank a stored one on the next save. Same reason the field is optional.
        if request.workspace:
            save_metadata["workspace"] = request.workspace

        # Read what the row holds BEFORE this save, so the version written below
        # can be compared against it. Without this, a Save where nothing changed
        # would manufacture a version recording no change.
        previous_state = None
        if request.session_id:
            try:
                previous_state = state.prompt_sessions_api.get_session(
                    session_id=request.session_id, user_id=uid
                )
            except Exception as e:
                _warn(f"the row could not be read before this save, so no version was written to compare against: {e}")

        if request.session_id:
            # UPDATE existing session
            session = state.prompt_sessions_api.update_session(
                user_id=uid,
                session_id=request.session_id,
                title=request.title,
                description=session_description,
                left_column_content=left_column_content,
                compiled_output=compiled_output,
                conversation_id=conversation_id,
                metadata=save_metadata,
            )
            action = "updated"
        else:
            # CREATE new session (create_session only accepts user_id, title, description)
            title = request.title or f"Prompt - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            session = state.prompt_sessions_api.create_session(
                user_id=uid,
                title=title,
                description=session_description,
            )
            # Now update with full content
            if session and session.get("id"):
                session = state.prompt_sessions_api.update_session(
                    session_id=session["id"],
                    user_id=uid,
                    left_column_content=left_column_content,
                    compiled_output=compiled_output,
                    conversation_id=conversation_id,
                    metadata=save_metadata,
                )
            action = "created"

        session_id = session.get("id") if session else request.session_id

        # ══════════════════════════════════════════════════════════════════════
        # REAL VERSION HISTORY
        # This endpoint used to update the row in place and write no version at
        # all: nothing in it ever touched prompt_versions, so a Save left no
        # predecessor to diff against and nothing to restore, and the console's
        # version panel only ever had rows written by other code paths to show.
        #
        # One version is now written per Save whose stored content actually
        # differs from what the row held, carrying BOTH columns. The output is
        # included because no row in prompt_versions had ever held any.
        # ══════════════════════════════════════════════════════════════════════
        version_number = None
        version_error = None
        if session_id:
            prev_output = (previous_state or {}).get("compiled_output")
            # Compare the SECTIONS, not the serialized left_column_content. That
            # JSON carries a `savedAt` timestamp which changes on every call, so
            # comparing it verbatim reported "changed" for an identical save and
            # wrote a version that recorded nothing.
            try:
                prev_sections = json.loads(
                    (previous_state or {}).get("left_column_content") or "{}"
                ).get("sections")
            except (json.JSONDecodeError, AttributeError):
                prev_sections = None
            content_changed = (
                previous_state is None
                or prev_sections != sections
                or (prev_output or "") != (compiled_output or "")
            )
            if content_changed:
                reason = [f"{len(sections)} sections"]
                if output_was_sent:
                    reason.append(
                        "output cleared" if not (compiled_output or "").strip()
                        else "output saved"
                    )
                elif (compiled_output or "").strip():
                    # Not the model's doing any more: the sections were joined
                    # into the output column (see the gap-fill above), so the
                    # version says that rather than claiming a compilation.
                    reason.append("output built from the sections")
                try:
                    written = state.prompt_sessions_api.save_version(
                        session_id=session_id,
                        user_id=uid,
                        left_column_content=left_column_content,
                        compiled_output=compiled_output,
                        change_description="Console save — " + ", ".join(reason),
                        change_type="manual",
                    )
                    version_number = (written or {}).get("version_number")
                    print(f"[AI Save] version {version_number} written for {session_id}")
                except Exception as e:
                    version_error = str(e)
                    print(f"[AI Save] VERSION WRITE FAILED: {e}")

        # ══════════════════════════════════════════════════════════════════════
        # A2UI: EMBED THE AI-COMPILED SEMANTIC SUMMARY, NOT RAW JSON
        # This enables semantic search: "find prompts about swimming" will work
        # even if "swimming" isn't a literal key in the JSON structure.
        #
        # We embed: Title + Description + Tags + Compiled Prompt (truncated)
        # This gives Milvus maximum semantic surface area for retrieval.
        # ══════════════════════════════════════════════════════════════════════
        milvus_saved = False
        ai_tags = []
        try:
            # Build semantic content for embedding
            if ai_compilation and ai_compilation.get("description"):
                # Extract tags for embedding and metadata storage
                ai_tags = ai_compilation.get("tags", [])
                tags_str = ", ".join(ai_tags) if ai_tags else ""

                # Best case: embed the AI-generated semantic description + tags
                semantic_content = f"""Title: {request.title or ai_compilation.get('suggested_title', 'Untitled')}

Description: {ai_compilation['description']}

Tags: {tags_str}

Compiled Prompt:
{compiled_output[:2000]}"""  # Truncate for embedding limits
                print(f"[AI Save] Embedding AI-compiled semantic summary ({len(semantic_content)} chars, {len(ai_tags)} tags)")
            else:
                # Fallback: embed a structured summary of the sections
                section_summary = " | ".join([
                    f"{s.get('section', s.get('role', 'Section'))}: {s.get('content', '')[:100]}"
                    for s in sections if s.get("content", "").strip()
                ])
                semantic_content = f"Title: {request.title or 'Untitled'}\nSections: {section_summary}"
                print("[AI Save] Embedding section summary (no AI compilation)")

            # Pass AI metadata to Milvus for filtering and retrieval. Off the
            # event loop for the same reason as the summary call above: this is a
            # synchronous network write behind a model load, and the save in front
            # of it has already been written. (When the embedding model is not
            # loaded at all, this is where the "Milvus save warning" comes from.)
            await asyncio.to_thread(
                milvus_save_version, session_id, semantic_content, ai_metadata=ai_compilation
            )
            milvus_saved = True
        except Exception as e:
            _warn(f"the vector index was not written — the row is saved, but semantic search will not find this version: {e}")

        elapsed_ms = int((time.time() - start_time) * 1000)

        # AI confirmation message. It reports what actually happened to the row:
        # a summary that did not arrive says so without calling the SAVE a failure,
        # an emptied output column says so, and a vector index that was NOT written
        # says that too. The message used to read as an unqualified success in all
        # three cases — and then, for the first of them, as "AI compilation FAILED
        # — no compiled prompt was generated" about a row that had been written.
        summary_missing = bool(section_contents) and ai_compilation is None
        ai_message = f"Surface {action} successfully in {elapsed_ms}ms."
        if llm_used:
            ai_message += f" AI summary written for {len(sections)} sections."
        elif summary_missing:
            ai_message += " No AI summary (the compile call returned nothing usable)."
        else:
            ai_message += f" {len(sections)} sections saved."
        # One statement of an explicitly cleared column, whichever branch above
        # was taken: the summary that was written does not live in the output
        # column, so a cleared column is not a discarded summary.
        if output_was_sent and not (compiled_output or "").strip():
            ai_message += " Output column cleared."
        if version_number is not None:
            ai_message += f" Version {version_number} saved."
        elif version_error:
            ai_message += f" VERSION NOT SAVED: {version_error}"
        else:
            ai_message += " No version written (content unchanged)."
        if milvus_saved:
            ai_message += " Vector embeddings updated."
        else:
            ai_message += " Vector index NOT updated (embedding model not loaded)."

        return {
            "status": "ok",
            "action": action,
            "session_id": session_id,
            "save_time_ms": elapsed_ms,
            "sections_saved": len(sections),
            "milvus_saved": milvus_saved,
            "llm_used": llm_used,
            "ai_compiled": ai_compilation is not None,
            "summary_missing": summary_missing,
            "compiled_output_length": len(compiled_output),
            "version_number": version_number,
            "version_error": version_error,
            "ai_message": ai_message,
            "warnings": _drain_warnings(),
            # Include AI-generated data if available (for semantic search & display)
            "ai_description": ai_compilation.get("description") if ai_compilation else None,
            "ai_suggested_title": ai_compilation.get("suggested_title") if ai_compilation else None,
            "ai_tags": ai_tags if ai_tags else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save surface: {e!s}"
        )


def _tool_refusal(message: str, path: str = "/name") -> HTTPException:
    """The answer to a tool request that cannot be met.

    The same four-field shape the catalog uses for a component that is not in
    it. A tool that does not exist is not an empty result — it is a refusal
    that names what was asked for.
    """
    return HTTPException(status_code=503, detail={
        "error": {
            "code": "VALIDATION_FAILED",
            "surfaceId": "main",
            "path": path,
            "message": message,
        }
    })


@router.get("/api/ai/tools")
async def ai_tools(section: str | None = Query(None)):
    """The tools on offer, optionally narrowed to one section of a prompt.

    Names, one line each, and the category. No bodies — a body is fetched only
    when something asks for that tool by name.

    `section` is one of the prompt's seats. A tool can belong to more than one
    and appears in each, which is what makes a tool show up where the person is
    working rather than in one fixed list.
    """
    try:
        return {"tools": list_tools(section), "section": section}
    except ToolError as e:
        raise _tool_refusal(str(e), path="/section")


@router.get("/api/ai/tool-categories")
async def ai_tool_categories():
    """The categories and how many tools each holds.

    This is what the first list shows when someone presses Tools: the shape of
    what is available, not every tool at once.
    """
    try:
        return {"categories": categories()}
    except ToolError as e:
        raise _tool_refusal(str(e), path="/categories")


@router.post("/api/ai/read-tool")
async def ai_read_tool(request_body: dict):
    """Read one tool's full text.

    A tool is not in the prompt until something asks for it by name, which is
    why one can be long and still cost nothing on the calls that do not use it.

    An unknown name is a refusal that lists what exists, not an empty answer.
    """
    name = (request_body or {}).get("name", "")
    if not name:
        raise _tool_refusal("read-tool needs a 'name'.")
    try:
        return get_tool(name)
    except ToolError as e:
        raise _tool_refusal(str(e))


@router.get("/api/ai/role-capabilities")
async def ai_role_capabilities(
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """
    Return the current user's departmental role and capability set.

    The frontend uses this to:
    - Filter which tabs are visible in <chat-navigation-bar>
    - Decide whether to show the prompt builder vs read-only view
    - Gate governance data views (cost, trace, quality metrics)

    This is the runtime contract between backend role resolution and
    frontend role-based rendering.
    """
    uid = get_user_id_from_header(x_user_id)
    role = get_user_role(uid)
    caps = get_role_capabilities(role)
    return {
        "user_id": uid,
        "role": role,
        "capabilities": caps,
    }


@router.get("/api/admin/audit-logs")
async def api_admin_audit_logs(
    limit: int = Query(50),
    offset: int = Query(0),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Admin-only: retrieve audit log entries."""
    uid = get_user_id_from_header(x_user_id)
    if not user_is_admin(uid):
        raise HTTPException(status_code=403, detail="Admin access required")

    if not state.conversation_api:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        conn = state.conversation_api.get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, action, resource_type, resource_id, metadata, created_at "
            "FROM audit_logs ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (limit, offset)
        )
        rows = cursor.fetchall()
        logs = [dict(r) for r in rows]
        # Convert datetime to string for JSON
        for log in logs:
            if log.get("created_at"):
                log["created_at"] = log["created_at"].isoformat()
        cursor.close()
        conn.close()
        return {"logs": logs, "count": len(logs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading audit logs: {e!s}")


# ============================================
# PROMPT SESSION + VERSION MANAGEMENT
# ============================================
