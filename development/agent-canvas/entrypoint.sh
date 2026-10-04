#!/usr/bin/env bash
# ── THE DEV WORKSPACE'S DOOR, HOSTED (2026-10-04 — wireframe-lab/HOST-THE-TOOLS.md) ─────────
# Three jobs, then the tool's own process in the foreground:
#
#   1. NOBODY IS ASKED FOR ANYTHING (owner, 2026-10-04, watching a fresh window: *"every
#      single person that views this will be seeing it for the first time … You just need
#      to add the back in so that it's not asking the user or the visitor."*). So the tool
#      runs its LOCAL mode — not `--public`: LOCAL_BACKEND_API_KEY (the service secret) is
#      INJECTED into the served page at startup, and the tool's own first-load code adds
#      its "Local" backend from it — the same mechanism the owner's Mac uses, which is why
#      the Mac never asks him for a key either. The "Add a backend" step is untouched in
#      the tool and simply never appears; every first-time visitor lands in the workspace.
#      WHAT THIS TRADES, SAID PLAINLY: anyone who has this workspace's URL can drive the
#      agent from a browser — the URL is unlisted, not secret, and the demo circle is the
#      exposure. Raw API callers WITHOUT the key still get 401 (the server still requires
#      it — verified live), and the key is no longer handed out with the pin.
#
#   2. THE MODEL IS SEEDED — nobody types an API key. The DeepSeek configuration is
#      written through the agent server's own APIs, in the order the tool actually reads:
#      the LLM PROFILE (key included; the key is in no image and no repository — it
#      arrives as the service secret), its activation, the AGENT PROFILE that points at
#      it (conversations launch from the agent profile — verified live), and the settings
#      the banner and the wizard read. A steps ceiling rides along (max_iterations —
#      the SDK's own knob; this version has NO dollar-budget setting, measured).
#
#   3. THE DRIFT IS REPAIRED. WHY A LOOP AND NOT ONE SEED (measured live, 2026-10-04):
#      the first-run wizard's "Set up your LLM" step ALWAYS proposes its own default
#      model, so its Next button is always a dirty save — it once overwrote the seeded
#      profile with an unusable model and a blank key, and every conversation died at
#      "Your LLM isn't set up". The wizard no longer appears for visitors (the house patch
#      presets the flow as completed), but Settings can still trample the seed, so the demo
#      has exactly ONE valid configuration and this seed puts it back: a quiet check every
#      45 seconds, and the full seed again only when drift is found. The demo's own
#      robustness, not a fight with the tool.
#
# THE VERSION PIN IS A FIX, NOT A PREFERENCE: OH_AGENT_SERVER_VERSION=1.51.0 (the launcher
# pins sdk/tools/workspace to the same number). At 1.49.6 the SDK's telemetry reads
# `usage.prompt_tokens_details.cache_creation_tokens` unguarded, and DeepSeek's
# OpenAI-compatible responses do not carry it — every run died with AttributeError
# (measured live: conversation error event, 'PromptTokensDetailsWrapper' object has no
# attribute 'cache_creation_tokens'). 1.51.0 guards the read with hasattr. Read, not
# guessed: the two versions' telemetry.py were diffed in the uv cache.
#
# WHAT IS *NOT* HERE, SAID PLAINLY: no global daily cap exists inside this tool — the
# ceilings are max_iterations per conversation and the DeepSeek account's own limits,
# which are the hard floor under all of it. A global cap would need a proxy in front of
# the model — a decision with its own measurement, not a line smuggled into this script.
set -euo pipefail

PORT="${PORT:-8090}"

if [ -z "${LOCAL_BACKEND_API_KEY:-}" ]; then
  echo "❌ LOCAL_BACKEND_API_KEY is not set — it is the session key the served page carries (and every API call still requires); refusing to start." >&2
  exit 1
fi

# THE VERSION PIN — see the header. The image sets the same ENV (Dockerfile) so the
# build-time pre-warm and this runtime agree; the default here is the belt to that
# suspender, with the reason one screen up.
export OH_AGENT_SERVER_VERSION="${OH_AGENT_SERVER_VERSION:-1.51.0}"

# ── THE BIND, AND WHY THE KEY MAY TRAVEL WITH IT (2026-10-04, later — the sixth measured trap) ─
# The launcher binds 127.0.0.1 by default. In a Northflank pod that is an INVISIBLE service:
# measured from inside the running container, a curl to the pod's own IP:8090 was "Connection
# refused" while 127.0.0.1:8090 answered 200 — so the platform's edge could never reach the
# ingress (the public URL was 503 for ten minutes while the agent server, automation, static
# server and this loop were all healthy). OH_BIND_HOST moves the ingress and the static server
# to every interface; the agent server and automation stay on loopback behind the proxy.
#
# AND THE SESSION KEY STAYS INJECTED: off-loopback, the launcher's own policy would otherwise
# strip the key and show visitors the key-entry screen — the one thing the owner has ruled out
# (*"just add the back in so that it's not asking the user or the visitor"*). The opt-in below
# is the upstream's OWN env name for this decision (`AGENT_CANVAS_ALLOW_LAN_SESSION_KEY`, its
# docker entrypoint: *"set to true only when … you accept embedding the session key in the
# served HTML"*), now honored by the launcher (dev-with-automation.mjs). The trade is the one
# this file's header already records: anyone with the workspace's URL can drive the agent —
# the URL is unlisted, not secret; raw API callers still get 401 without the key.
export OH_BIND_HOST="${OH_BIND_HOST:-0.0.0.0}"
export AGENT_CANVAS_ALLOW_LAN_SESSION_KEY="${AGENT_CANVAS_ALLOW_LAN_SESSION_KEY:-true}"

