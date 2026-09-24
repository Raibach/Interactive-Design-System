/**
 * flowReview — the pre-Run list, derived here instead of remembered by a model.
 *
 * WHY THIS TEST EXISTS. Watched on screen, 2026-09-23: the review asked for every unmet
 * requirement in one reply and the person got a slightly different subset each turn, with
 * "Add description" recurring after the description had been written. The requirement list
 * lives in READ-ME/FLOW-REQUIREMENTS.md, and §8 asks whether the mechanical checks should be
 * a model call at all. These tests pin the answer: the list is complete, ordered, and the same
 * twice — so the reply that carries it only has to explain it.
 *
 * The fixtures are the package from that transcript: a name, NO description, a filled Agent
 * Role, a stray `agent_role` row beside it, and the tool written into the Agent Role instead
 * of the Tool Call step.
 */
import { describe, it, expect } from 'vitest';
import {
  holdsRun,
  mechanicalRepairs,
  reviewFlow,
  runHoldingRepairs,
  type UnmetRequirement,
} from '@/shared/flowReview';
import type { FlowSeatInput } from '@/shared/agentFlow';

const ids = (list: UnmetRequirement[]): string[] => list.map((u) => u.id);

/** The register as the app reads it: what exists, and whether anything answers the name. */
const register = [
  { name: 'search-the-internet', kind: 'call', runner: 'news' },
  { name: 'read-a-wiki', kind: 'call', runner: 'wikipedia' },
  { name: 'capture-notes', kind: 'read', runner: null },
];

/** The four rows a repair prompt is — the shape the editor and Run already use. */
const clean: FlowSeatInput[] = [
  { name: 'System Role', type: 'system-role', content: 'You are a scout.' },
  { name: 'Agent Role', type: 'agent-role', content: 'Search the news and summarise the findings.' },
  { name: 'User Role', type: 'user-role', content: 'A topic arrives as a single line.' },
  { name: 'Tool Call', type: 'tool-call', content: '{{tool:search-the-internet}}' },
];

describe('reviewFlow — every unmet requirement, once, in one list', () => {
  it('names the transcript package\u2019s three blockers together, not one per turn', () => {
    const unmet = reviewFlow({
      title: 'Insurance News Scout',
      description: '',
      sections: [
        { name: 'System Role', type: 'system-role', content: 'You are a scout.' },
        { name: 'Agent Role', type: 'agent-role', content: 'Search the news.\n{{tool:search-the-internet}}' },
        { name: 'agent_role', type: 'agent_role', content: 'Move this text into the Agent Role above.' },
        { name: 'User Role', type: 'user-role', content: 'A topic arrives.' },
      ],
      register,
    });
    // I2 the missing description, T6 the row that stands twice, S5 the tool in the wrong step.
    // ALL THREE, and the Agent Role is filled so S1 is silent about it.
    expect(ids(unmet)).toEqual(['I2', 'T6', 'S5']);
    expect(unmet.every((u) => u.level === 'blocking')).toBe(true);
    // The stray row is caught by MEANING: `agent_role` and `Agent Role` are one seat.
    expect(unmet.find((u) => u.id === 'T6')?.why).toContain('agent_role');
    expect(unmet.find((u) => u.id === 'S5')?.repair).toMatchObject({ kind: 'move-tool', into: 'Tool Call' });
  });

  it('is the same list twice — the person watching cannot tell a nearly-finished prompt from a fresh one', () => {
    const input = {
      title: 'Scout',
      description: '',
      sections: clean.map((s) => (s.type === 'user-role' ? { ...s, content: '' } : s)),
      register,
    };
    expect(ids(reviewFlow(input))).toEqual(ids(reviewFlow(input)));
  });

  it('says nothing at all about a prompt that can run', () => {
    const unmet = reviewFlow({ title: 'Insurance News Scout', description: 'Reads the news.', sections: clean, register });
    expect(unmet).toEqual([]);
    expect(holdsRun(unmet)).toBe(false);
  });

  it('asks for the save first when the package has never been saved — and never Fix-all-saves it', () => {
    /**
     * THE HONEST ANSWER TO THE LOOP. A description is written AT SAVE, so a package that has
     * never been saved cannot be described; asking for the description anyway is what arrived in
     * every reply while the person watched. The ask is the save.
     */
    const unmet = reviewFlow({
      title: 'Insurance News Scout',
      description: '',
      saved: false,
      sections: clean,
      register,
    });
    expect(ids(unmet)).toEqual(['I4', 'I2']);
    expect(unmet[0].repair).toMatchObject({ kind: 'save', via: 'ask' });
    // NOT MECHANICAL: a press meant to tidy a prompt must not create packages in a library.
    expect(mechanicalRepairs(unmet)).toEqual([]);
  });

  it('does not accuse a package of being unsaved when the caller did not say', () => {
    // Absent is not false: a caller that has not looked must not be told to save something that
    // is already in the library.
    const unmet = reviewFlow({ title: 'Scout', description: 'Reads the news.', sections: clean, register });
    expect(ids(unmet)).not.toContain('I4');
  });

  it('holds the Run only for a blocking requirement — an advisory row is said, not enforced', () => {
    const sections = [...clean, { name: 'Constraints', type: 'constraints', content: '' }];
    const unmet = reviewFlow({ title: 'Scout', description: 'Reads the news.', sections, register });
    expect(ids(unmet)).toEqual(['S4']);
    expect(holdsRun(unmet)).toBe(false);
    // Advisory rows carry a real repair, but they may never hold a Run.
    expect(unmet[0].level).toBe('advisory');
    expect(unmet[0].repair).toMatchObject({ kind: 'remove-seat', seat: 'constraints', via: 'action' });
  });
});

