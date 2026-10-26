# Figma Ingest — handoff prompt for the coding agent


> **Start with `START-HERE.md`** — this file documents the ingest tool as built (single-catalogue era).
**Read this first if you are picking this work up in a new session.** It is a prompt for
you, not for the owner: what exists, what was verified, what was decided, what must not be
re-litigated, and what the next step is. Everything below was true at
2026-09-27 ~20:00 UTC, verified by running it.

---

## 1. What this is

A tool that turns a Figma node into a real Lit component in this repository: paste a node
URL → the application's own **assembly model** builds the component from what both Figma
channels measured → the designer previews it → **Approve** writes it into
`frontend/src/components/lit/` and registers it in all three registries → it can then be
composed into surfaces like any other element. Nothing is written until approval, and
discarding throws the drafts away server-side.

The owner's framing, verbatim: *the assembly model WILL be assembling the design from Figma
and presenting it to the user — this was the whole point of the entire application.*

## 2. Where everything lives

**Backend — `backend/routes/figma.py`** (one file, around the `FIGMA INGEST PIPELINE`
banner):

| Piece | What it does |
|---|---|
| `ingest_drafts` / `ingest_draft_validation` / `ingest_job_meta` | In-memory draft store, keyed by jobId. `INGEST_DRAFT_JOBS_KEPT = 20`. |
| `_fetch_figma_nodes` / `_fetch_figma_mcp` | The two channels; both sync, both called via `asyncio.to_thread` so concurrent ingests don't stall the loop. |
| `_parse_mcp_response` + `_extract_assets` | Parses the MCP reply; keeps it **whole** as `reference_code["mcp-reference"]` when it isn't the old annotated text format, and pulls asset URLs (`http://localhost:3845/assets/*.svg`) — that payload is the only place a library vector (chevron) exists. |
| `_figma_paint` / `_figma_gradient` | Every paint as CSS: SOLID, GRADIENT_LINEAR/RADIAL/ANGULAR/DIAMOND (stops → %, direction from the handle vector), IMAGE noted. SOLID-only was the original bug: gradients arrived as no fill at all. |
| `_figma_spec_for_model` | The measured design handed to the model: geometry, auto-layout, paints, radius, effects, typography + text, layer names, children. |
| `_assemble_with_model` | Calls `grace_gui.query_llm(mode="console_assembly")` with the spec + the catalogue's component names. Returns `{surface, components[{name,tag,reason,code}], rawReply, error}`. |
| `_validate_generated_module` | esbuild compile check (`frontend/node_modules/.bin/esbuild`). Missing esbuild reports `ok: true, note: …` — a note, not a pass. |
| `_generate_lit_component` | The **fallback** generator (template). Emits the repo's Lit convention: static `properties`, `declare`d fields, constructor defaults, `customElements.define`. Never decorators. |
| `_register_in_figma_map` / `_register_in_allowlist` / `_register_in_catalog` | The three registrations (below). All textual splices — the registry files are hand-laid-out and must stay byte-identical apart from the addition. |
| `_sync_catalog_claims` | Keeps `README.md` / `READ-ME/IMPLEMENTATION_CONFORMANCE.md` counts equal to the catalog's, because `doc-claim-drift` is blocking. |
| `_catalog_check` | Runs `npm run catalog:check` and returns its verdict + findings. |
| `_log_ingest` + `_activity_insert` + `_activity_from_db` + `_activity_backfill` | The record: JSONL file **and** Postgres table. |

**Endpoints (all under `/api/figma`):**

- `POST /ingest` — body `{jobId, fileKey, nodeId, notes, sessionId, sessionTitle}`. Returns
  `result` with `tag`, `components`, `drafts{tag→code}`, `validation`, `assembled{model,
  generatedBy, surface, componentsFromModel, rejected, note, error, rawReply}`,
  `channels{rest, mcp, annotations, descriptions, assets}`, `mcp_parsed`, `rest_response`,
  `details{target_*, components_found, generated_files, spec}`.
