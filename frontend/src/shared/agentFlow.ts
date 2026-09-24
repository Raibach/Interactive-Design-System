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
import { SECTION_TYPES, normalizeSectionType, seatIdOf, declaredName } from './promptSections';
// A row's trigger is read from its own text, the same reader the row's element and the host use —
// so a seat's subtitle can say how it starts without a second copy of the fact anywhere.
import { triggerIn } from './triggers';

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
  /**
   * WHICH ROW OF THE PROMPT THIS NODE IS — its index in the rows the builder was given.
   *
   * A2UI's own rule, from Data-Binding.md: an action's `context` is a hand-picked VIEW of the data
   * model, and "a data reference is resolvable either by path in the data model or by value". The
   * host's write path is `/session/left_column/sections`, so a node that carries its index carries
   * the address of the row it stands for — and the host's edit becomes an update AT A PATH instead
   * of a name to be re-matched.
   *
   * THIS EXISTS BECAUSE MATCHING BY NAME FAILED TWICE IN ONE SESSION: a seat node wears the seat's
   * LABEL ("System Role") while the row's name is "System", so a title comparison matched nothing
   * and the canvas looked like a control that does nothing. A path cannot be misspelled.
   */
  rowIndex?: number;
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
  /**
   * WHERE THE PERSON PUT THE NODES, when the package remembers — the saved graph's own nodes
   * (WorkspaceState.graph.nodes), read on open. The arrangement below is the DEFAULT picture;
   * a node with a carried place keeps it (see FlowPosition). Absent means nobody has moved
   * anything, and the ring decides every place, exactly as before.
   */
  carried?: FlowPosition[];
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

/**
 * WHERE A NODE SITS, AS THE PACKAGE SAVED IT.
 *
 * POSITION IS THE ONE FACT THAT IS THE DRAWING'S, and this is the shape it travels in. The brief
 * (READ-ME/CANVAS-AND-PROMPT.md §2): "Every node action has a prompt meaning, or it does not
 * exist… The one genuine exception is position… It already has a home: the graph the package
 * saves carries workspace.graph.nodes[].x/y, written on Save." This is the read half of that
 * home — the saved nodes handed back to the builder, so a Run after a reopen arranges the picture
 * around the person's own layout instead of overruling it.
 *
 * A FEW FIELDS, NOT THE WHOLE NODE: a place needs to know WHICH node it is for, and nothing else
 * about it. The graph the save writes carries full nodes, which satisfy this shape.
 */
export interface FlowPosition {
  id: string;
  family: FlowFamily;
  kind: string;
  x: number;
  y: number;
  /**
   * TRUE WHEN A PERSON PUT IT THERE — a drag, or a module dropped from a port.
   *
   * The flag exists because a drawing and a choice looked identical in a saved package, and the
   * layout could not tell its own output from somebody's decision. Only a place that carries this
   * wins over the arrangement (see `arrangeAsHub`). A package saved before the flag existed has it
   * on nothing, so its places are treated as what they were: the layout's, read back.
   */
  moved?: boolean;
}

/**
 * WHICH NODE A PLACE BELONGS TO — and the answer is NOT always the id.
 *
 * A seat's id carries its SLOT: `seat:<index>:<kind>` (see the builder). A slot is not an
 * identity. Move a row up the stack, or delete the row above it, and the same row is handed back
 * as `seat:0` where the person dragged `seat:1` — keyed by id, their place stays behind and lands
 * on whichever row took the slot. Keyed by the DECLARED KIND, the place follows the row, which is
 * what a person means when they say they put the Tool Call over there.
 *
 * TWO THINGS KEEP THEIR ID, both for the same reason — their id is already the only name they
 * have: a row the builder could NOT name (every one of those is `seat:<i>:unresolved`, so a key of
 * `seat:unresolved` would give several rows one place), and everything that is not a slotted seat
 * (a note, a step, a draft the element made — none of their ids carry an ordinal).
 */
const SLOTTED_SEAT = /^seat:\d+:/;
/** The `kind` the builder gives a row it could not name. Here because positionKey reads it. */
const UNRESOLVED_SEAT = 'unresolved';

