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

EXPOSE 5001

WORKDIR /app/backend

CMD python init_db.py && uvicorn main:app --host 0.0.0.0 --port ${PORT:-5001}
