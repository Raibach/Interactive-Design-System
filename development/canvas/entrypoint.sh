#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Development canvas — container entrypoint.
#
# Starts FOUR processes and supervises them; any one of them dying takes the
# container down (restart policy surfaces the failure — never a silent partial).
#   1. agent-server  127.0.0.1:18000   (venv /app/venv, vendored SDK editable)
#   2. automation    127.0.0.1:18001   (venv /app/automation/.venv)
#   3. frontend      127.0.0.1:3001    (static-server.mjs, base path /dev)
#   4. ingress       0.0.0.0:8090      (the one published port)
#
# The session key: read from $OH_CANVAS_STATE_DIR/session-key.txt when present
# (generate it once to keep it stable across restarts), otherwise $CANVAS_SESSION_KEY,
# otherwise auto-generated AND PERSISTED here. It is injected into the served
# HTML (--allow-lan-session-key: this listener is reachable only on the private
# compose network, which is what that flag's contract requires) — the visitor
# is never asked for a key.
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail

APP=/app
FRONTEND=http://127.0.0.1:3001
AGENT=http://127.0.0.1:18000
AUTOMATION=http://127.0.0.1:18001
VSCODE=http://127.0.0.1:19000
# Where the box's deployment state lives (settings.json rides here from the
# deploy — the same file the Mac runs, sealed with OH_SECRET_KEY).
STATE="$HOME/.openhands"
KEY_FILE="$STATE/agent-canvas/session-key.txt"
# The room's public address — the agent-server derives its route prefix from
# this path (api.py `_get_root_path`, web_url.path = "/dev"), which is what
# makes EVERY route answer under /dev/*. Overridable via compose env.
PUBLIC_URL="${OH_WEB_URL:-https://design.system.raibach.net/dev}"

mkdir -p "$STATE/agent-canvas/storage" "$STATE/agent-canvas/dev_conversations" \
         "$STATE/agent-canvas/workspaces" "$STATE/agent-canvas/bash_events" \
         "$STATE/agent-canvas/tmux" "$STATE/agent-canvas/logs" \
         "$STATE/automation"

if [ -s "$KEY_FILE" ]; then
  KEY="$(tr -d '\n' < "$KEY_FILE")"
elif [ -n "${CANVAS_SESSION_KEY:-}" ]; then
  KEY="$CANVAS_SESSION_KEY"
  printf '%s\n' "$KEY" > "$KEY_FILE"
else
  KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  printf '%s\n' "$KEY" > "$KEY_FILE"
fi

# ~/.openhands may be a bind-mounted volume owned by the image's root; the
# services run as root here (same as the local launcher runs as the user).
echo "$KEY" > "$STATE/agent-canvas/api-key.txt"

log() { printf '[canvas] %s\n' "$*"; }

# Same JSON the local launcher injects — describes internal services to the frontend.
read -r -d '' SERVICES_JSON <<'JSON'
{"mode":"agent-canvas","agent_host_alias":"localhost","services":{"agent_server":{"description":"The agent server this canvas runs on.","url_from_agent":"http://localhost:18000"},"ingress":{"description":"Unified entry point.","url_from_agent":"http://localhost:8090"},"frontend":{"kind":"static","description":"The canvas build.","url_from_agent":"http://localhost:3001"},"automation":{"description":"OpenHands Automations service. All routes are mounted under /api/automation. Authenticate with header X-Session-API-Key: $OPENHANDS_AUTOMATION_API_KEY.","url_from_agent":"http://localhost:18001","api_prefix":"/api/automation"}}}
JSON
export SERVICES_JSON

# Session key seeded into agent-server secrets: automation jobs authenticate with it.
# ── Environment: mirrored 1:1 from the live local stack (measured there, not
# guessed). Every value below came from the working Mac processes; divergences
# are marked. ──────────────────────────────────────────────────────────────────
export OH_SESSION_API_KEYS_0="$KEY"
export OPENHANDS_AUTOMATION_API_KEY="$KEY"
export AUTOMATION_KV_SECRET="$KEY"
export AUTOMATION_AGENT_SERVER_API_KEY="$KEY"
export AUTOMATION_LOCAL_API_KEY="$KEY"

export AUTOMATION_AGENT_SERVER_URL="$AGENT"
export AGENT_SERVER_URL="$AGENT"
export AUTOMATION_BASE_URL="$PUBLIC_URL"
export AUTOMATION_CORS_ORIGINS="http://127.0.0.1:8090,http://localhost:8090,http://127.0.0.1:3001,http://localhost:3001,https://design.system.raibach.net"
export AUTOMATION_DB_URL="sqlite+aiosqlite:///$STATE/automation/automations.db"
export FILE_STORE=local
export LOCAL_STORAGE_PATH="$STATE/agent-canvas/storage"
export AUTOMATION_WORKSPACE_BASE="$STATE/agent-canvas/workspaces"

