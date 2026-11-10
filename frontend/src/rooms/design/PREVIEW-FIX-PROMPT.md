# PREVIEW FIX — Prompt

**Audience: the AI implementing this.** Read `frontend/src/rooms/design/FOUNDATION.md` first. This
prompt is about the Figma ingest preview: what it is, what it must read, what it must report, and
what is broken. Do not delete information to make a result look clean; repurpose it.

## The rule: all or nothing

The ingest either reads the Figma file completely, draws every fact it states exactly, and carries
every layer, or it **fails and says so**. There is no partial result: no "35 accepted without a
drawing", no "built anyway", no "I only did this part". A single unaccounted fact means the run
failed and no component is offered.

The reader has no choice about what to read. REST and the desktop MCP are the two channels, and
every fact a channel states is read from it. Where the code lets a model choose which facts to read,
or lets it interpret a fact instead of reading it, that choice is removed. The model may describe a
design; it may not decide what the design consists of.

The fidelity gate blocks. Its current note says reported, not blocked; that is the opposite of this
rule. A run whose fidelity is not complete is refused with the report as its reason, and the report
is what names what failed.

## The retry rule

Every layer, every stated spec, exactly as the Figma file states it. Nothing omitted, nothing
approximated, nothing accepted. If the result is not exact, the run fails **and tries again**.

- **Attempt 1:** read every layer over REST and the desktop MCP, build the preview, and verify every
  stated fact against the measured values.
- **If verification is not 100%:** discard the draft, go back to the read, and try again. A retry is
  a real re-read of the channels, not a repeat of the previous answer; the run must show that the
  channels were read again.
- **Five attempts at most.** After the fifth failed verification, the ingest fails as a whole: no
  preview is presented, no component is built, and the failure message names every layer and every
  fact that never matched.
- **No partial ever leaves the loop.** The preview is offered only after a run verifies completely.

### Instruction to the model, used verbatim in the ingest's prompt

```
Read every layer in the Figma file through both channels, and produce a preview that is exactly the
file: every layer, every stated spec, nothing omitted and nothing approximated. Verify your result
against the measured facts. If any layer is missing, or any fact differs or is not drawn, you have
failed: discard the result and try again. You have five attempts. On the fifth failure, stop and
report that the ingest failed, naming every layer and every fact that never matched. Never present a
partial preview or a partial component.
```

---

## 1. What the preview is, from its own code

- `components/lit/component-preview.ts` is the middle column. It draws what it is given and does not
  fetch: `preview` arrives from the data model, written by the shell from the answer the ingest
  returned. It parses nothing, calls nothing, and decides nothing about what a component is.
- The ingest (`backend/routes/figma.py`, `POST /api/figma/ingest`) reads the Figma node, writes a
  draft to `frontend/.preview/<job>/<tag>.ts`, and serves it at `/@figma-preview/<job>/<tag>.ts`. The
  preview draws that draft.
