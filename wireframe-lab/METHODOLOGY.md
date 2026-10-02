# The method — how this is built, and why it holds

This file is the METHOD. The other files in this folder are the RECORD: `README.md` is the map and
what is landed, `PLAN.md` is the canvas blueprint and its corrections,
`ADD-A-DESIGN-SYSTEM.md` is the catalog ingest, `PRODUCT-ROOM.md` is the Product room. None of them
argues for the way the work is done; they assume it. This one states it — for the next builder, and
for any reader deciding whether the claims in those files can be trusted.

## §1 — The failure mode this method exists to avoid

An unbounded generative pipeline — "write me the feature" — optimizes for conversational
satisfaction, not for truth about the system. Two failures follow mechanically, not morally. First,
the agent mirrors the operator's framing (sycophancy): a claim is accepted because it was said
fluently, and each unverified claim becomes the next one's premise. Second, the artifacts are
unverifiable by inspection: nothing in a fluent answer says whether the component exists, whether
the API returns that shape, or whether two code paths now write the same field.

This repository has a measured instance, not a hypothetical. `PLAN.md` §1 records five claims from
the original brief — each fluent, each plausible, each false against this tree: there is no SFC
toolchain here; the canvas library's own gestures are switched off by law; the shell refuses a
second surface; the execution layout engine is not reusable for a draft; and "re-save on every
gesture" would have created a second writer. None of the five was caught by conversation. Each was
caught by opening the files and reading this tree.

The same shape recurred the day S2's drive was verified: the shorthand "Scout → RUN → the header
tile → Draft" implied the seeded tiles would draw — and the first drive drew the empty state, which
was CORRECT, because a Run forks the seat onto a fresh conversation by design and the draft is
conversation-keyed. The claim was wrong, the system was right, and only the drive could tell the
difference. That is the working assumption: **prose about this tree is a hypothesis; the tree is
the evidence.**

## §2 — Assembly, not generation: the model composes a bounded palette

The model is not asked to author UI. It is asked to ARRANGE declared components. The catalog is the
only palette: every component is declared (name, props, the file that implements it), every name
resolves through one reader (`resolveTag`), and a name the catalog does not know is drawn as a
sentence — *"The catalogue does not know \"NotAComponent\"."* — never invented. "The model cannot
invent an interface" is therefore true BY CONSTRUCTION (a refusal path that exists), not true by
instruction (a sentence in a prompt asking it nicely).

This confines the non-determinism to the space where it is cheap: WHICH components, with WHICH
props, at WHICH places. The primitives themselves are deterministic, reviewed, and already in the
bundle. The emitted shape is the app's own — a flat, id-referenced list (A2UI's adjacency list,
never nested templates) with positions carried as data — and the consumer is a renderer that holds
no state: it draws what the payload says, including the refusals.

And the model's vocabulary is a BLINDFOLD by construction, not by trust: the assembly is given one
partition (the package's chosen design system), so "the model is blind to everything else" is a
property of what it was handed. `ADD-A-DESIGN-SYSTEM.md` §3 is the mechanism.

## §3 — The verification stack: mechanical gates, one architect, a record

There is no promise that a second model will catch the first model's mistakes — a model auditing a
model is conversation auditing conversation. What exists instead is asymmetric and mostly dumb:

**The gates are programs, and they refuse.** Each of these has been exercised, most of them fail
loudly in production today:

- **The shell's envelope reader** (`shared/a2ui-envelope.ts`): an envelope naming more than one
  surface is refused (`SURFACE-CONFLICT` — "this shell draws one"). A whole class of malformed
  assemblies dies at the door.
- **The catalog gate** (`validate_a2ui_components`): a payload is validated against the catalog the
  surface declares, and a mismatch is refused WITH THE CATALOGUE'S OWN NAME in the message. A
  component that passes against one partition and is refused against another is the designed proof
  of the blindfold.
- **The partition loader** (`deps.py`): a catalog broken at runtime fails the request that asked
  for it, with the file named — it does not fall back, and it does not take the server down. A
  directory that appears at runtime is a partition with no restart.
- **The catalog audit** (`npm run catalog:check`): a program that compares the three declarations
  supposed to be one fact — the catalog JSON, the tag registry, and the elements' own templates —
  and writes what it MEASURED to a report the app serves and draws where a person reads it. Its
  contract is the method in miniature: *"It REPORTS findings and never fails on them: a non-zero
  exit means this check did not run, not that the catalog has problems"* — and checks it cannot run
  (the Figma side) are reported `partial` rather than passed.
- **The run's review hold**: a run can be HELD before it changes anything ("Run held for review" →
  "released by her review", observed in the console), so the stream into the surface is gated, not
  trusted.

