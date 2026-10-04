#!/usr/bin/env bash
# ── THE DEV WORKSPACE'S DOOR, HOSTED (2026-10-05 — wireframe-lab/HOST-THE-TOOLS.md) ─────────
# Two jobs, then the tool's own process in the foreground:
#
#   1. THE GATE IS REAL. `--public` mode: the server always requires its session key
#      (LOCAL_BACKEND_API_KEY, from the service's environment — a secret) and the key is
#      NOT injected into the page — each reviewer types it once, per browser. This is the
#      owner's decision made mechanical: pin-holders may drive the agent, and the key is
#      the pin's partner (which is why the same sentence is handed out with both). Without
#      this, every visitor's browser would hold a working session and the gate would be a
#      picture of one.
#
#   2. THE MODEL IS SEEDED — nobody types an API key. Once the ingress answers, the
#      DeepSeek profile (OpenAI-compatible) is written through the agent server's own
#      settings API — the supported writer, verified 2026-10-05 against a fresh instance —
#      idempotently, from service environment variables. The key is in NO image and NO
#      repository: it arrives as the service's secret and lives only in the container's own
#      state. A steps ceiling rides the same write (max_iterations — the SDK's own knob;
#      verified applied), so a runaway conversation has a bound of its own.
#
# WHAT IS *NOT* HERE, SAID PLAINLY: this SDK version has NO dollar-budget setting (a
# max_budget_per_task field exists in the frontend's types and is silently dropped by the
# server — measured, then not used). The ceilings that DO exist: max_iterations per
# conversation, the key gate (only pin-holders run anything at all), and the DeepSeek
# account's own limits, which are the hard floor under all of it. A global daily cap would
# need a proxy in front of the model — a decision with its own measurement, not a line
# smuggled into this script.
set -euo pipefail

PORT="${PORT:-8090}"

if [ -z "${LOCAL_BACKEND_API_KEY:-}" ]; then
  echo "❌ LOCAL_BACKEND_API_KEY is not set — --public mode requires it; refusing to start." >&2
  exit 1
fi

agent-canvas -p "$PORT" --public &
CANVAS_PID=$!

# Wait for the ingress — the launcher boots an agent server behind it (first boot after a
# fresh deploy still spends a little time even with the uv cache pre-warmed at build).
READY=0
for _ in $(seq 1 150); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/"; then READY=1; break; fi
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "⚠️ the ingress did not answer within 150s — starting anyway (the seed below will fail loudly)" >&2
fi

if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  MODEL="${DEEPSEEK_MODEL:-deepseek-v4-pro}"
  BASE_URL="${DEEPSEEK_BASE_URL:-https://api.deepseek.com/v1}"
  # The JSON is BUILT BY python3 (in the image for the patch script), not by string
  # interpolation — a key with a quote in it must not become malformed JSON.
  BODY="$(MODEL="$MODEL" BASE_URL="$BASE_URL" KEY="$DEEPSEEK_API_KEY" python3 -c 'import json, os
print(json.dumps({"agent_settings_diff": {"agent_kind": "openhands",
    "llm": {"model": os.environ["MODEL"], "base_url": os.environ["BASE_URL"],
            "api_key": os.environ["KEY"], "auth_type": "api_key"}},
  "conversation_settings_diff": {"max_iterations": 150}}))')"
  echo "→ seeding the model profile: ${MODEL} (${BASE_URL})"
  curl -sS -X PATCH "http://127.0.0.1:${PORT}/api/settings" \
    -H "content-type: application/json" \
    -H "X-Session-API-Key: ${LOCAL_BACKEND_API_KEY}" \
    -d "$BODY" -o /dev/null -w "→ settings seeded (HTTP %{http_code})\n" \
    || echo "⚠️ settings seed failed — the wizard still accepts a key by hand"
else
  echo "→ DEEPSEEK_API_KEY unset — the workspace starts with no model (the showcase state)"
fi

wait "$CANVAS_PID"
