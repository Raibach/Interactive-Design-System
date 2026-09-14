/**
 * Where a newly appended message puts the view.
 *
 * The bug this file exists for: the flag that meant "the person scrolled away
 * from the newest message" was also written by the app's own scroll — the
 * deliberate move that aligns a reply's first line with the top of the viewport.
 * A long reply left the view at its own start, above the bottom, and from then on
 * nothing scrolled: replies arrived below the fold and stayed there. So the
 * cases below are the ones that decide whether a person sees the answer.
 */
import { describe, it, expect } from 'vitest';
import {
  isAtBottom,
  isFollowingNewest,
  appendTarget,
  messageTop,
  BOTTOM_SLACK,
} from '@/shared/chatScroll';

const viewport = (scrollTop: number, clientHeight = 600, scrollHeight = 2000) => ({
  scrollTop,
  clientHeight,
  scrollHeight,
});

describe('the bottom is the bottom, within a few pixels', () => {
  it('is at the bottom when the remaining scroll is inside the slack', () => {
    expect(isAtBottom(viewport(1400))).toBe(true);
    expect(isAtBottom(viewport(1400 - BOTTOM_SLACK))).toBe(true);
  });

  it('is not at the bottom when there is more than the slack below', () => {
    expect(isAtBottom(viewport(1400 - BOTTOM_SLACK - 1))).toBe(false);
  });
});

describe('following the newest message is not the same as being at the bottom', () => {
  it('follows while the view sits inside the newest message', () => {
    // Reading a reply from its own first line: the bottom is 900px away, and it
    // is still the newest message that is in front of the person.
    expect(isAtBottom(viewport(1100))).toBe(false);
    expect(isFollowingNewest(viewport(1100), 1100)).toBe(true);
  });

  it('stops following once the person has scrolled back past it', () => {
    expect(isFollowingNewest(viewport(200), 1100)).toBe(false);
  });

  it('lets the bottom decide when there is no message to measure', () => {
    expect(isFollowingNewest(viewport(1400), null)).toBe(true);
    expect(isFollowingNewest(viewport(0), null)).toBe(false);
  });
});

describe('the person\'s own turn is the anchor', () => {
  it('goes to the bottom whatever the view was doing', () => {
    expect(appendTarget('user', { following: false, newestTop: 1100 })).toBe('bottom');
    expect(appendTarget('user', { following: true, newestTop: 1100 })).toBe('bottom');
  });
});

describe('a reply is read from its own start', () => {
  it('aligns the reply to the top while the view is with the conversation', () => {
    expect(appendTarget('assistant', { following: true, newestTop: 1100 })).toBe('newest-top');
  });

  it('holds when the person has scrolled into older turns', () => {
    expect(appendTarget('assistant', { following: false, newestTop: 1100 })).toBe('hold');
  });

  it('falls back to the bottom when there is no element to align', () => {
    expect(appendTarget('assistant', { following: true, newestTop: null })).toBe('bottom');
  });
});

describe('the regression this replaces', () => {
  it('keeps following after a reply too tall to fit: the app\'s own scroll is not the person leaving', () => {
    // A 1500px reply on a 600px viewport. Anchoring it to the top leaves the view
    // at 1100 — far from the bottom of a 2000px thread — and the next reply has to
    // land on screen anyway.
    const afterAnchor = viewport(1100);
    expect(isAtBottom(afterAnchor)).toBe(false);
    const following = isFollowingNewest(afterAnchor, 1100);
    expect(following).toBe(true);
    expect(appendTarget('assistant', { following, newestTop: 2600 })).toBe('newest-top');
  });
});

describe('measuring a message inside the scroll container', () => {
  it('is the element top relative to the content, not the viewport', () => {
    const container = { scrollTop: 400, getBoundingClientRect: () => ({ top: 60 }) };
    const el = { getBoundingClientRect: () => ({ top: 160 }) };
    expect(messageTop(container, el)).toBe(500);
  });
});
