# The Governance Room — the map and the record

Owner: John Holt (Raibach). **Everything in this folder is LOCAL.** `governance/` is
gitignored (`.gitignore` line 126) — nothing here is committed or pushed. The stack it
describes ran **hosted** for a period — that half was built from a second tree
(`wireframe-lab/langfuse-gov-embed/`) that was **REMOVED from the repository on the
owner's order, 2026-10-13**; see the production note below. ONE copy of the application
exists in this repository: `governance/langfuse-main`.

---

## What the room is

The studio's **Governance tab IS a self-hosted Langfuse** (OSS, v4.55.0) living in
`governance/langfuse-main/` (docker compose: `langfuse-web`, `langfuse-worker`,
`clickhouse`, `postgres`, `redis`, `minio`, plus an nginx **frame proxy on :3100** that
serves the embed with the house-ground styling). The React shell embeds it full-page;
the room's left nav is the shell-level **`GovernanceNav`**
(`frontend/src/components/navigation/GovernanceNav.tsx`), which deep-links the embedded
app (the Governance "pages" are iframe routes, not React routes). The right column is
the shared chat seat.

**The studio is wired INTO the room** — the room watches the studio's real work, not
demo data:

| Wire | State | What it is |
|---|---|---|
| 1 — Traces | **LIVE** (2026-10-09) | Every studio model call runs through one seam: `query_llm()` in `backend/grace_gui.py`. Trace name `query_llm.<mode>`; user = the studio identity; session = the prompt package on runs. |
| 2 — Scores | **LIVE** (2026-10-09) | A run's judge verdict posts as score `judge` (CATEGORICAL: `cleared` / `failed` / `error`, comment = the judge's sentence) onto **the run's own trace** (owned trace id + in-process ledger `LAST_RUN_TRACE`; session-level fallback, always printed). |
| Costs | **LIVE** (2026-10-09) | Model prices stated in the room (Settings → Models) from the owner's price sheet; and the studio sends its own **exact** cost per call (provided `cost_details` — Langfuse uses it verbatim): peak/off-peak window + measured cache split — the same arithmetic as the studio's `/api/governance/usage` ledger. |
| 3 — Prompts | planned | `prompt_sessions` ↔ Langfuse Prompt Management, one-way first. |
| 4 — Datasets / experiments | planned | Engine task sets → dataset items; batch runs → experiments. |
| 5 — MCP back-channel | planned | Langfuse MCP/CLI with the `raibach-ids` key for read access. |

Wires 3–5 move one at a time, on the owner's word. The full plan + receipts live in
`PLANS.AGENT/langfuse-wiring/PLAN.md` (outside this folder, also local).

## Current (2026-10-24)

- **The room's seat is its own element**: `frontend/src/rooms/governance/governance-chat-panel.ts`,
  mounted by the room. The shared `chat-panel` serves the Composer only. This is the protection
  against another room's change stripping this room's paths.
- **The room opens on Chat, collapsed, at the application's home** — the same arrival as the
  Console (Chat selected, the column at its rail, the frame at the project root).
- **Sessions is the evals seat's own tab**: the list selects its first row (purple) and the middle
  opens the real session. The lane (words → filter → rows, no reply) and its replay are built in the
  backend and not yet wired to the seat; the room's to-do list is
  `frontend/src/rooms/governance/TODO.md`.
- **The app's read path is v4** (`users.v4_beta_enabled = true`). Its sessions table's seven-day
  window, measured on a session's creation, is why an old table read "No results" — measured
  against the app's own reader: 0 at seven days, 23 at thirty.
- **The evaluators run again** on the platform's DeepSeek key; the Evals tab draws its index.

- **The unwired governance surface is the room's.** `assembleGovernanceSurface`, its tree and its
  dead renderer effect live in `rooms/governance/useGovernanceSurface.ts`; the shell no longer
  carries them. The hook is not called — the application's own loader is the room's opening — and
  the telemetry application is unchanged in `governance/langfuse-main`.

