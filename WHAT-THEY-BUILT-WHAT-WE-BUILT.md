# What n8n Built, What We Built

A living comparison. Started 2026-09-14. **Add to it as the comparison continues.**

Purpose: keep a record of what their screen does, what our screen does, and where the two
differ — so the differences can be read instead of remembered. Every claim about our
build names a file and line, so it can be checked rather than believed.

Nothing in this document is a commitment to build anything.

---

## 1. Decisions

### D1 — The middle column is the canvas

Not a document. It is the middle column's job to render a result, and what it renders is
chosen at the top of the panel. The Figma design already draws that selector:
`ouput-selector-tile`, the 431×40 top row of `center-panel-3rd-col` (node `40000914:4677`),
drawn with an empty label and a chevron — a selector with nothing chosen yet.

The node name has a typo in Figma: `ouput-selector-tile` should be `output-selector-tile`.

### D2 — Canvas capabilities arrive as plug-ins, not as things we build

A CAD reader for a utilities schematic. A Figma component adjuster for design work. An
agent flow. These are **plug-ins** into the middle column, in the same way a code editor
hosts a language server or an extension. We build the seat the plug-in plugs into. We do
not build the CAD reader, the Figma adjuster, or the agent flow.

Consequence for this document: any row below that reads "we don't have a CAD view" is not
a gap in our build. It is a plug-in that has not been written yet.

### D3 — The canvas stays closed until someone Runs

The middle column is collapsed on load and opens when a Run produces output. This is
deliberate friction, not a defect. The intended sequence is:

    open the prompt  →  talk to the chat  →  press Run  →  the canvas opens with a result

Reason: adoption. A person who is handed every pane at once has no reason to learn the
order the system works in. The closed canvas teaches the order.

**Consequence:** the canvas must also open when a Run *fails*. The canvas already has a
state for this, separate from "nothing produced yet" — `compiled-output-viewer.ts:414-430`
renders `⚠ This could not be generated.` rather than an empty pane. The two states look
identical in a pane and mean opposite things, so they are kept apart in the code.

**Not** a rule for this system: "the middle column never appears or disappears." That was
proposed and rejected. The collapse is a designed gate.

### D4 — Run is a button. There is no run-record screen

For now: the Run button, and nothing else. No run history, no execution list, no
step-by-step timeline.

### D5 — The four canvas controls stay as a static placeholder

`Rendered / Raw`, `Copy`, `Regenerate`, `Clear` sit inside the third column and are left
alone for now. The `Raw` toggle exists and can be turned on. These controls are a
placeholder that will be switched later; they are not the final set.

### D6 — There is no bottom strip in our system

Every pane n8n docks along the bottom (`Chat`, `Logs`, `Output`) is redistributed into one
of our three columns. We do not add a fourth region.

One space is reserved and unused: **the bottom of the chat window on the right, underneath
the chat input.** Some of the things that could have gone in a bottom strip belong there.

### D7 — We do not show what people do not need to see

Their screen prints the raw JSON payload of the chat trigger directly into the
conversation, always open. Ours is behind a labelled collapse whose summary reads
*"Raw diagnostics — verbatim, nothing filtered"* (`WritingAreaIndex.tsx:3173`). Same bytes.
Theirs is presented as content. Ours is presented as something you can look at if you need to.

### D8 — A diagram is a view of the prompt, never a builder

The prompt fields are the source. A diagram is one way of *looking at* them. There is no
building step, no canvas the user must populate, and nothing to drag into place.

This is the difference between our shapes and theirs, and it is worth stating plainly
because it is easy to assume they are the same thing:

| | n8n | Ours |
|---|---|---|
| What a node is | An **operation** the user must supply and configure — a trigger, an HTTP request, a service integration | A **section of the prompt the user already wrote** — System Role, User Role, Agent Role, Tool Call (`prompt-section-editor.ts:155-157`) |
| Why you drag it | The graph's meaning *is* its edges. Order and branching are the design | Nothing to assemble. The sections exist because the user typed them |
| What the word "node" already means in our product | A step in a workflow | **A Figma node** — `figma node 40000909:4005`, parsed by regex at `WritingAreaIndex.tsx:2679`. Two meanings of "node" on one screen is a hazard to name before it bites |

So a diagram imposes **no work**. n8n asks a person to build the thing before they can run
it; we ask them to write four fields. The diagram is available afterwards, as a reading.

