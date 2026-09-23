# Phase 3 — Gap Analysis and Implementation Plan

**Scope of this document:** three capabilities we do not have and want — **Skills**, **MCP**,
**Sandbox**. Nothing here decides where a feature lives in the UI; the interface is undecided
and this plan does not assume one.

**How this was written.** Every "we have / we don't have" below was read out of the current
repository, not assumed. The reference for the target shape is
`trueforge/trueforge-main/` (MIT, vendored copy in this repo). Where the reference does
something we should not copy, this document says so and says why.

---

## §0 — The vocabulary, fixed once

Four different things get called "tools" in this industry, and the names have moved twice in
two years (functions → tools → skills). Confusing them is the single largest source of wasted
time in this phase. Use these five words and no others:

| Word | What it is | Called or read? | Where it comes from |
|---|---|---|---|
| **Model** | Which LLM answers | — | Configured once |
| **Tool** | A function with a JSON schema and a handler | **Called** by the model at runtime | Code, or an MCP server |
| **MCP server** | A *connection* to an external system. Its tools arrive with it | — | A URL + credentials |
| **Skill** | A `SKILL.md` playbook + supporting files | **Read** by the model, never called | A git repo, cloned on demand |
| **Flow** | Our word. An authored customer path | Executed by the *customer*, designed by us | Our catalog + our authoring |

**The one rule that resolves all future confusion:** a tool is *executed*; a skill is *read*.
If the model calls it, it is a tool. If the model reads it and follows it, it is a skill.

Two consequences we adopt:

1. **We keep "Flow" for our procedure layer.** A flow is a customer path — hardwired, authored
   by design and engineering, used by the customer. It is not a TrueForge "skill" and it is not
   an "agent." Keeping the word separate keeps the concept separate.
2. **RAG is not MCP.** RAG is context we retrieve *before* the model runs, because we already
   know it is needed. MCP is a call the model makes *during* a run, because only then does it
   know. Both are wanted; neither replaces the other. §4 covers where ours stands.

---

## §1 — Where we are today

### What we already have (verified in source)

| Capability | What exists | File |
|---|---|---|
| Constrained assembly | Catalog loaded fail-fast at boot; unknown component → HTTP 503 | `backend/deps.py:34,40,43` |
| Envelope protocol | 3-message A2UI v0.9.1 envelopes at 4 return sites | `backend/routes/ai.py:339` |
| Role governance | Role → allowed tags, filtered *before* the LLM call | `backend/role_caps.py:33` |
| One tool surface | Exactly **one** MCP tool is callable: `figma.get_design_context` | `backend/figma_mcp.py:48` |
| A resource-lookup RPC | JSON-RPC 2.0 over HTTP for projects (create/get/list) | `backend/routes/agent_rpc.py` |
| Retrieval substrate | Embeddings (384-dim) + local vector store + recall API | `backend/memory_embedder.py`, `milvus_client.py`, `grace_memory_api.py` |
| Guarded code execution | Writes *our own* `frontend/src` only, with backups + completeness checks | `backend/repair_apply.py` |
| Subprocess, unscoped | `git` and other shell calls run on the server host | `governance_inspector.py:81,90` |

### What we do not have

- No skill concept anywhere. (`grep -ri skill` over our own source returns nothing.)
- No MCP *client* in our sense — `figma_mcp.py` speaks the Figma MCP protocol directly for one
  hardcoded tool. There is no ability to attach a server and discover its tools.
- No sandbox. `repair_apply.py` is a *guarded writer* on the host, not an isolated environment.
- No generic tool registry. Tools are whatever the code happens to call.

**The honest one-line summary:** we have a strong *constraint* layer (catalog, roles, 503) and
almost no *capability* layer. Skills, MCP, and the sandbox are all capability-layer additions.
That is exactly why Phase 3 is these three, and it means they are one theme, not three projects.

---

## §2 — The architectural seam all three plug into

The reference's most valuable idea is not any one feature — it is that a capability is a
**pluggable unit with declared stages**. `AgentCapability` declares:

