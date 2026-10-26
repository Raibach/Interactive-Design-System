# PLAN — the UX chat footer follows the product and the place

> Written 2026-10-24 after reading PostHog's `ContextDisplay`, `ModeSelector`, `MODE_DEFINITIONS`,
> `productsCatalog.ts`, the framed Product analytics navigation and the room's bottom card. This
> plan changes no code. The welcome, the notebook and the discussion are already built; this plan
> covers the product-aware footer tools.
>
> **Correction from the owner, 2026-10-24.** Most of the products share the exact same footer
> menu. Selecting Session replay, error tracking or another product changes the chip's label and
> icon and Grace's focus; it does not replace the menu. The shared footer menu and Add context are
> the template. A place may add its own actions, as Web analytics does with its Actions menu, but
> that is the exception rather than a separate footer per product.
>
> **Executed, Stage 0 and Stage 1, with the shared selector (2026-10-24).** The product map is
> `ux-products.ts`; the framed application reports its path through `ux-app-frame`; the product
> chip and its flyout are `ux-product-chip.ts`; the notebook and discussion are flat chips in
> `ux-chat-controls.ts`; the tray card gives them one row. The chip shows the place while Auto is
> on, a chosen product pins the chip, and Auto returns it to the place. The chip and flyout use
> PostHog's chip and selector shape. Add context for the current page is built beside it; the full
> context picker and the optional location actions are not built yet.

## What the person will experience

The person is in Design → UX, with the Product analytics application open on the left and Grace's
chat on the right. The bottom card of the chat shows the product they are in: a small chip reading
Product analytics, a selector that can move to Auto or another product, and Add context. The
selector opens one shared menu: Auto, Product analytics, SQL, Session replay, Error tracking,
Surveys, Flags and AI observability. Choosing a product changes the chip's label and icon and the
focus of the next question; the menu itself stays the same. The person can leave the selector on
Auto, and the chip follows the place.

When a place has its own actions, they appear beside the shared tools. Web analytics is the
example: Export all as CSV and Session Attribution Explorer. That is an addition to the shared
footer, not a different footer for every product. The notebook and discussion control stays in the
same card; it is the room's own tool, not a PostHog product.

The chat still goes to Grace, our model, through `/api/teacher/query`. The product selector and the
footer actions do not bring PostHog's agent back. The actions are the application's own actions;
the selector tells Grace what the person is looking at.

## The source in PostHog

The visible footer is `ContextDisplay` in
`design/posthog-master/frontend/src/scenes/max/Context.tsx`. It holds three things:

- `ModeSelector` (`components/ModeSelector.tsx`) — the product/mode selector. Its options are Auto
  from `SPECIAL_MODES` and the product modes from `MODE_DEFINITIONS` in `max-constants.tsx`:
  Product analytics, SQL, Session replay, Error tracking, Surveys, Flags, AI observability, and
  Customer analytics when its flag is on.
- `TaxonomicPopover` — the Add context picker, with the current page, insights, dashboards, events,
  actions and notebooks.
- The context tags — what is already attached to the next turn.

`MODE_DEFINITIONS` gives each product mode a name, a description, an icon and a set of scene keys.
That is the existing map from a place in the application to a product mode. For example, the
Product analytics mode covers Dashboards, Dashboard, Insight and Saved insights; Session replay
covers Replay, Replay single, Replay playlist, Replay file playback and Replay settings; Flags
covers feature flags and experiments.

The navigation's product list is wider than the mode selector. `productsCatalog.ts` and the
product tab list carry more than ten products, including Dashboards, Product analytics, Web
analytics, AI observability, Session replay, Replay vision, Feature flags, Experiments, Error
tracking and Logs. Some of those products share a mode; some may have no mode of their own. The
footer's product chip and custom actions therefore need a registry that is larger than
`MODE_DEFINITIONS`.

