/**
 * THE PROMPT TEXTAREA'S BEHAVIOUR — everything about `<prompt-textarea>` that is not a drawing.
 *
 * WHY THIS FILE EXISTS. `frontend/src/components/lit/prompt-input/prompt-textarea.ts` was hand
 * built: it declared `value`, `placeholder` and `minHeight`, kept a `<textarea>` in its own render,
 * measured the text on every change, and dispatched `value-input`. The Figma tool's approval
 * replaces a component's DRAWING from the measured design, and the measured design renders
 * `<div class="empty">Enter prompt text.</div>` — a placeholder line, not a typing box. If the
 * drawing replaced the hand-built file with nothing else, the composer's field would stop accepting
 * text. So the behaviour moved here first, into a file the ingest cannot write, and the drawing
 * calls it through the constant seam (`attachBehaviour(this, 'prompt-textarea')`).
 *
 * THE DRAWING OWNS THE BOX; THIS FILE OWNS THE INPUT. The design's own layer names are the
 * addresses: `text-input-area-container` is the well, and `empty` is the sample line the design
 * drew in it. The companion keeps the design's sample as the placeholder, hides the sample line,
 * and mounts a real `<textarea>` inside the same well. The host's fill, radius, shadows and padding
 * stay the drawing's; the text's height, the value, the placeholder and the event are this file's.
 *
 * THE HEIGHT IS THE TEXT'S, ALWAYS. `minHeight` is a floor and nothing else — never a cap, and
 * never the height. The design's 125px host measurement is a measurement, and measurement belongs
 * here, so the companion releases the fixed height and re-measures whenever the value changes
 * however it changed (a keystroke here, or the host pushing a whole prompt in) and whenever the
 * column it is in changes width. Unset is not empty: a box is overwritten when the element was
 * HANDED a value, and the design's own placeholder stands otherwise.
 *
 * WHAT IT MUST NEVER DO: import the element. The element imports this loader first, so a companion
 * that imported its own element back would close a cycle at module-evaluation time.
 */
import type { LitElement, PropertyDeclarations } from 'lit';
import { reapplyAfterRender } from './boxes';

const TAG = 'prompt-textarea';

/** The design's own names for the field's parts — layer names, kept verbatim. */
const WELL_CLASS = 'text-input-area-container';
const SAMPLE_CLASS = 'empty';

/** What the composer hands this element, and reads back off it. */
interface TypingBox {
  value?: string;
  placeholder?: string;
  minHeight?: number;
}

/** Where the listener, the observer and the after-render hook are kept, per instance. */
interface Bound {
  onInput: (event: Event) => void;
  observer: ResizeObserver | null;
  unhook: () => void;
}

const BOUND = new WeakMap<HTMLElement, Bound>();

export const tag = TAG;

export const properties: PropertyDeclarations = {
  /** The text in the box. */
  value: { type: String },
  /** The design's own line, shown while the box is empty. */
  placeholder: { type: String },
  /** The design's floor for this section (45 / 145 / 120), never a cap. */
  minHeight: { type: Number, attribute: 'min-height' },
};

/** The typing box this companion mounted, or null before the first render. */
function fieldOf(el: LitElement): HTMLTextAreaElement | null {
  return (
    (el.shadowRoot?.querySelector(`.${WELL_CLASS} textarea`) as HTMLTextAreaElement | null) ?? null
  );
}

/** The floor the section handed in, with the element's own default when it handed none. */
function floorOf(el: LitElement): number {
  const value = Number((el as LitElement & TypingBox).minHeight);
  return Number.isFinite(value) && value > 0 ? value : 45;
}

/**
 * Measure once the browser has laid the new text out.
 *
 * 'auto' first: a height set on the element is a floor for `scrollHeight`, so measuring without
 * clearing it can only ever grow the box, never shrink it.
 */
function measure(el: LitElement): void {
  const field = fieldOf(el);
  if (!field) return;
  (el as LitElement & { _measuredWidth?: number })._measuredWidth = el.clientWidth;
  field.style.height = 'auto';
  field.style.height = `${Math.max(floorOf(el), field.scrollHeight)}px`;
}

