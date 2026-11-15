import type { InputActionHost } from './host';

/** PASTE ATTACHES WHAT IS ON THE CLIPBOARD — product room only, and only when it is not text. */
export const productPasteAction = (host: InputActionHost, e: ClipboardEvent): void => {
  if (!host.productTools) return;
  const text = e.clipboardData?.getData('text/plain') ?? '';
  if (text.trim()) return;
  const files = Array.from(e.clipboardData?.files ?? []);
  if (!files.length) return;
  e.preventDefault();
  host._forwardProductAttach(files);
};
