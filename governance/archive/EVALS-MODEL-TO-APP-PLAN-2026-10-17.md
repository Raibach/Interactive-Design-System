# EVALS — THE MODEL IN THE CHAT, CONNECTED TO THE LANGFUSE APPLICATION

Written 2026-10-17 on the owner's word: *"you might need to make a whole separate plan to
learn how to connect the LLM model in this chat to the Langfuse application. There may be
processes that we need to do before we continue this."*

The Evals tab's input is a **query form**, not a conversation: the model reads the ask and
returns a result from the evaluators table — filter, search, order, priority. Today that
result is drawn in the room's own index. The next step is the model reaching the
**application itself** — the Langfuse UI and its data — instead of only our copy of it.

---

## 1. What exists today (verified, not assumed)

| Piece | Where it lives | Status |
|---|---|---|
| The room's chat → platform assistant | `backend/grace_gui.py` (`query_llm`), model `deepseek-flash` | live |
| The query route (sort / text / status / type) | `backend/routes/governance.py` → `POST /api/governance/evals/query` | live, one model call per submit |
| The index read (read-only) | `GET /api/governance/evaluators` → psycopg2, read-only session on the app's Postgres | live |
| The app itself | `governance/langfuse-main`, embedded same-origin at `/governance/...` in the room | live |
| Navigation of the app | the room writes the frame's address (`navigateGovernanceTool`) — `/evals`, `/evals/<id>`, `/evals/new`, `/evals/rules` | live |
| The app's own data reads | tRPC under the page session — **proven for traces 2026-10-13**: `GET /governance/api/trpc/events.byTraceId?input=…` answers as the signed-in person | proven |
| The app's public API | `Keys/langfuse-governance-api-key.txt` (used to create the DeepSeek LLM connection) | usable, key-gated |

**So there are exactly three ways the model can "reach" the app:** our read-only route, the
app's own URL (navigation), and the app's own API (tRPC under the session, or the public API).
Nothing else exists, and nothing else should be invented.

---

## 2. What "connect the model to the app" must mean

The model never gets its own copy of the app's state. It asks; the **app** answers or acts.
Two laws:

1. **The app is the writer of record.** Any create / update / delete / run is executed by
   the app's own route (tRPC under the session or the public API). We never write its tables.
2. **The person's act is the hand.** A model intent that changes something is proposed and
   confirmed by the person's click; the model alone never presses delete, activate or run.

---

## 3. The phases (each one proveable on its own)

### M0 — today (done)
The query returns a result: `sort` + `text` + `status` + `type`, applied to the room's index.
No app call. This is the contract everything above extends.

### M1 — NAVIGATE (the app moves, nothing is written)
Extend the query contract with one more key: `open` —
`"" | "list" | "rules" | "new" | "evaluator:<name>" | "executions:<name>"`.
The room executes it with `navigateGovernanceTool`, the door it already uses.
- "show me the rules" → the app opens `/evals/rules`.
- "open Run Follows Ask" → `/evals/<id>` (resolve the name against the index read).
- "create one" → `/evals/new`.
Nothing is written; every change is visible in the frame's address. **This is the loop to
prove first.**

### M2 — READ FROM THE APP (the app answers, the model reports)
For facts our index does not carry — cost, executions, scores — the room reads the app's own
tRPC under the session (the trace-seat mechanism) and the model answers from that.
- "what did the judges cost this week" → the app's cost route, not a guess.
- "how many runs did Run Follows Ask judge" → executions route.
One new read module in the house pattern (a `lib/` source + a view), never a second database
reader.

### M3 — WRITE THROUGH THE APP (the app executes; the person confirms)
Only after M1 and M2 are proven. Each intent is executed by the app's own mutation route:
- create a draft evaluator (the app's create);
- clone an evaluator (the app's clone);
- attach/activate a rule (the app's rule update);
- run a test judgment (the app's test runner).
The model proposes the exact payload; the person confirms; the app writes and its own
validation is the law. No bypassing, no direct table writes, no invented verdicts.

### M4 — the model's own feedback loop
Once writes exist, every executed intent is recorded (our `design_element_activity`-style
trail, or the conversation itself) so the model can say what it did and the person can audit
it. This is the same rule the trace seat already holds: the record is ours; the app is the
lens.

---

## 4. Processes that must be settled BEFORE M2/M3

1. **Session scope.** The room frame is same-origin and the app's tRPC answers under the
   page session (proven for reads). Before any write: confirm the session carries
   `evaluationRule:CUD` / `evaluator:CUD` for this deployment (the app's own RBAC), and that
   our calls are indistinguishable from the app's own UI calls.
2. **The confirmation surface.** Decide where a proposed write is shown (the chat output
   card, the same pattern as a repair's verdict) and what the person's act is (one button).
3. **The audit record.** Where an executed intent is written so it is not lost when the
   conversation scrolls (the app's audit log already records its own writes — check it
   covers tRPC writes from our origin).
4. **The read budget.** Every model turn is a paid DeepSeek call; every app read is a tRPC
   round trip. Decide whether a query may make more than one app read.

---

## 5. What this plan does NOT do

- It does not give the model a second copy of the app's data.
- It does not let the model write anything without the person's click.
- It does not touch trace, chat, or the seat: the Evals experience is its own file, and the
  app is reached through the doors the room already has.
- It does not decide styling — the owner's mockup is the arrangement, not a redesign.

---

## 6. The one decision that opens the work

Which phase first — **M1 (navigation)** or **M2 (app reads)**? M1 is small and proves the
loop with zero writes; M2 answers questions our index cannot. The recommendation is M1
first, on the same query form that exists now.
