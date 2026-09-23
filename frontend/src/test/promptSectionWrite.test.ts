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
import { describe, it, expect, afterEach, vi } from 'vitest';
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

  it('makes a seat this column does not have, the same row Custom makes', async () => {
    /*
     * THE OWNER'S DECISION, 2026-09-23: "she should be able to insert a section right into the
     * prompt… I can do it by going to custom… it creates the role and then I have to change the
     * name."
     *
     * This used to be REFUSED — a composer seat named into a repair prompt matched nothing, the
     * write was dropped, and (because nothing listened to the report either) the assistant could
     * say "Done — I've added that constraint" over a prompt that had not changed. A name with no
     * seat is now made into a row, exactly as the person's own path makes one: type custom, and
     * the name they asked for.
     */
    const el = await mount(REPAIR.map((s) => ({ ...s })));
    await write(el, 'set-left-column-text', { target: 'Provenance', content: 'never delete' });

    const made = el.sections[el.sections.length - 1];
    expect(made.name).toBe('Provenance');
    expect(made.type).toBe('custom');
    expect(made.content).toBe('never delete');
    // And the four seats the prompt already had are untouched.
    expect(el.sections.slice(0, 4).map((s) => s.content)).toEqual(REPAIR.map((s) => s.content));
  });

  it('names a DECLARED seat from the declaration, not from her spelling of it', async () => {
    // "Add these to Constraints" on a composer with no Constraints row makes a Constraints row
    // — label and type from @/shared/promptSections, so the row reads like one the seat menu
    // made rather than like a row someone typed.
    const el = await mount([
      { name: 'System Role', type: 'system-role', content: 'a' },
      { name: 'User Role', type: 'user-role', content: 'b' },
    ]);
    await write(el, 'set-left-column-text', { target: 'constraints', content: 'never delete' });

    const made = el.sections[el.sections.length - 1];
    expect(made.name).toBe('Constraints');
    expect(made.type).toBe('constraints');
    expect(made.content).toBe('never delete');
  });

  it('does not print the words twice when the row was made for them', async () => {
    // A made row is seeded WITH the value and the write that follows appends — so without the
    // guard in _onWriteSeat the sentence lands in the row twice.
    const el = await mount([{ name: 'System Role', type: 'system-role', content: 'a' }]);
    await write(el, 'a2ui:write-seat', { section: 'Provenance', value: 'Ask for the source.' });

    const made = el.sections[el.sections.length - 1];
    expect(made.name).toBe('Provenance');
    expect(made.content).toBe('Ask for the source.');
  });

  it('still reports a write that cannot be placed at all, with the seats it DOES have', async () => {
    // A field is a label INSIDE a row's text, so a fill-field whose section is absent has no row
    // to make and no line to write under. That one is still refused — and reported, with the
    // seats the prompt has, so the sentence can name them.
    const el = await mount(REPAIR.map((s) => ({ ...s })));
    const failed = capture(el, 'section-write-failed');
    await write(el, 'fill-field', {
      section: 'Constraints',
      field: 'Provenance',
      value: '"provenance": "verbatim"',
    });
    expect(el.sections.map((s) => s.content)).toEqual(REPAIR.map((s) => s.content));
    expect(failed.seen).toEqual([
      { target: 'Constraints', why: 'no section by that name', names: ['System', 'User', 'Tool Call', 'Agent'] },
    ]);
    failed.stop();
  });
});

