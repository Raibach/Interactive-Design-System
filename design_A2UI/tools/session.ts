/**
 * session.ts — THE TOOLS TAB'S OWN SESSION CONTRACT.
 *
 * ONE SOURCE, AND NOTHING BORROWED. The seat's session id comes from the Tools assembly's own
 * answer, which writes the visit's row at `/session/design_session_id` in the tab's data model.
 * The console's package snapshot is NOT a source: a snapshot names the session that is already
 * gone, and reading it is how a fresh press opened an old conversation. The backend pair that
 * makes and reads the visit's row lives in `backend/routes/tools_session.py`, its own file, so
 * the Tools lifecycle never shares the read the other tabs use.
 */
export function toolsSessionId(model: unknown): string {
  const data = (model ?? {}) as Record<string, unknown>;
  const session = (data.session ?? {}) as Record<string, unknown>;
  return String(session.design_session_id ?? "").trim();
}
