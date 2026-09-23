/**
 * agentFlow — the repair, drawn as a graph the output column can render.
 *
 * WHAT THIS IS. When a Run happens in a repair package, the output column draws
 * the agentic flow: the note being repaired, the prompt's seats, and the steps the
 * run performs — as nodes with positions, joined by edges. This module is the
 * MODEL: a pure function from facts the app already holds to a graph. It draws
 * nothing and fetches nothing; the element that renders it is lit/agent-flow.ts.
 *
 * EVERY RUN DRAWS, and a repair is only the case that has a note at its head. Run in
 * the left column's footer runs the prompt the person built — that run has no finding,
 * so the flow starts at its own seats and shows the same steps. One builder, one
 * picture of the same process; see RepairFlowInput.finding.
 *
 * WHAT A NODE'S SHAPE KEYS OFF — never a label. promptSections.ts states the law
 * twice: "A diagram shape keys off id — a stable canonical string. Never off a
 * label" (:49), and the id field carries it again at :79. A label is presentation
 * and may be renamed by the person using the app, so a shape keyed on one would
 * change under a rename and two seats would trade pictures. Every seat node below
 * therefore carries the RESOLVED canonical id as `kind`, and the label only as the
 * text a person reads.
 *
 * AND WHAT CANNOT BE NAMED IS NOT GUESSED. promptSections.ts keeps an UNDECIDED
 * list with the rule "Anything here that also reaches a diagram is a reason not to
 * draw yet" (:163). Two values land there today — a free-form 'custom' row and an
 * AI-written name that a row's type can BE. This module draws such a row as an
 * `unresolved` node: its own words as the title, a badge that says so, and NO seat
 * shape claimed. It also lists every one of them on the graph, so the surface can
 * say out loud what it could not name. A row that is hidden would be worse than a
 * row that is ugly.
 *
 * ABSENT IS REPORTED, NEVER DECORATED. A step that cannot happen is not drawn —
 * there is no write node when the finding names no file — and each omission is
 * carried on the graph in `absent` with its reason, because a missing node in a
 * flow drawing reads as a step that succeeded.
 *
 * THE STATES ARE DERIVED FROM WHAT THE APP KNOWS, at the moment it knows it. A run
 * is one POST; the app sees the answer arrive, then what it itself wrote, then the
 * fresh check's verdict. Nothing here invents a state the app cannot observe: a
 * node with no known state stays 'idle', which is this app's rule for unset data
 * everywhere else (unset is not empty).
 */
import { SECTION_TYPES, normalizeSectionType, isUndecidedType } from './promptSections';

// ── the shapes ──────────────────────────────────────────────────────────────

/** Where a node came from. Three families, one canvas. */
export type FlowFamily = 'note' | 'seat' | 'step';

/** What a node's mark says. 'idle' claims nothing — it is the absence of news. */
export type FlowState = 'idle' | 'active' | 'done' | 'failed';

export interface FlowNode {
  /** Stable within one graph. `note:<finding id>` / `seat:<index>:<id>` / `step:<name>`. */
  id: string;
  family: FlowFamily;
  /**
   * The SHAPE this node draws as. A seat carries its canonical section id
   * (system-role, user-role, …), 'unresolved' when the row could not be named, a
   * step carries its own name, and a note carries the check that produced it.
   */
  kind: string;
  /** The words a person reads. Presentation — never the key. */
  title: string;
  subtitle?: string;
  state: FlowState;
  /** A short mark: a finding's level ('blocking' | 'advisory'), or 'unresolved'. */
  badge?: string;
  /** Top-left of the node box, in canvas units. Deterministic (see the layout below). */
  x: number;
  y: number;
}

export interface FlowEdge {
  from: string;
  to: string;
}

/** A note from the catalog check — the fields a graph needs, and no more. */
export interface FlowNote {
  id: string;
  check: string;
  component?: string | null;
  nodeId?: string | null;
  file?: string | null;
  level?: string | null;
}

