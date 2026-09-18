/**
 * The canvas, by itself — the playground at /canvas.html.
 *
 * WHY THIS PAGE EXISTS. The element is a portable unit (AGENTIC_EDITOR/08): one
 * property in, events out, nothing fetched, no app internals. So it can be worked on
 * with the editor, the shell and the design system all out of the picture — this page
 * imports the element and the model, and nothing else from the application.
 *
 * ── WHERE THIS PANEL IS GOING ───────────────────────────────────────────────
 *
 * The narration and the event list on the right are not the destination: they are the
 * WORKING EXAMPLE of the loop. In the application this section loads INSIDE GRACE'S
 * CHAT — one of the chat panel's simple slots, the same generic hole the Trace view
 * and the repair list are injected into — so the events the canvas emits arrive as
 * things she can speak about while the person keeps working the drawing. She is not
 * a blank box with a flashing cursor beside the canvas; she is the one saying what is
 * happening to it.
 *
 * ── THE ILLUSION, AND WHERE THE TRUTH IS ────────────────────────────────────
 *
 * "Play the run" walks the flow through the states a real run produces, one await at
 * a time (03-THE-REPAIR-FLOW.md), with a line of narration at each step. THE
 * NARRATION IS SCRIPTED — it is written by hand in this file, and the panel says so.
 * What is NOT scripted is the drawing: every step is a real call to buildRepairFlow
 * with the facts the app also holds at that moment, so the canvas animates because
 * the model changed, not because a picture was swapped. And the event list beside it
 * is whatever the element actually emitted while you touched it.
 *
 * Nothing about the chat integration is wired. This page is why it can be: the four
 * events a host must hear are all here, with the drawing beside them, and the open
 * question — what Grace should say — lives in AGENTIC_EDITOR/06.
 */
// THE PLUG-IN, as a container: it lays out the header, the drawing and her seat, and
// this page fills those slots below (see canvas.html). It draws no component of its own —
// an element whose template renders another element is nesting, and a surface cannot nest
// (AGENTS-instructions/Core-Concept.md). Importing it does not import the elements it
// hosts: those are imported next, because THIS page is the surface that emits them.
import './components/lit/agent-canvas';
import './components/lit/output-controls';
// THE FOOT, from the catalog. This page drew its own copy of the master's bar until the
// component existed; the strip below is now the component, and the demo's own chips ride in
// its slot. Importing it here is what defines it on this page.
import './components/lit/canvas-footer';
import './components/lit/agent-flow';
// THE REAL SEAT, from the component library. Not a mock-up of a chat: this is the
// same element the application mounts in its right column, with its own rail, thread
// and composer. It reads the same channel the app writes Grace's verdicts to
// (a2ui:system-message), so what this page demonstrates is the actual plumbing
// between the canvas and her, not an illustration of it.
import './components/lit/chat-panel';
// THE CONSOLE'S OWN REPAIR LIST — a portable element, inserted into her slot here. Not
// a rebuild of it: the same rows, marks, buttons and empty states the console mounts.
import './components/lit/chat-repair-actions';
import type { AgentFlow } from './components/lit/agent-flow';
import type { AgentCanvas } from './components/lit/agent-canvas';
import { buildRepairFlow, CREATABLE_KINDS, type FlowGraph, type RepairRunFacts } from './shared/agentFlow';
// The repair prompt's own builder and the finding shape — the SAME modules the app
// uses, so a repair opened here is the repair the application would have built.
import { buildRepairSections } from './shared/repairSections';
import { byUrgency, type CatalogFinding } from './shared/catalogHealth';

// ── the facts the demo stands on ────────────────────────────────────────────

/** A real finding from the last catalog run. */
const finding = {
  id: 'annotation-missing:prompt-container:40000746:6',
  check: 'annotation-missing',
  component: 'prompt-container',
  nodeId: '40000746:6',
  file: 'frontend/src/components/lit/prompt-input/prompt-container.ts',
  level: 'advisory',
};

const sections = [
  { name: 'System', type: 'system', content: '' },
  { name: 'User', type: 'user', content: 'Provenance (required):\n"provenance": "verbatim"' },
  {
    name: 'Tool Call',
    type: 'tool-call',
    content:
      'tool        figma.get_design_context\n'
      + 'figma node  40000746:6\n'
      + 'file        frontend/src/components/lit/prompt-input/prompt-container.ts',
  },
  { name: 'Agent', type: 'agent', content: 'prompt-container: Annotate the master in Figma.\nAdd Data / On click / State / A11y.' },
];

const label = 'Repair — annotation-missing on prompt-container';

/** The written-file facts: the shape the apply response returns. */
const written = {
  path: 'frontend/src/components/lit/prompt-input/prompt-container.ts',
  bytes: 4211,
  backup: 'prompt-container.ts.backup.20260918_101500',
  linesBefore: 96,
  linesAfter: 99,
};

// ── the run, played back ────────────────────────────────────────────────────

/**
 * One line per await of the real repair flow. `facts` is CUMULATIVE — each step is what
 * the app knows at that moment, which is exactly what the graph is a function of. `say`
 * is the demo's narration, scripted. `node` is WHICH NODE the line is about (the link),
 * and `note` is the small word it wears in the thread.
 *
 * `afterMs` is a GAP, not a timestamp: the player accumulates, so the sum is the run's
 * length. It was written as if it were cumulative and then added anyway, which made an
 * eight-second run take twenty — the kind of arithmetic that is invisible until you
 * count the lines on screen halfway through.
 */
const script: Array<{
  afterMs: number;
  facts: RepairRunFacts;
  say: string;
  node?: string;
  note?: string;
  /** What that await would move: the prompt carries the whole file, so the calls that
   *  read and rewrite it are the big ones. */
  tokens?: [number, number];
}> = [
  {
    afterMs: 0,
    facts: {},
    say: 'A note came in on prompt-container — the master in Figma carries no annotation. I have the node and the file; I have not touched anything yet.',
    note: 'note',
    tokens: [820, 240],
  },
  {
    afterMs: 900,
    facts: { running: true },
    say: 'Reading the file as it is now, so the change is made against the real thing and not against what I remember of it.',
    // The seats a repair prompt always has, in the order buildRepairSections lays them
    // down: System 0, User 1, Tool Call 2, Agent 3.
    node: 'seat:2:tool-call',
    note: 'prompt — the address',
    tokens: [2400, 180],
  },
  {
    afterMs: 1000,
    facts: { running: true },
    say: 'Opening the design context — node 40000746:6. The note is about the master, so that is where the answer has to point.',
    node: 'step:tool',
    note: 'tool call',
    tokens: [900, 640],
  },
  {
    afterMs: 1400,
    facts: { answer: 'received', answerLine: 'RESULT: DONE — annotate the master' },
    say: 'The design came back and the annotation is written into the prompt. Handing it to the app to place in the file.',
    node: 'step:agent',
    note: 'answer',
    tokens: [520, 1180],
  },
  {
    afterMs: 1300,
    facts: { answer: 'received', write: written },
    say: 'Wrote prompt-container.ts — 4,211 bytes, 96 lines to 99. The backup is kept and nothing else in the file moved.',
    node: 'step:data',
    note: 'data insert',
    tokens: [4100, 900],
  },
  {
    afterMs: 1300,
    facts: {
      answer: 'received',
      write: written,
      verdict: { cleared: true, sentence: 'the fresh check no longer finds it' },
    },
    say: 'Running the check again. It no longer derives this note — so this one is finished.',
    node: 'step:evaluation',
    note: 'evaluation',
    tokens: [700, 260],
  },
  {
    // AND THEN SHE ASKS. A flow that ends in a green tick nobody talks about is a
    // dashboard; the person is left holding it. This is the half of the loop the
    // canvas deliberately does not do: the question lives in the conversation.
    afterMs: 1200,
    facts: {
      answer: 'received',
      write: written,
      verdict: { cleared: true, sentence: 'the fresh check no longer finds it' },
    },
    say: 'Two more notes are open on this component. Want me to take the next one, or would you rather read what changed in prompt-container.ts first?',
  },
];

