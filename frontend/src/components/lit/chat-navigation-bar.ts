/**
 * <chat-navigation-bar> — Lit A2UI web component
 *
 * Right column navigation bar with three tabs (Chat, Trace, Tools) and a
 * drag-to-resize gripper. Replaces the React SidebarNavigation + NavigationButton
 * components. Registered as a custom element for A2UI surface assembly.
 *
 * Features:
 *   - 3 tabs with inline SVG icons and labels
 *   - Active tab: yellow highlight (#FCCD3D), 77px height, icon shifts down
 *   - Gripper: drag handle at bottom dispatches right-column-drag-* events
 *   - Logo slot: <slot name="logo"> for AI-assigned branding
 *   - Collapse/expand: clicking active tab toggles collapsed state
 *   - CustomEvents: tab-change, collapse-toggle
 *
 * A2UI Catalog ID: chat-navigation-bar
 * Framework: Lit 3.x — no decorators, static properties + customElements.define()
 */

import { LitElement, html, css, nothing } from 'lit';

// ── The chat button's icon ─────────────────────────────────────────────────
// From Figma "chat-button" (node 40001010:25768), icon instance 40001012:26436
// — an instance of component "Machine-learning-model" (40000122:3412). The design
// ships this as VECTOR artwork now (38×38, one path, fill #1FACC2), so it is
// carried as its own SVG and stays crisp at whatever size the rail asks for.
//
// This REPLACES a raster that was imported here from node 40001010:25766. That
// node no longer exists in the file — the design was edited — so the provenance
// pointed at nothing, and the artwork behind it (a purple CPU chip) is no longer
// what this button draws. Re-pulled 2026-09-11; the render of 40001010:25768 is
// the reference: yellow frame, chat glyph, label in that same teal.
import chatButtonIcon from '@/assets/figma-chat-button-icon.svg';

// The trace button's icon, from Figma component "trace-button" (node
// 40001011:26266), icon instance 40001011:26260. Vector, not raster — it is an
// SVG INSTANCE of "Model--foundation", so it renders as its own artwork at any
// size. Read straight off the node's render.
//
// Artwork re-pulled 2026-09-11: the instance's vector is a single SOLID #1FACC2,
// so the asset's fill was updated to match (it previously carried a #2689D6 →
// #AC8CEC gradient — stale artwork from an earlier state of the file).
import traceButtonIcon from '@/assets/figma-trace-button-icon.svg';
import versionsButtonIcon from '@/assets/figma-versions-button-icon.svg';
import toolsButtonIcon from '@/assets/figma-tools-button-icon.svg';

// ═══════════════════════════════════════════════════════════════════════════════
// Types — exported for React consumers (InteractiveChatInterface.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

/** Valid tab identifiers. */
// The design draws FOUR rail buttons — chat, trace, versions, tools
// (#40001085:2666, :2762, :2731, :2634). `evaluation` and `metadata` were
// placeholders whose own panels said "design pending"; they came off the rail
// with the design, and `variables` became `versions` because that is what its
// panel actually renders.
// `approvals` is the CONSOLE's fourth button — Figma "approval-button"
// #40001088:2795. The rail is surface-dependent: Chat / Trace / Versions on both,
// Tools in the composer, Approvals on the console. The host chooses with
// `allowed-tabs`; this list is what is drawable.
export type TabId = 'chat' | 'trace' | 'versions' | 'tools' | 'approvals';

/** Detail payload for the 'tab-change' CustomEvent. */
export interface TabChangeEventDetail {
  tab: TabId;
}

