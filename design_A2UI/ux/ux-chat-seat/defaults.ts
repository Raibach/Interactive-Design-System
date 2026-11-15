/**
 * THE DEFAULT CONVERSATION — one per session, or the one that is already there.
 *
 * The UX seat's rule is the chat seat's, with one addition of its own: the UX tab opens the
 * application's first conversation through `_loadUxStore`, so this default stands aside while
 * that tab is the standing one.
 *
 * THE ONE-AT-A-TIME RULE. A map keyed by the session makes every caller in the page share one
 * run, and every decision re-reads the package's list first, so a conversation that exists is
 * adopted and never duplicated. Across two separate page loads the client cannot be atomic; that
 * window belongs to the server, and this file says so rather than pretending.
 */
import { pointPackageAt } from '@/shared/conversations';

const IN_FLIGHT = new Map<string, Promise<void>>();

export function ensureDefaultConversation(host: any): Promise<void> {
  const session = String(host.sessionId ?? '');
  if (!session || !host._wantsDefaultConversation) return Promise.resolve();
  const running = IN_FLIGHT.get(session);
  if (running) return running;
  const run = openOrCreate(host, session).finally(() => {
    if (IN_FLIGHT.get(session) === run) IN_FLIGHT.delete(session);
  });
  IN_FLIGHT.set(session, run);
  return run;
}

async function openOrCreate(host: any, session: string): Promise<void> {
    /* THE UX TAB OPENS THE APPLICATION'S FIRST CONVERSATION (see _loadUxStore). */
    if (host.activeTab === 'ux') return;
    if (!host._wantsDefaultConversation || !host.sessionId) return;
    host._wantsDefaultConversation = false;
    host._openingDefault = true;
    try {
      await host._readPackageConversations(host._userId());
      /* A FAILED READ IS NOT AN EMPTY ONE. The row list is only assigned by a successful read, so
         a null list means "this seat could not find out", and that is never a reason to create a
         conversation. The read's own failure is what the card says. */
      if (!Array.isArray(host._conversationRows)) return;
      const rows = host._conversationRows.filter((row) => !row.archived);
      if (!rows.length) {
        host._startNewConversation();
        return;
      }
      const bound = String(host.conversationId ?? '');
      const boundRow = bound ? rows.find((row: any) => String(row.id) === bound) : undefined;
      const withMessages = rows.filter((row: any) => Number(row.messageCount ?? 0) > 0);
      /* THE DEFAULT IS A CONVERSATION WITH SOMETHING IN IT — an empty row draws a blank thread and
         reads as the chat not loading. A bound row with turns is kept; otherwise the newest row
         with turns is the default, and a package with no turns at all keeps its newest. */
      const target = (boundRow && Number(boundRow.messageCount ?? 0) > 0)
        ? boundRow
        : (withMessages[0] ?? boundRow ?? rows[0]);
      if (boundRow && String(target.id) === bound) return;
      host._moveSeatTo(String(target.id), { tab: target.tab || 'chat' });
      if (host.sessionId) {
        pointPackageAt({ sessionId: host.sessionId, userId: host._userId() }, String(target.id)).catch((err) => {
          host._listNote = `This package could not be pointed at its last chat: ${String((err as Error)?.message ?? err)}`;
          host.requestUpdate();
        });
      }
    } finally {
      /* THE OPEN IS OVER WHEN THE READ AND THE MOVE ARE. The create, if one was started, is
         covered by `_creatingConversation` from here on. */
      host._openingDefault = false;
    }
}