- `GET /ingest/{jobId}` — job status + result.
- `GET /ingest/{jobId}/code/{tag}` — the draft source as plain text (what the preview loads).
- `GET /ingest/{jobId}/log` — the full record(s) for a job, raw reply included.
- `GET /activity?limit&sessionId&outcomes` — the procession. Prefers the database, falls
  back to the file, and says which answered (`source: "database" | "file"`).
- `POST /commit` — body `{jobId, tags?, addToCatalogue}`. See §4.
- `POST /discard` — body `{jobId}`. Drops drafts/validation/meta/job.

**Frontend:**

- `frontend/src/components/IngestModal.tsx` — the tool. Props: `open`, `onClose`,
  `apiFetch`, `sessionId`, `sessionTitle`. `MAX_DRAFTS = 5` (becomes 1 — see §5).
- `frontend/src/components/LeftVerticalMenu.tsx` — mounts it; the rail menu item is
  "Ingest Design"; tracks `activeSessionId`/`activeSessionTitle` from the
  `prompt-session-loaded` event (`detail: { sessionId: p.id }`) the rail already dispatches.
- `frontend/vite-plugin-figma-preview.ts` — serves `/@figma-preview/<jobId>/<tag>.ts` by
  fetching the draft from the backend, so Vite compiles it like a real file (TypeScript,
  the `lit` bare import). Registered in `vite.config.ts`. **Dev-only — see §5, Stage 4.**

**The record:** `backend/logs/figma-ingest.jsonl` (append-only, primary) and table
`figma_ingest_activity` (`kind, session_id, session_title, actor, job_id, node_id,
node_name, tag, generated_by, error, note, rejected jsonb, written jsonb, verdict, at`).
Backfill from file → table is idempotent (keyed on jobId+kind+at).

## 3. Facts that were measured, not assumed

- **A FIGMA NODE ID CARRIES TWO FACTS, and every comparison has to know which one it is asking
  about.** `I40001206:3418;40001205:5529` is a component REFERENCE (`i40001206:3418` — the part
  before the semicolon, the same for every instance of that component) followed by an
  OCCURRENCE (`40001205:5529` — the part after it, which is only the LOCATION that instance sits
  in). Compare the whole string and a second instance of a known component reads as a brand-new
  node. Owner's framing, verbatim: *"That's why we use the numbers after the colon — the ability
  to distinguish children in other areas although they share the first part of the id. Every
  trailing four numbers are simply ids for the location, not for the component."* Implemented
  once per side and the two must agree: `node_code_identity` / `node_location` / `node_ids_match`
  in `backend/routes/figma.py`; `nodeIdentity` / `nodeLocation` / `sameComponent` in
  `frontend/src/shared/node-id.ts`; the rule is also written into `registry.json` under
  `_meta.nodeIdGrammar`. Used for: the map lookup, the collision/instance split, the
  design-system context, the tag built from a `componentId`, history-for-tag, and the tree's
  "this layer is one of ours" mark. The FULL string is still what is stored and sent.
- **A REMOVAL TOUCHES ONE COMPONENT AND NO CHILDREN.** `_remove_component` deletes one tag's file
  and its own registrations, and nothing else. Owner, verbatim: *"When a child is created and it's
  shared with other components, you can't remove all other instances — you can only remove that
  component's relationship to that child."* There is **no guard** on removal and there must not
  be: an attempt to add one (a 409 refusing to delete a component other components compose) was
  built and removed on the owner's instruction, 2026-09-29 — *"There is no guard remove the guard
  there's no guard."*
- **A STAGED PREVIEW IS A CACHE AND IT EXPIRES — IT IS NOT SAVED WORK.** Owner, 2026-09-29:
  *"they're not really drafts. They're just staging previews. They shouldn't even be held if I
  walk away or the browser crashes or the internet goes down — that should disappear… I guess
  it's a cache preview more than anything."* The server holds the one staged preview plus
  `ingest_preview_seen[job]` — the last moment anything asked about it — and
  `_expire_stale_previews()` drops it after `INGEST_PREVIEW_TTL_SECONDS` (default 90, env
  `FIGMA_PREVIEW_TTL_SECONDS`) with no sign of life. The open screen sends
  `POST /api/figma/preview/heartbeat` every 30s while a staged preview is on it; reading the
  code, polling the job, asking a question and approving all touch it too — every measure is
  "since anything last looked", never "how old the file is". The sweep runs on the REQUEST PATH
  before the request is served (never a background timer, so there is no race with an approval),
  and dropping a preview clears drafts, validation, meta, job and stamp — nothing on disk exists
  to clean up. A reload keeps the preview; a closed tab, a crash or a sleeping machine loses it.