/** Detail payload for the 'collapse-toggle' CustomEvent. */
export interface CollapseToggleEventDetail {
  collapsed: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab definition — icon, label, and tooltip
// ═══════════════════════════════════════════════════════════════════════════════

interface TabDef {
  id: TabId;
  label: string;
  tooltip: string;
  /**
   * The icon as the DESIGN drew it, when that tab's Figma node ships artwork — a
   * raster fill or an SVG instance. Takes precedence over svgPath.
   */
  iconSrc?: string;
  /**
   * The button as the DESIGN draws it. Per tab, because the two designs do NOT
   * share numbers yet: chat is 74 tall with a 38px icon at (18, 8); trace is still
   * 77 tall with a 42×39 icon at (16, 8). Same frame name in Figma, different
   * measurements — so they are read per node, never assumed to match.
   */
  box?: {
    /** The button's height. */
    h: number;
    iconW: number;
    iconH: number;
    /** The icon's position inside the button, as the design places it. */
    iconX: number;
    iconY: number;
    /** The label's top, inside the button. */
    labelY: number;
  };
  /**
   * Inline SVG path, for tabs with no exported artwork yet. Default viewBox is
   * 0 0 22.75 21.8752.
   */
  svgPath?: string;
  /**
   * Optional per-icon viewBox. The shared default (0 0 22.75 21.8752) is exactly
   * the chat glyph's own extent, so an icon drawn on a 24x24 grid gets clipped
   * by it. Set this when the path's coordinate space differs from the default.
   */
  viewBox?: string;
  /**
   * The Figma nodes this tab is drawn from. Carried through to the DOM as
   * `data-node-id` on the element that renders each one — Figma node → Lit
   * element, node for node — so a component found in a browser can be traced
   * back to the node, and a node back to the element. Absent for tabs that have
   * no designed counterpart yet.
   *
   *   nodeId      — the button itself (the Figma component node)
   *   iconNodeId  — the icon instance inside it
   *   labelNodeId — the text layer
   */
  nodeId?: string;
  iconNodeId?: string;
  labelNodeId?: string;
}

const TABS: TabDef[] = [
  {
    id: 'chat',
    label: 'Chat',
    tooltip: 'Chat with Grace',
    // Figma "chat-button" 40001010:25768 — component, frame "chat-menu-item"
    // 40001010:25749 inside it. Geometry comes from the container's constraint
    // (the :host block in this file), not from here — see the note there for why.
    // The artwork below supersedes the traced glyph under it, which is the same
    // glyph drawn on its own 22.75×21.8752 grid.
    nodeId: '40001010:25768',
    iconNodeId: '40001012:26436',
    labelNodeId: '40001010:25751',
    iconSrc: chatButtonIcon,
    // Speech bubble / branching chat icon, traced before the design shipped its
    // artwork. Unused while iconSrc is set; kept as the drawing of record.
    svgPath: 'M20.3125 13.2813C21.6566 13.2813 22.75 12.2299 22.75 10.9375C22.75 9.6451 21.6566 8.5937 20.3125 8.5937C19.2546 8.5937 18.3612 9.2488 18.0247 10.1563H13.3364L19.2683 4.4525C19.586 4.59898 19.9374 4.6875 20.3125 4.6875C21.6566 4.6875 22.75 3.63617 22.75 2.34375C22.75 1.05133 21.6566 0 20.3125 0C18.9684 0 17.875 1.05133 17.875 2.34375C17.875 2.70461 17.9672 3.04219 18.1192 3.34781L11.375 9.8328V4.68758C11.375 3.82625 12.1038 3.12508 13 3.12508H14.625V1.56258H13C12.0248 1.56258 11.1588 1.98641 10.5625 2.6425C9.9662 1.98641 9.1002 1.56258 8.125 1.56258H7.3125C3.28055 1.56258 0 4.71656 0 8.5938V13.2813C0 17.1586 3.28055 20.3126 7.3125 20.3126H8.125C9.1002 20.3126 9.9662 19.8887 10.5625 19.2327C11.1588 19.8887 12.0248 20.3126 13 20.3126H14.625V18.7501H13C12.1038 18.7501 11.375 18.0489 11.375 17.1876V12.0423L18.1192 18.5273C17.9672 18.8329 17.875 19.1705 17.875 19.5314C17.875 20.8238 18.9684 21.8752 20.3125 21.8752C21.6566 21.8752 22.75 20.8238 22.75 19.5314C22.75 18.239 21.6566 17.1877 20.3125 17.1877C19.9374 17.1877 19.5861 17.2762 19.2683 17.4227L13.3364 11.7189H18.0247C18.3612 12.6264 19.2546 13.2813 20.3125 13.2813Z',
  },
  // The TRACE tab was removed 2026-09-17: the trace view is not being built. The
  // information it showed lived in the retired React seat
  // (retired-files/console-seat-20260917/InteractiveChatInterface.tsx) and the
  // decision is not to load it. A rail button whose view will never exist is a
  // control that can only fail, so it is gone rather than left dangling.
  {
    id: 'trace',
    label: 'Trace',
    tooltip: 'Execution trace and evaluation',
    // Figma "trace-button" 40001011:26266 — the rail's second button, restored
    // 2026-09-17. It was deleted an hour earlier on a misreading of "the trace
    // information is not being loaded": that is about the VIEW, not the button. A
    // rail tab is a view switch, and the panel's view is a SLOT — the design calls
    // it chat-output-simple-slot-area, and anything can be injected into it.
    //
    // The hand-traced `svgPath` that used to sit here as the drawing of record is
    // NOT restored: the original string is not recoverable from git, whose version
    // of this file predates the working tree. `iconSrc` is the design's own
    // artwork and is what renders; the traced fallback was unused while it was set.
    nodeId: '40001011:26266',
    iconNodeId: '40001011:26260',
    labelNodeId: '40001011:26259',
    iconSrc: traceButtonIcon,
  },
  {
    id: 'versions',
    label: 'Versions',
    tooltip: 'Version history for this session',
    iconSrc: versionsButtonIcon,
    // Figma "versions-button" #40001085:2731 — the fourth rail button. Label is
    // Versions, not Variables: the tab renders the session's version history.
    svgPath: 'M9.4 22C7.6 22 6.4 21.2 5.6 19.5C5.3 18.8 5 18.2 4.5 17.7C4 17.2 3.5 16.9 2.8 16.7L2 16.4V14.4L3.2 14.7C4.3 15 5.2 15.6 5.9 16.4C6.6 17.2 7.1 18.1 7.5 19.1C7.9 19.9 8.3 20.2 9.4 20.2H10V22H9.4ZM14.6 22C12.8 22 11.6 21.2 10.8 19.5C10.5 18.8 10.2 18.2 9.7 17.7C9.2 17.2 8.7 16.9 8 16.7L7.2 16.4V14.4L8.4 14.7C9.5 15 10.4 15.6 11.1 16.4C11.8 17.2 12.3 18.1 12.7 19.1C13.1 19.9 13.5 20.2 14.6 20.2H15.2V22H14.6ZM5.5 11H18.5V9H5.5V11ZM5.5 7H18.5V5H5.5V7Z',
  },
  {
    id: 'tools',
    label: 'Tools',
    tooltip: 'Tool registry and usage',
    iconSrc: toolsButtonIcon,
    // Figma "tools-button" #40001085:2634 — the fifth rail button, which was the
    // old trace-button set until the design renamed it.
    // Wrench / tools icon — Material Design "build". Drawn on a 24x24 grid, so
    // it declares its own viewBox; the shared default would clip its handle.
    viewBox: '0 0 24 24',
    svgPath: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    tooltip: 'Pending approvals',
    // Figma "approval-button" #40001088:2795 — the CONSOLE rail's fourth button.
    //
    // The artwork is the TRACE glyph: the design's variant carries
    // "Model-trace" (40000122:3408), instance node I40001088:2797;40001011:26260,
    // which is the same icon the Trace button uses. Read verbatim rather than
    // substituted — but if Approvals is meant to have its own mark, the design
    // needs to draw one, because right now the two buttons read identically.
    nodeId: '40001088:2795',
    iconNodeId: '40001088:2797;40001011:26260',
    labelNodeId: '40001088:2797;40001011:26259',
    iconSrc: traceButtonIcon,
    svgPath: 'M23.07 15.6777V4.11016C24.0271 3.81716 24.7178 3.04006 24.7178 2.12013C24.7178 0.951022 23.6091 0 22.2461 0C20.883 0 19.7742 0.951022 19.7742 2.12013C19.7742 2.39688 19.8406 2.6595 19.9533 2.90176L12.3589 8.60167L4.76457 2.90204C4.87736 2.65943 4.94356 2.39688 4.94356 2.12013C4.94356 0.951022 3.83479 0 2.47179 0C1.10877 0 0 0.951022 0 2.12013C0 3.04013 0.690785 3.81723 1.64785 4.10981V15.678C0.690785 15.9707 0 16.7478 0 17.6677C0 18.8368 1.10877 19.7878 2.47179 19.7878C3.83479 19.7878 4.94356 18.8368 4.94356 17.6677C4.94356 17.1967 4.75757 16.7653 4.45317 16.413L8.84758 13.1148L10.7957 16.0389C10.2456 16.4282 9.88716 17.0096 9.88716 17.6677C9.88716 18.8368 10.9959 19.7878 12.3589 19.7878C13.722 19.7878 14.8306 18.8368 14.8306 17.6677C14.8306 17.0096 14.4721 16.4282 13.9221 16.0389L15.8702 13.1148L20.2646 16.413C19.9603 16.7653 19.7742 17.1967 19.7742 17.6677C19.7742 18.8368 20.883 19.7878 22.2461 19.7878C23.6091 19.7878 24.7178 18.8368 24.7178 17.6677C24.7178 16.7478 24.0271 15.9707 23.07 15.6777Z',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export class ChatNavigationBar extends LitElement {
  // ── Reactive properties (static getter — no decorators) ──────────────────
  static properties = {
    activeTab: { type: String, attribute: 'active-tab' },
    collapsed: { type: Boolean },
    allowedTabs: { type: String, attribute: 'allowed-tabs' },
    healthCount: { type: Number, attribute: 'health-count' },
    healthState: { type: String, attribute: 'health-state' },
  };

  // ── Defaults ─────────────────────────────────────────────────────────────
  declare activeTab: TabId;
  declare collapsed: boolean;
  /**
   * Open catalog findings. When above zero the chat tab's ICON pulses red, so
   * the condition is visible on arrival. Set by InteractiveChatInterface from
   * the catalog check (/api/catalog/audit). Zero means quiet.
   */
  declare healthCount: number;
  /**
   * Whether the count can be trusted.
   *   'ok'      — the check ran; healthCount is real
   *   'loading' — not fetched yet; say nothing
   *   'unknown' — the check could not run. This must NEVER render the same as an
   *               open finding: "cannot check" and "one problem" are different
   *               claims, and collapsing them makes a broken pipeline look calm.
   */
  declare healthState: 'ok' | 'loading' | 'unknown';
  /**
   * Comma-separated list of tab IDs to show, filtered by the user's
   * departmental role. Set by InteractiveChatInterface from the
   * /api/ai/role-capabilities response.
   * If unset, all tabs are shown (backwards-compatible dev default).
   */
  declare allowedTabs: string;

  constructor() {
    super();
    this.activeTab = 'chat';
    this.collapsed = false;
    this.allowedTabs = '';
    this.healthCount = 0;
    this.healthState = 'loading';
  }

  // ── Drag state (not reactive — no re-render needed) ──────────────────────
  private _previousTab: TabId | '' = '';

  // ── Shadow DOM styles — pixel-identical to original compiled component ──
  static styles = css`
    :host {
      /* ── THE RAIL'S CONSTRAINT ON A DESIGNED BUTTON ─────────────────────────
         Ingestion may be inconsistent — nodes get hand-placed, sizes drift. The
         CATALOGUE may not be. So the common constraint lives here, on the
         container, and every designed button inside this rail inherits it by the
         cascade rather than each one carrying its own numbers.

         A button can still override any of these, but it now has to SAY SO (a
         per-tab box override), so an override is a visible exception in a diff
         instead of an invisible difference in a rail. That is the whole point:
         the buttons cannot disagree by accident, only on purpose.

         Values read from Figma "chat-button" (40001010:25768). The trace node
         (40001011:26266) carries different numbers; that is drift, not intent, and
         the geometry-drift check reports it rather than copying it. */
      --nb-h: 74px;
      --nb-icon-w: 38px;
      --nb-icon-h: 38px;
      --nb-icon-x: 18px;
      --nb-icon-y: 8px;
      --nb-label-y: 46px;
      display: block;
      height: 100%;
      /* Figma "chat-main-menu-vert" #40001066:4301 — width 74. */
      width: 74px;
      flex-shrink: 0;
    }

    .sb {
      display: flex;
      flex-direction: column;
      align-items: center;
      /* Figma "chat-main-menu-vert" #40001066:4301 — gap 10 between the logo and
         each button. The code stacked them flush, so every button sat 10px high. */
      gap: 10px;
      height: 100%;
      width: 74px;
      /* Figma "chat-main-menu-vert" #40001066:4301, verbatim: radius 10px 0 0 0,
         shadow -4px 4px 10px rgba(0,0,0,.25), "blue gradient" at 181deg. */
      border-radius: 10px 0px 0px 0px;
      box-shadow: -4px 4px 10px 0px rgba(0, 0, 0, 0.25);
      background-image: linear-gradient(
        181deg,
        rgba(28, 47, 78, 1) 0%,
        rgba(27, 80, 145, 1) 38%,
        rgba(13, 48, 91, 1) 100%
      );
      overflow: hidden;
    }

    /* ── Logo section ─────────────────────────────────────────────────── */
    .lo {
      display: flex;
      flex-direction: column;
      height: 66px;
      width: 100%;
      /* Figma "logo-of-chat-model-slected" #40001085:2680 — 74×66 with px 3px,
         so the mark itself is 68 wide. The slot was stretching the artwork to
         the full 74×66 with object-fit: cover. */
      padding: 0 3px;
      box-sizing: border-box;
      overflow: clip;
      flex-shrink: 0;
      align-items: flex-start;
    }
    .lc {
      height: 65.984px;
      width: 100%;
      position: relative;
      flex-shrink: 0;
    }
    .lp {
      position: absolute;
      inset: 0;
      background: rgb(55, 65, 81);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      font-family: 'Inter', system-ui, sans-serif;
    }
    /* The mark as the design draws it: 68×58, centred in the 74×66 slot. */
    ::slotted(img) {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      max-width: none;
      object-fit: contain;
      pointer-events: none;
      width: 68px;
      height: 58px;
    }

    /* ── Tab button ───────────────────────────────────────────────────── */
    .nb {
      /* Inherit — a shadow-root <button> otherwise falls back to the UA font (Arial). */
      font-family: inherit;
      position: relative;
      flex-shrink: 0;
      width: 100%;
      height: 67px;
      transition: background-color 0.2s, height 0.2s;
      border: none;
      background: none;
      cursor: pointer;
      padding: 0;
    }
    .nb:hover {
      background: rgb(252, 205, 61);
      height: 77px;
    }
    .na {
      background: rgb(252, 205, 61);
      height: 77px;
    }

    /* ── Icon wrapper ─────────────────────────────────────────────────── */
    .ni {
      position: absolute;
      height: 47px;
      left: 7.42px;
      top: 10px;
      width: 67.58px;
      transition: top 0.2s;
    }
    .ns,
    .nb:hover .ni,
    .na .ni {
      top: 15px;
    }
    .iw {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      left: 17px;
      top: 1px;
      width: 26px;
    }
    .ic {
      height: 25px;
      overflow: clip;
      width: 100%;
      position: relative;
      flex-shrink: 0;
    }

    /* ── SVG layers ───────────────────────────────────────────────────── */
    .nm {
      position: absolute;
      inset: 0;
      mix-blend-mode: multiply;
      display: block;
      width: 100%;
      height: 100%;
    }
    .nsv {
      position: absolute;
      inset: 6.25%;
      display: block;
      width: 87.5%;
      height: 87.5%;
    }

    /* ── Label ────────────────────────────────────────────────────────── */
    .lw {
      position: absolute;
      display: flex;
      flex-direction: column;
      height: 16px;
      align-items: flex-start;
      justify-content: center;
      left: 0;
      top: 31px;
      width: 100%;
      transition: top 0.2s;
    }
    .ls,
    .nb:hover .lw,
    .na .lw {
      top: 33px;
    }
    .lt {
      height: 20px;
      position: relative;
      flex-shrink: 0;
      width: 100%;
      font-family: 'Inter', system-ui, sans-serif;
      font-weight: 700;
      font-style: normal;
      font-size: 13px;
      line-height: 20px;
      text-align: center;
      white-space: nowrap;
      color: rgb(78, 207, 213);
      display: block;
    }
    .nb:not(:hover):not(.na) .lt {
      font-weight: 500;
    }

    /* ── The designed menu item — geometry per tab, from the node ────────────
       Every measurement arrives as a custom property set on the button, because
       these two designs do NOT share numbers: chat is 74 tall with a 38×38 icon at
       (18, 8) and its label at y=46; trace is 77 tall with a 42×39 icon at (16, 8)
       and its label at y=53. Same frame name in Figma, different measurements.

       The calcs subtract .ni's own origin (left 7.42, top 10), so the numbers in
       TABS read as the numbers in Figma rather than as offsets against a nested box.

       The bar's other tabs rest at 67px and grow to 77 on hover/selected, and .ni
       slides down 5px with them. A designed button has one size and no slide, so
       both are pinned here instead of inherited. */
    .nb.nbc,
    .nb.nbc:hover,
    .nb.nbc.na {
      height: var(--nb-h, 74px);
    }
    .nb.nbc .ni,
    .nb.nbc:hover .ni,
    .nb.nbc.na .ni {
      top: 10px;
    }
    .nb.nbc .iw {
      left: calc(var(--nb-icon-x, 18px) - 7.42px);
      top: calc(var(--nb-icon-y, 8px) - 10px);
      width: var(--nb-icon-w, 38px);
    }
    .nb.nbc .ic {
      height: var(--nb-icon-h, 38px);
    }
    .nb.nbc .lw,
    .nb.nbc .ls,
    .nb.nbc:hover .lw,
    .nb.nbc.na .lw {
      top: calc(var(--nb-label-y, 46px) - 10px);
    }
    /* Sized from the same properties as its wrapper, so the artwork and the box
       can never disagree. object-fit is contain, not fill: the two icons are
       different artwork at different aspect ratios (chat's 38×38 glyph, trace's
       42×39), and forcing them into one box without it would stretch one of
       them. */
    .nci {
      display: block;
      width: var(--nb-icon-w, 38px);
      height: var(--nb-icon-h, 38px);
      object-fit: contain;
      pointer-events: none;
    }
    /* The label's colour, straight off the node: #1FACC2 — the same value the
       icon's vector carries, so the glyph and its word read as one mark.

       This corrects #3D8DDE, which the source claimed was "the design's label
       blue". It appears nowhere in the file, on this node or any other — an
       invention wearing the designer's authority, which is the exact thing the
       provenance rule exists to stop. Figma 40001010:25768, text node
       40001010:25751: fill #1FACC2, Inter Bold 700 / 13px / 20px. */
    .nb.nbc .lt {
      color: #1FACC2;
    }
    /* Figma "chat-button" state=Selected #40001085:2663 — the inset the registry
       has carried as "not yet in CSS": inset 0 4px 4px rgba(0,0,0,0.25).
       ONLY Selected carries it. state=Hover is the same yellow with no inset. */
    .nb.nbc.na {
      box-shadow: inset 0 4px 4px 0 rgba(0, 0, 0, 0.25);
    }

    /* ── Selected vs closed — from the annotation, verbatim ──────────────────
       "Chat button selected: it's yellow when it's selected and it's transparent
       when the chat is closed and it's not selected."

       So closed-and-unselected is just transparent — the design's state=Default.
       NOTHING MOVES. This used to pulse the whole button; that pulse was never in
       the design (it was marked "inferred" in registry.json), and drawing the
       states settled it: a resting state that moves reads as an alert, and the
       design already spends motion on state=Alert. */
    .nb.nbc.nb-closed {
      background: none;
    }
    .nb.nbc.nb-closed:hover {
      background: rgb(252, 205, 61);
    }

    /* ── Tooltip ──────────────────────────────────────────────────────── */
    .tt {
      position: absolute;
      left: 100%;
      margin-left: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: rgb(188, 203, 206);
      color: #000;
      padding: 8px 12px;
      border-radius: 4px;
      box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.25);
      white-space: nowrap;
      font-size: 10pt;
      font-family: 'Inter', system-ui, sans-serif;
      font-weight: 400;
      z-index: 50;
    }
    .ta {
      position: absolute;
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      width: 0;
      height: 0;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
      border-right: 4px solid rgb(188, 203, 206);
    }

    /* Catalog health marker — visible on arrival, silent when the count is 0.
       There is no separate dot laid over the icon any more: the ICON itself
       pulses, so the signal rides the thing the person is already looking at. */
    /* The DESIGNED alert — Figma "chat-button" state=Alert #40001085:2662, whose
       Builder block is the spec: fade to blank and back, 400ms, infinite, until
       the findings clear. The BUTTON fades, not just its glyph, so "blank" means
       the whole control goes — which is what makes it findable in a 74px rail. */
    .nb.hb-on {
      animation: chat-alert-pulse 400ms ease-in-out infinite;
    }
    @keyframes chat-alert-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    /* "The check could not run" is a DIFFERENT claim from "one problem", and the
       design has no state for it. It keeps the older, slower, partial fade and
       rides the GLYPH alone, so the two can never be read as each other. */
    .nb.hb-x .nsv {
      animation: hb-pulse 1.1s ease-in-out infinite;
    }
    /* No red. The colour follows the BACKGROUND, not the state: on the yellow
       active tab the icon goes dark blue, so it stays legible instead of
       washing out; off the yellow it keeps the lime it already uses.
       The PULSE is the signal — the colour is only there to stay readable on
       whatever the tab happens to be sitting on. */
    .nb.hb-on .nsv path,
    .nb.hb-x .nsv path { fill: #4ECFD5; }

    .nb.na.hb-on .nsv path,
    .nb.na.hb-x .nsv path { fill: #1c2f4e; }
    @keyframes hb-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    @media (prefers-reduced-motion: reduce) {
      /* The Alert note, verbatim: with the motion off, hold a visible alert look
         rather than a blank — the glyph tint below IS the signal when the fade
         cannot be. */
      .nb.hb-on,
      .nb.hb-x .nsv { animation: none; }
    }
    /* The marker is a signal, not decoration — so it is still announced even
       though it is no longer shown. Visually hidden, screen-reader audible. */
    .hb-sr {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }


  `;

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab click handler
  // ═══════════════════════════════════════════════════════════════════════════

  private _handleTabClick(tabId: TabId) {
    // If clicking the already-active tab: toggle collapse
    if (tabId === this.activeTab && !this.collapsed) {
      this.collapsed = true;
      this._previousTab = this.activeTab;
      this.activeTab = '' as TabId;
      this.dispatchEvent(
        new CustomEvent<CollapseToggleEventDetail>('collapse-toggle', {
          detail: { collapsed: true },
          bubbles: true,
          composed: true,
        })
      );
      this.dispatchEvent(
        new CustomEvent<TabChangeEventDetail>('tab-change', {
          detail: { tab: '' as TabId },
          bubbles: true,
          composed: true,
        })
      );
      return;
    }

    // If collapsed: expand to the clicked tab
    if (this.collapsed) {
      this.collapsed = false;
    }

    // Set the active tab
    const prev = this.activeTab;
    this.activeTab = tabId;

    // Dispatch events
    this.dispatchEvent(
      new CustomEvent<TabChangeEventDetail>('tab-change', {
        detail: { tab: tabId },
        bubbles: true,
        composed: true,
      })
    );

    if (this.collapsed === false && (prev as string) === '') {
      this.dispatchEvent(
        new CustomEvent<CollapseToggleEventDetail>('collapse-toggle', {
          detail: { collapsed: false },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Health marker
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * The chat tab's health marker. Three conditions, three different renderings —
   * the point is that a person can tell them apart at a glance:
   *
   *   findings open            → the icon pulses red
   *   the check could not run  → the icon pulses amber
   *   clean, or still loading  → nothing
   *
   * These used to share one "!" because the caller passed 1 as a sentinel for
   * "not ok". So a checker that never ran looked like a single open finding, and
   * the label asserted a count that was not true.
   *
   * The marker now rides the icon instead of a dot laid over it — no second
   * element to keep in register with the first, and the signal sits on the thing
   * the person is already looking at.
   */
  private _healthClass(): '' | 'hb-on' | 'hb-x' {
    if (this.healthState === 'unknown') return 'hb-x';
    if (this.healthState === 'ok' && this.healthCount > 0) return 'hb-on';
    return '';
  }

  /**
   * The same three states, spoken. The marker is a signal, not decoration, so
   * hiding it visually must not silence it — a screen reader still hears the
   * fact, and the count with it.
   */
  private _healthStatus() {
    if (this.healthState === 'unknown') {
      return html`<span class="hb-sr" role="status">The catalog check did not run. This is not a clean result.</span>`;
    }
    if (this.healthState === 'ok' && this.healthCount > 0) {
      return html`<span class="hb-sr" role="status">${this.healthCount} open catalog findings</span>`;
    }
    return '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  render() {
    const currentTab = this.activeTab;

    // Filter tabs by role — if allowedTabs is set, only show those.
    // If unset (dev mode / no role), show all (backwards-compatible).
    // A set that matches no known tab would render an empty bar, and an empty bar
    // reads as "the nav bar is broken", not "this role has no tabs" — fail open.
    const allowed = this.allowedTabs
      ? this.allowedTabs.split(',').map((id) => id.trim()).filter(Boolean)
      : [];
    const filtered = allowed.length
      ? TABS.filter((tab) => allowed.includes(tab.id))
      : TABS;
    const visibleTabs = filtered.length ? filtered : TABS;

    return html`
      <div class="sb">
        <!-- Logo -->
        <div class="lo">
          <div class="lc">
            <slot name="logo">
              <div class="lp">LOGO</div>
            </slot>
          </div>
        </div>

        <!-- Tab buttons (role-filtered) -->
        ${visibleTabs.map(
          (tab) => html`
            <button
              type="button"
              data-node-id=${tab.nodeId ?? nothing}
              class="nb ${tab.iconSrc ? 'nbc' : ''} ${currentTab === tab.id ? 'na' : ''} ${tab.id === 'chat' ? this._healthClass() : ''} ${tab.id === 'chat' && this.collapsed ? 'nb-closed' : ''}"
              style=${tab.box
                ? `--nb-h: ${tab.box.h}px; --nb-icon-w: ${tab.box.iconW}px; --nb-icon-h: ${tab.box.iconH}px; --nb-icon-x: ${tab.box.iconX}px; --nb-icon-y: ${tab.box.iconY}px; --nb-label-y: ${tab.box.labelY}px`
                : ''}
              @click=${() => this._handleTabClick(tab.id)}
              title="${tab.tooltip}"
            >
              ${tab.id === 'chat' ? this._healthStatus() : ''}
              <div class="ni ${currentTab === tab.id ? 'ns' : ''}">
                <div class="iw">
                  <div class="ic">
                    <!-- A tab with exported artwork renders the design's own icon;
                         the rest keep the mask + glyph pair. -->
                    ${tab.iconSrc
                      ? html`<img class="nci" src=${tab.iconSrc} alt="" data-node-id=${tab.iconNodeId ?? nothing} />`
                      : html`
                        <!-- Monochrome mask layer -->
                        <svg class="nm" fill="none" viewBox="0 0 26 25">
                          <path d="M26 0H0V25H26V0Z" fill="white" fill-opacity="0.01" />
                        </svg>
                        <!-- Colored icon -->
                        <svg class="nsv" fill="none" viewBox="${tab.viewBox ?? '0 0 22.75 21.8752'}">
                          <path fill="#4ECFD5" d="${tab.svgPath}" />
                        </svg>
                      `}
                  </div>
                </div>
                <div class="lw ${currentTab === tab.id ? 'ls' : ''}">
                  <span class="lt" data-node-id=${tab.labelNodeId ?? nothing}>${tab.label}</span>
                </div>
              </div>
            </button>
          `
        )}

        <!-- No resize grip here. The design draws it as "chat-left-spacer"
             #40001085:1406 — a 20px strip on the chat column's left edge — and
             <workspace-layout> renders it. The rail's own dot-grid grip went with
             it, along with the right-column-drag-* events it was the only emitter
             of; nothing ever listened for those. -->
      </div>
    `;
  }
}

// ── Register custom element ──────────────────────────────────────────────────
customElements.define('chat-navigation-bar', ChatNavigationBar);

// ── JSX type declaration for React/TypeScript consumers ─────────────────────
declare global {
  interface HTMLElementTagNameMap {
    'chat-navigation-bar': ChatNavigationBar;
  }
}

// Extend JSX intrinsic elements so <chat-navigation-bar> is recognized in TSX
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-navigation-bar': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatNavigationBar> & {
          'active-tab'?: TabId | '';
          /**
           * Lit declares this as `{ type: Boolean }`. React 19 sets the
           * matching *property* on the element, so a real boolean is correct
           * here — never the string "false", which Lit's boolean converter
           * would read as true (any non-null attribute value is truthy).
           * `'' | boolean` matches the convention used by the sibling Lit
           * components (prompt-section-editor, workspace-layout, ...).
           */
          collapsed?: '' | boolean;
          'allowed-tabs'?: string;
          'health-count'?: number | string;
          'health-state'?: 'ok' | 'loading' | 'unknown';
          ref?: React.Ref<ChatNavigationBar>;
        },
        ChatNavigationBar
      >;
    }
  }
}
