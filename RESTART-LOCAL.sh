#!/bin/bash
# RESTART-LOCAL.sh — Local dev restart. DO NOT DELETE. DO NOT BYPASS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
PORT=5001

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
            brew services start postgresql@15 2>/dev/null || brew services start postgresql 2>/dev/null || true
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
            brew services start postgresql@15 2>/dev/null || true
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

# --- 5. Kill old processes (backend only — serves UI + API on 5001) ---
echo "🔄 RESTART-LOCAL — killing old processes on port $PORT (backend)..."
PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    kill $PIDS 2>/dev/null || true
    sleep 1
    if lsof -ti :$PORT 2>/dev/null | grep -q .; then
        echo "⚠️  Force-killing stubborn processes on $PORT..."
        lsof -ti :$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    echo "✅ Killed process(es) on port $PORT"
else
    echo "ℹ️  No process found on port $PORT"
fi

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
echo "   UI + API (single server):  http://localhost:$PORT"
echo "   (FastAPI serves frontend/dist + all /api/* routes)"
echo ""
echo "🧹 After frontend changes:"
echo "   cd frontend && npm run build   # then re-run this script"

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

# DeepSeek (primary AI provider — OpenAI-compatible, used by grace_gui.py)
DEEPSEEK_KEY=$(grep -E '^DEEPSEEK_API_KEY=' "$BACKEND/.env" | head -1 | cut -d= -f2-)
if [ -n "$DEEPSEEK_KEY" ]; then
    if curl -sf --max-time 10 -H "Authorization: Bearer $DEEPSEEK_KEY" \
         "https://api.deepseek.com/models" > /dev/null 2>&1; then
        echo "✅ DeepSeek (api.deepseek.com) — CONNECTED"
    else
        echo "❌ DeepSeek (api.deepseek.com) — UNREACHABLE (key may be invalid)"
    fi
else
    echo "❌ DeepSeek — NOT CONFIGURED (DEEPSEEK_API_KEY missing from .env)"
fi

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
echo "🧠 AI PROVIDER:  DeepSeek (primary for A2UI)"
echo "📊 DATA SOURCES: PostgreSQL + Zilliz Cloud + Figma"

# --- 10. Start Cloudflare Tunnel (auto public URL) ---
echo ""
if command -v cloudflared &>/dev/null; then
    # Kill any existing cloudflared tunnel from a previous run
    EXISTING_CF=$(pgrep -f "cloudflared tunnel" 2>/dev/null || true)
    if [ -n "$EXISTING_CF" ]; then
        echo "🔄 Killing old Cloudflare tunnel..."
        kill $EXISTING_CF 2>/dev/null || true
        sleep 1
    fi

    echo "🚇 Starting Cloudflare Tunnel (public demo URL)..."
    echo "   Capturing URL... (takes ~5 seconds)"
    # Run cloudflared in background, capture the URL from its output
    CF_LOG="$BACKEND/logs/cloudflared-$(date +%Y%m%d-%H%M%S).log"
    cloudflared tunnel --url "http://localhost:$PORT" > "$CF_LOG" 2>&1 &
    CF_PID=$!

    # Wait for the tunnel URL to appear in the log
    CF_URL=""
    for i in $(seq 1 15); do
        sleep 1
        CF_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" 2>/dev/null | head -1 || true)
        if [ -n "$CF_URL" ]; then
            break
        fi
    done

    if [ -n "$CF_URL" ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  🌐 PUBLIC DEMO URL (share this link):"
        echo ""
        echo "     $CF_URL"
        echo ""
        echo "  Anyone with this URL can see your app."
        echo "  Your Mac must stay awake for the link to work."
        echo "  Tunnel logs: $CF_LOG"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    else
        echo "⚠️  Cloudflare tunnel started but URL not captured yet."
        echo "   Check: grep 'trycloudflare.com' $CF_LOG"
        echo "   Tunnel PID: $CF_PID"
    fi
else
    echo "⚠️  cloudflared not installed — no public tunnel."
    echo "   Install it for a public demo URL:  brew install cloudflared"
fi

# --- 11. Final summary ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STARTUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Local:    http://localhost:$PORT"
echo "  Health:   http://localhost:$PORT/api/health"
echo "  PID:      $UVICORN_PID"
echo "  Logs:     tail -f $UVICORN_LOG"
if [ -n "${CF_URL:-}" ]; then
echo "  Public:   $CF_URL"
fi
echo ""
echo "  Architecture: React Shell + AI Surface"
echo "  AI Provider:  DeepSeek (deepseek-v4-flash)"
echo "  Data:         PostgreSQL + Zilliz Cloud + Figma"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"