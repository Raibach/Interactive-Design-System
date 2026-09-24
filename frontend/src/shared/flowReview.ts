/**
 * flowReview — the pre-Run review as a LIST THIS APP DERIVES, not a list she remembers.
 *
 * READ-ME/FLOW-REQUIREMENTS.md is the standard: what a prompt must be before it can run, with
 * each requirement's level. §8 asks the question this module answers — "Should the review be a
 * model call at all? I1, I2, S1, S2, S5, T1, T3 and T6 are all checkable in code … A review that
 * asks a model to count empty seats is paying for arithmetic."
 *
 * SO THE MECHANICAL CHECKS ARE HERE, and she keeps the judgement. The reason is not economy: a
 * list she derives is a list that arrives a piece at a time. Measured on screen, 2026-09-23 —
 * the review asked for every unmet requirement in one reply, at a 2000-token ceiling, and the
 * person watched a slightly different subset arrive each turn, with "Add description" recurring
 * after the description had been written. A list computed here is complete every time, in the
 * same order, and the reply that carries it only has to explain it.
 *
 * WHAT THIS DOES NOT DO. It does not enforce anything, and it does not refuse a person at the
 * point of typing — the composer still lets anyone add fifteen agent roles (the owner: "That's
 * how human beings learn, by making mistakes"). It produces the review, and the wall stays the
 * held Run, made of one sentence and a button.
 *
 * ADVISORY ROWS ARE REPORTED, blockable ones are marked. Only `blocking` may hold a Run; the
 * level is the document's, copied here so the two cannot drift silently, and a level changed in
 * the document is a change to make here too.
 */
import { toolsFromSections, type FlowSeatInput, type FlowTool } from './agentFlow';
import { SECTION_TYPES, seatIdOf, declaredName } from './promptSections';

/** The requirement ids, exactly as READ-ME/FLOW-REQUIREMENTS.md numbers them. */
export type RequirementId = 'I1' | 'I2' | 'I3' | 'I4' | 'S1' | 'S2' | 'S4' | 'S5' | 'T1' | 'T2' | 'T6';

export type RequirementLevel = 'blocking' | 'advisory';

/**
 * THE ONE REPAIR THAT CLEARS IT, and whether a machine can do it.
 *
 * `mechanical` is the whole of what "Fix all" may touch: a repair that needs WORDS (a name, a
 * description, a row's content) is not mechanical, because the words are the person's — and a
 * fix-all that invented them into somebody's prompt would be the worst kind of help.
 */
export interface Repair {
  kind: 'name' | 'describe' | 'save' | 'write-seat' | 'move-tool' | 'merge-seat' | 'remove-seat' | 'replace-tool';
  /** Which row it is about, or which row it writes into. */
  seat?: string;
  /** For a merge: the row that goes, and the row it goes into — BY NAME, as the writers resolve them. */
  from?: string;
  /** For a move: the tool, and the seat it belongs in. */
  tool?: string;
  into?: string;
  /** For Replace: the name the prompt uses that the register does not have. */
  name?: string;
  /**
   * HOW THE REPAIR IS MADE — three answers, and the difference is who is doing it.
   *
   *   'action'  the app does it, under Fix all, from one press. Moving a tool and merging a
   *             duplicate row are the app's own business.
   *   'ask'     the app CAN do it, and it is not done without the person saying so: saving a
   *             package makes something that did not exist. Offered as its own button.
   *   'words'   it needs language — a name, a description, a row's content. Never invented by
   *             a button: the words in a prompt are the person's, and a fix-all that wrote them
   *             would be the worst kind of help.
   */
  via: 'action' | 'ask' | 'words';
}

export interface UnmetRequirement {
  id: RequirementId;
  level: RequirementLevel;
  /** What is wrong, in the requirement's own terms — she rephrases it, this states it. */
  why: string;
  /** The row it is about, when it is about one. */
  seat?: string;
  repair: Repair;
}

/** What the review is allowed to look at. Facts the shell already holds — no fetch, no model. */
export interface ReviewInput {
  /** The package's name, as the app has it. */
  title?: string | null;
  /** The package's description, as the app has it. */
  description?: string | null;
  /**
   * Whether this package has been saved yet — an id, in the app's terms.
   *
   * FALSE IS A REAL ANSWER AND ABSENT IS NOT. Only an explicit `false` raises I4: a caller that
   * has not looked must not be told its package is unsaved, because the repair is "save it" and
   * saying that about a package already in the library would be the review inventing a problem.
   */
  saved?: boolean;
  /** The prompt's rows, in the order they are stacked. */
  sections: FlowSeatInput[];
  /** The register: what exists. `runner` null/absent means nothing answers that name. */
  register?: Array<{ name?: string | null; kind?: string | null; runner?: string | null }> | null;
}