# LOCAL MODE, ON PURPOSE (see job 1 in the header): the key is injected into the page at
# startup, so the tool adds its own backend and no visitor is asked for anything.
agent-canvas -p "$PORT" &
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

MODEL="${DEEPSEEK_MODEL:-deepseek-v4-pro}"
BASE_URL="${DEEPSEEK_BASE_URL:-https://api.deepseek.com/v1}"
PROFILE_LABEL="sovereign-local-model"

seed_model() {
  python3 - "$PORT" "$LOCAL_BACKEND_API_KEY" "$PROFILE_LABEL" "$MODEL" "$BASE_URL" "$DEEPSEEK_API_KEY" <<'PY'
import json, sys, urllib.request

port, key, label, model, base_url, api_key = sys.argv[1:7]
BASE = f"http://127.0.0.1:{port}"
HEADERS = {"content-type": "application/json", "X-Session-API-Key": key}

def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, method=method, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read()
        return json.loads(raw) if raw else {}

# The order is the reading order of the tool itself: the LLM profile (where the key
# lives), its activation, the agent profile that conversations actually launch from, and
# the conversation settings the SDK enforces per run.
call("POST", f"/api/profiles/{label}", {
    "llm": {"model": model, "base_url": base_url, "api_key": api_key, "auth_type": "api_key"},
    "include_secrets": True,
})
call("POST", f"/api/profiles/{label}/activate")
call("POST", "/api/agent-profiles/default", {
    "agent_kind": "openhands",
    "llm_profile_ref": label,
})
# AND THE POINTER (measured on a fresh container, 2026-10-04): a brand-new state has
# active_agent_profile_id = None — the wizard normally sets it, and nobody walks the
# wizard on our behalf. Activation is pointer-only (it does not write agent_settings),
# which is exactly what a fresh demo wants.
profiles = call("GET", "/api/agent-profiles")
target = next((p for p in profiles.get("profiles", []) if p.get("name") == "default"), None)
if target and profiles.get("active_agent_profile_id") != target.get("id"):
    call("POST", f"/api/agent-profiles/{target['id']}/activate")
call("PATCH", "/api/settings", {
    "conversation_settings_diff": {"max_iterations": 150},
    # THE TELEMETRY PROMPT, ANSWERED (2026-10-04): the "Help improve OpenHands" dialog shows
    # while this preference is NULL; answering it — false, declining — keeps it off every
    # reviewer's screen without opting the demo's traffic into anything.
    "misc_settings_diff": {"app_preferences": {"user_consents_to_analytics": False}},
})
print("→ model profile seeded:", label, "→", model)
PY
}

drift() {
  # "clean" when the model, the key's presence and the agent profile's ref are what this
  # demo says they are; "drift" otherwise. Never fails the caller.
  python3 - "$PORT" "$LOCAL_BACKEND_API_KEY" "$PROFILE_LABEL" "$MODEL" <<'PY' 2>/dev/null || echo "drift"
import json, sys, urllib.request

port, key, label, model = sys.argv[1:5]
BASE = f"http://127.0.0.1:{port}"
HEADERS = {"X-Session-API-Key": key}

def get(path):
    request = urllib.request.Request(BASE + path, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read())

settings = get("/api/settings")
llm = settings.get("agent_settings", {}).get("llm", {})
clean = llm.get("model") == model and settings.get("llm_api_key_is_set") is True
profiles = get("/api/agent-profiles")
active = profiles.get("active_agent_profile_id")
active_ref = next(
    (p.get("llm_profile_ref") for p in profiles.get("profiles", []) if p.get("id") == active),
    None,
)
# The pointer matters as much as the ref: a fresh state has neither, and a wizard pass
# can repoint both (see the header).
clean = clean and active_ref == label
print("clean" if clean else "drift")
PY
}

if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  seed_model || echo "⚠️ the model seed failed — the wizard still accepts a profile by hand"
  (
    while true; do
      sleep 45
      if [ "$(drift)" = "drift" ]; then
        echo "→ drift detected (a wizard save?) — re-seeding the model profile"
        seed_model || true
      fi
    done
  ) &
else
  echo "→ DEEPSEEK_API_KEY unset — the workspace starts with no model (the showcase state)"
fi

wait "$CANVAS_PID"
