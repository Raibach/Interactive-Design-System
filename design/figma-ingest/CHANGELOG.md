# Figma ingest — the running changelog

This folder is the record of **one function**: taking a component drawn in Figma into the catalogue the
application actually runs on. It is the oldest and the busiest thing in this repository, and the owner
described its standing on 2026-09-30: *"this Figma process, as you can see and as it's evolving, is the
actual core of the application — it'll run all things. It'll run the product ideation when they put in
their business requirements; we're gonna pull from this little catalogue and the AI is going to use it
to assemble things. We're gonna eventually create a separate section inside of developer where we put
all of our code snippets for our function."*

So: the catalogue this ingest builds is what the AI assembles from, and every business requirement that
becomes a surface ends up resting on a component this pipeline wrote.

**How to read this file.** Newest first, one entry per change, each saying what changed, why, how it was
verified, and what it left open — recorded from measurements, never from memory. A change that is not in
here but is in git is still real; the entry is missing, not the work. The detailed case for the 2026-09-30
change is in [`update-path-remediation-2026-09-30.md`](./update-path-remediation-2026-09-30.md), beside
this file.

**The rule that decides everything here** — the design owns the drawing and the generator READS it
(never interprets it), and everything that is not a drawing lives in a hand-written file the ingest
cannot write. A generated element is a build output; a re-ingest must produce the same bytes for the same
node; and nothing in a generated file may be underivable. Where a binding or a behaviour lives is decided
in the corresponding entry below, and the short version as of 2026-09-30 is: **Figma draws, the
application binds, the consumer owns what a click means.**

---

## 2026-10-26 — the proof, the patterns, and feedback that never goes silent

The day's account is its own folder:
[`2026-10-26-feedback-and-patterns/`](./2026-10-26-feedback-and-patterns/README.md) — prose in
`README.md`, the dated change log in `CHANGELOG.md` beside it. The brief for the next session, with
what is still open and the order to take it in, is [`NEXT-CHAT.md`](./NEXT-CHAT.md); the session-level
brief, covering the Design room's own chat parts and rails as well, is [`../NEXT-CHAT.md`](../NEXT-CHAT.md).

The headline: the proof now compares **values** rather than words and cannot report 100% beside a
named failure; the answer leads with what could not be read and says whose gap it is; the node's
transform is drawn from Figma's matrix after a horizontal mirror was mistaken for a 3.14° rotation;
a design's component children are now patterns identified by **layer name**, drafted, proved and
registered at approval; and the preview's records are ephemeral, with nothing written to the database
before approval.

Later the same day: the output states **what approving will write** before any press — the existing
component with its tag and date, then every child pattern with a tick box, new ones ticked and
existing ones unticked — and the approval writes only the ticked ones; an approval and a removal
**name their stages as they run** and stop on the stage that failed; the list is ordered by approval
date only, after a trial that used each file's write time put three of the program's own files at the
top; and the pattern list no longer counts an instance's insides, or an instance of a component this
system already ships, as patterns. The list also gained a **search box** above the catalogue's name —
a literal filter of the names, tags and Figma layers, with a count of what is shown — and the
catalogue chips were then removed: the list reads the official catalogue only, and the primitives
catalogue was deleted because every one of its seven names is already in the official one. The
design-artifacts catalogue's five room-only names moved into the official catalogue before its file was
deleted, and the Design room's own checks now run against the one catalogue, which declares 73. The
Design seat was then given its own copies of the chat parts it draws, so its rail and its column owe
nothing to the shared `chat-*` components the other rooms still use.

---

## 2026-10-15 — hardening round one: the design-update flow, tested end to end (no pipeline change)

The owner's goal for this line: *"a 100% accurate seamless hardened ingestion process"* — and the
boundary: the element is never hand-edited; it changes only through the design seat's process and
the automatic update on the composer. Round one ran the real pipeline against node `40001177:2476`
(`prompt-textarea-container-system`): the ingest passes (200; the 2026-10-05 strokes refusal for
this node is gone), both channels read, the fetch is live (no cache — a one-pixel move will be
read), two runs are byte-identical, no AI is anywhere in the render (the renderer is blind to
`mcp_*`; no MCP-derived key reached the spec), the staged preview serves, and 21/21 measured facts
match the emitted component under an independent instrument (three of mine lied first — recorded in
the doc). Findings filed beside this log in
[`HARDENING-RECORD-2026-10-15-design-seat-to-composer.md`](./HARDENING-RECORD-2026-10-15-design-seat-to-composer.md):
effects-stacking policy (F1), latent MCP carry that could 422 (F2), refusals not journaled (F3),
the room's `Compiles: yes` default (F4), `_size_report`'s silent child drop (F5). Nothing was
hand-edited; no pipeline file changed.

