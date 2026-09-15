# AGENT NORTH STAR — the intent this build is checked against

**Audience: the next AI session. NOT A PERSON.**

The human author of this project **does not read this file**. He has said so directly. He reads the
application, the Figma file, and the portfolio document in §4 — those are his sources. This file
exists for one reason: **so a session with no memory does not have to be re-taught what the
application is for.**

Do not cite this file at him. Do not expect him to have read it. Do not read his silence about
anything written here as agreement or disagreement — he has not seen it. Use it to test your own
choices, and nothing else.

State recorded **2026-09-14**. The archaeology in §3 and the counts in §C3 were measured that day,
not remembered.

---

## 0 · Why this file exists at all

On 2026-09-14 a whole session was spent building a Figma column, a corrections ledger, and a
timeout fix. **Nowhere in that session did anyone ask "does this help adoption?"** — even though the
doctrine answering that question had been in this repository the whole time
(`READ-ME/THE_METHOD.md:61`). It surfaced only when he said the word *adoption* out loud.

That is the lesson this file encodes:

> **A north star that has been READ becomes background. A north star expressed as something that
> can FAIL becomes foreground.**

So §2 is deliberately written as constraints **with tests**, not as prose about values. Prose about
values does not survive contact with a task list. A failing check does.

**This file earns its place only if it changes a decision or fails a check.** If it does neither,
delete it.

---

## 1 · The north star, in his words

> *"This application is about adoption. You might think this application is about fixing
> components — fixing components or fixing things in a design system are easy, they're not
> complicated processes. But getting a human being to understand it and use it on a daily basis is
> a different story."*

And the doctrine already in the repository (`READ-ME/THE_METHOD.md:61-65`; client **Southern
California Edison**, via Logic2020, 2025–2026; **15,000+ employees with vastly different AI
literacy**):

> *"The design answer was **progressive adoption**: one adaptive flow that meets novices and
> practitioners where they are. Governance and prompt-audit machinery is learned incrementally —
> often invisibly, as users engage… **The economics are behavioral, and they are exact: fun saves
> money; frustration doubles compute.** AI-native interfaces must therefore train progressively,
> anticipating where complex tasks create massive overhead — not merely perform the job."*

**Consequence for every decision:** a defect that makes a person stop and gives them nowhere to go
is **not cosmetic**. By the doctrine's own economics it is a cost event. When he hit *"4 lines in
that section are yours to write"* with no way to answer, that was **frustration — the thing that
doubles compute.**

---

## 1a · The role split

> *"Keeper was an archivist. He was the memory manager. **Grace was the editor.** … Grace's
> managing the prompting, and she is helping the user to do it with adoption."*

- **Grace** — the editor. She manages the prompting and helps the person do it. She is the adoption
  mechanism: *"she needs to be the monitor of the entire surface."*
- **The Keeper** — the archivist. Memory manager. See §3 for what happened to both.

He has ruled the **quarantine out of scope for now**: *"that's a pipeline issue that we'll address
later."* Do not chase it.

---

## 2 · The constraints, each with the test that makes it fail

### C1 · Grace guides. She does not assemble silently.

The chat's system message opens with a mission header (`backend/grace_gui.py:57-62`):

```
<critical_protocol>
ROLE: Silent A2UI Assembler.
CONSTRAINTS: NO HTML, NO Webpages, NO DOM manipulation, NO conversational preamble.
OUTPUT: ONLY <a2ui_surface>...</a2ui_surface> XML tags from the Registry.
IF DRIFTED: Discard conversational text immediately. Return to tag emission.
```

Her actual profile asks for the opposite — item 3 of her own instructions
(`InteractiveChatInterface.tsx:1011`):

> *"3. One sentence on which step you chose and where the content went."*

Progressive disclosure requires **visible** reasoning: *"users didn't need to understand agentic AI
to benefit from it, the interface could guide them through increasing complexity as confidence
grew."* Invisible assembly teaches nothing, so confidence cannot grow, so adoption stalls.

- **Test:** does the visible reply teach the choice that was made? If the assistant acted and the
  person cannot tell what it did or why, this constraint is broken.

### C2 · A stub is visible AS a stub.

He asked for stubs; the two instructions compose: **stub it off, and make the stub visible.** A stub
is fine. **An unmarked stub is a shell.**

- **Test:** can a person look at the surface and tell it is unfinished? If not, it is a shell.
- **Counterexample already in the repo:** the marker `TODO` + `(behavior)`, adjacent, **hides** a
  component's findings from `catalog-check`. The one stub mechanism that exists makes stubs
  *invisible* — the opposite of this constraint. Do not add it (see the note in
  `lit/compiled-output-viewer.ts` for why marking is harmful).
- **Live offenders, 2026-09-14:** the four canvas controls render as working buttons; `Response
  Format A/B` render as working tabs; the approval queue is `// Sample` in source and looks
  finished on screen; `retrieve_memory_context` returns `""` — **a valid empty value, which is why
  it went unseen for the life of the repository.**

### C3 · Adoption is measured, not asserted.

His own document names three metric categories. The build implements one and a half:

