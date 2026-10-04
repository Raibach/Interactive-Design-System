# The Development zone — changelog and what comes next

*Started 2026-10-04, the night the Development room was built. This is the Development zone's own
log (its siblings: `wireframe-lab/DEVELOPMENT-ROOM.md` for the room's record and plan,
`wireframe-lab/PRODUCT-ROOM.md` for the Product room). The top-level README is deliberately not
touched.*

---

## 2026-10-04 — the room lands, and its tool changes twice in one night

**The room.** `Development` — the last dead stub of the shell (`SECTION_TABS = ['development']`,
`disabled: true` in the nav) — is live: the tab handler gained its branch (no A2UI assembly,
nothing of the Composer touched), the nav entry lost `disabled`, and the tab now embeds a tool
whole, the Product room's own move one tab over.

**bolt.diy was tried and replaced the same night.** It is a web app, but its runtime
(WebContainers) needs cross-origin isolation — `SharedArrayBuffer transfer requires
self.crossOriginIsolated`, proven live in the console — and a page nested in an iframe can never
have it unless the top page does too. Its UI could show in the frame; building could not. The
owner's verdict: *"not designed properly for what I want — that's a vibecoding thing."* The clone
stays on disk, unpointed.

**OpenHands' Agent Canvas is the room's tool** (MIT, npm: `@openhands/agent-canvas@1.24.0`,
web UI on the ingress port). Installed globally, booted with **`agent-canvas -p 8090`** (8000 is
this app's backend), serving 200. It is a REAL web app — no isolation requirement — so the room
embeds it plain, with no strip and no door.

**The staged opening.** The Development gate is deliberately staged, not measured: the owner's
graph-paper tile (`frontend/src/assets/canvas-development-lab-bkg.png`) as the ground, the
assembly gate's amber ring, one neutral line, a **held 5 seconds** (`DEVELOPMENT_GATE_MIN_MS` in
`frontend/src/pages/WritingAreaIndex.tsx`; it was 10, cut by the owner the same night), and a
700 ms cross-fade into the window — the same feel as composer and design. The gate covers the
frame from the first paint, so the white splash is gone by construction.

**The installed build is patched — and the patch is scripted.** The running app is the built
package, not the source clone, so its chrome is patched where it lives, by
**`development/openhands-patch.sh`** (idempotent; run it again after any
`npm install -g @openhands/agent-canvas` update). Applied tonight, all three verified live in the
browser:

