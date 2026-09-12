/**
 * A2UI protocol primitives — the six components the SPEC defines.
 *
 * These are not ours. `Text`, `Image`, `Row`, `Column`, `Card` and `Button` come
 * from A2UI v0.9.1, so no application element will ever appear for them and no
 * Figma node will ever map to them. If the renderer waited for one, it would
 * render nothing for the components every prompt is actually built from.
 *
 * So the renderer owns them, under an `a2ui-` prefix so the tags cannot collide
 * with a design-system element or a future native tag. `a2ui-text` is
 * deliberately NOT `text`.
 *
 * Each primitive is a passive container: it draws what it is given and slots its
 * children. It holds no state, fetches nothing, and evaluates nothing.
 *
 * Framework: Lit 3.x — no decorators, static properties + customElements.define()
 * (the convention in this folder).
 */
import { LitElement, html, css } from 'lit';

// ── shared ──────────────────────────────────────────────────────────────────

/** Flex alignment values the spec's Row/Column accept. */
const ALIGN: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
};
const JUSTIFY: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  between: 'space-between', around: 'space-around',
};

// ── Text ────────────────────────────────────────────────────────────────────

class A2UIText extends LitElement {
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
    .t { font-family: 'Inter', system-ui, sans-serif; color: #1c2f4e; margin: 0; }
    .greeting { font-size: 20px; font-weight: 700; }
    .h1 { font-size: 28px; font-weight: 700; }
    .h2 { font-size: 22px; font-weight: 700; }
    .h3 { font-size: 18px; font-weight: 600; }
    .caption { font-size: 12px; color: #6c757d; }
    .body { font-size: 14px; }
  `;

  render() {
    return html`<p class="t ${this.variant || 'body'}">${this.text}</p>`;
  }
}

// ── Image ───────────────────────────────────────────────────────────────────

class A2UIImage extends LitElement {
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
    // `description` is the spec's field for the accessible name. An empty one
    // means decorative: hide it from assistive tech rather than announcing an
    // unlabelled image.
    return html`<img
      src=${this.url}
      alt=${this.description || ''}
      ?aria-hidden=${!this.description}
      style="object-fit:${this.fit}"
    />`;
  }
}

// ── Row / Column ────────────────────────────────────────────────────────────

class A2UIColumn extends LitElement {
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

class A2UIRow extends LitElement {
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

class A2UICard extends LitElement {
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

class A2UIButton extends LitElement {
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
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
    }
    .primary { background: #507274; color: #fff; }
    .secondary { background: #fff; color: #1c2f4e; border-color: #cbd3d9; }
  `;

  private _onClick() {
    // The action stays declarative: the component reports it and the shell
    // decides what it means. Nothing is evaluated here — no eval, no handler
    // looked up from a string. That is the A2UI guarantee, kept at the leaf.
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

// ── structural composites (renderer-owned) ──────────────────────────────────
//
// These have no element and no Figma node, and they do not need one: none of
// them carries a visual identity. A grid is `display: grid`. A row is
// `flex-direction: row`. Their appearance comes entirely from their CHILDREN,
// which are real design-system components with their own provenance.
//
// That is the line the provenance check draws: it flags invented *visuals*
// (radius, colour, spacing with no Figma source), not structural composition.
// So adding these does not grow `provenance-missing` — nothing here invents a
// look. If one of these ever gains a border or a background, it has crossed
// into design and belongs in Figma.

class A2UIConsoleCardGrid extends LitElement {
  static properties = { items: { type: Array } };
  declare items: unknown[];

  constructor() {
    super();
    this.items = [];
  }

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(276px, 1fr));
      gap: 16px;
      align-content: start;
    }
  `;

  /**
   * The card's DECLARED open event — the wrapper's `card-open` handler that
   * <agent-card-element> stops its delete click from reaching (see that file's
   * `_onDeleteClick`).
   *
   * `agent-card` declares three events and this grid is the component that
   * receives them: frontend/src/shared/tag-registry.ts → AgentCardSchema.events =
   * ['card-open', 'card-delete', 'card-archive']. Only `card-delete` was ever
   * emitted by anyone, and nothing anywhere listened for `card-open` — the
   * declared wire was connected at neither end.
   *
   * Dispatched, not handled here. Opening a package re-assembles a surface through
   * the AI (`render-session:{id}`), and a card grid has no business running an
   * assembly. The host owns that; this only says which package was chosen.
   */
  private _open(sessionId: string) {
    if (!sessionId) return; // a card with no session id has nothing to open
    this.dispatchEvent(
      new CustomEvent('card-open', {
        detail: { sessionId, id: sessionId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    // `items` arrives already resolved by the renderer's binding pass. Until that
    // pass exists it is still a {path} object, so this paints nothing — correct,
    // and visible rather than silently empty.
    const cards = Array.isArray(this.items) ? this.items : [];
    // The same prop set the hand-rendered console grid used to pass to
    // <agent-card-element> before the console became the AI's own surface. That grid
    // is gone and this is the only console now, so /cards is the single list of
    // packages any part of the app reads. The card is a designed component with its
    // own provenance; this grid only forwards the model's fields, so nothing here
    // invents a look.
    //
    // `id` is set deliberately: <agent-card-element> dispatches `card-delete` with
    // `this.id`, so a card rendered without one deletes nothing.
    return html`${cards.map((item: any) => {
      const sessionId = item?.id ?? '';
      return html`<agent-card-element
        id=${sessionId}
        data-a2ui-id=${sessionId}
        title=${item?.title ?? ''}
        category=${item?.category ?? ''}
        description=${item?.description ?? ''}
        username=${item?.username ?? item?.author ?? ''}
        team-name=${item?.team_name ?? item?.teamName ?? ''}
        version=${item?.version || item?.message_count || 1}
        status=${item?.status || 'Active'}
        likes=${item?.likes ?? 0}
        model-name=${item?.model_name ?? item?.modelName ?? ''}
        avatar-url=${item?.avatar_url ?? ''}
        category-color=${item?.category_color ?? ''}
        category-title-color=${item?.category_title_color ?? ''}
        category-text-color=${item?.category_text_color ?? ''}
        last-used=${item?.lastUsed ?? ''}
        created-at=${item?.createdAt ?? ''}
        @click=${() => this._open(sessionId)}
      ></agent-card-element>`;
    })}<slot></slot>`;
  }
}

class A2UIActionGroup extends LitElement {
  static properties = { items: { type: Array } };
  declare items: unknown[];

  constructor() {
    super();
    this.items = [];
  }

  static styles = css`
    :host { display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap; }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

class A2UIDecisionDialog extends LitElement {
  static styles = css`
    :host { display: block; }
    .shell {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
    }
  `;

  render() {
    // Deliberately unstyled beyond layout: the dialog's surface treatment is a
    // design decision with no Figma source yet, so it is not invented here.
    return html`<div class="shell"><slot></slot></div>`;
  }
}

class A2UIFooterBar extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: sticky;
      bottom: 0;
      padding-top: 8px;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

class A2UIStatusReadout extends LitElement {
  static properties = {
    label: { type: String },
    text: { type: String },
    state: { type: String },
  };

  declare label: string;
  declare text: string;
  declare state: string;

  constructor() {
    super();
    this.label = '';
    this.text = '';
    this.state = '';
  }

  static styles = css`
    :host {
      display: inline-block;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      color: #6c757d;
    }
  `;

  render() {
    // No colour is asserted for a state here: which colour `error` should be is a
    // design decision, not a structural one.
    return html`<span>${this.label ? `${this.label}: ` : ''}${this.text}</span>`;
  }
}

class A2UITokenCostReadout extends LitElement {
  static properties = {
    tokens: { type: Number },
    calls: { type: Number },
    label: { type: String },
  };

  declare tokens: number;
  declare calls: number;
  declare label: string;

  constructor() {
    super();
    this.tokens = 0;
    this.calls = 0;
    this.label = '';
  }

  static styles = css`
    :host {
      display: inline-block;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      color: #6c757d;
      font-variant-numeric: tabular-nums;
    }
  `;

  render() {
    // Measured or absent. No cost is shown because the provider's usage report
    // carries no price — an invented figure above a real one is worse than none.
    const measured = this.calls > 0;
    return html`<span>${this.label ? `${this.label}: ` : ''}${
      measured
        ? `${this.tokens.toLocaleString()} tokens · ${this.calls} ${this.calls === 1 ? 'call' : 'calls'}`
        : '—'
    }</span>`;
  }
}

class A2UIAddSectionButton extends LitElement {
  static properties = { label: { type: String } };
  declare label: string;

  constructor() {
    super();
    this.label = 'Add Section';
  }

  static styles = css`
    :host { display: inline-block; }
    button {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      background: none;
      border: 1px dashed #cbd3d9;
      border-radius: 6px;
      padding: 4px 10px;
      cursor: pointer;
      color: #507274;
    }
  `;

  private _onClick = () => {
    this.dispatchEvent(
      new CustomEvent('a2ui-action', {
        bubbles: true,
        composed: true,
        detail: { action: { name: 'add-section' }, child: this.label },
      }),
    );
  };

  render() {
    return html`<button @click=${this._onClick}>+ ${this.label}</button>`;
  }
}

// ── registration ────────────────────────────────────────────────────────────

/**
 * Renderer-owned STRUCTURAL composites, catalog name → tag.
 *
 * Kept separate from the spec primitives because they are a different kind of
 * thing: `Text` is A2UI's, these are ours. Both are resolved before the
 * allowlist, because neither has a design-system element to fall back to.
 */
export const A2UI_STRUCTURAL: Record<string, string> = {
  ConsoleCardGrid: 'a2ui-console-card-grid',
  ActionGroup: 'a2ui-action-group',
  DecisionDialog: 'a2ui-decision-dialog',
  'footer-bar': 'a2ui-footer-bar',
  'status-readout': 'a2ui-status-readout',
  'token-cost-readout': 'a2ui-token-cost-readout',
  'add-section-button': 'a2ui-add-section-button',
};

/**
 * The six spec components, name → tag. Exported as the renderer's first lookup
 * table so the primitive set is declared in exactly one place.
 */
export const A2UI_PRIMITIVES: Record<string, string> = {
  Text: 'a2ui-text',
  Image: 'a2ui-image',
  Row: 'a2ui-row',
  Column: 'a2ui-column',
  Card: 'a2ui-card',
  Button: 'a2ui-button',
};

const DEFINE: Array<[string, CustomElementConstructor]> = [
  ['a2ui-text', A2UIText],
  ['a2ui-image', A2UIImage],
  ['a2ui-column', A2UIColumn],
  ['a2ui-row', A2UIRow],
  ['a2ui-card', A2UICard],
  ['a2ui-button', A2UIButton],
  // structural composites — renderer-owned, no Figma node
  ['a2ui-console-card-grid', A2UIConsoleCardGrid],
  ['a2ui-action-group', A2UIActionGroup],
  ['a2ui-decision-dialog', A2UIDecisionDialog],
  ['a2ui-footer-bar', A2UIFooterBar],
  ['a2ui-status-readout', A2UIStatusReadout],
  ['a2ui-token-cost-readout', A2UITokenCostReadout],
  ['a2ui-add-section-button', A2UIAddSectionButton],
];

for (const [tag, ctor] of DEFINE) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
