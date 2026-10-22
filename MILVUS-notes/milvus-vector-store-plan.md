# The vector store — where it stands, and the plan

Written 2026-09-29, from measurements taken that night. Every number below was read off the live
system, not estimated.

**THE GOAL: a vector store running on the Northflank site.** Not on the laptop — on the site, where
the product actually runs. That goal is what ranks the options below, and it is why the plan
recommends the only route whose store survives a deploy.

**WHERE IT HAS GOT TO**

| step | state |
|---|---|
| The store's destination | **DONE, free.** pgvector 0.8.3 is installed on the production Postgres and verified working at 384 dimensions. |
| Getting the vectors there | **NOT DONE.** Needs the wrapper written against pgvector, and a reindex. |
| Making the vectors | **NOT DONE, and it is the money question.** The embedder needs 500 MB–2 GB; the container has 512 MB. |

**A note on the word "vector."** There is already a `vector-pivot-handoff.md` in this folder and it
is about a completely different thing: Figma's *artwork* vectors (SVG paths, the `Catalog_node`
icon). This document is about the vector *database* — Milvus — and the embeddings stored in it.
They are unrelated, and confusing them wastes an afternoon.

---

## The two facts that decide everything

Everything else in this document follows from these, so they come first.

### 1. Production has no persistent disk. Its filesystem is erased on every deploy.

Measured: the service has **no volumes configured** (checked in the raw spec, not inferred), and
the container that serves the site started fresh at 21:36 with no store file in it. Production was
redeployed three times tonight; each one started from an empty filesystem.

**This is the fact that kills the obvious fix.** The plan was always "run the embedded store where
the app runs." That cannot work here: whatever the store writes is destroyed the next time anybody
pushes code. More memory does not help. A bigger container with no disk keeps losing the vectors.

### 2. Production cannot run the store or the embedder within its memory limit.

The container is capped at **512 MB** (`nf-compute-20`, $5.40/month). At steady state it has about
**41 MB free**. Two things need far more than that:

- **The embedded vector store** wants about **700 MB of headroom**. The app measures the real
  cgroup budget, refuses to open it, and says so on every boot:
  `Only 41MB memory available — the embedded vector store needs about 700MB of headroom and is not
  opened. Vector features are off on this instance.` That guard is not a bug; the comment above it
  records that opening it anyway got the process OOM-killed in a crash loop (exit 137).
- **The embedding model** (`BAAI/bge-small-en` via sentence-transformers) needs torch and roughly
  500 MB–2 GB resident. It cannot load in 41 MB either.

Note that `psutil` reports **740 MB available** inside that container, because it reads the host's
`/proc/meminfo` rather than the cgroup. `config.py` already documents this trap at length. Any
future measurement must use the cgroup figure, or it will be wrong in the optimistic direction.

---

## What is actually broken today

| | state |
|---|---|
| **Production** | Milvus **OFF**. Health reports `"status":"degraded"`, `degraded_services:["milvus"]`. |
| **Local machine** | Milvus **WORKS** — 8 collections created, health `ok`. But **all 8 are empty.** |
| **Zilliz Cloud** | **GONE.** The endpoint `in03-…zilliz.com` does not resolve in DNS. The two dead env vars (`MILVUS_URI`, `MILVUS_TOKEN`) were removed from production on 2026-09-29. |

**Nothing is lost.** Every vector ever stored was derived from a row that lives in Postgres — a
memory's text, a version's snapshot, a conversation's message — and those rows carry their vector
ids. `backend/reindex_local_vectors.py` rebuilds the index from those rows, which is why its own
header says the index "matches the record by construction."

**And nothing crashes.** `MilvusClientWrapper.connect()` returns `None` on failure and every caller
tolerates it. The app runs with vector features quietly off. This is a capability that is missing,
not an outage.

---

## What the vector layer is for

Eight collections, and what each one serves:

| collection | serves |
|---|---|
| `memories` | recalling what the system has been told before |
| `conversations` | finding related past conversations rather than exact matches |
| `prompt_sessions` | the same, for prompt packages |
| `prompt_versions` | finding a version by meaning |
| `ai_actions` | matching an intent to something already done |
| `governance` | searching the register, the corrections, the inspection findings |
| `files` | locating a file by what is in it |
| `default` | the general-purpose one |