```
systemToolSets          tools the harness registers (not the author)
instructionBuilders     how to describe itself in the system prompt
preSendProcessors       transforms the outgoing payload
preLLMProcessors        transforms context before the model call
postToolCallProcessors  reacts to a tool result
toolResponseProcessors  shapes what the model sees of a result
state                   durable cross-turn state, namespaced
```

*(`trueforge-core/src/core/capabilities/AgentCapability.ts`)*

And the extension seam is `ITurnResourceResolver`, whose own contract says
*"extraCapabilities are appended after the built-in capabilities"* — a supported way to add
behavior **without forking**. (*`agent-session/ITurnResourceResolver.ts`*)

**What we adopt:** the *shape*. A capability in our system declares its tools, its prompt
contribution, and its free/denied decisions — and flows plug in where capabilities plug in.

**What we reject:** their file layout and their scope. Notable things not to copy:

| Reference choice | Why we do not take it |
|---|---|
| `activeServerId` — every request can carry a server id | Multi-tenant concept. We are one sovereign deployment. |
| `skill` as a git-cloned runtime-discovered playbook | Our flows are **hardwired**. We take the *mechanic* (clone on demand, read only when relevant), not the runtime-discovery model. |
| Sandbox = a Daytona VM running user Python | Our flows render and act on our catalog; they do not execute customer code. See §5 for why the sandbox is still needed. |
| OpenUI's free-form expression language | Widens the model's choice set. Our whole cost argument is that the catalog narrows it. We keep JSON-with-paths. |

---

## §3 — Skills

### What a skill is for us

A **procedure**: a markdown playbook with supporting files, authored once, read by the model
only when it decides the procedure is relevant. Examples in our domain:

- the design system's spacing and naming rules, as a playbook the assembler consults
- "how to add a component to a catalog" — our own `ADDING-A-CATALOG-ELEMENT.md`, currently
  prose for humans, could be a skill the agent can follow
- an escalation procedure for a governance finding

### What we take from the reference

| Mechanic | Where it is | Why it is worth taking |
|---|---|---|
| Sparse-clone on demand, never preloaded | `SkillMounter.ts` + `skill_downloader.py` | A skill costs nothing until used |
| `preload: boolean` | `SkillMounter.ts:resolvePreloadContent` | Inline `SKILL.md` when it is short; read from disk when it is long |
| **Progressive disclosure** | `docs/skills.mdx` | The agent sees *name + description* upfront; the body loads only when picked |
| Skills are **mounted**, not copied into the prompt | `SandboxInit` uploads | The prompt stays small |

**The idea worth the most to us is progressive disclosure, and it applies beyond skills.**
Today our assembly prompt carries the full role-filtered catalog manifest on every call. That
is the same trade the reference solves with a `get_tool_info`-style tool: advertise names,
load detail on demand. This is a token-cost win on our own numbers and it is independent of
whether we ever add a skill.

### Steps

1. Define a skill as: `{ name, description, ref, body, files[] }`. Name is the identity;
   description is what the model sees upfront.
2. Add a **mount** stage: materialize the skill's files into a known directory at turn start.
   Never inline the whole body unless `preload`.
3. Add the **advertise** stage: names + descriptions go in the prompt; the body is fetched by a
   tool call when the model picks the skill.
4. Register skill content in the catalog story — a skill is *data*, so the same validator
   philosophy applies: if the model names a skill that is not mounted, that is a loud failure,
   not a silent no-op.
5. Write our first real skill: the design-system rules as a playbook. That is authoring, and it
   is the actual Phase 3 deliverable.

### Not in scope for skills

Runtime discovery (the model finding skills it was not given), registry-backed skills with
pre-signed URLs, and skill marketplaces. Our flows are authored; we do not need a discovery
surface.

---

## §4 — Where RAG actually stands

Not one of the three, but it came up and it needs settling so it stops being confused with MCP.

