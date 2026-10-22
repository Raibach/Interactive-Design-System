# The Conversation Contract — how the chat behaves, as invariants

**Project:** Deterministic Design System Manager — Raibach Interactive Design Studio
**Status of this document:** Authored 2026-09-24, from the failures of that evening; revised the
same night, after the reopen-after-Run failures were traced to their cause in Postgres. Every
measurement quoted here was taken from the running backend log and from Postgres
(`DATABASE_URL`, local) on that date. This is not a description of what the app does; it is the
set of rules the app must obey, and §4 says which file owns each one.
**Companions:** [`THE_PACKAGE_CONTRACT.md`](THE_PACKAGE_CONTRACT.md) (the package owns its
history) · [`../READ-ME/FLOW-REQUIREMENTS.md`](../READ-ME/FLOW-REQUIREMENTS.md) (what must be
true before a Run) · `../frontend/src/shared/autoAdvice.ts` (the recommendations rule)

---

## §1 — The unit is the package's conversation

A conversation belongs to a package (`conversations.session_id`, `NOT NULL`) and to one tab of
it. The console has its own package and its own conversations; it sees no package's thread, and
no package sees the console's. The owner, 2026-09-23: *"the chats are not global. They're
specific for the package, and console has its own package."*

Conversations are the **audit trail** — the same class of record as runs and evaluations. They
are separate rows with their own timestamps, they are never merged into one another, and a Run
gets a conversation of its own rather than appending to the one in front of the person. The
owner, 2026-09-24: *"it's creating a conversation audit trail and their timestamp … you can't
merge them together. They have to be separate."*

## §2 — The invariants

| # | Rule | Where it is decided |
|---|---|---|
| **C1** | **A package always has somewhere to talk.** Opening a package with no conversation creates one — for that package, before anything is said. | `chat-panel._greetIfArriving` (the `sessionId && !conversationId` gate) |
| **C2** | **She speaks on arrival, and only before it has run.** Opening a package she has not run greets from where the work stands and offers what to do next. The offer is the learning experience; it is NOT removed to silence a symptom. | `chat-panel._greetIfArriving` (the `offering` gate at the end) |
| **C3** | **Once it has run, she is silent unless asked.** A package that has produced results is not greeted and not proposed to. She answers when the person types, and says nothing else. The fact is READ, never guessed (C9). | `chat-panel._greetIfArriving` (`_hasResultTurns`), `chat-panel._send` (the backstop) |
| **C4** | **Recommendations belong to the first Run only.** After results exist she stops proposing and waits to be asked. The switch is the person's (`autoAdvice`). | `shared/autoAdvice.ts`, applied in `_greetIfArriving` |
| **C5** | **The results are the reading, and the view is not moved.** Opening a results thread places nothing: the thread's first content is already the head, and any scroll re-applied on render is a clamp the person cannot escape. The person scrolls freely. The rule ends when the person speaks. | `shared/chatScroll.resultsAreTheReading`, `chat-messages.updated`, `chat-panel._scrollThreadToBottom` |
| **C6** | **A Run files its results in a new conversation and archives the one it replaced** — both rows kept, each dated. | `chat-panel.adoptConversation`, `routes/teacher.py` |
| **C7** | **The seat is ONE element, reused** across the console and every package opened after it. Anything it remembers about "the last time" must be re-readable, because a new arrival is not the last one. | `chat-panel._takeArrival`, `_enterPackage` |
| **C8** | **A silent seat is indistinguishable from a broken one.** No rule is allowed to be implemented as returning without a word: either she speaks, or she has a stated reason to be quiet (C3). | `_greetIfArriving` — the two `return`-as-silence gates were removed |
| **C9** | **NO TURN IS SENT ON A GUESS.** Whether this package has run is answered by the package's own record, which arrives ASYNCHRONOUSLY. An unread list is not an empty one, and "not known yet" is not "no": a package's seat waits for its own list before any decision about whether she speaks. | `chat-panel._conversationsRead` (the wait), `chat-panel._readPackageConversations` |

## §3 — What breaking these looks like, measured 2026-09-24

Each of these was seen on the owner's machine and is the reason a rule above exists.

- **C1 broken — nothing happens at all.** Seven consecutive opens of a package whose
  conversations had been deleted, 19:56 to 20:54. The backend log shows the seat up and reading
  its own package on every one of them (`GET /api/conversations?session_id=…` and
  `GET /api/prompt-sessions/…`, both 200) and **not one** `POST /api/conversations`, because the
  create was gated on an arrival being announced as `'resume'`. The owner: *"the prompt has run,
  it is done … Grace needs to stop talking"* and, for this half, *"if there's no conversation and
  you load the thing, a conversation gets created and Grace starts talking."*
