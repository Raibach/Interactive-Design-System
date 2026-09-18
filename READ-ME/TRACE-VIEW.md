# The Trace view — how it is wired, and what it is for

Written 2026-09-17, after building it. Everything below marked **SEEN** was measured on a
freshly loaded page; everything marked **written, not seen** was not. That distinction is the
point of the file — twice in the previous session, work was reported complete that had never
rendered.

## The operator's spec, and where it stands

> I should click on it, it should expand, I should see a spinner, and it should load the
> content of that slot.

| step | state | evidence |
| --- | --- | --- |
| click | **SEEN** | rail button "Trace", count 1 |
| expand | **SEEN** | right pane 74px collapsed → **726px** open; `isThirdOpen` true |
| spinner | **SEEN** | `.view-waiting` drawn, text "Loading the trace view…", slot assigned 0 |
| content | **SEEN** | `LIVE TRACE 8` with real entries — `POST /api/ai/assemble-surface`, `GET /api/projects`, … |

## The path, end to end

Five steps, and each one has exactly one owner. The reason this is written down is that the
view used to fetch its own data, which is why it could only ever show what it could find.

```
1 SOURCE   lib/trace-source.ts        every signal this page can observe about itself:
                                      the logger, every fetch, errors, the surface's own
                                      events, the catalog audit, long tasks, Sentry's scope.
                                      One observer per page; bursts coalesced 250ms; a snapshot
                                      object whose IDENTITY is stable until values change.
                                      Started at MODULE LOAD, not first subscribe, so the first
                                      assembly is not the one request the feed cannot explain.
2 WRITE    WritingAreaIndex.tsx       React state is the authority — the renderer is assigned
                                      el.dataModel from it every commit, so writing anywhere
                                      else would be overwritten
3 MODEL    /trace = {                  entries: TraceEntry[],   // newest first, max 100
                                      breadcrumbCount: number }
4 BIND     backend assembler           chat-panel "children": {"view": "trace-view"}
                                      TraceFeed "entries": {"path": "/trace/entries"}
5 DRAW     lit/trace-feed.ts          renders only what it is given. Unset ≠ empty.
```

## What is on screen

Every line is `time · kind · message · status/duration`, with a detail line when the entry has
one. The kinds, and where each comes from:

| kind | source | carries |
| --- | --- | --- |
| `network` | a `window.fetch` wrapper | method, path, **HTTP status, duration** |
| `log` | the app logger, by subscription | level, message, and the structured `data` the logger already accepted and the old feed **dropped** |
| `event` | `a2ui-event`, `a2ui:system-message`, `a2ui:user-message`, `a2ui:usage` | what the surface was asked to do, and the model/token payloads |
| `error` | `window` error + unhandled rejection | message and stack |
| `audit` | the `/api/catalog/audit` response the app **already** fetches — no second request | findings, blocking count, checks run |
| `perf` | `PerformanceObserver` long tasks | how long the main thread was blocked |
| `breadcrumb` | Sentry's global scope, polled | in a dev build, empty by construction |

Seen on a fresh page (2026-09-17), 25 entries: `network` 9, `log` 9, `event` 6, `audit` 1. Real
examples from the screen:

```
18:35:57  AUDIT    Catalog audit (prompt-composer): 45 findings · 1 blocking · 22/22 checks ran
                   pipeline=35  designer=10  passed=5
18:35:57  NETWORK  GET /api/catalog/audit                                        200 · 6ms
18:35:57  EVENT    ui usage
                   call_id=20 provider=DeepSeek API model=deepseek-v4-pro mode=surface_assembly
                   prompt_tokens=1060 completion_tokens=973 total_tokens=2033
18:35:57  NETWORK  POST /api/ai/assemble-surface                                  200 · 6.9s
18:34:22  NETWORK  POST /api/ai/assemble-surface                                  200 · 9.4s
```

Those durations agree with the backend's own `[PERF TRACE]` blocks, measured independently — so
the latency the operator sees is the latency the server measures.

**Wired but not yet observed on screen**, and why — stated rather than implied:

- `error` — nothing has thrown in these runs. The kind is exercised by the same `add()` every
  other kind uses, but it has not been seen to fire, so it is *written, not seen*.
- `perf` — no main-thread task over 50ms has been recorded in these runs. Chrome and Edge only;
  a browser without `longtask` support drops this source silently by design.
- `breadcrumb` — empty by construction in a dev build, as above.
- `audit` — fires only when the shell asks for catalog context, so it appears when the app makes
  that request rather than on every load.

**What is NOT loadable here, so nobody looks for it:** Sentry spans, transactions, replays and
Web Vitals need a build — `lib/sentry.ts` returns early in development — and reading them at all
needs an auth token, which this machine does not have (a DSN is write-only). The three
`catalog-health` intents are model calls, so their entries cost a request; the audit kind rides
along on a request the app makes anyway.

