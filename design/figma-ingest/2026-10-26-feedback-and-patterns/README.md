# 2026-10-26 — the proof, the patterns, and feedback that never goes silent

This folder records one working day on the Figma ingest. The running changelog lives one level up
(`design/figma-ingest/CHANGELOG.md`); this is the account of the day, in prose, with the change log
beside it.

Read this before touching `backend/figma_fidelity.py`, `backend/design_renderer.py`,
`backend/routes/figma.py`, `frontend/src/components/lit/component-preview.ts` or
`frontend/src/components/lit/figma-layers-view.ts`.

The brief for the next session — what was settled, what is open, and the order to take it in — is one
level up, at [`../NEXT-CHAT.md`](../NEXT-CHAT.md).

## The problem the day began with

The ingest's proof — the thing that decides whether a design was carried into the component — did
not compare values. For each fact it looked for a **word** in the emitted style: a position became
the word `width`, a colour became `background`, a font became `font-family`. Every layer with a
width passed the position check, and every layer with a background passed the colour check.

The owner had said, more than once, that the process cannot be about interpretation: the Figma file
is the authority, the component is a copy, and a gap is reported rather than guessed. The proof was
the opposite of that promise in one precise way: it could not fail. A design whose component was
wrong reported complete.

Two screenshots from that morning are worth keeping in mind, because everything below is a
consequence of them:

- the panel read **“74 of 74 facts carry the design's own values exactly (100%)”** on the same
  screen as **“Not exact — controlBar (FRAME) · effects: stated and never reached the spec”**.
  The count was taken over only the facts the check could compare, so the fact it could not read
  was left out of the total. The owner's word for that was suppression.
- the preview of a correct ingest showed nothing in its hollow box. The element was drawing; the
  pane had no sentence saying so. The dashed outline in that box is the element's own box, drawn
  whether or not the element renders.

## The rules the day settled

Each of these is the owner's, and each is enforced in code rather than promised in prose.

**Every fact is a pair of values.** What Figma states, and what the component carries. A fact is
`drawn` only when the two are equal; when they are not it is `differs`, and both values travel in
the row (`source`, `drawn`, `delta`).

**The count cannot contradict the report.** Every fact that asks for a drawing is in the total:
never read, not drawn, impossible to compare, and known defects included. `accepted` — a fact with a
written reason for needing no declaration — is the only kind excluded. One hundred percent can never
appear beside a named failure.

**The answer leads with what could not be read.** `fidelity.verdict` is a sentence in plain words,
and `fidelity.unread` lists each missing fact with the value found and the reason. Above the drawing,
never below it.

**Every gap names whose it is.** A fact the file states that the component does not carry is the
program's: “This is the pipeline's to fix, not yours.” A fact that contradicts another fact in the
same file is the designer's, with the arithmetic shown. Only three file contradictions are claimed:
an empty box that contains visible content, a text box shorter than its own line height, and an
auto-layout frame smaller than its children, gaps and padding with no wrap, no fill and no clipping.

**Never a success where a failure lives.** A commit is refused with a 409 while any fact differs,
and the refusal names the layer, the fact, the Figma value and the value the component would carry.
The ingest itself always completes and always draws the preview.

## What the measurement now does

The proof runs on every ingest and gives every stated fact one of five outcomes: `drawn` (the two
values are equal), `differs` (they are not), `not-read` (the design stated it and the measurement has
no line for it), `not-drawn` (measured, and the drawing emitted nothing), and `defect` (drawn, and
measured not to work). `accepted` is added for facts that ask for no declaration, each with the
reason written down.

The facts are kept as a table for the life of the preview, addressed by job:
`GET /api/figma/ingest/<job>/facts`. Two ingests of one design can be compared:
`GET /api/figma/ingest/<job>/compare/<other>`, and the ingest answer carries the comparison with
the last measurement automatically (`changesSinceLast`).

The comparison is keyed on the layer's **name path**, not the node id, because node ids change when
a design is redrawn. A position is compared as the layer's own offset inside its parent, not as its
coordinate on Figma's canvas: moving the whole component 18 pixels on the canvas reports zero changes,
while moving one button one pixel reports exactly one row —
`approve-button (FRAME) · position | left 142, top 0 → left 143, top 0`.

## The faults the value comparison found

These were all invisible to the word-matching check, and each was measured before it was changed.

**Gradients and translucent fills were not drawn at all.** A gradient reached the style as
`linear-gradient(...) (gradient, 2 stops)` and a translucent fill as `#000000 (fill opacity 0.5)`.
Neither is a colour, so the browser discarded the declaration and the layer had no fill. Both are now
real CSS.

**A fill stack kept only its first fill**, because the code set `fill` to the first paint and the
stack branch was then unreachable. The whole stack is emitted in the design's order.