describe('reviewFlow — the tools, read against the register', () => {
  it('blocks a tool that reaches out when nothing answers the name', () => {
    const unmet = reviewFlow({
      title: 'Scout',
      description: 'Reads the news.',
      sections: clean,
      register: [{ name: 'search-the-internet', kind: 'call', runner: null }],
    });
    expect(ids(unmet)).toEqual(['T2']);
    expect(unmet[0].why).toContain('search-the-internet');
  });

  it('blocks a name the register does not have — a step that cannot happen', () => {
    const unmet = reviewFlow({
      title: 'Scout',
      description: 'Reads the news.',
      sections: [{ ...clean[0] }, { ...clean[1] }, { ...clean[2] }, { name: 'Tool Call', type: 'tool-call', content: '{{tool:search-the-news}}' }],
      register,
    });
    expect(ids(unmet)).toEqual(['T1']);
    expect(unmet[0].repair).toMatchObject({ kind: 'replace-tool', name: 'search-the-news', via: 'words' });
  });

  it('claims nothing about tools when the register could not be read', () => {
    // An unreadable register is not an empty one: a review that said "no such tool" out of a
    // failed read would send the person to fix a name that was already right.
    const unmet = reviewFlow({ title: 'Scout', description: 'Reads the news.', sections: clean, register: [] });
    expect(ids(unmet)).toEqual([]);
  });
});

describe('reviewFlow — what Fix all may touch', () => {
  /**
   * THE LINE THIS PINS is the one that keeps the feature honest: a repair that needs WORDS is
   * never applied by a button. The words in a prompt are the person's — moving a tool and
   * merging a duplicate row are the app's business, writing the Agent Role is not.
   */
  it('separates the repairs a machine can make from the ones that need words', () => {
    const unmet = reviewFlow({
      title: 'Insurance News Scout',
      description: '',
      sections: [
        { name: 'Agent Role', type: 'agent-role', content: 'Search the news.\n{{tool:search-the-internet}}' },
        { name: 'agent_role', type: 'agent_role', content: 'Move this text up.' },
        { name: 'User Role', type: 'user-role', content: 'A topic arrives.' },
      ],
      register,
    });
    const mechanical = mechanicalRepairs(unmet);
    expect(ids(mechanical)).toEqual(['T6', 'S5']);
    expect(mechanical.every((u) => u.repair.via === 'action')).toBe(true);
    // And the one that is left is exactly the description, which is hers to write.
    const leftForWords = unmet.filter((u) => !mechanical.includes(u));
    expect(ids(leftForWords)).toEqual(['I2']);
    expect(leftForWords[0].repair.via).toBe('words');
  });

  /**
   * THE OFFER AND THE PRESS ARE ONE LIST, and this is the test that keeps them one.
   *
   * Apply all was unreachable for a session: the handler existed, the action name existed, and no
   * surface ever drew a button for it — so the repairs the app can make for itself could never be
   * worked and no Run ever got past them. Putting the button back is only half of it. A button
   * offered for a repair the press would not make is the same defect wearing the opposite mask:
   * the person presses it, the Run does not follow, and the control reads as broken. So the
   * offer asks `runHoldingRepairs` and the press asks `runHoldingRepairs`, and this pins that
   * what it answers is the narrow thing — blocking, and only the kinds the press handles.
   */
  it('answers the repairs a press of Apply all would actually make, and no others', () => {
    const unmet = reviewFlow({
      title: 'Insurance News Scout',
      description: '',
      sections: [
        { name: 'Agent Role', type: 'agent-role', content: 'Search the news.\n{{tool:search-the-internet}}' },
        { name: 'agent_role', type: 'agent_role', content: 'Move this text up.' },
        { name: 'User Role', type: 'user-role', content: 'A topic arrives.' },
        // An empty advisory row: its repair is `remove-seat`, which the press does NOT make.
        { name: 'Constraints', type: 'constraints', content: '' },
      ],
      register,
    });
    const applyable = runHoldingRepairs(unmet);
    expect(ids(applyable)).toEqual(['T6', 'S5']);

    // The advisory row's removal is deliberately NOT offered: it does not hold the Run, and a
    // press meant to clear the wall must not also tidy what nobody asked about.
    expect(mechanicalRepairs(unmet).map((u) => u.repair.kind)).toContain('remove-seat');
    expect(applyable.map((u) => u.repair.kind)).not.toContain('remove-seat');
    // Everything offered holds the Run — which is what makes "the Run follows by itself" true
    // once the press has finished.
    expect(applyable.every((u) => u.level === 'blocking')).toBe(true);
  });

  it('offers nothing on a prompt that has nothing wrong with it', () => {
    // The button is not drawn on a clean prompt, so a press can never be an empty gesture.
    const unmet = reviewFlow({ title: 'Scout', description: 'Reads the news.', sections: clean, register });
    expect(runHoldingRepairs(unmet)).toEqual([]);
  });
});

