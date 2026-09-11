# Open Items — the numbered register

Every unresolved discrepancy, with the number to quote it by.

## Two ID spaces, deliberately

- **The CHECKER owns `check:component`** — e.g. `annotation-missing:prompt-textarea`.
  Machine-derived, regenerated on every build from `frontend/catalog-audit/<catalog>.json`.
  It **cannot drift**, because nobody types it. It is also what the app shows you.

- **THIS FILE owns `#NNN`** — for the things no checker can see: a flag nothing
  reads, an invariant with no assertion, a behaviour that is `inferred` where it
  should be `verbatim`. These cannot be derived, so they are typed — and typing is
  what drifts. That trade is the reason this file exists.

**Coordination rule:** an item's number is the checker ID when the checker can see
it, and a `#NNN` when it cannot. Do not number the same thing twice.

**Closure rule:** an item closes only when **the thing that derived it stops
deriving it.** A `#NNN` entry that cannot name the check which would replace it
will rot — so it must name one, or say why none is possible.

Regenerate the checker half with:

    cd frontend && npm run catalog:check

---

## A · Yours — 7 items, identical in both catalogs

All advisory. All the same shape: **a node the pipeline resolves, that carries no
usable behavioural spec**, so the agent invents the behaviour and the invention is
what ships.

| # | Checker ID | Node | File to follow |
|---|---|---|---|
| **#001** | `annotation-missing:prompt-container` | `40000746:6` "left-column-panel-container" | `FIGMA/ANNOTATION_FIGMA_GUIDE.md` |
| **#002** | `annotation-missing:model-selector-button` | `40000909:4322` "Function - Model Selector Button" | same |
| **#003** | `annotation-missing:status-bar-prompt-input` | `40000878:239` "status-bar-prompt-input" | same |
| **#004** | `annotation-missing:prompt-textarea` | `40000746:95` "prompt-textarea" | same |
| **#005** | `annotation-missing:prompt-input-section` | `40000746:94` "prompt-input-section" | same |
| **#006** | `annotation-prose:role-dropdown` | `40000934:22851` | rewrite as fields — Data / On click / State / A11y |
| **#007** | `annotation-prose:chat-navigation-bar` | `40001010:25768` "chat-button" | same — the note says only *"Chat button selected"* |

**#007 is the live example.** That note covers the selected state — which is why
`selectedState` is `verbatim` in `registry.json` — and says nothing about the
collapsed state, which is why `collapsedState` is `inferred`. The flash rule is
mine, not the designer's, and only an annotation can change that.

**When #001–#005, #006 and #007 close:** the checker stops deriving them. That is
the test — not that somebody edited the file.

---

## B · Mine — pipeline-owned, auto-tracked (62 of 69)

These need no numbers: the checker names each one (`check:component`) and
re-derives it every build. Counts as of `2026-09-11T16:21`:

| Check | Count | What it is |
|---|---|---|
| `event-unheard` | 17 | a component dispatches an event nothing listens for |
| `provenance-missing` | 16 | built element with no `provenance` in `registry.json` |
| `allowlist-absent` | 10 | renders, but is not in `tag-registry.ts` |
| `tag-inert` | 9 | in the allowlist, but nothing renders it |
| `node-unresolved` | 4 | `figmaNodeId` that the file no longer contains |
| `element-unclaimed` | 3 | `data-tag` with no matching element |
| `component-missing` | 1 | reference to a component that does not exist |
| `node-id-absent` | 1 | built element with no `figmaNodeId` at all |
| `attr-hardcoded` | 1 | value that should come from the design, typed in |
| `schema-absent` | 1 | (ecommerce only) in one gate, missing from the other |

`clean-no-jsx` is the single **pass**: no React, no JSX, no Tailwind in any of the
19 component sources.

---

## C · No checker can see these — typed, numbered, mine to keep honest

Each names the check that would retire it. Where an item cannot name one, it says
so — that is the honest answer, and it is also the item most likely to rot.

**#008 — `grace_greeting: True` is set and read by nothing.**
`backend/routes/ai.py:801`. Either wire it or delete it; a flag nothing reads is a
claim the code stopped making.
*Opened, closed, and re-opened the same day: it was deleted, then the backend was
reverted to `b6d6309` and it came back. Nothing derives this key, so nothing caught
the regression — which is exactly what the entry is for.*