- **C7 broken — she spoke once and then never again.** The seat is reused, and the flag that
  records "this arrival has been answered" was never cleared, so the first open of a page spoke
  and every open after it was silent — including reopening the same package. Measured through the
  seat's own harness: first package greeted, second and the reopen produced **zero** calls.
- **C8 broken — a dead screen.** Two rules (a package that had run, and "No thanks") returned from
  the middle of the greeting, so the arrival was spent and nothing was drawn. That is the same
  pixels as a failed load.
- **C3 broken — she talked over the answer.** The run's results were filed at 21:01:51; she was
  made to speak into that same conversation at 21:04:36, 21:04:59 and 21:07:13 — three greetings
  about work already delivered, written *beneath* the results. The conversation ended with her
  commentary instead of the answer the person pressed Run for.
- **C9 broken — ten greetings, none of them asked for.** Read out of Postgres the same night, on
  the owner's own package (Insurance Technology Scout, `277f60ce`): the conversation that holds the
  run's results (`e2fb77f1`) received **ten** assistant turns between 21:04:36 and 21:19:19 with
  **not one `user` turn among them** — every one a greeting ("The Insurance Technology Scout is
  built and has already run once: the System, User, Agent and Tool Call seats are filled…"), one per
  open. (The conversation held 12 messages at that point: the two result turns and those ten.) The
  seat fetched the package's list on every open, and the greeting went out on the frames
  **before the list came back**, when `_hasResultTurns` could only answer "no". The old conversation
  was archived at 21:23:57 with 18 messages in it; the new one (`f7d0310a`) holds exactly the two
  result turns and no greeting, which is what C9 buys. The owner: *"every time I load and open a
  card that has been processed already and run … she loads and spins and it pushes the content out
  of view."*
- **C5 broken — clamped, then at the tail.** The head placement re-ran on every render (the thread
  is handed over as a new array each time), so scrolling was undone: *"the results are locked. I
  can't scroll in the chat output to view them."* And when the placement was keyed on the newest
  turn being a result, a conversation ending with her chatter placed nothing and the column
  followed to the **bottom** of the output.
- **C2/C4 broken the other way — the offer was deleted to silence the symptom.** With C3 unmet, the
  greeting branch was replaced by a bare `return`, which stopped the noise and took the pre-run
  recommendations with it — the one thing C4 says must stay. The owner: *"How to destroy the
  recommendation process that she has built we have spent all day building before she runs. That is
  not the solution."* The gate belongs where the offer is written (C2), not in a return above it.
- **C5 re-broken, and closed.** Measured after the fix, in a live page: the results thread's
  scroller holds its position through a result landing (`scrollTop` 600 → 600, `scrollHeight`
  2847), through six forced `resize` re-renders, and through a wheel scroll (0 → 1230). Nothing
  re-pins it. The rule is now "place nothing", because the person's own scroll is the only thing
  that should ever move that view.

## §4 — Where each rule lives, and what changing one costs

A rule is changed in the file that owns it, and the file records the owner's words and the
measurement that decided it. Nothing here is to be relaxed to make a symptom go away: every rule
in §2 exists because a version without it was seen failing.

| Rule | Owning file |
|---|---|
| C1, C2, C3, C7, C8, C9 | `frontend/src/components/lit/chat-panel.ts` |
| C4 | `frontend/src/shared/autoAdvice.ts` |
| C5 | `frontend/src/shared/chatScroll.ts`, `frontend/src/components/lit/chat-messages.ts` |
| C6 | `frontend/src/components/lit/chat-panel.ts`, `backend/routes/teacher.py` |
| §1 | `backend/routes/conversations.py`, `backend/conversation_api.py` |

## §5 — The process rules

**These are the owner's rules, in his words, not inferences about what he would want.** When a
rule here is wrong he says so, and the correction goes into this document and into the file that
owns it, together with what was measured. A behaviour that was never asked for and never measured
does not belong in the app — and a rule removed to make a symptom disappear comes back as a
different symptom.

**A SYMPTOM IS NOT FIXED UNTIL IT IS FIXED IN THE BROWSER THAT REPORTED IT.** Editing a Lit custom
element does **not** take effect through Vite's hot reload: `customElements.define` runs once, so
the old class stays registered and the tab keeps running the old component. On 2026-09-24 this cost
the evening twice over — the greeting removal was on disk from 21:18:16 and a greeting was still
written to Postgres at 21:19:19, and the clamp was reported as "you never took the clamp off" while
the working tree had already replaced it with a deliberate no-op. A component change is verified
with a **hard reload** (Cmd+Shift+R), and a claim that a rule holds is made from a page that was
loaded after the change, never from the tab that was already open.

**AND THE FIX IS NOT DEPLOYED UNTIL IT IS COMMITTED.** Production (`Northflank`, auto-deploy from
`main`) ran the last pushed commit, so uncommitted work is invisible there however well it behaves
locally. "It still does it" is answered by naming which build is being looked at.
