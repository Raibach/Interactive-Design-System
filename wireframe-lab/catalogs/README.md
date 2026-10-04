# catalogs/ — one directory per design system, never merged

This is where **this effort's own catalogs** live: the registries and the Lit catalogues for the
wireframing / vibe-coding effort, partitioned **on purpose**. The owner's reason is management, not
structure: a separate directory and a separate registry per design system, so a reviewer can read
the repository and see the systems apart — and so a feature can be permission-locked to a team.

The shape, as landed (2026-10-03 — the first two systems are in):

```
wireframe-lab/catalogs/
  <system>/
    catalog.json      the catalogue — components, props, proposals, the accept record
    registry.json     the system's OWN name→tag table (data; the resolver's "own resolver")
```

plus, with each system's Lit tree in the app (`frontend/src/components/lit/<system>/`), its OWN
registry module — `registry.ts` beside its components — which registers its elements for the bundle
and carries its declarations (`kor/registry.ts`, `agnosticui/registry.ts`). Two systems are on disk:
**agnosticui** (instance #1, `ag-select`) and **kor** (instance #2, `kor-button`).

## The two decisions this file carried, now made (owner, 2026-10-03)

**1 · The home.** The open build question ("are these directories the source and the app's tree
takes them, or does the app read this folder directly?") was put to the owner with both costs
measured, and he chose: **these directories are the SOURCE; the app's tree holds one symlink per
partition** (`frontend/src/components/A2UI/catalogs/<system> -> ../../../…/wireframe-lab/catalogs/
<system>`), which is what keeps every existing reader — the server's partition scan
(`backend/deps.py`), the bundle's `import.meta.glob`, the design rail, the audit — reading the
paths they have always read. The ingest writes the real files HERE and creates the link as part of
the same act (one writer; `backend/routes/figma.py`), and it was driven: the partition appeared in
the rail, in the room's chooser, and in the acceptance with no restart. Vite needed one line
(`server.fs.allow: ['..']`) because the link's real path sits outside its workspace root — measured,
not guessed.

**2 · The wall.** The owner then watched a session that had chosen an ingested system, and said the
thing this whole folder exists for, plainly: *"These are supposed to be separate, isolated catalogs.
They do not share any assembly information. They do not share a registry. They have to be
independent… The applications catalog cannot be leveraged for this. We have to create a completely
new lit catalog completely new registry for each one of these — it's not about convenience. It's not
about capability. It's about I want to have this partitioned."* (Verbatim, with the same rule
recorded earlier in `PLANS.AGENT/multiple-catalogs.md` §10: *"The app's three files are the app
catalogue's files. A second catalogue must never write into them."*)

**What the wall changed, the same day, all driven:**

- Each system's declarations left `frontend/src/shared/tag-registry.ts` (the prompt-composer
  catalogue's own file) for the system's own registry module — the entries appear there only in a
  pointer comment now.
- Each system's `registry.json` carries its own name→tag table, and `resolveTag` reads **the chosen
  system's own table FIRST** — the app's allowlist answers only after it, as the app catalogue's
  own. Proven with the map emptied: `kor-button` drew *"The catalogue does not know
  \"kor-button\"."* — there is no fallback to the app's tables anywhere; restored, the element
  drew again.
- The Product room's assembly hands a session **its own** catalogue to the model — an ingested
  system's own file, never the app's — which is what the owner saw leaking. Grace, asked what her
  session carries (deepseek-v4-pro, in the running room): *"This session draws from the kor
  catalogue, and the draft-safe palette carries exactly one component: kor-button."*
- A node whose name its session's system does not own now draws its refusal **alone** — switching
  systems previously left the other system's element mounted under the sentence (found and fixed in
  `vueCanvas`'s node renderer while driving).

And what the systems share, by construction: **nothing**. Not a file, not a registry, not a
resolution path, not the model's context. A system's world is its own folder, its own Lit tree, its
own registry — the app's files describe the app.

## What is still open here

- **A catalogue's own editors and rooms** — who may edit a catalogue, which rooms may draft with it
  (`PLAN.md` §9, consequence 3). Nothing declares it yet; the walled-off harness catalogues are the
  case it exists for.
- **The per-partition audit** — the design rail's row for a system's catalogue reads "the audit has
  not measured it yet" until that partition has a checker of its own (or manifest mode); the app's
  `catalog:check` audits prompt-composer and must not pretend to cover the systems.
- **The systems' Lit trees are hand-carried today** (the import procedure, `IMPORT-A-DESIGN-SYSTEM.md`);
  the owner's direction the same evening: *"Grace can load it in the background and they never even
  need to see it"* — the preparation automation (`prepare_design_system.py`) and the background
  import are the named next build.
