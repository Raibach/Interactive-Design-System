# Agent spec — the middle output column (`<compiled-output-viewer>`)

**Audience: the next agent.** Written 2026-09-14.

This file is a **gate**. No code is written against the middle column until the value it
implements appears on this page, next to the node id it was read from. It exists because
that rule was broken once and the result shipped.

## 0 · Why this file exists

Commit `940d10d` said, in its own message:

> *"Middle output column now matches Figma node `40000914:4677` (center-panel-3rd-col)"*

It does not. Against the node itself, that commit:

| it did | the node says |
| --- | --- |
| typed `Rendered output` / `Raw output` into `ouput-selector-tile` | the text node `40001034:1190` contains **`Agent Flow`** |
| added `Copy` / `Regenerate` / `Clear` inside `output-vontrols` | that frame has exactly **two** children: `ouput-selector-tile`, `Function - Model Selector Button` |
| rendered one `<div class="tab-strip">` | there are **two** frames `vertical-tab-A` — `40001034:1035` and `40001034:1775` |
| made `A` / `B` a pair of buttons | each frame holds a **rotated text run** reading `` `Response  Format  A` `` / `` `Response  Format  B` `` |
| wrote `Tokens: ${n} · Cost: ${c}` | the literal is `` `Tokens: 2022 Cost: $0.00802 ` `` — a space, and a trailing space |
| modelled the model control as `<model-selector-button>` + a `<span>` of the model name | the label is the single word **`Models`**, `#8b8b8b`, Inter Bold 16px, centered |

It passed `tsc`, `vitest` **226/226**, and `npm run build` (catalog GREEN) — because none of
those can see a design. It was reverted in `da05a4e`.

The mechanism, worth naming so it is not repeated: `VALUES.json` held **no entry** for any
node in this subtree (`grep` for `40000909:4165`, `40001034:1186`, `40001034:1035`,
`40001034:1775`, `40001037:2229`, `40000909:4085` → 0 hits). The middle column had never
been through `design-extract.mjs`, so there was no value table to copy from, and the values
were written from a model's memory. `design-extract.mjs` states the rule in its own header:

> *"NO LLM in this loop. Every number in VALUES.json is machine-traced to a Tailwind class or
> inline style in the MCP output. Lit components copy from VALUES.json — never from a model's
> memory."*

## 1 · Source of truth

| fact | value |
| --- | --- |
| Figma file key | `20UPR2KQMsbAxlo5NJb1se` |
| root node | `40000914:4677` `center-panel-3rd-col` — 531 × 732 |
| raw capture (this rebuild) | `frontend/src/design/center-panel-3rd-col.json` |
| value table | `frontend/src/design/VALUES.json` → key `center-panel-3rd-col` |
| extractor | `node frontend/scripts/design-extract.mjs` (idempotent; re-run after any re-pull) |
| drawn in (not a registry entry) | `WHAT-THEY-BUILT-WHAT-WE-BUILT.md` §D1 |

### 1.1 · `AGENT_NODE_MAP.md` §1 and this file do not conflict

`AGENT_NODE_MAP.md` §1 lists `compiled-output-viewer` among the eight entries with
`figmaNodeId: null`, and rules: *"a composed element has no single Figma node. Do not invent
one."*

That rule is about the **registry's component → node mapping**, and it stands.
`compiled-output-viewer` is a *composition*; it does **not** get a `figmaNodeId`, and nothing
below asks it to. `40000914:4677` is the **frame the composition is drawn in** — which is what
the design document says it is. Two different claims, both true:

- the registry maps *elements to the node they were imported from* → this element has none;
- this spec maps *a screen to the frame that draws it* → this screen is `40000914:4677`.

What neither claim licenses is typing a value nobody read. That is the only thing this file
forbids.

### 1.2 · The arithmetic closes — the frame is complete

An earlier read of this frame reported coordinates that cannot exist (`vertical-tab-A` at
`y=732`, two tabs at `x=491` and `x=531`, `right-panel-horiz-tab` reaching x=902). It was
read as an unfinished or scratch frame. It is not: those coordinates are a consequence of the
transform chain in §2, and the layout reconciles exactly.

```
531 = 451 (right-panel-horiz-tab w-[451px]) + 40 (vertical-tab B) + 40 (vertical-tab A)
649 = 732 − pt10 − 40 (output-vontrols h-[40px]) − gap10 − pb23   → matches output-area 431 × 649
431 = 451 − px10 − px10
```

