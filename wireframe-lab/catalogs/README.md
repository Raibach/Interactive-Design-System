# catalogs/ — one directory per design system, never merged

This is where **this effort's own catalogs** live: the registries and the Lit catalogues for the
wireframing / vibe-coding effort, partitioned **on purpose**. The owner's reason is management, not
structure: a separate directory and a separate registry per design system, so a reviewer can read
the repository and see the systems apart — and so a feature can be permission-locked to a team.

The intended shape, one system per directory:

```
catalogs/
  <system>/
    catalog.json      the declarations — components, props, annotations (what the assembler reads)
    registry.ts       the Lit element mappings for this system only
```

A new system (Carbon, Material UI, the harness's own) arrives through the Figma ingest and lands as
one more directory here — the same way `frontend/src/components/A2UI/catalogs/<system>/` works today.

**One thing to settle before the first system lands here** (it is a build question, not a style
question): the application's assembly path reads catalogs from inside the frontend tree
(`frontend/src/components/A2UI/catalogs/…`, resolved server-side by `backend/routes/ai.py`), and the
renderer reads the registry from `frontend/src/shared/tag-registry.ts`. A catalog that lives only in
this folder is not readable by either. So either these directories are the **source** and the app's
tree takes them at build time (a copy or a symlink), or the app reads this folder directly (a path
the bundler and the server both know). The choice belongs to the owner's next note; nothing here
pretends to have made it.
