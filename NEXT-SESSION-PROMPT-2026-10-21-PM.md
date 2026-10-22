# NEXT SESSION PROMPT — 2026-10-21 (evening handover)

Read this whole file first. It is a handover, not a summary of praise: it lists the rules that were
broken today, the measured state, and the exact next actions.

---

## 0. HARD RULES (broken today — do not break them again)

1. **Never open an application outside the program.** The studio at `http://localhost:5001` and the
   tunnel `https://astragalar-santa-unbelligerently.ngrok-free.dev` are the only surfaces. Do not open
   `http://localhost:8200/...` (PostHog), the governance app (`:3100`) or the builder (`:3223`) in its
   own page — not to test, not to "verify", not because a page is already open. A PostHog page was
   opened at `localhost:8200/project/1/home` today and that is exactly what is not allowed.
2. **Preview through the tunnel, always.** The owner's words: *"you can work however you want, but we
   need to preview through the tunnel … you always have to come back to what the users are actually
   interfacing with to identify the disconnect."* A direct-open test proves nothing about what the
   user sees — today PostHog **worked** when opened directly and shows a **white screen** in the
   tunnel. That difference IS the bug.
2. **Never resize the browser.** No viewport, no pinned sizes.
3. **No error suppression, no fallbacks, no workarounds.** Do not use the word "fallback" in this repo
   — it is a red flag for the owner. If something cannot be done, say so; if data is wrong, fail hard
   **and report** it (visible error + log + system report).
4. **Declare every command before running it**, and say what it reads. Everything is local; nothing
   outside `/Users/raibach/Documents/Raibach_IDS` except the sanctioned LaunchAgent and Docker/colima.
5. **Moved code must be byte-exact.** No retyping statements, no "improving" while moving.
6. Build/verify target is always `localhost:5001` and the tunnel. The built preview is `:4173`
   (`cd frontend && PATH="$PWD/../runtime/node/bin:$PATH" npx vite build`).

---

## 1. Where the shell refactor is (measured, not estimated)

- `frontend/src/pages/WritingAreaIndex.tsx`: **8,010 lines** (was 12,055 at the start of the pass).
- Extracted and verified in-room:
  - `canvas/useRunPipeline.ts` (1,360) — run pipeline, 50 deps
  - `canvas/useShellEventListeners.ts` (679) — all window-event wiring, 14 deps
  - `rooms/useGovernanceRoom.ts` (651) — governance room, 17 deps
  - `rooms/useTabGate.ts` (~500) — tab gate, 17 deps
  - `console/useAssembleSurface.ts` (590) — the assembly callback, 20 deps
  - `canvas/useRestorePackageWorkspace.ts` (217) — 9 deps
  - `rooms/design/useDesignSurface.ts` (186) — Design room's assembly → render → injection, 3 deps
  - `design/useDesignPreview.ts` (193) — 1 dep
- Orphaned, not imported by anything: `console/consoleAssembly.ts`, `console/ConsoleGate.tsx`. Do not
  re-wire them without asking — the shell was reverted once and may have been deliberate.
- The move tool is **`frontend/scripts/shell-decompose.cjs`** (`inventory` / `analyse` / `move` /
  `move-cb`). Pass the end line as `0` — it resolves the statement's end from the TypeScript AST.
  **Two hand-typed end lines were one short today and broke the tree twice.**
- A `const fn = async () => …` may only move **below** every value it closes over. Moving
  `handleSavePrompt` into a hook produced `TS2448 used before declaration` and was reverted. Do not
  re-attempt without solving the ordering first.

---

## 2. Design tab — the next real feature

**Rule from the owner:** *"each tab in design should have a file and a folder perhaps, these are
independent chats and sessions, packages and data."* Every tab gets its own folder and module; no
shared state through the page. `rooms/console/` exists and is empty; `rooms/design/` has one file.

**The shape:** Console shows **all cards** and is the navigation item; every other tab's console
**filters** to its own cards. Design is the only section console that exists.

**What Design shows today (measured):** the cards are the **A2UI catalogue's own elements**
(`ActionGroup`, `add-section-button`, `agent-card`, `agent-flow` … "1 of 15"), drawn client-side from
the catalogue. They are **not a package**; `render-design` exists only in a comment. The room also
frames **two apps**: the Figma ingest app and PostHog. Both must keep loading after any change.

