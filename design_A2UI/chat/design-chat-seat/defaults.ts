/**
 * THE DEFAULT CONVERSATION — one per session, or the one that is already there.
 *
 * The seat lands on the conversation its package points to; if that row is gone, the newest row
 * in the list; and only when the package genuinely has none does one get created. The read runs
 * before every decision, so a conversation that already exists is RETURNED and never duplicated.
 *
 * THE ONE-AT-A-TIME RULE, AND WHAT IT CANNOT DO. Two seats for the same session in one page used
 * to race: both read an empty list, both created, and the package ended with two empty
 * conversations. The in-flight map below makes the second caller await the first, and the re-read
 * makes a caller that arrives after the first has finished see the row the first created. Across
 * TWO SEPARATE PAGE LOADS the client cannot be atomic — the check and the create are two requests
 * with a page between them — and that window belongs to the server: a get-or-create for the
 * session's conversation is the only way to close it. What is here is the client's half, stated
 * as such.
 *
 * A FAILED READ IS NOT AN EMPTY ONE. The row list is only assigned by a successful read, so a
 * null list means "this seat could not find out", and that is never a reason to create.
 */
import { pointPackageAt } from '@/shared/conversations';

/** One open-or-create per session at a time, in this page. */
const IN_FLIGHT = new Map<string, Promise<void>>();

/**
 * THE DEFAULT OPEN. It does nothing until the seat knows its session and its owner has asked for
 * the default (the seat's own update or the shell's call); then one attempt stands for every
 * caller, and the row that exists is adopted rather than a second one created.
 */
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
  host._wantsDefaultConversation = false;
  host._openingDefault = true;
  try {
    await host._readPackageConversations(host._userId());
    if (!Array.isArray(host._conversationRows)) return;
    const rows = host._conversationRows.filter((row: any) => !row.archived);
    if (!rows.length) {
      /* NO CONVERSATION EXISTS FOR THIS SESSION — the only case that creates, and the create path
         has its own one-at-a-time latch (`_creatingConversation`). */
      host._startNewConversation();
      return;
    }
    const bound = String(host.conversationId ?? '');
    const boundRow = bound ? rows.find((row: any) => String(row.id) === bound) : undefined;
    const withMessages = rows.filter((row: any) => Number(row.messageCount ?? 0) > 0);
    /*
     * THE DEFAULT IS A CONVERSATION WITH SOMETHING IN IT. A row created by an earlier bad load is
     * empty; opening it draws a blank thread, which reads as the chat never loading. When the bound
     * row is empty and another row has turns, the row with turns is the default; a bound row with
     * turns is kept, and a package with no turns at all keeps its newest.
     */
    const target = (boundRow && Number(boundRow.messageCount ?? 0) > 0)
      ? boundRow
      : (withMessages[0] ?? boundRow ?? rows[0]);
    if (boundRow && String(target.id) === bound) return;
    host._moveSeatTo(String(target.id), { tab: target.tab || 'chat' });
    pointPackageAt({ sessionId: session, userId: host._userId() }, String(target.id)).catch((err: unknown) => {
      host._listNote = `This package could not be pointed at its last chat: ${String((err as Error)?.message ?? err)}`;
      host.requestUpdate();
    });
  } finally {
    /* THE OPEN IS OVER WHEN THE READ AND THE MOVE ARE. The create, if one was started, is
       covered by `_creatingConversation` from here on. */
    host._openingDefault = false;
  }
}