**We have the substrate:** a local vector store, a 384-dim embedder, and a recall API
(`grace_memory_api.py`, `milvus_client.py`, `memory_embedder.py`).

**What is missing is a *pipeline*, not a database.** A pipeline means: what gets chunked, at what
size, with what metadata, re-indexed when the source changes, and retrieved with what rule.
Right now memories are saved but there is no defined ingest path for *documents* — the design
system's rules, SCE research, prior decisions.

**Do this when it is needed, not now.** RAG gets richer as our corpus grows, and that is
authoring work. It is not on the critical path for skills → MCP → sandbox. Recorded here only
so that "we need RAG too" does not get merged into the MCP work.

---

## §5 — MCP

### What we have, precisely

Exactly one tool, hardcoded: `SUPPORTED_TOOLS = {"figma.get_design_context"}`
(`backend/figma_mcp.py:48`). The protocol machinery is real — `_post()` does a proper
streamable-HTTP JSON-RPC exchange with session handling — but nothing generic sits on top of it.
We cannot attach a server we did not write.

### What MCP gives us

The model, during a run, reaching a system we did not pre-wire: a vendor API, a search service,
an internal SCE service. For Phase 3 the stated goal is **connect to the internet and collect
information**, which means one or two remote servers, not a marketplace.

### Steps

1. **Extract the transport we already wrote.** `figma_mcp._post()` is already a correct
   streamable-HTTP MCP client. Lift it into a `backend/mcp_client.py` with no Figma knowledge.
2. **Add a server registry** — the same shape as our catalog: a small JSON/YAML file listing
   configured servers (`name`, `url`, `auth`). Discovery-only; credentials are not in it.
3. **Add tool discovery** — `list_tools` against a configured server, cached.
4. **Add the call path with the catalog's discipline.** A tool call returns into a run; the
   result must be shaped before it reaches the model (that is what `toolResponseProcessors`
   is for in the reference). And a call to an unconfigured server must fail loud, exactly as an
   unknown component fails with 503 today.
5. **Approval gating.** The reference gates tools the server marks `@destructive`/`@write`, and
   is honest that *unannotated tools match neither and run ungated*. That honesty is the
   important part: our gate must be an **allowlist** — named tools only — because most servers
   annotate nothing.
6. **First server: the internet.** One read-only search/fetch server. Keep it read-only for the
   first version; there is no reason to give a first MCP write access.

### The boundary that must not be crossed

If a tool call ever originates from inside a sandbox, **credentials stay in the harness and the
tool call bridges back to it** (the reference's Code Mode does exactly this, and documents why:
*"the sandbox never holds tokens"*). This is the difference between a tool and a breach. Write
it down before the sandbox exists, not after.

---

## §6 — Sandbox

### First, what our word means

We already use "sandbox" for the **AI surface viewport** (`ai-surface-sandbox`) and for a
**scoped catalog/vocabulary for a team or domain**. The reference uses it for an **isolated
compute environment**. These are three different things and the collision will cost real time.

**Decision for this document:** call the reference's concept an **execution sandbox**, always
qualified. "Sandbox" unqualified continues to mean our surface/domain concept.

### Why we need an execution sandbox at all

Not for customer flows — those render and act on our catalog. We need it for two reasons that
are already visible in the code:

1. **`repair_apply.py` writes our source directly on the host.** It is well-guarded (allowlisted
   prefix, completeness check, timestamped backup) but it is not isolated. An execution sandbox
   is where that belongs.
2. **`governance_inspector.py` runs `subprocess` on the host** (`:81`, `:90`). Same issue.
3. Skills will need somewhere to run supporting scripts — the reference requires the sandbox for
   exactly this, and it is structural rather than a preference.

### What a sandbox must provide (the contract, adapted)

The reference's `SandboxProvider` interface is the right checklist. Ours needs:

```
createSandbox()                 provision
exec({command, cwd, env, timeout})   run, return exitCode + output
uploadFile / downloadFile       move bytes in and out
getSkillsDir()                  where skill mounts land
getFileUploadsDir()             where user files land
getToolResultDumpDir()          where oversized results are offloaded
```