- **The room owns its box, container and traces.** `GovernanceBox` owns the wave;
  `GovernanceRoomContainer` owns the layout, seat, evals seat, embedded application, trace
  selection and read, grip and assembly door; `useGovernanceTrace` owns the trace reads. The
  shell keeps the left nav and the box mount, with the path up and one navigate ref down.
- **Navigation is customized per application.** As each tab is cleaned, the chat panel absorbs
  most of its functionality. Sessions is the first: it is the chat panel's own tab, and the left
  nav no longer carries a second Sessions interface. A saved conversation under Sessions is the
  preset; the target is the application's full filter vocabulary. `PLAN-chat-as-filter.md` is the
  exploration.

The dated record is `CHANGELOG.md`, the seat anatomy is `SEAT-MAP.md`, and the retired plans are in
`archive/`.

## The query lanes — the record (official 2026-10-18)

The owner's law for this seat, verbatim: *"there's only one chat interface inside of governance
that is the one that says chat on the tab. The rest of them are model based queries for sorting
filtering, checking everything that the langfuse filtering system provides"* — and *"when I say
seats I mean, the individual tabs will have their own criteria for searching that particular
tab's data."*

Two documents carry it, and they are the record of what is being built:

| File | What it is |
|---|---|
| [`QUERY-LANES.md`](QUERY-LANES.md) | the spine — the law, the language, the vocabulary source, the first fix |
| [`QUERY-LANES-PLAN.md`](QUERY-LANES-PLAN.md) | the full plan — contract, executor, per-lane sorts, phases 0–7 with acceptance tests, risks, Milvus decision |

In one line: **every non-chat tab turns words into a Langfuse `FilterState` array**, validated
against a catalogue generated from the app's own filter config, executed over `events_core`
(sessions/traces/scores) or Postgres (conversations, approvals), and drawn as rows in the output
column. No prose reply, no chat turn.

The seat anatomy (what each tab is, what owns it) stays in [`SEAT-MAP.md`](SEAT-MAP.md); the
history stays in [`CHANGELOG.md`](CHANGELOG.md).

## House rules that apply here (each learned the hard way)

- **Verify IN THE ROOM** (the React frame), never on the raw port. The embedded app is
  transparent; raw `:3100` outside the shell renders white — by design, not a bug.
- **Worker law:** after a ClickHouse container restart, restart `langfuse-worker`.
  Tell: batch-export `Socket timeout` every 30s; otherwise ingestion stalls silently.
- **events_only mode:** the legacy public API (`/api/public/*`) answers **404 by
  design** in this v4 deployment. Verify in the room or in ClickHouse
  (`events_core` / `events_full` / `scores`).
- **Backend has no `--reload`** — restart after code edits:
  `kill $(lsof -ti :8000); sleep 2; (cd backend && nohup .venv/bin/python .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 >> logs/uvicorn-$(date +%Y%m%d-%H%M%S).log 2>&1 &)`
- **The venv is uv-managed** — install with
  `uv pip install --python backend/.venv/bin/python <pkg>` (there is no `bin/pip`).
