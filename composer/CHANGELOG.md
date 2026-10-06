# The Composer zone — changelog and what comes next

*Started 2026-10-05, on the owner's rule: every tab's folder keeps its own log, and each tab's
folder is the source of truth. This folder begins here — before today the Composer's records live
in the root `CHANGELOG.md`, the git history, and the report the checker writes
(`frontend/catalog-audit/prompt-composer.json`).*

---

## 2026-10-05 — the log starts

**What this folder is.** The Composer zone's own shelf: the prompt-package composer — the room
where packages are built, run, and saved. Its catalogue is the gate for every payload it renders,
its checker's report lands at `frontend/catalog-audit/prompt-composer.json`, and a run's saved
state lives on the package's own row (`metadata.workspace`).

Entries land here as the zone's work lands.

## 2026-10-05 — the check reports to the shell again, behind ONE switch

`fetchCatalogHealth` — the chat bar's badge and the findings the shell resolves repairs against —
reads the real report again (`frontend/src/shared/catalogHealth.ts`; the hard "disabled" stub from
2026-09-29 is gone). The ONE switch now lives in the backend, `CATALOG_AUDIT` (default ON), and
both halves go through it: the shell's fetch and the backend readers (Grace's check rows,
`_repair_rows`; `routes/misc.py` `_read_catalog_audit`), so a flipped switch cannot leave the two
halves telling different stories. Owner's word on the plan's question: "align".
