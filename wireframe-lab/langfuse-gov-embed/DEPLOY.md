# DEPLOY — the governance room's application, from a blank slate

Everything the hosted room runs is **built from this repository**. No file is ever
placed on a server by hand; every value lives on the Northflank services
(THE CONFIG RULE — see `wireframe-lab/HOST-THE-TOOLS.md`), never in this tree.

## Components — each one is a plain `docker build` of a folder in this repo

| piece | source (this repo) | build command (from repo root) | Northflank service |
|---|---|---|---|
| **web** — the room's app | `wireframe-lab/langfuse-gov-embed/` | `docker build -f wireframe-lab/langfuse-gov-embed/web/Dockerfile --build-arg NEXT_IGNORE_BUILD_ERRORS=1 wireframe-lab/langfuse-gov-embed` | `langfuse-web-gov` (port 3000) |
| **worker** — ingestion enrichment | same tree | `docker build -f wireframe-lab/langfuse-gov-embed/worker/Dockerfile wireframe-lab/langfuse-gov-embed` | `langfuse-worker-gov` (port 3030, internal) |
| **frame proxy** — frame headers, session, house ground | `wireframe-lab/langfuse-frame-proxy/` | `docker build wireframe-lab/langfuse-frame-proxy` | `langfuse-frame-proxy` (port 8080) |
| **studio** — the shell around the room | repo root (its own Dockerfile) | production build from `main` | `semantic-design-systems` |

Northflank build settings (values on the service, not in files): git source =
this repo, branch `gov-embed-2026-10-09`; build engine buildkit; build plan
nf-compute-400-16; deployment plans: web nf-compute-100-2, worker nf-compute-50.

## Infrastructure the stack expects (created on Northflank; not built here)

- Postgres addon (`langfuse-postgres`) · a ClickHouse service · a Redis service · a MinIO service.
- All connection values arrive as service environment; none of them exist in this tree.

## Environment keys the services need (NAMES ONLY — values on the services)

- **web + worker (shared)**: everything in the local
  `governance/langfuse-main/docker-compose.yml` anchor list, notably
  `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_SESSION_MAX_AGE`,
  `SALT`, `ENCRYPTION_KEY`, `CLICKHOUSE_URL`, `CLICKHOUSE_MIGRATION_URL`,
  `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`,
  `REDIS_AUTH`, the `LANGFUSE_S3_*` set (event + media buckets, endpoints, keys),
  `TELEMETRY_ENABLED=false` (never home), `LANGFUSE_INIT_ORG_*`, `LANGFUSE_INIT_PROJECT_*`,
  `LANGFUSE_INIT_USER_*` (the seed).
- **proxy**: `RAIBACH_SESSION_COOKIE` (see below), `STUDIO_ORIGIN`, `LANGFUSE_WEB_UPSTREAM`.
- **studio**: `GOVERNANCE_TOOL_URL` (the proxy address), `LANGFUSE_BASE_URL`
  (internal address of the web service), `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`.

## The session (why the room never shows a login)

The frame proxy injects `__Secure-next-auth.session-token` as a request header,
taken from the proxy's `RAIBACH_SESSION_COOKIE` env. Mint it once: sign in on the
web app (seeded admin), copy the cookie value, set it on the proxy. Rotate =
re-mint + update that one env. The 10-year expiry comes from
`AUTH_SESSION_MAX_AGE` on the web service.

## Local vs hosted — the complete difference list

1. **Platform**: the same tree builds for arm64 (the Mac) and amd64 (the servers). Same source, two compiles.
2. **Values**: on services (env), never in files — by design.
3. **Each side has its own database.** Data does not travel between the two; the local
   history lives in the local store, the hosted room reads the hosted store.

Everything else — code, patches, proxy behaviour, styling layer — is identical.
