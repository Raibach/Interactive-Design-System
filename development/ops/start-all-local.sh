#!/bin/bash
# ═══ INSTALLED 2026-10-10 — active. launchd agent: com.raibach.stack (RunAtLoad). ═══════════
# start-all-local.sh — the ONE command that brings everything up from cold:
# colima, the langfuse stack, the backend, the site, the builder, and the
# Development workspace.
# 2026-10-12: the WordPress sites LEFT LOCAL — they are server-managed now and
# never updated here again; nothing WordPress is started, probed, or built on
# this machine. REVERT: re-add the 7th section + the holt/raibach probes if a
# local WP stack ever returns.
# 2026-10-15: two dead paths repaired — the builder lives at product/ now (the
# old wireframe-lab/ name was retired to match the Product tab) and the
# Development workspace entry is the OpenHands-main launcher (the old
# development/dev-tool package is gone). ALSO MEASURED that day: as a login
# agent (com.raibach.stack) this script CANNOT run — macOS refuses to execute
# scripts under ~/Documents for launchd jobs ("Operation not permitted"; the
# agent shows exit 126 in its boot log). Hand-run from a terminal works; the
# agent only ever works with a system-level consent (Full Disk Access) for its
# executor.
# REBOOT RECIPE: run this single script. The tunnel + keep-awake helpers are separate
# launchd agents (com.raibach.tunnel / com.raibach.awake) and return on their own.
# Each service gets its own log under ~/Library/Logs/raibach/.
#
# WHAT IT DELIBERATELY DOES NOT DO:
#   · the tunnel and keep-awake agents are ALREADY launchd agents (com.raibach.tunnel,
#     com.raibach.awake) — starting them here would duplicate them.
#   · it does not re-run openhands-patch.sh. On a reboot the installed build is already
#     patched; if the canvas package was ever reinstalled, run RESTART-LOCAL.sh once first.
#
# HOME: development/ops/start-all-local.sh (chmod +x, installed 2026-10-10)
# COMPANION:     development/ops/com.raibach.stack.plist (installed 2026-10-10)
set -u
ROOT=/Users/raibach/Documents/Raibach_IDS
LOGS=/Users/raibach/Library/Logs/raibach
# THE VENDORED NODE (2026-10-19, owner): run the engines off the repo's own copy —
# runtime/node (a full Node v24.9.0) — never the Mac's system node. It leads PATH, so
# every node/npm/npx here is the folder's own. runtime/uv (uv + uvx, the OpenHands
# automation runner) is vendored the same way beside it.
export PATH="$ROOT/runtime/bin:$ROOT/runtime/node/bin:$ROOT/runtime/uv/bin:/Users/raibach/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p "$LOGS"

echo '── 1/6 colima (the docker VM) ──'
if ! colima status >/dev/null 2>&1; then
  colima start
fi
colima status | head -3

echo '── 2/6 the langfuse stack ──'
(cd "$ROOT/governance/langfuse-main" && docker compose up -d) >> "$LOGS/langfuse-compose.log" 2>&1 \
  && echo 'langfuse stack up'

echo '── 3/6 studio backend (:8000) ──'
if ! lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
  # --reload (2026-10-15): backend edits load themselves — local changes appear instantly.
  (cd "$ROOT/backend" && nohup .venv/bin/python .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload < /dev/null >> "$LOGS/studio-backend.log" 2>&1 &)
fi

# < /dev/null on EVERY spawn below: a background child that keeps the launching terminal's TTY
# dies with `read EIO` when that terminal closes — vite did, twice (2026-10-11), killing the site;
# the login run has no terminal to hold, but a hand-run does. Detach it at the spawn.
echo '── 4/6 the site (:5001) ──'
if ! lsof -nP -iTCP:5001 -sTCP:LISTEN >/dev/null 2>&1; then
  (cd "$ROOT/frontend" && nohup node node_modules/.bin/vite --port 5001 --strictPort < /dev/null >> "$LOGS/studio-site.log" 2>&1 &)
fi

echo '── 5/6 the builder (:3223 + its engine :4000) ──'
if ! lsof -nP -iTCP:3223 -sTCP:LISTEN >/dev/null 2>&1; then
  nohup bash "$ROOT/product/ai-app-builder-open/run-dev-local.sh" < /dev/null >> "$LOGS/builder.log" 2>&1 &
fi

echo '── 6/6 the Development workspace (:8090, under the /dev section) ──'
if ! lsof -nP -iTCP:8090 -sTCP:LISTEN >/dev/null 2>&1; then
  (cd "$ROOT" && \
    VITE_BASE_PATH=/dev \
    OH_WEB_URL=http://localhost:5001/dev \
    AUTOMATION_BASE_URL=http://localhost:5001/dev \
    OH_AGENT_SERVER_LOCAL_PATH="$ROOT/development/vendor/software-agent-sdk" \
    OH_AUTOMATION_LOCAL_PATH="$ROOT/development/vendor/automation" \
    OH_TELEMETRY_CONSENT=deny \
    AGENT_CANVAS_DISABLE_TELEMETRY=1 \
    nohup node "$ROOT/development/OpenHands-main/bin/agent-canvas.mjs" -p 8090 < /dev/null >> "$LOGS/dev-workspace.log" 2>&1 &)
fi

echo '── done. Probing every seat (up to ~40s per door while containers finish booting) ──'
probe() {
  label="$1"; url="$2"; code=000
  for i in 1 2 3 4 5 6 7 8; do
    code=$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$url")
    [ "$code" = "200" ] && break
    sleep 5
  done
  echo "  $label -> $code"
}
probe 'studio   :5001' http://localhost:5001/api/config
probe 'backend  :8000' http://localhost:8000/api/health
probe 'builder  :4000' http://localhost:4000/health
probe 'builder   door' http://localhost:5001/builder
probe 'workspace door' http://localhost:5001/dev/
probe 'governance door' http://localhost:5001/governance/

