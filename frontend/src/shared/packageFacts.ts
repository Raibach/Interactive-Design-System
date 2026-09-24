/**
 * packageFacts — the package's own facts, read the way the seat that judges them reads them.
 *
 * WHY THIS FILE EXISTS, and it cost a Run every time. The pre-Run review asks one question about
 * the package's description — "is there one?" — and the seat beside it draws one control from the
 * same question: the "Add description" button is spent when the package HAS a description
 * (shared/buttonState, "the description: done when the package has one"). The two were asking it
 * of DIFFERENT COPIES:
 *
 *   the seat        reads the surface's `/session/description` — `packageDescription`
 *   the review      read the session row — `currentPromptSession.description`
 *
 * and the row's copy was never filled: the composer assembly builds the session object from the
 * surface and carries `id`, `title`, the sections, the compiled output, the conversation and the
 * saved workspace, and drops `description`. So on a package that plainly HAS one — the console
 * card shows it, the seat reads it — the review reported `(none)`, raised I2, and held the Run.
 * The person then saw a blocker they could not clear: the repair is `via: 'words'`, so Grace
 * offers it as a button, and the button is DISABLED, because the seat's reader says the
 * description is already there. Held forever, by two readers of one fact.
 *
 * THAT IS THIS REPOSITORY'S OLDEST RULE, restated in shared/buttonState: "Keeping a second record
 * of one fact … would be two records that can disagree, and the one that lies is always the copy
 * nobody re-derives." The review was that copy.
 *
 * SO THERE IS ONE FUNCTION, and the review asks it. The surface wins because the surface is the
 * copy that is written in EVERY case: `handlePromptDescriptionChange` writes it for a saved
 * package and for a draft alike, and the assembly rehydrates it on open — while a draft has no row
 * to write to at all. The row is the fallback, for the instant before the surface is populated.
 *
 * WHAT THIS IS NOT. It is not a cache and not a second store: nothing is kept here. It is the
 * order two existing copies are read in, written down once so the next reader does not have to
 * rediscover which one lies.
 */

/** The surface's session object, as the renderer holds it. Only the field read is described. */
export interface SurfaceSession {
  description?: unknown;
  title?: unknown;
}

/**
 * THE DESCRIPTION, from the one place it is written.
 *
 * `surface` is the surface's own `/session` object; `row` is the session row's copy. A blank on
 * either side is not a value — the review's question is whether a description EXISTS, and
 * whitespace is not one, which is the same test the seat applies before spending its button.
 */
export function packageDescription(surface: unknown, row: unknown): string {
  const s = (surface as SurfaceSession | null | undefined)?.description;
  const fromSurface = typeof s === 'string' ? s.trim() : '';
  if (fromSurface) return fromSurface;
  const r = typeof row === 'string' ? row.trim() : '';
  return r;
}

/**
 * THE NAME, the same way — the surface first, the row after.
 *
 * The review already read it this way, which is how the asymmetry was visible at all: the title
 * had been given the surface read and the description had not. Both are the same kind of fact
 * about the same package, so both are read here, and the next pair of them has one home.
 */
export function packageTitle(surface: unknown, row: unknown): string {
  const s = (surface as SurfaceSession | null | undefined)?.title;
  const fromSurface = typeof s === 'string' ? s.trim() : '';
  if (fromSurface) return fromSurface;
  const r = typeof row === 'string' ? row.trim() : '';
  return r;
}