Every one of those five numbers is asserted by a class string in §3. Nothing is inferred.

## 2 · The transform chain — structure, not decoration

The MCP emits transforms around children. They are load-bearing: they are why DOM order and
visual order of the two vertical tabs disagree.

| wrapper | wraps | inside |
| --- | --- | --- |
| `-scale-y-100 rotate-180` | `right-panel-horiz-tab` `40000909:4085` | `output-container` `40001037:2229` |
| `-scale-y-100 rotate-180` | `output-vontrols` `40001034:1186` | `right-panel-horiz-tab` |
| `-scale-y-100 rotate-180` | `output-area` `40000909:4165` | `right-panel-horiz-tab` |
| `rotate-180` | each `gripper-prompt-input` | every `vertical-tab-A` |
| `-rotate-90` | every text run | every `vertical-tab-A` |

`rotate-180` composed with `-scale-y-100` is a horizontal mirror (`scaleX(-1)`).

**O1 — open, blocks §4.** Whether these are authored mirrors or an artifact of reversed
auto-layout is not decided by the node data. Both readings produce a visually identical
screen for `output-vontrols`/`output-area`, which are symmetric in this drawing; they do
**not** produce identical DOM. The author of the drawing is the only source. Until answered,
no transform is applied.

## 3 · Node-by-node — every value with the node it was read from

Format: `property` → `value`. A class string quoted verbatim from the MCP response is the
receipt. Nothing on this page was written from a model's memory; where a value could not be
read, it is listed in §6 as open instead of filled in.

### 3.1 · `output-container` — `40001037:2229` · 531 × 732

`content-stretch flex items-center relative size-full`

| property | value |
| --- | --- |
| display | `flex` |
| align-items | `center` |
| position | `relative` |
| size | `100% × 100%` |
| children | `40000909:4085` (the panel), then the two `vertical-tab-A` frames |

> This node's own pull truncates mid-tree. Every child below was read from its own node id.

### 3.2 · `right-panel-horiz-tab` — `40000909:4085` · 451 × 732

`bg-white content-stretch flex flex-col gap-[10px] items-start justify-center pb-[23px] pt-[10px] px-[10px] relative size-full`
— inside `output-container` this resolves to `w-[451px] h-full`.

**Read this before copying `451` into anything.** The node's own class string is `size-full`:
the panel **fills its container**. `451` is what the drawing's 531-wide container leaves it
after the two 40px tabs (`531 − 40 − 40`). It is a **consequence** of the container, not a width
the node fixes — so the element must express it as `flex: 1`, not as `width: 451px`. Copied as a
hard width it reproduces the drawing at exactly 531 and breaks at every other width, and the
middle column's width in the app is driven by `workspace-layout`, not by 531. (This mistake was
made and corrected on 2026-09-14 — §9.8.)

| property | value |
| --- | --- |
| background-color | `#ffffff` |
| flex-direction | `column` |
| gap | `10px` |
| align-items | `flex-start` |
| justify-content | `center` |
| padding-top | `10px` |
| padding-bottom | `23px` |
| padding-left / -right | `10px` |
| width | `451px` |
| height | `100%` |

### 3.3 · `output-vontrols` — `40001034:1186` · 431 × 40

`content-stretch flex gap-[10px] items-center relative size-full`
— and, in the panel, `gap-[10px] h-[40px] items-center w-full`.

| property | value |
| --- | --- |
| display | `flex` |
| gap | `10px` |
| height | `40px` |
| align-items | `center` |
| width | `100%` |
| children | **exactly two** — `40001034:1187`, `40001034:1192` |

### 3.4 · `ouput-selector-tile` — `40001034:1187` (misspelled in Figma; keep the id, fix nothing)

`bg-white content-stretch drop-shadow-[-4px_-4px_5px_rgba(0,0,0,0.15),4px_4px_5px_rgba(0,0,0,0.15)] flex flex-[1_0_0] h-[40px] items-center max-w-[500px] min-w-px px-[10px] relative rounded-[6px]`

| property | value |
| --- | --- |
| background-color | `#ffffff` |
| box-shadow | `-4px -4px 5px rgba(0,0,0,0.15)`, `4px 4px 5px rgba(0,0,0,0.15)` |
| height | `40px` |
| padding-left / -right | `10px` |
| border-radius | `6px` |
| max-width | `500px` |
| flex | `1 0 0` — this tile takes the slack |