**Two shadows kept only the last**, because the same property was emitted twice and the settling pass
treated the repeat as a conflict. Multiple shadows are one comma-separated declaration.

**The font was translated, then the translation was removed, then reinstated as one declared rule.**
The system ships one face, IBM Plex Sans. The design's stated family is kept in the fact row, and the
drawn face is recorded as a substitution (`accepted`), with a warning at the root of the answer:
“FONT WARNING: 3 layer(s) use Inter, which this system does not ship.” Eight of the room's own files
still named `Inter`, which is not shipped; the browser fell back, which is why the tool looked like
Times.

**A drawn shape's outline was read only for `VECTOR`.** Boolean operations, stars, ellipses and
polygons lost their outline and were reported as never read. One list now decides which layer types
carry a path, and both the reading and the drawing use it.

**A frame with no auto-layout drew at 0 × 0.** A custom element is an inline box until something says
otherwise, and an inline box ignores width and height. The box is now declared as a box. Measured
before: 0 × 0. After: 120 × 120.

**Precision was being edited away.** A child's offset was rounded to two decimals while the check
expected four; size and position were rounded to one decimal; the artwork's box to two. Each is now
carried at the precision the drawing keeps.

## The mirror: the case that proved the report's limit

The footer group in the control bar was drawn as if rotated by 3.14 degrees. The file did not say
that. Figma's `rotation` field reads `3.14159` on that node, but the node's actual transform is
`[[-1, 0, 624], [0, 1, 13]]` — a **horizontal mirror**. The code read a field named `rotation` and
made a picture from it.

That is the drift the owner keeps naming, and it also exposed the proof's own limit: every value was
present and every declaration was self-consistent, so the check reported 64 of 64 exact over a
wrong picture. A per-value comparison cannot see a composition.

The correction is a model, not a patch. A layer whose stated transform is not the identity is placed
by that transform: its translation is its position, its 2×2 part is a matrix with the origin at the
corner, and CSS composes the levels exactly as Figma does. A group's mirror and each button's mirror
cancel for the text, which is why the labels read normally.

Measured after the correction: the component is 662 × 66, and the buttons sit at 209, 343 and 482,
124 × 40, 124 × 40 and 142 × 40, at 13 from the top — the design's own numbers to the pixel.

## The preview is a file, and it is ephemeral

The preview is one Lit component written to `frontend/.preview/<job>/<tag>.ts`, served as a module
and instantiated in the pane. It is not a picture and not a model output.

- One preview at a time. The folder is emptied before the new one is written, and the previous job is
  dropped. Two ingests in a row leave exactly one folder.
- Discard removes the entry and the folder, and the discarded module answers with a sentence saying
  it was discarded, approved or replaced.
- The measurement record lives **inside that folder** (`facts.json`) and in memory. It dies with the
  preview. Nothing is written to the database before approval.
- A preview folder left by a previous process is removed at start, and the removal is printed with
  the folder names. A file that outlives its entry is a ghost, not a preview.
- Every discard writes an audit into the activity record: the in-memory entries, the folder, every
  file in it, any other preview folder, and the measurement record. A discard that leaves something
  behind says so.

`GET /api/figma/preview/audit/<job>` returns the same audit at any time.

## Feedback: the column never goes silent

- **During an ingest** the third column opens at once with a spinner at its exact centre and the real
  step beneath it: reading the node, the layer checks with their fact counts, building, compiling.
  The steps are written by the work itself, not by a timer.
- **During an approval** the Approve button turns and reads “Approving — writing it into the
  catalogue…”. A commit takes about 69 seconds on this machine: the component-manifest analysis and
  the catalogue audit, not the design. That was the “hang”.
- **On success** the column stays open, shows the component the catalogue now holds, and states the
  confirmation, including the patterns added, replaced, or not written with their reasons.
- **On a replacement** the button's label never carries the fact. Pressing Approve raises a red
  readout that names the component and what is replaced, with “Replace <tag> and approve” and
  “Cancel”. Nothing is written on the first press.

## The write is a readout, and the tick is a choice

The panel now says what approving will do before any button is pressed, and it says it in a block
rather than a sentence, because a sentence gets pruned and a block that states a fact does not.

- When the design's layer name is already in the catalogue, the block's heading reads **“Already in
  the catalogue”** and the line beneath it names the component, its approval date, and the fact that
  approving replaces it. It also says the existing component's own values were not read: the match is
  the layer name, which is the whole of the relationship.
- Every child pattern is a row: its name, its tag, and one of three states. A new pattern is ticked
  and says “New — will be added”. An existing pattern is unticked and says “Existing — tick to
  replace it”, because replacing a component is a decision the designer makes here and never a
  consequence of pressing Approve. A pattern that could not be built is disabled and carries **the
  server's own reason**; the panel no longer supplies words for a cause it did not measure.
