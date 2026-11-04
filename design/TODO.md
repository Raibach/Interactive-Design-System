# The to-do list — what is open, what is settled, and what comes next

*2026-11-03. This was `UNDONE.md`; the name now says what it is. It records your answers, the facts I
checked, the open work, and the items that belong to no plan. What stands today is in
[`CHANGELOG.md`](./CHANGELOG.md); the seven plans are the acceptance tests. The structure is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).*

## The three facts I checked

**The two cards are different, and they are the real ones.** The console draws `system:prompt-composer`
(Raibach Prompt Composer) and `system:carbon` (Carbon). On disk, `prompt-composer/catalog.json` holds
73 components and `carbon/catalog.json` holds 58, and pressing each card opens the tool in that
system's own catalogue.

**The catalogue default, explained.** Pressing Tools with no card opens the Raibach Prompt Composer
catalogue every time: its 73 components in the left column. The rail offers no list to choose from,
and the catalogue name saved in the session does not decide what opens; the tab writes its own
default over it when it loads. That fixed default is what the earlier notes called the "pin". It is
one line in the tab's own code (`DEFAULT_CATALOGUE_SYSTEM = "prompt-composer"`), not a feature with a
switch.

The design-system cards are the other road. Pressing Carbon's card, or the Prompt Composer card,
builds the tab in that system's own catalogue and chat. A visit that names no system still starts in
Prompt Composer. The 2026-11-03 answer is the selector: Raibach Design System first and default,
Carbon beneath it, and the choice belongs to the person. The tree under a system, the functionality
nodes and the console's gallery are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**Only two of the five `design_catalogue` rows are real.** `prompt-composer` and `carbon` have
catalogues on disk. `raibach-ids`, `room-embed` (Agent Canvas) and `f-40001207-3497` have none and are
stubs from earlier runs; nothing draws them.

## Your answers, recorded

1. **The two cards already separate the catalogues.** I checked; they do.
2. **The pin** is explained above; the 2026-11-03 answer is the selector.
3. **Which rows are real** is answered above; it was mine to check, not yours.
4. **Any person can be a reviewer.** Deferred to the approval plan.
5. **A session is a growing package.** It can be shared, picked up by another person, and reassigned to
   a new owner. Approval gates are recorded events inside it. It is not a task.
6. **Catalogue files are themes; the data comes from the database.** The reference for how a surface
   takes data, binds it and handles a user action is `AGENTS-instructions/`.
7. **A duplicate is the same name, marked pending.** Approving it replaces the approved one. Deferred
   to the approval plan.
8. **Save is the state since the last save**, recorded per person, so the session can later show what
   each person did.
9. **The status line says what just happened.**
10. **Save saves whatever happened in the session.** The files should be thin shells; the database does
    the lifting. Activities are not recorded today, and that is the base to build.
11. **A card is a shell over database rows.** The database should carry the card's row, not the file.
12. **A missing face is a conversation.** Tell the person; the chat offers to replace it or to ask for
    it to be added; adding enters the approval queue.
13. **A new component is expected and welcome.** It becomes a new card with its own data. The database
    is the holding container — drafts, temporary items and previews included. Milvus is unused today
    and could hold previews or pending approvals; that is worth exploring.
14. **The R mark will grow into real functionality.** The rail itself can wait; the chat is already the
    navigation inside the seat.
15. **The chat output is a surface.** It speaks, offers functions, presents diagrams, asks for files.
16. **Keep the stubs; list dead code for the refactor.** Do not touch gestures; the approval flow is
    now its own plan (02). The plans are broken out below.

## The seven plans

| plan | what it covers |
|---|---|
| `plans/00-DATABASE.md` | the tables as they stand, and the six gaps the other plans fill |
| `plans/01-INGEST.md` | complete 2026-11-03 — the reading, the checks, the accounting, the font conversation |
| `plans/02-APPROVALS.md` | reviewer, review surface, the running audit log, the ingest trace, the chat's question, people and sign-in, approve and return, the final write, duplicates |
| `plans/03-CATALOGUES.md` | the two real systems (the three stubs are retired), the registries, Carbon in git, the selector and the tree |
| `plans/04-UX-TAB.md` | the readout, the actions, the functions slot, the output port, Add context |
| `plans/05-SEATS.md` | the frame and each seat's own conversation file in the other tabs, dead code |
| `plans/06-CARDS-AND-CONSOLE.md` | the card as a row, the screen as rows, the action as a row, the gallery's kinds, the card's context prompt, sharing |

## The next work

The order is mine. Ask him which he wants first, and give him the options with their cost in one line
each. If he says nothing, start with the architecture's selector and tree.

1. **The architecture's selector and tree** — choose a design system from a selector (Raibach Design
   System first, Carbon beneath it), then open the tree from the system through the global console and
   the tabs, the components, their child elements and the functionality. Selecting a functionality
   loads its code; the chat recommends the Development tool. `plans/03-CATALOGUES.md` step 5 and
   `plans/06-CARDS-AND-CONSOLE.md` step 7.
2. **The approval plan's last two** — the final approval that writes the catalogue, and the rule that a
   change to an approved component becomes the same name marked pending.
3. **The catalogues** — a `registry.json` beside Carbon and Prompt Composer, Carbon committed to the
   repository, and the decision about a third system.
4. **The UX tab** — the readout, New chat and Download, the functions slot, the PostHog output port, the
   refused preset prompts, Add context, location actions, tracking.
5. **The seats** — adopt the frame and each seat's own conversation file in UX, Executions and Settings;
   retire the shared `chat-panel` per room; settle the fifteen drawing pieces; the dead-code list.
6. **The consoles and the session** — one read for both consoles; the card's logo; sharing and
   reassignment; the status line; the read that unites Postgres and ClickHouse for the audit.

## Carried from the 2026-10-26 handoff

- The shared rail's hover and selected rules still sit in `chat-navigation-bar.ts`, which five other
  seats use. If every room is to be sovereign for behaviour, each needs its own rail. A decision, not
  taken.
- An instance of a component this system does not ship becomes a new pattern whose tag comes from its
  occurrence. Whether that is a pattern or a refusal is undecided.
- Ingest and discard rows written before the ephemerality rule remain in `figma_ingest_activity`.
- Six approved components predate the stored fact tables.
- `childMatches` is a stale always-empty field.
- The catalogue search is literal because Milvus holds no index of these components.

## Items that belong to no plan

- The room paints without a fade; your word for it is "it slams".
- The Tools placeholder sometimes reads `chat input` before the field exists.
- The two-click report on the Design rail was never reproduced.
- The audit's one blocking finding: `RoomEmbed` declares a `seat` slot its element does not render.
- Thirty-eight audit advisories.
- Built but not yet seen working on screen: the two-ask sentence on a real stall; a preview that
  survives a reload without writing; an approval with the pattern tick boxes; one Design room AI turn
  since the catalogue merge; the three-step colour and position test; the UX welcome on reload; the
  footer chip across the ten-plus places; and today's Tools work — her greeting, `+`, delete, title,
  Save/Accept/Discard, the console's whole-person list, and finding a component from the chat.
