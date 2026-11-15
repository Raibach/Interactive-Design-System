/**
 * THE RAIL'S TAB PRESS — navigation, and, on a room-owned rail, only an announcement.
 *
 * The press is the room's navigation, not a switch inside the seat: when the host owns the rail,
 * the seat keeps its tab, its conversation and its thread, and says what happened. When the seat
 * owns the rail, the press switches the view and, for a tab with its own conversation, switches
 * which conversation the seat reads. An empty tab is the rail collapsing itself.
 */
const TRACE_PROMPT =
  'Load the latest activity and report tokens, cost, latency and evaluation for this session.';

export interface RailTabHost {
  collapsed: boolean;
  railOwnedByHost: boolean;
  activeTab: string;
  conversations?: Array<{ id?: string | null; tab?: string | null }>;
  conversationId?: string | null;
  messages: unknown[];
  _local: unknown[];
  tracePrompt?: boolean;
  dispatchEvent(event: Event): boolean;
  _send(text: string): Promise<void>;
}

export const tabChangeAction = (host: RailTabHost, e: Event): void => {
  const tab = String((e as CustomEvent).detail?.tab ?? '');
  if (!tab) {
    host.collapsed = true;
    return;
  }
  host.collapsed = false;
  if (host.railOwnedByHost) {
    host.dispatchEvent(
      new CustomEvent('tab-change', {
        detail: { tab },
        bubbles: true,
        composed: true,
      }),
    );
    return;
  }
  host.activeTab = tab;
  const list = host.conversations ?? [];
  const match = list.find((c) => String(c.tab || 'chat') === tab)
    ?? list.find((c) => String(c.tab || 'chat') === 'chat');
  if (match && match.id && String(match.id) !== host.conversationId) {
    host.messages = [];
    host._local = [];
    host.conversationId = String(match.id);
  }
  if (tab === 'trace' && host.tracePrompt) void host._send(TRACE_PROMPT);
  host.dispatchEvent(
    new CustomEvent('tab-change', {
      detail: { tab },
      bubbles: true,
      composed: true,
    }),
  );
};
