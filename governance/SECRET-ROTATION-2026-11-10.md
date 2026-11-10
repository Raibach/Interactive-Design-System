# Secret exposure — Langfuse hosted stack (2026-11-10)

## What happened

GitGuardian reported a **Generic Database Assignment** in `Raibach/Interactive-Design-System`
on 2026-11-10 04:10 UTC. The repository is **public**.

The finding is real, and the database URL is the smallest part of it. Two Northflank service
snapshots were committed with their `runtimeEnvironment` block intact:

| File | Blob |
| --- | --- |
| `governance/stock-langfuse-web-service-2026-10-09.json` | `0315b397881631065ef1923ea313ce6136090822` |
| `governance/stock-worker-service-2026-10-09.json` | `c3000be9d671c35022a1f12e27de1f2df535a5d9` |

Introduced by commit `4a82aad15bdc83e6b5ffc420d0b45f3ab6db361a` — *The zone documents join the
demo*, 2026-10-26 14:29 -0500 — on `main`. It stayed on the default branch for two weeks.

These are the two services of the hosted Langfuse stack:

- project `semantic-design-system`, cluster `nf-europe-west`, namespace `ns-mgtvxtd7xr2v`
- UI: <https://ui--langfuse-web--mgtvxtd7xr2v.code.run>
- Postgres: `primary.langfuse-postgres--mgtvxtd7xr2v.addon.code.run:5432`

## What leaked

Eleven values, every one of them live at the time of publication:

| Value | Used for |
| --- | --- |
| `DATABASE_URL` | Postgres role `_f763f7b900e4c7f3` and its password, database `_a8d16e67cd26` |
| `NEXTAUTH_SECRET` | session signing on the web service |
| `SALT` | hashing of API keys stored in Postgres |
| `ENCRYPTION_KEY` | encryption of secrets stored in Postgres |
| `CLICKHOUSE_PASSWORD` | ClickHouse user `clickhouse` |
| `REDIS_AUTH` | Redis auth |
| `MINIO_ROOT_PASSWORD` | MinIO root, also used as both S3 secret access keys |
| `LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY` | event bucket |
| `LANGFUSE_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY` | media bucket |
| `LANGFUSE_INIT_PROJECT_SECRET_KEY` | Langfuse project API secret (`sk-lf-…`) |
| `LANGFUSE_INIT_USER_PASSWORD` | admin account `admin@raibach.local` |

`LANGFUSE_INIT_PROJECT_PUBLIC_KEY` was published too. It is not a secret on its own, but it names
the project that the leaked secret key unlocks.

## 1. Rotate first

The values are burned. Deleting files or rewriting history does not un-publish them; the only
remedy is new credentials.

**If this stack is only the 2026-10-09 stock demo** — admin is `admin@raibach.local`, the project
is `Governance`, nothing in `governance/langfuse-main` talks to it — the cheapest correct move is
to **delete the whole Northflank project** and redeploy from scratch if it is ever needed again.
That retires every value in the table at once, including the ones whose rotation is awkward.

Otherwise, rotate in this order:

1. **Postgres** — Northflank → addon `langfuse-postgres` → credentials → reset password.
2. **ClickHouse, Redis, MinIO** — rotate each service's password, then update the same keys on
   both `langfuse-web` and `langfuse-worker`.
3. **`NEXTAUTH_SECRET`** — new value on both services; every session is invalidated.
4. **`SALT`** — new value; all existing Langfuse API keys stop verifying. Recreate them in the UI.
5. **`ENCRYPTION_KEY`** — new value. This key decrypts rows already in Postgres, so rotating it
   orphans whatever was stored encrypted (project keys, integration secrets). Rotate it together
   with step 4 and recreate the project keys, or start from an empty database.
6. **Langfuse project key** — UI → project `Governance` → Settings → API keys → delete and create.
7. **Admin password** — UI → user settings, or reset it through `LANGFUSE_INIT_USER_PASSWORD` on a
   fresh deployment.
8. Update `governance/langfuse-hosted.env` (gitignored) with the new values and restart the
   services.

## 2. Scrub the repository

Done in the working tree, not yet in history:

- both JSON snapshots now carry `"REDACTED"` for all eleven values — the deployment facts (image,
  ports, resource plan, env key names) are preserved, the credentials are not;
- the real values live only in `governance/langfuse-hosted.env`, which `*.env` keeps out of git
  and which is now `0600`.

History still holds the original blobs. `scripts/purge-langfuse-secrets.sh` rewrites every ref
with `git filter-repo --replace-text`, verifies the result, and force-pushes. Read it before
running it — it rewrites `main` and every published branch, and every clone must be re-cloned
afterwards.

After the push:

- old commits remain reachable by SHA on GitHub until their objects are collected. Open a support
  request at <https://support.github.com> asking to purge cached views and unreachable objects for
  this repository, naming the blobs above.
- in GitGuardian, mark the incident **revoked** (credential rotated) and then **resolved**.
- enable *Secret scanning → Push protection* in the repository settings so the next `DATABASE_URL`
  never reaches `main`. The repository is public, so scanning is free.

## 3. Prevent the repeat

- `scripts/secret-scan.mjs` checks tracked files, and with `--history` every blob in every commit,
  for these patterns. Run it before a push that touches `governance/`.
- Service snapshots are the recurring hazard: `northflank`/`crane` output carries the full
  environment. Strip `runtimeEnvironment` values at capture time, keep the key names, and put the
  values in the gitignored env file.
- `governance/` is tracked. Only `*.env` inside it is ignored — do not read that as "the directory
  is safe".
