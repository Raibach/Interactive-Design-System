import type { InputActionHost } from './host';

/**
 * TYPING WRITES THE DRAFT — the Read/Write contract's write half. `_draft` is a plain field on
 * purpose; the bar is told separately (`_syncBarText`) so a keystroke does not re-render the
 * whole thread.
 */
export const draftInputAction = (host: InputActionHost, e: Event): void => {
  const d = (e as CustomEvent).detail || {};
  if (typeof d.value !== 'string') return;
  host._draft = d.value;
  host._syncBarText();
};
