/**
 * agentFlow — the repair, drawn from facts the app already holds.
 *
 * These are tests for a DRAWING RULE, not for a data structure, and the rule has
 * three parts that were each paid for somewhere else in this repo:
 *
 *   1. A shape keys off the canonical section id, never a label
 *      (promptSections.ts:49). So a seat node's `kind` is `agent-role`, not
 *      "Agent Role" — a person may rename the label and the picture must not move.
 *   2. A row that cannot be named is drawn as no seat, and SAID — never guessed
 *      (promptSections.ts:163, the UNDECIDED rule). The row still appears, because
 *      hiding a row is a worse lie than an ugly one, but it claims no shape.
 *   3. A step that cannot happen is NOT DRAWN, and the reason is carried
 *      (agentFlow.ts's `absent`). A missing node in a flow drawing reads as a step
 *      that succeeded, which is the failure this pins against.
 *
 * The rest asserts the states are the app's own facts and nothing more: the answer
 * arriving is `received`, the write is the apply response, and the verdict is the
 * fresh check — a run never marks itself done (SETTLE comes from a real report).
 */
import { describe, it, expect } from 'vitest';
import { buildRepairFlow, toolFromSections, type RepairFlowInput } from '@/shared/agentFlow';

const finding = {
  id: 'annotation-missing:prompt-container:40000954:23865',
  check: 'annotation-missing',
  component: 'prompt-container',
  nodeId: '40000954:23865',
  file: 'frontend/src/components/lit/prompt-input/prompt-container.ts',
  level: 'advisory',
};

/** The four seats a repair prompt is, in the order buildRepairSections stacks them. */
const sections = [
  { name: 'System', type: 'system', content: '' },
  { name: 'User', type: 'user', content: 'Provenance (required):\n"provenance": "verbatim"' },
  {
    name: 'Tool Call',
    type: 'tool-call',
    content: 'tool        figma.get_design_context\nfigma node  40000954:23865\nfile        frontend/src/components/lit/prompt-input/prompt-container.ts',
  },
  { name: 'Agent', type: 'agent', content: 'prompt-container: Add the annotation.\nRESULT: DONE' },
];

const input = (over: Partial<RepairFlowInput> = {}): RepairFlowInput => ({
  label: 'Repair — annotation-missing on prompt-container',
  finding,
  sections,
  tool: toolFromSections(sections),
  ...over,
});

