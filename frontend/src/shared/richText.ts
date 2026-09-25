/**
 * richText.ts — the one place AI text becomes HTML.
 *
 * The model answers in markdown (headings, bold, code blocks, tables), and every
 * surface that shows an AI RESPONSE — the middle column's output viewer, and the
 * chat's result turns — renders it through here, with `marked` (the parser the
 * owner named, 2026-09-24) and DOMPurify.
 *
 * WHY DOMPURIFY RIDES ALONG. `marked` parses; it no longer sanitizes (the option
 * was removed), and the text being parsed is the model's own output — untrusted
 * by definition. Injecting it unsanitized would let a bad answer run markup in
 * the page, which is exactly what the codebase's own rule against raw HTML was
 * written to stop (see shared/plainText). The parse is therefore always washed
 * through DOMPurify before it reaches a template. Rendering stays typed —
 * `unsafeHTML` — because the string IS html now; the safety lives in the wash,
 * not in avoiding the tag.
 *
 * Callers give the returned string to Lit's `unsafeHTML` inside an element that
 * carries the `markdown-body` class, and `github-markdown-css` (imported here)
 * supplies the type. The element's own styles may size it further.
 */
import { marked, Tokens } from 'marked';
import DOMPurify from 'dompurify';
import 'github-markdown-css/github-markdown.css';

/**
 * A fenced block longer than this is folded to one line until it is opened.
 *
 * Kept from the middle column's own renderer (compiled-output-viewer's
 * FOLD_AFTER_LINES): a repair answer hands back an ENTIRE file, and sixty lines
 * of code in the pane was a wall the verdict above it could not survive. The
 * fold is now the native `<details>` element — one summary line (language, line
 * count), the block inside, opened by the reader's own click — which keeps the
 * same behavior inside the marked pipeline instead of beside it.
 */
const FOLD_AFTER_LINES = 12;

/** A code block, folded with `<details>` when it is long enough to be the whole reply. */
marked.use({
  renderer: {
    code(token: Tokens.Code): string {
      // `escaped` says whether the parser already escaped the text; the token form
      // hands it through raw, so the washing below is this module's.
      const text = token.escaped ? token.text : escapeHtml(token.text);
      const lang = String(token.lang || '').trim();
      const classAttr = lang ? ` class="language-${lang}"` : '';
      const lines = token.text.split('\n').length;
      const pre = `<pre><code${classAttr}>${text}</code></pre>`;
      if (lines <= FOLD_AFTER_LINES) return pre;
      return (
        `<details class="fold"><summary>`
        + `<span class="fold-title">${lang ? `${lang} · ` : ''}${lines} lines</span>`
        + `</summary>${pre}</details>`
      );
    },
    /*
     * LINKS ARE THE TOOL'S PROOF, SO THEY MUST OPEN. The search brings back the
     * actual addresses now (the owner, 2026-09-24: "bring back the actual links"),
     * and a result link that navigates the app away would throw away the answer
     * the person is reading — so links open in a new tab, with no opener for the
     * new page to reach back through. DOMPurify washes this like everything else.
     */
    link(token: Tokens.Link): string {
      const href = escapeHtml(String(token.href || ''));
      const text = String(token.text ?? '');
      const title = token.title ? ` title="${escapeHtml(String(token.title))}"` : '';
      return `<a href="${href}"${title} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

/** Markdown text → sanitized HTML. Safe to hand to `unsafeHTML`. */
export function renderMarkdown(text: string): string {
  const parsed = marked.parse(text ?? '', { async: false }) as string;
  // `target` is not in DOMPurify's default allow-list, and the link renderer above
  // writes target="_blank" so result links open beside the app instead of taking it
  // over — the wash must keep it or the renderer's whole point is washed away.
  return DOMPurify.sanitize(parsed, { ADD_ATTR: ['target'] });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
