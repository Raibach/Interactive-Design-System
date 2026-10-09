# DEPLOY.md — the strict runbook for the Governance room (local + hosted)

Authoritative operating facts for the room, written after the 2026-10-09
launch-friction / configuration-drift mandate. Everything below is a mechanical
fact of the live system — not a suggestion.

## Doctrine (applies to every section)

- NO grace-state placeholders. NO automatic buildpack guessing. NO silent
  fallbacks to vendor/base behaviors.
- A mismatched or missing required value (NEXTAUTH_URL, a database route, a
  build context) must hard-fail: crash the container, `FATAL:` in the logs.
  The app must never serve a degraded state quietly.
- A failed build deploys NOTHING (the previous deployment stays). There is
  never a stock/vendor fallback image.

## 1. The project-path rule (both environments)

The Langfuse root address `/` shows the vendor's "Search projects…" chooser
whenever the browser has no remembered project — exactly the loop we hit.
Therefore EVERY entry point into the room carries the project path suffix:

- Project id: `51211b35-c875-4715-8040-33fccb624279` (identical local + hosted)
- Local room: `http://localhost:3100/project/51211b35-c875-4715-8040-33fccb624279`
  - hardcoded in `frontend/src/shared/appConfig.ts` → `LOCAL_GOVERNANCE_TOOL`
  - read ONCE at page boot → after changing it, reload the page (not just the tab)
- Hosted room: `https://ui--langfuse-frame-proxy--mgtvxtd7xr2v.code.run/project/51211b35-c875-4715-8040-33fccb624279`
  - the hosted studio receives this via the service env `GOVERNANCE_TOOL_URL`
    (value lives on the service — THE CONFIG RULE — never in this repo)
- `/project/<id>` (no trailing slash) 308-redirects to `/project/<id>/`; that
  normalization is expected — real browsers follow it silently, probes must use `-L`.

The project path IS the homepage (project Home dashboard). If you ever see the
chooser page, you entered at a bare root: fix the ADDRESS, never the app.

## 2. Routing and authentication mechanics (hosted)

`browser → langfuse-frame-proxy (nginx) → langfuse-web-gov:3000 (Next.js)`

- The proxy is the only door. Template: `wireframe-lab/langfuse-frame-proxy/nginx.conf.template`.
  Its upstream is the service env `LANGFUSE_WEB_UPSTREAM` (= `langfuse-web-gov:3000`);
  no service name is hardcoded in the config (Northflank ignores service renames, so
  addresses move by value, not by name).
- Authentication: the standard login wall is DISABLED BY DESIGN — our patched source
  has no sign-in UI and there is no user-account flow. The proxy injects the
  pre-minted, long-lived session (`AUTH_SESSION_MAX_AGE=5256000`) via the
  `RAIBACH_SESSION_COOKIE` service value (mint procedure: `wireframe-lab/langfuse-gov-embed/DEPLOY.md`).
  Never create an account/admin on this deployment; nothing should ever ask you to.
- `NEXTAUTH_URL` MUST explicitly match the ACTIVE live host:
  `https://ui--langfuse-web-gov--mgtvxtd7xr2v.code.run` (read at boot).
  If the host ever changes: patch NEXTAUTH_URL on `langfuse-web-gov` AND
  `langfuse-worker-gov` first, then test. A mismatch is a broken state —
  there is no fallback path.
- Embedding: no `x-frame-options`; CSP `frame-ancestors` = studio origin only;
  responses `no-store`. Studio origin: `https://site--semantic-design-systems--mgtvxtd7xr2v.code.run`.

## 3. Fleet (Northflank project `semantic-design-system`, branch `gov-embed-2026-10-09`)

- `langfuse-web-gov` — our build of `wireframe-lab/langfuse-gov-embed` (web/Dockerfile), port 3000 internal
- `langfuse-worker-gov` — our build (worker/Dockerfile), port 3030 internal
- `langfuse-frame-proxy` — nginx door (`wireframe-lab/langfuse-frame-proxy`)
- `langfuse-clickhouse`, `langfuse-redis`, `langfuse-minio`, addon `langfuse-postgres` — state stores
- Deleted and gone (404, verified): the stock `langfuse-web` vendor image and the
  vendor-image worker. Vendor registry hosts are banned in this project; the local
  compose builds from this repo's source.

## 4. Pipeline rules (Northflank) — no assumptions allowed

- Build type: Dockerfile ONLY — no buildpacks, no autodetection. Every service pins
  `dockerFilePath` + `dockerWorkDir` explicitly:
  - web: `/wireframe-lab/langfuse-gov-embed/web/Dockerfile`, workdir `/wireframe-lab/langfuse-gov-embed`
  - worker: `/wireframe-lab/langfuse-gov-embed/worker/Dockerfile`, same workdir
  - proxy: `/wireframe-lab/langfuse-frame-proxy/Dockerfile`, workdir `/wireframe-lab/langfuse-frame-proxy`
  - Context drift note: each pinned workdir IS the build context its Dockerfile reads
    (each app folder is self-contained: its own lockfile/package tree). Every COPY
    path is relative to that pinned context — repointing a context anywhere else
    (including "to the repo root") misroutes every COPY and fails the build, by design.
