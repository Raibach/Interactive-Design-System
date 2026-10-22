# NEXT SESSION — 2026-10-18 night. Read this first, then the code.

## READ FIRST
Do not read markdown for facts beyond this page. Read the code. Nothing here is a substitute for
opening the files named below.

## THE ONE OPEN DEFECT
**The Design room renders blank.** Measured after a reload and a Design click: 0 `agent-card`,
0 `agent-card-element`, 0 `figma-ingest-form`, 0 `figma-layers-view`, 0 `a2ui-console-card-grid`;
page text is nav labels only. The shell's design branch is reverted to
`<a2ui-renderer key="design-render" ref={designRendererRef} />` and `tsc --noEmit` exits 0, so the
code is the pre-attempt code — the room has not re-assembled, or the assembly returned nothing.

**First action: diagnose, do not build.** POST `/api/ai/assemble-surface` with
`{"intent":"render-design"}` and `X-User-ID: 00000000-0000-0000-0000-000000000001`, and read what
it answers (components, dataModel, or a refusal in its own words). Then read the page console
around the Design click. Only then decide whether the defect is the assembly or the shell branch.

## THE LAWS (owner's words, standing)
- Rooms are independent applications. The only shared things are the React shell and the styling,
  and the styling must be IDENTICAL everywhere. The separateness is internal; users never see it.
- Six applications; each gets its own AI file(s) and its own chat component with its own behaviour.
  Never one chat with tabs, never a global menu. Never build a 20,000-line page.
- Mini consoles get their own files. **Never share a file with the primary console.**
- Never lift, reparent or repurpose an existing piece. New files IMPORT the catalogue components.
- Method: duplicate whole → rename so it belongs to the room → work in the isolated copy → test →
  wire. Never carry pieces over by hand.
- The Figma ingest tool belongs to the Tools icon. Its component files are NEVER edited.
- The tool room, the design console and the application console are three different rooms with
  three different conversations. The tool room's chat talks about components and catalogue
  findings; the design console's chat talks about organising files/projects/packages.
- No fallbacks, no error suppression, blank beats fake. Test in the room (Playwright at :5001)
  before reporting. Measure; never declare.
- Do not touch the design surface's composition to move something. A thing that must be reusable
  gets its own file and its own surface first.

## FILES THAT EXIST AND COMPILE (verified tonight)
- `frontend/src/design/DesignConsole.tsx` — the console host-states component duplicated whole,
  renamed to Design. Primary `frontend/src/pages/ConsolePage.tsx` untouched.
- `frontend/src/design/DesignCards.tsx` — the design console's card loader (reads
  `POST /api/design/console`), compiles.
- `backend/routes/design_console.py` — the design console's own package endpoint. PROVEN:
  200, package `1d61cd4c…` ("Design", conversation `b6ca063a…`), 58 cards, category "Design System".
  Registered in `backend/main.py`.
- `frontend/src/tools/ToolsTab.ts` — `<tools-tab>`: imports `figma-ingest-form` +
  `figma-layers-view` with their real property contracts. Unwired.
- `frontend/src/tools/GraceToolsChat.ts` — `<grace-tools-chat>`: the tool room's conversation
  (`POST /api/teacher/query`, `{question, session_id}`). Unwired.
- `backend/routes/tools_surface.py` — `POST /api/tools/surface`. PROVEN: 200, tool-only tree
  (workspace-layout → figma-ingest-form → figma-layers-view), 58 element rows. Registered.
- `frontend/src/ux/ux-chat.ts` — `<ux-chat>`, the UX application's own chat. Unwired.

## WHAT WAS TRIED AND REVERTED (do not repeat blind)
- Mounting `<DesignCards />` in the design branch in place of `<a2ui-renderer>` drew a BLANK room
  (measured). The slot is sized and filled by the assembled surface tree; a host-states component
  cannot stand where a surface stood. The design console needs its own surface mount (sandbox +
  renderer + cards), not a swap.
- Earlier the same night: adding a `ConsoleCardGrid` into the design surface, and appending design
  cards into the primary console's render, were both removed. The committed design-element card
  shape block in `routes/ai.py` (comment dated 2026-09-30) was restored byte-identical after a bad
  rollback — verify it is still present before touching that file.

## THE QUEUE, in the owner's order
1. Diagnose the blank Design room (above). Nothing else until that is understood.
2. Give the design console its own surface mount; mount `<DesignCards />` there; test in-room.
3. Mount `<tools-tab>` + `<grace-tools-chat>` on the Tools tab as seat views
   (`slot="view"`, `view-tab="tools"`); test. The Figma rail leaves Design; Design's default
   tool conversation stops loading.
4. Remove the four UX-chat injections from `chat-panel.ts` (`uxTalk` property + declare,
   `_showsThread` term, `_send` turn-URL branch) and `designSeat.uxTalk = true` in
   `WritingAreaIndex.tsx`; mount `<ux-chat>` as a seat view; test.
5. Then the primary console's own file + its own card loader under the same duplicate-rename-
   isolate method.

## OUTSTANDING NON-STUDIO ITEMS (separate stack, done earlier tonight)
PostHog stack: 14 products starred through their own sidebar dialog; `capture-logs`,
`ingestion-logs`, `ingestion-traces` disabled by a `profiles: ['raibach-disabled']` line each in
`design/posthog-master/docker-compose.hobby.yml` (container removed); web/worker sizing set in
`docker-compose.raibach-hack.yml` (GRANIAN_WORKERS 2, WEB_CONCURRENCY 2,
CELERY_MAX_TASKS_PER_CHILD 100) with a measured drop from 9.55→4.93 GiB and 5.31→2.69 GiB.
One width overlay removed from the studio, archived at
`retired-files/responsive-warning-20261018/MinWidthWarning.tsx` — restorable in one line.