/** One seat of the prompt being built, in the shape the editor and Run already use. */
export interface FlowSeatInput {
  name: string;
  type: string;
  content: string;
}

/**
 * What has happened to the run so far. Every field is optional because every field
 * is a fact that arrives later: the graph is rebuilt as they land, not authored once.
 */
export interface RepairRunFacts {
  /** The Run's request is in flight. */
  running?: boolean;
  /** The model's answer, when one arrived. 'error' is the app's own failure mark. */
  answer?: 'received' | 'error';
  /** The answer's first line — the RESULT line the repair prompt asks for. */
  answerLine?: string;
  /** A warning the server returned ABOUT THE TOOL CALL itself (shown as ⚠️ in chat). */
  toolWarning?: string;
  /** What the app actually wrote, from the apply response. The app's own report. */
  write?: { path: string; bytes?: number; backup?: string; linesBefore?: number; linesAfter?: number };
  /** The fresh check's verdict on this finding. Cleared means the report stopped deriving it. */
  verdict?: { cleared: boolean; sentence?: string };
}

export interface RepairFlowInput {
  /** The graph's own name, e.g. the repair package's title. */
  label: string;
  /**
   * The note the repair is for — the trigger at the head of the flow.
   *
   * ABSENT IS A REAL STATE, and the run that arrives with none is the ordinary one:
   * Run in the left column's own footer is a prompt being run, not a repair being
   * applied, so there is no finding to draw at the head and no note node exists. The
   * drawing then starts at the prompt's own seats and still shows every step the run
   * performs. It is not an error, and it is not the same as an empty graph.
   */
  finding?: FlowNote | null;
  /** The rest of the open notes (same file, when the caller scopes them). Drawn, unconnected. */
  notes?: FlowNote[];
  /** The prompt's seats, in the order they are stacked in the left column. */
  sections: FlowSeatInput[];
  /** The address the prompt names. Omit to derive it from the Tool Call seat; pass
   *  null only when you have looked and the prompt names none. */
  tool?: { name: string; nodeId?: string | null } | null;
  /** The run's facts, as far as they have arrived. */
  run?: RepairRunFacts;
}

export interface FlowGraph {
  label: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Rows that reached the diagram without a nameable seat (see UNDECIDED). */
  unresolved: string[];
  /** Steps deliberately not drawn, each with the reason. Absence is reported. */
  absent: Array<{ step: string; why: string }>;
}

// ── the layout ──────────────────────────────────────────────────────────────
// Deterministic on purpose: the same facts must draw the same picture, for the
// person looking at it twice and for the test asserting it. A left-to-right flow:
// the notes in a column at the left, the prompt's seats stacked beside them, then
// the run's steps in a row.
//
// THE TWO NUMBERS THAT MATTER, and they are here rather than in the element because
// they are GEOMETRY — where a node sits — not styling:
//
//   NODE_TILE  the drawn size of a node's tile
//   NODE_GAP   the space between two connected tiles: THREE GRID DOTS at the canvas's
//              24px dot pitch. The first drawing strung its nodes out with eleven dots
//              between them and the flow read as a map rather than a sentence; five was
//              better, three is what the owner settled on ("arrange the nodes closer"):
//              the flow has to read as one line of thought, and it has to be TIGHT
//              enough that the far end of it runs off the column on purpose.
//
// The element imports both, so a change here moves the drawing and the edges that
// join it in the same step.
export const NODE_TILE = 88;
export const NODE_GAP = 72;
const STEP = NODE_TILE + NODE_GAP;

/**
 * THE STAIRCASE. Read down the left, out to the right, down again — the configuration
 * the owner drew and asked for (2026-09-18): "these notes in this exact configuration".
 *
 * The rule that makes it work, and that the first layout got wrong: A STEP SITS BESIDE
 * ITS SOURCE, on the SAME ROW. The tool call is level with the Tool Call seat that names
 * it; the answer and everything after it are level with the Agent Role seat that asked
 * for them. Every step on the top row — which is what this did — drew a long S-curve up
 * the canvas from the seat that caused it, and the owner's word for that was "bizarre".
 * Short edges are not an aesthetic preference here; they are what the arrangement means.
 */