**O2 — open, does not block.** Two sources disagree inside the same file. The **applied** effect
is blur `5px` (class string above). `get_variable_defs` for this node returns the variable
`button drop` = `#00000026`, offset `(4,4)`, radius **`10`**, spread `0`; and `(-4,-4)`, radius
`10`. Alpha agrees (`0x26` = 38/255 ≈ 0.15); blur does not. The rendered node is implemented as
`5px`, and this row is the record of why.

### 3.5 · `output-type` `40001034:1189` → text `40001034:1190`

`output-type`: `content-stretch flex flex-[1_0_0] items-center min-w-px relative`
text `40001034:1190`: `[word-break:break-word] flex flex-col font-['Inter:Bold'] font-bold justify-center leading-[normal] not-italic relative shrink-0 text-[#171717] text-[18px] whitespace-nowrap`

| literal | **`Agent Flow`** |
| --- | --- |
| font-family | Inter |
| font-weight | `700` |
| font-size | `18px` |
| color | `#171717` |
| white-space | `nowrap` |

**O3 — open, does not block.** `WHAT-THEY-BUILT-WHAT-WE-BUILT.md` §D1 calls this slot *"an
empty label and a chevron — a selector with nothing chosen yet"*, and `940d10d` read that as
licence to write `Rendered output` into it. The node's literal is `Agent Flow`. The two are
reconcilable — D1 describes the *runtime* state before a Run chooses an output type; the
drawing holds an example of one. Either way the string read from the node is `Agent Flow`, and
that is the string a rebuild uses.

### 3.6 · `chevron-blue-closed` — instance `40001034:1191` → component `40000922:4875`

`content-stretch flex flex-col items-center justify-center p-[7px] relative size-[40px]`
inner `40000922:4872` `Arrow_drop_down` — `h-[13px] w-[14px]`, artwork `figma-9598a83b…svg`

| box | `40 × 40` |
| --- | --- |
| padding | `7px` |
| icon | `14 × 13` SVG |
| position in the tile | `x = 200` — the right end |

### 3.7 · `Function - Model Selector Button` — `40001034:1192`

`bg-white content-stretch drop-shadow-[-4px_-4px_5px_rgba(0,0,0,0.15),4px_4px_5px_rgba(0,0,0,0.15)] flex h-[40px] items-center justify-center px-[3px] relative rounded-[6px] shrink-0 w-[171px]`

| property | value |
| --- | --- |
| background-color | `#ffffff` |
| box-shadow | same pair as §3.4 |
| height | `40px` |
| width | `171px` — fixed |
| padding-left / -right | `3px` |
| border-radius | `6px` |
| flex-shrink | `0` — it does not shrink |

### 3.8 · `model-btn-label` — instance `40001034:1193` → component `40000973:24205`

outer `40000973:24205`: `h-[43px] relative w-[165px]`
inner `40000973:24203`: `[word-break:break-word] absolute flex flex-col font-['Inter:Bold'] font-bold inset-0 justify-center leading-[normal] not-italic text-[#8b8b8b] text-[16px] text-center`

| literal | **`Models`** |
| --- | --- |
| font-family / weight | Inter / `700` |
| font-size | `16px` |
| color | `#8b8b8b` |
| text-align | `center` |
| box | `165 × 43`, inset `0` in a `171 × 40` parent |

> `43px` tall inside a `40px` parent, and the instance sits at `y = −1.5`: the label is drawn
> **overflowing its parent by 1.5px top and bottom**. That is the design, not a rounding error.
>
> `940d10d` rendered `<model-selector-button>` **plus** a separate `<span>` carrying the model
> name. The drawing has one `171px` tile whose entire label is the word `Models`.

### 3.9 · `output-area` — `40000909:4165` · 431 × 649 · **this is where the result goes**

`bg-white content-stretch flex flex-col items-start p-[20px] relative rounded-[6px] size-full`
— and, in the panel, `flex-[1_0_0] w-full` (it takes all remaining height).

| property | value |
| --- | --- |
| background-color | `#ffffff` |
| padding | `20px` — all four sides |
| border-radius | `6px` |
| flex-direction | `column` |
| align-items | `flex-start` |
| flex | `1 0 0` — the growing row of `right-panel-horiz-tab` |

### 3.10 · the output text — `40000909:4168`

`[word-break:break-word] flex flex-[1_0_0] font-['Inter:Medium'] font-medium leading-[normal] min-h-px not-italic relative text-[#171717] text-[14px] w-[391px]`

