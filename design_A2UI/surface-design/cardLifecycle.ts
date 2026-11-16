/**
 * cardLifecycle — THE CARD'S LIFECYCLE, IN THE SAME WORDS THE SERVER USES.
 *
 * The server's `card_lifecycle.CardState` is the one source. This file is the client's copy of
 * the four names so a surface never compares a label or a colour to decide a lock.
 *
 * THERE IS NO LOCK ON A CARD (owner, 2026-11-16): *"There's no fucking lock, there's never a
 * fucking lock on a card."* Pending is the default a saved Figma card wears, and it is not a
 * refusal: the card opens, its canvas draws, and it can be re-opened, re-ingested, edited and
 * closed. The function stays so every caller keeps one answer, and the answer is false.
 */
export enum CardLifecycleState {
  Open = "Open",
  Closed = "Closed",
  PendingApproval = "Pending_Approval",
  QueuedForShare = "Queued_For_Share",
}

export const LOCKED_CARD_STATES: readonly CardLifecycleState[] = [];

export function isCardLocked(_state: unknown, _routing?: unknown): boolean {
  return false;
}

/** The refusal the workspace panel states instead of drawing a locked card's canvas. */
export function lockedCardSentence(state: unknown): string {
  const value = String(state ?? "");
  return (
    `This card is locked in the Supervisor Queue (${value || "unknown"}). It cannot be ` +
    "re-opened, re-ingested, edited, or closed until the supervisor approves or rejects it."
  );
}
