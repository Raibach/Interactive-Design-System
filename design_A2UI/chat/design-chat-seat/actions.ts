/**
 * THE SEAT'S CONVERSATION PRESSES — the work behind a conversation being opened, started, moved
 * to or picked.
 *
 * Moved from `design-chat-seat.ts` without a rule changed. Each function takes the seat it is
 * acting for, so the seat keeps one-line members of the same names and the template and the run's
 * own code still find them where they were.
 *
 * THE PLACE MODULES KEEP THE PRESSES THEMSELVES. `conversations/actions/` holds the handlers that
 * the list raises; this file holds what the seat does around them: the new conversation's work,
 * the move a Run makes when its results land, and the default-open a fresh page asks for.
 */
import { logger } from '@/lib/logger';
import * as conversations from '../conversations/actions';
import { ensureDefaultConversation } from './defaults';

export const NEW_PROMPT_HELLO =
  'Introduce yourself in a sentence or two. If the person has not asked anything yet, '
  + 'tell them in your own words and in a few short lines what this room handles, then ask '
  + 'where they want to start. Do not guess what they are building, and offer no '
  + 'suggestions and no buttons — there is nothing yet to have an opinion about.';

/**
 * ADOPT A CONVERSATION — a Run's results arrived, and the seat moves into their thread.
 *
 * The greeting is spent here rather than forbidden, so the next thing that is an arrival is
 * answered normally; the thread being left is archived by the run, not deleted.
 */