- **THE HISTORY IS READ WHERE A DECISION IS MADE.** `GET /api/figma/component/{tag}` already
  returned `history` (`_history_for_tag`, matched by tag OR by the component part of the node);
  it is now shown as the **"Its history" accordion inside Show Details**, beside the target node,
  the code and the check — for a draft as well as a component, because re-importing a node or
  overwriting a name is exactly when its past matters. Rows that record the same thing about the
  same subject at the same moment are collapsed when displayed (the record itself keeps every
  row). This is what made the seat's incident legible: `f-40001204-5752` was approved, removed,
  re-approved, removed, discarded, approved, removed and re-approved under a different name,
  all in the record, none of it ever on screen.
- **THE ACTIVITY LOG IS MEASURED AND TRIMMED BY HAND, NEVER BY ITSELF.** `_activity_audit()`
  reports the log file's KiB/lines and the table's row count on every activity read (read-only,
  `os.stat` + one COUNT), with thresholds `INGEST_ACTIVITY_WARN_KIB = 4096` /
  `INGEST_ACTIVITY_WARN_ROWS = 5000`; the panel shows a warning with a trim button when either is
  crossed. `POST /api/figma/activity/purge` deletes activity entries older than `days` (default
  30, the owner's "after a month") **only when `confirm: true`** — the UI dry-runs first and
  shows the cutoff. It touches the activity table and the log file and nothing else: not a
  component, not the Figma map, not the allowlist, not the catalogue, not the layer record. Lines
  whose timestamp cannot be parsed are KEPT. Owner, 2026-09-29: *"That's just a basic activity log
  for auditing purposes that should be purged after a month… just give a warning when they get too
  large… I don't wanna play a game of whack-a-mole."*
- The app's model is DeepSeek `deepseek-chat` via `grace_gui.query_llm`; assembly modes are
  `console_assembly` / `surface_assembly`, strict-JSON contracts.
- `frontend/src/components/lit/` holds 33 `.ts` files and **not one decorator**; 32
  self-register with static `properties` + `customElements.define` (verified 2026-09-27). `tsconfig.app.json` sets
  `useDefineForClassFields`, so a field initializer would shadow Lit's accessor: use
  `declare` + constructor assignment.
- The A2UI resolver's last path is `TAG_REGISTRY[pascalToKebab(name)]`;
  `pascalToKebab("f-40001185-2176")` is unchanged, so a registered `f-…` tag resolves.
- `npm run catalog:check` is the gate and **its verdict is what "done" means**. As of
  2026-09-29: `53 components, 13 finding(s), 1 blocking` — the blocking one is pre-existing
  (`room-embed` declares a `seat` slot the element does not render). None of the findings
  come from ingested components. (Before the comment fix below it read 15 findings / 3
  blocking.)
- **A COMMENT IS NOT A USE, and the measurement had to be taught that.** `catalog-check.mjs`
  strips block comments as whole blocks (`/* … */`), not line by line: dropping only lines that
  begin with `*` left the prose inside JSDoc in the text, so a doc comment writing
  `<chat-panel> — GRACE'S SEAT…` counted as that file drawing `<chat-panel>`. That made
  components appear to draw themselves and made `prompt-textarea` look composed by eight files
  that only mention it in prose — which would have refused the removal of components nothing
  actually composes. `renderedIn` is now free of self-references.
- MCP is reachable in this environment (Figma Desktop open, `127.0.0.1:3845`) — a bare GET
  returns 400, which is healthy.
- The owner's node `40001185:2176` ("Frame 886987", System Role / Tools) is ingested,
  approved and registered. It renders, chevrons included.
- Two env files hold **different** Figma tokens: the backend reads `backend/.env` (that one
  was revoked; the working token from `/Users/raibach/Documents/Raibach_IDS/.env` was copied
  in on 2026-09-27). `AGENT.md` contains a third, live token inline — **rotate it**.

## 4. The registration contract (do not shortcut it)

A component is only usable when it is in **all** of these, and the commit endpoint does all
of them:

1. **The element** — `frontend/src/components/lit/<tag>.ts` (tag regex
   `^f-[A-Za-z0-9-]{1,120}$`, path containment checked).
2. **The Figma map** — `frontend/src/components/registry.json` ("THE FIGMA MAP": which Figma
   node a component came from). Hand-formatted; splice textually.
3. **The allowlist** — `frontend/src/shared/tag-registry.ts`: a `TAG_REGISTRY` entry **and** a
   line in `AI_PLAYGROUND_TAGS` (without the second, the gatekeeper refuses to let the AI
   emit it).
4. **The catalog** — `A2UI/catalogs/prompt-composer/catalog.json`: the definition **and** its
   `$defs.anyComponent.oneOf` reference (the second edit is the one the catalog checks catch).
5. **Counts** — `_sync_catalog_claims`, or the gate goes to 2 blocking.
6. Then `npm run catalog:check`, whose verdict is returned to the UI and shown on the card.

**Two deviations from the owner's pasted plan, both deliberate and both to keep:**

- Commit takes **only a jobId**; the code comes from the server's own drafts and the path is
  derived from a validated tag. The pasted plan had the browser send `code` **and**
  `filePath` — that is arbitrary file write from a request body.
- Approval is the only write. Ingest writes nothing.

## 5. Next step — make it a plugin (the owner's decision, staged)

The owner's decisions are settled; do not re-open them: it becomes **a plugin/tool** offered
in the function/tool list, **one component at a time**, with **its own third-column output
process** (it may replace the canvas or part of it), **kept on the left rail until then**,
and the model never places components — the owner names a node and where it goes.

- **Stage 1 — mount it as an output display type.** Read the third column first
  (`workspace-layout.ts`, `output-controls.ts`, `output-header.ts`,
  `compiled-output-viewer.ts`, `canvas-lab/`, `room-embed.ts`) before deciding where the
  mode switch goes. Add a `variant="inline"` to `IngestModal` that fills its container
  instead of covering the viewport; the overlay stays for the rail entry.
- **Stage 2 — lift the state into the harness.** Drafts die when the view closes; they
  should live where packages live, so a session's drafts survive view changes and a draft
  can be an artifact of its package. The package id is already the `sessionId` on every
  record.
- **Stage 3 — `MAX_DRAFTS = 1`.** One node, one prompt card, one package.
- **Stage 4 — the production preview path.** `vite-plugin-figma-preview.ts` is the single
  piece that cannot survive leaving `vite dev`. Replace it with a backend that compiles the
  draft (esbuild is already a project dependency, `_validate_generated_module` already calls
  it) served as a module, or a build-time virtual module.
- **Stage 5 — later, the owner's second use of this feature**: the same pipeline stocks the
  design-system catalog shipped to customers' front ends.

## 6. Known limits (state them, don't paper over them)

### Added 2026-09-28 late — the artwork, and a check that does not check

- **The artwork is now kept** (`_vendor_assets`, `_repoint_assets` in `backend/routes/figma.py`).
  Assets arrive as a data URI, an inline SVG or an **MCP URL** — a pointer at the Figma server,
  which is only up while Figma is open. A component that shipped with the pointer lost its chevron
  the moment the designer closed the file, which is exactly what happened to `f-40001204-5752`.
  Now: every asset is written into `frontend/public/assets/` at approval, the component's URLs are
  repointed at those copies, and the layer record keeps the list per node (`assets`, with the file
  that serves it). A pointer keeps the MCP server's own hash as its name (`figma-959a83b…svg` — the
  same name this repository already used), anything carrying bytes is named by a hash of them, and
  an asset whose bytes cannot be obtained is **reported in the record** (`file: null` plus why)
  rather than dropped quietly.
