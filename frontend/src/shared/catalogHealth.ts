/**
 * catalogHealth — the shell's view of the catalog check.
 *
 * One fetch, one shape, used by the indicator on the chat bar. The report is
 * produced by frontend/scripts/catalog-check.mjs and served by GET /api/catalog/audit.
 *
 * The REPORT is no longer assembled here. The list, the counts and the wording
 * are Grace's: she assembles the surface and speaks through `ai_message`. What
 * lives in this module is only what the shell owns — the fetch, and the badge.
 *
 * FAIL LOUD: a 503 means the checker did not run. That is reported as an
 * incomplete check — never as a clean catalog.
 */
import { API_BASE } from './apiHelper';

export type FindingOwner = 'pipeline' | 'designer';
export type FindingStage = 'ingest' | 'deliver' | 'gap' | 'clean';

export interface CatalogFinding {
  id: string;
  check: string;
  stage: FindingStage;
  owner: FindingOwner;
  level: 'advisory' | 'blocking' | 'pass';
  component: string | null;
  nodeId: string | null;
  file: string | null;
  what: string;
  fix: string | null;
  /**
   * Event names the check MEASURED in the component's own source
   * (`new CustomEvent('…')`), carried as a list so a repair prompt can write the
   * value it asks for instead of describing one to type. Present only on the
   * checks that measure it (provenance, annotation) — absent, not null, elsewhere.
   */
  dispatchedEvents?: string[] | null;
}

export interface CatalogAudit {
  generatedAt: string;
  catalog: string;
  status: 'complete' | 'partial';
  fileKey: string | null;
  counts: { total: number; blocking: number; pipeline: number; designer: number; passed: number };
  checks: string[];
  findings: CatalogFinding[];
}

export type CatalogHealth =
  | { state: 'loading' }
  | { state: 'ok'; report: CatalogAudit }
  | { state: 'incomplete'; reason: string; remedy?: string }
  | { state: 'unavailable'; reason: string };

/** Fetch the catalog check. Never throws; a failure is a reported state. */
export async function fetchCatalogHealth(): Promise<CatalogHealth> {
  try {
    const res = await fetch(`${API_BASE}/catalog/audit`);
    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      return {
        state: 'unavailable',
        reason: body?.detail?.message || 'The catalog checker has not run.',
      };
    }
    if (!res.ok) return { state: 'unavailable', reason: `HTTP ${res.status}` };
    const report = (await res.json()) as CatalogAudit;
    if (report.status !== 'complete') {
      return { state: 'incomplete', reason: 'A live check did not run, so this report is partial.' };
    }
    return { state: 'ok', report };
  } catch (e) {
    return { state: 'unavailable', reason: e instanceof Error ? e.message : 'unreachable' };
  }
}

/**
 * Map the health union to the nav bar's badge state, and to the count it may
 * carry. Both live here, beside the union itself, so the meaning of "not ok" has
 * exactly one home.
 *
 * This replaces a sentinel: the caller used to pass the count `1` to signal "not
 * ok", which made a checker that never ran render identically to a single open
 * finding. A number can carry a quantity or a flag, never both.
 */
export const badgeState = (h: CatalogHealth): 'ok' | 'loading' | 'unknown' =>
  h.state === 'ok' ? 'ok' : h.state === 'loading' ? 'loading' : 'unknown';

/** The count the badge may show. Zero unless the report is real. */
export const badgeCount = (h: CatalogHealth): number =>
  h.state === 'ok' ? h.report.counts.total : 0;

/**
 * Which finding is read first.
 *
 * The check reports in the order its checks RAN — a fact about the checker, not
 * about urgency. On 2026-09-14 that put the single blocking finding at item 43 of
 * 43, below forty-two advisories, inside a list that is closed by default: the
 * report said "1 blocking" and nothing on screen said which one it was. A list of
 * findings is a list of questions, so its order IS the answer to "which one
 * first", and the answer is never "the last row".
 *
 * One home, one rule. The panel sorts with this, and the brief that travels into
 * her prompt sorts with the same comparator, so the row a person reads first is
 * the finding she is told to name first.
 */
export type FindingLevel = CatalogFinding['level'];

/** Most urgent first. `pass` sorts last: a green tick is not a question. */
export const URGENCY: Record<FindingLevel, number> = {
  blocking: 0,
  advisory: 1,
  pass: 2,
};

/**
 * A level the panel did not carry is not a claim of urgency: an absent or
 * unrecognised level sorts WITH advisory, so it can never be lifted above a
 * blocking finding — and never hides one either.
 */
export const urgencyRank = (level?: string): number =>
  level === 'blocking' || level === 'pass' ? URGENCY[level] : URGENCY.advisory;

/**
 * Urgency, then the check, then the id. Deterministic on purpose: two people
 * reading the same report cannot be told a different item is first.
 */
export function byUrgency(
  a: { id: string; level?: string; check?: string },
  b: { id: string; level?: string; check?: string },
): number {
  return (
    urgencyRank(a.level) - urgencyRank(b.level)
    || (a.check || '').localeCompare(b.check || '')
    || a.id.localeCompare(b.id)
  );
}

/**
 * Sorted, never sorted in place: the array handed in here is the report, and the
 * report is the check's own statement — order is presentation, so it is made
 * somewhere that does not own the evidence.
 */
export function sortByUrgency<T extends { id: string; level?: string; check?: string }>(
  findings: readonly T[],
): T[] {
  return [...findings].sort(byUrgency);
}

/**
 * Where a finding's repair stands, while the finding is in front of the person.
 *
 * The checker is the judge, and it has already spoken once — that verdict is the
 * reason the finding is in the queue. So the only question left is whether it still
 * speaks: a finding is 'repair' from the click until a fresh report stops deriving
 * it, and 'done' after that. Absent means nothing has been done about it.
 */
export type RepairStage = 'repair' | 'done';
export type RepairStages = Record<string, RepairStage>;

/** Clicked. Queued for repair; no run has settled it yet. */
export const queuedRepair = (stages: RepairStages, id: string): RepairStages => ({
  ...stages,
  [id]: 'repair',
});

/**
 * What a finished repair run proved, read from a fresh report.
 *
 * `stillDerived` is the ids that report carries. A finding the check no longer
 * derives is done; one it still derives stays in repair — the change did not hold,
 * or it did not reach the file the check reads. A checker that did not answer must
 * not be passed through here at all: silence is not a pass.
 */
export function settleRepairs(
  stages: RepairStages,
  ids: string[],
  stillDerived: string[],
): RepairStages {
  const open = new Set(stillDerived);
  const next = { ...stages };
  for (const id of ids) next[id] = open.has(id) ? 'repair' : 'done';
  return next;
}

/**
 * A done mark lives only until a report derives the finding again.
 *
 * The report on screen is the one the person is reading, so a finding it still
 * carries is open, whatever an earlier settle concluded — the fix regressed, the file
 * moved back, or the settle read a newer report than the one on screen. Called with
 * the ids of every report the surface receives, so the mark cannot outlive its
 * evidence.
 */
export function reconcileRepairs(stages: RepairStages, derived: string[]): RepairStages {
  const open = new Set(derived);
  const next: RepairStages = {};
  for (const [id, stage] of Object.entries(stages)) {
    if (stage === 'done' && open.has(id)) continue;
    next[id] = stage;
  }
  return next;
}