**#009 — Three `ai_message` values are typed by the system and attributed to her.**
The unsaved-work decision (`ai.py:252`, `ai.py:1060` fallback) and the action status
readouts (`ai.py:1323`). She says it, or the system says it — not the system saying it
in her voice. The decision dialog needs *something*, so this is really "decide which
of these are the system speaking and label them as such".
*Closes when:* no `ai_message` is assigned a literal outside a prompt.
*No check is possible today; this needs a decision first.*

**#010 — `a2ui:user-message` is dispatched and unheard.**
The surface renderer routes `message-sent` there; nothing listens. `event-unheard`
covers the allowlist, not window channels — so the checker cannot see this one.
*Closes when:* a window-channel audit exists, or the listener does.

**#011 — The annotation attribute names differ from the contract.**
`.clinerules/figma-to-lit.md` §2 records the observed name as
`data-development-annotations`. Node `40001010:25768` carries `data-annotations` and
`data-interaction-annotations` instead — and my `get_figma_data` pull returned none of
them. The contract's "observed name" is stale; §2's rule (treat it as untrusted, match
`/^data-.*annotation/i`) is what caught it.
*Closes when:* the contract lists the names actually seen, with dates.

**#012 — `chat-panel` has no element.**
Both catalogs reserve the name and `COMPOSITE_MAP` resolves it to `chat-panel`, but no
such custom element is defined — so the renderer draws an empty unknown tag when the
model emits one.
*Closes when:* the element exists, or the name maps to whatever owns that seat now.

**#013 — The composer's model tree still puts a chat panel inside the surface.**
`ai.py:878-882` tells the model to emit `right-col: chat-panel` inside
`workspace-layout`. Grace now lives *outside* the surface, so the prompt and the
topology disagree: the renderer would draw a second seat for her, and `conversationId`
binds to a chat that is not there.
*Closes when:* the prompt stops declaring her as a column of the surface.

**#014 — The renderer is a shadow, not the surface.**
It renders beside `ConsolePage`, behind `display:none`. Authoritative is blocked on
parity evidence across all three surfaces — and #013 has to close first, or the swap
bakes the wrong topology in.
*Closes when:* the `data-a2ui-id` diff is clean for one full assembly cycle per surface.

**#015 — The shadow mount is hidden, so geometry cannot be compared.**
`display:none` means `getBoundingClientRect()` returns zeros. Structure and content
diff fine; measured size cannot. Move to `position:absolute; left:-99999px` if size
parity is ever needed (`WritingAreaIndex.tsx`, the SHADOW SURFACE block).
*Closes when:* #014 closes on a structure-only diff, or the mount moves off-screen.

**#016 — The console's 2-column left gripper is inert.**
Grace left the surface, so `workspace-layout`'s left gripper has nothing to divide in
2-column mode and is collapsed. Correct, but a behaviour change nobody chose.
*Closes when:* the gripper is removed for real, or confirmed wanted.
*No check is possible — it is a layout truth, not a data one.*

**#017 — `consoleChatWidth` / `isConsoleChatCollapsed` now govern both surfaces.**
Named for one, used by two. Cosmetic; the names are now lies.
*Closes when:* renamed.

**#018 — Nothing runs the guards automatically.**
`npm run typecheck` and `npx vitest run` are scripts. No CI and no pre-commit hook
invokes them, so `tsc --noEmit -p tsconfig.json` — the check that inspects zero files —
can still be believed by whoever types it next.
*Closes when:* a pre-commit hook or CI step runs `npm run typecheck && npx vitest run`.

**#019 — `role_caps.py` tells the reader to edit a file that does not exist.**
`backend/role_caps.py:31` and `InteractiveChatInterface.tsx:228` both point at
`frontend/src/shared/role-caps.ts`. There is no such file, so the two role sources
they describe can drift with nothing to catch it.
*Closes when:* the file exists, or the references are corrected.

**#020 — 5 `async def` handlers in `routes/ai.py` await nothing.**
`ai_manifest`, `ai_confirm_exit`, `ai_save_surface`, `ai_role_capabilities`,
`api_admin_audit_logs`. Each holds a worker for its duration instead of yielding.
*Closes when:* they are plain `def`, which is what FastAPI expects for sync work.

**#021 — WATCH: temperature 0.6 raises the 503-on-unparseable risk.**
The four assembly calls moved off 0.0 to stop Grace repeating herself. The JSON
contract is now held by the system prompt and the validation, not by determinism. A
rise in `503 A2UI FAILURE` at assembly is this dial, and it is one line to lower.
*Closes when:* a few weeks of assemblies produce no parse failures.
