/**
 * The chat button wire format.
 *
 * A button in this app is a line of text — `[label](action:payload)` — because that is
 * what survives a model's reply, and the render turns the line into something to press.
 * The failure this file exists for is silent and total: the render finds buttons with
 * `/\[.*?\]\(action:[^)]+\)/g`, so a `)` inside the payload ends the link early and the
 * button degrades into visible punctuation in the middle of a sentence. There is no error
 * anywhere when that happens — the person simply reads the apparatus instead of pressing it.
 *
 * `encodeURIComponent` does not escape `( ) ! ' * ~`, and this app's values are JSON
 * fragments and sentences: `"provenance": { … }`. So the parens are escaped explicitly,
 * and the round trip is pinned here for the characters that actually occur.
 *
 * Also pinned: an argument may contain the separator. `fill-field` carries three of them —
 * section, field, value — joined by `|`, and a value containing a `|` must arrive whole.
 */
import { describe, it, expect } from 'vitest';
import {
  actionLink,
  encodeActionArg,
  decodeActionArg,
  fillFieldAction,
  parseFillFieldAction,
  ACTION_ARG_SEP,
  writeToolAction,
  parseWriteToolAction,
  writeSeatAction,
  parseWriteSeatAction,
} from '@/shared/actionLink';

/** The render's own matcher, so the test fails the way the app does. */
const BUTTON = /^\[(.*?)\]\(action:([^)]+)\)$/;

describe('an action link survives the render that finds it', () => {
  it('keeps a payload with parens inside the link, where a raw one would end it', () => {
    const value = '"provenance": { "x": "inferred" } (per field)';
    const link = actionLink('designer — verbatim', fillFieldAction('User', 'Provenance', value));
    const m = BUTTON.exec(link);
    expect(m, link).not.toBeNull();
    expect(m![1]).toBe('designer — verbatim');
    // And the value comes back whole, parens and all.
    expect(parseFillFieldAction(m![2])).toEqual({
      section: 'User',
      field: 'Provenance',
      value,
    });
  });

  it('carries a value that contains the argument separator, a newline, and quotes', () => {
    const value = ['wire the listener for "section-menu-select" | mark it', '// TODO(behavior)'].join('\n');
    const link = actionLink('wire it', fillFieldAction('User', 'Listener', value));
    const m = BUTTON.exec(link);
    expect(m).not.toBeNull();
    expect(parseFillFieldAction(m![2])?.value).toBe(value);
  });

  it('never leaves a raw separator inside an encoded argument', () => {
    for (const v of ['a|b', '|', 'a)(b', "it's", '100% sure', 'a*b']) {
      expect(encodeActionArg(v), v).not.toContain(ACTION_ARG_SEP);
      expect(decodeActionArg(encodeActionArg(v)), v).toBe(v);
    }
  });

  it('strips a bracket from the label, which would end the label early', () => {
    const link = actionLink('add [this]', 'confirm');
    expect(BUTTON.exec(link)?.[1]).toBe('add this');
  });

  it('reads back only its own action, and nothing malformed', () => {
    expect(parseFillFieldAction('confirm')).toBeNull();
    expect(parseFillFieldAction('fill-field:User')).toBeNull();
    expect(parseFillFieldAction('fill-field:User' + ACTION_ARG_SEP + 'Provenance')).toBeNull();
    // An encoded argument that will not decode is returned as read, not thrown on: a
    // broken button is worth reporting, and it must not take the chat panel down.
    expect(decodeActionArg('%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('carries a TOOL by name, and never confuses the two write actions', () => {
    /*
     * A tool button names a row in the register, and the register's names are the only thing
     * that resolves. Two properties matter and both were live failures on 2026-09-23: the two
     * write actions must not read each other's payloads (a `write-tool` reaching the seat writer
     * would put the tool's NAME in as prose), and a name carrying the separator must be refused
     * rather than split.
     */
    const link = actionLink('Search the internet', writeToolAction('search-the-internet'));
    const m = BUTTON.exec(link);
    expect(m).not.toBeNull();
    expect(parseWriteToolAction(m![2])).toEqual({ name: 'search-the-internet' });

    // Each reader refuses the other's action, and the seat reader refuses a bare tool name.
    expect(parseWriteToolAction(writeSeatAction('Tool Call', '{{tool:read-a-wiki}}'))).toBeNull();
    expect(parseWriteSeatAction(writeToolAction('read-a-wiki'))).toBeNull();
    expect(parseWriteToolAction('write-tool:')).toBeNull();
    expect(parseWriteToolAction(`write-tool:a${ACTION_ARG_SEP}b`)).toBeNull();
  });
});
