# Raibach frame-proxy — fronts the hosted Langfuse so the studio's Governance
# room can embed it.
#
# Why: the stock Langfuse image refuses framing (`frame-ancestors 'none'` +
# `X-Frame-Options: SAMEORIGIN`). This nginx drops both, re-issues a CSP that
# allows framing ONLY from the studio origin, injects the house-ground styling
# and the location reporter, and presents a pre-minted session cookie so the
# room never shows a login. It is the hosted twin of the local proxy at
# governance/langfuse-main/nginx-frame-proxy.conf (gitignored; this folder is
# the committed copy).
#
# VALUES STAY ON THE SERVICE (the config rule): RAIBACH_SESSION_COOKIE and
# STUDIO_ORIGIN arrive as runtime env vars on the Northflank service; the
# official nginx image entrypoint substitutes them into the template at boot.
# If a value is missing, nginx fails loudly on boot — never silently.
FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
