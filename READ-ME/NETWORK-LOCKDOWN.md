# NETWORK LOCKDOWN — every host, and what stands in front of it

*Verified 2026-10-07 on the running stack. Owner's rule: no API call to any external anything —
no clouds ever, except the model calls while the system is being built.*

---

## 1. Cut today (each verified on the running bytes)

| Call site | Was reaching | Cut, and how |
| --- | --- | --- |
| **Fonts — the site** | fonts.googleapis.com / fonts.gstatic.com | one self-hosted sheet (`frontend/public/fonts/fonts.css`, see `rids_resources/fonts_res/FONTS.md`). Live session: **zero external hosts**, fonts same-origin |
| **Fonts — the Development tool** | fonts.googleapis.com (2 dead `@import`s) | stripped from the tracked source clone AND from every build by `openhands-patch.sh` item 9 (fresh hashed link carries the cut past caches) |
| **Icons — the Development tool** | cdn.simpleicons.org (186 remote logo URLs) | patch item 10: all rewritten to the dead loopback (`127.0.0.1:9`); re-applied after every install, every restart (`RESTART-LOCAL` §8c), every hosted build. Bundled marks draw; the rest fail to draw — cosmetic, deliberate |
| **Telemetry — the Development tool (source + built)** | z.openhands.dev, us.posthog.com, us.i.posthog.com; baked `phc_` keys | source: key blanked in `config/defaults.json`, hosts deadened in `telemetry.ts`; built: patch item 11 (same rewrite across the whole `@openhands` scope). Survives reinstalls — nothing to re-arm by hand |
| **`/docs` — the backend (the site)** | cdn.jsdelivr.net (swagger-ui css+js) | Swagger UI **vendored** into `backend/static/swagger/` (same pinned version); custom `/docs` serves it from this origin; `/redoc` off (one word to vendor it too). Verified: rendered HTML has zero external refs |
| **`/docs` + `/redoc` — agent server & automation (the tool's two Python halves)** | cdn.jsdelivr.net (+ a Google fonts link in newer FastAPI templates) | `docs_url=None, redoc_url=None` in both tracked apps — travels to the hosted image |
| **Grace's external tools** | news.google.com (RSS), en.wikipedia.org (API) | `tool_run._get()` — the backend's single fetch door — now REFUSES with the host named. Re-enable deliberately with `ALLOW_EXTERNAL_TOOLS=1` on the host; never a silent default |
| **The builder's hosted fallback** | api-accounts.totalum.app (used silently when `VCAAS_BASE_URL` was unset) | default deleted; unset now = loud refusal at load. The last third-party cloud default in the tree is gone |

## 2. The declared calls that remain (each one deliberate)

1. **The model — `api.deepseek.com`.** Grace's turns, the builder engine's runs, and the
   restart script's one-token status check. This is the "while I'm building" exception — and
   it is the system's thinking layer; the endpoint is explicit configuration everywhere.
2. **Figma — `api.figma.com`.** The ingest/fidelity pipeline, only when you run an ingest —
   plus the restart script's token check. Nothing calls it on its own.
3. **SMTP — `emailer.py`.** Sends only when the app's own mail actions run; `SMTP_*` env-gated
   (empty = inert).
4. **Integrations inside the Development tool** (github, slack, linear, atlassian…). Endpoints
   exist as data in the integrations catalog; they fire only when an integration is configured
   and used. A loaded session makes zero external requests (measured 2026-10-06, and again
   today after the cuts).

## 3. Records and guards — strings that CANNOT call (the complete list)

- `development/openhands-patch.sh` — its comments, and the needle strings it cuts **must**
  contain the hosts they search for (that's the scissors, not a call).
- `development/OpenHands-main/src/mocks/analytics-handlers.ts` — MSW **blockers**: they
  intercept the real endpoints so mock-mode builds can't send; an interceptor never fetches.
- `development/OpenHands-main/__tests__/constants/extensions-catalogs.test.ts` — a vendor test
  fixture comparing against the catalog's constant (artifact URLs are rewritten at build).
- `development/OpenHands-main/src/components/features/mcp-logo-badge.tsx` — a comment about
  the icon CDN.
- `posthog-js` / `@posthog/*` library innards inside the tool install (47 URL strings) —
  **inert**: the key is blanked, consent is denied at launch, and the disable flag is set;
  the memory's own audit classified these the same way.
- Changelogs and `FONTS.md` prose.
- **Archives, not served, not scrubbed** (say the word and they're stripped too):
  `Raibach_IDS-pre-sept30/` (untracked snapshot), `product/ai-app-builder-open-main/`
  (tracked reference source of the builder fork), `rids_resources/carbon-web-components-main/`
  (resource archive whose demos reference IBM's CDN).

## 4. Build-time only (allowed — "while building")

Dockerfiles (apt, uv installer, npm ci, pinned PyPI resolutions), the frontend build, and the
one-time vendoring done by hand today (Swagger UI files, the Nunito woff2 cut — recipe in
FONTS.md §8). Nothing at RUNTIME fetches any of it again.

## 5. Switches, plainly

- `ALLOW_EXTERNAL_TOOLS=1` — turns Grace's external tools (news/wikipedia) back on for the host.
- `VCAAS_BASE_URL` — **required** by the builder now (e.g. `http://localhost:4000/api/v1/vcaas`).
- **Backend restart** — the local `:8000` process predates the `/docs` change; restart activates it.
- **Push** — the hosted services run the last pushed build; everything above takes effect there
  on the next push (all four services rebuild; the dev-workspace image runs the patch at build).
