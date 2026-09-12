# OPEN-ITEMS — the register

Every unresolved discrepancy in this repository, with the thing to cite it by.

**Tracked by git since 2026-09-12.** Before that this file lived in a locally
excluded directory (`.git/info/exclude`), where `git status` never showed it as
changed — so nothing ever prompted an update to it, and no clone had it at all.
A register that cannot be seen cannot be maintained. `catalog-check.mjs` now
asserts this file exists, is tracked, is not excluded, and **agrees with the run
it is part of** (`check: open-items-register`).

**Re-measured:** 2026-09-12, against `prompt-composer`
(`node frontend/scripts/catalog-check.mjs`). **The counts are scoped to that
pipeline**, because that is the one `deps.py` loads — an `--catalog ecommerce` run
checks a copy of it and is reported separately.

---

## How to cite a defect — three spaces, and they do not mix

**1 · `check:<class>` — machine-derived.** The class name from `CHECK_INVENTORY`
in `catalog-check.mjs`. Never quoted by count in prose: the count is *recorded*
below and *asserted* against the live run, so a stale number fails the build
instead of aging in silence. This is the space for anything the checker can see.

**2 · `check:<class>:<subject>` — one finding.** E.g.
`annotation-missing:prompt-textarea:40000746:95`, `tag-inert:run-button`. This is the
checker's own per-finding id, and it is what the console chat shows. A subject that is
a **node** carries the node, because two registry rows can resolve to one file (`#024`)
— and two nodes make two statements, so their ids must differ. Regenerate with:

    cd frontend && npm run catalog:check

**3 · `#NNN` — typed by a person.** THIS FILE owns these. They cover what no
checker can see: a flag nothing reads, an invariant with no assertion, a
behaviour that is `inferred` where it should be `verbatim`. They cannot be
derived, so they are typed — and typing is what drifts. That trade is the reason
this file exists.

**Coordination rule:** a thing's citation is `check:` when the checker can see it
and `#NNN` when it cannot. Do not number the same thing twice, and do not renumber.

**Closure rule:** an item closes only when **the thing that derived it stops
deriving it** — not when somebody edited a file. Every entry must name the check
that would retire it, or say why none is possible. An entry that can name neither
will rot, and is marked as such.

---

## The ledger

Machine-read: one row per check class, one row per typed item. The checker parses
these six columns and holds the `Recorded` column against the run. A check the
script knows how to run with no row here is a **blocking** finding, so a new check
cannot be added without a status.

| ID | Status | Owner | What it is | Recorded | Witness — what closes it |
|---|---|---|---|---|---|

