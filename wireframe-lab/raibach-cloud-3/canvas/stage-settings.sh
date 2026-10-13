#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Canvas settings stage — built the settings bundle from the Mac's live config.
# One-time staging; the bundle ships to the box by hand during deploy.
#
# What travels:
#   settings.json  — the live agent/LLM config (the DeepSeek credential is
#                    Fernet-sealed inside; the box decodes it with OH_SECRET_KEY)
#   secrets.json   — custom secrets MINUS the automation entry: the old box key
#                    is dead, and the container seeds OPENHANDS_AUTOMATION_API_KEY
#                    itself at first boot (entrypoint.sh)
#   secret-key.txt — the sealing key (same value as OH_SECRET_KEY in the compose)
#
# Output: ../development/canvas/deploy/settings-bundle/
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SRC="$HOME/.openhands"
OUT="$(cd "$(dirname "$0")" && pwd)/reqs-staged/settings-bundle"

mkdir -p "$OUT"
cp "$SRC/settings.json" "$OUT/settings.json"
cp "$SRC/agent-canvas/secret-key.txt" "$OUT/secret-key.txt"

python3 - "$SRC/secrets.json" "$OUT/secrets.json" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src))
d.get("custom_secrets", {}).pop("OPENHANDS_AUTOMATION_API_KEY", None)
json.dump(d, open(dst, "w"), indent=2)
print("secrets.json: automation entry removed (container seeds it)")
PY

echo "bundle ready: $OUT"
ls -la "$OUT"
