/**
 * THE GOVERNANCE ROOM'S TRACE DOOR — the helpers the room page used to keep inline.
 *
 * WHY THIS FILE EXISTS (owner, 2026-10-17: *"you need to start now breaking that file up …
 * it will no longer work as your holder for all the information that we need"*). These three
 * pieces were ~90 lines inside `pages/WritingAreaIndex.tsx`; they are about the TRACE surface
 * only, so they live here and the page imports them. Behaviour is unchanged — this is a move,
 * not a rewrite:
 *
 *   governanceFrameDoc(embed)      the embedded app's document, or null (never throws)
 *   selectLatestTableRow(frameDoc) the measured pointer sequence that selects the LATEST row
 *   traceSelectionUrl(projectId, sel) the app's own `?peek=…&observation=…&traceId=…` url
 *
 * The page keeps its own refs; these take the values they need as arguments.
 */

/** The embedded app's document, or null. Never throws: a not-yet-mounted frame is a value. */
export function governanceFrameDoc(embed: Element | null): Document | null {
  try {
    const iframe = (embed as { shadowRoot?: ShadowRoot } | null)?.shadowRoot?.querySelector(
      'iframe',
    ) as HTMLIFrameElement | null;
    return iframe?.contentDocument ?? null;
  } catch {
    return null;
  }
}

/**
 * SELECT THE LATEST ROW IN THE APP'S TRACE TABLE, THE WAY A HAND SELECTS IT.
 *
 * Owner, 2026-10-13 late: *"you can't just pick an arbitrary line in the table and call it
 * default — default has to be the latest one … or else it'll eventually get pushed way
 * down."* The row's own time cell (td[1] — the cell the row handler answers) carries its
 * start time; the row with the MAXIMUM is the latest, whatever order the table is showing.
 * Rows whose time cannot be read are skipped; if NO row reads, the pick falls back to the
 * FIRST row — a FALLBACK ONLY: the app's own default sort is newest-first, so the two agree
 * in practice, and this comment says so rather than pretending position is the rule.
 *
 * A bare synthetic `click()` does not reach the fork's row handler — the measured pointer
 * sequence below does.
 */
export async function selectLatestTableRow(
  frameDoc: () => Document | null,
): Promise<void> {
  const deadline = Date.now() + 8000;
  let rows: HTMLElement[] = [];
  while (Date.now() < deadline && rows.length === 0) {
    rows = [...(frameDoc()?.querySelectorAll<HTMLElement>('tr[data-row-index]') ?? [])];
    if (rows.length === 0) await new Promise((r) => setTimeout(r, 150));
  }
  if (rows.length === 0) return; // an empty project: nothing to select, nothing opens

  const timeOf = (row: HTMLElement): number => {
    const m = (row.querySelectorAll('td')[1]?.textContent ?? row.textContent ?? '').match(
      /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/,
    );
    return m ? Date.parse(`${m[1]}T${m[2]}`) : Number.NaN;
  };
  let pick = rows[0];
  let best = Number.NaN;
  for (const row of rows) {
    const t = timeOf(row);
    if (Number.isNaN(t)) continue;
    if (Number.isNaN(best) || t > best) {
      best = t;
      pick = row;
    }
  }
  const cell = (pick.querySelectorAll('td')[1] as HTMLElement | undefined) ?? pick;
  const box = cell.getBoundingClientRect();
  const at = {
    bubbles: true,
    composed: true,
    cancelable: true,
    view: cell.ownerDocument.defaultView ?? window,
    clientX: Math.round(box.x + box.width / 2),
    clientY: Math.round(box.y + box.height / 2),
    button: 0,
  };
  cell.dispatchEvent(new PointerEvent('pointerdown', { ...at, pointerId: 1, isPrimary: true, buttons: 1 }));
  cell.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
  cell.dispatchEvent(new PointerEvent('pointerup', { ...at, pointerId: 1, isPrimary: true, buttons: 0 }));
  cell.dispatchEvent(new MouseEvent('mouseup', { ...at, buttons: 0 }));
  cell.dispatchEvent(new MouseEvent('click', at));
}

/**
 * THE TABLE ALWAYS INDICATES WHAT IS DISPLAYED (owner, 2026-10-13 late: *"you can either
 * select a table[item] or you can select the trace navigation … we have to indicate on the
 * table a default"*). With a STANDING selection, the app re-navigates WITH ITS OWN selection
 * params (the v4 dialect: peek = observation = the root's id), so the table re-marks that
 * row — the clean `/traces` url used to wash the params out and leave the table unmarked.
 *
 * THE APP'S OWN PEEK ID IS THE MARK THE TABLE HEARS (measured 2026-10-13 late: a
 * re-navigation built from a different parentless observation lit NO row — the app's own
 * row click had used another id for the same trace). Same dialect the app writes, or the
 * table stays dark.
 *
 * Returns the url to navigate to, or null when there is nothing to select.
 */
export function traceSelectionUrl(
  projectId: string,
  sel: { peekId?: string | null; bundle?: { trace: { id: string }; observations: Array<{ id: string; parentObservationId: string | null }> } | null } | null,
): string | null {
  const bundle = sel?.bundle;
  if (!bundle) return null;
  const peekNow = sel?.peekId && bundle.observations.some((o) => o.id === sel.peekId)
    ? sel.peekId
    : (bundle.observations.find((o) => !o.parentObservationId) ?? bundle.observations[0] ?? null)?.id ?? null;
  if (!peekNow) return null;
  return `/project/${projectId}/traces?peek=${peekNow}&observation=${peekNow}&traceId=${bundle.trace.id}`;
}
