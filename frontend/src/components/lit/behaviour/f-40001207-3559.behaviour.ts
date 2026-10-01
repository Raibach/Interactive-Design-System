/**
 * THE CATALOGUE HEAD'S BEHAVIOUR — everything about `<f-40001207-3559>` that is not a drawing.
 *
 * WHY IT IS NEEDED, MEASURED 2026-09-30. `frontend/src/components/lit/f-40001207-3559.ts` was
 * hand-edited after its ingest: it declares `name`, `count`, `catalogId` and `description`, gives
 * them the measured sample text as constructor defaults, and renders `${this.name}`,
 * `${this.count}` and `${this.catalogId || this.description}` — in a file whose own header still
 * says *"there is no interpretation in this file, and re-ingesting the same node produces this same
 * file."* That sentence is false of it, and the next approve of node `40001207:3559` deletes all
 * four bindings, exactly as an approve of the row's node deleted the row's (`f-40001207-3497`,
 * 2026-09-30). The drawing would come back correct and the head would draw Figma's sample words.
 *
 * WHAT THE TREE HANDS IT (`figma-layers-view.ts`, `_renderCatalog`): `.name` — the catalogue's own
 * title; `.count` — how many components it declares; `.catalogId` — the URL the catalogue is
 * published at. `description` is kept because the element's own file declared it, and it is the
 * fallback the hand-edit used in the third box.
 *
 * WHAT IT DOES NOT DO, and this is deliberate rather than unfinished: THE CHEVRON IS NOT A CONTROL.
 * The design draws one, its annotation says nothing about behaviour (it carries the prose note
 * "show this chevrons annotaitons"), and NOTHING in this application listens for an event from the
 * head. A listener that dispatched into the void would be the dead control this repository files
 * findings about, so the companion leaves it a drawing until a consumer answers it.
 *
 * The values go into the design's own boxes through `boxes.ts`, which holds the rule for that: a box
 * is overwritten when the element was HANDED a value, and the design's sample text stands otherwise.
 *
 * WHICH BOX GETS WHICH VALUE IS THE APPLICATION'S STATEMENT, not something waiting on a designer: the
 * owner, 2026-09-30 — *"the designers aren't gonna add those… You need to add those at least for this
 * application."* Figma draws the head; the application says what it shows and where, here, in a file
 * the ingest cannot write. A box that is missing is reported (see `boxes.ts`) rather than silently
 * left drawing the sample words. And the four props are declared REACTIVE so the assembly can bind
 * them from its data model — the surface states WHAT (`{"path": "…"}`), this file states WHERE.
 */
import type { LitElement, PropertyDeclarations } from 'lit';
import { reapplyAfterRender, writeSpans, writeText } from './boxes';

const TAG = 'f-40001207-3559';

/** The design's names for the head's boxes — layer names, kept verbatim. */
const NAME_BOX_CLASS = 'catalog-name';
const DESCRIPTION_BOX_CLASS = 'functions-label';

/** What the tree that lists the catalogue hands this element. */
interface Head {
  name?: string;
  count?: string;
  catalogId?: string;
  description?: string;
}

const BOUND = new WeakMap<HTMLElement, () => void>();

export const tag = TAG;

export const properties: PropertyDeclarations = {
  /** The catalogue's title, where the design drew its own sample name. */
  name: { type: String },
  /** How many components it declares, on the line under the name. */
  count: { type: String },
  /** The catalogId it is published at — the third box. */
  catalogId: { type: String, attribute: 'catalog-id' },
  /** Kept because the element's own file declared it: the fallback for the third box. */
  description: { type: String },
};

export function attach(el: LitElement): void {
  const head = el as LitElement & Head;
  const unhook = reapplyAfterRender(el, () => {
    writeSpans(el, NAME_BOX_CLASS, [head.name, head.count]);
    // The third box shows the catalogId, and only when there IS one: the hand-edit this replaces
    // wrote `${this.catalogId || this.description}`, which drew the design's sample line whenever the
    // catalogue had no id — the same thing as leaving the box alone, said once.
    writeText(el, DESCRIPTION_BOX_CLASS, head.catalogId ? head.catalogId : head.description);
  });
  BOUND.set(el, unhook);
}

export function detach(el: LitElement): void {
  const unhook = BOUND.get(el);
  if (!unhook) return;
  unhook();
  BOUND.delete(el);
}
