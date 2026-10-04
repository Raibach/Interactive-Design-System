# The Development room — OpenHands' Agent Canvas (plan + record)

Written 2026-10-04, late. The owner: *"I think this one will work better. Check it out — all the
other one, bolt, is not gonna cut it. It's not designed properly for what I want."* This file is
the Development room's own record, the way `PRODUCT-TEAM-SOLUTION.md` is the Product room's.

## What this room is

**The developer-facing sibling of the Product room.** Product is the ideation sandbox (a
product person prompts a page into being); Development is where real agents WORK — on code, in
repositories, with tools. The owner's framing matches the tools: Product runs a builder;
Development runs an agent control center.

## The candidates, and the verdicts

| candidate | shape | verdict |
|---|---|---|
| **bolt.diy** (MIT) | web app on a port, apps run in-browser via WebContainers | **REPLACED.** Its runtime needs cross-origin isolation (`SharedArrayBuffer requires self.crossOriginIsolated` — proven live in the console), and a page nested in an iframe can never have it. It could show its UI in the room and nothing else; the strip + "open in its own window" door was the honest patch, and the owner's verdict ("not designed properly for what I want — that's a vibecoding thing") closed it. `/development/bolt.diy` stays on disk, unpointed; its preview may still run on :3230. |
| **OpenHands Agent Canvas** (MIT) | npm package (`@openhands/agent-canvas` 1.24.0) + Electron shell; serves a **web UI on a port**; agent sandboxes in Docker, on VMs, or LOCAL | **IN — the room's tool now.** |
| **Dyad** | Electron desktop app | not embeddable, never was; left alone. |

## What stands, driven (2026-10-04, late)

1. **Installed**: `npm install -g @openhands/agent-canvas` (exit 0; binary at
   `/opt/homebrew/bin/agent-canvas`). Prereqs on this machine: Node 24 ✓, `uv` ✓
   (`~/.local/bin/uv`). Docker is **not** installed.
2. **Booted**: `agent-canvas -p 8090` — the ingress (default 8000 is THIS APP's backend port,
   hence 8090) serves the static frontend and proxies the agent server that `uvx` starts
   behind it (first boot downloads its Python deps, ~a minute). Verified: **HTTP 200,
   `<title>OpenHands</title>`** at `http://localhost:8090/`.
3. **In the room**: the Development tab (the last dead stub, live since the bolt.diy pass)
   embeds it plain — `<builder-embed key="openhands-room" src="http://localhost:8090/">`,
   no strip, no door, because unlike bolt.diy this app needs no isolation. Frontend `tsc`
   exit 0.

## The plan (for the next session, in order)

1. **The agent's model.** Configure it in the app's own settings (OpenHands speaks LiteLLM —
   OpenAI-compatible providers, so the house's hosted DeepSeek fits; the API's model list here
   offers `deepseek-v4-pro` / `deepseek-flash`). Decide whether to preseed its config
   (`~/.openhands`) so nobody types a key, the way the builder's engine holds its own.
2. **THE ONE REAL DECISION — the sandbox.** Local mode (what is booted now) runs the agent
   **directly on this machine with full filesystem access** (the README's own warning, verbatim
   in spirit: *"the agent will have full access to your filesystem"*). Docker sandbox mode
   (Options 2/3) is the contained path and needs **Docker Desktop installed** — a user install,
   and the right default before anyone but the owner uses this room. Until then the room is a
   workbench for the owner alone.
3. **Lifecycle, the `dev:local` lesson applied.** Add a start script (builder's
   `local-vcaas/start.mjs` is the pattern) that boots Agent Canvas on 8090, and the Product
   room's health-door pattern — a banner that says plainly when the server is down instead of
   an empty frame (`/api/builder/health` is the model).
4. **The bridge (when the room wants parity).** The Product room's bridge is the proven shape:
   one row per thing on the console, a category of its own, a reference not a copy, publish =
   the commit. For Development the "thing" is a **conversation/task** (its projects live in the
   agent server), and the same questions apply: which ones become cards, what the card says,
   what publishing means. OpenHands' own API (it has one — `/api/automation/docs` is served
   from the ingress) is the fact to read, not invent.
