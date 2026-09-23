/**
 * autoAdvice — whether she volunteers, or only answers.
 *
 * She opens a package with where the work stands and what to do next. That is
 * advising, and somebody who has waved it away once does not want it on the next
 * package either — so the flag cannot live on the chat seat, which is created and
 * destroyed once per package. It lives here instead, which is the smallest place
 * that survives one.
 *
 * WHERE THIS REALLY BELONGS: a per-person setting with a switch, because the owner
 * wants to be able to turn it off and on, and because a preference is not a property
 * of a page. Until that exists this is the whole of it — one boolean, two functions,
 * and the one place a real setting would read from. A reload is the current lifetime;
 * that is a limitation, not a decision.
 *
 * PAGE-LEVEL, NOT PERSISTED, and deliberately not in localStorage: a preference that
 * outlives the tab without anybody being able to see or change it is a setting with
 * no switch, which is worse than one that resets.
 */

let volunteering = true;

/** Whether she should open a package with suggestions. */
export function autoAdviceOn(): boolean {
  return volunteering;
}

/** Turn it off — what "No thanks" does. */
export function declineAutoAdvice(): void {
  volunteering = false;
}

/** Turn it back on, for whatever switch eventually owns this. */
export function allowAutoAdvice(): void {
  volunteering = true;
}
