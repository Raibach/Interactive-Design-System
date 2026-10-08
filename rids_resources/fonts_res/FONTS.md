# FONTS — the one list of every place the site's fonts are set

*Last verified: 2026-10-07 (the owner's font pass — "Use our fonts only - no API calls").*
*This file lives beside the font files it describes: `rids_resources/fonts_res/`.*

---

## 1. The ruling (owner, 2026-10-07)

> "Arial or rounded fonts -> becomes Nunito (found in chat interfaces for Grace).
> Inter -> everywhere else. Numbers -> Inter. Use our fonts only - no API calls."

| Found | Becomes | Where |
| --- | --- | --- |
| `'Arial Rounded MT Bold'` (and any Arial) | **Nunito** | the chat interfaces for Grace — the nine components in §5 |
| `'DM Sans'` | **Nunito** | one spot: the conversations line in `chat-header.ts` (owner's answer, same day: both chat cards Nunito) |
| `'Inter'` | **Inter** (unchanged) | everywhere else |
| figures ("numbers") | **Inter** | inside the Nunito components: "12s", "89.38%", "28.495s", "1,234" render as one Inter token; words stay Nunito; standalone counts (e.g. the card's like count) are Inter |

No page, tool, or render in the product may request a font over the network. Everything is
served from this origin, from the files below. The only remaining Google font links in the
repository live in **archived or vendored third-party material** (§9) — not the site (the
Development room's embedded tool was cut on the same day; §9).

Note on italic: no italic faces are shipped (Inter and Nunito italic TTFs exist in this
folder but are not cut). A browser that italicises synthesises the slant, exactly as it
already did for Inter before this pass.

---

## 2. The library — the source files (this folder)

| Folder | Family | Files | License | Used by the app? |
| --- | --- | --- | --- | --- |
| [`Inter/`](./Inter/) | Inter (opsz 14–32, wght 100–900) | variable TTF + 54 static TTFs | [OFL](./Inter/OFL.txt) | yes — the application face |
| [`Nunito/`](./Nunito/) | Nunito (wght 200–1000) | variable TTF + 16 static TTFs (`Nunito.zip` is the download archive) | [OFL](./Nunito/OFL.txt) | yes — the chat's rounded face since 2026-10-07 |
| [`Manrope/`](./Manrope/) | Manrope | variable TTF + static set | OFL | no — available, not referenced by the site |

These TTFs are the master copies. The site serves woff2 cuts of them (§3); the recipe for
re-cutting is in §8.

---

## 3. The served files — `frontend/public/fonts/`

| File | What it is |
| --- | --- |
| `fonts.css` | **THE SHEET.** All four `@font-face` blocks: Inter (100–900) and Nunito (200–1000), each in latin + latin-ext subsets with Google's own subset `unicode-range`s. Every entry point links this one file. |
| `inter-var-latin.woff2`, `inter-var-latin-ext.woff2` | Inter's two subsets (fetched once from Google's own files on 2026-10-06, served locally since). |
| `nunito-var-latin.woff2`, `nunito-var-latin-ext.woff2` | Nunito's two subsets, cut from `Nunito/Nunito-VariableFont_wght.ttf` with `pyftsubset` on 2026-10-07 (§8 has the exact command). |
| `inter.css` | **Not a sheet — a compatibility redirect.** One `@import` to `fonts.css`, kept so pages built before the 2026-10-07 rename (any `frontend/dist` older than that) still resolve `/fonts/inter.css`. Delete it once no built page references it. |

Served from the origin by: Vite (dev, `public/` → `/fonts/*`), and `backend/main.py`'s
`/fonts` mount (every backend origin — the mount reads `frontend/public/fonts/`, and the
Dockerfile copies `frontend/public` into the production image for it).

---

## 4. Entry points — who links the sheet

| Location | Line to look for |
| --- | --- |
| `frontend/index.html` | `<link rel="stylesheet" href="/fonts/fonts.css">` (and the splash card's inline styles, `font-family: 'Inter'`) |
| `frontend/src/components/IngestModal.tsx` | preview `<iframe>` document: `window.location.origin + '/fonts/fonts.css'` |
| `frontend/src/components/lit/draft-preview.ts` | the same pattern for the draft preview document |
| `backend/routes/figma_intake.py` | the intake page's `<head>`: `<link rel="stylesheet" href="/fonts/fonts.css" />` |
| `backend/main.py` | the `/fonts` mount (serves `frontend/public/fonts/`); the SPA fallback deliberately does NOT answer `/fonts/*` with HTML |
| `Dockerfile` | `COPY frontend/public ./frontend/public` (production image; the mount's source) |

---

## 5. The Nunito set — the nine chat components (face swapped 2026-10-07)

All in `frontend/src/components/lit/`. Each declaration carries a comment naming the ruling.

| File | What draws in Nunito |
| --- | --- |
| `chat-panel.ts` | the panel's base face (`:host`) |
| `chat-header.ts` | the readout bar/card (`.status`, `.card`) **and** the conversations line (`.readout.dm` — was DM Sans); the line's figures render Inter via `figures()` |
| `chat-messages.ts` | the thread (`.thread`) and the empty-state line (`.empty`); "Worked for Ns" figure via `figures()` |
| `chat-fold.ts` | the fold panel/tile; the count chip's figure via `figures()` |
| `chat-plugin-tray.ts` | the tray label (`.label`) |
| `user-response-bubble.ts` | the person's line (`.line`, `::slotted(*)`) |
| `agent-card-element.ts` | the console card (`.card`) and the delete label; the version figure via `figures()`; `.like-count` is a standalone figure and is set in Inter directly |
| `output-header.ts` | the readout line (`.line`); its figures via `figures()` |
| `output-footer-area.ts` | the plugin label (`.btn-text`) and the credit (`.credit-text`) |

The figures rule itself is shared: `frontend/src/shared/figures.ts` — `figureStyles` (the
`.num` Inter face) + the `figures()` helper that wraps digit runs. The five components that
render generated figures spread it into their styles.

---

## 6. The Inter set — everywhere else (faces unchanged)

These carry explicit `'Inter'` declarations (or read the `--ds-font` token) and were NOT
touched by the pass. All in `frontend/src/components/lit/` unless noted:

- explicit `'Inter'` in the element's styles: `a2ui-primitives.ts`, `a2ui-renderer.ts`,
  `ai-surface-sandbox.ts`, `artifact-canvas.ts`, `canvas-footer.ts`, `catalog-schema-view.ts`,
  `chat-action-bar.ts`, `chat-footer.ts`, `chat-navigation-bar.ts`, `compiled-output-viewer.ts`,
  `control-bar.ts`, `draft-canvas.ts`, `error-banner.ts`, `figma-layers-view.ts`,
  `governance-usage-view.ts`, `output-controls.ts`, `prompt-section-editor.ts`, `room-embed.ts`,
  `small-dropdown.ts`, `workspace-layout.ts`, `prompt-input/` (`model-selector-button.ts`,
  `prompt-container.ts`, `prompt-input-section.ts`, `prompt-input-section-department-role.ts`,
  `prompt-input-section-system-role.ts`, `prompt-textarea.ts`, `role-dropdown.ts`,
  `role-tile.ts`), and the four translated design components `f-40001204-5752.ts`,
  `f-40001206-2888.ts`, `f-40001207-3497.ts`, `f-40001207-3559.ts`;
- via the `--ds-font` token: `agent-flow.ts`, `eval-feed.ts`, `trace-feed.ts`;
- React surfaces: `frontend/index.html` (splash), `GateSplash.tsx` and `LeftVerticalMenu.tsx`
  (inline `'Inter'`), `SignUpWizard.tsx` (inherits), `chat-product-thread.ts` (inherits its
  room's Inter; its code blocks are monospace).

Global styles and tokens:

| Location | What it sets |
| --- | --- |
| `frontend/src/index.css` | `body { font-family: 'Inter', system-ui, sans-serif; font-weight: 500; }` — the site-wide base (plus the one chat palette for every chat seat) |
| `frontend/src/global.css` | loaded after `index.css`; carries no font declarations today |
| `frontend/tailwind.config.ts` | `fontFamily.sans: ['Inter', 'system-ui', 'sans-serif']` (Tailwind's `font-sans`) |
| `frontend/src/shared/design-tokens.ts` | `--ds-font: 'Inter', system-ui, sans-serif` — the token the Lit components read inside shadow roots |

---

## 7. Monospace — kept, deliberately (not part of the swap)

Code, JSON and raw-output contexts keep the machine's own monospace stack
(`ui-monospace, SFMono-Regular, Menlo, monospace` style). That is a system font — no files,
no API calls — and the design system's own note stands: figures align through Inter, and a
value that must read as code says so in its context. Files with monospace declarations:
`chat-product-thread.ts`, `chat-messages.ts` (fold titles), `compiled-output-viewer.ts`,
`catalog-schema-view.ts`, `figma-layers-view.ts`, `error-banner.ts`, `component-preview.ts`,
`ai-surface-sandbox.ts`, `IngestModal.tsx` and `draft-preview.ts` (captions/status),
`pages/CommandCenter.tsx`, `pages/WritingAreaIndex.tsx` (dev panels), `figma_intake.py`
(textareas/pre).

---

## 8. Backend render paths — how fonts reach them

| Location | What it does |
| --- | --- |
| `backend/main.py` | mounts `/fonts` from `frontend/public/fonts/` — source, not build output; a genuinely missing font file 404s honestly (the SPA fallback skips `/fonts/`) |
| `backend/render_component.py` | the fidelity screenshot page carries `fonts.css` inline with its urls resolved to `file://` paths on this disk. If the sheet or a font file is missing the render REFUSES (`{"ok": false, "error": ...}` naming the path) — it never draws substitute faces |
| `backend/routes/figma_intake.py` | the intake page links `/fonts/fonts.css` from its own origin |
| `backend/design_renderer.py` | emits `font-family` from the measured design spec, translated through `_FONT_SUBSTITUTIONS`: `Arial Rounded MT Bold`/`Arial`/`DM Sans` → `Nunito` (the owner's ruling; everything else keeps the design's own family) |

### The conversion recipe (how the woff2 files were cut)

```bash
# one-time tooling (throwaway venv; nothing installed into the app)
python3 -m venv /tmp/nunito-woff2 && /tmp/nunito-woff2/bin/pip install fonttools brotli

# latin
/tmp/nunito-woff2/bin/pyftsubset Nunito-VariableFont_wght.ttf \
  --output-file=nunito-var-latin.woff2 --flavor=woff2 --layout-features='*' \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"

# latin-ext
/tmp/nunito-woff2/bin/pyftsubset Nunito-VariableFont_wght.ttf \
  --output-file=nunito-var-latin-ext.woff2 --flavor=woff2 --layout-features='*' \
  --unicodes="U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF"
```

### How to change the setup later

1. New family: drop the TTFs + OFL into a folder here, cut the two woff2 subsets (§8 recipe),
   place them in `frontend/public/fonts/`, add `@font-face` blocks to `fonts.css`, and add the
   family to §5/§6 of this file.
2. Replace a family: same as above — the components point at family NAMES, so only `fonts.css`
   and the file names change.
3. Retire `inter.css`: delete it once no built page references `/fonts/inter.css` (i.e. after
   the next `frontend/dist` build).
4. To see every declaration in one command:
   `grep -rn "font-family" frontend/src backend --include='*.ts' --include='*.tsx' --include='*.css' --include='*.py'`

---

## 9. Not touched, on purpose (recorded so the list is complete)

| Where | Why |
| --- | --- |
| `Raibach_IDS-pre-sept30/` | the pre-Sept-30 archive (untracked). An archive is a record — it keeps the Google links it was archived with. |
| `development/vendor/` (the agent SDK's example UIs, the automation service and its venv — including library built-ins like FastAPI's own docs page) | vendored third-party material; nothing in the product's served path loads any of it. |
| `rids_resources/carbon-web-components-main/` | a resource archive; its demo apps reference IBM Plex from IBM's CDN inside example files. The `@carbon/web-components` npm dependency has zero imports in the current source — its CDN fonts can only fetch if a Carbon component is ever mounted, and would need the same cut at that point. |

### The Development room's workspace — cut, not exempted (2026-10-07)

The tool embedded in the Development room (`development/dev-tool/`) carried the same kind of
debt: its vendor sheet `@import`-ed **Outfit** and **IBM Plex Mono** from Google — and no rule
in the build used either family (every stack resolves through the system vars `--font-sans` /
`--font-mono`), so the imports were pure weight: two calls out of the machine per cold load
that drew nothing. They are CUT by `development/openhands-patch.sh` (item 9): stripped from
the served sheet, which is also copied to a stripped content-hashed url and re-linked, so
browsers that cached the vendor name get the cut on the next ordinary reload. The tool now
draws in its own system stacks — no files, no calls. (If its chrome should ever wear Inter or
Nunito, that is a one-block addition to the same patch script.) The integrations catalog's icon
CDN (`cdn.simpleicons.org`) is cut the same way (openhands-patch.sh item 10 — a dead-loopback
rewrite of the ~40 remote logo urls): bundled marks draw, the rest simply fail to draw; no
external request exists.

The vendor SOURCE clone (`development/OpenHands-main/`) keeps the vendor's imports as shipped
— deliberately: the house cuts at the built output, never by forking the source ("one script,
one look" — the same script runs on the Mac after an install and inside the hosted image at
build time). The hosted image runs it (`development/agent-canvas/Dockerfile`: `RUN bash
/src/development/openhands-patch.sh --hosted`), so the hosted tool takes this cut on its next
rebuild; a build older than 2026-10-07 serves the imports until then (measured on the deployed
`canvas--dev-workspace` origin, same day).

Records that NAME fonts but are not CSS (do not edit these to change a font — they describe
the designs; keep them in sync at the design source): the A2UI catalogs
(`frontend/src/components/A2UI/catalogs/*/catalog.json`, e.g. "Arial Rounded MT Bold 12px"
inside `size` strings), `frontend/src/shared/tag-registry.ts`, and
`frontend/src/components/registry.json` ("fontFamily": "Inter" on icon entries).
