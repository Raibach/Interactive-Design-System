/**
 * What a persistence error does to the local thread.
 *
 * The surface may not draw a turn that has no conversation row. Two cases:
 *   - the REPLY failed to write: the reply is not drawn; a notice is added by the seat.
 *   - the PERSON's turn failed to write: their words stay visible, marked `notSaved`; the
 *     reply may be a real row and is drawn.
 *
 * This is pure so the rule is testable without a browser or a database.
 */
export interface PersistenceTurn {
  role?: string;
  content?: string;
  notSaved?: boolean;
  alert?: boolean;
}

export interface PersistenceEffect<T extends PersistenceTurn> {
  replyNotSaved: boolean;
  userNotSaved: boolean;
  turns: T[];
}

export function classifyPersistenceError(error: string | null | undefined): {
  replyNotSaved: boolean;
  userNotSaved: boolean;
} {
  const text = String(error || '');
  const replyNotSaved = /reply could not be written/i.test(text);
  return {
    replyNotSaved,
    userNotSaved: Boolean(text) && !replyNotSaved,
  };
}

export function applyPersistenceFailure<T extends PersistenceTurn>(
  turns: T[],
  error: string | null | undefined,
): PersistenceEffect<T> {
  const { replyNotSaved, userNotSaved } = classifyPersistenceError(error);
  if (!userNotSaved) return { replyNotSaved, userNotSaved, turns };
  const reversedIndex = [...turns].reverse().findIndex((turn) => turn.role === 'user');
  if (reversedIndex < 0) return { replyNotSaved, userNotSaved, turns };
  const index = turns.length - 1 - reversedIndex;
  return {
    replyNotSaved,
    userNotSaved,
    turns: turns.map((turn, i) => (i === index ? { ...turn, notSaved: true } : turn)),
  };
}
