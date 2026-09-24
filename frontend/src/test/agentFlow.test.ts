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
import {
  buildRepairFlow,
  positionKey,
  rowForAddedNode,
  toolFromSections,
  NODE_FOOTPRINT,
  NODE_TILE,
  type FlowGraph,
  type FlowNode,
  type RepairFlowInput,
} from '@/shared/agentFlow';

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

    // EVERY ROW COMES OFF THE BRAIN, and no row follows another row. That chain is what the hub
    // replaced, so a chain reappearing here is the staircase coming back.
    const hub = 'seat:0:system-role';
    expect(g.edges).toContainEqual({ from: hub, to: 'seat:1:user-role' });
    expect(g.edges).toContainEqual({ from: hub, to: 'seat:2:tool-call' });
    expect(g.edges).toContainEqual({ from: hub, to: 'seat:3:agent-role' });
    expect(g.edges.some((e) => e.from === 'seat:1:user-role' && e.to === 'seat:2:tool-call')).toBe(false);
    expect(g.edges.some((e) => e.from === 'seat:2:tool-call' && e.to === 'seat:3:agent-role')).toBe(false);
    // The finding leads IN to the brain — it is what the prompt is being drawn about — and the
    // steps keep the relationships the builder derived.
    expect(g.edges).toContainEqual({
      from: 'note:annotation-missing:prompt-container:40000954:23865',
      to: hub,
    });
    expect(g.edges).toContainEqual({ from: 'seat:2:tool-call', to: 'step:tool' });
    expect(g.edges).toContainEqual({ from: 'seat:3:agent-role', to: 'step:agent' });
    expect(g.edges).toContainEqual({ from: 'step:agent', to: 'step:data' });
    expect(g.edges).toContainEqual({ from: 'step:data', to: 'step:evaluation' });
    // One edge per pair: the note leads to the hub once, not twice.
    const pairs = g.edges.map((e) => `${e.from}\u0000${e.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('keys a seat shape on the canonical id and shows the label only as text', () => {
    const g = buildRepairFlow(input());
    const agent = g.nodes.find((n) => n.id === 'seat:3:agent-role')!;
    expect(agent.kind).toBe('agent-role');
    expect(agent.title).toBe('Agent Role');
    // The subtitle is the row's own first line, not a sentence composed here.
    expect(agent.subtitle).toBe('prompt-container: Add the annotation.');
  });

  it('draws a HUB: the brain at the centre, the rows on a ring, the steps beyond them', () => {
    /**
     * THE OWNER'S OWN PICTURE, 2026-09-23: "There's a central brain that runs the prompt that
     * represents Grace… and then the nodes come off of that — in this case the system role is the
     * main driver, the brain of the agent." The hub is the one row the editor keeps sticky at
     * slot 0, so the drawing says what the data already enforces.
     *
     * A RING AND NOT A ROW is also the scaling answer: another node takes the next place around
     * the circle instead of making a line longer, and the radius grows with the count so two
     * tiles never touch however many arrive.
     */
    const g = buildRepairFlow(input());
    const at = (id: string) => g.nodes.find((n) => n.id === id)!;
    const hub = 'seat:0:system-role';
    const dist = (id: string) => Math.hypot(at(id).x - at(hub).x, at(id).y - at(hub).y);

    // THE BRAIN IS THE SYSTEM ROLE, and it holds the centre.
    expect(at(hub).x).toBe(0);
    expect(at(hub).y).toBe(0);

    // THE ROWS SIT ON ONE RING — the same distance from the brain, and never on top of it.
    const rows = ['seat:1:user-role', 'seat:2:tool-call', 'seat:3:agent-role'];
    for (const id of rows) expect(dist(id)).toBeGreaterThan(0);
    // Within two pixels: `ringPlace` rounds a place to whole pixels, so two rows at different
    // angles land a fraction of a unit apart. The invariant is "one ring", not "the same float".
    const sameRing = (a: string, b: string) => expect(Math.abs(dist(a) - dist(b))).toBeLessThan(2);
    sameRing('seat:2:tool-call', 'seat:1:user-role');
    sameRing('seat:3:agent-role', 'seat:1:user-role');
    // A note is on that ring too: a finding is what the prompt is being drawn about.
    sameRing('note:annotation-missing:prompt-container:40000954:23865', 'seat:1:user-role');

    // EVERYTHING BUT THE BRAIN SHARES THAT ONE BAND, steps included. The steps had a ring of
    // their own beyond the rows, and that is the shape the owner rejected: a ring's spacing is its
    // circumference over its count, so three steps stood 120° apart at the larger radius — 665
    // units between any two of them, a third of the picture. One band, and each step is inserted
    // beside the node it comes off, so a connector is a spoke or a single arc at most.
    const band = dist('seat:1:user-role');
    for (const n of g.nodes) {
      if (n.id === hub) continue;
      expect(dist(n.id)).toBeGreaterThan(band - 1.5);
      expect(dist(n.id)).toBeLessThan(band + 1.5);
    }

    // And no two nodes share a place.
    expect(new Set(g.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(g.nodes.length);
  });

  it('is deterministic: the same facts draw the same picture', () => {
    expect(buildRepairFlow(input())).toEqual(buildRepairFlow(input()));
  });

  /**
   * A PLACE THE PERSON SET IS THE DRAWING'S OWN FACT, AND A REBUILD DOES NOT TAKE IT AWAY.
   *
   * Position is the one exception the brief allows (CANVAS-AND-PROMPT.md §2), and its home is
   * `workspace.graph.nodes[].x/y`. The drawing is rebuilt from the rows at every await of a run,
   * so a saved place has to survive that rebuild — and a Run after a reopen is exactly that
   * rebuild, which is why these four tests exist rather than one.
   */
  describe('the place a person set is kept, not re-derived', () => {
    const at = (g: FlowGraph, id: string): { x: number; y: number } => {
      const n = g.nodes.find((node) => node.id === id)!;
      return { x: n.x, y: n.y };
    };

    it('keeps the moved node where it was left, and the ring untouched for everything else', () => {
      const first = buildRepairFlow(input());
      const moved = first.nodes.map((n) => (n.id === 'seat:2:tool-call' ? { ...n, x: -640, y: 275 } : n));
      const again = buildRepairFlow(input({ carried: moved }));

      expect(at(again, 'seat:2:tool-call')).toEqual({ x: -640, y: 275 });
      // A carried place is a place, not a nudge to the arrangement: every other node is exactly
      // where the ring put it, so one node moved is one node moved.
      for (const n of first.nodes) {
        if (n.id === 'seat:2:tool-call') continue;
        expect({ id: n.id, ...at(again, n.id) }).toEqual({ id: n.id, x: n.x, y: n.y });
      }
    });

    it('follows the ROW when its slot changes — the kind is the identity, the slot is not', () => {
      /*
       * A seat's id carries the row's ORDINAL (`seat:<i>:<kind>`), and the ordinal is not an
       * identity: reorder the stack, delete a row above, and the same row arrives under another
       * number. Keyed by id, the place a person chose stays behind and is worn by whichever row
       * moved into that slot — which is a picture that lies about what they did.
       */
      const before = buildRepairFlow(input());
      const dragged = before.nodes.map((n) => (n.id === 'seat:1:user-role' ? { ...n, x: 900, y: 90 } : n));
      // The same four rows with the User Role at the top: the row that was moved comes back as
      // seat:0, and the brain takes slot 1.
      const after = buildRepairFlow(input({
        sections: [sections[1], sections[0], sections[2], sections[3]],
        carried: dragged,
      }));

      const user = after.nodes.find((n) => n.kind === 'user-role')!;
      expect(user.id).toBe('seat:0:user-role');
      expect({ x: user.x, y: user.y }).toEqual({ x: 900, y: 90 });
      // And the brain did NOT inherit it: the place moved with the row, not with the number.
      const brain = after.nodes.find((n) => n.kind === 'system-role')!;
      expect({ x: brain.x, y: brain.y }).toEqual({ x: 0, y: 0 });
    });

    it('ignores a place for a node that is not on the canvas, and one that is not a place', () => {
      const plain = buildRepairFlow(input());
      const gone = [{ id: 'seat:9:reflection-role', family: 'seat' as const, kind: 'reflection-role', x: 40, y: 60 }];
      // A row the prompt no longer has: the place goes with it, and nothing wears it.
      expect(buildRepairFlow(input({ carried: gone }))).toEqual(plain);

      // A corrupt field in a stored package is not a place. NaN is the failure this prevents:
      // the node is drawn by the ring rather than at a coordinate that paints nothing.
      const corrupt = [{ id: 'seat:1:user-role', family: 'seat' as const, kind: 'user-role', x: NaN, y: 0 }];
      const user = buildRepairFlow(input({ carried: corrupt })).nodes.find((n) => n.kind === 'user-role')!;
      expect({ x: user.x, y: user.y }).toEqual(at(plain, 'seat:1:user-role'));
    });
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

  it('draws the node beside the row that named it, on the one band', async () => {
    const g = buildRepairFlow({ label: 'Scout', finding: null, sections: withToolIn('Agent Role', 'agent-role') });
    const tool = g.nodes.find((n) => n.id === 'step:tool');
    const agentSeat = g.nodes.find((n) => n.id === 'seat:2:agent-role');
    const hub = g.nodes.find((n) => n.kind === 'system-role')!;
    expect(tool).toBeTruthy();
    expect(tool!.title).toBe('search-the-internet');
    // THE RELATIONSHIP IS THE EDGE (asserted next), AND THE PLACE IS THE BAND. A tool used to sit
    // on a ring BEYOND the rows — "so the eye reads the prompt first and what it calls second" —
    // and that second ring is what stretched the drawing out: three steps 120° apart at a larger
    // radius are 665 units from each other whatever else is true (measured 2026-09-23, the
    // owner's "they're stretched out across the screen"). Now everything but the brain shares one
    // band and a step is inserted next to its parent, so the connector is an arc, not a crossing.
    const dist = (n: { x: number; y: number }) => Math.hypot(n.x - hub.x, n.y - hub.y);
    expect(Math.abs(dist(tool!) - dist(agentSeat!))).toBeLessThan(2);
    // And it is beside its seat, not across the picture: no further from it than two places on
    // the band (the band's own neighbour gap is the chord between adjacent places).
    const bandNodes = g.nodes.filter((n) => n.id !== hub.id);
    const neighbour = 2 * dist(agentSeat!) * Math.sin(Math.PI / bandNodes.length);
    const gap = Math.hypot(tool!.x - agentSeat!.x, tool!.y - agentSeat!.y);
    expect(gap).toBeLessThanOrEqual(2 * neighbour + 2);
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

describe('rowForAddedNode — a node added on the canvas IS a row in the prompt', () => {
  /**
   * THE ONE INVARIANT, at the only seam where it can be broken: "Every node action has a
   * prompt meaning, or it does not exist." A node whose row cannot be named is a picture
   * of a node, and the picture is the thing a person trusts most — so this either names
   * the row to write or refuses, and it never guesses.
   *
   * THE REFUSALS ARE AS MUCH THE POINT AS THE WRITE. 'already' is a refusal because the
   * one write available SETS a row's content, and a person dropping a node must never
   * erase words they cannot see — the rule the seat writers already hold ("AN EXISTING
   * SEAT IS APPENDED TO, NOT REPLACED"). A refusal is also where Grace earns her seat:
   * making a mistake on the canvas is allowed, and she is the one who says so.
   */
  it('names the row from the declaration, never from a label the drawing invented', () => {
    const rows = [{ name: 'System Role', type: 'system-role', content: 'x' }];
    expect(rowForAddedNode('constraints', rows)).toEqual({ section: 'constraints', label: 'Constraints' });
  });

  it('refuses a kind no seat is declared for — a row nobody agreed on', () => {
    expect(rowForAddedNode('not-a-seat', []).why).toBe('undeclared');
    expect(rowForAddedNode('', []).why).toBe('undeclared');
  });

  it('refuses a row the prompt already has, so a dropped node cannot erase text', () => {
    // A name is matched by MEANING, not spelling: this prompt stores the row as `system`
    // and the node names `system-role`, and they are one row.
    expect(rowForAddedNode('system-role', sections).why).toBe('already');
    expect(rowForAddedNode('agent-role', [{ name: 'Agent Role', type: 'agent-role', content: 'w' }]).why).toBe('already');
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

/**
 * ONE PLACE, ONE NAME — the key the element files a drag under is the same key the model looks a
 * carried place up by, and this is the rule both read. Two keys for one fact is what the repo's
 * own law calls drift (CANVAS-AND-PROMPT.md §5), so the rule is asserted directly rather than
 * only through the two callers that depend on it.
 */
/**
 * THE RING CLEARS A NODE, NOT A TILE — and this is the test that says so.
 *
 * The hub arrangement's whole claim is "two nodes never touch however many arrive". It was not
 * true, and nothing measured it: a ring's radius was floored at NODE_TILE (88) while a node draws
 * NODE_FOOTPRINT (142 — the tile plus the label block it hangs underneath), so the brain sat 88
 * from its first row and the two boxes ran through each other by 47px. Measured live on a 7-node
 * run 2026-09-23, the owner: "all of the nodes are like sitting on top of each other."
 *
 * The boxes here are the ones the element draws and the view fits (see startView/fit in
 * agent-flow.ts): a tile wide, a footprint tall, from the node's own x/y. Nothing overlaps, at
 * every ring size — so a change to the spacing that reintroduces the pile fails here rather than
 * on somebody's screen.
 */
describe('the hub ring clears a node at every size', () => {
  const box = (n: FlowNode) => ({
    id: n.id,
    x1: n.x, x2: n.x + NODE_TILE,
    y1: n.y, y2: n.y + NODE_FOOTPRINT,
  });

  const clashesIn = (g: FlowGraph): string[] => {
    const boxes = g.nodes.map(box);
    const clashes: string[] = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const overlaps = a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
        if (overlaps) clashes.push(`${a.id} overlaps ${b.id}`);
      }
    }
    return clashes;
  };

  // One extra row per ring size, from the plain run's seven nodes up to a busy flow.
  for (const extra of [0, 1, 2, 4, 6, 8]) {
    it(`lays out ${7 + extra} nodes with nothing on top of anything${extra ? '' : ' (the measured 7-node run)'}`, () => {
      const rows = [
        ...sections,
        ...Array.from({ length: extra }, (_, i) => ({
          name: `Custom ${i + 1}`, type: 'custom', content: `note ${i + 1}`,
        })),
      ];
      const g = buildRepairFlow(input({ finding: null, sections: rows }));
      expect(clashesIn(g)).toEqual([]);
    });
  }

  it('stands the hub a whole node from its first ring, not a tile', () => {
    const g = buildRepairFlow(input({ finding: null }));
    const hub = g.nodes.find((n) => n.family === 'seat' && n.kind === 'system-role')!;
    const others = g.nodes.filter((n) => n.id !== hub.id);
    // Every other node starts a footprint away or more: that is the floor the ring is built on.
    for (const n of others) {
      const dx = n.x - hub.x;
      const dy = n.y - hub.y;
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(NODE_FOOTPRINT);
    }
  });
});

describe('positionKey — which node a place belongs to', () => {
  it('files a slotted seat by its ROW, so the place survives a change of slot', () => {
    const seat = (id: string, kind: string) => ({ id, family: 'seat' as const, kind });
    expect(positionKey(seat('seat:0:system-role', 'system-role'))).toBe('seat:system-role');
    expect(positionKey(seat('seat:3:agent-role', 'agent-role'))).toBe('seat:agent-role');
  });

  it('files everything that has no slot by its own id', () => {
    // A row nobody could name has only its slot to distinguish it from the next one: two of
    // them must not share a place.
    expect(positionKey({ id: 'seat:1:unresolved', family: 'seat', kind: 'unresolved' })).toBe('seat:1:unresolved');
    // A step's id already names the step, a note's the finding, and a draft is its own node —
    // filing any of those by `kind` would give two nodes one place.
    expect(positionKey({ id: 'step:agent', family: 'step', kind: 'agent' })).toBe('step:agent');
    expect(positionKey({ id: 'note:1', family: 'note', kind: 'annotation-missing' })).toBe('note:1');
    expect(positionKey({ id: 'draft:2', family: 'seat', kind: 'user-role' })).toBe('draft:2');
  });
});
