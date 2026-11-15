import type { InputActionHost } from './host';

/**
 * ENTER SENDS — the same act as the Send button, given to the keyboard.
 *
 * It takes the button's path exactly, including the clear. Shift+Enter is left alone (a newline
 * is a person typing, not asking) and `isComposing` so an IME's Enter does not fire mid-word.
 */
export const composerKeyAction = (host: InputActionHost, e: KeyboardEvent): void => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  const text = String(host._draft ?? '').trim();
  if (!text) return;
  e.preventDefault();
  host._clearDraft();
  void host._send(text);
};