/**
 * The seat ids the review is about, resolved the lenient way so a spelling is never a second seat.
 *
 * THROUGH THE ONE NAME READER, and this function is where the whole gate was broken by not being.
 * A saved row arrives as `{section, role, content}` — the shape the surface's own data model hands
 * over — and `type || name` answers `''` for it. `''` is not `undecided` (it is its own `empty`
 * kind), so it passed the guard, fell to `normalizeSectionType`'s documented `custom` fallback, and
 * TWO rows of every saved package became two rows with no name:
 *
 *   S2  "There is no User Role"        over a User Role with words in it
 *   T6  a row "stands twice"           over System and User, which are different rows
 *
 * Both are BLOCKING and both repairs are `via: 'words'`, so no button on screen could clear them
 * and no Run could pass the gate — which is why a prompt could not be run at all. Measured live on
 * the Insurance News Scout package, 2026-09-23. See promptSections.declaredName.
 */
function seatIndex(sections: FlowSeatInput[], id: string): number {
  return sections.findIndex((s) => seatIdOf(s) === id);
}

function hasContent(section: FlowSeatInput | undefined): boolean {
  return String(section?.content ?? '').trim().length > 0;
}

/**
 * A row's readable name, for a sentence about it.
 *
 * The declaration's label when the row has a seat, and the row's OWN words when it has none — a
 * row called "Hero Specs" is named to the person as "Hero Specs", not as "a row", because they are
 * the only one who can tell which row it is.
 */
function rowName(section: FlowSeatInput): string {
  const id = seatIdOf(section);
  const seat = id ? SECTION_TYPES.find((t) => t.id === id) : undefined;
  return seat?.label ?? declaredName(section) ?? 'a row';
}

/**
 * Every unmet requirement, blocking first, in the document's order.
 *
 * Deterministic on purpose: two presses of Run with no edit between them must produce the same
 * list, and a test can then assert the whole of it rather than sampling.
 */
