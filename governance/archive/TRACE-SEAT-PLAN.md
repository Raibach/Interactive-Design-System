# TRACE-SEAT-PLAN — the Langfuse trace experience, rebuilt inside Grace's seat (governance)

**Status: STAGE 1 PLACED AND VERIFIED IN-ROOM (2026-10-13 night, local :5001 only — the box has none of it).** Live: the seat's three trace views in their slots (header/tree/detail), the reads, the selection channel (the EXISTING reporter — no fork change needed), the rail's Tools→Preview label, the send-flips-to-Chat rule. 
**Remaining for Stage 1's full face:** Corrected Output/annotations in the detail, the dense timeline's map-mode (row zoom/lens) and the fork graph's ELK engine + search dimming (the graph itself now DRAWS — our own layered layout with pan/zoom and node-pick, fixed + verified in-room 2026-10-13 night; the fork's fly-out was KILLED at the source the same night — `peek.tsx` early return, no sequencing left; the rest of the tree panel is PLACED — toolbar, View Options, min level, Tree/Timeline/Graph all draw), box publish on the owner's word. **DONE since the draft was written:** the detail's full strip (Preview | Attributes | Scores | Log View | Formatted | Raw — all six draw; no inner scroll boxes), the selected-row highlight in the trace list (house patch in `data-table.tsx` — the app's own `--primary-accent` tint + 3px inset bar, image rebuilt 2026-10-13 late), 'Open in Composer' (M4 — the trace's Langfuse `sessionId` IS the package's `prompt_sessions.id`; the seat's trailing button opens that package in the Composer, verified), her live trace facts (`graceLiveContext` now TRUE — the TRACE ON SCREEN block), AND the fly-out controls + the chat's gripper (2026-10-13 late, M2 answered): the header's ⬇ (Download JSON — the shell writes the real payload: trace + observations + scores) and ⋮ (the app's own copy items only: Copy trace ID / Copy trace name), and below the header the design's five-dot gripper drags her column's width (follow the pointer, snap closed at the rail — no clamps; a standing-width floor was built the same evening and removed on the owner's word), AND — same night — her column is an OVERLAY over the app in this room (the app keeps every pixel beneath her; scope: the trace section only), the app's own containers stepped in `paddingRight: 30px` with the chat flush right, the Trace-tab default chain (the **latest** row — picked by the row's own shown time, never by position — selected by the measured pointer sequence → highlight + open through the selection channel), and Preview deactivated until a selection stands. Read §4's Data item note — the read path CHANGED from this draft after measurement (v4 events_only).
This file exists for CHAT HANDOFF: the next agent picks this work up in a fresh conversation.
It is deliberately self-contained — read it top to bottom before touching anything.

Companion: `/memories/repo/raibach-ids.md` (repo operating card — local ops, box rules, owner laws; persists in this workspace).

---

## 0. WHAT THIS IS

The governance room today = the Langfuse fork in an iframe + Grace's chat column (`<chat-panel>`) beside it.
The owner is **taking Langfuse apart and repurposing it**. This plan moves the trace experience — the fly-out
that opens when a trace is selected — into Grace's seat, and lays out the staged path to ONE application
(no iframe) where the model can talk about what is happening on screen.

**Local until verified, then the box.** Nothing ships to the Hetzner box without the owner's explicit word.

---

## 1. THE OWNER'S DIRECTIVE — verbatim, then as rules

> *"when you select a trace row opens this fly out from Langfuse we want to incorporate into Grace — into the chat panel output on the right."*

> *"It's a slot at the very top of the chat output area for header information and this is going to be specific
> information to each section but for now we're in governance. I'm giving you two examples of how that header
> changes when you're doing different things."*

> *"What remains the same is conversation ID because this is the actual conversation the user has with the model
> while they're working their way through the process and they're stored in the chat section. … she will flip back
> to the chat section. She's not gonna insert chats in the trace section. She's not gonna start talking to them
> inside of the preview section. She's going to always have our conversations in the chat tab and that's important.
> So if I wanna ask Grace a question, the tab is going to flip back to chat and the user is going to have to
> manually go back to the trace that they were working on."*

