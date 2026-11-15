/**
 * THE SEAT'S OWN COPY OF THE SIX SPEC PRIMITIVES — the components every A2UI surface is built
 * from: `Text`, `Image`, `Row`, `Column`, `Card`, `Button`.
 *
 * They are the renderer's own, as they are in the living renderer: no application element will
 * ever appear for them and no Figma node will ever map to them, so waiting for one would draw
 * nothing for the components an assembly is mostly made of. Under the seat's own tags
 * (`design2-*`) because this folder owns its runtime elements; RULES.md is explicit that a
 * shared element is copied during the refactor, never shared, so a failure here is this seat's.
 *
 * The markup and the styles are the living primitives' own, copied so the pixels match the live
 * site — parity is the acceptance test, and a re-drawn primitive would be a design change.
 * Each one is passive: it draws what it is given, holds no state, fetches nothing, evaluates
 * nothing.
 */
import { LitElement, html, css, nothing } from 'lit';

// Flex values the spec's Row/Column accept. The spec also allows `stretch` for justify and the
// living elements fall back to `start` for it; that fallback is kept, not improved on.
const ALIGN: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
};
const JUSTIFY: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  between: 'space-between', around: 'space-around',
};

// ── Text ────────────────────────────────────────────────────────────────────

class Design2Text extends LitElement {
  static properties = {
    text: { type: String },
    variant: { type: String },
  };

  declare text: string;
  declare variant: string;

  constructor() {
    super();
    this.text = '';
    this.variant = '';
  }

  static styles = css`
    :host { display: block; }
    .t { font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #1c2f4e; margin: 0; }
    .greeting { font-size: 20px; font-weight: 700; }
    .h1 { font-size: 28px; font-weight: 700; }
    .h2 { font-size: 22px; font-weight: 700; }
    .h3 { font-size: 18px; font-weight: 600; }
    .caption { font-size: 13px; color: #6c757d; }
    .body { font-size: 14px; }
  `;

  render() {
    return html`<p class="t ${this.variant || 'body'}">${this.text}</p>`;
  }
}

// ── Image ───────────────────────────────────────────────────────────────────

class Design2Image extends LitElement {
  static properties = {
    url: { type: String },
    description: { type: String },
    fit: { type: String },
  };

  declare url: string;
  declare description: string;
  declare fit: string;

  constructor() {
    super();
    this.url = '';
    this.description = '';
    this.fit = 'cover';
  }

  static styles = css`
    :host { display: block; }
    img { display: block; width: 100%; height: 100%; }
  `;

  render() {
    // `description` is the spec's field for the accessible name. An empty one means the image is
    // decorative: it is hidden from assistive technology rather than announced unlabelled.
    return html`<img
      src=${this.url}
      alt=${this.description || ''}
      ?aria-hidden=${!this.description}
      style="object-fit:${this.fit}"
    />`;
  }
}

// ── Column ──────────────────────────────────────────────────────────────────

class Design2Column extends LitElement {
  static properties = { justify: { type: String }, align: { type: String } };
  declare justify: string;
  declare align: string;

  constructor() {
    super();
    this.justify = 'start';
    this.align = 'stretch';
  }

  static styles = css`
    :host { display: flex; flex-direction: column; gap: 12px; }
  `;

  render() {
    this.style.justifyContent = JUSTIFY[this.justify] ?? JUSTIFY.start;
    this.style.alignItems = ALIGN[this.align] ?? ALIGN.stretch;
    return html`<slot></slot>`;
  }
}

// ── Row ─────────────────────────────────────────────────────────────────────

class Design2Row extends LitElement {
  static properties = { justify: { type: String }, align: { type: String } };
  declare justify: string;
  declare align: string;

  constructor() {
    super();
    this.justify = 'start';
    this.align = 'center';
  }

  static styles = css`
    :host { display: flex; flex-direction: row; gap: 12px; }
  `;

  render() {
    this.style.justifyContent = JUSTIFY[this.justify] ?? JUSTIFY.start;
    this.style.alignItems = ALIGN[this.align] ?? ALIGN.center;
    return html`<slot></slot>`;
  }
}

// ── Card ────────────────────────────────────────────────────────────────────

class Design2Card extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: #fdfefd;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

// ── Button ──────────────────────────────────────────────────────────────────

class Design2Button extends LitElement {
  static properties = {
    child: { type: String },
    variant: { type: String },
    action: { type: Object },
  };

  declare child: string;
  declare variant: string;
  declare action: unknown;

  constructor() {
    super();
    this.child = '';
    this.variant = 'primary';
    this.action = null;
  }

  static styles = css`
    :host { display: inline-block; }
    button {
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
    }
    .primary { background: #507274; color: #fff; }
    .secondary { background: #F7F8F2; color: #1c2f4e; border-color: #cbd3d9; }
  `;

  private _onClick(): void {
    // The action stays declarative: the component reports it and the surface decides what it
    // means. Nothing is evaluated here — no eval, no handler looked up from a string.
    this.dispatchEvent(
      new CustomEvent('a2ui-action', {
        bubbles: true,
        composed: true,
        detail: { action: this.action, child: this.child },
      }),
    );
  }

  private _onClickBound = () => this._onClick();

  render() {
    return html`<button class=${this.variant} @click=${this._onClickBound}>
      <slot>${this.child}</slot>
    </button>`;
  }
}

const PRIMITIVES: Array<[string, CustomElementConstructor]> = [
  ['design2-text', Design2Text],
  ['design2-image', Design2Image],
  ['design2-column', Design2Column],
  ['design2-row', Design2Row],
  ['design2-card', Design2Card],
  ['design2-button', Design2Button],
];

for (const [tag, element] of PRIMITIVES) {
  if (!customElements.get(tag)) customElements.define(tag, element);
}

declare global {
  interface HTMLElementTagNameMap {
    'design2-text': Design2Text;
    'design2-image': Design2Image;
    'design2-column': Design2Column;
    'design2-row': Design2Row;
    'design2-card': Design2Card;
    'design2-button': Design2Button;
  }
}