### D9 — Clicking a shape in the diagram locates the section it came from

Not navigation, not a pane swap — a **highlight**. Click a shape in the middle column and the
section it represents is highlighted in the left column. Nothing moves, nothing is replaced.

The data for this already exists and needs nothing new:

- every section carries a stable `type` and a `position` (`prompt-section-editor.ts:155-157`)
- the Tool Call section's text already carries the Figma node id, and the running code already
  parses it out — `/figma node\s+(\d+:\d+)/` (`WritingAreaIndex.tsx:2679`) — to make a real
  server-side call with it

This is also the interaction n8n *cannot* have: clicking their node refills a different pane
with different content. Ours points back at the same content the user typed, which is what
makes the two views worth having on screen at the same time.

### D10 — A tool is inserted, not written, and it lives in Tool Call

n8n makes a person configure an HTTP node: method, URL, headers, body. We do not, and this is
not a simplification we still owe anyone — it is already built, in two places.

**A picker inserts the tool.** `PRELABELED_TOOLS` (`prompt-input-section.ts:57-59`) is a menu;
clicking an entry puts a token in the section text:

```
{{tool:generate_solar_system_design}}
```

One tool listed today. The user picks a name; no call is authored.

**The Figma fetch is an address, not code.** The repair flow writes three labelled lines into
a section, and the server reads the node id back out of them:

```
tool        figma.get_design_context
figma node  40000909:4005
file        frontend/src/components/lit/prompt-section-editor.ts
```

That call is executed server-side **before the model runs**
(`WritingAreaIndex.tsx:2670-2683`). The person declares what to fetch. Nobody writes HTTP.

**And it goes in `Tool Call`, which is its own role — not Agent Role.** The four role tiles the
user actually sees are `SECTION_MENU_TYPES` (`prompt-input-section.ts:35-40`), traced to a live
Figma component (`40001003:25249`):

| tile | value written | what it holds |
|---|---|---|
| User Role | `user` | the person's ask |
| Agent Role | `agent` | *how to respond* — the fix, and "return a composer, not an answer" |
| **Tool Call** | **`tool-call`** | **what to go fetch** |
| Custom Data | `custom-data` | attached context |

System is the fifth section and is deliberately sticky with no menu
(`prompt-input-section.ts:29`). Tool Call and Agent Role do different jobs: one fetches, the
other decides what to say about what came back.

### D11 — Identity is not presentation. A seat is named once.

A section's `type` was written in four places with four spellings, and nothing compared them (the
full accounting is in **O5**). The values the left column stored did not match the enum the schema
enforces, and the Run path keyed off **display strings** rather than ids.

`frontend/src/shared/promptSections.ts` now declares the seats once. `TYPE_LABELS`,
`SECTION_MENU_TYPES` and `CORE_ROLES` are derived from it, and `TYPE_LABELS`/`SECTION_MENU_TYPES`
remain re-exported from their old homes so no import breaks.

Three rules the module holds:

- **The id is stable; the label is presentation.** A row may be renamed. Its seat does not move
  because of that. Anything that needs to identify a section — a diagram shape above all — keys
  off `id`.
- **A value with no seat is not guessed at.** `custom` (Add Section) and the free-form `roleName`
  are listed in `UNDECIDED` and passed through unchanged. The module maps what is decidable and
  refuses to invent the rest.
- **The run path is derived, not retyped.** `CORE_ROLE_LABELS` replaces a hand-typed list of ten
  strings that decided whether a section reached the model as a core role or was dropped into
  `custom_roles`. A seat added later cannot now be silently dropped by a list nobody updated.

**The schema enum moved too.** `agent-role` was added to it — it had no seat, though it is the
most-used role in the product. The schema was behind the product, not the other way round. That
enum is declared in **four** places and all four moved together: the zod schema (`tag-registry.ts:47`,
the one that is actually enforced), `TAG_REGISTRY`'s own descriptor (`:686`), and the
`prompt-composer` and `ecommerce` catalog schemas.

Copies drift — that is the whole finding. So the copy held in this module is not trusted: the test
reads the LIVE `PromptSectionSchema` and fails if any of the four disagrees with it, or if a short
spelling like `agent` is ever reintroduced.

What did **not** change: the names, and therefore the wire format. The Run path sends the same
strings it sent before — the test asserts the derived list reproduces the old literal exactly, so
this is a renaming and not a re-routing. One behavioural tightening came with it: `_isSystem` was
`.includes('system')`, which was true of `system-role` by luck and of a row literally called
"Systematic Review" by accident. It is now an identity test.