export function adoptConversationAction(host: any, id: string): void {
    if (!id || id === host.conversationId) return;
    const leaving = String(host.conversationId ?? '');
    /*
     * AND SHE SAYS NOTHING ABOUT A RUN THAT JUST FINISHED.
     *
     * The results landing is not an arrival she answers — it is the output of the thing the person
     * pressed. The owner, 2026-09-24: "she's not supposed to be chatting after run. She is done
     * with recommendations after run." Measured the same evening: filing a run's results was
     * followed by her opening the conversation out loud ("the app asked for this turn
     * (person_turn=false): Grace is opening the conversation"), which is a greeting about work she
     * had already delivered, sitting on top of the answer they pressed Run to read.
     *
     * The greeting is spent here rather than forbidden, so the next thing that IS an arrival — the
     * person opening this package later — is answered normally (`_takeArrival` clears the flag).
     */
    host._wantsGreeting = '';
    host._greeted = true;
    // THE HOST'S WORD IS THE AUTHORITY FOR THIS ONE MOVE — see _adoptedByHost. The
    // list is re-read alongside it, so the belongs-check passes for every later turn.
    host._adoptedByHost = id;
    void host._readPackageConversations(host._userId());
    host._moveSeatTo(id);
    /*
     * AND THE RUN ARCHIVES WHAT IT LEFT.
     *
     * The owner, 2026-09-24, describing what a Run should do to the package's conversations:
     * "it creates a new conversation and archives the one that was there when user arrived. So
     * now you have two conversations — you have the original conversation on load and then you
     * have the results conversation. It's creating a conversation audit trail."
     *
     * The backend makes the results conversation and files them in it (routes/teacher.py, "A RUN
     * GETS ITS OWN CONVERSATION"); archiving the one being left is this half, so the package's
     * list reads as the record it is: the thread the person was in, closed and dated, above the
     * run's own. Archived and never deleted — `_readPackageConversations` asks for the archived
     * rows too, and the row wears the chip that says so.
     *
     * A PERSON STARTING A CONVERSATION STILL ARCHIVES NOTHING (see _createConversation: a
     * package's list is theirs to keep or clear). This is the Run's act, not the seat's habit.
     */
    if (leaving) {
      void host._conversationWrite(
        `/api/conversations/${leaving}/archive`,
        'POST',
        undefined,
        host._userId(),
      ).catch((err) => {
        // NOT SWALLOWED, and not fatal: the results are on screen either way, and what is lost
        // is the row's own note that the thread is closed. The Trace tab reads this logger.
        logger.warn('the run could not archive the conversation it replaced', {
          conversationId: leaving,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
}

/**
 * START A NEW CONVERSATION. The console's seat archives its predecessor and repoints the session;
 * a package's seat creates its own thread and moves into it. A failure stops the sequence and is
 * said in the thread.
 */
export async function createConversationAction(host: any): Promise<void> {
    const userId = host._userId();
    const scope = host._seatIsConsole === null
      ? await host._readSeatScope(userId)
      : (host._seatIsConsole ? 'console' : 'package');
    if (scope === 'unknown') {
      // The gate could not be read, so nothing is attempted — and the reason is said rather
      // than shown as a button that quietly does nothing.
      host._historyError =
        'Whether this chat is the console’s could not be read, so nothing was changed — no conversation was archived.';
      host.requestUpdate();
      return;
    }
    /*
     * A PACKAGE STARTS ITS OWN CONVERSATION TOO — this was one half of a deadlock.
     *
     * It returned here and did nothing at all: no request, no note, no message (measured
     * 2026-09-23 — zero fetches). And the seat's other control, the trash, refused to remove the
     * conversation you were in ("start a new one, then remove it"). So a package's one row could
     * not be removed, and no second row could be started to move off it — a person cleaning up had
     * no move at all. The owner: "I'm not able to delete conversations from the packages. It's just
     * basic CRUD process I thought."
     *
     * WHAT IT DOES IS THE PLAIN THING: create a conversation for THIS package and move the seat
     * into it, leaving the one just left in the list, where it can be returned to or deleted. The
     * console's flow ARCHIVES its predecessor instead — that is the console's own act and it stays
     * there (the owner, 2026-09-19: "this is the only place that this global chat is associated …
     * don't just apply it to both areas"). A package's list is the person's to keep or clear, which
     * is what CRUD means here.
     *
     * THE SESSION IS REPOINTED, the same hop the console's flow makes: the seat's conversation id
     * comes from this session's own column, so moving the column is what makes a reload land in the
     * new thread instead of resurrecting the old one.
     */
    if (scope === 'package') {
      host._historyError = '';
      try {
        /* THE MECHANICS ARE THE SHARED MODULE'S. It creates, points the package, moves the seat
           and reads the list BEFORE returning, so a greeting fired after it can never be refused
           by the seat's own ownership guard. */
        await host._conversationModule.createPackageConversation.call(
          host._conv(), userId, host._successorTitle() ?? 'New Chat',
        );
        /* A NEW CONVERSATION OPENS WITH HER OWN WORD, not with an empty card — the Tools seat's
           own rule, applied here (owner, 2026-11-07). The turn lands in the thread just created;
           `_greeted` stops the arriving path from saying it twice. */
        host._greeted = true;
        void host._send(
          'A person has just started a new chat in the design room — '
          + 'the Chat tab, where the design work and the console are discussed. '
          + 'They have said nothing yet. ' + NEW_PROMPT_HELLO,
          { silent: true },
        );
        host.requestUpdate();
      } catch (err) {
        host._historyError =
          `A new conversation could not be started: ${String((err as Error)?.message ?? err)}`;
        host.requestUpdate();
      }
      return;
    }
    const leaving = host.conversationId;
    const title = host._firstTurnTitle();
    const writing = host._conversationWrite;
    host._historyError = '';
    try {
      if (leaving && title) {
        await writing(`/api/conversations/${leaving}`, 'PUT', { title }, userId);
      }
      if (leaving) {
        await writing(`/api/conversations/${leaving}/archive`, 'POST', undefined, userId);
      }
      const created = await writing(
        '/api/conversations',
        'POST',
        { session_id: host.sessionId ?? undefined, title: host._successorTitle() },
        userId,
      );
      const next = typeof created?.id === 'string' ? created.id : '';
      if (!next) throw new Error('the new conversation came back without an id');
      if (host.sessionId) {
        await writing(`/api/prompt-sessions/${host.sessionId}`, 'PUT', { conversation_id: next }, userId);
      }
      // The seat moves, exactly as it does when a conversation is picked from the list.
      host.messages = [];
      host._local = [];
      host._inspectionReports = [];
      host.conversationId = next;
      // AND THE COUNT MOVES WITH IT: one archived, one created — the package's total is
      // what the leading bar counts, so it is re-read rather than guessed at.
      void host._readPackageConversations(userId);
      // NO GREETING EVENT, AND NO ASSEMBLY. The owner, 2026-09-19: "I don't care about a
      // greeting. I care that the conversations create and then are they retrievable" — and
      // a greeting raised by re-assembling would reload the whole surface, which this must
      // never do: everything a new conversation touches stays inside this chat.
      host.dispatchEvent(
        new CustomEvent('conversation-change', {
          bubbles: true,
          composed: true,
          detail: { conversationId: next },
        }),
      );
    } catch (err) {
      const why = String((err as Error)?.message ?? err);
      host._historyError = `A new conversation could not be started, so this one is still yours: ${why}`;
      host.requestUpdate();
    }
}

/** THE DEFAULT OPEN a fresh page asks for — the seat's newest thread of its own package. */
export function loadDefaultConversationAction(host: any): void {
    host._wantsDefaultConversation = true;
    void ensureDefaultConversation(host);
}

/** A conversation row was pressed. */
export function selectConversationPress(host: any, e: Event): void {
  conversations.selectConversationAction(host, e);
}

/** The plus beside the conversations bar. */
export function startNewConversationPress(host: any): void {
  conversations.newConversationAction(host);
}

/** The bar itself: open or close the conversation card. */
export function toggleConversationsPress(host: any): void {
  conversations.toggleConversationsAction(host);
}

/** Enter or Space on the bar. */
export function conversationsKeyPress(host: any, e: KeyboardEvent): void {
  conversations.conversationsKeyAction(host, e);
}

/** The trash on a row, armed then confirmed. */
export function removeConversationPress(host: any, e: Event): void {
  conversations.removeConversationAction(host, e);
}

/** A conversation's own open mark inside the thread. */
export function pickConversationPress(host: any, e: Event): void {
  conversations.pickConversationAction(e);
}
