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
#      THE FIRST-RUN FLOW IS THE TOOL'S OWN, NOWHERE SUPPRESSED (2026-10-04, late). There was
#      a hosted-only suppression layer here — the flow preset completed, an auto-clicker for
#      the wizard's "Skip for now", a modal that passed the LLM/parameters slide through —
#      built in response to the owner's earlier "nobody is asked for anything" ruling. The
#      owner then caught it from the outside and named it for what it was: *"we worked very
#      hard on creating the onboarding screen … then skip the third step to avoid showing the
#      parameters screen … We did a lot of work to suppress an error. Skip this process makes
#      me suspicious that it's not working correct."* — *"That's error suppression … It has
#      to fail hard. You can't skip things for convenience. This is a zero-trust
#      application."* The layer is DELETED (the block in the ground script says where), and
#      the wizard stands everywhere exactly as the tool ships it: every step visible, every
#      save kept; skipping a step is the visitor's own choice through the vendor's own
#      control. What remains hosted-only is provisioning, not suppression: the entrypoint
#      still injects the session key (the backend is present when a page loads) and seeds
#      the provided model — a visitor has no key to type, and the seed is what makes the
#      workspace usable after the walk.
#   6. THE TAB TITLE (2026-10-04): the vendor's name is in <title> — visible in every tab and
#      every bookmark, and the one branding no stylesheet can reach — so it is rewritten to the
#      house title ("Raibach — Agent Canvas", the same pattern as the site's own). Forced on
#      every run; a rebuild cannot leave it unpatched for long.
#   7. THE BETA NOTICE (2026-10-04): deleted with the suppressions that night, then restored
#      the same hour — the notice without the skip (the ground script's block carries the
#      ruling). Since item 8 the wizard never opens for visitors, so the notice has nothing
#      to intercept; its code stays as the guard it always was.
#   8. THE WIZARD IS OFF (owner, 2026-10-06: *"we don't need the wizard you can disable the
#      wizard. It was a part of the demo process."*). The first-run modal is not part of this
#      product: a dedicated block — `house-patch-firstrun` — writes `openhands-onboarded`
#      (the exact completion state the wizard itself writes) before any of the app's own
#      scripts can run, so the modal never mounts, for every visitor, on both runs (the same
#      script is applied to the Mac's build and to the hosted image alike). It cannot live
#      in the ground script: that runs at the end of the body, and the app's bundle is an
#      async module — on a warm cache it can execute first. It lives INSTEAD in the head's
#      TRAILING ZONE — the last nodes before </head>, together with the stylesheet link —
#      and the zone is the #418 lesson below.
#      WHY THE TRAILING ZONE (measured 2026-10-06): with the house nodes among the elements
#      the app's own hydration walks, the console ran React's #418 on EVERY load — the full
#      arrangement 6/6 reloads; the flag at the top of <head> (css link absent) 3/3; the
#      css link right after the root css link, alone, 3/3; with every house node absent,
#      clean. Moved into the trailing zone — after everything the app renders, before
#      </head>, the zone the launcher's own injected session script lands in — the page
#      hydrated clean: reload after reload, plus a fresh-profile simulation. The head keeps
#      the app's order; the house keeps to its back.
#      This is NOT the 2026-10-04 suppression returning: nothing is clicked, skipped
#      mid-flow, or papered over — the flow never starts; a real failure still fails loud
#      on its own surface. The vendor's design door stays open:
#      ?previewOnboardingStep=<0-3> still opens the flow for review without persisting
#      completion — the preview path bypasses the gate and never reads this preset.
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
# image, straight from the app's assets — same file, same repeat; 2026-10-06: the artwork is
# now the owner's JPEG, and the extension follows the source).
TILE_SRC="$(cd "$(dirname "$0")" && pwd)/../frontend/src/assets/canvas-development-lab-bkg.jpg"
TILE_NAME=""
if [ -f "$TILE_SRC" ]; then
  TILE_EXT="${TILE_SRC##*.}"
  TILE_NAME="house-patch-tile-$(shasum -a 256 "$TILE_SRC" | cut -c1-10).${TILE_EXT}"
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

