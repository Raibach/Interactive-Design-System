# THE DEVELOPMENT WORKSPACE, HOSTED — the Raibach IDS Agent Canvas as its own service
# (2026-10-04, wireframe-lab/HOST-THE-TOOLS.md).
#
# ── SOVEREIGN AS OF 2026-10-04: NOTHING HERE IS FETCHED FROM OPENHANDS ────────────────────────
# Until today this image installed the tool from npm and pre-warmed two Python backends from
# PyPI at build time, so a build reached two of the vendor's registries before the service
# existed. That is gone. Every third-party piece now comes out of THIS REPOSITORY — the tool's
# own source, the two Python trees, and the pinned dependency fingerprints — and the build is
# made to FAIL rather than reach the network, so a silent fallback cannot creep back in.
#
# THE ONE THING THIS IMAGE STILL REACHES THE INTERNET FOR, said plainly: Debian's apt, the
# uv installer, and the one managed CPython uv installs just after it, because a base image
# needs a package manager, an interpreter runner, and an interpreter the tool's own source
# accepts. Everything after that line is repository material.
#
# node:24 IS NOT A PREFERENCE — the source's own engines field requires >=24.
FROM node:24-slim

# WHAT THE PATCH SCRIPT NEEDS: python3 (its HTML/JSON edits), perl (its `shasum` — the content
# hashes that name every patch file), plus git/curl/ca-certificates and procps.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 perl ca-certificates curl git procps \
    && rm -rf /var/lib/apt/lists/*

# uv — how the two Python halves are run. The same binary is on PATH for the build-time
# install and for runtime.
RUN curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh

# PYTHON 3.12, INSTALLED HERE ON PURPOSE — THE FIRST CLOUD BUILD'S SECOND TRAP (2026-10-04).
# Both vendored trees (and every package in the locks) require >=3.12 — measured in their own
# pyprojects — while Debian bookworm's python3 is 3.11, and that is the interpreter the first
# build's venv picked before it died on the lockfile two steps later. The locks were resolved
# against a 3.12 (the Mac's uv managed one), so a 3.11 venv is not merely slow — it is the
# wrong resolution. `uv python install` rides the same reach as the installer above and lands
# in the image, which is what lets the runtime's uvx/uv run builds (UV_OFFLINE=1) find an
# interpreter without fetching one.
RUN uv python install 3.12
ENV UV_PYTHON=3.12

# ── 1. THE TOOL ITSELF: THIS REPOSITORY'S COPY, BUILT HERE ────────────────────────────────────
# The source travels with the repository (development/OpenHands-main, 2,431 files) and is built
# in the image exactly as it builds on the Mac — same `npm ci`, same `npm run build`. The global
# install that follows puts it where the house patch expects to find it
# (`$(npm root -g)/@openhands/agent-canvas`), copied from the registry's layout on purpose: the
# patch script is unchanged and still works against the same paths.
COPY development/OpenHands-main /opt/agent-canvas
WORKDIR /opt/agent-canvas
RUN npm ci --no-audit --no-fund \
 && npm run build \
 && npm install -g .

# ── 2. THE PYTHON SIDE: THIS REPOSITORY'S TREES ───────────────────────────────────────────────
# Four packages (the SDK, the tools, the workspaces, the agent server) live in
# software-agent-sdk; the fifth (the automation backend) in automation/. Both are pointed at by
# the tool's own documented overrides — the vendor's guide calls OH_AGENT_SERVER_LOCAL_PATH
# "highest precedence" — so the launcher runs OUR files instead of resolving them from PyPI.
# The embedded .git folders were removed when these were vendored: left in, git records a folder
# like that as a pointer to another repository, and this image would have been built from two
# empty directories.
COPY development/vendor /opt/vendor
ENV OH_AGENT_SERVER_LOCAL_PATH=/opt/vendor/software-agent-sdk
ENV OH_AUTOMATION_LOCAL_PATH=/opt/vendor/automation

# ── 3. THE DEPENDENCIES, WARMED BY RUNNING WHAT THE RUNTIME RUNS ──────────────────────────────
# THREE SHAPES, ONE LESSON, all measured (development/CHANGELOG.md, 2026-10-04):
#   · the first cloud build installed `--require-hashes` compiles of the two trees' pyprojects —
#     and the compile carried this Mac's editable `-e file:///Users/…` paths, which the flag
#     refuses (exit 2, build `wanted-silver-6569`);
#   · the second installed UNIVERSAL compiles of the same pyprojects — right in form, but a
#     fresh compile resolves today's newest versions, and neither runtime half uses those: the
#     launcher builds the agent server with its own `posthog>=6,<7` constraint (dev-safe.mjs)
#     and runs automation from the tree's OWN uv.lock (`uv run --project`). The boot met
#     `posthog==7.62.1` in the cache where it needed 6.x, and `botocore==1.43.108` where the
#     tree's lock pins 1.42.93 — and under UV_OFFLINE=1 a missing wheel is a HARD boot error,
#     which is how both halves died in the same minute (build `steady-chess-6922`'s deploy);
#   · THIS shape warms the cache BY RUNNING THE RUNTIME'S OWN COMMANDS, once, with the network
#     still on: the exact uvx the launcher will run (leaving a tool environment it then finds
#     cached and reused) and the automation project's environment, materialized so the
#     runtime's `uv run --project` has nothing left to resolve at boot.
# The two lockfiles stay in the repository as the FINGERPRINTS of these graphs — read them,
# don't install them; they were never the runtime's writer.
RUN uvx --reinstall \
      --from /opt/vendor/software-agent-sdk/openhands-agent-server \
      --with-editable /opt/vendor/software-agent-sdk/openhands-sdk \
      --with-editable /opt/vendor/software-agent-sdk/openhands-tools \
      --with-editable /opt/vendor/software-agent-sdk/openhands-workspace \
      --with "posthog>=6,<7" \
      agent-server --help
RUN uv run --project /opt/vendor/automation true

# ── 4. AND NOTHING MAY REACH THE NETWORK AT RUNTIME ───────────────────────────────────────────
# UV_OFFLINE is the enforcement, not decoration: with it set, uv refuses to fetch anything, so a
# dependency this image failed to prepare becomes a LOUD error on the first boot rather than a
# quiet download from a registry that was supposed to be out of the picture. It is set for the
# service's whole life, not just the build.
ENV UV_OFFLINE=1

# THE AGENT SERVER'S VERSION — the fixed one, on purpose: at 1.49.6 the SDK's telemetry reads
# `usage.prompt_tokens_details.cache_creation_tokens` unguarded, and DeepSeek's
# OpenAI-compatible responses do not carry it — every run died with AttributeError. 1.51.0
# guards the read, and the vendored tree in /opt/vendor is that version.
ENV OH_AGENT_SERVER_VERSION=1.51.0

# THE HOUSE PATCH RIDES THE IMAGE: the script and the tile it needs come from the repo, and
# running it here is the same act as running it on the Mac after an install — palette, logo,
# wizard relabel, locale strings, and the assembly tile painted into the tool's own canvas.
# Idempotent by design; content-hashed file names, so no cache can hold an old look.
COPY development/openhands-patch.sh /src/development/openhands-patch.sh
COPY frontend/src/assets/canvas-development-lab-bkg.jpg /src/frontend/src/assets/canvas-development-lab-bkg.jpg
RUN bash /src/development/openhands-patch.sh --hosted

# ── THE IDENTITY — THE SDK'S OWN SOUL.md (owner, 2026-10-06/07) ──────────────────────────────
# The agent SDK reads SOUL.md from the persistence directory and, when present, it REPLACES the
# default identity in the system prompt — so the agent introduces itself as Raibach IDS, not the
# vendor's name. The launcher points the agent server at exactly this directory (dev-safe.mjs:
# "Parent of stateDir (= ~/.openhands) so settings/secrets match Docker"), and this image runs
# as root, so the file lives here. The Mac's copy is seeded by RESTART-LOCAL.sh §8c.
COPY development/agent-canvas/SOUL.md /root/.openhands/SOUL.md

# THE DOOR — local mode (the key is injected into the served page at startup, so no visitor is
# asked for anything) and the model seed. See the script's own header.
COPY development/agent-canvas/entrypoint.sh /usr/local/bin/house-entrypoint.sh
RUN chmod +x /usr/local/bin/house-entrypoint.sh

ENV PORT=8090
EXPOSE 8090
ENTRYPOINT ["/usr/local/bin/house-entrypoint.sh"]