The Actions menu in the Web analytics example is a location action list, not the mode selector.
Its visible entries are Export all as CSV (.zip) and Session Attribution Explorer. The exact
source of that list must be located in the Web analytics product folder during the first stage of
the work. It is the proof that each place can carry its own footer actions. `Add context` is the
common footer action; the Actions menu is a product-specific one.

The framed application is same-origin under `/posthog`. The room already frames it in the left
column, but the room does not yet receive its current place. The Governance room has the pattern
for this: a small location reporter in the framed application posts the pathname back, and the
room listens. The UX footer needs the same kind of bridge.

## The shared menu and the location additions

The shared footer menu is the template. It holds one product selector and one Add context action,
and it is the same menu for every product. The product chip is the one chip with a flyout; its
flyout is the selector, and it stays. The product mode is the chat's focus: Auto follows the
current place, and choosing a product pins the focus. Choosing Session replay, error tracking or
another product changes the label, the icon and the focus of the next question, not the menu.

The notebook and the discussion are flat text chips beside the product chip. They are not placed
inside a menu, and the footer does not bury a tool behind an icon.

The location actions are optional additions. Add context is common to every place. A place may
also offer its own actions, as Web analytics does with Export all as CSV and Session Attribution
Explorer. The actions are per place, not a second footer. Most products have none in the first
pass.

The bottom card holds the shared menu first and the location actions beside it; the room's
notebook/discussion icon stays at the end.

## The registry

The registry is one data-defined list. It is the contract the footer reads, and the contract a
customer frontend can later supply. Each entry states:

| Field | What it means |
| --- | --- |
| `key` | The stable product key, such as `product_analytics`, `web_analytics`, `session_replay`, `error_tracking`, `surveys`, `flags`, `ai_observability`, `logs` |
| `label` and `icon` | What the chip and the selector show |
| `mode` | The Grace mode the product uses, or none when it is a product with no mode of its own |
| `scenes` | The places in the application that select this product |
| `actions` | The place's own additions, when it has them; the Web analytics entry carries its two visible actions, and most entries leave this empty |
| `context` | The context the place can attach through Add context |
| `track` | The stable event key the UX designers will wire later |

The first registry is the PostHog list, because that is the application in the room today. The
registry is not hardcoded inside the footer element: the footer reads the entries, and a customer
frontend can replace the entries with its own products and actions. That is the part the system
does not produce yet.

Auto is the default entry. When Auto is on, the current place selects the product; when the person
pins a product, the pin wins until Auto is chosen again. The chip always shows the product that
will be used for the next question.

## The location bridge

The left application is the source of truth for the place. The room must not keep a second
navigation list that can drift from it. The bridge is one fact: the current place in the framed
application, as a path and a scene key, with a product key resolved from the registry.

The room listens for that fact and updates the footer. The Governance room's reporter is the
pattern to copy: a small script in the framed application posts the pathname when the location
changes; the room normalizes the section prefix and updates its own fact. For the PostHog frame,
the reporter can announce the pathname, and the registry maps it to the product and the actions.
If the application already exposes its scene key, the reporter carries that too; the registry
prefers the scene key and falls back to the path.

The footer does not navigate the application. It reads the place and it runs the actions the
registry declares. A location action calls the application's own action or opens the application's
own route; it does not invent a route of its own.

The next turn carries the resolved product, the place and the attached context. Grace's script is
the analytics script from `ux-voice.ts`; the place is added to the context the same way the current
Add context sentence is added today.

## The bottom card layout

The reserved `chat-plugin-tray` card keeps its current slot. Its contents become:

- the product chip and its selector, at the left;
- Add context and the location actions, beside the chip;
- the room's chat-tools icon at the right, opening the notebook and discussion menu.

The card is one row when the space allows, and it wraps when the products or actions need more
room. The action labels are text CTAs, as the PostHog footer uses. The product icons are the
product registry's icons. The room's own icon stays ours; the notebook and discussion are not
PostHog products.

The notebook mode still hides the chat input and leaves the card in place, so the person can return.
The discussion mode still uses the seat's input, and the product chip stays visible because the
discussion is about the product the person is in. The product mode does not change the discussion
thread's storage; it changes the context of the next turn.