# The stylesheet link: strip any older house-patch link (any name, with or without ?v=).
# The fresh link is written last, in the head's TRAILING ZONE — together with the first-run
# flag, immediately before </head>. Why there and not after the app's root css link (its old
# home): the #418 measurement of 2026-10-06 — see the note above the combined insertion at
# the bottom of this script.
link = f'<link rel="stylesheet" href="/assets/{name}"/>'
src2 = re.sub(r'\s*<link rel="stylesheet" href="/assets/house-patch[^"]*"/>', '', src)

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
       --hosted; the Mac does not). It gates the beta notice below (the beta is the hosted
       service's own story — see its block). It does NOT gate THE WIZARD IS OFF: the owner
       ruled the first-run flow out of the product on BOTH runs (2026-10-06), and that flag
       is written by its own block at the end of <head>, before anything can read it. */
    var HOSTED = __HOUSE_HOSTED__;
    /* WHICH DOOR THIS PAGE WAS REACHED THROUGH (2026-10-04): 'registered' (a signed-up beta
       user) or 'dev' (the pin) or "" (older sessions). builder-embed.ts appends it. Nothing
       door-dependent remains in this script — the suppressions that read it are deleted
       (see the block above `run(set)`) — and the variable stays as the page's record of
       where its visitor came from, for whatever the next door-dependent piece needs. */
    var DOOR = (location.search.match(/[?&]house_door=([a-z]+)/) || [])[1] || "";
    /* ── THE WIZARD IS OFF — written at the end of <head>, not in this script ────────────────
       (house-patch-firstrun). The first-run flag must be down before ANY of the app's scripts
       can run, and this script sits at the end of the body: the app's bundle is an ASYNC
       module, so on a warm cache it can execute before a write placed here would land. The
       flag's block is deliberately in the head's TRAILING ZONE (its note carries the
       owner's ruling, the mechanics, what the flag is not, and why the zone is what it
       is). Nothing below depends on this script writing it. */
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
       that used to follow Confirm stays deleted; the owner's zero-trust ruling above is why.)
       NOTE (2026-10-06): the wizard no longer opens for visitors (THE WIZARD IS OFF — the
       house-patch-firstrun block, in the head's trailing zone), so nothing reaches this
       notice on a normal visit; it stays as written for any surface that ever shows the
       flow again (the design preview). */
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
    /* ── THE SUPPRESSIONS ARE GONE (owner, 2026-10-04, late) ────────────────────────────────
       The owner, watching the hosted workspace: *"we worked very hard on creating the
       onboarding screen … then skip the third step to avoid showing the parameters screen
       for APIs. We did a lot of work to suppress an error. Skip this process makes me
       suspicious that it's not working correct."* And, plainly: *"That's error suppression.
       … It has to fail hard. You can't skip things for convenience. This is a zero-trust
       application."* So the hosted copy no longer:
         · presets the first-run flow as completed (preseedFirstRun — deleted);
         · auto-clicks the wizard's "Skip for now" (skipSetupSteps — deleted);
         · intercepts the agent tiles and passes the LLM/parameters slide through behind a
           modal, restoring the profile afterwards (the beta-notice machinery — deleted,
           including its "third step" skip and the snapshot/repair that papered over the
           save that pass-through made).
       The wizard then walked exactly as the tool ships it — every step visible, every save
       kept; a step a visitor skipped was that visitor's own choice through the vendor's own
       control. The records promised this re-introduction ("the onboarding was parked, not
       lost"); this deletes exactly the switches they named. The chrome patches — palette,
       logo, tile, labels — are untouched: they are looks, not skips.
       UPDATE (2026-10-06): the wizard itself is now off for everyone — see THE WIZARD IS
       OFF, the house-patch-firstrun block (in the head's trailing zone; it is not
       written in this script — why: that block's note). It starts nothing and skips
       nothing: it writes the completion state before first paint, so the flow never begins.
       The distinction is kept on purpose — the 2026-10-04 cut removed clicks and
       pass-throughs that hid a RUNNING process; the 2026-10-06 ruling removed the process
       from the product. Failures still fail loud. */
    /* EVERY ENTRY GUARDED ON ITS OWN (2026-10-04). Measured: one throw anywhere in this list
       aborted everything after it — and the later the entry, the quieter the loss. So no
       step may take another down. What runs below is chrome only: the ground, the labels. */
    var run = function (fn) { try { fn(); } catch (e) {} };
    run(set); setTimeout(function () { run(set); }, 600);
    setTimeout(function () { run(set); }, 2200); setTimeout(function () { run(set); }, 4000);
    run(relabel); setTimeout(function () { run(relabel); }, 600);
    run(betaNotice); setTimeout(function () { run(betaNotice); }, 1000);
    setTimeout(function () { run(relabel); }, 2200); setTimeout(function () { run(relabel); }, 4000);
    new MutationObserver(function () { run(relabel); run(betaNotice); }).observe(document.documentElement, { childList: true, subtree: true });
  })();