> *"the second part is just the output … the outputs captured with their own tab, a preview opens up exactly what
> it does now and then inside of that you've got tabs to navigate that section just like you do now. The only thing
> it changes is the header at the top will now feature that individual trace row information."*

> *"the third one is just your basic what's already there — it's on the left side. It is the trace. It is the data
> tree and it has multiple views like timeline and graph … basically an exact transfer of that outline but now it's
> being loaded inside of the chat panel and its own space with all the same controls."*

> *"the chat panel — you need to stop thinking of it as a conversation. It's not a conversation. The chat panel is
> an A2UI surface. It just looks like a chat panel because of the way it's styled. This is for user familiarity …
> don't let the styling of it confuse you into thinking it's a chat output. It is a surface — an A2UI native surface
> — and it should be calling lit components which we have to add."*

> *"The final point and the most difficult part: we are wiring the chat output directly into the Langfuse interface.
> Here's the problem with your current build: the chat loads outside of the Langfuse app — I can see it loading
> when it's spinning — and that probably will not work, so you'll probably have to move it inside of the application
> so that the model will be able to talk to the user about what's happening in the application. That's the most
> complicated part and we may need a completely different spec and completely different plan for that."*

> *"you're not tweaking and customizing and hacking this chat output into this application. You're gonna have to
> actually modify and build the application differently than it is now. You need to look at Langfuse as a template,
> as a guide — it is not the application that we will end up with. I am slowly taking it apart and repurposing it."*

> *"We cannot guess in this application. I don't guess, you don't guess … we may experiment, but that's a very
> controlled period of work that will be outlined as experimentation."*

### As binding rules
1. **The seat is an A2UI surface.** Chat styling = familiarity skin only. Its content = lit components bound to data paths.
2. **Langfuse is the template.** We rebuild views on our side; we do not port their React wholesale, and we do not hack around the iframe long-term.
3. **Conversations live only in the Chat tab.** Asking while on another tab flips to Chat. Return is manual. Never auto-return.
4. **No guessing.** Anything not fully specified here waits for the owner's mockups (see ADDENDUM §7) or runs as a defined experiment (§6).
5. **Honesty laws** (repo card): no suppressed errors, no fallbacks/fake states (blank beats fake), declare terminal commands before running, notes live in code — this file is the owner-ordered exception.

---

## 2. THE MAP (from the owner's annotated screenshots, 2026-10-13)

The screenshots (in the owner's chat, not stored here — re-ask him if needed):
- **Image A** — arrows: (1) the Langfuse trace ROW header (`6eb526e…`, 2.01s, $0.000443, 5k tokens, session↗, user `00000000…0001`, trace name `console_assem…`) → the TOP of the chat output area; (2) the Langfuse tree panel (Tree|Timeline|Graph + search toolbar, `query_llm.console_assembly` → `completion`) → the seat's **Trace tab** (which today shows `<trace-feed>`'s empty state).
- **Image B** — the trace DETAIL header (`query_llm.conso…`, date, 2.14s, $0.000023, 5k tokens) → the same top slot (second state); and inside the seat: the detail tab strip `Preview | Attributes | Scores | Log View | Formatted | Raw` + System/User content + a green **"Open in Composer"** button.
- **Image C (later message)** — the current Langfuse trace view "so you can map the locations": left = tree+timeline; right = detail with the tab strip.

| In Langfuse today | New home in the seat |
|---|---|
| Trace row header (id, name, latency, cost, tokens, session, user) | **Header slot** — very top of the chat output area (state 1) |
| Trace detail header (`query_llm.<mode>` + date/latency/cost/tokens) | Same slot, state 2 |
| Conversation ID | **Constant** element of the slot — the conversation never moves |
| Detail tab strip (Preview \| Attributes \| Scores \| Log View + Formatted \| Raw) | Transferred **as-is** inside the seat |
| IO preview (System/User blocks, formatted/raw) + Corrected Output + Annotate/Comment | As-is, inside the Preview section |
| **Open in Composer** (new, from the mock) | New seat action — handoff to the Composer room |
| Tree \| Timeline \| Graph + toolbar (search/show/cost/filters) | The seat's **Trace** tab — "its own space with all the same controls" |
| The fly-out (peek slide-out) itself | Dies. Selecting a trace opens **Grace's column** on the trace. |

