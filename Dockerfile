# Multi-stage production image: frontend is compiled inside the build stage,
# so no build artifacts need to be committed to the repository.
FROM node:20-alpine AS frontend-build

WORKDIR /build

# Install exact dependency tree first for layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Vite reads .env.production (public Sentry DSN) during this step.
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
COPY --from=frontend-build /build/dist ./frontend/dist

# Frontend source (A2UI component catalog required by backend at runtime)
COPY frontend/src ./frontend/src

EXPOSE 5001

WORKDIR /app/backend

CMD python init_db.py && uvicorn main:app --host 0.0.0.0 --port ${PORT:-5001}