const NOTE_X = 0;
const NOTE_Y0 = 40;
const NOTE_GAP = STEP;

const SEAT_X = STEP;
const SEAT_Y0 = 40;
const SEAT_GAP = STEP;

/** The steps' column: one STEP right of the seats, and one STEP between each other. */
const STEP_X = SEAT_X + STEP;
const STEP_GAP = STEP;

/** One line of a seat's content, for the subtitle. Empty stays empty. */
function firstLine(content: string): string {
  const line = (content || '').split('\n').find((l) => l.trim()) ?? '';
  return line.trim().length > 64 ? line.trim().slice(0, 61) + '…' : line.trim();
}

/** What a step's mark says, from the facts that exist: failed, then done, then active. */
function stepState(facts: {
  failed?: boolean;
  done?: boolean;
  active?: boolean;
}): FlowState {
  if (facts.failed) return 'failed';
  if (facts.done) return 'done';
  if (facts.active) return 'active';
  return 'idle';
}

/** A seat's readable title: the canonical label when the row is named, else its own words. */
function seatLabel(id: string): string {
  return SECTION_TYPES.find((t) => t.id === id)?.label ?? id;
}

// ── the builder ─────────────────────────────────────────────────────────────

export function buildRepairFlow(input: RepairFlowInput): FlowGraph {
  const { label, finding, sections } = input;
  const run = input.run ?? {};
  const notes = input.notes ?? [];
  // The tool is DERIVED from the prompt's own address seat unless the caller knows
  // better, because that is the same text the app itself reads at Run to build
  // tool_calls (WritingAreaIndex.tsx:3285). One source, so the drawing cannot name a
  // call the run would not make. An explicit null means "there is no tool" — a
  // caller who has looked and found none, which is not the same as not having looked.
  /*
   * THE TOOLS, AND THE SEAT EACH ONE BELONGS TO.
   *
   * `input.tool` is the caller's own answer (the repair path knows the address it wrote); with no
   * answer, the prompt is read — every seat, not only the Tool Call one, because a tool the agent
   * uses may be written beside the agent. Each entry remembers WHERE, so the node is drawn on
   * that seat's row and the edge leaves that seat: the relationship is the point.
   */
  const tools: FlowTool[] =
    input.tool !== undefined
      ? input.tool
        ? [{
            name: input.tool.name,
            seatIndex: sections.findIndex((s) => {
              const raw = s.type || s.name;
              return !isUndecidedType(raw) && normalizeSectionType(raw) === 'tool-call';
            }),
            nodeId: input.tool.nodeId,
          }]
        : []
      : toolsFromSections(sections);
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const unresolved: string[] = [];
  const absent: Array<{ step: string; why: string }> = [];

  // Where the run has got to, in the app's own terms. One place, so the nodes below
  // cannot disagree about the same fact.
  const answered = run.answer === 'received';
  const errored = run.answer === 'error';
  const running = Boolean(run.running);

  // ── the notes: the trigger, and the rest of the open list ──
  // With no finding there is no trigger and no note node: a prompt run that came from
  // no repair starts at its own seats. The rest of the open list rides WITH a trigger
  // (it is the same file's other findings), so it too is absent when there is none.
  const noteNodes: FlowNode[] = (finding ? [finding, ...notes] : []).map((n, i) => ({
    id: `note:${n.id}`,
    family: 'note',
    kind: n.check,
    title: n.check,
    subtitle: n.component || n.file || '',
    badge: n.level === 'blocking' || n.level === 'advisory' ? n.level : undefined,
    // The note under repair carries the news; the others are open and idle. A note
    // is 'done' only when the fresh check stopped deriving it — never when a run
    // merely claimed so (settleRepairs decides, and it is fed by a real report).
    state:
      i === 0
        ? run.verdict
          ? run.verdict.cleared
            ? 'done'
            : 'failed'
          : running || run.write
            ? 'active'
            : 'idle'
        : 'idle',
    x: NOTE_X,
    y: NOTE_Y0 + i * NOTE_GAP,
  }));
  nodes.push(...noteNodes);

  // ── the seats: the prompt being built, in the order it is stacked ──
  const seatNodes: FlowNode[] = sections.map((s, i) => {
    const raw = s.type || s.name;
    const decided = !isUndecidedType(raw);
    const id = decideSeatId(raw);
    if (!decided) unresolved.push(s.name || String(raw));
    return {
      id: `seat:${i}:${id}`,
      family: 'seat' as FlowFamily,
      kind: id,
      title: decided ? seatLabel(id) : s.name || 'Unresolved row',
      subtitle: firstLine(s.content),
      badge: decided ? undefined : 'unresolved',
      // A seat is not a step: it is 'active' while the run is in flight and 'done'
      // once an answer exists, because that is the whole of what the app knows —
      // the prompt was executed. Nothing else is claimed about it.
      state: errored ? 'idle' : stepState({ done: answered, active: running }),
      x: SEAT_X,
      y: SEAT_Y0 + i * SEAT_GAP,
    };
  });
  nodes.push(...seatNodes);

  // ── the steps: what the run does ──
  //
  // Their ROW comes from the seat that causes them (see THE STAIRCASE): the tool call
  // level with the address seat that opens it, everything after the answer level with
  // the Agent Role seat that asked for it. Falling back to the drawn order keeps a
  // prompt with no such seat drawing sensibly instead of throwing.
  const seatRowY = (kind: string): number | null => {
    const seat = seatNodes.find((n) => n.kind === kind);
    return seat ? seat.y : null;
  };
  const lastSeatY = seatNodes.length ? seatNodes[seatNodes.length - 1].y : SEAT_Y0;
  const toolRow = seatRowY('tool-call') ?? SEAT_Y0 + SEAT_GAP * 2;
  const answerRow = seatRowY('agent-role') ?? lastSeatY;

  const stepNodes: FlowNode[] = [];
  let stepX = STEP_X;

  /*
   * ONE NODE PER TOOL, ON THE ROW OF THE SEAT THAT NAMES IT.
   *
   * The row is the whole of the relationship here: a tool beside the Agent Role sits level with
   * that seat, and the edge to it leaves that seat. A tool in the Tool Call seat keeps the row
   * this drawing has always given it. A tool whose seat cannot be found (the caller named one by
   * hand) falls back to the Tool Call row rather than being dropped — a named tool with no row
   * of its own belongs SOMEWHERE, and the row it would have had is the honest guess.
   */
  const toolNodes: FlowNode[] = tools.map((t, i) => {
    const row = t.seatIndex >= 0 && seatNodes[t.seatIndex] ? seatNodes[t.seatIndex].y : toolRow;
    return {
      // The single-tool id is unchanged, so a drawing saved against it still finds its node.
      id: tools.length > 1 ? `step:tool:${t.name}` : 'step:tool',
      family: 'step',
      kind: 'tool-call',
      title: t.name,
      subtitle: t.nodeId ? `figma node ${t.nodeId}` : '',
      state: stepState({
        failed: Boolean(run.toolWarning),
        done: answered && !run.toolWarning,
        active: running && !run.toolWarning,
      }),
      x: STEP_X + i * STEP_GAP,
      y: row,
    };
  });
  if (toolNodes.length) {
    stepNodes.push(...toolNodes);
    stepX += STEP_GAP * toolNodes.length;
  } else {
    absent.push({
      step: 'tool-call',
      why: 'the prompt names no tool, so no call is fired',
    });
  }

  const answerNode: FlowNode = {
    id: 'step:agent',
    family: 'step',
    kind: 'agent',
    title: 'Answer',
    subtitle: run.answerLine || '',
    state: stepState({ failed: errored, done: answered, active: running }),
    x: stepX,
    y: answerRow,
  };
  stepNodes.push(answerNode);
  stepX += STEP_GAP;

  // The write exists only where a file does: the app replaces a whole file, and a
  // finding that names none — or a run that has no finding at all — has nothing to
  // replace. Draw no node, say why. The file is read once into a local because the
  // finding itself may be absent, and `finding?.file` in a condition does not narrow
  // the finding for the uses below it.
  const writeFile = finding?.file ?? null;
  let writeNode: FlowNode | null = null;
  if (writeFile) {
    writeNode = {
      id: 'step:data',
      family: 'step',
      kind: 'data-insert',
      title: 'Data insert',
      subtitle: run.write
        ? `${run.write.path}${run.write.bytes !== undefined ? ` · ${run.write.bytes} bytes` : ''}`
        : writeFile,
      // The write follows an ANSWER, never the Run's flight: the app has nothing to
      // write until there is something to write, and a failed answer means no write
      // was attempted — 'failed' here would blame the write for the answer's error.
      state: stepState({
        done: Boolean(run.write),
        active: answered,
      }),
      x: stepX,
      y: answerRow,
    };
    stepNodes.push(writeNode);
    stepX += STEP_GAP;
  } else {
    absent.push({
      step: 'data-insert',
      why: 'the finding names no file, so there is nothing to write',
    });
  }

  // The check runs after a write and after nothing else; before that it has no
  // verdict to draw and no claim to make.
  const evaluationNode: FlowNode = {
    id: 'step:evaluation',
    family: 'step',
    kind: 'evaluation',
    title: 'Evaluation',
    subtitle: run.verdict?.sentence || (finding?.check ? `${finding.check} — re-run` : ''),
    state: stepState({
      done: run.verdict?.cleared === true,
      failed: run.verdict ? !run.verdict.cleared : false,
      active: Boolean(run.write) && !run.verdict,
    }),
    x: stepX,
    y: answerRow,
  };
  stepNodes.push(evaluationNode);
  nodes.push(...stepNodes);

  // ── the edges: what leads to what ──
  // The trigger leads the flow when there is one. Without it the seats lead, and with
  // neither the answer stands alone — an edge from a node that was not drawn would be
  // the drawing claiming a step nobody made.
  const trigger = noteNodes[0] ?? null;
  if (seatNodes.length) {
    if (trigger) edges.push({ from: trigger.id, to: seatNodes[0].id });
    for (let i = 1; i < seatNodes.length; i++) {
      edges.push({ from: seatNodes[i - 1].id, to: seatNodes[i].id });
    }
    // EACH TOOL HANGS OFF THE SEAT THAT NAMED IT — the relationship, drawn. A tool in the Agent
    // Role comes off the Agent Role; one in the Tool Call seat comes off Tool Call. (The old edge
    // looked for a Tool Call seat and gave up otherwise, so a tool written anywhere else was a
    // node with nothing leading to it.)
    tools.forEach((t, i) => {
      const source = t.seatIndex >= 0 ? seatNodes[t.seatIndex] : seatNodes.find((n) => n.kind === 'tool-call');
      if (source) edges.push({ from: source.id, to: toolNodes[i].id });
    });
    edges.push({ from: seatNodes[seatNodes.length - 1].id, to: answerNode.id });
  } else if (trigger) {
    // No seats: the note is all there is, and the run still answers.
    edges.push({ from: trigger.id, to: answerNode.id });
  }
  if (writeNode) edges.push({ from: answerNode.id, to: writeNode.id });
  // The check follows the write when there is one; without a write there is nothing
  // for it to check, and the edge would draw a step that cannot run.
  edges.push({ from: writeNode ? writeNode.id : answerNode.id, to: evaluationNode.id });

  return { label, nodes, edges, unresolved, absent };
}