- The approval sends the ticked tags and writes only those. A pattern left unticked is untouched:
  no file, no Figma map entry, no allowlist entry, no catalogue entry, no layer record. The
  confirmation names what was added, what was replaced, and what was left as it was.

Measured in the room: a design whose root exists drew the heading and the root line with its tag and
the date `2026-09-28`; six patterns were listed ticked; four entries that were not patterns at all
were found and removed from the list on the same measurement (see below). With three existing
patterns and one new one, the three existing boxes were unticked, the new one ticked, and ticking one
of the three made the approval carry exactly the new tag and that one tag.

## The list of stages, for a write

An approval and a removal are lists of real stages: read the measurement, check every fact, keep the
artwork, write each file, rebuild the element manifest, register the map, the allowlist and the
catalogue, register each pattern, run the catalogue gate. Each stage records itself as it begins,
against an id the client generates, and the panel shows the stage that is running on one line above
the block. There is no percentage and no invented progress: a line is a fact about work that started.

A failure stops the readout on the stage that failed and says what is still there. Measured: a
removal of a component the application's own code names stops on the liveness stage with two lines —
the check, then “Stopped at: … it is, in `frontend/src/components/lit/figma-layers-view.ts`. Nothing
was removed.” — and the component is untouched.

## Two things the pattern list was saying that were not true

The pattern set for `System_Role` listed ten children. Six were patterns; four were the inside of an
instance of the system's own chevron — two layers named `Arrow_drop_down` and `Vector 10`, twice
over, carrying tags nothing can write. They appeared as “Not written”, which read as four problems
in the design.

- **The insides of an instance are that component's drawing, not this design's patterns.** The walk
  now stops at an instance. The instance is the fact; what is inside it was measured as part of it.
- **An instance of a component this system ships is not a pattern.** It is the design using its own
  design system: it is stated under “Same component, other place”, and nothing is written for it.
  The test is the component the instance names, not the place it is drawn.

The same pattern set now reports six patterns, each one drafted, with no phantom entries.

## The pattern library, as the owner defined it

The design system is a **pattern library**. A button is a pattern, and the layer's **name** is its
identity.

- A child whose name matches an existing catalogue component **is** that component; approval replaces
  it.
- A child with a name of its own is a **new pattern**, even when it looks identical to ten others.
  Fifty uniquely named buttons are fifty patterns, and that is the designer's choice; the program
  follows the name rather than merging lookalikes.
- A pattern on its own carries no annotations. When it is used inside a component it takes the
  annotations applied at that occurrence. A pattern with no annotation assumes none.
- A pattern is a frame, a component, an instance or a vector. A text layer is content and a group is
  a grouping; both stay layers inside their parent.

The ingest reports the pattern set with each pattern's layer name, path, node id, tag, **the parent it
was measured under**, and its own annotations. Each pattern is rendered from its own measurement,
put through the same proof, and compiled. Only an exact pattern is registered.

Approval writes, per pattern, what the root gets: the file, the Figma map entry, the allowlist entry,
the catalogue entry, the record with its facts and its annotations, and a database row with its own
approval time.

## The test that closes the day

Node `40001421:5467` (`figma-results-controlBar`), with three plain-frame buttons. Folded into
patterns by the name rule, the design stands on three: `approve-button`, `discard button`,
`remove-button`. Their own proofs: 16 of 16, 15 of 15 and 16 of 16 facts exact, no gaps.

The full approval ran on 2026-10-26: 1.55 seconds to ingest, 69.5 seconds to approve, four files
written (the bar and the three patterns), the three patterns registered and declared, the root
refreshed to eight layers and seven database layer rows. The catalogue audit reported 69 components,
46 findings, 5 blocking — reported, not enforced. After that day's catalogue merge the same audit,
regenerated against the 73-name catalogue, reports 39 findings and 1 blocking; both numbers are in
“What remains open” below.

## What this does not change

- The preview reads no catalogue to draw. The catalogue is read for the layer **name** only when
  matching a pattern, never for its measured values.
- The measurement stays as it is: every value from the file, every gap named, every substitution
  recorded.
- Nothing is written to the database before approval.
- The generated components stay byte-identical to what an approval writes; the preview loads the same
  file.

## The list holds one catalogue, and it can be searched

*(Added at the end of the same day, after the ingest work above.)*

The left column showed four catalogues as chips — carbon, design-artifacts, primitives and
prompt-composer — with their entry counts. The owner asked where those names came from and said the
prompt-composer catalogue is the only official one. Two of the four were measured against the official
file before anything was removed.

**The seven names in primitives were already in the official catalogue.** Its name set is a strict
subset of the official one's, so the file added no name. Pressing it drew seven rows; what failed was
its **audit**, which answered 503 because the checker produces a report for one catalogue, and
prompt-composer is that one. The file, its tree document, its entry in the tree index and its place
in the accept list were removed.

