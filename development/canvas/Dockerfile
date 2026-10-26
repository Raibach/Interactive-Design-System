# syntax=docker/dockerfile:1.7
# ═══════════════════════════════════════════════════════════════════════════════
# Development canvas — the Development room's tool, containerized for the box.
#
# Four services in one image, behind one port (see entrypoint.sh):
#   ingress (8090) → static frontend (/dev) + agent-server (/dev/api, /dev/sockets)
#                    + automation (/dev/api/automation) + vscode route (/dev/vscode)
#
# Build context: the `development/` directory. Dependency pins are FROZEN from
# the live local stack (canvas/requirements-*.txt) — nothing resolves loose at
# build time. python:3.12 matches the local venvs exactly. The SDK and
# automation are the vendored sources, installed editable, as on the Mac.
# ═══════════════════════════════════════════════════════════════════════════════

FROM node:24-slim AS frontend-deps
# Exactly the two externals the frontend scripts import (verified by grep over
# all four .mjs files): sirv@3 (static) + httpxy@0.5.5 (proxy-utils). Versions
# match the local package.json; the whole node_modules tree ships so transitive
# deps travel automatically.
RUN mkdir -p /deps && cd /deps \
 && npm install --no-audit --no-fund --no-save --loglevel=error \
      --prefix /deps sirv@3.0.2 httpxy@0.5.5 \
 && ls /deps/node_modules

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON=3.12

# git: agent workspace operations. curl: container healthcheck.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv==0.11.3

COPY canvas/requirements-agent.txt /root/requirements-agent.txt
COPY canvas/requirements-automation.txt /root/requirements-automation.txt

COPY vendor/software-agent-sdk /app/sdk
COPY vendor/automation /app/automation
COPY OpenHands-main/tools/canvas_ui_tool.py /app/canvas-tools/

WORKDIR /app
ENV HOME=/root
RUN mkdir -p /root/.openhands

# --no-sources: install from PyPI ONLY. The SDK's pyproject declares uv sources
# that would otherwise try to fetch the workspace packages themselves; the
# editable installs below replace them instead.
RUN uv venv /app/venv --python 3.12 \
 && . /app/venv/bin/activate \
 && uv pip install --no-cache --no-sources -r /root/requirements-agent.txt \
 && uv pip install --no-cache --no-deps -e /app/sdk/openhands-sdk -e /app/sdk/openhands-tools -e /app/sdk/openhands-workspace -e /app/sdk/openhands-agent-server

# Chromium — a REAL requirement of this image, fixed at the source 2026-10-14.
# The agent's boot-time tool preload instantiates BrowserToolExecutor, which
# hard-fails when no Chromium binary exists (before this: every boot logged
# "Tool preload service failed to start - skipping", and the browser tool
# answered with install instructions instead of browsing). Debian's chromium
# lands at /usr/bin/chromium — the first path the executor's
# check_chromium_available() scans. Fonts ride along because the slim base
# ships none — Latin (liberation/dejavu), CJK (noto-cjk) and emoji
# (noto-color-emoji), so pages render legibly in screenshots (the first real
# screenshot showed Chinese text as tofu boxes — seen, and fixed in this same
# pass rather than left as a limitation). Running as root, the vendor code
# disables Chromium's sandbox and logs its security note at boot — that is
# the vendor's designed in-container behavior.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation fonts-dejavu-core \
      fonts-noto-cjk fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

# The automation venv carries the same four openhands pieces as the Mac's:
#   sdk + workspace (editable, from the vendored source) + agent-server 1.19.1
#   (from the freeze — the public package the workspace depends on) + automation
#   itself. Verified against the live venv's dist-info set.
RUN uv venv /app/automation/.venv --python 3.12 \
 && . /app/automation/.venv/bin/activate \
 && uv pip install --no-cache --no-sources -r /root/requirements-automation.txt \
 && uv pip install --no-cache --no-deps -e /app/automation -e /app/sdk/openhands-sdk -e /app/sdk/openhands-workspace

COPY OpenHands-main/scripts /app/frontend/scripts
COPY OpenHands-main/build /app/frontend/build
# node: the frontend + ingress are .mjs scripts run by the Node runtime —
# python:3.12-slim has none, so the runtime binary travels from the node stage
# (same glibc Debian base; proven by the container smoke test).
COPY --from=frontend-deps /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend-deps /deps/node_modules /app/frontend/node_modules

COPY canvas/requirements-agent.txt /root/requirements-agent.txt
COPY canvas/requirements-automation.txt /root/requirements-automation.txt

COPY canvas/entrypoint.sh /app/entrypoint.sh
COPY canvas/log.sh /app/log.sh
RUN chmod +x /app/entrypoint.sh /app/log.sh

EXPOSE 8090
HEALTHCHECK --interval=20s --timeout=4s --start-period=150s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8090/dev/server_info || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]
