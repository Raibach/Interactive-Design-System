#!/usr/bin/env bash
# ── THE HOUSE PATCH on OpenHands' Agent Canvas (the Development room's tool) ─────────────────
# The running app is the INSTALLED package (@openhands/agent-canvas under the global npm root),
# not the source clone — so its chrome is patched where it actually lives, and this script is
# how the patch survives an update: run it again after `npm install -g @openhands/agent-canvas`.
# Idempotent: each step checks its own marker first. The originals are kept in
# development/openhands-patch-backup/ (first run only).
#
#   bash development/openhands-patch.sh
#
# WHAT IT DOES (owner's pass, 2026-10-04; see development/CHANGELOG.md):
#   1. Hides the sidebar's OpenHands logo (it sits right under this app's own logo).
#   2. Repaints the dark theme's base surfaces to the pin gate's navy + its lifted card:
#      --oh-color-base #110E1F, --oh-color-base-secondary #231f2e.
#   3. Relabels the checklist's "Join the OpenHands Slack" item to "local sovereign model"
#      (a placeholder name for the model story to come — wiring later, the owner's word).
set -euo pipefail

BUILD="$(npm root -g)/@openhands/agent-canvas/build"
BACKUP="$(cd "$(dirname "$0")" && pwd)/openhands-patch-backup"
CSS="$(ls "$BUILD"/assets/root-*.css | head -1)"

if [ ! -d "$BUILD" ]; then
  echo "❌ not found: $BUILD — is @openhands/agent-canvas installed globally?" >&2
  exit 1
fi

mkdir -p "$BACKUP"

# 1 + 2 — the CSS pass (logo + palette), guarded by its own marker.
if ! grep -q "THE HOUSE PATCH" "$CSS"; then
  cp "$CSS" "$BACKUP/root.css.bak"
  cat >> "$CSS" <<'CSS_PATCH'

/* ── THE HOUSE PATCH (2026-10-04): the owner's own pass on this app's chrome — applied to the
   INSTALLED build, re-appliable after an update by development/openhands-patch.sh.
   1. THE LOGO GOES: the sidebar's OpenHands mark sits right under this app's own logo.
   2. THE PALETTE: the dark ground and cards take the pin gate's navy and its lifted card
      (#110E1F / #231f2e) — the chooser screens and every base surface follow. */
[data-agent-server-ui]{ --oh-color-base:#110E1F; --oh-color-base-secondary:#231f2e; }
[aria-label="OpenHands Logo"]{ display:none !important; }
CSS_PATCH
  echo "✅ css patched ($CSS)"
else
  echo "⏭  css already patched"
fi

# 3 — the label, guarded by value.
python3 - "$BUILD" <<'PY'
import json, sys, shutil, os
build = sys.argv[1]
p = os.path.join(build, "locales", "en", "openhands.json")
d = json.load(open(p))
key = "SIDEBAR$ONBOARDING_CHECKLIST_JOIN_SLACK"
if d.get(key) == "local sovereign model":
    print("⏭  label already patched")
else:
    backup = os.path.join(os.path.dirname(os.path.abspath(__file__)))
    d[key] = "local sovereign model"
    json.dump(d, open(p, "w"), indent=1, ensure_ascii=False)
    print("✅ label patched:", key, "→ local sovereign model")
PY
