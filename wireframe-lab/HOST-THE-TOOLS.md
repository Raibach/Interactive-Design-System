# Host the tools — the plan (the demo must carry both rooms)

> **EXECUTED — 2026-10-04, the same long night.** Both tools run as their own Northflank
> services and both rooms show them on the deployed demo, verified signed out. The three
> owner decisions Part 4 asked for were made first: **pin-holders may drive the hosted
> development agent** (public mode; the session key goes out with the demo pin), **demo
> visitors may run the builder** (per-visitor + global caps inside the engine), and **the
> hosted builder store starts fresh**. Three build notes where the plan met the machine:
> node **24** (the package's engines field requires it), the agent-server pin is **1.51.0**
> (1.49.6 crashed every run on DeepSeek's usage block — measured), and the run budget
> lives in the **engine** (it is the money's home), with the builder forwarding the
> visitor's address. The full story, measured end to end, is in `development/CHANGELOG.md`
> (2026-10-04, "the tools go hosted") and `wireframe-lab/DEVELOPMENT-ROOM.md`.

*Written 2026-10-04, the night the demo went remote, at the owner's ask: **"I don't do in-person
demos. This has to be on the remote site."** This is the plan for a fresh chat window; the
Development zone's changelog (`development/CHANGELOG.md`) carries the night's story, and
`wireframe-lab/DEVELOPMENT-ROOM.md` carries the room's record.*

---

## Where this comes from

The deployed app (Northflank, branch `demo-mode`) went live tonight with both rooms. But the two
rooms point at programs that run **on the owner's Mac** — `localhost` means *the visitor's own
computer*, so on the deployed site:

- the Development room triggered Chrome's permission box — *"…is asking you to access other apps
  and services on this device"* — because the page reached for `localhost:8090`;
- the Product room showed a banner reading *"The builder's engine isn't running. Start it with:
  npm run dev:local"* — developer text that reads to a visitor as "this program cannot run".

Neither is acceptable on a demo. **Interim shipped tonight:** on the demo (`isDemoMode()`), both
rooms show an honest panel instead of reaching localhost; no prompt, no developer copy. Local
runs are untouched (the Mac keeps the full experience). This document is the real fix.

## What exists today

| piece | where it runs today | how |
|---|---|---|
| The app (frontend + backend + DB) | Northflank (deployed) | Dockerfile multi-stage; `init_db.py` migrates on boot; redeploys on every push to `demo-mode` |
| Development room's tool — **OpenHands Agent Canvas** | the owner's Mac, port 8090 | global npm package `@openhands/agent-canvas`; `agent-canvas -p 8090`; its look carried by `development/openhands-patch.sh` (idempotent; content-hashed stylesheet + tile + locale + in-page relabel) |
| Product room's tool — **the builder** | the owner's Mac, ports 3223 + 4000 | `wireframe-lab/ai-app-builder-open` (Next dev server) + the `local-vcaas` engine (`server.mjs`); started by `npm run dev:local`; projects synced to console cards by the bridge (`backend/routes/builder_bridge.py`) |

## The goal

Both tools run as their own **services**; the rooms get their addresses from the server at
runtime (nothing hardcoded to localhost); the demo's rooms then show the real tools — patched
look included — to every visitor.

## Part 1 — Host the development workspace (OpenHands Agent Canvas)

1. **Containerize it** — `node:20` base; `npm i -g @openhands/agent-canvas@<pin the version>`;
   expose the ingress port (8090). A Northflank service of its own (mirror the app service's
   shape: repo Dockerfile on a branch, or a dedicated build).
2. **The house patch rides the image** — run `development/openhands-patch.sh` inside the image
   build (it patches the installed package's `build/` dir: palette, tile ground, wizard relabel,
   locale strings). This is what keeps the hosted copy wearing the house look; the script is the
   single home of that work and re-runs idempotently.
3. **The agent's model** — configure a DeepSeek (OpenAI-compatible) profile in its settings, the
   key held as a service secret (never in git — the demo backend already models this).
4. **⚠️ THE OWNER'S DECISION — the sandbox question** (recorded as open in
   `DEVELOPMENT-ROOM.md`): the agent RUNS CODE. On a public demo anyone could drive it — real
   cost, real risk. Options, to present in plain words:
   - (a) the hosted copy is a **showcase**: the room and its look are fully visible, the agent
     runs are locked or keyless until signed in — *recommended for the demo*;
   - (b) the demo's identity gates the room (reuse the guest flow);
   - (c) full sandboxed workspace with hard limits (most work, most capable).

## Part 2 — Host the product builder

1. **Two services**: `ai-app-builder-open` (Next — build, then run its server) and the
   `local-vcaas` engine (`server.mjs`) with a **volume for its store** (`projects/` — the JSON
   per-project files + snapshots). The builder's `VCAAS_BASE_URL` env points at the engine's
   address.
2. **The engine's key** — its AI runs need the DeepSeek key: another service secret.
3. **The bridge** — set `BUILDER_ENGINE_URL` on the APP service to the engine service's
   address: the console's card sync, publish/discard, and preview URLs then all work remote.
4. **The Mac's 10 projects** — decide: copy them into the hosted engine (the engine has
   base64 export/import) or start the hosted store fresh. ⚠️ Owner's call (the store holds test
   projects from tonight's clicking).

## Part 3 — The app-side plumbing (small, shared)

- **Runtime tool addresses.** Extend `/api/config` (already returns `demo_mode`) with
  `development_tool_url` and `builder_tool_url` (env-driven on the app service, e.g.
  `DEVELOPMENT_TOOL_URL`, `BUILDER_TOOL_URL`). Grow `frontend/src/shared/demoMode.ts` into a
  small `appConfig` read-once module; the two rooms use it instead of hardcoded
  `http://localhost:8090` / `http://localhost:3223`. Locally (env unset) the defaults stay
  localhost, so the Mac is unchanged; the demo points at the hosted services; any future move
  is then a config change, never code.
- The demo's interim panels (shipped tonight) become the fallback whenever a tool URL is unset
  or unreachable — the honest state stays available for free.

## Part 4 — Decisions only the owner can make (ask BEFORE building public-facing agent)

1. Who may drive the hosted development agent (Part 1.4 above).
2. May demo visitors run the product builder (a public prompt→app generator on our key = cost;
   the demo's existing rate limits `DEMO_RATE_*` can be reused, or building can be locked).
3. Copy the Mac's builder projects into the hosted engine, or start fresh.

## Verification (when done)

Deployed site, signed out: Development room shows the workspace with the house look (grid, navy,
purple, relabeled wizard); Product room opens a project and builds; a Product Team card appears
on the console via the bridge; the network tab shows **no request to any `localhost`** from the
demo; the permission prompt never appears; local runs still behave exactly as today.

## NEXT PROMPT (paste into a fresh chat window)

> Read `wireframe-lab/HOST-THE-TOOLS.md` and execute it. Host the Development room's tool
> (OpenHands Agent Canvas) and the Product room's builder (Next app + the local-vcaas engine) as
> their own services on Northflank; apply `development/openhands-patch.sh` inside the tool's
> image build; wire both room addresses through `/api/config` runtime config (grow
> `frontend/src/shared/demoMode.ts`) so the rooms stop hardcoding localhost; point the bridge's
> `BUILDER_ENGINE_URL` at the hosted engine. **Ask the owner the three decisions in Part 4
> before building anything public-facing with an API key.** Then verify end to end on the
> deployed demo (the checklist above) and record the work in `development/CHANGELOG.md` and
> `wireframe-lab/DEVELOPMENT-ROOM.md` in the repo's style.