describe('buildRepairFlow — the picture is the prompt and the run, keyed on ids', () => {
  it('draws the note, the seats in order, and the steps, joined head to tail', () => {
    const g = buildRepairFlow(input());
    const ids = g.nodes.map((n) => n.id);

    expect(ids).toEqual([
      'note:annotation-missing:prompt-container:40000954:23865',
      'seat:0:system-role',
      'seat:1:user-role',
      'seat:2:tool-call',
      'seat:3:agent-role',
      'step:tool',
      'step:agent',
      'step:data',
      'step:evaluation',
    ]);

    // The chain, in one assertion: note → seats → answer → write → check, with the
    // tool hanging off the address seat that opens it.
    expect(g.edges).toEqual([
      { from: 'note:annotation-missing:prompt-container:40000954:23865', to: 'seat:0:system-role' },
      { from: 'seat:0:system-role', to: 'seat:1:user-role' },
      { from: 'seat:1:user-role', to: 'seat:2:tool-call' },
      { from: 'seat:2:tool-call', to: 'seat:3:agent-role' },
      { from: 'seat:2:tool-call', to: 'step:tool' },
      { from: 'seat:3:agent-role', to: 'step:agent' },
      { from: 'step:agent', to: 'step:data' },
      { from: 'step:data', to: 'step:evaluation' },
    ]);
  });

  it('keys a seat shape on the canonical id and shows the label only as text', () => {
    const g = buildRepairFlow(input());
    const agent = g.nodes.find((n) => n.id === 'seat:3:agent-role')!;
    expect(agent.kind).toBe('agent-role');
    expect(agent.title).toBe('Agent Role');
    // The subtitle is the row's own first line, not a sentence composed here.
    expect(agent.subtitle).toBe('prompt-container: Add the annotation.');
  });

  it('draws a STAIRCASE: each step beside its source, on the same row', () => {
    // The owner's configuration, 2026-09-18. Every step on the top row drew a long
    // S-curve up the canvas; the rows are what make the edges short and the flow read.
    const g = buildRepairFlow(input());
    const at = (id: string) => g.nodes.find((n) => n.id === id)!;

    // Down the left: the seats stack, one row apart.
    const rows = ['seat:0:system-role', 'seat:1:user-role', 'seat:2:tool-call', 'seat:3:agent-role']
      .map((id) => at(id).y);
    expect(rows[1] - rows[0]).toBe(rows[2] - rows[1]);
    expect(rows[3] - rows[2]).toBe(rows[1] - rows[0]);

    // Out to the right: the tool call is level with the address seat that opens it,
    // and the answer with the Agent Role seat that asked for it.
    expect(at('step:tool').y).toBe(at('seat:2:tool-call').y);
    expect(at('step:agent').y).toBe(at('seat:3:agent-role').y);
    expect(at('step:data').y).toBe(at('step:agent').y);
    expect(at('step:evaluation').y).toBe(at('step:agent').y);

    // And each step is one column right of the one before it — no overlaps.
    expect(at('step:tool').x).toBeGreaterThan(at('seat:2:tool-call').x);
    expect(at('step:agent').x).toBeGreaterThan(at('step:tool').x);
    expect(at('step:data').x).toBeGreaterThan(at('step:agent').x);
    expect(at('step:evaluation').x).toBeGreaterThan(at('step:data').x);
  });

  it('is deterministic: the same facts draw the same picture', () => {
    expect(buildRepairFlow(input())).toEqual(buildRepairFlow(input()));
  });

  it('draws an unnameable row as no seat, says so, and never guesses a shape', () => {
    const g = buildRepairFlow(
      input({
        sections: [
          { name: 'System', type: 'system', content: '' },
          // The UNDECIDED case of promptSections.ts:165 — an AI-written name that a
          // row's type can literally BE. A diagram keyed on it would draw a seat
          // nobody declared, so this one claims none.
          { name: 'Hero Specs', type: 'Hero Specs', content: 'make it pop' },
        ],
      }),
    );
    const row = g.nodes.find((n) => n.family === 'seat' && n.title === 'Hero Specs')!;
    expect(row.kind).toBe('unresolved');
    expect(row.badge).toBe('unresolved');
    expect(g.unresolved).toEqual(['Hero Specs']);
    // Still drawn — a hidden row is a worse lie than an ugly one.
    expect(g.nodes.some((n) => n.id === 'seat:1:unresolved')).toBe(true);
  });

  it('omits the write when the finding names no file, and carries the reason', () => {
    const g = buildRepairFlow(input({ finding: { ...finding, file: null } }));
    expect(g.nodes.some((n) => n.kind === 'data-insert')).toBe(false);
    expect(g.absent).toEqual([
      { step: 'data-insert', why: 'the finding names no file, so there is nothing to write' },
    ]);
    // The check still happens; without a write it follows the answer directly,
    // rather than drawing an edge through a step that cannot run.
    expect(g.edges).toContainEqual({ from: 'step:agent', to: 'step:evaluation' });
  });

  it('omits the tool call when the prompt names no tool, and carries the reason', () => {
    const g = buildRepairFlow(input({ sections: sections.slice(0, 2), tool: null }));
    expect(g.nodes.some((n) => n.kind === 'tool-call' && n.family === 'step')).toBe(false);
    expect(g.absent).toContainEqual({
      step: 'tool-call',
      why: 'the prompt names no tool, so no call is fired',
    });
  });
});