| `check:annotation-missing` | open | designer | a resolved node carrying no annotation at all | 7 | `check:annotation-missing` → 0 |
| `check:annotation-prose` | open | designer | an annotation that says what the thing *is*, not what it *does* | 1 | `check:annotation-prose` → 0 |
| `check:event-unheard` | open | pipeline | a component dispatches an event nothing listens for | 12 | `check:event-unheard` → 0 |
| `check:provenance-missing` | open | pipeline | a built element with no `provenance` block | 15 | `check:provenance-missing` → 0 — **re-measured 2026-09-12: 16 → 15 when the check began counting the FILE once (`#024`), not once per registry row that resolves to it** |
| `check:tag-inert` | decided | pipeline | the allowlist offers the tag; nothing implements it — **see DECIDED below: implement** | 8 | `check:tag-inert` → 0, each of the 8 with an element + catalog entry |
| `check:geometry-drift` | open | pipeline | the node and the rendering disagree (`chat-navigation-bar`) | 1 | `check:geometry-drift` → 0 |
| `check:schema-absent` | open | pipeline | in one gate, missing from the other (`ai-surface-sandbox`, **ecommerce only**) | 0 | `check:schema-absent` → 0 in both catalogs |
| `check:allowlist-absent` | closed | pipeline | renders, but is not in `tag-registry.ts` | 0 | `check:allowlist-absent` → 0 |
| `check:component-missing` | closed | pipeline | the map named a source that does not exist (`functions-wrap`) | 0 | `check:component-missing` → 0 — **closed by `493d932`, which left #024 behind** |
| `check:node-id-absent` | closed | pipeline | a node-derived component with no node id anywhere | 0 | `check:node-id-absent` → 0 |
| `check:node-unresolved` | closed | pipeline | a `figmaNodeId` the file no longer contains | 0 | `check:node-unresolved` → 0 |
| `check:element-unclaimed` | closed | pipeline | a `data-tag` with no matching element (3 false alarms, fixed in `493d932`) | 0 | `check:element-unclaimed` → 0 |
| `check:attr-hardcoded` | closed | pipeline | the untrusted annotation attribute name, typed in | 0 | `check:attr-hardcoded` → 0 |
| `check:doc-claim-drift` | closed | pipeline | a document states something about this catalog that is false | 0 | `check:doc-claim-drift` → 0 — **fired twice on 2026-09-12 (`README` said 28; a phantom name); both corrected** |
| `check:container-undeclared` | watching | pipeline | a component drawn inside a container that does not declare it | 0 | `check:container-undeclared` → 0 |
| `check:primitive-missing` | watching | pipeline | a theme that drops the shared primitive floor | 0 | `check:primitive-missing` → 0 |
| `check:primitive-drift` | watching | pipeline | one component, two definitions of it | 0 | `check:primitive-drift` → 0 |
| `check:schema-unreachable` | watching | pipeline | a published catalog a client would reject | 0 | `check:schema-unreachable` → 0 |
| `check:check-could-not-run` | watching | pipeline | the report does not know what it is talking about | — | `no check is possible` — this class counts **whether the machine could reach Figma**, not anything about the tree: 0 with a token, 1 without (`--offline`, or a clone — proved 2026-09-12: a fresh `git clone` with no token derived 1 while a number here said 0 and made the run RED for something nobody can fix). No derivation can make a run complete, so this row records the environment dependence instead of a number — see the note under this table |
| `check:clean-no-jsx` | watching | pipeline | no React / JSX / Tailwind in the component sources | 0 | `check:clean-no-jsx` → 0 — a **pass**, kept deliberately |
| `check:open-items-register` | watching | pipeline | this file: present, tracked, un-excluded, agreeing with the run | 0 | `check:open-items-register` → 0 |

`open` = derives findings now · `decided` = a ruling has been made, the work has
not landed · `in-progress` = the work is in the tree, unmerged · `watching` = a
guard with nothing to clear · `closed` = it used to derive findings and no longer
does.

**The counts above are the only numbers in this file that are asserted.** That is
the point: a `#NNN` entry's status is a person's word, and the register says so
rather than pretending otherwise.

**`—` means "this count is about the machine, not the tree."** Exactly one class
qualifies — `check:check-could-not-run`, which counts whether Figma answered — and the
checker knows that class by name (`ENV_SCOPED`). A `—` on any other class is a
**blocking** finding, because deleting a stale number is how a stale number hides: the
comparison only holds a class that has a number to hold. A second environment-scoped
class cannot slip in silently either — it shows up as a count mismatch the first time
anyone runs `--offline`.

