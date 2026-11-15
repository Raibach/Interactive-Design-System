import type { InputActionHost } from './host';

/** TYPING WRITES THE DRAFT — the Read/Write contract's write half. The bar is told separately. */
export const draftInputAction = (host: InputActionHost, e: Event): void => {
  const d = (e as CustomEvent).detail || {};
  if (typeof d.value !== 'string') return;
  host._draft = d.value;
  host._syncBarText();
};
