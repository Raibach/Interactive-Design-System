/**
 * buttonState — which of her buttons the PROMPT says are done.
 *
 * THE PROBLEM THIS SOLVES. A pressed button is marked spent so a row of them reads as a list
 * you work down rather than a choice you make once. That mark began as a memory on the seat —
 * which lives as long as the tab does. So reopening a package drew the review again with every
 * button live, over a prompt whose seats had been filled: the owner, 2026-09-23, "it's not
 * saving states … it's actually representing the list again as if it wasn't done."
 *
 * THE ANSWER IS NOT TO SAVE THE MARKS, and that is the whole of this module. The work those
 * buttons asked for is IN THE PROMPT: "Fill User Role" is done because the User Role seat has
 * text in it, and that fact was saved by the person's own Save. Keeping a second record of one
 * fact — a flag in a table saying a button was pressed — would be two records that can
 * disagree, and the one that lies is always the copy nobody re-derives.
 *
 * WHAT THAT MEANS IN PRACTICE:
 *
 *   a seat written into    done when the seat exists and has content
 *   a tool inserted        done when the prompt names it
 *   the description        done when the package has one
 *
 * AND WHAT IT CANNOT DERIVE. A button that is a QUESTION rather than an edit — `confirm`,
 * `not-now`, or a sentence she is meant to answer — leaves nothing in the prompt to read, so
 * its mark is only a memory and does not survive a reload. That is honest: the answer is spent
 * in the conversation, and the conversation is what remembers it.
 */
import {
  parseWriteSeatAction,
  parseWriteToolAction,
  parseDescriptionAction,
} from './actionLink';
import { resolveSectionName } from './promptSections';

/** The shape this needs from a seat of the prompt. Nothing else is read. */
export interface StepSection {
  name?: string;
  type?: string;
  content?: string;
  section?: string;
  role?: string;
}

/**
 * WHAT A SEAT IS CALLED — the same four fields, in the same order, that every other reader in
 * this app uses.
 *
 * NOT `name` ALONE, and this is measured rather than defensive: a saved package stores its
 * seats as `{section: "System", role: "System", content: …}` with NO `name` field at all, so a
 * matcher reading `s.name` against stored data compares against `undefined` four times, finds
 * nothing, and reports a prompt whose seats are full as untouched. The derivation would have
 * been silently wrong for exactly the case it was written for.
 */
function seatName(s: StepSection): string {
  return String(s?.name || s?.section || s?.role || s?.type || '');
}

/** Does a prompt name this tool — by the token its own menu writes, or in a sentence? */
function namesTool(sections: StepSection[], name: string): boolean {
  const needle = name.toLowerCase();
  return sections.some((s) => String(s?.content ?? '').toLowerCase().includes(needle));
}

/**
 * The actions the prompt itself says are finished, out of the actions on offer.
 *
 * Takes the whole list and answers with the subset, so a caller does not have to know the
 * rules per action — one place decides, and a button whose action is not an edit is simply
 * never in the answer.
 */
export function stepsDone(
  actions: string[],
  sections: StepSection[],
  description: string,
): Set<string> {
  const done = new Set<string>();
  const seats = (sections ?? []).filter(Boolean);
  const hasDescription = String(description ?? '').trim().length > 0;

  for (const action of actions) {
    const write = parseWriteSeatAction(action);
    if (write) {
      // FILLED, NOT "CONTAINS THESE WORDS". Her button offered a placeholder to start from —
      // "Draft a task for scouting insurance news" — and what ends up in the seat is the
      // person's own text, or words she wrote after reading theirs. So the question a
      // checklist answers is whether the STEP is done, and a seat with something in it is.
      const at = resolveSectionName(write.section, seats.map(seatName));
      const seat = at >= 0 ? seats[at] : null;
      if (seat && String(seat.content ?? '').trim()) done.add(action);
      continue;
    }

    const tool = parseWriteToolAction(action);
    if (tool) {
      if (namesTool(seats, tool.name)) done.add(action);
      continue;
    }

    const described = parseDescriptionAction(action);
    if (described && hasDescription) done.add(action);
  }

  return done;
}
