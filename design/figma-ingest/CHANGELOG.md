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

**The label.** This file is the Figma ingest's record and nothing else. Every entry from 2026-11-02
carries `[figma-ingest]` in its heading, so a search for that label finds this file and every change
made to the ingest, wherever the repository has been rebuilt.

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

## 2026-11-02 (later) — [figma-ingest] the queue the missing face asks into now exists

One thing changed for the ingest after the entry below, and it was not in the ingest: the place a
request goes when the tool meets something the system does not hold.

**What was built elsewhere.** `design_requests` holds a request until a person decides — kind, subject,
reason, requester, decision, who decided and when, a note. Three endpoints: ask, list, decide. The
Design rail's `Approve` tab draws the waiting requests with Approve and Refuse. Proven on the running
app; the test rows were removed afterwards.

**Why it is in this log.** The last open step of the ingest is the conversation about a face the system
does not ship: the chat says so, offers to replace it or to ask for it to be added, and "asking for it
to be added enters the approval queue". Until today there was no queue to enter. Now there is, so that
step is unblocked and is still not built.

**The ingest itself did not change after the entry below.** The span reader, the two examined keys, the
chosen channel and the closed accounting stand exactly as recorded there.

---

## 2026-11-02 — [figma-ingest] the read is complete, the choice is named, the account closes

Owner, 2026-11-02: *"the AI has to read every single spec on that Figma file and assemble it according
to that Figma file. It doesn't matter — there's no interpretation, there's no evaluation, there's no
'I don't need to read it, I'll just make it up.' If it's not there, none of that can happen."* Four
changes serve that sentence. Three of them were faults in the CHECK, not in the drawing, which is why
the count had been understating the read without anyone being able to see it.

| # | what changed | where |
|---|---|---|
| 1 | the styled spans are read wherever the style sits in the tag | `figma_fidelity._runs_drawn` |
| 2 | `arcData` and `styles` are examined, with reasons, instead of skipped | `design_renderer.ACCEPTED_UNRENDERED`, `figma_fidelity.RAW_TO_SPEC` |
| 3 | every reconciled fact names the channel the drawing takes it from, and the ingest applies that choice | `figma_twopass.reconcile` (`chosen`), `figma_twopass.apply` |
| 4 | the accounting is checked: each layer and fact once, the buckets add up, the gate blocks when they do not | `figma_fidelity.account`, `fidelity_gate` |

**1 — the span reader.** The reader matched `<span style="…">` exactly: no attribute before the style,
double quotes only, no nesting. A generated drawing writes `<span class="…" style="…">`, sometimes
single-quoted, and spans inside spans. So a layer whose ranges WERE drawn came back as "0 span(s)" and
the answer reported a loss the drawing did not have. It now walks every span tag, takes the style
wherever it sits, and finds the matching close by counting nested spans.

**2 — two keys nobody examined.** `arcData` and `styles` appeared in no table in the pipeline, so the
walk skipped them in silence. Each now has a written reason: the ellipse's arc is not carried and a
partial arc is a stated limitation, never a silent loss; a style reference names an effect that is
resolved onto the node and drawn from `effects`, so the reference asks for no declaration of its own.
The examination is consulted BEFORE the spec lookup, because a fact deliberately not drawn has no
drawn value to search for.

**3 — the choice, named per fact.** The two reads were reconciled but the drawing still took every
value from REST, and nothing recorded that as a decision. Every row now carries `chosen` — `both` when
the channels agree, `rest` or `mcp` when one carried it, and the drawn channel on a disagreement,
where the cause already says why. `apply` writes a second-channel value into the document the renderer
reads. On every node measured so far the chosen source is REST, because every disagreement recorded is
a flip, a group's offset or a kind Figma names twice — each one where REST is the drawing's space. The
column says that per fact now instead of leaving it implicit.

**4 — the accounting.** The answer already said "I read N facts: D drawn, A accepted, M did not
survive" without checking that the three add up. `account()` now counts each layer and fact once,
checks the equation, and names any repeat. The gate blocks when the account does not close, because a
report that counts a fact twice cannot be read as "every fact once" — that is the instrument's fault,
not the designer's.