**What we do not need yet:** image building (`buildImage`/`getImageBuildStatus`), Code Mode
transports, git credential stores, or remote providers. Start with a local, disposable process
or container and grow only if a real need appears.

### Provider choice

The reference supports **Daytona only**, and requires snapshot-write permission on the key or
setup fails even when the key is valid. **We should not start there.** A local ephemeral
container is closer to our sovereign goal, has no external dependency, and no cost model. If a
remote provider is ever needed, the interface above is what makes it swappable.

### Steps

1. **Write the security boundary first, as prose, before any code.** What may be written, what
   may be executed, what may be reached, what credentials are never present. `repair_apply.py`'s
   docstring is the model to follow — it states its rules and the reasons, and is small enough
   to verify by reading.
2. Implement a minimal provider: create / exec / upload / download.
3. Move `repair_apply`'s write path and `governance_inspector`'s shell calls onto it.
4. Add skill mounting to it (§3 step 2 depends on this).
5. **Loud failure:** no sandbox available must be a stated failure, never a silent fallback to
   host execution. This is the one place where degrading quietly is a security bug.

### Ordering note

Skills strictly need the sandbox's *mount directory* and very little else. So the sandbox can
start minimal — a directory plus a way to place files in it — and grow into execution later
without re-doing skills. That is why §3 can begin before §6 is finished.

---

## §7 — The order, and why

| # | Work | Depends on | Blocked by |
|---|---|---|---|
| 1 | **Skills** — mount + advertise + progressive disclosure | A mount directory | Nothing. Start here. |
| 2 | **Progressive disclosure for the catalog manifest** | Nothing | Nothing. Token win, independent. |
| 3 | **MCP** — transport extraction, server registry, discovery, allowlist gating | Nothing hard | First real server choice |
| 4 | **Sandbox** — boundary prose, then minimal provider | Nothing | Then skills move into it |
| 5 | **RAG pipeline** — ingest path for documents | Corpus | Deferred on purpose |

**Why skills first, as you said:** it is the authoring layer, which is what Phase 3 actually is,
and it is the only one of the three that produces domain value on day one. It also needs the
least new machinery — a directory and a prompt change.

**Why MCP second:** it is the one with external lead time — credentials, approvals, network
reach. Start the conversations now, build it second.

**Why the sandbox third:** it is the largest and the most irreversible (it is a security
surface). Doing it third means it arrives with a proven consumer. Doing it first would be
building an isolation boundary for code that does not exist yet.

**Why RAG is deferred:** the substrate exists and the corpus does not. Building a pipeline
before there is anything to ingest is the classic way to build the wrong one.

---

## §8 — Open questions this document does not answer

1. **Where do skills live on disk?** Undecided, and it matters — a skill is data, so where it is
   stored decides who can author one. Left open deliberately.
2. **Does a flow ever need to execute code?** If never, the execution sandbox shrinks to "a
   guarded place to write files," and `repair_apply.py` is closer to sufficient than it looks.
   This question decides §6's size more than anything else.
3. **What is the first MCP server?** An internet search/fetch is the stated goal; the specific
   server is unchosen.
4. **Is a skill per-sandbox (per-domain) or global?** Following §2 of the project's own
   direction, this is the same question as "is a flow per-domain or per-team" and should be
   answered together.

---

## §9 — What this plan deliberately does not do

- It does not decide the interface. No slots, no pages, no placement.
- It does not adopt TrueForge as a dependency. The folder is a **reference**; the ideas are
  taken, the runtime is not.
- It does not add a governance overseer. Governance stays by construction — the catalog decides,
  and a failure is a 503 rather than a report someone must read. Any dashboard is a *view* of
  data the assembly path already produced.
- It does not widen what the model may choose. Every addition here either narrows the choice
  set (skills, allowlists) or adds a capability the model reaches for deliberately (MCP).