describe('buildRepairFlow — the states are the app own facts, one await at a time', () => {
  it('says nothing while nothing has happened', () => {
    const g = buildRepairFlow(input());
    expect(g.nodes.every((n) => n.state === 'idle')).toBe(true);
  });

  it('runs: the seats and steps go active, and nothing claims to be done', () => {
    const g = buildRepairFlow(input({ run: { running: true } }));
    expect(g.nodes.find((n) => n.id === 'step:agent')!.state).toBe('active');
    expect(g.nodes.find((n) => n.id === 'step:tool')!.state).toBe('active');
    expect(g.nodes.find((n) => n.id === 'step:data')!.state).toBe('idle');
    expect(g.nodes.find((n) => n.id === 'step:evaluation')!.state).toBe('idle');
    // No step may be green while the run is in flight.
    expect(g.nodes.some((n) => n.state === 'done')).toBe(false);
  });

  it('an answer done is not a repair done: the note and the check stay open', () => {
    const g = buildRepairFlow(input({ run: { answer: 'received', answerLine: 'RESULT: DONE' } }));
    expect(g.nodes.find((n) => n.family === 'step' && n.kind === 'agent')!.state).toBe('done');
    expect(g.nodes.find((n) => n.kind === 'data-insert')!.state).toBe('active');
    // The claim "done" belongs to the fresh check, never to the answer.
    expect(g.nodes.find((n) => n.id.startsWith('note:'))!.state).toBe('idle');
    expect(g.nodes.find((n) => n.kind === 'evaluation')!.state).toBe('idle');
  });

  it('the write is the app own report, and the check the fresh verdict', () => {
    const g = buildRepairFlow(
      input({
        run: {
          answer: 'received',
          write: {
            path: 'frontend/src/components/lit/prompt-input/prompt-container.ts',
            bytes: 4211,
            backup: 'prompt-container.ts.backup.20260918_101500',
          },
          verdict: { cleared: true, sentence: 'the fresh check no longer finds it' },
        },
      }),
    );
    const data = g.nodes.find((n) => n.kind === 'data-insert')!;
    expect(data.state).toBe('done');
    expect(data.subtitle).toContain('4211 bytes');
    expect(g.nodes.find((n) => n.kind === 'evaluation')!.state).toBe('done');
    expect(g.nodes.find((n) => n.id.startsWith('note:'))!.state).toBe('done');
  });

  it('a tool warning marks the call, not the whole run', () => {
    const g = buildRepairFlow(
      input({ run: { running: true, toolWarning: 'figma node 40000954:23865 not found' } }),
    );
    expect(g.nodes.find((n) => n.id === 'step:tool')!.state).toBe('failed');
    expect(g.nodes.find((n) => n.id === 'step:agent')!.state).toBe('active');
  });

  it('a verdict that still derives the finding is a failed evaluation, not a quiet one', () => {
    const g = buildRepairFlow(
      input({
        run: {
          answer: 'received',
          write: { path: finding.file as string },
          verdict: { cleared: false, sentence: 'the fresh check still finds it' },
        },
      }),
    );
    expect(g.nodes.find((n) => n.kind === 'evaluation')!.state).toBe('failed');
    expect(g.nodes.find((n) => n.id.startsWith('note:'))!.state).toBe('failed');
  });

  it('an error answer fails the answer and writes nothing', () => {
    const g = buildRepairFlow(input({ run: { answer: 'error' } }));
    expect(g.nodes.find((n) => n.kind === 'agent' && n.family === 'step')!.state).toBe('failed');
    expect(g.nodes.find((n) => n.kind === 'data-insert')!.state).toBe('idle');
    expect(g.nodes.find((n) => n.kind === 'evaluation')!.state).toBe('idle');
  });
});

