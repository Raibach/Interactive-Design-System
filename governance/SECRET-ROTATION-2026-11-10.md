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

These are the two services of the hosted Langfuse stack, project `semantic-design-system`:

- UI: `https://ui--langfuse-web--mgtvxtd7xr2v.code.run`
- Postgres: `primary.langfuse-postgres--mgtvxtd7xr2v.addon.code.run:5432`

**The stack is retired.** Northflank is no longer used, and both hostnames had stopped resolving
before the alert arrived. Every value below is dead: there is no live target to rotate.

## What leaked

Eleven values, every one of them live at the time of publication:

| Value | Was used for |
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
the project that the leaked secret key unlocked.

None of these may be reused. `governance/langfuse-hosted.env` keeps them only as a record of what
was burned, and `*.env` keeps that file out of git. If a Langfuse stack is ever stood up again it
gets new credentials from scratch.

## 1. What the repository now publishes

- **`main` is redacted.** Commit `d92f9a0f` — *The Langfuse service snapshots lose their secrets…* —
  replaced all eleven values with `"REDACTED"` and added this record. The deployment facts (image,
  ports, resource plan, environment key names) are preserved; the credentials are not.
- **Secret scanning and push protection are enabled** on the repository as of 2026-11-10, so the
  next `DATABASE_URL` is refused at push time instead of being caught two weeks later. Enabling it
  surfaced two older alerts for Stripe webhook signing secrets in vendored test and Storybook files;
  both were resolved as `used_in_tests`.
- **History is deliberately untouched** (owner decision, 2026-11-10). Every commit before `d92f9a0f`
  still carries the original blobs, so the public history keeps the values one click away. That is
  accepted because the values are dead. The cost is that secret scanners will keep reporting this
  repository until the alerts are closed as revoked.
- `scripts/purge-langfuse-secrets.sh` is the rewrite path if that decision ever changes. It works
  on a throwaway mirror clone, verifies the result before pushing, and force-pushes every ref.
  Read it before running it: afterwards every clone is stale and must be re-cloned.

## 2. Answering the scanners

- **GitGuardian** — mark the incident *revoked* (the service it belonged to no longer exists), not
  *resolved by rotation*. Reference this file in the comment.
- Expect the same two blobs to be classified more than once. GitGuardian reads them as a database
  assignment, an encryption key, a salt, a next-auth secret, API keys and passwords; those are one
  incident with several labels, not several incidents.
- **GitHub** — if alerts appear against the historical blobs `0315b397…` or `c3000be9…`, resolve
  them as revoked and point at this file. Do not delete the alert thread; the record is what makes
  the next alert intelligible.
- Do not reopen the finding by pasting a real value into a comment, an issue, or a commit message.

## 3. Why it happened, and what stops the repeat

- The snapshots came from a `northflank` service dump, which carries the complete environment. The
  environment was captured with the values because nothing stripped them at capture time.
- `governance/` is tracked. Only `*.env` inside it is ignored — do not read that as "the directory
  is safe". The old comment in `langfuse-hosted.env` said the directory was ignored, which is how
  these files ended up committed in the first place.
- `scripts/secret-scan.mjs` scans tracked files, and with `--history` every blob in every commit.
  Run it before a push that touches `governance/` or captures a service definition.
