# Design artifacts in the database — a plan to evaluate

Written 2026-09-30, from a survey of the live production database. **Nothing has been changed.**
This is for you to read, argue with, and correct before anything is built.

---

## The question, and the answer

You asked whether there is a dedicated space for storing design system components as reference.
**There is not.** Three tables touch this area at all, and none of them holds a component:

| table | cols | rows | what it actually is |
|---|---|---|---|
| `figma_specs` | 5 | 16 | a **measurement cache** — `file_key, node_id, name, spec, synced_at`. Raw Figma JSON, kept so the API is not called twice for the same node. |
| `figma_ingest_activity` | 17 | 1 | an **event log** for ingests — `kind, actor, verdict, written, rejected, reason`. One row. |
| `prompt_artifacts` | 6 | 0 | empty. |

**The design system's components are not in the database at all.** They live in the repository:
`frontend/src/components/registry.json`, `custom-elements.json`, the catalogue JSONs, and
`tag-registry.ts`. So today:

- the **component** is a file in git, described by a JSON registry;
- the **design it came from** is 16 cached Figma nodes;
- the **findings about it** are 64 rows in `governance_items`, each with `component` populated.

That last one is the interesting part, and it is the thing to build on rather than replace — see
*What already exists* below.

---

## Read this before the schema: what a vector database actually does

You said, honestly, that you are not sure what a vector database does. That matters more than any
table in this document, because the plan changes shape depending on the answer.

**A vector database does exactly one thing: it finds things that are SIMILAR.** You give it a piece
of text, it turns that text into a list of numbers (an embedding), and it answers "which of the
things you gave me earlier are nearest to this?" That is the whole capability. It is very good at
that and it does nothing else.

Here is the test that matters. Your list of what a design component needs:

| you asked for | where it belongs |
|---|---|
| annotations | **Postgres** |
| styling references | **Postgres** |
| notes | **Postgres** |
| audit trails | **Postgres** |
| history | **Postgres** |
| versioning | **Postgres** |
| users, per-user activity | **Postgres** |
| portable, shareable | **Postgres** |
| "500 entries for a design" | **Postgres** |
| "millions of interactions" | **Postgres** (a different table, see below) |
| *"find components like this one"* | **the vector index** |

Everything you described except the last row is relational data, and a vector database is the wrong
tool for all of it. It has no notion of a version, a user, a foreign key, or an audit trail. It
cannot enforce that an annotation belongs to a real component, and it cannot count reliably. If you
built versioning on Milvus you would be writing all of that by hand, badly, on top of a search
index.

**Your own code already says this.** `backend/reindex_local_vectors.py`:

> *"every vector ever stored there was DERIVED from a row that lives in Postgres … The local store
> is rebuilt from those rows, so the index matches the record by construction."*

That is the correct relationship, and it is worth stating as a rule:

> **Postgres is the record. The vector index is a derived accelerator — rebuildable, disposable,
> and never authoritative for anything.**

Which is good news, because it means the vector layer is the *small* part of this job. It is
approximately one table and one reindex. Everything else you asked for is ordinary, well-understood
relational design — and it is where the design work should go.

**And the vector layer does have one genuinely valuable job here**, so it is not a distraction:
*"describe what you want in words and find the components that match."* For a design system that
grows to hundreds or thousands of components, searching by description rather than by exact name is
the difference between a catalogue people use and one they ignore. That is a real feature and the
vector index is the right tool for it. It is just one feature, not the foundation.

---

## Evaluating the structure you described

You described the database as the brain, compartmentalised by the top navigation: enterprise →
user → their console → packages, with the console as its own package rather than a rollup of
everything. Here is how much of that exists today.

**What exists:**

- `users` — 12 rows. Real, and used.
- `prompt_sessions` — **226 rows. This is what "packages" currently means**, and it is doing that
  job well: `id, user_id, title, category, project_id, is_active, is_archived, current_version,
  status, likes, model_name, team_name, avatar_url`.
- `projects` — 12 rows. A loose grouping with a `user_id`.
- `categories` — 6 rows, a flat label (`Design System`, `Writing`, `Coding`, …).

**What does not exist:**

- **No enterprise, organisation or team entity.** Not one table. `users` is the top of the model as
  far as the schema is concerned. `prompt_sessions.team_name` is a string, not a reference.
- **No hierarchy anywhere.** I searched every table for a parent/child column: the only ones are
  unrelated (`prompt_comments.parent_id`, `tag_definitions.parent_tag_id`). There is no tree.
