/**
 * THE OPEN THAT ARRIVES BEFORE THE ROOM.
 *
 * A console card press changes the header tab to Design and asks the Design room to open a
 * session. The room is a lazy chunk: for the first frames of that tab it does not exist, so an
 * event dispatched then is heard by nobody and the room lands on its own default page.
 *
 * The note is written BEFORE the tab changes and read once when the room mounts. The event is
 * still dispatched as well, for the case where the room is already standing. The age limit keeps
 * a note from a failed navigation from opening something unrelated much later.
 */
export type ToolOpenDetail = {
  openTag?: string;
  openSession?: string;
  openSystem?: string;
};

const MAX_AGE_MS = 15_000;

let pending: { detail: ToolOpenDetail; at: number } | null = null;

export function rememberToolOpen(detail: ToolOpenDetail): void {
  pending = { detail, at: Date.now() };
}

export function takeToolOpen(): ToolOpenDetail | null {
  if (!pending) return null;
  const { detail, at } = pending;
  pending = null;
  return Date.now() - at <= MAX_AGE_MS ? detail : null;
}
