# PLAN — the Tools and PostHog chats become their own conversations under Design

> Written after reading the Tools tab, the design seat, the Tools server route, the design tab
> package builder, the UX chat route, the turn route, the schema, and the backup copy. Every claim
> below was read in the code. This plan changes no code.
>
> **Status, 2026-10-24.** The first slice is executed: the tab helper, the Tools conversation,
> Grace's Tools introduction and the mounted Tools view are in place and verified on 5001. The UX
> and Chat conversations now use the same helper. The UX tab's PostHog welcome, its top readout,
> its conversation identity and its bottom functions are planned separately in
> `PLAN-ux-posthog-chat.md`; that document is the live instruction for the UX screen.
>
> **Later, 2026-10-24.** The UX chat and discussion turns now go to Grace's own
> `/api/teacher/query` with the UX package and conversation ids. The old
> `/api/ux/posthog-chat` route is unused and the PostHog agent is out of the active path.

## What the person will experience

The person clicks Design, then Tools. The Figma ingestion tool opens on the left, and Grace's own
tools conversation is already in the right column. Her introduction is the first message in that
conversation: it says what the tool is, what the person can do with it, and what she can answer.
The person asks about a layer, an ingest refusal, or what to change before approving; the answer
belongs to the tool conversation. Switching to Chat, UX or back does not reload the tool or the
chat. Each tab keeps its own thread.

The UX tab has its own PostHog conversation and its own introduction. The Chat tab keeps the design
console's conversation. The database has one row per conversation tab under Design, each with its
own conversation and its first message, so the rows mirror the tabs on screen.

## What I found

### The Tools tab today

- `rooms/design/DesignRoom.tsx` listens for `design-tools-open` and `design-console-open`, holds
  `toolsStanding` and `toolsOpened`, and mounts the headless `ToolsSeat`.
- `ToolsSeat` assembles `render-design` and reports its content through `onContent`. Its
  `content.ts` takes the Figma application out of the assembled tree and **keeps the chat
  information** in `chat` (conversation, session, script, rail).
- `DesignSeatShell` receives that content as `injected`, but it uses only the left and middle
  applications. The chat it creates is the **design console's** chat: `takeChat(frame)` reads the
  console's entry, and the conversation comes from `packages.tools?.conversationId` in the console
  frame. `injected.chat` is never read.
- The seat is then told `chatEl.activeTab = toolsStanding ? 'tools' : …`. The rail shows Tools, but
  the thread, the instructions and the hello are still the console's. That is the different style
  the owner is seeing: it is the right tab with the wrong conversation.
- `frontend/src/tools/GraceToolsChat.ts` is Grace's own tools conversation: a 196-line element,
  registered in `components/lit/register.ts`, with a thread and a form. It is **never mounted** by
  the room. Its turn door sends `/api/teacher/query` with only `session_id`, no `conversation_id`,
  and it has no history read and no conversation ID of its own.
- The backup copy (`Raibach_IDS copy 2/frontend/src/tools/GraceToolsChat.ts`) is the same file. The
  backup does not hold a second, different tools chat. What was lost is the **wiring**: the
  `Content.chat` that `content.ts` still collects and `DesignSeatShell` discards, and the mount
  that never happened.

### The database does not mirror the tabs yet

- `backend/routes/ai.py:2962–2973` gets the Tools conversation with
  `get_or_create_design_conversation(user_id, tab="tools")`. That helper
  (`prompt_sessions_api.py:467–521`) hangs the conversation off the **Design container** with
  `conversations.tab = 'tools'`. It creates no `prompt_sessions` row for the Tools tab.
- `backend/routes/design_console.py:219–244` reads `design_packages` from rows where
  `metadata.session_type = 'design_tab'` and `metadata.design_tab = <tab>`. The Tools conversation
  is not one of those rows, so `design_packages.tools` is empty. The Chat tab falls back to the
  Design container's conversation.