**Unset is not empty, and the element says so.** `entries === undefined` draws "Waiting for the
surface to bind /trace/entries". `entries === []` draws "Nothing yet…". Those are different
claims: the second says the app has logged nothing, and an element that guessed would be wrong
half the time.

### Why one observer, not one per element

`<trace-feed>` used to subscribe to the logger and poll Sentry from `connectedCallback`. That
made a *view* into a *source*: it could not be handed different data, and every seat that wanted
a trace paid for its own poller. The reads now happen once per page, whether or not anything is
mounted.

## The one real decision: who writes the path

**The client writes it.** Recorded here because it is a deviation, not a default.

The protocol-pure writer is the agent — it owns the model, and it would send `updateDataModel`.
It cannot be, for two reasons and neither is stylistic:

1. **The transport has no return path.** `transports.md`: A2A and AG-UI are stable, REST is
   "planned"; ours is a one-shot POST. Breadcrumbs never reach the server at all.
2. **Telemetry is client-local by nature.** The logger and Sentry's scope exist in this browser
   tab and nowhere else. There is no server-side observer to be the author.

So the client writes it, which the Read/Write contract permits, and which this shell already
does for `/session/left_column/sections` (`writeSectionsToSurface`). The component stays a view:
it is still handed its values by a path, and it draws what it is given.

**What that costs, stated rather than hidden.** The model now has two authors — the agent writes
`/cards` and `/console`, the client writes `/trace`. Two consequences:

- **An assembly REPLACES the whole model**, so `/trace` leaves with the one it was written into.
  The writer is therefore keyed on the assembled component lists and re-asserts the values on
  every assembly, not only on change. Without that, the feed shows "waiting" after every console
  tab click until the next breadcrumb happens to arrive.
- **The identity check is load-bearing.** `prev.dataModel.trace === trace ? prev : …` — the source
  hands back the same object until something changed, and returning `prev` makes React bail out.
  Remove it and a quiet poll re-renders the whole surface twice a second.

## The defect only looking found

**The rail disappeared from the collapsed column.** Cards spanned the full window, the right pane
measured 82px with nothing in it, and the Trace button could not be found (`count = 0`).

`chat-panel._seatSlotted()` decides whether the host handed it a seat. Its first check asks the
slot; its fallback was `this.children.length > 0` — "a host may append a seat after the first
render". The surface now puts the Trace view in the panel's `view` slot, so the panel had a child,
so the fallback said *a seat was handed over*, so it rendered the seat slot **in place of the whole
body** — rail, input, footer and all.

The fix is that a child which NAMES another slot is not a seat:
`Array.from(this.children).some((el) => !el.getAttribute('slot'))`.

No test caught this. The component tests assert content inside the panel; none asserts that the
rail is still on screen. It was found by opening the app and looking — which is the entire argument
for the verification gate, made concrete.

## The second defect: the payload closed the column the operator had just opened

Found the same way, minutes later. Pick Trace, the column opens to 726px, and then it slams shut
to 74px with the Trace view inside it. Intermittent — it held open for three seconds, then closed.

**The mechanism, proved rather than reasoned.** With the column open, assigning the renderer a
data model object with the same contents:

```js
renderer.dataModel = { ...renderer.dataModel, __probe: Date.now() };
```

⇒ `isThirdOpen` true → **false**, pane **726px → 74px**. A data-model change re-runs the renderer,
which re-applies **every** prop from the component payload — including `isThirdOpen: false`, which
the console's prompt requires so that the chat column LOADS closed.

So this is trap #5 from the handoff ("a payload flag the operator can also toggle fights them"),
which was latent because the model only changed when a new assembly landed. The trace writer
changes the model on **every log line and every poll**, so what was rare became constant: opening
Trace and then anything logging at all closed the column.

