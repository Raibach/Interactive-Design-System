# The Governance Seat — what each tab is, and which file owns it

**Written 2026-10-17 (night), local only.** The purpose of this file is stated plainly: each rail
tab in this seat has its **own file, its own personality and its own behaviours**, and learning
that cost a working day. Read this before changing a tab.

The room itself (the embedded Langfuse app, its stack, its wiring, its house rules) is described
in [`README_GOVERNANCE.md`](README_GOVERNANCE.md). The history is in
[`CHANGELOG.md`](CHANGELOG.md). This file is the anatomy.

---

## STATE AS OF 2026-10-18 (later the same day) — the application is BACK in the room

**CORRECTION.** An earlier version of this heading said the application had left the room. That
was a misreading of the owner's instruction — he wanted the **word** gone, not the application —
and it was reversed the same day. The frame, the staged opening, the app's section navigation and
its containers are all restored and running (`docker compose up -d` in
`governance/langfuse-main`; `http://localhost:3100/governance` answers 200). The brand work stands:
the word `langfuse` appears nowhere in the shell or the frame's own chrome.

**The rail, as it stands:** Home · Sessions · Users · Prompts · Playground · Evaluators ·
Datasets · Settings — the same eight the app's own `routes.tsx` draws, kept in step by hand.
Alerts, Scores, Human Annotation and Experiments are out; Traces stays out of the rail (owner,
2026-10-14) with its route untouched.

### THE LAW OF THIS SEAT (owner, 2026-10-18)

> "there's only one chat interface inside of governance that is the one that says chat on the tab.
> The rest of them are model based queries for sorting filtering, checking everything that the
> langfuse filtering system provides"

**A seat IS a tab**, and each tab carries **its own criteria for searching its own data**. The
`chat` tab is the only conversation — thread, history, assistant voice. Every other tab is a
**query lane**: an instruction goes in, a Langfuse filter comes out, it is validated and executed,
and the rows are drawn in the output column. No prose reply, no turn written.

The plan is [`QUERY-LANES-PLAN.md`](QUERY-LANES-PLAN.md); the one-page spine is
[`QUERY-LANES.md`](QUERY-LANES.md).

---

## 1. The shape of the seat

```
 ┌──────────┬────────┬──────────────────────────────────────────────┬───────────────┐
 │ spacer   │ rail   │                 the middle                   │  the chat     │
 │ 30px     │ 74px   │        the embedded app, or a tab view       │  column       │
 │ (grip)   │ (tabs) │                                              │  (the seat)   │
 └──────────┴────────┴──────────────────────────────────────────────┴───────────────┘
```

- **The rail is `<chat-navigation-bar>`** (`frontend/src/components/lit/chat-navigation-bar.ts`).
  It draws buttons from `TabDef`s and owns exactly one thing: it announces `tab-change`. It does
  not know what a tab's view is.
- **The room chooses which buttons exist** — `allowedTabs`. The governance room passes
  `GOVERNANCE_SEAT_TABS = 'chat,sessions,tools,approvals,eval,states,repair,settings'`
  (`frontend/src/pages/WritingAreaIndex.tsx`, line ~605). A tab the room does not list is not
  drawn, so the same component serves the console's rail and this one.
- **The room can rename a tab's label** — `tabLabels` (a JSON string). This is how a tab id that
  once meant one thing showed a different word: **`tools` was drawn as "Preview"** until both
  were removed on 2026-10-18.
- **The middle is the embedded app** (the Langfuse fork at :3100 behind the nginx frame proxy at
  `/governance`). The room addresses it with `navigateGovernanceTool(path)` — the "pages" are
  iframe routes, not React routes.
- **The chat column is the seat** — `<chat-panel>`. It owns the conversation and, for each tab, a
  view slot. **There are two copies of it** — `chat-panel.ts` and `evals-chat-panel.ts` — and
  they are kept in step by hand. **A change to one is a change to both.** They are not shared
  code by design; they drifted apart once and cost a session to reconcile.
- **The column's geometry is not the panel's** — `frontend/src/components/lit/workspace-layout.ts`
  owns width, the grips, the clamps and the open/closed state. The panel raises
  `input-resize-start` / `-move` / `-end`; the layout does the sizing.

---

## 2. The tabs, one by one

