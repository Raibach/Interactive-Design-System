# Handoff — the Design room, 2026-09-30

Written because a session was exhausted, not because the work is done. Everything here was
measured; nothing here is a plan.

## The rule that decides everything in this room

- The room is a **surface**: an adjacency list. Children come from the envelope's ID references.
  Nothing is mounted into it from the client — no React, no portal, no appended node.
- Two kinds of chat seat, **never interchangeable**: a HOST seat is mounted by the shell outside a
  surface; a SURFACE seat is emitted inside the assembly and carries conversation id + session id.
- Data belongs to the **database**, travels in the **data model** as `{ "path": "/x/y" }`, and is
  drawn by a **Lit element from the catalogue** (catalog + registry + runtime + resolver — all four,
  or it is refused). `npm run catalog:check` is the gate.
- The ingestion application is the **template**. Its functionality is translated into catalogue
  elements filled from the database. It is not styled to match and it is never copied in as React.
- Verify by looking at the interface: does the turn appear, does the call happen. Not by grepping.

## What is in the working tree (uncommitted)

- `frontend/src/pages/WritingAreaIndex.tsx` — the React portal that mounted the ingest
  (`IngestModal variant="section"`) into the room is **removed**, and `createPortal` with it.
- `backend/routes/ai.py` — the design branch (`render-design`) now emits, in the seat/panes:
  - `design-checks` → `chat-repair-actions`, bound to `/session/checks`: the catalog checker's rows,
    composed by `_repair_rows()` (the same reader the Console's list uses).
  - `element-grid` → `ConsoleCardGrid`, bound to `/session/elements`: the 58 `design_master` rows.
    **This shape is wrong** — see "the open gap".
  - the seat offers `repair` (see `DESIGN_TABS`) so the rail's own Repairs button draws and the
    check view is reachable, and carries `tracePrompt: False`.
  - `/trace` in the data model: the room's procession, composed from `figma_ingest_activity`
    (`_activity_from_db`, unscoped — the tool records no session yet), in the trace feed's shape.
  - the element rows carry `id`/`title`/`description`/`status` for the list element to draw.
- `frontend/src/components/lit/chat-panel.ts` — Enter now sends: `_onComposerKey` is bound on
  `<chat-input>` (`@keydown`). Nothing in the repository dispatched `message-sent`; the seat
  listened for it and the renderer forwarded it. The Send button's path is the one it uses.
- `frontend/src/components/lit/design-left-panel.ts` — the React mount inside it became
  `<slot name="left">`, so the surface's own children are projected there.

## Verified in the running app (fresh page, not a claim)

- The room holds only the renderer's components (`left-column-header`, `chat-panel`,
  `design-left-panel`); no `div`, no ingest markup anywhere; the layout sits at y = 56 (it was
  pushed to y = −129 by the injected 202px block).
- The rail offers Chat, Trace, Tools, Evals, Repairs, Settings.
- The Trace tab draws the database: "Live trace 50", rows like `audit approved — f-40001206-2888`.
- The check list draws: 24 rows, "3 blocking", on the Repairs tab.
- A question sent from the seat reached `POST /api/teacher/query` (200) and both turns were written
  to Design's conversation `3a33ba32`.

## The open gap — the thing to do next

The component list must be **the ingestion flow's own list**, not a grid: the ingest rail's left
column is a collapsible list/dropdown (`figma-layers-view`, `IngestModal.tsx:1703-1722`) and the left
nav's Components panel is a list of buttons (`LeftVerticalMenu.tsx:479-501`). The catalogue has **no
element that draws a bound list as a dropdown** — `role-dropdown` and `model-selector-button` take no
list binding — which is why `ConsoleCardGrid` was reached for and why it is the wrong shape.
The missing piece is a catalogue element that draws a **bound list** in that treatment. The gap is
real and measured: `role-dropdown` and `model-selector-button` are the only dropdown-shaped entries
in `design-artifacts`, and neither takes a list binding (`component`, `id`, `label` only);
`figma-layers-view` is the ingest's own element and is not a catalogue entry at all. The rows
themselves are already in the data model at `/session/elements` (58 rows read from `prompt_sessions`
where `metadata->>'session_type' = 'design_master'`), which is why the data half of this is done and
only the shape is wrong.

Also still not translated: her turns carry the room's script and the catalogue's facts, but **not
the component under review** (its source, what was measured, the checks that failed) — the context
`POST /api/figma/ask` already builds for her in the ingest.

## Things that cost hours and must not be repeated

- A Lit element change does not take effect through hot reload (`customElements.define` runs once).
  Verify on a page loaded after the change; the owner's rule is a hard reload.
- Do not remove the ingest tool from where it lives (the left menu). Only its React mount into the
  surface is forbidden.
- Do not author new components to make a shape work: enter it in the catalogue properly, or say the
  shape does not exist.
