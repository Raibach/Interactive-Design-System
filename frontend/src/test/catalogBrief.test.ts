/**
 * What the chat carries about the catalog check.
 *
 * Asked "name the single blocking finding", she named one that had been fixed
 * earlier the same day — because her prompt had no report in it and a model with
 * no report will produce one. These cases pin the two properties that make her
 * answer checkable instead of plausible: the list is the report's own, and when
 * there is no report she says so rather than describing findings from memory.
 */
import { describe, it, expect } from 'vitest';
import { catalogBrief, FIELD_LIMIT } from '@/shared/catalogBrief';
import type { CatalogHealth } from '@/shared/catalogHealth';

const ok = (over: Partial<Extract<CatalogHealth, { state: 'ok' }>['report']> = {}): CatalogHealth => ({
  state: 'ok',
  report: {
    generatedAt: '2026-09-14T17:50:03.801Z',
    catalog: 'prompt-composer',
    status: 'complete',
    fileKey: '20UPR2KQMsbAxlo5NJb1se',
    counts: { total: 2, blocking: 1, pipeline: 1, designer: 1, passed: 5 },
    checks: ['open-items-register'],
    findings: [
      {
        id: 'open-items-register:OPEN-ITEMS.md:count:event-unheard',
        check: 'open-items-register', stage: 'deliver', owner: 'pipeline', level: 'blocking',
        component: null, nodeId: null, file: 'OPEN-ITEMS.md',
        what: 'The register records 2 where this run derived 1.', fix: 'Re-measure the row.',
      },
      {
        id: 'annotation-missing:role-tile', check: 'annotation-missing', stage: 'gap', owner: 'designer',
        level: 'advisory', component: 'role-tile', nodeId: '40000909:4316', file: null,
        what: 'Node 40000909:4316 resolves but carries no annotation.', fix: null,
      },
      {
        id: 'clean:no-jsx', check: 'clean-no-jsx', stage: 'clean', owner: 'pipeline', level: 'pass',
        component: null, nodeId: null, file: null, what: 'No React in any source.', fix: null,
      },
    ],
    ...over,
  },
});

const text = (lines: string[]) => lines.join('\n');