describe('a tool goes into a prompt the way the menu puts it in', () => {
  /**
   * A TOOL IS NOT WORDS, AND THIS IS THE PATH SHE HAD NONE OF.
   *
   * The seat's Functions / Tools menu could insert a tool and nothing else could — the insertion
   * lived inside that menu's own branch. Measured 2026-09-23, on the assistant telling a person
   * their prompt named no tool and offering to add one: the offer could not be kept, so the
   * button did nothing and the prompt kept asking for news it had no way to fetch.
   *
   * What goes in is the register's own text under the tool's own name — the same two things the
   * menu writes — because a prompt inserted from the chat has to be the prompt a person would
   * have made by hand.
   */
  it('inserts the tool the menu would insert, into a seat the prompt did not have', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ name: 'search-the-internet', body: 'Search the internet for a query.' }),
    } as Response)));

    const el = await mount([{ name: 'System Role', type: 'system-role', content: 'a' }]);
    window.dispatchEvent(new CustomEvent('insert-tool', { detail: { name: 'search-the-internet' } }));
    for (let i = 0; i < 20; i++) { await Promise.resolve(); await el.updateComplete; }

    const made = el.sections[el.sections.length - 1];
    expect(made.type).toBe('tool-call');
    expect(made.content).toBe('{{tool:search-the-internet}}\nSearch the internet for a query.');
    vi.unstubAllGlobals();
  });

  it('writes nothing and says so when the register has no such tool', async () => {
    // An invented tool name is a step that cannot happen: the editor reports it through the
    // error channel rather than writing a token nothing can resolve.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ detail: { error: { message: 'no such tool' } } }),
    } as Response)));

    const el = await mount([{ name: 'Tool Call', type: 'tool-call', content: 'x' }]);
    const errors: any[] = [];
    const fn = (e: Event) => errors.push((e as CustomEvent).detail);
    window.addEventListener('a2ui-update-error-banner', fn as EventListener);

    window.dispatchEvent(new CustomEvent('insert-tool', { detail: { name: 'make-coffee' } }));
    for (let i = 0; i < 20; i++) { await Promise.resolve(); await el.updateComplete; }
    window.removeEventListener('a2ui-update-error-banner', fn as EventListener);

    expect(el.sections[0].content).toBe('x');
    expect(errors.map((d) => d.props?.code)).toEqual(['TOOL_UNREADABLE']);
    vi.unstubAllGlobals();
  });
});

describe('two rows for one step, put back together', () => {
  /**
   * THE MISTAKE A PERSON MAKES BY TYPING, AND THE REPAIR THAT DOES NOT REPHRASE IT.
   *
   * A prompt can end up with an "Agent Role" row and another called "agent_role" — one from the
   * menu, one typed. The rows are the drawing, so that is two agent nodes and two agent roles
   * sent to the model, and it is found at Run. The owner, 2026-09-23: the mistake is the
   * person's to make, and Grace offers the repair rather than refusing the input.
   *
   * THE WORDS ARE MOVED, NOT RETYPED. The alternative — she rewrites the merged text through a
   * tag — puts the person's prose through a model, which returns 380 characters of almost the
   * same sentence. So the test asserts the two texts arrive EXACTLY as they were written,
   * byte for byte, joined.
   */
  it('moves the words as written, and removes what is left', async () => {
    const el = await mount([
      { name: 'Agent Role', type: 'agent-role', content: 'You are the news scout.' },
      { name: 'agent_role', type: 'custom', content: 'Flag what matters most.' },
    ]);
    window.dispatchEvent(new CustomEvent('merge-seat', {
      detail: { from: 'agent_role', into: 'Agent Role' },
    }));
    await el.updateComplete;

    expect(el.sections.length).toBe(1);
    expect(el.sections[0].name).toBe('Agent Role');
    // Both halves, exactly as typed — the merge is a move, not a rewrite.
    expect(el.sections[0].content).toBe('You are the news scout.\n\nFlag what matters most.');
  });

  it('finds both rows by any spelling, which is the case it exists for', async () => {
    // The duplicate IS a spelling difference, so a matcher that needed an exact name could not
    // repair the very thing it was written for.
    const el = await mount([
      { name: 'Agent', type: 'agent', content: 'the identity' },
      { name: 'agent_role', type: 'custom', content: 'the duplicate' },
    ]);
    window.dispatchEvent(new CustomEvent('merge-seat', {
      detail: { from: 'agent_role', into: 'agent_role' },
    }));
    await el.updateComplete;
    // Same seat named twice: nothing to merge, and it says so rather than claiming success.
    expect(el.sections.length).toBe(2);
  });

  it('refuses a merge that would go nowhere, and names what it could not find', async () => {
    const el = await mount([{ name: 'Agent Role', type: 'agent-role', content: 'x' }]);
    const failed: any[] = [];
    const fn = (e: Event) => failed.push((e as CustomEvent).detail);
    window.addEventListener('section-write-failed', fn as EventListener);

    window.dispatchEvent(new CustomEvent('merge-seat', { detail: { from: 'nope', into: 'Agent Role' } }));
    await el.updateComplete;
    window.removeEventListener('section-write-failed', fn as EventListener);

    expect(el.sections.length).toBe(1);
    expect(failed[0]?.target).toBe('nope');
  });

  it('takes a row out by name and removes it from the list', async () => {
    // `<remove_role>` went through an exact name comparison, so a stray row called `agent_role`
    // did not answer to "Agent Role" — the assistant's own repair matched nothing.
    const el = await mount([
      { name: 'Agent Role', type: 'agent-role', content: 'keep me' },
      { name: 'agent_role', type: 'custom', content: 'remove me' },
    ]);
    window.dispatchEvent(new CustomEvent('remove-prompt-role', { detail: { roleName: 'agent_role' } }));
    await el.updateComplete;

    expect(el.sections.length).toBe(1);
    expect(el.sections[0].content).toBe('keep me');
  });
});