// ── the fixtures ────────────────────────────────────────────────────────────

const fixtures: Record<string, () => FlowGraph> = {
  'state · done': () =>
    buildRepairFlow({
      label,
      finding,
      sections,
      run: { answer: 'received', answerLine: 'RESULT: DONE', write: written, verdict: { cleared: true, sentence: 'the fresh check no longer finds it' } },
    }),
  'state · running': () => buildRepairFlow({ label, finding, sections, run: { running: true } }),
  'state · answered': () =>
    buildRepairFlow({ label, finding, sections, run: { answer: 'received', answerLine: 'RESULT: DONE — annotate the master' } }),
  'state · failed': () =>
    buildRepairFlow({
      label,
      finding,
      sections,
      run: {
        answer: 'received',
        toolWarning: 'figma node 40000746:6 not found — is the Figma file open?',
        write: { path: written.path, bytes: 4180 },
        verdict: { cleared: false, sentence: 'the fresh check still finds it' },
      },
    }),
  'state · a row nobody declared': () =>
    buildRepairFlow({
      label: 'Repair — with a row nobody declared',
      finding,
      sections: [
        { name: 'System', type: 'system', content: '' },
        { name: 'Hero Specs', type: 'Hero Specs', content: 'make it pop' },
        { name: 'Tool Call', type: 'tool-call', content: 'tool        figma.get_design_context' },
        { name: 'Agent', type: 'agent', content: 'Change it.' },
      ],
      run: { running: true },
    }),
  'state · nothing yet': () => ({ label: '', nodes: [], edges: [], unresolved: [], absent: [] }),
  'state · steps that cannot happen': () =>
    buildRepairFlow({
      label: 'A prompt with no tool and no file',
      finding: { id: 'x', check: 'annotation-prose', component: 'role-dropdown', level: 'advisory' },
      sections: [
        { name: 'System', type: 'system', content: '' },
        { name: 'Agent', type: 'agent', content: 'Write the annotation.' },
      ],
      run: {},
    }),
};

// ── the page ────────────────────────────────────────────────────────────────

/**
 * ?clean=1 hides the demo's own chrome (the fixtures bar, the conversations bar, the
 * tone switch) so the page shows only the two columns — the canvas and Grace. It is
 * the same page, the same events, the same loop: a recording aid, not a different
 * build. Nothing about the canvas or the seat changes. The canvas keeps its full
 * height either way — the strip is BELOW it, never over it.
 */
const CLEAN = location.search.includes('clean');

/**
 * ?real=1 — THE SAME PAGE WITH NOTHING HAND-FED ON IT ANY MORE.
 *
 * The first honest thing to say about this page: MORE OF IT IS ALREADY REAL THAN ITS
 * OWN LABEL CLAIMED. Opening it reads the LIVE catalog check (`/api/catalog/audit`),
 * takes the open findings, and builds each repair's prompt with the application's own
 * `buildRepairSections` — so the finding, the seats, the tool address and the drawing
 * are the application's, not a mock. What was ever hand-fed is the PLAYBACK: the
 * timings, the token counts and Grace's narration.
 *
 * This flag removes the second half from the room. The fixtures bar, the play button
 * and the reset button are gone (the chrome strips with them, like ?clean), the rail
 * offers only the views that are real (Chat and Trace), and what is left is the live
 * audit drawn as a flow. Pressing Play is impossible because the button does not
 * exist; nothing on screen can overwrite the real graph with a hand-fed one.
 *
 * It is still not the application's own Run path — that writes source files, and lives
 * in the app. This is the closest sighting available without writing anything: the
 * same model, the same builder, the same element, real data.
 */
const REAL = location.search.includes('real');

if (CLEAN || REAL) {
  const chrome = document.getElementById('foot') as HTMLElement | null;
  if (chrome) chrome.style.display = 'none';
}

const canvasHost = document.getElementById('canvas-host') as HTMLElement;
const fixturesHost = document.getElementById('fixtures') as HTMLElement | null;
const eventsHost = document.getElementById('events') as HTMLElement;
/** The foot: the ControlBar master's bar, as the catalog component. Its controls are the
 *  host's to answer — see the wiring at the end of this file. */
const foot = document.getElementById('foot') as (HTMLElement & { theme: string; running: boolean }) | null;

/**
 * THE THREE HALVES, FROM THIS PAGE'S OWN MARKUP. The container is the host; the header
 * and the drawing are ITS children in the "header" and "flow" slots, and her panel is the
 * "seat" — which is what makes this page a SURFACE and the container a container.
 * `canvasHost` is kept only to hide the whole thing under ?clean.
 */
void canvasHost;
const unit = document.getElementById('unit') as AgentCanvas;
const canvas = document.getElementById('flow') as AgentFlow;
// Mid-tone is the canvas's own default: this page does not set a theme.

// ── the seat's column: collapsed, like the console ─────────────────────────

/**
 * THE CHAT COLUMN'S OPEN/COLLAPSE BEHAVIOUR, THE CONSOLE'S OWN.
 *
 * Three gestures, one fact — the column's width — and they are kept in step here the way
 * `workspace-layout` keeps them in the app (that element owns the width there; this page
 * owns it here, because there is no workspace-layout in this shell):
 *
 *   the rail's active tab, clicked again   → collapse        (the rail says so itself)
 *   any other tab, clicked                 → expand          (a tab is a request to look)
 *   the spacer gripped and dragged         → the width follows the POINTER, and letting
 *                                            go at the floor leaves it collapsed
 *
 * The last one is the rule the app already paid for: a gripper derives its position from
 * where the pointer IS, not from how far it has travelled (TO-DO.md item 1), or the edge
 * drifts from the hand the moment anything reflows.
 */
