/**
 * The chat's words, made plain at the display edge.
 *
 * What was reported is the first test: a reply that arrived as a heading, a bolded
 * word, a pipe table and a `Reply with one of: …` footer, drawn in a div with
 * `whitespace-pre-wrap` — a person read the characters. These assertions exist
 * because that failure is invisible from the code: every layer looks right
 * (no markdown parser, no `innerHTML`), and the markers were the message.
 *
 * Four properties are held here, each one cheap to check and expensive to lose:
 *
 *   1. The markers go, and the WORDS STAY. A strip that took the sentence with the
 *      heading would be a worse defect than the heading, so the exact expected text
 *      is asserted rather than the absence of a character.
 *   2. The wire formats survive. `[Confirm](action:confirm)` is not decoration — the
 *      renderer turns it into the button the person clicks — so it must come through
 *      byte for byte, and only the `Reply with one of: …` line under it goes.
 *   3. What is not markup is not touched: `2 * 3`, `snake_case_name`, `__init__`,
 *      `#24`, `>50%`, and the inside of a fenced code block.
 *   4. It is idempotent — running it twice is running it once.
 */
import { describe, it, expect } from 'vitest';
import { asPlainText } from '@/shared/plainText';

/** The reply as it reached the screen, in the shape it was reported. */
const reportedReply = [
  '## Constraints',
  '',
  'The agent must **never** remove error boundaries. Add this:',
  '',
  '| Field | Value |',
  '|-------|-------|',
  '| scope | app |',
  '| owner | design |',
  '',
  '[Confirm](action:confirm) [Refuse](action:refuse) [Cancel](action:cancel)',
  '',
  'Reply with one of: confirm, refuse, cancel.',
].join('\n');

describe('a reply reaches the person as plain sentences', () => {
  it('drops the heading, the weight and the table, and keeps every word', () => {
    expect(asPlainText(reportedReply)).toBe([
      'Constraints',
      '',
      'The agent must never remove error boundaries. Add this:',
      '',
      'Field   Value',
      'scope   app',
      'owner   design',
      '',
      '[Confirm](action:confirm) [Refuse](action:refuse) [Cancel](action:cancel)',
    ].join('\n'));
  });

  it('keeps the buttons and drops the sentence that restates them', () => {
    const out = asPlainText(
      'Want me to apply it?\n\n[Confirm](action:confirm) [Cancel](action:cancel)\n\nReply with one of: confirm, refuse, cancel.'
    );
    expect(out).toBe(
      'Want me to apply it?\n\n[Confirm](action:confirm) [Cancel](action:cancel)'
    );
    // The buttons are how the person answers; a reply with buttons and no footer
    // must be unchanged in the part that carries them.
    expect(out).toContain('[Cancel](action:cancel)');
  });

  it('leaves no marker character behind, whichever one she reaches for', () => {
    const out = asPlainText([
      '# System Role',
      '**Hard rule**: the agent stops at `checkout`.',
      '~~Old line~~',
      '> Ask before deleting.',
      '___',
      '* one',
      '+ two',
      '- three',
      'See [the brief](https://example.com/brief.md).',
    ].join('\n'));

    expect(out).not.toMatch(/^#{1,6}\s/m);
    expect(out).not.toContain('**');
    expect(out).not.toContain('~~');
    expect(out).not.toContain('`');
    expect(out).not.toMatch(/^\s*\|/m);
    expect(out).not.toMatch(/^[*+]\s/m);

    expect(out).toBe([
      'System Role',
      'Hard rule: the agent stops at checkout.',
      'Old line',
      'Ask before deleting.',
      '- one',
      '- two',
      '- three',
      'See the brief.',
    ].join('\n'));
  });

  it('is idempotent', () => {
    const once = asPlainText(reportedReply);
    expect(asPlainText(once)).toBe(once);
  });
});

describe('what is not markup is not touched', () => {
  it('keeps arithmetic, identifiers and dunders as written', () => {
    const code = 'Width is 2 * 3 * 4 px, read from __init__ in prompt_sections_config.';
    expect(asPlainText(code)).toBe(code);
    expect(asPlainText('The fix landed in release #24 for >50% of runs.')).toBe(
      'The fix landed in release #24 for >50% of runs.'
    );
  });

  it('unwraps emphasis, and stops where the marker is a name', () => {
    // The form she actually reaches for. `**` carries single words and is never
    // valid inside a name, so it is always unwrapped.
    expect(asPlainText('The agent must **never** remove **error boundaries**.')).toBe(
      'The agent must never remove error boundaries.'
    );
    expect(asPlainText('We read _the whole file_ before editing.')).toBe(
      'We read the whole file before editing.'
    );
    // The limit, asserted rather than left to review: `_init_` and `__init__` are
    // the same shape as a single underscored word, and in a prompt-engineering
    // workspace the names are the more expensive thing to damage. A one-word
    // emphasis written with underscores keeps its markers; written with asterisks
    // it does not.
    expect(asPlainText('Name it _init_ and the framework runs it.')).toBe(
      'Name it _init_ and the framework runs it.'
    );
    expect(asPlainText('Name it **init** and the framework runs it.')).toBe(
      'Name it init and the framework runs it.'
    );
  });

  it('takes a fenced code block verbatim and only drops the fence', () => {
    const out = asPlainText([
      'Set it like this:',
      '```ts',
      'const stars = 2 * 3; // **not** a marker',
      '```',
      'That is the whole edit.',
    ].join('\n'));
    expect(out).toBe([
      'Set it like this:',
      'const stars = 2 * 3; // **not** a marker',
      'That is the whole edit.',
    ].join('\n'));
  });

  it('leaves a pipe inside a sentence alone', () => {
    const sentence = 'Use "a | b" as the OR, quoted.';
    expect(asPlainText(sentence)).toBe(sentence);
  });
});
