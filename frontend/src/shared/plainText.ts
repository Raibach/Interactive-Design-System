/**
 * plainText — the chat panel draws text, so the text has to BE text.
 *
 * What was reported: Grace's replies arrived carrying `##` headings, `**` weight,
 * pipe tables, and a closing `Reply with one of: confirm, refuse, cancel.` line, and
 * a person read those characters. The renderer is not the fault —
 * `InteractiveChatInterface.tsx` draws `whitespace-pre-wrap` in a div, there is no
 * markdown library anywhere in `frontend/src`, and no `dangerouslySetInnerHTML`.
 * Nothing was rendering markdown. The markers WERE the message.
 *
 * How the words came out that way is the prompts, and the prompts were corrected
 * alongside this module (the baseline `systemInstructions` in
 * `InteractiveChatInterface.tsx`, and the tag block in
 * `backend/grace_gui.py::_build_chat_system`). A prompt is a request, though, and a
 * person's screen is no place to find out whether it was honoured — so the words are
 * also made plain here, once, where they are handed to the reader.
 *
 * WHERE THIS RUNS, and why only there. `renderMessageContent`, on assistant text,
 * after the XML control tags have been extracted and before the action links are
 * split out. NOT in `stripSystemScaffolding` (neuralNetworkService): that runs while
 * `<update_constraints>…</update_constraints>` is still in the string, and the
 * interior of a control tag is the ARTIFACT BEING WRITTEN INTO THE USER'S PROMPT —
 * a strip there would quietly rewrite content the user asked for, which is a worse
 * defect than the one it repairs. NOT on the stored message either: the record of
 * what was said is kept as it was said, and stripping on write would leave every
 * reply already in the database — the ones a person is looking at right now —
 * still unreadable. Display decides what is read.
 *
 * WHAT SURVIVES, on purpose:
 *   - `[Confirm](action:confirm)` and every other `action:` link. That is a wire
 *     format, not decoration — `renderMessageContent` turns it into a button, and the
 *     buttons are how the person answers. Only `[label](url)` loses its brackets.
 *   - `_underscored_identifiers` and `__dunder__` names: emphasis is only unwrapped
 *     when the underscores sit on word boundaries AND do not wrap a single word.
 *   - `2 * 3` — a lone `*` is a sum, not a marker. Asterisk PAIRS are unwrapped; a
 *     single one is left. That is this module's one stated limit: it removes the
 *     markers it can pair, and keeps what it cannot.
 *   - the inside of a fenced code block, taken verbatim. The fence lines are dropped,
 *     the code is not touched: `_` and `*` are syntax there.
 *
 * Idempotent by construction — running it twice is running it once.
 */


/** A GFM table row: fenced by a pipe at each end, which is how tables are written. */
const TABLE_ROW = /^\s*\|(.*)\|\s*$/;

/**
 * A line that is nothing but rule characters — a table's header rule (`|---|---|`)
 * or a horizontal rule (`---`, `***`, `___`, `===`). Both are drawn lines, not
 * sentences, and a table's header rule carries only column widths.
 */
const RULE_LINE = /^\s*[|\s:]*(?:-{3,}|\*{3,}|_{3,}|={3,})[|\s:*-]*$/;

/** An ATX heading. The space is required, so `#24` and `#sheet` stay as typed. */
const HEADING_OPEN = /^\s{0,3}#{1,6}\s+/;
/** The optional closing run of hashes (`## Title ##`). */
const HEADING_CLOSE = /\s+#{1,}$/;

/** A blockquote marker. Only when a space follows, so `>50%` is not a quote. */
const QUOTE_MARK = /^\s{0,3}>\s+/;

/** A list bullet. `-` is kept as the dash it reads as; `*` and `+` are markup. */
const BULLET = /^(\s{0,3})[*+-]\s+/;

/**
 * Links. `action:` links are the button wire format and are set aside before this
 * runs. An image keeps its alt text, which is the part a reader would have seen.
 */