/**
 * THE COLUMN IS THE CONTAINER'S NOW. Every line that used to live here — the rail width,
 * the 650 it expands to, the drag that follows the pointer, the guard that stops the
 * motion fighting the hand, and the five channels a gesture can end on — moved into
 * <agent-canvas> when it became the unit. This page keeps ONE fact: whether she is away,
 * and it keeps it only to restore it after a seat is replaced.
 *
 * The reason is the one this page paid for twice: a second copy of the same behaviour
 * drifts. The page had the 520ms arrival without the drag guard, so the column chased the
 * cursor; the container has both, and every host that uses it gets both.
 */
let seatCollapsedState = true;

/** The one writer here. The container owns the width and tells her panel; this page only
 *  remembers the state so a replaced seat does not slam a column somebody opened. */
function setSeatCollapsed(collapsed: boolean): void {
  seatCollapsedState = collapsed;
  unit.collapsed = collapsed;
}

window.addEventListener('collapse-toggle', (e) => {
  setSeatCollapsed(Boolean((e as CustomEvent).detail?.collapsed));
});
window.addEventListener('tab-change', (e) => {
  const tab = (e as CustomEvent).detail?.tab;
  if (tab) setSeatCollapsed(false);
});


// ── the seat, and its conversations ─────────────────────────────────────────

/**
 * THE LOADING CONTRACT THIS PAGE DEMONSTRATES: the canvas and Grace load TOGETHER.
 *
 * Starting a run loads her seat fresh — a new conversation, which is the cleanest way
 * to open one, and it is fast enough that nobody notices the reload. The conversation
 * that was there ROLLS UP rather than vanishing: its lines are kept, a chip appears in
 * the bar, and clicking that chip brings it back as the live one. So the person can
 * always go back, and the new conversation can pick up where the old one left off —
 * the roll-up line in the fresh seat is that continuation.
 */
interface Conversation { id: number; lines: string[] }

const history: Conversation[] = [];
let liveId = 0;
let nextConversationId = 1;

/** The seat's slot. The element inside it is replaced; the slot never moves. */
const initialChat = document.getElementById('chat') as HTMLElement;

/**
 * A fresh seat — the element REPLACED in the same slot, which is a real reload of
 * Grace and not a clear.
 *
 * HER PICTURE DOES NOT CHANGE. The element is the same component in the same column at
 * the same size, so a reload is invisible: she does not move, she is not compressed
 * into the canvas, and she is not redrawn as something else. All that changes is that
 * the thread starts empty, which is the whole point of loading her with the canvas.
 */
function makeSeat(keepTab = false): HTMLElement {
  const fresh = document.createElement('chat-panel') as HTMLElement & {
    collapsed: boolean;
    activeTab: string;
    allowedTabs: string;
    tracePrompt: boolean;
    conversationId?: string;
  };
  fresh.id = 'chat';
  // Open, and ON THE CHAT TAB: without these she loads to her rail and to whatever tab
  // her default is, which is right for a package with no conversation and wrong for a
  // page whose whole point is her talking.
  // THE CHAT COLUMN LOADS COLLAPSED — the console's behaviour, and the owner's
  // instruction for this view (2026-09-18): the canvas is what a person came for, she is
  // one click away, and the rail is what they click. `seatCollapsedState` is the column's
  // state, so a seat reloaded by a repair selection keeps whatever the operator set.
  fresh.collapsed = seatCollapsedState;
  // A CONVERSATION TO ATTRIBUTE TO. The seat marks token figures it cannot tie to a
  // conversation as `unattributed` on purpose — an honest rule, and the reason the footer
  // read "Tokens: unattributed" until this existed. In the application the id comes from
  // the package; here it comes from this page's own conversation list, which is the same
  // kind of thing at a smaller scale. One request follows from it
  // (/api/conversations/<id>/messages) and answers 404 on this page — silently, because
  // the loader returns on !ok and logs nothing.
  fresh.conversationId = `demo-conversation-${liveId}`;
  fresh.activeTab = 'chat';
  // NO PROMPT INJECTION FROM THE TRACE TAB. In the composer the Trace click posts the
  // Figma AI line into her thread by design; in THIS seat Trace is a plain view of the
  // canvas's events, and posting a question nobody asked is the automatic chatter the
  // owner asked to be rid of (2026-09-18).
  fresh.tracePrompt = false;
  // HER RAIL IS THE MENU, and the seat chooses which buttons it needs.
  //   Chat        — what she says about the work
  //   Trace       — the raw execution of this flow: what the canvas emitted, line by line
  //   Executions  — the runs of the flow, the newest first, and the one you pick
  //   Evaluations — the checks that JUDGE the flow (a placeholder; see 10-TODO.md)
  //   States      — the canvas in each situation, as SAMPLE data (the panel says so)
  // The canvas seat drops Approvals (packages and people, not this drawing) and the
  // other seats keep the rest. 'executions' is the button this page REUSED AND RENAMED
  // for the n8n view — a filler until the rail's taxonomy is settled.
  // ?real=1 offers only the views that are real: what she says, and the raw execution
  // of this flow. The runs, the judgements and the sample states are this page's own
  // fillers (see 10-TODO.md), and a page claiming nothing is hand-fed must not offer a
  // button that opens one.
  fresh.allowedTabs = REAL ? 'chat,trace' : 'chat,trace,executions,eval,states';
  // EVERY SLOTTED CHILD TRAVELS WITH THE RELOAD. They are the HOST's content — the
  // repairs list, the events, the runs, the evals, the states — slotted into her real
  // slots, and a reload of the seat must not leave them behind in the element it
  // replaced. Listing them one by one is how the repairs panel was orphaned the first
  // time; the list is gone, the rule is not.
  // The panel is the container's "seat" child, so the replacement happens in that slot:
  // the new panel takes the old one's place among the container's light-DOM children.
  const old = document.getElementById('chat') as (HTMLElement & { activeTab?: string }) | null;
  // A REPLACED SEAT KEEPS THE TAB *ONLY WHEN THE CONVERSATION IS THE SAME ONE*. Reopening a
  // conversation must not throw away the view the pick just moved to; a NEW conversation must
  // start on Chat, because that is where the narration lands. Keeping it unconditionally was
  // a real bug and an invisible one (owner, 2026-09-18: "Grace did not reply when I played
  // the run — there was no output in Grace"): the pick had left the panel on Trace, the
  // fresh panel inherited Trace, and every line she said went into the thread behind it.
  const previousTab = (keepTab ? (old?.activeTab as 'chat' | 'trace' | undefined) : 'chat') ?? 'chat';
  if (old) {
    for (const child of Array.from(old.children)) fresh.appendChild(child);
    old.replaceWith(fresh);
  } else {
    initialChat.appendChild(fresh);
  }
  fresh.setAttribute('slot', 'seat');
  /*
   * THE REPLACEMENT KEEPS THE VIEW IT REPLACED. A fresh panel is born on Chat — and this
   * page replaces the panel on every new conversation, so the tab a person was looking at
   * was thrown away with the old element. Measured 2026-09-18, picking a conversation moved
   * the panel to Trace (its own rule) and this swap put it straight back to Chat.
   *
   * Same law as `collapsed` below: a seat that is replaced must not change what the person
   * was looking at. The pick survives the swap because the swap is an implementation detail
   * of the demo, not something they did.
   */
  fresh.activeTab = previousTab;
  // And the trace panels this page draws are its own; the panel only knows its tab.
  if (previousTab === 'trace') showView('trace');
  else showView('chat');
  // AND THE COLUMN FOLLOWS THE FLAG. The container owns the width and reads `collapsed`
  // — one fact, one writer, which is what this page stopped being when the unit took the
  // column.
  setSeatCollapsed(seatCollapsedState);
  return fresh;
}

