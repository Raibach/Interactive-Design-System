#!/usr/bin/env bash
# ── THE HOUSE PATCH on the Raibach IDS Agent Canvas (the Development room's tool) ─────────────────
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
#   1. Hides the vendor's logo from the sidebar (it sits right under this app's own logo).
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
#   4. Relabels the checklist's outbound Slack-invite item to "local sovereign
#      model" (a placeholder name for the model story — wiring later, the owner's word).
#   5. THE FIRST-RUN WIZARD'S DEFAULT ROW (owner, same night: this panel "should just say
#      sovereign local model, and the description should say defaults to local model agent …
#      best for general purpose work"). The description is a locale string and is patched in
#      the locale file; the TITLE is not a string in the build at all — the wizard renders each
#      row's name from the backend's agent metadata (`display_name`) — so the row title is
#      relabeled in-page by the ground script, exact-match only, inside the wizard container.
#      THE FIRST-RUN FLOW IS DOOR-SCOPED (2026-10-04, last): the wizard is the REGISTERED
#      door's way in and nobody else's — *"That process is not supposed to exist for the pin
#      gate. It's only available if you click the register for the beta."* The pin door (and
#      a hosted visitor with no marker) opens on the working model: the flow is preset
#      completed (openhands-onboarded) and the getting-started checklist dismissed, with the
#      "Skip for now" backstop should the wizard ever appear anyway. The registered walk
#      stays honest — every step visible, nothing skipped — which is the zero-trust ruling
#      that deleted the pass-through, kept exactly where it applied. The ground script's
#      block above `run(set)` holds the door switch.
#   6. THE TAB TITLE (2026-10-04): the vendor's name is in <title> — visible in every tab and
#      every bookmark, and the one branding no stylesheet can reach — so it is rewritten to the
#      house title ("Raibach — Agent Canvas", the same pattern as the site's own). Forced on
#      every run; a rebuild cannot leave it unpatched for long.
#   7. THE BETA NOTICE MODAL (2026-10-04): a click on an agent tile in "Choose your agent"
#      opens the notice on the hosted beta and goes no further — no advance, no skip (the
#      pass-through stays deleted). Hosted only, and the registered door's walk is the only
#      walk that reaches it: every other door is preset completed (item 5).
#   8. THE SIDEBAR STARTS COLLAPSED (owner, 2026-10-05): the left navigation opens as its
#      icon rail. The app's sidebar store (`src/stores/sidebar-store.ts`) reads its choice
#      from `openhands-sidebar` and carries a one-shot migration from the older raw key
#      `openhands-sidebar-collapsed`; the ground script seeds that older key BEFORE the
#      bundle boots (inline script parses first — module scripts are deferred), and stops
#      the moment the app has a key of its own: the first toggle writes it and the person's
#      choice rules from then on — default, not forced. Every door alike (a layout default
#      is not the wizard's business). Lives in the ground script because index.html is
#      served no-store — no hashed asset edit, so the immutable cache cannot hide it.
#   9. THE WASH — THE LIBRARY CARD'S FILL AT HALF STRENGTH, TWO PASSES (owner, 2026-10-05):
#      FIRST the settings and automate views' transparent state boxes — "No MCP servers
#      installed yet.", "No apps are installed on this backend.", the Automate dashboard's
#      "No automations configured" (774×450) — the library card's own colour (#22202D) at
#      50%: rgba(34, 32, 45, 0.5), so the assembly tile still reads through. THEN the owner's
#      second pass — "keep what you've done, don't undo anything … now we need to do the
#      wrapper that goes around all of them, same opacity same color. It will double the
#      layers that are already done, which will make them a little darker, which will make
#      them stand out, so that's fine" — the same wash on the wrapper column each settings /
#      automate view draws its whole content in, and on the settings sub-nav's own column
#      beside it ("the same thing you would do with this one it has its own container").
#      The wrappers are square, so they take the owner's 10px corners; the boxes were
#      already rounded (12px), so nothing is re-rounded there. THE DOUBLE LAYER IS
#      INTENDED — a filled box on the filled wrapper reads darker, which is the point.
#      The chat surfaces match none of the selectors (scanned clean 2026-10-05 — chat
#      landing: 0 wrappers, 0 asides, 0 boxes; MCP and Automate: 1 of each), so the
#      homepage stays clean by construction. THIRD PASS, same evening — "add ten pixel
#      padding to anything that's sitting next to a border or an edge — most of those last
#      ones could use a 10 pixel padding": the wrapper and the sub-nav take 10px padding so
#      their content sits clear of the fill's edge (both were flush at 0); the boxes keep
#      their own p-8 (32px), which was already breathing.
#  10. THE ONBOARDING IS PARKED — EVERY DOOR (owner, 2026-10-06): *"The development room app
#      keeps reverting to the wizard for dev@local through the pin gate. I want to make this
#      work. … Maybe we can move the onboarding and the wizard until I am ready to use it for
#      real accounts."* While PARK_ONBOARDING is true (ground script, below), the first-run
#      flow is preset completed for EVERY door — registered included — and the registered
#      door's once-only re-arm (`house_welcome_granted`) is suspended, so no profile can land
#      back in the wizard. RE-INTRODUCTION IS ONE SWITCH: set PARK_ONBOARDING = false and
#      re-run this script — the door logic then behaves exactly as items 5/7 describe
#      (registered walks with the beta notice; dev and hosted preset completed). The wizard
#      code in the tool is untouched: parked, not lost.
set -euo pipefail