`frontend/src/test/promptSections.test.ts` — 40 assertions, including both the "1 of 5" and
"3 of 5" counts so neither can be misquoted again, the drift checks that read the live schema
rather than a copy of it, and the fallback counts pinned in **D12**.

### D12 — The vocabulary refuses. It does not substitute.

D11 declared the seats. It did not stop anything from being silently re-labelled — and one real
fallback survived that change, inside the new module, with a test written to freeze it:

`normalizeSectionType(undefined)` → `'custom'`.

A prompt row arriving with no `type` was rendered as **Custom**. Nothing logged; nothing failed. The
row looked like a section somebody had deliberately chosen, and the data was malformed. The test
asserted that as correct behaviour, which is how a fallback becomes permanent: it acquires a test.

Two further things were true, and worth stating plainly rather than leaving implied:

- **`isUndecidedType` had no production caller.** The guard built to detect un-decided values was
  exported, tested, and called by nothing. The vocabulary knew what it did not know, and had no way
  to refuse.
- **The comparison was written out twice** — once in `normalizeSectionType`, once in
  `isUndecidedType`. A strict reader would have made it three. That is the same failure as the four
  vocabularies in O5, one order of magnitude down.

There is one comparison now (`resolveSectionType`), and three readers that differ only in what they
do with its answer:

| reader | empty type | undecided value | for |
|---|---|---|---|
| `normalizeSectionType` | `'custom'` — the one substitution | passed through unchanged | data already on disk |
| `isUndecidedType` | `false` | `true` | inspection |
| `strictSectionType` | **throws** | **throws** | anything new |

`strictSectionType(raw, where)` requires a `where` label, so the failure names its caller —
`[promptSections] prompt-section-editor.ts:_normalizeSection: "hero specs" has no seat...`. A stack
trace with no label is where a substitution goes to hide.

**The load path still calls the lenient reader**, and this document does not claim otherwise.
Switching it is a one-symbol change per site; that it is a *decision* rather than a tidy-up is the
point. Nothing calls `strictSectionType` yet either — so no runtime is at risk today. It is the
reader the new left-column work is written against, not a migration applied underneath behaviour
that already depends on the old one.

**The fallbacks that remain are counted, not tolerated.** Three files still contain `|| 'custom'`:
`prompt-input-section.ts` (1), `prompt-section-editor.ts` (2), `WritingAreaIndex.tsx` (3). The test
scans `frontend/src` and asserts that exact map — a fourth cannot appear without the test failing
and the site being recorded on purpose. The direction of travel is down.

The scan strips comments first, and that detail matters: this module now *names* its own
`|| 'custom'` in prose precisely so that a reader need not infer it. A scan that counted the
quotation would punish the documentation and reward the silence.

---

---

## 2. The distinction that matters

**n8n removes a region to make room. We park it.**

When n8n needs space, `Hide chat` deletes the chat from the screen. When our layout needs
space, the side columns collapse to a 60px rail and stay there: `MIN_LEFT_PX = 60`,
`MIN_CHAT_PX = 60`, `SNAP_PX = 16` (`workspace-layout.ts:33-35`).

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▤  Console · Composer · Evaluation · Variables · Metadata                   │
├──┬──────────────────────────────────────────────────────────────────────┬──┤
│▤ │                                                                      │▤ │
│60│                  THE CANVAS, FULL WIDTH                              │60│
│px│                                                                      │px│
├──┴──────────────────────────────────────────────────────────────────────┴──┤
└────────────────────────────────────────────────────────────────────────────┘
       ▲ still there, still one click away — PARKED, NOT REMOVED
