/**
 * when — how the app writes a moment.
 *
 * ONE FORMAT, ONE HOME. A timestamp is a fact with a shape, and the app was beginning to
 * grow a second writer of it: the Evals feed formatted date + time inline, and the
 * conversations list needs the same thing to say when a thread was last saved. Two writers
 * of one shape is how "Sep 24, 2026, 20:25:29" and "9/24/26 8:25 PM" end up on the same
 * screen, so the shape lives here and both read it.
 *
 * "2026-09-24, 20:25:29" — the same two facts n8n's Run-at column shows. The format was
 * drawn from there when the Evals feed was built, and it is kept as it was: moving it to
 * this file is a change of home, not of value.
 *
 * AN UNPARSEABLE VALUE IS RETURNED AS IT CAME. A server that sent something else is telling
 * the truth about itself, and "Invalid Date" under a row would hide that.
 */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-US', { hour12: false });
}