| property | value |
| --- | --- |
| font-family / weight | Inter / `500` Medium |
| font-size | `14px` |
| color | `#171717` |
| line-height | `normal` |
| width | `391px` |
| literal in the drawing | `Prompt Output ← match this font and size for out put text.` |

> The drawing's literal is **an instruction addressed to the builder**, not content: it names
> the type of the text that will replace it. `Inter / 500 / 14px / #171717 / normal` is the
> spec; the sentence is never rendered.

### 3.11 · `vertical-tab-A` — `40001034:1035` · format label reads `Response  Format  B`

`bg-white border-[#8b8b8b] border-l border-solid content-stretch drop-shadow-[5px_0px_2px_rgba(0,0,0,0.15)] flex flex-col gap-[10px] items-center justify-center relative size-full`

| property | value |
| --- | --- |
| background-color | `#ffffff` |
| border-left | `1px solid #8b8b8b` |
| box-shadow | `5px 0 2px rgba(0,0,0,0.15)` — casts rightwards, onto the panel |
| flex-direction | `column` |
| gap | `10px` |
| align-items | `center` |
| justify-content | `center` |
| width | `40px` (from §1.2) |
| DOM order | gripper `1036` · readout `1038` · description `1040` · format label `1042` · gripper `1044` |

### 3.12 · `vertical-tab-A` — `40001034:1775` · format label reads `Response  Format  A`

`bg-white content-stretch drop-shadow-[5px_0px_2px_rgba(0,0,0,0.15)] flex flex-col gap-[10px] items-center justify-center relative size-full`

**Identical to §3.11 in every property except one: there is no border.** No `border-[#8b8b8b]`,
no `border-l`, no `border-solid`. Both frames also carry the same `data-name`
(`vertical-tab-A`).

> Two consequences, both of which `940d10d` got wrong:
> 1. **The two frames are not the same component.** Anything keying off the name alone merges
>    them and loses the border.
> 2. **The names and the labels are crossed.** The frame named `vertical-tab-A` at `x=491`
>    (`40001034:1035`) holds `Response  Format  B`; the frame named `vertical-tab-A` at `x=531`
>    (`40001034:1775`) holds `Response  Format  A`. **O4 — open, does not block:** whether the
>    crossing is intentional (adjacent tabs, both auto-named) or a naming slip in the file.
>    Position and label are implemented as read; no renaming happens in code.

### 3.13 · the five children of a `vertical-tab-A`, verbatim

**token readout** — `40001034:1038` / `40001034:1778`
`content-stretch flex flex-col items-center justify-center relative shrink-0 w-full`
inner `40001034:1039` / `1779`: `flex h-[197px] items-center justify-center relative shrink-0 w-full`, `style={{ containerType: "size" }}`
inner: `-rotate-90 flex-none h-[100cqw]`
text: `[word-break:break-word] flex flex-col font-['Inter:Semi_Bold'] font-semibold h-full justify-center leading-[0] not-italic relative text-[#767676] text-[12px] text-right w-[197px]`

| literal | `` `Tokens: 2022 Cost: $0.00802 ` `` — one space between the fields, one **trailing** space |
| font-family / weight | Inter / `600` SemiBold |
| font-size | `12px` |
| color | `#767676` |
| text-align | `right` |
| line-height | `20px` |
| rotation | `-90°` |
| box | `197` on the text axis, `w-full` across; the layer is `h-[197px]` |

**description** — `40001034:1040` / `40001034:1780`
`content-stretch flex flex-[1_0_0] flex-col items-center justify-center min-h-px relative w-full` — **this is the row that grows**
inner `40001034:1041` / `1781`: `flex h-[169px] items-center justify-center relative shrink-0 w-[40px]`
inner: `-rotate-90 flex-none`
text: `[word-break:break-word] flex flex-col font-['Inter:Medium'] font-medium h-[40px] justify-center leading-[0] not-italic relative text-[#171717] text-[16px] w-[169px]`

| literal | **`Figma designs`** |
| font-family / weight | Inter / `500` |
| font-size | `16px` |
| color | `#171717` |
| rotation | `-90°` |

**format label** — `40001034:1042` / `40001034:1782`
inner `40001034:1043` / `1783`: `flex h-[169px] items-center justify-center relative shrink-0 w-[40px]`
inner: `-rotate-90 flex-none`
text: same class string as the description, plus `whitespace-pre-wrap`

| literal, frame `40001034:1035` | `` `Response  Format  B` `` — **two spaces** between each word |
| literal, frame `40001034:1775` | `` `Response  Format  A` `` — **two spaces** between each word |
| white-space | `pre-wrap` — the doubled spaces are the design and must survive |