export function reviewFlow(input: ReviewInput): UnmetRequirement[] {
  const sections = input.sections ?? [];
  const register = (input.register ?? []).filter((t) => t?.name);
  const registerNames = new Set(register.map((t) => String(t.name)));
  const unmet: UnmetRequirement[] = [];

  // ── I4 · the package has been saved ───────────────────────────────────────
  //
  // FIRST, BECAUSE EVERYTHING ELSE DEPENDS ON IT, and because it is the honest answer to a loop
  // that cost a session: a description is written AT SAVE (§2 of the requirements), so a package
  // that has never been saved cannot be described — and asking for a description that cannot
  // exist yet is how "Add description" arrived in every single reply while the person watched.
  // The real ask is the save. The owner, 2026-09-23: "Grace can save a package that is being
  // engaged with and has not been saved yet. She should ask the user it's time to save. I can't
  // work without saving — communicate to the user through Grace what's needed."
  //
  // 'ask' and not 'action': saving makes a package that did not exist, so the app can do it and
  // does not do it uninvited. Pressing Fix all must not quietly create rows in someone's library.
  //
  // AND THE PLAY PATH STAYS OPEN. This holds the RUN; it does not hold the person. Somebody who
  // wants to try things and not keep them is doing something legitimate, and nothing here refuses
  // them at the point of typing — they can say not now and go on building. What cannot happen is
  // a run: she has nothing to run AS without an id. The owner, 2026-09-23: "Sometimes people
  // don't want to save they just wanna play. So I guess the options there but she probably can't
  // perform without a saved ID at some point — let's not make it too complicated."
  if (input.saved === false) {
    unmet.push({
      id: 'I4',
      level: 'blocking',
      why: 'This package has not been saved, so there is nothing to run as yet — and nothing written '
        + 'into it, its description included, exists anywhere but this screen. Playing on without '
        + 'saving is fine; a Run needs it saved first.',
      repair: { kind: 'save', via: 'ask' },
    });
  }

  // ── I1 · the package has a name ────────────────────────────────────────────
  const title = String(input.title ?? '').trim();
  if (!title) {
    unmet.push({
      id: 'I1',
      level: 'blocking',
      why: 'The package has no name, so it cannot be found again or told apart from the next unnamed one.',
      repair: { kind: 'name', via: 'words' },
    });
  } else if (/^untitled( prompt)?$/i.test(title) || /\d{1,2}:\d{2}\s*(am|pm)?$/i.test(title)) {
    // I3 — it satisfies I1 in letter and fails it in purpose. Advisory: it does not hold a Run.
    unmet.push({
      id: 'I3',
      level: 'advisory',
      why: `The name "${title}" is a placeholder, so it distinguishes this from nothing.`,
      repair: { kind: 'name', via: 'words' },
    });
  }

  // ── I2 · the package has a description ────────────────────────────────────
  //
  // THE ONE THAT LOOPED. It is judged here from the SAME copy the app writes to, and the shell
  // is responsible for handing over the live one — an id-less draft's description lives in the
  // surface, and a review reading only the package row told the person it was still missing
  // after they had written it.
  if (!String(input.description ?? '').trim()) {
    unmet.push({
      id: 'I2',
      level: 'blocking',
      why: 'The package has no description, and the description is what its card says in the library.',
      repair: { kind: 'describe', via: 'words' },
    });
  }

  // ── S1 · the Agent Role has content ───────────────────────────────────────
  const agentRole = seatIndex(sections, 'agent-role');
  if (!hasContent(sections[agentRole])) {
    unmet.push({
      id: 'S1',
      level: 'blocking',
      why: agentRole < 0
        ? 'There is no Agent Role, so the prompt never says what the work is.'
        : 'The Agent Role is empty, so the prompt has a persona and no task.',
      seat: 'agent-role',
      repair: { kind: 'write-seat', seat: 'agent-role', via: 'words' },
    });
  }

  // ── S2 · the User Role has content ────────────────────────────────────────
  const userRole = seatIndex(sections, 'user-role');
  if (!hasContent(sections[userRole])) {
    unmet.push({
      id: 'S2',
      level: 'blocking',
      why: userRole < 0
        ? 'There is no User Role, so the prompt does not say what arrives at it.'
        : 'The User Role is empty, so what arrives at this prompt is not described.',
      seat: 'user-role',
      repair: { kind: 'write-seat', seat: 'user-role', via: 'words' },
    });
  }

  // ── S4 · no seat is present and empty (advisory) ──────────────────────────
  sections.forEach((s, i) => {
    const id = seatIdOf(s);
    if (!id) return; // an unnamed row is its own problem, not an empty seat
    if (id === 'agent-role' || id === 'user-role') return; // S1/S2 already said it, with the fix
    if (hasContent(s)) return;
    unmet.push({
      id: 'S4',
      level: 'advisory',
      why: `${rowName(s)} is present and empty, and an empty row reads as deliberate.`,
      seat: id,
      repair: { kind: 'remove-seat', seat: id, via: 'action' },
    });
  });

  // ── T6 · no two rows stand for the same step ──────────────────────────────
  //
  // A name is one row by MEANING, not spelling: "Agent Role" and "agent_role" are the same step
  // twice, and the drawing would show two agent nodes for one agent. Undecided rows are exempt —
  // two free-form rows are two rows, and neither claims a seat.
  const seen = new Map<string, number>();
  sections.forEach((s, i) => {
    const id = seatIdOf(s);
    if (!id) return;
    const first = seen.get(id);
    if (first === undefined) {
      seen.set(id, i);
      return;
    }
    unmet.push({
      id: 'T6',
      level: 'blocking',
      why: `${rowName(sections[first])} stands twice — once as ${rowName(sections[first])} and again as `
        + `"${declaredName(s)}" — so the step is sent to the model twice and drawn twice.`,
      seat: id,
      // The merge writes the second row's words into the first and drops the duplicate, which is
      // the repair the seat writers already implement (`merge-seat`). The NAMES go in, not the
      // ids: that writer resolves both rows by name, and these are the two spellings the person
      // can actually see in their prompt.
      //
      // BOTH NAMES FROM THE ONE READER, so the repair names a row the writer can find. `s?.name`
      // answers `''` for a saved row — which is a `merge-seat` event carrying an empty `from`,
      // which the writer's own guard drops without a word.
      repair: {
        kind: 'merge-seat',
        seat: id,
        from: declaredName(s),
        into: declaredName(sections[first]),
        via: 'action',
      },
    });
  });

  // ── S5 / T1 / T2 · the tools ─────────────────────────────────────────────
  const tools: FlowTool[] = toolsFromSections(sections);
  const toolCall = seatIndex(sections, 'tool-call');

  // S5 — a tool written somewhere other than the Tool Call step. The reference seat is where a
  // tool is DECLARED, so a tool beside the agent is a call the run would make from a step that
  // does not declare it. The repair moves it, which is mechanical.
  for (const t of tools) {
    if (toolCall >= 0 && t.seatIndex === toolCall) continue;
    const from = sections[t.seatIndex];
    unmet.push({
      id: 'S5',
      level: 'blocking',
      why: `"${t.name}" is written into ${from ? rowName(from) : 'a seat'}, not the Tool Call step, `
        + 'so the step that declares the call is not the step that names it.',
      seat: 'tool-call',
      repair: { kind: 'move-tool', tool: t.name, into: 'Tool Call', via: 'action' },
    });
  }

  // T1 — a name the register does not have. A step that cannot happen.
  for (const t of tools) {
    if (registerNames.size === 0) break; // the register could not be read: claim nothing
    if (registerNames.has(t.name)) continue;
    unmet.push({
      id: 'T1',
      level: 'blocking',
      why: `"${t.name}" is not a tool this system has, and a name that is not in the register is a step that cannot happen.`,
      repair: { kind: 'replace-tool', name: t.name, via: 'words' },
    });
  }

  // T2 — a `call` tool with nothing behind it. The register alone can answer this one.
  for (const t of tools) {
    const entry = register.find((r) => String(r.name) === t.name);
    if (!entry) continue;
    if (String(entry.kind ?? '') !== 'call') continue;
    if (entry.runner) continue;
    unmet.push({
      id: 'T2',
      level: 'blocking',
      why: `"${t.name}" is written as a tool that reaches out, and nothing answers that name yet.`,
      repair: { kind: 'replace-tool', name: t.name, via: 'words' },
    });
  }

  // Blocking first, then the document's own order. A review is read top-down, and the thing that
  // holds the Run has to be the thing read first.
  const rank = (r: UnmetRequirement): number => (r.level === 'blocking' ? 0 : 1);
  return unmet
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (rank(a.r) - rank(b.r)) || (a.i - b.i))
    .map((x) => x.r);
}

