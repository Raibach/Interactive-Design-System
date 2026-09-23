# SKILLS.md — the skill contract

> **Status:** specification. Nothing in this document is built yet. It is written to be
> implemented against, and it follows the shape of
> [`PHASE-3-GAP-ANALYSIS.md`](PHASE-3-GAP-ANALYSIS.md) §3.
>
> **Build order:** this is the first of the three Phase 3 capabilities (skills → MCP →
> execution sandbox).

---

## §1 — What a skill is

A **skill** is a procedure written as documents, which the agent **reads** and follows.

It is not a tool. A tool is *executed* and returns a result; a skill is *read* and changes what
the agent knows how to do. If the agent calls it, it is a tool. If the agent reads it, it is a
skill.

A skill has:

| Field | Meaning | Who reads it |
|---|---|---|
| `name` | Identity. Stable, unique, never a label. | The system |
| `description` | What the skill is for. One or two sentences. | **The agent, always** |
| `body` | The `SKILL.md` playbook itself | The agent, only when it picks the skill |
| `files` | Supporting documents and scripts | The agent, only if the body names them |
| `ref` | Which revision this is | The system |

**The one structural rule:** `description` is always in the prompt; `body` is not. That is the
whole mechanism, and it is what makes a skill free until it is used.

---

## §2 — Why we want them

We have exactly one place today where a procedure is written down in prose for a human to
follow: [`ADDING-A-CATALOG-ELEMENT.md`](ADDING-A-CATALOG-ELEMENT.md). It is excellent, it
describes a real sequence with real traps, and **nothing can execute it**. A person reads it
and does the steps.

That document is the model for what a skill is. The difference is that a skill is addressable by
the agent — it can be picked up, followed, and its result checked, without a human transcribing
it each time.

Three skills that are worth writing in Phase 3, in order of value:

1. **The design system's rules** — spacing, naming, the layer-name requirement, the contrast
   floor. The rules that a surface must obey and that today live only in the code that enforces
   them.
2. **Adding a component to a catalog** — `ADDING-A-CATALOG-ELEMENT.md`, converted. The agent can
   then do the seven steps rather than be told about them.
3. **Reading a governance finding** — what a `blocking` versus `advisory` finding means and what
   the correct response to each is.

Skill 1 is the one that matters. It is the design system managing itself.

---

## §3 — The lifecycle

Four stages. Only the first two are needed for the first version.

```
  1. DECLARE      a skill exists: {name, description, ref}
  2. ADVERTISE    name + description enter the prompt
  3. READ         the agent picks it; the body is fetched
  4. FOLLOW       the agent does the procedure; files are read if named
```

### Stage 1 — Declare

A skill is data, declared in one place. The declaration is `name`, `description`, `ref` — never
the body.

```json
{
  "name": "design-system-rules",
  "description": "The spacing, naming, and contrast rules a surface must obey, and the checks that enforce them. Read before assembling or correcting a component.",
  "ref": "v1"
}
```

**The declaration is validated the same way the catalog is.** A skill whose `name` is not
declared fails loud. There is no silent no-op — the reason is the same reason an unknown
component returns 503: a procedure that failed to load looks identical to a procedure that ran
and found nothing to do.

### Stage 2 — Advertise (progressive disclosure)

The prompt carries a list of available skills as name and description only:

```
<skills>
design-system-rules — The spacing, naming, and contrast rules a surface must obey...
catalog-element-checklist — The seven steps to add a component, and the trap at each...
governance-findings — What blocking and advisory findings mean and how to respond...
</skills>
```

Three skills at roughly 40 words each is ~120 tokens. The three bodies behind them are
thousands. That ratio is the entire argument for the mechanism.

### Stage 3 — Read

The agent asks for a skill by name through a tool — the same tool surface MCP will later use, so
this comes before MCP rather than waiting on it:

```
get_skill({ name: "design-system-rules" })
  → the body, plus the list of files if any
```

This is the only part that costs a round trip, and it costs one **because the agent chose to
pay it**.

### Stage 4 — Follow

Reading is not doing. A skill may name files it needs:

```
design-system-rules/
├── SKILL.md
├── references/
│   └── spacing-scale.md
└── scripts/
    └── check-contrast.py
```