/** Mount the typing box inside the well the design drew, once, and keep it in step with the props. */
function mount(el: LitElement): void {
  const host = el as LitElement & TypingBox;
  // THE ELEMENT'S OWN DEFAULT. A companion attaches before the first render, so the default has to
  // exist here rather than in a constructor the drawing does not have.
  if (host.minHeight === undefined) host.minHeight = 45;

  const well = el.shadowRoot?.querySelector(`.${WELL_CLASS}`) as HTMLElement | null;
  if (!well) return;

  let field = fieldOf(el);
  if (!field) {
    const sample = well.querySelector(`.${SAMPLE_CLASS}`) as HTMLElement | null;
    field = document.createElement('textarea');
    field.setAttribute('part', 'textarea');
    field.style.cssText = [
      'display:block',
      'width:100%',
      'box-sizing:border-box',
      'border:none',
      'outline:none',
      'background:transparent',
      'resize:none',
      'overflow:hidden',
      'padding:0',
      'margin:0',
      "font-family:'Inter',system-ui,sans-serif",
      'font-weight:500',
      'font-size:16px',
      'line-height:25px',
      'color:#000000',
    ].join(';');
    // THE DESIGN'S SAMPLE IS THE PLACEHOLDER, and it stops being drawn as text: one field, one
    // line, not a placeholder drawn under a box that also says the same words.
    if (sample) {
      field.placeholder = (sample.textContent ?? '').trim();
      sample.style.display = 'none';
    }
    well.appendChild(field);
  }

  const value = host.value ?? '';
  if (field.value !== value) field.value = value;
  const placeholder = String(host.placeholder ?? '').trim();
  if (placeholder) field.placeholder = placeholder;

  // THE DESIGN'S FIXED HEIGHT IS A MEASUREMENT, AND MEASUREMENT BELONGS HERE. The drawing measured
  // 125px for the Figma frame; the composer's field grows with its text, so the host's height is
  // released and its floor is the section's own.
  el.style.height = 'auto';
  el.style.minHeight = `${floorOf(el) + 20}px`;
  measure(el);
}

/**
 * Attach the field's behaviour.
 *
 * THE LISTENER SITS ON THE SHADOW ROOT, NOT ON THE FIELD, because the drawing can re-render and
 * replace the field; a listener bound to a removed textarea would be a dead control. One listener
 * per instance, removed on detach.
 */
export function attach(el: LitElement): void {
  if (BOUND.has(el)) return;
  const host = el as LitElement & TypingBox;

  const onInput = (event: Event): void => {
    const field = event.target as HTMLTextAreaElement | null;
    if (!field || field.tagName !== 'TEXTAREA') return;
    // THE ELEMENT ABSORBS WHAT IT REPORTS. It dispatched `value-input` and left its own `value`
    // at whatever the payload last assigned, so the property and the DOM disagreed about the
    // text; a caller that then CLEARED the box changed nothing. The property follows the DOM here.
    if (host.value !== field.value) host.value = field.value;
    measure(el);
    el.dispatchEvent(
      new CustomEvent('value-input', {
        bubbles: true,
        composed: true,
        detail: { value: field.value },
      }),
    );
  };
  el.shadowRoot?.addEventListener('input', onInput);

  // The host's own width decides how the same text wraps; only a WIDTH change re-measures, because
  // a height change is this element's own resize landing back on the observer.
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      const marked = el as LitElement & { _measuredWidth?: number };
      if (el.clientWidth === marked._measuredWidth) return;
      measure(el);
    });
    observer.observe(el);
  }

  // The drawing can re-render on any prop change; the field is mounted and synced after every one.
  const unhook = reapplyAfterRender(el, mount);
  BOUND.set(el, { onInput, observer, unhook });
}

/** Release the listener, the observer and the after-render hook. */
export function detach(el: LitElement): void {
  const bound = BOUND.get(el);
  if (!bound) return;
  el.shadowRoot?.removeEventListener('input', bound.onInput);
  bound.observer?.disconnect();
  bound.unhook();
  BOUND.delete(el);
}
