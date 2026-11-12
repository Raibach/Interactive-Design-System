# FIGMA INGEST — working notes (AI re-orientation; not for human reading)

## Source of truth: existing plans under design/plans-docs/

- 01-INGEST.md — ingest BUILT, 5/5 steps (2026-11-03). Includes the chat's
  missing-face conversation with two buttons: "Use the system's face" /
  "Ask for it to be added" (writes a `design_requests` row via
  POST /api/design/requests). This is the existing chat-presents-buttons
  pattern to reuse.
- 02-APPROVALS.md — built: 1 (action rows), 2 (address to person), 3
  (review surface, `rooms/design/review/design-review-view.ts` +
  GET /api/design/reviews), 4 (approve/changes, POST /design/review),
  7 (queue: `design_requests`, three endpoints). REMAINING: 5 (final
  approval writes the catalogue — only this gate writes), 6 (pending
  replacement: change to an approved component becomes the same name,
  marked pending; approving replaces), 8 (running log), 9 (ingest trace
  in the approval record), 10 (chat asks after the trace: approve anyway
  / make corrections), 11 (people + sign-in, one user per person).
- 03-CATALOGUES.md — two real catalogues on disk: prompt-composer (73
  components) and carbon (58). Stub rows retired (built). Remaining:
  registry per catalogue, selector/tree.
- 06-CARDS-AND-CONSOLE.md — card = `prompt_sessions` row; console reads
  rows; action = a row. Sharing/reassignment (step 5) not built.

## Goal

Ingest a new text input (inner shadow), overwrite the existing one (drop
shadow) in the Composer section, add a PostHog tag to it, and drive the
whole flow from the chat. The chat PRESENTS the interactive elements:
buttons ("do you want to do this?"), input fields ("enter your text"),
lists of predefined tags. Not buttonless — chat-offered.

## Code map (verified)

- ingest: POST /api/catalog/ingest (backend/routes/figma.py:126) —
  design-system zip (system.json + components.json) becomes a walled-off
  partition of `draft:false` proposals.
- preview: GET /api/figma/spec/{file_key}/{node_id} (figma.py:597);
  GET /api/figma/steps/{op_id} (figma.py:747).
- accept: POST /api/catalog/{system}/accept (figma.py:313) — flips
  `draft:true`, writes `accepted:{at,by}`; response "placeable now —
  the room's palette reads this marker". Library (left column) reads
  `draft:true`.
- overwrite identity: node id component part = everything before the
  LAST `;` (figma.py:390-413); the occurrence part after is location.
- Composer text input: frontend/src/components/lit/prompt-input/ and
  frontend/src/components/lit/chat-input.ts.
- chat approve signal exists: chat-tab.ts `a2ui:run-approved` (1028),
  `_pendingRun: 'asked'|'approved'` (1011), Approve rail pulse (565).

## Gaps (what the goal needs, mapped to existing plans)

1. catalogue write + pending replacement — 02-APPROVALS steps 5, 6,
   NOT built. This is the overwrite.
2. chat question after the trace — 02-APPROVALS step 10, NOT built.
   But the chat-buttons pattern EXISTS (01-INGEST missing-face).
3. PostHog tag — NOT in any plan. Tag = predefined metric from
   `element_metrics_vocabulary.py`; attach point (catalog entry /
   tag-registry.ts / registry.json) unknown. Must flow to the capture
   door so the A2UI action stream measures the component.
4. people + sign-in — 02-APPROVALS step 11, NOT built. Multi-user.

## Next on return

1. Live-verify: ingest → preview → accept → library (each step against
   the running app; record file + line + what it writes).
2. Trace the overwrite: same-name accept + the catalogue write path.
3. Decide the tag attach point.
4. Design the chat flow per step (button/input/list), reusing
   `a2ui:run-approved` and the 01-INGEST button pattern.

## Changelog on completion

- Record finished pieces in design/CHANGELOG.md.
