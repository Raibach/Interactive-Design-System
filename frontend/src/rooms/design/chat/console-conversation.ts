/**
 * THE CHAT CONSOLE'S CONVERSATION — this seat's own file, and no other seat reads it.
 *
 * The Tools tab has `tools/conversation.ts`; this is the Chat console's counterpart, with the same
 * behavior and its own content. It reads the CONSOLE package's list: the console's threads and no
 * other tab's. The divider between the tabs is the package, and this file never asks another tab's
 * list, adopts another tab's row, or borrows another tab's conversation code.
 *
 * WHAT IT DOES. It reads the console package's conversation list, reads a conversation's turns,
 * checks that a conversation belongs to this package, moves the seat into one, removes one, and
 * starts one. What stays in the seat is what a person sees and what this tab asks for: its
 * greeting, its send, its scroll record, its own controls.
 *
 * A PLAIN MODULE, NOT AN ELEMENT. Every function takes the seat as `this`, so the bodies below are
 * the seat's own text. `ConsoleConversationHost` states what the conversation may reach; a member
 * it does not name cannot be reached from here.
 */
import { logger } from '@/lib/logger';
import { create, listForPackage, pointPackageAt, remove, type ConversationRow } from '@/shared/conversations';

/** One turn as the seat draws it. The same shape the seats already carry. */
export interface ConversationTurn {
  role?: string;
  content?: string;
  result?: boolean;
  alert?: boolean;
  label?: string;
  nodeId?: string;
}

/** Everything the conversation may reach on a seat, and nothing more. */
export interface ConsoleConversationHost extends HTMLElement {
  messages?: ConversationTurn[];
  conversationId?: string;
  conversations?: Array<{ id?: string; title?: string; tab?: string }>;
  sessionId?: string;
  activeTab: string;
  _historyChecked: boolean;
  _historyError: string;
  _conversationRows: ConversationRow[] | null;
  _conversationsRead: boolean;
  _inspectionReports: ConversationTurn[];
  _local: ConversationTurn[];
  _adoptedByHost: string;
  _userId(): string;
  _moveSeatTo(id: string, opts?: { tab?: string }): void;
  _replayLaneQuery(id: string): Promise<void>;
  _listNote: string;
  _takeArrival(kind: 'resume' | 'blank' | 'console' | 'governance' | 'evaluators'): void;
  _conversationWrite(url: string, method: 'POST' | 'PUT', body: unknown, userId: string): Promise<Record<string, unknown> | null>;
  requestUpdate(): void;
}

/**
 * IS THIS CONVERSATION ONE OF THIS PACKAGE'S?
 *
 * An EMPTY list proves nothing (a fresh package, or a list that failed to load), so only a positive
 * contradiction refuses, and the refusal is LOUD. A seat told about another package's thread is
 * being lied to, and silence is how it happened.
 */
export function belongsToPackage(this: ConsoleConversationHost, id: string): boolean {
  if (String(this._adoptedByHost) === String(id)) return true;
  const list = this.conversations ?? [];
  /* The surface's list carries ACTIVE rows only; this seat's own server read carries the archived
     ones too, and a conversation archived from here is still this package's and must stay openable. */
  if ((this._conversationRows ?? []).some((r) => String(r.id) === String(id))) return true;
  /* AN UNREAD LIST IS NOT A REFUSAL. The package's own conversation list arrives asynchronously,
     and the seat binds its conversation from the room before that read lands. */
  if (this._conversationRows === null) return true;
  if (!list.length) return true;
  if (list.some((c) => String(c?.id ?? '') === String(id))) return true;
  console.error(
    `[chat-panel] refused conversation ${String(id).slice(0, 8)}…: it is not in package ` +
    `${String(this.sessionId ?? '(none)').slice(0, 8)}'s own list of conversations.`,
  );
  return false;
}

/**
 * READ THE OPEN CONVERSATION'S TURNS.
 *
 * NO CONVERSATION YET IS NOT "CHECKED": this used to answer a missing id by marking the history
 * checked, so the id arriving a moment later — the room binds its conversation after this element
 * exists — found a seat that believed it had already read a thread it never asked for.
 *
 * A DENIAL IS LOUD. "You may not read this conversation" must not draw as "nothing was ever said
 * here"; a 403, a 404 and a 500 each say their own status.
 */
