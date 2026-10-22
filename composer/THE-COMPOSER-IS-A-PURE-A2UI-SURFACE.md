# The composer is a pure A2UI surface — the zone's map, begun 2026-10-15

**Why this file exists.** Until today the Composer zone held one changelog and nothing else;
the only information about the room was its code and the A2UI documents. The owner's rule
(2026-10-15): *"Keep all notes in the folder for the specific seat/tab we are working on"* —
and the composer is a pure A2UI surface, so its notes begin with the surface itself.

**The code is the authority; this file is the index into it.** Every claim below was read from
the files on 2026-10-15. Companion plan (Design zone):
`design/DESIGN-UPDATE-FLOW-PLAN-2026-10-15.md`.

---

## 1. The room, in one paragraph

The composer builds prompt packages. Three columns: **left** = the prompt
(`prompt-section-editor`), **middle** = the run's output (`compiled-output-viewer`), **right**
= the chat seat (`chat-panel`), hosted by `workspace-layout` (the 3-column resizable host).
The room is not hand-drawn in React: the shell asks the server for a surface by **intent**
(`render-composer` for a blank composer, `render-session:{id}` for a saved package —
`frontend/src/pages/WritingAreaIndex.tsx` → `backend/routes/ai.py`), reads the envelope
(components + data model), refuses a malformed one **loudly** (no fallback rendering), and
hands it to the A2UI renderer, which resolves every component name to a tag and draws it. The
slot contract is fixed in the sandbox: left = prompt-section-editor, middle =
compiled-output-viewer, right = chat-panel (`frontend/src/components/lit/ai-surface-sandbox.ts`).
The AI fills the slots; it never creates the frame.

## 2. The layers (this repository's Lit catalog)

