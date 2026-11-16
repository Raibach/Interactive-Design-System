/**
 * session.ts — THE TOOLS TAB'S OWN SESSION CONTRACT.
 *
 * ONE SOURCE, AND NOTHING BORROWED. The seat's session id comes from the Tools assembly's own
 * answer, which writes the visit's row at `/session/design_session_id` in the tab's data model.
 * The console's package snapshot is NOT a source: a snapshot names the session that is already
 * gone, and reading it is how a fresh press opened an old conversation. The backend pair that
 * makes and reads the visit's row lives in `backend/routes/tools_session.py`, its own file, so
 * the Tools lifecycle never shares the read the other tabs use.
 *
 * THE ONE EXCEPTION IS WHEN THE ANSWER IS HANDED OVER, AND IT IS NOT A SECOND SOURCE. The room
 * reads the id out of the Tools answer with this same function and gives it to the seat before the
 * surface is drawn, so the conversation is read while the page's components mount (owner,
 * 2026-11-16: "make the chat load first in the tools tab"). The seat then resolves the same id
 * from the same answer, finds it unchanged and does not enter the package twice.
 */
export function toolsSessionId(model: unknown): string {
  const data = (model ?? {}) as Record<string, unknown>;
  const session = (data.session ?? {}) as Record<string, unknown>;
  return String(session.design_session_id ?? "").trim();
}