**grippers ×2** — `40001034:1036` + `40001034:1044` (frame B), `40001034:1776` + `40001034:1784` (frame A)
each is `flex-none rotate-180` wrapping a `40 × 40` `gripper-prompt-input`.

### 3.14 · `gripper-prompt-input` — `40000941:23074` · already in the registry

`bg-white content-stretch flex items-center justify-center px-[10px] py-[8px] relative size-[40px]`,
containing `Meatballs` — `40001010:25332`, `17 × 21`, artwork `figma-26d9932641…svg`.

`registry.json` already maps figmaName `gripper-prompt-input` → `40000941:23074` →
`lit/prompt-input/gripper-prompt-input.ts`. **Reuse the element. Do not re-draw it.**
Same file, same node id, same element — a second implementation would be a second truth.

## 4 · What is NOT in this node — and where the four existing controls go

`output-vontrols` (`40001034:1186`) has **two** children. The product has four canvas controls
that `940d10d` placed inside it: `Rendered / Raw`, `Copy`, `Regenerate`, `Clear`. They are not
in that frame in the drawing, and they do not go there.

`WHAT-THEY-BUILT-WHAT-WE-BUILT.md` §D5 keeps them as a deliberate placeholder — *"left alone for
now… a placeholder that will be switched later"*. They are kept. **Placement, decided by the
design owner 2026-09-14:** they render **in the body of the output area, underneath the output
content** — inside `output-area` (`40000909:4165`). The designed bar is not widened to hold them.

| where | what belongs there |
| --- | --- |
| `output-vontrols` `40001034:1186` | **the drawing only** — selector tile (3.4–3.6) + model button (3.7–3.8). Two children, exactly. |
| `output-area` `40000909:4165` | the output content; **and beneath it**, the §D5 placeholder controls |
| the four controls | **not designed.** `AGENT_OPEN_GAPS.md` §`event-unheard` already records that `copy-output` and `regenerate-requested` dispatch into nothing. They stay marked as placeholder. |

This is the reading of the drawing, not a compromise around it: the drawing gives one bar with
one selector and one model button, and one large pane whose entire body is empty. Controls that
have no node go in the region with no content — not in a region that has exactly two named
children, which is where `940d10d` put them.

## 5 · The description channel — read it, it is addressed to the builder

Per `AGENT_BRIEF.md` §2, everything in this section arrives in `get_design_context`'s
**"Component descriptions"** block. That is the **description** channel — *what a component is
for* — **not** the annotation channel (*what a node does*). The two were confused once already in
this repository and it is on record. Do not report one as the other.

**`model-btn-label` — `40000973:24205`.** Verbatim, in full:

> testing to see if Deepseek can see the notes - this represents the model layer. I assume it's
> linked to documentation somewhere. This is pretty cool. I think I've got it in the right place
> now it's verify you

This note was written as a probe, and it is the receipt for the failure this file exists to
correct. `940d10d` never read it. It rendered `<model-selector-button>` **plus** a `<span>` of the
model name, where the drawing has one `171px` tile whose whole label is `Models` (§3.8).

**`chevron-blue-closed` — `40000922:4875`.** Verbatim:

> Used to indicate a grphic

The known placeholder, typo included. Recorded, not corrected.

**`gripper-prompt-input` — `40000941:23074`.** Verbatim:

> **Data:** sections = workspace.left_column.sections[] (reorderable list)
> Source: agent_rpc save-surface → session.left_column.sections
> On drag: dragstart → record dragIndex; dragover → preventDefault (allow drop);
> drop → dispatch section-reorder { from: &lt;i&gt;, to: &lt;j&gt; }
> Track: track section_reordered { from, to }
> State: idle (default) / dragging (drop-target row shows highlight)
> Disabled: System Role (sticky) — not draggable, no gripper drag
> A11y: gripper draggable, aria-label "Drag to reorder"; keyboard Alt+↑ / Alt+↓
> Connects: reorders sections[]; persisted on save via save-surface
> Failure: drop outside the list → cancel, no reorder

**O6 — open, does not block.** This contract is written for the **left column's** section list
(*"reorders sections[]"*, `session.left_column.sections`). The middle column's vertical tabs
instantiate the same component with the same node id. Whether those instances carry the same
contract, or a resize contract instead — `workspace-layout` dispatches `resize-start` /
`resize-end` — is not stated by the node data. **The grippers are rendered; their handler is not
invented here.**