export async function loadHistory(this: ConsoleConversationHost): Promise<void> {
  if (this.messages?.length) { this._historyChecked = true; return; }
  if (!this.conversationId) return;
  if (!belongsToPackage.call(this, this.conversationId)) {
    /* A DENIAL IS LOUD (zero-suppression mode). A conversation that does not belong to this
       seat must never draw as a blank or empty thread: the refusal is written on the screen,
       which is also the audit record for the person using it. */
    this._historyError =
      `This conversation is not this seat's: ${String(this.conversationId).slice(0, 8)}… ` +
      'belongs to another tab. Nothing was read.';
    this._historyChecked = true;
    this.requestUpdate();
    return;
  }
  try {
    const resp = await fetch(`/api/conversations/${this.conversationId}/messages?limit=200`, {
      headers: { 'X-User-ID': this._userId() },
    });
    if (!resp.ok) {
      this._historyError = `This conversation could not be read (HTTP ${resp.status}).`;
      console.error(`[chat-panel] history read refused for ${String(this.conversationId).slice(0, 8)}…: HTTP ${resp.status}`);
      this._historyChecked = true;
      this.requestUpdate();
      return;
    }
    const data = await resp.json().catch(() => ({}));
    const rows: ConversationTurn[] = Array.isArray(data?.messages) ? data.messages : [];
    this._historyError = '';
    this._historyChecked = true;
    if (!rows.length) { this.requestUpdate(); return; }
    /* A GOVERNANCE INSPECTION IS A REPORT, NOT A CHAT TURN. The inspector files its verdict in the
       console's own conversation (metadata kind='inspection'); the reports are taken OUT of the
       thread here and drawn under the Approvals tab. */
    const reports: ConversationTurn[] = [];
    for (const row of rows) {
      const meta = (row as { metadata?: { kind?: string; verdict?: string; at?: string } }).metadata;
      if (meta?.kind === 'inspection') {
        logger.info(`[inspection] ${meta.verdict ?? 'not done'} · ${meta.at ?? ''}`, {
          verdict: meta.verdict ?? null,
          at: meta.at ?? null,
        });
        reports.push({ role: row.role, content: row.content });
      }
    }
    this._inspectionReports = reports;
    this.messages = rows
      .filter((row) => (row as { metadata?: { kind?: string } }).metadata?.kind !== 'inspection')
      .map((m) => {
        const meta = (m as {
          metadata?: { kind?: string; alert?: boolean; result?: boolean };
        }).metadata;
        /* A RUN'S RESULTS KEEP THEIR MARK ACROSS A RELOAD: the conversation the run filed them in
           carries kind 'tool-answer' / 'run-result', and the thread draws those as results.
           THE ERROR STATE IS PART OF THE TURN TOO. `alert` is stored with the line; dropping it
           on reload drew a failure as an ordinary answer. */
        return {
          role: m.role,
          content: m.content,
          result:
            meta?.kind === 'tool-answer' || meta?.kind === 'run-result' || meta?.result === true,
          alert: meta?.alert === true,
        };
      });
  } catch (err) {
    this._historyError = 'This conversation could not be read — the server did not answer.';
    this._historyChecked = true;
    console.error('[chat-panel] could not read the package\'s history:', err);
    this.requestUpdate();
  }
}

/**
 * READ THE PACKAGE'S CONVERSATION LIST, AND ADOPT THE NEWEST WHEN NOTHING IS BOUND.
 *
 * `_conversationsRead` means "this seat is no longer waiting on the list", so it is set on every
 * exit, including failures; a wait that only ends when the server answers strands a seat on an
 * unreachable one. A FAILED READ LEAVES THE ROWS NULL ON PURPOSE — "there are no conversations" is
 * a claim only a successful empty read can make.
 */
