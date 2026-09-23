# Phase 3 — Action Plan

> **What this is.** The executable version of [`PHASE-3-GAP-ANALYSIS.md`](PHASE-3-GAP-ANALYSIS.md).
> That document says *what is missing and why*. This one says *what to build, in what order, in
> which file, and how to know it worked.*
>
> **Scope:** Skills → MCP → Execution sandbox. RAG is deferred (`GAP-ANALYSIS §7`).
> **No interface decisions.** Nothing here assumes where a feature appears on screen.
> **Reference:** `trueforge/trueforge-main/` (MIT) — ideas are taken, the runtime is not.

---

## §0 — How this plan is shaped

Three rules govern every step below, and each one is a rule this project already follows:

1. **Fail loud.** An unknown anything is a stated failure, never a silent no-op. This is the
   503 discipline applied to skills, tools, and the sandbox.
2. **One canonical owner.** Every concept is defined in exactly one file. No duplicate
   definitions, no forwarding shims. (The reference states this as a hard rule in its
   `AGENTS.md`; we should hold to it too.)
3. **Prove it at the boundary.** A step is done when a *test* passes, not when the code exists.
   The failure modes listed in each step are the silent ones — they are silent precisely
   because nothing checks them.

**Naming, fixed for this plan** (`GAP-ANALYSIS §0`): a **tool** is called and returns a result.
A **skill** is read and followed. A **flow** is our authored customer path. An **execution
sandbox** is an isolated compute environment — always qualified.

---

## §1 — The critical path

```
                ┌─────────────────────────────────────────┐
                │  MILESTONE 1 — SKILLS          (P0)     │
                │  declare → advertise → read → follow    │
                └────────────────┬────────────────────────┘
                                 │  builds the tool registry
                                 ▼
                ┌─────────────────────────────────────────┐
                │  MILESTONE 2 — MCP             (P1)     │
                │  transport → registry → discovery       │
                └────────────────┬────────────────────────┘
                                 │  needs a place to run
                                 ▼
                ┌─────────────────────────────────────────┐
                │  MILESTONE 3 — EXECUTION SANDBOX (P2)   │
                │  boundary → provider → move tenants     │
                └─────────────────────────────────────────┘

  Runs alongside, no dependencies:
    • Progressive disclosure for the catalog manifest  (§5, do early — it is a token win)
    • Security boundary prose                          (§6, before M3 writes any code)
```

**Why this order** (`GAP-ANALYSIS §7`): Skills is the authoring layer, which is what Phase 3
actually is, and it produces domain value on day one. MCP has the longest external lead time —
start the credentials conversation during M1. The execution sandbox is the largest and the most
irreversible, and doing it last means it arrives with two proven tenants instead of building an
isolation boundary for code that does not exist yet.

---

## §2 — Milestone 1: Skills (P0)

**Goal:** a procedure written as a document is addressable by the agent — pickable, readable,
and followable — without a human transcribing it.

**Contract:** [`SKILLS.md`](SKILLS.md) is the specification. Do not re-decide it here.

### Step 1.1 — The declaration and the loader

**Files:** new `backend/skills.py`; new `skills/` directory at repo root.

Model this exactly on `deps.py`'s catalog loader, because that loader already gets it right:
load at import, fail fast, print the count.

```
backend/skills.py
  load_skills()          → reads skills/<name>/SKILL.md frontmatter
  skills: Dict[str, Skill]
  get_skill(name)        → body + file list, or a loud error
  skill_manifest()       → [{name, description, ref}]  ← what goes in the prompt
```

**The `skills/` layout** (mirrors the reference's on-disk shape, and our own
`ADDING-A-CATALOG-ELEMENT.md` structure):

```
skills/
└── design-system-rules/
    ├── SKILL.md              ← frontmatter: name, description, ref
    └── references/
        └── spacing-scale.md
```

**The loader must:** reject a skill whose `name` does not match its directory; reject a missing
`description`; reject a duplicate `name`. A skill that fails to load aborts startup the way an
unreadable catalog does (`deps.py:40`). A procedure that silently failed to load is
indistinguishable from a procedure that ran and found nothing.

**Prove it:** a test that loads a malformed skill and asserts the failure names the skill and
the reason.

### Step 1.2 — Advertise (progressive disclosure)

**Files:** `backend/skills.py` (the manifest), `backend/routes/ai.py` (the prompt sites).

