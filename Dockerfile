# Multi-stage production image: frontend is compiled inside the build stage,
# so no build artifacts need to be committed to the repository.
FROM node:20-alpine AS frontend-build

# The gate is not a lint pass over the frontend: `npm run build` ends in
# `npm run catalog:check`, and that checker reads the REPOSITORY. Its root is two
# levels above frontend/scripts/, so it opens README.md, READ-ME/IMPLEMENTATION_CONFORMANCE.md
# and OPEN-ITEMS.md, and it shells out to git to prove the register is TRACKED.
#
# This stage used to hold frontend/ only. Its root therefore resolved to `/`, all
# three reads missed, and doc-claim-drift plus open-items-register (both blocking)
# failed every build from 2026-09-12 on: production kept serving the previous day's
# image while each push died here in ~35 seconds. The whole repository is copied to
# /repo instead, and git comes along — which is also what vite needs to stamp the
# release hash (`git rev-parse`; without git the build says "unknown").
RUN apk add --no-cache git

WORKDIR /repo/frontend

# Install exact dependency tree first for layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# The repository, so the checker's reads resolve: its root is /repo from here.
WORKDIR /repo
COPY . .

# Vite reads .env.production (public Sentry DSN) during this step.
WORKDIR /repo/frontend
RUN npm run build && npx tsx scripts/generate-manifest.mjs


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

# Built frontend + generated manifest.json
COPY --from=frontend-build /repo/frontend/dist ./frontend/dist

# Frontend source (A2UI component catalog required by backend at runtime)
COPY frontend/src ./frontend/src

# The catalog check's reports, taken from the run that gated this very build — not
# from the repository, where they would be as old as the last commit. GET
# /api/catalog/audit reads these and 503s when one is missing — deliberately, so
# "the checker never ran" can never be mistaken for "no findings".
COPY --from=frontend-build /repo/frontend/catalog-audit ./frontend/catalog-audit

EXPOSE 5001

WORKDIR /app/backend

CMD python init_db.py && uvicorn main:app --host 0.0.0.0 --port ${PORT:-5001}