---

## 3. VERIFIED MECHANICS — what exists, and the exact extension points

*(All anchors verified 2026-10-13; re-read the files before building — line numbers drift.)*

### 3.1 The seat's view system — `frontend/src/components/lit/chat-panel.ts`
- **Tab → view map**: `_wantedViewTag()` (~line 2174): `trace → trace-feed`, `eval → eval-feed`, `repair|approvals → chat-repair-actions`, default `null`. Each rail tab draws ONE view.
- **The view slot**: `.view-slot` CSS (~1833–1869) — known tags are hidden by default and shown per tab (`.view-slot.tab-eval ::slotted(eval-feed) { display: block; }`). The slot renders at ~5197: `<div class="view-slot tab-${activeTab}">`.
- **The seat's OWN door for room furniture** — `_anyForeignViewAssigned()` (~2144): a room may assign a view tag the seat does not know; it draws **above the thread on the Chat tab**. Known set: `['trace-feed','eval-feed','chat-repair-actions']`; the code comment says *"The next room's view needs the same one-line allow-list entry above and nothing here."*
- `_showsThread()` (~2196): `chat` + `approvals` draw the thread; other tabs show views in the slot.
- **DESIGN ITEM (not a guess — the requirement is certain, the exact seat change is a READ-FIRST task):** governance's Trace tab must show OUR trace view instead of `trace-feed`. This needs a small seat-side rule in the spirit of the foreign-view door — e.g. "when a foreign view is assigned AND its home tab is active, it wins over the wanted tag" — plus the CSS pair. Read all four mechanisms above before writing it; keep the seat's law *"an element still never renders another element"* (views are slotted children assigned by the surface).
- Rail tabs for governance: `GOVERNANCE_SEAT_TABS = 'chat,trace,tools,approvals,eval,states,repair,settings'` (`frontend/src/pages/WritingAreaIndex.tsx` ~598). **Owner update 2026-10-13 (evening): `tools` → `preview` — his words: "tools changed to preview on the chat". Apply per the Approve precedent (labels are presentation, ids are the stable key): rail label `Tools` → `Preview` in `frontend/src/components/lit/chat-navigation-bar.ts` (its TABS map; today it still reads 'Tools'/'tools'); keep the id `tools` unless the build argues otherwise.**
- Children spec precedent: the surface declares view children (`"view": ["trace-view", "repair-view"]` for the console); names resolve through the renderer (see 3.3).

### 3.2 The view contract — `frontend/src/components/lit/trace-feed.ts` (THE TEMPLATE)
- *"IT IS A VIEW, NOT A SOURCE. It reads nothing: `entries` and `breadcrumbCount` arrive as bound properties … A component that fetches its own data cannot be handed a different one."*
- Waiting ≠ empty: `entries === undefined` draws a waiting state; `[]` draws empty — the two differ on purpose.
- The reads live in `frontend/src/lib/trace-source.ts`; **the SHELL writes the values into the data model**.
- `eval-feed` is the sibling; both are registered in the catalogs (3.3).

### 3.3 The surface pipeline (registration + assembly)
- **Catalogs** (both, kept in sync): `frontend/src/components/A2UI/catalogs/design-artifacts/catalog.json` and `.../prompt-composer/catalog.json` — the `TraceFeed`/`trace-feed` entry (~line 15) documents dual names (renderer resolves `TraceFeed → <trace-feed>` via `COMPOSITE_MAP` in `a2ui-renderer.ts` ~243) and the bindings (`{"path": "/trace/entries"}`, `{"path": "/trace/breadcrumbCount"}`).
- Registration: `frontend/src/components/lit/register.ts` (imports; `trace-feed` at ~104); `frontend/src/shared/tag-registry.ts` carries the tag entries; the catalog audit checks the allowlist.
- **The data-path writer pattern** — `WritingAreaIndex.tsx` ~1558–1610: `<trace-feed>` renders `{path:"/trace/entries"}` and *"something has to write that path … So the CLIENT writes it"* — the shell merges the snapshot into BOTH models (console + workspace), re-asserts after every assembly (keyed on the assembled component lists), and the source returns the same snapshot object until change (identity check → no re-renders).
- The clone pattern (~7348): when a tree row names a component, the room's own entry for it is cloned so its **bindings travel with it** (`resolveTag` matches names; owner quote in-file 2026-09-30 about failing loud when bindings are missing).