- **No notion of the top navigation.** Console, Composer, Design Artifacts and Development Artifacts
  are a *frontend* idea. The database has no concept of a tab, or of a package that *contains*
  packages. `prompt_sessions.category` is the nearest thing and it is a label, not a kind.

**So the honest feedback:** the structure you are describing is real and coherent, and it is not in
the database. What is in the database is one flat table of packages distinguished by a text label.
Before design artifacts have somewhere to live, one decision is needed, and it is yours:

> **Are the top-navigation entries a kind of package, or a container of packages?**

That single question decides whether you need one `packages` table with a `kind` column
(console/composer/design_artifacts/dev_artifacts) and an optional `parent_id`, or a two-level
model. Your own words — *"the console can be a separate package itself… I don't want to roll things
up under it"* — point at the first: **one table, a kind, and an optional parent**, so a tab can hold
packages and a package can also just be a package. Flat by default, nestable when it earns it.

What I would **not** do yet is build the enterprise layer. There is no data behind it, and a
hierarchy with one user in it is a guess. Add it when a second organisation is real.

---

## What already exists, and should be reused rather than reinvented

This is the most useful finding in the survey. You already have working patterns for almost every
thing on your list — they are just applied to prompts and conversations instead of components.

| pattern | where it lives now | reuse it for |
|---|---|---|
| **a finding attached to a component** | `governance_items` — 64 `finding` rows, **all 64 with `component` populated**, plus `node_id`, `file_path`, `catalog`, `package_id` | proof the "something attached to a component" shape already works |
| **versioning** | `prompt_versions` — `version_number, change_description, change_type, created_by_user_id, overall_score, score_breakdown` | the exact shape a component version wants |
| **generic activity** | `audit_logs` — `user_id, action, resource_type, resource_id, ip_address, user_agent, metadata, created_at` | already generic in shape… |
| **per-event ingest record** | `figma_ingest_activity` — `kind, actor, verdict, written, rejected, reason` | the audit trail for an element |
| **sharing** | `prompt_shares`, `prompt_permissions` | the portability requirement |
| **depth precedent** | `user_memories` — **38 columns** | evidence you are comfortable with rich tables |

**One warning about `audit_logs`,** because it looks like the obvious home for component activity
and is not. It has 972 rows and **every single one is `resource_type='conversation'`,
`action='teacher_query'`**. It is a chat-query log that happens to be generic in shape. It has never
carried a second kind of resource, there are no indexes built for that, and your own requirement is
**millions** of component interactions. Putting those in the same table as login and query events
would make both slower to read. Give component activity its own table.

---

## The proposed structure — for evaluation, not execution

Six tables. Nothing is renamed, nothing existing is dropped; this is additive.

**1. `design_components` — the entity, the thing with identity**

```
id                uuid pk
key               text unique     -- the stable tag: `f-40001207-3497`
name              text            -- "accounting section 2 dropdown"
kind              text            -- element | icon | pattern | container | template
status            text            -- draft | approved | built | deprecated
figma_file_key    text
figma_node_id     text            -- the component node
source_path       text            -- the Lit file that draws it (may be null for icons)
catalog           text            -- which A2UI catalogue it belongs to
package_id        uuid            -- which package it belongs to
owner_user_id     uuid
metadata          jsonb
created_at, updated_at
```

This is the table that does not exist and that everything else hangs off. Note that most of its
columns are already fields in `components/registry.json` — which raises the question at the bottom.

**2. `design_component_versions` — history, modelled on `prompt_versions`**

```
id, component_id, version_number, change_type, change_description,
snapshot jsonb,          -- the component as it was, so a version can be diffed
created_by_user_id, created_at
```

**3. `design_component_annotations` — notes, annotations, styling references**

One table with a `kind`, the way `governance_items` uses `kind`, rather than three tables:

```
id, component_id, kind,   -- note | annotation | style_reference | decision | question
body text, author_user_id, target text,   -- which slot / property / layer it is about
metadata jsonb, resolved_at, created_at, updated_at
```

`target` is what makes it attach to a *part* of a component rather than the whole thing — the slot,
the property, the layer. Without it, "the padding on the status icon is wrong" has nowhere to go.

**4. `design_component_activity` — the per-element audit trail**

```
id bigserial, component_id, user_id, package_id, action,
detail jsonb, at timestamptz
```

Its own table, per the warning above. This is the one that grows without limit; see the scale
section.

**5. `design_component_metrics` — the millions case**

```
id bigserial, component_id, at timestamptz, metric, value numeric, dimensions jsonb
```