- The UX tab already uses the shape the room wants. `backend/routes/ux_chat.py:108–208` creates a
  `prompt_sessions` row with `session_type = 'design_tab'`, `design_tab = 'ux'`; it creates the
  conversation under that package, names it from the first question, and `/api/ux/chat/thread`
  reads it. The Design console's map can see `ux`.
- So the database holds two shapes for one interface: the container's conversation with a `tab`
  column (Tools and Chat), and a package per tab with its own conversation (UX). The UI draws one
  tab per conversation; the database should hold one package per conversation tab.

### The introduction

- `render-design` creates the Tools conversation empty. The design surface sets
  `"grace_greeting": True`, but the Tools tab never dispatches the arrival event that the seat's
  `_onComposerOpened` listens for. The seat's own hello belongs to the console conversation. Grace
  therefore does not introduce the Figma tool on landing.
- A greeting generated by the model would be a model call on every first landing and would not be
  the first stored message until it returned. The reliable shape is a **seeded first assistant
  message** written when the Tools package and conversation are created. The thread then loads it
  like any other turn, and a reload shows it.

### The history and turn doors already exist

- The seat reads history with `GET /api/conversations/{conversationId}/messages?limit=200`
  (`rooms/design/design-chat.ts:2814–2818`).
- The seat sends a turn with `POST /api/teacher/query`, carrying both `session_id` and
  `conversation_id` (`design-chat.ts:4205–4257`). `backend/routes/teacher.py:28–34,152–322` persists
  the turn only when the conversation belongs to that session package.
- `GraceToolsChat` sends `/api/teacher/query` with only `session_id`. That is why a tool turn would
  not land in the tool conversation even if the element were mounted.

## The one decision

Use **one Design container plus one `design_tab` package per conversation tab** — Chat, Tools and
UX. Each package owns one conversation. The UX route is the template; the Tools route and the Chat
tab move to it. No new tables are needed: `prompt_sessions` already carries the tab metadata,
`conversations` already carries `session_id` and `tab`, and the schema already enforces one
`design_tab` row per user per tab.

The client keeps the design-chat element as the **frame** (rail, input, Chat tab). The Tools and UX
tabs are **views in that frame**, like `ux-chat` is today. Each view owns its output, loads its own
conversation, and takes the words from the seat's one input. The Tools view is the existing
`GraceToolsChat`, moved into the design room and finished; the Figma tool itself is not touched.
The Chat tab stays the seat's own thread.

## The database shape

```
prompt_sessions
  Design container       metadata.session_type = 'design'
                         (the division; no conversation of its own)
  Design — Chat          metadata.session_type = 'design_tab'
                         metadata.design_tab = 'chat'
                         conversation_id = the chat conversation
  Design — Tools         metadata.session_type = 'design_tab'
                         metadata.design_tab = 'tools'
                         conversation_id = the tools conversation
  Design — UX            metadata.session_type = 'design_tab'
                         metadata.design_tab = 'ux'
                         conversation_id = the ux conversation

conversations
  session_id = the tab package's id
  tab        = 'chat' | 'tools' | 'ux'
  the thread's messages hang off this row

conversation_messages
  the first row is the tab's assistant introduction
  every later row is a person or Grace turn
```

The design console's `design_packages` map is the one read of this shape. `packages.chat`,
`packages.tools` and `packages.ux` are the three conversations the UI draws. Executions and
Settings have no conversation and no row.

## The tab contract

| tab | package | what draws it | its instructions | its first message |
| --- | --- | --- | --- | --- |
| Chat | `design_tab = 'chat'` | the `design-chat` seat's own thread | the design console's script | the chat introduction, only if the thread is empty |
| Tools | `design_tab = 'tools'` | the Tools view (`grace-tools-chat`) in the seat's view slot | the Figma surface's script from `injected.chat` | Grace's Figma introduction |
| UX | `design_tab = 'ux'` | `ux-chat` in the seat's view slot | the UX tab's own script | Grace's PostHog introduction |
| Executions | none | the seat's empty view | none | none |
| Settings | none | the seat's empty view | none | none |

The rail changes the **active tab**; the active tab selects **the package and the view**. The
Design console's frame supplies the Chat conversation. The Tools seat's `injected.chat` supplies the
Tools conversation and script. The UX route supplies the UX conversation.

