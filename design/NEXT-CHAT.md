# The next conversation — the Design room and the Figma ingest

This is the opening brief for the next session. It says what stands, what changed in the session that
ended on 2026-10-26, what is open, and which documents to read before anything is touched.

## The one paragraph that matters

Each room is its own box. The Design room draws its own chat column, its own rail and its own tab
controls; the catalogue supplies shapes, styling and theme, and nothing else is shared for behaviour.
The Figma file is the authority for a drawing, and the component is a copy of it made by measurement:
every value the file states is carried exactly or reported as a gap with the value it should have had.
The layer's name is its identity. Errors are the product, never suppressed.

## Read first, in this order

1. [`src/rooms/design/README.md`](../frontend/src/rooms/design/README.md) — what the Design room is,
   its three conversation faces, and its own files.
2. [`src/rooms/design/CHANGELOG.md`](../frontend/src/rooms/design/CHANGELOG.md) — the room's own
   dated record.
3. [`src/rooms/design/PLAN-sovereign-design.md`](../frontend/src/rooms/design/PLAN-sovereign-design.md)
   — the plan the room was built to.
4. [`figma-ingest/CHANGELOG.md`](./figma-ingest/CHANGELOG.md) — the ingest's running record,
   newest first. The 2026-10-26 entry names everything done that day.
5. [`figma-ingest/2026-10-26-feedback-and-patterns/README.md`](./figma-ingest/2026-10-26-feedback-and-patterns/README.md)
   — the day in prose: the value-level proof, the patterns, the ephemeral preview, the readouts, the
   single catalogue, the search box.
6. [`figma-ingest/NEXT-CHAT.md`](./figma-ingest/NEXT-CHAT.md) — the detailed brief for the ingest
   pipeline itself, with its remaining tests.
7. The files this session changed, read before editing them:
   `src/rooms/design/chat/design-chat.ts`, `src/rooms/design/chat/parts/*` (fifteen files),
   `src/rooms/design/DesignSeatShell.tsx`, `src/rooms/product/productSurface.ts`,
   `src/rooms/development/useDevelopmentRoom.ts`,
   `src/components/lit/chat-navigation-bar.ts`,
   `src/components/A2UI/catalogs/prompt-composer/catalog.json`.

## What changed in this session

**The ingest.** The proof compares values rather than words, so a one-pixel move and a one-digit
colour change are both named with both values. The answer leads with what could not be read and says
whose gap it is. A design's children are patterns identified by layer name, drafted, proved and
registered at approval. The preview is a Lit component in `frontend/.preview/` and dies with the
preview; nothing reaches the database before approval. The list states what approving will write —
the existing component with its tag and date, then every pattern with a tick box, new ones ticked and
existing ones unticked — and the approval writes only the ticked ones. An approval and a removal name
their real stages as they run and stop on the stage that failed.

**One catalogue.** The list reads `prompt-composer` only. Primitives was deleted because its seven
names were already in the official catalogue. The design-artifacts catalogue's five room-only names
moved into the official catalogue (which now declares 73) before its file was deleted, and the Design
room's own checks now run against it. Carbon remains on disk for the Apply Carbon control and is not
offered in the list. Both module lists that read catalogues name the one file instead of scanning the
folder, because a scanned list kept a deleted file's name and failed with "Failed to fetch dynamically
imported module".

**The search box.** Above the catalogue's name, a literal filter of names, tags and Figma layers, with
a line saying how many of how many are shown, and a sentence when nothing matches.

**The Design seat is sovereign.** Fifteen chat parts — the rail, header, messages, input, action bar,
footer, fold, plugin tray, product tools and thread, small dropdown, sessions feed, error banner,
prompt textarea and response bubble — now live in `src/rooms/design/chat/parts/` with their own
element names (`design-chat-header`, `design-chat-messages`, `design-chat-navigation-bar`, and so on).
The seat imports no shared `chat-*` component. Measured: all sixteen design elements are defined, the
room draws its own, and no shared chat element appears in it.

**The rail's behaviour.** On the Design rail the selected tab ignores the pointer entirely: no fill
change, no growth, no bold. A tab that is not selected answers hover by growing its icon only. Closing
the panel keeps the active tab filled, because that is how the person knows which tab they are in.

**The Product and Development rails.** Product offers Chat, Approve and Settings. Development offers
Chat, Approve, Evals and Settings. Trace, Tools, States and Repairs were removed from Development at
the owner's word.

## What is open

1. **The two-click report on the Design rail.** Not reproduced: from Chat I pressed Tools, then UX,
   then Tools, then UX, and each press moved both the rail and the visible column in about one tenth
   of a second. The page that showed the fault was open before the seat was replaced, and a reload
   cleared it. If it returns, capture whether the panel was open or closed, which tab was current, and
   which tab was pressed.
2. **The shared rail still carries the new hover and selected rules.** The rules were asked for while
   the owner was in Design, but they sit in `src/components/lit/chat-navigation-bar.ts`, which the
   Composer, Console, Development, Governance and Evals seats still share. Design and Product have
   their own copies. If every room must be sovereign for behaviour, each needs its own rail — a
   decision, not taken.
3. **One uncommitted change was lost and one line was restored.** The shared rail was restored from
   git to undo an earlier edit, and that discarded an uncommitted `maskSrc` type line. The line was put
   back in both the shared file and the Design copy. Whether the file carried other uncommitted edits
   cannot be known, because the working copy that would have shown them was overwritten.
4. **The removed tabs' views remain in the code.** Product's Trace, Tools and Evals paths and
   Development's Trace, Tools, States and Repairs paths are no longer offered, and their view code is
   still present. Removing that code is a separate decision.
5. **The Design room's own AI turn has not run since the catalogue merge.** The room's five own names
   now live in the one catalogue; its next turn is the proof that the check passes.
6. **No approval has run since the pattern tick boxes were added.** The confirmation's "left as they
   were" sentence and a replace-exactly-one-pattern approval are unproven end to end.
7. **The three-step test the owner defined is still unrun as one sequence.** Ingest a design; move one
   node one pixel and re-ingest, reading the named change; ingest again, reading that nothing changed;
   change one digit of a colour and re-ingest, reading the named colour.
8. **The catalogue's title.** The file reads "Raibach Prompt Composer Catalog" and now holds the
   Design room's five names as well. A name for the one catalogue is the owner's choice.
9. **An instance of a component this system does not ship** is still a new pattern whose tag comes
   from its occurrence. Whether that should be a pattern or a refusal is undecided.
10. **Carbon is not in git.** Its catalogue exists only on this machine and is reachable only through
    the Apply Carbon control.
11. **Older open items.** Ingest and discard rows written before the ephemerality rule remain in
    `figma_ingest_activity`; the audit carries one blocking finding (`RoomEmbed` declares a `seat`
    slot its element does not render) and thirty-eight advisories; six approved components predate the
    stored fact tables; `childMatches` is a stale always-empty field; `DISAORD` is Figma's own spelling;
    the search is literal because Milvus holds no index of these components.

## What not to do

- Do not give one room's behaviour to another. If a control must change, change it in that room's own
  file.
- Do not restore a second catalogue, a fallback, a second copy of data, or an error suppression.
- Do not treat a file's write time as a component's date.
- Do not enumerate the catalogues folder in a module list; name the one file.
- Do not approve, remove or ingest into the catalogue without the owner's own press.
- Do not run a build test in the project that is open on his screen.