export async function readPackageConversations(this: ConsoleConversationHost, userId: string): Promise<void> {
  /*
   * THE CHAT SEAT READS ITS OWN PACKAGE — the Console package, and no other tab's threads.
   *
   * The behavior is the Tools tab's, copied into this seat's own file: read the package's own
   * list, adopt the last modified row when nothing is bound. The CONTENT is not shared — the
   * Tools chat, the UX chat and every other tab's conversation belong to their own packages and
   * are not this list. A seat that read all of Design adopted the Figma tool's thread and then
   * refused it as another tab's; the divider is the package.
   */
  if (!this.sessionId) return;
  try {
    let rows: ConversationRow[];
    try {
      rows = await listForPackage({ sessionId: this.sessionId!, userId });
    } catch (err) {
      /* A READ THAT FAILED IS SAID. "Reading the conversations…" held forever over an unreachable
         server is the same dead screen as an empty one, and it is not an answer. */
      this._conversationsRead = true;
      this._listNote = `The conversations could not be read: ${String((err as Error)?.message ?? err)}`;
      this.requestUpdate();
      return;
    }
    /* THE LIST IS REDRAWN WHEN IT CHANGES, AND THE COMPARISON IS MADE BEFORE THE ASSIGNMENT. */
    const rowsChanged = JSON.stringify(rows) !== JSON.stringify(this._conversationRows ?? []);
    this._conversationRows = rows;
    this._conversationsRead = true;

    /*
     * A CONVERSATION NOT IN THIS PACKAGE'S LIST IS NOT THIS PACKAGE'S. The server answers newest
     * first, so the first row is the thread last written to — "the last one" as a person means it.
     * A bound id the list does not contain is stale by the package's own rule, and the newest row
     * replaces it. The caller's package is the only owner this seat answers to.
     */
    const boundIsThisPackages =
      !!this.conversationId &&
      rows.some((row) => String(row.id) === String(this.conversationId));
    if (rows.length && !boundIsThisPackages) {
      this._moveSeatTo(rows[0].id, { tab: rows[0].tab });
      return;
    }
    if (!rowsChanged) return;
    this.requestUpdate();
  } catch (err) {
    this._conversationsRead = true;
    this._listNote = `The conversations could not be read: ${String((err as Error)?.message ?? err)}`;
    this.requestUpdate();
  }
}

/**
 * MOVE THE SEAT INTO A CONVERSATION — one writer for the facts that move together.
 *
 * Four things move the seat: picking a row, the console's new conversation, a package's new
 * conversation, and removing the one the seat is in. Writing these fields by hand in four places is
 * how one of them ends up not clearing the thread, or clears two of the three lists it is drawn
 * from. The tab is the CALLER's: only the list knows which process a row belongs to.
 */
export function moveSeatTo(this: ConsoleConversationHost, id: string, opts: { tab?: string } = {}): void {
  if (id !== this._adoptedByHost) this._adoptedByHost = '';
  this.messages = [];
  this._local = [];
  this._inspectionReports = [];
  this.conversationId = id;
  this._historyError = '';
  if (opts.tab) {
    /* A QUERY RECORD OPENS ON ITS OWN TAB. A conversation filed with `tab = "sessions"` is a stored
       lane query, not a thread — opening it moves to Sessions and REPLAYS the recorded filter. */
    /* THIS SEAT STAYS ON TOOLS (owner, 2026-11-02). A thread born in this tab is stored under the
       chat tab's name, because a conversation has no tab of its own when it is created. Adopting a
       row by its stored tab therefore moved the rail onto Chat while the person was working in
       Tools — the flip they saw between the two. Only the two tabs that are a different process (a
       stored query, and the approvals gate) move this seat. */
    this.activeTab =
      opts.tab === 'approvals' ? 'approvals'
        : opts.tab === 'sessions' ? 'sessions'
          : 'chat';
  }
  if (opts.tab === 'sessions') void this._replayLaneQuery(id);
  this.dispatchEvent(
    new CustomEvent('conversation-change', {
      bubbles: true,
      composed: true,
      detail: { conversationId: id },
    }),
  );
  this.requestUpdate();
}

/**
 * A PERSON PICKED A ROW. The row knows its own tab, both lists are asked, and the package is
 * pointed at the choice — the same two writes in every seat.
 *
 * A QUERY RECORD IS A DOOR EVEN WHEN YOU ARE ALREADY IN IT: the early return used to make the row
 * dead in exactly that case, so a stored query opened as the one already showing did nothing.
 */
