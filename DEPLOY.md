# DEPLOY.md — the strict runbook (local + raibach-cloud-3)

Authoritative operating facts, written after the 2026-10-09 launch-friction /
configuration-drift mandate and re-grounded the same night when all hosting moved
off Northflank onto raibach-cloud-2, then re-grounded again on 2026-10-18 onto
**raibach-cloud-3** (188.245.25.26 — the machine that is live today; the retired
Northflank fleet and raibach-cloud-2 are history, not a fallback). Everything
below is a mechanical fact of the live system — not a suggestion.

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
- Hosted room (raibach-cloud-3): `https://design.system.raibach.net/project/51211b35-c875-4715-8040-33fccb624279`
  - the hosted studio receives this via its env `GOVERNANCE_TOOL_URL`
    (value lives on the server in `/opt/raibach/ids/studio.env` — THE CONFIG RULE — never in this repo)
- `/project/<id>` (no trailing slash) 308-redirects to `/project/<id>/`; that
  normalization is expected — real browsers follow it silently, probes must use `-L`.

The project path IS the homepage (project Home dashboard). If you ever see the
chooser page, you entered at a bare root: fix the ADDRESS, never the app.

## 2. Routing and authentication mechanics (raibach-cloud-3)

`browser → frame-proxy (nginx, :80) → langfuse-web (Next.js, :3000)`

- The proxy is the only door. Template: `product/langfuse-frame-proxy/nginx.conf.template`.
  Its upstream comes from the env `LANGFUSE_WEB_UPSTREAM` (= `langfuse-web:3000` on the
  compose network); no service name is hardcoded in the config — addresses move by
  value, not by name.
- Authentication: the standard login wall is DISABLED BY DESIGN — our patched source
  has no sign-in UI and there is no user-account flow. The proxy injects the
  pre-minted, long-lived session (`AUTH_SESSION_MAX_AGE=5256000`) via the
  `RAIBACH_SESSION_COOKIE` value in `/opt/raibach/ids/.env` (mint procedure:
  `product/raibach-cloud-3/ids/README.md`). The cookie is injected under BOTH
  name variants in one header (`next-auth.session-token` + `__Secure-…`) — one tree
  serves the bare http server and any future https world.
  Never create an account/admin on this deployment; nothing should ever ask you to.
- `NEXTAUTH_URL` MUST name the live host: `https://design.system.raibach.net` (read at boot;
  the boot guard accepts any absolute http(s) URL and FATALs on anything else).
  If the host ever changes: patch it in `/opt/raibach/ids/.env` (it feeds both
  `langfuse-web` and `langfuse-worker`), recreate those two containers, then test.
  A mismatch is a broken state — there is no fallback path.
- Embedding: no `x-frame-options`; CSP `frame-ancestors` = studio origin only;
  responses `no-store`. Studio origin: `https://design.system.raibach.net` (the `STUDIO_ORIGIN`
  value in `/opt/raibach/ids/.env`; recreate `frame-proxy` after changing it).
  The proxy also injects the house-ground styling and the location reporter the
  studio's shell nav listens for.

## 3. The server (raibach-cloud-3)

One bare Ubuntu box (cpx32, 188.245.25.26, hostname `raibach-cloud-3`), Docker +
compose, no platform layer. Stack root: **`/opt/raibach/ids`** — `docker-compose.yml`
+ `.env` (values, chmod 600) + `studio.env` + one source folder per built image.
Every service runs `restart: "no"`: a broken build or boot leaves its port BLACK on
purpose; the raw error is in `docker compose logs <service>`.

**The public door is Caddy, not the stack.** A separate compose project
(`wp-sites`, container `wp-sites-caddy-1`) owns host ports 80/443 and reverse-proxies
by hostname. **The `ids` services publish NO host ports** — reaching them by
`IP:port` is expected to fail; go through `https://design.system.raibach.net`.

Compose services (project name `ids`):
- `postgres`, `clickhouse`, `redis`, `minio` — the room's state stores (named volumes)
- `langfuse-web` — build `./langfuse`, internal only
- `langfuse-worker` — build `./langfuse`, internal only
- `frame-proxy` — build `./frame-proxy`, the room door behind Caddy
- `studio-postgres` — the studio's own database (healthchecked; internal only)
- `studio` — build `./studio` (the repo-root Dockerfile: built frontend + FastAPI
  backend in one image), served at the site root
- `builder`, `builder-engine`, `canvas` — the design-side services

## 4. The deploy procedure (raibach-cloud-3)

Source of truth is this repository on the local machine. A deploy is three
mechanical steps — no CI, no buildpacks, no guessing:

