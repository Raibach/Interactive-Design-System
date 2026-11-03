# The Design zone — changelog and what comes next

*Started 2026-10-05, on the owner's rule: every tab's folder keeps its own log, and each tab's
folder is the source of truth. Before today the zone's records live in the root `CHANGELOG.md`,
the git history, and `READ-ME/HANDOFF-DESIGN-ROOM.md`. Sibling logs: `development/CHANGELOG.md`,
`governance/CHANGELOG.md`, and — started the same day — `console/`, `composer/`, `product/`.*

---

## 2026-10-05 — the log starts, and the ingest's one wrong call is found

**What this folder is.** The Design zone's own shelf: the Figma measurements the interface was
built from, taken through the Figma MCP channel — the censuses (`node-census.json`, captured
2026-09-09; `VALUES.json`, 2026-09-14, 76 nodes scanned) and the per-element exports
(`prompt-input-section.json`, `prompt-accordion.json`, `chat-column.json`, `role-tile.json`,
`status-bar-prompt-input.json`, …) that the prompt and chat components were measured and written
from.

**The Design room's ingest refused a design it exists to serve — the cause is fixed.** Re-ingesting
`40001177:2476` (`prompt-textarea-container-system`) returned 422: *"Nothing was written: … strokes:
stated and never reached the spec."* Measured: the frame's border paint in Figma is switched off
(`visible: false`), and `figma_fidelity._states` counted any non-empty `strokes` list as a stated
fact while the renderer — correctly — carries only visible paints. The check now asks the
renderer's own question for `strokes` and `fills`: a hidden paint asks for no declaration, and a
VISIBLE stroke the renderer cannot draw (a gradient border) still blocks. Receipts, including the
before/after proof over the live node: `PLANS.AGENT/design-room-2026-10-05/PLAN.md`.

## 2026-10-05 (later) — the room's wait, on the owner's word

**The ingest wait.** A design submit docked the chat and then the middle column stayed empty until
the answer arrived — no load state, where a composer Run has one. The shell now speaks
`ingest-started` / `ingest-settled` around the request (`WritingAreaIndex.tsx`), and the layout's
own waiting pane covers the design submit too — spinner and one sentence, "Rendering the design…",
because no model runs on this path (`workspace-layout.ts`). A refusal ends the wait exactly as a
success does. Owner's answer to the open question: parity.

## 2026-10-05 (later still) — both fixes above were replaced the same day; the full record moves to a findings document

On the owner's instruction, the five-file edit behind both entries above (the gate fix, the
ingest wait, the parity answer — `figma_fidelity.py`, `workspace-layout.ts`,
`WritingAreaIndex.tsx`, `catalogHealth.ts`, `misc.py`) was replaced with GitHub's own files the
same day and lives only in `git stash@{0}` — so **neither fix stands in any build**. What was
LEARNED instead is filed beside this log: **`FINDINGS-AND-REMEDIATION-PLAN-2026-10-05.md`** —
the refusal machinery's exact rules with live receipts, the night the break arrived (Wed Sept 30,
21:08 — before which the journal shows the ingest working and after which it never ran again),
why no build switch between Thursday and Monday could have undone it, and where the room's f-
key chips went (the same night's row redesign — the f- system itself is alive). It ends with the
repair order, M0–M4, and the replacement items, R1–R3 — each waiting on the owner's word.

## 2026-10-07 — the ingest refuses a wireframe footer: analysed; the gate is right; the repair plan is filed

**The symptom.** Importing node `40001283:2827` (`output-footer-product`, from `Wireframes v.4b` /
file `20UPR2KQMsbAxlo5NJb1se`) returns the 422 "Nothing was written…" listing `arcData`, `styles`,
and Ellipse 209/207/206/208 stroke facts. The owner's first suspicion was the Figma MCP / credentials.

**What it is, measured.** Not the MCP: the Figma desktop MCP is listening (127.0.0.1:3845), the REST
read works, and the backend log shows the render **succeeded** (`🧩 [figma-ingest] f-40001283-2827:
rendered from the measured design`) one line before the 422. Not the ZIP work. **The zero-trust
fidelity gate — present in every build since Sept 30 21:08 — refusing three fact classes the pipeline
has never handled:**
1. `arcData` × 4 (the value is a FULL ellipse: 0 → 2π, innerRadius 0) — no examination entry;
2. `styles` × 1 (`{"effect": "1:64"}` — resolved effects are on the node and drawn as box-shadow) —
   no examination entry;
3. the four ellipses' stroke rendering — `strokeGeometry` never reaches the spec (geometry transport
   is VECTOR-only since `7b1c757`, Sept 29) and the renderer draws a 2.2px **square** border for an
   ELLIPSE, not the circle (paint opacity 0.5 dropped).

**The harder receipt:** the pre-Sept-30 reference build (`Raibach_IDS-pre-sept30` @ `1b153e6`, pulled
from GitHub, stored read-only beside this log) has **no gate and the same VECTOR-only code** — it
would have written the same four squares **silently**. Nothing anywhere ever drew a stroked ellipse;
the Sept 30 rework only stopped the silence.

**Filed:** `INGEST-REFUSAL-ANALYSIS-2026-10-07.md`, beside this log — full receipts, the complete
14-fact list, the timeline from the journal (last success Oct 1 02:08Z = the rework minute), and the
repair plan (M2a transport widen / M2b artwork drawing with a pixel-verified painting choice / M3a
`arcData` and M3b `styles` examination entries / M0–M4 carryovers) — **analysis only; nothing applied,
nothing committed; each step waits on the owner's word.**

## 2026-10-07 (later) — four end-of-day reference snapshots pulled down; the front end's real gap named

