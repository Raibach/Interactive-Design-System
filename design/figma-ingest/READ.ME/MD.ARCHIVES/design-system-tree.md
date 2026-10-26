# The design-system tree — schematic for the front end


> **Start with `START-HERE.md`** — this file is the tree schematic for the front end.
What the catalogue looks like as a tree, what every node carries, where each value comes from,
and what a click does. Written for the screen, not for the database: this is the shape to build
the display against.

> **Status, 2026-09-28 late — how much of this now exists.**
> - **§7's three kinds of children**: two are built. A component's row shows its **measured design
>   layers** where a node exists (`_renderMeasuredFor`, from `public/catalog-figma/<pipeline>.json`),
>   and **`composes`** — the elements its own template draws — which is the only children a
>   hand-built component can have. **Slots are not drawn**: the catalogue declares a child slot for
>   exactly one entry (`RoomEmbed`), and that declaration disagrees with the element (the `seat`
>   slot), which the audit reports as a blocking finding.
> - **§2's Element row** carries, per component: tag, module, health (the audit's findings as a
>   dot), in-use (purple dot: named by a payload the app sends, or drawn inside another element's
>   template), declared props, functions (declared events + what the code actually dispatches and
>   listens for, or `empty`), composed children, and the measured layers where a node exists.
> - **§5's API** was not needed: the tree reads the files it needs directly (the catalogue, the
>   manifest, the Figma map, the audit report) and resolves names through the renderer's own
>   `resolveTag` — see `frontend/src/shared/component-drawn-by.ts`.
> - **§6's question** (which children a click expands) is answered in practice: the chevron expands,
>   the row opens the thing itself — a component, a layer's measurement, or a function's source.

---

## 1. The tree

```
┌ DESIGN SYSTEM ─────────────────────────────────────────────── carbon-web ─────────────────┐
│  catalogId carbon-web · v11 · source lit_design-catalogs/carbon/                          │
│  declared 42 / 42 in the manifest · annotated 17 / 42 · gate 42 declared, 0 unknown       │
│  tokens 50,002 · last checked 2026-09-28T02:14Z · owner design-systems                    │
│                                                                                           │
│  ▾ ⬤ Carbon Web                                            [ Artifacts ]   ← the system   │
│    │                                                                                      │
│    ├─ ▾ ▤ Forms                                    12 elements · 9 annotated · 3,140 tok   │
│    │   ├─ ▪ checkbox          cds-checkbox            6 props · 2 events · 4 slots · 210 tok│
│    │   │   ├─ ◇ input slot "label"            annotation 1                                │
│    │   │   └─ ◇ input slot "helper-text"      annotation 0                                │
│    │   ├─ ▪ date-picker       cds-date-picker         11 props · 3 events · 2 slots · 480 tok│
│    │   │   ├─ ◇ child  cds-input               (composed)                                 │
│    │   │   └─ ◇ child  cds-icon                (composed)                                 │
│    │   └─ ▪ number-input      cds-number-input         8 props · 2 events · 1 slot  · 320 tok│
│    │                                                                                      │
│    ├─ ▾ ▤ Menus                                    6 elements · 4 annotated · 1,880 tok   │
│    │   ├─ ▪ dropdown          cds-dropdown             9 props · 3 events · 3 slots · 520 tok│
│    │   │   └─ ◇ child  cds-dropdown-item       (composed)                                 │
│    │   └─ ▪ overflow-menu     cds-overflow-menu        7 props · 2 events · 2 slots · 410 tok│
│    │                                                                                      │
│    ├─ ▾ ▤ Buttons                                  3 elements · 3 annotated · 640 tok     │
│    │   ├─ ▪ button            cds-button               5 props · 1 event  · 1 slot  · 260 tok│
│    │   └─ ▪ copy-button       cds-copy-button          4 props · 2 events · 0 slots · 190 tok│
│    │                                                                                      │
│    └─ ▸ ▤ Everything else                          21 elements · 1 annotated · 4,342 tok  │
│                                                                                           │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                                                       [ Save Design System ⌘S ]  ← writes
```

Node glyphs: `⬤` the system · `▤` a group · `▪` an element · `◇` a child (a slot or a composed
element). `▸/▾` collapsed/expanded. Status marks live on the element, not the row text:
`●` annotated · `◐` declared but not annotated · `○` known from the source but not declared ·
`⚠` declared but absent from the manifest (the gate's finding).

## 2. Every level, and what it carries

| Level | Is | Carries | Comes from | Editable |
|---|---|---|---|---|
| **System** | one catalogue | catalogId, title, version, source root, owner, counts (declared / in manifest / annotated), token total, gate verdict, last checked | `catalogs/index.json`, the catalog file, the gate's report | title, owner, version grouping |
| **Group** | how elements are organised — Carbon's own sections, or ours | title, element count, annotated count, token total | a declared grouping in the catalogue (default: the source's folders) | yes — move an element between groups |
| **Element** | one component | tag, class, source file, props[], events[], slots/children[], annotations[], registration state (declared / mapped / allowlisted / built), token count | the generated manifest (props, events, slots), the catalog file (the declaration), the map (origin, when there is one) | annotations, and the declaration's description/props |
| **Child** | a slot it renders, or an element it composes | name, kind (`slot` or `child`), target tag when composed, annotation | the manifest's slots + the source's template usage | annotation; a composed child's props |

## 3. The three panes in the mock, and what each is reading

- **Left — the tree.** One row per node: glyph, name, tag or slot name, and the counts that
  make a decision (props · events · slots · tokens). Clicking a row selects it and loads the
  middle pane. This is the only pane that scrolls a lot, so it is the one that should carry the
  count column.
