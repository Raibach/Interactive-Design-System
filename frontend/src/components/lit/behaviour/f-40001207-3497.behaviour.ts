/**
 * THE CATALOGUE ROW'S BEHAVIOUR — everything about `<f-40001207-3497>` that is not a drawing.
 *
 * THE ELEMENT THIS ATTACHES TO IS GENERATED. `frontend/src/components/lit/f-40001207-3497.ts` is
 * written whole by `render_spec` (backend/design_renderer.py) from what Figma measured, so a
 * re-ingest replaces every byte of it — and measured 2026-09-30, that is exactly what happened: the
 * row's props, its `chevron-toggle` dispatch and its `status` slot had been hand-added to the
 * generated file, one approve of the node took all three away, and every row in the left column
 * went back to drawing Figma's sample words. Nothing reported a fault.
 *
 * SO THE BEHAVIOUR LIVES HERE INSTEAD. This file is hand-written, is never generated, and no ingest
 * can reach it: an approve may only write `lit/f-<figma node id>.ts` (`_SAFE_TAG_RE`,
 * backend/routes/figma.py; the commit writes `drafts[tag]` at that one path). The generated element
 * calls it through the constant seam — `connectedCallback → attachBehaviour(this, '<tag>')` — and
 * nothing in the generated file knows what the behaviour does. That is what makes a re-ingest an
 * update to the DRAWING and not to the component: the pretty part is re-measured, and this part is
 * not touched at all.
 *
 * WHAT IT OWNS, and what each piece is waiting on:
 *
 *   * the row's three VALUES — `name`, `code`, `description` — written into the design's own boxes.
 *     WHICH BOX GETS WHICH VALUE IS THE APPLICATION'S STATEMENT, and the owner made that a decision
 *     on 2026-09-30 rather than an oversight: *"the designers aren't gonna add those… You need to add
 *     those at least for this application."* Figma drew the row; the application says what the row
 *     shows and where, and it says it here, in a file the ingest cannot write. The values themselves
 *     come from the application's own records (the tree that lists the catalogue), never from Figma.
 *     A design that DOES carry `Data: name` on a layer gets its binding from the generator instead —
 *     that reading is built and tested — but nothing here waits for one.
 *
 *     THE PROPS ARE THE BINDING SURFACE, and they are declared reactive for that reason: the
 *     surface's data model can bind them the way it binds any other catalogue element
 *     (`{ "path": "/session/elements/0/name" }`, resolved by the renderer's own resolver and assigned
 *     to this element), so THE ASSEMBLY STATES WHAT and this file states WHERE. The tree that lists
 *     the catalogue happens to be the consumer today; it is not the only one that can be.
 *   * `open` — the row's expanded state. Declared here for the same reason: the chevron is an
 *     INSTANCE of a component set with variants (`chevron-blue-closed` / `chevron-blue-open`), and
 *     reading a variant property off an instance is generator work that is not built. When it is,
 *     `open` becomes the design's own prop and this declaration goes.
 *   * the chevron's click — it flips `open` and REPORTS the result, because the tree that lists the
 *     catalogue records what it is told rather than toggling a second time (`figma-layers-view.ts`,
 *     `_setDeclaredOpen`).
 *   * the status well — the design's own box (`slot-status-icon-container`) gets the `status` slot
 *     the tree fills with its dot. A slot is not something a design can state in this repository's
 *     grammar, so it belongs here; when the drawing can say "this box is a well", it moves there.
 *
 * WHAT IT DOES NOT OWN, and this is the point of the whole mechanism: the drawing. The chevron's
 * geometry, the name's type, the row's measured sizes — all of that is the generated file's, and
 * this module never writes a declaration into it.
 *
 * THE BOXES ARE MATCHED BY LAYER NAME, WHICH IS THE DESIGN'S OWN. `catalog-name` and
 * `functions-label` are the names the designer gave those layers, and this repository's contract
 * rules make layer names stable identifiers — paint and geometry edits change nothing upstream. A
 * box that is not found is NOT an error state to fake: the design's own sample text simply stands,
 * which is what an unbound drawing looks like and is visibly not the application's data.
 */
