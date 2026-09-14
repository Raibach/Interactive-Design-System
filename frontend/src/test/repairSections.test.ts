/**
 * The repair prompt: the correction, and nothing that repeats the rule.
 *
 * A finding exists because a check ran and failed. That verdict is why it is in the
 * queue, and the person who clicks Repair is looking straight at it — so restating it
 * in the prompt (the check's name, the finding's own sentence, why the app cannot
 * derive a value, who owns the work) is the noise this test refuses. What the four
 * seats carry is the CORRECTION: the values to write, the address they go to, and
 * what makes the repair finished.
 *
 * The failures worth guarding are silent ones — a section that reads well and says
 * nothing, or a field that arrives with no place to put it — so these assertions are
 * about presence AND absence, made on the assembled text rather than on a copy of it.
 */
import { describe, it, expect } from 'vitest';
import {
  buildRepairSections,
  REPAIR_DONE_LINE,
  REPAIR_FILE_UNREADABLE_NOTE,
} from '@/shared/repairSections';
import { CORE_ROLE_LABELS } from '@/shared/promptSections';
import type { RepairFinding } from '@/shared/repairMaterial';

/** The prompt as the page assembles it, keyed by seat — contents, not prose about them. */
const bySeat = (f: RepairFinding, fileText?: string) =>
  Object.fromEntries(buildRepairSections(f, fileText).map((s) => [s.name, s.content]));

const provenance: RepairFinding = {
  check: 'provenance-missing',
  component: 'prompt-input-section',
  nodeId: '40000746:94',
  file: 'frontend/src/components/lit/prompt-input/prompt-input-section.ts',
  what: 'No provenance block. Nothing marks which fields came from the design and which were invented.',
  fix: 'Add a "provenance" object marking each field verbatim or inferred.',
};

describe('the repair prompt carries the correction', () => {
  const seats = bySeat(provenance);

  it('states the change on the Agent seat, and what finishes the repair', () => {
    expect(seats.Agent).toContain('prompt-input-section');
    expect(seats.Agent).toContain('Add a "provenance" object marking each field verbatim or inferred.');
    // Verify, then done — the run is not the end of it; the check is.
    expect(seats.Agent).toContain(REPAIR_DONE_LINE);
  });

  it('puts the fields, and only the fields, on the User seat', () => {
    // The label line carries the state (`required`) and the label carries the field's
    // NAME — the whole seat, and nothing to read. The two answers the field can take are
    // not written here: they are the buttons in the chat (repairMaterial.repairAsk), and
    // the finding's own sentence, which is the verdict the check already printed, is on
    // this seat or any other.
    expect(seats.User).toBe('Provenance (required):');
    expect(seats.User).not.toContain('No provenance block.');
    expect(seats.User).not.toContain('type here');
    expect(seats.User).not.toContain('verbatim');
  });

  it('keeps the address, so the tool call Run makes is the one the prompt names', () => {
    expect(seats['Tool Call']).toContain('tool        figma.get_design_context');
    expect(seats['Tool Call']).toContain('figma node  40000746:94');
    expect(seats['Tool Call']).toContain('prompt-input-section.ts');
  });

  it('leaves the System seat empty, because the check already spoke', () => {
    expect(seats.System).toBe('');
  });

  it('is four seats under the names Run maps to core roles, in the order it reads them', () => {
    const sections = buildRepairSections(provenance);
    const names = sections.map((s) => s.name);
    expect(names).toEqual(['System', 'User', 'Tool Call', 'Agent']);
    expect(sections.map((s) => s.type)).toEqual(['system', 'user', 'tool-call', 'agent']);
    expect(sections.map((s) => s.position)).toEqual([0, 1, 2, 3]);
    // A seat Run does not recognise is a section dropped into custom_roles, which is
    // how a role silently stops reaching the model. Held to Run's own list, not a copy.
    expect(CORE_ROLE_LABELS).toEqual(expect.arrayContaining(names));
  });

  it('names the component on the correction when the finding carries one', () => {
    const seats2 = bySeat({ ...provenance, component: null });
    expect(seats2.Agent.startsWith('Add a "provenance"')).toBe(true);
  });
});

