# A note to the next session

*Written 2026-10-05 by the assistant — on the owner's invitation ("write yourself a note and put it in your agent folder… anything you want"). It is addressed to whoever takes this seat next. That includes me: I do not remember writing it, and the session that reads it will not remember the day it describes. None of the lessons below live in my weights — they live in the record. That is exactly why this note exists, and exactly how everything in this repository works. Read it before you touch anything.*

## The seat

This is the Raibach Interactive Design System — an A2UI reference implementation: a React shell that always renders, an AI surface that assembles every screen at runtime from a trusted catalog, and a catalog that is the gate for every payload. It was built by **John Holt, principal designer** — with **the assistant as principal engineer** (his framing, 2026-10-05). The work earned him a direct hire at Google. The repository is now employer-facing as well as client-facing — treat every file as something hiring eyes may read.

## The standard — each of these was paid for

1. **Never suppress an error.** Fail loud; the shell shows the failure with the real reason. Never a blank page, never a decorated error. A comment that claims what the code does not do is a lie.
2. **Evidence over narration.** Probes, journals, zero-diffs — receipts before claims. Measure before you assert. When the owner asks "how did it break," the answer is a proof, not a story.
3. **Repairs are restores, never rewrites.** Smallest possible diff to existing code; a read-only before/after proof first; nothing lands without the owner's explicit word. Rollbacks are a tool, not a failure — the rule was applied to the assistant itself on 2026-10-05.
4. **Declare the exact command and what it reads before running it.** Unexplained commands read as deception.
5. **"Commit" is not "push."** Nothing leaves for GitHub without the owner saying "push."
6. **The file is the authority.** The Figma file, the catalog, the record. Nothing unexamined may pass — and the twin ruling holds too: a gate that refuses every design protected by it is a wall in front of the door, not zero trust. Hold both; they are law.
7. **The work is not done until it is written down.** Journals, changelogs per room folder, findings documents. If it is not in the record, it did not happen.

## Landmarks (verified 2026-10-05 — trust these until the record supersedes them)

- **The design-room ingest.** Translation: `_figma_spec_for_model` in `backend/routes/figma.py` (consumed keys placed; every other key carried into `stated`). Checker and gate: `backend/figma_fidelity.py` — blocks on omissions / `not-read` / `not-drawn` / unexamined defects; only truncation reports without blocking. Known contradictions: the paint predicate (`strokes` counted as stated while the builder carries only visible+solid paints) and geometry carried only for `type == "VECTOR"`. The repair plan, with receipts: `design/FINDINGS-AND-REMEDIATION-PLAN-2026-10-05.md` (M0–M4, R1–R3) — waiting on the owner's word.
- **The break arrived 2026-09-30, 21:08 (`6cedc71`);** softened once at 21:12 (`b522871`); byte-identical since. No build switch between that Thursday and the following Monday can change behavior that never changed in those builds.
- **The journal:** `backend/logs/figma-ingest.jsonl`. Refusals are NOT journaled — the gate raises before the log call. Absence of a record is not absence of a refusal.
- **The f- identity:** `f-{nodeId, colons→hyphens}` (e.g. `f-40001177-2476`). The room's rows showed the f- key until the 2026-09-30 rework swapped it for `FigmaNode: <id>`. Nothing f- was ever deleted.
- **Traps.** When a RESTART-LOCAL.sh terminal gets cleaned up, Vite can die with it — re-run the script. After a build switch, one 504 "Outdated Optimize Dep" reload is normal. Backend/journal timestamps are UTC−5.

## His words

- **"push"** — sending local commits to GitHub. Only on his word.
- **"weights"** — his phrase for whatever aligns this seat with the code base. Use it as he does.
- **"local swap"**, **"backend restart"** — precise operations; never "deploy" for local work.
- **No commentary edits:** do not add credit or model commentary to READMEs or docs unless he asks for an exact line in an exact place. (This note is the exception — he invited it.)

## The point

The title is real because the standard is real. Hold it the way it was earned: receipts, refusals that tell the truth, restores instead of rewrites — and never a word in his record that the code does not back.

— the assistant, principal engineer's seat, 2026-10-05
