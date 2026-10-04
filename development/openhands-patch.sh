#!/usr/bin/env bash
# ── THE HOUSE PATCH on OpenHands' Agent Canvas (the Development room's tool) ─────────────────
# The running app is the INSTALLED package (@openhands/agent-canvas under the global npm root),
# not the source clone — so its chrome is patched where it actually lives, and this script is
# how the patch survives an update: run it again after `npm install -g @openhands/agent-canvas`.
# Idempotent AND self-upgrading: every step removes older forms of itself before writing, so a
# re-run after this file has changed replaces the old patch instead of doubling it.
#
#   bash development/openhands-patch.sh
#
# WHY THE STYLESHEET CARRIES A CONTENT HASH IN ITS NAME: the app's own assets are served
# `immutable, max-age=1yr`; a rule appended to them reaches nobody who has ever loaded the page
# (measured 2026-10-03 — the owner's incognito kept OLD bytes through every reload and new tab,
# because the file's URL had not changed). An earlier pass here linked `house-patch.css?v=2` and
# then AMENDED the file one minute later — the amendment was invisible to any browser that had
# loaded it in that window, permanently. So the css now lands under `house-patch-<sha>.css`:
# change any byte and the URL changes with it, with nothing to remember. The HTML that links it
# is served `no-store`, so the next ordinary reload carries it — no hard refresh, no cleared cache.
#
# WHAT IT DOES (owner's pass, 2026-10-03):
#   1. Hides the sidebar's OpenHands logo (it sits right under this app's own logo).
#   2. THE PALETTE — every gray the neutral theme paints becomes a house colour: the grounds take
#      the pin gate's navy #110E1F, the panels take the owner's purple #22202D ("my preferred
#      colour for all the panels that are currently gray"). Hovers are deliberately untouched.
#      The event: root.css maps the oh-color vars onto the theme's grays (probed fresh-profile,
#      default `openhands-neutral`: base #181818, base-secondary #202020, surface #202020,
#      surface-deep #101010, bg-dark #181818, bg-light #282828, bg-input #313131,
#      bg-workspace #202020) — the first pass swapped only the first two, so the cards, the
#      composer and the sidebar's buttons stayed gray and the owner rightly said so. The whole
#      family (including the raised cards and the editor chrome) is swapped here. NOTE the
#      active theme re-declares its vars from a runtime <style> under TWO selectors — the shell
#      (doubled) and an inner themed scope — which outrank a plain rule; hence the TRIPLE
#      selector + !important, and the inline-important script in index.html as the unstoppable
#      backstop (inline important beats every stylesheet).
#   3. THE PAPER SHOWS THROUGH: grounds transparent (the room behind the frame carries the lab's
#      graph-paper tile), and the landing's `pt-[max(4rem,28vh)]` gives back 100px — it was
#      "sitting way down".
#   4. Relabels the checklist's outbound "Join the OpenHands Slack" item to "local sovereign
#      model" (a placeholder name for the model story — wiring later, the owner's word).
#   5. THE FIRST-RUN WIZARD'S DEFAULT ROW (owner, same night: this panel "should just say
#      sovereign local model, and the description should say defaults to local model agent …
#      best for general purpose work"). The description is a locale string and is patched in
#      the locale file; the TITLE is not a string in the build at all — the wizard renders each
#      row's name from the backend's agent metadata (`display_name`) — so the row title is
#      relabeled in-page by the ground script, exact-match only, inside the wizard container.
#      The "Skip for now" control is deliberately left alone.
set -euo pipefail

BUILD="$(npm root -g)/@openhands/agent-canvas/build"

if [ ! -d "$BUILD" ]; then
  echo "❌ not found: $BUILD — is @openhands/agent-canvas installed globally?" >&2
  exit 1
fi