/** Does anything here hold the Run? The only question the gate asks of this list. */
export function holdsRun(unmet: UnmetRequirement[]): boolean {
  return unmet.some((u) => u.level === 'blocking');
}

/**
 * WHAT FIX ALL MAY TOUCH — the repairs the app makes from one press.
 *
 * 'ask' and 'words' are deliberately not here, and for different reasons: a repair that needs
 * language is the person's to write, and a repair that CREATES something (the save) is offered as
 * its own button so nobody's library grows from a press meant to tidy a prompt. What is left is
 * handed back so the reply can ask for it in the same pass — one press clears what a machine can
 * clear, and the person is told exactly what remains and why it is theirs.
 */
export function mechanicalRepairs(unmet: UnmetRequirement[]): UnmetRequirement[] {
  return unmet.filter((u) => u.repair.via === 'action');
}

/**
 * WHAT FIX ALL ACTUALLY APPLIES — and therefore the only list that may be OFFERED as "Apply all".
 *
 * The narrower question, and it exists because the two must not drift: a button offered for a
 * repair the press would not make is a control that lies, and the direction it lies in is the one
 * that matters here — the person presses Apply all expecting the Run to follow, and nothing moves.
 *
 * So this is `mechanicalRepairs` minus the advisory ones, and only the kinds the app's apply
 * HANDLES. Two deliberate exclusions, both visible in the code that applies them
 * (`onFixAll`, WritingAreaIndex):
 *
 *   · ADVISORY repairs are not applied. An advisory does not hold the Run, and a press meant to
 *     clear the wall should not quietly also tidy things nobody was asked about.
 *   · `remove-seat` is not among the kinds applied TODAY. It is marked `via: 'action'` in S4, and
 *     removing an empty row is a repair the checklist says the app may make — but the repository's
 *     own later rule is that a row's removal is ASKED for (CANVAS-AND-PROMPT §4.5: "with her asking
 *     first, exactly as a row removal does today"), and those two have not been reconciled. Until
 *     they are, the button does not claim it.
 */
export function runHoldingRepairs(unmet: UnmetRequirement[]): UnmetRequirement[] {
  return unmet.filter(
    (u) =>
      u.level === 'blocking'
      && u.repair.via === 'action'
      && (u.repair.kind === 'move-tool' || u.repair.kind === 'merge-seat'),
  );
}