The body says which of these exist. The agent reads a reference by passing its path to the same
tool. Scripts are a later concern and belong to the execution sandbox, not here.

---

## §4 — The contract

### §4.1 What is in the prompt on every assembly

| Present | Absent |
|---|---|
| Skill names | Skill bodies |
| Skill descriptions | Skill files |
| What the skill is for | How the skill works |

### §4.2 What a skill may not be

- **Not a tool.** If it needs to *do* something (call an API, write a file, run a check), that is
  a tool, and the skill says *when* to call it rather than being it.
- **Not a place to hide the catalog.** The catalog decides what may be drawn and is enforced by
  the server. A skill explains and instructs; it never becomes the authority on what is allowed.
- **Not runtime-discovered.** Our flows are authored. We do not adopt the reference's model of
  an agent finding skills it was not given.
- **Not an overseer.** A skill is a procedure. It does not watch, report on, or judge. Governance
  is by construction — see §7.

### §4.3 Names

`name` is the identity — stable, lowercase, hyphenated. A description is a label and may be
rewritten freely without breaking anything that references the skill. This is the same rule the
codebase already states for catalog elements: *a shape keys off id, never off a label.*

---

## §5 — Where skills live

**Undecided, deliberately.** The choice is load-bearing and this document does not make it.

What decides it: a skill is *data*, so where it is stored decides **who can author one**. Three
options, with what each implies:

| Option | Implication |
|---|---|
| In the repo, beside the catalog (`skills/<name>/`) | Authored by whoever can commit. Versioned with the code that enforces it. Our default instinct. |
| In the database, per package | Authored by a user in the app. Needs a permission model. Matches the package contract. |
| Fetched from a git ref at runtime | Authored externally, pinned by `ref`. Matches the reference. Adds a network dependency and a supply-chain question. |

**Recommendation for the first version:** in the repo. It needs no new machinery, it versions
with the rules it describes, and it is reviewable in a pull request. Move to the database when
there is a user who needs to author one who cannot commit — not before.

---

## §6 — How we know it works

The failure modes to test for, because each one is silent without a test:

| Failure | What it looks like | The check |
|---|---|---|
| A skill is declared but not advertised | The agent never picks it; looks like the agent chose not to | Assert every declared skill's name appears in the prompt |
| A skill is advertised but not readable | The agent asks; the read fails | Read every advertised skill in a test |
| A description is too vague to act on | The agent reads it and does not follow it | Read the descriptions as if you were the agent: does it say *when* to use it? |
| A body is stale | The agent follows a rule the code no longer enforces | The skill's `ref` bumps when the rule changes — same discipline as the catalog count |

**The last row is the one that will rot.** `ADDING-A-CATALOG-ELEMENT.md` already warns that a
stale count waited to be remembered. A skill that describes a rule the code has changed is the
same failure with a longer half-life. The `ref` is the mechanism; bumping it is the discipline.

---

## §7 — What skills are not, and the governance question

You removed the catalog audit because it was behaving as an overseer. This spec keeps that
decision intact:

- **A skill instructs; the catalog decides.** A skill may say "check the contrast before
  assembling." It cannot make an out-of-catalog component render. The 503 still decides.
- **No reporting path.** There is nothing for a skill to report to. A refusal at the catalog
  boundary is already recorded by the assembly that failed; any dashboard reads that record.
- **No self-assessment.** A skill is not a rubric the agent applies to itself. If a rule needs
  enforcing, it belongs in the validator, not in a document the agent is asked to be honest
  about.

The distinction: an overseer asks *did you behave?* A skill answers *how is this done?* Only the
second one belongs in a prompt.

---

## §8 — First three steps to build

1. **Write the declaration format and the advertiser.** A list of `{name, description, ref}`,
   rendered into the prompt as names and descriptions. Verify the token cost against what the
   full catalog manifest costs today.
2. **Write `get_skill({name})` as one tool.** It reads from disk and returns the body. It fails
   loud on an unknown name. It is the first entry in what becomes the tool registry MCP also
   uses.
3. **Write the first skill — the design system rules.** This is the authoring work, and it is the
   point of the whole exercise. Everything above is plumbing for this.

Step 3 is where the value is. Steps 1 and 2 should be small enough that they do not delay it.
