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

export type ArrivalKind = 'blank' | 'resume';

let pending: ArrivalKind | null = null;

/** Record an arrival, for a seat that may not exist yet. */
export function markArrival(kind: ArrivalKind): void {
  pending = kind;
}

/** Read and clear it. Null when nothing is waiting. */
export function consumeArrival(): ArrivalKind | null {
  const was = pending;
  pending = null;
  return was;
}
