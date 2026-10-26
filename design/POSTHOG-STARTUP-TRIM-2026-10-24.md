# POSTHOG — the startup trim, 2026-10-24

> The first pass on the analytics application in the Design room's UX tab. It is written here,
> beside `posthog-master/`, because this is the application's own shelf. The Design room's plan is
> `frontend/src/design/PLAN-sovereign-design.md`; this note is the separate PostHog job.

## What the person saw

The UX tab drew three loading faces before the analytics application appeared, and the wait was
several seconds. The application is ours (`posthog-raibach:ours`, built from
`design/posthog-master`), the login page is gone, and the auto-login user is already on the page.
The wait was not the data.

## The measured chain

1. **The entry preloader.** `frontend/src/index.tsx` renders `.Preloader` while the App chunk and
   its boot modules load.

2. **The app gate.** `App` reads `appLogic.showApp`. That selector waited for the user, for
   feature flags, and for preflight (`frontend/src/scenes/appLogic.tsx`). With
   `OPT_OUT_CAPTURE=1`, the server's head template does not emit `JS_POSTHOG_API_KEY`
   (`posthog/templates/head.html:46–70`), so `loadPostHogJS` does nothing and
   `featureFlagLogic.receivedFeatureFlags` never becomes true. The only thing that opened the gate
   was the 3,000 ms `ignoreFeatureFlags` timer. That timer is the long spinner.

3. **The shell fallback.** `AuthenticatedShell` was a lazy chunk, and its Suspense fallback was
   `AuthenticatedShellFallback`, a second spinner with its own look.

4. **The scene spinner.** The scene chunk shows `DelayedLoadingSpinner` after 500 ms
   (`frontend/src/scenes/sceneLogic.tsx`), a small spinner again.

The user and the team are already known at the first frame: `userLogic` seeds
`window.POSTHOG_APP_CONTEXT.current_user` in its mount (`frontend/src/scenes/userLogic.ts:1099–1106`),
and `teamLogic` seeds `current_team` in its mount (`frontend/src/scenes/teamLogic.tsx:688–710`).
Nothing in the gate needs a network round trip.

## The cuts

- **One loading face.** `scenes/BootPreloader.tsx` is the same `.Preloader` markup the entry
  already used. The entry, the app gate, the shell and the scene all draw it. It is one visual
  spinner from the first paint to the first scene.
- **The gate waits only for the user.** `appLogic.showApp` is `!userLoading || !!user`. The
  feature-flag wait, its 3,000 ms timeout, the preflight wait and the 1,000 ms delayed-spinner
  timer are removed. Flags and preflight still load in the background; they no longer hold the
  application.
- **The shell is not a chunk.** `AuthenticatedShell` is imported directly. The shell spinner and
  one chunk round trip are removed. The shell's own lazy pieces (the terminal, the internal
  feedback widget) stay lazy.
- **No OAuth startup.** The `/oauth/callback` branch and the eager `oauthLogic` mount are removed.
  They are vendor paths and cannot occur in the auto-login deployment.
- **Capture stays off.** `OPT_OUT_CAPTURE=1` is already in the running `web` container. The
  application does not emit the vendor key, and the SDK does not initialize. This pass does not
  re-enable it.

## What is not touched

The Figma ingest tool, the analytics screens, the database, the app's data, and the UX chat's own
door (`/api/ux/posthog-chat`). The room's frame and the Design seat are not changed here.

## Build and verify

The running image is `posthog-raibach:ours`; `docker-compose.ours.yml` points `web` at it. The
build is the documented one:

```
runtime/bin/docker build -f design/posthog-master/Dockerfile -t posthog-raibach:ours design/posthog-master
docker compose --project-directory design/posthog-master \
  -f design/posthog-master/docker-compose.hobby.yml \
  -f design/posthog-master/docker-compose.raibach-hack.yml \
  -f design/posthog-master/docker-compose.ours.yml \
  --env-file design/posthog-master/.env up -d --no-build --force-recreate web
```

The verification is on the framed UX tab: one loading face, the application ready without the
three-second wait, the home screen drawn, and no `JS_POSTHOG_API_KEY` or vendor host in the page.

## Status — built and verified 2026-10-24

- The frontend stage built: eight tasks, 1 min 22 s, no errors.
- The full image built as `936ecbeefe1c` and tagged `posthog-raibach:ours`. The image before this
  pass is tagged `posthog-raibach:pre-startup-trim-20261024` for rollback.
- `web` was recreated with `AUTO_LOGIN=1`, `POSTHOG_BASE_PATH=/posthog` and `OPT_OUT_CAPTURE=1`.
  The first recreate lost the first two because our compose layer did not carry them; they are now
  on `docker-compose.ours.yml`, and the second recreate answered 200 on both 8200 and 5001.
- Measured **inside the React frame** on `http://localhost:5001/`, through Design → UX, not at
  `/posthog` directly. The iframe's own boot marks: entry 1,518 ms, app_modules_loaded 1,557 ms,
  app_booted 1,567 ms, scene_loaded 1,759 ms, scene_rendered 1,930 ms, app_ready 1,931 ms. The
  only loading face is `.Preloader`; the app gate, the shell and the scene no longer draw the old
  `.SpinnerOverlay` or the old `.Spinner`. Two small `.Spinner` elements appear for about 236 ms
  after the scene renders — the insights content's own data wait — then none. The room cover is
  `aria-hidden` with opacity 0, and the left cover is `display: none`.
- `window.JS_POSTHOG_API_KEY` and `window.JS_POSTHOG_HOST` are null inside the frame.
- The direct `/posthog` read made earlier in the session was outside the React frame and is **not**
  the accepted measurement. The framed read above is.
- The app's own screen and data are unchanged. The Figma ingest tool was not touched.

The deeper feature trim (experiments, surveys, flags, replays, cohorts, billing, onboarding, the
remaining cloud and OAuth code) is Stage 7 of the Design room plan, after the room is closed.

## The TLS warning removed — 2026-10-24

The orange banner “PostHog dangerously running in PRODUCTION mode without TLS!” came from the
Django template `posthog/templates/overlays.html`, not from our shell. It was the template's
non-debug branch that prepended `#bottom-notice` when `location.protocol !== 'https:'`.

The branch is removed at the source. The debug bar remains; the production/TLS warning does not.
This setup is local HTTP behind our own proxy and is not a production TLS deployment, so the
warning is not for this installation.

The running `posthog-master-web-1` container was patched with the corrected template and restarted,
because the image rebuild could not finish: the Docker daemon reports a missing overlay snapshot
(`.../xero.cpython-314.pyc...: no such file or directory`) and the build process stalls before the
first step. The source is corrected for the next healthy image build.

Verified on 5001, inside the React frame, after reloading the embedded document itself: the frame's
`#bottom-notice` is absent and its text no longer contains “dangerously running.” The direct app
HTML and the 5001 proxy both answer 200 with no warning text. The room's product footer and direct
Grace turns are unaffected.

A container **recreate** before a successful image build would restore the old template. A restart
of the current container keeps the patch. The next image build with the corrected source makes the
removal permanent.