/**
 * A row's canonical seat id, or 'unresolved' — never a guess.
 *
 * normalizeSectionType is the LENIENT reader: it normalises what it can and
 * preserves what it cannot, including the 'custom' fallback for a row with no type
 * at all. That fallback is exactly one of the UNDECIDED values, so the caller asks
 * isUndecidedType first and this runs only for rows that have a name to give.
 */
function decideSeatId(raw: unknown): string {
  return isUndecidedType(raw) ? 'unresolved' : normalizeSectionType(raw);
}

/**
 * THE KINDS A PERSON MAY DROP ON THE CANVAS — the prompt's own seats, in its own order.
 *
 * Derived from SECTION_TYPES rather than retyped, so the canvas and the prompt input
 * panel cannot drift apart: one declaration names the seats, and both views read it.
 * This is what "the nodes are directly related to the chat panel" means in code — the
 * alternate view offers the SAME vocabulary, not a second one.
 *
 * "Custom Role" is deliberately ABSENT: promptSections.ts keeps `custom` on its
 * UNDECIDED list ("a diagram keyed on it would draw rows it cannot name"), and a shape
 * keyed on an undecided value would claim a seat nobody declared. Retiring that entry
 * is a decision, and it is written down as AGENTIC_EDITOR/10-TODO.md W5.
 */
