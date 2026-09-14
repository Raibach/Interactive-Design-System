/**
 * catalogBrief — the catalog check, in the words her prompt can carry.
 *
 * The findings panel is drawn in her own seat, and her prompt did not contain it.
 * So "what did the check find" had no answer, and she filled the gap from the
 * console: asked for the blocking finding, she named one that had been fixed
 * earlier the same day, in a sentence that read exactly like a fact. A model with
 * no report will produce one. This is the report.
 *
 * Four things travel with the list, because they are what the LIST itself cannot
 * say and a person will ask:
 *
 *   1. The check re-derives everything from the files on every run. A fixed
 *      finding is REMOVED — it is not marked green, and no pass mark records it.
 *      The count dropping is the only statement that it is gone.
 *   2. "done" and "in repair" are the APP's marks for work in this session, and
 *      the check has not confirmed either. They are not the check's verdict.
 *   3. When there is no current report, there is no list — say so, and never
 *      describe findings from memory or inference.
 *   4. The list is ordered most urgent first, and the check does not send it that
 *      way. It reports in the order its checks ran, so on 2026-09-14 the one
 *      blocking finding arrived at item 43 of 43. Item 1 is what a person is
 *      asking about when they ask "which one", so item 1 is the answer.
 */
import type { CatalogHealth } from './catalogHealth';
import { sortByUrgency } from './catalogHealth';

/** What the brief needs of a finding, from either the report or the panel. */
export interface BriefFinding {
  id: string;
  check?: string;
  level?: string;
  owner?: string;
  stage?: string;
  component?: string | null;
  nodeId?: string | null;
  file?: string | null;
  what?: string;
  fix?: string | null;
}

/** A finding's `what`/`fix` is truncated: this is for recognition, not reading. */
export const FIELD_LIMIT = 260;

const clip = (s: string, limit: number = FIELD_LIMIT): string =>
  s.length <= limit ? s : `${s.slice(0, limit)}…`;

const where = (f: BriefFinding): string =>
  [f.component || '(catalog)', f.nodeId ? `node ${f.nodeId}` : '', f.file ? `file ${f.file}` : '']
    .filter(Boolean)
    .join(' · ');

/**
 * The catalog check as prompt lines. `onScreen` is the list the person is
 * actually looking at (the surface's data model); it wins over the report this
 * shell fetched, because a brief that describes a different list than the panel
 * is worse than no brief.
 */
export function catalogBrief(
  health: CatalogHealth,
  onScreen: BriefFinding[] | null = null,
): string[] {
  const lines: string[] = [];

  if (health.state !== 'ok' && (!onScreen || onScreen.length === 0)) {
    lines.push('=== CATALOG CHECK ===');
    lines.push(
      health.state === 'loading'
        ? 'No report has been read yet in this session, so you cannot say what the check found.'
        : `There is NO current report: ${'reason' in health ? health.reason : 'the check did not answer'}.`,
    );
    lines.push(
      'Do not describe findings from memory, from the console, or from an earlier conversation. '
      + 'Say the check has not reported, and that it can be re-run.',
    );
    return lines;
  }

  const report = health.state === 'ok' ? health.report : null;
  const findings: BriefFinding[] = onScreen && onScreen.length > 0 ? onScreen : (report?.findings ?? []);
  // Urgency order, here and in the panel, from the one comparator: a brief that
  // numbers a blocking finding 43rd teaches her to answer with the last row.
  const open = sortByUrgency(findings.filter((f) => f.level !== 'pass'));

  const generatedAt = report?.generatedAt ?? 'unknown';
  const catalog = report?.catalog ?? 'prompt-composer';

  lines.push(`=== CATALOG CHECK — ${catalog} (the list on screen) ===`);
  lines.push(
    `Report generated ${generatedAt}. ${open.length} open finding(s), ordered most urgent first`
    + `${open.length ? ` — item 1 is ${open[0].id}` : ''}.`,
  );
  lines.push(
    'How to read it: the check re-derives this list from the files on every run and writes a '
    + 'fresh report. A fixed finding is REMOVED from the list — it is never marked green, and no '
    + 'pass mark records it. The count dropping is the only statement that it is gone. '
    + 'A "done" or "in repair" mark beside an item is the app\'s, for work in this session; '
    + 'only the check can confirm a repair, and it has not. '
    + 'The order is urgency, not the order the checker reported: a blocking finding is always '
    + 'above an advisory one, and the most urgent open finding is item 1. Any "blocking" or '
    + '"advisory" you read is the level in the brackets on that item, not a count.',
  );

  if (!open.length) {
    lines.push('No open findings in this report.');
    return lines;
  }

  open.forEach((f, i) => {
    const bits = [f.check, f.level, f.owner, f.stage].filter(Boolean).join(' · ');
    lines.push(`${i + 1}. ${f.id} [${bits}] — ${where(f)}`);
    if (f.what) lines.push(`   what: ${clip(f.what)}`);
    if (f.fix) lines.push(`   the fix: ${clip(f.fix)}`);
  });
  lines.push('These are the findings, verbatim from the check. Do not add, merge or rename one.');

  return lines;
}