# ── 1 + 2 + 3 — the stylesheet, under a content-hashed url ──────────────────────────────────
TMP="$(mktemp)"
cat > "$TMP" <<'CSS'
/* ── THE HOUSE PATCH — a SEPARATE stylesheet under a CONTENT-HASHED url, ON PURPOSE.
   The app's own asset files are immutable-cached for a year by URL, so an edit appended to them
   reaches nobody who has ever loaded the page; and a hand-bumped `?v=N` was already burned once
   (see the script header). This file's name carries the hash of its own bytes: change it and the
   URL changes with it, and the no-store HTML that links it carries the rules on the next reload.
   1. THE LOGO GOES (the sidebar's OpenHands mark sits under this app's own logo).
   2. THE PALETTE — the neutral theme's whole gray family takes the house colours: #110E1F (the
      pin gate's navy) for grounds, #22202D (the owner's purple) for panels. The variables
      replaced are every gray a fresh-profile probe measured on 2026-10-03. Hovers stay
      untouched.
   3. THE GROUND IS THE ASSEMBLY TILE — painted into the tool's own canvas (see below), and the
      landing's pt-[max(4rem,28vh)] gives back 100px. The ground is ALSO forced by an
      inline-important script in index.html.
   WHY TRIPLE SELECTOR + !important: the active theme re-declares its variables from a runtime
   <style> under TWO selectors — the shell (doubled) and an inner themed scope
   ([data-agent-server-ui] [data-theme][data-theme]) — and specificity ties went to the runtime
   sheet. Both scopes are mirrored here with a third copy + important: nothing has ever won
   against that. The .dark wrapper paints its own ground from OUTSIDE the shell, so it gets the
   transparency rule by name. */
[data-agent-server-ui][data-agent-server-ui][data-agent-server-ui],
[data-agent-server-ui] [data-theme][data-theme][data-theme] {
  --oh-color-base: #110E1F !important;            /* ground / frame        (was #181818) */
  --oh-color-base-secondary: #22202D !important;  /* panels                (was #202020) */
  --oh-surface: #22202D !important;               /* cards & panels        (was #202020) */
  --oh-surface-raised: #22202D !important;        /* raised cards          (was #282828) */
  --oh-surface-deep: #110E1F !important;          /* deep panels           (was #101010) */
  --oh-bg-dark: #110E1F !important;               /* dark grounds          (was #181818) */
  --oh-bg-light: #22202D !important;              /* raised controls       (was #282828) */
  --oh-bg-input: #22202D !important;              /* the composer's field  (was #313131) */
  --oh-bg-workspace: #22202D !important;          /* workspace surfaces    (was #202020) */
  --oh-bg-editor-sidebar: #22202D !important;     /* editor chrome         (was #202020) */
  --oh-bg-editor-active: #22202D !important;      /* editor chrome         (was #282828) */
  --oh-color-tertiary: #22202D !important;        /* rows, base buttons    (was #313131) */
}
div.dark.min-h-screen{ background-color: transparent !important; }
/* THE MIDDLE OPENS (owner, same night: "make that background in the middle area transparent to
   show our boxes"): the app's own full-window frame div paints bg-base straight across the main
   area and hides the room's assembly tile. It goes transparent; the sidebar keeps its navy —
   it is a panel, not the middle. */
div[class*="h-screen"][class*="bg-base"]{ background-color: transparent !important; }
/* THE SETUP PANEL STANDS ON THE SAME GROUND (owner, same night: "it has to also be there when
   the Setup panel opens up … it's just a black dark background"). The first-run wizard renders
   its own opaque navy takeover (`main.min-h-screen.bg-base`) under a 60%-black veil — measured:
   those two layers, not the panel, were painting the black. Both go transparent, and the opaque
   purple card floats on the assembly tile like every other panel. The "Skip for now" control is
   deliberately untouched (meant to be skippable). */
main[class*="min-h-screen"][class*="bg-base"]{ background-color: transparent !important; }
div[class*="bg-black"][class*="opacity-60"]{ background-color: transparent !important; }
[aria-label="OpenHands Logo"]{ display:none !important; }

