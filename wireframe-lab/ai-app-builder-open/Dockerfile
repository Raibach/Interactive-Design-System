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

# THE BUILD-ARGUMENT WIRE (2026-10-09): VCAAS_BASE_URL is set as a build argument on
# the Northflank service (the hosted engine's address, http://builder-engine:4000/...)
# because `next build` evaluates the /api routes — and src/lib/vcaas-server.ts
# REFUSES at load when the value is missing (network lockdown, 2026-10-07). Northflank
# passes build arguments as Docker build args, which a Dockerfile only receives when
# declared — and npm only sees them as environment variables — so this pair is the
# WIRE, not a value: the value stays on the service. See "THE CONFIG RULE" in
# wireframe-lab/HOST-THE-TOOLS.md. At run time the service's runtime env overrides the
# baked default; a build without the argument fails loudly at the guard, as designed.
ARG VCAAS_BASE_URL
ENV VCAAS_BASE_URL=${VCAAS_BASE_URL}

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3223

CMD ["npx", "next", "start", "-p", "3223"]
