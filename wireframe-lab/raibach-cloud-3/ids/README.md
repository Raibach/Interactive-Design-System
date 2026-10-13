# The Design System stack — `/opt/raibach/ids` on raibach-cloud-3

**What this serves:** `https://design.system.raibach.net` — the studio app at the
root; the Governance room at `/governance` (langfuse, framed through the proxy);
the Product room's builder at `/builder` + engine previews at `/preview/<id>/`.

**The door chain:** caddy (in the wp stack, on the shared network
`wp-sites_default`) → `frame-proxy:8080` → `langfuse-web:3000/governance`;
`builder:3223` for `/builder*`; `builder-engine:4000` for `/preview*` (the
engine runs with `PUBLIC_BASE_URL=https://design.system.raibach.net` so every
preview URL it issues is the door's path form); `studio:5001` at everything
else. The `/dev` canvas is the last room waiting for this same pattern.

## Layout on the box

```
/opt/raibach/ids/
  docker-compose.yml          ← from this repo folder
  .env                        ← from governance/ids-box.env (600; secrets)
  studio.env                  ← from governance/ids-studio.env (600; secrets)
  langfuse/                   ← wireframe-lab/langfuse-gov-embed (web + worker Dockerfiles)
  studio/                     ← the build context (Dockerfile, backend/, frontend/, scripts/, .git, catalogs)
  frame-proxy/                ← the box variant of wireframe-lab/langfuse-frame-proxy
  data/                       ← postgres x2, clickhouse, minio, redis (bind mounts)
  vector/                     ← milvus-lite store (studio)
```

## The bring-up order (and why)

```bash
cd /opt/raibach/ids
docker compose build langfuse-web langfuse-worker studio frame-proxy
docker compose up -d postgres clickhouse minio redis studio-postgres
docker compose up -d langfuse-web langfuse-worker        # seeds org/project/user
docker compose up -d frame-proxy studio                  # then the door + the app
```

The langfuse session cookie (`RAIBACH_SESSION_COOKIE`) is minted ONCE after
`langfuse-web` boots, via the csrf + credentials flow
(`admin@raibach.local` / password in `.env`), then written into `.env` and
`docker compose up -d frame-proxy` again. Until minted, the room shows the
login; nothing else.

## LESSONS (2026-10-11 — earned live, keep them)

- **Mint over https, never the internal http hop.** With
  `NEXTAUTH_URL=https://…` the app issues `__Secure-` prefixed cookies; curl
  REFUSES to store those from a plain-http response (prefix rules) — the jar
  comes back empty and the login POST answers `?csrf=true`. Mint against
  `https://design.system.raibach.net` from the box itself (`curl -c`/`-b`
  jar over the public door), then write the captured
  `__Secure-next-auth.session-token` value into `.env`.
- **The auth endpoints must NOT get the injected cookie.** The frame-proxy
  carries a `/governance/api/auth/` pass-through location precisely so the
  csrf dance sees the client's real cookies. Room traffic never touches it.
- **Bind-dir ownership:** clickhouse runs as uid 101 (`chown -R 101:101
  data/clickhouse*`) and minio runs non-root (`chmod -R 777 data/minio` +
  pre-created `langfuse/`). Missing this = Exited(1) at first boot.
- **The boot guard (no-fallback doctrine) works:** missing `CLICKHOUSE_URL`
  in `.env` = `FATAL … refusing to start`, exit 1, black — exactly as
  designed. The guard's required set: `NEXTAUTH_URL NEXTAUTH_SECRET
  REDIS_HOST CLICKHOUSE_URL SALT ENCRYPTION_KEY`.

## House rules (inherited from the wp stack)

- `restart: "no"` everywhere — a broken boot leaves the door BLACK, loudly.
- No host ports; the only inbound is caddy (80/443).
- Caddyfile lives at `/opt/raibach/wp/caddy/Caddyfile` — its DIRECTORY is
  mounted (`./caddy:/etc/caddy:ro`), so rsync-ing the file in works; reload
  with `docker compose -f /opt/raibach/wp/docker-compose.yml exec -T caddy caddy reload --config /etc/caddy/Caddyfile`.

## DATA — the studio's database was carried 2026-10-11

The box's `studio` DB holds the owner's real data (dumped from the Mac's
`railway` DB): 320 prompt_sessions, audit/usage/figma-activity rows, full
schema. The restore ran as a DETACHED script on the box —
`/opt/raibach/ids/restore-studio-db.sh` (stages stop→backup→wipe→restore→
start→verify, log `restore.log`, `pg_restore exit: 0`). Re-run pattern for a
refresh: ship a fresh dump to `railway-restore.dump`, run the same script
detached — cancelling an interactive session cannot strand the studio
(learned twice the hard way: a cancelled command's remote `stop` still ran).
Pre-restore backups live at `data/pre-restore-*.dump`.

## Build notes (the honest ones)

- **SWAP IS REQUIRED for the langfuse-web build** (2026-10-11, learned live):
  box has 7.6G RAM of which ~2G belongs to the live WP stack; the Next.js
  build OOM-killed (exit 137) without it. An 8G swapfile at `/swapfile`
  (in `/etc/fstab`, `vm.swappiness=10`) is active — the build used 1.4G of it.
  Do not remove the swapfile; a rebuilt web image will need it again.
- `langfuse-web` is the long build (FIPS UBI, pnpm/turbo, Next.js) — start it
  first, everything else can wait on it.
- `NEXT_PUBLIC_BASE_PATH=/governance` is a BUILD arg (baked into the image,
  Dockerfile line 189 + `next.config.mjs` line 113) and repeated at runtime.
- The studio build needs `.git` (the catalog checker asks git whether
  OPEN-ITEMS.md is tracked; it fails the build when it cannot answer) and
  `scripts/catalog-check.mjs` at the repo root of the context.
- The studio runtime runs `python init_db.py && uvicorn main:app` — the schema
  is created on first boot against `studio-postgres`.
