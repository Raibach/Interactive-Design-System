/**
 * THE DESIGN SEAT'S STYLES — moved whole out of the element (2026-10-24).
 *
 * No statement changed. The element imports this sheet as its `static styles`; the drawing
 * still reads the same rules. The file is separate so the seat's behaviour can be read
 * without scrolling through the drawing's CSS.
 */
import { css } from 'lit';

export const designChatStyles = css`
    :host {
      display: flex;
      flex-direction: row;
      height: 100%;
      min-height: 0;
      min-width: 0;
      /*
       * NO OVERFLOW HIDING. This host used to clip, and that clip was doing two
       * jobs, both of them wrong. It hid content that overflows — the class of
       * thing that makes a broken layout look contained — and it cut off the rail's
       * edge drop shadow, which is drawn to fall OUTSIDE the rail and onto the
       * surface beside it ("chat-main-menu-vert" #40001066:4301, -4px 4px 10px).
       *
       * Nothing here needs it. The column's scrollers are the inner regions — the
       * thread and the view slot both carry overflow-y: auto — so this box is not a
       * scroll container and has no overflow to contain.
       */
      /* THE PANEL'S FACE — NUNITO, per the owner's ruling, 2026-10-07: "Arial or rounded
         fonts -> becomes Nunito (found in chat interfaces for Grace)... Use our fonts
         only - no API calls." The panel is chat; the figures its children draw render
         Inter (.num). */
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 14px;
      color: #1c2f4e;
    }
    /*
     * THIS ELEMENT IS THE DESIGN'S right-column-panel-container, and the node it names
     * moved with v.4b: it was #40001066:3272 and it is now #40001119:6025 — same name,
     * same three siblings, new drawing. The container is 634 wide = spacer (20) + rail
     * (74) + panel (540), with paddingTop 10; the drawing's own panel is 540x954.
     *   paddingTop 10 — why the design's rail is 954 tall inside a 964 container.
     * With the strip and the panel both inside this box, the padding insets both and
     * the fill sits behind both — which is what could not happen while the strip was
     * outside it.
     */
    :host {
      padding-top: 10px;
      box-sizing: border-box;
      /* TRANSPARENT, SO THERE IS NOTHING TO KEEP IN STEP. This container (the design's
         right-column-panel-container) and the spacer beside it paint no fill at all: what
         shows through is whatever the column stands on, so when it stands on a canvas the
         canvas IS its background and the two read as one surface with no token to match
         (owner, 2026-09-18). A ground colour here was a second value that had to agree
         with the drawing, and a second value is a thing that drifts. Her own fills — the
         rail, the panel, the turns — are hers, and she looks the same everywhere.
         No backticks in a css literal: this comment is inside one. */
      background: transparent;
    }
    /*
     * The spacer: "chat-left-spacer" #40001085:2598. 20px in the design, 30px here
     * for the reason recorded in the host layout tests; transparent because the
     * node's fill is switched off (or removed) in Figma and the container's fill is
     * what shows through; the glyph's two colours are the component set's two
     * states, and the colour IS the hover — neither state paints a background.
     *
     * AND THE GLYPH SITS AT THE STRIP'S RAIL SIDE, NOT ITS CENTRE (owner, 2026-10-13:
     * *"Scroll bar is still underneath the gripper … brought in closer"*). MEASURED at
     * the governance seam: the app's own 12px scrollbar rides the app's right edge at
     * 90..102px from the browser's edge, and the CENTRED glyph (84..94) sat on its
     * lane. Justified to the panel side the glyph lives at 74..84 — six clear pixels
     * from the scrollbar's lane — while the strip's own width and every number the
     * layout's drag arithmetic keeps stay untouched.
     */
    .gripper-chat {
      flex: 0 0 30px;
      width: 30px;
      /* 5px BETWEEN THE GLYPH AND THE RAIL (owner, 2026-10-17: *"it's supposed to have a little
         maybe a five pixel padding between the gripper and the edge of the vertical navigation
         menu."*). The strip keeps its 30px — the layout's drag arithmetic reads that width — and
         border-box means the 5px comes out of it, so the glyph floats 5px clear of the rail's
         first pixel instead of sitting flush against it. */
      box-sizing: border-box;
      padding-right: 5px;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      cursor: col-resize;
      color: #b4b4b4;
      user-select: none;
      /* POINTER-CAPTURE DRAG — the strip keeps the gesture even over a framed application
         (see _onGripDown); no touch or trackpad gesture may take it mid-drag. */
      touch-action: none;
    }
    .gripper-chat:hover,
    .gripper-chat:active {
      color: #7e72e3;
    }
    .gripper-chat svg {
      display: block;
      pointer-events: none;
    }
    /* The rail is <chat-navigation-bar>, which carries its own Figma constraint
       (75px, blue gradient, radius). The panel stacks the remaining pieces; only
       the thread is allowed to grow and scroll.

       NO z-index, NO un-clipping, and neither is missing: both were tried today to
       get the rail's drop shadow out of this element, and both were the wrong kind
       of change — a forced paint order, and a containment guarantee given up for a
       visual effect. The shadow is invisible here because THIS ELEMENT IS NOT THE
       CONTAINER THE DESIGN PUTS IT IN.

       The design's right column is one container holding three SIBLINGS — spacer
       (20, x -14857), rail (74, x -14837), panel (540, x -14763) — so the rail's
       -4px 4px 10px lands on the transparent spacer beside it and on the container
       behind it, across boundaries nothing clips. Here the rail is a CHILD of the
       panel, flush against the edge of the box that clips it, and the panel paints
       over it. Until the rail is the panel's sibling inside a right-column
       container, any fix from inside this element is a workaround. */
    design-chat-navigation-bar { flex-shrink: 0; will-change: transform; }
    /* The panel FILLS its column and snaps to the edges of the browser window.
       contain: layout paint scopes its internals so a window drag-resize
       doesn't invalidate the whole surface every frame. */
    .panel {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-width: 0;
      /* The console sets --chat-bg on its wrapper (the owner's #2d1831, 2026-09-19);
         the composer sets nothing and keeps the design's white. */
      background: var(--chat-bg, #F7F8F2);
      contain: layout paint;
    }
    /* The split the gripper adjusts: the OUTPUT region flexes and scrolls
       internally; the INPUT chain (menu + input area + footer) hugs its
       content at the BOTTOM, so the footer never moves. Dragging the bar up
       grows the input area and shrinks the output; down reveals more output.
       No fixed heights, no empty slot wells — the frame's 519px was a
       wireframe value, not a contract. */
    /* THE FRAME DOES NOT MOVE — ONLY WHAT IS INSIDE IT. The owner, 2026-09-19: "you've got
       the entire contents of the chat panel scrolling when actually it's supposed to just be
       that window where you chat with the model — so nothing else moves. The frame stays, but
       only the content inside of the frames moves."
       So this region is a fixed frame again: overflow hidden, the bars hold their place,
       and the ONE scroller is the card's own body (.content-scroll, inside the response
       card). That is also where it was before the drawn scrollbar existed; what the drawn
       bar changed is only HOW it is drawn, not WHAT scrolls. */
    .chat-output-wrapper {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      /* The floor: no matter how far the input is dragged, the output keeps a
         visible region — the console reserves 80px for the chat area; this is
         the same rule. Default (inputHeight 0) is the design's own view. */
      min-height: 120px;
      overflow: hidden;
    }
    /* The rail is the thumb's track: 4px at the CARD's right edge, transparent, and it
       takes no pointer events of its own — only the thumb is grabbable, so a click that
       lands beside it goes to the bubble underneath. It rides the card, not the column:
       the frame stays put while the conversation scrolls inside it (owner, 2026-09-19). */
    .scroll-rail {
      position: absolute;
      top: 0;
      right: 2px;
      bottom: 0;
      width: 4px;
      pointer-events: none;
      z-index: 1;
    }
    .scroll-thumb {
      position: absolute;
      right: 0;
      width: 4px;
      border-radius: 10px;
      /* The same thumb the other panes draw (#dadee4) — a value this repository already
         has, not a new one. */
      background: #dadee4;
      opacity: 0.8;
      pointer-events: auto;
      cursor: grab;
      touch-action: none;
    }
    .scroll-thumb:hover,
    .scroll-thumb.dragging {
      opacity: 1;
      cursor: grabbing;
    }
    .chat-input-wrapper {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      /* v.4b: "chat-input-wrapper" #40001119:6034 — the input stack's own ground,
         #CBE6E3, with 5px above it. The action bar, the input area and the footer
         inside it each paint their own fills over this one. */
      background: #CBE6E3;
      padding-top: 5px;
    }
    /* THE TAB-EXPERIENCE DOOR IS GONE (owner, 2026-10-17: *"every assembly is customized"*
       — and the assembly is the CATALOG's views in the seat's own view slot, not a second
       output area beside them). The Evals view is <evals-index> claiming view-tab="eval"
       in the slot below, drawn by the seat's own per-tab rule. This seat is the box copy
       from Hetzner, unchanged. */
    design-chat-header { flex-shrink: 0; }
    /* THE LEADING BLOCK'S TOP IS THE DRAWING'S OWN — #40001119:6308 says 16 (it said 20
       before the file moved, 2026-09-20), and every later block takes 6. It is marked on the
       instance that leads (the readout passes variant="lead") rather than left in a custom
       property: the value check compares what it can read, and a var() was a value neither it
       nor a reader could hold against the file. */
    .chat-output-wrapper > design-chat-header:first-child { --block-pad-top: 16px; }
    /* THE CARD IS BOUNDED BY THE REGION, AND THAT IS WHAT MAKES THE THREAD SCROLL.
       It GROWS to fill what the bars leave (a short thread still fills the region, the
       design's own view) and it SHRINKS no further than the region allows — flex 1 1 auto
       with min-height 0. Its own body (.content-scroll, overflow-y auto) is then the box
       that runs out of room, which is what a wheel needs: while this was flex 1 0 auto the
       card grew to its CONTENT instead, so the inner scroller never overflowed and the
       conversation could not be rolled at all (owner, 2026-09-19: "still cannot scroll, it's
       weird"). The note that used to stand here — that allowing shrink would stop the region
       scrolling — was true while the REGION was the scroller, which it no longer is. */
    design-chat-header[card] { flex: 1 1 auto; min-height: 0; }
    design-small-dropdown { flex-shrink: 0; }
    /* "chat-output-slot-area" #40001085:1521 — column, padding 10px 20px, gap 10px,
       vertical HUG. The HUG is why the Conversations row is as tall as the dropdown
       and no taller; only the two below it are drawn to fill.
       ITS GROUND IS THE v.4b BLOCK'S: this row heads the conversations bar and sits in
       the block the drawing paints #CBE6E3, so it paints that instead of the column's
       own token — otherwise a white (or, in the console, plum) strip would cut the
       block in two. */
    .output-slot {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 20px;
      background: #CBE6E3;
    }
    /* Collapsed to the rail — chat-button state=Selected, clicked again.
       THE MOVEMENT IS THE COLUMN'S, NOT THIS ELEMENT'S, and that is the whole of this rule.
       It used to fade: first display:none (contents gone in one frame, "all of the chat contents
       pop away … and then the bar slides back", owner 2026-09-23), then an opacity fade over
       --dur-pane, which was written and never driven and is now measured — sampled on the console
       with the panes every 40ms, the CONTENT was still being squeezed to nothing (width 803 → 587
       → 357 → 191 → 0) while it faded, so what a person saw was the chat crunching and then an
       empty container sliding shut. The owner: "it should slide shut as a complete component, not
       in pieces … do you have clamps, do you have workarounds, do you have trickery in there to
       give the illusion of it sliding instead of just building it properly."
       SO THERE IS NO TRICK HERE ANY MORE. The element that owns the width — <workspace-layout> —
       holds this whole panel at the size it had open while the column is shut, and lets it
       overflow the narrowing pane (see its _slabWidthPx). Nothing about this element resizes, so
       nothing inside it re-lays-out: the column slides out of the room as one object and the rail
       arrives at the edge as its leading face.
       WHAT IS LEFT IS ONLY WHAT A HIDDEN PANEL MUST STILL DO: stop taking presses, and stop being
       reachable by the keyboard. Both are visibility's, DELAYED on the way out so the slide is
       seen to the end, and immediate on the way in so the panel is live again the instant it
       opens. (No backticks in this comment: this is a Lit css literal and one would end it.) */
    .panel {
      transition: visibility 0s linear 0s;
    }
    .panel.collapsed {
      visibility: hidden;
      pointer-events: none;
      transition: visibility 0s linear var(--dur-pane, 760ms);
    }
    /* The Conversations dropdown's rows, from "small-dropdown" state=open
       #40001085:2414: a column of white tiles, gap 5, radius 4, height 30,
       label #4E68D2 Semi Bold 600 / 14. */
    /* A LONG LIST SCROLLS IN ITS OWN SMALL BOX — more than two rows, or a short window,
       and a slim scrollbar appears inside the dropdown instead of the list stretching the
       Conversations row down the column. Two rows are always held whole (2×30 + 5 gap =
       65px); the viewport term only bites on a short window, where the box shrinks further
       rather than crowding the results area below it. */
    .conversation-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: min(65px, 20vh);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    /* 6px, and WEBKIT-ONLY ON PURPOSE — a scrollbar-width: thin here would take precedence
       in this app's own browser and draw Chrome's 11px bar instead (measured on the Scout's
       23-row list, 2026-10-02: an 11px gutter). The rest of the app's scrollers style only
       through the pseudo-elements for the same reason. (No backticks in this comment: this is
       a Lit css literal and one would end it.) */
    .conversation-list::-webkit-scrollbar { width: 6px; }
    .conversation-list::-webkit-scrollbar-track { background: transparent; }
    .conversation-list::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.28);
      border-radius: 3px;
    }
    /* THE ROW IS THE TILE, AND IT HOLDS TWO CONTROLS — the conversation (open it) and the
       trash (remove it). The tile could not stay a <button>: a button inside a button is not
       HTML, and the inner click would fire both. So the tile's own look (white, radius 4, the
       twin shadows, 30 tall) lives on the row and the controls inside it are transparent. */
    /* AND THE ROWS DO NOT SHRINK INTO THE BOX — flex items compress before they overflow
       (min-height: auto), which would squash every tile instead of scrolling the list. */
    .conversation-list li {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      height: 30px;
      border-radius: 4px;
      background: #F7F8F2;
      box-shadow: 2px 2px 6px 0 rgba(0, 0, 0, 0.15), -2px -2px 6px 0 rgba(0, 0, 0, 0.15);
    }
    .conversation-list button {
      border: none;
      background: none;
      font-family: inherit;
      cursor: pointer;
    }
    .conversation-list .conv-open {
      flex: 1 1 auto;
      min-width: 0;
      height: 100%;
      padding: 0 10px;
      text-align: left;
      font-size: 14px;
      font-weight: 600;
      color: #4e68d2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .conversation-list .conv-open:hover { background: #f7fafc; border-radius: 4px 0 0 4px; }
    /* WHEN THE THREAD WAS LAST SAVED — the owner's ask, 2026-09-24: "can you add timestamps to
       the conversations when they're saved."
       IT IS NOT IN THE DRAWING, AND THAT IS WORTH SAYING PLAINLY. v.4b draws no conversation
       selector here at all; this list's look is the older "small-dropdown" state=open
       #40001085:2414 (see registry.json), so there is no drawn time to copy. This is the app's
       own when — the same format the Evals feed shows (shared/when.ts) — recorded as an
       addition the design has yet to catch up with, the way the citation pill is.
       THE COLOUR IS MEASURED, NOT CHOSEN. #3D515B is the card's own line colour — a value the
       file already carries — and on this tile it reads 7.78:1, past AA. The muted greys the
       rest of this file uses (#6c757d, #767676) measure 4.39:1 and 4.25:1 here: both fail, and
       a timestamp is exactly the kind of small text that fails invisibly. */
    .conversation-list .conv-when {
      flex: 0 0 auto;
      padding-right: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #3D515B;
      white-space: nowrap;
    }
    /* The trash, at the row's end. The mark is the one the console cards already carry
       (agent-card-element: the same 24-grid stroke path), and so is the gesture: first click
       arms it, second click removes — a conversation is not deleted by one stray click. */
    .conversation-list .conv-remove {
      flex: 0 0 30px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6c757d;
      border-radius: 0 4px 4px 0;
    }
    .conversation-list .conv-remove:hover { background: #f7fafc; color: #b91c1c; }
    .conversation-list .conv-remove svg { display: block; width: 14px; height: 14px; }
    .conversation-list .conv-remove.armed,
    .conversation-list .conv-remove.armed:hover {
      background: #b91c1c;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
    }
    /* The list's own line — for a refusal that must be said where it happened. */
    .conv-note {
      margin: 0;
      padding: 6px 0 0;
      font-size: 13px;
      color: #6c757d;
    }
    /* THE ROW'S PLACE TAG — "this isn't from here". A conversation that belongs to another
       tab says where it belongs (the owner, 2026-09-19: "we have a little label saying this
       isn't from approval"), in the muted type, at the floor size the type law allows. */
    .conversation-list .tab-tag {
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.08);
      color: #6c757d;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .conversation-none {
      margin: 0;
      padding: 8px 0;
      font-size: 13px;
      font-style: italic;
      opacity: 0.7;
    }
    design-chat-messages { flex: 1 1 auto; min-height: 0; display: flex; }
    /* The host's slot above the content. It takes what its content asks for and
       NOTHING when it is empty — no height, no border, no gap. This is what keeps the
       new slot cost-free for every assembly that does not fill it. */
    /* THE ONE SCROLLER: the card's own body, and the bar over it is DRAWN.
       The owner, 2026-09-19: "just be that window where you chat with the model so nothing
       else moves… only the content inside of the frames moves." So the thread and whatever
       view the rail selected scroll inside the card, the card and the bars stay put, and the
       native bar is switched off in favour of the 4px thumb (see .scroll-rail) — nothing is
       narrowed to make room for it. Only the card's CONTENT travels. */
    .content-scroll {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 10px;
      /* Firefox: no native bar — the drawn thumb is the only one. */
      scrollbar-width: none;
    }
    .content-scroll::-webkit-scrollbar {
      width: 0;
      height: 0;
    }
    .content-header { flex: 0 0 auto; min-height: 0; display: flex; }
    .content-header ::slotted(*) { flex: 1 1 auto; min-height: 0; }
    /* "chat-output-simple-slot-area" #40001085:2373 — the hole the surface injects into.
       Read from the file, not assumed: the master's own sizing is vertical HUG (it is as
       tall as what is put in it) and the placement #40001085:2391 is vertical FILL (it takes
       the height its parent gives it). NEITHER IS A FIXED HEIGHT, and this rule is the
       placement's: flex 1 1 auto is vertical fill, and the children keep their own heights
       — the feed fills, the repair list hugs.
       The box's own numbers are drawn on both nodes and were not being honoured here: padding
       10px 20px (this had 20px all round), gap 10px between injected children, white fill.
       overflow-y is NOT drawn — the drawing shows one static line — and it is kept
       deliberately: a slot that fills a column whose parent clips (.chat-output-wrapper,
       overflow hidden) would otherwise cut a long repair list off at the panel's edge. */
    .view-slot {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      padding: 10px 20px;
      background: var(--chat-bg, #FFFFFF);
    }
    /* TWO VIEWS SHARE THIS ONE HOLE (the design's answer: "holds plain text output and
       inserted functions", plural). The feed FILLS it; the repair list HUGS its content,
       because a list stretched to fill the pane leaves a border around empty space and
       pushes its own rows off the bottom edge — measured: the header sat clipped at the
       panel's lower boundary with the feed above it taking the whole height. The 12px under
       the list is gone: the slot's own 10px gap is the drawn distance between children. */
    .view-slot ::slotted(chat-repair-actions) {
      flex: 0 0 auto;
    }
    /* ONE SLOT, ONE VIEW AT A TIME. The slot can hold several views at once (the trace feed
       AND the eval feed are both slotted), and each rail tab shows only its own: everything is
       hidden by default, and the tab's class turns its view on. The trace tab renders its own
       fold branch above, so the trace feed is hidden here everywhere; the eval feed exists only
       under Evals; the repair rows belong to Approvals and their chat-top branch, nowhere else.
       A view shown under the wrong tab is the bug this fixes: Evals used to draw the trace feed
       because the slot had no idea which tab was looking. */
    .view-slot ::slotted(trace-feed) { display: none; }
    .view-slot ::slotted(eval-feed) { display: none; }
    .view-slot ::slotted(chat-repair-actions) { display: none; }
    .view-slot.tab-eval ::slotted(eval-feed) { display: block; }
    .view-slot.tab-approvals ::slotted(chat-repair-actions) { display: block; }
    .view-slot.tab-repair ::slotted(chat-repair-actions) { display: block; }
    /* A ROOM'S OWN VIEW, PER TAB — the same one-slot-one-view discipline as the tag
       rules above, made generic so the seat needs no room's names: the view declares its
       tab on itself (the view-tab attribute, e.g. view-tab="trace" — the attribute
       _viewSlotted reads) and only the active tab's claimant draws. Everything claiming a
       tab is hidden first; the two showing rules are the two tabs that have a claimant
       today — a room whose view declares another tab adds that pair the day the view
       exists. A view naming NO tab is not governed here: it is chat furniture, and
       _anyForeignViewAssigned is that door. */
    .view-slot ::slotted([view-tab]) { display: none; }
    .view-slot.tab-trace ::slotted([view-tab="trace"]) { display: block; }
    .view-slot.tab-tools ::slotted([view-tab="tools"]) { display: block; }
    /* THE SESSIONS TAB'S OWN OUTPUT — the panel draws this view itself (no slot, no
       mounting): <sessions-feed> reads its own feed and fills the column. */
    .sessions-out {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .sessions-out design-sessions-feed { flex: 1 1 auto; min-height: 0; }
    /* THE EVALS TAB'S VIEW — the same pair as the two above, for the tab whose view is the
       evaluators index (owner, 2026-10-17: *"you just take the exact information and stick
       it into the chat output — we'll design it later"*). */
    .view-slot.tab-eval ::slotted([view-tab="eval"]) { display: block; }
    /* THE DESIGN SEAT'S UX VIEW — REMOVED 2026-10-18 (owner, on the counters view: *"it's
       useless … a small, unnecessary vanity metric … no call to action or functionality tied to
       it"*). The rule stays because the tab stays: when the UX tab has a view of its own, this
       is the one line that draws it. */
    .view-slot.tab-ux ::slotted([view-tab="ux"]) { display: block; }
    /* THE EVALS VIEW PAINTS NO GROUND — the owner asked for it transparent (2026-09-24), so
       the drawing's ground reads through the column. Scoped to the eval tab: the chat and the
       other views keep the design's own sheet. */
    .panel.tab-eval { background: transparent; }
    .view-slot.tab-eval { background: transparent; }
    /* The trace fold holds the same slot; only the feed it names may draw there. */
    .fold-wrap ::slotted(eval-feed) { display: none; }
    .fold-wrap ::slotted(chat-repair-actions) { display: none; }
    /* …and only the view that NAMED the trace tab may draw there: it is the trace tab's
       hole, so a claimant of any other tab is hidden — the pair's other half. */
    .fold-wrap ::slotted([view-tab]:not([view-tab="trace"])) { display: none; }
    /* THE CHAT TAB CARRIES THE FINDINGS TOO — AND ONLY THE FINDINGS.
       The console must not open on a blank chat (owner, 2026-09-18: "I'm building a demo and
       I don't want blank chat to open up, so add it to the chat as well… just make sure it's
       collapsed by default"). It is the SAME slot the rail's tabs draw from — one element,
       two places, so the two can never disagree — and the filter is what keeps the chat
       honest: a TraceFeed slotted for a package's rail is not drawn above a package's thread.
       It sits inside the column's one scroller, so a long list scrolls the column instead of
       growing a second scrollbar, and the list itself arrives collapsed: the person opens it,
       and the thread stays the first thing they meet. */
    .chat-top {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 0 0 auto;
      padding: 10px 20px 0;
      background: var(--chat-bg, #FFFFFF);
    }
    .chat-top ::slotted(*) { display: none; }
    .chat-top ::slotted(chat-repair-actions) { display: block; }
    /* AND THE ROOMS' OWN VIEWS DRAW — the allow-list above is what keeps this hole to KNOWN
       views only (2026-10-03: the Product room's context strip was assigned, projected, and
       then hidden here — measured on the live page as a zero-sized element). A room's view
       joins the list the day the room exists, named, nothing else admitted.
       THE STRIP'S LINE IS GONE WITH THE STRIP (late 2026-10-03): the owner removed the
       catalogue chooser, so nothing foreign is assigned today — the next room's view joins
       this list the day it exists, the same rule as before. */
    /* THE FILED INSPECTIONS, UNDER APPROVALS — the governance reports as cards, not chat turns:
       the header in the header's cream, the attention rows in amber, the ok rows in green. */
    .inspection-reports { display: flex; flex-direction: column; gap: 8px; padding: 4px 10px 10px; }
    /* THE FOLDS ARE <chat-fold> NOW — the catalogue's 40px white dropdown tile, shared
       with the catalog check and the trace. What the panel adds is the margin around it. */
    .fold-wrap { margin: 4px 10px 8px; }
    .inspection-report {
      background: rgba(0, 0, 0, 0.03);
      border-left: 2px solid rgba(0, 0, 0, 0.12);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 13px;
      line-height: 1.5;
      color: #444444;
    }
    .inspection-report .line-head { color: #171717; font-weight: 700; margin-bottom: 2px; }
    .inspection-report .line-attention { color: #fbbf24; }
    .inspection-report .line-ok { color: #4ade80; }
    /* What an EMPTY view slot draws. The slot is filled by the surface, so an empty
       one means the surface has not put anything there yet — a state, not a blank.
       THE LINE IS THE FIRST LESSON, NOT A SPINNER. It used to read "Loading the X view…",
       which was untrue twice over: nothing is loading (the slot is filled by the surface,
       synchronously), and the person is looking at a demo whose whole point is to be
       explored empty (owner, 2026-09-18: "offer empty slots and offer advice in those
       slots… letting them know how Grace handles an empty prompt"). So an empty view says
       what the view IS and what would fill it. */
    .view-waiting {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #6B7280;
    }
    .view-empty { line-height: 1.5; }
    .view-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #D1D5DB;
      border-top-color: #1FACC2;
      border-radius: 50%;
      animation: view-spin 0.8s linear infinite;
    }
    @keyframes view-spin {
      to { transform: rotate(360deg); }
    }
    design-chat-action-bar { flex-shrink: 0; }
    design-chat-input { flex-shrink: 0; }
    design-chat-footer { flex-shrink: 0; }
    design-chat-plugin-tray { flex-shrink: 0; }
    /* A seat handed over by the host fills the column. The empty modifier is display:none rather
       than a zero-height box on purpose: an empty flex child with flex-grow would take the space
       the element's own pieces are supposed to have. */
    .seat { flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; }
    .seat.empty { display: none; }
    ::slotted(*) { flex: 1 1 auto; min-width: 0; min-height: 0; }
`;
