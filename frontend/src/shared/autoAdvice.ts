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
 *
 * AND THE BIGGER GATE IS NOT A PREFERENCE AT ALL — IT IS THE RUN. Recommendations are
 * the learning experience: they are how somebody finds out what the machine does with
 * what they wrote, so they belong to the FIRST Run and not to every visit after it. Once
 * a package has produced results she stops proposing and waits to be asked. The owner,
 * 2026-09-24: "Recommendations are really only for the first before run. It's part of the
 * learning experience and then once they process a run they're gonna have to ask her for
 * enhancements."
 *
 * That gate is a fact about the WORK — read from the package's own thread (does it carry a
 * Run's results?) — rather than a flag kept beside this one, so it has no switch here and
 * no lifetime to manage. It is applied in <chat-panel>._greetIfArriving, next to
 * `autoAdviceOn()` and BEFORE the send: an offer she is not going to make must not be paid
 * for with a model call.
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
