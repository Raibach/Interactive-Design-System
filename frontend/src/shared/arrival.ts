/**
 * arrival — the one fact that has to outlive the render that produced it.
 *
 * An arrival is announced at the moment a surface's assembly lands, and the chat
 * panel is created by that same commit — so an event dispatched there is fired
 * BEFORE the element that needs it exists. Measured: the host's announcement
 * arrived with the panel absent and nothing happened; dispatching the same event
 * once the panel was on screen produced the greeting immediately.
 *
 * So the announcement is both SENT and RECORDED. A listener catches it when the
 * seat is already up; the record catches it when the seat is created by the very
 * commit that announced it. The record is consumed, not merely read, so a seat
 * that arrives later does not greet on behalf of an arrival it missed.
 *
 * THE KIND MATTERS, because the two arrivals are not the same event:
 *
 *   blank   a composer opened with nothing in it — she introduces herself and
 *           asks what the person wants to work on. Only worth doing when nobody
 *           has said anything yet.
 *   resume  an existing package was opened — she greets from where the work was
 *           left. Worth doing whether or not the thread has turns, because the
 *           turns are exactly what she is greeting about.
 *
 * This is page-level, not persisted: a reload has no open package until one opens.
 */

export type ArrivalKind = 'blank' | 'resume' | 'console';

/**
 * AN ARRIVAL IS ADDRESSED TO ONE SEAT — and this is the field that was missing.
 *
 * The announcement is broadcast on `window` and EVERY mounted panel hears it, so before this an
 * arrival was answered by whoever happened to be up. Measured 2026-09-23: the console's panel
 * answered a package's arrival and wrote that package's greeting into the CONSOLE's own
 * conversation — 31 messages about another package's prompt, in the thread of the seat whose
 * whole job is organising cards. The owner's rule, stated the same day: "the chats are not global.
 * They're specific for the package, and console has its own package."
 *
 * `sessionId` names the seat it is for: a package's session id, or null for the seat with no
 * package (a blank composer). A `console` arrival carries no id because the console's session id
 * is a server fact that does not exist at dispatch time — that panel decides it with its own scope
 * read, which is the same fact its greeting already waits on.
 */
export interface Arrival {
  kind: ArrivalKind;
  sessionId: string | null;
}

let pending: Arrival | null = null;

/** Record an arrival, for a seat that may not exist yet. */
export function markArrival(kind: ArrivalKind, sessionId: string | null = null): void {
  pending = { kind, sessionId };
}

/**
 * IS THIS ARRIVAL FOR THE SEAT THAT IS ASKING?
 *
 * One comparison, in one place, so the event path and the record path cannot disagree about who an
 * arrival belongs to. Null addresses the seat with no package, which is what a blank composer is;
 * anything else must name the seat exactly.
 */
export function arrivalIsFor(arrival: Arrival, sessionId: string | null): boolean {
  if (arrival.kind === 'console') return true;
  return String(arrival.sessionId ?? '') === String(sessionId ?? '');
}

/**
 * Read and clear it, FOR ONE SEAT. Null when nothing is waiting — or when what is waiting is for a
 * different seat, in which case it STAYS: that seat has not been born yet, and eating the record
 * here is how the seat it was addressed to never hears it.
 */
export function consumeArrival(sessionId: string | null): Arrival | null {
  if (!pending) return null;
  if (!arrivalIsFor(pending, sessionId)) return null;
  const was = pending;
  pending = null;
  return was;
}
