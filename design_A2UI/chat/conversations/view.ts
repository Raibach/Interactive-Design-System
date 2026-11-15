/**
 * THE CONVERSATIONS' VIEW — the card's bar, the new mark, the rows and the note.
 *
 * The conversation place of the conversation/messages/input extraction named in RULES.md. The
 * markup leaves the seat; the rows are still built by the seat (the list read and the remove are
 * its actions), so the view takes them as content. The card's chrome — the icon, the node ids,
 * the copy — is this place's own.
 */
import { html, nothing, type TemplateResult } from 'lit';
import historyIcon from '@/assets/figma-chat-history-icon.svg';
import '../parts/design-chat-header';

export interface ConversationsViewValues {
  statusText: string;
  open: boolean;
  note: string;
  rows: TemplateResult | TemplateResult[] | typeof nothing;
  onToggle: (e: Event) => void;
  onKey: (e: KeyboardEvent) => void;
  onNew: () => void;
}

export const conversationsView = (v: ConversationsViewValues): TemplateResult => html`
  <design2-chat-header
    data-slot="conversations"
    status-text=${v.statusText}
    role="button"
    tabindex="0"
    aria-expanded=${v.open ? 'true' : 'false'}
    aria-label="Show this package's conversations"
    icon=${historyIcon}
    icon-node="40001123:6745"
    icon-size="22"
    block-node="40001119:6317"
    bar-node="40001119:6318"
    text-node="40001123:6744"
    grip-node="40001126:2014"
    grip-row-node="40001126:2015"
    grip-dots="40001126:2016,40001126:2017,40001126:2018,40001126:2019,40001126:2020"
    dm-sans
    ?open=${v.open}
    @click=${v.onToggle}
    @keydown=${v.onKey}
  >
    <button
      slot="bar-actions"
      class="conv-new"
      type="button"
      title="New conversation"
      aria-label="New conversation"
      @click=${(e: Event) => {
        e.stopPropagation();
        v.onNew();
      }}
    >+</button>
    <ul class="conversation-list">${v.rows}</ul>
    ${v.note ? html`<p class="conv-note" role="status">${v.note}</p>` : nothing}
  </design2-chat-header>
`;