```

This is what makes a full-width canvas possible for us and not for them. It is also why a
CAD plug-in or a Figma adjuster can take the whole width without the user losing their
prompt or their conversation.

---

## 3. Their screen

```
n8n — ONE SCREEN, FIVE REGIONS
════════════════════════════════════════════════════════════════════════════
┌──────────┬───────────────────────────────────────────┬──────────────┐
│ ⌄ n8n  + │  Personal / My workflow       [Publish ▾] │              │
├──────────┼───────────────────────────────────────────┤  right rail  │
│ AI Asst  │   ┌─ Editor ─┬─ Executions ─┬─ Evaluations─┐              │
│ Overview │   └──────────┴──────────────┴──────────────┘  +  🔍       │
│ Personal │     THREE TABS. CLICKING ONE REPLACES                  │
│          │     EVERYTHING BELOW IT.                          📄  ▣  ✦ │
│ Admin    │                                                │
│ Templates│      ┌──────────┐  1 item  ┌────────────┐       │
│ Insights │      │ When chat │────────▶│ HTTP       │       │
│ Help     │      │ message   │         │ Request    │       │
│          │      │ received  │         │ GET:       │       │
│          │      └────✓─────┘         └─────⚠──────┘       │
│          │        green tick            red triangle       │
│          │        = it ran              = it is broken     │
│          │                                                 │
│          │      [⤢] [＋] [－] [✨]   ← canvas toolbar       │
│          │              [ ⬤ Hide chat ]  ← REMOVES a region│
├──────────┴──────────────────┬──────────────────────┬───────┴──────┤
│ Chat         ⤢              │ Logs  [Clear exec]   │ OUTPUT   1it │
│ Session: 45f62c… ⟳          │                      │              │
│                             │ ⌄ When chat message  │ action │ s…  │
│     ▢ so you take them      │   received           │ ───────┼───  │
│       away whenever…        │   Success in 792ms   │ sendMe…│45f… │
│                             │                      │ chatIn…│so … │
│  { "action":"sendMessage",  │                      │              │
│    "sessionId":"45f62c…",   │                      │              │
│    "chatInput":"so you…" }  │                      │              │
│                             │                      │              │
│  [ Type message…      ▶ ]   │                      │              │
└─────────────────────────────┴──────────────────────┴──────────────┘
   ▲ appears when you    ▲ one row per step      ▲ refills with the
     run anything          showing its duration    step you click