function currentConversation(): Conversation {
  const found = history.find((c) => c.id === liveId);
  if (found) return found;
  const c: Conversation = { id: nextConversationId++, lines: [] };
  history.push(c);
  liveId = c.id;
  return c;
}

/**
 * THE DEMO'S OWN HISTORY, IN HER OWN CONTROL.
 *
 * This used to draw a row of chips into the footer: a second list of conversations, in the
 * page's chrome, beside the one the panel already has. The owner's question (2026-09-18)
 * named the problem exactly: "these conversations — aren't these conversations that are
 * supposed to go into the chat?"
 *
 * Yes. A conversation is a chat conversation, and the panel owns the control for them: it
 * draws `conversations` as rows in its own dropdown beside the thread, and picking one
 * dispatches `conversation-change`. So the demo feeds THAT — one list, one control, the real
 * one — and the page keeps only the bookkeeping (which conversation is live, and how many
 * lines it holds).
 */
function renderConvoChips(): void {
  const chat = document.getElementById('chat') as (HTMLElement & { conversations?: unknown[] }) | null;
  if (!chat) return;
  chat.conversations = history.map((c) => ({
    id: String(c.id),
    title: `conv ${c.id} · ${c.lines.length}`,
    live: c.id === liveId,
  }));
}

/**
 * A new conversation, with the previous one rolled up and named.
 *
 * The roll-up line goes through the same channel as everything else, so it appears in
 * her own thread: she says what the last conversation ended with, and where to find
 * it. Nothing is deleted — the page keeps every conversation's lines.
 */
function startConversation(): void {
  const previous = history.filter((c) => c.id !== liveId && c.lines.length > 0).at(-1);
  const c: Conversation = { id: nextConversationId++, lines: [] };
  history.push(c);
  liveId = c.id;
  makeSeat(false);   // a new conversation opens on Chat — see makeSeat
  renderConvoChips();
  if (previous) {
    const last = previous.lines[previous.lines.length - 1] ?? '';
    speak(
      `New conversation. The last one (${previous.lines.length} line${previous.lines.length === 1 ? '' : 's'}) `
      + `is kept — conv ${previous.id} in the bar — and it closed with: "${last.slice(0, 110)}${last.length > 110 ? '…' : ''}"`,
    );
  }
}

/** Bring an earlier conversation back as the live one, lines and all. */
function reopenConversation(id: number): void {
  const c = history.find((x) => x.id === id);
  if (!c || c.id === liveId) return;
  liveId = c.id;
  makeSeat(true);    // the SAME conversation, in a fresh element: keep the view the pick chose
  for (const line of c.lines) speak(line, { record: false });
  renderConvoChips();
}

function setFlow(flow: FlowGraph, refit: boolean): void {
  canvas.flow = flow;
  if (refit) {
    // BLOWN UP AT THE BEGINNING, not fitted to everything: the canvas opens at reading
    // size on the first nodes and the person PANS THROUGH the flow. Fit (the ⛶ button,
    // or the 0 key) is what shows the whole shape, whenever they want it.
    requestAnimationFrame(() => canvas.startView());
  }
}

/**
 * WHICH READING HER RAIL IS SHOWING.
 *
 * Chat shows her thread and no panel. Trace shows the canvas's own events, line by line.
 * Executions shows the runs: the list, and the one picked. One slot, three readings of
 * the same flow — which is why the buttons are view switches rather than destinations.
 */
function showView(tab: string): void {
  const events = document.getElementById('events-panel') as HTMLElement | null;
  const execs = document.getElementById('executions-panel') as HTMLElement | null;
  const evals = document.getElementById('eval-panel') as HTMLElement | null;
  if (events) events.hidden = tab !== 'trace';
  if (execs) execs.hidden = tab !== 'executions';
  if (evals) evals.hidden = tab !== 'eval';
  const states = document.getElementById('states-panel') as HTMLElement | null;
  if (states) states.hidden = tab !== 'states';
  if (tab === 'executions') renderExecutions();
}

window.addEventListener('tab-change', (e) => {
  const tab = String((e as CustomEvent).detail?.tab ?? 'chat');
  showView(tab);
});

// ── the narration and the events ────────────────────────────────────────────

let eventCount = 0;
/**
 * THE BLANK ONES ARE NEWS TOO.
 *
 * A seat with nothing written in it used to pass in silence: the drawing showed an empty
 * tile and Grace said nothing, so the demo's most likely first move — open a blank prompt,
 * run it — produced a picture and a quiet chat (owner, 2026-09-18: "it doesn't engage Grace
 * at all… we need to send her a notification for blank nodes and tell her to load a section
 * in the chat that represents them just like they would if they were filled with something,
 * but simply just say they're blank — would you like to work on this one?").
 *
 * So each blank seat gets a turn: the node's own name as the turn's LABEL (which is what
 * makes it clickable — the turn carries the node's id and points the canvas at it), the
 * sentence that says nothing is written yet, and the question. The card is the same card
 * the filled ones get; only the words differ, because an empty seat is a state, not a fault.
 */
function speakBlankSeats(): void {
  const graph = canvas.flow;
  if (!graph) return;
  const blanks = (graph.nodes || []).filter(
    (n) => n.family === 'seat' && !String(n.subtitle || '').trim(),
  );
  for (const node of blanks) {
    speak(
      `"${node.title}" is blank — nothing has been written in this seat yet. Want to work on this one?`,
      { nodeId: node.id, label: node.title },
    );
    noteEvent('blank-seat', { nodeId: node.id, kind: node.kind });
  }
}

function noteEvent(name: string, detail: unknown): void {
  if (eventCount === 0) eventsHost.innerHTML = '';
  eventCount += 1;
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const code = document.createElement('code');
  code.textContent = name.replace('flow-', '');
  li.append(`${time} `, code, ` ${JSON.stringify(detail)}`);
  eventsHost.prepend(li);
  while (eventsHost.children.length > 60) eventsHost.lastElementChild?.remove();
  // The disclosure stays rolled up; the count on its summary is what says it is alive.
  const counter = document.getElementById('events-count');
  if (counter) counter.textContent = String(eventCount);
}