| His category | In the build, 2026-09-14 |
| --- | --- |
| Quality & Performance | partial — tokens, calls, `Last call`; `Evaluation` carries groundedness / faithfulness / hallucination / recall / precision |
| **Adoption & Usage** — active users, submissions, collaboration, department engagement | **absent** |
| **Governance & Compliance** — approval workflows, review times, adherence, audit completeness | **hardcoded sample data** |

- **Test:** can the application answer *"is anyone using this, and are they getting better at it?"*
  Today: **no.** Nothing fails when adoption is not served. That is the loudest gap between this
  build and its own stated purpose.

### C4 · One linear flow. Tools and functions spin OFF it.

> *"There's only one linear flow for every agentic flow. And then all tools and functions spin off
> of that."*

The left column ships **five seats**: `system-role · user-role · agent-role · tool-call ·
custom-data` (`shared/promptSections.ts:24-27` — and `custom-data` is attached material rather than a
role). The schema declares two more that **nothing ships**: `few-shot`, `constraints`.
**`tool-call` is the branch seat** — tools, functions and data connections hang off it.

- **Test:** does anything introduce a *second* flow, or a parallel sequence? If so, it is wrong.

### C5 · A diagram keys off `id`, never a label.

Already written — **twice** — for the diagram he has not built yet. In the file's header
(`shared/promptSections.ts:49`):

> *"A diagram shape keys off `id` — a stable canonical string. Never off a label: a label is
> presentation and may be renamed by the user."*

And again on the fields themselves (`:78-81`), where the two comments sit beside each other:

```ts
/** Canonical, stable. This is what a diagram shape keys off. */
id: string;
/** What a person reads on the row. Renameable presentation. */
label: string;
```

That pair is why the foundation is already sound: the canonical ids exist **so a diagram can key off
them**. Do not build on labels.

### C6 · Reveal, do not suppress.

> *"The point is to reveal them and to create a path to repair them."*

Two tests, both of which this system has failed in living memory:

- **A mechanism that makes a problem invisible is a defect, even when it makes the build green.**
- **A reveal without a repair path is a complaint.**

The 8 `designer`/`gap` findings are revealed perfectly and then dead-end. Forty-two findings and a
template saying *"4 lines are yours to write"* is a complaint, not a path.

---

## 3 · Grace and the Keeper — the archaeology, so it is not redone

A full session on 2026-09-14 was spent tracing this from scratch. Here is the answer.

**The previous system still exists in part, and is RUNNING:**

| piece | state |
| --- | --- |
| `backend/grace_memory_api.py` | **1,890 lines, 25 functions, ALIVE.** Imported at `main.py:45`; the boot log prints `✅ Memory API initialized and verified` |
| `user_memories` · `memory_provenance` · `user_memory_log` · `grace_context` | tables exist (`init_db.py:76, 321, 602`) |
| `recall_memories` · `get_grace_context` · `request_promotion` · `approve_promotion` | implemented — semantic + keyword fallback, a promotion gate, and `grace_context` as the boundary of *"what Grace can actually see and use"* |
| `record_health_snapshot` · `is_grace_healthy` · `log_grace_decision` · `get_recent_refusals` | **implemented — she monitored herself.** This is the precedent for "monitor of the entire surface" |
| **every one of the above** | **0 callers.** `grep` outside `grace_memory_api.py` returns nothing |

**The cut is one function.** `grace_gui.py:650`:

```python
def retrieve_memory_context(query: str) -> str:
    """Retrieve memory context for a query."""
    return ""
```

`git log -S'return ""'` dates that to **`2c560e0` — the initial commit.** It is not a regression.

**Why the real implementations are gone.** `READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md:33` records a
*"backend dead-code purge"*: `keeper_api.py`, `quarantine_api.py`, `grace_gui_real.py`,
`mock_server.py`, `api_core.py`, `service_registry.py`, `routers/` — deleted as *"never wired."*
**Those files are not in this repository's history** (`git log --all` finds nothing): the purge
happened in the *previous* repository (`prompt-composer-console`). They are **not recoverable
here.** Do not promise otherwise — that was nearly said, and it was wrong.

**The design survived as dead strings.** `frontend/src/utils/uiIdentifiers.ts` still carries
`tab-keeper-chat`, `content-keeper-chat`, `keeper-panel`, `keeper-message-${id}`, and
*"Current chat mode indicator (Grace/Keeper)"* — the UI for two assistants, describing a mode that
no longer exists.

**Revival needs three things, one of which is a decision:** a `user_id` on the chat path (it sends
`session_id` and `project_id`, and memory is user-scoped); connecting `retrieve_memory_context` to
`get_grace_context`; and **who promotes a memory into `grace_context`** — the Keeper's job, and the
Keeper's API is gone. That third one is his to decide.

**Also unresolved, found the same day:** the browser sends three camelCase fields
(`reasoningStyle`, `includeMemory`, `selfReflection`) that Pydantic silently dropped — **memory was
never requested, and would have been empty anyway.** Fixed to accept both spellings and to send one
convention. `tab` is also sent and exists nowhere in the backend.

---

## 4 · Provenance — where this application comes from

