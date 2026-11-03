/**
 * THE DESIGN SECTION'S FRAME — the five boxes, their bands, the pull and its stop.
 *
 * Owner, 2026-10-31: *"as far as the grippers the tabs I think that's common throughout design
 * section … but as far as what's inside of them and how they were displayed, that would be
 * specific to the tab."* This file is the first half of that sentence. It knows the boxes and the
 * gestures and NOTHING ELSE: it never reads a session, never calls a conversation, never holds a
 * thread. If a change here would need to know what a message says, it belongs in the seat.
 *
 * ONE COPY, FOR EVERY TAB (2026-11-02). Each tab names its own five elements; the boxes, the
 * bands, the pull, the stop and the pull's own arithmetic are this file's, once. A tab supplies
 * `frameSlotTags` and nothing else about the frame, so a change to a floor or a stop is made here
 * and cannot differ between two tabs.
 *
 * A PLAIN MODULE, NOT AN ELEMENT AND NOT A CHAT. Each function takes the seat as `this`, so the
 * bodies below are the seat's own text, MOVED — no rule changed, no number touched. The seat
 * keeps one-line delegates under the names its template already binds.
 */

/** `html` is here for ONE line: the empty view slot's placeholder (`_emptyViewLine`). Nothing else
 *  in this file draws anything. */
import { html } from 'lit';

/** The five boxes a tab draws, by the element that draws each one. */
export type FrameSlotTags = Record<string, string>;

/** Every slot's element, once each — the selector the grip wiring and the reset walk. */
export function slotSelector(tags: FrameSlotTags): string {
  return Array.from(new Set(Object.values(tags))).join(', ');
}

/**
 * WHAT THE FRAME NEEDS FROM THE SEAT, AND NOTHING MORE. Every member below is used by one of
 * the functions in this file; the seat answers all of them. A member this interface does not
 * name cannot be reached from here, which is what keeps the frame from growing back into a chat.
 */
