# The next conversation — Figma ingest

This is the opening brief for the ingest pipeline. It says what the ingest is, what was settled, what
is open, and the order to take it in. It is written to be read before anything is changed.

The session-level brief, which also covers the Design room's own chat parts and its rails, is one
level up at [`../NEXT-CHAT.md`](../NEXT-CHAT.md).

## The one paragraph that matters

The Figma file is the authority. The component is a copy of it, made by measurement, and every value
the file states is either carried exactly or reported as a gap with the value it should have had.
Nothing is interpreted, nothing is guessed, and nothing is suppressed. The layer's **name** is its
identity: a name the catalogue already holds is that component and an approval replaces it; a name of
its own is a new pattern, even when it looks identical to another.

## Read first

1. [`CHANGELOG.md`](./CHANGELOG.md) — the running record, newest first.
2. [`2026-10-26-feedback-and-patterns/README.md`](./2026-10-26-feedback-and-patterns/README.md) — the
   day's account in prose: the value-level proof, the patterns, the ephemeral preview, the readouts,
   the single catalogue and the search box.
3. [`2026-10-26-feedback-and-patterns/CHANGELOG.md`](./2026-10-26-feedback-and-patterns/CHANGELOG.md)
   — the same day's dated changes, each with its verification.

## The rules this work runs on

- **A word is not a value.** Every fact is compared as the Figma value against the drawn value. A
  check that looks for a declaration's name instead of its value passes everything.
- **A count cannot contradict the report.** Every fact that asks for a drawing is in the total. One
  hundred percent must never appear beside a named failure.
- **Errors are the product.** What could not be read is said above the drawing, in plain sentences,
  and every gap says whether it is the program's or the file's.
- **The preview is ephemeral.** One at a time, emptied before each write, gone on discard. Nothing is
  written to the database before approval.
- **The catalogue is read for the layer name only**, never for the existing component's measured
  values. Anything else is interpretation.
- **The tick boxes decide the write.** New patterns start ticked, existing ones unticked, and an
  unticked pattern is untouched — no file, no record, no entry.
- **A write names its stages.** Approval and removal record each real stage as it begins and stop on
  the stage that failed.
- **One catalogue.** The official catalogue is `prompt-composer`, and it now holds the Design room's
  own five names as well. There is no second catalogue and no switcher.

## What was settled on 2026-10-26, with its measurements

- The proof compares values. A one-pixel move and a one-digit colour change are both named as facts
  with both values.
- The mirror was drawn as a rotation because a field named `rotation` was read instead of the
  transform. The transform is drawn now; the buttons measure at 209, 343 and 482, each 124 (the third
  142) wide and 40 tall, 13 from the top.
- Seven drawing faults were found and fixed by the value comparison: gradient and translucent fills,
  a lost fill stack, a lost second shadow, the shape family's outline, a 0 × 0 free frame, and two
  precision losses.
- The preview is a Lit component in `frontend/.preview/<job>/`, served as a module; its records die
  with it.
- A design's children are patterns by layer name, each drafted, proved and registered at approval.
- The list states what approving will write before any press: the existing component with its tag and
  date, then every pattern with a tick box.
- The list is ordered by approval date only. A trial that used each file's write time was removed the
  same day, because it put the three files being edited at the top.
- The list has a search box above the catalogue's name: a literal filter of names, tags and Figma
  layers, with a count of what is shown.
- One catalogue: primitives was deleted (its seven names were already in the official one), and
  design-artifacts' five room-only names moved into the official one before its file was deleted. The
  catalogue now declares 73.

## What is outstanding, in the order to take it

1. **Run one Design-room turn.** The room's own check moved from the deleted second catalogue to the
   official one. The room draws; its next AI turn is the proof that its own five names pass. A
   refusal would name the component and the catalogue in the answer.
2. **Approve a design whose patterns already exist, with the tick boxes.** Three existing patterns
   must start unticked; ticking one must replace exactly that one, leave the other two untouched, and
   the confirmation must name them as left as they were. Watch the stage line while it runs.
3. **Run the owner's three-step test as one recorded run.** Ingest a design; move one node by one
   pixel in Figma and re-ingest — the answer must name the fact that changed, with both values;
   ingest again — the answer must say nothing changed; change one digit of a colour and re-ingest — the
   answer must name the colour. Each step's answer is the evidence.
4. **Decide the catalogue's title.** The file still reads “Raibach Prompt Composer Catalog” and now
   holds the Design room's own names too. This is the owner's naming decision.
5. **Decide what an instance of an unshipped component is.** Today it becomes a new pattern whose tag
   comes from its occurrence. It may instead deserve a refusal or its own statement.
6. **Carbon.** Its catalogue is not in git and exists only on this machine; it is reachable only
   through the Apply Carbon control. Commit it or drop it, with the control.
7. **The old database rows.** Ingest and discard records written before the ephemerality rule are
   still in `figma_ingest_activity`. Removing them is destructive and waits on the owner.
8. **The audit's one blocking finding.** `RoomEmbed` declares a `seat` slot its element does not
   render. The audit also carries 38 advisories, regenerated after the catalogue merge.
9. **Six approved components predate the stored fact tables.** Their facts and annotations are empty
   and the interface says so. Only approvals from now on carry the whole record.
10. **`childMatches`** is a stale field in the ingest answer that is always empty; the pattern set
    carries the child facts now.

## What not to do

- Do not restore a second catalogue, or a chip row that offers one.
- Do not add a fallback, a second copy, or an error suppression. If one copy fails, it fails in front
  of the owner.
- Do not treat a file's write time as a component's date.
- Do not enumerate the catalogues folder in a module list; name the one file, or a deleted folder will
  survive in the browser as “Failed to fetch dynamically imported module”.
- Do not approve, remove or ingest anything into the catalogue without the owner's own press.
- Do not make a change he did not ask for and describe it as a fix.