Separate from activity on purpose. "Who changed this" and "how many times was this rendered for
customers" are different questions with different volumes, and mixing them makes the audit trail
slow to read for the sake of data that is never read one row at a time.

**6. `design_component_embeddings` — the derived vector index (pgvector)**

```
component_id uuid pk references design_components(id) on delete cascade,
embedding vector(384),        -- same 384 dimensions the code already uses
source_hash text,             -- what text produced this; skip re-embedding when unchanged
model_version text, updated_at
```

Rebuildable at any time from the record. If it is ever lost or the model changes, it is regenerated,
not restored. Embedding the **name + description + annotation text** is what makes "find me
something like an accounting dropdown" work.

**Sharing** needs no new design: copy the `prompt_shares` shape.

---

## The three scale tiers are not one problem

You described them precisely, and they are three different shapes:

| scale | example | what it needs |
|---|---|---|
| **2–3 rows** | a container component | nothing special. Everything above works as written. |
| **~500 rows** | one front-end experience | nothing special. This is small. |
| **millions** | quantitative metrics, per-customer interaction tracking | **a different table and a different plan.** Same physical table is fine at first; it will want partitioning by month and an index on `(component_id, at)` before it hurts. Never put metrics in `design_components` itself. |

The good news is that the first two tiers are the same design, and the third is already separated out
above. Resist the urge to build the millions-scale shape on day one — it will be wrong, because what
you actually measure at that volume is not knowable yet.

---

## Portability, and the "port it later" intention

You said this is deliberately a side Postgres that may be ported to dedicated databases per
governance layer. Three things follow:

1. **Keep the record plain.** The six tables above use ordinary types. That is deliberate — a plain
   relational record ports cleanly, and a design that leans on Postgres-only features does not.
2. **The one Postgres-specific piece is the vector column, and it is the disposable one.** That is
   the whole argument for the record/index split: the part that is hard to port is also the part you
   can throw away and rebuild anywhere.
3. **Do not let package ids be foreign keys across future database boundaries.** If governance
   layers become separate databases, `package_id` becomes a cross-database reference, which no
   database enforces. Keep it a value with a documented meaning, not a constraint you will have to
   break.

---

## Questions I cannot decide for you

These are yours, and the answers change the schema:

1. **Is the repository or the database the source of truth for a component?** This is the big one.
   Today `registry.json` is authoritative — the ingest writes it, `catalog:check` measures it, and
   the build reads it. If a `design_components` table also claims to describe components, the two
   will drift, and there will be two answers to "what is this component." Either the database becomes
   authoritative and the file becomes generated output, or the database mirrors the file and a check
   keeps them in step. **I would not build table 1 until this is answered.**
2. **Are the navigation tabs a kind of package, or a container of packages?** (See the structure
   discussion above — this decides one table or two.)
3. **Is the enterprise layer real yet?** No data exists behind it. I would leave it out until a
   second organisation needs it.
4. **What is a component's identity when the same icon appears in five places?** Your naming already
   distinguishes the component from the occurrence (`I40001206:3418;40001205:5529`), and the schema
   above assumes that split. Worth confirming it holds for the accounting-dropdown case where the
   same design may be reused per customer.

---

## What I would do first, and it is small

**Answer question 1, and only then start.** Everything else in this document is ordinary design work
once the source of truth is settled, and most of it will be wasted if it is settled the other way
afterwards.

After that, in order:

1. The package decision (question 2) — one table with a kind, or two levels.
2. `design_components` plus `design_component_versions`, since they are the pair that makes a
   component a record rather than a file.
3. `design_component_annotations`, which is the feature you described in the most detail and the one
   people will feel immediately.
4. The vector index last, once there are enough components for search to matter. It is the smallest
   piece and it can be added to existing rows at any time without touching them.

---

## What was checked, so this can be trusted or refuted

- 45 base tables surveyed in the **production** database, with row counts and column counts.
- Column lists read for `figma_specs`, `figma_ingest_activity`, `governance_items`,
  `prompt_versions`, `audit_logs`, `prompt_sessions`.
- `audit_logs` grouped by `resource_type` and `action` — 972 rows, one resource, two actions.
- `governance_items` grouped by `kind`, with `count(component)` — 64 findings, all with a component.
- Every table searched for a component/artifact/package column, and every table searched for a
  parent column.
- Nothing was created, altered or dropped. `pgvector` is installed on that database (done earlier
  the same day, for the vector-store plan) and is unused so far.
