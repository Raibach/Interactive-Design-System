/**
 * A repair's standing: queued by the click, and settled by the check.
 *
 * Two things are pinned here, and both exist because the alternative is a status that
 * lies:
 *
 *   1. Only the check that raised a finding can say it is fixed. It is the sole
 *      source of "done" — not the run finishing, and not a model saying it did. The
 *      stage is read from a FRESH report, so no run can close its own ticket.
 *   2. A done mark cannot outlive its evidence. The report on screen is the one being
 *      read, so a finding that report still derives is open, whatever an earlier
 *      settle concluded.
 */
import { describe, it, expect } from 'vitest';
import {
  queuedRepair,
  settleRepairs,
  reconcileRepairs,
  type RepairStages,
} from '@/shared/catalogHealth';

describe('clicking Repair queues exactly that finding', () => {
  it('marks it in repair, and leaves the rest of the queue alone', () => {
    expect(queuedRepair({}, 'a')).toEqual({ a: 'repair' });
    expect(queuedRepair({ a: 'repair', b: 'done' }, 'c')).toEqual({ a: 'repair', b: 'done', c: 'repair' });
  });
});

describe('the check settles the repair, not the run', () => {
  it('is done only when the fresh report stops deriving it', () => {
    const queued: RepairStages = { a: 'repair', b: 'repair' };
    expect(settleRepairs(queued, ['a'], ['b', 'c'])).toEqual({ a: 'done', b: 'repair' });
    expect(settleRepairs(queued, ['a'], ['a', 'c'])).toEqual({ a: 'repair', b: 'repair' });
  });

  it('settles only the finding the run answered', () => {
    const before: RepairStages = { a: 'repair', b: 'repair' };
    const after = settleRepairs(before, ['a'], []);
    expect(after).toEqual({ a: 'done', b: 'repair' });
    // A new object, because React compares by identity — an in-place edit would
    // settle nothing on screen.
    expect(after).not.toBe(before);
  });

  it('reopens a done finding the report derives again', () => {
    expect(settleRepairs({ a: 'done' }, ['a'], ['a'])).toEqual({ a: 'repair' });
  });
});

describe('a done mark lives only as long as the evidence for it', () => {
  it('is dropped the moment a report derives the finding again', () => {
    const done: RepairStages = { a: 'done', b: 'repair' };
    expect(reconcileRepairs(done, ['a'])).toEqual({ b: 'repair' });
    expect(reconcileRepairs(done, ['c'])).toEqual({ a: 'done', b: 'repair' });
    expect(reconcileRepairs(done, [])).toEqual({ a: 'done', b: 'repair' });
  });

  it('never drops a queued repair: it is still being worked on', () => {
    expect(reconcileRepairs({ a: 'repair' }, ['a'])).toEqual({ a: 'repair' });
  });
});
