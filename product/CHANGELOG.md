# The Product zone — changelog and what comes next

*Started 2026-10-05, on the owner's rule: every tab's folder keeps its own log, and each tab's
folder is the source of truth. This folder begins here — before today the Product room's records
live in `wireframe-lab/PRODUCT-ROOM.md`, the root `CHANGELOG.md`, and the git history.*

---

## 2026-10-05 — the log starts

**What this folder is.** The Product zone's own shelf. The Product room embeds the app builder —
its hosted tools are services of their own (`builder`, `builder-engine`; the README's
"The rooms' tools are services of their own" table names them) — and its record so far lives in
`wireframe-lab/PRODUCT-ROOM.md` and `wireframe-lab/PRODUCT-TEAM-SOLUTION.md`.

Entries land here as the zone's work lands.

---

## 2026-10-06 — the stage loads, the store is clean, the engine is in the repository

**The room's stage loads again** (fixed at the engine, both edits local-only; the full
forensics live in `wireframe-lab/CHANGELOG.md`): preview URLs now use the path form
(`http://localhost:4000/preview/<id>/`), and a slashless request redirects to it so a built
page's relative links resolve. Verified live with a proof build; the owner's own follow-up
prompt completed in the same project (`product-idea-h65`).

**The store is clean.** The 34 click-born empty shells were deleted through the engine's own
delete route — each verified empty first. Two real projects remain (`product-idea`,
`product-idea-h65`); full copy at `~/Raibach_IDS-vcaas-data-backup-2026-10-06/`; the
**Product Team** category row is untouched.

**The engine is backed up** (owner: *"the engine is one of the most important things that we
just did and it needs to be backed up. You can git-ignore DeepSeek credentials and still put
the core of the application."*): the builder app and its engine enter this repository on the
working branch — 179 files, mirroring main's import — with the DeepSeek key
(`local-vcaas/.env`), the engine's store (`data/`) and build output kept out. Commit `6bf8d0b`,
pushed to `origin/pre-removal-build`.

**Next (agreed in discussion; not yet built).** Absorb the builder's chat into Grace — the
thread is the product's conversation, named by the product idea. Then the room's simple
remainder as catalog components (`product-*` tags, `surface: 'product'`): the My Projects
button and its modal. **The handoff sheet — "IDs for Design" — lands in this folder once those
elements are built**, carrying the real IDs, bindings and declared events for the drawing
side (owner, 2026-10-06: *"may need to be done after you've built it"*).