**design-artifacts was not a second copy of the whole catalogue.** It held five names the official one
did not: `design-left-panel`, `design-middle-container`, `design-workspace`, `tools-workspace` and
`design-left-footer` — the Design room's own frame and containers. The server checked the room's own
screen against that file in two places, so deleting it as it stood would have stopped the room from
accepting its own components. The five entries moved into the official catalogue, which now declares
73; both checks were pointed at the one catalogue, and the file and its tree document were removed.

**Carbon stayed.** Its file is what the Apply Carbon control writes through. The list no longer offers
it, and the file is not in git.

**The catalogue reader names one file now.** It used to build its list by scanning the catalogues
folder, and the browser kept that list from the moment the page loaded — so a catalogue deleted from
disk stayed in the list and every read of it failed with “Failed to fetch dynamically imported
module”. The list now names the official catalogue's path, and a deleted folder cannot leave a name
behind.

**A search box sits above the catalogue's name.** It narrows the rows to those whose name, tag or
Figma layer contains the typed words — a filter, not a meaning-based search. The line beneath it says
how many of how many are shown, and a search that matches nothing says so in words rather than drawing
an empty list. Measured in the room: `button` gave 3 of the 68 rows the catalogue declared at the
time, a tag gave 1, and `zzzz` gave 0 with the sentence; the catalogue's own count stayed 68.

## The date a row is ordered by

The list is ordered by the day a component was approved into the catalogue. A trial gave every row
without an approval its file's write time instead, and the measurement rejected it: the three rows at
the top became `component-preview`, `figma-layers-view` and `figma-ingest-form`, because those files
were being edited. That is the program being worked on, not a component being designed. The trial was
removed the same hour. A component with no approval has no date, sorts below every dated one, and
keeps the catalogue's own order among its peers.

## What remains open

- **The Design room's own check has not run since the catalogue merge.** The room's surfaces are now
  checked against the one catalogue, and its five own names are declared there. The room draws; its
  next AI turn is what proves the check, and that turn has not been taken.
- **No approval has run since the tick boxes were added.** The confirmation's “left as they were”
  sentence and a replace-exactly-one-pattern approval are unproven end to end; the boxes and the
  server's selection rule were measured separately.
- **The approval's stage line has not been watched.** A removal's readout was watched and stops on the
  stage that failed; an approval's stages are recorded through the same line and were not seen.
- **The three-step test the owner defined** — ingest, move one node by one pixel and re-ingest, then
  change one colour digit and re-ingest — is built for (the comparison names the changed fact) but has
  not been run as one recorded test.
- **An instance of a component this system does not ship** is still treated as a new pattern whose tag
  comes from its occurrence. Whether it should be a pattern or a refusal is the owner's decision.
- **The catalogue's title.** The file is called “Raibach Prompt Composer Catalog” and now holds the
  Design room's five own names as well. A name for the single catalogue is the owner's to choose.
- **Carbon is not in git.** Its file exists only on this machine, and it is reachable only through the
  Apply Carbon control. If that control is kept, the file should be committed; if it is dropped, the
  file can go.
- **The old rows in the database.** Ingest and discard records written before this day's rule are
  still in `figma_ingest_activity`. Removing them is a destructive database operation and was left to
  the owner's word.
- **The catalogue audit's one blocking finding** — `RoomEmbed` declares a `seat` slot its element does
  not render — is reported, not enforced. The audit also carries 38 advisories. Both counts were
  regenerated after the catalogue merge.
- **Six approved components predate the stored fact tables.** Their rows show declarations and source;
  their facts and annotations are empty, and the interface says so. Only approvals from now on carry
  the whole record.
- **`childMatches`** in the ingest answer is a stale field that is always empty. The child question is
  now carried by the pattern set.
- **The `DISAORD` layer name** in the test design is Figma's own spelling; the words are `DISCARD`.
  The report shows both because they are two different facts.
- **The search is literal.** No index of these components exists in Milvus, so the box matches the
  words it is given. A meaning-based search was offered and not chosen.

## The lessons worth carrying

1. **A word is not a value.** Any check that looks for a declaration's name instead of its value will
   pass everything.
2. **A count over the comparable facts is a lie by construction.** Count over everything that asks.
3. **A transform is not a field named `rotation`.** Read the transform, or the picture drifts.
4. **A blank pane and a failed pane look the same.** Say which one is on screen.
5. **A slow write is not a hang if the button says it is writing.** 69 seconds of silence reads as a
   failure.
6. **The instrument lies first.** Three false reports in one day were the check's fault, not the
   design's: a hidden effect counted as stated, a two-decimal rounding compared to four, and a
   whole-component canvas move reported as a change.