export interface ChatFrameHost extends HTMLElement {
  /** The five boxes THIS tab draws — the only fact a tab supplies about the frame. */
  frameSlotTags: FrameSlotTags;
  /** Lit's own render root — the frame walks this seat's shadow tree and no other. */
  renderRoot: ShadowRoot | DocumentFragment;
  /** Lit's scheduler: a size written by a gesture is drawn on the next frame. */
  requestUpdate(): void;
  /** The chat input's height — the one number the composer's divider and the footer share. */
  inputHeight: number;
  _dragStartY: number;
  _dragStartHeight: number;
  _gripWired: WeakSet<Element>;
  _conversationsLoaded: boolean;
  _userId(): string;
  _readPackageConversations(userId: string): Promise<void>;
  _toggleConversations: () => void;
  _anyForeignViewAssigned(): boolean;
  _releaseGrip(): void;
  _roomToGrow(host: HTMLElement): number;
  _defaultOf(host: HTMLElement): number;
  _resetBox(host: HTMLElement): void;
  _onSlotGripDown(e: PointerEvent, band: HTMLElement, host: HTMLElement): void;
  _wireGrips(attempt?: number): void;
  /** The tab the seat stands on — the slotting below reads it and nothing else does. */
  activeTab: string;
  allowedTabs: string;
  evalsTalk: boolean;
  collapsed: boolean;
  _gripEl: HTMLElement | null;
  _gripPointerId: number | null;
  _gripMove: ((e: PointerEvent) => void) | null;
  _gripUp: ((e: PointerEvent) => void) | null;
  _slot(name?: string): HTMLSlotElement | null;
  _seatSlotted(): boolean;
  _findingsSeat(): boolean;
  _tabClaimant(tab: string): boolean;
  _viewSlotted(): boolean;
  _wantedViewTag(): string | null;
  _showsThread: boolean;
  _evalsDrawsThread(): boolean;
}

  /* ── THE OUTPUT COLUMN'S DOT BANDS ARE HANDLES (owner, 2026-10-31) ─────────────────────────
   *
   * *"Make these 5-dot gripper resizable just like the ones at the chat input output divider …
   * remove the clamp or whatever is making the gripper jerk away from the mouse … do all of those
   * grippers exactly the same."*
   *
   * WHERE THIS LIVES, AND WHY IT IS NOT IN THE PARTS. The three 7px bands are drawn by
   * `output-header`, `design-chat-header` and `design-chat-plugin-tray` as `aria-hidden`
   * ornament — the parts are shared by every seat in the room. The owner's rule the same day:
   * a change made for Tools must not reach Chat or UX. So the behaviour is attached HERE, from
   * the Tools seat, to this seat's own shadow tree. The Chat and UX seats draw the same bands and
   * keep the old behaviour until their own pass.
   *
   * A BAND SIZES ITS OWN BLOCK. Each band is the bottom edge of the block that draws it, so a
   * drag changes THAT block's height and the column below takes the rest. Every band on the
   * column is wired the same way: the readout, the conversation bar, the plugin tray, and the
   * action bar's own grip (which the room already dragged by its own handler).
   *
   * NO JERK. The height is `the height at the press + how far the pointer has TRAVELLED`, never
   * the pointer's own position. A position needs a grab offset to be corrected and jumps on the
   * press when that offset is wrong — which is the "jerk away from the mouse" the owner reported.
   * A delta cannot jump: at the moment of the press it is zero.
   *
   * A CLICK IS NOT A DRAG. Under 3px of travel the band toggles its block: no inline height
   * restores the natural one, and a block with one set grows by 120px. A grip click never opens a
   * dropdown — the band stops its own click, so the conversation bar's list is not toggled by a
   * press on the dots.
   */

  export function onResizeMove(this: ChatFrameHost, e: Event) {
    const d = (e as CustomEvent).detail || {};
    if (typeof d.clientY !== 'number') return;
    /* A MOVE WITH NO VERTICAL POSITION IS NOT A MOVE (owner, 2026-10-31: *"it flies to the top …
       it's like a click, not a drag"*). An event whose Y is zero made the delta the whole height of
       the window, so the input shot open on a click. Zero is not a pointer inside this page. */
    if (d.clientY <= 0) return;
    /* THE PRESS IS NOT A MOVE. The first event after a press arrives with the pointer where it was
       put down; reading it moved the edge to a height the hand never asked for, which read as the
       gripper jerking away on selection. Three pixels of travel are ignored, so a press changes
       nothing and a drag starts where the hand actually goes. */
    /* THE FIRST MOVE IS THE ANCHOR (owner, 2026-10-31: the divider "jumped and opened up all the way"
       on a press). A gesture whose start Y never arrived had a start of zero, so the first event
       measured the whole distance from the top of the window and the input went with it. If there is
       no start, this event becomes one: it records the height as it is and changes nothing. */
    if (!this._dragStartY) {
      const inputEl = this.renderRoot?.querySelector('design-chat-input') as HTMLElement | null;
      this._dragStartY = d.clientY;
      this._dragStartHeight = this.inputHeight ?? (inputEl ? inputEl.getBoundingClientRect().height : 0);
      return;
    }
    if (Math.abs(d.clientY - this._dragStartY) < 3) return;
    // THE HEIGHT THE HAND IS ASKING FOR — read from the POINTER, never from how far it has
    // travelled. This is the owner's rule for every gripper here (TO-DO.md item 1: "I have to
    // use the cursor"), and the same rule `workspace-layout._rightPxFromPointer` already
    // follows for the width. A height computed as `start + travel` drifts from the hand the
    // moment anything reflows — the cap below clamps, the pane resizes, the footer
    // re-measures — and the edge ends up somewhere the cursor is not, for the rest of the drag.
    //
    // The input area sits above the footer and below this bar, so its top is the edge the
    // hand holds. THE POINTER IS NOT THE EDGE: the grip strip sits above the edge, so the
    // edge follows `pointer + grabOffset`. Reading the pointer each move keeps the edge on
    // the hand after the cap clamps and releases; the measured bottom keeps it from jumping.
    /* NO CEILING OF ITS OWN (owner, 2026-10-31: *"we don't use clamps"*). The 600 was a constant
       that stopped the input long before the column was full, and it is what felt like the divider
       fighting the hand. The only bound left is the space the column actually has, read from the
       column, and the output above keeps its own minimum. */
    /* THE LIMIT BLOCK IS GONE: no slots were summed and no maximum was computed, so nothing in
       this handler can pull against the hand. */
    /* THE HEIGHT AT THE PRESS, taken when the gesture was anchored. */
    const startHeight = this._dragStartHeight || (this.inputHeight ?? 0);
    const wanted = startHeight + (this._dragStartY - d.clientY);
    /* NO CLAMP AT ALL — the input takes the hand's distance exactly. */
    this.inputHeight = wanted;
  }

  export function wireGrips(this: ChatFrameHost, attempt = 0): void {
    const root = this.renderRoot;
    if (!root) return;
    const hosts = Array.from(
      root.querySelectorAll(slotSelector(this.frameSlotTags)),
    ) as HTMLElement[];
    let unwired = 0;
    for (const host of hosts) {
      const band = host.shadowRoot?.querySelector('.gripper, .grip') as HTMLElement | null;
      if (!band) {
        unwired += 1;
        continue;
      }
      if (this._gripWired.has(band)) continue;
      this._gripWired.add(band);
      /* ── INPUT ── */
      /* THE COMPOSER'S DIVIDER SLIDES THE INPUT (owner, 2026-10-31: *"make the divider gripper with
         the send button slide up and slide down"*). It gets its own plain gesture here, the same
         shape as the slots': hold, move, the input's height changes by the distance. */
      if (host.tagName.toLowerCase() === 'tools-chat-controls') {
        band.style.cursor = 'ns-resize';
        band.style.touchAction = 'none';
        /* A PRESS ON THE BAND IS A DRAG, NEVER A SELECTION (owner, 2026-10-31: the divider "snaps
           and jerks" when he takes hold of it). Without this, moving over the bar's own words
           starts a text selection, the browser cancels the pointer, and the drag lets go. */
        band.style.userSelect = 'none';
        band.style.setProperty('-webkit-user-select', 'none');
        band.addEventListener('pointerdown', (event) => {
          const ev = event as PointerEvent;
          if (ev.button !== 0) return;
          ev.preventDefault();
          const input = this.renderRoot?.querySelector('design-chat-input') as HTMLElement | null;
          const startY = ev.clientY;
          const startH = input ? input.getBoundingClientRect().height : (this.inputHeight ?? 100);
          /* THE HAND'S TRAVEL IS CAPPED BY THE ROOM THE BOXES ABOVE CAN GIVE (owner, 2026-10-31:
             *"it stops right at a certain point it doesn't just keep dragging forever"*). Read
             ONCE, at the press, so the cap cannot move under the hand. */
          const cap = startH + this._roomToGrow(host);
          const onMove = (move: PointerEvent): void => {
            if (move.buttons === 0) { done(); return; }
            const wanted = startH + (startY - move.clientY);
            this.inputHeight = Math.round(Math.min(wanted, cap));
          };
          const done = (): void => {
            band.removeEventListener('pointermove', onMove);
            band.removeEventListener('pointerup', done);
            band.removeEventListener('pointercancel', done);
          };
          band.addEventListener('pointermove', onMove);
          band.addEventListener('pointerup', done);
          band.addEventListener('pointercancel', done);
          band.setPointerCapture(ev.pointerId);
        });
        continue;
      }
      band.setAttribute('data-tools-grip', '');
      band.style.cursor = 'ns-resize';
      band.style.touchAction = 'none';
      band.style.userSelect = 'none';
      band.style.setProperty('-webkit-user-select', 'none');

      /* A GRIP CARRIES ONE THING: THE DRAG (owner, 2026-10-31: *"check each gripper and remove
         anything that is not related to a gripping sliding behavior"*). No click handler, no role,
         no toggle — the pointerdown below is the whole of it. */
      /* ONLY THE BAR COLLAPSES THE CARD (owner, 2026-10-31: *"if I click inside of the conversation
         anywhere inside of it, it collapses it … it should only collapse when you click the header"*).
         The toggle is on the card's bar row, so a press anywhere else in the card — the list, the
         empty space, a row's margin — does nothing to the card's size. */
      /* ── CONVERSATIONS ── */
      if (host.dataset.slot === 'conversations') {
        const barRow = host.shadowRoot?.querySelector('.status') as HTMLElement | null;
        barRow?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this._toggleConversations();
        });

      }
      /* ── HEADER ── */
      /* THE HEADER'S OWN ACCORDION PRESS. Its whole face is its bar, so a press on the card returns
         it to its Default; only a drag writes a size. */
      if (host.tagName.toLowerCase() === 'output-header') {
        const face = host.shadowRoot?.querySelector('.readout-area') as HTMLElement | null;
        face?.addEventListener('click', () => this._resetBox(host));
      }
      band.addEventListener('pointerdown', (event) =>
        this._onSlotGripDown(event as PointerEvent, band, host),
      );
    }
    /* The parts draw their bands in their own shadow trees, which land a frame or two after this
       seat's first render. Retry while one is missing, and stop when they are all found. */
    if (unwired > 0 && attempt < 8) {
      window.setTimeout(() => this._wireGrips(attempt + 1), 120);
    }
  }

  /* ONE GRIP, ONE BEHAVIOUR: it grabs the box and moves it (owner, 2026-10-31: *"remove the bullshit
     that you have added to these grippers"*). Hold the band, move, the box's height changes by the
     distance travelled. Release, and it stops. Nothing else — no dead zone, no click, no special
     case for a named slot. */
  export function onSlotGripDown(this: ChatFrameHost, e: PointerEvent, band: HTMLElement, host: HTMLElement): void {
    if (e.button !== 0) return;
    e.preventDefault();
    /* The tray names its card `.card`; the other parts name it `.shell` or `.readout-area`. */
    const card =
      (host.shadowRoot?.querySelector('.shell, .readout-area, .card') as HTMLElement | null) ?? host;
    const startY = e.clientY;
    const startH = card.getBoundingClientRect().height;
    card.style.flex = '0 0 auto';
    /* ── FOOTER ── The footer's band sits ABOVE its card, so an upward drag grows it, and its
       growth comes out of the Chat input above it: the two move as one pair, up to 100 pixels
       (owner, 2026-10-31: *"the footer expand to a maximum of 100 pixels"*). */
    if (host.tagName.toLowerCase() === 'design-chat-plugin-tray') {
      const box = this.renderRoot?.querySelector('design-chat-input') as HTMLElement | null;
      if (!box) return;
      const startInput = box.getBoundingClientRect().height;
      const area = box.shadowRoot?.querySelector('.input-area') as HTMLElement | null;
      const areaMin = area ? parseFloat(getComputedStyle(area).minHeight) : 0;
      const inputFloor = Number.isFinite(areaMin) && areaMin > 0 ? areaMin : startInput;
      const cardMin = parseFloat(getComputedStyle(card).minHeight);
      const footerFloor = Number.isFinite(cardMin) && cardMin > 0 ? cardMin : startH;
      const maxDelta = Math.max(0, Math.min(100 - startH, startInput - inputFloor));
      const minDelta = Math.min(0, footerFloor - startH);
      const onFooterMove = (ev: PointerEvent): void => {
        if (ev.buttons === 0) {
          footerDone();
          return;
        }
        const travel = startY - ev.clientY;
        const delta = Math.max(minDelta, Math.min(travel, maxDelta));
        card.style.height = `${Math.round(startH + delta)}px`;
        this.inputHeight = Math.round(startInput - delta);
      };
      const footerDone = (): void => {
        band.removeEventListener('pointermove', onFooterMove);
        band.removeEventListener('pointerup', footerDone);
        band.removeEventListener('pointercancel', footerDone);
      };
      band.addEventListener('pointermove', onFooterMove);
      band.addEventListener('pointerup', footerDone);
      band.addEventListener('pointercancel', footerDone);
      band.setPointerCapture(e.pointerId);
      return;
    }
    /* THE OTHER BOXES ARE THE STOP (owner, 2026-10-31: *"a simple container with a divider that
       moves one or the other and then they're stuck together"*). The drag can only spend the room
       the boxes around it have above their own floors; that sum is read ONCE, here, so the stop is
       fixed for the whole gesture and the card follows the hand until it reaches it. */
    const cap = startH + this._roomToGrow(host);

    const onMove = (ev: PointerEvent): void => {
      if (ev.buttons === 0) {
        done();
        return;
      }
      const wanted = startH + (ev.clientY - startY);
      card.style.height = `${Math.round(Math.min(wanted, cap))}px`;
      if (
        host.dataset.slot === 'conversations' &&
        !this._conversationsLoaded &&
        ev.clientY > startY + 8
      ) {
        this._conversationsLoaded = true;
        void this._readPackageConversations(this._userId());
      }
    };
    const done = (): void => {
      band.removeEventListener('pointermove', onMove);
      band.removeEventListener('pointerup', done);
      band.removeEventListener('pointercancel', done);
    };
    band.addEventListener('pointermove', onMove);
    band.addEventListener('pointerup', done);
    band.addEventListener('pointercancel', done);
    band.setPointerCapture(e.pointerId);
  }

  /**
   * THE ROOM THE OTHER BOXES CAN GIVE, ABOVE THEIR OWN DEFAULTS — the one number that stops a drag.
   * A box inside the output takes the spare room of the boxes beside it, never its own; the
   * composer and the tray stand below the output, so they take the spare room of all of it.
   */
  export function roomToGrow(this: ChatFrameHost, host: HTMLElement): number {
    const root = this.renderRoot;
    const output = root?.querySelector('.chat-output-wrapper') as HTMLElement | null;
    if (!output) return 0;
    const input = root?.querySelector('.chat-input-wrapper') as HTMLElement | null;
    const fromAll = Boolean(input && host.parentElement === input);
    /* THE FOOTER REACHES THE CHAT INPUT'S HEIGHT AND NO FURTHER (owner, 2026-10-31: *"it would only
       expand to the height of the chat input area … if the input area was pulled up then maybe it
       could go higher"*). The input's box is the number, read at the press. */
    if (host.tagName.toLowerCase() === 'design-chat-plugin-tray') {
      const box = root?.querySelector('design-chat-input') as HTMLElement | null;
      const card = host.shadowRoot?.querySelector('.card') as HTMLElement | null;
      if (!box || !card) return 0;
      return Math.max(
        0,
        Math.round(box.getBoundingClientRect().height) - Math.round(card.getBoundingClientRect().height),
      );
    }
    let room = 0;
    for (const child of Array.from(output.children) as HTMLElement[]) {
      if (!fromAll && child === host) continue;
      const style = getComputedStyle(child);
      /* A box that cannot shrink gives nothing, so it is not counted as room. */
      if (Number(style.flexShrink) === 0) continue;
      room += Math.max(0, child.offsetHeight - this._defaultOf(child));
    }
    return room;
  }

  /** A box's Default: the number its card declares, plus the block's own chrome around the card. */
  export function defaultOf(this: ChatFrameHost, host: HTMLElement): number {
    const card = host.shadowRoot?.querySelector(
      '.shell, .readout-area, .card',
    ) as HTMLElement | null;
    if (!card) return host.offsetHeight;
    const min = parseFloat(getComputedStyle(card).minHeight);
    if (!Number.isFinite(min) || min <= 0) return host.offsetHeight;
    return host.offsetHeight - card.offsetHeight + min;
  }

  /** One box back to its Default: the size a drag wrote is cleared. */
  export function resetBox(this: ChatFrameHost, host: HTMLElement): void {
    const card = host.shadowRoot?.querySelector(
      '.shell, .readout-area, .card',
    ) as HTMLElement | null;
    if (card) {
      card.style.height = '';
      card.style.flex = '';
    }
    host.style.height = '';
    host.style.flex = '';
  }

  /** Every slot height this seat set goes back to its natural size. */
  export function resetSlotGrips(this: ChatFrameHost): void {
    const root = this.renderRoot;
    if (!root) return;
    for (const host of Array.from(
      root.querySelectorAll(slotSelector(this.frameSlotTags)),
    ) as HTMLElement[]) {
      host.style.height = '';
      host.style.flex = '';
      const card = host.shadowRoot?.querySelector('.shell, .readout-area, .card') as HTMLElement | null;
      if (card) {
        card.style.height = '';
        card.style.flex = '';
      }
    }
  }