import type { LitElement, PropertyDeclarations } from 'lit';
import { ensureSlot, reapplyAfterRender, writeSpans, writeText } from './boxes';

const TAG = 'f-40001207-3497';

/** The design's names for the row's parts — layer names, kept verbatim. */
const NAME_BOX_CLASS = 'catalog-name';
const DESCRIPTION_BOX_CLASS = 'functions-label';
const CHEVRON_CLASS = 'chevron-blue';
const STATUS_WELL_CLASS = 'slot-status-icon-container';

/** What the tree that lists the catalogue hands this element, and reads back off it. */
interface Row {
  name?: string;
  code?: string;
  description?: string;
  open?: boolean;
}

/** Where the delegated listener and the instance's own hook are kept, per instance. */
interface Bound {
  onClick: (event: Event) => void;
  /** Undoes the after-render hook this companion took — see `boxes.ts`. */
  unhook: () => void;
}
const BOUND = new WeakMap<HTMLElement, Bound>();

/** True when a click's path passes through the chevron the design drew. */
function clickedTheChevron(event: Event): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  for (const node of path) {
    if (!(node instanceof Element)) continue;
    for (const name of Array.from(node.classList)) {
      if (name === CHEVRON_CLASS || name.startsWith(CHEVRON_CLASS + '-')) return true;
    }
  }
  return false;
}

export const tag = TAG;

export const properties: PropertyDeclarations = {
  /** What the catalogue calls this component — see the header for why these three are here. */
  name: { type: String },
  /** The address the row shows under the name: the Figma node, or the element's own tag. */
  code: { type: String },
  /** What it is, in the catalogue's words. */
  description: { type: String },
  /** Whether the row is expanded. The companion holds it, flips it on the chevron, reports it. */
  open: { type: Boolean },
};

/**
 * Attach the row's behaviour.
 *
 * ONE CLICK, ONE THING. The chevron sits inside a row that is itself a button, so the click is
 * stopped before it reaches the row: without that, clicking the chevron would both expand the row
 * AND navigate to the component's preview, which is the one-click-two-actions fault the tree's own
 * comment records.
 *
 * THE VALUES ARE RE-PLACED AFTER EVERY RENDER, through `boxes.ts` — the companion runs from
 * `connectedCallback`, before the first render, so the boxes do not exist yet at that moment, and a
 * prop assigned later changes nothing in the DOM unless something re-runs after the render it
 * triggered. `reapplyAfterRender` is that something, and its undo is called on detach.
 */
export function attach(el: LitElement): void {
  const row = el as LitElement & Row;

  const onClick = (event: Event): void => {
    if (!clickedTheChevron(event)) return;
    event.stopPropagation();
    row.open = !row.open;
    el.dispatchEvent(
      new CustomEvent('chevron-toggle', {
        bubbles: true,
        composed: true,
        detail: { open: row.open },
      }),
    );
  };

  el.shadowRoot?.addEventListener('click', onClick);

  // The design's own boxes: the name over the code, the description in its own text box, and the
  // well that takes the tree's mark.
  //
  // A BOX SHOWS ITS VALUE WHEN THERE IS ONE, AND THE DESIGN'S OWN WORDS WHEN THERE IS NOT. That is
  // the rule this repository runs on (unset is not empty) and it was briefly suspended here, on the
  // reasoning that a row is data and should not show mock copy — which blanked every box in a
  // PREVIEW, where no value is handed in at all: the preview draws the design with nothing bound, so
  // "no value" is its normal state, not an empty row. The mock copy is what the design says is in
  // that box, and in a preview the design is the whole truth there is.
  const unhook = reapplyAfterRender(el, () => {
    writeSpans(el, NAME_BOX_CLASS, [row.name, row.code]);
    writeText(el, DESCRIPTION_BOX_CLASS, row.description);
    ensureSlot(el, STATUS_WELL_CLASS, 'status');
  });
  BOUND.set(el, { onClick, unhook });
}

export function detach(el: LitElement): void {
  const bound = BOUND.get(el);
  if (!bound) return;
  el.shadowRoot?.removeEventListener('click', bound.onClick);
  bound.unhook();
  BOUND.delete(el);
}