## 6 · Two recorded limits of the value table — why the gate is this file, not `VALUES.json`

`design-extract.mjs` runs green on this subtree (`center-panel-3rd-col: 30 nodes, 2 assets`,
`nodesScanned` 42 → 76). Both limits below are properties of the **extractor**, not of the
design. Neither is a reason to hand-edit `VALUES.json`; both are reasons this page exists.

### 6.1 · A shared `data-name` silently overwrites — and it dropped the border

`design-extract.mjs` keys nodes by `data-name` (`if (!nameMatch && !classMatch) continue;` …
`const key = nameMatch ? nameMatch[1] : node-400…`). Both vertical tabs are named
`vertical-tab-A`, so the second one processed **overwrites** the first. Measured, not assumed:

```
key vertical-tab-A -> 40001034:1775      # the borderless frame survived
1035 present under any key? False        # the border-bearing frame is absent entirely
css: { background-color:#ffffff, align-items:center, box-shadow:5px 0px 2px rgba(0,0,0,0.15),
       flex-direction:column, gap:10px, justify-content:center, position:relative,
       width:100%, height:100% }          # no border-left anywhere
```

`40001034:1035` — and with it `border-left: 1px solid #8b8b8b` — is **not representable** in
`VALUES.json` as this extractor stands. §3.11 is the only record of it.

One correction, checked rather than assumed: `#8b8b8b` **does** occur under
`center-panel-3rd-col` in `VALUES.json`, and it is *not* a border. It is `model-btn-label`'s
**text colour** — node `40000973:24203`, `"color": "#8b8b8b"`, font-size `16px`, centre-aligned
(§3.8). Verified directly: a search for `border-left` anywhere under this component returns
**NONE**. Text colour and border colour share one hex by coincidence, which is exactly the kind
of hit that a careless grep reports as the other.

### 6.2 · Classes the extractor has no mapping for

Recorded so that *"not in `VALUES.json`"* is never misread as *"not in the design"*. Each of
these is in §3 next to its node id:

| class | why it is missed |
| --- | --- |
| `font-['Inter:Bold']`, `font-['Inter:Medium']`, `font-['Inter:Semi_Bold']` | no family mapping exists |
| `font-medium` | `CLASS_MAP` carries `font-bold`/`font-semibold` only |
| `drop-shadow-…` applied via a `className` **prop** (`<ChevronBlueClosed className=… />`) | the matcher reads `className="…"` literals, not props — `chevron-blue-closed` extracts an **empty** css object |
| `-rotate-90`, `rotate-180`, `-scale-y-100`, `-rotate-90 flex-none h-[100cqw]` | transforms are not mapped |
| `border-l`, `border-[#8b8b8b]`, `border-solid` | borders are not mapped |
| `whitespace-nowrap`, `text-right`, `flex-[1_0_0]`, `w-full`, `h-full`, `max-w-[500px]`, `min-w-px`, `min-h-px`, `items-start` (on `right-panel-horiz-tab`) | partially or wholly unmapped |

## 7 · Open questions, consolidated — none of them blocks starting

| id | question | disposition |
| --- | --- | --- |
| **O1** | the `-scale-y-100 rotate-180` chain on `right-panel-horiz-tab`, `output-vontrols`, `output-area` | **Resolved by evidence, recorded:** applying it mirrors every glyph horizontally (`rotate-180` ∘ `scaleY(-1)` = `scaleX(-1)`), and the drawing's text is upright and readable. These wrappers are therefore codegen artifacts of reversed auto-layout, not authored mirrors. **Not applied.** The text rotations (`-rotate-90`) are separate and *are* applied — without them the vertical tab's text is not vertical. |
| **O2** | tile shadow blur — node class says `5px`, variable `button drop` says `10` | node applied (`5px`); both recorded (§3.4) |
| **O3** | selector label — node says `Agent Flow`, §D1 says "an empty label" | node implemented (`Agent Flow`); §D1 read as the pre-Run runtime state (§3.5) |
| **O4** | the two tabs are both named `vertical-tab-A` and their names/labels are crossed | implemented as read; **no renaming in code**; see §6.1 for the consequence |
| **O5** | frame `1035` has a left border, frame `1775` does not | both implemented as read; the border exists only in §3.11 |
| **O6** | the gripper's documented contract is the **left** column's section reordering | grippers rendered; **no handler invented** |
| **O7** | `copy-output` / `regenerate-requested` dispatch into nothing (`AGENT_OPEN_GAPS.md` §`event-unheard`) | controls stay where §4 puts them, marked placeholder |
| **O8** | tab order: metadata gives `1035` at `x=491` and `1775` at `x=531`; the transform chain shifts these by one tab width | **Derived from the arithmetic in §1.2, not invented:** panel occupies `0–451`, so `1035` sits at `451–491` (immediately right of the panel — which is why it, and not `1775`, carries a *left* border) and `1775` at `491–531`. Implemented in that order. |