```

Three things move on one click:

| What moves | What triggers it |
|---|---|
| The centre becomes `Editor`, `Executions`, or `Evaluations` | Clicking one of the three tabs across the top. The whole workspace is replaced. |
| The bottom strip appears or disappears | Running anything. |
| The `OUTPUT` pane empties and refills | Clicking a node on the canvas. |

---

## 4. Our screen

```
OURS — ONE FRAME, THREE SEATS
════════════════════════════════════════════════════════════════════════════
┌────────────────────────────────────────────────────────────────────────┐
│ ▤  Console · Composer · Evaluation · Variables · Metadata               │
├────────────────────┬──────────────────────┬────────────────────────────┤
│                    │                      │                            │
│  LEFT              │  CENTRE              │  RIGHT                     │
│  the instructions  │  THE CANVAS          │  the chat                  │
│                    │                      │                            │
│  System            │  ┌────────────────┐  │  conversation              │
│  User              │  │ [select ▾]     │  │                            │
│  Agent             │  └────────────────┘  │                            │
│  Tool Call         │   the plug-in seat   │                            │
│    figma node …    │                      │                            │
│                    │                      │                            │
│  ┌──────────────┐  │   ┌──────────────┐   │  ┌──────────────────────┐  │
│  │  Run  │ Save │  │   │ CLOSED until │   │  │  type message    ▶   │  │
│  └──────────────┘  │   │   a Run      │   │  └──────────────────────┘  │
│                    │   └──────────────┘   │                            │
│                    │                      │  ┌──────────────────────┐  │
│                    │  [md│raw│Copy│⟳│✕]  │  │ reserved space below │  │
│                    │   static placeholder │  │ the chat input       │  │
│                    │   for now            │  └──────────────────────┘  │
├────────────────────┴──────────────────────┴────────────────────────────┤
│  ◀──────── drag = park to a 60px rail, never remove ────────▶          │
└────────────────────────────────────────────────────────────────────────┘
```

**No bottom strip.** Every bottom-docked pane on their screen has been assigned to one of
these three seats, or left out.

---

## 5. Feature map

Verdict column: **Have** — same idea, in our own place. **Different** — same job, done
another way. **Not shown** — we decided the user does not need to see it. **Plug-in** — a
capability that arrives as a plug-in into the canvas. **Absent** — we do not have it.

### Top bar

| Their element | What it does there | Verdict | Ours |
|---|---|---|---|
| `Personal / My workflow` breadcrumb | Names the workflow, `…` menu to rename/duplicate | Have | The prompt package's name. A repair names itself `Repair — annotation-missing on prompt-textarea` (`WritingAreaIndex.tsx:1432`) |
| `Publish` + dropdown | Moves a workflow from draft to live | Absent | We have `Save` and a version number. There is no publish *state* in the data (`backend/routes/prompt_sessions.py:132`) |
| `Preview` chip on `AI Assistant` | Marks an unfinished feature as unfinished | Absent | We do not mark features this way |

### Left sidebar

| Their element | What it does there | Verdict | Ours |
|---|---|---|---|
| `AI Assistant · Overview · Personal` | Product-level navigation | Have | `Console · Composer · Evaluation · Variables · Metadata` (`LeftColumnHeader.tsx:120-124`) |
| `Admin Panel · Templates · Insights · Help` | Organisation-level navigation | Have | `LeftVerticalMenu.tsx` |
| Collapse arrow, top-left | Hides the sidebar | Different | Collapses to a 60px rail instead of hiding (`workspace-layout.ts:33`) |

### Centre — the canvas

| Their element | What it does there | Verdict | Ours |
|---|---|---|---|
| `Editor · Executions · Evaluations` tabs | **Replaces the entire centre area.** Three screens, swap on click | Different | Our top tabs choose which *surface* is assembled. They do not swap the canvas (`LeftColumnHeader.tsx:120-124`, `ai-surface-sandbox.ts:19-51`) |
| Two nodes joined by a curve | A workflow: trigger, then step. The graph is the artifact | Plug-in | Our canvas renders a result. An agent flow would arrive as a plug-in into the canvas selector |
| Green tick badge on a node | Marks a step that ran successfully | Different | A dead Run is reported inside the canvas: `⚠ This could not be generated.`, and `(no output yet)` / `Running…` otherwise (`compiled-output-viewer.ts:414-465`) |
| Red triangle badge on a node | **A warning pinned to the thing that is broken** | Different | The warning exists but lives in the chat column: health list `InteractiveChatInterface.tsx:1594-1615`, red alert `:1567-1572`, count on the nav badge `catalogHealth.ts:79-84` |
| `+` handle on a node | Appends the next step | Absent | We do not build flows |
| `⚡` bolt on a node | Pins test data for a step | Absent | A Run sends every section in one request (`WritingAreaIndex.tsx:2631`) |
| Canvas toolbar (fit, zoom, wand) | Navigates and test-runs the graph | Different | Run and Save are a control bar under the prompt, with `is-running` / `is-saving` states (`control-bar.ts`, `WritingAreaIndex.tsx:3211-3215`) |
| `Hide chat` pill | **Removes** a region | Different | We park to 60px and snap within 16px. It is never gone (`workspace-layout.ts:33-35`) |
| Clicking a node refills `OUTPUT` | The pane follows your selection | Different | Our canvas is written to by a Run and holds the package's saved output. It does not follow a click (`WritingAreaIndex.tsx:3229`) |

### Right rail

| Their element | What it does there | Verdict | Ours |
|---|---|---|---|
| `+`, search, note, panel, sparkle | Global shortcuts | Have | Six: `chat · trace · tools · evaluation · variables · metadata` (`chat-navigation-bar.ts:121-179`) |

---

### Bottom-docked panes — where each one goes

There is no bottom strip. This table is the redistribution.

| Their pane | What it does there | Verdict | Where it goes |
|---|---|---|---|
| `Session: 45f62c…` + replay | Names the run, re-runs it | Have | Carried on every element as `data-session-id`; `Regenerate` in the canvas (`compiled-output-viewer.ts:76-82`) |
| `Clear execution` | Clears **the record of a run** | Different | One `clear-output` today that clears **the artifact** and closes the canvas (`compiled-output-viewer.ts:84-86`, `WritingAreaIndex.tsx:2813`) |
| `Success in 792ms` | How long a step took | Different | Measured and never shown: `latency_ms` (`backend/routes/teacher.py:263-272`), `assembly_time_ms` (`WritingAreaIndex.tsx:1866`), written to `audit_logs`, readable at `backend/routes/ai.py:1380` — no screen |
| `1 item` badge | How many records a step produced | Have | Finding count on the nav badge, and `counts.total` in the health report (`catalogHealth.ts:33-40, 79-84`) |
| `Tokens` / `Cost` | What the run consumed | Have | `a2ui:usage` carries both (`WritingAreaIndex.tsx:1873-1880`), shown in the chat (`InteractiveChatInterface.tsx:1583-1590`), and drawn into the Figma panel as `Tokens: 2022 Cost: $0.00802` |
| Chat pane, with the trigger payload printed inline | The conversation, plus the raw JSON, always open | Different | The conversation is the **right column**. The payload is behind a labelled collapse (`WritingAreaIndex.tsx:3173`) |
| `Type message, or press 'up' for previous one` | Message box with ↑ history | Different | Message box yes, ↑ history no (`prompt-input-section.ts`) |
| A small field beside the word `Chat` | Looks like an endpoint or URL selector for the trigger | Not mapped | Unreadable at the resolution of the screenshot. Not guessed |
| `Logs` — one row per step with its duration | The trace of a single run, step by step | Different | `TraceFeed` is a **client** feed — browser logs, API breadcrumbs, Sentry — not a record of the run that just happened (`TraceFeed.tsx`, `InteractiveChatInterface.tsx:1435`) |
| `OUTPUT` table of the selected step's data | The structured data a step produced | Different | Our canvas renders the result as **prose**, parsed into headings, paragraphs, tables, lists, quotes, rules and code (`compiled-output-viewer.ts:95-140, 384-408`) |
| `⋯` menu on the output | Copy and export the data | Different | Buttons instead of a menu: `Rendered/Raw`, `Copy`, `Regenerate`, `Clear` (`compiled-output-viewer.ts:438-441`) |

### The one-line shape of it

Their centre area is three screens that replace each other, and their bottom strip is three
panes that appear, disappear and refill as you click — so every click moves something you
were reading. Our centre column is one canvas with a selector at its top that opens on Run,
and our side columns park at the edges instead of vanishing. **We cover most of what they
cover, in different places, and leave out what people do not need to see.**

---

## 6. Open questions

**O1 — What the canvas selector chooses.**
If it chooses *what kind of result the canvas is showing* (text output, agent flow, a
schematic), then run measurements and catalog warnings should stay put beneath it, because
leaving them means leaving the result. If it chooses *a screen* the way n8n's top tabs do,
then every switch takes the warnings and the measurements off screen with it — the behaviour
this comparison is trying to get away from. Not decided.

**O2 — Where the warning lives.**
`catalogHealth.ts` already carries the node each finding belongs to. The finding is
currently listed in the chat column only. n8n pins its warning to the row it describes. Not decided.

**O3 — The two meanings of `Clear`.**
n8n separates "clear the record" from "clear the output". We have one `clear-output` that
destroys the artifact. Fine while the canvas holds one thing. Not decided, and it only
becomes a defect once the canvas holds more than one.

**O4 — The bottom-of-chat space.**
Space is reserved on the right, under the chat input. What goes there is undecided.

**O5 — Four vocabularies for the same five seats. RESOLVED — and my first count was wrong.** *(corrected after a test disagreed with me)*

This began as "two vocabularies that share one seat". It is **four** vocabularies, and they share
**three** seats, not one. The wrong number came from comparing *values* while asking a question
about *seats* — and those two comparisons genuinely give different answers:

| comparison | result |
|---|---|
| value written vs. the enum | **1 of 5** — only `tool-call` is spelled canonically |
| seat, once spelling is normalised | **3 of 5** — `system-role`, `user-role`, `tool-call` |

A spot-check that asks "does any value look like the enum?" passes on `tool-call` and never looks
at the other four. That is how this stayed invisible. `frontend/src/test/promptSections.test.ts`
now asserts **both** numbers, so neither can be quoted by accident again.

The four authorities, in the order they were written:

1. **The schema** (enforced) — `system-role · user-role · tool-call · few-shot · constraints`
   (`tag-registry.ts:47`, `prompt-composer/catalog.json:531-538`).
2. **The editor** (what is stored in `_sections[].type`) — `system` / `user` / `agent` /
   `tool-call` / `custom-data`, plus `custom` (`:248`) and *any string at all* from a rename (`:306`).
3. **`TYPE_LABELS`** — ten keys for eight ideas.
4. **`CORE_ROLES`** (`WritingAreaIndex.tsx:2656`) — ten **display strings**, and this is the one
   that decides whether a section reaches the model as a core role or is dropped into
   `custom_roles`. It matches on `name`, and the save path overwrites `type` with `name` (`:783`),
   so what persists is a presentation string.

| UI tile | value written | in the enforced enum? |
|---|---|---|
| System Role (sticky) | `system` → now `system-role` | **yes**, once spelled out |
| User Role | `user` → now `user-role` | **yes**, once spelled out |
| Agent Role | `agent` → now `agent-role` | **yes** — it had NO seat; added (D11) |
| Tool Call | `tool-call` | **yes** — the only value that ever matched |
| Custom Data | `custom-data` | no |
| "Add Section" | `custom` (`prompt-section-editor.ts:248`) | no — **left undecided** |
| rename | `roleName` (`prompt-section-editor.ts:306`) | no — any string, **left undecided** |

The enforced enum also names two seats that have **no UI at all**: `few-shot` and `constraints`.

Why it stayed invisible: sections reach the server as
`context: JSON.stringify({ core_roles, custom_roles })` (`WritingAreaIndex.tsx:2669`), which
`teacher.py:223` runs `json.loads()` over. Free-form — the enum never gates that path. I searched
`frontend/src` and `backend` for `agent-role` and found only an unrelated CSS-class check
(`promptService.ts:1000`). No normaliser mapped one vocabulary onto the other. Not in
`OPEN-ITEMS.md` or `CHANGELOG.md`.

**Resolved — see D11.** `frontend/src/shared/promptSections.ts` now declares the seats once.
`TYPE_LABELS`, `SECTION_MENU_TYPES` and `CORE_ROLES` are derived from it, and `CORE_ROLE_LABELS`
is asserted to reproduce the literal it replaced, string for string — so the Run path's behaviour
is unchanged. This was a renaming, not a re-routing.

Two readings could not be decided from the code and are **listed rather than guessed**
(`UNDECIDED`): `custom` (Add Section) and the free-form `roleName`. Both are preserved as they
are. Neither is mapped onto a seat nobody agreed it is — a value with no seat keeps its own name
rather than acquiring a wrong one.

**The diagram is no longer blocked.** A shape can key off a stable canonical `id`.

**`agent-role` had no seat in the schema enum** — the most-used role in the product, and the enum
had never heard of it. That was fixed along with the rest: four of five shipped seats are now
declared. The fifth, `custom-data`, is attached material rather than a role — it reaches the model
through `custom_roles`, which this enum does not gate, so it is undeclared on purpose. The enum
still names two seats with no tile: `few-shot` and `constraints`.

**O6 — Two conventions for naming a tool, in the same text field.**

The picker writes `{{tool:generate_solar_system_design}}`. The repair flow writes
`tool figma.get_design_context` plus a `figma node` line. Both name a tool inside a section's
content, and they are not the same format. Anything that wants to read "which tool does this
section call" — a diagram most of all — has to understand both. Not decided.

---

## 7. What we are not doing

- Building a node graph or a flow canvas.
- Building a CAD viewer, a Figma adjuster, or an agent-flow view. Those are plug-ins.
- Adding a bottom strip or any fourth region.
- Adding a run-record screen or a per-step timeline.
- Showing the chat trigger's raw payload as conversation content.
- Asking anyone to build, assemble, or drag anything on the canvas. The sections they
  authored in the left column *are* the content (D8).

---

## 8. The product, stated plainly

> Structure your prompt to achieve something. Then watch how it performs over time.

That is the loop. Not: build a graph, wire it up, then run it. A person writes four fields,
presses Run, reads the result, and comes back later to see whether it is still performing.

Everything else follows from it:

- The **left** column is where the work is. It is authored, and it is resizable because
  authoring wants room.
- The **middle** column is where a result is *read*. It holds nothing the user must build.
- The **right** column answers "what should I do next."
- **Performance over time** is the part we measure and do not yet show: `latency_ms`
  (`backend/routes/teacher.py:263`), `assembly_time_ms` (`WritingAreaIndex.tsx:1866`),
  `audit_logs` (`backend/routes/ai.py:1380`), and tokens and cost (`a2ui:usage`,
  `WritingAreaIndex.tsx:1873-1880`). Four existing sources, no screen.

### Where a diagram can appear, and why only there

A diagram can only ever appear in the middle column. The left column is authored — you do not
diagram an input while somebody is typing in it. This is the same conclusion D1 and D2
already reach, arrived at from the other direction.

### A bound on "this is an automation application"

Today a Run makes exactly **one** tool call — `figma.get_design_context` — read out of the
Tool Call section (`WritingAreaIndex.tsx:2683`). There is no graph engine here, no branching,
no retries between steps, and one integration. Whether that grows is a separate question and
is not settled by this document. What is settled is that a person does not have to describe a
workflow for the system to do anything.