**The fix is the split the requirement already asked for in words** — "Open or closed belongs to
the element that owns the width, never re-asserted by every assembly". `workspace-layout` now
says that in code: `isThirdOpen` has a hand-written accessor (Lit's `noAccessor: true`), the
setter — which is what a payload assignment goes through — is **ignored once the operator has
touched the pane**, and `_setThirdOpen()` is the internal path that also marks that ownership.
A payload still closes the column on load, which is what the flag is for. After that the operator
owns it, and the element can still close what it opened, so the rail stays one control.

Verified live after the fix: Trace click → 726px, then two data-model changes → **still 726px**,
`isThirdOpen` still true, rail still drawn. Three tests pin it, and two of them fail without the
guard.

## Styling: there is no component stylesheet, so one now exists

Asked why the feed didn't just use "the styling sheet we already have". The honest answer, checked
rather than assumed, is that no sheet reaches a component:

- **`src/index.css` is the SHELL's sheet** — Tailwind's three directives and a couple of classes for
  the React tree. 51 lines, **no `:root`, no CSS variables, no token set.**
- **Tailwind cannot cross a shadow boundary.** A Lit component renders into a shadow root, so a
  global class in its template matches nothing. That is the DOM, not a preference.
- **And a check forbids it anyway:** `clean-no-jsx` requires no Tailwind in the component sources,
  and it passes — all 29 sources are clean.
- `primitive-missing` / `primitive-drift` are about catalog **schemas**, not CSS, so they were never
  watching styles.

So every element carries its own `static styles`, and each one also carried its own copy of the
palette. `<chat-messages>` writes `#171717` and `#507274`; the trace had drifted to the Tailwind
greys (`#111827`, `#6B7280`, `#E5E7EB`) — which is exactly why it read as a widget bolted next to
the console instead of part of it.

**`src/shared/design-tokens.ts` is the fix**: one `CSSResult` declaring the app's values as custom
properties on `:host`, adopted by an element as `static styles = [designTokens, css\`…\`]`. Lit
de-duplicates a `CSSResult` it has seen, so the shared block costs one stylesheet no matter how many
elements adopt it, and the properties inherit into each shadow tree. `trace-feed` consumes it; the
palette is now referenced, not restated. Adopting it across the other components is a follow-up with
its own visual risk, not a free win, so it is not done here.

What changed on screen: a four-column grid so times, badges and messages each start at one x; kind
badges as tinted pills whose colours are **classes resolved from tokens**, not inline styles chosen
in JavaScript; HTTP status as a tinted pill and duration in tabular figures, with anything over a
second in amber and bold; detail lines under the message; a row hover so a line can be tracked
across; and the brand gold spent on one meaning only — the pulsing dot that says this view is live.

### One family, and a contrast floor

The first pass put the timestamps, statuses and detail lines in a monospace stack — the usual
assumption that data wants a "data font". Two things were wrong with it, and both were visible on
screen before they were understood:

- **It split the application's voice.** Inter is loaded (`index.html` → Google Fonts) and is the
  application font; a second family for "data" made the trace read as a different product. Inter
  aligns figures through `tabular-nums`, which is what the monospace look was actually buying. The
  tokens now carry **no monospace family at all**.
- **The timestamps were barely visible.** They were `#9aa5ae`, which is **2.6:1** on white — under
  the 4.5:1 floor for body text and hopeless at 11px. `--ds-muted` (#6c757d) is 4.8:1 and is now the
  lightest ink token in the sheet.

Both are recorded in `design-tokens.ts` as rules rather than left as choices: **one family**, and
**--ds-muted is the floor** — to make something recede, reduce its size or weight, never its
contrast. A token list is the only place that rule can live and apply to the next component too.

## The trap this styling pass earned

**The `element-unclaimed` check decides a component is mounted by the app when the literal tag text
appears anywhere under `src` — and a COMMENT satisfies it.** Writing the chat thread's tag with its
angle bracket inside a comment in `design-tokens.ts` turned that element's real finding into a
`pass`, which moved the derived `element-unclaimed` count 7 → 6 and made `open-items-register` fail
as **blocking**. Nothing was broken; a sentence was read as markup. Name an element in prose, not as
markup, unless you mean to claim it. (The comment in `design-tokens.ts` says so, for the next
person.)

If a shared component stylesheet is ever wanted, this is the file to extend — and the check is worth
tightening so that a comment cannot claim a component.

## Traps, including two new ones

The five from the earlier session still hold (a backtick ends a Lit template literal and `tsc` will
not tell you; the server reads the catalog at **startup**, so a catalog edit needs a backend
restart; the 503s are usually the model's 10s cap and the cap must not be raised; a prop the
payload stops sending is released by the renderer; a payload flag the operator can also toggle
fights them). Two of those five bit in this session, so they are worth restating rather than
leaving as history:

- **Trap 3 fired twice while verifying.** `[DeepSeek API] Failed: Request timed out.` → a 503 →
  the shell cleared the surface → the panel, and therefore the rail, was legitimately absent. Do
  not debug the frontend for it. Wait for an assembly, don't count seconds.
- **Trap 5 was not a caution, it was a bug waiting for a trigger.** See above. The trigger was
  added by this session's own writer.
- **The in-app browser serves the PREVIOUS module from its own cache.** `vite.config.ts` sets
  `Cache-Control: no-store` for exactly this reason and documents it, but `tabs.reload()` was
  still not enough: after editing `trace-source.ts`, the page kept running the old module — the
  give-away was `window.__traceObserved === false` and entries still carrying `type` instead of
  `kind`. **Open a NEW TAB** rather than reloading, and confirm with a marker the new code sets.
  Vite serves the new file correctly (`curl` the module to check the server side first); it is the
  browser's cache, not the build.

Two more, both found here:

- **A catalog component needs BOTH names when the tag differs from the model name.** The
  allowlist names the TAG (`trace-feed`); the payload names the MODEL name (`TraceFeed`). Claim
  `trace-feed` in the allowlist without a `trace-feed` entry in the catalog and `schema-absent`
  fires — correctly, because the allowlist just promised something the schema does not accept.
  Both entries must also appear in `$defs.anyComponent.oneOf` or `schema-unreachable` fires.
- **The documented component count is blocking.** Adding one entry took the catalog 38 → 39, and
  `doc-claim-drift` fails the build until `README.md` and `IMPLEMENTATION_CONFORMANCE.md` agree.
  That is the check working: the number is asserted, not remembered.

## Using this to trace the CONSOLE'S performance

The idea: the same feed, showing how the console's own components perform. What is actually
available, checked rather than assumed:

**Sentry is OFF in development.** `lib/sentry.ts` returns early when `MODE === 'development'`.
Consequence, measured: on the dev page the breadcrumb poll returns nothing —
`breadcrumbCount` was **0** while the feed held 8 entries, all from the app's own logger. So in
dev, Sentry contributes nothing to this feed and never has.

**In production/staging it is configured for performance**, not just errors:
`browserTracingIntegration()` plus `tracesSampleRate` (1.0 staging, 0.1 production),
`profilesSampleRate`, and replay. So pageload/navigation/fetch spans and Web Vitals already flow
to Sentry from a deployed build.

**The supported way to feed them into the trace is a client hook**, not an internal read:
`beforeSendSpan` / `beforeSendTransaction` (or `spanToJSON(span)`) forwarding finished spans into
`trace-source`, the same channel breadcrumbs use. Do **not** reach for a private field to get
spans the way the breadcrumb poll reaches for `_breadcrumbs` — that read is wrapped precisely
because it is not a published surface.

**The dev-visible performance signal already exists and is not being used.** The backend prints a
`[PERF TRACE]` block per assembly (Milestone A database / B LLM / C parse / total ms), and the
assembly's data model already carries `assembly_time_ms`; `logger` accepts structured data
(`logger.info(msg, data)`), and `trace-source` **drops that `data` field today**. Carrying it and
drawing a duration is the smallest honest first step: `POST /api/ai/assemble-surface` becomes
`POST /api/ai/assemble-surface · 4.3s`, per operation, for both milestones. That is console
performance traced through the component that is already on screen.

**What not to do.** Do not raise `grace_gui.LLM_TIMEOUT` to make the numbers look better — the
owner has refused that explicitly, and the 10s cap is not the bug.

## Written, not seen

Stated plainly, because the gate is a rule and not a mood:

- The **composer** and **session** prompts now emit the same view child (one line each, so that no
  seat shows a loading state that can never resolve). **The composer is SEEN** — its Trace tab
  draws the same live feed (`activeTab: trace`, slot assigned `trace-feed`, no waiting state over
  it, 8 entries, column open). The **session** intent is verified only as far as the envelope: it
  returns `right-col → children {view: trace-view}` with the right paths bound. Not seen on a
  rendered page, and it is the one seat still on that list.
- The **performance channel** above is an assessment, not built.
- `src/components/TraceFeed.tsx` — the retired React feed — is still in `src/` with **zero
  importers**, while `retired-files/console-seat-20260917/` holds the archived copy. Duplicate
  dead file; not moved, because disposal was not asked for.

## Files

| file | what it owns |
| --- | --- |
| `frontend/src/lib/trace-source.ts` | the reads, the snapshot, the subscribing — new |
| `frontend/src/shared/design-tokens.ts` | the component design sheet: the app's palette, type and radii as `--ds-*` custom properties — new |
| `frontend/src/components/lit/trace-feed.ts` | the view; bound, fetches nothing, styled from the tokens |
| `frontend/src/components/lit/chat-panel.ts` | the `view` slot, its loading state, `_slot()` / `_seatSlotted()` |
| `frontend/src/components/lit/workspace-layout.ts` | the third column's open state — payload first, operator after |
| `frontend/src/test/chat-panel.test.ts` | 3 cases: a child naming another slot is not a seat; the rail survives; the spinner yields |
| `frontend/src/test/workspace-layout.test.ts` | 3 cases: the payload closes it on load, and cannot re-open or re-close it after the operator acts |
| `frontend/src/pages/WritingAreaIndex.tsx` | the writer: `/trace` into both trees, re-asserted per assembly |
| `backend/routes/ai.py` | the three prompts that emit `trace-view` into the panel's `view` slot |
| `frontend/src/shared/tag-registry.ts` | `<trace-feed>` claimed in the allowlist |
| `frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json` | `TraceFeed` + `trace-feed`, its bindings, and the `anyComponent` ref |