/**
 * One line in Grace's own seat, through the app's own door.
 *
 * a2ui:system-message is the channel `speakRepairVerdict` uses in the application —
 * the one that puts "Wrote prompt-container.ts — 4,211 bytes…" in front of a person
 * after a real repair. Using it here means the demo shows the real wire: the canvas
 * and the conversation are joined by the app's own plumbing, not by a lookalike.
 */
function speak(text: string, opts: { record?: boolean; nodeId?: string; label?: string } = {}): void {
  if (opts.record !== false) {
    currentConversation().lines.push(text);
    // Keep the bar honest as she talks: a chip that says 0 while her thread fills up
    // is a number nobody re-measured, which is the drift this repo keeps catching.
    renderConvoChips();
  }
  window.dispatchEvent(new CustomEvent('a2ui:system-message', {
    detail: { role: 'assistant', content: text, nodeId: opts.nodeId, label: opts.label },
  }));
}

/**
 * THE LINK, BOTH WAYS — one fact, two views pointing at it.
 *
 *   a turn clicked            → the canvas puts that node under the person's eyes
 *                               (focusNode centres and selects it)
 *   a node selected           → the turn about it is marked and scrolled to
 *
 * Neither view reaches into the other: the turn raises `turn-click`, the canvas raises
 * `flow-select`, and the wiring between them is here, in the host — where the two are
 * known to each other. That is the "interconnected play" the owner asked for
 * (2026-09-18), and the reason every line she says states which node it is about.
 */
// THE LINK IS THE UNIT'S NOW. A clicked turn bringing its node into view, a picked node
// marking the turn about it and opening her — both live in <agent-canvas>, because it is
// the thing that holds the drawing and the seat. This page hears the same events and does
// what only IT can: write them into the trace panel below her, and move the readout.

// Everything the page shows arrives through these listeners — the same wire a host
// gets, so the page demonstrates the contract rather than describing it.
window.addEventListener('flow-select', (e) => {
  const detail = (e as CustomEvent).detail as { nodeId?: string | null };
  noteEvent('flow-select', detail);
  // The highlight, the open and the focus are the container's (see above): it is the half
  // of the page that knows both slots. What is left here is this page's own business —
  // the trace line, and the readout below.
  // AND READING A NODE COSTS SOMETHING, so the readout moves while the person explores:
  // pick a seat and its own prompt text is counted. Once per package per node — a thing
  // read twice is not work done twice.
  const picked = detail?.nodeId ?? null;
  if (picked && !countedNodes.has(picked)) {
    const est = estimateFor(picked);
    if (est) {
      countedNodes.add(picked);
      addUsage(est[0], est[1], new Date().toLocaleTimeString('en-US', { hour12: false }));
    }
  }
  // AND THE COLUMN'S TOP SAYS WHAT IS SELECTED. This is the output-header-area
  // (Figma 40001085:1553) doing what the design put it there for — a status readout —
  // with the canvas's own subject in it. A PLACEHOLDER: what belongs here for real is
  // the open question in AGENTIC_EDITOR/09, and this is the shape of it, not the answer.
  paintStatus(detail?.nodeId ?? null);
});

/**
 * The readout at the top of her column, for whatever is selected on the canvas.
 *
 * The design's own line is "Analyzing: Session 222 | supportCustomerSession — Duration:
 * 28.495s | Closed QA: 89.38%" — three facts a person watching a run wants: WHICH thing,
 * what it is DOING, and HOW it was judged. The same three, drawn from the drawing: the
 * node's title, its kind, and its state. Empty when nothing is selected, and the bar hides
 * itself when it is empty (see chat-header: a status with nothing to say takes no space).
 */
function paintStatus(nodeId: string | null): void {
  const chat = document.getElementById('chat') as (HTMLElement & { statusText?: string }) | null;
  if (!chat) return;
  if (!nodeId) {
    chat.statusText = '';
    return;
  }
  const node = canvas.drawn.nodes.find((n) => n.id === nodeId);
  if (!node) {
    chat.statusText = '';
    return;
  }
  const state = node.badge === 'unsaved' ? 'unsaved draft' : node.state;
  chat.statusText = `${node.title} | ${node.kind} — State: ${state}`;
}
window.addEventListener('flow-node-moved', (e) => noteEvent('flow-node-moved', (e as CustomEvent).detail));
window.addEventListener('flow-connect', (e) => noteEvent('flow-connect', (e as CustomEvent).detail));
window.addEventListener('flow-action', (e) => {
  const detail = (e as CustomEvent).detail as Record<string, unknown>;
  // THE VIEW'S OWN GESTURES ARE NOT NEWS. Zooming and fitting change what the person
  // is looking at, not what the flow is doing — one line per wheel notch would bury
  // the events that matter under the ones that do not. The application's host filters
  // them for the same reason.
  const action = String(detail.action || '');
  if (action === 'zoom' || action === 'fit') return;
  noteEvent('flow-action', detail);
});

/**
 * THE CANVAS ANNOUNCES ITSELF, AND SHE ANSWERS — the loop this page exists to show.
 *
 * When the element is handed a graph it says what it holds: the label, the counts,
 * and anything it could not name or did not draw. That summary is what the CHAT
 * populates from — Grace reads it out, names what is open, and asks what to do next.
 * The canvas stays the clean working area; the questions live in the conversation.
 * (The event is per document, so a run rebuilding the graph at every await does not
 * make her repeat herself.)
 */
/**
 * SHE REACTS TO WHAT THE PERSON DOES ON THE CANVAS.
 *
 * The two edits — a node pulled out, a line drawn or moved — are hers to acknowledge,
 * because they are the moments a person expects the assistant to notice. Selections and
 * pans are not: a sentence for every pointer move is noise, not attention. And what she
 * says about an edit is the truth about it: the node is a DRAFT, and the write-back that
 * would save it is on the list (AGENTIC_EDITOR/10-TODO.md W1).
 */
window.addEventListener('flow-node-added', (e) => {
  const d = (e as CustomEvent).detail as { kind?: string };
  // Silent, like every other edit: the drawing shows the node, its badge says `unsaved`,
  // and nobody is spoken to unasked. (The label lookup stays: the detail views use it.)
  void CREATABLE_KINDS.find((k) => k.kind === d.kind)?.label;
  renderExecutions();
});
window.addEventListener('flow-opened', (e) => {
  const d = ((e as CustomEvent).detail || {}) as {
    label?: string;
    notes?: number;
    seats?: number;
    steps?: number;
    unresolved?: string[];
    absent?: Array<{ step: string; why: string }>;
  };
  const plural = (n: number | undefined, one: string, many: string) =>
    `${n ?? 0} ${(n ?? 0) === 1 ? one : many}`;
  let line = `I have ${d.label || 'a flow'}: ${plural(d.notes, 'note', 'notes')}, `
    + `${plural(d.seats, 'seat', 'seats')} and ${plural(d.steps, 'step', 'steps')}.`;
  if (d.unresolved?.length) {
    line += ` One row I cannot name yet — ${d.unresolved.join(', ')} — so I have drawn it without claiming a role for it.`;
  }
  if (d.absent?.length) {
    line += ` I have not drawn ${d.absent.map((a) => a.step).join(' or ')}: ${d.absent.map((a) => a.why).join('; ')}.`;
  }
  // THE ANNOUNCEMENT IS HEARD, NOT SPOKEN. It stays in the events list, where a person
  // can look at what the canvas says about itself; it is NOT put in her mouth. Anything
  // she says from here on is either asked for or is part of a run someone started.
  void line;
});

