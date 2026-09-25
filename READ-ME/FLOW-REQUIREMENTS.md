# Flow requirements — what a prompt must be before it can run

The list Grace reviews against before a Run is allowed to proceed. It is a document so it
can be argued with, versioned, and hardened over time; the gate in the interface reads its
*shape*, and this is where the shape is decided.

**Status:** first draft, 2026-09-28. Written as the starting list, not the final one.

---

## §1 — How this is used

When a person presses **Run**, the system asks her to review the prompt against this list
before the run proceeds. Three things are true of that review:

- **It is advisory to the person and blocking to the run.** She cannot stop somebody who
  insists — they can turn her off, or press Run again after reading — but a run does not
  proceed *unexamined* unless they have chosen that.
- **Silence is not consent.** The run proceeds when she says it is ready, not when she
  fails to object. A missing answer leaves it held.
- **It can be switched off.** A person who knows what they are doing should not be
  lectured. `autoAdvice` is that switch, and it is theirs.
- **Recommendations are for the FIRST Run, not every Run after it.** They are the learning
  experience — how somebody finds out what the machine does with what they wrote — and once a
  package has produced results she stops proposing and waits to be asked. The gate is the
  package's own thread (the results it carries are the fact), applied in
  `<chat-panel>._greetIfArriving`; the rule and the owner's words are in `shared/autoAdvice`.

**The point of the list is not compliance.** It is that a bad prompt should be caught while
it is cheap to fix, by the person who wrote it, before it becomes a bad flow.

---

## §2 — Identity

| # | Requirement | Level | Why |
|---|---|---|---|
| I1 | The package has a **name** | Blocking | An unnamed package cannot be found again, referred to by a colleague, or told apart from the next unnamed one. The console is a library and a library of unlabelled things is a pile. |
| I2 | The package has a **description** | Blocking | The description is what the console card says and what the search reads. Without one, the card is a name and nothing else, and nobody can tell what it does without opening it. |
| I3 | The name is not a placeholder (`Untitled Prompt`, a timestamp) | Advisory | It satisfies I1 in letter. It fails it in purpose — the name exists to distinguish this from others, and a default distinguishes nothing. |
| I4 | The package has been **saved** | Blocking | A description is written at save, so a package that has never been saved cannot be described — and asking for a description that cannot exist yet is how "Add description" arrived in every reply while the person watched a loop they could not break. The owner, 2026-09-23: "Grace can save a package that is being engaged with and has not been saved yet. She should ask the user it's time to save… communicate to the user through Grace what's needed." **Checked in code since 2026-09-23**, and asked for FIRST: with no saved package, every other unmet requirement is downstream of it. |

**On I4, and why it is asked rather than done.** Grace can save the package, and she asks first: a save makes something that did not exist, so it is offered as its own button and is **never** applied by Fix all. The rule that keeps the two apart is written where the repairs are (`frontend/src/shared/flowReview.ts`): `action` the app does from one press, `ask` the app can do and does not do uninvited, `words` it needs language for. Fix all clears the first kind and tells the person what is left.

**And the play path stays open.** Somebody who wants to try things and not keep them is doing something legitimate: I4 holds the **Run**, not the person. Nothing refuses them at the point of typing, they can decline the save and go on building, and she says plainly that a Run is the thing that needs an id. The owner, 2026-09-23: "Sometimes people don't want to save they just wanna play… let's not make it too complicated."

**On I2 and where descriptions come from.** A description is written by the model at save.
So a package that has never been saved has none — and this requirement is why naming a
draft no longer creates a row: a row created without a description is a package that can
never be reviewed cleanly. The description is asked for *before* the run, and written.

---

## §3 — The instruction

| # | Requirement | Level | Why |
|---|---|---|---|
| S1 | **Agent Role** has content | Blocking | This is what the agent does. A prompt without it may have a persona and an input shape and no task. |
| S2 | **User Role** has content | Blocking for a flow that takes input | The seat describes what arrives. A prompt that expects input and does not say what shape it comes in is a prompt that guesses. |
| S3 | **Constraints** has content | Advisory | Not every prompt needs a stated limit. One that *has* a limit and does not state it relies on the model's judgement arriving at the same place twice. |
| S4 | No seat is present and empty | Advisory | An empty seat is a gap in the prompt that reads as deliberate. It costs nothing to remove and nothing to fill; what it costs is the model treating the gap as freedom. |
| S5 | **Tool Call** names a tool that **exists** | Blocking | See §4. This is the one seat whose content is a reference rather than prose, and a reference to nothing is worse than an empty seat. |