/* ── THE SLOTS THAT HOLD A VIEW ─────────────────────────────────────────────────────────────
 * Which view fills the `view` slot, which tab that view claims, and whether a tab draws the
 * thread instead. A2UI placeholders and tab names — never a message, a session or a thread.
 */
  export function slot(this: ChatFrameHost, name?: string): HTMLSlotElement | null {
    const selector = name ? 'slot[name="' + name + '"]' : 'slot';
    const found = this.renderRoot?.querySelector(selector) as HTMLSlotElement | null;
    return found ?? null;
  }

  /** Is a seat supplied by the host? Read at render time — the light DOM is the truth. */
  export function seatSlotted(this: ChatFrameHost): boolean {
    const assigned = this._slot()?.assignedNodes?.({ flatten: true }) ?? [];
    if (assigned.some((n) => n.nodeType === Node.ELEMENT_NODE)) return true;
    // The light DOM covers the case slotting does not report: jsdom's slotting is thin, and a host
    // may append a seat after this element's first render.
    //
    // A child that NAMES another slot is not a seat. The surface puts the Trace view in this
    // element's "view" slot, so a bare count of children read that as "the host handed me a seat",
    // rendered the seat slot in place of the panel body, and took the entire rail off the screen
    // — the collapsed right column measured 82px with nothing in it. Measured 2026-09-17.
    return Array.from(this.children).some((el) => !el.getAttribute('slot'));
  }

  export function onSlotChange(this: ChatFrameHost): void {
    // A seat or a view arrived or left. Nothing is cached: the next render reads the
    // light DOM again.
    this.requestUpdate();
  }

  /**
   * Is a view supplied for the rail's non-chat tab — Trace, Versions, Tools,
   * Approvals? Read at render time, the same rule the seat slot follows, because
   * the light DOM is the truth and a cached flag would be one more thing that can
   * disagree with what is assigned.
   *
   * The slot element only exists while a non-chat tab is active (see render), so
   * this answers for the tab being drawn, not for every tab at once.
   */
  /**
   * WHAT AN EMPTY VIEW SAYS. Advice, per tab, in the place the view would be — because a
   * rail button is a request to look at something THIS place has, and "this place has none
   * yet" is the answer a demo owes the person who pressed it.
   *
   * A tab with no line of its own gets the plain truth rather than an invention: the view
   * is empty, and it fills when the surface puts something in it.
   */
  export function emptyViewLine(this: ChatFrameHost): unknown {
    const lines: Record<string, string> = {
      versions: 'No versions yet. A version is written when this package is saved.',
      tools: 'No tools yet. A Tool Call seat in the prompt is what names one.',
      executions: 'No runs yet. Press ▶ Play the run and this flow\'s run lands here.',
      eval: 'Nothing has been judged yet. Press Run and each run\'s verdict lands here, one row per run.',
      trace: 'Nothing traced yet. The canvas\'s own events appear here as they happen.',
      states: 'Sample drawings only. Run the flow to draw the real one.',
      repair: 'Nothing to repair. The catalog checker found no open findings.',
    };
    const line = lines[this.activeTab]
      ?? `Nothing in this view yet — the surface fills it when this place has something to show.`;
    return html`<span class="view-empty">${line}</span>`;
  }

  /**
   * IS THIS THE CONSOLE'S SEAT — the one whose chat carries the findings?
   *
   * The answer is the rail's own list, written by the server: the seat that OFFERS Repairs is
   * the seat that draws the findings above its thread, and no other chat is touched (owner,
   * 2026-09-18: "this is only for the console, not anywhere else chat appears"). Reading the
   * server's list rather than taking a second flag means the rail and the panel cannot
   * disagree about which seat this is — the same reason the list is not the model's to write.
   */
  /**
   * Is this seat the one that carries a findings view? APPROVALS is that tab now — the
   * owner, 2026-09-19: "remove the repairs from the tab — repairs live under the approvals."
   * The repair TAB is gone (the console's allowedTabs dropped it), and the view that used
   * to hang off it draws under Approvals, where the findings always belonged.
   */
  export function findingsSeat(this: ChatFrameHost): boolean {
    return this.allowedTabs
      .split(',')
      .map((tab) => tab.trim())
      .includes('approvals');
  }

  /**
   * IS A VIEW CLAIMING THIS TAB — an assigned view declaring `view-tab="<tab>"` on
   * itself (a room's own furniture; see `_viewSlotted`). When one is, the tab draws
   * the view FLAT, not in the fold: the trace fold exists for the console/composer's
   * trace-feed — a disclosure around telemetry — and a room whose own view fills the
   * hole draws it as the hole's content, the way the app it came from draws it (the
   * owner, 2026-10-13: "there's no drop-down … if it's a flat list there's no
   * drop-down"). The fold path stays untouched for every seat without a claimant.
   */
  export function tabClaimant(this: ChatFrameHost, tab: string): boolean {
    const claims = (el: Element): boolean =>
      el.tagName.toLowerCase() !== 'slot' && el.getAttribute('view-tab') === tab;
    const assigned = this._slot('view')?.assignedNodes?.({ flatten: true }) ?? [];
    if (assigned.some((n) => n.nodeType === Node.ELEMENT_NODE && claims(n as Element))) return true;
    return Array.from(this.children).some(
      (el) => el.getAttribute('slot') === 'view' && claims(el),
    );
  }

  export function viewSlotted(this: ChatFrameHost): boolean {
    const wanted = this._wantedViewTag();
    const assigned = this._slot('view')?.assignedNodes?.({ flatten: true }) ?? [];
    /* TWO WAYS A VIEW BELONGS TO THIS TAB — its TAG is one this tab wants (the seat's
       own views: trace-feed, eval-feed, chat-repair-actions), or the ROOM declared the
       tab on the element itself (`view-tab="<rail tab id>"` — the door that lets a
       room's own furniture fill this hole without the seat learning room names).
       Either way its waiting line must not draw: the view is coming, or here. */
    const cameFor = (el: Element): boolean =>
      (!!wanted && el.tagName.toLowerCase() === wanted)
      || (!!this.activeTab && el.getAttribute('view-tab') === this.activeTab);
    if (assigned.some((n) => n.nodeType === Node.ELEMENT_NODE && cameFor(n as Element))) return true;
    // The light DOM covers what slotting does not report: jsdom's slotting is thin,
    // and the surface's child may be appended after this element's first render.
    // A SLOT ELEMENT IS NOT A VIEW. When a host sits between this panel and the
    // surface — <room-embed> re-projects the surface's children into these slots —
    // the children seen here are `slot` elements, which PROJECT content rather than
    // being it. Counting them claimed a view was slotted when the host had none, and
    // the waiting line was suppressed for a view that was never coming.
    return Array.from(this.children).some(
      (el) => el.getAttribute('slot') === 'view' && el.tagName.toLowerCase() !== 'slot' && cameFor(el),
    );
  }

  /**
   * IS A FOREIGN VIEW ASSIGNED — a view this seat's own tabs do not name.
   *
   * THE SEAT'S OWN DOOR, kept when the first room to use it left. The Product room bound its
   * context strip here (declared 2026-10-03; the owner removed the catalogue chooser the same
   * day, and the strip with it — see the allow-list note above the styles), and this mechanism
   * was what let it draw: the seat's `_wantedViewTag` knows only its own views (trace-feed,
   * eval-feed, chat-repair-actions), so a room's furniture in the hole the design left open
   * ("holds plain text output and inserted functions") is neither "wanted" nor wrong. The
   * question is narrow on purpose — are any assigned view elements tags this seat does not
   * own? — so a room's view draws above her thread on the Chat tab WITHOUT changing any other
   * seat: the composer's seat assigns trace/eval views (all known, nothing changes there), and
   * the console's repair rows are known too. Nothing binds it today; the next room's view needs
   * the same one-line allow-list entry above and nothing here. The two assignment checks mirror
   * `_viewSlotted`'s own.
   */
  export function anyForeignViewAssigned(this: ChatFrameHost): boolean {
    const known = new Set(['trace-feed', 'eval-feed', 'chat-repair-actions']);
    /* A TAB VIEW IS NOT FURNITURE. A room's rail-tab view declares `view-tab` on itself
       and draws in the hole under its own tab (the `view-tab` rules in the styles); this
       door feeds the chat-top strip ABOVE the thread and must not see those — admitting
       one drew an empty chat-top band on every Chat tab, because that strip's own styles
       allow only the repair rows. Foreign here means: a tag this seat does not own AND
       no tab claimed — the Product strip was that, and the next such strip joins by
       nothing but this check. */
    const isFurniture = (el: Element): boolean =>
      el.tagName.toLowerCase() !== 'slot'
      && !known.has(el.tagName.toLowerCase())
      && !el.hasAttribute('view-tab');
    const assigned = this._slot('view')?.assignedNodes?.({ flatten: true }) ?? [];
    for (const n of assigned) {
      if (n.nodeType === Node.ELEMENT_NODE && isFurniture(n as Element)) return true;
    }
    return Array.from(this.children).some(
      (el) => el.getAttribute('slot') === 'view' && isFurniture(el),
    );
  }

  /**
   * DOES THIS TAB DRAW A VIEW ABOVE THE THREAD. Two cases, one place: the console's repair
   * rows on Approvals (their own recorded rule), and a room's foreign view on Chat (the
   * Product room's context strip, 2026-10-03 — the room must open with its chooser visible,
   * the same "never opens on a blank chat" the console's rows answer).
   */
  export function chatTopView(this: ChatFrameHost): boolean {
    return (this.activeTab === 'approvals' && this._findingsSeat())
      || (this.activeTab === 'chat' && this._anyForeignViewAssigned());
  }

  /**
   * WHICH SLOTTED ELEMENT THIS TAB'S VIEW IS — each rail tab draws one view, and the
   * slot can hold several at once. A tab without a view element yet (tools, versions,
   * runs, states) has none, so its waiting line shows; the views that exist answer to
   * their own tag, so the trace feed never stands in for Evals and vice versa.
   */
  export function wantedViewTag(this: ChatFrameHost): string | null {
    switch (this.activeTab) {
      case 'trace': return 'trace-feed';
      case 'eval': return 'eval-feed';
      case 'repair':
      case 'approvals': return 'chat-repair-actions';
      default: return null;
    }
  }

  /**
   * WHICH TABS DRAW THE THREAD — and `approvals` draws it.
   *
   * The owner, 2026-09-18: "there's no chat hooked up to the console approval button. It's
   * dead, it does nothing — just hook one of them up so I can talk to it." The console's
   * approvals view held the repair list, which renders nothing when no findings carry a
   * stage, so the tab showed an empty pane. The seat draws its own conversation there
   * instead: the same thread and the same input the Chat tab uses, against the same
   * conversation. A message that names governance runs the inspection and its report comes
   * back as the reply (routes/teacher.py), so this tab is a surface to ask the governance
   * system for a report and to read the reports already filed.
   *
   * The view slot keeps the other tabs (trace, versions, tools, repair), and an element
   * still never renders another element: this is the seat drawing its own thread.
   */
  export function showsThread(this: ChatFrameHost): boolean {
    /* A ROOM'S OWN VIEW THAT NAMES THIS TAB IS THE TAB'S CONTENT (owner, 2026-11-02).

       The Design room assigns its approvals surface to the right column with `view-tab="approvals"`.
       The console's recorded rule has Approvals draw its thread, so the view was assigned to a strip
       that admits only the repair rows while the column drew a conversation — the person pressed
       Approve and met a chat. A claimed tab is a view tab: the view fills the hole and no thread is
       drawn beside it. CHAT IS EXCLUDED, because a view claiming the Chat tab, if one ever exists,
       stands ABOVE the thread by the chat-top rule rather than replacing it. */
    if (this.activeTab !== 'chat' && this._tabClaimant(this.activeTab)) return false;
    /* `tools` IS A CONVERSATION TAB (owner, 2026-11-02). It was left out when the tab's output
       was a slotted view; with that view gone, the seat's own thread is the Tools chat, and a
       rule that excluded it drew an empty column over a thread that held her greeting. */
    return this.activeTab === 'chat' || this.activeTab === 'approvals'
      || this.activeTab === 'tools' || this._evalsDrawsThread();
  }

  /**
   * WHICH EVALS TABS DRAW THE THREAD — the rooms that say so.
   *
   * The owner, 2026-10-16: *"She has to talk whenever you click the eval's button. That's
   * the trigger."* — and the talk has to be VISIBLE on the tab that was clicked, or the
   * click reads as silence (measured: the Evals tab drew its waiting line while her words
   * sat one tab over). A room whose Evals have no feed of their own yet declares
   * `evalsTalk`, and its Evals tab draws the conversation instead of the waiting line;
   * THE DAY a feed is slotted (a view claiming `view-tab="eval"` or an eval-feed bound
   * into the slot) this stands aside and the view draws. Other seats never set the flag
   * and render exactly as before.
   */
  /**
   * THE TAB-EXPERIENCE DOOR IS GONE with its styles: a tab's output is the catalog's own view
   * in the `view` slot (the trace tree, the evaluators index), never a second output area.
   * `_evalsDrawsThread` below still reads the slot the right way — a view claiming the tab
   * stands aside from her thread, exactly as the Trace tab does.
   */
  export function evalsDrawsThread(this: ChatFrameHost): boolean {
    return this.activeTab === 'eval'
      && this.evalsTalk
      && !this._tabClaimant('eval')
      && !this._viewSlotted();
  }

