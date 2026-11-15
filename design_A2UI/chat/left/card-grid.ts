/**
 * <design2-console-card-grid> — THE ROOM'S COPY OF THE CONSOLE'S CARD GRID.
 *
 * The console's packages, two rows at a time, paged exactly as the living grid pages them — the
 * arithmetic, the fit test, the refusal above zero rows and the pager are its own, copied so the
 * surface draws what the live site draws. Copied rather than shared (RULES.md); the card it draws
 * is the room's own <design2-agent-card>.
 */
import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
// The card the grid draws — its own copy, registered with the grid that needs it.
import './agent-card';
import consoleMark from '@/components/lit/assets/chat-logo-watsonx.svg';
import governanceMark from '@/components/lit/assets/chat-logo-watsonx-governance.svg';
import composerMark from '@/components/lit/assets/chat-logo-watsonx-orchestrate.svg';
import developmentMark from '@/components/lit/assets/chat-logo-watsonx-engineering-insights.svg';
import designMark from '@/components/lit/assets/chat-logo-carbon.svg';
import productMark from '@/components/lit/assets/chat-logo-watsonx-code-assistant.svg';

const MARK_BY_SEAT: Record<string, string> = {
  console: consoleMark,
  governance: governanceMark,
  composer: composerMark,
  development: developmentMark,
  design: designMark,
  product: productMark,
};


/**
 * THE CARD'S OWN SIZE, and the page is arithmetic on it. 262 × 251 is the card
 * (<design2-agent-card>, Figma node 40001114:5813 "console-card-design-system"),
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

class DesignConsoleCardGrid extends LitElement {
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
    const items = Array.isArray(this.items) ? this.items : [];
    return Math.max(1, Math.ceil(items.length / size));
  }

  private _go(delta: number): void {
    const next = Math.min(this._pageCount() - 1, Math.max(0, this.page + delta));
    if (next === this.page) return;
    this.page = next;
    this.dispatchEvent(new CustomEvent('card-page', {
      bubbles: true, composed: true, detail: { page: next },
    }));
  }

  /** A NEW CARD SET IS A NEW LIST: a tab's assembly opens at its first page, not the old page. */
  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('items')) this.page = 0;
  }

  /** The host drops its grid layout for the empty state, so the message can be centred. */
  protected updated(): void {
    const empty = this._fits && Array.isArray(this.items) && this.items.length === 0;
    this.classList.toggle('empty-state', empty);
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
      /* The card is a fixed 262 × 251 (<design2-agent-card>, Figma node
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
    /* THE HOST FILLS THE PANE WHEN A TAB HAS NO CARDS, so the message below stands in the
       pane's centre — where the cards would have been — instead of the top-left corner. */
    :host(.empty-state) {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 0;
    }
    /* A FILTERED TAB WITH NOTHING IN IT IS SAID, NOT LEFT BLANK. Cards are the console's only
       content today; a tab whose record has none says so in the same muted line as the
       too-small answer, so "nothing is here" and "it did not arrive" never look alike.
       The ink is the console's dark plum, not the muted gray, and the line stands centred in
       the pane, so the answer is seen the moment the tab loads. */
    .empty {
      margin: 0;
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.5;
      color: #241a33;
      text-align: center;
      max-width: 420px;
    }
  `;

  /**
   * The card's DECLARED open event — the wrapper's `card-open` handler that
   * <design2-agent-card> stops its delete click from reaching (see that file's
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
    if (!all.length) {
      return html`<p class="empty" role="status">No cards for this tab.</p>`;
    }
    const size = Math.max(1, this._cols * this._rows);
    const pages = this._pageCount();
    // A page that the current size has emptied is not a page: the index is clamped here so a
    // resize can never leave the console showing nothing.
    const page = Math.min(this.page, pages - 1);
    const cards = all.slice(page * size, page * size + size);
    // The same prop set the hand-rendered console grid used to pass to
    // <design2-agent-card> before the console became the AI's own surface. That grid
    // is gone and this is the only console now, so /cards is the single list of
    // packages any part of the app reads. The card is a designed component with its
    // own provenance; this grid only forwards the model's fields, so nothing here
    // invents a look.
    //
    // `id` is set deliberately: <design2-agent-card> dispatches `card-delete` with
    // `this.id`, so a card rendered without one deletes nothing.
    return html`${repeat(cards, (item: any) => String(item?.id ?? ''), (item: any) => {
      const sessionId = item?.id ?? '';
      /* NO CARD WEARS PLACEHOLDER COPY. The line above the category is the card's own name:
         the product room's category, Design Tools for a design card, the composer's own name
         otherwise — never a literal that belongs to no record. */
      const headerLabel =
        item?.headerLabel
          || (item?.room_domain === 'product' ? (item?.category ?? '') : '')
          || item?.category
          || (item?.seat === 'composer' ? 'Composer' : item?.seat === 'console' ? 'Console' : '');
      const sublabel = item?.subcategory ?? '';
      return html`<design2-agent-card
        id=${sessionId}
        data-a2ui-id=${sessionId}
        title=${item?.title ?? ''}
        category=${item?.category ?? ''}
        mark-src=${MARK_BY_SEAT[item?.seat ?? ''] ?? ''}
        header-label=${headerLabel}
        sublabel=${sublabel}
        function=${item?.function ?? 'Function like Repair'}
        description=${item?.description ?? ''}
        version=${item?.version || item?.message_count || 1}
        status=${item?.status || 'Active'}
        status-color=${item?.status_color ?? ''}
        likes=${item?.likes ?? 0}
        category-color=${item?.category_color ?? ''}
        category-title-color=${item?.category_title_color ?? ''}
        category-text-color=${item?.category_text_color ?? ''}
        @click=${() => this._open(sessionId)}
      ></design2-agent-card>`;
    })}<slot></slot>${pages > 1
      ? html`<nav class="pager" aria-label="Packages">
          <button type="button" ?disabled=${page === 0} @click=${() => this._go(-1)}>Previous</button>
          <span class="count" role="status">${page + 1} of ${pages}</span>
          <button type="button" ?disabled=${page >= pages - 1} @click=${() => this._go(1)}>Next</button>
        </nav>`
      : nothing}`;
  }
}


if (!customElements.get('design2-console-card-grid')) {
  customElements.define('design2-console-card-grid', DesignConsoleCardGrid);
}

declare global {
  interface HTMLElementTagNameMap {
    'design2-console-card-grid': DesignConsoleCardGrid;
  }
}
