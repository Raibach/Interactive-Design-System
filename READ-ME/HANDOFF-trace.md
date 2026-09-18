# Handoff — finish the Trace view, then audit the assembly against the protocol

Read this first. Then read `AGENTS-instructions/Components-Structure.md` — the one
file from that folder nobody has opened yet.

## The goal for this session: Trace, and nothing else

One button. `Trace` in the console's chat rail. The expected behaviour, in the
operator's words:

> I should click on it, it should expand, I should see a spinner, and it should load
> the content of that slot.

**All three steps are done and SEEN** (fresh page, measured):

| | column width | active tab | view slot |
|---|---|---|---|
| on load | 74px | chat | absent |
| after one click on Trace | **726px** | **trace** | **present**, feed drawing real entries |

It was broken because the rail's tab click un-hid the panel body inside a 74px
collapsed pane — the column never opened, so the click looked like nothing. Fixed in
`workspace-layout._onTabChange`: a non-empty tab sets `isThirdOpen = true`, an empty
tab closes it.

**Everything built in this session is written up in `READ-ME/TRACE-VIEW.md`** — the
path end to end, the writer decision and what it costs, the measurements, the defect
that only looking found, and the parts that were written but NOT seen. Read that
rather than this section; this one is now history.

- **2 — the spinner.** Built. `chat-panel` draws "Loading the <tab> view…" with a
  spinner while a non-chat tab is active and the `view` slot has nothing assigned.
- **3 — the content.** Built. All three assemblers emit `trace-view` into the panel's
  `view` slot, bound to `/trace/entries` and `/trace/breadcrumbCount`.
- **4 — the data is bound, and the client is the writer.** `lib/trace-source.ts` owns
  the reads; `WritingAreaIndex` writes the path, and re-asserts it on every assembly
  because an assembly replaces the whole model. The element fetches nothing.

## One more defect, found by looking rather than by a test

The surface's new child in the panel's `view` slot made `_seatSlotted()`'s fallback
(`this.children.length > 0`) read as "the host handed me a seat" — so the panel drew
the seat slot in place of its entire body and **the rail vanished**, leaving an 82px
empty collapsed column with no Trace button to click. A child that names another slot
is not a seat. Three regression tests were added, and two of them were confirmed to
fail without the fix.

This is the same lesson as the verification gate, one level down: the component tests
passed the whole time. None of them asserted the rail was still on screen.

## Facts already established — do not re-derive

- The data IS reachable, and it reaches the feed by BINDING now, not by the element
  fetching it: `/trace/entries` holds the entries (`POST /api/ai/assemble-surface`,
  `GET /api/conversations/…/messages`) and the reads live in `lib/trace-source.ts`.
  Measured on the dev page: the logger is the only source that contributes —
  `breadcrumbCount` was **0** against 8 entries, because `lib/sentry.ts` returns early
  when `MODE === 'development'`. Sentry contributes nothing here until a build.
- The renderer creates a component only when it is in the tree and removes it when
  it leaves. Verified both directions — nothing draws outside the model.
- The panel has **one** `view` slot, and that is what the design draws
  (`chat-output-simple-slot-area`). A per-tab-slot scheme was tried and reverted;
  the design's answer is one generic hole fed by the surface.
- Named-slot children (`children: {"left": "a", "right": "b"}`) is a LOCAL extension
  of ours. The spec's `children` is an array or a template `{path, componentId}`.
  Write it down as an extension, do not present it as spec.
- The renderer must keep the release-stale-props behaviour and the `:host` height —
  both were needed to make the surface render at all.

## Five traps that cost hours here

1. **A backtick inside a Lit `css\`\`` or `html\`\`` literal ends the literal.**
   Three times, always in a comment. `tsc --noEmit` reports SUCCESS on it — it is
   valid TypeScript — while esbuild fails and Vite shows a build overlay instead of
   the app. **Compile the file with esbuild before believing any check:**
   `npx esbuild <file> --outfile=/tmp/o.js --log-level=error`
2. **The server reads the catalog at STARTUP.** After editing any catalog, restart
   the backend (`uvicorn` runs without `--reload`) or it keeps refusing a component
   you just added, with `Component '<X>' is not in the trusted catalog`.
3. **The 503s are mostly the model timing out.** The surface mode has a hard 10s cap
   (`grace_gui.LLM_TIMEOUT`, `SURFACE_MODES`) and the provider answers in 8–20s. Ask
   the log which it is (`[DeepSeek API] Failed: Request timed out.`) before touching
   the frontend. Do NOT raise the cap — the owner has refused that explicitly.
4. **A prop the payload stops sending stays on the element.** Fixed in the renderer
   (it now releases them), but keep it that way.
5. **A payload flag the operator can also toggle fights them.** Open/closed belongs
   to the element that owns the width, never re-asserted by every assembly. **This
   one is no longer a warning — it is a bug that fired, and it is fixed.** The
   renderer re-applies every payload prop when the DATA MODEL changes, not only when
   an assembly lands, so writing `/trace` on every log line re-asserted
   `isThirdOpen: false` and closed the column the operator had just opened. See
   `TRACE-VIEW.md` for the proof and the fix (`workspace-layout` owns the flag).

## Verification gate — the rule this session must not break

Nothing is reported as done until it has been SEEN on a freshly loaded page, with a
measurement or a screenshot. Twice in the previous session work was reported complete
that had never rendered. Say "written, not seen" when that is the truth.

## Then: the retrospective — is the surface assembled according to the protocol?

Not a rewrite. An audit, file by file in `AGENTS-instructions/`, of where the
implementation and the protocol disagree. Known findings to confirm or correct:

- **Bindings** — displayed values should come from the data model by `{path}`, not
  from components fetching their own. The trace feed is the example.
- **Tab switching is a `functionCall`**, not a DOM event: `Handling-User-Actions.md`
  names "switching tabs" as a renderer-local Function. Ours are window events.
- **`VALIDATION_FAILED` is a feedback loop to the agent** for self-correction. We
  render it beautifully and never send it back, so the model cannot fix itself.
- **`functions` and `theme`** exist in the catalog schema (`catalogs.md`) and our
  catalog has neither. Tab switching belongs there.
- **The transport has no return path.** `transports.md`: A2A and AG-UI are stable,
  REST is "planned"; ours is a one-shot POST. So no `action` back to the agent, no
  `sendDataModel`, no streaming, no progressive rendering.
- **The validator is stricter than the spec's floor** (it refuses the whole surface
  on one unknown component; the spec permits skip-and-continue). The owner chose
  this and it caught a real mistake — do not call it wrong, do call it a choice.
- **State of the repo:** `tsc` clean, 247 frontend tests pass, `catalog:check` has
  **1** blocking finding — `corrections-ledger`, which is pre-existing and needs a
  file this work does not touch (`OPEN-ITEMS.md` #021). The other pre-existing red,
  the open-items register count, is **fixed**: `<trace-feed>` was claimed in the
  allowlist, the unclaimed-element count went 8 → 7, and the register's own number
  became true again. Nothing else was introduced.
- **One more finding this work earned, for the audit:** `catalogs.md` describes
  `functions` and `theme`, and `common_types.json` has no `DynamicNumber` /
  `DynamicBoolean` — so a NON-STRING bound prop has no $ref to use. `TraceFeed`'s
  `breadcrumbCount` spells its both-forms union out inline rather than inventing a
  remote ref. Worth a decision: add the missing dynamic types to the catalog's
  vocabulary, or keep accepting inline unions.

Read `READ-ME/ADDING-A-CATALOG-ELEMENT.md` before adding any component: five places,
and missing one produces exactly the failures listed above.