export function positionKey(n: { id: string; family: FlowFamily; kind: string }): string {
  if (n.family !== 'seat' || !SLOTTED_SEAT.test(n.id)) return n.id;
  if (n.kind === UNRESOLVED_SEAT) return n.id;
  return 'seat:' + n.kind;
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
export const NODE_TILE = 96;
export const NODE_GAP = 72;
const STEP = NODE_TILE + NODE_GAP;

/**
 * THE GRID, AND EVERY NUMBER THEY USE ON IT — read from their canvas, not chosen here.
 *
 * `app/utils/nodeViewUtils.ts` in the reference: `GRID_SIZE = 16`, and everything else is a
 * multiple of it — `DEFAULT_NODE_SIZE = [16*6, 16*6]` (96), `NODE_X_SPACING = 16*8` (128),
 * `DEFAULT_START_POSITION = [16*11, 16*15]`. `useCanvasLayout` spaces stacked rows by
 * `GRID_SIZE * 6` and subgraphs by `GRID_SIZE * 8`, and its own tests assert that every node it
 * places sits at a multiple of the grid.
 *
 * The owner, 2026-09-24: "please replicate their grid layout… the way the canvas lays out, the way
 * the nodes land by default — every single thing. I'm trying to do an exact replication of what
 * they've got."
 *
 * So this is the unit OUR canvas measures in from here: a node is six cells, a column is fourteen
 * (six for the node, eight for the gap), and a placed node lands ON the grid rather than wherever
 * a division happened to come out.
 */
export const GRID_SIZE = 16;
/** Their node: `GRID_SIZE * 6`. Ours was 88, which is not on their grid at all. */
const NODE_ON_GRID = GRID_SIZE * 6;
/** Their column step: the node plus `NODE_X_SPACING` (GRID_SIZE * 8). */
const COL_ON_GRID = NODE_ON_GRID + GRID_SIZE * 8;
/**
 * Their row step is `GRID_SIZE * 6` (96) — because in their node the LABEL IS INSIDE the 96px box.
 * Ours draws its label BELOW the tile (footprint 150 tall), so their exact number would overlap
 * ours by 54px on every row. Until our node wears its label inside the box as theirs does, the row
 * step is our own footprint snapped to their grid — on the grid, and honest about what we draw.
 */
const ROW_ON_GRID = GRID_SIZE * 10;
/** Their default start position, in cells: `[GRID_SIZE * 11, GRID_SIZE * 15]`. */
export const START_ON_GRID = { x: GRID_SIZE * 11, y: GRID_SIZE * 15 };

/** The column step, exported so a test can assert a step is ONE column from its seat. */
export const COLUMN_STEP = COL_ON_GRID;

/** A number snapped to their grid. Every position this module hands out goes through it. */
export function onGrid(value: number): number {
  // `+ 0` NORMALISES NEGATIVE ZERO: `Math.round(-0.4 / 16) * 16` is `-0`, and `-0` is not strictly
  // equal to `0` — a position that is arithmetically zero and fails an equality against zero. The
  // kind of fact that shows up in a test rather than on a screen, and worth not carrying at all.
  return Math.round(value / GRID_SIZE) * GRID_SIZE + 0;
}

/**
 * HOW TALL A NODE ACTUALLY DRAWS — the tile, plus the label block it hangs underneath itself.
 *
 * THE MODEL HAS TO KNOW THIS, AND IT DID NOT. Everything that places a node was measured in
 * tiles: a ring's radius was floored at NODE_TILE, so the hub stood 88 units from its first row
 * while a node draws 135 tall. Measured live on a 7-node run 2026-09-23: the brain and the row
 * above it overlapped by 47px, and every ring-to-ring step did the same — the owner: "all of the
 * nodes are like sitting on top of each other."
 *
 * THE NUMBER IS THE ELEMENT'S OWN, moved here rather than copied. `agent-flow.ts` has used 54 as
 * its label block in the fit and in the drag extent all along, and did NOT use it in its arrival
 * view — so one fact had four readers and one of them was reading a different fact. It lives in
 * THIS module because this is the module that decides where a node goes; the element imports it.
 */
const NODE_LABEL_BLOCK = 54;

/** What a node occupies: the tile, and the label block it draws below it. */
export const NODE_FOOTPRINT = NODE_TILE + NODE_LABEL_BLOCK;

/**
 * THE TRIGGER'S TILE — LARGER, AND A SQUARE, because theirs is.
 *
 * The owner, 2026-09-24, holding their canvas beside ours: "if their system role is a large
 * square, then make our system role a large square — by changing the shape you give the user
 * identity of what it is." Their canvas draws the node a workflow starts from bigger than the
 * rest, so its shape carries its job; ours were all one size, and the row everything hangs off
 * looked like every other row.
 *
 * IT LIVES HERE, WITH THE OTHER SIZES, and not in the element. Everything that PLACES a node
 * reads these numbers, so the trigger's size is a fact the placement has to know: with the
 * trigger 140 wide, a spoke 192 units away on a ring can overlap it by about 11px at 45 degrees
 * — the same pair of boxes on top of each other that the label block above was moved here to
 * end. `RING_STEP` is derived from both footprints for that reason.
 */
export const HUB_TILE = 140;

/** The trigger's own footprint: its larger tile plus the label block every node carries. */
export const HUB_FOOTPRINT = HUB_TILE + NODE_LABEL_BLOCK;

/**
 * THE HUB — one brain, and what comes off it. Read this before the row constants below.
 *
 * The arrangement is a hub with rings around it: the SYSTEM ROLE at the centre, every other row
 * on the first ring, and the run's steps on the ring beyond. The owner, 2026-09-23: "There's a
 * central brain that runs the prompt that represents Grace… and then the nodes come off of that —
 * in this case the system role is the main driver, the brain of the agent." The row ARE the
 * drawing, so this is not decoration: the hub is the one row the editor makes sticky (slot 0, and
 * `_removeSection`/`_moveSection` refuse to remove or displace it), which is the same fact the
 * picture is now drawn from.
 *
 * WHAT THE OLD ARRANGEMENT WAS, and why it changed: a staircase — notes down the left, the rows
 * chained to each other in stacked order, the steps out to the right. It read as one line of
 * thought, and a line has no brain in it: the second row was as much a driver as the first. A hub
 * says what is true, and it SCALES — the reason it is built as rings rather than a row is that a
 * node added anywhere (another row, another tool, and one day another agent) takes the next place
 * on a ring instead of making the line longer. The owner asked for that directly: "these canvases
 * can get really complicated with lots of agent activity going on coming out of that system role…
 * it might be something to think about where it's going to go and how it's going to scale while
 * you're building it now."
 *
 * THE RING GROWS WITH ITS COUNT, so two nodes never touch however many arrive: each node needs an
 * arc of its own around the circumference, and the radius is whatever holds them. Deterministic,
 * because the module's rule is that the same facts draw the same picture — for the person looking
 * twice and for the test asserting it.
 */

/**
 * ONE RING STEP — how far apart two nodes have to stand to be clear of each other, plus air.
 *
 * THE NUMBER IS A BOX PROBLEM, NOT A TILE PROBLEM. Two axis-aligned boxes 88 wide and 142 tall
 * cannot overlap once their centres are √(88² + 142²) ≈ 167 apart — AT ANY ANGLE, which is what a
 * ring needs: neighbours travel around the circumference so their separation sweeps every
 * direction, and the hub's spokes point every way too. Below that distance there is always some
 * angle where both axes come up short at once. Measured on a nine-node ring before this: two rows
 * stood 81 apart in x and 141 in y against a box of 88×142 — one pixel of overlap in each
 * direction, which is enough to read as a pile.
 *
 * It is BOTH the radial floor — the hub to a row, and one ring to the next — and the arc one node
 * needs around the circumference, because it answers one question: how much room a node takes.
 * The old floor was NODE_TILE (88) and the old arc NODE_TILE + 24 (112); both were the tile, so
 * the brain stood 88 from its first row while the two drew 142 tall and sat through each other —
 * the owner: "all of the nodes are like sitting on top of each other."
 *
 * The tests in agentFlow.test.ts assert this at every ring size, so a future tightening fails
 * there rather than on somebody's screen.
 *
 * AND IT NOW KNOWS ABOUT THE TRIGGER, which is the larger node: the distance that clears two
 * ordinary nodes does not clear an ordinary node and a trigger, because the trigger's half is
 * wider. Two half-boxes are clear at ANY angle once their centres are hypot(halfW, halfH) apart,
 * so the step is the larger of the two pairs — trigger-with-ordinary, and ordinary-with-ordinary.
 * Measured before this change: a 140-wide trigger and an 88-wide spoke 192 apart overlapped by
 * 11px on the diagonal, which is exactly the failure this constant exists to prevent.
 */
const RING_STEP =
  Math.ceil(
    Math.max(
      Math.hypot(NODE_TILE, NODE_FOOTPRINT), // two ordinary nodes
      Math.hypot((HUB_TILE + NODE_TILE) / 2, (HUB_FOOTPRINT + NODE_FOOTPRINT) / 2), // a trigger and one
    ),
  ) + 24;

/** The radius that holds `n` nodes clear of each other. */
function ringRadius(n: number): number {
  if (n <= 1) return RING_STEP;
  return Math.max(RING_STEP, (n * RING_STEP) / (2 * Math.PI));
}

/** Evenly spaced from the top, clockwise — so the first spoke is where a person looks first. */
function ringPlace(i: number, n: number, radius: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n);
  return { x: Math.round(radius * Math.cos(angle)), y: Math.round(radius * Math.sin(angle)) };
}

