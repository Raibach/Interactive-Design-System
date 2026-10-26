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
