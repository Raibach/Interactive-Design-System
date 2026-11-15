/**
 * THE RAIL'S VIEW — the navigation bar and the one logo it carries.
 *
 * The second extraction of the behavior split named in RULES.md: the rail's markup leaves the
 * seat. It takes values and callbacks and returns the template; it owns no state and answers
 * nothing itself. The seat still answers the two events, because the tab press and the collapse
 * are the seat's actions in this pass.
 */
import { html, type TemplateResult } from 'lit';
import '@design2/surface-design/surface/rail/navigation-bar';
import logoAsset from '@/components/lit/assets/chat-logo-carbon.svg';

export interface RailViewValues {
  activeTab: string;
  railOwnedByHost: boolean;
  allowedTabs: string;
  tabLabels?: string;
  disabledTabs?: string;
  collapsed: boolean;
  unread: boolean;
  approvalWaiting: boolean;
  onTabChange: (e: Event) => void;
  onCollapseToggle: (e: Event) => void;
}

export const railView = (v: RailViewValues): TemplateResult => html`
  <design2-chat-navigation-bar
    active-tab=${v.activeTab}
    ?rail-owned-by-host=${v.railOwnedByHost}
    allowed-tabs=${v.allowedTabs}
    tab-labels=${v.tabLabels}
    disabled-tabs=${v.disabledTabs}
    ?collapsed=${v.collapsed}
    ?unread=${v.unread}
    ?approval-waiting=${v.approvalWaiting}
    @tab-change=${v.onTabChange}
    @collapse-toggle=${v.onCollapseToggle}
  >
    <img slot="logo" src=${logoAsset} width="50" height="50" alt="Grace" />
  </design2-chat-navigation-bar>
`;
