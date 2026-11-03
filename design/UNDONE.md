# Everything still undone — the index

*2026-11-02. The work is now six plans in `design/plans/`. This file records your answers, the three
facts I checked, and the items that belong to no plan.*

## The three facts I checked

**The two cards are different, and they are the real ones.** The console draws `system:prompt-composer`
(Raibach Prompt Composer) and `system:carbon` (Carbon). On disk, `prompt-composer/catalog.json` holds
73 components and `carbon/catalog.json` holds 58, and pressing each card opens the tool in that
system's own catalogue.

**The catalogue pin, explained.** On 2026-10-26 you said the room only needs the official catalogue.
The code recorded that as a rule: the Tools tab defaults to `prompt-composer`, the rail offers no
choice, and a stored choice from an earlier session was corrected on first load. It is not a
user-facing feature; it is a decision written into the code. Today it is softened by the system cards:
a card names its catalogue and the tab is built in it, and a visit that names none is still the
official one. The pin, as a question, is only whether that default should stay the default.

**Only two of the five `design_catalogue` rows are real.** `prompt-composer` and `carbon` have
catalogues on disk. `raibach-ids`, `room-embed` (Agent Canvas) and `f-40001207-3497` have none and are
stubs from earlier runs; nothing draws them.

## Your answers, recorded

1. **The two cards already separate the catalogues.** I checked; they do.
2. **The pin** is explained above.
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
16. **Keep the stubs; list dead code for the refactor.** Do not touch gestures or the approval flow
    now. The plans are broken out below.

## The six plans

| plan | what it covers |
|---|---|
| `plans/00-DATABASE.md` | the tables as they stand, and the six gaps the other plans fill |
| `plans/01-INGEST.md` | the reading, the checks, the accounting, the font conversation |
| `plans/02-APPROVALS.md` | reviewer, review surface, approve and return, the final write, duplicates |
| `plans/03-CATALOGUES.md` | the two real systems (the three stubs are retired), the registries, Carbon in git |
| `plans/04-UX-TAB.md` | the readout, the actions, the functions slot, the output port, Add context |
| `plans/05-SEATS.md` | adopting the shared frame and conversation in the other tabs, dead code |
| `plans/06-CARDS-AND-CONSOLE.md` | the card as a row, the screen as rows, the action as a row, sharing |

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
