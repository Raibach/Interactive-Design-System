# Plan — AI-Native Compliance: Remove the Fake Fallbacks, Feed the Real Numbers

Owner, 2026-11-06. The application will be reviewed by people reading the code and pressing
the screen. Everything this plan removes is something a reviewer would find and read as
deception. Everything this plan adds is data the application already holds, shown where the
screen now shows a made-up line.

Scope, stated once: the A2UI claim covers the design section's own assembly — the surface
the model composes from the catalog and the renderer draws. Product, Development,
Governance, and the UX application inside Design are applications, and are not claimed as
A2UI anywhere. That line is kept.

---

## 1. The fake status line — what it was, and what it must become

The line at the top of every tab — "Analyzing: Session 222 | support Customer Session
Duration: 28.495s | Closed QA: 89.38% | Sample text" — is a fallback drawn when nothing is
fed. Its source is `frontend/src/components/lit/output-header.ts`, line 206. The words came
from the wireframe mock of a support platform's status bar (the Figma node the design
imported); they were meant to be the live readout of the running session: which session,
how long it has run, its quality score, the tokens spent, and the calls made. They were
sample values in a drawing, and they are now the live screen.

The intended behavior, which the code's own notes already describe, is that a bar with no
real facts draws nothing. The fix is two parts:

1. Delete the hardcoded fallback in `output-header.ts`. An empty feed draws no bar.
2. Feed the design tabs their real facts, from the Governance application's session
   records — the Langfuse-filtered store the Governance room already queries, served
   through `backend/governance_lanes.py` and `/api/governance/sessions`. The header's
   lead figures are the section's lifetime totals, as the owner chose: total tokens
   across all recorded time (the store's input and output sums), total calls, total
   cost, and the number of sessions — the honest wording being "since recording began."
   Beside them stand the section's last session (its name, how long it ran, its tokens,
   its calls, its cost, when it was last seen) and the conversation's own facts (its
   name, its message count, when it was last saved). The quality slot shows the
   section's real evaluation when one exists — the governance evaluators' recorded
   score — and shows nothing when it does not. No number is ever invented; where a
   section has no records, the honest reading is no bar, not zeros dressed as
   telemetry.

This is one step, verified on the page: the fake line is gone, and a real line stands in
its place, or no line stands at all.

## 2. The empty feeds that made the fake line appear

The same empty feeds show "Tokens: 0 | Calls: 0" beside the fake line. They are the other
half of step 1: once the header is fed from the governance records, both halves are real.
Where a section has no usage yet, the honest reading is nothing, not zeros dressed as
telemetry.

## 3. The leaked source text in the Tools log

The Tools tab's log area renders a piece of the program's own source code as if it were
content — the text beginning with `@send-input-to-model=...` in the thread area. It is a
drawing defect, and it reads as breakage to anyone who sees it. The fix is in the tools
chat's log drawing, and it is verified by opening Tools and reading the window.

## 4. The error-swallowing blocks — the hidden deception

Four files that serve the design section still catch failures and dress them up:
`backend/routes/design_console.py`, `backend/conversation_api.py`,
`backend/prompt_sessions_api.py`, and `backend/routes/ux_chat.py` — between sixteen and
thirty-three caught-error blocks each. This is the suppression pattern the owner's own
rules forbid, and a code review looks for exactly this. The work goes one file at a time:
every catch that formats a failure into a friendly string is removed, and the failure is
allowed to surface. Each file is verified by running it, not by reading it.

## 5. The model-driven assembly — verify it is clean, then say so

The design section's page assembly is genuinely model-driven: the server asks the model,
parses its answer, and refuses loudly on failure (`backend/routes/design_console.py`,
lines 551–720). This step verifies, on the running site, that no part of that chain was
replaced by a fixed answer: the model's response is what is rendered, the components it
names are checked against the catalog, and a failure is a refusal, not a substitute page.
The result is written into the README as fact, with the file and line where each claim
lives, so a reviewer can confirm it in minutes.

## 6. The README — a summary again, not a change log

The first section of the README grew into a long conversation and dated log entries. It is
the section everyone reads, and it must return to being a high-level overview: what has
been built, in one page. The rewrite keeps four short parts — the architecture in plain
terms, what is genuinely model-driven and where it lives, what is governed composition
with the catalog audit, and the honest demo declarations (the sign-in door, and the
embedded analytics product inside the UX tab). The dated entries move to the bottom or to
their own file; they are history, not the front page.

## Order of work

1. Remove the fake status fallback and feed the real per-section facts from the governance
   records (steps 1 and 2 together — they are the same feed).
2. Fix the leaked source text in the Tools log (step 3).
3. Remove the caught-error blocks, one backend file at a time (step 4).
4. Verify the model-driven assembly end to end and record the proof (step 5).
5. Rewrite the README's first section (step 6).

Each step is completed and verified on the running page before the next begins, and each
step is one change in one place, so nothing is stripped out and nothing else is touched.
