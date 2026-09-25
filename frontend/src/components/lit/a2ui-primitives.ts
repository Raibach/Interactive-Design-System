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
import { LitElement, html, css, nothing } from 'lit';

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
    .caption { font-size: 13px; color: #6c757d; }
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
    .secondary { background: #F7F8F2; color: #1c2f4e; border-color: #cbd3d9; }
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

/**
 * THE CARD'S OWN SIZE, and the page is arithmetic on it. 262 × 251 is the card
 * (<agent-card-element>, Figma node 40001114:5813 "console-card-design-system"),
 * and 16 is the grid's gap.
 */
const CARD_W = 262;
const CARD_H = 251;
const CARD_GAP = 16;
/** The grid's own inset, from :host below — 40px across, 75px down (2026-09-18). */
const GRID_PAD_X = 40;
/**
 * HOW MANY ROWS THE CONSOLE MAY EVER SHOW.
 *
 * The owner's rule, 2026-09-18: "it only ever be two rows of cards on the console at any one
 * time… I would really love it if there was no vertical scroll, and that whenever it was
 * resized at particular breakpoints, whenever the card was getting ready to drop below two
 * rows, that it hid and added to the pagination queue."
 *
 * So the console does not grow — it PAGES. The page size is one card more than fits: columns
 * come from the grid's width, rows from its height, and a card that will not fit is not drawn,
 * it moves to the next page.
 */
const MAX_ROWS = 2;
/**
 * The top inset and the pager's height, both already drawn below in :host and .pager —
 * named here because the FIT TEST needs them: whether the pane can hold what this grid is
 * about to draw is arithmetic on the same numbers the stylesheet uses.
 *   55  — the top padding of :host ("padding: 55px 40px 0")
 *   47  — the pager's 43px button plus its own 4px top padding
 */
const GRID_PAD_TOP = 55;
const PAGER_H = 47;

class A2UIConsoleCardGrid extends LitElement {
  static properties = {
    items: { type: Array },
    /** The page being shown, 0-based. Local state — the host owns the LIST, not the page. */
    page: { state: true },
    /** How many columns and rows fit right now, measured from this element's own box. */
    _cols: { state: true },
    _rows: { state: true },
    /** Whether the pane can hold the rows this grid draws. False = no cards, and no scroller. */
    _fits: { state: true },
  };
  declare items: unknown[];
  declare page: number;
  declare private _cols: number;
  declare private _rows: number;
  declare private _fits: boolean;

  constructor() {
    super();
    this.items = [];
    this.page = 0;
    this._cols = 1;
    this._rows = 1;
    // TRUE until a measurement says otherwise: the first paint must never be an empty console.
    this._fits = true;
  }

  /**
   * The columns `auto-fill` will draw, and the rows the PANE can hold.
   *
   * THE HEIGHT COMES FROM THE PARENT, NEVER FROM THIS ELEMENT. Measuring itself is circular:
   * the grid's own height is decided by the rows it is already drawing, so one row measured
   * one row's worth of room and drew one row — for ever (measured 2026-09-18, the owner:
   * "no, that's one row"). The box that CONSTRAINS the grid is the pane it is scrolled
   * inside, and that is what its page size is measured against.
   */
  private _measure = (): void => {
    const rect = this.getBoundingClientRect();
    const inner = Math.max(0, rect.width - GRID_PAD_X * 2);
    // HOW MANY COLUMNS FIT — and zero is an answer. This used to be Math.max(1, …), which
    // drew one 276px column into a narrower box and pushed the grid wider than its pane.
    const colsThatFit = Math.floor((inner + CARD_GAP) / (CARD_W + CARD_GAP));
    const cols = Math.max(1, colsThatFit);

    // HOW MANY ROWS FIT — AND ONE ROW IS STILL THE CONSOLE.
    //
    // This has been three things. First the height capped the rows, and a short window collapsed
    // to one and centred it; he turned that off ("I don't think we need to remove the second row
    // when the browser resizes — you can just turn that feature off"). Then the rows were fixed
    // at two and the fit was all-or-nothing, so a short window got NO cards at all — a message
    // where the console should be. His words on seeing that, at 1280x720: "I love the console
    // and I get a message instead of" the cards.
    //
    // So the rows are as many as FIT, up to two, and the message is kept for the case that is
    // genuinely impossible: not even one row. The one rule that never bends is the scrollbar —
    // what is drawn must fit the pane.
    const pane = this.parentElement;
    const paneH = pane ? pane.clientHeight : 0;
    const measured = rect.width >= 2 && paneH >= 2;
    const pagerRoom = this._pageCount() > 1 ? PAGER_H : 0;
    const rowsThatFit = Math.max(
      0,
      Math.floor((paneH - GRID_PAD_TOP - pagerRoom) / (CARD_H + CARD_GAP)),
    );
    // NO BOX, NO LIMIT: with nothing measured (a host mid-layout, or jsdom) the full two rows
    // draw. A measurement is an optimisation here, never the difference between a console with
    // cards and one that looks broken.
    const rows = measured ? Math.min(MAX_ROWS, rowsThatFit) : MAX_ROWS;
    const fits = !measured || (colsThatFit >= 1 && rows >= 1);

    if (cols !== this._cols || rows !== this._rows || fits !== this._fits) {
      this._cols = cols;
      this._rows = rows;
      this._fits = fits;
      this.requestUpdate();
    }
  };

  private _observer: ResizeObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    // MEASURED, not guessed: the grid's own box decides the page, so a window resize can
    // empty a page and the cards it drops are simply on the next one.
    // GUARDED: a measurement is an optimisation, not a requirement. jsdom has no
    // ResizeObserver (the element's own tests run there), and an exception thrown from
    // connectedCallback would take the whole grid down with it — the cards would simply not
    // draw, which is a far worse failure than a page size that never adapts.
    if (typeof ResizeObserver === 'function') {
      this._observer = new ResizeObserver(() => this._measure());
      this._observer.observe(this);
      // THE PANE TOO. The fit test reads the pane's height, and the pane can shrink without
      // this element's own box changing at all — the grid is content-sized inside a box that
      // scrolls, so a shorter window moves the pane and not the grid. Observing the parent is
      // what turns that into a re-measure instead of a stale page.
      if (this.parentElement) this._observer.observe(this.parentElement);
    }
    this._measure();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._observer = null;
  }

  /** The page a change has left us on, kept inside the range the new size allows. */
  private _pageCount(): number {
    const size = Math.max(1, this._cols * this._rows);
    return Math.max(1, Math.ceil((Array.isArray(this.items) ? this.items.length : 0) / size));
  }

  private _go(delta: number): void {
    const next = Math.min(this._pageCount() - 1, Math.max(0, this.page + delta));
    if (next === this.page) return;
    this.page = next;
    this.dispatchEvent(new CustomEvent('card-page', {
      bubbles: true, composed: true, detail: { page: next },
    }));
  }

  static styles = css`
    :host {
      display: grid;
      /*
       * 75px of clearance on EVERY side — top, bottom, left, right — and nowhere
       * else. The card area is a panel inset in its column, not a band that
       * floats in the middle of it.
       *
       * It belongs HERE, on the grid, and not on the pane that holds it or on the
       * shell wrapper around the surface. The left pane is shared with the
       * composer's prompt-section-editor, so an inset there would push the editor
       * down too, and a wrapper inset moves the chat column with the cards — the
       * two columns would sit at different heights, which is what the shell's
       * wrapper was doing before it was removed. This element draws console cards
       * and nothing else, so an inset on it is an inset on the cards only.
       *
       * padding, not margin: the pane is the scroll container, and padding on the
       * scrolled content is part of the scrollable area, so the inset stays put
       * instead of collapsing out of the box.
       *
       * box-sizing: border-box is REQUIRED with it. Under content-box the 150px of
       * side padding would be added to a width: 100% host, and the grid would be
       * 150px wider than its column — a horizontal scrollbar on every console.
       *
       * No backticks in this comment: this is a Lit css template literal.
       */
      /* THE INSET, SIDE BY SIDE, AS THE OWNER NAMED IT (2026-09-18):
           left and right   75 → 45   "reduce it by 30 pixels on each side… it's too wide"
           top              75 → 55   "correction, let me reduce the top by 20 pixels"
           bottom           75 → 0    "remove the margin on the bottom completely, which
                                        would help prevent triggering a scroll" 
         The side inset is not taste: it is what decides how many 276px cards a window holds,
         and 75px on both sides was costing a column on exactly the widths where it mattered. */
      padding: 55px 40px 0;
      box-sizing: border-box;
      /* The card is a fixed 262 × 251 (<agent-card-element>, Figma node
         40001114:5813), so the track is fixed too: auto-fill over a 262px track
         drops a column as the viewport narrows. minmax(262px, 1fr) did the
         opposite — it opened another column for every 262 + 16px and stretched
         the tracks it had — and a stretched track cannot widen a fixed card, so
         the slack only reappeared inside the track. */
      grid-template-columns: repeat(auto-fill, 262px);
      /*
       * The rows are CENTRED in the column, and the cards are packed TIGHT: the
       * equal 16px gap is the only space between them.
       *
       * This was justify-content: space-between, which distributed the leftover
       * width INTO the gaps — so the space between two cards grew with the window
       * and the row read as an accordion opening. The leftover belongs outside the
       * group, not inside it.
       *
       * It was then justify-content: start, which pinned the group to the left
       * inset and dumped all of the leftover on the right. Centring splits it
       * evenly, so the two outside margins match each other, and with the 75px
       * padding they can never fall below the inset. A wider window gets MORE
       * columns from auto-fill — which is what fills the width, not wider gaps and
       * not a group that drifts left.
       */
      justify-content: center;
      width: 100%;
      gap: 16px;
      align-content: start;
    }

    /* THE PAGER. Unknown in Figma — there is no node for it, so nothing here claims one;
       the numbers are the master's secondary button (43px, radius 6, the drop shadow) and
       the type is the system floor. It spans the full width under the last row so the two
       card rows stay centred and the controls sit outside them. */
    .pager {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding-top: 4px;
    }
    .pager button {
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      /* THE HEADER'S PURPLE, LIGHT TEXT — the owner, 2026-09-19: "give them the same purple
         as the header and make the text light." Reversed from the white tile. */
      color: #b6afbd;
      /* The owner, 2026-09-19: the header's purple at 85% opaque — the same treatment the
         cards wear, so the pair reads as one family. */
      background: rgba(34, 23, 44, 0.85);
      height: 43px;
      padding: 0 18px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.25), -4px -4px 10px 0px rgba(0, 0, 0, 0.15);
    }
    .pager button:disabled { opacity: 0.4; cursor: default; }
    .pager .count { font-size: 13px; font-weight: 500; color: #b6afbd; }

    /* DRAWN INSTEAD OF THE CARDS when the pane cannot hold them (see _measure). It sits in
       the host's own inset, so it lines up with where the first card would have been, and it
       takes the pager's muted ink — it is a statement of fact, not an error. */
    .too-small {
      margin: 0;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.5;
      color: #6c757d;
      max-width: 420px;
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
    // NO ROOM, NO CARDS. See _measure: when the pane cannot hold two rows and their inset,
    // the console takes the cards away rather than growing the scrollbar the owner refuses.
    // The line says what this place shows and what it needs — the same kind of answer the
    // chat panel's empty views give, and the reason it is not a blank pane.
    if (!this._fits) {
      return html`<p class="too-small" role="status">
        Packages are shown two rows at a time. This window is too small for them — widen it,
        or make it taller, and they come back.
      </p>`;
    }
    // `items` arrives already resolved by the renderer's binding pass. Until that
    // pass exists it is still a {path} object, so this paints nothing — correct,
    // and visible rather than silently empty.
    const all = Array.isArray(this.items) ? this.items : [];
    const size = Math.max(1, this._cols * this._rows);
    const pages = this._pageCount();
    // A page that the current size has emptied is not a page: the index is clamped here so a
    // resize can never leave the console showing nothing.
    const page = Math.min(this.page, pages - 1);
    const cards = all.slice(page * size, page * size + size);
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
        function=${item?.function ?? 'Function like Repair'}
        description=${item?.description ?? ''}
        version=${item?.version || item?.message_count || 1}
        status=${item?.status || 'Active'}
        likes=${item?.likes ?? 0}
        category-color=${item?.category_color ?? ''}
        category-title-color=${item?.category_title_color ?? ''}
        category-text-color=${item?.category_text_color ?? ''}
        @click=${() => this._open(sessionId)}
      ></agent-card-element>`;
    })}<slot></slot>${pages > 1
      ? html`<nav class="pager" aria-label="Packages">
          <button type="button" ?disabled=${page === 0} @click=${() => this._go(-1)}>Previous</button>
          <span class="count" role="status">${page + 1} of ${pages}</span>
          <button type="button" ?disabled=${page >= pages - 1} @click=${() => this._go(1)}>Next</button>
        </nav>`
      : nothing}`;
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
      font-size: 13px;
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
      font-size: 13px;
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
      font-size: 13px;
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
