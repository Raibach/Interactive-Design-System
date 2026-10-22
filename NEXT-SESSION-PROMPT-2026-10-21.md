# NEXT SESSION PROMPT — 2026-10-21 (handoff)

You are taking over a working local system. Read this whole file before touching anything.
It lists **what is broken, where the previous model failed, and what "fixed" has to look like**.
Nothing below is a suggestion.

---

## 0. The machine, as measured on 2026-10-21 (do not re-derive it)

- Workspace root: `/Users/raibach/Documents/Raibach_IDS` (always `cd` there first).
- Studio: dev on `:5001`, built preview on `:4173`, public through ngrok
  `https://astragalar-santa-unbelligerently.ngrok-free.dev` → `127.0.0.1:4173`.
  Rebuild the preview with `cd frontend && PATH="$PWD/../runtime/node/bin:$PATH" npx vite build`.
- Backend: FastAPI/uvicorn on `:8000` (`main:app --host 0.0.0.0 --port 8000 --reload`).
- Supervisor: launchd `com.raibach.ids-supervisor` → `development/ops/supervise-all.sh` (checks
  8000 / 5001 / 3223+4000 / 8090 / 4173 **and the ngrok tunnel** every 15 s).
- Docker: **vendored CLI** `runtime/bin/docker` (client 29.8.2 / server 29.5.2) on colima.
  **There is no buildx** — classic builder only. Never set `DOCKER_BUILDKIT=1` (it fails).
- PostHog stack: project `posthog-master`, started from `design/posthog-master/` with
  `docker-compose.hobby.yml` + `docker-compose.raibach-hack.yml` + `docker-compose.no-login.yml`.

---

## 1. FAILURE 1 — PostHog does not load (the headline failure, still unfixed)

**What the user sees:** `http://localhost:8200/` is a white page.

**Measured evidence (2026-10-21):**

```
$ curl -sI http://localhost:8200/
HTTP/1.1 302 Found
location: /login
$ curl -L http://localhost:8200/     → final=http://localhost:8200/login code=200   (blank)
$ runtime/bin/docker ps
posthog-master-web-1      posthog-raibach-nologin:local   Up 8 hours
posthog-master-worker-1   posthog/posthog:latest           Up 13 minutes
$ runtime/bin/docker images posthog-raibach:ours          → nothing
```

**Cause, stated exactly:** `/` still redirects to `/login`. The `web` container is running an
**old local image (`posthog-raibach-nologin:local`, 8 h old) that predates every login-removal
edit in this tree**. The source in `design/posthog-master` has the login removed (settings
`AUTO_LOGIN` default `True`; the Login scene, route, screen and its components deleted), but that
source has **never been built into an image**, so the running server still issues the redirect and
the login bundle it points at no longer exists → white page. The `worker` runs upstream
`posthog/posthog:latest`, i.e. not our build either.

**Where the previous model failed:**

1. The image build failed at the pre-compile step:
   `PermissionError: [Errno 13] Permission denied: 'products/__pycache__'` during
   `RUN /python-runtime/bin/python -m compileall -q -j 0 -x '/tests?/' …`.
2. The applied fix — run that step as `USER root` and then
   `chown -R posthog:posthog manage.py posthog ee common packages products`, before returning to
   `USER posthog` — **was never verified**. The rebuild was still at **step 119/133** when the
   session ended (`/tmp/posthog-ours-build.log`).
3. Even if it had finished, `web` was **never swapped** to the new image, so the user's white page
   never changed.
4. A trap that produced false "success" readings: `docker build … | tee /tmp/log` returns **tee's**
   exit code. Several terminal entries read `Exit Code: 0` while the build had actually failed.
   Always `set -o pipefail` (or drop the pipe) before trusting a build's exit code.

**What "fixed" must prove (all four, in this order):**

1. `runtime/bin/docker images posthog-raibach:ours` lists the image.
2. `runtime/bin/docker ps` shows `posthog-master-web-1` running **`posthog-raibach:ours`**.
3. `curl -sI http://localhost:8200/` returns **`200` with no `location:` header** — the redirect
   to `/login` is gone at the server, not hidden by the client.
4. A browser open of `http://localhost:8200/` shows the application itself: no login form, no
   blank page.

**Files that own this:**

- `design/posthog-master/Dockerfile` — final stage starts at `FROM python:3.14.7-slim-bookworm`
  (line ~292); `USER posthog` at ~343; all source `COPY --chown=posthog:posthog …` at ~391–407;
  pre-compile at ~413; `USER root` at ~436. Edit here if the compile step fails again.