## The steps

### Step 1 — one helper for a design tab package

Add one server helper, in `prompt_sessions_api.py`, that returns the tab's package and conversation
and creates both when they are absent:

- find the row with `metadata.session_type = 'design_tab'` and `metadata.design_tab = <tab>`;
- create it through `create_session`, then write the design tab metadata; the UX route's
  `_create_ux_package` is the existing pattern;
- create the conversation with `session_id = package.id`, `tab = <tab>`, and the tab's title and
  metadata;
- write the tab's introduction as the first `conversation_messages` row, `role = 'assistant'`,
  metadata `kind = 'intro'`, `save_to_memory = false`;
- return `{ packageId, conversationId, conversationIds }`.

It handles the unique-index race the way `_ensure_ux_thread` does: a losing insert re-reads the
winner. The helper is the only writer of the tab packages, so the three routes cannot drift again.

### Step 2 — the Tools route uses the package

In `backend/routes/ai.py`, replace `get_or_create_design_conversation(user_id, tab='tools')` with the
helper for `tools`. The `render-design` surface's `right_column.conversation_id` and
`right_column.conversations` become the Tools package's conversation and its conversation list. The
`render-design` chat script stays the Figma section's own script; it now travels with the tools
conversation instead of a container conversation.

The design console's `design_packages` map then contains `tools` without a client change. The
console's `console_conversation` for Chat moves to the `chat` package (Step 5); the container is no
longer a conversation.

### Step 3 — the Tools chat view

Move `frontend/src/tools/GraceToolsChat.ts` into the design room, beside the tool. Give it the UX
view's shape:

- it is appended to the seat once, with `slot="view"` and `view-tab="tools"`, exactly as
  `DesignSeatShell` appends `ux-chat`;
- it takes `sessionId` (the Tools package), `conversationId` (the Tools conversation) and
  `instructions` (from `injected.chat`) as properties;
- it reads the conversation's history with `GET /api/conversations/{id}/messages?limit=200`; the
  seeded introduction is the first turn;
- it takes the person's words from the seat's own input: the `send-input-to-model` event and Enter,
  captured on the seat and stopped there, exactly as `ux-chat` does. It does not draw a second
  input;
- it sends `POST /api/teacher/query` with both `session_id` and `conversation_id`, so the turn is
  written to the Tools conversation; it draws the reply in its own thread;
- its failures are its own words in its own thread; no fallback and no silent empty.

`DesignSeatShell` binds it when Tools is standing, from `injected.chat` (the Figma surface's own
chat information) or `packages.tools`, and keeps `chatEl.activeTab = 'tools'`. The seat's own
thread is covered by the view slot, so the console conversation never shows under the tool.

The Figma tool's form, layer tree, preview, ingest and approval are **not touched**. The view only
owns the conversation.

### Step 4 — Grace's Tools introduction

The Tools package's introduction is seeded by Step 1, once, when the conversation is created. It is
the first message, not a greeting that fires again on every entry. Its content is the tool's own:

- what the tool is: load a Figma file, read its layers, submit a node, preview the draft, approve it
  into the catalogue;
- what the person can ask her: about a layer, a failed ingest, what an element is missing, or what
  to change before approving;
- what she will not do: approve or edit the design for the person.

The exact copy belongs to the owner; the plan supplies the facts it must carry. A re-entry does not
seed it again; an existing conversation with its own turns keeps them.

### Step 5 — the Chat tab becomes a package, and the old rows move

Create the `design_tab = 'chat'` package and move the Design container's current chat conversation
to it, preserving every message. The design console's Chat seat then reads `packages.chat`; the
container is only the division. The existing Tools conversation under the container is moved to the
`tools` package in the same migration, preserving its messages. The UX package is already correct.

The migration is one transaction, with a dry read first:

- find the Design container (`session_type = 'design'`);
- for each old conversation under it (`session_id = container.id`, `tab = 'chat'` or `'tools'`),
  ensure the tab package, then set the conversation's `session_id` to the package and the package's
  `conversation_id` to the conversation;