Add a `<skills>` block to the assembly prompts carrying **names and descriptions only**:

```
<skills>
design-system-rules — The spacing, naming, and contrast rules a surface must obey.
catalog-element-checklist — The seven steps to add a component, and the trap at each.
</skills>
```

The five assembly prompt sites are in `backend/routes/ai.py` — the console assembler
(`:536`), the catalog-check assembler (`:768`), the composer assembler (`:894`), the general
surface assembler (`:1208`). All four must carry the same block; a skill advertised in one
prompt and absent from another is worse than no skill, because the agent's behavior changes by
which surface loaded.

**Prove it:** assert every declared skill's name appears in every assembly prompt.

### Step 1.3 — Read (`get_skill`)

**Files:** `backend/skills.py`, and a new tool-dispatch path in `backend/routes/ai.py`.

This is the **first entry in the tool registry** that MCP will later extend. Build it as a
registry from the start rather than as a special case:

```python
# one place that answers "what may be called, and what does it do"
TOOL_REGISTRY: Dict[str, ToolDef] = {}

@tool("get_skill", "Read a skill's full body by name.")
def get_skill(name: str) -> dict: ...
```

`defineTool`-style validation (schema in, validated out) is the piece worth copying from the
reference's `LocalToolMCP.ts:defineTool`. An argument that does not validate returns a
*stated* error, not an exception that reads as a crash.

**The tool belongs to the same surface as assembly:** if the model can name a component it must
be catalogued, and if it can name a skill it must be declared. Same gate, same 503 discipline.

**Prove it:** reading an undeclared skill fails loudly and names the skill; reading a declared
one returns the body and its file list.

### Step 1.4 — The first skill (the actual deliverable)

**Files:** `skills/design-system-rules/SKILL.md`, plus `skills/catalog-element-checklist/SKILL.md`.

This is where the value is; 1.1–1.3 are plumbing for it.

- **`design-system-rules`** — the spacing scale, the layer-name requirement
  (`ADDING-A-CATALOG-ELEMENT.md` step 7), the contrast floor, the naming rule
  ("one name means one component with the same parameters, drawn by one file"). These rules are
  currently enforced only by code; the skill makes them *knowable* before assembly rather than
  *discoverable* by 503.
- **`catalog-element-checklist`** — `ADDING-A-CATALOG-ELEMENT.md` converted. It already has the
  seven steps and the traps; it needs frontmatter and a file layout.

**Prove it:** the agent assembles a correct surface having read only the skill, with no
corrections needed. That is the acceptance test for the whole milestone.

**Cost check (do this in M1, not later):** confirm the `<skills>` block is small. Three skills
at ~40 words is ~120 tokens against bodies in the thousands. Record the real number — this is
the same discipline the project already applies to its token measurements.

---

## §3 — Milestone 2: MCP (P1)

**Goal:** reach a system we did not pre-wire, at runtime, gated by an allowlist.

### Step 2.1 — Extract the transport we already wrote

**Files:** new `backend/mcp_client.py`; `backend/figma_mcp.py` reduced to a consumer.

`backend/figma_mcp.py:53` — `_post()` — **is already a correct streamable-HTTP MCP client.** It
does a real JSON-RPC exchange with `Accept: application/json, text/event-stream` and session
handling. It is welded to Figma by nothing but its module and its allowlist
(`SUPPORTED_TOOLS = {"figma.get_design_context"}`, `:48`).

Lift `_post`, the session handling, and the error shapes into `mcp_client.py` with **zero Figma
knowledge**. Then `figma_mcp.py` keeps only `SUPPORTED_TOOLS` and its tool definitions, and calls
the client. This is a refactor, not new code — and it should be done as a pure move with the
existing Figma path still working, so the refactor is provably behavior-preserving.

**Prove it:** the existing Figma tool call behaves identically before and after.

### Step 2.2 — The server registry

**Files:** new `backend/mcp_servers.json` (or `.yaml`), `backend/mcp_client.py`.

Same shape as the catalog: a small file listing configured servers (`name`, `url`, `auth_ref`).
**Discovery-only; no credentials in it.** An unconfigured server name fails loud.

### Step 2.3 — Tool discovery and the allowlist gate

**Files:** `backend/mcp_client.py`, `TOOL_REGISTRY` from M1.