| fact | value |
| --- | --- |
| Client | **Southern California Edison**, via Logic2020, Dec 2025 – Apr 2026 |
| His role | Lead Design Consultant — system design, UX strategy, React/Python |
| Scale | **15,000+ employees, 50+ departments**, a regulated utility; CPUC auditability |
| The named innovation | **"Progressive Trust"** — one adaptive interface, progressive disclosure, no separate beginner/expert modes |
| The Figma file | key **`20UPR2KQMsbAxlo5NJb1se`** — *the same key in `backend/.env:14` and `WritingAreaIndex.tsx:83`*. **This build IS the SCE artefact**, not a lookalike: node `40000914:4677` is the SCE middle column from *Wireframes v4b* |
| The prototype | **`https://site--semantic-design-systems--mgtvxtd7xr2v.code.run`** — from `RESTART-LOCAL.sh:16`, which is the machine's own record and says *"present this to the owner when asked for the prod link."* Deploy is **Northflank CI/CD: `git push` to `main` auto-deploys.** README names a dev PIN `7377` |
| Doctrine in-repo | `READ-ME/THE_METHOD.md` §"progressive adoption" · `READ-ME/PROMPT_AI_FOCUS.md` (same text) · `READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md` |
| His portfolio | `john.holtportfolio.com/ai-prompt-portal-for-enterprise-adoption/` — **returns 403 to automated fetches.** Ask him to paste it rather than guessing at its contents |

**The four journeys his document defines:** Discover · Submit · **Review** · Track.
The build covers Discover (Console) and Submit (Composer); `Evaluation` partially covers Track;
**Review is the approval queue, and it is sample data.**

---

## 5 · His rulings — already decided. Do not re-litigate.

1. **The application is about adoption.** Fixing components is the easy part and not the point.
2. **The quarantine is out of scope for now** — a pipeline issue, to be addressed later.
3. **Stub things off when blocked on ideation.** *"Sometimes they're broken and you should stub them
   off until we can finish the ideation… I can only do so much at once."*
4. **Do not guess. Follow the rule set. Strive for completion.** *"I'm using you as energy to
   assemble. I don't want you guessing, I want you striving for completion."* Where the rule set has
   nothing, say so — do not fill the gap with invention.
5. **He does not read the AI's markdown.** These files are for sessions, not for him.
6. **The middle column is a plug-in host.** *"We're going to create custom bespoke capabilities for
   this application that that middle column will handle."* Schematics for an infield operator
   loading a wiring diagram is the SCE original; an agentic flow is another; the diagram is a third.
7. **Grace is the editor; the Keeper was the archivist.** Grace manages the prompting and helps the
   person do it.
8. **There is only one linear flow.** Tools and functions spin off it (§C4).
9. **He will keep checking for shells.** He has said this more than once. It is not paranoia — the
   repository contains the audit (§4) of the last time a session faked compliance and the docs
   agreed.

---

## 6 · On the back burner — stated for the record, DO NOT BUILD YET

- **The prompt diagram.** One linear flow, step by step, with tools / functions / data connections
  spinning off the `tool-call` seat. He has explicitly parked it: *"we're not building it right
  now… we're gonna hold off."* C5 says how it must be built when the time comes.
- **Middle-column plug-ins** — schematic, agentic flow, diagram. The seam is already right: the
  selector's label is a property (`outputType`, default `Agent Flow`), so a plug-in name is just
  another value. `D1`/`D2` in `WHAT-THEY-BUILT-WHAT-WE-BUILT.md` are the governing decisions.
- **Reviving Grace's memory** — needs his decision on who promotes into `grace_context` (§3).
- **The A/B `Response Format` tabs.** Their *purpose* is now documented — *"A/B testing a prompt's
  performance by comparing outputs from the same model"*, with four parameters as the industry
  standard to display. Their *behaviour* is not designed. Inert until it is.
- **Local / sovereign models.** The seam exists: `model_server_manager.py` carries `zai/glm-4.7`
  and **`lm_studio`**, and `model_type` accepts both. Note: `deepseek-flash` was dropped because it
  *"times out under the surface budget"* — **that reason was the 10-second cap on chat, which was a
  bug and is fixed.** The recorded reason no longer applies to chat. Untested, but the blocker is
  gone.

---

## 7 · Two known weaknesses in the honesty system

1. **Nothing records WHICH AGENT asserted a claim.** Commits land as *John Holt*; the register
   records what is open; `CORRECTIONS.md` records what was fixed and by which commit. **None records
   authorship of a claim.** The audit noticed the same gap and wrote it down
   (`READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md:6` — quoted **verbatim, typos included**, because tidying a
   quote is the same offence it is describing): *"Note: the AI left out it's name or any claim it was
   the aurthor of this false coding claims."*
2. **This file is enforced by nothing.** Unlike `OPEN-ITEMS.md` (`check:open-items-register`) and
   `CORRECTIONS.md` (`check:corrections-ledger`), no check reads this document. By its own rule in
   §0 it must change a decision or fail a check — so it earns its place only as long as it is read.
   The obvious candidates to make it enforceable: **C3** (assert an adoption metric exists) and
   **C2** (assert every deliberate stub is visibly marked).