The honest summary: **these are all "find the similar thing" features.** Nothing in the product
stops working without them — the app falls back to exact matching and structured filters. What is
lost is recall by meaning.

**That matters for how much this is worth.** It is a quality-of-life capability across several
features, not a blocker for any of them. The plan below is written on that basis: this is a
decision about how much to spend on semantic recall, not an emergency.

---

## The options, with real numbers

### Route A — pgvector, in the Postgres already paid for. **Recommended.**

`pgvector` **0.8.3 is already available** on the managed Postgres (`SDSManager` addon) — measured by
querying `pg_available_extensions` from inside the container. It is not installed; it is offered,
which means one `CREATE EXTENSION` away. That database is Postgres 17.10, has 6 GB of storage with
**14 MB used**, and is backed up. The Postgres addon costs nothing extra.

| | |
|---|---|
| **Store cost** | **$0.** It is the database already running and already billed. |
| **Durability** | **Fixed.** Vectors live in managed storage and survive every deploy. This is the only route that fixes fact 1. |
| **App memory** | The ~700 MB requirement **disappears** — search runs in Postgres, not in the process. |
| **Code work** | Real but bounded: `MilvusClientWrapper` exposes six operations (connect, create_collection, insert, search, get_collection_stats, delete_by_filter) across 66 call sites in 14 files. The wrapper is the seam; the call sites do not change. |
| **Migration** | `reindex_local_vectors.py` already rebuilds from Postgres. Point it at the new backend and run it. |
| **Scale** | Not a concern. The largest tables are 485 tag definitions and 226 prompt sessions. pgvector with an HNSW index is comfortable to millions of rows. |
| **Removes** | The `milvus-lite` dependency entirely, and with it a store that is single-writer, embedded, and tied to one machine. |

Cosine similarity maps directly: `vector(384)` with `vector_cosine_ops` and the `<=>` operator,
matching the 384-dimension COSINE configuration the code already uses.

### Route B — a persistent volume, and a container big enough for milvus-lite.

Northflank volumes can be attached, and the container raised until the embedded store fits.

| | |
|---|---|
| **Container** | ~2 GB needed (700 MB store headroom + the app + the embedder). `nf-compute-100-2` is **$24/month**, up from $5.40. |
| **Volume** | Additional cost, plus the operational fact that the store becomes a single-writer embedded database on a network volume. |
| **Code work** | None for the store. |
| **Keeps** | The stated design in `.env`: *"OUR OWN VECTOR STORE — local and embedded (milvus-lite); no cloud, no token."* |

Honest reading: this pays the most money to keep the design that is currently failing, and it still
leaves an embedded database with one writer and no query tooling. Route A is cheaper, more durable,
and easier to inspect.

### Route C — a managed vector service. **This is what Zilliz was.**

A new cluster, a new vendor, a new token, and per-use pricing. The reason Zilliz was retired is
recorded in `reindex_local_vectors.py`: *"weights … cached locally, so no network is needed"* and
*"zero model tokens, which is the point of the whole migration."* Route C re-creates the cost that
migration existed to remove, and Route A gets the same durability for nothing.

### Route D — leave production without vectors.

$0, no work, and the honest option if semantic recall is not worth caring about yet. The app is
already graceful about it. **This is the correct choice if the answer to "do we miss it?" is no.**

---

## The embedder is a separate decision

Whichever store is chosen, **something has to turn text into vectors**, and that is the other half
of the cost. Today it is `BAAI/bge-small-en` via sentence-transformers, computed locally.

The GPU stack was removed from the image on 2026-09-29 (torch + CUDA + triton, ~5.5 GB, taking the
container from 6.6 GB to 906 MB) precisely because it could never load. So the container currently
has **no** embedding capability, and installing it back on a deployment is a deliberate act —
`requirements-embeddings.txt` says so where someone would read it.

Three ways to embed:

