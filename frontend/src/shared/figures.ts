/**
 * THE FIGURES RULE — a number renders in the system's mono face, whatever face surrounds it.
 *
 * The owner's font ruling, 2026-10-25: Carbon's type — IBM Plex — becomes the one face the
 * application speaks; figures and code take IBM Plex Mono, everything else IBM Plex Sans.
 * The chat's words and the readouts inside it stay distinguishable by family, as before.
 *
 * HOW TO USE IT. Spread `figureStyles` into the element's styles and render any generated
 * line that may carry figures through the helper:
 *
 *     static styles = [figureStyles, css` ... `];
 *     ... ${figures(this._statusLine)} ...
 *
 * The helper wraps the matched runs and nothing else; every other character stays plain
 * text, exactly as it was before — only the figures are re-faced. A `class="num"` span thus
 * exists for generated figures only; prose (a message's own digits) is never rewritten.
 *
 * WHAT IT DOES NOT DO. It declares no weight, spacing or tabular treatment — the rule is
 * the FAMILY, nothing else.
 */
import { css, html, type TemplateResult } from 'lit';

/**
 * One figure: digits with `,`/`.` separators, plus any directly-attached `%` or unit of one
 * or two lowercase letters (`12s`, `300ms`, `5.5x`). A unit only attaches when it touches
 * the digits — "1,234 tokens" wraps `1,234`, never the word after the space. Uppercase is
 * deliberately NOT matched as a unit (a hex run like `3D515B` must not bleed a stray `3D`
 * into this rule's spans in any future line).
 */
const FIGURE = /(\d[\d.,]*\d|\d)(?:%|[a-z]{1,2}(?![a-z]))?/g;

/** The figure face — spread this wherever `figures()` output is rendered. Numbers render in
    the system's mono face, so a figure reads as a figure wherever it stands (owner, 2026-10-25:
    IBM Plex everywhere; figures and code take the Mono). */
export const figureStyles = css`
  .num {
    font-family: 'IBM Plex Mono', monospace;
  }
`;

/**
 * The line, with every figure wrapped in a `.num` span (Inter). Returns the segments for a
 * Lit template — strings and spans, in order; an empty line yields an empty array.
 */
export function figures(text: string): (string | TemplateResult)[] {
  const out: (string | TemplateResult)[] = [];
  let last = 0;
  for (const m of text.matchAll(FIGURE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(html`<span class="num">${m[0]}</span>`);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