1. SEND the source: rsync the tree the Dockerfile reads into its folder under
   `/opt/raibach/ids` (for the studio: `.git` (the catalog checker asks git), the repo
   `Dockerfile`, `.dockerignore`, `README.md`, `config.py`, `backend/` (no `.venv`,
   no `.env`), `frontend/` (no `node_modules`, no `dist`), `READ-ME/`,
   `catalog-audit/`, `product/catalogs`, **and `filter-config/`** — see below).
2. BUILD on the server: `cd /opt/raibach && docker compose build <service>`.
   A failed build deploys NOTHING; the previous image stays in use. Never swap in
   a vendor image as a stopgap, never re-add error-masking.
3. UP: `docker compose up -d <service>` (+ recreate `frame-proxy` when
   `STUDIO_ORIGIN` changed). Verify from OUTSIDE (the receipt block in §7).

The studio's database: `init_db.py` runs on every studio boot (safe migrations,
never drops). To carry data from the local machine (`railway`):
`pg_dump -d railway --no-owner --no-acl` locally, piped into
`docker exec -i ids-studio-postgres-1 psql -U studio -d studio`
(ON_ERROR_STOP=1 — a failed restore is loud).

### 4a. Two inputs the studio build needs that are easy to forget (measured 2026-10-18)

- **`filter-config/sessions-config.ts` must be in the build context.** The governance
  sessions lane generates its query catalogue from the Langfuse fork's own
  `web/src/features/filters/config/sessions-config.ts`, and the fork is NOT in the
  studio image. The repo keeps one copy — a symlink at `filter-config/sessions-config.ts`
  pointing into the fork — and the Dockerfile does `COPY filter-config ./filter-config`.
  The backend resolves it through `governance_lanes.sessions_config_path()`:
  `LANGFUSE_FILTER_CONFIG` → `LANGFUSE_FILTER_DIR` → fork path → `filter-config/`.
  Missing file = the catalogue endpoint answers `FileNotFoundError` with every path it
  tried (that was the first deploy failure; the error named the path, which is why the
  repair was mechanical).
- **`studio.env` must carry the ClickHouse coordinates.** The lane reads ClickHouse for
  facet values and session rows. Default is `http://127.0.0.1:8123`, which inside the
  container is nothing — the endpoint answers `URLError: Connection refused`. The four
  lines that must be in `/opt/raibach/ids/studio.env`:
  `CLICKHOUSE_URL=http://clickhouse:8123`, `CLICKHOUSE_DB=default`,
  `CLICKHOUSE_USER=clickhouse`, `CLICKHOUSE_PASSWORD=<same value as the compose .env>`.
  Adding them requires `docker compose up -d studio` (a restart does not re-read env).

## 5. Fail-fast / no-fallback enforcement (live)

- The image is the only source: builds run the real Next.js type check and must
  pass clean (the Northflank-era error-mask ARG was deleted from the web Dockerfile
  on 2026-10-09 — an undeclared ARG cannot be passed back in).
- Boot guards (source-committed; active from the NEXT image build — entrypoints are
  baked into images): `web/entrypoint.sh` + `worker/entrypoint.sh` validate required
  configuration BEFORE anything connects and exit 1 with a `FATAL:` line when it is
  missing or malformed:
  - worker: `DATABASE_URL` (postgres DSN, or the full `DATABASE_*` component set),
    `REDIS_HOST`, `CLICKHOUSE_URL`, `SALT`, `ENCRYPTION_KEY`
  - web: the above + `NEXTAUTH_URL` (any absolute `http(s)` URL — the bare server is a
    legitimate http deployment; empty/garbage = FATAL) + `NEXTAUTH_SECRET`
  - the guard is a presence/shape check (FATAL + exit 1); exact live-host matching of
    `NEXTAUTH_URL` stays the operational rule in §2.
- Telemetry OFF: `TELEMETRY_ENABLED=false`; no vendor endpoints anywhere.
- The studio's DB SSL rule lives in `backend/database_pool.py`: an explicit
  `sslmode` in `DATABASE_URL` always wins; absent it, localhost → `disable`,
  private/`railway.internal` → `prefer`, anything else → `require`. The server's
  `studio.env` pins `?sslmode=prefer` (private compose network, no TLS on the wire).