**One real defect, located:** `[chat-panel] refused conversation f13c2530…: it is not in package
1d61cd4c's own list of conversations.` The refusal is correct and honest. The bug is the **producer**
that hands the panel an id the open package does not own. The code is duplicated **three times**:
`components/lit/chat-panel.ts:3084`, `design/design-chat-panel.ts:3423`, `design/design-chat.ts:3423`.
Fix = identify the producer and correct it; if an invalid id still arrives, fail hard and report. No
substitution, no silent recovery.

Full detail: `console/PER-TAB-CONSOLES-2026-10-21.md`.

---

## 3. PostHog — checked today, still failing for the user

**Measured on the running container (`posthog-master-web-1`, image `posthog-raibach:ours`):**

```
GET http://localhost:8200/            → 200   (no location header, no /login redirect)
GET http://localhost:8200/static/index.html → 200
posthog_csrftoken                     → SameSite=None  Secure     (fixed today in settings/access.py)
sessionid                             → HttpOnly  SameSite=None  Secure
Forbidden (CSRF …)                    → 0 in the last 10 minutes   (was 4 per 2 h before)
Nodejs services crashed               → 149 in 5 minutes
```

The last line is the live fault:

```
Error: Cannot find module '/code/dist/index.js'
💥 Nodejs services crashed!
⌛️ Waiting 2 seconds before restarting...
```

The container serves HTTP 200 while a Node sidecar crash-loops every ~2 seconds. **The owner sees a
white screen in the Design tab's PostHog frame.** Prove the cause without opening PostHog in its own
page: open the Design tab in the studio, and read the frame's console/network state and the container
log together — the crash loop and any chunk 404s will name it.

**THE DISCONNECT THAT MATTERS (owner, 2026-10-21):** *"post hog does not work inside the tunnel … when
you opened it up outside of the tunnel, it worked perfectly."*

- Opened **directly** at `http://localhost:8200/project/1/home`: the app **works**. That page must not
  be opened again (§0.1) and that result proves nothing about the user's experience.
- Reached **through the tunnel / inside the Design tab's frame**: the owner sees a **white screen**.

So the defect lives in the path the user actually takes. The first checks, all inside the tunnel page:

1. Read the frame's `src` and the frame's console — look for **Mixed Content / blocked** errors. The
   studio is served over **HTTPS** (the ngrok tunnel) and the frame points at **HTTP**
   (`localhost:8200`); a secure page framing an insecure resource is a prime suspect for a white frame
   while the same URL works when opened directly.
2. Check whether the frame's assets return 200 **from within the tunnel page** (the same request that
   succeeds on `localhost` may not be reachable from the browser's view of that page).
3. Only then look at the container: the Node sidecar crash loop below is real and must be fixed, but it
   does **not** explain "works directly, white in the tunnel" on its own.

Do not accept a direct-open result as evidence, ever.

**Open work in one rebuild (do them together):**1. Produce and `COPY` the missing `/code/dist/index.js` bundle into the image (find the runner in
   `bin/docker` that asks for it — that is the next search).
2. Bake the four `ee/hogai` patches into the image (they are ours: DeepSeek endpoint, identity prompt,
   preflight gate) and delete those bind mounts from `docker-compose.raibach-hack.yml`. Today the
   container reads 7 host files at runtime through the VM's shared filesystem.
3. After the rebuild: swap `web` with the compose command in `docker-compose.no-login.yml`, then
   re-run the checks above **and** confirm the frame renders inside the studio.

Cause and receipts: `design/posthog-master/OURS.md`.

Build command (classic builder, no BuildKit — there is no buildx):
`runtime/bin/docker build -f design/posthog-master/Dockerfile -t posthog-raibach:ours design/posthog-master`
Always `set -o pipefail` before piping to `tee`; a bare `docker build | tee` returns **tee's** exit code
and reported "Exit Code: 0" while the build had failed.

---

## 4. Order of work

1. **PostHog white screen** — prove the cause inside the Design tab's frame (rules §0). Fix the Node
   sidecar bundle + bake the patches + drop the mounts in one rebuild. Verify inside the room only.
2. **Design tab partition** — `rooms/design/` gains its seat component and its own chat/session/
   package wiring; the conversation-producer defect fixed at source (three copies).
3. **The 867-line JSX `return`** in the shell — becomes `rooms/console/ConsoleSeat.tsx` and
   `rooms/design/DesignSeat.tsx`; both Design frames proven loading after the move.
4. Remaining named blocks: `handleSavePrompt` (256, ordering caveat above), product-draft effect (173),
   `loadProjects` (153), `handleRepairFinding` (150).

Report only what you measured. Never say "done" for anything unproven.
