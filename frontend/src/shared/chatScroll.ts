/**
 * chatScroll — where a newly appended message puts the view.
 *
 * This is the whole of the chat's scroll policy, in one place, because the
 * version that lived inline in the component carried a bug that reads as the
 * assistant ignoring you: the flag meaning "the person has scrolled away from
 * the newest message" was also written by the app's OWN scroll — the deliberate
 * move that aligns a reply's first line with the top of the viewport. A long
 * reply left the view scrolled to its start, i.e. above the bottom, i.e. flagged
 * as "the person is reading history" — and from then on nothing scrolled: every
 * later reply was appended below the fold and stayed there until the person
 * scrolled down by hand. The replies were arriving. They were out of view.
 *
 * So the question is not "is the view at the bottom" — a reply too tall for the
 * viewport is read from its start and is never at the bottom while it is being
 * read. The question is whether the NEWEST MESSAGE is still in front of them:
 *
 *   following  — its first line is at or above the bottom edge of the viewport,
 *                so the view is with the conversation and may be moved.
 *   not        — they have scrolled back past it, into older turns. Leave it.
 *
 * The person's own turn is the anchor. Whatever the view was doing, what they
 * just said and the answer that follows it belong on screen: that is the reset.
 *
 * FAIL LOUD lives here as a shape, not a warning: `hold` is the only outcome
 * that does nothing, and it is reachable only from a deliberate scroll away from
 * the newest message.
 */

/** Within this many pixels of the bottom counts as the bottom. */
export const BOTTOM_SLACK = 30;

/**
 * ARE A RUN'S RESULTS THE THING TO READ?
 *
 * The owner, 2026-09-24: "the results after run have to load at the top of the results. You can't
 * load it at the bottom of the results." A thread that carries results is a READING, and it is
 * read from the head of the results — the "Your Results" line first, the answer below it, and any
 * later turn below that.
 *
 * THE FACT IS THE RESULTS EXISTING, NOT THE RESULTS BEING LAST. This was keyed on the newest turn
 * being a result, and a package's results conversation does not always end there: measured in
 * Postgres the same evening, the run's results were filed at 21:01:51 and her own turns were
 * written after them, so the newest turn was hers — the head was never placed, the column followed
 * to the tail, and the person landed at the bottom of the output they had just produced.
 *
 * AND THE PERSON SPEAKING ENDS IT. Once they have said something since the results, the thread is
 * a conversation again and follows its newest turn like any other — answering the results is
 * exactly the case where the newest words are the ones to see.
 */
export function resultsAreTheReading(
  thread: Array<{ role?: unknown; result?: unknown }>,
): boolean {
  const head = thread.findIndex((m) => m?.result === true);
  if (head < 0) return false;
  return !thread.slice(head).some((m) => String(m?.role ?? '') === 'user');
}

/** The numbers this policy reads off the scroll container. */
export interface ChatViewport {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

/** Touching the bottom, within a few pixels either way. */
export function isAtBottom(v: ChatViewport, slack: number = BOTTOM_SLACK): boolean {
  return v.scrollHeight - v.scrollTop - v.clientHeight <= slack;
}

/**
 * Is the newest message still in front of the person?
 *
 * `newestTop` is the newest message's offset from the top of the scrollable
 * content — null when there is no message element to measure (an empty
 * conversation, or a tab that is not drawing the thread). With nothing to
 * measure there is nothing to be scrolled away from, so the bottom decides.
 */
export function isFollowingNewest(
  v: ChatViewport,
  newestTop: number | null,
  slack: number = BOTTOM_SLACK,
): boolean {
  if (newestTop === null) return isAtBottom(v, slack);
  return v.scrollTop + v.clientHeight >= newestTop - slack;
}

/** What an append does to the view. */
export type AppendTarget =
  /** The newest content, pinned to the bottom of the viewport. */
  | 'bottom'
  /** The new reply's first line, aligned to the top — read it from the start. */
  | 'newest-top'
  /** Do nothing: the person is reading older turns. */
  | 'hold';

/**
 * Where an appended message should put the view.
 *
 * A message from the person always goes to the bottom, and that is not a
 * convenience: they typed it, so it and the reply it asks for are the thing on
 * screen now, and any earlier scroll position is superseded. Everything else is
 * read from its own start, and only while the view is still with the
 * conversation.
 */
export function appendTarget(
  role: 'user' | 'assistant',
  opts: { following: boolean; newestTop: number | null },
): AppendTarget {
  if (role === 'user') return 'bottom';
  if (!opts.following) return 'hold';
  return opts.newestTop === null ? 'bottom' : 'newest-top';
}

/** The offset of a message element from the top of the scrollable content. */
export function messageTop(
  container: { scrollTop: number; getBoundingClientRect: () => { top: number } },
  el: { getBoundingClientRect: () => { top: number } },
): number {
  return el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
}