- The ingest's answer carries the preview's facts: `preview` (the draft address and identity),
  `fidelity` (the design against the Figma file), `specs` (the drawn declarations), `readings` (every
  fact, layer by layer), `annotations` (the designer's own notes), `steps` (what the run did), and
  `twoPass` (the second channel's read).
- The preview is **ephemeral**. Discarding it touches nothing. It does not read the catalogue. It
  has no relation to the catalogue until the run is in approval.
- The catalogue comparison the ingest makes — whether the tag exists, the entry whose layer name
  matches, the layers whose names exist on other components — is carried in
  `preview.approvalFacts` for the approval queue. No renderer in the preview reads it. The
  `_collisionQuestion` method is kept in the preview for the approval; it is not drawn.

---

## 2. What is broken

**2.1 — The Figma file is no longer read; it is guessed.** The design must be built from the Figma
file through both channels: the REST API (`/v1/files/<key>/nodes?ids=<node>`) and Figma's desktop
MCP. A fact that a channel states must be read from it, not interpreted, summarised, or invented by a
model. The activity note "rendered from the design's own measurements — no model was called" is the
shape to verify for every run: prove which channel supplied each fact.

**2.2 — The two-pass read is incomplete and misreported.** The report states: 21 of 26 layers were
measured over both channels; 106 of 126 facts carried the same value; 20 facts differ inside a
mirrored frame; 4 vector layers are named by one channel only; 25 facts exist only over REST
(1 frame, 3 text, 21 transform). Two different problems are mixed there:
- The mirrored-frame differences are a comparison bug. REST negates a child's offset from a flipped
  frame down; the MCP adds it as written. Both are the same place from two origins. The comparison
  must normalize the flip (using the frame's flip and the child's relative transform) so those facts
  are reported as agreeing, not as differing.
- The 4 unnamed vector layers and the 25 REST-only facts are a reading gap in the MCP path. Read them
  from the MCP, or read them from its own data (its artwork and its transform chain). Do not leave
  them unconfirmed and do not drop them from the report.

**2.3 — Facts are accepted without a drawing.** 35 of 218 stated facts are "accepted without a
drawing", and 1 (`strokeAlign`) did not survive. A fact visible in the Figma file must survive into
the draft. A fact that is not drawn is a failed run: the ingest is refused, not completed, and the
report names the fact. "Accepted" is not an outcome. `strokeAlign` is a measured value that the
drawing must carry (border or outline per the design's alignment), not a fact to excuse.

**2.3a — The four keys the report cannot account for.** `booleanOperation`, `boundVariables`,
`maxWidth`, `styles`. Each is a fact the Figma file states. `booleanOperation` is a drawn shape
(UNION, SUBTRACT, INTERSECT, EXCLUDE); `boundVariables` is the variable bindings the design uses;
`maxWidth` is a text constraint; `styles` is the shared style the layer references. Account for each
in the reading or report it as an omission with its reason — never as an unknown.

**2.4 — The preview must report everything visible in Figma.** Every stated fact, drawn or not, is
in the report by name: the fidelity counts and the per-fact list, the declarations, the annotations,
the steps, and the two-pass read. Nothing is shortened, summarised away, or reclassified to make the
result look clean. Error suppression is a defect.

**2.5 — Saving does not save the preview.** The draft is a temporary file at
`frontend/.preview/<job>/<tag>.ts`. Saving the session does not copy it, so the save question says
the preview will be lost and the ingest must be run again. Saving a session must keep its preview:
copy the draft into a place owned by the session, record its address with the session's record, and
draw it when the session is reopened.

**2.6 — The catalogue column shows the draft's tree.** `figma-layers-view.ts` used to draw "The
design you just ingested, and its children" in the catalogue column. That is preview data and does
not belong there. The call was removed; the method is kept. It must not come back without the
catalogue having a row for it.

---

## 3. The rules for the fix

1. The preview reads the Figma file and nothing else. REST and the desktop MCP are the two readers;
   a fact a channel states is taken from the channel, never guessed.
2. **All or nothing.** A complete read and a complete drawing, or a failure with its reason. No
   partial result, no accepted fact, no component offered from an incomplete run.
3. **The reader has no choice.** Remove any code path that lets a model decide which facts to read or
   interpret a fact in place of reading it.
4. **The gate blocks.** A run whose fidelity is not complete is refused; "reported, not blocked" is
   the behavior to remove.
5. The preview is ephemeral. Discarding it touches nothing.
6. The preview draws the draft and the design's own facts. It draws nothing from the catalogue.
7. The catalogue comparison travels in `preview.approvalFacts` and is read only by the approval.
8. Nothing is deleted from the report or the code to hide a failure. The report is the evidence.
9. The two-pass comparison compares the same place in the same origin. A mirrored frame is
   normalized, not excused.
10. A saved session keeps its preview; the draft is copied, not lost.
11. Do not add a fallback, a delay, or a silent catch. A failure is said where the person is reading,
    with its reason.
12. **Retry five times, then fail the run entirely.** No partial preview, no partial component, no
    "built anyway". The failure message names every layer and fact that never matched.

---

## 4. The plan

**Step 0 — Read the pipeline and collect the evidence.** Read `routes/figma.py` (the ingest),
`figma_twopass.py`, `figma_fidelity.py`, `components/lit/component-preview.ts`, and
`ToolsSeat.applyIngestResult`. For one real node, collect: the ingest result JSON, the job's draft
files, the `figma_ingest_activity` row, and the two-pass rows. State which channel supplied which
fact.

**Step 1 — Prove or disprove the guessing.** For the same node, compare the draft's declarations and
the result's facts against the REST node and the MCP answer. Find every fact that was not taken from
a channel. If a model is producing any measured value, remove it from that path: the model may
describe, but the channels state.

**Step 2 — Close the MCP reading gaps.** The 4 vector layers and the 25 REST-only facts: read them
from the MCP, or read them from its artwork/transform data. If the MCP genuinely cannot carry one,
state why in the report and keep the REST value — do not drop it.

**Step 3 — Normalize the mirrored frame.** In the two-pass comparison, transform the MCP value into
REST's origin for a layer under a flipped frame before comparing. A fact that is the same place from
two origins is reported as agreeing, with the flip as a fact REST carries.

**Step 4 — Make every accepted fact survive.** For each of the 35, the draft carries it. If a fact
cannot be carried, the run fails and the report names it; the ingest does not complete with a
partial drawing. `strokeAlign` is the first: the drawing must carry the design's alignment; add the
declaration the renderer needs. Make the fidelity gate refuse a run that is not complete.

**Step 5 — Report everything.** The preview draws the draft, the declarations, the per-fact readings,
the annotations, the steps, the fidelity counts, and the two-pass read. No pruning, no reclassification.

**Step 6 — Save the preview.** Make the save copy the draft into a durable, session-owned place,
record its address with the session, and draw it on reopen. The save question then says the drawing
is kept.

**Step 7 — Verify.** Ingest the same node again. The run either completes with every layer read over
both channels, every fact drawn exactly, `strokeAlign` drawn, the mirrored-frame facts agreeing, and
the preview drawing the draft — or it refuses with the failure message naming the facts it could not
carry. There is no third result. Then run the fidelity gate and confirm it blocks.

---

## 5. The other open Design-tab problems

These were raised in the same work and are not addressed. Record them; do not fix them by deleting
features.

- **The chat's width.** The width has no single owner. The proper design: the section owns one width;
  each page's layout receives it before its first paint; a drag changes it; a page shown again is set
  to it once, with the pane's motion off. Never measure a pane before the chat is placed, never
  re-apply on every draw (that reset the width under the pointer), and never transition it during a
  switch. The code currently has the width carrying removed; the per-page behavior is back.
- **The right column's open state.** Opening the Figma preview is supposed to fold the right rail.
  Three owners write the state today: the Tools page, the shell, and the workspace. The page owns
  it; the shell decides only which page stands.
- **The leave question.** Leaving must always navigate and reset the page. A warning appears only
  when the page reports a change, never as a gate, and never with no change. The Tools work test
  counts a draft made in this visit, not a component merely opened.
- **The page lifecycle.** The foundation says a page loads when used and is disposed when left; the
  shell still keeps every container. The record and conversation persist in the database and are
  re-read on return.
- **The boundary surface.** The seats are host elements mounted outside the surface. The surface seat
  is the structural item the foundation names as unmet.
- **The tabs as pages.** Chat is its own page now (`chat/chat-tab.ts`). Approve and UX still draw the
  shared `design-chat`. Each needs its own page, conversation file, record and words.
- **The approval queue.** Not built. An ingest produces a pending entry; the entry is its own record
  with its own log conversation; selecting the card loads the log; the chat asks yes or no; approval
  commits and replaces; the card is first in the lists; the next pending entry follows.
- **The dead record.** A page that keeps a package id across a replacement asks the server for a
  record that no longer exists and gets a 403. The boundary re-resolves its record; the refusal stays
  visible.
- **The audit.** The ingest's full fidelity report is not persisted with the ingest record, so it
  cannot be read later or in the approval. It must be stored with the run and readable there.