const ACTION_LINK = /\[[^\]]*\]\(action:[^)]*\)/g;
const PLAIN_LINK = /!?\[([^\]]*)\]\([^)]*\)/g;

/**
 * Emphasis, requiring GFM's left-flanking shape: no whitespace inside the opening
 * delimiter. Without that requirement `2 * 3 * 4` reads as one emphasis run and
 * loses both multiplication signs.
 */
const STAR_STRONG = /\*\*(\S(?:[^*\n]*?\S)?)\*\*/g;
const STAR_EM = /\*(\S(?:[^*\n]*?\S)?)\*/g;
const STRIKE = /~~(\S(?:[^~\n]*?\S)?)~~/g;

/**
 * Underscore emphasis. The lookarounds keep `snake_case_name` intact; the inner
 * `\s` requirement is the honest limit — `__init__` and `_init_` are
 * identifier-shaped, so an underscore-wrapped SINGLE word is left as written.
 * Asterisks carry no such ambiguity: `**Constraints**` is unwrapped, because `**`
 * is not valid inside an identifier or an arithmetic sum.
 */
const UNDER_STRONG = /(?<![\w_])__(\S[^_\n]*?\s[^_\n]*?\S)__(?![\w_])/g;
const UNDER_EM = /(?<![\w_])_(\S[^_\n]*?\s[^_\n]*?\S)_(?![\w_])/g;

/** An unpaired `**` left from a broken pair. Never prose; a single `*` may be. */
const STRAY_STRONG = /\*\*/g;

/** A fenced code block delimiter, with its optional info string. */
const FENCE = /^\s*```[^\n]*$/;

/**
 * The scaffold sentence appended under the buttons: the options the buttons already
 * show, written out to be read. The buttons are the ask.
 */
const SCAFFOLD_FOOTER = /^\s*(?:please\s+)?reply with one of\b.*$/i;

/** Table columns, read as columns: cells kept, pipes dropped, spacing only. */
function tableRowToLine(line: string): string {
  const inner = line.match(TABLE_ROW);
  if (!inner) return line;
  return inner[1]
    .split('|')
    .map((cell) => cell.trim())
    .join('   ')
    .trimEnd();
}

/** One line of prose, with the markers a reader must not see removed. */
function lineToPlainText(line: string): string {
  if (TABLE_ROW.test(line)) return tableRowToLine(line);

  let out = line.replace(HEADING_OPEN, '').replace(HEADING_CLOSE, '');
  out = out.replace(QUOTE_MARK, '');
  out = out.replace(BULLET, (_m, indent: string) => `${indent}- `);

  // Action links are set aside, not stripped: they are the button format.
  const actions: string[] = [];
  out = out.replace(ACTION_LINK, (m) => {
    actions.push(m);
    return `\u0000${actions.length - 1}\u0000`;
  });
  out = out.replace(PLAIN_LINK, '$1');

  out = out
    .replace(STRIKE, '$1')
    .replace(STAR_STRONG, '$1')
    .replace(UNDER_STRONG, '$1')
    .replace(STAR_EM, '$1')
    .replace(UNDER_EM, '$1')
    .replace(STRAY_STRONG, '');

  // Backticks are never prose punctuation — the code stays, the ticks go.
  out = out.replace(/`/g, '');

  out = out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => actions[Number(i)] ?? '');

  return out.trimEnd();
}

/**
 * Grace's words as a person should read them: plain sentences, no markers, and no
 * scaffold footer restating the buttons underneath it.
 */
export function asPlainText(text: string): string {
  if (!text) return text;

  const out: string[] = [];
  let inFence = false;

  for (const line of text.split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(line.trimEnd());
      continue;
    }
    // A drawn line — a table's header rule, or a horizontal rule — is removed
    // outright rather than blanked: between a table's header and its first row a
    // blank line would split the table in two.
    if (RULE_LINE.test(line)) continue;
    if (SCAFFOLD_FOOTER.test(line)) continue;
    out.push(lineToPlainText(line));
  }

  return out
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