// ── the fixtures bar (still there: the states are worth looking at one at a time) ──

// ── executions: the runs, as a filler for the n8n view ──────────────────────

/**
 * One played run. A FILLER, and the panel says so: these are the demo's own playbacks,
 * hand-fed like everything else on this page. What is real is the SHAPE — a list of runs
 * beside the run you picked — and the facts in the detail come from the same script the
 * canvas played.
 */
interface Execution {
  id: number;
  /**
   * WHICH CONVERSATION THIS RUN BELONGS TO. The record did not carry it, which is why
   * picking a conversation could move the column to Trace and still show the flow's whole
   * feed rather than that conversation's run. The owner's intent for the demo (2026-09-18):
   * "if I could click one of the convos in that conversation, then shift the user to trace,
   * show them that combo already expanded and rolled up to the job — so they're beginning to
   * make the connections in their brain, the way you've got them in the system."
   */
  conversationId: number;
  startedAt: Date;
  durationMs: number;
  ok: boolean;
  steps: Array<{ at: string; say: string; state: string }>;
  nodes: Array<{ title: string; kind: string; state: string }>;
  note: string;
}

const executions: Execution[] = [];
let execSeq = 0;
let selectedExec: number | null = null;

function renderExecutions(): void {
  const list = document.getElementById('exec-list') as HTMLElement | null;
  const detail = document.getElementById('exec-detail') as HTMLElement | null;
  if (!list || !detail) return;

  list.innerHTML = '';
  for (const run of [...executions].reverse()) {
    const li = document.createElement('li');
    li.setAttribute('aria-selected', String(run.id === selectedExec));
    const when = document.createElement('div'); when.className = 'when';
    when.textContent = run.startedAt.toLocaleTimeString('en-US', { hour12: false });
    const how = document.createElement('div'); how.className = 'how';
    how.textContent = `${run.ok ? 'Succeeded' : 'Stopped'} in ${(run.durationMs / 1000).toFixed(1)}s · ${run.steps.length} steps`;
    li.append(when, how);
    li.addEventListener('click', () => { selectedExec = run.id; renderExecutions(); });
    list.appendChild(li);
  }
  if (!executions.length) {
    list.innerHTML = '<li class="how">No runs yet — press Play the run.</li>';
    detail.innerHTML = '';
    return;
  }

  const run = executions.find((r) => r.id === selectedExec) ?? executions[executions.length - 1];
  selectedExec = run.id;
  detail.innerHTML = '';

  const h = document.createElement('h3');
  h.textContent = run.startedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' });
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${run.ok ? 'Succeeded' : 'Stopped'} in ${(run.durationMs / 1000).toFixed(1)}s | `
    + `${run.nodes.length} nodes | ID#${run.id}`;
  detail.append(h, meta);

  const ol = document.createElement('ol');
  for (const step of run.steps) {
    const li = document.createElement('li');
    li.append(step.at + ' — ' + step.say + ' ');
    const state = document.createElement('span');
    state.className = 'step-state ' + step.state;
    state.textContent = '(' + step.state + ')';
    li.append(state);
    ol.appendChild(li);
  }
  detail.appendChild(ol);

  const flowLine = document.createElement('p');
  flowLine.className = 'meta';
  flowLine.textContent = 'The flow as it ran: ' + run.nodes.map((n) => `${n.title} (${n.state})`).join(' · ');
  detail.appendChild(flowLine);

  const filler = document.createElement('p');
  filler.className = 'filler';
  filler.textContent = 'Filler. These are this page\'s own playbacks, hand-fed — not execution records from the application.';
  detail.appendChild(filler);
}

// ── evaluations: a placeholder, in the shape we are adopting ────────────────

/**
 * THE EVALUATIONS VIEW — a placeholder, and it behaves like one.
 *
 * Empty it shows the shape the owner sent: a bolt, "No evaluation output", a button.
 * Pressing it fills the output with a MOCK result — the real evaluations do not exist
 * yet, and the panel says which half is which rather than dressing a sample as a
 * finding. What it is FOR: the checks and scores that judge a flow, which are not the
 * same thing as Trace (the execution trace) and were corrected apart on 2026-09-18.
 */
function renderEvalEmpty(): void {
  const body = document.getElementById('eval-body');
  if (!body) return;
  body.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'eval-empty';
  const bolt = document.createElement('div'); bolt.className = 'bolt'; bolt.textContent = '⚡';
  const big = document.createElement('div'); big.className = 'big'; big.textContent = 'No evaluation output';
  const run = document.createElement('button');
  run.type = 'button'; run.textContent = 'Run this evaluation';
  run.addEventListener('click', () => renderEvalMock());
  const or = document.createElement('div'); or.className = 'or'; or.textContent = 'or set mock data';
  wrap.append(bolt, big, run, or);
  body.appendChild(wrap);
}

function renderEvalMock(): void {
  const body = document.getElementById('eval-body');
  if (!body) return;
  body.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'eval-table';
  const head = document.createElement('tr');
  for (const h of ['Check', 'Level', 'Findings', 'Verdict']) {
    const th = document.createElement('th'); th.textContent = h; head.appendChild(th);
  }
  table.appendChild(head);
  // The shape of a real answer, with sample numbers: the point is the columns.
  for (const row of [
    ['annotation-missing', 'advisory', '9', 'needs a designer'],
    ['event-unheard', 'advisory', '18', 'needs wiring'],
    ['schema-absent', 'blocking', '0', 'pass'],
  ]) {
    const tr = document.createElement('tr');
    for (const cell of row) { const td = document.createElement('td'); td.textContent = cell; tr.appendChild(td); }
    table.appendChild(tr);
  }
  const note = document.createElement('p');
  note.className = 'eval-note';
  note.textContent = 'MOCK. These rows are written into this page, not read from a check. The real evaluations view is work still to do (AGENTIC_EDITOR/10-TODO.md).';
  body.append(table, note);
}

// ── the repairs on the bench: the console's own list, fed by this seat ──────

/**
 * THE LIST IS THE FIRST THING, AND IT IS THE REAL ONE.
 *
 * The rows are read from `GET /api/catalog/audit` and composed the way the application
 * composes them (backend/routes/ai.py `_repair_rows`: `subject (nodeId) — what`, level
 * resolved, blocking first), then handed to <chat-repair-actions> — the CONSOLE'S OWN
 * PORTABLE ELEMENT, with its own rows, marks, buttons and empty states. It is inserted
 * into her slot and can be inserted into any slot; this seat supplies DATA and invents
 * no list, no row and no mark of its own.
 *
 * Each row is a repair, and a repair IS a package: the unit the whole system hangs off
 * (READ-ME/THE_PACKAGE_CONTRACT.md §1). So choosing one is an EXIT — the element raises
 * `repair-finding`, and this page leaves the current package for that repair's: a new
 * conversation (the last one rolls up into the bar) and the canvas showing the repair
 * the application would have assembled, built by the same module (`buildRepairSections`).
 * Nothing is said aloud: the canvas changing IS the statement.
 */