## 8 · The rule

> **A value in `<compiled-output-viewer>` appears in §3 next to the node id it was read from, or
> it does not appear in the element.**

And the corollary, learned from `940d10d` and worth keeping:

> **A green gate is not evidence of fidelity.** `tsc`, `vitest` (226/226) and `npm run build`
> (catalog GREEN) were all green on a design that had never been read. None of them can see a
> drawing. Only §3 can.

## 9 · Built and measured against the drawing — 2026-09-14

`940d10d` reverted (`da05a4e`). `<compiled-output-viewer>` rebuilt from §3 alone. Everything
below was **measured** off the running element (`getBoundingClientRect` / `getComputedStyle`),
not read back off the source.

### 9.1 · Geometry — the element at the drawn host width (531px)

| measured | value | the drawing says |
| --- | --- | --- |
| panel width | `451` | `451` — `w-[451px]` |
| controls width | `431` | `431` |
| **tile width** | **`250`** | **`250`** — `ouput-selector-tile` |
| model button | `171` | `171` |
| tile + model + gap | `250 + 171 + 10 = 431` | `output-vontrols` = `431` |
| output area width | `431` | `451 − 10 − 10` |
| output area height | `649` | `732 − 10 − 40 − 10 − 23` |
| tab widths | `40`, `40` | `40`, `40` |
| **column total** | **`531`** | **`531`** — `center-panel-3rd-col` |

Note the tile: it measures **250**, which is `40001034:1187`. §D1 of
`WHAT-THEY-BUILT-WHAT-WE-BUILT.md` calls the 431×40 row the tile, but 431 is that row's
*parent*. The element follows the node, and the arithmetic above closes either way.

### 9.2 · Styles

| measured | value | node |
| --- | --- | --- |
| `output-type` | `18px / 700 / rgb(23,23,23) / Inter` | `40001034:1190` |
| tile | `radius 6px · padding 0 10px · height 40` | `40001034:1187` |
| tile shadow | `-4px -4px 5px rgba(0,0,0,.15)`, `4px 4px 5px rgba(0,0,0,.15)` | `40001034:1187` |
| model button | `171 × 40`, label `Models` `#8b8b8b` `16px/700` | `40000973:24205` |
| output body | `14px / 500 / rgb(23,23,23)` | `40000909:4168` |
| output area | `padding 20px · radius 6px` | `40000909:4165` |
| tab (first) | `border-left: 1px rgb(139,139,139)` | `40001034:1035` |
| tab (second) | `border-left: 0` | `40001034:1775` |
| tab shadow | `5px 0 2px rgba(0,0,0,.15)` — **both** | both |
| every tab text run | `writing-mode: vertical-rl` (the `-rotate-90`) | all runs |
| format run | `16px / 500 · height 169` | `40001034:1043` / `1783` |

### 9.3 · Literals, exactly as drawn

| rendered | node |
| --- | --- |
| `Agent Flow` | `40001034:1190` |
| `Models` | `40000973:24203` |
| `Tokens: 2022 Cost: $0.00802` — from the `tokens` and `cost` properties | `40001034:1039` |
| `Figma designs` | `40001034:1041` |
| `Response  Format  B` — **two spaces** | `40001034:1043` |
| `Response  Format  A` — **two spaces** | `40001034:1783` |

One space between `Tokens:` and `Cost:`, as drawn. The `·` that `940d10d` inserted is gone.

### 9.4 · Where the four controls went

`Rendered/Raw`, `Copy`, `Regenerate`, `Clear` render **in the body of `output-area`, beneath
the content** — §4 — verified on a single row with the meta at their left. `output-vontrols`
has exactly two children. Nothing from §D5 was deleted.

### 9.5 · Gates

- `npm run typecheck` → **0** (`typecheck-guard: ok`, `tsc -b` clean)
- `npx vitest run` → **226 / 226**, 19 files
- `npm run build` → **exit 0**, catalog **GREEN** on `prompt-composer` (42 advisory) and
  `ecommerce` (43 advisory)