**What went wrong on the way, recorded because it will happen again.**

- The first duplicate test keyed on the node id. Report rows carry no id, so every row collided with
  every other one and a clean report read as full of duplicates. It keys on the layer's own name and
  the fact now.
- The span reader's first rewrite matched the outer span of a nested pair and consumed the inner ones,
  so a nested drawing would have reported zero spans again. The scanner counts nesting instead.
- `apply` writes nothing for an agreement and nothing for a disagreement. Turning a flipped position
  into a second-channel override would be a number with no coordinate space behind it, which is the
  invention this file exists to refuse.

**Verified.**

- The span reader on five shapes: a plain span, a class before the style, a single-quoted style,
  nested spans, and a `<br/>` inside — the four shapes the generated catalogue files actually use.
- `arcData` and `styles` on a synthetic ellipse: both rows come back `accepted` with their reasons.
- `apply` on a synthetic result: a fact marked `mcp` changed the document's layer name and a fact
  marked `rest` left its position alone.
- `account()` on a clean report closes at 7 = 5 drawn + 2 accepted + 0 missing; one repeated row opens
  it and adds a blocker naming the repeated fact.

**Left open.** The missing-face conversation (step 5 of `design/plans/01-INGEST.md`), which waits for
the approval queue it files into. A real node run, which is the only way to see the count move. And a
case where a fact really is second-channel-only — none has been measured yet, so `apply` is a path
with no traffic on a live node.

---

## 2026-11-01 — the read asks twice, and says so

Two runs were lost at 14:15 to a stalled connection: both failed at the thirty-second ceiling while
the same address answered in 0.6 seconds from a shell at the same moment. The owner's instruction:
*"We can either do a retry or rerun on failure automatically… one line of the answer… what would
keep the failure visible instead of hiding it."* So the read asks a second time, and the second ask
is never silent.

**What was changed, in the order it was agreed.**

| step | what it does |
|---|---|
| the read | `_fetch_figma_nodes` asks twice; only a NO ANSWER is asked again |
| the record | the attempts — what each ask took and which one answered — travel in the answer as `read`, and in the run's own history as the same value |
| the form | one line above the verdict, from the backend's own sentence, and only when there is something to say |

**Only a no-answer is retried, and that is deliberate.** A timeout, a dropped connection or a
failed connection is the network failing to answer. A refusal from Figma is an ANSWER: it is passed
through on the first ask, because asking again would add thirty seconds to a sentence that is
already true. Measured: a refusal produces exactly one ask.

**The three sentences, in the system's own words.**

- first ask answered — nothing is printed. A line saying "read first time" on every run is noise.
- first ask unanswered, second answered — *"The first read did not answer within 30 seconds (it
  timed out); the second answered in 0.9 seconds. The design was read."*
- neither answered — the answer is refused with status 504 and the sentence *"The read did not
  answer in 30 seconds, twice. Nothing was written."*

**How each claim is marked.**

| claim | mark |
|---|---|
| the second ask happens on a timeout and answers the run | verified, by stubbing the network: two attempts recorded, `answeredBy: 2` |
| a refusal is not asked twice | verified, by stubbing a 403: exactly one ask |
| neither answering produces a refusal with both attempts named | verified, by stubbing: status 504 and the sentence |
| a healthy run says nothing | verified, on a live run: one attempt, `answered by 1`, 0.62 seconds, empty summary |
| the two-ask sentence on the screen | **verification pending** — the form prints `read.summary` in the same list that already draws the two-pass line; a real stall has not been made to happen on purpose |

**Where the answer and the history could have disagreed, and do not.** The record of the asks is
built once, by `_read_record`, and the answer and the run's history take that same value. There is
no second count of attempts anywhere.

**The risk, written down.** When Figma is genuinely down rather than stalling, the answer now takes
sixty seconds instead of thirty. That was accepted rather than hidden: a stall costs a second, an
outage costs half a minute more and says so twice.

---

## 2026-11-01 — the second reading: the same node asked twice, compared fact by fact