let repairs: CatalogFinding[] = [];
let currentRepairId: string | null = null;

/** The app's row composition, copied rather than paraphrased (ai.py `_repair_rows`). */
function repairRows(): Array<{ id: string; text: string; level: 'advisory' | 'blocking' }> {
  return repairs.map((f) => {
    const subject = f.component || f.file || f.nodeId || 'catalog';
    const where = f.nodeId ? ` (${f.nodeId})` : '';
    return {
      id: f.id,
      text: `${subject}${where} — ${f.what || ''}`,
      level: f.level === 'blocking' ? 'blocking' : 'advisory',
    };
  });
}

type RepairsEl = HTMLElement & { findings?: unknown; stages?: unknown; collapsed?: boolean };

function repairsElement(): RepairsEl | null {
  return document.getElementById('repairs') as RepairsEl | null;
}

/**
 * THE TOKEN READOUT TICKS UP AS THE WORK HAPPENS.
 *
 * The numbers are the demo's own — this page runs no model, so there is nothing real to
 * count — and they travel the SEAT'S OWN channel: the host accumulates `a2ui:usage`
 * payloads exactly as the application does and hands them to the panel, so the footer
 * draws them without knowing where they came from. A real Run feeds real numbers the same
 * way and the footer does not change.
 */
let usageTotals = { tokens: 0, inTokens: 0, outTokens: 0, calls: 0, lastCall: '' };

/**
 * ESTIMATES, ONE SET PER NODE KIND — what a person's exploration costs, so the readout
 * moves as they move through the drawing.
 *
 * Every number here is an estimate and the code says so rather than the footer: a readout
 * is a quantity, and a quantity with a disclaimer attached reads as a hedge. The honesty
 * lives where it belongs — the page already states that its data is hand-fed, and
 * AGENTIC_EDITOR/10-TODO.md records that these estimates are what a real Run replaces.
 *
 *   a seat        what its own text is worth (length / 4, the usual chars-to-tokens rule)
 *   the note      reading it and the master it points at
 *   the steps     the numbers the played run already uses, so the readout agrees with the
 *                 run it just watched instead of inventing a second set
 *
 * The one real thing in the table is the seat's: its in-count is derived from the prompt
 * the person is actually editing.
 */
const STEP_ESTIMATES: Record<string, [number, number]> = {
  'step:tool': [900, 640],
  'step:agent': [520, 1180],
  'step:data': [4100, 900],
  'step:evaluation': [700, 260],
};
const NOTE_ESTIMATE: [number, number] = [820, 240];
/** A node is counted once per package: the work happened once, however often it is read. */
let countedNodes = new Set<string>();
/** The seats of the package on the canvas — the only estimates with real text behind them. */
let lastSections: Array<{ name: string; type: string; content: string }> = [];

function estimateFor(nodeId: string): [number, number] | null {
  if (nodeId.startsWith('note:')) return NOTE_ESTIMATE;
  if (STEP_ESTIMATES[nodeId]) return STEP_ESTIMATES[nodeId];
  const seat = /^seat:(\d+):/.exec(nodeId);
  if (seat && lastSections[Number(seat[1])]) {
    const content = lastSections[Number(seat[1])].content || '';
    // The seat's own text, at four characters to the token — the one estimate in the
    // table that is derived from something real rather than chosen.
    return [Math.round(content.length / 4), 0];
  }
  return null;
}

function addUsage(inTokens: number, outTokens: number, lastCall: string): void {
  usageTotals = {
    tokens: usageTotals.tokens + inTokens + outTokens,
    inTokens: usageTotals.inTokens + inTokens,
    outTokens: usageTotals.outTokens + outTokens,
    calls: usageTotals.calls + 1,
    lastCall,
  };
  const chat = document.getElementById('chat') as (HTMLElement & { usage?: unknown }) | null;
  if (!chat) return;
  // THE PANEL'S OWN NAMES. Its footer takes totalTokens / inTokens / outTokens / calls /
  // lastCall — the application's host translates the model's total_tokens, prompt_tokens
  // and completion_tokens into them, and this page does the same translation rather than
  // reaching past it into the footer.
  chat.usage = {
    totalTokens: usageTotals.tokens,
    inTokens: usageTotals.inTokens,
    outTokens: usageTotals.outTokens,
    calls: usageTotals.calls,
    lastCall: usageTotals.lastCall,
  };
}

function paintRepairs(): void {
  const el = repairsElement();
  if (!el) return;
  el.findings = repairRows();
  // The mark the console draws while a repair is in flight; here it says which package
  // the canvas is showing.
  el.stages = currentRepairId ? { [currentRepairId]: 'repair' } : {};
}

function openRepair(findingId: string): void {
  const f = repairs.find((r) => r.id === findingId);
  if (!f || f.id === currentRepairId) return;
  currentRepairId = f.id;
  // The exit: a new package means a new conversation, and the previous one rolls up.
  startConversation();
  const sections = buildRepairSections(f);
  lastSections = sections;
  countedNodes = new Set<string>();
  setFlow(buildRepairFlow({
    label: `Repair — ${f.check}${f.component ? ' on ' + f.component : ''}`,
    finding: f,
    sections,
  }), true);
  paintRepairs();
}

async function loadRepairs(): Promise<void> {
  const el = repairsElement();
  // The element draws its OWN waiting state while findings are unset, so nothing is
  // shown until there is something true to show.
  if (el) el.findings = undefined;
  try {
    const res = await fetch('/api/catalog/audit');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const report = await res.json();
    repairs = (Array.isArray(report.findings) ? report.findings : [])
      .filter((f: CatalogFinding) => f.level !== 'pass')
      .sort(byUrgency);
  } catch (e) {
    repairs = [];
    currentRepairId = null;
    console.warn('[canvas] the catalog check could not be read:', e);
    return;
  }
  paintRepairs();
  if (repairs.length) openRepair(repairs[0].id);
}

// Repair is an EXIT from this package, not a button that decorates a row.
// THE PANEL ALREADY SWITCHED ITSELF — it clears its thread and sets its own
// conversationId before it announces the change. This page follows: it makes the live
// conversation match, and replays that conversation's lines into the fresh thread.
window.addEventListener('conversation-change', (e) => {
  const id = Number((e as CustomEvent).detail?.conversationId ?? NaN);
  if (Number.isNaN(id)) return;
  reopenConversation(id);
  // ...AND THE TRACE FOLLOWS IT. The panel has already moved its own tab to Trace (that is
  // its rule); this page shows ITS trace panels, and rolls the runs list to the run this
  // conversation produced — selected, so its detail is the one that is open. The user sees
  // the pair at once: this conversation, that run.
  showView('trace');
  const run = [...executions].reverse().find((r) => r.conversationId === id);
  if (run) selectedExec = run.id;
  renderExecutions();
});

