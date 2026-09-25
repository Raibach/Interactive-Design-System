/**
 * formatWhen — the app's one writer of a moment.
 *
 * It moved here from the Evals feed when the conversations list needed the same shape (the
 * owner, 2026-09-24: "can you add timestamps to the conversations when they're saved"), and
 * this file pins the two things that make having one worth it: the shape, and what happens to a
 * value it cannot read.
 *
 * THE SHAPE IS ASSERTED AS A SHAPE, NOT AS A STRING, deliberately. The format is local — it
 * goes through the browser's own date and time formatting — so "Sep 24, 2026, 20:25:29" is
 * what a machine in Chicago draws and a machine in Berlin draws the same instant differently.
 * A test pinning that string would pass on the machine it was written on and fail everywhere
 * else; evalFeed.test.ts asserts the raw stamp on the row's title for the same reason.
 */
import { describe, it, expect } from 'vitest';
import { formatWhen } from '@/shared/when';

describe('formatWhen', () => {
  it('writes a date and a time, in the one shape', () => {
    expect(formatWhen('2026-09-24T20:25:29Z'))
      .toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{2}:\d{2}:\d{2}$/);
  });

  it('gives back what it cannot read, rather than inventing a date', () => {
    // A server that sent something else is telling the truth about itself, and a row saying
    // "Invalid Date" would hide it.
    expect(formatWhen('')).toBe('');
    expect(formatWhen('not a time')).toBe('not a time');
  });
});
