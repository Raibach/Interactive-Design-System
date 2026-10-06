# THE BUILDER, HOSTED — the Next app as its own service (2026-10-04,
# wireframe-lab/HOST-THE-TOOLS.md).
#
# `next build` here, `next start -p 3223` at run — the same port the Mac's
# `npm run dev:local` uses, so the room's embed address is the same shape in both
# worlds. The engine it talks to is the VCAAS_BASE_URL environment variable: the
# Mac's copy points at localhost:4000, the hosted copy at the engine service's
# internal address (server-side only — the browser never dials the engine for API
# calls, it uses this app's own /api/vcaas proxy; only preview iframes reach the
# engine's public origin, and those URLs come from the engine itself).
#
# SINGLE STAGE, ON PURPOSE, FOR NOW: the build needs the dev dependencies (Next's
# TypeScript and Tailwind stacks) and the runtime needs the same tree honest and
# obvious. Slimming to a two-stage image is a later step with its own measurement,
# not a guess made the night hosting landed.

FROM node:24-slim

WORKDIR /app

# Dependencies first, for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# The app, whole.
COPY . .

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3223

CMD ["npx", "next", "start", "-p", "3223"]
