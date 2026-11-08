/**
 * design-tabs — THE DESIGN ROOM'S SLOT COORDINATOR.
 *
 * One host, four physical panes. The chat, tools, ux and approve seat elements are supplied by
 * the A2UI surface as children; this element never creates them, never copies them and never
 * chooses their package. It shows exactly one pane and hides the other three.
 *
 * The rail is the one component in the room that knows a tab was pressed. It is the existing
 * design-chat-navigation-bar; this host listens to its `tab-change` and moves the visible pane.
 * The seat elements' own rails are hidden by the surface's `hideNav` binding, so the room has
 * one rail and four panes.
 */
import { LitElement, html, css } from 'lit';
import '@/rooms/design/chat/parts/design-chat-navigation-bar';

const TABS = ['chat', 'tools', 'ux', 'approve'] as const;
type Tab = (typeof TABS)[number];

export class DesignTabs extends LitElement {
  static properties = {
    /** WHICH PANE STANDS. Bound from the surface; one of the four. */
    activeTab: { type: String, attribute: 'active-tab' },
  };

  declare activeTab: string;

  static styles = css`
    :host {
      display: flex;
      flex: 1 1 0%;
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }
    .room {
      display: flex;
      flex: 1 1 0%;
      min-width: 0;
      min-height: 0;
      height: 100%;
    }
    .panes {
      display: flex;
      flex: 1 1 0%;
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }
    .pane {
      display: block;
      flex: 1 1 0%;
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }
    .pane[hidden] {
      display: none;
    }
    slot {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  constructor() {
    super();
    this.activeTab = 'chat';
  }

  private _onTabChange = (event: Event): void => {
    const raw = String((event as CustomEvent<{ tab?: string }>).detail?.tab || '');
    /* THE EMPTY DETAIL IS THE RAIL'S COLLAPSE, not a tab. Nothing moves. */
    if (!raw) return;
    const next = raw === 'approvals' ? 'approve' : raw;
    if (!(TABS as readonly string[]).includes(next)) {
      throw new Error(`design-tabs received a tab it does not own: ${raw}`);
    }
    this.activeTab = next;
  };

  render() {
    if (!(TABS as readonly string[]).includes(this.activeTab)) {
      throw new Error(
        `A2UI Data Violation: design-tabs activeTab is "${this.activeTab}", which is not one of ${TABS.join(', ')}.`,
      );
    }
    const active = this.activeTab;
    return html`
      <div class="room">
        <design-chat-navigation-bar
          active-tab=${active === 'approve' ? 'approvals' : active}
          allowed-tabs="chat,tools,approvals,ux"
          @tab-change=${this._onTabChange}
        ></design-chat-navigation-bar>
        <div class="panes">
          <section class="pane" data-tab="chat" ?hidden=${active !== 'chat'}>
            <slot name="chat"></slot>
          </section>
          <section class="pane" data-tab="tools" ?hidden=${active !== 'tools'}>
            <slot name="tools"></slot>
          </section>
          <section class="pane" data-tab="ux" ?hidden=${active !== 'ux'}>
            <slot name="ux"></slot>
          </section>
          <section class="pane" data-tab="approve" ?hidden=${active !== 'approve'}>
            <slot name="approve"></slot>
          </section>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('design-tabs')) customElements.define('design-tabs', DesignTabs);