/**
 * ARRANGE THE BUILT NODES AS A HUB, and join the rows to the brain.
 *
 * A pass over what the builder produced rather than a rewrite of it: every node keeps the id,
 * family, kind and state it was given (which is what the edges, the selection and the tests are
 * about), and only where it SITS and what leads to it come from here.
 *
 * WHAT IT DOES TO THE EDGES, and this is the part that makes the picture say "brain": the chain
 * between one row and the next is REMOVED — that chain was the staircase's claim that each row
 * follows the last — and every row is joined FROM the hub instead. A note still leads IN to the
 * hub, because a finding is what the prompt is being drawn about. The steps keep the edges the
 * builder derived (each tool from the row that names it, the answer after the rows), because
 * those are the relationships the requirements document already fixes.
 */
function arrangeAsHub(
  nodes: FlowNode[],
  edges: FlowEdge[],
  carried?: FlowPosition[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const hub = nodes.find((n) => n.family === 'seat' && n.kind === 'system-role')
    ?? nodes.find((n) => n.family === 'seat');
  if (!hub) return { nodes, edges };

  /*
   * THE PERSON'S OWN PLACES, read first so they can win.
   *
   * A place is the drawing's fact (FlowPosition), and a rebuild is not a reason to take it away:
   * the ring is what the picture looks like when nobody has said otherwise. A place that is not a
   * pair of numbers is not a place — it is a corrupt field in a stored package, and the ring is
   * the honest answer to that rather than a node drawn at NaN.
   */
  const held = new Map<string, { x: number; y: number }>();
  for (const p of carried ?? []) {
    /*
     * ONLY A PLACE A PERSON MADE WINS — see `drawn` in agent-flow.ts for the measurement. A saved
     * package used to carry the LAYOUT's coordinates as though they were choices, so the ring
     * survived its own deletion: every package that had ever run handed back the circle and the
     * arrangement never got to draw. A place that does not say it was moved is the layout's own
     * output being read back to it, and the layout wins.
     *
     * The flag is additive: a package saved before it existed has no `moved` on any node, so those
     * places are ignored and the drawing is the arrangement — which is the honest answer for a
     * package whose positions nobody chose.
     */
    if (p && p.moved === true && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      held.set(positionKey(p), { x: p.x, y: p.y });
    }
  }

  const notes = nodes.filter((n) => n.family === 'note');
  const spokes = nodes.filter((n) => n.family === 'seat' && n.id !== hub.id);
  const steps = nodes.filter((n) => n.family === 'step');

  const at = new Map<string, { x: number; y: number }>();
  at.set(hub.id, { x: 0, y: 0 });
  /*
   * ONE BAND, NOT TWO — and the second ring was the whole of the problem.
   *
   * The steps used to sit on a ring BEYOND the rows ("the eye goes brain → rows → what happens").
   * That reads well with twelve nodes and badly with seven, because a ring's spacing is the
   * CIRCUMFERENCE divided by the count: three steps on their own ring stand 120° apart at
   * r = inner + step, so ANY two of them are 2·r·sin(60°) apart whatever else is true. Measured on
   * the package the owner was looking at, 2026-09-23: the answer sat at the top, the evaluation at
   * the lower right, and the edge between them was **665 units long — a third of the whole
   * picture**, with the tool's own edge 508 across the middle. His words: "the evaluation is way
   * at the bottom with a long line up to the top of the pyramid … they're stretched out across the
   * screen. They should be nicely stacked together with just a small connector line."
   *
   * On ONE band every edge is one of two things: a SPOKE from the brain (the radius), or an ARC
   * between neighbours (the chord, ~= the radius). For this package that is 214 and 186 units —
   * every connector short, and the whole drawing 516 × 570 instead of 754 × 718, so the arrival
   * view opens at 0.80 instead of 0.64 and the labels can be read.
   *
   * THE ORDER IS THE CHAIN'S. The rows keep their prompt order, and each step is inserted
   * immediately after the node it hangs off — so a tool stands beside the row that declares it,
   * and the answer and the evaluation follow on from there instead of being flung to the far side
   * of a bigger circle. Deterministic: same facts, same picture.
   */
  /*
   * ── THE LAYOUT IS THEIRS ──────────────────────────────────────────────────────────────
   *
   * The owner, 2026-09-24: "please replicate their grid layout — the way the canvas lays out, the
   * way the nodes land by default, all of it. Every single thing. I'm trying to do an exact
   * replication of what they've got." And before that, three times in three words: not a circle,
   * a horizontal rectangle, a horizontal triangular structure.
   *
   * Their canvas (`useCanvasLayout`) places a node's dependants one COLUMN to the right and
   * stacks siblings one ROW apart, with every position a multiple of GRID_SIZE — its own tests
   * assert that. So:
   *
   *   the seats   stand in the first column, stacked, the brain at their head;
   *   the steps   take one column each to the right, in the order the run performs them;
   *   a note      sits one column LEFT of the seats, at the head of the flow, which is what it is;
   *   everything  lands ON the grid (GRID_SIZE), because a placement off the grid is a placement
   *               a person cannot line up by eye.
   *
   * The ring is gone with this. It was this module's own invention — a hub with spokes — and it is
   * the thing the owner kept having to correct.
   */
  const seats = [hub, ...spokes];
  const midY = ((seats.length - 1) * ROW_ON_GRID) / 2;
  seats.forEach((n, i) => at.set(n.id, { x: onGrid(START_ON_GRID.x), y: onGrid(START_ON_GRID.y + i * ROW_ON_GRID) }));
  steps.forEach((s, i) => at.set(s.id, { x: onGrid(START_ON_GRID.x + (i + 1) * COL_ON_GRID), y: onGrid(START_ON_GRID.y + midY) }));
  notes.forEach((n, i) => at.set(n.id, { x: onGrid(START_ON_GRID.x - COL_ON_GRID), y: onGrid(START_ON_GRID.y + midY + i * ROW_ON_GRID) }));

  const arranged = nodes.map((n) => {
    const p = held.get(positionKey(n)) ?? at.get(n.id);
    return p ? { ...n, x: p.x, y: p.y } : n;
  });

  /*
   * THE EDGES ARE THE BUILDER'S OWN — THE FAN IS GONE WITH THE RING.
   *
   * This replaced the chain between rows with spokes from the hub: every row joined FROM the
   * System Role, because the picture was a brain with a ring around it and the spokes were what
   * said "brain". With the layout now theirs — the rows stacked in a column, the steps a column
   * to the right — those spokes became a fan crossing the whole drawing: lines over nodes and
   * under nodes, which is what the owner saw and called a mess.
   *
   * The reference's canvas is a CHAIN, and its edges are the workflow's own connections: each
   * node joins what follows it, so the lines run left to right and never cross the picture. That
   * is what the builder already derives (the rows in order, each tool from the row that names it,
   * the answer and the check after them), so nothing is added here and nothing is removed: the
   * edges are handed back as they came, deduplicated.
   */
  const seen = new Set<string>();
  const joined = edges.filter((e) => {
    const key = `${e.from}\u0000${e.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { nodes: arranged, edges: joined };
}
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
/**
 * The row's first line of prose, with the CAPABILITY TOKENS taken out.
 *
 * A node's subtitle is what a person reads under the tile, and a row's text may now begin with a
 * trigger token — `{{trigger:on-a-schedule}}\nFind the newest…`. That token is a fact the row
 * holds, not prose, so drawing it as the subtitle would put machine text where the sentence goes.
 * A tool token is left alone deliberately: the Tool Call seat's own subtitle has always shown
 * `{{tool:search-the-internet}}` (it is the row's point), and stripping it would hide the one line
 * that says what the seat calls.
 */
function firstLine(content: string): string {
  const prose = String(content || '').replace(/\{\{trigger:[A-Za-z0-9_-]+\}\}[ \t]*\n?/g, '');
  const line = prose.split('\n').find((l) => l.trim()) ?? '';
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
            seatIndex: sections.findIndex((s) => seatIdOf(s) === 'tool-call'),
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
    // THE NAME, THROUGH THE ONE READER — a saved row carries `{section, role, content}` and no
    // `type`, so reading `type || name` here drew the System and User rows of every saved package
    // as `custom` nodes with no seat claimed. See promptSections.declaredName.
    const seat = seatIdOf(s);
    const decided = seat !== null;
    const id = seat ?? UNRESOLVED_SEAT;
    if (!decided) unresolved.push(declaredName(s) || 'a row with no name');
    return {
      id: `seat:${i}:${id}`,
      family: 'seat' as FlowFamily,
      kind: id,
      // THE ADDRESS OF THE ROW THIS NODE IS — see the note on FlowNode.rowIndex. `i` is the index
      // in the rows this builder was handed, and every caller hands it the model's own list in
      // order, so this is the index in `/session/left_column/sections` as well.
      rowIndex: i,
      title: decided ? seatLabel(id) : declaredName(s) || 'Unresolved row',
      /*
       * WHAT THE ROW SAYS, AND HOW IT STARTS — the trigger first when the row has one.
       *
       * A trigger is a fact about the whole row rather than a line of its prose, and the node has
       * one subtitle to spend: leading with the trigger means the drawing answers "what starts
       * this?" at a glance, which is the question the reference canvas asks first. The prose
       * follows it, so nothing the person wrote disappears.
       */
      subtitle: triggerIn(s.content)
        ? `${triggerIn(s.content)!.name}${firstLine(s.content) ? ' · ' + firstLine(s.content) : ''}`
        : firstLine(s.content),
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

  // WHERE EVERYTHING SITS, AND WHAT LEADS TO THE BRAIN. The last word on both: the row
  // constants above seed a position and the arrangement then owns it, so there is one place
  // that decides the picture — EXCEPT for a place the person set and the package saved, which
  // the arrangement keeps (see FlowPosition and arrangeAsHub).
  const arranged = arrangeAsHub(nodes, edges, input.carried);
  return { label, nodes: arranged.nodes, edges: arranged.edges, unresolved, absent };
}

/**
 * A NODE ADDED ON THE CANVAS, READ AS THE ROW IT IS.
 *
 * THE ONE INVARIANT, at the only place it can be broken: "Every node action has a prompt
 * meaning, or it does not exist." A node whose row cannot be named is not a node — it is a
 * picture of one — so this returns the row to add, or the reason there is none, and the
 * caller writes the row or says the reason. It never guesses.
 *
 * THREE ANSWERS, AND TWO OF THEM ARE REFUSALS:
 *
 *   the row is added     the declaration's own id and label. The NAME comes from the
 *                        declaration and never from the drawing's label, because a node
 *                        whose name the prompt does not use is a second vocabulary.
 *   'undeclared'         the kind names no seat this app declares. A row invented for it
 *                        would be drawn with a shape nobody agreed on (see UNDECIDED in
 *                        promptSections).
 *   'already'            the prompt already has that row — so the node already exists and
 *                        there is nothing to add. This is a refusal rather than a write
 *                        because the only write available would SET the row's content, and
 *                        a person dropping a node must never erase text they cannot see.
 *                        (The rule the seat writers already hold: "AN EXISTING SEAT IS
 *                        APPENDED TO, NOT REPLACED.")
 *
 * A name is matched by MEANING, not spelling: `agent_role`, `agent role` and `agent-role`
 * are one row, and they are one node.
 */
export function rowForAddedNode(
  kind: string,
  rows: FlowSeatInput[],
): { section?: string; label?: string; why?: 'undeclared' | 'already' } {
  const wanted = normalizeSectionType(kind);
  const seat = SECTION_TYPES.find((t) => t.id === wanted);
  if (!seat) return { why: 'undeclared' };
  const present = (rows ?? []).some((r) => seatIdOf(r) === seat.id);
  // The label rides the refusal too: the refusal is something Grace says out loud, and she
  // has to be able to name the row that is already there.
  if (present) return { why: 'already', section: seat.id, label: seat.label };
  return { section: seat.id, label: seat.label };
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
  const seat = sections.find((s) => seatIdOf(s) === 'tool-call');
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
