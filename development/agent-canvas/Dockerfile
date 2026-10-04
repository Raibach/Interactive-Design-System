# THE DEVELOPMENT WORKSPACE, HOSTED — OpenHands' Agent Canvas as its own service
# (2026-10-04, wireframe-lab/HOST-THE-TOOLS.md).
#
# The same package the Mac runs (`agent-canvas -p 8090`), built the same way: a global
# npm install, THE HOUSE PATCH APPLIED WHERE THE PACKAGE ACTUALLY LIVES (the patch script
# is the single home of that work, exactly as on the Mac), and the ingress on 8090.
#
# node:24 IS NOT A PREFERENCE — the package's own engines field requires >=24 (the plan
# said node:20 before the package was read; 24 is what it asks for).
FROM node:24-slim

# WHAT THE PATCH SCRIPT NEEDS, INSTALLED BECAUSE THE IMAGE IS ITS HOST: python3 (its
# HTML/JSON edits), perl (its `shasum` — the content hashes that name every patch file),
# plus git/curl/ca-certificates for npm's own fetches.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 perl ca-certificates curl git procps \
    && rm -rf /var/lib/apt/lists/*

# uv — the agent server and the automation backend are Python, run from PyPI by `uvx`
# (the launcher's own mechanism, not a choice made here). Installed to /usr/local/bin so
# the same binary is on PATH for the build-time pre-warm and for runtime.
RUN curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh

# THE TOOL, PINNED — the version the Mac runs and the patch was written against.
RUN npm install -g @openhands/agent-canvas@1.24.0

# THE HOUSE PATCH RIDES THE IMAGE: the script and the tile it needs come from the repo
# (the script's single home), and running it here is the same act as running it on the Mac
# after an install — palette, logo, wizard relabel, locale strings, and the assembly tile
# painted into the tool's own canvas. Idempotent by design; content-hashed file names, so
# no cache can hold an old look.
COPY development/openhands-patch.sh /src/development/openhands-patch.sh
COPY frontend/src/assets/canvas-development-lab-bkg.png /src/frontend/src/assets/canvas-development-lab-bkg.png
RUN bash /src/development/openhands-patch.sh

# THE AGENT SERVER'S VERSION — THE FIXED ONE, ON PURPOSE (see the entrypoint's header for
# the full story): at 1.49.6 the SDK's telemetry reads
# `usage.prompt_tokens_details.cache_creation_tokens` unguarded, and DeepSeek's
# OpenAI-compatible responses do not carry it — every run died with AttributeError.
# 1.51.0 guards the read. The launcher pins sdk/tools/workspace to this same number.
ENV OH_AGENT_SERVER_VERSION=1.51.0

# PRE-WARM uv's CACHE (a Python interpreter + both backends) so a cold container boots
# without a minute of downloads. These are the launcher's own invocations, run exactly the
# way it will run them — a build-time hiccup here costs only the warm cache, so it must
# not fail the image.
RUN uvx --from openhands-agent-server==$OH_AGENT_SERVER_VERSION python -V || echo "⚠️ agent-server pre-warm skipped"
RUN uvx --from openhands-automation==1.15.1 python -V || echo "⚠️ automation pre-warm skipped"

# THE DOOR — public mode (the owner's decision: pin-holders may drive the agent; the key
# is typed once per browser) and the model seed. See the script's own header.
COPY development/agent-canvas/entrypoint.sh /usr/local/bin/house-entrypoint.sh
RUN chmod +x /usr/local/bin/house-entrypoint.sh

ENV PORT=8090
EXPOSE 8090
ENTRYPOINT ["/usr/local/bin/house-entrypoint.sh"]
