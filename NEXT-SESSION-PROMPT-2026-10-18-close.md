# NEXT SESSION — 2026-10-18 close. Read this, then the code it names.

## THE LAWS (owner, verbatim, standing)
- `WritingAreaIndex.tsx` (12,554 lines on the box, ~12,700 local) is **RETIRED**: no more edits, no more
  solving anything inside it. Same for `chat-panel.ts` (~5,960).
- **Every tab inside Design gets its own dedicated file.** Every room gets its own host file. The shell
  only routes to a room's file and renders it.
- The only shared things are the **Lit components and the styling** — nothing else. No borrowing one
  section's frame for another; no copying an existing section as a shortcut; no shoving a second program
  into a console's frame.
- The **Figma ingestion program** is its own program: **three columns** — left = ingest form over the
  layers tree, middle = the preview a Submit opens, right = its own conversation. It is not a console.
- **UX stays** — do not remove or rewire the UX tab. It works today.
- Do not roll back or tear apart working features. Move forward.
- No fast hacks, no copy-paste jobs. New files, built correctly.

## WHAT EXISTS AND IS VERIFIED (local, 2026-10-18)
- **Design console** — `frontend/src/design/DesignConsole.tsx` (host states, own file), `DesignCards.tsx`
  (the console mount: reads `POST /api/design/console`, owns its own `<a2ui-renderer>`, draws cards +
  host states, wires the UX host). `backend/routes/design_console.py` answers a real envelope: 3 messages,
  `design-artifacts`, components `workspace-layout` + `ConsoleCardGrid` + `design-chat-panel` +
  `chat-repair-actions`, **58 design cards**, seat bound to design package `1d61cd4c…` / conversation
  `b6ca063a…`.
- **Design seat** — `frontend/src/components/lit/design-chat-panel.ts`, a whole duplicate of `chat-panel.ts`,
  retagged and registered. The room never draws the shared seat.
- **UX** — verified in-room: the UX tab mounts `ux-app-frame` (`http://localhost:8200`) in the left column,
  signs in server-side (`POST /api/ux/posthog-login` 200), hides the card grid, and draws our thread via
  `uxTalk`. The framed app is the **customized** PostHog from `design/posthog-master` (compose project
  `posthog-master`, files `docker-compose.hobby.yml` + `docker-compose.raibach-hack.yml`, our patched
  `csp_middleware.py`, `executables.py`, `llm.py`, `prompts/base.py` mounted live).
- **Tools program (started, not yet mounted)** —
  `frontend/src/tools/ToolsLeftPanel.ts` (new element, the tool's own left-column frame),
  `frontend/src/tools/ToolsTab.ts` (form over layers view, existing),
  `frontend/src/tools/GraceToolsChat.ts` (its conversation, existing),
  `backend/routes/tools_surface.py` (extended to the three-column tree: left `tools-left-panel` holding
  `figma-ingest-form` + `figma-layers-view`; middle `component-preview` **declared but not referenced**
  until a preview lands; right `grace-tools-chat`; data model `session.{id,elements,preview,ingest}`).
- **Approved reference copy** — `runtime/box-reference-2026-10-18/src/` = the live Hetzner studio source.
  It is the reference for the Figma program's behavior: `render-design` (10 components, three columns),
  the design renderer effect, the `ingest-submit` handler, the preview that opens the middle column
  (`children.middle = "design-middle"`), draft-by-address drawing. **Use it; never overwrite it.**

## WHAT IS STILL IN WritingAreaIndex (the extraction list — 74 references)
`designTree` 523 · `currentDesignSession` 526 · `designRendererRef` 1519 · seat states 980/1002/1019 ·
`designPreviewOpen`/`onDesignPreviewChange` 1050–1059 · renderer effect 1647–1820 · `assembleDesignSurface`
7761–7855 · ingest handler + `setDesignIngest` 8020–8226 · `setDesignPreview` 8285 · approve/discard/
collision effects 8514–8893 · callers 5224 + 9232 · JSX branch 12255.

## NEXT (in order)
1. `frontend/src/design/DesignRoom.tsx` — the Design room's own host: move the state, the renderer effect,
   `assembleDesignSurface`, the ingest handler, the preview/approve/discard effects into it. The shell keeps
   one reference. Compile + verify in the room after each move.
2. `frontend/src/tools/FigmaExperience.ts` — the Tools program's own element: own renderer, reads
   `/api/tools/surface`, owns the ingest (parsing via `@/utils/figmaUrl`, the verbatim refusals from
   `IngestModal`, `POST /api/figma/ingest`), writes `/session/preview`, adds the middle reference when a
   preview lands. Register `tools-left-panel`, `grace-tools-chat`, `figma-experience`.
3. The Tools rail button loads `<figma-experience>`; per-tab files for Trace, Evals, Repairs, Settings.
4. Only then: the same treatment for the other rooms.

## DO NOT
- Do not edit `WritingAreaIndex.tsx` or `chat-panel.ts`.
- Do not mount tool/UX content inside the console's two-column layout (workspace-layout measures one
  element per slot: `assignedElements()[0]` — extra slot children break the split).
- Do not remove UX; do not roll back the console; do not re-pull over local files.
