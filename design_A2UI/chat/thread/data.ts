/**
 * THE THREAD'S DATA — the merged turns and the results fact.
 *
 * The seat keeps the property and delegates; this file owns the two rules the thread's data
 * states: a local turn the surface has since returned is RELEASED (the conversation is the source
 * of truth), and a package that has run is a package whose card says so (a run files its results
 * in its own conversation and archives the one it replaced).
 */
export interface ThreadTurn {
  role?: string;
  content?: string;
  result?: boolean;
}

export interface ThreadDataHost {
  messages?: ThreadTurn[];
  _local: ThreadTurn[];
  _seatIsConsole: boolean | null;
  _conversationRows?: Array<{ archived?: boolean }> | null;
}

/** The surface's history first, then only the local turns the conversation has not caught up with. */
export const threadOf = (host: ThreadDataHost): ThreadTurn[] => {
  const fromSurface = host.messages || [];
  const local = host._local;
  if (!fromSurface.length || !local.length) return [...fromSurface, ...local];
  const same = (a: ThreadTurn, b: ThreadTurn) =>
    (a?.role || '') === (b?.role || '') && (a?.content || '') === (b?.content || '');
  let caughtUp = 0;
  const max = Math.min(local.length, fromSurface.length);
  for (let n = max; n > 0; n--) {
    const tail = fromSurface.slice(-n);
    const spoken = local.slice(-n);
    if (tail.every((m, i) => same(m, spoken[i]))) {
      caughtUp = n;
      break;
    }
  }
  return [...fromSurface, ...local.slice(0, local.length - caughtUp)];
};

/** Does the thread carry a run's results — a result turn, or a package with an archived row. */
export const hasResultTurns = (host: ThreadDataHost): boolean => {
  if (threadOf(host).some((m) => m.result === true)) return true;
  // THE CONSOLE IS NOT A PACKAGE and runs nothing: its archived rows must not silence it.
  if (host._seatIsConsole === true) return false;
  return (host._conversationRows ?? []).some((r) => r.archived === true);
};
