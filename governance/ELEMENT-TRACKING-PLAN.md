# ELEMENT-TRACKING-PLAN — every element's record, and the governance layer that keeps it

**Status: PLANNED (2026-10-13 night) — nothing built from this file yet; it is the write-up the owner asked for.**
The next focus, in the owner's words: *"tracking elements in the system needs to be our next focus so that we're
not just tracking assembly and chats."* This file is a CHAT HANDOFF: read it top to bottom before touching
anything, and re-verify every TO VERIFY item before building on it.

Companion: `governance/TRACE-SEAT-PLAN.md` (the model/chat lens — PLACED), `/memories/repo/raibach-ids.md`
(the operating card). Local until verified; nothing ships to the box without the owner's explicit word.

---

## 0. THE THESIS (the owner's framing, 2026-10-13)

> *"Figma is definitely trying to keep them in their cloud while I'm actively building an interface and design
> system that … allows people to leave. Because we're gonna be tagging our Figma elements whenever we put them
> into the system and this governance layer is gonna be tracking them. We might have to use PostHog, but I'm
> hoping to leverage Langfuse in the same way."*

Decoded as rules: **elements leave Figma TAGGED; the system keeps the record; the governance layer shows it.**
The record must be able to leave with the person — that is the whole point of the product — which decides the
tool question in §3 before any code is written. "Not just assembly and chats" = the governance room currently
accounts for model work (traces) and conversations (packages/threads); the missing third is the ELEMENTS
themselves.

**AND THE FRONT END (added the same night):** *"This application is gonna serve a front end. And I want to
know how the users are interacting with it. I mean right now we're tracking how internal teams use it but the
idea of the Figma components is those tags will be actively engaged with by users on the front end and that's
important information … but we should capture that inside of our application."* Decoded as a rule:
**end-user engagement is part of the record too** — the tags are the instrumentation, and the COLLECTOR is
our application (never a third-party pixel as the source). Internal usage (assemblies, conversations) and
end-user usage (front-end engagement) are the same record's two halves.

---

## 1. THE GROUND — VERIFIED (what already exists, with file evidence)

1. **An element's identity is its tag — no new table defines it.** An element IS a `prompt_sessions` row:
   `design_master` (one per catalogue component, keyed `(catalogue_id, element_key)` by a partial unique index)
   and `design_child` (one per element inside a master, keyed `(master_id, element_key)`). The DDL says it
   plainly (`backend/init_db.py:714-720`): *"A component's IDENTITY is its tag in a catalogue plus its entry in
   the registry."* Rows are written by `backend/sync_design_elements.py` (idempotent, `ON CONFLICT DO NOTHING`);
   the design room already lists them (the `/session/elements` section — one row per component; readers:
   `backend/routes/ai.py`, `frontend/src/components/lit/component-preview.ts`).
2. **The four record tables exist, with the owner's own doctrine in their comments** (`init_db.py:744-810`,
   written 2026-09-30):
   - `design_element_activity` — THE TRAIL: what happened to the element, one row per event
     (`actor`: user/ingest/catalogue-sync/…; `action`; `detail` JSONB; `at`). "The activity trail is read row
     by row."
   - `design_element_annotations` — notes/decisions/questions, one table with a `kind`; `target` attaches an
     entry to a PART of an element ("the padding on the status icon is wrong" has somewhere to go).
   - `design_element_versions` — THE INTENT, NOT THE CODE: why it changed + a pointer at the commit
     (git holds the code; a copy here would drift).
   - `design_element_metrics` — THE MILLIONS CASE, separate on purpose: "Partition by month and index
     (element_id, at) when it earns it; do not build that shape before it is needed."
3. **The tagging door already works at INGEST.** `backend/routes/figma.py` writes `figma_ingest_activity` for
   every ingest event (the node, the tag, what was written, the verdict, the reason). `backend/backfill_element_activity.py`
   copies those events into the elements' trails, keyed by the tag — 68 events matched, each row carrying its
   `ingest_event_id` (idempotent re-runs).
4. **Catalogue sync writes the trail too** (`sync_design_elements.py` → `catalogue-sync` rows: added/changed/
   removed against the catalogue file).
5. **Governance already joins elements:** `governance_items` carries `component`, `node_id`, `file_path`,
   `catalog`, `package_id` on its findings — the join to these elements is the component tag (`init_db.py` note).
6. **MISSING today (grep-verified):** no runtime writers (nothing records "this element was USED" — placed in an
   assembly, edited, annotated, verified); NO reader UI for the trail/annotations/versions/metrics (zero hits in
   `frontend/src` for element activity); no join from model traces to element tags.
7. **TO VERIFY before building** (do not assume):
   - Where an assembled package stores its TREE (candidate: `prompt_sessions` metadata; confirm the exact shape
     — the derive-uses scan in M2 depends on it).
   - Whether the ENGINE's build traces can carry component tags today (the fork's trace view already renders
     tags — confirm the write side, and whose code writes them).
   - The exact element read endpoints in `routes/ai.py` (extend them or add `routes/design_elements.py` —
     decide after reading how the design room scopes its reads).
   - Auth/user scoping the design room applies to element rows today.

---

## 2. WHAT "TRACKING" MEANS — the events that belong in the record

The schema's own scales decide the shape; keep both honest:

**THE TRAIL (low volume, read row by row — `design_element_activity`):**
- `ingested` (exists), `catalogue-sync` (exists);
- `placed` — the element used in an assembly (derivable by scanning packages for the tag, OR emitted by the
  build; prefer the derive-then-verify approach below);