The ingest read the submitted node once, over REST. The desktop MCP was also called, but only for
annotations, reference code and assets, and what it returned was written INTO the REST tree. An
overwrite is not a second opinion: once the annotation arrived, nothing recorded that the two
channels could have disagreed. This entry is the second opinion, built and measured.

**How each claim below is marked.** *verified* — measured here, with the measurement named.
*verification pending* — the code is in place and has not yet been run. *not built* — absent.

| claim | mark |
|---|---|
| the second reading is reconciled fact by fact, with both values and the cause | verified, on two nodes and one live ingest |
| every difference found is accounted for, with no unexplained row | verified — 0 unexplained on both nodes |
| the three causes of disagreement are named: a flipped frame, a Figma group, and a name | verified, per node below |
| the sentence reaches the screen | verified, on a signed-in tab of my own: the paragraph and the fact row are drawn |
| the drawing takes a value from the second channel | **not built** — deliberately. The second channel adds nothing to the drawing yet; it confirms or contradicts what REST said |

**What reads the second time.** `backend/figma_twopass.py`, called from `_process_ingest_job` once
the REST tree is in hand, and answering in the ingest's result as `twoPass`.

**Why `get_metadata` and not `get_design_context`.** Measured on node `40001283:2791` before any code
was written: `get_design_context` returns generated React with Tailwind classes — `gap-[7px]`,
`bg-[#cbe6e3]` — which are rounded and rewritten, so a comparison against them measures the code
generator, not the design. `get_metadata` returns the layer tree with Figma's own numbers, one of
them `262.3243103027344`. The second channel for a value comparison is therefore the metadata tool.

**The comparable position is the transform's origin, not the bounding box.** The first comparison
reported 17 differences and was wrong: it compared the MCP's accumulated offset against REST's
`absoluteBoundingBox`, which is the box AFTER the layer's own transform, so on a flipped layer the
two figures are the same place written from two origins. Measured, corrected, and the rule written
into the module: the translation of the layer's transform chain is what both channels can be asked
for, and a flip is a separate fact that only REST carries.

**Measured, node `40001283:2791` (the output footer area, your own design).**

| what | number |
|---|---|
| layers measured over both channels | 14 of 17 |
| facts agreeing | 70 of 84 |
| facts differing | 14 — all inside a mirrored frame |
| facts only REST carries | 10 — 3 VECTOR layers, 1 text, 6 transforms |

The 3 VECTOR layers are the three strokes of the chat mark under `chat history`. **Corrected the
same hour:** the first version of this entry said "the second channel does not return vectors at
all, so the artwork exists on one channel only", and that was too broad and wrong. The channel is
asked twice for different things — `get_metadata` enumerates layers and returns no vectors, and
`get_design_context` returns the vector artwork without enumerating the layers. Measured on this
node: the layer list has 3 vectors missing, and the same channel's design-context answer supplied
3 artwork assets, one per stroke. **The shapes were read twice; the layer names once.** The report
now says exactly that, and it says the opposite when no artwork comes back.

**Measured, node `40001421:5467` (the results control bar).**

| what | number |
|---|---|
| layers measured over both channels | 8 of 8 |
| facts agreeing | 35 of 48 |
| facts differing | 12 inside a Figma group, 1 in name only |
| facts only REST carries | 4 — 3 text, 1 transform |

**The three causes, each measured rather than reasoned.**

- **A flipped frame.** A frame whose own scale is −1 on an axis stores each child's offset on that
  axis negated. REST composes it, the MCP adds the offset as written. Measured on the three
  ellipses: x 2, 8.16 and 14.32 in the MCP against −2, −8.16 and −14.32 in REST. The mark travels
  down the chain, because a child inside the flipped frame cancels the flip for the axis and
  inherits the difference anyway — reading only the direct parent left three layers with a
  difference and no cause, and the first version of the summary said so.
- **A Figma group.** A group is not a coordinate space of its own, and the two channels disagree
  about that: the MCP adds the group's own offset to every child and REST does not. Measured on
  `figma-ingest-results-footer`: every child differs by exactly the group's offset, 642 on x and 13
  on y.
