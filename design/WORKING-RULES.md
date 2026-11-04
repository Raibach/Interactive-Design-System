# The working rules — how to work here, the local setup, and the mistakes already paid for

*2026-11-03. These instructions were inside a file called `HANDOFF.md`, whose name said nothing about
what it held. The work that handoff still carried is in [`TODO.md`](./TODO.md); this file holds the
standing rules.*

## How to work with the owner

He is a software designer and he wants plain language: what the person sees, presses and receives.
Complete sentences, no jargon, no fragments, no flattery. Slow and methodical — he calls it granny
coding — but answers stay short. Do not open files he did not name unless you say why in one line
first. Do not write documentation until the work is done; when he asks for status, give three short
lists: completed, next, questions for him, with options attached to each question. Never claim a thing
works until you have seen it work. Errors are welcome: do not suppress them, and do not paper over a
failure with a fallback.

## The running application

The dev server is `http://localhost:5001` and serves live source. The backend is on `8000` with
`--reload`. The sign-in email is `dev@local` and the PIN is `7377`. The static build on `4173` and the
tunnel are not to be rebuilt or pushed unless he asks for it.

## The mistakes already paid for

- **Never overwrite anything in `design/figma-ingest/`.** It is the owner's record; entries are newest
  first. Add above, never replace. One overwrite lost two weeks of entries once.
- **List every member before moving a block of a seat.** A line-range slice carried a getter into a
  module and broke the page once. A file can be restored from `frontend/dist/assets/*.js.map` — the
  source map embeds the source, and that is how the Tools seat was recovered once.
- **Run esbuild on a `.ts` file after any CSS or scripted edit.** `tsc` does not catch a backtick that
  closes a `css\`` template; esbuild does.
- **A filter and a box size are unsaved work.** Leaving Tools must ask; before this was fixed, leaving
  after only filtering deleted the session and its conversation.
- **The Tools tab has no second view.** A `grace-tools-chat` element slotting in front of the seat drew
  an empty card and hid the thread. Do not put one back.
- **The seat is not to be replaced again without finishing the replacement end to end.** A dedicated
  Tools element was built and backed out on his word; the design he has must survive every change.
- **Do not give one room's behaviour to another.** If a control must change, change it in that room's
  own file.
- **Do not restore a second catalogue, a fallback, a second copy of data, or an error suppression.**
- **Do not treat a file's write time as a component's date.**
- **Do not enumerate the catalogues folder in a module list; name the one file.**
- **Do not approve, remove or ingest into the catalogue without the owner's own press.**
- **Do not run a build test in the project that is open on his screen.**
- **Do not build or push to the tunnel until he says so.** He tests on `5001`.
