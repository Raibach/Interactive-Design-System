# THE ENGINE, HOSTED — the Product room's builder engine as its own service
# (2026-10-04, wireframe-lab/HOST-THE-TOOLS.md).
#
# The same server.mjs the Mac runs (`npm run dev:local`), with no changes to how it
# starts: one process, one port, and the projects store under `data/` — which the
# service mounts as a volume so a redeploy does not throw the projects away.
#
# ONE PLACE THE TWO COPIES DIFFER, AND IT IS CONFIGURATION: the hosted copy runs with
# PUBLIC_BASE_URL set (the service's public origin), which is what makes the UI's
# preview URLs `<PUBLIC_BASE_URL>/preview/<id>/` instead of `<id>.localhost:4000` and
# what arms the run budget on the two token-spending endpoints. Unset — the Mac —
# both of those are exactly what they always were.

FROM node:24-slim

WORKDIR /app/local-vcaas

# No dependencies to install: server.mjs speaks node:http and the node: standard
# library, nothing else. The assets ride along because an empty project's splash
# lives on the preview's own origin.
COPY local-vcaas/server.mjs ./
COPY local-vcaas/assets ./assets

# The store's two folders. The projects themselves are born at runtime; the volume
# mounts over `data/`.
RUN mkdir -p data/projects data/apps

ENV PORT=4000
EXPOSE 4000

CMD ["node", "server.mjs"]