Discovery is `list_tools` against a configured server, cached. **The gate is an allowlist of
named tools, not the server's annotations** — and this is the one place we deliberately diverge
from the reference. Their doc is honest that unannotated tools match neither `@write` nor
`@destructive` and therefore run ungated, and that most servers annotate nothing. For a system
whose premise is that the catalog decides, "ungated by default" is the wrong default.

**Prove it:** a call to a tool not on the allowlist fails loudly and does not execute.

### Step 2.4 — The first server: read-only internet

**Files:** `backend/mcp_servers.json`.

One search/fetch server, read-only. No write tools in v1 — there is no reason to give a first
MCP write access, and the allowance can be widened later with evidence.

### Step 2.5 — Trigger the registry review

Start the credentials/network conversation **during M1, not now.** External lead time is the
reason MCP is second in the order despite being ready to build.

---

## §4 — Milestone 3: Execution sandbox (P2)

**Goal:** a place where code runs that is not the host, with two known tenants.

### Step 3.1 — The boundary document, before any code

**Files:** new `READ-ME/SANDBOX-BOUNDARY.md` (or a section appended to this plan).

Write it first. `backend/repair_apply.py`'s docstring is the model: it states what may be
written, what may not, and the reason for each in two paragraphs — small enough that a reader can
verify it by reading. The boundary must answer, in prose:

- What may be **written** (and what is refused by path, by extension, by existence)
- What may be **executed** (and with what timeout, and what a non-zero exit means)
- What may be **reached** (network? credentials? nothing?)
- **What is never present** — the credential rule from `GAP-ANALYSIS §5`: if a tool call ever
  originates inside the sandbox, credentials stay in the harness and the call bridges back.

This is not documentation-as-afterthought. It is the design, and the code is then written to it.

### Step 3.2 — The minimal provider

**Files:** new `backend/sandbox/`.

Implement only what §6 of the gap analysis lists as needed now:

```
createSandbox()                      provision
exec({command, cwd, env, timeout})   run → exitCode + output
uploadFile / downloadFile            move bytes
getSkillsDir()                       where skill mounts land
getToolResultDumpDir()               where oversized results are offloaded
```

**Do not build:** image building, Code Mode transports, git credential stores, remote providers.
Start local and disposable. **Do not start with Daytona** — the reference requires
snapshot-write permission on the key or setup fails even when the key is valid, and it is an
external dependency against a sovereign goal.

### Step 3.3 — Move the two tenants

**Files:** `backend/repair_apply.py`, `backend/governance_inspector.py`.

Two concrete tenants already exist, which is why this milestone is not speculative:

1. `repair_apply.py` writes `frontend/src` **on the host**. Well-guarded (allowlisted prefix,
   `looks_complete`, timestamped backups) but not isolated.
2. `governance_inspector.py:81,90` runs `subprocess` — `git` and other shell — **on the host**.

Move them onto the provider. Keep every guard `repair_apply` already has; the sandbox is an
*additional* boundary, not a replacement for its rules.

### Step 3.4 — Skills move into it

Mount skill files into `getSkillsDir()` rather than reading them from the repo path. This is
what makes the sandbox a prerequisite for skill *scripts* (not for skill *bodies* — which is why
M1 can be finished first).

**No silent fallback.** No sandbox available is a stated failure. This is the one place where
degrading quietly is a security bug, and it must be a test.

---

## §5 — Runs alongside: progressive disclosure for the catalog manifest

**Priority: high, cheap, independent.** Do this during M1.

**The problem, in our own code.** `backend/routes/ai.py:894` assembles the composer prompt with:

```python
{json.dumps(list(a2ui_catalog.get("components", {}).keys()))}
```

and `:536`, `:768`, `:1208` carry the catalog the same way. Every assembly call pays for the full
component list. Meanwhile `/api/ai/manifest` (`:253`) already serves a per-role manifest from
`frontend/dist/manifest.json`, and `role_caps.get_filtered_manifest()` already filters by role —
**the machinery exists and the prompt does not use it fully.**

**What to do:** advertise component *names* in the prompt and load a component's full prop
contract only when the model asks — the same mechanic as skills, applied to the catalog. The
reference does exactly this with `get_tool_output_schema` (`docs/key-features/deferred-tool-loading.mdx`).

**Why this is worth doing early:** it is a direct token reduction on the hot path, it needs no
new concept (the tool registry from §1.3 is the vehicle), and it composes with the cost argument
the project already makes. It also tests the registry under real load before MCP depends on it.

**Prove it:** record the prompt size before and after, on the same intent, and report the
difference honestly — including if it is smaller than expected.

