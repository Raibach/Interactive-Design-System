/**
 * WRITING A VALUE INTO A BOX THE DESIGN DREW — the one rule, in one place.
 *
 * WHO OWNS A BINDING, DECIDED 2026-09-30 by the owner, and it is the application: *"the designers
 * aren't gonna add those… You need to add those at least for this application."* A text layer is a
 * box with the designer's sample words in it, and WHICH VALUE GOES IN WHICH BOX is stated here, in a
 * hand-written companion the ingest cannot write — so a re-ingest re-measures the drawing and the
 * bindings are untouched. The design's own grammar can state the same thing (`Data: <field>` makes
 * the generator emit a prop and render it where the sample words were, and that reading is built and
 * tested), and a component whose design carries one gets its binding that way; nothing in this
 * application WAITS for a designer to annotate, because a binding the app needs must not depend on
 * Figma being edited.
 *
 * UNSET IS NOT EMPTY, the rule this repository runs on. A box is overwritten when the element has
 * been HANDED a value — including an empty string, which is the consumer saying "there is nothing on
 * this line" — and otherwise the design's own sample text stands. An unbound drawing is not an empty
 * one, and a value nobody set must not be invented as blank.
 *
 * THE BOXES ARE ADDRESSED BY LAYER NAME. `_class_name` in backend/design_renderer.py derives every
 * class in a generated element from the layer's own name, and this repository's contract rules make
 * layer names the STABLE identifiers — paint and geometry edits change nothing upstream. WHAT THAT
 * COSTS, stated rather than implied: a layer RENAMED or REMOVED in Figma leaves a binding pointing
 * at a box that is gone. That case is not silent — the design's own words stand in the box, and one
 * line goes to the console naming the tag and the box — because a binding that could not be placed
 * is a fact about the component, and the alternative is a row that quietly draws the wrong thing.
 *
 * IT MUST NEVER BE A COMPANION. The loader globs `./*.behaviour.ts`; this file does not match, so it
 * is a helper module and no tag is ever registered against it.
 */
import type { LitElement } from 'lit';

/**
 * Run `work` after this element's first render and after every later one, and return the unbinding.
 *
 * THIS IS DONE BY TAKING THE INSTANCE'S `updated`, which is the only hook a file outside the class
 * can reach: a companion runs from `connectedCallback`, before the first render, so reading the
 * element's boxes there would find nothing — and a prop assigned later changes nothing in the DOM
 * unless something re-runs after the render it triggered. Lit calls `this.updated(…)`, so an own
 * property on the instance shadows the (empty) prototype method; the instance's own is restored
 * when the companion detaches, so nothing this module did outlives the attachment.
 */
export function reapplyAfterRender(el: LitElement, work: (el: LitElement) => void): () => void {
  const hooked = el as LitElement & { updated?: (changed: unknown) => void };
  const previous = hooked.updated;
  hooked.updated = () => {
    previous?.call(el, undefined);
    work(el);
  };
  // A reconnect attaches to an element that has already rendered; `updated` covers everything after.
  void el.updateComplete.then(() => work(el));
  return () => {
    if (previous) hooked.updated = previous;
    else delete hooked.updated;
  };
}

/** One text box: the value when it was handed over, the design's own words when it was not. */
export function writeText(el: HTMLElement, className: string, value: string | undefined | null): void {
  if (value === undefined || value === null) return;
  const box = boxOf(el, className);
  if (!box) return unplaced(el, className, 'the box itself is gone');
  // THE CLIP WRAPPER IS PART OF THE DESIGN'S DRAWING AND MUST SURVIVE THE WRITE. A text layer the
  // design truncates carries an inner `<span class="<box>-lines">` holding the lines that wholly
  // fit (`design_renderer._truncation_frame`); writing into the BOX replaces that wrapper and the
  // clip goes with it, so a long value then draws unclipped inside a box too short for it.
  (linesOf(box) ?? box).textContent = value;
}

/**
 * A box the design draws as several lines: the first span is the first value, the second the
 * second — which is the shape a two-line text layer has in the generated markup.
 */
export function writeSpans(
  el: HTMLElement,
  className: string,
  values: Array<string | undefined | null>,
): void {
  const box = boxOf(el, className);
  if (!box) {
    if (values.some((v) => v !== undefined && v !== null)) unplaced(el, className, 'the box itself is gone');
    return;
  }
  /*
   * THE RUN SPANS, NOT THE WRAPPER. `querySelectorAll('span')` returns the clip wrapper FIRST when
   * there is one, so the first value was written over the wrapper — destroying the design's own
   * run spans, and with them the second line's styling and the clip — and the second value then
   * went into a span that had already been wiped. Measured 2026-09-30 in the room: two rows'
   * descriptions drawn on top of each other in one box, and a row whose name had lost its code
   * line. Searching INSIDE the wrapper skips it, because `querySelectorAll` never returns the
   * element it is called on.
   */
  const spans = Array.from((linesOf(box) ?? box).querySelectorAll('span')) as HTMLElement[];
  values.forEach((value, index) => {
    if (value === undefined || value === null) return;
    if (!spans[index]) return unplaced(el, className, `the box draws no line ${index + 1}`);
    spans[index].textContent = value;
  });
}

/**
 * The clip wrapper inside a box the design truncates, or null when the design does not.
 *
 * LOOKED UP BY SUFFIX AND ONLY ONE LEVEL DOWN, because the wrapper is the box's own child and the
 * run spans are inside it. A deeper search would find a run span whose class happens to end in
 * `-lines` and hand back the wrong element — and the failure would look like a clip that stopped
 * working, which is the thing this lookup exists to prevent.
 */
function linesOf(box: HTMLElement): HTMLElement | null {
  return box.querySelector(':scope > [class$="-lines"]') as HTMLElement | null;
}

/**
 * Put a slot inside a box the design drew, once.
 *
 * A SLOT IS NOT SOMETHING THIS REPOSITORY'S GRAMMAR LETS A DESIGN STATE (the fields are Data / On
 * click / State / A11y), so a companion owns it and the consumer fills it. The guard is here because
 * a slot that has to exist is not a slot to add twice.
 */
export function ensureSlot(el: HTMLElement, className: string, slotName: string): void {
  const box = boxOf(el, className);
  if (!box) return unplaced(el, className, `the well for the "${slotName}" slot is gone`);
  if (box.querySelector(`slot[name="${slotName}"]`)) return;
  const slot = document.createElement('slot');
  slot.name = slotName;
  box.appendChild(slot);
}

/** The design's box, by the CLASS NAME its layer name produced — never a bare tag selector. */
function boxOf(el: HTMLElement, className: string): HTMLElement | null {
  return (el.shadowRoot?.querySelector('.' + className) as HTMLElement | null) ?? null;
}

/**
 * A VALUE WAS HANDED AND THERE IS NOWHERE TO PUT IT — said out loud, once per occurrence.
 *
 * A binding names one of the design's own layers, so a layer renamed or removed in Figma leaves it
 * pointing at a box that is gone. Left silent, that is a component drawing the design's sample words
 * while every declaration still says the value arrives — which is the class of fault this whole
 * mechanism exists to stop. A companion cannot draw a warning into a design it did not measure and
 * must not fake the box, so the report is this line: the tag, the box, and what to do about it.
 */
function unplaced(el: HTMLElement, className: string, why: string): void {
  console.warn(
    `[behaviour] <${el.tagName.toLowerCase()}>: a value was handed to .${className} and it was NOT ` +
      `placed — ${why}. Its companion names one of the design's own layers; if the design renamed or ` +
      `removed it, the companion's mapping must change with it.`,
  );
}
