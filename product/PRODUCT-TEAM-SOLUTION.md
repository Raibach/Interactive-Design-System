# The product team's solution — what stands, and the next builds

Written 2026-10-04, at the end of the night the Product room became the tool. `PRODUCT-ROOM.md`
keeps the record of *how it got here*; **this file is the forward list** — what exists, what is
open, and in what order the owner's decisions unlock it. Nothing here is built until it says so.

---

## §1 — What stands tonight (driven, not claimed)

**The room.** The Product tab is the product team's ideation seat: clicking it **creates a new
project** in the app builder (the Composer's own door semantics) and opens its workspace. The
tool's dashboard is unreachable from the room by construction, a new project's preview shows an
honest splash ("nothing is built here yet") served by the engine rather than a 404, the chat sits
on the **right** (the app's own pattern), the back arrow and "My projects" go **to the console**,
and the project menu creates (`New project`), navigates (`My projects`), and no longer offers
`Custom domain`.

**The tool.** `wireframe-lab/ai-app-builder-open/` — the vendored MIT builder, running on a local
engine (`local-vcaas/server.mjs`) with DeepSeek behind it. Prompt → build in ~10–70 s with the
run progression in chat; live preview at `<project>.localhost:4000`; code panel; source ZIP;
versions with real line diffs and restore; run logs; export/import transfer codes;
`npm run dev:local` starts engine + builder together. Refused, with the reason in words:
Publish/Deploy, the Database panel, GitHub, Figma, custom domains, webhooks, attachments.

**The bridge.** A **published** project is a **package** on the console — one row per project, in the
Product Team category (its own color), carrying `builder_project_id`/`builder_preview_url`/`builder_runs`
as a REFERENCE (the tool's database stays where it is). **Publish is the commit** (the builder's top
control; the room's exit guard asks the same question on the way out — publish or discard, and a blank,
never-used idea is discarded in silence; projects from before publishing existed read as published, so
their cards were never disturbed). The console syncs on every assembly; a project deleted in the tool
removes its card. A card click opens the Product room **on that project**. A race that made five
concurrent assemblies create fifteen rows was found and fixed (one sync at a time), and the duplicates
were reconciled.

**Access writes, verified live.** The app's own grant/revoke/transfer module was driven whole:
grant to a real second user → visible in their list → transfer (ownership moved, previous owner
demoted to editor, the project reference rode the row) → transfer back → revoke. Two gaps were
closed: a second `owner` can no longer be granted (it was un-revocable), and grants/transfers to
a nonexistent user answer a named 404 instead of an opaque 500.

---

## §2 — The next builds, in the order the decisions unlock them

### 1. Claude in the builder (or in Grace) — a provider switch, not a secret

The owner asked whether Claude can run here instead of the system model. It can — there are two
paths, and the honest difference between them is what fails when:

- **Pure config (optimistic):** Anthropic publishes an OpenAI-compatibility layer
  (`https://api.anthropic.com/v1`), so the three values in `local-vcaas/.env`
  (`DEEPSEEK_BASE_URL`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`) can be pointed at it with a Claude
  model name and key. **The one thing to test before promising it:** the engine asks for
  `response_format: json_object` (the build contract needs JSON back), and if the compatibility
  layer does not honour that field the call fails or comes back unparsed.
- **The sturdy path (recommended if Claude is meant to stay):** a small provider switch in the
  engine (`MODEL_PROVIDER=anthropic`) that calls Anthropic's **native Messages API** — same JSON
  contract, ~30–40 lines in one file, no new dependencies, plus `ANTHROPIC_API_KEY` /
  `ANTHROPIC_MODEL` in the engine's env. The app's own Grace has the same shape of knob in
  `backend/grace_gui.py` (`MODEL_PROVIDERS` — "the env value is the knob").

**NEEDS:** an Anthropic key, and the owner's word on which system switches first — the builder's
agent, Grace, or both. Then the build is done and a real build is driven through Claude to prove it.

⚠️ **Secrets are NOT the model hook** — that panel is per-project (for the built app's runtime)
and inert locally; the tool's own model lives in the engine's `.env`.

### 2. The handoff out of ideation — product → development → design

*"They're gonna share it with design and with development and to be reviewed."* The endpoints the
review flow needs are **already real and driven** (grant/revoke/transfer — §1); what is missing is
the **UI half and the address book**: a "send for review" act on a product card, and the answer to
*who receives it and where the review lands*. The owner's earlier record named the landing place:
the queue (Slice C). **DECISION NEEDED:** who reviews (a team? a named user?), and does the card
move to them (transfer) or open to them (grant editor/viewer)?

### 3. The UI half of the access writes

Buttons for what already works: a Share/Review control on the console card (or in the room) that
grants a user or team a role, and a transfer flow with its confirmations. Small — the wheels exist.

### 4. Per-idea databases — making ideas real

The tool's **Database panel** is the one refusal that costs a product person the most: an idea like
"a CRM with contacts" wants its own database (records, tables), which is exactly what Totalum's
platform ships per generated app. Locally there is no per-project database. **This is the biggest
missing piece for ideation that feels real**, and it is a product decision before it is a build:
do ideas get data (and which kind — key/value, a real Postgres per project, or a JSON store the
preview can query through a small read-only endpoint)?

### 5. Memory / RAG — the system remembering its own work

The pipe already exists in this repository (`memory_embedder.py` with chunking, `grace_memory_api`,
`routes/memory.py`, `routes/milvus.py`, the `memory_provenance` table) — it is waiting for a corpus.
The corpora, in order of payoff:

1. **The console's own packages** — institutional memory: Grace answering *"have we built
   something like this before?"* from the company's actual work rather than in a vacuum.
2. **Research the owner compiles** — documents loaded in as a knowledge source for ideation.
3. **The cost ledger** (governance tables) — *"what does this kind of work cost us?"* as a
   retrievable fact.

**The first build is small and self-contained:** index packages on save, retrieve on ask. It
touches no schema (embeddings live in the vector store; provenance is already a table).

### 6. The styling pass

Everything is ours: the builder's UI (React/Tailwind in `ai-app-builder-open/src`), the engine's
splash page, the Product Team category's placeholder colors (`#1C2F4E` / `#D3DF44`), the room's
surroundings in the app. Deliberately untouched until the owner styles it.

### 7. The publish checklist (when a deploy is approved)

Every mutation added for this solution is **absent from `demo_policy.ALLOWED_MUTATIONS`**, so the
deployed demo refuses them (deny-by-default — the correct default): `POST /api/prompt-sessions/{id}/permissions`,
`DELETE …/permissions/{id}`, `POST …/transfer`, `POST /api/builder/sync`, `POST /api/builder/new`.
An allowlist entry is a publish-time decision, never a side effect of building the door.

### 8. Small open items

- **Attachments** in the builder are refused locally (a stretch: store + serve + tell the model the
  file exists — no vision on the current model).
- **Mobile layout of the builder** is untouched (one pane; it never had two columns).
- **The samples shelf** — see §3; inert reference clones may be deleted on the owner's word.
- `check_demo_policy.py` remains the published check; run it before any demo publish.

---

## §3 — Where everything lives (the map)

| piece | where |
|---|---|
| the room (embed + create-on-click + back arrow + health banner) | `frontend/src/pages/WritingAreaIndex.tsx`, `frontend/src/components/lit/builder-embed.ts` |
| the tool (MIT, vendored) | `wireframe-lab/ai-app-builder-open/` — `npm run dev:local` (engine 4000 + builder 3223) |
| the engine (the tool's brain; DeepSeek behind it) | `wireframe-lab/ai-app-builder-open/local-vcaas/` (`server.mjs`, `.env`, `README.md`) |
| the tool's store (JSON per project + mirrored files) | `…/local-vcaas/data/` |
| the bridge (projects ⇄ packages) | `backend/routes/builder_bridge.py` |
| the app's database | Postgres 15, `postgresql://localhost:5432/railway` (see `backend/.env`) |
| the cards' category | `categories` row "Product Team"; colors from the card's own mechanism |
| the record of how it got here | `PRODUCT-ROOM.md` (this file is the forward plan) |

**Cleaned tonight:** the three download archives (`ai-app-builder-open-main.zip`,
`ai-elements-main.zip`, `chatbot-main.zip`) and every `.DS_Store` — all extracted folders stand
beside where the archives were. What remains is 3.1 GB, almost all `node_modules`:

- **Never delete:** `ai-app-builder-open/` (the tool, live), `chatbot-main/` (the running chatbot
  preview on :3222 — reference for the seat pattern).
- **Inert reference, deletable on the owner's word:** `builder-main/`, `mitosis-main/`,
  `ai-elements-main/`, `agent-native/` — the samples shelf named in `PRODUCT-ROOM.md` §9. Their
  docs cite the names, so deleting them should be a deliberate act, not folder hygiene.
- **Keep:** `catalogs/` (design-system sources for ingestion), the six `.md` documents.

---

## §4 — The open questions (the owner's to answer)

1. **Claude** — which system switches first: the builder's agent, Grace, or both? (and the key)
2. **The review handoff** — who reviews an idea (a team, a named user?), and does the card move to
   them or open to them?
3. **Per-idea databases** — do ideas get data? Which kind? (This is the biggest product decision
   on this list.)
4. **Memory** — start with the console's own packages as corpus #1? (small, self-contained)
5. **The samples shelf** — delete the four inert reference clones?