### 3.4 The room wiring — `WritingAreaIndex.tsx`
- Governance room JSX ~11245–11300: `<workspace-layout key="governance-room" ref={governanceLayoutRef}>` → left slot = `<builder-embed no-embedded-params src={governanceToolUrl()} colorScheme:'dark'>` (the Langfuse iframe), right slot = `<chat-panel slot="right" ref={governanceSeatRef}>`.
- Entry effect ~5671: the room loads **closed** (`isThirdOpen = false` as a property). Open mechanics: `_openThird()` / `_onGripDown('right')` in `workspace-layout.ts` (the grip opens her under the pointer).
- The seat binding effect ~5765: `POST /builder/governance/room` → assigns `sessionId`, `conversationId`, `packageTitle`, `allowedTabs`, `instructions`, `graceLiveContext: false`, `tracePrompt: false`.
- Room → shell channel: the frame-proxy injects the location reporter (`{type:'langfuse-location', path}`); studio listener = `onLangfuseLocation` ~652–668; nav writes the frame's path via `navigateGovernanceTool` ~618.
- **NEW (2026-10-13, shipped + owner-confirmed): the grip safety net** — `governanceGripActive` state (~600), listeners on the layout's `resize-start`/`resize-end` (~5765), transparent overlay `fixed inset 0 z 9999` (~11250). Same pattern as Product's `productGripActive`. Reason: document moves die when the pointer crosses onto the iframe mid-drag.

### 3.5 The fork (the template being taken apart) — `governance/langfuse-main/`
- Routes: pages `web/src/pages/project/[projectId]/traces/{index,[traceId]}.tsx`; public API `web/src/pages/api/public/traces/{index,[traceId]}.ts`; endpoint families available: `traces, observations, scores, comments, sessions, metrics, v3, …` (dir listing 2026-10-13).
- The traces feature = **275 files** — the reference inventory: `TraceDetailView`, `IOPreview` (+ `CorrectedOutputField`), `TraceGraphView`, `TraceTimelineDense`, `TraceLogView`, `TraceMessagesView`, `TracePanelNavigation*`, `AdvancedJsonViewer`, `JSONTableView`.
- Row selection today: `web/src/components/table/data-table.tsx` `handleOnRowClick` → `peekView.openPeek(rowId, row)` — the fly-out the owner wants replaced by Grace.
- Local rebuild recipe + twin discipline: see the repo card. (One lesson recorded today: the `| tail -8` build pipe masks the build's exit code — always compare the tag-image sha against the running container's sha.)

### 3.6 The data plane (stays Langfuse) + the studio tap
- `backend/grace_gui.py` — every `query_llm()` call writes ONE trace via the Langfuse tap: name `query_llm.<mode>`; metadata `{mode, prompt_id, model, temperature}`; tags `[mode]`; session = `trace_session` or `prompt_id`; the studio owns the generation → the room shows the studio's exact cost; the root span's io is pinned so the preview carries input/output.
- Trace families: `console_assembly` (console room arrival; `prompt_id="surface-assembly-console"`) | `chat` (her replies) | `prompt_output` (Composer RUNs).
- Read endpoints for the new views: proxy the fork's public API server-side (keys in `backend/.env`; the backend already holds Langfuse env). New router lives in `backend/routes/` (pattern: `ai.py`, `misc.py`, …).

### 3.7 Seat storage (from the first draft — still required)
- `backend/init_db.py`: `conversations` (session_id, project_id, tab, metadata JSONB, …) + `conversation_messages`. No seat column yet.
- **OWNER RULING 2026-10-13 (evening) — the model is simpler than the first draft.** Verbatim: *"conversations are going to be user based without any other layers because there aren't any other layers… it's not tied to a project. It's just a general interface — conversations related to governance in general… the database for those are gonna be a little much simpler, but they still must be tab based. They can't be… they're not Global. And they don't change."* So: **USER-scoped (no package/project FK), TAB-keyed (the `conversations.tab` column is the dimension), stable IDs that never change, and nothing global.** The earlier `grace_seats` + `conversations.seat_id` idea is SUPERSEDED. Creation + list stay in `backend/conversation_api.py`; follow `init_db.py`'s id conventions at build time. Chatting lives in the Chat tab — anything else flips back there (binding rule 3).