HOSTED=0
for arg in "$@"; do
  case "$arg" in
    --hosted) HOSTED=1 ;;
  esac
done

# ── WHICH BUILD GETS PATCHED, AND WHY THAT IS NOW A QUESTION (2026-10-04) ────────────────────
# This was `npm root -g` and nothing else, because the globally installed package was the only
# copy of the tool that existed. It is not any more: the Development tool runs from THIS
# repository's own checkout (`development/OpenHands-main`) — that is what the untethering work
# was for — and a patch that could only reach the global install left that copy wearing the
# vendor's bare colours while every other surface of the house was styled.
#
# So the target is named by the caller when the caller knows better, and falls back to the
# global install every other time. The patch itself is untouched: one script, one look.
BUILD="${OH_PATCH_BUILD_DIR:-$(npm root -g)/@openhands/agent-canvas/build}"

if [ ! -d "$BUILD" ]; then
  echo "❌ not found: $BUILD — is @openhands/agent-canvas installed globally?" >&2
  echo "   (or set OH_PATCH_BUILD_DIR to the build directory of a local checkout)" >&2
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
   1. THE LOGO GOES (the vendor's mark sits under this app's own logo).
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
/* THE WASH — THE LIBRARY CARD'S FILL AT HALF STRENGTH (owner, 2026-10-05, two passes).
   PART 1, THE BOXES: "fill these containers … at 50% opacity so that I can see a little bit
   of the background" — the transparent state boxes (`rounded-xl border border-border`;
   measured: MCP servers, Apps, Automate dashboard 774×450). PART 2, THE WRAPPERS: "keep what
   you've done, don't undo anything … now we need to do the wrapper that goes around all of
   them, same opacity same color. It will double the layers that are already done, which will
   make them a little darker, which will make them stand out, so that's fine" — the centered
   wrapper column each settings/automate view draws everything in, plus the settings sub-nav
   column ("the same thing you would do with this one it has its own container"). THE DOUBLE
   LAYER IS INTENDED: a box on the wrapper reads darker by design. The wrappers are square,
   so they take the owner's 10px corners. The chat surfaces are excluded by construction —
   scanned clean 2026-10-05: chat landing 0 wrappers / 0 asides / 0 boxes; MCP and Automate
   1 of each. The :not([class*="bg-"]) guards mean these two rules can never repaint an
   element that already carries its own background. AND THE FILLED BLOCKS TAKE 10px PADDING
   (owner, 2026-10-05, third pass: "add ten pixel padding to anything that's sitting next to
   a border or an edge — most of those last ones could use a 10 pixel padding") — the
   wrapper and the sub-nav were flush at 0, so their content sat against the fill's edge;
   the boxes keep their own p-8 (32px), already breathing. */
[data-agent-server-ui] [class~="rounded-xl"][class~="border"][class~="border-border"]{
  background-color: rgba(34, 32, 45, 0.5) !important;
}
[data-agent-server-ui] :is([class~="max-w-200"],[class~="max-w-275"])[class~="mx-auto"][class~="flex-col"][class~="gap-6"]:not([class*="bg-"]){
  background-color: rgba(34, 32, 45, 0.5) !important;
  border-radius: 10px !important;
  padding: 10px !important;
}
[data-agent-server-ui] aside[class~="md:w-65"]:not([class*="bg-"]){
  background-color: rgba(34, 32, 45, 0.5) !important;
  border-radius: 10px !important;
  padding: 10px !important;
}
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
python3 - "$BUILD" "$NAME" "$HOSTED" <<'PY'
import os, re, sys
build, name, hosted = sys.argv[1], sys.argv[2], sys.argv[3]
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

