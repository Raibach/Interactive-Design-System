# OUR BUILD — notes on the PostHog image we run

## 403 CSRF on logout (found 2026-10-21, FIXED in source — image rebuilding)

**Symptom:** clicking Log out shows Django's `Forbidden (403) — CSRF verification failed` page.

**Cause, corrected after measuring (the first reading was wrong):**

```
Forbidden (CSRF cookie not set.): /logout          (4 in the last 2 hours)
set-cookie: posthog_csrftoken=…; Path=/; SameSite=Lax; Secure
@ensure_csrf_cookie is already on _render_home (posthog/frontend_views.py:134)
```

The entry view **does** set the cookie. The cookie is **`SameSite=Lax`**, and the app is displayed
**inside the studio's frame, which is a different site** — so the browser does not attach the cookie
to a cross-site POST. `/logout` arrives without it and Django correctly refuses.

**The fix (removes the cause; does not exempt the view):** `posthog/settings/access.py` now sets
`SESSION_COOKIE_SAMESITE = "None"` and `CSRF_COOKIE_SAMESITE = "None"` **when `secure_cookies` is on**
(the cookies already carry `Secure`). The cookie then travels in the frame; CSRF verification still
runs on every unsafe request exactly as before. When secure cookies are off (plain-http local dev) the
cookies stay at Django's default rather than being dropped by the browser for lacking `Secure`.

**Verification once the image is rebuilt and `web` is swapped:** `GET /` still sets
`posthog_csrftoken` with `SameSite=None; Secure`; a logout inside the studio frame must no longer
produce `Forbidden (CSRF …)` in `docker logs posthog-master-web-1`.

### VERIFIED 2026-10-21 after the rebuild + swap

```
GET /                     → 200  (no location header, no /login redirect)
posthog_csrftoken         → SameSite=None  Secure
sessionid                 → HttpOnly  SameSite=None  Secure
Forbidden (CSRF …) in the last 10 minutes → 0
```

## OPEN DEFECT — the Node sidecar crash-loops (found 2026-10-21 during the same check)

The container's log repeats, every ~2 seconds:

```
Error: Cannot find module '/code/dist/index.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1421:15)
💥 Nodejs services crashed!
⌛️ Waiting 2 seconds before restarting...
```

`/code/dist/index.js` is not in our image — the Node services bundle was not built/copied by our
Dockerfile. Whatever those services do (plugin transpilation and its neighbours) is therefore not
running, and the container is burning CPU restarting it. **Not fixed.** It is a build-layer omission,
not a configuration: the bundle must be produced and placed at `/code/dist/index.js` in the image.