- **House image patches** (styling + display precision) live inside
  `governance/langfuse-main/web/` with dated comments and explicit REVERT lines.
  Rebuild + recreate: `colima ssh -- docker buildx build --platform linux/arm64 -f .../web/Dockerfile -t langfuse-web:gov-embed --build-arg NEXT_PUBLIC_BASE_PATH=/governance .../langfuse-main`
  then `docker compose up -d langfuse-web`.
  **THE DOOR SECTION IS A REQUIRED BUILD ARG (2026-10-12, measured):** the room
  embeds the app through the studio's `/governance*` proxy path (vite forwards it
  to :3100 as-is; box Caddy does the same), so the image MUST bake
  `NEXT_PUBLIC_BASE_PATH=/governance` — the box compose passes the identical arg
  for the identical reason. An image built WITHOUT it serves its assets at the
  ROOT: the room shows a white page and the console 404s
  `/_next/static/chunks/*` at :5001 (the app's own error page, asking for chunks
  under the wrong prefix). Verify the DOOR shape —
  `http://localhost:5001/governance/project/...` — never the raw :3100 root, which
  answers 200 even on a wrong-prefix image.
  **Hosted twins: REMOVED (owner's order, 2026-10-13).** The owner found the extra
  tree in the repo and ordered it out — verbatim: *"I want to know how many versions of
  that application are in this repository and I want all extra versions or twins as you
  call them out."* The twin (`wireframe-lab/langfuse-gov-embed/`, 6736 tracked files)
  was deleted from the working tree and from git tracking the same night; there is ONE
  copy of the application in this repository now: `governance/langfuse-main` (untracked
  by design — `.gitignore` line 126). Any future box/hosted rebuild sources from that
  one tree, with the same recipe below (the old `DEPLOY.md` died with the twin).
- **The tap never degrades the studio.** Every wiring block is `try/except` with loud
  prints; tracing/scoring failures can never fail a call or an evaluation.
- **Smoke artifacts STAY** (owner, 2026-10-09: *"I don't think smoke artifacts are a
  problem. Leave them in there. This is a demo."*) — the labeled session
  `WIRE2 SMOKE — safe to delete`, the probes (`wire2-probe`, `io-probe-span`,
  `cost-probe-1`), runs one–six. They are demo data now.
- **Credentials:** `Keys/langfuse-governance-api-key.txt` (the `Keys/` folder is
  gitignored). Langfuse shows the secret exactly once at creation.

## Production note — the room is HOSTED (owner-ordered, 2026-10-09 night)

The hosting decision reversed on the owner's order the same day it was recorded
(“You were in the process of doing that”): the full stack now runs on Northflank
(project `semantic-design-system`), and the hosted room serves **our own build** —
nothing stock, no vendor servers:

- `langfuse-web-gov` — built from this repo (branch `gov-embed-2026-10-09`) — the
  second tree it was built from (`wireframe-lab/langfuse-gov-embed/`) was REMOVED from
  the repository on the owner's order, 2026-10-13; the one copy now lives at
  `governance/langfuse-main`. The patched tree — the app's own sidebar
  removed at the source (the shell's `GovernanceNav` is the room's only left nav),
  micro-dollar cost precision, the settings-subnav fix.
- `langfuse-worker-gov` — built from the same repo tree (never a vendor image).
- `langfuse-frame-proxy` — the hosted twin of the local frame proxy (frame headers
  dropped for the studio origin only, the minted session injected, house ground +
  location reporter).
- ClickHouse + Redis + MinIO + Postgres — infrastructure, as locally.
- Values all live on the services (THE CONFIG RULE); telemetry off; the old
  stock-image services were deleted outright; no fallback exists anywhere.
- Room wiring: studio `GOVERNANCE_TOOL_URL` → proxy → the Governance project path;
  the hosted studio's tap (`LANGFUSE_BASE_URL=http://langfuse-web-gov:3000`) feeds the
  hosted instance — real traces + micro-dollar costs verified IN the hosted room
  (2026-10-09 night).
- Cost: governance stack ≈ $64.80/mo at list (web 24 · clickhouse 12.90 · worker 12 ·
  redis 3.60 · minio 3.60 · postgres 6.00 · proxy 2.70).

The local room is the working copy. The extra tree this note used to point at
(`wireframe-lab/langfuse-gov-embed/`) was REMOVED from the repository on the owner's
order, 2026-10-13 — the blank-slate recipe below plus `governance/langfuse-main` is the
whole of the build path.

## Docs map

- `CHANGELOG.md` — this room's record, current.
- `NEXT-SESSION-PROMPT.md` — the paste-ready prompt for the next working session.
- `governance/langfuse-main/` — the local Langfuse install (the room's application).

## Owner context, 2026-10-09

- *"We need to make it governance. This is governance. We need to take out any
  composer references."* — Audit done: the governance code path (`GovernanceNav` + the
  room mount in `WritingAreaIndex.tsx`) carries **no composer wording**. Remaining
  "Composer" strings live in the other rooms' code and in the shared chat seat — which
  the governance room borrows (*"we borrowed the composer's architecture and replicated
  style wise"*). The owner's styling pass will settle the seat; nothing was guessed.
- Room status: **functionally wired and verified** — owner: *"I think it's relatively
  finished."* Styling is the owner's remaining pass.
