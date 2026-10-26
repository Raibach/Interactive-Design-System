# Continue the Composer work — handoff for 2026-10-25

This is the prompt to pick up from. Read it first, then read the two room records named at the
bottom. The owner is a software designer; speak in what he sees on the screen, not in
implementation words.

## The point of the work

The user must be able to open any room and find that room's chat, package and controls behaving
as that room's own. Changing one room must never change another room. The screen must look and
behave as it does today; this work moves ownership, not design.

The database is the application. A conversation belongs to a package. The page is navigation.

## What is finished and verified (2026-10-24)

- **The page is navigation only.** `frontend/src/pages/WritingAreaIndex.tsx` is **463 lines**
  (from 2,565). It holds the header tabs, the left rail, one box per tab, the Console's first
  load, and three boundary facts: unsaved work, the open package id, and the Console's card
  writer. It holds no package, Save, run, repair, conversation or Composer chat code.
- **The Composer owns the Composer.** `frontend/src/rooms/composer/useComposerProvider.ts` owns
  the package, the Save, the run dependencies, the assembly, the decision, the repair, the flow
  and the drawing. `useComposerEventListeners.ts` owns the Composer's window events. The room is
  mounted only while the Composer tab is open.
- **The Composer has its own finished chat.** `frontend/src/rooms/composer/composer-chat-panel.ts`
  is a whole copy of the shared chat, retagged `composer-chat-panel` (5,518 lines). The Console,
  the Product, Development and Governance already had their own. The shared `chat-panel` remains
  for the Governance room and is not deleted.
- **The Console owns its three card actions.** `frontend/src/rooms/console/useConsoleCardActions.ts`
  opens a card, asks for a new prompt and deletes a card. The shell no longer listens for
  `card-delete`.
- **The Product owns its voice.** `frontend/src/rooms/product/useProductThread.ts` holds its
  thread line and its draft canvas.
- **Two duplicate files are deleted:** `frontend/src/canvas/useShellEventListeners.ts` and
  `frontend/src/rooms/useOpenCardFromConsole.ts`.
- **Conversations save themselves.** The first spoken turn in a blank Composer creates the
  package as a **draft** (`metadata.draft = true`, hidden from the Console) and its conversation
  before the turn is sent. Both messages are written immediately; no Save is pressed. Save
  promotes the draft (`metadata.draft` cleared, version 1). The counter reads "1 Conversation".
  Backend: `draft` on `POST /api/prompt-sessions` (`routes/prompt_sessions.py`,
  `prompt_sessions_api.py`). The save already cleared the draft flag.
- **Verified in the database:** draft package `a8aa21ff-decd-4331-80d1-27e58c3ead77`, conversation
  `5a10b970-6d53-4128-9b2a-34b8aa60ad61`, whose `session_id` is that package id, holding the
  person's line and Grace's reply. Save cleared the draft and wrote version 1.
- **Other verified paths:** a saved package (`98662bc4-404d-4ff7-831a-381d5113fb25`) was reopened
  from its Console card with its text; a throwaway package (`04e8389d-11f7-4a49-9f75-1672d44fc35e`)
  was deleted through the card's arm → CONFIRM and its row was gone; all six rooms mounted with
  no page error.
- **Type check is zero.** The working copy is **5001**. The public link at **4173 still serves
  the earlier build**.

## What remains, in order