| `#001` | open | designer | `annotation-missing:prompt-container:40000746:6` "left-column-panel-container" | — | `check:annotation-missing` → 0 |
| `#002` | open | designer | `annotation-missing:model-selector-button:40000909:4322` | — | `check:annotation-missing` → 0 |
| `#003` | open | designer | `annotation-missing:status-bar-prompt-input:40000878:239` | — | `check:annotation-missing` → 0 |
| `#004` | open | designer | `annotation-missing:prompt-textarea:40000746:95` | — | `check:annotation-missing` → 0 |
| `#005` | open | designer | `annotation-missing:prompt-input-section:40000909:4005` + `…:40000746:94` — two nodes claim one file; see `#024` | — | `check:annotation-missing` → 0 |
| `#006` | open | designer | `annotation-prose:role-dropdown:40000934:22851`; rewrite as fields: Data / On click / State / A11y | — | `check:annotation-prose` → 0 |
| `#007` | closed | designer | `annotation-prose:chat-navigation-bar` — the note said only *"Chat button selected"* | — | **closed 2026-09-12: `check:annotation-prose` stopped deriving it.** The entry now carries both halves of the spec, `selectedState`/`closedState` are `verbatim`, and `collapsedState` — the field this item existed for — is gone from the tree entirely |
| `#008` | open | pipeline | `grace_greeting: True` is set and read by nothing (`routes/ai.py:784`) | — | `no check is possible today` — a flag nothing reads has no derivation; closes when it is wired or deleted |
| `#009` | open | pipeline | `ai_message` values typed by the system and attributed to her (`ai.py:252`; fallbacks `:414`, `:562`, `:924`) — the two prompt **templates** that made her greet are gone (2026-09-12: console `:381`, session `:888`) | — | `no check is possible today` — needs the decision first: which of these are the system speaking, and labelled as such |
| `#010` | open | pipeline | `a2ui:user-message` is dispatched (`WritingAreaIndex.tsx:264`) and heard by nothing | — | `no check is possible today` — `check:event-unheard` covers the allowlist, not window channels; closes when the listener exists or a window-channel audit does |
| `#011` | open | pipeline | the annotation attribute names disagree across three records | — | `no check is possible today` — the contract file this item would fix (`.clinerules/figma-to-lit.md`) is **not in the tree**; see the entry for the three-way split |
| `#012` | open | pipeline | `chat-panel` has no element — both catalogs reserve the name and `COMPOSITE_MAP` resolves it | — | no check sees a reserved name with no element — closes when a `customElements.define('chat-panel'` is in the tree, or the name maps to whatever owns that seat now |
| `#013` | open | pipeline | the composer's model tree still puts a chat panel *inside* the surface (`ai.py:634`, `:648`, `:866`, `:882`) | — | no check reads a prompt's topology today — closes when the prompt stops declaring her as a column of the surface; until then only a human reading it sees this |