## The stages

### Stage 0 — the map, before any footer code

Read the navigation and the places, and write the registry's first table:

- the ten-plus product entries and their labels, icons and paths;
- the scene keys each product covers, using `MODE_DEFINITIONS` where it exists;
- the places that add their own actions, beginning with Web analytics' Export all as CSV and
  Session Attribution Explorer; most places add none, and Add context remains the common action;
- the exact location reporter the framed application can provide, or the same-origin read if it
  has none.

The stage produces the table and the source notes. It changes no code. The table is reviewed
before the footer is built, because a wrong product-to-place map is a wrong answer for Grace.

### Stage 1 — the location bridge and the product chip

Add the reporter and the room's listener. The footer shows the current product in the chip. The
shared flyout is the selector from Stage 2, built in the same pass because the chip's design
requires it. Verify that navigating the left application through the places changes the chip. The
app's navigation remains the only navigation.

### Stage 2 — the product selector and Add context

The selector is built: the product chip opens the shared flyout with Auto and the product modes.
Choosing a product pins it; choosing Auto returns it to the place. The next turn carries the
resolved product in its context. Add context for the current page is built beside it; the full
context picker is the later Stage 4.

This is the first slice the person will use. It must not change the chat's existing notebook and
discussion behavior, and it must not restore the PostHog agent.

### Stage 3 — the optional location actions

Add the action list only where a place really has one. Web analytics comes first with its two
visible actions. Most products add nothing: their footer is the shared menu, with the product
label changed. An action that has no real door is not shown; the footer does not invent a button
for every tab.

### Stage 4 — the full Add context picker

The current page is the first context. The full picker adds insights, dashboards, events, actions
and notebooks, with the tags already attached shown beside the action. This is the PostHog
`TaxonomicPopover` behavior, ported into our own element. It uses our conversation and our turn;
it does not use their agent.

### Stage 5 — the tracking contract, for the UX designers

The registry carries a stable `track` key for each product, action and context choice. The footer
can emit the events the UX designers will wire later:

- a product changed, with the previous product, the new product and whether it was Auto or a pin;
- a location action opened, with the product, the place and the action;
- a location action ran, with the same facts and whether it succeeded;
- a context was added or removed, with the context kind.

The event names and properties are the contract. The destinations, the PostHog metrics setup and
the customer-facing frontend configuration are the UX designers' later work. The footer does not
hardcode a vendor capture call in this plan. The system is producing a frontend for customers, and
that frontend does not exist yet; the registry is what it will be configured from.

### Stage 6 — verification

On `localhost:5001`, inside the React frame:

- the footer shows the current product and changes when the left application moves through the
  ten-plus places;
- Auto follows the place; a pinned product stays until Auto is chosen;
- Add context attaches the current place, and the next turn carries it;
- the Web analytics place shows its two actions, and each runs the application's own action;
- the product selector, the actions and the context do not send anything to PostHog's agent;
- the notebook and discussion still open in the output, and the discussion still uses the main
  input;
- the typecheck is zero; no build, preview or tunnel rebuild without the owner's word.

## What this plan does not do

- It does not change the framed application's navigation, screens or data.
- It does not use the PostHog agent; every turn stays on Grace's `/api/teacher/query`.
- It does not add a second chat input or a second navigation.
- It does not build a different footer menu for every product; the shared selector and Add context
  are the template, and location actions are the exception.
- It does not implement the tracking destinations; it defines the contract for the later setup.
- It does not finish the God file cleanup or the chat file's Stage 5 split.
- It does not build the customer frontend; it makes the registry the place where that frontend's
  products and actions will be declared.

## The first slice

The first slice is executed. The map, the location bridge and the product chip with its shared
flyout are standing; the notebook and discussion are flat chips beside it. The chip shows Product
analytics on the landing place, a pinned Session replay stays, Auto returns the chip to the place,
and a location change to Session replay moves it. Add context and the optional location actions
are the next stages.
