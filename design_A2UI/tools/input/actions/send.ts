import type { InputActionHost } from './host';

/** SEND — the button's one act: trim the draft, clear the box, start the turn. */
export const sendAction = (host: InputActionHost): void => {
  const text = host._draft.trim();
  if (!text || host._sending) return;
  host._clearDraft();
  void host._send(text);
};