### 3.8 How she reads a room — the chat-awareness seam (verified 2026-10-13)
- **What rides a turn.** `_send` (chat-panel.ts ~3609) takes `_gracePrompt()` (~3217) as the `context` of `POST /api/teacher/query` (~3665). The prompt = the room's `instructions`; ONLY when `graceLiveContext === true` it appends `CURRENT WORKSPACE` + `_buildWorkspaceContext()` (~3027).
- **What the workspace block reads.** Seat PROPS the host writes: `packageTitle`/`packageDescription` (always stated — "(none)" is a fact), `leftColumnContent` (the input-area sections), `compiledOutput`, `_tools` (from `/api/ai/tools`), `consoleCards`. Each block appears only when its prop is set. Nothing in the payload tells the seat which room it is — the ROOM states the facts; awareness is exactly what it wrote into these props.
- **A fact channel is a DECLARED prop.** `assignProps` (a2ui-renderer.ts ~129) assigns through the element's `static properties`; an undeclared prop returns as `unreported` and the room's effect warns (the product/development/governance seat effects). A new channel = declare on `chat-panel` + tag-registry entry + both catalogs (§3.3).
- **Precedent — a room's own props.** Product: `productTools`, `productRoom`, `productRunning`, `productRunStartedAt`, `productExpectedMinutes`, `productFigmaConnected` … — set ONLY by that room's binding; every other seat untouched. **Governance's facts ride the same way: dedicated props written by the shell from the fetched trace snapshot — never dressed into `leftColumnContent`/`compiledOutput`, which render and mean the composer's areas.**
- **Governance today states nothing.** Its binding (WritingAreaIndex.tsx ~5813) sets `graceLiveContext: false` and binds no facts — her context there is one sentence of instructions + "name: Governance / description: (none)". No eyes by design until this work lands.
- **The only channel out of the program** is the frame-proxy's location reporter (`{type:'langfuse-location', path}`; shell listener ~664, origin-checked). The §4 Stage-1 selection reporter is its sibling. The shell is what turns "what's happening" into (a) view data and (b) seat facts. Stage 3 retires the reporter with the iframe: the state is native and `graceLiveContext` flips `true`.

---

## 4. THE BUILD — staged, each stage leaves a working room

### STAGE 1 — the seat's trace views (our components; the fork still shows the list)