| # | patch | where it landed |
|---|---|---|
| 1 | **The logo is hidden** — the sidebar's OpenHands mark sat right under this app's own logo | the built CSS (an `[aria-label="OpenHands Logo"]{display:none}` rule) |
| 2 | **The palette takes the pin gate's darks** — `--oh-color-base #110E1F`, `--oh-color-base-secondary #231f2e`, so the chooser screens and every base surface read navy like the gate | the built CSS, on `[data-agent-server-ui]` |
| 3 | **"Join the OpenHands Slack" → "local sovereign model"** in the sidebar checklist — a placeholder name for the model story, wiring later (owner's word). ⚠️ MY CHOICE OF TARGET, flagged: the app has no literal "sign-up tab"; this outbound link was the only sign-up-shaped item. If a different tab was meant, it is one string. | `build/locales/en/openhands.json`, key `SIDEBAR$ONBOARDING_CHECKLIST_JOIN_SLACK` |

Originals are kept in `development/openhands-patch-backup/` (first run only). The patch is NOT in
git in the usual sense — the installed package lives outside both repos, which is exactly why the
script exists; the script itself IS committed.

**Decisions recorded (owner, same night):** the **branding stays** — showing that this harness
absorbs other real applications whole is the point, and it is MIT. The **onboarding needs
nothing**: it is remembered per browser (the `openhands-onboarded` localStorage key), so every
new visitor gets it fresh; `?previewOnboardingStep=0` is its own non-persisting replay if a demo
ever needs one. *(Both recorded in `wireframe-lab/DEVELOPMENT-ROOM.md`.)*

**Still open, in order** (the room's plan carries the detail):

1. **The agent's model.** It has no LLM configured yet ("Your LLM isn't set up yet" is on
   screen). Its settings speak OpenAI-compatible providers, so the house's hosted DeepSeek fits.
   Preseeding its config (so nobody types a key) is the natural follow-up — and it is what the
   "local sovereign model" label is placeholder-ing for.
2. **The sandbox decision.** The agent currently runs in LOCAL mode with full filesystem access
   (OpenHands' own warning). Contained = Docker sandboxes, which needs Docker Desktop installed.
   Until then, the room is the owner's workbench alone.
3. **Lifecycle + the health banner.** A `dev:local`-style start script for `agent-canvas -p 8090`,
   and the Product room's health-door pattern so a stopped server says so instead of an empty
   frame.
4. **The bridge (parity with Product).** Conversations/tasks → console cards under their own
   category, reference not copy, publish as the commit — the same questions the Product bridge
   answered with the owner's words.
5. **Styling.** The gate is ours; the app inside is its own origin with its own theme (the
   patches above are the exception, not the rule). Prefer its theme knobs over rewriting its
   components.

---

## NEXT PROMPT — copy this into a fresh chat

> We are working on the **Development room** of this application — the tab in the top nav that
> embeds **OpenHands' Agent Canvas**. Read `wireframe-lab/DEVELOPMENT-ROOM.md` (the room's record
> and plan) and `development/CHANGELOG.md` (this file) first; the room's gate and embed live in
> `frontend/src/pages/WritingAreaIndex.tsx` (search for `openhands-room` /
> `DEVELOPMENT_GATE_MIN_MS`), the engine-free tool runs from the globally installed
> `@openhands/agent-canvas` on port 8090, and the chrome patches we apply to that installed build
> are scripted in `development/openhands-patch.sh`.
>
> Tonight, in order: (1) get the agent's model configured — it speaks OpenAI-compatible providers,
> use our hosted DeepSeek, and preseed the config if you can so nobody types a key; (2) bring up
> the room's lifecycle — a start script for `agent-canvas -p 8090` plus the Product room's health
> banner pattern; (3) decide the sandbox (local mode currently has full filesystem access; Docker
> sandboxes need Docker Desktop); (4) sketch the bridge that would put the room's conversations on
> the console as cards under the same publish rule the Product room uses. Do not restyle
> OpenHands' insides — the gate is ours, the app is its own; extend the patch script only for the
> chrome the owner names. Follow the repo's laws: one writer per fact, drive it, and record
> corrections where they land.

**Patch amendments, same night (owner's second look):** the panel colour is now HIS value,
exactly — *"this is my preferred colour for all the panels that are currently gray … you can just
leave the hovers."* So patch #2's secondary is **#22202D** (it was my #231f2e guess, one bit off
his swatch — the app's own cache had also been showing him the pre-patch greys until a hard
refresh). The ground keeps the gate's navy #110E1F, and hovers are deliberately untouched. Both
the live build and `openhands-patch.sh` carry the new value; verified by the COMPUTED style on
the running element (`--oh-color-base: #110E1F`, `--oh-color-base-secondary: #22202D`), not by
reading the file.

**The correction that closed the night — "you must've built it somewhere else":** the owner's
incognito kept showing the OLD colours after the panel patch, and the bytes said otherwise
because they were right and I had missed WHERE the staleness lived. The app's own assets are
served **`public, max-age=31536000, immutable`** — a rule appended to `assets/root-*.css` reaches
nobody who has ever loaded the page, because the URL never changes and the cache never
revalidates; the owner's incognito session had fetched the file BEFORE the patch and kept those
bytes for a year. (The HTML, by contrast, is `no-store` — always fresh.) THE FIX IS A NEW URL:
the patch now lives in **`assets/house-patch.css`**, a file with no cache history, linked from
the always-fresh HTML — so the very next ORDINARY reload carries it, in any session, incognito
included, no hard refresh and no cache to clear. Verified exactly that way: an ordinary reload,
`linked: true`, computed `--oh-color-base: #110E1F` and `--oh-color-base-secondary: #22202D`,
logo hidden. `openhands-patch.sh` carries the new mechanism, and the appended block was removed
from the hashed stylesheet so the patch has ONE home.

**The paper comes through, and the landing rises (same night, owner):** *"Add the background
that we're using at assembly for development behind the splash page … just make the background
behind [the] contents transparent. And move the contents up … like 100 pixels."* Done, and
verified on the live element, not by reading files: the ROOM's wrapper now carries the
graph-paper tile (`WritingAreaIndex.tsx`, behind the iframe), the app's own ground is
transparent (html/body/shell — measured `rgba(0,0,0,0)`), and the landing's hero container pads
`max(4rem, calc(28vh - 100px))` instead of `max(4rem,28vh)` — measured 201.6px → **101.6px**,
exactly the hundred back. Panels stay the owner's purple (`rgb(34,32,45)` ✓) and hovers are
untouched. TWO MECHANICAL LESSONS, both recorded because both cost time tonight: (1) the app's
LAYERED stylesheet beats an unlayered `!important` override — the transparent ground is also
forced by a three-line inline-important script in index.html, and that script is part of the
patch, not a hack around it; (2) `house-patch.css` is now linked as `?v=2` — an in-place edit of
a fixed URL is cached by the same one-year policy this very patch exists to escape, so the patch
script bumps the number with any content change.

**The closing correction — "even if I open a new tab" (the bad news first, then the whole
truth):** the `?v=2` mechanism above was itself already burned. The link went into the HTML at
22:27:27 and the stylesheet's content was AMENDED one minute later, at 22:28:50, under the same
`?v=2` URL — and the app serves assets `immutable, max-age=1yr`, so any session that loaded the
page inside that minute keeps the earlier bytes for a year, and a new TAB in the same incognito
window shares that cache. That alone could hold the owner on old colours. But probing a
fresh-profile state (the `openhands-color-theme` key deleted — exactly an incognito tab, since
the app's default is `openhands-neutral`) showed the deeper truth: **the panels were never
swapped at all.** The neutral theme paints its grays through a whole FAMILY of variables, and
patch #2 had replaced only two of them — measured on the live shell: base #181818,
base-secondary #202020, surface #202020, surface-raised #282828, surface-deep #101010, bg-dark
#181818, bg-light #282828, bg-input #313131, bg-workspace #202020, tertiary #313131. The cards,
the banner, the composer, the sidebar's New Chat row and the editor chrome all read from the
ones left alone, so "the old colours are still there" was simply true, cache or no cache. And
the cascade had one more twist: the active theme re-declares its variables from a runtime
`<style>` under TWO selectors — the shell `[data-agent-server-ui][data-agent-server-ui]` and an
inner scope `[data-agent-server-ui] [data-theme][data-theme]` — both DOUBLED to win ties.

**THE FIX, three layers deep and name-stable this time:** (1) `openhands-patch.sh` now installs
the stylesheet under a CONTENT-HASHED name — `house-patch-<sha>.css` — so changing any byte
changes the URL with it, and there is no version number left to burn; the `?v=2` file is deleted
from the build and the script strips any older link form before inserting the new one (idempotent,
self-upgrading). (2) The stylesheet swaps the WHOLE family on BOTH scopes with a TRIPLED selector
+ `!important` — base/base-secondary → #110E1F/#22202D, surface/raised/light/input/workspace/
editor-sidebar/editor-active/tertiary → #22202D, surface-deep/bg-dark → #110E1F — and gives
`div.dark.min-h-screen` (the wrapper that paints its own #181818 ground from OUTSIDE the shell)
the transparency rule by name. (3) The index.html ground script pins the same variables
INLINE-IMPORTANT on the shell and every `[data-theme]` scope — inline important beats every
stylesheet there is, layered or not, so the late-arriving theme <style> can re-inject all it
likes.

**Verified the way the owner will meet it** — fresh-profile state, ORDINARY reload, nothing
cleared: remaining neutral grays above 3000px²: ZERO; purple surfaces on the landing: 21; the
only translucent left is the house purple itself at 50% (`bg-base-secondary/50` on a row state).
Logo hidden, checklist reading "local sovereign model", and the same page reached through the
app's own Development tab (screenshot on file: navy frame, purple panels inside the room). The
law this night earned: **a patch URL is a promise about bytes — if the bytes can change, the
URL must change with them; never amend what a cache has already learned by heart.**

**The ground follows the tool itself — and AN IFRAME CANNOT SHOW YOU THE PARENT, full stop
(owner: "How hard is it to make that background in the middle area transparent to show our boxes
…" then "Yeah, I didn't go transparent").** The honest answer to the owner's question: the
transparent-middle idea itself is the hard part, and it turned out to be the impossible part.
Measured, layer by layer: the tool's document genuinely goes transparent (its own tab shows the
page behind through every non-panel pixel), the room's wrapper genuinely carries the assembly
tile (it has since the gate pass — MY EARLIER CLAIM THAT IT WAS FLAT WAS WRONG, corrected here
the same night), and still the middle stayed a featureless dark — verified by painting the
room's wrapper SOLID RED behind a fully transparent embed: not one red pixel reached the eye,
and a 3× magnified screenshot showed not one grid line. The reason is architectural: a framed
document paints its own canvas, and what the parent painted behind the frame is never part of
that canvas. No amount of `background: transparent`, color-scheme changes or cascades changes
that. THE FIX, therefore, paints the ground INTO the tool: `openhands-patch.sh` now copies the
room's tile (`frontend/src/assets/canvas-development-lab-bkg.png`) beside its stylesheet as
`house-patch-tile-<sha>.png` — its own content hash, same discipline as the stylesheet — and the
tool's canvas carries it (`html{ background: url(house-patch-tile-<sha>.png) repeat !important }`),
body and shell stay transparent above it, the sidebar keeps its navy, the panels their purple.
Verified in the owner's exact path (fresh reload → app → Development): the boxed graph paper now
runs through the middle, behind the hero, the composer and the cards — the assembly look, made
unremovable by any compositing rule of any browser.

**A NOTE TO OURSELVES — WHY THE STYLING WAS REWORKED SO MANY TIMES TONIGHT (the owner asked for
this note: "there's a lot of reworking of the styling … make a note about that in our folder").**
Five passes on one surface in one night is the symptom; these were the causes, kept here so the
next styling night is shorter:
1. **The theming stack was unknown.** The tool paints its grays through a family of ~12
   variables, set at RUNTIME by a theme script using doubled selectors, re-declared on two
   scopes — while an older pass of mine appended a rule into a hash-named stylesheet that no
   cache would ever refetch. Each pass discovered one more layer of that stack instead of the
   whole stack being mapped first (the map now exists — the stylesheet's own comments carry
   every measured value it replaces).
2. **The cache was twice the author of a "fix".** `?v=2` was amended one minute after it went
   live (a burned URL), and the first patch lived inside an immutable file for a year by
   contract. Both lessons are now structural: the patch's NAME carries its bytes' hash.
3. **Verification looked at the wrong instrument** in the middle passes: reading files and
   computed variables instead of the thing the owner sees. What settled every open question
   tonight was the same move — reproduce the owner's EXACT path (fresh profile → app → room),
   then either read the computed value ON the rendered element or look at real pixels
   (screenshots; magnify; paint a layer loud red to see what reaches the eye). The painting-into-
   the-tool fix was only possible because the red-paint test finally named the layer that
   paints.
4. **Two of my own interim claims were wrong and each cost a pass**: "the panels were swapped"
   (2 of 12 variables had been) and "the room's wrapper is flat" (it carried the tile all
   along). The rule this re-earns: claim only what the last measurement showed, and correct the
   record where it landed.
THE STANDING RULES FROM TONIGHT, for the next styling touch on any room: patch bytes live at
content-hashed URLs; a visual change is "done" only when seen through the owner's own door; when
a surface refuses to change, probe the paint chain in order (parent → frame → document) with
loud test values instead of guessing which layer is guilty.

**The Setup panel stands on the same ground — and names the model (owner, same night: *"it has
to also be there when the Setup panel opens up … it's just a black dark background"* and *"this
particular panel … should just say sovereign, local model, and the description should say
defaults to local model agent … best for general purpose work"*).** The first-run wizard was
measured before it was touched: the black surround was TWO layers — the wizard's own opaque navy
takeover (`main.min-h-screen.bg-base`) under a 60%-black veil — while its card was already the
house purple from the palette rules. Both layers now go transparent (the veil rule covers any
other modal that uses the same scrim combo; future ones get measured when met). The wizard's
default row: the description is a locale string and now reads "Defaults to the local model
agent. Best for general purpose work."; the TITLE is not a string in the build at all — the
wizard renders each row's name from the BACKEND's agent metadata (`display_name`) — so the row
title is relabeled in-page by the ground script (exact text match, inside the wizard container
only, with a MutationObserver so a late mount is caught): it now reads "Sovereign local model".
The other rows (Claude Code, Codex, Gemini CLI) and the "Skip for now" control are deliberately
untouched — the owner's earlier decision stands that the onboarding stays skippable and is
remembered per browser. Verified live: wizard open, first row relabeled with the new
description, grid running behind the whole panel, other rows byte-identical.

**The demo stops reaching for machines that aren't there — and the hosting plan is written
(owner, same night).** The work went remote (`demo-mode` pushed to `2220adb`; Northflank built
and deployed it), and the owner met the two symptoms the deployed build produced, in their
words: Chrome's *"…is asking you to access other apps and services on this device"* box over
the Development room, and the Product room's *"The builder's engine isn't running. Start it
with: npm run dev:local"* banner. The diagnosis in one line: the rooms embedded `localhost` —
which means the VISITOR's computer — so the deployed Development room asked every visitor's
browser for local-network access, and the Product banner's copy is developer text that reads to
a visitor as a verdict ("this program cannot run"). INTERIM, shipped the same night: on the demo
(`isDemoMode()` — the server's own flag, read at boot) both rooms render an honest panel instead
— each on the room's own tile ground, one plain line — the engine banner never shows on the
demo, and the demo's Product room no longer births a project against an engine that isn't there.
Local runs never take those branches; the Mac keeps the full experience. THE REAL FIX IS PLANNED,
NOT IMPROVISED: `wireframe-lab/HOST-THE-TOOLS.md` — host OpenHands and the builder engine as
their own Northflank services (the house patch riding the tool's image build), move both room
addresses into runtime config (`/api/config`), point the bridge's `BUILDER_ENGINE_URL` at the
hosted engine — carrying the three OWNER decisions the hosting must ask before anything
public-facing gets a key (who may drive the agent, whether visitors may run the builder, whether
to copy the Mac's projects). The file ends with a NEXT PROMPT block for the next chat window.

---

## 2026-10-04 — THE TOOLS GO HOSTED: both rooms run on the remote site (HOST-THE-TOOLS executed)

**The night the plan was written, it was executed — end to end, and verified on the deployed
site.** `wireframe-lab/HOST-THE-TOOLS.md` is no longer a plan: both tools run as their own
Northflank services in the same project and cluster (`nf-europe-west`), both rooms show them
to a signed-out visitor, and the interim panels are now what a MISSING tool says, not what the
demo says. First, the three decisions the plan refused to make alone (owner, the same night):

| # | decision | answer |
|---|---|---|
| 1 | who may drive the hosted development agent | **pin-holders** — the workspace runs in `--public` mode; its session key is a service secret, handed out with the demo pin, typed once per browser |
| 2 | may demo visitors run the builder | **yes, with caps** — per-visitor and global run budgets inside the engine (env-tunable) |
| 3 | the Mac's 10 builder projects | **start fresh** — the hosted store begins empty; the Mac's store stays untouched |

**THE FOUR SERVICES, BY NAME.** The app service is unchanged but for its environment
(`DEVELOPMENT_TOOL_URL`, `BUILDER_TOOL_URL`, `BUILDER_ENGINE_URL`) and the pushes; three new
combined services carry the tools:

- **`dev-workspace`** — `canvas--dev-workspace--mgtvxtd7xr2v.code.run` — OpenHands Agent
  Canvas, built from THIS repo (`development/agent-canvas/Dockerfile`, branch `demo-mode`):
  node:24 (the package's engines field requires >=24 — the plan said node:20 before the
  package was read), the pinned `@openhands/agent-canvas@1.24.0`, **the house patch applied
  inside the image build** (`openhands-patch.sh` — the same act as on the Mac, single home
  kept), uv pre-warmed at build so a cold container boots without a minute of downloads.
- **`builder`** — `builder--builder--mgtvxtd7xr2v.code.run` — the Next app, root Dockerfile
  (`next build` → `next start -p 3223`; the same port the Mac uses, so the room's address
  shape is identical in both worlds).
- **`builder-engine`** — `engine--builder-engine--mgtvxtd7xr2v.code.run` — `local-vcaas`
  server.mjs as its own process, with a **volume** (`builder-engine-store`, 6144 MB — the
  nvme class's minimum, learned from a 409) mounted over `data/` so a redeploy does not
  throw the projects away.

**THE REPO QUESTION, ANSWERED THE WAY IT HAD TO BE.** The builder + engine live in
`wireframe-lab/ai-app-builder-open`'s own git repo, whose upstream
(`totalumlabs/ai-app-builder-open`) is **pull-only** — the room's wiring commit (`9b1c77d`)
had never had a remote. So the repo is now **forked** (`Raibach/ai-app-builder-open`,
public, MIT) and Northflank builds both services from it; upstream stays pullable and our
main rides on top. The engine's two hosting changes ride that fork: with `PUBLIC_BASE_URL`
set, every URL the UI is handed is `<base>/preview/<id>/` (one hostname, the path form the
engine always served — verified live: the detail's preview URL and a 200 at it), the banner
names its own origin instead of localhost, and **the run budget is armed exactly and only
where the demo's address is** — 4 runs/hour/visitor, 60/hour globally, "N/seconds" env
specs, consumed before the two token-spending endpoints — while a local engine (no
`PUBLIC_BASE_URL`) is never throttled (verified in an isolated run, both directions, and a
refused launch leaves NO project behind). The builder forwards the visitor's address
(`x-visitor-ip`, read off the first XFF hop at its catch-all proxy) so the fairness bucket
bills the right person; the global bucket does not care who asks — the documented XFF
limits, same as `demo_policy.py`.

**THE APP HALF — small, and now the architecture.** `GET /api/config` grew
`development_tool_url` / `builder_tool_url` (env-driven); `shared/demoMode.ts` became
`shared/appConfig.ts`, the shell's one read-once module, which OWNS the localhost defaults
for a local run and returns the empty string on the demo when the server names nothing —
so the rooms never branch on demo-ness for their address, they render the tool or the
fallback panel. The Development room's gate gained a ceiling (`DEVELOPMENT_GATE_MAX_MS`,
25 s): a frame that never arrives gets the honest panel over a still-mounted embed, and a
late arrival still wins. The Product room checks and births against the HOSTED engine on
the demo too (`/api/builder/new` through the bridge — the old "no engine on the demo"
guard is gone, per decision 2), and `demo_policy.py` admits the bridge's four mutations
(`new`, `sync`, `publish`, `discard` — templates checked against the router's registered
paths), still behind the per-visitor mutation bucket.

**TWO FAILURES ONLY A LIVE ROOM COULD FIND — both fixed where they lived.** (1) **Every run
died**: `AttributeError: 'PromptTokensDetailsWrapper' object has no attribute
'cache_creation_tokens'` — the OpenHands SDK at 1.49.6 reads DeepSeek's usage block
unguarded, and DeepSeek's OpenAI-compatible responses do not carry it. The fix is a version,
not a hack: the launcher pins sdk/tools/workspace to the same number as the agent server, so
`OH_AGENT_SERVER_VERSION=1.51.0` (in the image and the entrypoint) carries the guarded read —
verified by diffing the two `telemetry.py` copies in the uv cache, then live
(`/server_info` now says 1.51.0 across all four packages). (2) **The wizard trampled the
seed**: the first-run "Set up your LLM" step ALWAYS proposes its own default model, so its
Next is always a dirty save — measured: it overwrote the seeded profile with
`openai/gpt-5.6-sol` and a cleared key, and the composer said "Your LLM isn't set up yet".
The entrypoint now seeds the whole chain the tool actually reads — the LLM PROFILE (key
included, from the service secret; in no image, no repository), its activation, the AGENT
profile conversations launch from (the launch request carries `agent_profile_id`, and a
brand-new container has NO active pointer — measured, so the seed sets it), and
`max_iterations: 150` as the steps ceiling — and a quiet 45-second drift check re-seeds
whenever a save tramples it. **Said plainly, because the record should say it: this SDK has
NO dollar-budget setting** (a `max_budget_per_task` field exists in the frontend's types and
the server silently drops it — measured). The ceilings that exist are max_iterations, the
key gate, and the DeepSeek account's own limits; a global daily cap would need a proxy in
front of the model, and that is a decision, not a line.

**VERIFIED THE WAY THE OWNER WILL MEET IT.** Signed out, on the deployed demo: `/api/config`
returns both addresses; the canvas answers 200 with `house-patch-<sha>.css` linked and every
house colour in it (`#110E1F` / `#22202D` — the content-hash discipline riding the image),
the tile asset 200 beside it; the workspace's key screen answers 401 without the session key
and the seeded settings with it; the wizard's default row reads "Sovereign local model" and
its list shows the seeded profile in the composer; the Product room's frame is
`https://builder--builder--mgtvxtd7xr2v.code.run/project/product-idea?embedded=console` —
born through the bridge against the HOSTED engine (`"engine":"http://builder-engine:4000"`
in the response — internal DNS confirmed from inside the cluster: `builder-engine:4000`
resolves, `builder-engine.semantic-design-system` does NOT), a real build ran through the
hosted builder (3 files in 4 s, preview 200), publish created the Product Team card, discard
removed the project, sync removed the row, and the room's own exit guard discarded its blank
project (store back to zero — decision 3 honored); **the browser's resource hosts contain NO
localhost** — the app, the canvas, the builder, the engine, and fonts, nothing else — so
Chrome's local-network prompt has nothing left to fire at; and the hosted agent, asked to
reply, answered on `deepseek-v4-pro` (`status finished`, "hello from the hosted agent",
cost accrued on the real key). Local runs: the engine's unchanged behavior is verified in an
isolated run of the new code with `PUBLIC_BASE_URL` unset (identical URLs, no budget), and
the frontend's local defaults are the module's own constants — the Mac's running processes
pick the new code up on their next start.

**What remains open, in order:** the Development room's bridge (conversations → console
cards — the Product room's shape, not yet built); the automation backend inside the
workspace still runs its own pinned SDK (1.49.6) — its DeepSeek paths were not exercised
and are an unknown, not a claim; a global spending cap (above); and the standing cost note:
three deployment plans at list (`nf-compute-50` / `100-1` / `100-2` ≈ $54/mo) plus build
plans mirroring the app's — the Northflank dashboard is the truth. **The demo's sentence for
reviewers:** the workspace's session key goes out WITH the pin; the room asks for it once.

## NEXT PROMPT — copy this into a fresh chat

> The tools are hosted (see the entry above and `wireframe-lab/HOST-THE-TOOLS.md`): the
> Development room shows `dev-workspace` (OpenHands Agent Canvas, house-patched at image
> build), the Product room shows `builder` on `builder-engine`, both addresses arrive via
> `GET /api/config` (`shared/appConfig.ts`). Tonight, in order: (1) the Development room's
> bridge — the room's conversations onto the console as cards, the Product room's bridge as
> the proven shape (reference, not copy; publish = the commit) — starting by reading
> OpenHands' own API (`/api/automation/docs`); (2) decide whether the automation backend's
> pinned SDK (1.49.6, unexercised with DeepSeek) needs the same version treatment the agent
> server got; (3) if the owner wants a hard global spending cap, design the proxy in front
> of the model — it is the one ceiling the tool cannot hold itself. Follow the repo's laws:
> one writer per fact, drive it, and record corrections where they land.
