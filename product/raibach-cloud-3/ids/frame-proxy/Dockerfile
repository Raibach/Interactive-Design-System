# Raibach frame-proxy — BOX variant (raibach-cloud-3).
#
# Same trust boundary as the hosted twin (product/langfuse-frame-proxy):
# drops langfuse's frame-blocking headers, re-issues a CSP that allows framing
# ONLY from the studio origin, injects the pre-minted admin session cookie plus
# the house-ground styling and location reporter.
#
# THIS variant serves the one-door shape: langfuse-web is BUILT with
# NEXT_PUBLIC_BASE_PATH=/governance, so requests arrive here already carrying
# the /governance prefix and pass through verbatim.
#
# The official nginx image entrypoint substitutes ${RAIBACH_SESSION_COOKIE},
# ${STUDIO_ORIGIN} and ${LANGFUSE_WEB_UPSTREAM} at boot. Missing values make
# nginx fail loudly — never silently.
FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