window.addEventListener('repair-finding', (e) => {
  const id = String((e as CustomEvent).detail?.findingId ?? '');
  if (id) openRepair(id);
});
const buttons: HTMLButtonElement[] = [];
// The fixtures are hand-fed drawings, so ?real=1 does not build them at all — a control
// that cannot be reached is better than one that overwrites a real finding with a fake
// one, and the page then has no path left to the demo data.
if (fixturesHost && !REAL) {
  for (const name of Object.keys(fixtures)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.addEventListener('click', () => {
      stopPlayback();
      setFlow(fixtures[name](), true);
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === b));
    });
    buttons.push(b);
    fixturesHost.appendChild(b);
  }
}

// ── the playback ────────────────────────────────────────────────────────────

let timers: number[] = [];
/** The run being recorded, while the script plays. Null outside a playback. */
let recordRun: Execution | null = null;

function stopPlayback(): void {
  for (const t of timers) window.clearTimeout(t);
  timers = [];
  if (foot) foot.running = false;
  for (const b of buttons) b.setAttribute('aria-pressed', 'false');
}

/**
 * Walk the flow through the run, one await at a time.
 *
 * The drawing is not animated frame by frame — there is no animation here at all.
 * Each step REBUILDS the graph from the facts of that moment (`buildRepairFlow`) and
 * assigns it, so what the person sees is the model changing, which is what a real run
 * does to it. The narration is the only scripted thing on the page.
 */
function play(): void {
  stopPlayback();
  // A RUN IS WORTH WATCHING, so it opens her: the narration and the model's answer land in
  // a column the person can see without being asked to go looking for them.
  setSeatCollapsed(false);
  // A run on the canvas is a run in the Executions view. The steps are recorded as they
  // play, so the detail pane is the same script the drawing just performed.
  const run: Execution = {
    id: ++execSeq,
    // The conversation this run belongs to, fixed at the moment it starts — see Execution.
    conversationId: liveId,
    startedAt: new Date(),
    durationMs: 0,
    ok: true,
    steps: [],
    nodes: [],
    note: '',
  };
  executions.push(run);
  selectedExec = run.id;
  run.conversationId = liveId;
  recordRun = run;
  // A run is a fresh piece of work, so the readout counts THIS one: the totals start at
  // zero with the package rather than accumulating across every package ever opened.
  usageTotals = { tokens: 0, inTokens: 0, outTokens: 0, calls: 0, lastCall: '' };
  countedNodes = new Set<string>();
  addUsage(0, 0, '');
  // The canvas and Grace load together: a run opens a fresh conversation, and the one
  // before it rolls up into the bar.
  startConversation();
  setFlow(buildRepairFlow({ label, finding, sections, run: {} }), true);
  // And the seats that are EMPTY say so, in her own voice, right after the drawing lands.
  speakBlankSeats();
  let elapsed = 0;
  for (const step of script) {
    elapsed += step.afterMs;
    timers.push(window.setTimeout(() => {
      setFlow(buildRepairFlow({ label, finding, sections, run: step.facts }), false);
      speak(step.say, { nodeId: step.node, label: step.note });
      if (step.tokens) {
        addUsage(step.tokens[0], step.tokens[1], new Date().toLocaleTimeString('en-US', { hour12: false }));
      }
      if (recordRun) {
        recordRun.steps.push({
          at: new Date().toLocaleTimeString('en-US', { hour12: false }),
          say: step.say,
          state: step.facts.verdict ? (step.facts.verdict.cleared ? 'done' : 'failed') : step.facts.running ? 'running' : 'done',
        });
        // The SCRIPT'S own timeline, not wall-clock: the run's duration is the sum of
        // the waits the playback performed, so the number in the list is the number the
        // drawing actually took. A wall-clock span would have counted the reload that
        // preceded it and reported a figure nothing performed.
        recordRun.durationMs = elapsed;
        const drawn = canvas.drawn;
        recordRun.nodes = drawn.nodes.map((n) => ({ title: n.title, kind: n.kind, state: n.state }));
        renderExecutions();
      }
    }, elapsed));
  }
  timers.push(window.setTimeout(() => stopPlayback(), elapsed + 400));
  if (foot) foot.running = true;
}

// THE TWO BUTTONS THAT REPLACE REAL DATA WITH HAND-FED DATA are not wired at all under
// ?real=1 — not merely hidden. Play replays the fixture's facts over whatever is drawn,
// and Reset puts the fixture's own finding back; either would take a real repair off the
// screen in front of the person looking at it. Their chrome is gone in that mode anyway,
// and this is the stronger guarantee: there is no path to them.
/**
 * THE FOOT SPEAKS, THIS PAGE ANSWERS — the same split as every other host in this file.
 * The component carries the master's controls; what a run, a reset or a tone means here is
 * this page's business.
 */
const TONE = 'dark'; // The canvas loads dark (owner, 2026-09-18) — mid-tone is one click away.
if (foot) {
  foot.theme = TONE;
  foot.addEventListener('theme-change', (e) => {
    const next = String((e as CustomEvent).detail?.theme ?? '');
    if (next) canvas.setAttribute('theme', next);
    else canvas.removeAttribute('theme');
    if (foot) foot.theme = next;
  });
}
if (TONE) canvas.setAttribute('theme', TONE);

if (!REAL) {
  foot?.addEventListener('canvas-play', () => play());
  foot?.addEventListener('canvas-reset', () => {
    stopPlayback();
    startConversation();
    setFlow(buildRepairFlow({ label, finding, sections, run: {} }), true);
    // RESET PUTS THE CANVAS BACK, so it puts her away with it: the default is the drawing
    // and the rail, which is how this view loads in the first place.
    setSeatCollapsed(true);
  });
}

// The evaluations panel opens empty, in the shape it will keep.
renderEvalEmpty();
(document.getElementById('eval-close') as HTMLElement | null)?.addEventListener('click', () => renderEvalEmpty());

// WHAT LOADS WHEN THIS VIEW OPENS: the repairs on the bench, and the package the canvas
// is showing. NOT a played run, and not a single sentence in her thread — the owner's
// instruction on 2026-09-18, and the reason `play()` is only ever reached by the button.
void loadRepairs();

// ?real=1 SAYS WHAT IS LEFT, in the panel it would otherwise be asked about. The line
// replaces the page's own filler, which names the playback — and there is no playback
// here to name.
if (REAL) {
  const filler = eventsHost.querySelector('.demo');
  if (filler) {
    filler.textContent =
      'Nothing on this page is hand-fed. The finding and the prompt come from the live ' +
      'catalog check, and every line below is an event this flow actually emitted.';
  }
}
