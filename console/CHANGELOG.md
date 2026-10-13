# The Console zone — changelog and what comes next

*Started 2026-10-05, on the owner's rule: every tab's folder keeps its own log, and each tab's
folder is the source of truth. This folder begins here — before today the Console's records live
in the root `CHANGELOG.md` and the git history.*

---

## 2026-10-05 — the log starts

**What this folder is.** The Console zone's own shelf. The Console is the room the shell opens
onto — the package library: the cards, the chat seats and the catalogue the assembly reads
(`frontend/src/pages/ConsolePage.tsx`; the surface comes from `backend/routes/ai.py`, intent
`render-console`).

Entries land here as the zone's work lands.

---

## 2026-10-11 — the box's Console was empty; the database wasn't (and neither was the page).

**What was seen.** On the deployed site the Console assembled **"AI assembled — 0 packages"**.
Straight answer first: that card is the page's honest EMPTY state, not suppression — and the
cause was data, not code: the box's studio database was a bootstrap skeleton (a few seat rows)
while this Mac's carried the real store.

**Fix + receipts.** The full studio dump was restored on the box (cancel-safe detached script;
`pg_restore` exit 0): `prompt_sessions` **320** · `audit_logs` **1622** · `usage_metrics`
**1327** · `figma_ingest_activity` **450**. Verified: `assemble-surface` returns the owner's
real cards (Tennis Shoe, Boots on Sale, Competitive Intelligence Analyst, My new product
idea, …).

**No code changed in this zone.** `ConsolePage.tsx`'s empty-state card, its adjacent raw
diagnostics path, and the assembly endpoint stood exactly as they were.