- seed the introduction only when the conversation has no messages; never rewrite a thread that
  already has turns;
- do not create Executions or Settings rows.

The design console's fallback to the container conversation is removed after the migration; a
missing package is a stated refusal, not a silent fallback.

### Step 6 — the PostHog chat

The UX tab already has the right shape: `ux_chat.py` creates the `design_tab = 'ux'` package and
the conversation, `/api/ux/chat/thread` reads it, and `/api/ux/posthog-chat` hands the same
conversation ID to the analytics application, so the app and the room keep one thread.

The plan changes only what is missing:

- the UX package uses the same Step 1 helper, so the three tabs are created by one writer;
- the UX conversation gets Grace's PostHog introduction as its first message when it is empty: what
  the analytics application is, what data it holds, and what the person can ask about it;
- `ux-chat` loads that introduction with the thread it already loads; it remains its own view, its
  own output, its own input capture, and its own `/api/ux/posthog-chat` door;
- the UX view never uses the design console's script or the design-chat's thread. The conversation
  ID the app receives is the UX package's conversation ID; no second thread is created.

The PostHog application's screens and data are not touched. Its own notes stay with
`posthog-master/`.

### Step 7 — verification inside the React frame

On `localhost:5001`, inside the Design room, not at a direct address:

- Design → Tools: the Figma tool draws; Grace's introduction is the first message; the thread is
  the Tools conversation, not the console's.
- Ask about the Figma tool or a layer. The answer arrives in the Tools thread. Reload the room and
  the same conversation is there. Switch to Chat and UX and back; each thread is separate and the
  tool is not reloaded.
- The database shows one `design_tab` row each for chat, tools and ux, each with its conversation
  and its introduction; the Tools conversation is under the Tools package, not the Design
  container.
- The UX tab shows its own introduction and its own PostHog thread; the app's conversation ID is
  the UX conversation's ID.
- The Figma ingest form, layer tree, preview and approval still work; the tool is untouched.
- `npm run typecheck` is zero. No build and no tunnel rebuild without the owner's word.

## What I will not touch

The Figma ingestion tool itself — its form, layer tree, preview, ingest and approval. The design
console's cards and its own Chat conversation. The PostHog application's screens and data. The
Design box, its ground and its own cover. The shared catalogue components. The design archive.

## The traps

- `injected.chat` is the Figma surface's own information. It is collected today and discarded. Do
  not build a second source for the Tools conversation; carry that one.
- The Tools turn needs **both** `session_id` and `conversation_id`. `GraceToolsChat` today sends
  only `session_id`; a mounted but unbound view would write to the wrong conversation.
- The seat's history refuses a conversation that does not belong to its package
  (`_conversationBelongsToPackage`). The view that reads directly must read the package's
  conversation, and the package row must point at that conversation.
- The unique index allows one `design_tab` row per user per tab. Creation must re-read on a losing
  insert, as the UX route already does.
- The introduction is seeded once, as the first message. It is not a model greeting and not a
  printed line on every empty thread. Do not seed it over an existing conversation.
- The seat's input belongs to the seat. The Tools and UX views capture the seat's events and stop
  them; they do not add a second input and do not let the seat's own handler send the turn.
- The headless `ToolsSeat` cannot set the seat's active tab; the shell's `railTab` and
  `toolsStanding` do. Keep one writer.
- The old container conversation is live data. Move it; do not copy it and leave two. Preserve every
  message.
- The Figma tool is fragile. Do not change its assembly, its content builder or its form to make the
  chat fit; the chat binds to the information the tool already returns.

## The first slice

The first slice is the Tools tab only, because that is the tool the owner is checking:

1. the Step 1 helper and the Tools package;
2. Grace's Tools introduction;
3. the mounted Tools view, bound to the helper's package and conversation;
4. the verification on 5001.

The Chat package migration and the PostHog introduction follow once the Tools conversation is
correct. The archive keeps the older plans; this plan is the live instruction for the Tools and
PostHog chats.