- Build args: error-masking is banned. `NEXT_IGNORE_BUILD_ERRORS` was REMOVED from
  `langfuse-web-gov` build arguments on 2026-10-09 (it only masks when the literal
  value is `"true"` — ours was `"1"`, i.e. inert — removed anyway: zero masking
  allowed). Builds run the real Next.js type check and must pass clean.
- CI: pushes to `gov-embed-2026-10-09` auto-build (`disabledCI=false`).
  Commit-message skip flags are ENABLED: `ciIgnoreFlagsEnabled=true`,
  `ciIgnoreFlags=["[skip ci]"]` on web-gov, worker-gov, frame-proxy.
  - TEXT-ONLY commits (docs/comments — e.g. DEPLOY.md edits) MUST carry the flag:
    `git commit -m "docs: ... [skip ci]"` — otherwise a docs push queues full image
    builds (endless queue loops).
  - CODE commits carry no flag: the build IS the verification.
- Manual rebuild: `POST /v1/projects/semantic-design-system/services/combined/<svc>/build`
  body `{"buildSource":"latest"}` · build list: `GET .../services/<svc>/build`
- Failed build = nothing deployed. Never swap in a vendor image as a stopgap.

## 5. Fail-fast / no-fallback enforcement (live)

- Live service config (2026-10-09 night, applied and receipted): build-error mask
  removed (web); `[skip ci]` enabled (all three); worker `NEXTAUTH_URL` corrected
  off the deleted `ui--langfuse-web--…` host to the live host (drift eliminated).
- Boot guards (source-committed; active from the NEXT image build — entrypoints are
  baked into images): `web/entrypoint.sh` + `worker/entrypoint.sh` validate required
  configuration BEFORE anything connects and exit 1 with a `FATAL:` line when it is
  missing or malformed:
  - worker: `DATABASE_URL` (postgres DSN, or the full `DATABASE_*` component set),
    `REDIS_HOST`, `CLICKHOUSE_URL`, `SALT`, `ENCRYPTION_KEY`
  - web: the above + `NEXTAUTH_URL` (must be `https://…`; `http://localhost…` allowed
    for local runs) + `NEXTAUTH_SECRET`
  - the guard is a presence/shape check (FATAL + exit 1); exact live-host matching of
    `NEXTAUTH_URL` stays the operational rule in §2.
- Telemetry OFF: `TELEMETRY_ENABLED=false`; no vendor endpoints anywhere.
- Logs are the truth surface: raw container stdout/stderr via Northflank
  (`GET /v1/projects/semantic-design-system/services/<svc>/logs?limit=N`,
  Bearer token from `~/.northflank/config.json`). Never summarize an error away.

## 6. Environment keys (names only — values live on the services)

- web-gov (40 keys): `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_SESSION_MAX_AGE`,
  `SALT`, `ENCRYPTION_KEY`, `DATABASE_URL`, `REDIS_*`, `CLICKHOUSE_*`
  (URL/USER/PASSWORD/MIGRATION_URL/CLUSTER_ENABLED), `LANGFUSE_S3_*`
  (media + event upload), `LANGFUSE_INIT_*` (org/project/user bootstrap),
  `TELEMETRY_ENABLED=false`.
- worker-gov (29 keys): `DATABASE_URL`, `REDIS_*`, `CLICKHOUSE_*`,
  `LANGFUSE_S3_*`, `SALT`, `ENCRYPTION_KEY`, `TELEMETRY_ENABLED=false`,
  `NEXTAUTH_URL` (kept aligned with web-gov).
- frame-proxy (3 keys): `LANGFUSE_WEB_UPSTREAM`, `STUDIO_ORIGIN`, `RAIBACH_SESSION_COOKIE`.
- studio (hosted): `GOVERNANCE_TOOL_URL` (the room project path); room tap:
  `LANGFUSE_BASE_URL` + hosted `LANGFUSE_*_KEY`.
- Local: room stack in `governance/langfuse-main` (compose; app images built from
  this repo source), studio vite `:5001`, backend uvicorn `:8000`, `RESTART-LOCAL.sh`.

## 7. 60-second verification receipts

```sh
curl -sL -o /dev/null -w '%{http_code}\n' \
  "https://ui--langfuse-frame-proxy--mgtvxtd7xr2v.code.run/project/51211b35-c875-4715-8040-33fccb624279"   # expect 200
curl -s  -o /dev/null -w '%{http_code}\n' \
  "http://localhost:3100/project/51211b35-c875-4715-8040-33fccb624279/"                                  # expect 200 (or its trailing-slash 308)
```

Deployment state: `GET /v1/projects/semantic-design-system/services/<svc>` →
`status.deployment.status` must read `COMPLETED`.

## 8. Triage (strict, no guessing)

| symptom | real action |
|---|---|
| chooser page ("Search projects…") | you used a bare root; enter via the project path (§1). No app change. |
| spinner on the room during a deploy | that is the rollout — the previous pod serves until the new one is ready. Check `status.deployment`; a failed new deployment replaces nothing. |
| `FATAL:` in boot logs | the guard fired; the named variable is missing/malformed. Fix the value on the service. Never bypass the guard. |
| 502 from the proxy | web-gov is down or deploying; read its logs. Never add substitute services. |
| red build | read the build log, fix the source. Never re-add masking args; never swap in a vendor image. |

The line to remember: **blank beats fake; the file is the authority; the raw error goes in the log.**
