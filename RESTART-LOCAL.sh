#!/bin/bash
# RESTART-LOCAL.sh — Local dev restart. DO NOT DELETE. DO NOT BYPASS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
BACKEND_PORT=8000
# The site. Served LIVE by the Vite dev server — never a build, so it can
# never go stale. Vite also forwards /api/* to BACKEND_PORT.
UI_PORT=5001
PORT=$BACKEND_PORT

# The model — DeepSeek's hosted API (deepseek-chat). It lives in DeepSeek's cloud,
# not on this machine, so nothing here starts a model or waits for one to load: the
# only model-related checks are the key and a one-token completion in the status
# section. (2026-09-24: the app left the local Qwen9B/LM Studio and Grace
# Local/llama.cpp behind — grace_gui.py's MODEL_PROVIDERS holds a single DeepSeek entry.)

# ── Production (Northflank CI/CD — git push to main auto-deploys) ──
# Public site URL. Present this to the owner when asked for the prod link.
# Service: semantic-design-systems · project: semantic-design-system
# Repo: Raibach/Interactive-Design-System · branch: main
PROD_URL="https://site--semantic-design-systems--mgtvxtd7xr2v.code.run"

# --- 1. Check .env ---
if [ ! -f "$BACKEND/.env" ]; then
    echo "❌ Error: .env file not found at $BACKEND/.env"
    exit 1
fi

# --- 2. Check .venv ---
if [ ! -f "$BACKEND/.venv/bin/uvicorn" ]; then
    echo "❌ Error: .venv not found at $BACKEND/.venv"
    echo "   Run: cd $BACKEND && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
    exit 1
fi

# --- 3. Check PostgreSQL ---
echo "🔍 Checking PostgreSQL..."
if command -v pg_isready &>/dev/null; then
    if ! pg_isready -q 2>/dev/null; then
        echo "⚠️  PostgreSQL is not running. Attempting to start via brew services..."
        if command -v brew &>/dev/null; then
            # No `|| true` at the end of this: a swallowed start is a start that
            # silently did not happen. If both names fail, say so — the pg_isready
            # gate below is what decides, and it should not have to guess why.
            if ! brew services start postgresql@15 2>/dev/null; then
                if ! brew services start postgresql 2>/dev/null; then
                    echo "   ⚠️  brew could not start postgresql@15 or postgresql — testing the connection anyway."
                fi
            fi
            sleep 2
            if ! pg_isready -q 2>/dev/null; then
                echo "❌ Error: PostgreSQL could not be started. Start it manually and re-run."
                exit 1
            fi
        else
            echo "❌ Error: PostgreSQL not running and Homebrew not found. Start PostgreSQL manually."
            exit 1
        fi
    fi
    echo "✅ PostgreSQL is accepting connections"
else
    # pg_isready not in PATH — try Homebrew path
    PG_ISREADY="/opt/homebrew/opt/postgresql@15/bin/pg_isready"
    if [ -x "$PG_ISREADY" ]; then
        if ! "$PG_ISREADY" -q 2>/dev/null; then
            echo "⚠️  PostgreSQL is not running. Attempting to start via brew services..."
            if ! brew services start postgresql@15 2>/dev/null; then
                echo "   ⚠️  brew services start postgresql@15 failed — testing the connection anyway."
            fi
            sleep 2
            if ! "$PG_ISREADY" -q 2>/dev/null; then
                echo "❌ Error: PostgreSQL could not be started. Start it manually and re-run."
                exit 1
            fi
        fi
        echo "✅ PostgreSQL is accepting connections"
    else
        echo "⚠️  pg_isready not found — skipping PostgreSQL check (ensure it's running)"
    fi
fi

