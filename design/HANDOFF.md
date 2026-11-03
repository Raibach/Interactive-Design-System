# The next chat — the brief

*Written 2026-11-02 at the end of a long session. Paste the section below as the opening message.*

---

## The opening message

You are continuing work on Raibach IDS at `/Users/raibach/Documents/Raibach_IDS`, in the Design zone.

**How to work with the owner.** He is a software designer and he wants plain language: what the person
sees, presses and receives. Complete sentences, no jargon, no fragments, no flattery. Slow and
methodical — he calls it granny coding — but answers stay short. Do not open files he did not name
unless you say why in one line first. Do not write documentation until the work is done; when he asks
for status, give three short lists: completed, next, questions for him, with options attached to each
question. Never claim a thing works until you have seen it work. Errors are welcome: do not suppress
them, and do not paper over a failure with a fallback.

**The running application.** The dev server is `http://localhost:5001` and serves live source. The
backend is on `8000` with `--reload`. The sign-in email is `dev@local` and the PIN is `7377`. The
static build on `4173` and the tunnel are NOT to be rebuilt or pushed unless he asks for it.

**Read these first, in this order.**

1. `design/UNDONE.md` — your answers recorded, and the index of the seven plans.
2. `design/plans/00-DATABASE.md` — the tables as they stand, and the gaps.
3. `design/plans/01-INGEST.md` through `06-CARDS-AND-CONSOLE.md` — the work, each step with its proof.
4. `design/figma-ingest/CHANGELOG.md` — the ingest's record, newest first. Read the two 2026-11-02
   entries; the label `[figma-ingest]` finds them.
5. `design/ONE-CHAT-PER-TAB.md` — the rule the seats follow.

## What stands, measured

- **The frame is one file** for the Design section: `rooms/design/frame/chat-frame.ts` (five boxes, the
  bands, the pull, its stop, the view slots). Each tab names its own five elements.
- **The conversation is one file**: `rooms/design/session/conversation.ts` (list, thread, ownership
  check, move, select, remove, create). Both the Tools seat and the Chat seat delegate to it.
- **The Tools seat and the Chat seat** are 5,374 and about 5,100 lines; each says at the top where the
  frame, the conversation, the look and its own words live.
- **The Tools conversation loads from the database**: the package's own pointer first, then the turns.
  The tab stays on `tools` (it used to flip to `chat`), and the newest row no longer replaces the open
  thread.
- **The screen's state travels with the conversation**: scroll, the heights of boxes a person sized,
  and the table's filter are written to `conversations.surface_state_json` and restored on open.
- **A kept design session stands on both consoles**, with its own category (`design`).
- **The approval record**: `POST/GET /api/design/sessions/{id}/review` writes a stage and events into
  `design_surface_events`; the Design rail's `Approve` tab lists sessions in review and answers them.
- **The queue**: `design_requests` and its three endpoints; the Approve tab draws waiting requests with
  Approve and Refuse.
- **The ingest**: the check reads styled spans, `arcData` and `styles` are examined, every reconciled
  fact names the channel the drawing uses, and the accounting is checked and blocks when it is open.

## What remains

1. **The ingest's last step** — the missing-face conversation: the chat offers to replace a face the
   system does not ship or to ask for it to be added, and asking files a `design_requests` row. The
   queue now exists, so nothing blocks it.
2. **The approval plan's last two** — the final approval that writes the catalogue, and the rule that a
   change to an approved component becomes the same name marked pending.
3. **The catalogues** — a `registry.json` beside Carbon and Prompt Composer, Carbon committed to the
   repository, and the decision about a third system.
4. **The UX tab** — the readout, New chat and Download, the functions slot, the PostHog output port, the
   refused preset prompts, Add context, location actions, tracking.
5. **The seats** — adopt the shared frame and conversation in UX, Executions and Settings; retire the
   shared `chat-panel` per room; settle the fifteen drawing pieces; the dead-code list.
6. **The consoles and the session** — one read for both consoles; the card's logo; sharing and
   reassignment; the status line; the read that unites Postgres and ClickHouse for the audit.

## Traps, paid for already

- **Never overwrite anything in `design/figma-ingest/`.** It is the owner's record; entries are newest
  first. Add above, never replace. One overwrite lost two weeks of entries once.
- **List every member before moving a block of a seat.** A line-range slice carried a getter into a
  module and broke the page once. A file can be restored from `frontend/dist/assets/*.js.map` — the
  source map embeds the source, and that is how the Tools seat was recovered today.
- **Run esbuild on a `.ts` file after any CSS or scripted edit.** `tsc` does not catch a backtick that
  closes a `css\`` template; esbuild does.
- **A filter and a box size are unsaved work.** Leaving Tools must ask; before this was fixed, leaving
  after only filtering deleted the session and its conversation.
- **The Tools tab has no second view.** A `grace-tools-chat` element slotting in front of the seat drew
  an empty card and hid the thread. Do not put one back.
- **The seat is not to be replaced again without finishing the replacement end to end.** A dedicated
  Tools element was built and backed out on his word; the design he has must survive every change.
- **Do not build or push to the tunnel until he says so.** He tests on `5001`.

## The first question to settle

The order above is mine. Ask him which of the six he wants first, and give him the options with their
cost in one line each. If he says nothing, start with the ingest's missing-face conversation, because
it is the shortest path to a plan being finished and its queue already exists.