describe('reviewFlow — a SAVED row is read as the row it is', () => {
  /**
   * THE RUN THAT COULD NOT HAPPEN, in one fixture.
   *
   * These four rows came out of the browser on 2026-09-23, off the live Insurance News Scout
   * package, from the `run-requested` payload the review is handed — copied, not composed. Two of
   * them carry `{section, role, content}` and no `type`, which is what a saved row looks like.
   *
   * Read with `type || name`, both answered `''`; `''` is not `undecided` but `normalizeSectionType`
   * still falls back to `custom`, so the System and User rows became two rows with no name. The
   * review then said "There is no User Role" over a User Role with words in it, and reported the
   * pair as one row sent twice — both BLOCKING, both `via: 'words'`, so no button could clear them
   * and every Run was held. This is the test that fails if that reader ever comes back.
   */
  const liveSavedRows: FlowSeatInput[] = [
    {
      content: 'You are a precise, professional assistant.',
      section: 'System',
      role: 'System',
    } as unknown as FlowSeatInput,
    {
      content: 'Find the latest news about insurance — new products, regulation changes, major claims.',
      section: 'User',
      role: 'User',
    } as unknown as FlowSeatInput,
    {
      content: 'You are the Insurance News Scout: you find, filter, and summarise insurance news.',
      name: 'Agent',
      type: 'agent-role',
    },
    { content: '{{tool:search-the-internet}}', name: 'Tool Call', type: 'tool-call' },
  ];

  it('finds every seat the person can see, and holds nothing', () => {
    const unmet = reviewFlow({
      title: 'Insurance News Scout',
      description: 'Finds and summarizes the latest insurance news.',
      saved: true,
      sections: liveSavedRows,
      register,
    });
    // Nothing at all: four rows, every one of them named, filled, and appearing exactly once.
    expect(ids(unmet)).toEqual([]);
    expect(holdsRun(unmet)).toBe(false);
  });

  it('and it names the User Role row after the row, not after a fallback', () => {
    // The sentence the person reads is about THEIR row, so a row with no `type` is still spoken of
    // as the seat its `section` names — never as "a row", and never as "custom".
    const unmet = reviewFlow({
      title: 'Scout',
      description: 'Reads the news.',
      sections: [
        { content: 'what arrives', section: 'User', role: 'User' } as unknown as FlowSeatInput,
        { content: '', section: 'Constraints', role: 'Constraints' } as unknown as FlowSeatInput,
      ],
      register,
    });
    // S1 fires first because this fixture has no Agent Role at all; the row-naming is what this
    // test is about, and it is S4's sentence that carries it.
    expect(ids(unmet)).toEqual(['S1', 'S4']);
    const s4 = unmet.find((u) => u.id === 'S4')!;
    expect(s4.why).toBe('Constraints is present and empty, and an empty row reads as deliberate.');
    expect(s4.seat).toBe('constraints');
  });

  it('still catches a real duplicate, including one whose only name is its `section`', () => {
    // The bug was TWO rows becoming one seat. The requirement itself must still fire on two rows
    // that really are one seat — including when the duplicate arrives in the saved shape, which is
    // where the merge's own repair has to name it correctly or the writer finds nothing.
    const unmet = reviewFlow({
      title: 'Scout',
      description: 'Reads the news.',
      sections: [
        { content: 'the real one', section: 'Agent Role', role: 'Agent' } as unknown as FlowSeatInput,
        { content: 'the stray one', name: 'agent_role', type: 'agent_role' },
      ],
      register,
    });
    // Agent Role has words, and is the one the two stray spellings resolve to, so S1 is met —
    // what is left is the missing User Role, and the duplicate the merge exists to repair.
    expect(ids(unmet)).toEqual(['S2', 'T6']);
    const t6 = unmet.find((u) => u.id === 'T6')!;
    expect(t6.repair).toMatchObject({
      kind: 'merge-seat',
      from: 'agent_role',
      into: 'Agent Role',
      via: 'action',
    });
    // And the merge is a repair the app actually makes, so the offer and the press both have it.
    expect(ids(runHoldingRepairs(unmet))).toEqual(['T6']);
  });
});
