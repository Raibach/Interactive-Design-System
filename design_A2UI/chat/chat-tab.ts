/**
 * <design2-chat-tab> — THE CHAT TAB'S OWN PAGE.
 *
 * The same seat as `<design2-chat>` with one different source. Every behaviour lives in
 * `./design-chat-seat`; this file names the element and states which conversation file the seat
 * reads.
 *
 * ITS SOURCE IS THE CONSOLE'S. The Chat tab shows the same home the top Design tab shows, so it
 * reads `./console-conversations` and binds the console's package — not the separate chat package,
 * which is not a second source for this room and holds none of the console's conversations.
 */
import { DesignChatSeat } from './design-chat-seat';

export class ChatTab extends DesignChatSeat {
  constructor() {
    super();
    this.conversationSource = 'console';
  }
}

if (!customElements.get('design2-chat-tab')) customElements.define('design2-chat-tab', ChatTab);

declare global {
  interface HTMLElementTagNameMap {
    'design2-chat-tab': ChatTab;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'design2-chat-tab': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatTab> & {
          'session-id'?: string;
          'conversation-id'?: string;
          'status-text'?: string;
          'allowed-tabs'?: string;
          /** React 19 sets the matching PROPERTY, so a real boolean is correct —
              never the string "false", which Lit's boolean converter reads as true. */
          collapsed?: boolean;
          ref?: React.Ref<ChatTab>;
        },
        ChatTab
      >;
    }
  }
}
