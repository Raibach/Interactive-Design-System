#!/usr/bin/env bash
# ── THE HOUSE PATCH on OpenHands' Agent Canvas (the Development room's tool) ─────────────────
# The running app is the INSTALLED package (@openhands/agent-canvas under the global npm root),
# not the source clone — so its chrome is patched where it actually lives, and this script is
# how the patch survives an update: run it again after `npm install -g @openhands/agent-canvas`.
# Idempotent: each step checks its own marker first.
#
#   bash development/openhands-patch.sh
#
# WHY A SEPARATE STYLESHEET, AND WHY THAT MATTERS: the app's own assets are served
# `immutable, max-age=1yr` — a rule appended to them reaches nobody who has ever loaded the
# page (measured 2026-10-04: the owner's incognito session kept the OLD bytes because the file's
# URL had not changed). `assets/house-patch.css` is a NEW url with no cache history, and the
# HTML that links it is served `no-store`, so the next ordinary reload carries these rules.
#
# WHAT IT DOES (owner's pass, 2026-10-04, amended same night):
#   1. Hides the sidebar's OpenHands logo (it sits right under this app's own logo).
#   2. THE PALETTE: the ground takes the pin gate's navy #110E1F; the panels take the owner's
#      purple #22202D ("my preferred colour for all the panels that are currently gray");
#      hovers are deliberately untouched.
#   3. Relabels the checklist's outbound "Join the OpenHands Slack" item to "local sovereign
#      model" (a placeholder name for the model story — wiring later, the owner's word).
set -euo pipefail

BUILD="$(npm root -g)/@openhands/agent-canvas/build"

if [ ! -d "$BUILD" ]; then
  echo "❌ not found: $BUILD — is @openhands/agent-canvas installed globally?" >&2
  exit 1
fi

# 1 + 2 — the patch stylesheet (fresh URL) and its link in the always-fresh HTML.
cat > "$BUILD/assets/house-patch.css" <<'CSS'
/* ── THE HOUSE PATCH (2026-10-04) — a SEPARATE, UNHASHED stylesheet ON PURPOSE.
   The app's own asset files are immutable-cached for a year by URL, so a rule appended to
   them reaches nobody who has ever loaded the page. This file is a NEW url with no cache
   history: the HTML that links it is served no-store, so the very next ordinary reload
   carries these rules — no hard refresh, no cache to clear.
   1. THE LOGO GOES (the sidebar's OpenHands mark sits under this app's own logo).
   2. THE PALETTE: the ground takes the pin gate's navy; the panels take the owner's purple
      (#22202D). Hovers are deliberately untouched. */
[data-agent-server-ui]{ --oh-color-base:#110E1F; --oh-color-base-secondary:#22202D; }
[aria-label="OpenHands Logo"]{ display:none !important; }
CSS
echo "✅ stylesheet written: assets/house-patch.css"

python3 - "$BUILD" <<'PY'
import os, sys, glob
build = sys.argv[1]
p = os.path.join(build, "index.html")
src = open(p).read()
if "house-patch.css" in src:
    print("⏭  index.html already links it")
else:
    root_link = sorted(glob.glob(os.path.join(build, "assets", "root-*.css")))
    name = os.path.basename(root_link[0]) if root_link else None
    needle = f'<link rel="stylesheet" href="/assets/{name}"/>' if name else None
    if needle and needle in src:
        src = src.replace(needle, needle + '\n    <link rel="stylesheet" href="/assets/house-patch.css"/>')
    else:
        src = src.replace("</head>", '    <link rel="stylesheet" href="/assets/house-patch.css"/>\n</head>')
    open(p, "w").write(src)
    print("✅ index.html: link injected")
PY

# 3 — the label, guarded by value.
python3 - "$BUILD" <<'PY'
import json, sys, os
build = sys.argv[1]
p = os.path.join(build, "locales", "en", "openhands.json")
d = json.load(open(p))
key = "SIDEBAR$ONBOARDING_CHECKLIST_JOIN_SLACK"
if d.get(key) == "local sovereign model":
    print("⏭  label already patched")
else:
    d[key] = "local sovereign model"
    json.dump(d, open(p, "w"), indent=1, ensure_ascii=False)
    print("✅ label patched:", key, "→ local sovereign model")
PY