- **A name.** The MCP calls a Figma group a `frame`; REST calls it `GROUP`. Nothing about the
  drawing changes, and the row says so.

**Verified by one live ingest.** The node was submitted through `POST /api/figma/ingest`; the answer
carried `twoPass` with 52 rows and 17 divergences, every one with a cause and no unexplained row;
the step list showed the sentence while the run was happening; the preview was then discarded and
the audit reported `clean: true` with no folder, no entry and no files left.

**Left open, and named.** The form's line is written in
`frontend/src/rooms/design/tools/ToolsSeat.tsx` and was then seen on the screen: a signed-in tab of
my own ran the ingest from the Tools form, the note drew the sentence verbatim, and the facts list
drew `Read twice — yes — 35 of 48 facts agree`. The preview that run created was discarded through
the same discard the screen uses and the audit reported `clean: true`. The job-status endpoint still
reports `mcp_status` and `rest_status` as empty after a run, because the finished job replaces the
record that carried them; this predates today and is left as it is until the owner says otherwise.
And the drawing still takes every value from REST except the artwork: the second reading confirms or
contradicts, and a measured number that reaches the drawn component from the new channel is a later
step with its own proof.

**Two failures seen while verifying, and what they were.** Two runs failed with "The read operation
timed out" after thirty seconds, at the first step, before any second reading. A direct read of the
same address took 0.6 seconds from the shell at the same moment, and the run that followed two
minutes later answered in 2.9 seconds. So the ceiling is Figma holding the request, not the
pipeline: the ingest reported the failure, named the step it failed on, recorded an `ingest-failed`
row and wrote nothing. It is noted here because a thirty-second ceiling that turns into a reported
failure is the behaviour this pipeline is supposed to have, and because a reader should know the
two failures were real and were not my code.

---

## 2026-11-01 — five writers removed, and a placed frame that had lost its offset

Two things happened in one day, and both matter for the same reason: the generator was answering for
the design in places nobody had looked at.

**How each claim below is marked.** *verified* — measured here, with the measurement named.
*verification pending* — the code is in place and has not yet been run against the owner's own file.
*not built* — specified and absent.

| claim | mark |
|---|---|
| the five writers are gone; the four render cases behave as stated | verified, by rendering four specs |
| a placed auto-layout frame keeps its offset, to four decimals | verified, by rendering the declarations |
| the owner's eleven findings are actually reduced by this | **verification pending** — needs the next ingest of his file |
| the two-pass read (MCP and REST reconciled) | **not built** on this day — built later the same day; see the entry above this one |

**1. Four writers and one interpolation, removed.** The owner, reading the eleven findings on his own
ingest ("output-footer-area import"): *"it interprets the specs exactly down to a pixel … build it
wrong because it is built wrong in Figma. That is the only way."*

| what was written | where | the number it produced |
|---|---|---|
| a stroke colour without the paint's own opacity | `routes/figma.py`, both stroke paths — the fill path had always passed it | `#933a45` where the design states `rgba(147, 58, 69, 0.5)` |
| the application's face for every design's family | `design_renderer.py` `_local_face()` | IBM Plex Sans where the design states Inter |
| a border width of `1` when none was stated | `design_renderer.py`, the stroke block (`weight or 1`, `'1px'`) | borders the design never asked for |
| a shadow colour of black at 25%, distances of zero | `design_renderer.py` `_shadow()` | shadows the design never asked for |
| a colour **object** interpolated into CSS | `design_renderer.py`, fills and stroke | `border: 1px solid {'hex': '#933A45', …}` — not CSS; a fill of that shape raised TypeError |

Verified by rendering four cases: a translucent stroke with a stated weight draws
`border: 1px solid rgba(147, 58, 69, 0.5)`; the same stroke with no stated weight draws no border; a
fill of alpha 0.4 under a paint opacity of 0.5 draws `rgba(207, 215, 213, 0.2)`; a shadow with no
stated colour draws nothing. The font warning sentence was deleted, because with no substitution it
would be false.