describe('the brief is the report, not a recollection', () => {
  it('names the catalog, the run and the open findings', () => {
    const out = text(catalogBrief(ok()));
    expect(out).toContain('CATALOG CHECK — prompt-composer');
    expect(out).toContain('2026-09-14T17:50:03.801Z');
    expect(out).toContain('open-items-register:OPEN-ITEMS.md:count:event-unheard');
    expect(out).toContain('blocking');
    expect(out).toContain('annotation-missing:role-tile');
  });

  it('leaves the pass entries out: a green tick is not an open finding', () => {
    const out = text(catalogBrief(ok()));
    expect(out).not.toContain('clean:no-jsx');
    expect(out).not.toContain('No React in any source.');
  });

  it('says what the list cannot say about itself', () => {
    const out = text(catalogBrief(ok()));
    // A fix is REMOVED, never marked green — the question a person asks first.
    expect(out).toMatch(/REMOVED from the list/);
    expect(out).toMatch(/never marked green/);
    // And the app's own marks are not the check's verdict.
    expect(out).toMatch(/"done" or "in repair" mark beside an item is the app's/);
  });

  it('carries the fix only when the checker gave one', () => {
    const out = text(catalogBrief(ok()));
    expect(out).toContain('the fix: Re-measure the row.');
    expect(out.split('\n').filter((l) => l.includes('the fix:')).length).toBe(1);
  });

  it('truncates a long what rather than pasting a paragraph', () => {
    const long = 'x'.repeat(FIELD_LIMIT + 50);
    const out = text(catalogBrief(ok({
      findings: [{
        id: 'a', check: 'c', stage: 'gap', owner: 'pipeline', level: 'advisory',
        component: null, nodeId: null, file: null, what: long, fix: null,
      }],
    })));
    const what = out.split('\n').find((l) => l.trim().startsWith('what:'))!;
    expect(what.length).toBeLessThan(FIELD_LIMIT + 20);
    expect(what.endsWith('…')).toBe(true);
  });

  it('says so when the report is clean, instead of saying nothing', () => {
    const out = text(catalogBrief(ok({ findings: [] })));
    expect(out).toContain('No open findings in this report.');
  });
});

describe('no report means no findings — never a list from memory', () => {
  it('refuses when the checker has not reported', () => {
    const out = text(catalogBrief({ state: 'unavailable', reason: 'The catalog checker has not run.' }));
    expect(out).toContain('NO current report');
    expect(out).toContain('Do not describe findings from memory');
  });

  it('refuses on a partial report too, and says what is wrong with it', () => {
    const out = text(catalogBrief({ state: 'incomplete', reason: 'A live check did not run.' }));
    expect(out).toContain('NO current report: A live check did not run.');
  });

  it('still has nothing to list while it is loading', () => {
    const out = text(catalogBrief({ state: 'loading' }));
    expect(out).toContain('No report has been read yet');
    expect(out).not.toContain('open finding(s)');
  });
});

describe('the list on screen wins over the one this shell fetched', () => {
  const onScreen = [{
    id: 'provenance-missing:prompt-container', check: 'provenance-missing', owner: 'pipeline',
    level: 'advisory', component: 'prompt-container', nodeId: '40000746:6', file: null,
    what: 'No provenance block.', 
  }];

  it('describes the panel, not a stale report', () => {
    const out = text(catalogBrief(ok(), onScreen));
    expect(out).toContain('provenance-missing:prompt-container');
    expect(out).not.toContain('annotation-missing:role-tile');
  });

  it('lists the panel even when the fetch failed', () => {
    const out = text(catalogBrief({ state: 'unavailable', reason: 'unreachable' }, onScreen));
    expect(out).toContain('provenance-missing:prompt-container');
  });

  it('falls back to the report when the panel is empty', () => {
    const out = text(catalogBrief(ok(), []));
    expect(out).toContain('annotation-missing:role-tile');
  });
});

describe('the brief lists them in the order they are to be read', () => {
  // The panel's own array, in the order the checker reported it: the blocking
  // finding last, exactly as it arrived on 2026-09-14 (item 43 of 43).
  const reportedLast = [
    {
      id: 'provenance-missing:gripper-prompt-input', check: 'provenance-missing', owner: 'pipeline',
      level: 'advisory', component: 'gripper-prompt-input', nodeId: null, file: null,
      what: 'No provenance block.',
    },
    {
      id: 'annotation-missing:role-tile', check: 'annotation-missing', owner: 'designer',
      level: 'advisory', component: 'role-tile', nodeId: '40000909:4316', file: null,
      what: 'Node 40000909:4316 resolves but carries no annotation.',
    },
    {
      id: 'open-items-register:OPEN-ITEMS.md:count:event-unheard', check: 'open-items-register',
      owner: 'pipeline', level: 'blocking', component: null, nodeId: null, file: 'OPEN-ITEMS.md',
      what: 'The register records 2 where this run derived 1.', fix: 'Re-measure the row.',
    },
  ];

  it('numbers the blocking finding 1 even though the check reported it last', () => {
    const out = text(catalogBrief({ state: 'unavailable', reason: 'unreachable' }, reportedLast));
    const first = out.split('\n').find((l) => /^1\. /.test(l))!;
    expect(first).toContain('open-items-register:OPEN-ITEMS.md:count:event-unheard');
    // The advisories are still there, below it — nothing was dropped to get there.
    const numbered = out.split('\n').filter((l) => /^\d+\. /.test(l));
    expect(numbered).toHaveLength(3);
    expect(numbered.slice(1).join('\n')).toContain('annotation-missing:role-tile');
  });

  it('says the order out loud, because "which one" is the question she is asked', () => {
    const out = text(catalogBrief(ok(), reportedLast));
    expect(out).toMatch(/ordered most urgent first/);
    expect(out).toMatch(/item 1 is open-items-register:OPEN-ITEMS\.md:count:event-unheard/);
    expect(out).toMatch(/a blocking finding is always above an advisory one/);
  });
});