**The snapshots.** `design/reference-oct-2026/` now holds four read-only exports of the application
at end of day **Oct 1 / Oct 2 / Oct 3 / Oct 4** (`aa5c416` · `4e7d5c0` · `7a7a84e` · `8737f12` — all
verified ancestors of the current build; manifest in that folder's `README.md`). For the owner's
one-by-one-by-one recovery comparison. Nothing committed; nothing in the app reads them.

**First comparison pass (corrected — the first run printed empty from a zsh quoting artifact, which
is itself recorded):** design-seat + ingest churn per day — Oct 1→2: `figma.py` +205, `WritingAreaIndex.tsx`
+541; Oct 2→3: `figma.py` 129, `figma-layers-view.ts` 93, `workspace-layout.ts` 49, `WritingAreaIndex.tsx`
+1384; Oct 3→4: `WritingAreaIndex.tsx` loses 143 lines net (161 changed — the removal day);
Oct 4→today: `figma_fidelity.py` ±23 (the Oct-5 paint fix), `WritingAreaIndex.tsx` +1703/−352.

**The front end's own gap (owner: *"the submit button should act and behave just like run on
composer… I don't know why I keep having problems with this third column"*).** Measured, and it is
separate from the ellipse refusal: on Submit the chat docks (deliberate, his 2026-10-01 request) and
the output column is written `children.middle = "design-middle"` **only when a preview exists** — so a
refusal leaves the column unopened and the only words are the small line under the URL field, and in
flight there is no waiting pane (that parity was built 2026-10-05 and rolled back; it lives in
`refs/stash` `b7c7eef`). The repair set F1–F4 (open the column + waiting pane on submit; refusals land
in the column; designer-language copy; Submit ≡ Run semantics) is filed in the analysis document, §7b.

## 2026-10-07 (later still) — Submit ≡ Run's first half RESTORED and verified live

**That reference to `refs/stash` is now a delivery, not a note.** The 2026-10-05 ingest-wait was
restored from the stash (restore, not rewrite — the stash's own hunks, ported to today's context)
into the two files that own it: `frontend/src/components/lit/workspace-layout.ts` (+71: the two
`ingest-started` / `ingest-settled` listeners, a `_waitingLabel` field — "Rendering the design…" for
an ingest, "Assembling the drawing…" for a composer Run — the two handlers, and `middleGrow` holding
the middle's space while a request is in flight with the form still open) and
`frontend/src/pages/WritingAreaIndex.tsx` (+7: the two dispatches, around the actual fetch — after
the guards, in `finally`). Backups: `/tmp/ids-interface-backup/`.

**Verified live on the running Design room (the owner's own page, hard-reloaded):**
- synthetic `ingest-started` → the middle pane animates open to its half (flex `1:0 → 0.5:0.5` over
  ~0.7s; sampled widths `[0, 680, 844, 865, 867 …]`, then holding at 867 of 1837) with the spinner
  and **"Rendering the design…"** — present in the DOM and as an accessibility `status` region;
  `ingest-settled` cleared it.
- **A real submit, instrumented:** `started` → wait visible → the ingest refused (POST 422 after
  2.8s) → `settled` → wait cleared, the refusal sentence lands under the form (unchanged wording).
- Zero page errors; `tsc -b` exit 0. The first probe readings that showed a 0-width pane were the
  probe hitting the flex transition at frame zero in a throttled tab — reported here because an
  instrument failure is reported first.

**Not yet done, explicitly on the owner's word:** the refusal copy rewritten for designers (F3), the
refusal's placement (form vs the column itself), the f- labels (R1), and the ellipse fact classes
(M2/M3 — the owner deferred them). **The gate is untouched; the ingest is untouched. Nothing
committed.**

## 2026-10-15 — the design-update flow plan is filed

**The plan.** `archive/DESIGN-UPDATE-FLOW-PLAN-2026-10-15.md` (retired 2026-10-24; see
`archive/README.md`) — the owner's goal
stated as one loop (Figma edit → ingest → approve → live Lit catalog → refresh → the composer
draws it), the verified inventory of what is already built (§1 cites the write-set in
`api_figma_commit`, the two doors, the ask-time catalogues in `deps.py`), the protection list
for the A2UI surface, binding and manipulation story (§3), and the staged work M0–M5 with the
decisions still open (the channel rule, the preview seam, M1's target node).

**The composer's shelf began the same day** — `composer/THE-COMPOSER-IS-A-PURE-A2UI-SURFACE.md`
(kept in the Composer zone, per the rule that notes live in the tab's own folder).

Nothing was built; the renderer, the gates and the ingest path are untouched. The first build
step (M0 — re-verify the ground at :5001) waits on the owner's word.

## 2026-10-24 — the analytics app starts once, and the Design room becomes its own box

**The PostHog startup pass, measured inside the React frame.** The UX application drew three
loading faces: the entry preloader, the app gate, and the shell/scene spinners.
`appLogic.showApp` waited for feature flags that cannot arrive because `OPT_OUT_CAPTURE=1` makes
the server emit no `JS_POSTHOG_API_KEY`, and for preflight; the flag timer opened the gate after
3,000 ms. The user and team were already seeded from `POSTHOG_APP_CONTEXT`. The gate now waits only
for the user; the flag and preflight waits are gone; the entry, app, shell and scene draw
`scenes/BootPreloader.tsx`; the OAuth startup is removed. Capture is explicit on
`docker-compose.ours.yml`: `AUTO_LOGIN=1`, `POSTHOG_BASE_PATH=/posthog`, `OPT_OUT_CAPTURE=1`.

**Measured on 5001 inside the React frame, through Design → UX (not at `/posthog` directly):** the
iframe's boot marks run entry 1,518 ms → app_modules_loaded 1,557 ms → app_booted 1,567 ms →
scene_loaded 1,759 ms → scene_rendered 1,930 ms → app_ready 1,931 ms. The only loading face is
`.Preloader`; two `.Spinner` elements appear for about 236 ms after the scene renders — the insights
content's own data wait — then none. The room cover is `aria-hidden` at opacity 0, the left cover is
`display: none`, and `window.JS_POSTHOG_API_KEY` and `window.JS_POSTHOG_HOST` are null. Image
`posthog-raibach:ours` built as `936ecbeefe1c`; rollback image
`posthog-raibach:pre-startup-trim-20261024`. Record: `POSTHOG-STARTUP-TRIM-2026-10-24.md`.

**The Design room is one box.** Nine dead or duplicated files were removed, including the 322 KB
`design-chat-panel` copy. The room moved from `frontend/src/design/` to
`frontend/src/rooms/design/`; `DesignBox` owns the design sheet, the `data-room-root="design"`
marker and the lazy room; `DesignRoomContainer` is the room's boundary. The shell mounts one
`<DesignBox />` beside Product and the Console; its design tree, renderer, preview, ground and two
inert effects are gone. The shared tab gate was deleted. The shell has one plain `handleTabChange`: the Composer clears and
assembles, every other tab changes the header. The Console room asks for its own surface on every
later entry; the initial page's assembly stays in the shell's mount effect, and `assembleOnEntry`
keeps the first paint to one call. Design's own cover is its gate; no shared cover stands over it.
**Verified on 5001 inside the React frame:** re-entering Design shows the room cover at opacity 1,
then the renderer/layout/chat/root with the cover at opacity 0; the initial Console and a later
Console entry both drew the cards; the Composer drew its prompt surface and chat. `npm run
typecheck` is zero. The Figma ingest tool is untouched.

**The archive.** The retired plans and the original Design prompt moved to `design/archive/`, with
a README that names each file and why it was retired. The live records are this log, the room's
changelog and the current plan. Nothing was deleted.

**The Tools/UX chat plan.** `frontend/src/rooms/design/PLAN-tools-and-ux-chat.md` traces the Tools
chat: `GraceToolsChat` is registered but never mounted; the Figma surface's chat information is
collected and discarded; the Tools conversation lives under the Design container while UX lives in
a per-tab package. The plan gives every conversation tab its own package and conversation, seeds
Grace's introduction as the first message, and mounts the Tools view. The PostHog chat is included.

**The shell/shared audit.** [the top-level README](../README.md#sovereign-shell-audit-2026-10-24) is the standing check. The
shell is 4,169 lines after the Governance container and box moved; the Design box is clean;
Development is the next room residue; and the
shared `workspace-layout` is still the wrapper for five rooms while Product owns its copy. The audit
recommends room-owned wrappers, Design first, and records the shared seats, the Composer acts still
in the Design chat, and the dead markers. Every refinement turn starts with its check.

**Next:** the console's own files (Stage 4) and the chat's folder and per-tab split (Stage 5). The
deeper PostHog feature trim is Stage 7.

---

## 2026-10-31 — the Tools tab gets its own seat (Stage 5 begins)

**Why.** Owner, 2026-10-31: *"you have a shared component there that's being used by the Figma tool
and … the console, then that has to stop … break those into three individual chat.TS files they have
to be imported into each tab individually because they are no longer shared."* The principle is
recorded in `design/ONE-CHAT-PER-TAB.md`. This is its first step, for the Figma tool only.

**What was built.** `frontend/src/rooms/design/tools/tools-chat.ts` — a WHOLE copy of the room's
seat (`rooms/design/chat/design-chat.ts`, 5,441 lines), with the class renamed `ToolsChat` and the
element retagged `tools-chat`. Only the class name, the registration, the element map and the
sixteen import paths changed; the drawing and the behaviour are the room's seat, byte for byte. The
header states the boundary in the file itself.

**What was wired.** `DesignSeatShell.tsx` imports it and creates it for the Tools tab alone
(`tab === TOOLS_TAB ? "tools-chat" : "design-chat"`). It is deliberately NOT in
`components/lit/register.ts`, which would make it available to every page: that file has zero
references to it.

**Three lookups were bound to the old tag, and are corrected.**

- `tools/GraceToolsChat.ts` found its seat with `closest('design-chat')`, which the new tag would
  never match. It now finds it by the mark the shell writes on every container, `[data-design-chat]`.
- `tools/GraceToolsChat.ts::_seatField()` asked for `prompt-textarea`, an element defined in
  `components/lit/prompt-input` that sits nowhere in the seat. The seat composes
  `design-prompt-textarea`. **So a Tools turn could never be read**: the lookup always came back
  empty. Corrected here, because the Tools view cannot work against its own seat without it.
- `tools/ToolsSeat.tsx` read the seat with `querySelector("design-chat")` to set its tab. Now by the
  same mark.

**Verification.** `tsc -b --noEmit` zero. Build clean; the chunk is `DesignRoom-DxHKfJjV.js` now.
`tools-chat` appears three times in that chunk and in no other. **Verified on screen after the owner
supplied the sign-in PIN:** the Tools container's own element is `tools-chat` (the Chat container's is
still `design-chat`), and the input's placeholder reads *"Ask Grace about this tool…"* — set through
both corrected lookups, so it is the proof they work.

**The text was a second face, and now it is not.** The owner, looking at the Tools tab: *"the styling
is different for the chat text from the chat tab … it seems like it has an extra padding on it"*.
Measured on screen, the two faces had drifted apart in four numbers and one inset:

| | Chat tab (the seat's thread) | Tools view, before | Tools view, now |
|---|---|---|---|
| weight | 500 | 400 | **500** |
| line height | 21px (1.5) | 20.3px (1.45) | **21px** |
| ink | rgb(23,23,23) | rgb(28,47,78) | **rgb(23,23,23)** |
| turn box | 10px 14px, radius 6, full width | 9px 12px, radius 10, max 92% | **10px 14px, radius 6, full width** |
| text starts | x 930 | x 948 | **x 930** |

The extra padding was two insets stacked: the seat's view slot pads 20px a side, and the view's turn
added 12px on top, so the text began 32px in where the Chat tab begins at 14px. The Tools seat now
sets `.view-slot { padding: 10px 0 }` in its OWN copy, and every turn carries the seat's 14px once.
The person's bubble keeps its fill and its 92% width; her turns still paint nothing.

A backtick inside a `static styles` comment closed the template literal and broke the build — the
same failure recorded for the rail. The file path in that comment is now plain text, not code.

**Found, and deliberately not touched.**

- The shared seat has three copies of the same wrong lookup (`chat/design-chat.ts:1444`, `:1458`,
  `:4034`). They read and clear `_draft`, so the other tabs' turns send, but the input is not
  cleared through that path. That is the other four tabs' pass, not this one.
- `ux/ux-chat.ts:161` still finds its seat with `closest('design-chat')`. Correct while UX draws the
  room's seat; it becomes a to-do the moment UX gets its own.
- The fifteen pieces in `chat/parts/` (5,841 lines) are still shared by all five containers, so a
  change to one of them still reaches every tab. **Copying the pieces is the remaining half of the
  split** and is the next step, not this one.

### 2026-10-31, the same day — the hardcoded greetings are removed

**The owner's ruling.** *"Don't create hardcoded messages don't tell the AI what to say"*, and then,
on landing in the Tools tab: *"I don't believe she's thinking at all. I believe you've hardcoded a
message and you're injecting."* He was right.

**What was there.** `backend/prompt_sessions_api.py` held `DESIGN_TAB_INTROS`, two first-person
introductions written by a person and stored as the conversation's first `assistant` message by
`get_or_create_design_tab` (metadata `{"kind": "intro"}`). The application was speaking in her
voice. That is why landing on the tab drew a paragraph with no thinking and no spinner: nothing
was thinking.

**What was removed.** The constant, the `introduction` parameter, and the whole seeding block. A
tab's conversation now begins empty, and this helper never writes a turn.

**The stored rows.** The Tools conversation `5264fcea…` held exactly one message,
`feacacac…`, metadata `{"kind": "intro"}`. It was deleted and the conversation's `message_count`
was corrected to 0. **Deliberately not deleted:** the Chat tab's greeting in `f13c2530…`
(`9d789d76…`), whose metadata is empty and whose text asks a question — it reads as a model turn,
not app copy, and a model's real words are not mine to erase. If it is app copy, it is the owner's
to say so.

**Proven on screen.** After the removal the Tools thread draws 0 turns on landing. One real turn
sent through the seat (`"What is this tool for?"`) drew `Working — 1s` **with its spinner** at one
second, and her answer at two. So the spinner works whenever there is real thinking; there was none
before because there was nothing to think about.

**Breakage I caused and repaired, recorded.** The first edit removed the constant but left the
`if intro:` block, and the Design room's door answered 503 *"name 'intro' is not defined"* until the
block was deleted. `py_compile` clean; `POST /api/design/console` 200; the room loads.

**Found and not yet fixed.** The Tools input's placeholder reads `chat input` on some loads instead
of *"Ask Grace about this tool…"*: `_applyPlaceholder` runs at connect, when the seat's shadow tree
may not have drawn its field yet, so the lookup finds nothing and returns silently. And the owner's
report that the tab *"slams … it blinks and slams"* instead of fading in is not investigated yet —
it needs a measurement of the cover and of when the surface paints, before anything is changed.

---

## 2026-10-31 — the day's record, in one place

*Written at the owner's direction: "put a change log inside of the design folder and document what
you did." The two entries above are this day's work in detail; this one lists every action so the
day can be read without stitching them together.*

**The three rules the owner set this day.** The right column is an output surface, not a
conversation — `design/ONE-CHAT-PER-TAB.md`. One chat file per tab of the vertical menu, imported by
that tab alone. No hardcoded messages, and do not tell the AI what to say.

**What changed, file by file.**

| file | what |
|---|---|
| `rooms/design/tools/tools-chat.ts` | **new.** A whole copy of `rooms/design/chat/design-chat.ts` (5,441 lines): class `ToolsChat`, element `tools-chat`, same fifteen pieces, same stylesheet. Plus a Tools-only `.view-slot { padding: 10px 0 }`. |
| `rooms/design/DesignSeatShell.tsx` | imports it and creates it for the Tools tab alone. Not added to `components/lit/register.ts`. |
| `rooms/design/tools/GraceToolsChat.ts` | finds its seat by `[data-design-chat]`; reads the field from `design-prompt-textarea` (the old lookup could never match); text matched to the seat's thread; the optional Tools-only greeting question left alone. |
| `rooms/design/tools/ToolsSeat.tsx` | finds the seat by the same mark. |
| `backend/prompt_sessions_api.py` | `DESIGN_TAB_INTROS`, the `introduction` parameter and the seeding block removed. A tab's conversation begins empty. |
| `database` | the seeded Tools intro `feacacac…` deleted and `message_count` set to 0; the test turn I typed (`4b79db0c…`) and her reply (`1ca4dfc5…`) deleted. Conversation `5264fcea…` holds 0 messages. |
| `design/ONE-CHAT-PER-TAB.md` | **new.** The principle and the split's order. |
| `design/TOOLS-SEAT-AND-CATALOGUES-PLAN-2026-10-31.md` | **new.** The seat's missing profile and the catalogue question, with the order to fix it. |
| `console/approvals/APPROVAL-PIPELINE-2026-10-31.md` | **new.** The approval flow's plan, revised twice on the owner's corrections. |

**What was proven on screen.**

- The Tools container draws `tools-chat`; the Chat container still draws `design-chat`.
- Both tabs' text starts at the same x (930) with the same weight (500), line (21px) and ink
  (`rgb(23,23,23)`).
- The Tools thread draws 0 turns on landing. The hardcoded greeting is gone.
- One real turn: `Working — 1s` with the spinner at one second, her answer at two. **She thinks when
  asked; she was never thinking on landing, because the text was a stored row.**

**What is still dictated, and is the first thing to remove next.** `routes/ai.py:2965-2972` tells her
in the prompt to say one specific sentence and "nothing else", and that sentence ends with a
question. The room's script (`design_grace_instructions`, `routes/ai.py:2960`) is one script for the
whole room; it needs to become one profile per seat.

**The catalogue answer.** Two partitions exist, `prompt-composer` (73 components) and `carbon` (58).
Neither has a `registry.json`. There is no `raibach-ids` partition, although the room asks for that
name and writes a `design_catalogue` row titled "Raibach IDS" — so our components live inside the
Composer's catalogue. The decision that unblocks the fix is the owner's: which components belong to
Raibach IDS and which to Carbon.

**Still wrong, named so it is not rediscovered.** The room slams rather than fades. The Tools
placeholder sometimes reads `chat input` because it is applied before the field exists. The fifteen
pieces in `chat/parts/` remain shared by all five tabs. `ux/ux-chat.ts:161` still finds its seat by
`closest('design-chat')`. The shared seat has three copies of the wrong `prompt-textarea` lookup
(`chat/design-chat.ts:1444`, `:1458`, `:4034`).

**A break caused and repaired.** The first removal left the `if intro:` block behind and the Design
door answered 503 — *"name 'intro' is not defined"* — until it was deleted. `py_compile` clean,
`POST /api/design/console` 200, room loads.

**The machine.** 5001 serves live source, 4173 serves `dist`, 8000 runs the API with `--reload`. The
last build's chunk is `dist/assets/DesignRoom-DxHKfJjV.js`, and `tools-chat` ships in it and nowhere
else. Nothing is committed; the working tree carries these changes beside everything that was
already uncommitted.

### 2026-10-31, later — the Tools seat's dot bands became handles

**The owner's report.** *"Make these 5-dot gripper resizable just like the ones at the chat input
output divider … remove the clamp or whatever is making the gripper jerk away from the mouse …
do all of those grippers exactly the same … on exit it returns it to default."* And: *"Clicking on
conversation and opening up a bunch of drop downs inside of a padding area — that's wrong. These
are expandable grippers."*

**What was wrong.** The three 7px dot bands in the output column — under the readout, under the
conversation bar, under the plugin tray — were drawn by their parts as `aria-hidden` ornament with
no gesture at all. A press on the conversation band reached the bar underneath it and toggled the
conversation list, which is the dropdown he was seeing.

**What was built, in `rooms/design/tools/tools-chat.ts` only.** `_wireGrips` finds each band in this
seat's own shadow tree and attaches a drag; `_onSlotGripDown` holds the pointer on the band and sets
the height of the block that draws it. Four bands are wired: the readout, the conversation bar, the
action bar (its own grip already dragged) and the plugin tray. A band sizes its own block; the
column below takes the rest.

- **No jerk, by construction.** The height is `the height at the press + how far the pointer has
  travelled`, never the pointer's position. A delta is zero at the press, so the edge cannot jump;
  no clamp was needed and none was added.
- **A click is not a drag.** Under 3px of travel, a band restores its block's natural height if one
  is set, or grows it by 120px. A grip click stops its own click, so the conversation list is not
  toggled by a press on the dots.
- **On leaving, the heights go back.** `_resetSlotGrips` clears every height this seat set, called
  from `disconnectedCallback`.

**Measured on screen, Tools tab.** Drag the readout band 80px: `output-header` 83 → 163 exactly, and
the block below shrank 631 → 551. Click the readout band: back to 83. Click the conversation band:
61 → 181 exactly, and `conversation-list` **did not open**. All four heights returned to natural
afterwards.

**Chat and UX were not touched, and that was verified.** The same bands exist in the Chat seat and
report `wired: false` with the default cursor; the wiring selects this seat's own shadow tree, so
the behaviour exists in Tools alone until each other tab has its own pass.

### 2026-10-31, later still — the conversation list moved INSIDE its rounded card

**The owner's correction, with a picture.** *"Those rounded corners indicate that the inside of
that is a container and that that is what is expanding … you have got to move the drop downs from
outside of the conversation window. It has to be inside of the conversation window — you've got the
drop-down loading outside of it. That's wrong."*

**What was wrong.** The list rendered as a sibling `.output-slot` below the bar — a pale band
outside the card — so opening the conversation put its contents outside the container that was
being opened.

**What changed, in the Tools seat only.** The `ul.conversation-list` (and the list's own note) are
now light-DOM children of `<design-chat-header>`, so the card's own `.body <slot>` draws them inside
the rounded container. The `.output-slot` sibling is gone. The Tools seat's own stylesheet lifts the
list's old 65px outside-band cap (`max-height: none; min-height: 0; flex: 1 1 auto`), because inside
the card the container's height is the space; the cap belonged to the band that no longer exists.

**Measured on screen.** Closed: card 61 tall, no list. Click the bar: card 91, list 515×30 with one
row, **inside** the header (`contains` true; no list in any sibling slot). Drag the band 90px with
the list open: card 91 → 181 exactly, list still inside. Click the band: back to 91. Then the bar
was clicked once more to return the room to how it was found: card 61, list closed.

**Not touched:** the Chat and UX seats keep the old arrangement; this is the Tools copy's template,
so their lists still render where they did.

### 2026-10-31, last — the conversation slot needs rebuilding, and the patch was reverted

**The owner's ruling.** *"The conversation slot is gonna have to be redesigned. You understand that
you're gonna have to redo the entire thing — there's no short[cut]."*

**Why every patch failed, in one paragraph.** `design-chat-header` draws the card as ONE element:
`.status.shell` — the bar's row and the card's frame are the same box. Its content area, `.body`, is
a SIBLING below that box, not a child of it. So nothing can ever sit inside the rounded frame, and
no height on anything can reveal content inside it. Moving the list into the element's light DOM
placed it inside the ELEMENT and still outside the FRAME; the card grew and stayed empty, which is
what the owner saw.

**Reverted.** The list is back in its `.output-slot` sibling and the Tools-only list override is
gone; typecheck clean, and the built chunk is the same one as before the attempt
(`DesignRoom-BFXNhUQJ.js`). The grip wiring from earlier stands; it does not depend on this.

**The shape the redesign needs.** A card is a frame with an inside:

| part | what it is |
|---|---|
| the shell | the rounded container — fill, stroke, radius, shadow; it owns the HEIGHT |
| the header row | the label and its own controls, inside the shell at the top |
| the content slot | the list or the view, inside the shell below the header row, scrolling in the shell's space |
| the grip | the shell's bottom edge; dragging it changes the shell's height, so the content area grows or shrinks with it |

**Where it goes.** A new element for the Tools tab's own card, used by `tools-chat.ts` in place of
`design-chat-header` for the conversation block. The shared part is not the place: it is drawn by
every seat in the room, and its current shape is what the Chat and UX seats still show. Each of
those gets its own card in its own pass, which is the split already under way.

**Not started.** No code for the new card was written.

### 2026-10-31, the fix itself — the card is the container

**Built, after the owner confirmed the shape** (*"Yes, that's the correct idea. You've got it."*).

- `chat/parts/design-chat-header.ts`: the framed box (`.shell`) now HOLDS the bar row and the
  content area. The bar is the first row INSIDE the card; `.body` is the inside below it, and it
  is where the card's height is spent (`flex: 1 1 auto; min-height: 0; overflow: auto`). Before,
  the body was a SIBLING of the framed box, so content could only ever land outside the card.
- `.shell` gained `margin-bottom: 5px`: the body used to contribute a gap between the card and its
  grip even at zero height, and moving it inside took that 5px away. The block is 61 again.
- `rooms/design/tools/tools-chat.ts`: the conversation list is a child of the header, so the card's
  own body draws it; and the grip now sizes the CARD (`.shell`), never the host — sizing the host
  grew the padded block AROUND the card and left the inside untouched, which is exactly the
  *"putting things inside of a padding area"* the owner rejected.

**Measured on screen, Tools tab.** Closed: block 61, card 38, no list. Click the bar: block 91,
card 68, list 641×30 slotted into the card's body. Drag the band 90px: card 38 → 158, body 30 →
120, **list 641×120** — the inside opens and the list fills it. Click the band: back to 68; click
the bar: closed at 61.

**The Chat seat is unchanged.** Its card measures block 61, shell 38, body 0 — the same numbers as
the Tools card at rest — and its list still renders where it did, because only the Tools template
puts a child inside the card.

## 2026-10-31 — the Tools tab's own controls, and the drag given a stop

**A new file, `rooms/design/tools/controls.ts`.** The Tools tab's own command strip, a copy of the
Design room's bar registered as `tools-chat-controls`. The seat imports it, draws it, and names it
in the three places that work it: the Send band's drag, the line that enables Send, and the reading
of the bar's height. The Chat and UX tabs keep the original bar.

**The Send band could not attach.** The band was registered at the top of the wiring loop and then
registered again inside the branch for the bar, so the branch found it already registered and
skipped itself. The second check and the second registration are removed.

**The footer's band moved nothing.** The card lookup asked for `.shell` and `.readout-area`; the
tray names its card `.card`, so the drag sized the whole tray element and the visible card stayed at
53. `.card` is now in the lookup, in the drag and in the reset.

**The drag has a stop.** `_roomToGrow` adds up the room the other boxes can give, counted once at
the press, and `_defaultOf` reads each box's floor from its own card. The cap is applied to the box
drag and to the Send bar drag. A box that cannot shrink gives nothing.

**One number per box.** The block minimums are removed: 83 from `output-header`, 40 from the
conversations block, 205 from the output block, and the thread's 120 with them. The numbers now
stand on the cards: Header 55, Conversation container 38, Chat output 75, Footer 53, and the Chat
input keeps its own 80. The output card's minimum was 0 and is now 75.

**The labels.** `SLOT_TAGS` reads `HEADER`, `CONVERSATIONS`, `OUTPUT`, `INPUT`, `FOOTER`. The five
blocks are marked with those labels in the seat's template, in its styles and in its wiring, and
each part's file opens with its label and its Default.

**The Header's press.** I attached a press on the readout card: the size a drag wrote is cleared and
the card returns to its Default. Only the dots write a size.

**The Footer and the Chat input move as one pair.** The Footer's band sits above its card, so an
upward pull grows it; the Chat input gives exactly what the footer takes, down to the input's own
floor, and the footer stops at 100 pixels. The branch reads the input's height, the input's floor
and the card's floor at the press, and writes both heights from one travel. Measured on the Tools
tab: footer 53 and input 94, a 40-pixel upward pull → footer 67 and input 80; with the input pulled
to 140 first, the same pull → footer 100 and input 107.

**A press on a band is a drag, never a selection.** Moving off the dots and over the bar's own words
started a text selection; the browser cancelled the pointer and the drag let go mid-pull, which is
the snap and jerk the owner felt. Every band now carries `user-select: none` as well as the resize
cursor and `touch-action: none`. Measured after the change: a 40-pixel pull moved the input exactly
40 pixels.

**The Chat tab.** `design-chat.ts` gained `data-slot="conversations"` and `data-slot="session"` on
its two headers; `design-chat.styles.ts` replaced the single rule that held both headers with the
three that say which box gives; and the seat gained the band wiring, the Header's press, the input
drag on the travel rule (the 600 ceiling, the 100 floor and the bar/footer arithmetic removed) and
the Footer's pair.

**A new conversation, beside the bar's mark.** `design-chat-header.ts` now carries a slot named
`bar-actions` in its bar, between the label and the mark. The Tools seat fills it with a square `+`
button; pressing it creates a conversation for this package, repoints the session, moves the seat
into the new conversation and re-reads the list. Measured on the Tools tab: one row before, two
rows after — "New Chat" above "Design — Tools" — and the seat moved to the new conversation's id.

**The conversation rows select.** A press on a row moves the seat to that conversation: measured by
pressing "Design — Tools" and reading the seat's id, which returned to that conversation. The thread
it shows is the conversation's own content; that one has no messages.

**A new conversation opens with her own word.** The create path sends the hello a blank composer
gets into the new thread, so the Chat output is never an empty card. Measured: pressing the `+` took
the list from two rows to three, and the new conversation's thread holds one message — her opening
line, asked for from the situation rather than written into the file.

**The new-chat hello names the Figma ingest.** The instruction now says the person has started a new
chat in the Figma ingest area of the design room — the Tools tab, where a design is read from Figma
and built into Lit components — so her opening sentence is about that work.

**The conversation chain is the database's, read back row by row.** Pressing `+` wrote a
`conversations` row (`a0d26644…`, `session_id` = the package `1575f99b…`, title "New Chat",
`message_count` 1); the package's `prompt_sessions` row was repointed to `conversation_id:
a0d26644…`; and her greeting was written as a `conversation_messages` row (`61b37063…`) against that
conversation, `role: assistant`. The seat's output draws that row's text. Nothing in the path is a
local list or a hardcoded name: the id the seat shows is the session's column, and the thread is the
messages read for that id.

**A conversation is removed from its row.** The trash on a row arms on the first press and removes on
the second. Measured on the "New Chat" row created for the test: the row went, the list returned to
"Design — Tools", and the seat stayed on it.

**The conversation list is always inside its card.** The list is no longer rendered only while the
card is open: it is in the card at all times, and the card's height is what shows it. On arrival the
card stands at 38 — its minimum — with the rows inside it and clipped; a press on the bar sets 68
(bar and one row) or 38 (bar alone); a pull on the dots sizes the card with the rows growing and
shrinking inside it. Measured on the Tools tab after a load: card 38, rows 3, the session's own
conversation selected (`a0d26644…`); press → 68 with a row showing; a 60-pixel pull → 128 with 90
pixels of rows. The Chat seat carries the same list inside its card.

**The Clear and Delete chips are gone from the chat output.** The two chips that stood at the bottom
of the Chat output card are removed from the template; the operations behind them stay in the seat.
The actions a conversation offers belong to the task on screen, not to a fixed row under the thread
(owner, 2026-10-31). Measured on the Tools tab: no `.conversation-chip` and no
`.conversation-actions` in the output, with the conversation still loaded.

**The thread remembers where it was left.** The scroll position is written to the conversation's own
row (`surface_state_json`) through `PUT /api/conversations/{id}/surface-state`, debounced while the
person scrolls, and read back with `GET` when the conversation opens; the seat restores it once the
thread has content. Measured round trip: `{"surfaceState":{"scroll":0}}` written to `a0d26644…` and
read back with its `surfaceUpdatedAt`.

**The conversation wiring is in the plan.** Section 11 of `design/slots/SLOT-PLAN.md` carries the
order (last modified, newest first), the default on landing (the session's conversation, else the
last modified), selection, creation through the bar's `+`, removal, and the five checks — written
once so the Chat and UX seats repeat it rather than reinvent it.

**The plan rewritten as one procedure.** `design/slots/SLOT-PLAN.md` now holds the five names, the
three behaviours, the six rules, one number per box, the labels, the Footer's ceiling, the
procedure for any tab, what was run into, and the compliance sheet.


## 2026-10-31 (later) — the Title field, Save at the foot, and a visit kept as a session

**The work is named before the design is read.** `figma-ingest-form` carries a Title field above
the Figma URL, taking the form's whole width, locked while an ingest runs. The title travels with
the address and the notes on Submit, and the fields announce themselves on every keystroke
(`ingest-field-change`) so SAVE at the foot of the column sees the name before anything is
submitted. Type check clean; the catalogue check reports nothing about this element.

**Apply Carbon is out of the foot and Save stands in its place.** `design-left-footer` carries one
control in the Composer's RUN treatment (`control-bar.ts`, `.btn-run`, node `40000761:267`): the
same gradient to the left, black bold label at 18, 43 by 142, the same two-part drop shadow. The
plate is untouched at 70, with its fill, corners and inner shadow. A press raises `design-left-save`
and the seat answers it; the footer itself fetches nothing. Type check clean; the catalogue check
reports nothing about this element.

**A visit to Tools is a session, and keeping it is a relabel.** The tab works in its own
`design_tab` row. Save writes that row through the Composer's own door, `POST /api/ai/save-surface`
— the title and the three fields as sections, the drawing said in words in the middle column, this
session's conversation in the right — and the server relabels the row `design_session`, stamps
`kept_at` and `kept_by`, and files it under the design category. That relabel is the whole
lifecycle: the partial unique index permits one `design_tab` row per person per tab, so once the
row is kept, the next entry to Tools makes a fresh untitled row and its own conversation.

**Measured, on a scratch session that was removed afterwards.** A scratch working row and its
conversation were made for `dev@local`; the save answered `action: updated`, version 1, and the row
read back as `title: Colour tile`, `category: design`, `kind: design_session`,
`kept_at: 2026-10-31T15:32:44`, the tab name kept in its metadata, the conversation id unchanged and
the drawn component stored as `f-1-2 · colour-tile · 12 measured values`. The tab's own writer was
then asked for a working row for that tab and found none — which is what makes the next entry a new
session. Your Tools row (`1575f99b…`) was not written to; the scratch rows, its conversation and
its version were deleted after the proof.

**The two design systems stand as cards, and a kept visit stands beside them.** The Design console
reads `design_catalogue` rows (created on first landing, one per person per system) and
`design_session` rows into the same card list, in that order before the element cards. Measured on
the live console endpoint as `dev@local`: 66 cards — Carbon, Raibach Prompt Composer, the kept
scratch session as "Colour tile" with status `saved`, then the 63 element cards.

**Leaving Tools asks.** The rail belongs to the shell, so the question is asked there before the
column moves: it asks the standing Tools seat whether the visit holds anything unsaved and what it
was called, and asks only when there is something to keep and it has not been kept already. Keep
runs the same save signal; not keeping destroys nothing, because the visit keeps the tab's working
row and the next entry comes back to it. Not yet pressed by hand.

**Save takes about twenty-two seconds, and that is the Composer's door.** Measured twice: 22,551 ms
and 21,198 ms, with the model asked for the summary the semantic index needs. The row is written
before that answer; the wait is the model.

**The Tools seat's look and its gestures are files of their own (2026-10-31, later).** Two cuts, both
moves of text and neither a change of rule. `rooms/design/tools/tools-chat.styles.ts` now holds the
sheet the seat used to borrow from the Chat folder (596 lines) followed by the seat's own 93, in the
order the element declared them — the display is the tab's own, as the owner's rule requires.
`rooms/design/tools/tools-chat.frame.ts` now holds the frame's gestures — the seven methods that move
an edge, read the room and stop at a number — with an interface stating exactly what the frame may
reach on the seat; the seat keeps one-line delegates under the names its template binds. The seat went
from 6,101 lines to 5,715, and the Chat tab's copy was not touched.

Measured on the live Tools tab in a new page, after the move: the boxes at rest were header 55,
conversations 38, footer 53, input 94, the output filling the column at 234 — the recorded numbers.
Then every band was pulled, in both directions: conversations 38 → 78 on a 40-pixel pull and the
output 234 → 194 giving exactly 40; the header 55 → 85 on 30 and the output giving 30; the footer
53 → 67 on a 40-pixel upward pull with the input 94 → 80, the pair rule and the input's own floor
landing exactly as `SLOT-PLAN.md` §6 records; and every one of them returned to its number when
pulled back. Type check clean after the move.

**Correction to the plan.** An earlier entry in `design/TOOLS-SEAT-SPLIT-PLAN-2026-10-31.md` said the
seat's stylesheet was 3,503 lines and that moving it would halve the file. The stylesheet is 95 lines;
the 3,503 was measured from the stylesheet's first line to the drawing's first line, and everything
between is the methods. The plan carries the correction and marks the old claim measured-and-wrong.
What remains of its step two: the slot and view methods, and the tab rail — about 420 lines.

**A move that broke the page, and its repair (2026-11-01).** The second half of the frame extraction
sliced `tools-chat.ts` by line number, and the slice carried members that are not methods — a getter
among them — into the module. A getter is not allowed at the top level of a file, esbuild refused the
module, and the Design room's error boundary caught it. The repair script then removed the moved text
from the module before its own check failed, so for a few minutes fourteen members — the eleven view
slot methods, the column-edge drag, its release, and the collapse toggle — existed nowhere in the
working tree.

They were recovered whole from `dist/assets/DesignRoom-CSu_lfZS.js.map`, the last build's own source
map, which embeds the file's source text. `_evalsDrawsThread` came back identical to the copy read
from the working file minutes earlier, which is the evidence that the map is faithful for these
members. They are back in the seat, the type check passes, and on a fresh page the Tools tab draws its
three bands, its Title field and SAVE; the conversation band pulled down 30 took its card 38 → 68 with
the output giving 30, and pulled back up, both returned — with header 55, footer 53, input 94 and the
output at 234 at rest.

**What step two stands at.** The seven gesture methods are in `tools-chat.frame.ts` and proven by
pulling (2026-10-31). The view-slot methods and the column edge are back in the seat and NOT moved;
they will be moved one method at a time, with each boundary printed and checked before the edit, and
with a copy of the file taken first. The files in `rooms/design/tools/` are untracked by git, which is
what made an ordinary safety net unavailable.

**The view slots and the column edge join the frame (2026-11-01).** Fifteen members moved into
`tools-chat.frame.ts`: the eleven that decide which view fills the `view` slot and which tab that
view claims, the getter that says whether a tab draws the thread, the strip whose drag resizes the
column, its release, and the rail's collapse toggle. The seat went from 5,715 lines to 5,437; the
frame is 751. Twelve of the fifteen are the block that broke the page a few hours earlier — this
time the span was READ FIRST: every member in it was listed, the getter among them was found, and it
moved deliberately as a function of its own instead of arriving at the top level of a file.

Measured: the type check passes; on a fresh page the Tools tab draws its three bands, its Title field
and SAVE with the view slot filled; the conversation band pulled down 30 took its card 38 → 68 with
the output giving 30, and pulled back up both returned; the rail moves the room to Chat and back, and
the SAVE control belongs to Tools alone (present on Tools, absent on Chat). The frame needed one
import for this move — `html`, for the empty view slot's single line of text — and one contract
addition the compiler named: `requestUpdate`.

**`_onTabChange` stays in the seat on purpose.** The tab press also switches which conversation the
seat reads and writes (`conversations`, `conversationId`, `messages`, `_local`, `_send`), and that is
chat behaviour, not frame. The rail's navigation part is already announced by the seat; the
conversation part belongs where it is.

**A kept session's card now takes the person back to where they were (2026-11-01).** The owner,
after saving: *"when I clicked on it, it doesn't reopen the state of where I was."* It did nothing at
all, for two reasons: the room's only listener answered card ids that belong to catalogue elements,
and a session's id is not one; and that listener runs only while the Tools tab stands, which it was
not when the card was pressed on the console.

Three links were added. The shell now reads the pressed card from the console's own list and, when
the card is a session (its key is empty), asks the room for Tools carrying that id — the
`design-tools-open` door that had a listener and no sender. The room hands the id to the Tools seat.
The assembly accepts it: `render-design` with a `session_id` adopts that row when it is this person's
own `design_session`, and builds the tab in it — its conversation, its conversation list, its title,
address and notes — while any id it will not adopt opens the tab's own working row instead. The form
opens holding those three values through three new bound paths, `/session/form/{title,url,notes}`.

Measured. Asked directly, the assembly for `1575f99b…` ("output-footer-area import") answered with
that session's id, its conversation `a0d26644…`, three conversations, and a form carrying the title
`output-footer-area import` and the Figma address it was read from. In a new page, pressing that card
on the Design console moved the room to Tools; the form opened holding the same title and address; the
seat was bound to `1575f99b…` and to `a0d26644…`, with its one message read; the conversation list
drew its three rows — "Design — Tools" and two "New Chat". Type check clean.

Pressing Save on a reopened session writes that same row, because the seat takes the id from the
assembly rather than making one — reasoned from the path, not yet pressed by hand.

**Saving while a preview stands now says what it costs (2026-11-01).** Owner, 2026-11-01: *"when it's
in preview, there's really nothing to save because that's ephemeral … just add an additional save
button just so they know that they're not going to see it. They'll have to run the ingestion process
again because the preview will disappear."* And: *"they still have their title, they still have their
link and they still have their notes."*

So Save is not refused. When the drawing in the middle is an ingest preview — not a row opened from
the catalogue — the press raises one question and writes nothing until it is answered: *"The drawing
in the middle is a preview — nothing has been added to the catalogue. Saving keeps this session but
the preview goes with it, and you will have to run the ingest again. Approve keeps the component
instead."* Three buttons, in the Composer's own shape, as a copy in the Tools folder:
`rooms/design/tools/ToolsDecisionDialog.tsx`.

- **Save anyway** runs the pane's own discard — so the temporary folder is not left held — and keeps
  the session with its title, address and notes, its output saying `preview not kept: <tag>`.
- **Approve** runs the pane's own approve, then keeps the session with `approved: <tag>`.
- **Cancel** writes nothing and leaves the preview on screen.

The room draws the question because the seat is headless; the seat asks with `design-save-decision`
and the room answers with `design-save-decision-answer`. Approve and discard are the pane's own two
actions, reached through one shared reference — there is one approve in the seat, not two.

Measured: the type check passes; in the open tab the question drew with its sentence and the three
buttons, and Cancel closed it — after which the database still held exactly one kept session
(`1575f99b…`, "output-footer-area import") and the five tab rows, nothing new written. The Save-anyway
and Approve paths are wired to the same two actions the pane uses and are not yet pressed with a live
preview.

**The refusal reads as a list now (2026-11-01).** Owner, on the ingest answer: *"format this text …
so that the user can read it easier. Right now it's just one huge block."* Nothing about the
ingestion changed — the same sentences, the same count, the same gate. What changed is how the seat
hands them over and how the preview draws them.

`component-preview` gains two settings: `noteLines`, so the summary, the exactness line and the
approval line each draw on their own line, and `unread`, the named gaps drawn as a list under the
note with a heading that states the count ("What could not be read or drawn — 11 things"). `note` is
kept as the fallback for any host that still sends one string. The seat stops joining the eleven
findings into the note and passes them as the list.

Measured by rendering the element with the same eleven sentences and looking at it: three summary
lines, then the heading and eleven items, each on its own line with air between them, then the
actions below. The page was cleaned of the check afterwards.

**Three false findings in the catalog check were my own comments.** The checker counts braces with a
parser that treats an apostrophe inside a `#` comment as the start of a string, so a comment reading
"the saved work's own three values" swallowed the rest of the block and attributed three properties
of the neighbouring element to the form. Removing the apostrophe removed the three findings: the
check now reports 45, none of them about the elements touched today.

**The writers that answered for the design are gone (2026-11-01).** Owner, 2026-11-01: *"it
interprets the specs exactly down to a pixel, and it builds it exactly based on the specs. If it
breaks, that is the only way a designer will know that the design needs fixing. Build it wrong
because it is built wrong in Figma. That is the only way."* And: *"Stop making it work; make it
exact with no drift, ever."*

**The root cause of four of the eleven findings, reproduced exactly.** A stroke's transparency in
Figma sits on the paint (`opacity`), and the stroke path called `_figma_color(s)` without it, in two
places (`routes/figma.py`), while the fill path had always passed it. The result is the number in the
answer: `#933a45` where the design states `rgba(147, 58, 69, 0.5)`. Passing the paint's own opacity
returns exactly `rgba(147, 58, 69, 0.5)`. Nothing else about the eleven changed: three of them are
values the design does not state, and one is the pipeline's missing examination.

**Four writers removed, and what replaced them.**

- **The face.** `_local_face()` returned the application's face for every design. It now returns the
  family the design states, so a draft carries `font-family: "Inter", sans-serif`. The sentence that
  warned the application would draw its own face is deleted, because it would now be false.
- **The border weight.** `weight or 1` and the literal `1px` are gone. A side whose width the design
  does not state is not drawn; a stated width is written as stated. Where every side agrees the rule
  is one `border:` line; where they differ it is `border-width` and `border-color`.
- **The shadow.** A missing colour was filled in with black at 25% and missing distances with zero.
  Now a shadow is drawn only from the parts the design states; if the colour or a distance is absent,
  the effect is not drawn.
- **The colour object.** A colour was interpolated into the stylesheet as a Python dictionary
  (`border: 1px solid {'hex': '#933A45', …}`), which is not CSS at all, and a fill of that shape
  crashed the renderer outright. One converter now reads the measurement's colour and alpha and
  writes `rgba(...)` or the hex, and multiplies a paint's own opacity in.

**Measured after the change, on four cases.** A translucent stroke with a stated weight draws
`border: 1px solid rgba(147, 58, 69, 0.5)`. The same stroke with no stated weight draws no border at
all. A fill of alpha 0.4 under a paint opacity of 0.5 draws `rgba(207, 215, 213, 0.2)`. A shadow with
no stated colour draws nothing. Pixel values are not rounded: `_px` keeps four decimals, so a move of
one pixel stays one pixel.

**One record per subject from here (2026-11-01).** Two subjects have outgrown this log and now keep
their own, so nothing is written twice:

- **The Figma ingest** — `design/figma-ingest/CHANGELOG.md`, which is the running record that has
  existed since 2026-09-12 and now carries the 2026-11-01 entry: the five writers removed, the placed
  frame that had lost its offset, and the eight requirements they produced. The ingest lines in this
  log today (the refusal list, the writers, the check's apostrophe) are superseded by that entry; this
  log keeps the room's own work — the seat, the session, the save warning.
- **The approval process** — `approval-reviews/`, at the top level on the owner's instruction, holding
  `APPROVAL-PIPELINE.md` (moved from `console/approvals/`) and its own `CHANGELOG.md`, where every
  claim is marked verified, specified-not-built or verification-pending.

`backend/CHANGELOG-FIGMA-INGEST.md` is now a three-line signpost to the ingest folder, so a person
reading the code finds the record without a second copy to drift.

**A saved session's card must also stand on the main console (2026-11-01, requirement — not built).**
The owner: *"we have a saved session function that creates a card on the design console … it should
also add that same card to the main console. It has its own logos … its own category."* Today the card
is written and read by the Design console only (`backend/routes/design_console.py`); the global console
does not list `design_session` rows. Recorded here because it is a requirement rather than a fix, and
because it is easy to lose: the two consoles read different queries today, and a second reader would
be the wrong way to make them agree. The execution plan is
[`PLAN-2026-11-01-STATE-AND-NEXT.md`](./PLAN-2026-11-01-STATE-AND-NEXT.md), Phase 3.

## 2026-11-02 — the question on leaving Tools is asked only when something changed

The owner, looking at a dialog over his own screen: *"there is no need to [ask] if nothing has
changed after opening."* The dialog read *"output-footer-area import" is not kept yet…* over a
session that had been opened from its card and left untouched.

**Why it appeared.** The seat asked "does this visit hold work?" by testing whether the title, the
address or the notes were non-empty. A reopened session arrives with all three already filled from
the row it was kept as, so a visit nobody had touched looked exactly like a visit full of unsaved
typing.

**What changed.** The seat now remembers the three values the visit opened with, and the question is
asked when the fields differ from that starting point or when a preview is standing. The starting
point is set where the form is seeded from the session — the same place the fields are — and again
after a successful save, because what was just kept is the new starting point.

**Verified on the screen**, in a tab of my own, against the kept session `output-footer-area
import`:

| action | question |
|---|---|
| opened it from its card, left Tools for Chat | none |
| returned, changed the title by one character, left | asked, naming the new title |
| put the title back, left | none |

A preview standing still asks, because a preview is made in this visit and dies on discard. A fresh
visit with nothing typed still leaves without a word. Save itself is unchanged.

## 2026-11-02 (later) — the design system's card says what the system is, and opens the tool in it

Two requests from the owner in one message: *"we need to add a description to the design cards:
'This design system manages the applications them. All components and primitives featured are either
in use or pending approval.' Also the card should just open the tool with the loaded DS, which this
one is the default. Let's explore how we can open Carbon in the same way."*

**The description was blank for a measurable reason.** The row already held a description; the read
that builds the card never asked for it — `get_or_create_design_container` selected id, title,
metadata and created_at, and not `description`. So the card drew nothing, and nothing on screen
could tell "no description" from "not read".

| what | where |
|---|---|
| the read now returns the description | `prompt_sessions_api.get_or_create_design_container` |
| the sentence is written to the row once, and only when it differs | `prompt_sessions_api.set_session_description`, called from `routes/design_console.py` |
| the console draws it | no change — the grid already forwards `description` to the card |

The sentence is the owner's, word for word. It is stored on the two system rows and read back, so the
card and the row are one record and a console load writes nothing after the first.

**A system card now opens the tool in that system.** The card's key was `system:<id>` and the shell
returned on any non-empty key, so both system cards did nothing. Now:

- the shell sends `design-tools-open { openSystem }` for a `system:` key;
- the room carries it to the seam;
- the seat asks the assembly's own door — `render-design:<system>` — which already resolved a named
  design system's container and catalogue.

`prompt-composer` is the default, so pressing that card asks for exactly what the tab already stood
in. Nothing is switched and no new control exists: the press is the choice.

**And the head was lying about the system it was in.** The name, the count and the catalogId were
read from the official catalogue no matter which system the room was in, so a Carbon tab would have
been headed "Raibach Prompt Composer Catalog". The three facts now come from the catalogue of the
system the tab is in, through one map that names where the two ids differ (`raibach-ids` and
`prompt-composer` read the official catalogue; `carbon` reads its own).

**Verified on the screen**, in a tab of my own:

| press | what the Tools tab showed |
|---|---|
| Raibach Prompt Composer | `Raibach Prompt Composer Catalog`, 73 components, the prompt-composer catalogId |
| Carbon | `Carbon`, 58 components, the carbon catalogId, and the list beneath it is Carbon's `cds-*` elements |

Both system cards draw the sentence; the kept session card keeps its own description.

**What this does not do.** An approval still writes the one catalogue the repository carries. The
card decides which system the tab is READ in; which catalogue an approval writes is the open
catalogue-pin decision in `PLAN-2026-11-01-STATE-AND-NEXT.md`, and it is untouched.

**The sentence's wording, corrected the same day.** The owner read it back — *"yes: 'Do you want 'the
applications themselves'?'"* — so the card now reads *"This design system manages the applications
themselves. All components and primitives featured are either in use or pending approval."* One line
in `routes/design_console.py`; the two rows followed on the next console load, because the write
happens only when the stored text differs. Verified in the row and on the card.

## 2026-11-02 (later still) — "no catalogue named carbon" appears, then loads

The owner, opening the tool in Carbon: *"We had this at one time: The catalogue above these
components could not be read — no catalogue named 'carbon'… we get that error message and then it
seems to load… We just need to load the design system, right? That error message popped up for some
reason."*

**Two causes, both in the list that draws the catalogue's head above the components.**

1. **The bundled fallback named one catalogue.** `CATALOG_MODULES` was a single file —
   `prompt-composer/catalog.json` — so when the live read missed, Carbon had nothing behind it and
   the block said "no catalogue named carbon". Carbon is named now, as a second literal path and not
   a folder glob, because the brief forbids enumerating the folder: a deleted one would survive in
   the browser as a failed dynamic import.
2. **Two reads raced, and the older one wrote last.** Opening the tab runs the catalogue read; the
   seat's own rebuild runs it again. The older read could fail after the newer one had answered, and
   its failure overwrote the success — the error stayed under a list that had loaded. The read now
   carries a token, the same guard the layer tree already uses, and only the newest read may write
   the block's state. A superseded read says nothing.

The live read also asks a second time before it gives up, for the same reason the ingest's read does:
a first ask that misses while the file is being served is not a failed read.

**Verified on the screen:** the Carbon card pressed, the block watched for ten seconds — no error
appeared, and the head and list loaded with Carbon's 58 components and its own catalogue address.

**What is not claimed.** The exact instant that made the first ask miss was not captured; what is
written above is what the code did with it. The two changes remove both ways that miss could become a
message that outlived the load.

## 2026-11-02 (later again) — the component lists read in the application's face

Owner: *"Apply the default font to the component lists for the design systems."*

**Three places set a font, and the row's words were not governed by any of them from outside.**
Measured before the change, in the Carbon list: the row computed IBM Plex Mono, and the name inside
the row's tile computed Inter — because the tile is the design's own element and the design states
its face inline on the run spans, which no stylesheet can reach from outside its shadow root.

| what changed | where | why there |
|---|---|---|
| the row takes the host's face | `figma-layers-view.ts` `.lrow` — `font-family: inherit` | the host already declares IBM Plex Sans; inherit follows it if the default changes |
| the listing names the face it wants | `figma-layers-view.ts` `.lrow-tile` — `--catalog-row-font` | a custom property is the one thing that crosses a shadow boundary |
| the tile's boxes use it, with the design's face as the fallback | `f-40001207-3497.ts`, two rules | unset means the design's own Inter, exactly as before |
| the row's spans take it | `f-40001207-3497.behaviour.ts`, `applyRowFont` | the design states the face INLINE; only an inline assignment beats it — and the companion is hand-written, so a re-ingest cannot take it away |

**Verified on the screen, measured, both catalogues:**

| list | row | name span | description span |
|---|---|---|---|
| Raibach Prompt Composer | IBM Plex Sans | IBM Plex Sans | IBM Plex Sans |
| Carbon | IBM Plex Sans | IBM Plex Sans | IBM Plex Sans |

**One trap paid for twice.** The first attempt put backticks around a word inside a comment in the
CSS template literal of `figma-layers-view.ts`; the template closed early and the whole room failed
to load ("Failed to fetch dynamically imported module"). The file's own comment warns about exactly
that. The backticks are gone and both files compile and typecheck clean.

**The catalogue's own name, missed on the first pass.** The owner, looking at the head: *"so the
font did not apply to the name of the DS."* He was right: the head above the rows is a SECOND
design element (`f-40001207-3559`), it draws its name with an inline Inter on its own span, and the
row's rule could not reach it. Measured: the name computed Inter while the count beneath it had
already taken the default.

The head's two boxes now read the same property, and the name's inline style asks for the same
property with Inter as the fallback, so a reader that does not set it still gets the design's face.
An after-render function was written first and removed: that element attaches no behaviour at all —
its values are bound in its own template — so the function could never have run, and a function in
a file that never runs is the kind of thing this log exists to keep out.

**Verified:** the head's name and its count both compute IBM Plex Sans, in the Default catalogue and
in Carbon, and the rows with them.

## 2026-11-02 (later again) — the layer name alone, and each design system's own chat

Two instructions in one message, both obeyed.

### The rows name the layer, and nothing else

Owner: *"remove the figma node id from the list name. We only need the layer name in the component
data trees."* The component row carried a second line under its name: `FigmaNode: 40001207:3497`,
and where the Figma map held no origin, the element's own tag (`f-40001204-5752`) — which is
generated from the node id and reads the same way. Both are addresses. The line is gone, and the
per-layer node id that each row of a component's tree drew beside its name is gone with it. What the
tree still shows is the mark that says a layer IS an instance of another component, because that is
a different fact from "which node this is". Removed with them: the helper and the style rule that
existed only to draw the id, so nothing is left in the file for nobody.

Measured on the screen afterwards: `FigmaNode:` appears **0** times in the Default catalogue.

### Each design system has its own package and its own conversation

Owner: *"each design system should have a card it has its own package. It has its own chat
conversation… These chats are not global. They are specific to the card"* and, on how: *"It should
be loading a conversation associated with that design system from the database just like we do with
composer packages. That's the only way to build."*

Nothing is hard-coded and no copy of a thread is kept. The package is the design system's own
`design_catalogue` row — the row the console already draws its card from — and the chat is read the
one way this codebase reads conversations, `conversations.session_id`, ordered by `updated_at`, so
the thread that opens is the **last modified** one. A system with no thread gets one on first open,
because a chat with nowhere to write is not a chat.

| piece | where |
|---|---|
| a card that names a system resolves that system's row, not the shared Tools tab row | `routes/ai.py`, before the Tools package is chosen |
| the newest of the system's threads is the one that opens | `conversation_api.get_conversations_by_session` — the list's own order |
| a card naming the DEFAULT system also owns its chat | `ToolsSeat.tsx` — the intent names the system whenever a card does |
| the sentence a system's card shows is written once | `prompt_sessions_api.DESIGN_SYSTEM_DESCRIPTION`, used by the console and the assembly |

**Verified against the database and the screen:** before the test, both system rows had **0**
threads. After pressing the Raibach Prompt Composer card, its row owned one, and the Tools seat was
bound to it (`conversationId b1324c6f`, `sessionId 2e607520`). After pressing the Carbon card, Carbon's
row owned its own, and the seat rebound (`conversationId b4a831b7`, `sessionId 5139293f`). Two systems,
two packages, two conversations. A kept session's card still takes precedence over both, and a plain
visit to Tools still uses the tab's own package.

**Not built, and written down as a requirement:** each design system's card should carry its own
metrics in the top header — its usage and its expense. The data does not exist yet. The requirement
is in `PLAN-2026-11-01-STATE-AND-NEXT.md`, Phase 3.

## 2026-11-02 (later again) — the console is a tab, and a card is a package

Owner: *"Every tab technically has its own package. I mean console, which is the default page. When
you land on design loads chat, she introduces herself… that console for design should have its own
package just like the global console with a conversation tied to it — currently it says zero
conversations and she's speaking, so that means something's not right. This is the foundational
structure and architecture of the application: it's database-tied… two hollow empty containers
injected with information from a database or a separate file."*

**He was right, and the contradiction was measurable.** The console's seat was bound to the Design
**container** row — the "division" — which owns no conversations, while its `conversation_id` pointer
named the **Chat tab's** conversation. So the seat spoke over one package's thread while the list
counted another package's conversations and reported zero. A `design_tab | console` package already
existed with its own thread and was used by nothing.

| what | where |
|---|---|
| the Console tab resolves its own package, and its own conversation is created when it has none | `routes/design_console.py` |
| the seat's `session_id` is the Console package, not the Design container | `routes/design_console.py`, the payload |
| the conversation the seat opens is that package's **last modified** thread | the read's own order (`updated_at DESC`) |
| the shell no longer binds the console seat to the Chat tab's package | `DesignSeatShell.tsx` |

Measured before: session `1d61cd4c` (the container, **0** conversations), conversation `f13c2530`
(which belongs to the Chat package). After: session `323d1990` (Design · Console), conversation
`ef4f91ec` (its own thread), and the Conversations list shows the same thread rather than "No
conversations yet for this package."

**A card is a package.** *"Each of those cards represents a package with its own conversation, and
load the last conversation by default… We can get rid of the other cards for design because they're
not tied to any database structure they're just filler or stubs."* The console listed one card per
catalogue **element**, generated from the catalogue file — no package, no conversation, nothing a
person made. Those are no longer drawn. Nothing is deleted: the rows stay in the database and the
elements stay in the catalogue.

Measured after: the console lists **3** cards — Carbon, Raibach Prompt Composer, output-footer-area
import — two design systems and one kept session, each a row with its own conversation.

**On her introduction.** The words are not stored text: the seat is given an instruction and the
model answers it, and that answer is a message in a conversation. What was wrong was the container
it would have written into — a package that owned no conversations. That package now has one.

## 2026-11-02 (later again) — the conversation list on the Tools tab: found, not fixed

Owner: *"Clicking on the card loads a package and right now it's not loading a package… there's one
conversation in the Raibach Prompt Composer catalogue, but it doesn't load in the output window."*

**What was measured, before changing anything.**

| question | answer |
|---|---|
| does the card load the system's package? | yes — the Tools seat came up on the system's own row (`sessionId 2e607520`) and its own thread (`b1324c6f`) |
| does that thread hold messages? | no — `conversation_messages` has **0** rows for it, and the stored count agrees; it was created empty |
| does the assembly return the conversation list? | yes — `render-design:prompt-composer` answered with one conversation, titled "Raibach Prompt Composer" |
| does the seat receive it? | **no** — the seat's own `conversations` was empty |

So the package loads and the thread is genuinely empty. The defect is the LIST: the seat is never
handed the conversations the assembly resolved, so the control shows nothing over a package that has
a thread.

**What was tried, and why it was taken out again.** The list was handed to the seat from the two
sources reachable in the shell. Both resolve to the CONSOLE's list, not the Tools tab's — the room's
frame carries the console's data model, and the headless engine's report carried the console's
thread as well. Measured after the attempt: the seat drew another package's conversation
(`Design · Console`, `ef4f91ec`) under the prompt-composer session. That is worse than an empty list,
so the assignment is out and the code says so in place, with the measurement.

**The next step, named.** The list must come from the Tools tab's own assembled tree — the one
`buildContent` reads when the seat is drawn — and the first job is to read that object at run time
and see which path it holds. This is one binding, not a refactor; what made it slow is that every
candidate source in this shell looks plausible and only one is the tab's own.

**The empty conversation now asks her to open it — half done.** Owner: *"that one conversation is
generally the initial prompt to ask the user what they wanna work on and reference the seat… don't
tell her what to say and just add that to that existing conversation which is empty."*

The seats only greeted when a package had NO conversation. A conversation that existed and was empty
was drawn as a blank column and stayed blank for ever, because nothing ever treated it as new. Both
seats now treat a conversation they have READ and found empty exactly as a missing one: an arrival
is taken and she is asked once, in the seat's own words. The server already writes HER reply into
the conversation and does not write the instruction (`routes/teacher.py`), so the thread gains her
opening and the person's next sentence lands beside it.

**Verified:** the prompt-composer seat now takes the arrival — measured `_greeted: true` where it was
`false` before.

**Not verified, and the reason this is half done:** her reply does not arrive. After the arrival the
conversation still holds **0** messages in the database and the seat draws nothing. The page's own
resource log showed no request to the teacher endpoint, so either the turn returned before it was
sent or it failed without a message — that is the next measurement, and no further machinery was
added on a path that has not been shown to work.

## 2026-11-02 (later) — the screen's state travels with the conversation, and a defect it exposed

**What was built.** The Tools tab now remembers the size a person gave each of the five boxes and the
filter they put on the component table, in the same record that already held the scroll
(`conversations.surface_state_json`). A drag saves when it ends; the filter saves when it changes; both
are read back when the conversation opens, including on a press of the tab rather than only on a page
load. Proven on the running app: the table filtered to “footer” reads 5 of 73, leaving and returning
restores it.

**The defect the test found, which was mine.** A filter was not counted as work, so leaving Tools after
only filtering ran the silent-discard path: the session row and its conversations were deleted and a
new session appeared. Measured on this machine — the Tools package `bfd86ace` and its conversation
`d77b9c7b` were removed by that path during the test. The conversation held one greeting; nothing else
was lost, and the tab now works in a fresh package. The rule is corrected: a filter and a box size
count as work, so leaving asks Save, Accept or Discard instead of throwing the session away. Re-proven:
filter → leave → the question appears → Accept → return → 5 of 73.

**Two smaller faults, both fixed and seen.** The filter's restore could be lost when the seat read it
before the room was listening or before the room's assembly replaced the tree; the room now asks for
the value and the value is re-applied to every assembled tree. And a comment written between the
attributes of `tools-chat-controls` was printed as page text beside the bar; it now sits above the tag.

**The report of a crash.** A React error boundary was reported on the Design room. It did not
reproduce in a fresh browser: the room loads, the console draws twelve cards including the kept
session, Tools opens, the table filters, and no error appears in the page's own error listeners across
the whole sequence. The likely cause was a stale module during the edits; it is recorded as
unreproduced rather than explained.

### 2026-11-02 (later still) — the reviewer's surface, and what it proved

The Design rail carries `Approve`. Its view lists every design session that is not saved, and draws
the selected session's events with two answers. The list is `GET /api/design/reviews`; the answers post
to the review record built earlier. Proven on the running app against a scratch session addressed to
"Dana Whitfield": it appeared as "in review", pressing Approve moved it to "approved", and the list row
said so. The scratch row and its events were removed after the proof.

The tab had existed in the rail's own list since the design drew it; what kept it off screen was the
console's `allowedTabs` string, which named five tabs and not this one. The string now names six.

### 2026-11-02 — the Tools conversation had text the person could not see

**The report.** "The tools chat still does not load and I click tools — there's a conversation but
there's no text in the chat output."

**What the seat held, measured in the page.** The seat's thread held her greeting — "Hi, I'm Grace — I
work alongside you in this console…" — and the output showed an empty card. Two rules were the cause
and they compounded:

1. The Tools tab slotted a second element, `grace-tools-chat`, in front of the seat. That element is
   the old Tools conversation; it drew an empty card, and it was the thing on screen.
2. `showsThread` allowed the thread for `chat` and `approvals` only. `tools` was excluded, so even
   with the view gone the seat hid its own thread.

**What changed.** The Tools tab slots no view at all; the seat is the Tools chat. And `showsThread`
names `tools`, so the seat draws its conversation there like any other conversation tab.

**Proven on the running app.** The Tools tab now draws her greeting in the output, and the
conversation carries it as a stored message — measured in Postgres: conversation `e53f0452`, one
message, count 1.

**What this leaves, named.** Her greeting still says "in this console", because the room's script is
one script for every tab; the per-seat profile is the open item in
`design/plans/05-SEATS.md`. And the Tools tab has accumulated several conversations named "New Chat"
from earlier tests; the list can remove them.

### 2026-11-02 — the Tools chat is its own file, and the copy is gone

**The owner's direction.** *"You may need to write a file for the tools chat that just serves the tools
chat instead of trying to repurpose another chat … use the database as a way of loading it."*

**What was wrong with the copy.** `tools-chat.ts` was a byte-for-byte copy of the console seat with the
tag and class renamed. Everything that misbehaved in the Tools tab came from it: a send path that
switches the seat to the chat tab, a view slot the console's template fills, a thread rule that listed
`chat` and `approvals` and hid the conversation on `tools`, and a default-conversation rule that moved
to the newest row — a test "New Chat" — clearing the thread that had just loaded.

**What replaced it.** `rooms/design/tools/tools-conversation.ts`, the element `tools-conversation`,
written for this tab only. It reads the package's own pointer first and the conversation's turns from
the database; it draws the packaging list with add and remove; it greets only into an empty thread, in
this tool's own words; and after a send it reads the thread back from the database rather than trusting
a field name in the answer — the answer's own field had changed shape twice, and a guess drew an empty
thread over words that were written.

**Deleted.** `tools-chat.ts` (5,245 lines) and `tools-chat.styles.ts` (698 lines). Nothing imports them;
the type check is zero.

**Proven on the running app.** Tools draws one conversation, its one stored turn — "I'm Grace, the
assistant for this Figma ingest tool…" — and no error boundary. The seat's tab-switching code does not
exist in the new element, so it cannot happen.

**What this costs, named.** The five boxes and their grips lived in the old seat, so the Tools column
shows a plain card and a plain input for now. The frame is still one file for the section
(`rooms/design/frame/chat-frame.ts`) and wiring it into this element is the next step.

### 2026-11-02 — the new Tools element is backed out; the designed column is restored

**The owner, on the replacement:** *"Destroyed the chat … the chat container is gone and then it looks
like you built a new … we need to back that out whatever you just did or you need to finish."*

**Backed out.** `tools-conversation.ts` is deleted and the shell creates `tools-chat` again. The
designed seat and its stylesheet were restored whole from the last build's own source map
(`dist/assets/DesignRoom-*.js.map`, which embeds the source): 5,374 and 699 lines. The import that
makes the element exist had been dropped with the view in the earlier change, and the column rendered
as an un-upgraded tag until it was put back — that is why the seat had no shadow tree.

**Re-applied, because the restore predated them.** The tab is taken from the row (`tools`) instead of
being forced to `chat`, which is the flip between the two tabs. The package's pointer is the default
instead of the newest row, which was the thread that loaded and then disappeared. A table filter and a
box size count as unsaved work, so leaving asks instead of discarding. And the screen's state is
re-read on every press of the tab.

**Proven on the running app.** The Tools column draws its five boxes — `output-header`,
`design-chat-header` twice, `tools-chat-controls`, `design-chat-plugin-tray` — the seat's tab stays
`tools`, and the thread draws her words from the conversation: "I'm Grace, the assistant for this
Figma ingest tool…".

### 2026-11-02 (later) — the Tools tab opens the last conversation, not an empty one

**The owner, on the tab:** *"Why can you not make the last conversation load inside of tools? I've
asked 15 times."*

**What was wrong, measured.** A Save relabels the tab's working row `design_session`
(`routes/ai.py`), which frees the one-per-tab slot: the next press resolves a fresh row and its own
empty conversation. The last conversation therefore stood only on its card, while pressing Tools
showed an empty chat. The seat then greets into that empty thread, so `message_count > 0` is also
true of a thread nobody has spoken in — and a check by count would keep the tab empty forever. The
second half was the draw path: a rebuilt seat kept the conversation id of its previous package while
its list held the saved session's threads, and the list read adopted a thread only when nothing was
bound (measured: the seat held `c39f1852` and drew nothing over it).

**What changed.** `prompt_sessions_api.get_latest_design_session` reads the newest kept session of
one tab. `conversation_api.holds_person_turn` asks whether any thread of the tab holds a turn with
role `user`; a greeting is an assistant turn and is not the person's work. The `render-design`
resolver resumes the kept session when the tab's own package holds no person's turn. A card that
names a session still wins, a system card still wins, and a failed read is not an empty tab.
`rooms/design/tools/conversation.ts` now replaces a bound conversation the package's list does not
contain, so a stale id cannot survive a rebuild.

**Proven on the running app, 2026-11-02.** Press Tools after a page load: the title is
"output-footer-area import", its Figma address is filled, three conversations are listed, and the
stored turn is drawn. Press Chat and return: the same. Switch to Console and return: the same. No
person's turn was typed, nothing was asked, and the database's session, its conversations and its
message were unchanged.