- **Middle — Annotations.** For the selected node: the description of what it is and what it is
  for, who wrote it, when. For an element, also its props and events with their meanings. Rows
  with no annotation say so rather than showing an empty box — an unannotated element is the
  one that gets invented downstream.
- **Right — the identity strip.** `Design System Management | <system title>`, vertical. It is
  the context for everything in the middle: the annotations belong to *that* system.
- **Footer — Save Design System ⌘S.** Saving annotations is not the same act as saving a
  component. Two writes, two verbs: **Save** persists annotations and grouping (the catalogue
  file, no code changes); **Approve** still means the file-and-registrations write that the
  ingest tool does. Keep them visually distinct or a designer will think ⌘S built something.

## 4. State an element moves through

```
 from the source          declared in the catalog        annotated                gated
 ─────────────────  →  ─────────────────────────  →  ───────────────  →  ────────────────────
 ○ known                ◐ declared                     ● annotated          ✓ declared == manifest
   (in the manifest)      (a catalogue entry)            (has a description)   ⚠ or declared ≠ manifest
```

The gate is the only thing that can say "in the catalogue" — per catalogue, as always. An
element can be `●` annotated and still `⚠` failing the gate; the row should show both, and the
gate mark is the one that blocks.

## 5. What the front end needs from the API

| Need | Endpoint | State |
|---|---|---|
| the systems, with counts and verdicts | `GET /api/figma/catalogs` | planned (stage 1) |
| one system's tree, to the element level | `GET /api/catalog/{id}/tree` | to add |
| one element in full (props, events, slots, annotation, state) | `GET /api/catalog/{id}/component/{tag}` | to add |
| save an annotation or a grouping | `POST /api/catalog/{id}/annotate` | to add |
| re-check and get the verdict | `POST /api/catalog/{id}/check` | exists in spirit (`catalog:check`), needs the id |
| create a catalogue | `POST /api/catalogs` | to add — writes its descriptor, its index entry and an empty valid catalog file |

Until those exist, the tree can be built against the same JSON the catalogue already holds —
`catalog.json` for the declarations, the generated manifest for props/events/slots — so the
display can be built and fed from files while the endpoints catch up.

## 6. The one design question this raises

The mock groups by *kit and version* (`UI Kit (Version 8)`, `Forms (10-20-26)`); Carbon groups
by *component family* (Forms, Menus, Buttons) and has one version. Both are groupings over the
same element list, so the group layer should be **declared data** in the catalogue — not derived
from a folder name — otherwise the tree changes shape when someone reorganises a directory.

---

## 7. The owner's model vs. what the data actually is (2026-09-28)

The owner's words: *"I'm creating a visual representation of our Lit structure… a data tree.
This icon is a line item, the icon is the clickable indicator, say catalog. Under that we're
gonna have subsections — layout, components, actions — I'm gonna keep it flatter than the current
system. Some of that might cross over into the registry part, like action/database binding. And
this is not a folder: these are individual icons for individual components. The folder would be
whatever it is in the catalog — the catalog id or whatever is under that."*

**Their model:** catalogue → category (layout, components, actions…) → element (an icon each, not
a folder) → that element's children. Each element gets a tile carrying what ingest learned.

**The data underneath is flat.** Every structure we have today is a flat map keyed by name or id:

| Structure | Shape | What it can group by |
|---|---|---|
| the schema (`catalog.json`, 57 components) | `{name: definition}` | nothing — it is a dictionary |
| the allowlist (`tag-registry.ts`) | `{name: entry}` | `surface` (console/composer/both) and `column` (left/middle/right/console) |
| the Figma map (`registry.json`, 35) | `{by node}` | nothing — provenance only |
| the manifest (`custom-elements.json`, 44 modules) | `{module: declarations}` | nothing — it is per file |
| the design (Figma) | a real tree | layers, frames, sections |

So the **tree is a view to be built**, not a structure to be read. Nothing in the catalogue states
"this is a layout element" or "this is an action" today.

**Where each of their categories actually lives:**

- **layout / components** — a *declared category* that does not exist yet. The nearest thing that
  does exist is derived: `CATALOG_TIERS` in `tag-registry.ts` groups entries by `surface`, and the
  file is explicit that the tier is "DERIVED from each entry's `surface`, never restated". So a
  first, honest tree can group by `surface` + `column` without inventing anything, and a real
  "layout vs component vs action" category needs to be **declared per element** in the catalogue.
- **actions** — they exist, as `events` in the allowlist and as dispatched events in the manifest.
  They are *properties of an element*, not elements themselves.
- **database binding** — **this exists nowhere.** No structure in the repo maps an action to a
  data source. If it belongs in the catalogue it is a new, declared field (per element or per
  event), and that is a decision, not a lookup.
- **a component's children** — three different trees are available, and choosing wrongly is what
  makes this confusing: (a) **slots** it renders (from the manifest), (b) **child elements** it
  composes (the tags appearing in its template), (c) **Figma layers** it was drawn with (design
  time only). A tile can show all three, but only one can be the thing a click expands.

**The three questions that decide the build:**

1. **Which children does clicking expand — slots, composed elements, or Figma layers?**
2. **Where do the categories come from — derived (surface/column/tier) or declared per element?**
3. **Is an action (and its database binding) a node in the tree, or a field on the element's tile?**

Answer those three and the tree endpoint and the display follow directly; the tiles themselves
need no new data — everything an ingest learns already sits in the catalogue entry, the manifest
declaration, the map entry and the record.