**PLACEMENT FIRST (owner, 2026-10-13 evening):** *"I'm just placing those items inside of those containers — those existing slots — without making any real changes to them whatsoever. We will edit them later once you get them placed."* → Place the views into their slots KEEPING their current look and behavior; the styling pass is a later owner edit. No restyling in this stage.
1. **New lit views** (each: VIEW not source; values arrive by bindings; registered in both catalogs + tag-registry + register.ts):
   - `trace-context-header` — the top slot. States 1/2 per his images; conversation id constant (bind the seat's own bound conversationId). Exact fields + placement → ADDENDUM M2.
   - `trace-tree` — Tree | Timeline | Graph + toolbar parity. Graph rides the existing vue-flow foundation (`agent-flow`); timeline references the fork's `TraceTimelineDense`.
   - `trace-detail` — inner tab strip (Preview | Attributes | Scores | Log View + Formatted | Raw); role-block IO; Corrected Output + annotations parity; **Open in Composer** action (event → shell routes to the Composer with the trace's `prompt_id` — reuse the open-prompt-session machinery, `backend/routes/prompt_sessions.py`; exact door VERIFY AT BUILD).
2. **Data**: new shell-side source (pattern of `lib/trace-source.ts`) + `backend/routes` read proxy (`traces/{id}`, `observations?traceId=`, `scores`, `comments`). Shell writes into both models (3.3 pattern); views bind. Fetch-by-id fills header + views from one source.
   **AMENDED AT BUILD (measured 2026-10-13, do not re-litigate):** this deployment runs Langfuse v4 **events_only**, where the whole classic public read API is refused by the fork itself (`rejectInEventsOnlyMode` → 404 "not available on deployments running in Langfuse v4 events_only mode") — so the backend proxy in this line CANNOT exist, whatever keys it holds. The reads that DO answer are the app's own internal tRPC (`events.byTraceId`, `events.batchIO`, `events.scoresForTrace`), and the room frame is SAME-ORIGIN with the studio — so the shell calls them directly as the signed-in person: `frontend/src/lib/governance-trace-source.ts` (the exact protocol and its live verification are recorded in that file's header). Views unchanged — shell-side write, same as planned; only the transport moved. When the room goes native, the reads stay and the transport changes a third time.
   **AMENDED (selection):** no reporter needed IN the fork for Stage 1 either — the app writes its selection into its own URL (`?peek=&observation=&traceId=&timestamp=`), and the frame proxy's EXISTING location reporter carries it out; the shell parses it at the `onLangfuseLocation` listener. Both amendments die with the iframe at Stage 3.
3. **Selection (interim — dies at Stage 3)**: small reporter IN THE FORK (its source is ours): trace selected → `postMessage {type:'governance-trace-selected', traceId}` (mirror the location reporter's shape; hook anchors: the peek's open path and/or the `[traceId]` route page). Studio: extend the `onLangfuseLocation`-style listener to route ONLY to the governance seat, open her column (layout open mechanics), activate the Trace tab, then fetch-by-id.
4. **Seat storage**: §3.7.
5. **Doctrine**: sending a turn while on a non-Chat tab flips the tab to Chat first (one behavior + comment). Manual return only.
6. **Acceptance (verify in-room at localhost:5001, the studio is vite-live)**: select a trace in the room → her column opens, Trace tab active, header slot shows state 1; open a node → state 2 + detail strip as-is; send from Grace while on Trace → tab flips to Chat; back to Trace is manual.

### STAGE 2 — the list and navigation become ours
GovernanceNav is already ours; the trace list table becomes a studio component fed by the same read endpoints; the embedded fork surface narrows to nothing it must keep. The peek/fly-out stays only until the seat takes over fully.

### STAGE 3 — no iframe; ONE application
The governance room = our page: list + tree + detail + seat in one document. Selection and view state are native context; Grace reads the live app state the way she already reads workspace seats (`graceLiveContext` is the precedent — flip it on for governance). The fork's frontend is retired to reference; its **data plane stays** (ingestion the tap already writes to, storage, public API). The seam the owner saw (chat loading outside the spinning app) is gone by construction.

---

## 5. WHAT WE DO NOT DO
- No hacking the iframe to fake the final shape; no porting the fork's React wholesale; no guessing (ADDENDUM gates the open items).
- No unsanctioned experiments (frame below); no box publish without his word; no touching the twin's `web/Dockerfile` / `web/entrypoint.sh` (deliberate no-fallback variants).

---

## 6. CONTROLLED EXPERIMENTS — the only legal frame
The owner: *"we may experiment, but that's a very controlled period of work that will be outlined as experimentation."*
Current plan: **no experiments required for Stage 1** — every mechanic above is verified. If a build-time measurement genuinely needs one (candidates: lit tree/timeline performance on large traces), it runs ONLY as: **hypothesis → scope (files touched) → timebox (one session) → success measure → recorded decision**, and nothing ships from an experiment without normal in-room verification.

---

## 7. ADDENDUM — NEEDS FROM THE OWNER (we do not guess — MOCKUPS REQUIRED)
Answer these under each item (or point at a mockup); the next agent must not start the affected piece before one of these lands:
- **M1 — ANSWERED (2026-10-13 evening, two annotated images):** Tree lives in the **Trace** tab (the Langfuse tree panel — Search + Tree|Timeline|Graph + its toolbar); Detail lives in the **Preview** tab (the rail's former Tools, renamed — the detail's own strip Preview|Attributes|Scores|Log View|Formatted|Raw, System/User blocks, Open in Composer, Corrected Output). No stacking — two separate tabs. Both headers ride the **top slot** above '1 Conversation': state 1 = the trace ROW facts (id, latency, cost, tokens, session link, user, name); state 2 = the detail header (name, Add to / Annotate / Comment marks, date, latency, cost, tokens). Fields per the images.
- **M2 — ANSWERED (2026-10-13 late, two images: the app's fly-out header, and the seat's own "Analyzing: Session 222…" bar with its five-dot grip row).** The placement: the trace info rides the chat's output header (`trace-context-header`, both states, full id always). The gripper: below the header sits the DESIGN'S OWN five-dot mark (the same row every bar in the seat carries) — repurposed whole — and it drags the column's width: follows the pointer out over the app, snaps closed at the rail on release. NO CLAMPS (owner, same evening: *"Your clamps are not allowed"* — a standing-width floor shipped for one evening and was removed). The controls: ONLY Download JSON + ⋮ (Copy trace ID / Copy trace name). No up/down flipper, no expander. Verified in-room. THE DEFAULTS (owner: *"selecting trace loads the default first one in the table. Period … the interface itself is teaching them with defaults"*): the Trace tab click takes the app to its list and SELECTS THE FIRST ROW by the measured pointer sequence — she opens through the selection channel, the row keeps its highlight, and Preview ('tools') stays DEACTIVATED until a selection stands. HER COLUMN IS AN OVERLAY in this room (`chat-overlays-content`, the app keeps every pixel beneath her; the trace section ONLY per the owner), flush right, with the APP'S CONTAINERS stepped in 30px (paddingRight on the room's left slot — owner: *"push the dashboard and other internal containers inside 30 more pixels, not the chat — the chat should be flush"*).
- **M3 — Where does the trace LIST live at the end?** (room list stays; or becomes our list in Stage 2 per §4.) *Statement or mockup.*
- **M4 — "Open in Composer": what does it carry and where does it land? ANSWERED (2026-10-13 late, owner mockup: "[Send] •••• [Open in Composer]", with his words: "click on that button and it automatically loads that package that you're inspecting inside of the composer and lets the user edit it and rerun it based on the governance information").** Built: the button lives in the seat's action-bar trailing slot; it carries the trace's package — on a Composer run the trace's Langfuse `sessionId` IS the package's `prompt_sessions.id` (the run tap writes both), resolved via `GET /api/prompt-sessions/{id}`; the click opens the Composer room on that package (edit + rerun). Verified live (opened "My new product idea"); assembly-mode traces and dead sessions honestly resolve to no button.
- **M5 — The flip-to-chat trigger**: on SEND only, or also on focusing the input? (Plan assumes: on send.) *Statement.*
- **M6 — Stage-3 sign-off**: confirming the fork frontend is retired for governance (data plane stays). *Statement.*
- **M7 — Anything the owner already knows that this file doesn't** — add here.

---

## 8. AGENT NOTES (commentary for the next chat)
- **State of the room TODAY (local, verified):** separator pass (always-visible 1px column lines; hover = light 2px grab indicator; accent while resizing — `data-table.tsx`, mirrored byte-identical in the twin) and the grip safety net (above) are SHIPPED and owner-confirmed. The box does NOT have them yet; publish batch on his word: GovernanceNav Dashboards removal, bg-card button fills, pr-30px balance, separators + hover, gripper overlay.
- **Ops quick card:** studio = vite-live at :5001 (edits need no build); the room = local Docker image `langfuse-web:gov-embed` (rebuild recipe + sha lesson in the repo card); verify IN-ROOM only; declare every terminal command before running; Q: "did you declare it?" A: yes, always.
- **Carried loose ends:** Development room has the same frame-beside-her geometry — the same 3-line grip overlay is ready to mirror if asked; micro-cleanups ride the next room rebuild (AppSidebar dead body → stub, stale `app-shell-chrome.clienttest.tsx` lines, breadcrumb prop sweep).
- **Rationale kept from the earlier session (do not re-litigate):** corrections = expected-output hook; Composer owns prompt WRITES, governance reads/scores/corrects — that is why "Open in Composer" is a handoff, not an editor. The seat's conversation is per-seat (§3.7) — she is never a global chat.
- **Known session-memory mirror:** `/memories/session/grace-seat-plan.md` — may not persist to a new chat; THIS FILE is the authority.
- The owner evaluates on his own machine with a real pointer; Playwright synthetic drags prove the chain but cannot prove real-pointer feel — always hand him the check.