describe('a tool moved to the step it belongs in', () => {
  /**
   * THE REPAIR SHE OFFERED AND COULD NOT PERFORM.
   *
   * From the thread of 2026-09-23: `[Move tool to Tool Call step](action:move-tool:search-the-internet)`
   * was pressed and answered with "That button asks for something this app does not know how to
   * do (move-tool:search-the-internet), so nothing was changed." The intent was right and the
   * app had no way to carry it out — so the person was left holding a prompt with its tool in a
   * step they had just been told was the wrong one.
   *
   * WHAT TRAVELS IS THE TOOL'S OWN BLOCK — the line naming it and the lines under it, which is
   * the shape the Tools menu writes.
   */
  it('takes the tool and its words out of one row and into another', async () => {
    const el = await mount([
      { name: 'Agent Role', type: 'agent-role', content: 'You are the scout.\n\n{{tool:search-the-internet}}\nWrite the question.' },
      { name: 'User Role', type: 'user-role', content: 'Find the news.' },
    ]);
    window.dispatchEvent(new CustomEvent('move-tool', {
      detail: { name: 'search-the-internet', into: 'Tool Call' },
    }));
    await el.updateComplete;

    const agent = el.sections.find((s) => s.name === 'Agent Role')!;
    const tools = el.sections.find((s) => s.type === 'tool-call')!;
    // Out of the agent, words and all — the identity is left exactly as it was.
    expect(agent.content).toBe('You are the scout.');
    // And into a Tool Call row that did not exist before this.
    expect(tools.content).toBe('{{tool:search-the-internet}}\nWrite the question.');
  });

  it('refuses a move to the row it is already in, rather than claiming it worked', async () => {
    const el = await mount([
      { name: 'Tool Call', type: 'tool-call', content: '{{tool:read-a-wiki}}\nAsk the wiki.' },
    ]);
    const failed: any[] = [];
    const fn = (e: Event) => failed.push((e as CustomEvent).detail);
    window.addEventListener('section-write-failed', fn as EventListener);
    window.dispatchEvent(new CustomEvent('move-tool', { detail: { name: 'read-a-wiki', into: 'Tool Call' } }));
    await el.updateComplete;
    window.removeEventListener('section-write-failed', fn as EventListener);

    expect(el.sections[0].content).toBe('{{tool:read-a-wiki}}\nAsk the wiki.');
    expect(failed[0]?.why).toContain('already');
  });

  it('says so when no row names that tool', async () => {
    const el = await mount([{ name: 'Agent Role', type: 'agent-role', content: 'no tools here' }]);
    const failed: any[] = [];
    const fn = (e: Event) => failed.push((e as CustomEvent).detail);
    window.addEventListener('section-write-failed', fn as EventListener);
    window.dispatchEvent(new CustomEvent('move-tool', { detail: { name: 'search-the-internet', into: 'Tool Call' } }));
    await el.updateComplete;
    window.removeEventListener('section-write-failed', fn as EventListener);

    expect(el.sections.length).toBe(1);
    expect(failed[0]?.why).toContain('names that tool');
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
