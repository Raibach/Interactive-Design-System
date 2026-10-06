# wireframe-lab — changelog

## 2026-10-06 — the Product foot: the stubs go, the application's own tools arrive (wired)

Owner, 2026-10-06 — pointing at the v.4b "Active Plugins" tray: *"all of these stubs go. And
you're gonna put the products wiring down"* — *"just replace those functions in the bottom
footer of the chat."* The tray's five marks were drawing-only by their own header's admission.
The Product room's foot now carries the builder's tool row in the builder's own order —
**attach · Figma · GitHub · edit visually** — and every button ends at the product's real door:

- **attach** (and ⌘V — the app's clipboard rule: only when the clipboard is not really text)
  → new bridge route `POST /api/builder/projects/{id}/files/upload` forwards the multipart to
  the engine's own upload endpoint (field `file`) and returns ITS answer verbatim. Verified
  live: the local engine's honest refusal — "Attachments are not supported by the local
  engine." — lands as a chat line, the same sentence the app itself shows locally. When the
  engine grows upload support, the same call attaches for real.
- **Figma / GitHub / visual-edit** → the room posts `{type:'ids:product-tool', tool}` into the
  embedded builder (`<builder-embed>.postToBuilder`, aimed at the frame's own origin); the
  APP opens its own Figma/GitHub modal, toggles its own visual editor. Verified live: the
  pencil opened the app's Visual editor ("Connecting to your preview…"), the Figma button
  opened the app's own Figma modal (token field, instructions, Connect). The app posts
  `ids:tool-state` home (re-announced by `<builder-embed>` as `builder-tool-state`); the room
  mirrors it onto the seat's props — the foot's dots and the pencil's pressed state are the
  APP's facts, never a guess.

Set ONLY by the product room's binding (`chat-panel`'s `productTools`, through the same
`assignProps` door as every other seat prop); every other seat keeps the tray — verified:
Development still draws the tray and none of the tools. The foot element
(`chat-product-tools`) composes nothing and reaches nothing: it raises `product-attach` /
`product-tool` and the room answers.

Also in this pass: the empty thread's welcome line takes the owner's own dictated words —
*"Hi. Welcome product team. Let's get some ideas wireframed today. What's on your mind?"* —
and the Development room's gripper was re-verified: the shared element-size re-clamp fixed its
"stuck" pull-out too (grab at the rail → opens under the pointer → follows the hand to 449px,
release keeps her; no dev-specific change).

Test note, disclosed: Playwright's `setInputFiles` fires `change` twice, so the refusal drew
twice in the test (two POSTs 3ms apart in the log) — a harness artifact; a real hand picks
once.

## 2026-10-06 — the Product chat loads open at 550, and the gripper cycle proven

Owner, 2026-10-06: *"load the chat open by default at 5:50 pixels"* (550), and — added to the
list — *"the gripper is not allowing me to open and close the chat like the other sections."*

**550 on entry** (`WritingAreaIndex.tsx`, the product layout effect): the room now writes
`chatLoadWidth = 550` and `isThirdOpen = true` through the ref — the layout's own declared load
width ("a room that declares a width opens her THERE instead"), superseding the room's
2026-10-05 closed-on-entry rule. Verified live on a fresh entry: `isThirdOpen:true`,
`_rightPx:550`, pane 550 (`flex: 0 1 550px`), seat 550.

**Why the declaration alone froze at the 104px floor — and the element-size fix**
(`workspace-layout.ts`): `_columnWidth()` clamps her width against `this.clientWidth`, but the
only re-render trigger for that clamp was a WINDOW resize. A room whose tree mounts a beat
before its box lands at true size — measured here — computed its clamp from the zero-width
first frames and kept it: live probe showed the declared 550 sitting in `_rightPx` while the
pane stayed at the 104px floor for the whole session (flagged open, drawn collapsed — the
"won't open like other sections" look). A ResizeObserver now re-renders when the width this
arithmetic actually reads has changed, and only then — the same law the window listener
already stated, applied to the element's OWN box.

**The gripper cycle, verified end-to-end in Product** through the strip's own annotated
protocol (the events `chat-left-spacer #40001085:2598` raises: `input-resize-start/move/end`
with `clientX`): grab at the rail → she opens under the pointer; pull left → width follows the
hand (550 at the strip's x); release → stays; drag to the wall → follows to the floor; release
at the floor → collapses to the rail (`isThirdOpen false`, next open width 700 restored). The
same strip, the same events, the same law as every other room. Disclosed test note: Playwright
synthetic mouse drags feed the strip unevenly (its pointer capture) — one drag moved her, one
did not — so the deterministic proof is the protocol dispatch above; a real hand produces
exactly those events.

## 2026-10-06 — the stage loads again: the subdomain hang, fixed at its source

**The failure, measured (not guessed).** In the VS Code browser preview, a frame navigation to
the builder's per-project origin — `http://<project>.localhost:4000/`, the form the local
engine handed the UI — is fetched, gets HTTP 200 back, and is then ABORTED by the browser
(`net::ERR_ABORTED`); the stage stayed blank and spun forever. Controls in the same browser,
same minute: plain `http://localhost:4000/` loads; `http://localhost:4000/preview/<id>/` loads;
curl sees 200s everywhere. Nothing external was blocked — `/etc/hosts` clean, the stack's live
connections all loopback, DeepSeek reachable with a valid key. The stage simply never received
the document, because of the URL's shape in that browser.

**The fix, in this copy (`ai-app-builder-open/local-vcaas/server.mjs`, two edits).**
1. `previewUrlFor` now hands the UI the SAME path form the hosted engine already used —
   `http://localhost:4000/preview/<id>/` — locally too (`productionProjectUrl` matches). The
   per-project subdomain ROUTE stays served unchanged. Verified live: the stage's frame
   committed and rendered the empty-project splash, then a real build.
2. The stage asks for its page with the trailing slash stripped, so a built page's relative
   `./styles.css` resolved one level too high (404, unstyled page). `servePreview` now answers
   the no-slash form with a 302 to the canonical slash form. Verified: the built page renders
   with its stylesheet (`styleSheets: 1`).

**Proof build (one small run, owner-approved):** "The stage works" — `index.html` +
`styles.css`, built by the engine's own DeepSeek loop, displayed in the stage inside the
Product room.

Sovereignty note: both edits are local-only — no new host, no new call. The builder still
talks to nobody but its own engine, and the engine to nobody but DeepSeek when a run fires.

## 2026-10-06, later still — the store cleaned to its two real projects

Owner's call (*"This is absolutely brand new so we don't want any junk hanging out… but we do
want to preserve the Product Team category"*): the 34 click-born empty shells were deleted
through the engine's own DELETE route — each one VERIFIED empty (no conversation, no files, no
versions) immediately before deletion; nothing was skipped because nothing had content. The
full store was copied to `~/Raibach_IDS-vcaas-data-backup-2026-10-06/` first, so even this is
reversible. What remains: `product-idea` (the real Oct-3 project — "wireless headphones") and
`product-idea-h65` (today's stage proof, with the owner's follow-up run).

The **Product Team category row is untouched** (`#1C2F4E` / `#D3DF44` / `#FFFFFF`), as is the
bridge that creates it.

Console cards found: three — the wireless-headphones card appears TWICE (an Oct-3 row and an
Oct-4 duplicate, leftover of the pre-lock sync race; the sync cannot dedupe its own duplicates
because it keys by project id), plus h65's "My new product idea" tile. The duplicate's removal
is proposed to the owner (exact statement shown before running). Row deletion is self-healing:
the next console sync recreates exactly one row per published project.

## 2026-10-06 — the engine enters the repository (the backup the owner called for)

Owner: *"the engine is one of the most important things that we just did and it needs to be
backed up. You can git-ignore DeepSeek credentials and still put the core of the application."*
The builder app and its engine (`wireframe-lab/ai-app-builder-open/`, `local-vcaas/`) follow
main's 2026-10-05 ruling onto this branch: the folder leaves the vendored shelf in the parent
`.gitignore`, the core enters git (a mirror of main's 179-file set — today's engine fix, the
path-form previews and the slashless redirect, rides along), and the folder's own `.gitignore`
files keep everything that must not travel: the DeepSeek key (`local-vcaas/.env`), the engine's
store (`local-vcaas/data/`), and all build output (`node_modules/`, `.next/`).

## 2026-10-06 — the room absorbs the chat (step 1: the builder's own chat column retires)

Owner, 2026-10-06: *"I want to absorb that chat into our chat … I don't want two different
chat setting side-by-side."* The agreed shape: the room's seat (`<chat-panel>`) takes the
builder project's conversation as DATA — the thread is a bound prop, sends ride the one route
`/api/teacher/query`, and the backend seam answers that route for builder-backed conversations
by running the engine (the engine stays the transcript of record).

**Step 1, landed and verified live:** when the project page IS the room's embed
(`?embedded=console` + inside a frame), its chat column, its resize grip and the mobile
Chat switch are not drawn at all — the stage takes the width. Source:
`src/app/project/[projectId]/page.tsx` (`isEmbeddedInRoom`) — standalone :3223 keeps its chat
exactly as before. Verified in the room: the frame's composer and textareas are gone; only the
header and the stage remain.

## 2026-10-06 — the room absorbs the chat (steps 2–4: the application's behavior, verified live)

Owner, 2026-10-06, settling the shape: *"we're not taking Grace's behavior in the chat. We're
using the application's behavior in the chat"* — *"just a styling treatment to the existing
capabilities."* So the room's existing chat capabilities carry the application's own behavior:
a turn is a prompt to the local builder, the thread is the engine's conversation, the reply is
the builder's own words.

**The wire** (`backend/routes/builder_bridge.py`, `backend/routes/teacher.py`,
`frontend/src/pages/WritingAreaIndex.tsx`): the room's seat binds a CARRIER — a package row +
conversation keyed by `builder_project_id`, identity for the seat's guards and never the
transcript. `POST /projects/{id}/room` ensures it (serialized by `_ROOM_LOCK`: the room-entry
effect fires twice in dev and both calls used to race into two conversations);
`GET /projects/{id}/conversation` returns the engine's thread at entry; a turn on
`/api/teacher/query` for a builder-backed conversation runs the engine and answers with the
builder's sentence. The seat's script binding is plumbing (the seat refuses a room that binds
none; on this path it never reaches a model), and `graceLiveContext:false` is the seat's
required third state. A person-turn bumps the embed key, so the stage remounts on the new
build.

**Three defects the first real send found — measured, fixed, re-verified:** (1) the engine's
model speaks as author `"agent"`, not `"assistant"` — the first seated run answered "finished
without a written reply" while the sentence sat in the conversation; (2) the status flip and
the final messages share one tick (both stamped `15:42:25.349`) — the read re-reads for a
short grace window and scopes candidates to the messages after THIS prompt; (3) two
conversations for one fresh carrier — the race above, closed by `_ROOM_LOCK`. Also: an
`Enter`-clears-the-box change was briefly made to the shared seat (`chat-panel.ts`) and
REVERSED the same evening — owner: *"this chat is not universal. It belongs to product only
so you'll need to reverse that if you've affected other chat."* The seat is shared; only the
product room's own bindings may carry room-specific behavior, never the element.
## 2026-10-06 — the package model confirmed + built (persistence · resume · rename)

Owner, 2026-10-06: *"Composer creates a package under the user name and then that package
contains conversation IDs … the product team's work is the same way except theirs is not
called Composer, theirs is called a product ID or project instead of package, and the
conversation IDs would operate exactly the same."* Confirmed against live data — one package
on this machine already holds 6 conversations — so the "conversations become projects" rework
is DROPPED: a project stays a PACKAGE, and its conversations are the person's return visits —
*"five different edit processes over a month to one project … capture all of that history
inside of that project."* The builder's per-project log is that history; conversations are the
labeled doors.

**Built and verified live** (`backend/routes/builder_bridge.py`,
`frontend/src/pages/WritingAreaIndex.tsx`):

- **Persistence** — the sync no longer reaps an unpublished project's package: the row is
  kept and wears the mark every not-ready package wears (`draft`, which the console's card
  read already hides) plus a plain `builder_unpublished` flag. Verified: `product-idea-hyj`'s
  package survived a sync wearing `draft:true · unpublished:true`; the published rows (h65,
  product-idea) carry no marks — their cards show.
- **Resume on entry** — new `POST /api/builder/room`: entering Product reopens the project
  whose conversations moved last, and births one only when none exists. Verified:
  `resumed:true` returning `product-idea-hyj` — the owner's own project, most recently
  touched. (Entry no longer calls `/builder/new`; a new idea needs the door that was always
  coming with the room's chrome pass.)
- **Rename** — new `POST /api/builder/projects/:id/rename` writes the engine label (PATCH)
  and the package title together; the room's entry read prefers the engine label and keeps
  the pair in step. Verified: round-trip `ok:true` on hyj. The rename CONTROL rides the
  chrome pass — the seat's conversation list carries open/when/trash, no edit affordance.
- **Return visits name themselves** — a conversation still wearing its default title takes
  its first prompt as a label (product-scoped; a titled conversation is never touched), so
  the list reads as edit rounds instead of a stack of "My new product idea".
- **One welcome, then only the application** — an empty project's thread draws the single
  welcome line; the moment a build lands, the engine's own words are the room's voice.
- **Discard stays true** — the sync still reaps a package whose engine project is GONE.
  Verified: `product-idea-mj2` (project deleted in the tool) — row reaped; the rename
  refused with the honest `No project` error.

Nothing committed (checkpoint cadence).

## 2026-10-06 — Development owns its own chat (and its process survives)

Owner, 2026-10-06: *"It doesn't seem to own its own chat. It seems to be borrowing a chat from
product so therefore development breaks down … un-bind those … giving the product development
seat, its own chat"* — and the model behind it: *"developers are going to have a package,
they're gonna have chats related to the conversation ID … development processes that are
[not] shared … only for development."*

**Four faults found, all fixed and verified live:**

1. **The seat borrowed the Composer's tree** — the room's effect read `workspaceTree` (the
   Composer's loaded chat), so Development showed ANOTHER room's conversation. Gone: new
   `POST /api/builder/development/room` ensures the room's OWN package (`dev_room` marker,
   `draft` so it never cards) with its own conversation; the seat binds that.
2. **React reused the seat/frame nodes across rooms** — Product and Development reconciled as
   one subtree, so the same seat carried Product's conversation into Development. Fixed with
   room keys (`product-room`/`product-seat`, `development-room`/`development-seat`): each
   room mounts its own instances.
3. **A stale call shipped by today's rename** — the Product tab handler still called the
   retired `createProductProject` (ReferenceError on click, caught in the page's console).
   Pointed at `openProductRoom` (resume).
4. **The process died with its terminal** — the workspace log's last line was "Dispatcher
   received shutdown signal" minutes after a terminal-owned start. It now runs FULLY
   DETACHED — the shape the engine survives with: `(cd … && … nohup node agent-canvas.mjs
   -p 8090 >> log &)`.

**Verified live after a hard reload:** Development → seat = its own package (`86f49051…` /
conversation `562ffdcb…`, label "Development"), frame = `localhost:8090/?embedded=console`
painting the real workspace ("What do you want to work on?"). Product → seat = the resumed
project (`690679d8…`, the headphones idea — `hyj` was DISCARDED by the owner, its row reaped
correctly, rename refusing "No project"). Back to Development → its own identity again,
nothing carried over.

Noted, not ours: the tool's own console carries pre-existing noise (a React hydration warning
and one PostHog-without-token line — the token is blanked on purpose by the sovereign build).
**Verified live:** `product-idea-nxu` — send → 29s run → "Built a small habit tracker page
with the heading 'Habits from the room'…" rendered on the stage; a second send answered in 16s
with the builder's own words. `product-idea-mj2`, cold start — the box cleared on `Enter`,
the reply was the builder's sentence, the stage remounted. Every `POST /api/teacher/query` in
the post-fix log has a `[builder] seated run` line beside it: no turn in the room was answered
as Grace.

**Disclosed, not hidden:** the sync reaps carriers of un-published projects at the next
console assembly (by design — cards are for published work; watched happening today). A reap
DURING an open room would leave that room's next send unresolvable — not triggered in any
measured run; flagged to the owner.