/* THE GROUND IS PAINTED INTO THE TOOL (measured 2026-10-03): the owner asked for the room's
   assembly ground — the graph-paper tile with its boxes — to show through the middle of the
   tool. It CANNOT show through: the embedded page runs under its own theme with its own
   painting, and an iframe's transparent areas never reveal what the parent painted behind it —
   the middle stayed flat whatever the parent carried (wrapper, tile and all, measured by
   painting the room's wrapper red: not one pixel reached the eye). So the tile is copied in
   beside this stylesheet under its own content hash and painted AS THE TOOL'S OWN CANVAS —
   same image, same repeat: the middle IS the assembly ground, and no compositing rule of any
   browser can take it away. */
__HOUSE_PATCH_HTML_BG__
body, [data-agent-server-ui]{ background: transparent !important; }
.pt-\[max\(4rem\,28vh\)\]{ padding-top: max(4rem, calc(28vh - 100px)) !important; }
CSS

# The tile: copied in beside the stylesheet under its own content hash (the room's assembly
# image, straight from the app's assets — same file, same repeat).
TILE_SRC="$(cd "$(dirname "$0")" && pwd)/../frontend/src/assets/canvas-development-lab-bkg.png"
TILE_NAME=""
if [ -f "$TILE_SRC" ]; then
  TILE_NAME="house-patch-tile-$(shasum -a 256 "$TILE_SRC" | cut -c1-10).png"
  HTML_BG_RULE="html{ background: transparent url($TILE_NAME) repeat !important; }"
else
  HTML_BG_RULE="html{ background: transparent !important; }"
  echo "⚠️  tile not found at $TILE_SRC — the canvas falls back to plain transparent" >&2
fi
python3 - "$TMP" "$HTML_BG_RULE" <<'PY'
import sys
path, rule = sys.argv[1], sys.argv[2]
src = open(path).read().replace("__HOUSE_PATCH_HTML_BG__", rule)
open(path, "w").write(src)
PY

HASH="$(shasum -a 256 "$TMP" | cut -c1-10)"
NAME="house-patch-$HASH.css"
find "$BUILD/assets" -maxdepth 1 -name 'house-patch*' -delete
if [ -n "$TILE_NAME" ]; then cp "$TILE_SRC" "$BUILD/assets/$TILE_NAME"; fi
cp "$TMP" "$BUILD/assets/$NAME"
rm -f "$TMP"
echo "✅ stylesheet: assets/$NAME"
if [ -n "$TILE_NAME" ]; then echo "✅ tile: assets/$TILE_NAME"; fi

# ── the HTML: the link and the ground script, in their canonical form ───────────────────────
python3 - "$BUILD" "$NAME" <<'PY'
import os, re, sys
build, name = sys.argv[1], sys.argv[2]
p = os.path.join(build, "index.html")
src = open(p).read()

# The stylesheet link: strip any older house-patch link (any name, with or without ?v=) and
# insert exactly one, right after the app's own root css link.
link = f'<link rel="stylesheet" href="/assets/{name}"/>'
src2 = re.sub(r'\s*<link rel="stylesheet" href="/assets/house-patch[^"]*"/>', '', src)
if link in src2:
    src2 = src2  # canonical link already present
else:
    root = re.search(r'<link rel="stylesheet" href="/assets/root-[^"]+\.css"/>', src2)
    if root:
        src2 = src2[:root.end()] + "\n    " + link + src2[root.end():]
    else:
        src2 = src2.replace("</head>", "    " + link + "\n</head>", 1)
if link not in src2:
    raise SystemExit("❌ could not place the stylesheet link")

