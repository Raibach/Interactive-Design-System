#!/bin/bash
# supervise-all.sh — THE LOCAL SERVER SUPERVISOR (2026-10-19, owner: the Mac is a
# server and the stack must run like one — nothing may die with a terminal close or a
# program close).
#
# One detached loop keeps every engine up: it checks each port (plus the ngrok tunnel) and
# starts whatever is down, so closing a terminal or quitting a program never takes the stack
# with it. Each start is the same nohup-detached form start-all-local.sh uses.
#
# START FORMS (2026-10-20 — launchd is now the primary form; Full Disk Access granted to
# /bin/bash so a launchd job can read ~/Documents):
#   launchd (auto-start at login + keep alive): com.raibach.ids-supervisor
#     install: cp development/ops/com.raibach.ids-supervisor.plist ~/Library/LaunchAgents/
#     load:    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.raibach.ids-supervisor.plist
#     stop:    launchctl bootout gui/$(id -u)/com.raibach.ids-supervisor
#   manual one-shot (macOS has no setsid; nohup + </dev/null is the detach):
#     nohup bash development/ops/supervise-all.sh < /dev/null >> ~/Library/Logs/raibach/supervisor.log 2>&1 &
#     stop: pkill -f supervise-all.sh
#
# The builder pair is restarted only when BOTH of its ports are free (an orphan holding
# one port means a live pair still stands — a duplicate start would fail EADDRINUSE).
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PATH="$ROOT/runtime/bin:$ROOT/runtime/node/bin:$ROOT/runtime/uv/bin:/Users/raibach/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin"
LOGS=/Users/raibach/Library/Logs/raibach
mkdir -p "$LOGS"

alive() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# A slow-booting engine (the dev room runs `uvx --reinstall`, the builder runs Next)
# takes longer than one check to bind its port. Starting it again before it binds is the
# old thrash — so each engine carries a cooldown between start attempts. 120s is longer
# than the slowest boot; a genuinely dead engine is started again after that.
# (Plain variables, not `declare -A` — macOS /bin/bash is 3.2 and has no associative arrays.)
COOLDOWN=120
last_backend=0
last_site=0
last_builder=0
last_devroom=0
last_ngrok=0
now() { date +%s; }

while true; do
  if ! alive 8000 && (( $(now) - last_backend >= COOLDOWN )); then
    last_backend=$(now)
    echo "[supervisor] $(date '+%H:%M:%S') backend :8000 down — starting"
    (cd "$ROOT/backend" && nohup .venv/bin/python .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload < /dev/null >> "$LOGS/studio-backend.log" 2>&1 &)
  fi
  if ! alive 5001 && (( $(now) - last_site >= COOLDOWN )); then
    last_site=$(now)
    echo "[supervisor] $(date '+%H:%M:%S') site :5001 down — starting"
    (cd "$ROOT/frontend" && nohup node node_modules/.bin/vite --port 5001 --strictPort < /dev/null >> "$LOGS/studio-site.log" 2>&1 &)
  fi
  if ! alive 3223 && ! alive 4000 && (( $(now) - last_builder >= COOLDOWN )); then
    last_builder=$(now)
    echo "[supervisor] $(date '+%H:%M:%S') builder pair :3223/:4000 down — starting"
    nohup bash "$ROOT/product/ai-app-builder-open/run-dev-local.sh" < /dev/null >> "$LOGS/builder.log" 2>&1 &
  fi
  if ! alive 8090 && (( $(now) - last_devroom >= COOLDOWN )); then
    last_devroom=$(now)
    echo "[supervisor] $(date '+%H:%M:%S') dev room :8090 down — starting"
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
  # THE PREVIEW ON :4173 IS NOT STARTED (removed 2026-10-22).
  #
  # It served the built `dist/` so the tunnel could avoid the dev server's module count, and it
  # was a trap: `dist/` is replaced on every build, so a browser tab still holding the previous
  # page asks for hashed chunk files that no longer exist. The dev server answers that with the
  # SPA's index.html — a 200 containing HTML where a script was expected — and React fails with
  # "Failed to fetch dynamically imported module". That is the crash that took all three tabs
  # down, and it is a property of serving a build, not of the code.
  #
  # The tunnel points at :5001 (source) now, which cannot go stale that way: there are no hashed
  # filenames to disappear. Nothing else used :4173, so there is nothing left to supervise.
  if ! pgrep -f "ngrok start" >/dev/null 2>&1 && (( $(now) - last_ngrok >= COOLDOWN )); then
    last_ngrok=$(now)
    echo "[supervisor] $(date '+%H:%M:%S') ngrok tunnel down — starting"
    nohup /opt/homebrew/bin/ngrok start --config "/Users/raibach/Library/Application Support/ngrok/ngrok.yml" --config "$ROOT/runtime/ngrok-endpoints.yml" studio < /dev/null >> "$LOGS/ngrok.log" 2>&1 &
  fi
  sleep 15
done
