/**
 * WHICH BUTTONS THE PROMPT SAYS ARE DONE — and why nothing is saved to say it.
 *
 * The failure this file exists for: a review drew three things to do, the person did two of
 * them, saved, and reopened the package to find all three offered again as though nothing had
 * happened. The owner, 2026-09-23: "it's not saving states … it's actually representing the
 * list again as if it wasn't done."
 *
 * The marks were a memory on the seat, which lasts as long as the tab. The tempting repair is
 * to persist them — a row, a flag, a JSON blob per package. That repair is wrong twice over:
 * it is a second record of a fact the prompt already holds, and the copy nobody re-derives is
 * the copy that goes stale. "Fill User Role" is done because the User Role seat has text in
 * it, and that was saved by the person's own Save.
 *
 * So these tests are about a READ, and the cases that matter are the ones a flag could not
 * have got right: a seat the person edited by hand afterwards, a step done in another tab, a
 * button whose work nothing in the prompt can show.
 */
import { describe, it, expect } from 'vitest';
import { stepsDone } from '@/shared/buttonState';
import { writeSeatAction, writeToolAction, setDescriptionAction } from '@/shared/actionLink';

const SEATS = [
  { name: 'System Role', type: 'system-role', content: 'You are a precise assistant.' },
  { name: 'User Role', type: 'user-role', content: 'Find the latest insurance news.' },
  { name: 'Agent Role', type: 'agent-role', content: '' },
];

describe('a button is done when the prompt says so', () => {
  it('marks a seat that holds something, and leaves an empty one waiting', async () => {
    const actions = [
      writeSeatAction('User Role', 'Draft a task for scouting insurance news'),
      writeSeatAction('Agent Role', 'Draft an agent identity'),
      writeSeatAction('Constraints', 'Never invent a source'),
    ];
    const done = stepsDone(actions, SEATS, '');

    expect(done.has(actions[0])).toBe(true);   // the seat has text
    expect(done.has(actions[1])).toBe(false);  // the seat is present and EMPTY
    expect(done.has(actions[2])).toBe(false);  // the seat does not exist at all
  });

  it('does not care that the words changed — the STEP is what is done', async () => {
    // Her button offered a placeholder to start from; what is in the seat is the person's own
    // text, and possibly nothing like it. A checklist asks whether the step is finished.
    const action = writeSeatAction('User Role', 'Draft a placeholder task for the user to refine');
    expect(stepsDone([action], SEATS, '').has(action)).toBe(true);
  });

  it('finds the seat by any of the spellings this app accepts', async () => {
    // A repair prompt's seats are `System` / `User`; a composer's are `System Role` /
    // `User Role`. Both are names a person sees, so the matcher is the same one the writes use.
    const short = [{ name: 'User', type: 'user', content: 'Provenance (required):' }];
    const action = writeSeatAction('User Role', 'anything');
    expect(stepsDone([action], short, '').has(action)).toBe(true);
  });

  it('recognises a tool by the name the prompt carries', async () => {
    const withTool = [{ name: 'Tool Call', type: 'tool-call', content: '{{tool:search-the-internet}}\nSearch it.' }];
    const action = writeToolAction('search-the-internet');
    const other = writeToolAction('read-a-wiki');

    expect(stepsDone([action], withTool, '').has(action)).toBe(true);
    expect(stepsDone([other], withTool, '').has(other)).toBe(false);
    // ...and nothing in the prompt means nothing is done, even for a tool that runs.
    expect(stepsDone([action], SEATS, '').has(action)).toBe(false);
  });

  it('reads the description off the package, whichever spelling the button used', async () => {
    const colon = setDescriptionAction('Scouts insurance news.');
    const hers = 'set-description|Add a short description for the package';

    expect(stepsDone([colon, hers], SEATS, 'Scouts insurance news.').size).toBe(2);
    // No description on the package: neither is done, and this is the case that was broken —
    // the write had happened, so the prompt says done and the button stops asking.
    expect(stepsDone([colon, hers], SEATS, '').size).toBe(0);
    expect(stepsDone([colon, hers], SEATS, '   ').size).toBe(0);
  });

  it('reads the shape a SAVED package actually stores', async () => {
    /*
     * THE SHAPE THAT WOULD HAVE MADE THIS WHOLE DERIVATION USELESS.
     *
     * A composer's seats come from the editor as `{name, type, content}`. A SAVED package comes
     * back as `{section, role, content, position, visible}` — no `name` field at all (read out
     * of the database on 2026-09-23 for the package this was reported against). A matcher that
     * read `s.name` would compare against `undefined` for every seat, find nothing, and report
     * a prompt with full seats as untouched: right in a test built from the editor's shape, and
     * silently wrong on every reopened package.
     */
    const stored = [
      { section: 'System', role: 'System', content: 'You are a precise, professional assistant.', position: 0, visible: true },
      { section: 'User', role: 'User', content: 'Find the latest insurance news.', position: 1, visible: true },
      { section: 'Agent', role: 'Agent', content: '', position: 2, visible: true },
    ];
    const filled = writeSeatAction('user', 'Draft a task for scouting insurance news');
    const empty = writeSeatAction('agent_role', 'Draft an agent identity for the news scout');

    const done = stepsDone([filled, empty], stored, 'Finds and summarizes the latest insurance news.');
    expect(done.has(filled)).toBe(true);
    expect(done.has(empty)).toBe(false);
  });

  it('derives nothing for a button that is a question', async () => {
    // `confirm`, `not-now`, and a sentence to answer leave nothing in the prompt to read. Their
    // mark is only a memory, and saying so is better than inventing one from nothing.
    const actions = ['confirm', 'not-now', 'review-prompt', 'Tell me what is weak here'];
    expect(stepsDone(actions, SEATS, 'Scouts insurance news.').size).toBe(0);
  });

  it('survives an empty prompt without pretending anything is done', async () => {
    const action = writeSeatAction('User Role', 'x');
    expect(stepsDone([action], [], '').size).toBe(0);
    expect(stepsDone([], SEATS, '').size).toBe(0);
  });
});