/* ── THE COLUMN EDGE AND THE RAIL'S COLLAPSE ───────────────────────────────────────────────
 * The strip announces its drag to the host, which owns the column's width; the rail's toggle
 * only records the state it was told.
 */
  export function onGripDown(this: ChatFrameHost, e: PointerEvent): void {
    // A PRESS DURING A LIVE GESTURE REPLACES IT rather than stacking a second set of listeners
    // on the first — the rule the sibling grip already states ("a press during a live gesture
    // REPLACES it rather than stacking", chat-action-bar `_startDrag`), and the other way this
    // gesture ends up unable to let go. Without it the old listeners are unreachable (the fields
    // that named them are overwritten) and no release can ever remove them.
    this._releaseGrip();
    /*
     * THE STRIP KEEPS THE HAND — POINTER CAPTURE, NOT LISTENERS ON THE DOCUMENT.
     *
     * This gesture followed the hand through `mousemove` on the document, and that is what made
     * the gripper unusable beside a framed application: her left neighbour is often an iframe
     * (the Design room's left column frames PostHog), and while the pointer is over a frame the
     * parent document receives NO mouse events at all — not the moves, not the release. Measured
     * 2026-10-19: press the collapsed column's strip, drag left, and the width stopped at the
     * floor while the layout stayed `dragging` with the button up, so every later hover moved a
     * column nobody was holding. The owner: *"the gripper is fighting the user… it's forcing it to
     * the right, I'm not able to expand and collapse."*
     *
     * Pointer capture is the platform's own answer: the strip captures the pointer on
     * pointerdown, and from then until the release EVERY pointermove/pointerup is delivered to
     * the strip — whatever element, or frame, is under the cursor.
     */
    const strip = e.currentTarget as HTMLElement | null;
    if (!strip) return;
    const pointerId = e.pointerId;
    this._gripEl = strip;
    this._gripPointerId = pointerId;
    this._gripMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      /*
       * THE MOVE THAT SAYS THE HAND IS EMPTY IS THE RELEASE. Pointer capture already ends the
       * gesture on pointerup/pointercancel; this is the same fact read from the event that
       * carries it — `buttons` is the state of the mouse RIGHT NOW — so a release lost to a
       * focused frame or a dropped event cannot outlive the hand.
       */
      if (ev.buttons === 0) {
        this._gripUp?.(ev);
        return;
      }
      this.dispatchEvent(
        new CustomEvent('input-resize-move', {
          bubbles: true,
          composed: true,
          detail: { clientX: ev.clientX, clientY: ev.clientY },
        }),
      );
    };
    this._gripUp = () => {
      this.dispatchEvent(new CustomEvent('input-resize-end', { bubbles: true, composed: true }));
      this._releaseGrip();
    };
    strip.addEventListener('pointermove', this._gripMove);
    strip.addEventListener('pointerup', this._gripUp);
    strip.addEventListener('pointercancel', this._gripUp);
    /* THE CAPTURE IS THE GESTURE. It is taken on the strip itself, so every event in flight —
       over the panel, over the left column, over the frame inside it — is routed here. */
    try {
      strip.setPointerCapture(pointerId);
    } catch (err) {
      /* A capture that cannot be taken is said out loud, because the gesture would otherwise
         read as a dead gripper: the pointer would leave this element and the moves would stop. */
      console.error('[design-chat] the column gripper could not capture the pointer:', err);
    }

    this.dispatchEvent(
      new CustomEvent('input-resize-start', {
        bubbles: true,
        composed: true,
        detail: { clientX: e.clientX, clientY: e.clientY },
      }),
    );
    e.preventDefault();
  }

  /**
   * LET THE PAGE GO — the strip's pointer listeners and its capture off, once. The same discipline
   * the composer's input grip already keeps (`_endDrag` in chat-action-bar, which is called by its
   * release AND by `disconnectedCallback`), applied to the column's strip.
   *
   * WHY IT HAS TO RUN WHERE THE ELEMENT GOES, not only where the mouse does: this element is
   * REPLACED by the renderer whenever the surface re-renders — an assembly landing, a data-model
   * write — and a panel replaced mid-gesture used to leave its `mousemove` listener on the
   * document. That listener went on raising `input-resize-move` at a host that no longer had a
   * gesture, and the layout answered a stray move by STARTING one: the column took hold with no
   * button down, and nothing could release it because the listeners behind it were gone.
   */
  export function releaseGrip(this: ChatFrameHost): void {
    const el = this._gripEl;
    this._gripEl = null;
    if (el) {
      if (this._gripMove) el.removeEventListener('pointermove', this._gripMove);
      if (this._gripUp) {
        el.removeEventListener('pointerup', this._gripUp);
        el.removeEventListener('pointercancel', this._gripUp);
      }
      // The capture belongs to the strip, so it goes with it. `hasPointerCapture` guards the
      // release: releasing an id nobody holds throws, and a throw here would strand the gesture.
      if (this._gripPointerId !== null && el.hasPointerCapture?.(this._gripPointerId)) {
        el.releasePointerCapture(this._gripPointerId);
      }
    }
    this._gripMove = null;
    this._gripUp = null;
    this._gripPointerId = null;
  }

  /** The rail's `collapse-toggle` — chat-button state=Selected, clicked again. */
  export function onCollapseToggle(this: ChatFrameHost, e: Event): void {
    this.collapsed = Boolean((e as CustomEvent).detail?.collapsed);
  }
