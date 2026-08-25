# THE METHOD — Live-Verification Design Engineering

**Author:** John Holt, Raibach Interactive Design Studio
**Status:** Working doctrine — practiced daily in this repository since 2026
**Companion documents:** [`SPECIFICATIONS.md`](../SPECIFICATIONS.md) (protocol conformance) · [`A2UI_TRUE_VS_FAKE_AUDIT.md`](A2UI_TRUE_VS_FAKE_AUDIT.md) (the method applied under fire)

---

## 1 · The thesis

**A claim about software is a hypothesis. Only observed runtime behavior is knowledge.**

Most engineering cultures treat code review as truth-finding: read the diff, trust the description, approve. That culture was always fragile, and in the AI era it is indefensible — because an AI session does not merely make mistakes, it **optimizes for the error going away**, then writes confident documentation about the fix. Reviewing its prose is reading the suspect's alibi.

This method replaces claim-review with **live verification**: every meaningful statement about this system is checked against the running artifact — a booted process, an HTTP response, a compiled bundle, a rendered surface — before it is allowed to stand.

---

## 2 · The enemy: suppression

Suppression is any act that makes an error disappear **without making the system correct**. It succeeds locally — the message stops, the session ends, the transcript says *fixed ✓* — and fails globally later, far from its cause. Six months of suppression produces a repository that no longer tells the truth about itself, leaving no signal to argue with.

Real specimens, all excavated from this very codebase:

| Suppression move | Specimen | What it cost |
|---|---|---|
| Swallow the exception | `milvus_rest.connected()` → bare `except: return False` | Dead vector store reported healthy |
| Silence the conflict | `"storybook": "^10"` override in package.json | Every future install lied; builds haunted |
| Rename around the bug | Doc files saved as `X.mdx?raw` (import syntax baked into filenames) | In-app doc viewer returned **zero documents** while looking fully wired |
| Describe the capability instead of building it | vitest config importing `@storybook/addon-vitest`, never declared anywhere | Test infrastructure that could never run |
| Exile rather than delete | `_old/` directories, commented "excluded from production" imports | Permanent fog over what is alive |
| Falsify the record | CHANGELOG claiming catalog validators that did not exist | Trust in all other claims collapsed |

The counter-doctrine in one line: **an error you face is an asset; an error you suppress is debt with your name on it.**

---

## 3 · The procedure

Transferable. Run it exactly; the instincts come later.

### P1 — Ground truth before ground breaking
Before changing anything, read the load-bearing files end-to-end and boot the system. No acting on summaries, not even your own memory of them.

### P2 — The claims ledger
Every assertion earns one of three marks, each with a receipt type:
- ✅ **Verified** — cite the live evidence (curl output, startup log, bundle grep, screenshot)
- 🟡 **Partial** — state exactly which half is real
- 🔜 **Specified, not built** — say so plainly; unbuilt ≠ failed
Anything unverifiable gets demoted until it can be verified.

### P3 — Fail loud
No silent fallbacks. No `except: return False`. No compatibility shims that mute a conflict instead of resolving it. If assembly fails, return HTTP 503 with diagnostics; if a dependency graph contradicts itself, fix the declaration — never add a flag that ignores the contradiction.

### P4 — Verify the surface like a person, not a parser
Frontend behavior is verified **live against strict UX heuristics** (visibility of system status, error recovery, consistency, user control — Nielsen's ten as baseline). Does the loading state exist? Does failure render as guidance or blankness? Can the user undo it? A feature whose happy path works but whose failure mode strands the user is **not done**. This is why verification belongs to people who own UX judgment, not just test suites.

### P5 — Documentation synchronizes after behavior, never before
Docs describe what IS. Changelog entries carry verification receipts (what was run, what was observed). If the record and the runtime disagree, the runtime wins and the record gets corrected — publicly.

### P6 — Steering AI sessions
An AI model regresses toward the median of everything it has ever seen — for code, that means conventional SPA patterns. Do not fight this with vigilance; fight it with **structure**:
1. Put the worldview where every session meets it first (`SPECIFICATIONS.md` linked atop the README)
2. Constrain generation mechanically — trusted component catalogs, validation boundaries, fail-loud envelopes — so drift is *rejected by the system*, not caught by your attention
3. Audit outputs against behavior, never against the session's self-report
4. Keep a standing TRUE-vs-FAKE ledger so falsified records are discoverable

---

## 4 · The organizational claim

**Engineering should own UX. Product borrows UX from engineering — not the reverse.**

Reasoning: ownership follows verifiability. The people who can observe the running surface and judge it against heuristics (P4) are the people who hold truth about the product. A committee that verifies nothing cannot own a discipline; it can only gate-check one. Therefore: embed the UX designer inside the engineering pod, arm both with this procedure, and let product consume verified surfaces rather than author speculative ones. Enterprises buying "AI transformation" are in fact buying this inversion — most have it backwards today.

---

## 5 · Starting Monday (team checklist)

1. Boot the system. Watch the startup logs until you can recite them.
2. Pick one claim in your README. Find its receipt or delete the claim.
3. Grep your codebase for `except:` and for flags ending in `-force`/`--legacy`. Read every hit.
4. Run one surface against the P4 heuristics. Log what breaks when it breaks.
5. Write one changelog entry WITH its verification command included.
6. When an AI hands you "done," ask: *what would this look like if it were fake?* Then check for that.

---

*This document practices what it preaches: every historical claim above links to a ledger entry with live evidence. Verify us.*
