# Multi-stage production image: frontend is compiled inside the build stage,
# so no build artifacts need to be committed to the repository.
FROM node:20-alpine AS frontend-build

# git is what vite reads to stamp the release hash (`git rev-parse`); without it
# the build says "unknown".
RUN apk add --no-cache git

WORKDIR /repo/frontend

# Install exact dependency tree first for layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

WORKDIR /repo
COPY . .

# Vite reads .env.production (public Sentry DSN) during this step.
WORKDIR /repo/frontend
RUN npm run build

# ── THE AUDIT REPORT, GENERATED WHERE THE CODE THAT PRODUCES IT IS (2026-10-01) ──────────────
# The runtime image receives `frontend/dist` and `frontend/src` and nothing else, and the report
# lives in `frontend/catalog-audit/` — which is gitignored, so it is not in a clone's build context
# either. Production therefore answered every `GET /api/catalog/audit/…` with a loud 503 while the
# same call returned 200 locally, where the file happened to exist on a developer's disk. Measured
# before this step existed: HTTP 503, `expected_at /app/frontend/catalog-audit/prompt-composer.json`,
# and the shell drew "Whether anything uses a component could not be read".
#
# A REPORT IS DERIVED DATA — computed from the catalogue and the sources in this very checkout — so
# it is generated here, in the stage that has both, and copied in. That is this repository's own
# rule: §9 of THE_PACKAGE_CONTRACT forbids "a report file a build can delete, when the same report
# is a row", and until the report IS a row the image must build it.
#
# NO `|| true`, AND NO SILENT FALLBACK. The checker exits 0 whatever its findings say — its own
# comment is explicit that `level: 'blocking'` is a SEVERITY and not a veto — and it exits non-zero
# ONLY when the check could not run, in which case it writes no report. Letting that fail the build
# is the point: an image whose audit could not be produced must not ship looking clean.
#
# IT COVERS ONE PIPELINE: the checker's `CATALOG_NAME` is `prompt-composer`, so this produces one
# report and the other three pipelines the shell offers still answer CATALOG_AUDIT_UNAVAILABLE.
# That is a real gap and it is now said in the 503's own remedy rather than blamed on a checker
# that does not exist.
RUN node scripts/catalog-check.mjs


FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Backend dependencies, then code
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/

# config.py was moved to the repo root (from backend/config.py); the backend's
# imports (`from config import ...`) resolve against /app, so it must ride along.
COPY config.py ./

# Built frontend + generated manifest.json
COPY --from=frontend-build /repo/frontend/dist ./frontend/dist

# Frontend source (A2UI component catalog required by backend at runtime)
COPY frontend/src ./frontend/src

# The audit report the build stage produced (see the note there). The backend reads it from
# `/app/frontend/catalog-audit/<pipeline>.json` — the exact path its 503 names when it is missing.
COPY --from=frontend-build /repo/frontend/catalog-audit ./frontend/catalog-audit

EXPOSE 5001

WORKDIR /app/backend

CMD python init_db.py && uvicorn main:app --host 0.0.0.0 --port ${PORT:-5001}
