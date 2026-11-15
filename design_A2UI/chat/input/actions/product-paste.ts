import type { InputActionHost } from './host';

/**
 * PASTE ATTACHES WHAT IS ON THE CLIPBOARD — product room only, and only when the clipboard is
 * not really text: a Word or Excel paste carries its own image payload, and attaching a picture
 * of what the person meant to type is worse than doing nothing.
 */
export const productPasteAction = (host: InputActionHost, e: ClipboardEvent): void => {
  if (!host.productTools) return;
  const text = e.clipboardData?.getData('text/plain') ?? '';
  if (text.trim()) return;
  const files = Array.from(e.clipboardData?.files ?? []);
  if (!files.length) return;
  e.preventDefault();
  host._forwardProductAttach(files);
};