0. **The embedded programs are warmed at studio start (2026-10-24, done).**
   `frontend/src/shared/EmbeddedWarmup.tsx`, mounted in `App.tsx`, starts Governance, Development
   and Product after the config answers and the first screen is up. Measured on the tunnel:
   Development's canvas is ready **1.2 s** after the tab is clicked. Governance still takes
   **7.7 s** to leave its loading sentence because the room opens a SECOND Langfuse copy; the
   warm-up starts the program and fills the browser cache, but does not share the running page.
   The next fix for Governance is to show the already-running copy instead of creating another
   (a change to the room's embed, not a timer). Design's `/posthog` address answers **404** on
   the local proxy; it is not warmed and is a separate defect.

1. **Build the public link — only after the owner says so.** Run the normal frontend build and
   let the tunnel serve it. Do not rebuild `dist` before he asks. When you report, state that
   4173 now matches 5001.
2. **Give the Composer its own three-column frame.** It still uses the shared
   `frontend/src/components/lit/workspace-layout.ts` (2,211 lines), which the Console also uses.
   Copy it into `frontend/src/rooms/composer/composer-workspace.ts`, retag it
   `composer-workspace`, import it in `ComposerRoom`, and point the Composer's surfaces at the new
   name. Teach every registration list the new name, or the frame draws nothing:
   `frontend/src/shared/tag-registry.ts`, both `prompt-composer` catalogs
   (`frontend/catalog-tree/prompt-composer.json` and
   `frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json`), and the rendered
   surfaces in `backend/routes/ai.py` (the composer and session templates that emit
   `"workspace-layout"`). Follow the chat copy as the pattern. Do not delete the shared frame.
3. **Move the Console's first load into the Console room.** The page still assembles the Console
   once on page load before the room mounts. The Console room already owns every later entry;
   make it own this one too, then remove the page's assembly hook and its empty references.
4. **Regenerate the design tool's list for the new chat.** The app and the A2UI catalog know
   `composer-chat-panel`; the generated design-tool list has not been regenerated. Run the
   catalog generator the repository documents (not a hand edit), and check the Composer's chat
   appears as its own part. If the generated list cannot show it without a design-tool change,
   say so and leave the record.
5. **Optional test rows.** `98662bc4-404d-4ff7-831a-381d5113fb25` and
   `a8aa21ff-decd-4331-80d1-27e58c3ead77` are test packages, both titled "Untitled Prompt".
   Delete them only if the owner asks; the second one holds the conversation used to verify
   auto-save.

## Binding rules

- Do not put Composer state, handlers, Save, run or repair back into the page. The page is
  navigation.
- Do not hold a spoken turn in the browser. A conversation belongs to a package; create the
  draft so it has a home.
- The Console has no Save button and needs none. Its package already exists, so its turns write
  immediately.
- Do not add a Save button for conversations anywhere.
- Do not delete the shared `chat-panel` (Governance still uses it) or the shared frame (the
  Console still uses it).
- No workarounds, no suppressed errors. If a wire is missing, find it and name it.
- Test on 5001. The tunnel build happens only after the owner approves.
- The owner runs several chats on the same tree; a build is a snapshot. Check the source and the
  bundle before calling anything missing.

## How to verify on 5001

1. Open `http://127.0.0.1:5001/`, enter PIN `7377`, sign in.
2. **Composer, auto-save:** open Composer, send one line, wait for the reply. The header reads
   "1 Conversation". Query the database: the newest package with `metadata.draft = true`, its
   `conversation_id`, and `conversations.session_id` equal to the package id; the conversation
   holds the person's line and the reply.
3. **Save promotes the draft:** press Save Template. The same package now has no draft mark,
   version 1, and its conversation stays attached. The Console shows its card.
4. **Conversation is tied to the package:** in the database, every message you wrote while that
   package was open is under that package's conversation, never under another package and never
   under the Console's conversation.
5. **Console:** open the saved package from its card and read the prompt back. Delete only a
   throwaway card (arm → CONFIRM) and confirm its row is gone.
6. **Every room:** Console, Composer, Design, Product, Development, Governance each mount with no
   page error. The Composer draws exactly one `composer-chat-panel` and zero shared `chat-panel`.
7. Run the type check. It must be zero; a red type check is a defect, never a baseline.

## Records to read

- `frontend/src/rooms/composer/CHANGELOG.md` — the two 2026-10-24 entries: ownership, and
  conversations that save themselves.
- `frontend/src/rooms/composer/PLAN-sovereign-composer.md` — the status section and the remaining
  stages.
- `frontend/src/rooms/console/CHANGELOG.md` — the Console's card doors.
- `frontend/src/rooms/product/CHANGELOG.md` — the Product's own voice.
- `AGENTS-instructions/THE_CONVERSATION_CONTRACT.md` and `THE_PACKAGE_CONTRACT.md` — the rules a
  conversation belongs to a package, is created by speaking, and the Console has its own.

## One last thing

The working copy is the source of truth. If the public link and 5001 disagree, 5001 is right and
the public link is a build that has not caught up. State that difference before asking the owner
to test the public link.