| `#014` | open | pipeline | "the renderer is a shadow, not the surface" — **the premise no longer matches the tree** | — | no check tests mount parity — close with parity evidence: `<a2ui-renderer>` is mounted at `WritingAreaIndex.tsx:3085` inside `slot="console"`, visible, and no `display:none` renderer mount remains |
| `#015` | open | pipeline | the hidden mount meant geometry could not be compared (`getBoundingClientRect()` → zeros) | — | no check can see it once nothing is hidden — the same premise as `#014`; if nothing is hidden, this closes with it |
| `#016` | open | pipeline | the console's 2-column left gripper is inert (Grace left the surface) | — | `no check is possible — it is a layout truth, not a data one`; closes by removing the gripper for real, or confirming it is wanted |
| `#017` | open | pipeline | `consoleChatWidth` / `isConsoleChatCollapsed` govern both surfaces, named for one | — | a rename; `no check is possible today` |
| `#018` | open | pipeline | nothing runs the guards automatically — no CI, no pre-commit hook | — | no check is possible until one exists — a pre-commit hook or CI step running `npm run typecheck && npx vitest run`. **The item that would have made #20a's swallowed failures impossible** |
| `#019` | open | pipeline | `role_caps.py` and `InteractiveChatInterface.tsx` cite `frontend/src/shared/role-caps.ts` — 4 references, no such file | — | no check reads a comment's file reference — closes when the file exists, or the references are corrected (`INDEX.md` was corrected 2026-09-12) |
| `#020` | open | pipeline | 5 `async def` handlers in `routes/ai.py` await nothing (`:116`, `:1018`, `:1102`, `:1351`, `:1376`) | — | no check counts constructs — a reader does: they are plain `def`, and each holds a worker for its duration instead of yielding, which is what FastAPI expects for sync work |
| `#021` | closed | pipeline | WATCH: temperature `0.6` raises the 503-on-unparseable risk at assembly | — | no check is possible — a temperature is a dial a person sets. **Closed 2026-09-12: re-measured — no `0.6` anywhere in `backend/`**; the four calls it named are back at `0.0` (`ai.py:390`, `:540`, `:666`, `:895`) |
| `#022` | open | designer | `chat-button` dispatches `tab-change { tab: "chat conversations" }`; the element emits `{ tab: 'chat' }` | — | `no check is possible — both sides emit the same event name`; closes when the payload string is chosen. Detail recorded in `registry.json` → `gaps` |
| `#023` | open | pipeline | the `chat-menu-item` frame's inset shadow is carried in `values` and rendered by nothing (`node 40001010:25749`) | — | no check holds a `values` entry against the CSS — closes when the inset shadow is in the CSS, or dropped from `values`. Detail recorded in `registry.json` → `gaps` |
| `#024` | open | pipeline | two registry entries resolve to one component file — one of them from a node named `functions` | — | closes when one entry remains per file: merge the two source nodes' claims, or correct the node id. The duplicate ids it caused are fixed (2026-09-12: node-scoped ids carry the node; `check:provenance-missing` counts the file once) — what stays open is the claim itself, and no check can decide it: `check:annotation-missing` and `check:provenance-missing` see two rows, not which one is honest. **Created by `493d932`** |
| `#025` | open | designer | the `chat-menu-item` rail-button constraint has two homes and `provenance: inferred` | — | the designer supplies the constraint as an annotation, or the split is confirmed wanted. `no check is possible today` — `check:geometry-drift` compares rendered geometry against a named node, not a container rule |

| `#026` | open | pipeline | `RESTART-LOCAL.sh` is gitignored, so a fix to the launcher never enters history | — | no check can see a `.gitignore` rule's consequence — closes when the launcher is tracked, or the fix it carries moves into tracked code. **`#20a`'s fix is in this file and nowhere else** — it exists on one machine |
| `#027` | open | pipeline | `frontend/src/storybook/documentation/A2UI_SPEC_COMPLIANCE.md` cites `backend/main.py` lines 2670–2799 | — | the citations name the endpoint where it now lives (`routes/ai.py`). `no check today` — `check:doc-claim-drift` reads `README.md` and `IMPLEMENTATION_CONFORMANCE.md` only. That document is dated 2026-07-20, before the A2UI restoration |

---

## DECIDED — `check:tag-inert`: **implement the 8**

Ruling: **implement**, and do not answer this by removing the tags from the
allowlist. Decided 2026-09-12 after this session's audit. Recorded here because a
decision that is not written down is re-litigated, and because the closure test has
to be visible before the work starts.

Removing the 8 from `tag-registry.ts` would also empty the finding — but it would
empty it by shrinking what the model is allowed to draw, which is the opposite of
closing the gap. The pipeline can hand the surface a `run-button` today; nothing
renders it. That is a silent loss, not a tidy-up.

**The 8** (from `check:tag-inert`, this run):

    run-button   layout-row   layout-col   status-indicator
    dynamic-button   undo   redo   export

**What each one needs — all four, or it is not implemented:**

1. **An element** in `frontend/src/components/lit/` — `customElements.define(...)`,
   no React, no Tailwind (`check:clean-no-jsx` holds that line for every source).
2. **A catalog entry** in the pipeline's `catalog.json`. Watch the traps: allowlist +
   schema + renderer are three different lists, and `check:schema-absent` fires when a
   tag is in one gate and missing from the other.
3. **A `registry.json` entry** with a `provenance` block — otherwise this trades a
   `tag-inert` finding for a `provenance-missing` one, which is not progress.
4. **Design values from a real pull.** Invented geometry, fills, or typography are
   forbidden. Where Figma has no node for the element (a composition), the entry says
   so explicitly — `#012` is what happens when a reserved name has no home.