## 2026-10-08 — the clamp found again: dated to the minute, retired with receipts

**Files:** `backend/design_renderer.py` (no ellipsis mechanism is emitted anywhere), `AGENT.md` (the
laws block), [`AGENTS-instructions/THE_SUPPRESSION_RECORD.md`](../../AGENTS-instructions/THE_SUPPRESSION_RECORD.md)
(the case record). No component file changed — the approved files were already clean.

The owner, testing: *"It's not reading it's not reading padding. It's not reading truncation"* — the
standing complaint — plus the law that cracked it open: *"any error suppression in this system will
be revealed."* The clamp was the suppression, and here is its entire life, dated:

- **2026-09-30 21:08:46** — the last approval of the working era writes `f-40001207-3497` and
  `f-40001207-3559`. Their bytes carry **zero** clamp spellings, unchanged since.
- **2026-09-30 21:08:54** — commit `6cedc71` is the **first commit in history** to contain
  `block-ellipsis`. **21:12:55** — `b522871` completes `_truncation_support`. (Born from the owner's
  own 2026-10-01 instruction to stop hardcoding "no engine can"; recorded fairly in the case file.)
- **2026-10-01 → 10-08** — every commit carries it; no component was re-ingested until 10-05, so
  the emitted files and the emitting engine silently diverged.

**Verified by replay, not argument:** regenerating `40001207:3497` with the engine's own functions
against the committed working file showed **12 changed lines — ten of them the re-added `@supports`
blocks, two a pixel-equivalent SVG viewBox notation change**. Everything else byte-identical,
including the chevron's 16×14 bordered pattern. Measured in the owner's browser:
`CSS.supports('block-ellipsis')` = false, `line-clamp` = false, `-webkit-line-clamp` = true — the
surviving block was inert; the trap that breaks (`-webkit-`) was never emitted.