export const CREATABLE_KINDS: Array<{ kind: string; label: string; description: string }> =
  SECTION_TYPES.filter((t) => t.inMenu || t.sticky).map((t) => ({
    kind: t.id,
    label: t.label,
    description: t.description,
  }));

/** The address a repair prompt names, read from the Tool Call seat's own words. */
export function toolFromSections(sections: FlowSeatInput[]): { name: string; nodeId?: string | null } | null {
  const seat = sections.find((s) => {
    const raw = s.type || s.name;
    return !isUndecidedType(raw) && normalizeSectionType(raw) === 'tool-call';
  });
  if (!seat) return null;
  const name = /^\s*tool\s+(.+)$/m.exec(seat.content)?.[1]?.trim();
  if (!name) return null;
  const nodeId = /^\s*figma node\s+(\d+:\d+)\s*$/m.exec(seat.content)?.[1] ?? null;
  return { name, nodeId };
}

/** A tool a prompt names, and the seat that names it. */
export interface FlowTool {
  name: string;
  /** Which of `sections` carries it — the node's row, and the edge's source. */
  seatIndex: number;
  nodeId?: string | null;
}

/** The token a tool is named by — what the seat's own Tools menu writes. */
const TOOL_TOKEN = /\{\{tool:([A-Za-z0-9._-]+)\}\}/g;

