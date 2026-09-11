# THE METHOD — Live-Verification Design Engineering

**Author:** John Holt, Raibach Interactive Design Studio
**Status:** Working doctrine — practiced daily in this repository since 2026
**Companion documents:** [`SPECIFICATIONS.md`](../SPECIFICATIONS.md) (protocol conformance) · [`A2UI_TRUE_VS_FAKE_AUDIT.md`](A2UI_TRUE_VS_FAKE_AUDIT.md) (the method applied under fire)

---

## The enemy: Error suppression

Suppression is any act that makes an error disappear **without making the system correct**. It succeeds locally — the message stops, the session ends, the AI transcript says *fixed ✓* — and fails globally later, far from its cause. Six months of error suppression produces a repository that no longer tells the truth about itself.

Real specimens, all excavated from this very codebase:

| Suppression move | Specimen | What it cost |
|---|---|---|
| Swallow the exception | `milvus_rest.connected()` → bare `except: return False` | Dead vector store reported healthy |
| Silence the conflict | `"storybook": "^10"` override in package.json | Every future install lied; builds haunted |
| Rename around the bug | Doc files saved as `X.mdx?raw` (import syntax baked into filenames) | In-app doc viewer returned **zero documents** while looking fully wired |
| Describe the capability instead of building it | vitest config importing `@storybook/addon-vitest`, never declared anywhere | Test infrastructure that could never run |
| Exile rather than delete | `_old/` directories, commented "excluded from production" imports | Permanent fog over what is alive |
| Falsify the record | CHANGELOG claiming catalog validators that did not exist | Trust in all other claims collapsed |
---

## The procedure

### The claims ledger
Every assertion earns one of three marks, each with a receipt type:
- ✅ **Verified** — cite the live evidence (curl output, startup log, bundle grep, screenshot)
- 🟡 **Partial** — state exactly which half is real
- 🔜 **Specified, not built** — say so plainly; unbuilt ≠ failed
Anything unverifiable gets demoted until it can be verified.

### Fail loud
No silent fallbacks. No `except: return False`. No compatibility shims that mute a conflict instead of resolving it. If assembly fails, return HTTP 503 with diagnostics; if a dependency graph contradicts itself, fix the declaration — never add a flag that ignores the contradiction.

### Verify the surface like a person, not a parser
Frontend behavior is verified **live against strict UX heuristics** (visibility of system status, error recovery, consistency, user control — Nielsen's ten as baseline). Does the loading state exist? Does failure render as guidance or blankness? Can the user undo it? A feature whose happy path works but whose failure mode strands the user is **not done**. This is why verification belongs to people who own UX judgment, not just test suites.

### Documentation synchronizes after behavior, never before
Docs describe what IS. Changelog entries carry verification receipts (what was run, what was observed). If the record and the runtime disagree, the runtime wins and the record gets corrected — publicly.

### Steering AI sessions
An AI model regresses toward the median of everything it has ever seen — for code, that means conventional SPA patterns. Do not fight this with vigilance; fight it with **structure**:
1. Put the worldview where every session meets it first (`SPECIFICATIONS.md` linked atop the README)
2. Constrain generation mechanically — trusted component catalogs, validation boundaries, fail-loud envelopes — so drift is *rejected by the system*, not caught by your attention
3. Audit outputs against behavior, never against the session's self-report
4. Keep a standing TRUE-vs-FAKE ledger so falsified records are discoverable

**Why structure beats vigilance.** Vigilance expires when the session ends; structure persists. The genuine countermeasure is architectural, not attitudinal:

- A **trusted component catalog with fail-loud 503s** — out-of-allowlist generations are rejected by the server, not argued with by a reviewer.
- A **zero-trust validation boundary** — invalid UI physically cannot reach the client, no matter how confident the session that produced it.
- An **envelope protocol** — the model decides content; chrome is structurally untouchable.
- A **live-verification culture** — this document — catches whatever slips past the walls.

Each mechanism assumes the next session will misbehave — including mine. That assumption is precisely what makes a codebase safe to hand to machines.

---

## Provenance: progressive adoption — why this method exists

During an enterprise AI-lifecycle engagement (Southern California Edison, via Logic2020, 2025–2026) — 15,000+ employees with vastly different AI literacy, inside a regulated utility where safety and auditability are paramount — stakeholder discovery found adoption stalled by three things: no standardization, redundant expensive experimentation across departments, and missing compliance audit trails.

The design answer was **progressive adoption**: one adaptive flow that meets novices and practitioners where they are. Governance and prompt-audit machinery is learned incrementally — often invisibly, as users engage. Adoption anxiety falls, enterprise performance rises, and compute spend falls naturally with task efficiency. The economics are behavioral, and they are exact: **fun saves money; frustration doubles compute.** AI-native interfaces must therefore train progressively, anticipating where complex tasks create massive overhead — not merely perform the job.

This repository — an Interactive Design System (IDS) — thesis made executable: a deterministic shell so no user is ever stranded; a role-filtered trusted catalog so capability scales with responsibility; governance metadata riding inside every prompt package.


## Adendum for where developers fit into this paradigm:

The Shift from Slop to Primitives: Instead of writing repetitive ticket boilerplate or babysitting fragmented AI output, engineers shift to operating at a deep craft level. Code is introduced to the system similar to how UI componentsd.   

Building Hand-Crafted Repositories: Engineers author foundational, hand-crafted code blocks—such as custom functionality, high-performance logic, novel behaviors or just higly oiptimized curated simple code libraries that the AI cannot reliably guess or optimize from old training data—and package them into clean repositories. 
This method allows the code base observability for performance and security.

Deterministic System Integration: Rather than guessing, the deterministic AI and design system calls these specific, pre-vetted code sets to pair directly with the corresponding design components.   

## Elevated Collaboration: This aligns engineers and designers as equal craftspeople, where engineers provide the precision modules and designers orchestrate the system through a clean, verifiable pipeline.
---
---

*This document practices what it preaches: every historical claim above links to a ledger entry with live evidence. *