- The room's storage needs BOTH the address AND a writable bucket to ingest:
  `LANGFUSE_S3_EVENT_UPLOAD_ENDPOINT` + `LANGFUSE_S3_MEDIA_UPLOAD_ENDPOINT` must point
  at the internal storage (`http://minio:9000`) — without them, uploads fall back to
  REAL Amazon S3 and every ingest 500s (raw `InvalidAccessKeyId` in the room's log).
  And a bucket folder created by hand under the storage volume must be world-writable
  (the storage process runs non-root; the volume root is mode 777 for exactly that
  reason — 10-09 lesson: a 755 folder answers `AccessDenied` on PUT). Restart does
  NOT re-read `.env`; after changing values, recreate: `docker compose up -d <service>`.
- The frame-proxy re-resolves `langfuse-web` automatically (Docker-DNS resolver in the
  template, added 2026-10-09): recreating the web service no longer blacks the room out
  with a stale upstream address — before the fix, every web update answered 502
  `connection refused` until the proxy was recreated too (measured and repaired live).
- Logs are the truth surface: raw container stdout/stderr via
  `docker compose logs <service>` on raibach-cloud-3. Never summarize an error away.

## 6. Environment keys (names only — values live on the server)

- `/opt/raibach/ids/.env` feeds `langfuse-web`, `langfuse-worker` and the stores:
  `NEXTAUTH_URL` + `NEXTAUTH_SECRET` + `AUTH_SESSION_MAX_AGE`, `SALT`,
  `ENCRYPTION_KEY`, `DATABASE_URL` + `POSTGRES_*`, `REDIS_*`, `CLICKHOUSE_*`
  (URL/USER/PASSWORD/MIGRATION_URL/CLUSTER_ENABLED), `LANGFUSE_S3_*`
  (media + event upload), `LANGFUSE_INIT_*` (org/project/user bootstrap),
  `TELEMETRY_ENABLED=false`, `RAIBACH_SESSION_COOKIE`, `STUDIO_ORIGIN`,
  `LANGFUSE_WEB_UPSTREAM`, `STUDIO_DB_PASSWORD` (the studio DB's generated password).
- `/opt/raibach/ids/studio.env` feeds the `studio` service (chmod 600):
  `DATABASE_URL` (internal studio DB, `sslmode=prefer`), `ENVIRONMENT`,
  `MODEL_PROVIDER`/`DEEPSEEK_*`, `FIGMA_*`, `SMTP_*`/`FROM_EMAIL`,
  `ADMIN_USER_IDS`/`DEFAULT_USER_ID`, `GOVERNANCE_TOOL_URL` (the room project path —
  served to the browser via `/api/config`), `LANGFUSE_BASE_URL` (internal
  `http://langfuse-web:3000`) + `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`
  (the server's own project keys, copied from `LANGFUSE_INIT_PROJECT_*`),
  `CLICKHOUSE_URL`/`CLICKHOUSE_DB`/`CLICKHOUSE_USER`/`CLICKHOUSE_PASSWORD`
  (the governance query lanes read ClickHouse directly — see §4a), `PORT=5001`.
- Local: room stack in `governance/langfuse-main` (compose; app images built from
  this repo source), studio vite `:5001`, backend uvicorn `:8000`, `RESTART-LOCAL.sh`.

## 7. 60-second verification receipts

```sh
curl -sL -o /dev/null -w '%{http_code}\n' "https://design.system.raibach.net/"                                    # studio — expect 200
curl -sL -o /dev/null -w '%{http_code}\n' "https://design.system.raibach.net/project/51211b35-c875-4715-8040-33fccb624279/"  # room — expect 200
curl -s https://design.system.raibach.net/api/config                                                              # must name the room URL
curl -s https://design.system.raibach.net/api/governance/sessions/catalogue | head -c 120                         # must say "status":"ok"
curl -s  -o /dev/null -w '%{http_code}\n' \
  "http://localhost:3100/project/51211b35-c875-4715-8040-33fccb624279/"                                           # local room — expect 200 (or its trailing-slash 308)
```

Deployment state: `docker compose ps` on the server — every service must be `Up`;
a service that exited with `restart: "no"` is DOWN ON PURPOSE until its raw error
is fixed.

## 8. Triage (strict, no guessing)

| symptom | real action |
|---|---|
| chooser page ("Search projects…") | you used a bare root; enter via the project path (§1). No app change. |
| studio down (port black) | `docker compose logs studio` — the raw error is there. Most recent class: DB SSL (`sslmode`) — the rule in §5. Never remove the guard; fix the value. |
| `FATAL:` in boot logs | the guard fired; the named variable is missing/malformed. Fix the value on the service. Never bypass the guard. |
| 502 from the proxy | `langfuse-web` is down; `docker compose logs langfuse-web`. Never add substitute services. |
| red build | read the build log, fix the source. Never re-add masking args; never swap in a vendor image. |

The line to remember: **blank beats fake; the file is the authority; the raw error goes in the log.**