# The ground script: replaced wholesale with the canonical block (strip-if-present, then insert
# before </body>), so its content can evolve between runs.
src2 = re.sub(r'\s*<script id="house-patch-ground">.*?</script>', '', src2, flags=re.S)
script = '''<script id="house-patch-ground">
  /* THE HOUSE PATCH (see the /assets/house-patch-*.css link above): the app's ground goes
     transparent so the Development room's graph paper shows through, and the palette variables
     are pinned INLINE-IMPORTANT on the shell — the active theme re-declares them from a runtime
     style sheet (doubled selector), and inline styles beat every stylesheet there is.
     Measured 2026-10-03. */
  (function () {
    var VARS = { "--oh-color-base": "#110E1F", "--oh-color-base-secondary": "#22202D",
                 "--oh-surface": "#22202D", "--oh-surface-raised": "#22202D",
                 "--oh-surface-deep": "#110E1F",
                 "--oh-bg-dark": "#110E1F", "--oh-bg-light": "#22202D",
                 "--oh-bg-input": "#22202D", "--oh-bg-workspace": "#22202D",
                 "--oh-color-tertiary": "#22202D" };
    var set = function () {
      if (document.body) document.body.style.setProperty("background", "transparent", "important");
      var ground = document.querySelector("div.dark.min-h-screen");
      if (ground) ground.style.setProperty("background-color", "transparent", "important");
      var frame = document.querySelector('div[class*="h-screen"][class*="bg-base"]');
      if (frame) frame.style.setProperty("background-color", "transparent", "important");
      var targets = document.querySelectorAll("[data-agent-server-ui], [data-agent-server-ui] [data-theme]");
      for (var t = 0; t < targets.length; t++) {
        targets[t].style.setProperty("background", "transparent", "important");
        for (var k in VARS) targets[t].style.setProperty(k, VARS[k], "important");
      }
    };
    /* THE WIZARD'S DEFAULT ROW, renamed (see the patch script's note 5): its title is backend
       agent metadata, not a locale string, so it is relabeled here — exact text match, inside
       the first-run wizard only. The description is patched in the locale file. */
    var relabel = function () {
      var wiz = document.querySelector("div.fixed.inset-0.flex.items-center.justify-center");
      if (!wiz) return;
      var spans = wiz.querySelectorAll("span");
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i];
        if (s.textContent === "OpenHands" && s.className.indexOf("truncate") !== -1) {
          s.textContent = "Sovereign local model";
        }
      }
    };
    set();
    setTimeout(set, 600);
    setTimeout(set, 2200);
    setTimeout(set, 4000);
    relabel();
    setTimeout(relabel, 600);
    setTimeout(relabel, 2200);
    setTimeout(relabel, 4000);
    new MutationObserver(relabel).observe(document.documentElement, { childList: true, subtree: true });
  })();
</script>'''
src2 = src2.replace("</body>", script + "\n  </body>", 1)

if src2 != src:
    open(p, "w").write(src2)
    print("✅ index.html: link + ground script in canonical form")
else:
    print("⏭  index.html already canonical")
PY

# ── 4 + 5 — the strings, each guarded by value ───────────────────────────────────────────────
python3 - "$BUILD" <<'PY'
import json, sys, os
build = sys.argv[1]
p = os.path.join(build, "locales", "en", "openhands.json")
d = json.load(open(p))
changed = False
# The checklist's outbound Slack item — the model story's placeholder name (owner's word).
k1, v1 = "SIDEBAR$ONBOARDING_CHECKLIST_JOIN_SLACK", "local sovereign model"
if d.get(k1) != v1:
    d[k1] = v1
    changed = True
    print("✅ label patched:", k1, "→", v1)
else:
    print("⏭  label already patched")
# The wizard's default row description (owner, same night): "defaults to local model agent …
# best for general purpose work". The row's TITLE is backend metadata — the ground script
# relabels it in-page (see note 5 in the header).
k2 = "ONBOARDING$AGENT_OPENHANDS_DESCRIPTION"
v2 = "Defaults to the local model agent. Best for general purpose work."
if d.get(k2) != v2:
    d[k2] = v2
    changed = True
    print("✅ wizard description patched →", v2)
else:
    print("⏭  wizard description already patched")
if changed:
    json.dump(d, open(p, "w"), indent=1, ensure_ascii=False)
PY