**The prerequisite that makes this bigger than it looks:** an element with no
annotation ships invented behaviour — that is the whole finding class in section A
(`#001`–`#006`), and `event-unheard` is where the inventions show up. `run-button`,
`dynamic-button`, `undo`, `redo` and `export` are **actions**: without an
`On click:` the event names get invented. `layout-row`, `layout-col` and
`status-indicator` are presentation only, so they can be built from geometry and
state alone.

**Done when:** `check:tag-inert` reports **0** — and each of the 8 has an element, a
catalog entry, a provenance block, and (for the five actions) a behaviour that is
`verbatim` from an annotation, or explicitly marked `inferred` with the reason.

---

## Retired numbering — do not reuse these

The audit that produced the entries below quoted defects by **session-local numbers**
(`#7`, `#8`, `#12`, `#16`…) taken from the row order of files that are not in the
tree (`FIGMA/AGENT_OPEN_GAPS.md` §3) or from a goal statement. Those numbers were
never durable, and three of them **shadowed existing `#NNN` entries that mean
something else**. They are mapped here once so the collisions are dead:

| Quoted as | What it actually meant | Durable citation now |
|---|---|---|
| session `#7` | the 8 allowlist tags nothing implements | `check:tag-inert` → **DECIDED: implement** (see above) |
| session `#8` | 12 dispatched events nothing hears | `check:event-unheard` |
| session `#9` | 16 built elements with no `provenance` block | `check:provenance-missing` |
| session `#10` | `registry.json` did not name `prompt-input-section` | closed in `493d932` (`check:component-missing`) — **and it left `#024` behind** |
| session `#11` | `status-bar-prompt-input` carried no node ids | closed in `493d932` (`check:node-id-absent`, now pinned by a test) |
| session `#12` | the `chat-menu-item` constraint split | **`#025`** |
| session `#13` | the hardcoded `EXPECTED_ANNOTATION_ATTR` constant | closed in `493d932` (`check:attr-hardcoded`) |
| session `#16` | severity had no single home (`BLOCKING`) | closed in `493d932` — **collides with `#016`** (the inert left gripper, unrelated) |
| session `#17` | no census: a check that never ran looked like one that passed | closed in `493d932` (`check:check-could-not-run`) — **collides with `#017`** (the `consoleChatWidth` names, unrelated) |
| session `#18` | `element-unclaimed` raised 3 false alarms | closed in `493d932` — **collides with `#018`** (nothing runs the guards, unrelated) |
| session `#19` | the resilience pass: the launcher, this register | this file; `#026` for the part that could not be committed |
| session `#20a` | `RESTART-LOCAL.sh` reported failures it had swallowed | fixed 2026-09-12 — **`#026`: the fix is in a gitignored file** |
| session `#20b` | `README`/conformance stated 28; the catalog defines 37 | closed in `493d932` (`check:doc-claim-drift`, now blocking) — **`#027` is the same defect class, unfixed, in another document** |

**The lesson the table encodes:** a number is only durable if something other than
memory checks it. `check:` citations are checked by the run; `#NNN` citations are
checked by this file's ledger, which is checked by the run. A number that lives in
neither will be quoted out of position within a week — as three of these were.

---

## Detail — the entries a table cell cannot carry

**`#011` — three records, three different names.** `registry.json` →
`chat-button.annotationChannel.attributeNameFound` records the names actually
observed: `data-annotations` (the state note) and `data-interaction-annotations`
(the `On click:` contract) — *two* attributes carrying *different halves* of one
spec, which is why an implementation expecting a single attribute loses the half
that makes behaviour `verbatim`. `frontend/src/design/VALUES.json` →
`_meta.annotationAttributeNames` still records `["data-development-annotations"]`
— the stale single name from the pull that saw none of them. The contract that
states it (`.clinerules/figma-to-lit.md` §9.3) is not in the tree. So the item
cannot close by editing the file it names: it closes when the recorded names agree
*and* the contract returns or is retired. **Re-measured 2026-09-12:**

    registry.json  ["data-annotations", "data-interaction-annotations"]
    VALUES.json    ["data-development-annotations"]
    contract       not in the tree