- `annotated` — a note/decision/question landed (people now; the model later through a tap);
- `versioned` — a change shipped (change_type + description + commit pointer);
- `verdict` — a governance finding landed on it (from `governance_items`; write-through or derive-on-read —
  decide with the findings writer in view).

**THE METRICS (the millions — `design_element_metrics`, nothing raw in the trail):** renders, interactions,
timings — aggregated, dimensions as JSONB, partition shape only when it earns it. **THIS IS ALSO THE
END-USER LAYER:** when a front end built with this system serves real users, their engagement with tagged
components (viewed, clicked, engaged, dismissed …) lands HERE, per tag, with `dimensions` carrying the
context that makes it useful (front-end id, surface, package, anonymous session id, day). Aggregated AT THE
DOOR (counters per tag per dimension set), so the millions never become rows a person reads — the trail
stays the story, the metrics stay the counts.

**THE RULE:** if a person would scroll it in the element's record, it goes in the trail; if it is counted, it
goes in metrics; if it is neither, it does not get recorded at all (containers and colours get NO row — the
owner's own priority ruling).

---

## 3. LANGFUSE vs POSTHOG — the honest answer

- **The record of truth is OURS** (the four tables). The leave-the-cloud thesis from §0 decides this: the
  element's record must travel with the system and the person; a vendor analytics cloud as the record would
  rebuild the exact lock-in the product exists to break. The tables already have the right shapes; they stay
  the source.
- **Langfuse is the MODEL lens, and that is the "same way" it genuinely fits:** (a) build traces that touch
  components can carry the component tags they touched — then the governance room (which already reads
  Langfuse) shows, per element, *what the model did with it*, by joining trace-tags ↔ element-tag; (b) quality
  scores per element can attach to traces as scores. What Langfuse must NOT become: the place where element
  usage lives (interaction telemetry is not LLM work; wrong tool, wrong volume).
- **PostHog: DEFERRED, deliberately.** The metrics table's own doctrine says not to build the millions shape
  before it is needed. If volume ever earns it, the honest use is anonymous aggregate browser telemetry —
  never the record — and adopting a second cloud is a decision the owner makes with that contradiction in
  view. No PostHog work in this plan.
- **THE CAPTURE IS OURS, by the owner's rule (2026-10-13):** *"that's important information … but we should
  capture that inside of our application."* The front-end engagement endpoint lives in this application; any
  analytics tool (PostHog included, if it ever earns a place) READS FROM our capture — it never becomes the
  capture.

---

## 4. THE STAGES (next focus — each ends verified in-room at :5001 before the next)

**M1 — the trail's read API.** One read for one element's whole record: element row + trail + annotations +
versions (metrics when asked). Where: extend the existing element endpoints in `routes/ai.py` or add
`routes/design_elements.py` — decided after the TO VERIFY read of how the design room scopes its element reads.
No UI yet; verified with a real element's id (`curl` against :5001 and the row counts must match the DB).

**M2 — the writers widen.** (a) THE USED SCAN: for every package, find the elements its tree names, write
`placed` trail rows idempotently (a backfill script, same pattern as `backfill_element_activity.py`; requires
the TO VERIFY tree shape). (b) ANNOTATION WRITES: the API half of the annotations table, so the design room
(and later the model) can file a note against an element or a `target` inside it. (c) VERDICT WRITE-THROUGH:
when `governance_items` gains a finding naming a component, its trail says so.

**M3 — the viewing home: THE GOVERNANCE ROOM** (the owner's ruling: *"this governance layer is gonna be
tracking them"*). The element lens, built the house way: a read module (`lib/…-source.ts`), registry
components as VIEWS that never fetch, the shell wiring props — the exact pattern the trace views now prove.
First face: the element STRIP (tag, catalogue, package id, counts) + the TRAIL list (actor, action, when,
verdict chips). Annotations and versions next, in the same slots. The trace seat's laws apply verbatim
(placement first, no clamps, no invented states — empty is stated honestly).

**M4 — THE FRONT-END DOOR (the end-user layer, added 2026-10-13 night).** The application will serve front
ends, and their users' engagement with tagged components must land in OUR capture. One anonymous-friendly
batch endpoint (tag + event + anonymous session id + front-end/surface id, small JSON body), writing
AGGREGATED rows into `design_element_metrics` (the millions doctrine — counters, never raw rows). First the
endpoint + a tiny client helper the tagged components can call; then the element view grows an ENGAGEMENT
line (counts by day/surface — the same read pattern as everything else, via M1's record read). This is the
layer Google's tagged-analytics direction wants — collected inside our own application, never a third-party
pixel.

**M5 — the model lens joins.** Once the engine's traces carry component tags (TO VERIFY), the element view
gains *"what the model did"*: the trace reads the room already owns, filtered to the element's tag. This is
where "leverage Langfuse in the same way" lands.

**M6 (conditional, later) — the PostHog question, if volume ever earns it.** §3 stands: it would read FROM
our capture; the partition shape of `design_element_metrics` is built only when volume demands it.

---

## 5. WHAT NOT TO DO

- Do not define elements anywhere new — the tag in the catalogue + the `prompt_sessions` row IS the identity;
  a second definition is the drift the schema comments already forbid.
- Do not record raw interactions in the trail (millions — the schema says where they go).
- Do not make Langfuse (or any cloud) the holder of the element record.
- Do not build the metrics partition shape before volume earns it.
- Do not touch the box; local only until the owner's word.
- The front-end capture is OUR endpoint — no third-party pixel becomes the source of record; tools read
  FROM our capture, never around it.