describe('buildRepairFlow — a run with no finding (the plain prompt run)', () => {
  // Run in the left column's own footer runs the prompt the person built: there is no
  // finding at the head and therefore no note. That is a REAL state, not an error, and
  // the drawing must start at the prompt's own seats rather than invent a note to lead
  // with — or, worse, draw an edge from a node nobody drew.

  it("starts at the prompt's own seats and draws the same steps", () => {
    const g = buildRepairFlow(input({ finding: null }));

    expect(g.nodes.some((n) => n.family === 'note')).toBe(false);
    expect(g.nodes.map((n) => n.id)).toEqual([
      'seat:0:system-role',
      'seat:1:user-role',
      'seat:2:tool-call',
      'seat:3:agent-role',
      'step:tool',
      'step:agent',
      'step:evaluation',
    ]);

    // The seats lead: the first edge joins the first seat to the second, not something
    // to a note that does not exist.
    expect(g.edges[0]).toEqual({ from: 'seat:0:system-role', to: 'seat:1:user-role' });

    // EVERY edge joins two nodes that were actually drawn. An edge from a missing node
    // reads as a step that happened, which is the same lie as a missing node reading as
    // a step that succeeded.
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it('has no file to write, and says so rather than drawing a write', () => {
    // The write exists only where a file does, and a file comes from a finding. Without
    // one there is nothing to replace, so the step is absent AND reported.
    const g = buildRepairFlow(input({ finding: null }));
    expect(g.nodes.some((n) => n.kind === 'data-insert')).toBe(false);
    expect(g.absent).toEqual([
      { step: 'data-insert', why: 'the finding names no file, so there is nothing to write' },
    ]);
  });

  it('with no seats either, the answer stands alone and the check still follows it', () => {
    const g = buildRepairFlow(input({ finding: null, sections: [], tool: null }));
    expect(g.nodes.map((n) => n.id)).toEqual(['step:agent', 'step:evaluation']);
    expect(g.edges).toEqual([{ from: 'step:agent', to: 'step:evaluation' }]);
  });

  it('does not draw the open note list without a trigger to carry it', () => {
    // `notes` is "the rest of the open list" — the same file's other findings. It rides
    // WITH a trigger; with none it is not a flow, and drawing them would put unrelated
    // notes at the head of a prompt that never mentioned them.
    const g = buildRepairFlow(input({
      finding: null,
      notes: [{ id: 'x', check: 'annotation-missing', component: 'chat-panel', file: 'a.ts' }],
    }));
    expect(g.nodes.some((n) => n.family === 'note')).toBe(false);
  });
});

describe('a tool is drawn where it was named, and joined to that seat', () => {
  /**
   * THE RELATIONSHIP THE OWNER ASKED FOR.
   *
   * "You can put the tool in the agent role if the agent is the one using the tool … it has to be
   * represented in that diagram after we run. That's the relationship that the prompt has to
   * make."
   *
   * The drawing previously read the Tool Call seat alone, and looked there for a repair prompt's
   * `tool figma node …` line — so a register tool written as `{{tool:search-the-internet}}`,
   * which is what the seat's own menu writes, was invisible ANYWHERE. Measured 2026-09-23: a
   * tool named in the prompt and a drawing reporting "the prompt names no tool".
   */
  const withToolIn = (seatName: string, seatType: string) => [
    { name: 'System Role', type: 'system-role', content: 'You are a precise assistant.' },
    { name: 'User Role', type: 'user-role', content: 'Find the news.' },
    {
      name: seatName,
      type: seatType,
      content: 'You are the news scout.\n\n{{tool:search-the-internet}}\nWrite the question you want answered.',
    },
  ];

  it('puts the node on the row of the seat that names it, whatever seat that is', async () => {
    const g = buildRepairFlow({ label: 'Scout', finding: null, sections: withToolIn('Agent Role', 'agent-role') });
    const tool = g.nodes.find((n) => n.id === 'step:tool');
    const agentSeat = g.nodes.find((n) => n.id === 'seat:2:agent-role');
    expect(tool).toBeTruthy();
    expect(tool!.title).toBe('search-the-internet');
    // Level with the seat that named it — the relationship is the row.
    expect(tool!.y).toBe(agentSeat!.y);
  });

  it('joins it to that seat, not to a Tool Call seat it does not use', async () => {
    const g = buildRepairFlow({ label: 'Scout', finding: null, sections: withToolIn('Agent Role', 'agent-role') });
    expect(g.edges).toContainEqual({ from: 'seat:2:agent-role', to: 'step:tool' });
  });

  it('still draws a tool in the Tool Call seat, off that seat', async () => {
    const g = buildRepairFlow({ label: 'Scout', finding: null, sections: withToolIn('Tool Call', 'tool-call') });
    expect(g.edges).toContainEqual({ from: 'seat:2:tool-call', to: 'step:tool' });
  });

  it('draws one node per tool when a prompt names several', async () => {
    const sections = [
      { name: 'System Role', type: 'system-role', content: 'x' },
      {
        name: 'Agent Role',
        type: 'agent-role',
        content: 'Scout.\n{{tool:search-the-internet}}\n{{tool:read-a-wiki}}',
      },
    ];
    const g = buildRepairFlow({ label: 'Scout', finding: null, sections });
    const ids = g.nodes.filter((n) => n.kind === 'tool-call').map((n) => n.id);
    expect(ids).toEqual(['step:tool:search-the-internet', 'step:tool:read-a-wiki']);
    expect(g.edges).toContainEqual({ from: 'seat:1:agent-role', to: 'step:tool:read-a-wiki' });
  });

  it('still reports an absent tool when the prompt really names none', async () => {
    const g = buildRepairFlow({
      label: 'Scout',
      finding: null,
      sections: [{ name: 'System Role', type: 'system-role', content: 'x' }],
    });
    expect(g.nodes.some((n) => n.kind === 'tool-call')).toBe(false);
    expect(g.absent.map((a) => a.step)).toContain('tool-call');
  });
});

describe('toolFromSections — the address the prompt itself names', () => {
  it('reads the tool and the Figma node out of the Tool Call seat', () => {
    expect(toolFromSections(sections)).toEqual({
      name: 'figma.get_design_context',
      nodeId: '40000954:23865',
    });
  });

  it('is null when the prompt names no tool — an empty seat, not an invented call', () => {
    expect(toolFromSections([{ name: 'Tool Call', type: 'tool-call', content: '' }])).toBeNull();
    expect(toolFromSections(sections.slice(0, 2))).toBeNull();
  });
});
