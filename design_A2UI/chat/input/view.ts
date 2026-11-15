/**
 * THE INPUT'S VIEW — the action bar and the typing box.
 *
 * The input place of the conversation/messages/input extraction named in RULES.md. It is the
 * chat column's input, NOT the Composer room: the two share a word and nothing else. The typing
 * box (`design-prompt-textarea`) is a copy of the prompt input that was once shared with the
 * Composer; that ancestry is why the old folder was called `composer/`.
 *
 * The markup takes values and callbacks. The wrapper (`chat-input-wrapper`) stays in the seat: it
 * is the container, and it also holds the tray, which is its own place.
 */
import { html, type TemplateResult } from 'lit';
import '../parts/design-chat-action-bar';
import '../parts/design-chat-input';
import '../parts/design-prompt-textarea';

export interface InputViewValues {
  modelLabel: string;
  trailing: string;
  composerPackage: string;
  busy: boolean;
  hasText: boolean;
  inputHeight: number;
  onSend: () => void;
  onStop: () => void;
  onMessageSent: (e: Event) => void;
  onComposerKey: (e: KeyboardEvent) => void;
  onDraftInput: (e: Event) => void;
  onProductPaste: (e: ClipboardEvent) => void;
}

export const inputView = (v: InputViewValues): TemplateResult => html`
  <design2-chat-action-bar
    model-label=${v.modelLabel}
    trailing=${v.trailing}
    composer-package=${v.composerPackage}
    ?busy=${v.busy}
    ?has-text=${v.hasText}
    @send-input-to-model=${v.onSend}
    @stop-model-thinking=${v.onStop}
  ></design2-chat-action-bar>
  <design2-chat-input
    .height=${v.inputHeight}
    @message-sent=${v.onMessageSent}
    @keydown=${v.onComposerKey}
  >
    <design2-prompt-textarea
      placeholder="chat input"
      @value-input=${v.onDraftInput}
      @paste=${v.onProductPaste}
    ></design2-prompt-textarea>
  </design2-chat-input>
`;
