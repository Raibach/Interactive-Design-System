import type { InputActionHost } from './host';

/** A MESSAGE WAS SENT — the other path into the turn, when a part raises `message-sent`. */
export const messageSentAction = (host: InputActionHost, e: Event): void => {
  const detail = (e as CustomEvent).detail || {};
  const text = String(detail.text ?? '').trim();
  if (text) void host._send(text);
};