**Decision (owner's standing ruling):** `_truncation_support` and its call site are removed.
Truncation remains a **reported defect per layer** (`ACCEPTED_UNRENDERED`), never faked, never
refused. The one lesson of 10-01 that survives — do not write one engine's fact as a universal rule
— survives as **words in the report**, not as a conditional emission.

**Left open:** the ingest's own day-map (nothing ingested 10-01…10-04) and the two ruled questions
(the design-system ZIP cut; the header's hand-added facts block a re-ingest would not reproduce).
Case record: `AGENTS-instructions/THE_SUPPRESSION_RECORD.md`.

---

## 2026-10-01 (late) — the Design room's seat is told that somebody arrived

The owner, on the live site: *"whenever you load design, I expect to see the thinking spinner turning
and her getting ready to say something like hi I'm the design system assistant."* She never did, and
every other gate was already open.

**Measured in the Design room on production, with the seat up and its package read:**

```
sessionId 5c1212c9…   conversationId 3b191a7e…   _conversationsRead: true
_hasResultTurns: false   _historyChecked: true   _historyError: ""
_greeted: false          _wantsGreeting: ""        ← this, and only this
```

`_greetIfArriving` returns at its first gate — `if (!kind || this._greeted || …) return` — and `kind`
is `_wantsGreeting`, which only `_takeArrival` sets. The seat's own automatic arrival does not cover
this case and is right not to: it fires only for a package with **no conversation** and an **empty
list**, and this package has a conversation — empty, but a real thread.

**The cause.** `markArrival` is called where a package is opened: the composer's open (`resume`), a
blank one (`blank`), and the console (`console`). **The Design tab's branch announced nothing**, so
nothing ever set the seat's `_wantsGreeting` and the room drew a silent seat.

**The repair.** `assembleDesignSurface` announces the room's arrival with the **Design package's own
id**, which `arrivalIsFor` matches on — so this seat answers it and the console's seat refuses it and
leaves the record where it lies (the rule that stops one seat eating another's arrival). Announced
there and not at the click, because `currentDesignSession` is read from that assembly: at click time
the id is not yet known and the arrival would carry nothing to match. One announcement per open, which
is what C7 asks for.

**Verified locally in the page:** `_wantsGreeting: "resume"`, `_greeted: true`, `_local` holding one
turn — against `""` and `false` before.

**And the deploy question, since it came up:** schema, data and code are three different pushes. The
schema goes in with `init_db.py` inside the container; a data repair goes in through
`northflank exec` against the container's own `DATABASE_URL`; the code that keeps either correct goes
through git and the auto-deploy. A repair without the code is a repair you get to do again.

---

## 2026-10-01 — a package keeps its owner's row (and three that were missing it are written)

**Commit:** `1154fb8`. Prompted by the owner on the live site: *"I don't understand why she's not
speaking on the production site."* She was — the diagnosis is below — but it surfaced a real gap in the
package contract, closed here.

**The gap.** §7 of `THE_PACKAGE_CONTRACT.md`: *"permission is a property of the package.
`session_permissions` holds one row per person per package… If you may open the package, you may read
and write every conversation inside it."* That row is what a share is, and what every write check
reads. **Measured in both databases: 3 of 12 conversations sat in packages with no `owner` row for
their own user** — `50e0a193` with two conversations, `1d61cd4c` with one — while every other package
had exactly one. It is the exact count `HANDOFF-NEXT-SESSION.md` left open ("check the two counts"),
and nothing refuses those packages today because the read predicate also accepts plain ownership.

**The cause.** `conversation_api.create_conversation` inserted the conversation and never the row.
Every package whose conversation came through that path had none.

**The repairs.** `create_conversation` now fills the absence in the same transaction —
`ON CONFLICT (session_id, user_id) DO NOTHING`, `granted_by` recorded as the owner, so it fills an
absence and can never overwrite a role somebody was given. And
`backend/backfill_session_permissions.py` writes the rows that already exist: **dry by default**,
`--apply` to write, reading the pairs from `conversations` rather than a list of ids, and re-reading
the gap after applying instead of trusting its own count. Both databases: 2 rows inserted each, and
the same query now answers **0 of 19** locally and **0 of 12** on production.

**AND THE DIAGNOSIS THAT LED HERE WAS WRONG, WHICH IS THE PART WORTH KEEPING.** She was not silent and
her thread was not empty: her conversation holds **9 messages**, the seat is bound to exactly the id
the server lists first, and the panel is fully drawn (`chat-messages`, `chat-input`, `prompt-textarea`,
the rail). Three of my own instruments lied in a row:

  1. a query selecting a `message_count` column that does not exist on `conversations` — the error went
     to a stderr I had redirected away, and an empty `fetchall()` read as "this id exists nowhere";
  2. a `curl` probe that omitted `session_id`, so the route's package check could not run and the
     answer looked like a persistence failure;
  3. the same probe, with the conversation id typed `…-8bbc-…` where the id is `…-8abc-…` — one
     character — so it named a conversation that does not exist and the route CORRECTLY refused it and
     filed the turn under the package's own thread. That correct refusal became my "the seat and the
     server disagree" finding, and it nearly became a fix to a path that was already right.

**A failed query is a failed query, not an absence.** Every one of the three came from the same habit:
reading silence as a measurement. The id was settled by reading its code points off the live page and
the list from the live API, side by side — not by re-running the same wrong thing.

---

## 2026-10-01 — the zero-trust breakthrough: the ingest stops reporting success while doing nothing

**Commits:** `6cedc71` (the carry, the gate, the masters, the guard, the reload) and `b522871` (the
ellipsis asked for instead of ruled out). Deployed to production on push.

**The doctrine companion for this entry is [`../../AGENTS-instructions/THE_ZERO_TRUST_REPAIR.md`](../../AGENTS-instructions/THE_ZERO_TRUST_REPAIR.md)** —
this is the function's own record of what happened; that file is the transferable account of why it
could happen at all.

### The moment it turned

Nothing about the code was hidden. Every one of the faults below was in a file a person could read,
and every one of them passed every check that existed. They were found by **measuring the output** —
screenshotting the rendered element and diffing it against Figma's own export — and by building an
instrument and then **distrusting the instrument** before trusting a single number from it.

That is the breakthrough, and it is the whole of it: **a system that reports success while doing
nothing is not fixed by reading its code.** `Core-Concept.md` names this shape and says it happened
six times on 2026-09-16 ("complete-looking output, required piece missing, success reported anyway").
On 2026-09-30 it was still happening, seven more times, and this entry is what it took.

The owner's complaint was the specification, and every clause of it was checkable and true:

> *"It's not reading the Figma file. It's got every annotation in it… it will not read most of it, but
> it skips parts and the parts that can't read it just skipped and silently fail… it keeps on serving
> the same fucking thing over and over."*

### What was dropped — five traps inside the ingest, two outside it

| # | The lie | What the measurement was |
|---|---|---|
| 1 | **A capability claimed that did not exist.** `truncation` sat in `RENDERED_KEYS` — "this renderer draws it" — while the declaration it emitted drew nothing. | `-webkit-line-clamp` parses, computes to the stated count, draws nothing, and rewrites the box's `display` to `-webkit-box`. Six spellings tried; none drew. `CSS.supports('block-ellipsis','auto')` and `CSS.supports('line-clamp','2')` both false in Chrome 146 / Electron 41. |
| 2 | **Facts dropped at measurement by a hand-written key list.** `_figma_spec_for_model` read a fixed list; everything else Figma stated was discarded where it stood. | 18 keys on essentially every node — `interactions`, `overrides`, `lineTypes`, `primaryAxisSizingMode` among them — never reached the spec. |
| 3 | **A loop that could never execute, inside a comment asserting it did.** The ingest fetched the components a design uses from a `components` map that `/v1/files/<key>/nodes` does not return. | Response top-level keys are `editorType, lastModified, linkAccess, name, nodes, role, thumbnailUrl, version`; `components: null`. Five INSTANCE layers, no master ever measured. |
| 4 | **A measurement read by nothing.** `maxLines` was measured into the spec and listed as rendered; the line count came from `height ÷ lineHeightPx` instead. | The fact that decides the drawing was the one fact nothing looked at. |
| 5 | **A second code path for one layer.** The root's `:host` rule was hand-built from layout and size only. | The design's root frame is `[{SOLID, #ffffff}]`; the emitted `:host` carried no `background` at all. |
| 6 | **A guard that survived only as records.** Two `removal-refused` records in the activity log — each with `namedBy`, a `ruling` and a `nextStep` — refusing to delete a component live on the front end. | The code that wrote them is in **no commit in this repository** (`git log -S namedBy` is empty). Both removal paths had been unguarded since. The records outlived the rule. |
| 7 | **An instrument that lied five times.** The fidelity proof reported losses that were not losses before it was right once. | Text-layer fills probed for `background` instead of `color`; vector strokes probed for a CSS border when they sit on the `<path>`; `clipsContent: false` counted as a statement; **transparent pixels counted as ink** (alpha ignored); a 1px row misalignment that inflated a diff to 45%. |

Trap 6 is the one to carry forward: **a rule that survives as a log entry while its code is gone is
the most dangerous state in this list, because the record makes it look enforced.**

### The repairs

**The measurement carries everything.** `_figma_spec_for_model` names the keys it PLACES
(`_CONSUMED_KEYS`) and carries every other key Figma states into the spec under `stated`, verbatim.
Nothing is dropped where it stands and nothing is interpreted on the way in; `figma_fidelity.py`
reports each carried key by name, and the ledger now reads **0 omissions** on both of this
repository's own designs.

**Truncation is asked for, not assumed impossible** (`_truncation_support`). The wrapper holding the
whole lines that fit carries `line-clamp: N` inside `@supports (block-ellipsis: auto)`: an engine with
the standard ellipsis draws `…` exactly as Figma does, and an engine without it never sees the
declaration. The generator's bytes do not change — **the decision moves out of the renderer and into
the browser that knows the answer.** The prefixed `-webkit-line-clamp` is deliberately never emitted:
it parses in this engine, draws nothing, and costs the design's own `textAlignVertical`.

**The root goes through `_declarations`** like every other layer, so its own fill, stroke, radius,
effects, opacity and clipping are drawn instead of being forgotten by a second path.

**`_lines_in_box` takes the design's `maxLines`** when it states one. **Duplicate declarations are
deduped**, and two different values for one property are NAMED in the stylesheet rather than resolved
in silence.

**The masters are fetched.** `_instance_component_ids` reads every INSTANCE's own `componentId` from
the tree, and Pass 1 iterates the ids actually fetched. Measured: the header design drafted 1
component before and drafts **5** now (four masters + the target).

**The fidelity gate** (`figma_fidelity.fidelity_gate`) — **unexamined variance aborts; examined
defects are reported.** It blocks on a stated key no examination covers, a fact that never reached the
spec, or a declaration with no measurement behind it, and it reports (per layer, counted at the root of
the ingest's own answer) a defect whose measurement is recorded. Proven by injection: an invented key
blocks with it named. **A gate that aborts on any defect would refuse both of this repository's own
components**, since both truncate — so the distinction is not a softening, it is what makes the gate
usable. And **a reason expires with its value**: `blendMode: PASS_THROUGH` is examined, a real blend
mode is not.

**The liveness guard is back, on the server** (`_liveness_references`): removing a component the
application's own code names is refused with `409` + `namedBy` + `nextStep`. `figma-layers-view.ts`
instantiates `<f-40001207-3497>` as the tile every catalogue row is drawn with, so removing it would
have emptied the left column while reporting success. It **strips comments before it looks** — a raw
scan found six files naming that tag and three were prose — and it **does not scan its own module**,
whose documentation mentions the tags and would otherwise refuse every removal in the repository.

**The size gate measures the RENDERABLE spec**, not the report. The carry is 48–53% of a spec's
characters; counting it halved the gate's headroom and would have refused designs that draw perfectly.

**Approve reloads the page** once the files are written. A custom element is defined once per document,
so a page can never draw a component version it did not load: the left list — drawn by
`<f-40001207-3497>` itself — kept showing the old component through four approvals while the file on
disk carried the approve's own mtime **to the second** (`20:59:33` against an approve logged
`01:59:34Z` = `20:59:34` local). The sentence saying so is painted for 900ms first, because a page
that reloads itself with no explanation is the same unexplained behaviour this entry exists to remove.

**`boxes.ts` writes into the clip wrapper when the design has one.** Adding that wrapper broke the
companions' addressing: `writeText` wiped it — losing the clip, so a four-line description overflowed
its box and painted over the row below (the overlapping text the owner saw) — and `writeSpans` returned
the wrapper as the first "line", wiping the design's run spans and losing a row's code.

### How it verifies itself now

The rules that came out of this are the ones that make the system self-checking rather than
self-reporting:

- **A stated fact is either drawn, reported with a reason, or refused.** There is no fourth state, and
  `fidelity_gate` is what enforces it — the ledger is computed from the measurement, not written by
  hand.
- **A capability is asked for, not assumed** — `@supports`, in the browser, at render time.
- **A rule that names a component's liveness is enforced on the server**, where the deletion happens.
- **A reason carries the value it was written for**, so an examined set can never become a blanket
  exemption — and an exemption list is the failure mode to fear most here, because **a list of
  reassuring sentences looks exactly like diligence.**
- **The gap is stated where the person is looking**: `fidelity.missingEllipses` and its sentence sit at
  the root of every ingest's answer, so nothing has to be opened to know what is missing.

### Verified

Origin-aligned pixel diff against Figma's own scale-1 export: the truncating layer's region mean delta
**100 → 47.1**, its text ink rows **0–39 → 6–33** against Figma's **7–33**. Geometry of all 12 layers
exact to the sub-pixel. Inter loads and the description's ink x-extent is identical in both
(`[427,591]`), so the font was never the problem. Both designs ingest with `omissions: []` and
`missingEllipses: 2` reported per layer. `tsc -b`, `npm run build` and `npm run catalog:check`
(unchanged at 60 components / 28 findings / 3 blocking) all pass. The capability block was measured in
the engine: `CSS.supports('block-ellipsis','auto')` false, the block applied `line-clamp: none`,
`display` stayed `block`, and the fallback clip held — `clientHeight 29` against `scrollHeight 73`.

Local database updated with `init_db.py`: four new tables (`design_element_activity`,
`design_element_annotations`, `design_element_versions`, `design_element_metrics`) plus the partial
unique indexes on `prompt_sessions`. Production was updated the same way — the script run inside the
container against its own `DATABASE_URL` — and all four tables were verified present there.

**A correction to what this entry first said**, because it asserted the wrong mechanism: the schema
IS applied on deploy. `Dockerfile:51` runs `python init_db.py && uvicorn main:app …` as the
container's CMD, so every start brings the schema up, and the manual run was redundant rather than
required. What was true — and the reason the ORDER still mattered — is that the container carried a
**Sep 30 12:23** `init_db.py` until this deploy landed, so a run before it would have created the
old schema and missed all four tables.

### And one live fault the deploy exposed

The owner found it on the production site: *"Whether anything uses a component could not be read
(HTTP 503), so no row says…"* — which is `figma-layers-view._loadUsage` failing against
`GET /api/catalog/audit/{pipeline}`. Measured: **production 503, locally 200**, and the 503's own
`expected_at` named `/app/frontend/catalog-audit/prompt-composer.json`. Two faults behind one
symptom, and neither is what the error said:

1. **The report is not in a deployed image.** It lives in `frontend/catalog-audit/`, which is
   gitignored — so it is absent from a clone's build context, and the runtime image only ever
   received `frontend/dist` and `frontend/src`. The Dockerfile now runs the checker in the build
   stage (`RUN node scripts/catalog-check.mjs`, with no `|| true`) and copies the report in. This is
   §9 of `THE_PACKAGE_CONTRACT` exactly: *"a report file a build can delete, when the same report is
   a row"* — until the report IS a row, the image has to build it.
2. **The checker covers one pipeline.** `frontend/scripts/catalog-check.mjs` has
   `CATALOG_NAME = 'prompt-composer'`, so the other three pipelines the shell offers have never had
   a report — **measured locally, where the report file exists: 200 for `prompt-composer`, 503 for
   `design-artifacts`, `ecommerce` and `primitives`.** Those tabs cannot show usage until the
   checker is extended to them.

And the error message was itself a false record: *"The catalog checker was removed from this
project; no report is produced."* The checker is present, runs, and writes a 44KB report. The
remedy in `backend/routes/misc.py` (`_AUDIT_REMEDY`) and the fallback in `routes/ai.py:252` now
name the two real reasons. A remedy that names the wrong cause sends a reader looking for a
deletion that never happened.


### Left open

- **The ellipsis is absent where the engine lacks `block-ellipsis`** — which includes the browser this
  was verified in. The lines are clipped and the fact is counted; the design's `…` is not drawn there.
- **The generator is not byte-deterministic for a vector.** The same node rendered twice produced two
  different SVG coordinate origins — visually identical, but it violates "same spec → same bytes", so
  a re-approve rewrites a file for no visible reason.
- **No removal of a *removable* component has been executed.** Refusals were tested end to end; a
  completed removal was not.
- **`f-40001206-3423.ts` is written but registered nowhere.** Approving a job registers its TARGET tag
  only, so a drafted master lands as a file with no catalogue entry.
- **The two catalogue entries that are declared but unreachable** — `EvalFeed`/`eval-feed` in both
  catalogues, and `design-middle-container` in design-artifacts — sit in `components` and are
  referenced by no `$defs.anyComponent.oneOf`, so an assembled tree can never use them. The live gate
  does not report this (its 28 findings are props, catalog-member, events and slots).
- **THREE OF THE FOUR PIPELINES HAVE NO AUDIT AT ALL.** `figma-layers-view` asks
  `/api/catalog/audit/{pipeline}` for whichever tab is open, and the checker produces one report:
  measured locally, 200 for `prompt-composer` and 503 for `design-artifacts`, `ecommerce` and
  `primitives`. So "whether anything uses a component" is answerable for one catalogue and for
  nothing else, and the other three tabs draw the unreadable report rather than a usage column.
  Extending the checker past its single `CATALOG_NAME` is the work that closes it.

---

## 2026-09-30 — the update path stops destroying the code (working tree, uncommitted)

**What was wrong.** A re-ingest of a component deleted every prop, event, slot and handler that had been
hand-added to its generated file, because the generator writes that file whole from what Figma measures
and none of those were derivable from the design. Measured: the catalogue row `<f-40001207-3497>` lost
`name` / `code` / `description` / `open`, a `status` slot and a `chevron-toggle` dispatch in one approve,
and every row in the Design section's left column went back to drawing Figma's sample words while the
registry and both catalogues went on declaring the four props. The head element `<f-40001207-3559>` was
carrying the same hand edits and was one approve away from the same loss.

**What changed.**

| file | change |
|---|---|
| `backend/design_renderer.py` | the constant template emits ONE seam in every generated element: `import { attachBehaviour, detachBehaviour, behaviourProperties } from '@/components/lit/behaviour/attach'`, `static properties = { ...behaviourProperties('<tag>'), <the design's Data: fields> }`, and `connectedCallback`/`disconnectedCallback` calling attach/detach. It also reads `On click: dispatch <event>` from a layer's annotation and emits the dispatch (`_fire`), and `behaviourProperties` is written by the project's ALIAS because the file is also previewed from `.preview/`, beside `src/` |
| `frontend/src/components/lit/behaviour/attach.ts` | the loader: `import.meta.glob('./*.behaviour.ts', { eager: true })`, tag → companion, idempotent attach/detach, no companion = no-op |
| `frontend/src/components/lit/behaviour/boxes.ts` | where a value lands: the design's layer-derived class names as the box addresses, the unset-is-not-empty rule, the after-every-render hook, the slot helper, and a report when a value was handed to a box the design no longer draws |
| `frontend/src/components/lit/behaviour/f-40001207-3497.behaviour.ts` | the row: `name`/`code`/`description`/`open`, the values placed in the design's own boxes, the chevron flipping `open` and dispatching `chevron-toggle { open }` without letting the click also navigate, and the `status` slot in the design's well |
| `frontend/src/components/lit/behaviour/f-40001207-3559.behaviour.ts` | the head: `name`/`count`/`catalogId`/`description` placed in its boxes. Its chevron is deliberately left a drawing — the design's note on it is prose and nothing listens for an event from the head |
| `frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json` | the row's entry declared `content`/`justify`/`align` — three props from the retired template generator that nothing implemented. It now declares the four real ones |

**The decision behind it** (owner, 2026-09-30): bindings are the application's, not the designers'.
*"You should add those data bindings now, you do that and preserve them. The designers aren't gonna add
those… I'm not doing it. You need to add those at least for this application."* And the instruction that
becomes a binding is prose — a designer's story, a note, a sentence in chat — which the AI reads against
the measured drawing and writes into a companion. The design's own grammar (`Data:` / `On click:` /
`State:`) stays built and is the better path where a design states one; nothing waits on it.

**Verified.** `render_spec` twice on a fixture and twice on node `40001207:3497`'s live measurement:
byte-identical, seam present, compiles under the ingest's own esbuild. The head's live measurement: same.
`npx tsc -b`: clean. The live gate (`npm run catalog:check`): 60 components, 28 findings, 3 blocking —
unchanged, same ids. Both companions through the real loader (temporary harness, 9 checks, deleted):
values land; an empty value clears its line; an unset one places nothing and says nothing; a value with
its box gone is reported; the chevron flips, reports and does not reach the row; the status slot appears;
the head's chevron dispatches nothing; detach stops the listening — and that harness caught a real bug
(`querySelector('catalog-name')` instead of `'.catalog-name'`, which failed silently). A dry
`POST /api/figma/ingest` through the running app returns a draft carrying the seam; the preview URL that
Vite refused now returns the module with the import rewritten to `/src/components/lit/behaviour/attach.ts`.

### Later still — the clamp is gone, and the truncation is built properly

The clamp repaired earlier the same evening was itself the shortcut the owner distrusted, so it was
taken out and the design's own truncation built where Figma does it:

- **The generator emits geometry only.** For a text layer whose design says `textTruncation: ENDING`:
  the measured box, its measured wrapping, `overflow: hidden` at the box's own edge, and the design's
  vertical alignment untouched. No `-webkit-line-clamp`, no `display: -webkit-box`, no override.
- **The design's statement travels on the box**: `data-truncate="ending"`, plus
  `data-truncate-lines="N"` when the design states a line count — the number the fit obeys.
- **`frontend/src/components/lit/behaviour/text-fit.ts`** does the fitting: restore the design's words
  (a cut is reversible, and a value render's text is recognised rather than cut again), measure the
  box against its own size (or the stated line count, converted with the box's computed line height),
  binary-search the character count that fits **in a hidden mirror** — a clone carrying the box's own
  class, pinned to its width and height, so the stylesheet measures it identically — and apply the cut
  once: the kept characters stay in the design's own nodes so every run keeps its measured type, the
  rest are emptied, and the design's own ellipsis character ends the last kept node.
- **The loader runs it** for every generated element, after the companion has placed its values (both
  take the after-render hook, and the fit is taken last, so it measures the values and not the sample
  words), and again once the document's fonts are ready — fonts decide where the lines break.
- **Nothing of the design's is overridden**: an alignment switch that had been drafted (centred text
  starts at the top when it overflows) was deleted unshipped, because the design does not state it and
  the pass must not infer it. Verified statically on the live node: deterministic, no clamp anywhere,
  both boxes marked, the design's centring intact, compiles under the ingest's esbuild. **Not yet
  verified in a browser** — the mirror measurement and the cut are the owner's check in the preview.

**Left open here.** The chevron's other state — the component set's variants are not read yet, so the
element carries only the artwork of the variant Figma instanced and the chevron cannot turn. `open` is
the companion's until that reading exists. The backend had to be restarted for the new template to be
live (it runs without `--reload`), and the two elements land the seam on their next approve.

### Later the same evening — the preview, and the ellipsis (working tree, uncommitted)

Two defects the owner found by testing, both fixed and verified:

- **THE DESCRIPTION BOX DREW NO ELLIPSIS.** The clamp and the vertical centring were fighting over one
  property: `-webkit-line-clamp` is inert unless the box's display IS `-webkit-box`, and the
  `textAlignVertical: CENTER` rule wrote `display: flex` AFTER it — later declaration, same property —
  so the clamp was dead. Measured in the emitted rules for `functions-label` and `catalog-name` on node
  `40001207:3497`. Fixed by centring a clamped box the way a webkit box takes it (`-webkit-box-pack`),
  and verified on the live measurement: both boxes emit `display: -webkit-box; -webkit-box-orient:
  vertical; -webkit-line-clamp: 2; overflow: hidden; -webkit-box-pack: center` with no `display: flex`.
- **THE PREVIEW, IN TWO DIRECTIONS AT ONCE**, both decided by the owner on 2026-09-30: it must be blind
  to the catalogue's CODE (*"whenever it's in the preview it should be blind to the lit catalogue"*) and
  it MAY know the DATA BINDING (*"it can load the data binding as part of the preview… that creates a
  very clear picture"*). So: the seam is a RELATIVE import again (`./behaviour/attach`), which in the
  catalogue reaches the real loader and in a preview reaches the ingest's own inert copy
  (`PREVIEW_SEAM`, written beside each draft); `vite-plugin-figma-preview.ts` names that one specifier
  in its own namespace and serves exactly one nested path, so the preview resolves nothing the
  application ships; and the data binding travels in the preview state as `values`, composed in the
  shell from the `design_master` rows (`session/elements`) and drawn by `component-preview` beside the
  drawing — never substituted into it. Verified through the app's own server: the draft returns 200 and
  its import resolves to the preview's own copy, which is the inert stub.
- **A ONE-HOUR SKEW IN THE RECORD, found while chasing an approve that "did not write".** The activity
  feed's `at` and the ingest's `writtenAt` run an hour ahead of the filesystem's own timestamps on this
  machine (e.g. `22:31:36Z` where the file's mtime is `17:31:34` local) — so an approve read as "18:31
  local, after the fix" was really 17:31, before it, and the catalogue file's age is exactly what it
  should be. The timestamps are the defect, not the write path; not fixed yet.

**Found while doing it, not fixed.**

- `scripts/catalog-check.mjs` (the fuller gate, `prop-undeclared` / `event-unheard` / the annotation
  checks) CANNOT RUN where it lives: it computes its root as `frontend/`, which is right for
  `frontend/scripts/` and wrong for the repository root, so every run dies with
  `ENOENT … /Raibach_IDS/src/components/lit`. The live gate is the smaller
  `frontend/scripts/catalog-check.mjs`, which never compares declared props against the element's
  `static properties`. Both write the SAME report path.
- `npm test` cannot run: `vitest.config.ts` points at `src/test/setup.ts`, which does not exist.
- Adding a companion file needs the dev server to re-resolve the loader (touch `attach.ts`, or restart) —
  Vite caches the eager glob while the loader is unchanged, and an absent companion is a silent no-op.
- The application's site is on **5001**. A second Vite on **5173** has been up since 2026-09-27 with an
  older config (no preview plugin), which answers `/@figma-preview/…` with the SPA fallback.
- `READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md:12` records the site as "RESTART-LOCAL.sh (port 5173)" — wrong on
  both counts; the script has only ever used 5001 for the UI.
- `f-40001204-5752` and `f-40001206-2888` are drawn by nothing and bound by nothing; their catalogue
  entries still carry the retired generator's invented props.

---

## 2026-09-29 — the component is written from the design's own measurements

`7b1c757`. `render_spec` became the only builder of a Figma component: the ingest stopped asking a model
to build from numbers and started rendering the measurements deterministically, and the preview became a
temporary file that is deleted. `01d2b68`, `239cd25`, `1b153e6` followed the same day — the mechanical
findings fixed in four verified passes, two crashes, and the backend declaring the rules it follows. The
detail is in those commits; what matters here is the invariant they established and this changelog now
depends on: **the same node renders the same bytes, and a value the renderer cannot place is reported,
never silently dropped.**

## 2026-09-12 and before

The pipeline as it stood — model-driven component generation, MCP and REST both read, the Figma map, the
allowlist, the catalogues. Present in git (`28425c7`, `2c560e0`); the entries this file would hold for it
were not written.
