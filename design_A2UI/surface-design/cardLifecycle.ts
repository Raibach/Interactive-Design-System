/**
 * cardLifecycle — THE CARD'S LIFECYCLE, IN THE SAME WORDS THE SERVER USES.
 *
 * The server's `card_lifecycle.CardState` is the one source. This file is the client's copy of
 * the four names so a surface never compares a label or a colour to decide a lock. A card in
 * `Pending_Approval` or `Queued_For_Share` is read-only to its owner.
 */
export enum CardLifecycleState {
  Open = "Open",
  Closed = "Closed",
  PendingApproval = "Pending_Approval",
  QueuedForShare = "Queued_For_Share",
}

export const LOCKED_CARD_STATES: readonly CardLifecycleState[] = [
  CardLifecycleState.PendingApproval,
  CardLifecycleState.QueuedForShare,
];

export function isCardLocked(state: unknown): boolean {
  const value = String(state ?? "");
  return (
    value === CardLifecycleState.PendingApproval ||
    value === CardLifecycleState.QueuedForShare
  );
}

/** The refusal the workspace panel states instead of drawing a locked card's canvas. */
export function lockedCardSentence(state: unknown): string {
  const value = String(state ?? "");
  return (
    `This card is locked in the Supervisor Queue (${value || "unknown"}). It cannot be ` +
    "re-opened, re-ingested, edited, or closed until the supervisor approves or rejects it."
  );
}
