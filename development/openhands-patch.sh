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
#      The "Skip for now" control is deliberately left alone ON THE MAC — but the HOSTED
#      copy (2026-10-04, run with `--hosted`, as the service's Dockerfile does) turns the
#      first-run flow into NO FIRST-RUN FLOW AT ALL, the owner's ask twice over:
#        · *"we should disable the onboarding setup process"* (2026-10-04) — and then,
#          watching a fresh incognito window: *"every single person that views this will be
#          seeing it for the first time … just add the back in so that it's not asking the
#          user or the visitor."* The service runs the tool in LOCAL mode, so the backend is
#          ALREADY there when a page loads (the entrypoint's job 1); this script adds the
#          client half: the flow is PRESET COMPLETED (openhands-onboarded, when absent), so
#          the wizard — "Add a backend" and every step after it — never appears for anyone.
#        · THE AUTO-SKIP STAYS AS A BACKSTOP: should the wizard ever appear anyway (a
#          hand-cleared store, a future build), its steps after the first click the
#          wizard's own "Skip for now" (exact text, once, never during a
#          `?previewOnboardingStep=` design preview).
#        · THE GETTING-STARTED CHECKLIST DEFAULTS OFF (dismissed-if-absent — the Settings
#          toggle can bring it back for anyone who wants it).
#   6. THE TAB TITLE (2026-10-04): the vendor's name is in <title> — visible in every tab and
#      every bookmark, and the one branding no stylesheet can reach — so it is rewritten to the
#      house title ("Raibach — Agent Canvas", the same pattern as the site's own). Forced on
#      every run; a rebuild cannot leave it unpatched for long.
#   7. THE BETA NOTICE ON THE REGISTERED DOOR (2026-10-04): the wizard is kept whole — every
#      step-by-step panel, including the LLM panel that shows the model is set — but on the
#      hosted beta the agent tiles are informational (no credentials in this container, and
#      nothing for anyone to enter). Any tile click or Next opens one modal with the owner's
#      sentence; Confirm pins the default row, advances one step onto the LLM panel, and that
#      panel's untouched Next passes through without a save. dev@local (the pin) never sees
#      any of this: the behavior is gated on `house_door=registered`, not on the deployment.
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
       user — wizard is theirs, and the beta notice below applies) or 'dev' (the pin) or ""
       (older sessions). builder-embed.ts appends it; everything door-dependent reads it here. */
    var DOOR = (location.search.match(/[?&]house_door=([a-z]+)/) || [])[1] || "";
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
    /* THE HOSTED COPY'S FIRST-RUN FLOW — NONE OF IT (owner, 2026-10-04: *"we should disable
       the onboarding setup process … the getting started process"*, then, watching a fresh
       incognito window: *"every single person that views this will be seeing it for the
       first time … just add the back in so that it's not asking the user or the visitor."*)
       Two presets, both "only when absent", both exact and idempotent:
       1. THE FLOW IS COMPLETED — `openhands-onboarded` is what the app writes when the flow
          is finished or skipped; seeding it means the wizard never appears for a first-time
          visitor. ⚠️ SAFE ONLY BECAUSE THE SERVICE INJECTS ITS KEY (local mode — the
          entrypoint's job 1): with NO backend the app renders a white page behind the
          wizard (measured 2026-10-04); if this service is ever put back into `--public`
          mode, this preset must come out with it.
       2. THE GETTING-STARTED CHECKLIST DEFAULTS OFF — dismissed-if-absent, so the Settings
          toggle can bring it back for anyone who wants it. */
    var preseedFirstRun = function () {
      try {
        /* THE DOOR THE VISITOR CAME THROUGH (2026-10-04): the shell appends `house_door` to
           this page's address (builder-embed.ts) — `registered` for a person who signed up,
           `dev` for the pin (dev@local). Their two behaviors, stated once:
             · registered — the onboarding wizard (the model setup) IS the way in, so the
               completed-preset below must not stand for them: undo it ONCE (for a browser
               that carries it from the demo), after which the wizard's own completion marker
               rules. Re-arm by deleting `house_welcome_granted`.
             · dev — the demo identity keeps the tool's current state, no wizard: the preset
               is asserted whenever it is absent, so it also REPAIRS itself after any test
               that re-opened the wizard.
           A browser with no marker at all (older sessions) falls through to the old rules. */
        var door = DOOR;
        if (door === "registered") {
          if (localStorage.getItem("house_welcome_granted") === null) {
            localStorage.removeItem("openhands-onboarded");
            localStorage.setItem("house_welcome_granted", "1");
          }
          return;
        }
        if (!HOSTED && door !== "dev") return;
        if (localStorage.getItem("openhands-onboarded") === null) {
          localStorage.setItem("openhands-onboarded", "1");
        }
        if (localStorage.getItem("openhands-sidebar-onboarding-checklist-dismissed") === null) {
          localStorage.setItem("openhands-sidebar-onboarding-checklist-dismissed", "true");
        }
      } catch (e) {}
    };
    var skipSetupSteps = function () {
      if (!HOSTED) return;
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
    /* ── THE BETA'S ONE HONEST SENTENCE, AND THE STEP IT SKIPS (owner, 2026-10-04) ──────────
       The hosted beta runs on the provided model, so the agent tiles are informational: a
       choice of Claude Code / Codex / Gemini CANNOT work here (no credentials in this
       container — the trap measured on the local run), and there is no API key for anyone to
       enter. So on the registered door, any tile click — or the step's Next — opens one modal
       with the owner's words verbatim; Confirm pins the default "Sovereign local model" row,
       advances, and passes the LLM step through WITHOUT a save (its untouched form falls
       through by design — setup-llm-step.tsx), landing on "Say hello". Cancel dismisses and
       leaves the wizard exactly where it was; "Skip for now" is the vendor's dismiss and is
       deliberately left alone. The tiles never select (capture-phase interception), so no
       per-visitor agent choice can reach the one shared configuration. */
    var BETA_MESSAGE =
      "This beta runs on the hosted service with the provided model; sovereignty — your own " +
      "models, local or cloud, on your own machine — arrives with the installed suite.";
    var betaBypass = false;
    var betaWizard = function () {
      return document.querySelector("div.fixed.inset-0.flex.items-center.justify-center");
    };
    var betaHeading = function (wiz) {
      /* EVERY SLIDE STAYS MOUNTED — only the ACTIVE one is in normal flow, the rest are
         absolutely positioned (onboarding-modal.tsx). So the active panel's heading is the
         first heading with NO absolutely-positioned ancestor between it and the wizard; the
         first DOM heading would always be "Choose your agent" and would make the modal fire
         on the LLM panel's buttons too (caught in review, 2026-10-04). */
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
        if (act === "cancel") { box.remove(); return; }
        box.remove();
        betaConfirmAndAdvance();
      });
      document.body.appendChild(box);
    };
    var betaClickNext = function (wiz) {
      /* THE ACTIVE SLIDE'S OWN NEXT — every step is mounted at once, so a plain query reaches
         the WRONG step's button. The in-flow button is the one whose ancestor walk never hits
         an absolutely-positioned node — the same rule betaHeading uses for headings. */
      var bs = wiz.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) {
        if (bs[i].textContent.trim() !== "Next") continue;
        var node = bs[i];
        var inactive = false;
        while (node && node !== wiz) {
          if (getComputedStyle(node).position === "absolute") { inactive = true; break; }
          node = node.parentElement;
        }
        if (!inactive) {
          betaBypass = true;
          bs[i].click();
          setTimeout(function () { betaBypass = false; }, 500);
          return true;
        }
      }
      return false;
    };
    var betaRestoreProfile = function () {
      /* UNDO THE PASS-THROUGH'S SAVE. The LLM panel's Next persists its pre-selected default
         (gpt-5.6-sol, blank key) on the way past — the exact overwrite the hosted drift guard
         repairs on a 45s clock; measured here, 2026-10-04, from the beta walk itself. The
         profile that was active BEFORE the walk (snapshotted in betaConsent) is re-activated
         a moment after the save lands, which applies its model and key back onto the
         settings. Same mechanism the entrypoint's seed uses; no drift loop needed. */
      var profile = window.__houseBetaRestoreProfile;
      var key = window.__AGENT_CANVAS_SESSION_API_KEY__;
      if (!profile || !key) return;
      setTimeout(function () {
        try {
          fetch("/api/profiles/" + encodeURIComponent(profile) + "/activate", {
            method: "POST",
            headers: { "X-Session-API-Key": key },
          }).catch(function () {});
        } catch (e) {}
      }, 1500);
    };
    var betaConfirmAndAdvance = function () {
      var wiz = betaWizard();
      if (!wiz) { betaBypass = false; return; }
      /* pin the default row — a non-default choice must never be saved */
      betaBypass = true;
      var buttons = wiz.querySelectorAll("button");
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.indexOf("Sovereign local model") !== -1) { buttons[i].click(); break; }
      }
      betaBypass = false;
      /* SKIP THE MODEL-PARAMETER STEP (owner, 2026-10-04: *"it's supposed to skip the third
         step which is where you enter your parameters for your model. It should just go to
         the third step."*): forward twice — agent → LLM panel → "Say hello" — then repair
         what the pass-through saved (betaRestoreProfile above). */
      if (!betaClickNext(wiz)) { betaBypass = false; return; }
      var tries = 0;
      var tick = setInterval(function () {
        tries += 1;
        var w = betaWizard();
        if (!w) { clearInterval(tick); betaBypass = false; return; }
        var heads = w.querySelectorAll("h1,h2,h3");
        var active = "";
        for (var h = 0; h < heads.length; h++) {
          var node = heads[h];
          var inactive = false;
          while (node && node !== w) {
            if (getComputedStyle(node).position === "absolute") { inactive = true; break; }
            node = node.parentElement;
          }
          if (!inactive) { active = heads[h].textContent; break; }
        }
        if (active.indexOf("Set up your LLM") !== -1) {
          betaClickNext(w);
        } else if (active.indexOf("Say hello") !== -1 || tries > 40) {
          clearInterval(tick);
          betaBypass = false;
          betaRestoreProfile();
        }
      }, 200);
    };
    var betaConsent = function () {
      if (DOOR !== "registered") return;
      if (window.__houseBetaHooked) return;
      window.__houseBetaHooked = true;
      /* SNAPSHOT THE ACTIVE PROFILE BEFORE THE WALK — the pass-through of the LLM panel can
         overwrite the model with the onboarding default; this is what betaRestoreProfile
         re-activates afterwards. Fire-and-forget; absent data simply skips the repair. */
      try {
        var key0 = window.__AGENT_CANVAS_SESSION_API_KEY__;
        if (key0) {
          fetch("/api/settings", { headers: { "X-Session-API-Key": key0 } })
            .then(function (r) { return r.json(); })
            .then(function (s) { window.__houseBetaRestoreProfile = s.active_profile || null; })
            .catch(function () {});
        }
      } catch (e) {}
      document.addEventListener("click", function (event) {
        if (betaBypass) return;
        if (DOOR !== "registered") return;
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
    /* EVERY ENTRY GUARDED ON ITS OWN (2026-10-04). Measured: one throw anywhere in this list
       aborted everything after it — and the later the entry, the quieter the loss (the beta
       interceptor never attached while the palette, which is CSS, still looked right). So no
       step may take another down, and betaConsent gets a late re-assert as well: attaching a
       listener is idempotent behind its own `__houseBetaHooked` flag. */
    var run = function (fn) { try { fn(); } catch (e) {} };
    run(set); setTimeout(function () { run(set); }, 600);
    setTimeout(function () { run(set); }, 2200); setTimeout(function () { run(set); }, 4000);
    run(relabel); setTimeout(function () { run(relabel); }, 600);
    setTimeout(function () { run(relabel); }, 2200); setTimeout(function () { run(relabel); }, 4000);
    run(preseedFirstRun);
    run(betaConsent); setTimeout(function () { run(betaConsent); }, 1000);
    run(skipSetupSteps); setTimeout(function () { run(skipSetupSteps); }, 600);
    setTimeout(function () { run(skipSetupSteps); }, 2200); setTimeout(function () { run(skipSetupSteps); }, 4000);
    new MutationObserver(function () { run(relabel); run(skipSetupSteps); }).observe(document.documentElement, { childList: true, subtree: true });
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
