# CORRECTIONS — the ledger of fixes

Every finding this repository has **corrected**, with the commit that carries the fix.

**At the repository root, tracked by git, and read by the checker.**
`catalog-check.mjs` holds every row against the run it is part of — `check: corrections-ledger`,
which is **blocking**.

`OPEN-ITEMS.md` answers *what is still open*. This file answers *what we already did, and does
it still hold*. Two questions, two files — and separate because a correction that comes back has
to be visible as a **regression**, not as a count that quietly went back up.

---

## 1 · How a row is read

Two forms, and the checker treats them differently:

- `check:<class>` — a whole class was cleared. **Earned** when that class derives **zero** open
  findings in this run.
- `check:<class>:<subject>` — one finding was cleared. **Earned** when **no finding in this run
  carries that exact id**.

`<class>` must be a check in `CHECK_INVENTORY`. A citation to a check that does not exist cannot
fail, so it cannot prove anything.

A row that is **not earned** is a regression: the finding was recorded corrected, and this run
derives it again. That fails the build. It is the one signal a count cannot carry.

## 2 · The columns

| ID | column | how the checker reads it |
| --- | --- | --- |
| `Finding` | the per-finding id, as the report and the console show it | the claim |
| `Corrected` | `YYYY-MM-DD` | must parse as a date |
| `Receipt` | **the commit that carries the fix** | must resolve as a commit in this repository |
| `Witness` | what would re-open it | prose, for a reader |

**No receipt, no row.** *"It was fixed"* and *"it is fixed"* are different claims, and only the
second can be checked. A commit is the smallest thing a reader can open and look at.

## 3 · The ledger

| Finding | Corrected | Receipt | Witness — what re-opens it |
| --- | --- | --- | --- |
| `check:component-missing` | 2026-09-12 | `493d932` | a registry entry names a component source that does not exist |
| `check:node-id-absent` | 2026-09-12 | `493d932` | a node-derived component loses its node id |
| `check:element-unclaimed` | 2026-09-12 | `493d932` | a `data-tag` with no matching element |

Three rows — and those three are the whole of what this ledger can honestly claim today.

## 4 · Why only three

The register records more closures than this: `check:allowlist-absent`, `check:node-unresolved`,
`check:attr-hardcoded`, `check:doc-claim-drift`, and the typed items `#007` and `#021`. They are
**not** rows here, and the reason is the point of the file — **their receipts do not exist.** The
register states that they closed; it does not name a commit for them. A ledger that accepted
*"it was fixed"* on that evidence would be a list of beliefs.

They can be added the moment someone finds the commit. Until then `OPEN-ITEMS.md` carries them
as closed rows without a receipt, which is exactly what they are.

## 5 · Adding a row

```bash
cd frontend
npm run corrections:add -- --finding "check:provenance-missing:prompt-container" --receipt <commit>
```

The writer checks the class against `CHECK_INVENTORY`, refuses a duplicate, and inserts the row
into the table. Then run the check:

```bash
npm run catalog:check
```

If the finding still derives, the run says so and names the row.

## 6 · What this does not do

It does not close anything. A row is a record of a fix; the **run** decides whether the fix
holds — the same rule the register already states:

> an item closes only when the thing that derived it stops deriving it — not when somebody
> edited a file.