**The gates do not decide; they refuse.** What a refusal MEANS — whether Output should show the
column, what Reset does, whether Product becomes a real room — is a person's call, and the record
keeps each such decision with its reasons so it is answered once, not re-litigated per commit.
Decisions are collected, never taken by the builder.

**The record carries measurements, and corrects itself.** Every landing in these files states what
was run and what was seen (`tsc`, `npm run build`, and a browser drive — "green build is not done").
When a measurement contradicts the record, the record is amended and the amendment is visible: the
design rail's "the ingest form does not draw" entry was closed on 2026-10-02 with the reason it had
never been true — the surface being checked was assembled before a backend restart. A record that
cannot be wrong is not evidence; one that shows its corrections is.

The whole shape, one line:

```
[human intent + recorded decisions] → [the model composes ONE partition's palette]
    → [gates: envelope · catalog · partition loader · audit · review hold]
        → [a drawn surface, or a refusal with a name a person reads]
```

## §4 — The laws, by their real names

**The tree is a rendering, not a state store.** The layouts are rebuilt from the server's assembly;
the renderer holds no state; a value that must survive a components change is written as a live
property, not stamped into the tree. (The measured failure: *a tree-stamped prop goes stale* —
`PLAN.md`'s S1b notes.) One implementation of a gesture, one shape for a payload, one name per
fact — a second event name or a second path for an existing fact is the defect this repository
spends its comments preventing.

**One writer per fact.** The draft's autosave is the worked example: a drag emits one gesture-end
event, the host folds the released place into the payload, and the host is the single writer that
PUTs it — `conversation_id` keys the row, `positions` ride in the payload, and the write REPLACES
one artifact row. Measured end-to-end 2026-10-02: one drag, one PUT, `positions.s1 {60,50}` →
`{200,110}`, and the untouched node untouched.

**No fallbacks. A failure fails loud, with a name a person reads.** An unknown component draws its
refusal on the tile; a broken partition fails the request with the file named; a failed write says
why, in the thread. Silent degradation is forbidden because it converts one visible error into an
invisible lie — the empty-state claim, the substituted catalog, the quietly shorter list.

**The catalog is the only palette, and the catalogs stay partitioned.** Separate directories,
separate registries, per design system — a management boundary the owner has stated is the product,
not the packaging. `PLAN.md` §9 has the words; nothing here merges them for convenience.

**Drive it.** A change lands when it has been driven in the running app and the record says what
was seen — a frontend change needs a new tab; a backend change needs a restart, then a reload. The
two traps that motivate the rule have both been hit here in person: a stale module served from the
dev server's cache, and a surface assembled before a restart wearing the old content.

## §5 — What this method does NOT claim

It does not make the model deterministic; it confines the non-determinism to a space where refusal
is cheap, visible, and named. It does not remove the human — it moves the human from typist to
architect and reviewer, which is where the decisions that actually bind the system live. It does
not run on adjectives: there is no self-assigned grade here, because a grade is a claim without a
measurement; the audit report, the recorded drives, and the visible corrections are the evidence.
And it is not free — a landing costs its drive, a slice waits on its decision, and the
documentation is part of the change, not an afterthought to it.

## §6 — The session contract

What every builder session on this repository is bound to, in the order they bind:

1. **No fallbacks.** A failure fails loud, with a name a person reads.
2. **One writer per fact** — named in the change, or the change is wrong.
3. **One name for one fact.** No second event, path, or channel for something that already has one.
4. **Declare before ship** — tag registry and catalog first; an undeclared name does not exist.
5. **Drive it.** New tab for frontend, restart for backend. Compiling is not done.
6. **The record is part of the change**, with its measurements — and it gets corrected, visibly,
   when a measurement says so.
7. **Decisions are the owner's.** Collect them, record their reasons, re-litigate nothing.

The repository is the argument.