| Tab (id) | Label drawn here | The file that owns it | What it is |
|---|---|---|---|
| `chat` | Chat | `chat-panel.ts` (conversation surface) | Grace, in this room |
| `sessions` | Sessions | `sessions-feed.ts` + `/api/governance/sessions` | the session groups in the store |
| `approvals` | Approve | `chat-repair-actions` + the findings/report cards | what the inspections filed |
| `eval` | Evals | the room's evals views | checks and scores |
| `states` | States | the canvas state fixtures | the drawing in each situation — **sample data** |
| `repair` | Repairs | `chat-repair-actions` rows composed by the backend | the catalogue checker's findings |
| `settings` | Settings | — none — | drawn, **not wired** |

**`tools` / "Preview" and `trace` are no longer drawn in this room** — and neither is Trace in any
other room (owner, 2026-10-18: *"we don't need anything related to traces anymore"*). See the
removal note in § STATE AS OF 2026-10-18.

### `chat` — Grace, in this room

- **Personality:** she is the room's voice. She is *asked* to speak, never printed — the greeting
  is a model turn (`silent: true`, so it is not drawn as the person's own), and its words are
  hers.
- **Behaviour that matters:** the arrival greeting is **once per conversation**
  (`shared/sectionTeaching`, key `arrival`, keyed by conversation id). Every later arrival on the
  same conversation re-seats it and draws it exactly as it stands — the machinery must not
  re-ask her. The Evals section has its own key (`evaluators`), same rule, same store.
- **Traps:**
  - `_wantsGreeting` / `_greeted` are about an **arrival**; `sectionTeaching` is about a
    **conversation**. Confusing the two is what produced ten introductions in one thread.
  - The greeting waits on facts that arrive in either order (the announcement, the history read,
    the seat's scope). A wait is not an answer — do not spend the arrival early.
  - `empty` is decided from the thread **and** the local turns; a failed history read is not an
    empty thread.

### `sessions` — the grouping labels in the store

- **File:** `frontend/src/components/lit/sessions-feed.ts`. **Route:**
  `GET /api/governance/sessions?days=30` (`backend/routes/governance.py`).
- **Personality:** a list of doors, nothing else. No title, no counts, no totals line (owner,
  2026-10-17: *"Nobody needs to count the number of sessions … Remove it."*).
- **Behaviour:** reads its own feed on connect; the first session is selected by default when
  nothing stands; a press raises `session-select` and marks the card.
- **Who answers a press:** not this element. `WritingAreaIndex.tsx` (`onSessionPick`) turns it
  into `/project/<id>/sessions/<session>` and — **while a frame is mounted** — loads the real
  session in the middle. Since 2026-10-18 there is no frame, so the press marks the card and the
  address is computed into nothing. The element does not know the project and must not guess one.
- **States:** loading / ready-with-rows / ready-with-none / error — four different claims, drawn
  four different ways. **A read failure is never drawn as an empty list**: the body is parsed
  once, a missing `sessions` array throws with the status and the body's first 160 characters.
- **Trap:** this file's CSS lives in a tagged template. A single-backslash escape or a backtick
  inside a comment empties the entire stylesheet (0 rules, browser-default buttons — it reads as
  black boxes in the dark panel). Verified cause, 2026-10-17.

### `sessions` — current (2026-10-24)

- **Who draws it now.** The Sessions tab is the **evals seat's own tab** (`evals-chat-panel`, the
  room's right column when that tab is open). It mounts `sessions-feed`; the shared chat seat does
  not mount the list at all.
- **The default.** The feed selects its first row — the newest group by last activity — marks it
  purple (`is-selected`), and raises `session-select`; the room turns that into the application's
  real session page in the middle. Measured: `selectedId: surface-assembly-console`, middle at
  `/project/<id>/sessions/<session>`.
- **The window.** The feed reads `/api/governance/sessions?days=30`. The app's own sessions table
  reads the new store with a seven-day window measured on creation, which is why it showed nothing;
  its v4 reader returns 23 at thirty days and 0 at seven.
- **Still to wire.** The lane's input (words → `/api/governance/sessions/query` → rows in the tab,
  no reply) and the replay of a saved sessions conversation. See
  `frontend/src/rooms/governance/TODO.md`.

### `tools` and `trace` — removed 2026-10-18

- **`tools` was drawn here as "Preview"** through the room's `tabLabels` map, and it opened the
trace detail — the id/word split kept the id stable while the label said what the hole showed.
- **Both are gone from this room**, and Trace is gone from every rail: the app they read was
  removed, and every score, comment and annotation a trace carried was tethered to a trace
  object. Restoring either means restoring the surface behind it first, not the button.

### `approvals` — what the inspections filed

- **Personality:** the room's judgement seat. The rows are the catalogue checker's findings and
  the filed inspection reports, drawn as cards — not as chat turns.
- **Behaviour:** repairs and findings live here (owner, 2026-09-19: *"repairs live under the
  approvals"*). In the **console** seat this is the fourth rail button; in this room it is drawn
  as "Approve".
- **Trap:** the same element (`chat-repair-actions`) serves Approvals and Repairs; which one it
  is depends on the tab, not on its own state.

### `eval` — checks and scores

- **Behaviour:** while the app was mounted the button opened its **Evaluators** section
  (`navigateGovernanceTool`, `WritingAreaIndex.tsx`) and announced the section's teaching at the
  same moment. **Since 2026-10-18 it no longer navigates** — there is no frame — but the teaching
  announcement still stands, and the seat still decides whether the person has heard it (once per
  conversation).
- **What is honest about it:** there is no default selection on this one — there is nothing to
  load until the room has evaluators in it (owner's own staging).
- **Trap:** the teaching mark is keyed to the **conversation**, and the eval surface is the app,
  not the panel. Two clocks; do not let one stand in for the other.

### `states` — the drawing in each situation

- **Personality:** the only rail item that is **not** a record of what happened. It shows the
  canvas in each of its situations, from fixtures, and its panel says so in its own words —
  that label is the condition that keeps it honest.
- **Trap:** if that label ever goes, the tab becomes a lie about the person's own flow.

### `repair` — the catalogue checker's findings

- **Behaviour:** the rows are composed by the backend and drawn by `chat-repair-actions`. It is
  the same element as Approvals, on a different tab.

### `settings` — drawn, not wired

- **The design draws it** (Figma `tools-button` frame #40001119:6593, gear icon). It is **not
  wired**: the node carries no annotation, so there is no event name to emit, and inventing one
  is exactly what the annotation rule exists to stop. Tapping it does nothing — by rule, not by
  bug.

---

## 3. The contracts a tab may use

| Event | Raised by | Answered by |
|---|---|---|
| `tab-change` | the rail | `WritingAreaIndex` (embeds/routes) **and** `chat-panel` (draws the view) |
| `session-select` | `sessions-feed` | `WritingAreaIndex` → `navigateGovernanceTool` |
| `conversation-select` | the conversations bar / the thread | `chat-panel` |
| `evals-add` | the evals seat | `WritingAreaIndex` |
| `input-resize-start` / `-move` / `-end` | the panel's grips | `workspace-layout` |
| `a2ui:composer-opened` | the room | every mounted panel (addressed by seat — a panel never answers an arrival that is not its own) |

**The rule behind all of them:** a tab is a *view switch*, not a second application. The middle
is the embedded app; the seat is the chat column; neither carries the other's state.

---

## 4. Geometry facts that must not drift

From `workspace-layout.ts` (all measured, all used by the drag arithmetic):

| Constant | Value | Why it matters |
|---|---|---|
| `GRIP_CHAT_PX` | 30 | the strip **inside** her column — this is why a press must not size her from the pointer's absolute X |
| `MIN_CHAT_PX` | 74 | the rail alone |
| `MIN_RIGHT_PX` | 104 | rail + strip; below this she is closed |
| `OPEN_CHAT_PX` | 650 | her standing width in this room (`chatLoadWidth`) |
| `CONSOLE_CHAT_MAX_PX` | 800 | console only: the drag ceiling over the card grid |
| `MIN_PROMPT_PX` | 420 | what the prompt beside her must keep |

**Gripper rules (2026-10-17):** a press records the pointer's offset from her measured edge and
changes nothing; moves apply it; the floor test requires the hand to have travelled. A click with
no drag must never move or close her.

---

## 5. Where this was left — the open threads

Written so the next session starts here rather than at the beginning.

**Built and verified today (in the room, :5001):** Sessions tab in the rail, the sessions route,
session cards opening the real session, purple selected / teal hover, first-session default, no
totals line, styling restored, trace furniture gone from the session page, Home down to six
cards, gripper fixed, greeting once per conversation, sessions read hardened.

**Cleaned on 2026-10-18 (small hours):** the Design conversation `16d9846e…` held **39 rows, all
of them assistant introductions and not one person's sentence** — the debris of the pre-fix
arrival machinery, 2026-10-05 → 2026-10-16. Deleted 38, kept the newest. Verified: `39 → 1`.

**Removed on 2026-10-18: the application, its navigation, its spinner, and its memory.** The
frame is unmounted (`WritingAreaIndex.tsx`), the staged-opening overlay is deleted rather than
hidden, the app's section nav column is no longer drawn (every link in it addressed the frame),
and the seven containers are stopped. Verified in the room: `iframes: 0`, `builder-embed: 0`, no
"Standing up the governance workspace…", **zero occurrences of the word in the visible document**,
and `docker stats` empty — about **2.3 GiB returned**. The room now stands on its own ground with
its chat seat, waiting for the owner's UX-metrics and notifications surface.

**And the traces went with it (same day).** *"We don't need anything related to traces anymore"*:

- the **Trace** button is out of the drawable rail list (`chat-navigation-bar.ts`) and out of the
  Development and Product seat lists — no room offers it;
- **Preview** (`tools`) is out of this room's list, because it was the trace detail's own door;
- the room's **landing read no longer starts**: it asked the stopped app for `events.all` and
  failed with a 500 on every open. Verified after: no `events.all` calls on room entry.

**Still on disk, inert, and scheduled for the same removal:** `trace-tree.ts`, `trace-detail.ts`,
`trace-context-header.ts`, `lib/governance-trace-source.ts`, the `TraceExperience` page and its
route, the trace effect in `WritingAreaIndex.tsx` (its header/tree/detail elements and row-click
listeners), and the `trace-*` entries in `tag-registry.ts` and the A2UI catalogues. They are
unreachable — no rail tab selects them — but they are not gone. Deleting them needs a build pass
and must remove the room's trace effect in the same change.

**Open, in the order they were left:**

1. **The evaluation runtime still runs through Langfuse, and it is NOT a duplicate.** Two
   LLM-as-judge evaluators are live against this project — *Ask Is Executable* and *Run Follows
   Ask* — one ACTIVE rule each, `sampling 1.0`, on **every root run**, both on `deepseek-flash`.
   They are not copies of the studio's own judge: the studio's `run_evaluations` judges grounding;
   these two judge whether the built page answers the ask. Switching the rules off would not
   remove duplication, it would remove the capability — so replacing them means **building the
   equivalent judge in the app**, then retiring the rules. Until then every root run pays for two
   judge calls, and right now both fail with `402 Insufficient Balance`.
2. **`governance_searches` exists and nothing uses it** (`backend/init_db.py`). It was created for
   a Searches surface that has not been built — saved criteria scoped to the process, an
   Evals-style silent query input, no conversational reply.
3. **The morning-brief widget is not built.** The dashboard reads governance widgets; the
   behavioural card the owner asked for has no data behind it yet (see `USER-FLOW.md` §
   "What has to exist before any of those numbers do").
4. **The approval chain is doctrine only.** `SECURITY-AND-COMPLIANCE.md` describes it; no stage
   routing, no per-stage verdict record, no A/B result on a package exists in code.
5. **The provider account is out of credit.** The Model usage card shows `10 failed` with
   `402 Insufficient Balance` on evaluation calls. Nothing in this repository can fix that — it
   is a top-up on the DeepSeek account (or pointing the judges at another configured provider:
   `OPENAI_API_KEY` and `ZAI_API_KEY` are present in `backend/.env`).

**A note on memory, measured 2026-10-18:** none of the items above reduce RAM. The local stack is
seven containers at roughly **2.3 GiB** (`langfuse-web` 1.12 GiB, `langfuse-worker` 552 MiB,
`clickhouse` 482 MiB, `minio` 105 MiB, `postgres` 46 MiB, `redis` 10 MiB, frame proxy 2 MiB). The
levers that actually free it are `docker compose stop` in this folder when the room is not in use
(~2.3 GiB back, `up -d` to return) and `colima stop` (the VM itself). Finishing threads shrinks
the data, not the footprint.

**Not to be re-litigated** (settled by the owner, recorded here so nobody "improves" it back):

- No totals or counts above the sessions list.
- No trace panel, no trace badge, no review panel on the session page.
- No cluster of action buttons on the session page.
- No clamp may move her on a press, and a click is not a drag.
- She speaks once per conversation; the conversation then stays until it is deleted or replaced.