- **THE PRE-APPROVAL CHECK DOES NOT RESOLVE IMPORTS.** `_validate_generated_module()` runs
  `esbuild --loader=ts --format=esm` — no `--bundle` — so it transpiles and never resolves a module
  specifier. A generated component whose second line was `import './f-40001177-2459.js'` passed the
  check, then broke the browser with a Vite overlay; the same check gates the approve, so approving
  it would have written a broken import into `lit/` — the failure that blanked the whole app when
  `main.tsx` imported a file that had been deleted. Fix: resolve the relative imports against the
  job's other modules and the files in `lit/`. (`START-HERE.md` §4 item 2.)
- **`_name_collisions()` has two blind spots** — it skips the frame being ingested
  (`if node is spec: continue  # the root is what is being built`), and it compares a layer's own
  node id, so an **instance** of a component we have (`[40001204:5753]` of `40001204:5752`) is
  reported as a name taken by a stranger, and the form then offers to write the whole frame under
  that component's tag. Both verified live on node `40001177:2458`. (`START-HERE.md` §4 item 1.)
- **The design's behaviour is not captured at all.** The spec holds geometry, layout, text, fills
  and assets; there is no field for interactions, prototype reactions or data bindings. So a design
  that has gained a dropdown arrives as a drawing and the element that comes out of it is static
  while the design is not. The audit can say the element implements nothing (`behaviour — empty`);
  nothing can say yet what the design intends. (`START-HERE.md` §4 item 3.)

