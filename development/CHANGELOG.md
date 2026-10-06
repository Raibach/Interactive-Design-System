# The Development zone — record

## 2026-10-06 — the Development room's tool was removed from the project, in full

At the owner's direction (*"Remove OpenHands entirely from this codebase. We are NOT using it
anymore."*), the tool the Development room embedded — OpenHands' Agent Canvas — was removed:

- the vendored tool source and its two Python trees — deleted from the repository;
- the hosted-build definition and the machine-installation steps — deleted from the repository;
- the room's embed wiring (the frontend room code and its `/api/config` entry) — removed;
- the restart script's launch and seed blocks — removed;
- the machine-level install (global npm package, uv cache entries, launcher shims) — uninstalled;
- the machine data home (`~/.openhands`), and every document, plan, and log that carried
  references — archived OUTSIDE the repository at
  `~/Documents/Raibach_IDS-openhands-retired/2026-10-06/` (moved, not destroyed — the archive
  is recoverable; say the word to delete it too).

The Development room stands without its tool. The Product room (the app builder) is untouched.
The tool's full history in this repository, before this change, lives in git history.

## 2026-10-06, the same day, later — the workspace RETURNS, with its reporting channel cut at the source

Owner, after the posthog finding: *"you can still load it via iframe — I just don't want it
calling or sending anything or connecting to any external companies in order to function. We can
connect to companies through plug-ins or anything that we control, but I don't want any backend
telemetry that is circumventing my awareness."*

So the Development room's workspace is restored as a component WE control end to end:

- **Installed into the repo and run from the repo**: the tool lives at `development/dev-tool/`
  (one-time npm install), the Python halves at `development/vendor/` (restored from the local
  `demo-mode` branch — no network), and `RESTART-LOCAL.sh` §8c starts it from there.
- **The reporting channel is cut at the source**, not asked politely:
  the baked PostHog key and host are blanked in every file that carried them (config defaults,
  both module formats, the UI bundle); the sourcemaps that still carried the old key were
  removed; the posthog package is **no longer installed into the agent server** — all four
  `--with posthog>=6,<7` code paths in the launcher are gone; and the server boots with
  `OH_TELEMETRY_CONSENT=deny`. Boot log, verbatim:
  `Telemetry initialised: exporter=posthog enabled=False (legacy_settings)`.
- **Verified at runtime**: zero external connections from the tool's processes at idle;
  its UI was loaded in a watched browser session and every request it made was recorded
  (see the session report — nothing left this machine).
- **The room embeds it plainly again**: `<builder-embed key="dev-workspace"
  src="http://localhost:8090/">` in the Development room's branch (no gate, no delay).

The tool's one remaining external call is the model endpoint the app already keeps (DeepSeek) —
deliberate, visible, and the same link every other room uses. No analytics. No phoning home.

---

## 2026-10-06, later — the second key found and cut; the workspace loads again

**What a watched browser session caught** (after the cut above): the UI bundle still carried a
SECOND baked PostHog key (`phc_Bgzfx…`, distinct from the one blanked above). Its client
telemetry initialized regardless of consent and fetched `https://z.openhands.dev` — its config,
its surveys script, and its surveys API — recorded live from this machine.

**The cut, completed — in this repo's copy only** (the look patch is untouched): the second key
is blanked (`""`) in every file that carried it — the UI chunk `active-backend-context-*.js`,
`dist/services/telemetry.js` and `.cjs`, and `config/defaults.json`; every `z.openhands.dev` /
`us.posthog.com` endpoint in those files now points at a dead local address
(`http://127.0.0.1:9`), belt-and-suspenders behind the empty key; the two sourcemaps that
carried the host were removed; the type declaration's note says so. The surviving
`us.i.posthog.com` strings are the posthog-js library's own defaults — inert, because nothing
ever initializes without a key.

**The room embeds it again** (owner, 2026-10-06: *"show the modified open hands application
that we just made sovereign"*): the Development room's left column loads `<builder-embed
key="dev-workspace" src="http://localhost:8090/">` under the staged opening — three seconds,
the frame's own load handshake, 700ms ease — with the honest panel for a stopped workspace.
`RESTART-LOCAL.sh` starts it from the repo. (The parked-bench placeholder of the same day's
earlier restore is retired to that fallback panel.)

**Verified live** — watched browser session, cache disabled: the workspace loads in the room,
and **zero requests to any OpenHands or PostHog host — not even an attempt**; the dead
address is never tried either. Disclosed, still fetching and NOT OpenHands: the tool's own
Google Fonts CSS and icon CDN, and this app's IBM Plex fonts (Carbon) — each cuttable the
same way on the owner's word.
