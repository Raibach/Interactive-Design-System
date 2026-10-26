# Handoff prompt — the Design room (paste this into a new chat)

You are picking up work in `/Users/raibach/Documents/Raibach_IDS` (FastAPI + psycopg2 backend on 8000,
React + Lit frontend, Vite dev server on 5001, Postgres locally). Read this whole brief before touching
anything. The previous session built most of the plumbing and then failed at one specific thing; this
tells you exactly what exists, what is broken, why, and what is still undecided.

## 1. What the owner is asking for (his words, do not re-litigate these)

- **THE interface is fixed and shared.** A tab is a *room behind sliding doors* (his fusuma metaphor), never
  a different interface. Tabs: `Console, Composer, Design, Product, Development, Governance`.
- **Design is the same experience as the Composer**, with the **ingest tool as its content**:
  left column = the component tree (the ingest's rail: Figma URL, catalogue chips, the layer/component
  list), the **third column** = the output (the ingest's Preview), right column = **Grace**, responding to
  what happens in the left column.
- **"You don't replace, you inject."** The ingest's three regions are *ported into the room's slots*.
  They are deliberately unstyled — *"what you've got is unstyled, it has no theme, it's just the
  application the way you built it"* — and the container supplies the frame and the theme.
- **The order is fixed:** *"the assembly happens. The render of this container happens and then the
  injection happens. It's in an order."*
- **Reuse the Composer's Lit components; do not build from scratch; do not fork the container.**
  But he has also said: *"If you have to make a different component because you can't figure out how to
  load something inside of it, then build a different lit component for the design section."*
- **Registry entries live in BOTH places:** *"they have to be entered in composer, and then they have to
  be re-entered into the design… they can share the same name."* A design-side entry can carry the same
  name as the composer's; renaming comes later.
- **A catalogue is never invented by the app** — it is found/resolved. (Earlier in the session a
  `render-design:carbon` test created two catalogues nobody had added; they were deleted. Don't repeat it.)
- Working agreement: **no commits and no pushes without an explicit command**; the **local database is the
  source of truth** (back it up before migrations; never commit dumps); **errors are wanted** — never
  suppress a renderer report, fix the cause.

## 2. What already exists (built and, where stated, measured)

**Database (local Postgres).** Four new levels exist as rows in the single package table `prompt_sessions`,
each one-per-user/-per-element enforced by a partial unique index, created with `INSERT … ON CONFLICT DO
NOTHING`:
`metadata.session_type` ∈ `design` → `design_catalogue` → `design_master` → `design_child`.
Grace's conversation hangs off the `design` container. `init_db.py` also gained **15 columns** that existed
only in `CREATE TABLE` bodies and therefore on no running database. Verified: row counts unchanged, all
three views still read, backup verified by actually restoring it.

**Server.** `backend/routes/ai.py`:
- `render-design` has its own branch (alongside `render-composer` and `render-section:<id>`).
- It resolves the Design container + catalogue + Grace's conversation and emits a session value keyed to
  the container (never a prompt package).
- **The defect (see §3):** the component tree it emits is still the *model's Composer tree*, filtered by
  `design_omits = {"control-bar"}`.
- `backend/deps.py` now loads **one catalogue per surface** (`prompt-composer`, `design-artifacts`);
  `validate_a2ui_components(components, surface)` and `a2ui_catalog_id(surface)`; the composer's stays the
  default so every older call site is unchanged. Verified: both load (56 components each), module imports
  cleanly under `backend/.venv`.
- `backend/prompt_sessions_api.py`: `get_or_create_design_container()`, `get_or_create_design_conversation()`,
  and a `<> 'console'` / `NOT LIKE 'design%%'` exclusion in `get_sessions` (note the `%%`: a bare `%` in a
  psycopg2 query is read as a placeholder and took the whole backend down once).

**Client.** `frontend/src/pages/WritingAreaIndex.tsx`:
- Design has **its own renderer instance** (`designRendererRef`, a second `<a2ui-renderer>`, mounted at the
  `headerTab === 'design'` branch), **its own tree** (`designTree`) and **its own session**
  (`currentDesignSession`), assembled by `assembleDesignSurface()`. A click on Design calls that function
  and writes nothing the Composer owns (measured: `prompt_sessions` count unchanged, no conversation under
  any package, the header tab staying where the person put it).
- **The injection** (built): a `createPortal` from `react-dom` targets the room's `<workspace-layout>`,
  found by reading the design renderer's **shadow root** after `await el.updateComplete`, and renders
  `<IngestModal variant="section" open apiFetch={apiFetch} onClose={() => {}} />` into it.
- `frontend/src/components/IngestModal.tsx`: `variant="section"` returns **its three regions and nothing
  else** — a fragment, no wrapper, so each is a direct child of the container and is projected by its own
  `slot` attribute (`left` = the rail, `middle` = the Preview, `right` = the procession + Grace).

**New file.** `frontend/src/components/A2UI/catalogs/design-artifacts/catalog.json` — the design's own
catalogue, `catalogId` `https://raibach.net/a2ui/catalogs/design-artifacts/v0_9_1/catalog.json`, 56 names
(same names as the composer's, which is the point of "both places"). It is now **read by the server**.

## 3. What is broken, and why the container does not behave like the Composer's

**The honest answer to "why can't you preserve the behaviour and the container".**

The container *is* reused — the same `<workspace-layout>` element, drawn by the design renderer, measured
on screen (`div.pane.left`, `div.gripper`, `div.pane.middle`, `div.pane.right`, 1280×664 at y=56). What is
not reused is the **content contract**, and the Composer's behaviour is partly the behaviour of its
children, not only of the element:

- the middle pane **exists only when its slot holds an element** (`workspace-layout._onMiddleSlotChange`
  → `_hasMiddle`);
- the right pane is tracked through `_onRightSlotChange` → `_hasRight` / `_rightPanel`, and its rail,
  width, dock and collapse all run through whatever is in that slot (`_syncRightPanel`, `_onCollapseToggle`,
  `_onTabChange`);
- the left column's bar, scrolling and footer are `left-column-header` + `prompt-section-editor` +
  `control-bar`.

**And the design tree was DERIVED INSTEAD OF AUTHORED.** `render-design` takes the model's Composer tree
and subtracts `control-bar`, so the Composer's content is still sitting in Design's slots while the
ingest's regions are injected into those same slots. The container then stacks both in each pane. Measured
in the running app (design renderer's shadow root, after clicking Design):

| pane | assigned elements | geometry |
|---|---|---|
| `left` | `prompt-section-editor`, then the injected rail | panel ends y=382; **rail starts y=382 and is 1672px tall** |
| `middle` | the injected Preview | y=75, h=207 |
| `right` | `chat-panel`, then the ingest's Grace column | chat-panel spans y=56→720; **Grace's column starts at y=720** — below a 664px-tall room, i.e. off-screen |

So the slot assignment **works** — the regions are correctly projected into the named slots — and the
result is still wrong, because each pane holds two things and the second one is off the bottom. That is
what the owner saw as *"she put it underneath the container"* and *"prompt inputs are still there"*.

**Two further facts that matter:**

- `prompt-section-editor` (the Composer's panel, the design's `center-panel-3rd-col` 40001066:3888) has
  **no `<slot>` in its shadow DOM**. Nothing can be loaded *inside* it as it stands. That is exactly the
  case the owner ruled on: build a different Lit component for the design section if that is what it takes.
- I have **not** verified the grippers/docking/resize in Design. Only geometry was measured. Say so; do
  not claim behaviour you have not seen.

## 4. What I did not do, and the decisions still open

1. **Give `render-design` its own tree, authored in code, not filtered from the model's.** Design's frame is
   a fixed contract, so it does not need the model to guess it: a `workspace-layout` root
   (`isThirdOpen: true`), the left column's bar, and the three panes left EMPTY for the injection. No
   `prompt-section-editor`, no `compiled-output-viewer`, no `chat-panel`, no `control-bar` — none of those
   are Design's. Validate it against `design-artifacts` (already wired) and let the surface declare that
   catalogue's id.
2. **Then re-measure** that each pane's assigned element is exactly one injected region (the table in §3 is
   the check).
3. **If the left column must keep the panel's frame around the rail**: build the design's own panel Lit
   element **with a `<slot>`**, register it in `tag-registry.ts` *and* in
   `catalogs/design-artifacts/catalog.json` (the two places), emit it in the design tree, and portal the
   rail **into the panel** rather than into the pane. Watch the attribute mechanics: the ingest's regions
   carry `slot="left" | "middle" | "right"`, and a light child whose `slot` attribute matches no slot in
   its host's shadow tree is **not rendered at all** — so either the panel exposes those names, or
   `IngestModal`'s section mode gains an explicit seat prop.
4. **Decide Design's Grace.** Right now the right pane holds BOTH the Composer's `chat-panel` (bound to
   Design's conversation) and the ingest's own Grace column. The owner's intent: she is assembled in
   Design's own render, with her own seat — one of these two is redundant.
5. **The registry half is unfinished.** `frontend/src/shared/tag-registry.ts` has
   `surface: z.enum(['console','composer','both'])` and `CATALOG_TIERS` derived from it; there is no design
   surface and no `design-artifacts` tier yet. The server half is done (§2).
6. **The third column's rule.** In the Composer the root has **no `middle` child** at rest: a prompt that
   has not been run shows two columns. For Design the owner wants the third column to open on **select or
   Preview**. Decide whether the Preview region is injected always (opening the column at rest) or only
   once there is something to preview.

## 5. Environment facts that cost time last session — do not rediscover them

- **`RESTART-LOCAL.sh` is how local runs**; it sets `UI_PORT=5001`, so `http://localhost:5001/` is the real
  local site. A **second, stale Vite server from Sep 27 is still listening on 5173** (`--host 0.0.0.0`) —
  two servers serving the same source is a trap.
- The backend runs **without `--reload`**: a Python edit needs an explicit restart. It was down today
  **9:56→10:13**, and the dev server's log shows `proxy error … ECONNREFUSED` for `/api/*` throughout —
  the app genuinely was broken then.
- The owner's browser window failed with **`ERR_SOCKS_CONNECTION_FAILED`**, which is raised *before* any
  connection to 5001: Brave's Tor helper was running (started 10:22:12 under Brave). Tor refuses loopback
  destinations by design, so `localhost:5001` can never load in a Tor private window. A plain incognito
  window (`⌘⇧N`) loads it. macOS itself has no SOCKS proxy configured.
- **Shadow DOM:** `document.querySelector` cannot see into it. Read `renderer.shadowRoot` (see §3). This was
  twice mistaken for "the surface never arrived".
- **Lit changes need a hard reload** (`⌘⇧R` from a page loaded *after* the change): `customElements.define`
  runs once, so Vite's hot reload does not re-register an element.
- **psycopg2:** a bare `%` in SQL is a placeholder — escape as `%%`.

## 6. State of the tree

Nothing is committed. Restore points: branch `restore/sections-empty-left-20260930`, stashes
`stash@{0}` and `stash@{1}`. Modified: `backend/routes/ai.py`, `backend/deps.py`,
`backend/prompt_sessions_api.py`, `backend/init_db.py`, `frontend/src/pages/WritingAreaIndex.tsx`,
`frontend/src/components/IngestModal.tsx`, `frontend/src/components/lit/left-column-header.ts`,
`frontend/src/components/lit/trace-feed.ts`. New: `frontend/src/components/A2UI/catalogs/design-artifacts/`.

If the owner asks you to back out, that is a decision for him to state — do not revert on your own
initiative, and do not touch the database rows he did not ask about.

## 7. Where to start

Read, in this order: `frontend/src/components/lit/workspace-layout.ts` (the container's slots and pane
behaviour), the composer branch and its assembly prompt in `backend/routes/ai.py` (the LAYOUT CONTRACT
near `is_section`), the design branch below it, then the injection in
`frontend/src/pages/WritingAreaIndex.tsx` (search `designRoomEl`), then `IngestModal`'s
`variant === 'section'` return. Then do §4.1 — author Design's own tree — and re-measure §3's table.
