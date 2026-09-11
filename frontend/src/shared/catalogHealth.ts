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