</script>'''
script = script.replace("__HOUSE_HOSTED__", "true" if hosted == "1" else "false")
src2 = src2.replace("</body>", script + "\n  </body>", 1)

# ── THE HEAD'S TRAILING ZONE — the stylesheet link + the first-run flag (2026-10-06) ─────────
# BOTH house head nodes go in here, in this order — the css link, then the flag — immediately
# before </head>, after every element the app itself renders. Still the head, so still before
# any body script: the app's bundle is an async module in the body, and the flag must be down
# before the first render can read it. WHY NOT THE OLD HOMES (flag at the top of <head>, link
# after the root css link): the #418 measurement of 2026-10-06 — with those nodes among the
# app's own head elements the console ran React's #418 hydration failure on EVERY load of
# the dev tool (full arrangement 6/6 reloads; flag at the top, link absent: 3/3; link alone,
# mid-head: 3/3; with every house node absent: clean). In the trailing zone — the zone the
# launcher's own injected session script lands in — the page hydrated clean: every reload,
# plus a fresh-flag simulation. Same discipline as everything else here: strip-if-present,
# insert only here, and FAIL HARD if either node or the anchor cannot be placed.
src2 = re.sub(r'\s*<script id="house-patch-firstrun">.*?</script>', '', src2, flags=re.S)
firstrun = '''<script id="house-patch-firstrun">
  /* ── THE WIZARD IS OFF (owner, 2026-10-06) ───────────────────────────────────────────────
     The owner, meeting the first-run modal again on a fresh browser: *"we don't need the
     wizard you can disable the wizard. It was a part of the demo process."* The vendor's
     onboarding modal is not part of this product, so the completion state it writes when
     it finishes is written HERE — in the head's TRAILING ZONE (the last nodes in the
     head, after everything the app itself renders — the #418 measurement of 2026-10-06
     put it here; see the patch script). Any <head> script runs before any body script, and
     the app's bundle is an async module in the body — so this write is always down before
     the first render can read it, which an end-of-body write cannot promise on a warm
     cache. For every visitor, on both runs (the same script is applied to the Mac's build
     and to the hosted image alike). The modal then never mounts. NOT one of the switches
     deleted on 2026-10-04 coming back: nothing is clicked, skipped mid-flow, or papered
     over — the
     flow never starts; a real failure still fails loud on its own surfaces (seed, settings,
     conversations). The vendor's design door stays open: ?previewOnboardingStep=<0-3> still
     opens the flow for review without persisting completion. ⚠️ ASSUMES LOCAL MODE — the
     backend is already present when a page loads (the hosted entrypoint injects its session
     key; the Mac's run is the same mechanism). With NO backend at all, the workspace has
     nothing to show and no wizard would offer to add one — revisit this preset if the tool
     ever runs `--public`. */
  try {
    if (localStorage.getItem("openhands-onboarded") === null) {
      localStorage.setItem("openhands-onboarded", "1");
    }
  } catch (e) {}
</script>'''
if "</head>" not in src2:
    raise SystemExit("❌ could not place the head's trailing zone (no </head> in index.html)")
tail = "\n    " + link + "\n    " + firstrun + "\n  "
src2 = re.sub(r'\s*</head>', lambda m: tail + "</head>", src2, count=1)
if link not in src2 or '<script id="house-patch-firstrun">' not in src2:
    raise SystemExit("❌ could not place the stylesheet link / first-run flag")
# SINGULARITY GUARD (learned the hard way, 2026-10-06): the launcher injects its session
# script at the FIRST closing-head tag it finds — a stray one written inside a comment up
# in the head (exactly this happened: this block's own comment mentioned it) made the
# launcher inject INTO that script and broke the page ("Invalid or unexpected token").
# So: house nodes singular, closing tags unique. FAIL HARD otherwise.
if (src2.count("</head>") != 1 or src2.count("</body>") != 1
        or src2.count('<script id="house-patch-firstrun">') != 1
        or src2.count('<script id="house-patch-ground">') != 1 or src2.count(link) != 1):
    raise SystemExit("❌ index.html: house nodes / closing tags must each be exactly one")

if src2 != src:
    open(p, "w").write(src2)
    print("✅ index.html: link + first-run flag + ground script in canonical form")
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