export function selectConversation(this: ConsoleConversationHost, id: string): void {
  const picked =
    (this.conversations ?? []).find((c) => String(c.id) === id) ??
    (this._conversationRows ?? []).find((r) => String(r.id) === id);
  const tab = String((picked as { tab?: string } | undefined)?.tab || 'chat');
  if (id === this.conversationId) {
    if (tab === 'sessions') {
      if (this.activeTab !== 'sessions') this.activeTab = 'sessions';
      void this._replayLaneQuery(id);
    }
    return;
  }
  this._moveSeatTo(id, { tab });
  /* THE PACKAGE FOLLOWS THE SEAT, THE SAME AS THE CONSOLE'S. A conversation picked from the list
     used to change only what the seat was drawing, so a save wrote the old id. */
  if (this.sessionId) {
    pointPackageAt({ sessionId: this.sessionId, userId: this._userId() }, id).catch((err) => {
      this._listNote = `This package could not be pointed at that chat: ${String((err as Error)?.message ?? err)}`;
      this.requestUpdate();
    });
  }
}

/**
 * REMOVE ONE CONVERSATION, AND IF IT WAS THE ONE ON SCREEN, LEAVE NOTHING BEHIND.
 *
 * The removal is one call; the rest is what the seat owes the person afterwards. Reading a
 * conversation that is gone would draw a read error where their words were, so the seat moves off
 * it — to the newest live conversation the package still owns, or to none. With none, the package
 * is told so (an empty id, writable into a nullable column) and the removal is treated as an
 * arrival, so a package with nothing left is given its next conversation and she speaks in it.
 */
export async function removeConversation(
  this: ConsoleConversationHost,
  id: string,
  userId: string,
): Promise<void> {
  const wasTheOneOnScreen = String(id) === String(this.conversationId ?? '');
  try {
    try {
      await remove({ sessionId: this.sessionId ?? '', userId }, id);
    } catch (err) {
      this._listNote = `That conversation could not be removed — ${String((err as Error)?.message ?? err)}.`;
      this.requestUpdate();
      return;
    }
    this._listNote = '';
    await readPackageConversations.call(this, userId);
    if (!wasTheOneOnScreen) {
      // THE ROW'S DISAPPEARANCE IS THE CONFIRMATION (owner, 2026-11-03). No "Removed." note: the
      // list redraws without the row, and a note under it is noise, not feedback.
      this.requestUpdate();
      return;
    }
    const live = (this._conversationRows ?? [])
      .filter((r) => !r.archived && String(r.id) !== String(id));
    /* The next row is the next conversation, the last modified; no row is skipped. */
    const next = live.length ? String(live[0].id) : '';
    if (next) {
      this._moveSeatTo(next);
      if (this.sessionId) {
        pointPackageAt({ sessionId: this.sessionId, userId }, next).catch((err) => {
          this._listNote = `Removed, but this package still named the old chat: ${String((err as Error)?.message ?? err)}`;
          this.requestUpdate();
        });
      }
    } else {
      this._moveSeatTo('');
      if (this.sessionId) {
        this._conversationWrite(
          `/api/prompt-sessions/${this.sessionId}`,
          'PUT',
          { conversation_id: null },
          userId,
        ).catch((err) => {
          this._listNote = `Removed, but this package still named the old chat: ${String((err as Error)?.message ?? err)}`;
          this.requestUpdate();
        });
      }
      this._takeArrival('resume');
    }
    this.requestUpdate();
  } catch (err) {
    this._listNote = `That conversation could not be removed: ${String((err as Error)?.message ?? err)}`;
    this.requestUpdate();
  }
}

/**
 * START A CONVERSATION ON THIS PACKAGE AND MOVE THE SEAT INTO IT.
 *
 * A package's new chat leaves the one before it in the list; the console's own flow archives its
 * predecessor instead, and that stays in the console's branch, because the owner drew that line
 * himself ("this is the only place that this global chat is associated … don't just apply it to
 * both areas").
 *
 * THE LIST IS READ BEFORE THIS RETURNS, and that order is load-bearing: the seat's send refuses a
 * turn whose conversation the package's list contradicts, so a greeting fired before the read
 * landed was refused and the new thread stayed empty. Both seats get that order from here now.
 */
export async function createPackageConversation(
  this: ConsoleConversationHost,
  userId: string,
  title: string,
): Promise<string> {
  const next = await create({ sessionId: this.sessionId ?? '', userId }, title);
  await pointPackageAt({ sessionId: this.sessionId ?? '', userId }, next);
  this._moveSeatTo(next);
  await readPackageConversations.call(this, userId);
  this.requestUpdate();
  return next;
}
