# wireframe-lab — changelog

## 2026-10-06 — the stage loads again: the subdomain hang, fixed at its source

**The failure, measured (not guessed).** In the VS Code browser preview, a frame navigation to
the builder's per-project origin — `http://<project>.localhost:4000/`, the form the local
engine handed the UI — is fetched, gets HTTP 200 back, and is then ABORTED by the browser
(`net::ERR_ABORTED`); the stage stayed blank and spun forever. Controls in the same browser,
same minute: plain `http://localhost:4000/` loads; `http://localhost:4000/preview/<id>/` loads;
curl sees 200s everywhere. Nothing external was blocked — `/etc/hosts` clean, the stack's live
connections all loopback, DeepSeek reachable with a valid key. The stage simply never received
the document, because of the URL's shape in that browser.

**The fix, in this copy (`ai-app-builder-open/local-vcaas/server.mjs`, two edits).**
1. `previewUrlFor` now hands the UI the SAME path form the hosted engine already used —
   `http://localhost:4000/preview/<id>/` — locally too (`productionProjectUrl` matches). The
   per-project subdomain ROUTE stays served unchanged. Verified live: the stage's frame
   committed and rendered the empty-project splash, then a real build.
2. The stage asks for its page with the trailing slash stripped, so a built page's relative
   `./styles.css` resolved one level too high (404, unstyled page). `servePreview` now answers
   the no-slash form with a 302 to the canonical slash form. Verified: the built page renders
   with its stylesheet (`styleSheets: 1`).

**Proof build (one small run, owner-approved):** "The stage works" — `index.html` +
`styles.css`, built by the engine's own DeepSeek loop, displayed in the stage inside the
Product room.

Sovereignty note: both edits are local-only — no new host, no new call. The builder still
talks to nobody but its own engine, and the engine to nobody but DeepSeek when a run fires.

## 2026-10-06, later still — the store cleaned to its two real projects

Owner's call (*"This is absolutely brand new so we don't want any junk hanging out… but we do
want to preserve the Product Team category"*): the 34 click-born empty shells were deleted
through the engine's own DELETE route — each one VERIFIED empty (no conversation, no files, no
versions) immediately before deletion; nothing was skipped because nothing had content. The
full store was copied to `~/Raibach_IDS-vcaas-data-backup-2026-10-06/` first, so even this is
reversible. What remains: `product-idea` (the real Oct-3 project — "wireless headphones") and
`product-idea-h65` (today's stage proof, with the owner's follow-up run).

The **Product Team category row is untouched** (`#1C2F4E` / `#D3DF44` / `#FFFFFF`), as is the
bridge that creates it.

Console cards found: three — the wireless-headphones card appears TWICE (an Oct-3 row and an
Oct-4 duplicate, leftover of the pre-lock sync race; the sync cannot dedupe its own duplicates
because it keys by project id), plus h65's "My new product idea" tile. The duplicate's removal
is proposed to the owner (exact statement shown before running). Row deletion is self-healing:
the next console sync recreates exactly one row per published project.

## 2026-10-06 — the engine enters the repository (the backup the owner called for)

Owner: *"the engine is one of the most important things that we just did and it needs to be
backed up. You can git-ignore DeepSeek credentials and still put the core of the application."*
The builder app and its engine (`wireframe-lab/ai-app-builder-open/`, `local-vcaas/`) follow
main's 2026-10-05 ruling onto this branch: the folder leaves the vendored shelf in the parent
`.gitignore`, the core enters git (a mirror of main's 179-file set — today's engine fix, the
path-form previews and the slashless redirect, rides along), and the folder's own `.gitignore`
files keep everything that must not travel: the DeepSeek key (`local-vcaas/.env`), the engine's
store (`local-vcaas/data/`), and all build output (`node_modules/`, `.next/`).