# --- 4. Test DB credentials ---
echo "🔍 Verifying database credentials..."
DB_URL=$(grep -E '^DATABASE_URL=' "$BACKEND/.env" | head -1 | cut -d= -f2-)
if [ -z "$DB_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in .env"
    exit 1
fi
# Quick connectivity test via Python
if ! cd "$BACKEND" && .venv/bin/python -c "
import os, sys
os.environ['DATABASE_URL'] = '$DB_URL'
from database_pool import DatabasePoolManager
try:
    mgr = DatabasePoolManager.get_instance()
    print('OK')
except Exception as e:
    print(f'FAIL: {e}', file=sys.stderr)
    sys.exit(1)
" 2>&1 | grep -q "OK"; then
    echo "❌ Error: Cannot connect to PostgreSQL with DATABASE_URL=$DB_URL"
    exit 1
fi
echo "✅ Database credentials verified"

# --- 4b. Catalog health — the default pass ------------------------------------
# Regenerates the report the console chat shows on load, so what the user sees
# describes THIS startup. Without it the report is only as fresh as the last time
# somebody remembered to run the checker by hand.
echo "🔍 Catalog check (default pass)..."
if [ -f "$ROOT/frontend/scripts/catalog-check.mjs" ]; then
    for _catalog in prompt-composer ecommerce; do
        # Keep the checker's verdict line. Its exit code now means "a blocking
        # finding exists" (it used to mean only "the script ran"), and a loud warning
        # has to name WHICH finding — discarding all of its output made the sentence
        # below the only thing anyone ever saw.
        _check_log="$(mktemp)"
        if ( cd "$ROOT/frontend" && node scripts/catalog-check.mjs --catalog "$_catalog" >"$_check_log" 2>&1 ); then
            echo "   ✅ $_catalog"
        else
            echo "   ⚠️  $_catalog — checker returned non-zero. The console will report it as incomplete, not clean:"
            if grep -E 'VERDICT|did not run|blocking' "$_check_log" | sed 's/^/      /'; then
                :
            else
                echo "      no VERDICT line in the checker's output — the check itself did not complete."
            fi
            echo "      report: frontend/catalog-audit/$_catalog.json"
        fi
        rm -f "$_check_log"
    done
else
    echo "   ⚠️  catalog-check.mjs missing — the console will report the check as unavailable."
fi

# --- 5. Kill old processes (both ports: the site's server and the API) ---
echo "🔄 RESTART-LOCAL — freeing ports $UI_PORT (site) and $PORT (api)..."
for P in "$UI_PORT" "$PORT"; do
    # lsof exits non-zero when it matches NOTHING, which is the good case, so the
    # SUBSTITUTION is guarded. Guarding the kill the same way is what hid a failed
    # kill behind an unconditional "✅ Freed port" — so the success line is now only
    # printed after a probe that still finds the port empty, and a port that survives
    # kill -9 stops the script instead of being declared free.
    PIDS=$(lsof -ti :"$P" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        kill $PIDS 2>/dev/null || true
        sleep 1
        if lsof -ti :"$P" 2>/dev/null | grep -q .; then
            echo "⚠️  Force-killing stubborn processes on $P..."
            lsof -ti :"$P" 2>/dev/null | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
        STILL=$(lsof -ti :"$P" 2>/dev/null || true)
        if [ -n "$STILL" ]; then
            echo "❌ Port $P is still held by PID(s) $STILL after kill -9. Stop it and re-run."
            exit 1
        fi
        echo "✅ Freed port $P (verified: nothing answers on it)"
    else
        echo "ℹ️  Port $P was already free"
    fi
done

# --- 6. Load environment ---
echo "📦 Loading environment..."
set -a
# shellcheck disable=SC2046
export $(grep -v '^#' "$BACKEND/.env" | grep -v '^\s*$' | xargs)
set +a

# Dev mode notice (caches are disabled when ENVIRONMENT=development|dev|local)
DEV_ENV=$(grep -E '^ENVIRONMENT=' "$BACKEND/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "')
if [ "$DEV_ENV" = "development" ] || [ "$DEV_ENV" = "dev" ] || [ "$DEV_ENV" = "local" ]; then
    echo "🧪 DEVELOPMENT MODE DETECTED (ENVIRONMENT=$DEV_ENV)"
    echo "   → All backend caches (tag, context, milvus, figma) are BYPASSED."
    echo "   → Every request hits real data sources."
else
    echo "ℹ️  Production mode (set ENVIRONMENT=development in backend/.env for cache-free dev)"
fi

# --- 6b. The model is NOT started here, on purpose (2026-09-24) ----------------
# The app runs on DeepSeek's hosted API — nothing local. The llama.cpp server that
# used to load "Grace Local" here is gone because no code calls it any more, and
# the Qwen9B that LM Studio served is gone for the same reason. The status section
# below checks the one model the app actually uses.

# --- 7. Start FastAPI backend ---
# Stream uvicorn output to terminal AND log file simultaneously.
# The user sees startup in real time. The log file captures everything.
UVICORN_LOG="$BACKEND/logs/uvicorn-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$BACKEND/logs"
echo "🚀 Starting FastAPI backend on port $PORT..."
echo "   (streaming to terminal + $UVICORN_LOG)"
cd "$BACKEND"
.venv/bin/uvicorn main:app --host 0.0.0.0 --port $PORT 2>&1 | tee "$UVICORN_LOG" &
UVICORN_PID=$!
sleep 3

# --- 8. Verify server is running ---
if ! kill -0 $UVICORN_PID 2>/dev/null; then
    echo "❌ Error: FastAPI server failed to start. Check $UVICORN_LOG"
    exit 1
fi

# Verify FastAPI responds
HEALTH=$(curl -sf http://localhost:$PORT/api/health 2>/dev/null || echo "FAIL")
if [ "$HEALTH" != "FAIL" ]; then
    echo "✅ http://localhost:$PORT — FastAPI backend live (PID $UVICORN_PID)"
    echo "   Health: $HEALTH"
    echo "   Logs: tail -f $UVICORN_LOG"
else
    echo "⚠️  FastAPI started (PID $UVICORN_PID) but not responding yet."
    echo "   Check: tail -f $UVICORN_LOG"
fi

# --- 8b. Start the site — Vite dev server, serving source LIVE ---
# This is the site at http://localhost:$UI_PORT. It reads frontend/src directly
# and forwards /api/* to $PORT, so every saved change is visible on refresh.
# There is no build step and no compiled copy — the site cannot go stale.
if [ ! -d "$ROOT/frontend/node_modules" ]; then
    echo "❌ $ROOT/frontend/node_modules missing — run: cd frontend && npm install"
    exit 1
fi
VITE_LOG="$BACKEND/logs/vite-$(date +%Y%m%d-%H%M%S).log"
echo ""
echo "🚀 Starting the site (Vite, live source) on port $UI_PORT..."
echo "   (streaming to terminal + $VITE_LOG)"
cd "$ROOT/frontend"
# ── THE DOCKER SERVICE NAME MUST NOT REACH THE BROWSER ──────────────────────
# The `set -a; export $(grep ... backend/.env)` above exports EVERY key in
# backend/.env into this shell — including VITE_API_URL=http://prompt-composer-
# console:5001, which is the CONTAINER's own service name, kept there for the
# Docker deploy. Vite hands any VITE_-prefixed variable to the client, so the
# login (authService.login, the one call in the app that builds an absolute URL)
# posted to a host a browser cannot resolve — NXDOMAIN on this machine, measured
# 2026-09-19 — while every relative /api call went through this server's proxy and
# worked, which is why only the login broke. Cleared here, for the site only; the
# backend process keeps it, and the production build is unaffected (CI supplies it).
# neuralNetworkService.ts carries the same warning about the same variable.
unset VITE_API_URL
# --strictPort: if UI_PORT is taken, FAIL. Never silently land on another port.
npm run dev -- --port "$UI_PORT" --strictPort 2>&1 | tee "$VITE_LOG" &
VITE_PID=$!
cd "$ROOT"
for _ in $(seq 1 20); do
    sleep 1
    if curl -sf "http://localhost:$UI_PORT/" > /dev/null 2>&1; then break; fi
done
if curl -sf "http://localhost:$UI_PORT/" > /dev/null 2>&1; then
    echo "✅ http://localhost:$UI_PORT — site live, reading source directly (PID $VITE_PID)"
else
    echo "❌ Site did not come up on $UI_PORT. Check $VITE_LOG"
    exit 1
fi

# --- 9. Verify all databases and services ---
echo ""
echo "🔍 SYSTEM STATUS CHECK:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend (FastAPI)
if curl -sf http://localhost:$PORT/api/health > /dev/null 2>&1; then
    echo "✅ FastAPI backend on port $PORT (PID $UVICORN_PID) - CONNECTED"
else
    echo "⚠️  FastAPI backend on port $PORT (PID $UVICORN_PID) - NOT RESPONDING YET"
fi

echo ""
echo "📍 LOCAL PORTS:"
echo "   SITE (live source):  http://localhost:$UI_PORT"
echo "   API (proxied):       http://localhost:$PORT"
echo ""
echo "🧹 After frontend changes:"
echo "   Nothing. The site reads the source directly — just refresh."

# PostgreSQL (railway)
if pg_isready -q 2>/dev/null || [ -x "/opt/homebrew/opt/postgresql@15/bin/pg_isready" ] && /opt/homebrew/opt/postgresql@15/bin/pg_isready -q 2>/dev/null; then
    echo "✅ PostgreSQL (railway database) - CONNECTED"
else
    echo "❌ PostgreSQL (railway database) - DOWN"
fi

# Zilliz (remote vector database)
MILVUS_URI=$(grep -E '^MILVUS_URI=' "$BACKEND/.env" | head -1 | cut -d= -f2-)
MILVUS_TOKEN=$(grep -E '^MILVUS_TOKEN=' "$BACKEND/.env" | head -1 | cut -d= -f2-)
if [ -n "$MILVUS_URI" ]; then
    # Extract host from URI
    ZILLIZ_HOST=$(echo "$MILVUS_URI" | sed -E 's|https?://||' | cut -d/ -f1)
    if curl -sf --max-time 5 "$MILVUS_URI" > /dev/null 2>&1 || curl -sf --max-time 5 -H "Authorization: Bearer $MILVUS_TOKEN" "$MILVUS_URI/v1/vector/collections" > /dev/null 2>&1; then
        echo "✅ Zilliz ($ZILLIZ_HOST) - CONNECTED"
    else
        echo "⚠️  Zilliz ($ZILLIZ_HOST) - CANNOT VERIFY (remote service)"
    fi
else
    echo "⚠️  Zilliz - NOT CONFIGURED"
fi

# The model — DeepSeek's hosted API, the only model the app calls. No health check
# here: there is nothing local to probe, and the app itself reports when DeepSeek
# cannot answer. Listed so the restart log says what the app runs on.
echo "🧠 MODEL: DeepSeek (hosted API — deepseek-chat), key from backend/.env (DEEPSEEK_API_KEY)"

# Figma API (design spec extraction)
FIGMA_TOKEN=$(grep -E '^FIGMA_TOKEN=' "$BACKEND/.env" | head -1 | cut -d= -f2-)
if [ -n "$FIGMA_TOKEN" ]; then
    if curl -sf --max-time 5 -H "X-Figma-Token: $FIGMA_TOKEN" "https://api.figma.com/v1/me" > /dev/null 2>&1; then
        echo "✅ Figma API — CONNECTED"
    else
        echo "❌ Figma API — UNREACHABLE (token may be invalid)"
    fi
else
    echo "❌ Figma API — NOT CONFIGURED (FIGMA_TOKEN missing from .env)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧠 AI PROVIDER:  DeepSeek (hosted API — deepseek-chat)"
echo "📊 DATA SOURCES: PostgreSQL + Zilliz Cloud + Figma"

# The Cloudflare public tunnel that used to be started right here was REMOVED on
# 2026-09-14. It ran `cloudflared tunnel --url http://localhost:$UI_PORT` on every
# restart and printed a shareable trycloudflare.com link. A local restart must not
# publish this machine to the internet: below starts the API and the site on
# localhost only, and the tunnel is not started, not offered, and not mentioned.
# If a public demo link is ever wanted, start `cloudflared` deliberately, by hand,
# with the tunnel's own command — never as a silent side effect of restarting.

# --- 10. Final summary ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STARTUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Site:     http://localhost:$UI_PORT   (live source — never a build)"
echo "  Health:   http://localhost:$PORT/api/health"
echo "  PID:      site=$VITE_PID api=$UVICORN_PID"
echo "  Logs:     tail -f $UVICORN_LOG"
echo ""
  echo "  Production: $PROD_URL"
  echo "  Architecture: React Shell + AI Surface"
  echo "  AI Provider:  DeepSeek (hosted API — deepseek-chat)"
  echo "  Data:         PostgreSQL + milvus-lite (local vectors) + Figma"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"