describe('the rule is not repeated back at the person', () => {
  it('never states the finding, the check, or who owns the work', () => {
    const all = buildRepairSections(provenance).map((s) => s.content).join('\n');
    expect(all).not.toContain(provenance.what!);
    expect(all).not.toContain('provenance-missing');
    expect(all).not.toContain('THE FINDING');
    expect(all).not.toContain('IT NEEDS');
    expect(all).not.toContain('WHO OWNS IT');
  });

  it('holds the same line for a check that needs a person and one that needs nobody', () => {
    const person: RepairFinding = {
      check: 'event-unheard',
      component: 'prompt-input-section',
      what: 'Dispatches "section-menu-select" and nothing listens — and it is not marked as a stub.',
      fix: 'Wire a listener, or mark it: // TODO(behavior): action undefined in Figma',
    };
    const mechanical: RepairFinding = {
      check: 'attr-hardcoded',
      component: 'role-tile',
      what: 'The expected-name constant is hardcoded.',
      fix: 'Match by regex and record what was seen.',
    };
    for (const f of [person, mechanical]) {
      const all = buildRepairSections(f).map((s) => s.content).join('\n');
      expect(all).not.toContain(f.what!);
      expect(all).toContain(f.fix!);
      expect(all).toContain(REPAIR_DONE_LINE);
    }
    // Nothing to type means an empty User seat — not a paragraph standing in for one.
    expect(bySeat(mechanical).User).toBe('');
  });

  it('falls back to what the check needs when the check wrote no fix of its own', () => {
    const needsOnly: RepairFinding = { check: 'component-missing', component: 'role-tile' };
    const seats = bySeat(needsOnly);
    expect(seats.Agent).toContain('role-tile');
    expect(seats.Agent).toContain('Needs ');
    // The need is stated as material to supply — never as a claim about what the app
    // could not derive, which is the sentence this flow was told to stop printing.
    //
    // Asserted of the NEED LINE rather than of the whole seat, because the seat now
    // also says WHO writes the corrected file — this app, once the answer hands the
    // file back (see shared/repairApply). That sentence is the point of the new flow;
    // what must never come back is a need phrased as a limitation.
    const needLine = seats.Agent.split('\n').find((l) => l.includes('Needs '));
    expect(needLine).toBeTruthy();
    expect(needLine).not.toContain('the app');
  });
});

describe('the answer is a verdict, in plain words', () => {
  const agent = bySeat(provenance).Agent;

  it('asks for one of three plain RESULT lines, then what changed', () => {
    // One fixed shape, in the same places every time, so the answer can be read off the
    // top line without parsing prose — the thing a person could not do when the seat said
    // "make the correction, then verify it".
    expect(agent).toContain('RESULT: DONE');
    expect(agent).toContain('RESULT: NOT DONE');
    expect(agent).toContain('RESULT: COULD NOT CHECK');
    expect(agent).toContain('WHAT CHANGED');
  });

  it('does not ask the model to verify the change it just made', () => {
    // The instruction this replaced — "Make the correction, then verify it. When it
    // holds, this finding is done." — came back as a run that opened "Correction
    // applied", printed its own "Verification:" from two strings it had just typed, and
    // closed "The finding holds." Both halves were the instruction read back, and it
    // never said whether the repair existed.
    expect(agent).not.toContain('verify it');
    expect(agent).not.toContain('When it holds');
    // And the claim is still banned — for a different reason now. A run cannot write a
    // file (the only tool it may call is a read), so "Correction applied in …ts:" was
    // printed over a file whose timestamp had not moved. What writes the file is THIS
    // APP, after the answer hands the whole file back, and the app is what says so.
    expect(agent).not.toContain('Correction applied');
    expect(agent).toContain('Do not claim a file was changed');
    // The verdict belongs to the check that runs after this one, and the seat says so.
    expect(agent).toContain('The next catalog check decides');
    // And WHAT CHANGED cannot describe an edit as done: it names where the change goes.
    expect(agent).toContain('the file the change goes in');
  });
});