| layer | file | decides |
|---|---|---|
| CATALOG | `frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json` | what the **server** accepts. Refused = 503, the whole surface. `primitives` is the shared floor; `design-artifacts` carries the same names a second time (the Design room's gate) |
| REGISTRY (the allowlist) | `frontend/src/shared/tag-registry.ts` | name → tag, surface, column, props, events; `AI_PLAYGROUND_TAGS` is what the gatekeeper lets the AI emit |
| RUNTIME | `frontend/src/components/lit/**` | what draws |
| RESOLVER | `frontend/src/components/lit/a2ui-renderer.ts` | name → tag: `COMPOSITE_MAP` → primitives → structural composites → the allowlist. A name nothing claims is **reported**, never guessed — a guess draws an empty box and the failure then looks like styling |

Structure is an **adjacency list** (flat components with id references); content lives in the
data model. A component must be in **all** layers or nothing works; an unregistered tag fails
silently at runtime — the empty box with no error.

## 3. The prompt column, element by element (the box in the picture)

- **`prompt-section-editor`** — the assembly host for the prompt-input pattern. It owns the
  list of sections and seeds the three seats the design draws — System Role, User Role, Agent
  Role (order matches the Figma container, node 40000746-6). Its own note: this element owns
  `_sections`, so it is **the only place a change to the prompt can be made**. At Run, the
  sections are read back from this element — the only path.
- **`prompt-input-section`** — one prompt row: gripper + prompt-accordion (role-tile +
  Functions/Tools) + status-bar-prompt-input + prompt-textarea. Designer rules kept in the
  file: System Role is **sticky** (first, no menu, not draggable, not deletable); the arrow
  opens the type menu (roles + Add Section + Delete); the role label toggles collapse/expand;
  drag is anchored to the gripper only; an empty required field rings red **from the same text
  Run sends**, so a flag cannot describe a state the prompt is not in.
- **`gripper-prompt-input`** — the only drag anchor of a section (49×37, the meatballs mark).
- **`role-tile`** — the role label + chevron; emits `role-menu-toggle` and
  `role-tile-collapse-toggle`; its shadow comes from the measurement (`design/VALUES.json`).
- **`status-bar-prompt-input`** — the activity rail / status line of a row.
- **`prompt-textarea`** — the textarea ("Enter prompt text.").
- Supporting: `prompt-icons`, `prompt-container`, `model-selector-button`, `role-dropdown`,
  and the two older section variants (`prompt-input-section-system-role`,
  `prompt-input-section-department-role`).
- The choosable roles are **derived from the declaration** in
  `frontend/src/shared/promptSections.ts`, not retyped in the drawing.

## 4. Data binding — how values reach the drawing

- A binding is `{ "path": "/…" }` — **the object form only**; a bare string is never a path
  (`a2ui-renderer.ts:resolveBinding`). A prop whose path resolves to nothing renders empty and
  is **reported**, never a stand-in.
- Structure travels in components; **content travels in the data model**. Input components
  write back as a person edits: typing in the textarea goes into the section and is emitted
  without a re-render — the textarea owns its caret.
- The prompt's wire format is the labels the Run path keys on; the section list is read from
  the element (see §3). The repair flags read the same text Run sends.
- The seats are told apart by contract, never by convenience: **host seat** (mounted by the
  shell, aggregates the whole session) vs **surface seat** (emitted inside an A2UI surface;
  must carry conversation-id + session-id and aggregates only its own conversation). A surface
  seat that cannot resolve its own conversation renders tokens as "unattributed" — it never
  reads session totals.

## 5. Direct manipulation — the box is driven by hand and by the model

Two channels, one owner (the editor):

**In-surface menus** (a person can do everything by hand): the type menu (role list, Add
Section, Delete), Functions/Tools, and the triggers list from `shared/triggers.ts`.

**The window-event surface** — the editor's own note: *"Window event surface — unchanged
contract (AI can drive the editor)"*:

| event | what it does |
|---|---|
| `set-left-column-text` | write the whole left column |
| `force-set-section` | write one named seat |
| `fill-field` | fill a field |
| `add-prompt-role` / `remove-prompt-role` | add / remove a seat row |
| `a2ui:write-seat` | a chat button's `write-seat` action — dispatched by the chat panel **instead of being sent to the model**: the answer to it is a change to the prompt, not a sentence |
| `insert-tool` | put a tool in the seat; the name comes from the register and the seat gets the register's own text |
| `merge-seat` | put two duplicate rows back together, **on the person's own strings** — never round-tripped through a model, because a 400-character identity would come back as 380 characters of almost the same sentence |
| `move-tool` | move a tool to the step it belongs in |

The laws written into that code:

- **A write that lands nowhere is loud.** The editor dispatches the failure with the seats the
  prompt does have; the chat draws it as an alert ("Nothing was written… The prompt is
  unchanged."). Measured 2026-09-23: the failure was silent while her sentence said it was
  done — the listener exists for exactly that.
- **Offer vs write.** A chat offer (the panel's `_offerOnly` flag) does not write; the person
  presses the button, and the button's action changes the prompt. Nothing is applied to the
  prompt uninvited.
- **Tools come from the register.** The pre-labeled example tool is a **fallback**, drawn only
  until the server answers — an empty menu would claim "there are no tools" when the truth is
  "the list has not arrived yet". A name no register row answers is reported, and nothing is
  written.

## 6. The seat (the chat) — run review and the host's line

- A first Run is **held for her review** ("silence is not consent"): `<run_ok/>` releases it;
  anything else must say so, because the host shows the run as busy. A package that has
  already produced results is **not reviewed again** — the review is for a prompt that has not
  run yet.
- The host can put a line in the thread (`a2ui:system-message`): role + content, drawn as a
  message — the seat does not ask the model anything about it.
- A run's live lines ride in with their own stamps (`starting` / `building` / `finished` /
  `error`); the thread follows every line it grows.

## 7. The laws that protect this surface (checklist for any change)

1. **All layers or nothing** — element + Figma map + allowlist (+ `AI_PLAYGROUND_TAGS`) +
   catalogue + counts. `cd frontend && npm run catalog:check` is the gate; its verdict is the
   acceptance test; the report lands at `frontend/catalog-audit/prompt-composer.json`.
2. **Node labels and tag names are the stable anchors; properties and event payloads are
   additive-only.** A rename or a changed event detail shape breaks every consumer silently.
3. **A deleted element's dangling child ids render NOTHING** — report loud.
4. **No fallback rendering.** An assembly failure is the refusal, shown. Blank beats fake.
5. **A custom element is defined once per document** — new bytes need a refreshed document;
   this is why "refresh" is a real step in the design-update loop.
6. **Behavior first, pixels last** — the verification gate: round-trip, every control
   dispatches its event, drags change dimensions, and only then compare to Figma.
7. **Corrections are violations** — if the design lacks a control, render it absent and
   report; never invent missing pieces.
8. **No suppression.**

## 8. Where to look (the index)

- The shell and the assemblies: `frontend/src/pages/WritingAreaIndex.tsx`
  (`assembleComposerWithAI`, `assembleSurfaceWithAI`, `readA2UIEnvelope`).
- The sandbox + slots: `frontend/src/components/lit/ai-surface-sandbox.ts`.
- The host + 3 columns: `frontend/src/components/lit/workspace-layout.ts`.
- The prompt column: `frontend/src/components/lit/prompt-section-editor.ts` and
  `frontend/src/components/lit/prompt-input/` (the ten elements of §3).
- The chat seat: `frontend/src/components/lit/chat-panel.ts` (+ `chat-messages`,
  `chat-input`, `chat-navigation-bar`, `chat-action-bar`).
- The output: `frontend/src/components/lit/compiled-output-viewer.ts` (+ `output-header`,
  `output-controls`).
- The roles/triggers/tools declarations: `frontend/src/shared/promptSections.ts`,
  `frontend/src/shared/triggers.ts`, `backend/tool_run.py` (the register's runners).
- The gate: `frontend/scripts/catalog-check.mjs`; report at
  `frontend/catalog-audit/prompt-composer.json`.

**One forward note (kept here so it is not lost):** the prompt column family is hand-built —
the app's pioneer generation. The app's newer components follow the repository's built
protection pattern: an ingest-generated **drawing** plus a hand-written **behaviour companion**
in `frontend/src/components/lit/behaviour/` ("everything about the element that is not a
drawing"; the only part of the app an approve cannot overwrite). The design-update plan
(`design/DESIGN-UPDATE-FLOW-PLAN-2026-10-15.md` §1.4, M1) settles when and how this family
moves to that pattern, so a Figma restyle can update the drawing and sever nothing declared
here.