---

## §4 — Tools and the flow

| # | Requirement | Level | Why |
|---|---|---|---|
| T1 | Every tool named in a prompt is registered | Blocking | A name that is not in the register is a step that cannot happen. The register is `tools`, and the same rule already applies to components and the catalog. |
| T2 | A tool whose kind is `call` has something behind it | Blocking | A `call` tool writes a sentence saying the system reaches out. Until 2026-09-23 nothing did, and a prompt then claimed a capability the system did not have. **Four now have a service behind them** (`search-the-internet`, `read-a-wiki`, `research-a-topic`, `query-a-database` — see `backend/tool_run.py`); the other five are still descriptions and nothing more. **The gate can see this one:** the register is read at Run, the prompt's own words are searched for a `call` tool with no runner, and the answer is handed to her as a fact — see "What the gate can see" below. |
| T3 | A `call` tool's service is reachable | Blocking | A tool that needs a key it does not have is T2 wearing a different hat: configured, and non-functional. |
| T4 | Every step in the flow can execute | Blocking | A step that cannot happen is a flow that stops silently at that point. |
| T5 | The flow's order is stated | Advisory | Where one step's output is another's input, that should be visible rather than inferred from the seat order. |
| T6 | No two rows stand for the same step | Blocking | The rows ARE the drawing: a second Agent Role row is a second agent node and a second agent role sent to the model. It happens by typing — a person adds "agent_role" beside the "Agent Role" the menu made — and it is found at Run, not before. |


---

## §5 — What the gate can see, as built

The list above is the standard. This is what the code can actually put in front of her when a Run
is held, so nobody mistakes a requirement for a check that exists.

**Read from the prompt and the register, by the shell, and handed to her as facts:**

- the package's name, its description, and every seat with its whole text (cut at 600 characters)
- which seats are present and empty
- **T2** — the register is read at Run; every `call` tool with no `runner` is matched against the
  prompt's own words, and the ones found are named in the review as tools that cannot run

**Judged by her, in the review, with the requirements list in front of her:**

- I1, I2, S1, S2, S5, T1, T3, T4 — she is asked to review against them and to block when one is
  unmet. Nothing enforces her answer: the run is released by `<run_ok/>` and by nothing else, so a
  requirement she misses goes through. That is the design (she is the reviewer), and it is the
  first thing to revisit if a bad prompt ever runs.

**Deliberately not checked:**

- T5, and every advisory row.

---

## §6 — How a requirement is met when it is unmet

The person is allowed to make the mistake. Nothing in the composer refuses a second Agent Role
row, an empty seat or a missing description — a prompt is built the way its author types, and
being stopped at the point of typing teaches nobody anything. The owner, 2026-09-23: "let
Martha enter two agent roles. Let her enter 15 agent roles if she wants to, and then let Grace
help her through it. That's how human beings learn, by making mistakes."

What happens instead, at Run: the review holds, she names what is wrong in one sentence, and
offers the repair as a button. The person presses it, or says they meant it, or fixes it
themselves.

**The wall is the held Run, and it is deliberately gentle:** an unmet blocking requirement stops
the run and is made of a sentence and a button, never a refusal at the point of typing.

---

## §7 — What is deliberately not on this list

- **Length.** A long prompt is not a bad prompt. The list has nothing to say about how much
  someone wrote.
- **Wording, tone, style.** Not a governance question and not something a model should be
  correcting as though it were.
- **Quality of the thinking.** Whether the prompt asks for the *right* thing is the author's
  judgement. This list covers whether it can run, not whether it should.
- **Anything the catalog already enforces.** An unnamed component is refused with a 503
  before her review; a list that repeated it would be two authorities on one rule.

---

## §8 — Open questions

1. **Who owns the levels?** I have marked I1/I2/S1/S2/S5/T1–T4 blocking and the rest
   advisory. That split is a design decision, not a measurement, and it is the first thing
   to argue with.
2. **Does S2 hold for every flow?** "A flow that takes input" is doing a lot of work in that
   cell. A prompt that reads a document and returns a summary has no User Role and does not
   need one.
3. **Should the review be a model call at all?** I1, I2, S1, S2, S5, T1, T3 and T6 are all
   checkable in code. Only the judgement calls — S3, S4, T5 — need her. A review that asks a
   model to count empty seats is paying for arithmetic.
4. **Where does the description come from when a package is new** — asked for by her, or
   generated from the prompt at the gate and offered for confirmation?
5. **What happens to the four descriptions already missing?** They are local test rows. In
   general: a package saved before this list existed does not satisfy it.
