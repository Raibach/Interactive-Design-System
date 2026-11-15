/**
 * <design2-chat> — THE ROOM'S STANDING SEAT.
 *
 * The right column for the room's ordinary views: the rail, the five boxes and the conversation.
 * Every behaviour lives in `./design-chat-seat` — the boxes, the render, the events, the folds,
 * the send and the reply's buttons. This file is the page: it names the element and states which
 * conversation file the seat reads.
 *
 * ITS SOURCE IS THE SEAT'S OWN. `./conversations` is this page's file, and when its chat tab
 * stands it binds the package recorded as the chat package. The Chat tab's page is the other
 * subclass, `./chat-tab`, which reads the console's file instead.
 */
import { DesignChatSeat } from './design-chat-seat';

export class DesignChat extends DesignChatSeat {
  constructor() {
    super();
    this.conversationSource = 'seat';
  }
}

if (!customElements.get('design2-chat')) customElements.define('design2-chat', DesignChat);

declare global {
  interface HTMLElementTagNameMap {
    'design2-chat': DesignChat;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'design2-chat': React.DetailedHTMLProps<
        React.HTMLAttributes<DesignChat> & {
          'session-id'?: string;
          'conversation-id'?: string;
          'status-text'?: string;
          'allowed-tabs'?: string;
          /** React 19 sets the matching PROPERTY, so a real boolean is correct —
              never the string "false", which Lit's boolean converter reads as true. */
          collapsed?: boolean;
          ref?: React.Ref<DesignChat>;
        },
        DesignChat
      >;
    }
  }
}
