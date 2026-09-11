# Writing Annotations — Designer's Guide

> This is the one document you need to write notes the AI can read without
> asking you questions. You write once in Figma. The AI reads it and builds
> the component. No re-explaining, no "can you see my notes," no pasting text
> into a chat.

## Intent — the designer's job

The designer is responsible for the **intent** of the application. Your
annotation is not a description of the design — it is the statement of intent
the assembler needs to build and wire the component correctly.

For each component, your annotation answers:

- **Connectedness** — what other processes, surfaces, or components this one
  talks to, and how.
- **Backend relationships** — what it reads and writes; which API, `agent_rpc`
  call, or envelope field it depends on.
- **Triggers** — what makes it change: a click, a data push, a state transition.
- **States** — the states it can be in (open/closed, loading/ready/error).
- **Failure** — what it does when something fails, **and what failure looks
  like** (a disabled control, an error color, a retry affordance).

Every one of these you pair with a **visual representation** — the design
itself — and link them together inside the annotation.

### Annotations can be robust

This is not a one-line sticky note. You can put **code** in them — literal
snippets the assembler copies, not paraphrases — and **links** — to a frame,
an API doc, or the component this one connects to.

### What you're actually writing

You're writing **the prompt** for this component — the same instruction the
assembler AI would otherwise have to guess at. That's the reversal: instead of
the application generating prompts for components, the designer writes them,
one component at a time, and the assembler executes them.

You are not writing flourishes. You are not writing pontification. You are
writing **instructions for the assembly AI**. The design is the visual. The
annotation is the behavior and the intent. Together they are the full spec.

## What an annotation is

A note attached to a **component variant** in Figma Dev Mode. It is the only
thing you write about **what the component does**. Everything about **what it
looks like** — sizes, spacing, colors, fonts, shadows, radius — the AI reads
directly from your design. You never type those.

## Three destinations, three sources — you only write one of them

| Destination | Where it comes from | You write it? |
| --- | --- | --- |
| **What it looks like** (pixels, spacing, colors) | Your Figma design, automatically | **No.** Never type a size or color in a note |
| **What it does** (events, state, data, tracking) | Your **annotation** | **Yes** — this is the only thing you write |
| **What it's called** (name → code tag) | The node's **name in Figma** | **Yes, but once** — just name the node well (see below) |

That split is the whole trick. The annotation's only job is behavior. Visual
and naming come from sources you already control in Figma.

## The one rule: annotate the variant, not the set, not an instance

- Write **one annotation per variant**. An "open" state and a "closed" state
  behave differently, so each gets its own note.
- Do **not** annotate the component **set** — it holds only one note, so you'd
  lose the per-variant distinction.
- Do **not** annotate **instances** — the variant's contract applies everywhere
  it's placed. Annotate the master/variant once.

## The format

Write your note in this shape. Every field is optional — write only the ones
that apply.

```
Data:      <what it binds to, e.g. workspace.activeItem.role>
Source:    <where the data comes from, e.g. agent_rpc / envelope field>
On click:  <dispatch event + payload shape>
Track:     <track_event name + props>
State:     <this variant's state, e.g. open>
Disabled:  <condition, e.g. when no role selected>
A11y:      <role / label source>
Builder:   <extra instruction to the code generator>
AI:        <extra instruction to the runtime model>
Connects:  <downstream impact, e.g. feeds role to prompt-input-section>
Failure:   <error behavior + visual, e.g. show red border, log to error-service>
```

### Field-by-field

| Field | Meaning | Example |
| --- | --- | --- |
| `Data:` | What data this component binds to | `workspace.activeItem.role` |
| `Source:` | Where that data comes from | `agent_rpc` / envelope field |
| `On click:` | The event fired, and its payload | `dispatch role-select { role: <tile label> }` |
| `Track:` | Analytics event + props | `track role_changed { role }` |
| `State:` | The variant's state | `open` / `closed` |
| `Disabled:` | When it's not clickable | `no role selected` |
| `A11y:` | Accessibility role / label | `role="menu"`, label from tile text |
| `Builder:` | Instruction to the code generator | *(rarely needed)* |
| `AI:` | Instruction to the runtime model | *(rarely needed)* |
| `Connects:` | Where this component talks to | feeds role to prompt-input-section |
| `Failure:` | What it does on failure + visual | disabled tile / show red border |

## The golden rule: `On click:` is what makes behavior exact

If you write `On click:`, the AI copies your event names **verbatim** — it has
nothing to invent. If you write prose instead, the AI has to **guess** the
event names, and then it's guessing, not following your design.

## A good annotation (copy this pattern)

For the role dropdown:

```
Data:      role = workspace.activeItem.role
On click:  dispatch role-select { role: <tile label> }
On click (Remove tile): dispatch role-remove
State:     closed (default) / open (on role-tile arrow click)
A11y:      role="menu"; each tile role="menuitem", label from tile text
```

## A bad annotation (never do this)

```
This is supposed to be the drop-down for the accordion tiles in the left
column where we enter our prompt information.
```

Why it's bad: it's a sentence, not a spec. The AI reads it and has to invent
`role-select` / `role-remove` out of thin air. That guesswork is exactly what
the structured format prevents. (The AI will still *build* it, but it will mark
those invented parts `inferred` and flag the component for you to re-annotate.)

## Rename your components

Your Figma node name becomes the name in code. An auto-generated name like
`Component 24/Frame 886946` forces the AI to invent a code name. Rename it
once, name it well:

- `Component 24/Frame 886946` → `role-dropdown`
- `Frame 886944` → `model-selector`

Name it once in Figma, and that name flows to the code and the catalog
automatically. No re-typing, no second source of truth.

## The full loop, in one line

You write one structured annotation per variant → the AI pulls it by node ID →
it lands in the component (behavior), the design (visual, automatic), and the
catalog (name, automatic). Done. You never explain it again.