---

## §6 — Order, dependencies, and what unblocks what

| # | Step | Depends on | Unblocks |
|---|---|---|---|
| 1.1 | Skill declaration + loader | — | 1.2, 1.3 |
| 1.2 | Advertise in prompts | 1.1 | 1.4 |
| 1.3 | `get_skill` + tool registry | 1.1 | **M2 entirely**, §5 |
| 1.4 | First two skills | 1.2, 1.3 | Acceptance for M1 |
| 5 | Manifest progressive disclosure | 1.3 | Token win |
| 2.1 | Extract MCP transport | — (independent) | 2.2 |
| 2.2–2.4 | Registry, discovery, gate, first server | 2.1, 1.3 | M3 tool-call bridging |
| 3.1 | Boundary prose | — | 3.2 |
| 3.2 | Minimal provider | 3.1 | 3.3, 3.4 |
| 3.3 | Move `repair_apply`, `governance_inspector` | 3.2 | — |
| 3.4 | Skill mounts into sandbox | 3.2, 1.1 | — |

**Two things can start today and in parallel:** step 1.1 (skills loader) and step 2.1 (MCP
transport extraction). Neither depends on the other, and 2.1 is a pure refactor that de-risks
M2 while M1 is being built.

---

## §7 — Definition of done, per milestone

**M1 is done when:**
- An undeclared skill fails loudly at the boundary, with the skill named.
- Every declared skill appears in every assembly prompt. *(Test, not inspection.)*
- The agent assembles a correct surface having read `design-system-rules` and needing no
  correction. **This is the real acceptance test.**
- The `<skills>` block's token cost is measured and recorded.

**M2 is done when:**
- The Figma path works identically after the transport extraction.
- A tool not on the allowlist fails loudly and does not execute.
- One read-only internet server returns a result into a run.
- No credentials appear anywhere the model can read them.

**M3 is done when:**
- `SANDBOX-BOUNDARY.md` exists and the code matches it.
- `repair_apply` and `governance_inspector` no longer touch the host directly.
- **With no sandbox available, the failure is stated — verified by test.**
- Skill files mount into the sandbox rather than being read from the repo path.

---

## §8 — Risks, and what each one costs if ignored

| Risk | Why it bites | Mitigation |
|---|---|---|
| **The skill drifts from the code it describes** | `ADDING-A-CATALOG-ELEMENT.md` already records a stale count that "waited to be remembered." A stale skill is the same failure with a longer half-life. | Bump `ref` when the rule changes. Treat it as part of changing the rule. |
| **Advertised-but-unreadable skill** | Looks exactly like the agent choosing not to use it. | Read every advertised skill in a test (`SKILLS.md §6`). |
| **Ungated tool call** | The reference's own default. Most MCP servers annotate nothing. | Allowlist, not annotations. Named tools only (§2.3). |
| **Sandbox becomes the host** | A silent fallback to host execution is the whole risk, and it looks like success. | No fallback path exists in the code. Test for it. |
| **Skills become an overseer** | This already happened once with the catalog audit. | `SKILLS.md §7`: a skill instructs; the catalog decides. No reporting path. |
| **Three things named "sandbox"** | Already true: the surface viewport, a domain's catalog scope, and now an execution environment. | Qualify always: **execution sandbox** (`GAP-ANALYSIS §6`). |

---

## §9 — What this plan does not do

- **No interface.** No slots, no pages, no placement. Where this lives is undecided and this
  plan does not assume an answer.
- **No new authority.** Skills instruct, the catalog decides, the execution sandbox isolates.
  Nothing added here watches, reports on, or judges. Governance stays by construction —
  a refusal is a 503 and a record, not a report someone must read.
- **No widening of what the model may choose.** Skills and allowlists narrow the choice set.
  MCP adds a capability the model reaches for *deliberately*, one named tool at a time.
- **No TrueForge dependency.** The folder is a reference. The runtime is ours.

---

## §10 — Start here

**Today, in parallel:**

1. **`backend/skills.py`** — the loader, modelled on `deps.py` (step 1.1).
2. **`backend/mcp_client.py`** — lift `_post` out of `figma_mcp.py` as a pure move (step 2.1).

**Then:** the `<skills>` block in the four prompt sites (1.2), then `get_skill` (1.3).

**Then the thing that matters:** `skills/design-system-rules/SKILL.md` (1.4).
