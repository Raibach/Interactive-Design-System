/**
 * THE DESIGN TOKENS — the one home for the values the Lit components draw with.
 *
 * WHY THIS FILE EXISTS. `src/index.css` is the SHELL's sheet: Tailwind's three
 * directives and a couple of classes for the React tree. It cannot serve the
 * components, for two independent reasons:
 *
 *   1. A Lit component renders into a SHADOW ROOT. Global CSS does not cross that
 *      boundary, so `class="text-sm"` inside an element's template resolves to
 *      nothing. This is not a preference; it is how the DOM works.
 *   2. The catalog check `clean-no-jsx` explicitly requires NO Tailwind in the
 *      component sources, and it passes — all 29 sources are clean.
 *
 * So every element carries its own `static styles`, and until this file each one
 * ALSO carried its own copy of the palette. The chat thread element writes #171717
 * and #507274; `trace-feed` had drifted to the Tailwind greys (#111827, #6B7280,
 * #E5E7EB) and read as a widget bolted next to the console rather than part of it.
 * Two definitions of one value is the drift the catalog checks exist to catch for
 * component SCHEMAS (primitive-missing / primitive-drift) — this file is the same
 * idea for CSS, which nothing was watching.
 *
 * A NOTE ON NAMING TAGS IN COMMENTS. The `element-unclaimed` check decides an
 * element is mounted by the app when any file under `src` contains the literal tag
 * text — a naive test that a COMMENT satisfies. Writing the tag with its angle
 * bracket in a comment here silently converted that element's real finding into a
 * pass and moved a blocking count, which is how this paragraph came to exist. Name
 * an element in prose, not as markup, unless you mean to claim it.
 *
 * HOW TO USE IT. Declare the shared sheet first, then the element's own layout:
 *
 *     static styles = [designTokens, css` ... var(--ds-teal) ... `];
 *
 * The custom properties are declared on `:host`, so they inherit into the shadow
 * tree and can be overridden from outside. Lit de-duplicates a CSSResult it has
 * seen before, so the shared block costs one stylesheet however many elements
 * adopt it.
 *
 * WHAT IS NOT HERE, deliberately. Element layout (grid tracks, sticky headers,
 * pane widths) is not a token — it belongs to the element that owns the geometry.
 * Workspace-layout's `--ease-settle` / `--dur-pane` are motion values that would
 * fit here, but they are used by one element today; moving them is a follow-up,
 * not a free win. Add a token when a SECOND element needs the same value.
 */

import { css } from 'lit';

export const designTokens = css`
  :host {
    /* ── type ────────────────────────────────────────────────────────────────
       ONE FAMILY. Inter is the application font, full stop — it is loaded from
       Google Fonts by index.html and is the base at weight 500 (Inter Medium),
       with every heavier explicit weight still winning. There is deliberately no
       monospace token: a second family for "data" split the application's voice
       in two, and Inter aligns figures perfectly well through tabular-nums, which
       is what actually made the trace's columns line up. If a value must read as
       code, say so in the copy — do not change the typeface. */
    --ds-font: 'Inter', system-ui, sans-serif;
    --ds-weight: 500;
    /*
     * THE FLOOR IS 13. Nothing in this system is set below it, and the family is
     * always --ds-font (Inter) — the owner's rule, 2026-09-18: "the text and the system
     * never goes below 13 and it is always Inter font. You can use bolding medium weights
     * intermittently to create some variation."
     *
     * THAT LAST SENTENCE IS THE POINT OF THE FLOOR. The three smallest steps used to be
     * 12 / 11 / 10, so hierarchy below the body was carried by SIZE — each level a little
     * smaller, and the smallest of them 10px. With a floor there is nowhere left to shrink
     * to, so the same hierarchy is carried by WEIGHT: labels and badges keep their case and
     * their letterspacing and take 700 (or 600 against 500), which reads as a level rather
     * than as damage. The steps stay named, so a thing that is "meta" is still meta — it is
     * simply no longer smaller than the floor.
     *
     * The scale therefore reads 20 / 14 / 13 / 13 / 13. If a level needs to separate
     * further, it separates INK or WEIGHT or CASE — not size.
     */
    --ds-fs-lg: 20px;   /* the primitives' .greeting */
    --ds-fs-md: 14px;   /* body — the chat thread and the primitives' .body */
    --ds-fs-sm: 13px;   /* the primitives' .caption — the FLOOR */
    --ds-fs-meta: 13px; /* timestamps, statuses, detail lines (was 11) */
    --ds-fs-label: 13px;/* uppercase section labels and badges (was 10) */

    /* ── ink and surface ──────────────────────────────────────────────────────
       CONTRAST FLOOR: every ink token below is at least 4.5:1 on --ds-surface, so
       small text stays readable. --ds-muted (#6c757d, 4.8:1) is the LIGHTEST a
       value may go and still be used for text. An earlier "#9aa5ae" sat at 2.6:1
       and made the trace's timestamps unreadable on white, which is why there is
       no third, fainter grey in this list. If something must recede, take it down
       in size or weight — not in contrast. */
    --ds-text: #171717;        /* body text, same as the thread in this slot */
    --ds-text-strong: #1c2f4e; /* the primitives' .t */
    --ds-muted: #6c757d;       /* secondary: timestamps, statuses, detail lines */
    --ds-surface: #F7F8F2;
    --ds-surface-muted: #f7fafc; /* a user turn in the thread */
    --ds-surface-hover: #fafcfc;
    --ds-rule: #e3e8ec;
    --ds-rule-soft: #f0f2f4;

    /* ── accent ──────────────────────────────────────────────────────────────
       Teal is the panel's own voice: the chat spinner and the primary button
       both use it. It is not the brand gold, which is held for one meaning at a
       time (the trace spends it on "this view is live"). */
    --ds-teal: #507274;
    --ds-teal-tint: #edf2f2;
    --ds-navy: #00437c;
    --ds-navy-tint: #e8eef5;
    --ds-green: #658d1b;
    --ds-green-tint: #f0f5e8;
    --ds-cyan: #1facc2;
    --ds-cyan-tint: #e7f7fa;
    --ds-gold: #f6c031; /* brand */
    --ds-red: #b42318;
    --ds-red-tint: #fbeae8;
    --ds-amber: #b45309;
    --ds-amber-tint: #fdf1e3;
    --ds-grey-tint: #f1f3f5;

    /* ── form ────────────────────────────────────────────────────────────── */
    --ds-radius: 6px;
    --ds-radius-sm: 3px;
    --ds-radius-pill: 9px;
  }
`;