# THE TAB TITLE (2026-10-04): the vendor's name lives in <title> — the one branding no stylesheet
# can reach — so it is rewritten to the house title. Forced every run (any title is replaced),
# so a rebuild that puts "OpenHands" back is fixed on the next patch with nothing to remember.
src2 = re.sub(r"<title>[^<]*</title>", "<title>Raibach — Agent Canvas</title>", src2, count=1)
if "<title>Raibach" not in src2:
    raise SystemExit("❌ could not rewrite the page title")

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
    /* HOSTED OR NOT — the flag the patch script was run with (the service's Dockerfile says
       --hosted; the Mac does not). It gates the first-run-flow changes below, so the owner's
       own workbench keeps its wizard exactly as it was. */
    var HOSTED = __HOUSE_HOSTED__;
    /* WHICH DOOR THIS PAGE WAS REACHED THROUGH (2026-10-04): 'registered' (a signed-up beta
       user) or 'dev' (the pin) or "" (older sessions). builder-embed.ts appends it, and the
       door-dependent pieces below read it: the pin door opens on the working model — no
       wizard — while the registered door walks the wizard, which is the beta's way in. */
    var DOOR = (location.search.match(/[?&]house_door=([a-z]+)/) || [])[1] || "";
    /* ── THE ONBOARDING IS PARKED — EVERY DOOR (owner, 2026-10-06) ──────────────────────────
       *"The development room app keeps reverting to the wizard for dev@local through the pin
       gate. I want to make this work. … Maybe we can move the onboarding and the wizard until
       I am ready to use it for real accounts."* While PARK_ONBOARDING is true the flow NEVER
       appears for anyone: preseedFirstRun (below) presets completion for every door, and the
       registered door's once-only re-arm is suspended. RE-INTRODUCTION (one switch): set this
       to false and re-run the patch — the registered door walks again (with the beta notice),
       the pin and hosted doors are preset completed, exactly as the script header's items 5
       and 7 describe. The wizard code in the tool is never touched. */
    var PARK_ONBOARDING = true;
    /* ── THE BETA MODEL POP-UP — RESTORED, WITHOUT THE SKIP (owner, 2026-10-04, last) ────────
       Owner, walking the beta: *"Whenever somebody selects a model whether it's local or
       whether it's in the cloud, it's supposed to show a little pop-up [that] says there is
       no model to select in beta mode."* He is right, and it had been removed in the same cut
       as the pass-through — the pop-up was never the problem; the SKIP was. So it is back,
       hosted only (it is the beta's own truth; the Mac's workbench is not the beta), and it
       does exactly one thing: a click on a tile in "Choose your agent" opens the notice and
       goes no further — the click is intercepted in the capture phase, so nothing selects (a
       per-visitor agent choice must not reach the one shared configuration), and BOTH
       controls simply close it. NO ADVANCE, NO PINNING, NO PROFILE REPAIR: the wizard stays
       exactly where the visitor left it, and walking the rest of it — the LLM parameters
       screen included — is theirs to do through the vendor's own steps. (The pass-through
       that used to follow Confirm stays deleted; the owner's zero-trust ruling above is why.) */
    var BETA_MESSAGE =
      "This beta runs on the hosted service with the provided model; sovereignty — your own " +
      "models, local or cloud, on your own machine — arrives with the installed suite.";
    var betaWizard = function () {
      return document.querySelector("div.fixed.inset-0.flex.items-center.justify-center");
    };
    var betaHeading = function (wiz) {
      /* EVERY SLIDE STAYS MOUNTED — only the ACTIVE one is in normal flow, the rest are
         absolutely positioned (onboarding-modal.tsx). The active panel's heading is the
         first heading with NO absolutely-positioned ancestor between it and the wizard. */
      if (!wiz) return "";
      var heads = wiz.querySelectorAll("h1,h2,h3");
      for (var i = 0; i < heads.length; i++) {
        var node = heads[i];
        var inactive = false;
        while (node && node !== wiz) {
          if (getComputedStyle(node).position === "absolute") { inactive = true; break; }
          node = node.parentElement;
        }
        if (!inactive) return heads[i].textContent;
      }
      return heads.length ? heads[0].textContent : "";
    };
    var betaModal = function () {
      var box = document.getElementById("house-beta-consent");
      if (box) return;
      box = document.createElement("div");
      box.id = "house-beta-consent";
      box.setAttribute("style",
        "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;" +
        "justify-content:center;background:rgba(17,14,31,0.72);font-family:Inter,system-ui,sans-serif;");
      box.innerHTML =
        '<div style="width:430px;max-width:calc(100vw - 48px);box-sizing:border-box;' +
        'background:#231f2e;border:1px solid rgba(255,255,255,0.08);border-radius:16px;' +
        'padding:28px 28px 22px;box-shadow:0 32px 80px rgba(0,0,0,0.5);">' +
        '<div style="font-size:16px;font-weight:800;color:#f5f0e8;margin-bottom:10px;">' +
        "Beta model notice</div>" +
        '<p style="font-size:13px;line-height:1.6;color:rgba(245,240,232,0.6);margin:0 0 20px;">' +
        BETA_MESSAGE + "</p>" +
        '<div style="display:flex;gap:10px;">' +
        '<button type="button" data-house="cancel" style="flex:1;padding:10px;font-size:13px;' +
        'font-weight:700;color:rgba(245,240,232,0.7);background:transparent;' +
        'border:1px solid rgba(255,255,255,0.12);border-radius:9px;cursor:pointer;' +
        'font-family:inherit;">Cancel</button>' +
        '<button type="button" data-house="confirm" style="flex:1;padding:10px;font-size:13px;' +
        'font-weight:700;color:#110E1F;background:#D4A0EE;border:none;border-radius:9px;' +
        'cursor:pointer;font-family:inherit;">Confirm</button>' +
        "</div></div>";
      box.addEventListener("click", function (event) {
        var el = event.target;
        var act = el && el.getAttribute ? el.getAttribute("data-house") : null;
        if (!act) return;
        event.stopPropagation();
        /* BOTH CONTROLS CLOSE IT, AND NOTHING ELSE HAPPENS — the skip that used to follow
           Confirm is deleted on purpose (see the block's header). */
        box.remove();
      });
      document.body.appendChild(box);
    };
    var betaNotice = function () {
      if (!HOSTED) return;
      if (DOOR !== "registered") return; /* the notice is the beta's — every other door is preset completed */
      if (window.__houseBetaNoticeHooked) return;
      window.__houseBetaNoticeHooked = true;
      document.addEventListener("click", function (event) {
        var wiz = betaWizard();
        if (!wiz || !wiz.contains(event.target)) return;
        if (betaHeading(wiz).indexOf("Choose your agent") === -1) return;
        var el = event.target;
        while (el && el.tagName !== "BUTTON") el = el.parentElement;
        if (!el) return;
        var text = (el.textContent || "").trim();
        if (text === "Skip for now" || text === "Back") return;
        /* capture phase: React never sees the click, so nothing selects and Next never fires */
        event.stopPropagation();
        event.preventDefault();
        betaModal();
      }, true);
    };
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
    /* ── THE PIN DOOR OPENS ON THE WORKING MODEL — NO WIZARD (owner, 2026-10-04, last) ─────
       The wizard is the REGISTERED door's way in and nobody else's: *"That process is not
       supposed to exist for the pin gate. It's only available if you click the register for
       the beta."* The earlier cut deleted these two functions so the wizard walked for every
       door; they return here, door-scoped, and the beta's own walk stays honest — the
       zero-trust ruling that deleted the pass-through still stands for it.
       1. THE FLOW IS COMPLETED — `openhands-onboarded` is what the app writes when the flow
          is finished or skipped; seeding it means the wizard never appears. Safe only
          because the service injects its key (local mode — the entrypoint's job 1); a
          `--public` service must not preseed.
       2. THE GETTING-STARTED CHECKLIST DEFAULTS OFF — dismissed-if-absent. */
    var preseedFirstRun = function () {
      try {
        /* PARKED (owner, 2026-10-06 — see PARK_ONBOARDING above): every door gets the
           completed preset; the registered re-arm stays suspended until the owner is ready
           for real accounts. */
        if (PARK_ONBOARDING) {
          if (localStorage.getItem("openhands-onboarded") === null) {
            localStorage.setItem("openhands-onboarded", "1");
          }
          if (localStorage.getItem("openhands-sidebar-onboarding-checklist-dismissed") === null) {
            localStorage.setItem("openhands-sidebar-onboarding-checklist-dismissed", "true");
          }
          return;
        }
        var door = DOOR;
        if (door === "registered") {
          /* the wizard IS the registered user's way in: undo a stale completed-preset ONCE
             (a browser that carries it from the demo), after which the wizard's own completion
             marker rules. Re-arm by deleting `house_welcome_granted`. */
          if (localStorage.getItem("house_welcome_granted") === null) {
            localStorage.removeItem("openhands-onboarded");
            localStorage.setItem("house_welcome_granted", "1");
          }
          return;
        }
        if (!HOSTED && door !== "dev") return; /* the Mac workbench, opened directly, keeps its wizard */
        if (localStorage.getItem("openhands-onboarded") === null) {
          localStorage.setItem("openhands-onboarded", "1");
        }
        if (localStorage.getItem("openhands-sidebar-onboarding-checklist-dismissed") === null) {
          localStorage.setItem("openhands-sidebar-onboarding-checklist-dismissed", "true");
        }
      } catch (e) {}
    };
    var skipSetupSteps = function () {
      /* THE BACKSTOP FOR THE PIN DOOR ALONE — WIDENED WHILE PARKED (owner, 2026-10-06):
         should the wizard ever appear anyway (a hand-cleared store, a future build), its
         steps after the first click the wizard's own "Skip for now": hosted and the pin
         door as before, and while PARK_ONBOARDING every door including the registered
         walk — the parked state promises nobody meets the wizard; never during a
         `?previewOnboardingStep=` design preview. */
      if (!PARK_ONBOARDING) {
        if (!HOSTED) return;
        if (DOOR === "registered") return;
      }
      if (location.search.indexOf("previewOnboardingStep") !== -1) return;
      var hasBackend = false;
      try { hasBackend = localStorage.getItem("openhands-backends") !== null; } catch (e) { return; }
      if (!hasBackend) return;
      var wiz = document.querySelector("div.fixed.inset-0.flex.items-center.justify-center");
      if (!wiz) return;
      var heading = wiz.querySelector("h1,h2,h3");
      var title = heading ? heading.textContent : "";
      if (title.indexOf("Add a backend") !== -1) return;
      var buttons = wiz.querySelectorAll("button");
      for (var b = 0; b < buttons.length; b++) {
        if (buttons[b].textContent.trim() === "Skip for now") { buttons[b].click(); return; }
      }
    };
    /* 3. THE SIDEBAR STARTS COLLAPSED (owner, 2026-10-05): the left navigation opens as its
       icon rail, not the expanded menu. The app's sidebar store keeps its choice under
       `openhands-sidebar` and carries a one-shot migration from the older raw key
       `openhands-sidebar-collapsed` (src/stores/sidebar-store.ts): it seeds the store from
       that older key ONCE, and only while the new key is absent. So this seeds the older
       key before the bundle boots — and then gets out of the way: the first toggle writes
       `openhands-sidebar`, and the person's choice rules from then on ("default", not
       "forced"). NOT door-scoped — a layout default is not the wizard's business; every
       door gets the same rail. No hashed asset is touched: index.html is served no-store,
       so unlike the stylesheet this cannot hide behind a year of immutable cache. */
    var preseedSidebar = function () {
      try {
        if (localStorage.getItem("openhands-sidebar") !== null) return;
        if (localStorage.getItem("openhands-sidebar-collapsed") === null) {
          localStorage.setItem("openhands-sidebar-collapsed", "true");
        }
      } catch (e) {}
    };
    /* EVERY ENTRY GUARDED ON ITS OWN (2026-10-04). Measured: one throw anywhere in this list
       aborted everything after it — and the later the entry, the quieter the loss. So no
       step may take another down. The door-switch entries are idempotent and self-healing
       (preseedFirstRun re-asserts the preset; the listeners hook once behind their flags). */
    var run = function (fn) { try { fn(); } catch (e) { console.error("[house-patch]", e); } };
    run(set); setTimeout(function () { run(set); }, 600);
    setTimeout(function () { run(set); }, 2200); setTimeout(function () { run(set); }, 4000);
    run(relabel); setTimeout(function () { run(relabel); }, 600);
    run(preseedFirstRun);
    run(preseedSidebar);
    run(betaNotice); setTimeout(function () { run(betaNotice); }, 1000);
    run(skipSetupSteps); setTimeout(function () { run(skipSetupSteps); }, 600);
    setTimeout(function () { run(skipSetupSteps); }, 2200); setTimeout(function () { run(skipSetupSteps); }, 4000);
    setTimeout(function () { run(relabel); }, 2200); setTimeout(function () { run(relabel); }, 4000);
    new MutationObserver(function () { run(relabel); run(betaNotice); run(skipSetupSteps); }).observe(document.documentElement, { childList: true, subtree: true });
  })();
</script>'''
script = script.replace("__HOUSE_HOSTED__", "true" if hosted == "1" else "false")
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