**2. A frame that arranges its children lost its own position.** Two of the eleven findings read "left
262.3243, top 5.5256" against "left —, top —" (Meatballs and Frame 886979). `_declarations()` wrote
`position: relative` for every node with a `layoutMode`, and wrote the parent's offset only in the
other branch — so an auto-layout frame placed by a plain parent was left at the parent's origin. Now
a placed layer is absolute at the design's offset whether or not it arranges children, and a layer the
flow places still gets none. Verified: `left: 262.3243px`, `top: 5.5256px`, four decimals.

**The answer now states the scope of its own failure.** Instead of "11 things", the root sentence reads
"I read 132 stated facts in this file: 121 drawn, 0 accepted without a drawing, and 11 that did not
survive (stroke ×5, position ×2, …). The component was built anyway. Each one is named below with the
value I found and the value I drew." The list draws one finding per line under the preview with a
heading that keeps the proportion ("11 of 132 stated facts did not survive"). The line that assigned
blame — "they are the pipeline's to fix, not your file's" — is gone: it was a verdict on the file made
by the process being judged.

**No guard.** A contract script was written and removed the same hour: *"There is no guard. Blocking
something that is incorrect is not a solution. It must ingest, it must preview, it must tell the user
where it failed."* The requirements below are kept by what the build writes and what the answer says.

### The requirements this day produced

1. **Every placed layer keeps its offset, including a frame that arranges its own children.** The
   placement belongs to the layer; the layout belongs to its children.
2. **A colour is three facts** — colour, alpha, and the paint's own opacity — and all three are
   written, or the declaration is not written.
3. **The face is the design's**, written as stated, with no substitution and no warning about a
   substitution that no longer happens.
4. **Width, colour and shadow only from what is stated.** No `or 1`, no `1px`, no black at 25%.
5. **Nothing is rounded.** Four decimals, so a one-pixel move is a one-pixel change.
6. **No object reaches the stylesheet**; an unconvertible paint produces no declaration.
7. **The gate reports and never repairs.**
8. **One spec, two callers** — the ingest and the check both call `render_spec()`.

### Left open

- **The two-pass read.** REST is asked with `geometry=paths` and no depth limit; MCP is a second
  channel. Today the ingest reads over REST only; the two are not reconciled. This is the largest open
  requirement, and the one the owner names as the reason the tool must be hardened.
- **The footer stroke weight**: Figma states `1px` overall and, apparently, `0` on a side. The drawing
  now carries the per-side value; the contradiction is the file's and should be reported, not smoothed.
- **Text style ranges** on `functions-label` — not yet diagnosed.
- **`arcData` and `styles`** — no examination entry; each needs a decision, not an entry added to
  silence it.

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

---

## 2026-11-02 — two findings that were the program's, not the design's

**The owner's report on the footer (`strokeWeight: 1` beside a drawn `0px`) was not a contradiction in
his file.** Measured on `chat-output-footer` (`40001283:2798`): the layer states `strokeWeight: 1`
**and** `individualStrokeWeights: {top: 0, right: 0, bottom: 1, left: 0}`. That is how Figma states a
border on one side; the drawing follows the sides, `0px 0px 1px 0px`, and it was equal to the file.
The check compared the uniform `1px` against that border and reported `differs` — a failure the
program invented over a design that was right.

| fact | before | after |
|---|---|---|
| `individualStrokeWeights` | drawn | drawn |
| `strokeWeight` | **differs** (`1px` → `0px`) | accepted, with its reason: the four sides decide the border |
| `strokes` | drawn | drawn |

**The text ranges on `functions-label` are drawn, and the check cannot see them.** Measured on the
same node: the file states 58 characters of overrides in five ranges (`Arial Rounded MT Bold`, 400,
9px); `_text_runs` builds all five; the spec carries them; the draft draws five styled spans. The
answer's two remaining failures — `characterStyleOverrides` and `styleOverrideTable` — are the check
failing to find the spans it was given. Nothing in the pipeline is missing.

**The ingest now reports 144 stated facts: 120 drawn, 22 accepted, and the 2 above that are the
check's own fault.** The drawing was not changed to satisfy either finding; the comparison was.

**Not done, and named.** The check's own defect for the runs; and a decision each for `arcData` and
`styles`.
