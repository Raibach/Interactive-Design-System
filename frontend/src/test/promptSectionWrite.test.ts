/**
 * <prompt-section-editor> — the receiving end of every write into the left column.
 *
 * This is where the assistant (or the app) reaches the prompt: the window events
 * `set-left-column-text` / `force-set-section` / `fill-field`, and the `<update_*>`
 * tags that end up here. Three properties are pinned, and all three are silent when
 * they are wrong:
 *
 *   1. A NAME FINDS ITS SEAT. A repair prompt's seats are `System` / `User` / `Tool Call`
 *      / `Agent`; a composer's are `System Role` / `User Role` / … — and the assistant
 *      says either, because both are names a person sees. The comparison used to be an
 *      exact string match, so half of those writes matched nothing and the column simply
 *      did not change.
 *   2. A WRITE THAT LANDS NOWHERE IS REPORTED. Nothing is swallowed: the editor
 *      dispatches `section-write-failed` with the seats it does have, which the chat
 *      turns into one sentence. A silent no-op is indistinguishable from a broken app.
 *   3. A FIELD WRITE IS ONE EDIT. `fill-field` writes a value under a field's label and
 *      leaves the rest of the seat byte-for-byte alone, so a button in the chat and a
 *      keystroke in the box produce the same text. The section's `section-update` fires
 *      either way, which is what puts the change back into the repair the page holds.
 *
 * jsdom has no layout and does not matter here: every assertion is about `sections` and
 * about the events, not about pixels.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/prompt-section-editor';

type Section = { name: string; content: string; type?: string; position?: number; visible?: boolean };
type EditorEl = HTMLElement & {
  sections: Section[];
  updateComplete: Promise<unknown>;
};

/** The four seats a repair prompt is, exactly as buildRepairSections writes them. */
const REPAIR: Section[] = [
  { name: 'System', type: 'system', content: '', position: 0, visible: true },
  { name: 'User', type: 'user', content: 'Provenance (required):', position: 1, visible: true },
  { name: 'Tool Call', type: 'tool-call', content: 'figma node  40000746:94', position: 2, visible: true },
  { name: 'Agent', type: 'agent', content: 'Mark it verbatim or inferred.', position: 3, visible: true },
];

const mounted: EditorEl[] = [];

const mount = async (sections: Section[]) => {
  const el = document.createElement('prompt-section-editor') as EditorEl;
  el.sections = sections;
  document.body.appendChild(el);
  await el.updateComplete;
  mounted.push(el);
  return el;
};

afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
});

/** Fire one of the window events the writers use, and let the element react. */
const write = async (el: EditorEl, name: string, detail: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
  await el.updateComplete;
};

/** The detail of every event of this kind that arrives, and a way to stop listening. */
const capture = (el: EditorEl, name: string) => {
  const seen: any[] = [];
  const on = (e: Event) => seen.push((e as CustomEvent).detail);
  el.addEventListener(name, on as EventListener);
  return { seen, stop: () => el.removeEventListener(name, on as EventListener) };
};

describe('a name finds its seat, whichever spelling of it arrives', () => {
  it('writes the long name into a repair prompt’s short seat', async () => {
    const el = await mount(REPAIR.map((s) => ({ ...s })));
    await write(el, 'set-left-column-text', { target: 'User Role', content: 'Provenance (required):' });
    expect(el.sections[1].content).toBe('Provenance (required):');
    // And the same for the other event, whose payload is spelled differently.
    await write(el, 'force-set-section', { sectionName: 'Agent Role', content: 'Marked verbatim.' });
    expect(el.sections[3].content).toBe('Marked verbatim.');
  });

  it('writes the short name into a composer’s long seat', async () => {
    const el = await mount([
      { name: 'System Role', type: 'system', content: 'a' },
      { name: 'User Role', type: 'user', content: 'b' },
    ]);
    await write(el, 'set-left-column-text', { target: 'system', content: 'identity' });
    expect(el.sections[0].content).toBe('identity');
  });

  it('reports a seat this column does not have instead of doing nothing', async () => {
    const el = await mount(REPAIR.map((s) => ({ ...s })));
    const failed = capture(el, 'section-write-failed');
    // A composer seat in a repair prompt: real name, no such section here.
    await write(el, 'set-left-column-text', { target: 'Constraints', content: 'never delete' });
    expect(el.sections.map((s) => s.content)).toEqual(REPAIR.map((s) => s.content));
    expect(failed.seen).toEqual([
      { target: 'Constraints', why: 'no section by that name', names: ['System', 'User', 'Tool Call', 'Agent'] },
    ]);
    failed.stop();
  });
});

describe('a field write is one edit, and the section says so', () => {
  it('puts the value under the label and leaves every other line alone', async () => {
    const el = await mount(REPAIR.map((s) => ({ ...s })));
    const updates = capture(el, 'section-update');
    await write(el, 'fill-field', {
      section: 'User Role',
      field: 'Provenance',
      value: '"provenance": "verbatim"',
    });
    expect(el.sections[1].content).toBe('Provenance (required):\n  "provenance": "verbatim"');
    // Untouched: the other seats, and the seat's own name.
    expect(el.sections[3].content).toBe('Mark it verbatim or inferred.');
    expect(el.sections[1].name).toBe('User');
    // Announced once, with the index — that is what the page folds back into the repair.
    expect(updates.seen).toHaveLength(1);
    expect(updates.seen[0].index).toBe(1);
    updates.stop();
  });

  it('reports a field the section does not hold, and changes nothing', async () => {
    const el = await mount(REPAIR.map((s) => ({ ...s })));
    const failed = capture(el, 'section-write-failed');
    await write(el, 'fill-field', { section: 'User', field: 'Nonsense', value: 'x' });
    expect(el.sections[1].content).toBe('Provenance (required):');
    expect(failed.seen).toEqual([
      { target: 'User', why: 'no field named Nonsense', names: ['System', 'User', 'Tool Call', 'Agent'] },
    ]);
    failed.stop();
  });

  it('replaces the value on a second answer rather than adding a second block', async () => {
    const el = await mount(REPAIR.map((s) => ({ ...s })));
    await write(el, 'fill-field', { section: 'User', field: 'Provenance', value: '"provenance": "inferred"' });
    await write(el, 'fill-field', { section: 'User', field: 'Provenance', value: '"provenance": "verbatim"' });
    expect(el.sections[1].content).toBe('Provenance (required):\n  "provenance": "verbatim"');
  });
});