**`#024` — two entries, one file, two findings with the same id.** `registry.json`
holds both of these (verified this session):

    { "figmaName": "functions",             "figmaNodeId": "40000909:4005",
      "litComponent": "prompt-input-section",
      "file": ".../lit/prompt-input/prompt-input-section.ts", "status": "built" }
    { "figmaName": "prompt-input-section",  "figmaNodeId": "40000746:94",
      "litComponent": "prompt-input-section",
      "file": ".../lit/prompt-input/prompt-input-section.ts", "status": "built" }

Consequence, measured: the run reported **45 open findings but only 43 distinct
ids** — `annotation-missing:prompt-input-section` and
`provenance-missing:prompt-input-section` each appeared twice — and the chat rendered
that list under duplicate React keys on every 30s poll. **The collisions are fixed
(2026-09-12)** — the run now reports **44 open findings with 44 distinct ids** — **and they
were two different defects:**

- `provenance-missing`'s subject is the **FILE** — which fields came from the design and
  which were invented. Two rows resolving to one file is one problem, so it is counted
  once per file: the run derives **15**, not 16. Which row speaks for the file is the row
  whose `figmaName` **is** the component — `40000746:94`, the section root — and not
  whichever row the iteration reaches first. The node id is not decoration: a repair is
  told to open it (`WritingAreaIndex.tsx:1270` writes `figma node <id>` into the brief), so
  a file-level finding has to name the node the file answers to.
- `annotation-missing`'s subject is the **NODE**. Each node makes its own statement —
  *"Node 40000909:4005 ("functions", FRAME) resolves but carries no annotation"* is not
  the statement about `40000746:94` — so the id carries the node, through `add()`'s `key`
  parameter. **7 findings, unchanged: both nodes are still reported.** It matters that it
  is an id and not a display choice: a repair click looks a finding up *by id*, so two
  findings sharing one id repaired whichever came first (`WritingAreaIndex.tsx:1410`).

What the tree says, measured — the two rows name two different nodes of one file:
`prompt-input-section.ts` draws `40000909:4005` on its **inner** `.functions-wrap` div
(`:282`) and `40000746:94` on the section's root (`.responsive-prompt-container`, `:269`).

`493d932` created this by pointing the `functions` entry at
`prompt-input-section.ts` (it had named `functions-wrap`, which had no source —
`check:component-missing`). The open question is not mechanical: **is the
`functions` frame the section editor, or is that node id wrong?** One of the two
entries is the wrong claim, and only the designer can say which.

**`#014` / `#015` — the premise moved.** Both entries describe a renderer that
"renders beside `ConsolePage`, behind `display:none`". No such mount is in
`WritingAreaIndex.tsx` today: the surface is `<ai-surface-sandbox>` with `console`,
`workspace` and `spinner` slots, and the only `display: none` in the tree is not a
renderer mount. The geometry consequence in `#015` therefore does not hold either.
Neither is closed here, because "the shadow was swapped for the real thing" is a
claim about parity that this session did not test — close them with the parity
evidence, or rewrite them. What the tree does say, measured: `<a2ui-renderer>` is
mounted at `WritingAreaIndex.tsx:3085`, inside `slot="console"`, visible, and the
comment above it (`:3070`) states that the duplication which kept the mount
off-screen "is gone". `main.tsx:27`'s comment is accurate — it was checked, and it
was very nearly recorded here as stale because a `| head` made the search that
found the mount finite (see the journal's M15).

---

*Keep this file current. The checker fails the build when a recorded count, a
cited `#NNN`, a check's accounting, or this file's own tracked status drifts — so
"someone will notice" is not the mechanism. This is.*

