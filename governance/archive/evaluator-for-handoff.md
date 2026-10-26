# EVALUATOR — FOR HANDOFF

The Evals section revamp: every direction the owner gave on 2026-10-17, the state of each,
and the build order. This is the plan a next session (or a next person) picks up.

## The process (owner's words)
- Keep a running ledger of directions — they are contextual and guide the build.
- Plan first, discuss, then build. No piecemeal coding while the spec is moving.

## Standing rules in force
- Never resize or force the browser; verify in the room at real size only.
- Never operate apps outside the program (governance :3100 only inside the room's frame).
- All chat padding 10px. Real receipts only (DOM/state/DB). No fake pictures, no fallbacks.

## Built and verified in the room
1. The evaluators index lives in GRACE'S OUTPUT under the Evals tab — not the middle.
2. Rules is a tab of that same index.
3. Middle never shows an unselected evaluator: instructions page (`/evals/new`) by default;
   selection opens that evaluator, EDITABLE; re-entry reopens a standing selection.
4. Her input box on the tab is the search — no model call, no chat turn on this tab.
5. No pagination, ever — lazy list (window 25; ~20 evaluators max).
6. Struck from her output: filter facets, search instruction, My Views, Columns, sort chip,
   title, tabs, counts.
7. Model / Created by / Updated at hidden from rows (payload keeps them).
8. Order: newest created first; most critical (Blocked) overrides new.
9. Backend route `GET /api/governance/evaluators` — read-only psycopg2 against the app's own
   Postgres (`GOVERNANCE_DB_URL` in backend/.env, 127.0.0.1:5433). Real data verified.

## Code done, not yet visible / not yet verified
10. App detail top bar: View executions + Clone relocated in (needs the governance web rebuild).
11. `evals-column.ts` — the section's own Grace column: list only / bottom toggle + add /
    restricted query input ("not a chat interface — a model driven query"). Mounted in the
    Evals tab by WritingAreaIndex; add answers to `/evals/new` (evaluators) or `/evals/rules`.
12. `evals-index.ts` — list-only rows; mode bound; no navigation inside the output.

## Still to build
- P1 finish: verify the mounted column in the room (reload → Governance → Evals).
- P1 layout: two states — console-type (big area = instructions + Grace right, expanded) and
  the composer's `workspace-layout` THREE-COLUMN flex, equal on load, after a selection.
  Use the existing layout/catalog structure; do not reinvent; no overlay.
- P1 header (planned): model-output facts for the selected model + default-model bar.
- P1 creation: Langfuse's normal setup in the middle; on save the new evaluator pops into her
  list (newest first) and the middle returns to the instructions page.
- P2 (pinned): silent model-driven re-sort — "newest"/"resort" in the query box; the model
  applies it without a chat reply. Until then the text narrows the list.
- P3: remove the row actions menu (View scores/View executions/Edit/Clone/Delete), My Views,
  Columns picker, search instruction, pagination from the app's two v2 list pages; keep the
  top bar (Rules · Add alert · View executions · Clone · Version history · Delete). ONE fork
  change, ONE governance web rebuild, verified in the room.
- P4 (owner's hand): styling pass over the owner's mockup; mobile layout of the section is the
  index's styling base. Eventual card-console layout in the middle — later, not now.

## Open flags
- The section-introduction announce fires on entry and lands in the Chat thread (invisible on
  this tab) — keep or cut.
- All of this is LOCAL. Nothing pushed to the box; the box needs its own rebuild + data.
