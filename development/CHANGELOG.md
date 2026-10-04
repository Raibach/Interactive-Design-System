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