5. **Styling**: last, as everywhere — and the same caveat: Agent Canvas is a vendored app, so
   prefer its own theme knobs over rewriting its components.

## What NOT to do

- **Don't try to embed bolt.diy again.** The isolation requirement is a browser law, not a
  configuration.
- **Don't run the full-access local mode for anyone but the owner.** The room's users are
  developers, but that is not the same as "trust the agent with the machine".
- **Don't invent a second card/publish shape.** The Product room's bridge answered those
  questions with the owner's words; reuse them.

## The onboarding, answered (owner's question, 2026-10-04 late)

*"I like that onboarding experience … I wonder if we can restore that for new users and how we
can keep that as part of the process. It says 'skip for now' — I'm assuming once it's set up
it's not ever presented again."*

Read from its source, and the assumption is right — with one word to fix: **per BROWSER, not
per user.** `OnboardingHost` (mounted in the root layout) shows the welcome flow whenever the
localStorage key **`openhands-onboarded`** is absent on the OpenHands origin (:8090), and
"skip for now" writes exactly that key, same as completing it. Nothing server-side remembers it;
the agent's settings live in its own config, the DONE-flag lives in the browser.

What follows from that, concretely:

- **"Restore for new users" is already the default.** A new person, a fresh browser profile, or
  an incognito window gets the flow again, untouching anything.
- **To see it again yourself**: clear `openhands-onboarded` for localhost:8090 (DevTools →
  Application → Local Storage), open a private window, or use its own built-in preview:
  `http://localhost:8090/?previewOnboardingStep=0` (steps 0–3) shows a single slide for design
  review without touching state.
- **Per-account onboarding is the one thing that is NOT possible as-is** — the flag is
  browser-local and CROSS-ORIGIN: the app at :5001 can neither read nor write :8090's storage.
  If a person must see the flow once per ACCOUNT (not per browser), the honest paths are: serve
  OpenHands same-origin through this app (the `/api/preview` proxy pattern already in the tree,
  which would make the state ours to manage), or ask upstream for a reset parameter. Recommend
  per-browser for now — it is how OpenHands itself thinks, and no plumbing is needed.

**Two decisions recorded, same night (owner):** (1) **THE BRANDING STAYS.** *"I think I'm just
gonna leave OpenHands branded as is — it's a nice touch to show how we can import other
applications into this harness"* — no white-labelling, and none is owed: it is MIT, and the
point it makes (this harness absorbs other real applications) is worth more than a matched
logo. (2) **THE ONBOARDING NEEDS NOTHING.** The owner considered making it required/undismissible
and then answered his own question: *"we don't need to always show"* — the default (once per
BROWSER, the `openhands-onboarded` localStorage key) is what the room wants. No code changed.
The replay recipes, in case a demo ever needs them: clear that key for localhost:8090, use a
private window — or load `http://localhost:8090/?previewOnboardingStep=0`, which is OpenHands'
own non-persisting preview (its modal's `isPreview` prop: *"skip/close does not persist
onboarding completion"*), i.e. the exact "cannot be dismissed for keeps" behaviour behind one
URL parameter, no fork required.

## The staged opening — built and DRIVEN, the same night (2026-10-04, late)

The owner: *"I want to create an assembly effect similar to our other pages with a background …
you could use it as a 10 second delay … and then I wanted to ease in like composer and design …
Right now there's a white splash before the thing loads. We don't want that."* Built exactly so,
and every beat seen in a live browser (not inferred):

- **The ground is his own tile** (`canvas-development-lab-bkg.png`, the dark graph-paper grid —
  *"god knows it's gotta be gray"*), tiled across the pane, with the assembly gate's own amber
  ring and one neutral line: *"Standing up the development workspace…"*.
- **The white splash is gone by construction**: the frame starts at `opacity: 0` under an
  OPAQUE gate, so its first paint is never visible — verified at 2.5 s: `gateOpacity: 1,
  frameOpacity: 0`.
- **Five seconds now — one constant, cut from ten** (`DEVELOPMENT_GATE_MIN_MS` in
  WritingAreaIndex; the owner's first word was ten — *"you could use it as a 10 second delay"* —
  then the same night *"ten was too long — five"*), and the gate waits for BOTH clocks: the
  hold and the frame's own load (`builder-embed` now announces `builder-embed-loaded`; the refs
  reset on every entry, so each visit gets the same opening).