export OH_CANVAS_SAFE_STATE_DIR="$STATE/agent-canvas"
export OH_PERSISTENCE_DIR="$STATE"
export OH_CONVERSATIONS_PATH="$STATE/agent-canvas/dev_conversations"
export OH_BASH_EVENTS_DIR="$STATE/agent-canvas/bash_events"
export OH_EXTRA_PYTHON_PATH="$APP/canvas-tools"
export OH_WEB_URL="$PUBLIC_URL"
export OH_VSCODE_PORT=19000
export OH_VSCODE_BASE_PATH=/vscode
export OH_TELEMETRY_CONSENT=deny
export AGENT_CANVAS_DISABLE_TELEMETRY=1
export OPENHANDS_REMOTE_WS_READY_REQUIRED=false
export OPENHANDS_SUPPRESS_BANNER=1
export TMUX_TMPDIR="$STATE/agent-canvas/tmux"
export VITE_BASE_PATH=/dev
export PYTHONPATH="$APP/canvas-tools"

on_term() {
  trap - TERM INT EXIT
  log "stopping"
  kill 0 2>/dev/null
  wait 2>/dev/null
}
trap on_term TERM INT

# ── 1. agent-server ──────────────────────────────────────────────────────────
# The session key travels via OH_SESSION_API_KEYS_0 (exported above) — the
# server has no key CLI flag; its config reads that variable by contract.
# The script name is exactly `agent-server` (openhands-agent-server's
# pyproject [project.scripts]); there is no `openhands-agent-server` binary.
log "starting agent-server on 127.0.0.1:18000"
"$APP/venv/bin/agent-server" \
  --host 127.0.0.1 --port 18000 \
  --import-modules canvas_ui_tool \
  > >(sed -u 's/^/[agent]  /') 2>&1 &
P_AGENT=$!

# ── 2. automation ────────────────────────────────────────────────────────────
log "starting automation on 127.0.0.1:18001"
"$APP/automation/.venv/bin/uvicorn" openhands.automation.app:app \
  --host 127.0.0.1 --port 18001 \
  > >(sed -u 's/^/[auto]   /') 2>&1 &
P_AUTO=$!

# ── 3. frontend (static + SPA, base /dev) ────────────────────────────────────
log "starting frontend on 127.0.0.1:3001 (base /dev)"
node "$APP/frontend/scripts/static-server.mjs" \
  --dir "$APP/frontend/build" \
  --port 3001 --host 127.0.0.1 \
  --base-path /dev \
  --session-api-key "$KEY" --allow-lan-session-key \
  --route "/dev/api/automation=$AUTOMATION" \
  --route "/dev/api=$AGENT" \
  --route "/dev/sockets=$AGENT" \
  --route "/dev/server_info=$AGENT" \
  --route "/dev/health=$AGENT" \
  --route "/dev/ready=$AGENT" \
  --route "/dev/alive=$AGENT" \
  --route "/dev/docs=$AGENT" \
  --route "/dev/redoc=$AGENT" \
  --route "/dev/openapi.json=$AGENT" \
  --route "/dev/vscode=$VSCODE" \
  --vscode-base-path /dev/vscode \
  --no-referrer-prefix /dev/vscode \
  --runtime-services-info "$SERVICES_JSON" \
  > >(sed -u 's/^/[web]    /') 2>&1 &
P_WEB=$!

# ── 4. ingress (the published door) ──────────────────────────────────────────
# Off-loopback: sibling containers enter here. No LAN-flag here — the local
# launcher passes --allow-lan-session-key only to the static server; the
# ingress forwards the response (the key rides in the proxied HTML) untouched.
log "starting ingress on 0.0.0.0:8090"
node "$APP/frontend/scripts/ingress.mjs" \
  --host 0.0.0.0 --port 8090 \
  --runtime-services-info "$SERVICES_JSON" \
  --route "/dev/api/automation=$AUTOMATION" \
  --route "/dev/api=$AGENT" \
  --route "/dev/sockets=$AGENT" \
  --route "/dev/server_info=$AGENT" \
  --route "/dev/health=$AGENT" \
  --route "/dev/ready=$AGENT" \
  --route "/dev/alive=$AGENT" \
  --route "/dev/docs=$AGENT" \
  --route "/dev/redoc=$AGENT" \
  --route "/dev/openapi.json=$AGENT" \
  --route "/dev/vscode=$VSCODE" \
  --no-referrer-prefix /dev/vscode \
  --default "$FRONTEND" \
  > >(sed -u 's/^/[door]   /') 2>&1 &
P_DOOR=$!

log "all four up (agent=$P_AGENT auto=$P_AUTO web=$P_WEB door=$P_DOOR)"
wait -n
rc=$?
log "a service exited (rc=$rc) — stopping the rest"
on_term
exit 1