- `design/posthog-master/posthog/settings/__init__.py` — `AUTO_LOGIN` default `True`
  (`get_from_env("AUTO_LOGIN", True, type_cast=str_to_bool)`).
- `design/posthog-master/docker-compose.no-login.yml` — `web` must carry
  `image: posthog-raibach:ours` and `environment: AUTO_LOGIN: "1"`. Only `web` is overridden.
- Login removal already done in source: `frontend/src/scenes/urls.ts` (no `urls.login`),
  `frontend/src/scenes/scenes.ts` (no `Scene.Login`), `frontend/bin/loggedOutScenes.mjs` (no
  `'Login'`), `Login.tsx` / `LoginForm.tsx` / `Login.scss` / `Login.stories.tsx` /
  `SessionRiskBanner.tsx` deleted, all `/login` targets repointed to the app root.
- Build command:
  `runtime/bin/docker build -f design/posthog-master/Dockerfile -t posthog-raibach:ours design/posthog-master`
- Run/swap command: the `docker compose … -f docker-compose.no-login.yml up -d web` documented in
  the header of `docker-compose.no-login.yml`, run from `design/posthog-master/`.

**Hard rules for this part:** if a build step fails, read the actual error and fix the actual
cause. Do **not** delete the failing step, do **not** add `|| true`, do **not** lower the surface
(no `chmod 777` scatter-gun, no dropping `USER`). The source is MIT outside `ee/` and it is ours
to change — take it over, do not re-derive it.

---

## 2. FAILURE 2 — the gate must not hold while an assembly runs (code changed, UNVERIFIED)

**The owner's rule (2026-10-21, verbatim):** *"You can't hold the gate while a real assembly is
running. You'll need to undo that."* Related standing law: the deterministic shell must **always**
render; AI slow = the shell is on screen with a loading state, never a page-wide hold.