- **The ease-in**: one 700 ms cross-fade — the gate to 0, the window to 1 — the same feel as
  composer and design. Verified after the wait: `gateOpacity: 0, frameOpacity: 1`, and the
  screenshot shows OpenHands itself standing there (`http://localhost:8090/?embedded=console`),
  its own onboarding modal on screen.
- Note kept for honesty: it is a STAGED assembly (the owner's own word), not a measured one —
  nothing is actually computing during the ten seconds.
- And the styling boundary, recorded so nobody fights it later: the GATE is ours (his tile, the
  amber ring, neutral copy — gray on purpose). The OpenHands app inside is its own origin with
  its own theme; styling IT means its own theme knobs, never our CSS reaching across the frame.

**THE ZONE'S CHANGELOG IS LIVE:** `development/CHANGELOG.md` — the Development zone's own log
(the room's record stays here; the day-to-day and the NEXT PROMPT for a fresh chat live there).
Its two records are the only things under `development/` that are tracked by git; the clones
stay outside on purpose. And the installer patch this room applies to OpenHands' built chrome is
scripted: `development/openhands-patch.sh` (idempotent — run it again after any package update).

## The styling pass — landed, and the boundary note corrected (the same long night)

The plan's last item — the tool's styling — is no longer "later". Done and driven in a live
browser; the full blow-by-blow (including why it took five passes) lives in
`development/CHANGELOG.md`, and every step of it is `development/openhands-patch.sh`. What
stands now:

- **The palette**: every gray the tool's default theme paints — twelve variables, measured on
  the rendered element — takes the house colours: grounds #110E1F (the pin gate's navy), panels
  #22202D (the owner's purple). Hovers untouched. The tool's runtime theme style outranks plain
  rules (it re-declares variables from a `<style>` under doubled selectors), so both scopes are
  mirrored tripled + `!important`, plus an inline-important script in its HTML as the backstop.
- **The ground**: the room's own assembly tile — graph paper and boxes — is painted into the
  TOOL's canvas (a content-hashed copy of the tile sits beside the stylesheet). Why not
  "transparent": an embedded document never shows what the parent paints behind it — measured
  the hard way (the room's wrapper painted solid red behind a fully transparent embed: not one
  red pixel reached the eye, magnified 3× confirmed).
- **The Setup wizard** stands on the same ground — its own opaque takeover (`main.min-h-screen
  .bg-base`) and the 60 %-black veil were the entire "black background"; both cleared — and its
  default row is relabeled **"Sovereign local model"**. That row's TITLE is backend agent
  metadata, not a string in the build, so the ground script rewrites it in-page (exact match,
  wizard container only); the description is a locale string now reading "Defaults to the local
  model agent. Best for general purpose work." The "Skip for now" control is untouched,
  deliberately — the onboarding stays skippable and remembered per browser.
- **The boundary note, corrected**: "styling IT means its own theme knobs, never our CSS
  reaching across the frame" still holds in spirit — nothing of ours crosses the frame AT
  RUNTIME. What the patch does is different in kind: it is applied INSIDE the tool's own build
  at install time (its own stylesheet link, its own theme variables, its own locale file, its
  own canvas) — which is exactly "its own theme knobs", at the only level the tool offers. The
  app's CSS still never reaches across the frame.
- **The mechanism's law** (earned the hard way, three times): the patch's files carry the hashes
  of their own bytes — change the content and the URL changes with it; a hand-bumped `?v=N` is
  cached for a year the moment anyone loads it, and one was already burned. The script is
  idempotent and self-upgrading; re-run it after any `npm install -g @openhands/agent-canvas`.

## HOSTED — the room's tool is a service now, and the room carries it (2026-10-04, the same long night)

`wireframe-lab/HOST-THE-TOOLS.md` executed; the full blow-by-blow is in
`development/CHANGELOG.md` (the "tools go hosted" entry). The room's own facts, in the
form a next session needs them:

- **The service.** `dev-workspace` — `canvas--dev-workspace--mgtvxtd7xr2v.code.run` —
  built from THIS repo on every push to `demo-mode`:
  `development/agent-canvas/Dockerfile` (node:24, the pinned package, **the house patch
  applied inside the image build** — the same `openhands-patch.sh` as the Mac, palette,
  tile, logo, wizard relabel and all, content-hashed files riding the image) and
  `development/agent-canvas/entrypoint.sh` (the door: public mode, the model seed, the
  drift repair). The room's address arrives at runtime: `GET /api/config` →
  `development_tool_url` → `shared/appConfig.ts` → the embed. **The room hard-codes
  localhost no longer**; with the address unset the room's honest panel shows, and with
  the address set but the frame never arriving (25 s ceiling), the same panel covers a
  still-mounted embed — a late workspace still wins.

- **The gate, mechanically.** `--public` mode: the session key
  (`LOCAL_BACKEND_API_KEY`, a service secret) is NOT injected into the page; each
  reviewer types it once, per browser, in the wizard's local-backend step. **The owner
  hands the key out WITH the demo pin** (decision 1: pin-holders may drive the agent).
  The key value lives only in the service's environment — never in this repo.

- **The model, mechanically.** The entrypoint seeds the chain the tool actually reads —
  the LLM PROFILE (`sovereign-local-model`: `deepseek-v4-pro` at
  `https://api.deepseek.com/v1`, key from the service secret), its activation, the AGENT
  profile conversations launch from, and `max_iterations: 150`. The key is in no image
  and no repository. Two measured facts drove this shape: the composer's "LLM isn't set
  up" banner reads SETTINGS while conversations launch from the AGENT PROFILE (the first
  seed wrote settings only — every run still died keyless), and the first-run wizard's
  "Set up your LLM" step is ALWAYS a dirty save (it proposes its own default model), so a
  reviewer clicking through it clobbers the seed — hence the 45-second drift check that
  re-seeds when, and only when, the chain has been trampled.

- **The version pin is the fix for the run-killing bug.** `OH_AGENT_SERVER_VERSION=1.51.0`
  (image + entrypoint): at 1.49.6 the SDK read DeepSeek's
  `usage.prompt_tokens_details.cache_creation_tokens` unguarded and every conversation
  died with an AttributeError; 1.51.0 guards the read (the two `telemetry.py` copies
  were diffed in the uv cache — read, not guessed). Verified live after the bump:
  `/server_info` 1.51.0 across all four packages, and a real conversation answered
  ("hello from the hosted agent", `status finished`, `deepseek-v4-pro`, cost accrued).

- **What the room is NOT, stated plainly:** the 45-second repair loop is the demo's
  robustness, not a model-switching feature; there is NO dollar-budget setting in this
  SDK version (measured — the ceilings are `max_iterations`, the key gate, and the
  DeepSeek account's own limits); and the state directory is ephemeral — conversations
  do not survive a redeploy (the settings do, because the boot re-seeds them).

- **The room's plan, updated:** item 1 (the agent's model) is DONE, hosted — keep the
  seed/repair pair in mind before changing anything about profiles; item 2 (the sandbox)
  is answered FOR THE DEMO by the gate above (pin-holders only) — the agent runs inside
  the service's own container, nowhere near anyone's machine; item 3 (lifecycle) is the
  service itself now — the room's panel covers the down state on both platforms; item 4
  (the bridge — conversations onto the console as cards) is the open one, and the
  changelog's NEXT PROMPT starts there; item 5 (styling) is done, riding the image.

- **A reviewer's path, as built:** open the demo → the pin → Development → the workspace
  loads wearing the house ground → the wizard's local-backend step asks for the session
  key (the one the owner handed out with the pin) → the default agent row reads
  "Sovereign local model" → the composer shows the seeded profile → a conversation runs
  on DeepSeek. Every step of that path was walked on the deployed copy, screenshots on
  file in the session record.
