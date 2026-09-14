/**
 * Which finding is read first.
 *
 * The checker reports in the order its checks RAN, and that put the one blocking
 * finding at item 43 of 43 on 2026-09-14 — below forty-two advisories, inside a
 * list that is closed by default. A list of findings is a list of questions, so
 * its order IS the answer to "which one first", and the answer was the last row.
 * These cases pin the order to urgency, and pin the two ways it could break
 * silently: a level the panel did not carry, and a sort that reorders the report
 * it was handed.
 */
import { describe, it, expect } from 'vitest';
import { byUrgency, sortByUrgency, urgencyRank } from '@/shared/catalogHealth';

const f = (id: string, level?: string, check = 'c') => ({ id, level, check });

describe('the most urgent finding is first, whatever order the check reported', () => {
  it('lifts a blocking finding above the advisories it was reported after', () => {
    const reported = [f('a', 'advisory'), f('b', 'advisory'), f('z', 'blocking')];
    expect(sortByUrgency(reported).map((x) => x.id)).toEqual(['z', 'a', 'b']);
  });

  it('is the shape that was on screen: 42 advisories, then the blocking one', () => {
    const reported = [
      ...Array.from({ length: 42 }, (_, i) => f(`advisory-${String(i).padStart(2, '0')}`, 'advisory')),
      f('open-items-register:OPEN-ITEMS.md:count:event-unheard', 'blocking'),
    ];
    const ordered = sortByUrgency(reported);
    expect(ordered[0].id).toBe('open-items-register:OPEN-ITEMS.md:count:event-unheard');
    expect(ordered[0].level).toBe('blocking');
    // And the blocking item is not merely above the rest — it is item 1 of 43.
    expect(ordered.filter((x) => x.level === 'blocking')).toHaveLength(1);
    expect(ordered).toHaveLength(43);
    expect(ordered.slice(1).every((x) => x.level === 'advisory')).toBe(true);
  });

  it('keeps the greens at the bottom when they are handed in with the open ones', () => {
    const reported = [f('p', 'pass'), f('a', 'advisory'), f('z', 'blocking')];
    expect(sortByUrgency(reported).map((x) => x.id)).toEqual(['z', 'a', 'p']);
  });

  it('orders within a level by check, then id, so two readers cannot disagree', () => {
    const reported = [f('b', 'advisory', 'zeta'), f('a', 'advisory', 'alpha'), f('c', 'advisory', 'alpha')];
    expect(sortByUrgency(reported).map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('a level the panel did not carry can neither look urgent nor hide the urgent one', () => {
  it('sorts with advisory, not above blocking', () => {
    expect(urgencyRank(undefined)).toBe(urgencyRank('advisory'));
    expect(urgencyRank('')).toBe(urgencyRank('advisory'));
    expect(urgencyRank('whatever')).toBe(urgencyRank('advisory'));
    expect(sortByUrgency([f('no-level'), f('blocked', 'blocking')]).map((x) => x.id))
      .toEqual(['blocked', 'no-level']);
  });

  it('still ranks blocking first and pass last', () => {
    expect(urgencyRank('blocking')).toBeLessThan(urgencyRank('advisory'));
    expect(urgencyRank('advisory')).toBeLessThan(urgencyRank('pass'));
  });
});

describe('sorting is presentation: it does not touch the report', () => {
  it('leaves the array it was handed in the checker order', () => {
    const reported = [f('a', 'advisory'), f('z', 'blocking')];
    const ordered = sortByUrgency(reported);
    expect(reported.map((x) => x.id)).toEqual(['a', 'z']);
    expect(ordered).not.toBe(reported);
  });

  it('is the comparator the two callers share', () => {
    expect(byUrgency(f('z', 'blocking'), f('a', 'advisory'))).toBeLessThan(0);
    expect(byUrgency(f('a', 'advisory'), f('z', 'blocking'))).toBeGreaterThan(0);
    expect(byUrgency(f('a', 'advisory', 'a'), f('b', 'advisory', 'b'))).toBeLessThan(0);
    expect(byUrgency(f('same', 'advisory', 'same'), f('same', 'advisory', 'same'))).toBe(0);
  });
});