One test changed, and it was not weakened: `compiledOutputFold.test.ts` selected
`pre.output.raw`; the raw `<pre>` is now `pre.raw` because the class `output` moved to the
scrolling container `.output-body`. The assertion — *Raw shows the whole block, unfolded* — is
untouched.

### 9.6 · A trap in the checker, recorded because it cost an hour

`catalog-check.mjs` skips a component's unheard-event findings when one marker string appears
**anywhere** in that component's source. The marker is the two fragments `TODO` and
`(behavior)`, adjacent.

Writing it next to the selector or the gripper — legitimately "undefined in Figma" — would also
have silenced `copy-output` and `regenerate-requested`, which are **real** findings
(`OPEN-ITEMS.md` `check:event-unheard`, `AGENT_OPEN_GAPS.md` §`event-unheard`). Symptom: the
derived count fell 11 → 9 and the build went RED, and the register's own suggested "fix" —
*"set the recorded count to 9"* — would have deleted two live findings.

So `compiled-output-viewer.ts` names the marker only as two separate fragments. The count is
back to 11 and `open-items-register` runs clean. The marker is per-event in intent and
**per-file in implementation**; that mismatch is the defect, not the counts.

### 9.7 · Two things observed but not touched

1. **Two `<compiled-output-viewer>` elements exist in the running app** — one with
   `slot="middle"` inside `workspace-layout`, one with `id="middle-column"`. Pre-existing; not
   caused by this work. Worth a look.
### 9.8 · A correction of mine: the panel was built fixed-width and must flex

Found in review on 2026-09-14. Not from `940d10d` — my own error, in the rebuild.

`.panel` was written as `width: 451px`, citing `w-[451px]` out of the `output-container` pull.
That is the **resolved** width, not the node's: `40000909:4085`'s own class string is
`size-full`, and `451 = 531 − 40 − 40`. As a hard width it reproduced the drawing at exactly 531
and was wrong at every other width — and the middle column's width in this app is driven by
`workspace-layout`, not by 531. It is now `flex: 1 1 auto`, so the panel takes whatever the two
fixed 40px tabs leave. At 531 that still yields 451.

**On whether the drawing meant fixed: the pull is ambiguous, and both readings have evidence.**

| reading | evidence |
| --- | --- |
| **fills** | the node's own class string is `size-full` |
| **fills** | `ouput-selector-tile` (`40001034:1187`) is `flex-[1_0_0]` **and** carries `max-w-[500px]`. The tile is 250 in the drawing; to reach a 500 cap the panel would have to be ≥ 701 wide. A 500px cap on a tile that can never exceed 250 is dead design — so the drawing anticipates a **wider** panel than it was drawn at. |
| **fixed** | in `output-container`'s context the same node resolves to `w-[451px]`, and its wrapper is `shrink-0` / `flex-none` — the codegen signature of fixed sizing |

The third row is why the pull cannot settle it. **The decisive source is the node's own sizing
field:** in Figma, select `right-panel-horiz-tab` (`40000909:4085`) and read the **W** control —
a typed number means *Fixed*; a "Fill" control means *fill container*.

**D-W1 — open.** Which of the two the drawing means. The element flexes meanwhile, because that
is the only behaviour correct either way for a resizable column: if the drawing does fix the
width, then the fixed-ness belongs on the **column** (`center-panel-3rd-col`, 531), not on the
panel inside it — no implementation can honour a fixed 451px inside a column whose width the user
drags.

**Measured, four host widths, live element:**

| host | panel | tab B | tab A | selector tile | model button | panel + tabs |
| --- | --- | --- | --- | --- | --- | --- |
| `531` | `451` | `40` | `40` | `250` | `171` | `531` |
| `700` | `620` | `40` | `40` | `419` | `171` | `700` |
| `400` | `320` | `40` | `40` | `119` | `171` | `400` |
| `900` | `820` | `40` | `40` | **`500`** | `171` | `900` |

The panel is `host − 80` at every width; the tabs never move; nothing overflows at either end.

**The last row is the argument in the table above, measured.** At host 900 the tile reaches
*exactly* `500` and stops — its `max-w-[500px]` from `40001034:1187`. That cap is unreachable at
the drawn 531, where the tile is 250, and it can therefore only ever bind if the panel grows.
**The node's own `max-w-[500px]` is the evidence that the panel was not meant to be fixed.**
D-W1 stands as a question about the node's sizing *field*, but the arithmetic has already
answered it: the drawing anticipates a wider panel than it was drawn at.