1. **Give the process the memory.** The embedder needs ~500 MB–2 GB resident, so this means a 1–2 GB
   container: `nf-compute-50` (1 GB) is **$12/month**, `nf-compute-100-2` (2 GB) is **$24/month**.
   If torch is reinstalled for this, use the **CPU-only build**
   (`--index-url https://download.pytorch.org/whl/cpu`): about 200 MB instead of 1.2 GB plus the
   CUDA stack. There is no GPU in this account's plan list, so the CUDA build is pure waste.
2. **An embedding API.** No memory at all, stays at 512 MB, but it is per-call cost and an external
   dependency — the thing the Zilliz migration was done to avoid.
3. **Embed somewhere else and ship the vectors.** Production writes the row to Postgres; a job (or
   the dev machine) embeds and upserts. Cheapest runtime, most moving parts, and it introduces
   staleness between a row and its vector.

---

## What I would do

**Route A, with option 1 for the embedder — a 1 GB container.**

- Move the store to **pgvector** in the Postgres already paid for. It is the only route where the
  vectors are **durable**, it costs nothing for the store, it deletes the memory problem entirely,
  and the code seam is six operations rather than a rewrite.
- Raise the container to **1 GB** (`nf-compute-50`, $12/month, +$6.60) so the embedder can load,
  and install the **CPU-only** torch rather than the CUDA one.
- Total: **$12/month against $5.40 today**, and for that the vectors survive deploys, the app stops
  carrying a store it cannot open, and the container stays lean.

**If $6.60/month is not worth it**, the honest order is: do nothing (Route D) rather than Route B.
Route B pays more than Route A for a worse outcome.

**And whatever is chosen, do this first:** run `reindex_local_vectors.py` locally and confirm the
local store fills and semantic recall actually returns something useful. If the answers are not
noticeably better than exact matching, the whole question is moot and Route D is the answer. That
test costs nothing and is the cheapest way to decide.

---

## The concrete first step

No product code, no infrastructure change, and it answers the open question:

```bash
cd backend
.venv/bin/python reindex_local_vectors.py
```

It reports per-collection counts before and after, and reports — never silently skips — any row
whose content is empty. The local store is empty and working, so this fills it from Postgres. Then
exercise semantic recall by hand and judge whether the results justify any of the routes above.

Behind that, if the answer is yes:

1. ~~`CREATE EXTENSION IF NOT EXISTS vector;`~~ **DONE — 2026-09-29, and it worked.** Run from
   inside the production container against the managed Postgres as the addon's own user
   (`_7108355b2fa4c306`), it **succeeded**: pgvector **0.8.3 is now installed** on the production
   database. Verified working, not just installed — the cosine operator returns a real distance
   (`'[1,2,3]' <=> '[1,2,4]'` → `0.00854`) and a **384-dimension** vector is accepted, which is the
   dimension `config.py` specifies. This was the one checkpoint that could have killed Route A; it
   is cleared, and the store's destination now exists.
2. Add the table shape (one table per collection, or one table with a collection column) and write
   the six operations against it behind the existing wrapper.
3. Keep `milvus-lite` working behind the same wrapper so the two can be compared, switch production
   to pgvector, then remove milvus-lite once production is proven.

### What still stands between here and a working vector store on the site

The store's problem is solved. **The embedder's is not**, and it is the remaining blocker for the
site specifically. Production can now *hold* vectors; at 512 MB it still cannot *make* them, because
the model needs 500 MB–2 GB. So "Milvus running on Northflank" needs both halves:

- **Done / free:** a durable place to put the vectors (pgvector, in the database already paid for).
- **Not done:** memory for the embedder, or an embedding API instead of one. This is the $12/month
  question, and it is the only thing left that costs money.

Worth stating plainly: without the second half, a pgvector store on the site would be a store
nothing writes to — better than what exists today (nothing at all), but not yet the capability.

## How to know it is done

- Production health reads `"status":"ok"` with `"milvus":"connected"` — or, if the naming changes
  with the backend, whatever the store is called reads connected and `degraded_services` is absent.
- A redeploy does **not** empty the store. This is the specific regression to test, because it is
  the one that facts 1 and 2 guarantee if the store stays in the container.
- A semantic query returns results that a human judges relevant, not just non-empty.