/**
 * EVERY TOOL THE PROMPT NAMES, AND WHERE IT SAID SO.
 *
 * THE TOOL CALL SEAT WAS THE ONLY PLACE THIS LOOKED, and it was looking for the wrong thing
 * even there: the pattern is a repair prompt's `tool figma node 40000746:94` line, so a register
 * tool written as `{{tool:search-the-internet}}` — what the seat menu writes and what the
 * assistant writes when a person picks one — was invisible. Measured 2026-09-23 on a real
 * package: a tool named in the prompt, and the drawing reporting "the prompt names no tool".
 *
 * AND A TOOL MAY LEGITIMATELY SIT IN ANOTHER STEP. The owner: "you can put the tool in the agent
 * role if the agent is the one using the tool … it has to be represented in that diagram after
 * we run. That's the relationship that the prompt has to make." So this reports the SEAT too: the
 * node is drawn on that seat's row and the edge leaves that seat, which is the relationship drawn
 * rather than asserted.
 */
export function toolsFromSections(sections: FlowSeatInput[]): FlowTool[] {
  const found: FlowTool[] = [];
  (sections ?? []).forEach((seat, seatIndex) => {
    const content = String(seat?.content ?? '');
    const tokens = [...content.matchAll(TOOL_TOKEN)];
    if (tokens.length) {
      for (const m of tokens) found.push({ name: m[1], seatIndex });
      return;
    }
    // The repair prompt's own address line, kept for the one caller that still writes it: the
    // Tool Call seat holding "tool figma node …". Read per seat, so it reports the seat it is in
    // like every other tool.
    const legacy = toolFromSections([seat]);
    if (legacy) found.push({ name: legacy.name, seatIndex, nodeId: legacy.nodeId });
  });
  return found;
}