### From before

- Text inside a **library** component has no `style` in this file's REST data; only the MCP
  reference code may carry its font.
- Node positions are absolute canvas coordinates (a node can sit at x ≈ −20495); a consumer
  must treat them relatively.
- The preview loads **Inter 100–900 only**; a design using another family falls back.
- The **template fallback** renders a frame's non-component children as empty slots; the
  model path draws them. A fallback is never silent: a red banner names it and shows the
  model's error, every rejection, and her reply.
- The model sometimes tags a nested layer instead of the ingested node; a **single**
  mis-tagged component is adopted under the node's tag and the substitution is recorded as
  a rejection.
- `f-40001114-5687` is registered from the agent's own rehearsal (the owner may want it
  removed). Log rows written before kinds were recorded show as `(pre-kind)`; they were
  imported into the table rather than dropped.

## 7. How to run and verify (do this before claiming anything works)

```bash
# backend (8000) — required after any backend change
cd /Users/raibach/Documents/Raibach_IDS/backend && lsof -nP -iTCP:8000 -sTCP:LISTEN -t | xargs -r kill
nohup .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 > "logs/uvicorn-$(date +%Y%m%d-%H%M%S).log" 2>&1 & disown

# frontend (5001) — restart ONLY when vite.config.ts changes; HMR covers component edits
cd /Users/raibach/Documents/Raibach_IDS/frontend && node node_modules/.bin/vite --port 5001 --strictPort

# typecheck + lint what you touched
npx tsc -b --noEmit 2>&1 | grep -i <file>   # pre-existing errors exist elsewhere; don't chase them
npx eslint src/components/IngestModal.tsx

# the gate — the verdict is the acceptance test
npm run catalog:check

# an ingest without the UI
curl -s -X POST http://localhost:8000/api/figma/ingest -H 'Content-Type: application/json' \
  -d '{"jobId":"<uuid>","fileKey":"20UPR2KQMsbAxlo5NJb1se","nodeId":"40001185:2176",
       "sessionId":"<pkg>","sessionTitle":"<prompt title>"}'
curl -s "http://localhost:8000/api/figma/activity?sessionId=<pkg>&outcomes=true"
```

Then in the browser: rail → **Ingest Design** → paste the owner's URL → preview the design →
**Approve & add to catalogue** → the card shows the files written, each registration, and
the gate verdict.

## 8. Open questions for the owner (ask before building, not during)

1. Where the tool entry lives in the function list, and what it is called.
2. Whether an approved component should also write into its package's own history (the
   record today is the activity table + JSONL, keyed by `sessionId`).
3. Whether the preview should also render the model's **assembled surface** (the A2UI JSON
   she returns alongside the component) rather than only the component. Today the surface is
   shown as JSON in the details, not rendered.
