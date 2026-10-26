# What leaves this application — the list

**Status: PARTLY EXECUTED — corrected 2026-10-18, later the same day.** Nine sections were taken
out, then the owner named five of them back: *"sessions, propmts, database, users, playground need
to come back on the left nav."* They are restored in both navigations and the app image is rebuilt.
The sections still out are **Alerts, Scores, Human Annotation, Experiments** (plus the
feature-flagged Skills and Topics, which were never on in this deployment).

The line that decides each row comes from your own words, not from taste:

- **Keep** — the dashboard and its widgets (*"I don't wanna remove stuff from the dashboard. I'm
  gonna leverage it"*), the evaluators and their rules (*"Evals are important, evaluators are
  important, rules are important — those I get"*), the sessions the studio's cards open.
- **Remove** — everything that exists only because a trace exists. You said it yourself: *"all
  comments, annotations, and manual scores are fundamentally tethered to trace objects."*

---

## A. The app's sections (the left navigation)

| Section | Proposal | Why |
|---|---|---|
| **Home** (dashboards) | **KEEP** | to be leveraged; the metrics live here |
| **Dashboards** | **KEEP** | same |
| **Evaluators** (+ Rules) | **KEEP** | the one evaluation surface you called out by name |
| **Settings** | **KEEP** | project, model prices, members — needed to run the thing |
| **Traces** | *your call* | not on your list; it is the one remaining section that is a trace browser |
| Users | **RESTORED** | was removed, back on the owner's word 2026-10-18 |
| Alerts | **REMOVE — done** | nothing is routed to them |
| Prompts | **RESTORED** | was removed, back on the owner's word 2026-10-18 |
| Playground | **RESTORED** | was removed, back on the owner's word 2026-10-18 |
| Scores | **REMOVE — done** | a score is a judgement about a trace — trace-tethered |
| Human Annotation | **REMOVE — done** | the comment/annotation surface you rejected; trace-tethered |
| Datasets | **RESTORED** | was removed, back on the owner's word 2026-10-18 |
| Experiments | **REMOVE — done** | unused |
| Sessions | **RESTORED** | was removed, back on the owner's word 2026-10-18 |

**The navigation now reads:** Home · Sessions · Users · Prompts · Playground · Evaluators ·
Datasets · Settings — in BOTH places that draw a navigation: the app's own `routes.tsx` **and**
the studio's `GovernanceNav.tsx`. The second one is the icon rail you actually see in the room;
the two lists must always be edited together or one of them carries dead doors.

## B. Furniture inside the sections that stay

| Item | Proposal | Why |
|---|---|---|
| Trace detail pane, its inner tabs (Preview · Attributes · Scores · Log · Formatted · Raw) | remove | reads a trace object; the room's Preview tab has nothing to show without it |
| Comments and annotations on dashboards / threads | remove | your explicit ask |
| Comment counts and annotation queues in tables | remove | trace-tethered |
| Score columns in the sessions/traces tables | remove | trace-tethered |
| Cloud / region / sign-up copy (EU, US, Japan, HIPAA) | remove | self-hosted; it never applies |
| The five vendor-maintained dashboards, **as names** | keep the dashboards, rename them | see D |

## C. The dashboard — kept, and what changes

- **Kept as they are:** Model Usage, Cost by model, User consumption, Observation latency
  percentiles (p50/p90/p95/p99), the dashboard builder, the widgets.
- **Kept, renamed:** `Langfuse Home (Clone)` → **RaibachIDS**; the five maintained dashboards →
  **Raibach Agent / Raibach Cost / Raibach Home / Raibach Latency / Raibach Usage**.
- **Removed from it:** the comment affordance. (Your words: *"I don't want to see the ability to
  put comments on the dashboard."*)

## D. Branding → RaibachIDS

**Code, changed today (image rebuilt):**

| Where it showed | Now |
|---|---|
| Sidebar wordmark (`wordart-*.svg`) | the **R** mark + **RaibachIDS** |
| Mobile top bar wordmark | the **R** mark + **RaibachIDS** |
| The loading spinner's glyph | the **R** mark |
| The mark used everywhere (`LangfuseIcon`) | `/raibach-mark.png` — the studio's own R |
| Browser tab / touch icon | the **R** mark |
| Page titles (`Home | Langfuse`, `Sign in | Langfuse`, …) | `Home | RaibachIDS`, `Sign in | RaibachIDS`, … |
| Breadcrumb on a trace page | RaibachIDS |
| `og:site_name` | RaibachIDS |

**Data, renamed next:** the project name and the five dashboard names (shown as SQL before it
runs).

**Not touched:** the licence files. The fork is MIT outside `ee/`, and the notices stay exactly
where they are — white-labelling the UI is allowed; deleting the licence is not.

## E. Can ClickHouse go? — measured, with the answer

**Not yet. It is the store behind the two things you are keeping.**

What it holds right now (measured 2026-10-18): `events_full` 2,772 rows / 2.71 MiB,
`events_core` 2,771 rows / 983 KiB, `scores` 288 rows / 90 KiB — about **4 MB of real data** in
a container that costs ~480 MiB of RAM.

Who reads it:

| Reader | What it reads | Goes away when… |
|---|---|---|
| The app's **Dashboards** | `events_*` — every widget | the dashboard is fed by a store we own instead |
| The app's **Traces** page | `events_*` | Traces goes |
| The app's **Evaluator** score history | `scores` | score history goes |
| Our `/api/governance/sessions` | `events_core` | the sessions feed reads our Postgres |
| Our evaluator **Cost (7d)** columns | `events_*` grouped by trace | cost moves to `usage_metrics` |
| Our failures / filters readouts | `events_*` | same |

So ClickHouse drops only when **all** of these move: the dashboard's data source, the Traces
page, the scores history, and our own three reads. Keeping the dashboard as it stands keeps
ClickHouse. The moment the dashboard reads our own metrics store, `docker compose` loses
`clickhouse` — and with it ~480 MiB.

## F. What this does not touch

- The studio: rooms, Composer, Design, chat seat, sessions feed.
- The cost ledger (`usage_metrics`) and the per-call receipts that feed this app.
- The embed itself — the app stays in the Governance room; only its brand and its unused
  sections leave.
- **Traces themselves** — nothing here deletes trace rows. Whether the trace *sections* go is
  your call, not mine; today's list keeps them out of the navigation but does not promise their
  removal.