describe('the seat carries the file the change goes in', () => {
  const fileText = [
    '/**',
    ' * prompt-input-section — one section of the composer.',
    ' */',
    'export class PromptInputSection extends HTMLElement {}',
    '',
  ].join('\n');

  it('puts the file as it is now in front of the model, under its path', () => {
    const agent = bySeat(provenance, fileText).Agent;
    expect(agent).toContain(
      'THE FILE AS IT IS NOW (frontend/src/components/lit/prompt-input/prompt-input-section.ts)',
    );
    expect(agent).toContain(fileText.trimEnd());
    expect(agent).toContain('Change nothing else.');
  });

  it('asks for the whole file back, over one FILE: line and one block', () => {
    // The app replaces a file with a file, so a fragment, a summary or a diff cannot
    // be applied — the seat says which three shapes NOT to answer in.
    const agent = bySeat(provenance, fileText).Agent;
    expect(agent).toContain('FILE: <the file path from the Tool Call section');
    expect(agent).toContain('must be the ENTIRE file');
    expect(agent).toContain('never a fragment, a summary or a diff');
  });

  it('says so when the file could not be read, and asks for COULD NOT CHECK instead', () => {
    // Nothing to replace means nothing to correct: a component name is not enough to
    // invent a component from, and the answer must say that rather than produce one.
    const agent = bySeat(provenance).Agent;
    expect(agent).toContain(REPAIR_FILE_UNREADABLE_NOTE);
    expect(agent).toContain('COULD NOT CHECK');
    expect(agent).not.toContain('THE FILE AS IT IS NOW');
  });
});

describe('the events the code fires are named once, on the seat that acts on them', () => {
  const annotated: RepairFinding = {
    check: 'annotation-missing',
    component: 'prompt-input-section',
    nodeId: '40000746:94',
    what: 'Node 40000746:94 ("prompt-input-section", INSTANCE) resolves but carries no annotation.',
    fix: 'Annotate the variant in Figma.',
    dispatchedEvents: ['section-collapse-toggle', 'section-content-input', 'section-menu-select'],
  };

  it('hands the person four open lines and nothing to read first', () => {
    const user = bySeat(annotated).User;
    expect(user.split('\n')).toEqual(['Data:', 'On click:', 'State:', 'A11y:']);
    expect(user).not.toContain('#');
    expect(user).not.toContain('optional');
    // What each line is FOR is said in the chat, once — not in the prompt, which the
    // model reads, and not under a label, where it would be read before typing.
    expect(user).not.toContain('type here');
  });

  it('tells the agent what to write, where, and from which lines', () => {
    const agent = bySeat(annotated).Agent;
    expect(agent).toContain('Annotate the variant in Figma.');
    expect(agent).toContain('prompt-input-section — Figma node 40000746:94');
    expect(agent).toContain('Data, On click, State, A11y');
    expect(agent).toContain(REPAIR_DONE_LINE);
  });

  it('names the measured events in the instruction, and never under a field', () => {
    const seats = bySeat(annotated);
    expect(seats.Agent).toContain(
      'The code already fires section-collapse-toggle, section-content-input, section-menu-select',
    );
    // Said once, in the seat that acts on it: the person's seat is slots, not prose.
    expect(seats.User).not.toContain('section-collapse-toggle');
    expect(seats.User).not.toContain('already fires');
  });

  it('says nothing about events when the finding measured none', () => {
    const agent = bySeat({ ...annotated, dispatchedEvents: [] }).Agent;
    expect(agent).not.toContain('already fires');
    expect(agent).toContain('Data, On click, State, A11y');
  });
});