**What the previous model shipped without proving:** `frontend/src/components/GateSplash.tsx` was
rewritten — the `holdUntilDrawn` behaviour (an interval probing the shadow DOM for a drawn
`a2ui-renderer` or the console's standby line) was removed, and the card now lifts **two animation
frames after the shell mounts** (`liftOnShellPaint`). `App.tsx:175` was repointed to
`<GateSplash liftOnShellPaint />`. **No typecheck, no build, and no browser measurement followed.**
Treat it as unproven.

**What must be measured through the tunnel** (never resize the browser; the page is shared as
`60c4c495-6882-42ad-be30-caf12d18e135`):

1. Reload: the static `#splash` card is gone in ≈1 s **while the console is still assembling**
   (the console slot shows its own ring).
2. The console draws or fails **inside the already-painted shell**; a failure shows the pane from
   `frontend/src/console/ConsoleGate.tsx` naming the 10 s reason.
3. No full-page hold exists on any path.

**Measurement discipline (the previous model got this wrong twice):**

- `document.body.innerText` **cannot see** shadow-DOM content; the package cards live inside shadow
  roots. Use a shadow-aware walk (`el.shadowRoot` recursion) or an accessibility snapshot.
- A check must prove the **presence** of the thing you claim, never merely the absence of an error
  message. ("Drew in 1.3 s" was once claimed from a probe that only matched the alert clearing.)
- Sample a timeline; never `sleep`.

Timers currently in the tree (10 s ceilings, keep them):
`GateSplash` (removed — now two frames), `ASSEMBLY_TIMEOUT_MS = 10000`
(`frontend/src/pages/WritingAreaIndex.tsx` ~476), `PRODUCT_GATE_MAX_MS = 10_000` and
`GOVERNANCE_GATE_MAX_MS = 10_000` (`frontend/src/gate/gateTimings.ts` — **the owner has not ruled
on these two; ask before changing them**), `GET /api/config` 10 000 ms
(`frontend/src/shared/appConfig.ts`).

---

## 3. FAILURE 3 — the 12 000-line shell (partly done, mostly not)

`frontend/src/pages/WritingAreaIndex.tsx` is **≈12 010 lines**. The owner's target: *"a couple of
thousand lines if that."*

**Landed and verified in-room through the tunnel:**

- `frontend/src/console/consoleAssembly.ts` (99 lines) — `postAssembleSurface()`: the fetch, package
  headers (`X-Package-Session`, `X-Conversation-Id`), the non-ok body read as text, the §1
  envelope parse, and the failure facts.
- `frontend/src/console/ConsoleGate.tsx` (141 lines) — `AssemblySpinner` (`slot="spinner"`),
  `AssemblyFailureBanner`, `AssemblyFailureReport`, `AssemblyFailurePane`.

> **CORRECTION, measured 2026-10-21 after those receipts were written:** the shell no longer
> imports either module. `grep '@/console/' frontend/src/pages/WritingAreaIndex.tsx` returns
> nothing — the inline fetch, the inline gate markup and the inline failure pane are back in the
> page (the console symbols appear 19× in the shell). The two modules above therefore exist but
> are **unused**. Do not describe them as "in effect" until the shell imports them again, and do
> not re-apply the wiring without asking the owner — it may have been reverted deliberately.

**Not done (Phase 3 → 5):**

- Phase 3 `frontend/src/console/ConsoleSeat.tsx`: the console surface — cards, the renderer effect
  that places the seat, card interactions, and its **own conversation wiring**. Mounted by the
  shell through the established door `slot="view"` + `view-tab="console"` (precedent:
  `ToolsSeat.tsx`).
  The gate's **state** must travel with it: `isAIAssembling`, `aiAssemblyMessage`,
  `aiAssemblyFailed`, `aiAssemblyReport`, `isFailureAcknowledged`, `consoleAssemblyControllerRef`
  (~line 441), `lastAssemblyIntentRef` (~492), `consoleTree` (~501), `workspaceTree` (~504), and
  the `error-retry` / `error-dismiss` window listeners (~7566) — none of these moved yet.
- Phase 4: delete the moved state/effects from the shell; leave the mount line and the shell facts
  the seat needs (identity, session).
- Phase 5: the proof — cold load, retry, `wc -l` receipt, and
  `grep -rn "assemble-surface" frontend/src` naming no second assembly path.

Plan and receipts already written: `console/CONSOLE-EXTRACTION-PLAN-2026-10-21.md`,
`console/CHANGELOG.md`. Keep both current — the owner treats a stale receipt as a lie.

Note: `assembleSurfaceWithAI` (~line 6937) is **one** `useCallback` serving every intent
(`render-console` at ~4102; composer at ~3744 / ~5040 / ~5184). It cannot be lifted whole; split it
at the intent dispatch.

---

## 4. FAILURE 4 — backend event loop (fixed, needs a regression check only)

Applied earlier: `record_pending_usage` moved to `run_in_threadpool`, and
`load_logs_to_vectorstore()` (embedder + Milvus, 30–60 s) moved off startup into a background
thread in `backend/main.py`. Measured then: `GET /api/config` 2–20 ms during assembly; warm
assembly 1 966 ms (DB 193 ms, LLM 1 597 ms). **No regression check exists after the later edits.**
Re-measure both before claiming this is still fixed.

---

## 5. Laws — non-negotiable in this repo

- Everything local. Nothing outside `/Users/raibach/Documents/Raibach_IDS`, except the sanctioned
  LaunchAgent (`com.raibach.ids-supervisor`, needs Full Disk Access on `/bin/bash`) and
  Docker/colima.
- **Never resize the browser.** No viewport setting, no pinned widths. The viewport belongs to the
  owner.
- **Never operate an app outside the program.** The studio room (`:5001` / the tunnel) is the
  surface. Do not open the governance app (`:3100`), the builder (`:3223`) or PostHog in its own
  page to click or "verify" — if it cannot be done inside the room, stop and ask.
- **No error suppression, no fake fallbacks, no workarounds.** Fix the real code. A blank page beats
  a fake one. A misleading comment is a lie.
- Failures must be loud and bounded at 10 s, with the reason stated.
- Never say "vendor" bare — name the app. No model-credit commentary in docs.
- Declare every command *before* running it, and say what it reads (folder-only vs machine-wide).
- Do not use one-word process labels ("commit", "push", "deploy") with the owner — describe the
  action. Build/verify target is always `localhost:5001` and the tunnel; the box and any remote are
  never test targets.
- Typecheck: `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (the root `tsconfig.json` is an
  empty program — do not use it). Known pre-existing errors live in
  `src/components/lit/evals-chat-panel.ts`, `src/design/design-chat-panel.ts`,
  `src/design/design-chat.ts`, `src/design/ux/ux-chat.ts`. They are not yours and must not be
  "fixed" by suppression.

---

## 6. Order of work

1. Finish or repair the **PostHog image build**; swap `web` to `posthog-raibach:ours`; prove the
   four conditions in §1.
2. Prove the **gate lift** in §2; fix it if it does not lift on paint.
3. Continue the console extraction: Phase 3 → 4 → 5 in §3, measuring in-room through the tunnel.
4. Re-measure the backend loop (§4).

Report only what you measured. Never say "done" for anything unmeasured.
