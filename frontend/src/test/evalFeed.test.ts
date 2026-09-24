/**
 * <eval-feed> — the judged runs list for the rail's Evals view.
 *
 * The element is a VIEW: it draws the rows it is bound and invents none. The contract
 * pinned here is the n8n one-for-one: one row per run, run number, when, a status with
 * its word, and the judge's sentence under it. Unset is not empty — the waiting state
 * and the "nothing has been judged" state are different claims about the app and draw
 * differently.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/eval-feed';
import type { EvalFeed, EvaluationRecord } from '@/components/lit/eval-feed';

type El = EvalFeed & { updateComplete: Promise<unknown> };

const mounted: El[] = [];

const mount = async (evaluations?: EvaluationRecord[]): Promise<El> => {
  const el = document.createElement('eval-feed') as El;
  if (evaluations !== undefined) el.evaluations = evaluations;
  document.body.appendChild(el);
  await el.updateComplete;
  mounted.push(el);
  return el;
};

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

const ROWS: EvaluationRecord[] = [
  { id: 'a', index: 1, runAt: '2026-09-24T08:00:00Z', trigger: 'Run', verdict: 'cleared', sentence: 'The briefing names its sources and dates.' },
  { id: 'b', index: 2, runAt: '2026-09-24T09:30:00Z', trigger: 'Run', verdict: 'failed', sentence: 'The answer filled the gap from memory.' },
  { id: 'c', index: 3, runAt: '2026-09-24T10:15:00Z', trigger: 'Run', verdict: 'error' },
];

describe('<eval-feed>', () => {
  it('unset is not empty: waiting for the surface is not the claim that nothing was judged', async () => {
    const el = await mount(undefined);
    expect(el.shadowRoot!.textContent).toContain('Loading evaluations');
  });

  it('an empty list is the claim that the package ran and nothing has been judged', async () => {
    const el = await mount([]);
    expect(el.shadowRoot!.textContent).toContain('Nothing has been judged yet');
  });

  it('draws one row per judged run, with run number, status word and the sentence', async () => {
    const el = await mount(ROWS);
    const rows = el.shadowRoot!.querySelectorAll('.row');
    expect(rows.length).toBe(3);

    expect(rows[0].querySelector('.idx')!.textContent).toBe('#1');
    expect(rows[0].querySelector('.status')!.textContent).toContain('Cleared');
    expect(rows[0].querySelector('.sentence')!.textContent).toBe('The briefing names its sources and dates.');
    expect(rows[0].querySelector('.when')!.getAttribute('title')).toBe('2026-09-24T08:00:00Z');

    expect(rows[1].querySelector('.status')!.textContent).toContain('Failed');
    expect(rows[1].querySelector('.sentence')!.textContent).toBe('The answer filled the gap from memory.');
  });

  it('an error run draws its status and no sentence — a sentence is a claim only the judge makes', async () => {
    const el = await mount(ROWS);
    const rows = el.shadowRoot!.querySelectorAll('.row');
    expect(rows[2].querySelector('.status')!.textContent).toContain('Error');
    expect(rows[2].querySelector('.sentence')).toBeNull();
  });

  it('the count in the header is the number of rows, not an estimate', async () => {
    const el = await mount(ROWS);
    expect(el.shadowRoot!.querySelector('.count')!.textContent).toBe('3');
  });
});
