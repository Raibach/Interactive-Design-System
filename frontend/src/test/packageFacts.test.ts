/**
 * The package's own facts, read by ONE reader.
 *
 * The test that matters here is the last one: it is the failure the app was stuck in, written
 * down. A package that plainly HAS a description — the console card shows it, the seat beside the
 * Run reads it — was reviewed as if it had none, because the review read a copy the assembly never
 * filled. The Run was held on a requirement that was already satisfied, and the button that would
 * have cleared it was DISABLED, because the seat's reader said the description was there. Held
 * forever, by two readers of one fact.
 *
 * Measured live on 2026-09-23, on the Insurance News Scout package: the seat read
 * "Finds and summarizes the latest insurance news, …" and the review was told `(none)`.
 */
import { describe, it, expect } from 'vitest';
import { packageDescription, packageTitle } from '@/shared/packageFacts';
import { reviewFlow } from '@/shared/flowReview';

const SURFACE = {
  description: 'Finds and summarizes the latest insurance news, including new products.',
  title: 'Insurance News Scout',
};

describe('packageDescription — the surface is the reader, the row is the fallback', () => {
  it('answers with the surface value when there is one', () => {
    expect(packageDescription(SURFACE, undefined)).toBe(
      'Finds and summarizes the latest insurance news, including new products.',
    );
  });

  it('falls back to the row when the surface has not been populated yet', () => {
    expect(packageDescription(undefined, '  From the row.  ')).toBe('From the row.');
    expect(packageDescription({}, 'From the row.')).toBe('From the row.');
  });

  it('prefers the surface when the two disagree — it is the copy the seat reads', () => {
    // The seat judges the package from the surface, and a button that disagrees with the seat is
    // the bug. The surface is also the copy written in every case, a draft's included.
    expect(packageDescription(SURFACE, 'a stale row')).toBe(SURFACE.description);
  });

  it('treats whitespace as nothing, on both sides', () => {
    // The question is whether a description EXISTS, and spaces are not one — the same test the
    // seat applies before it spends its button.
    expect(packageDescription({ description: '   ' }, '  ')).toBe('');
    expect(packageDescription({ description: '   ' }, 'real words')).toBe('real words');
    expect(packageDescription(null, null)).toBe('');
    expect(packageDescription({ description: 42 }, 'words')).toBe('words');
  });
});

describe('packageTitle — the same pair, read the same way', () => {
  it('answers from the surface first, then the row', () => {
    expect(packageTitle(SURFACE, 'a stale row')).toBe('Insurance News Scout');
    expect(packageTitle({}, 'From the row')).toBe('From the row');
    expect(packageTitle(undefined, undefined)).toBe('');
  });
});

describe('the review and the seat cannot disagree about the description', () => {
  const seats = [
    { name: 'System Role', type: 'system-role', content: 'You are precise.' },
    { name: 'User Role', type: 'user-role', content: 'Find the latest insurance news.' },
    { name: 'Agent Role', type: 'agent-role', content: 'Scout the news and summarise it.' },
  ];

  it('raises no I2 for a package the seat can see a description for', () => {
    // THIS IS THE FIX, and it is the shape of the failure: the surface holds the description and
    // the row does not, because the assembly never carried it. Read through the one reader, the
    // requirement is met and the Run is not held on it.
    const review = reviewFlow({
      title: packageTitle(SURFACE, undefined),
      description: packageDescription(SURFACE, undefined),
      saved: true,
      sections: seats,
    });
    expect(review.some((u) => u.id === 'I2')).toBe(false);
    expect(review.some((u) => u.level === 'blocking')).toBe(false);
  });

  it('and the row alone would have held it — the defect, pinned', () => {
    // What was there before: the review asked the row, the row had no such field, and I2 held a
    // package whose description was on screen. Kept as a test so the copy-read cannot come back.
    const assembledWithoutDescription: { description?: string } = {};
    const review = reviewFlow({
      title: packageTitle(SURFACE, undefined),
      description: packageDescription(undefined, assembledWithoutDescription.description),
      saved: true,
      sections: seats,
    });
    expect(review.map((u) => u.id)).toEqual(['I2']);
    expect(review[0].level).toBe('blocking');
    // And the repair it offers is one the app will never make for the person — it needs their
    // words. So a false I2 is not a blocker they can press away.
    expect(review[0].repair.via).toBe('words');
  });
});
