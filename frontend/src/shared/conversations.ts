/**
 * THE CONVERSATIONS OF ONE PACKAGE — the six rules, in one place.
 *
 * WHY THIS FILE EXISTS. Every chat seat in this application carried its own copy of the same
 * idea: read this package's conversations, open the newest, create one, delete one, move the
 * seat. Four copies — `chat-panel`, `console-chat-panel`, `design-chat`, `tools-chat` — in files
 * of three to five and a half thousand lines each. They drifted, and the drift is what a person
 * sees: a seat whose conversation and whose list came from two different packages, a "+" that
 * changed nothing, a trash that removed the wrong row's chance to be armed.
 *
 * THE RULES, and nothing else:
 *   1. A package owns its conversations. The list is read by `conversations.session_id`.
 *   2. The list is newest first — the server answers `ORDER BY updated_at DESC`.
 *   3. Opening a package opens the NEWEST conversation it has.
 *   4. A package always has at least one conversation. One is created when there is none.
 *   5. A new conversation is created on that package, and the package's own pointer follows it.
 *   6. Deleting the open conversation moves the seat to the newest that remains; if none remains,
 *      a new one is created, so the seat is never left on nothing.
 *
 * WHAT IS NOT HERE: any drawing, any Lit property, any `this`. A seat keeps its own state and
 * calls these functions; it does not own the HTTP shape or the order. That is the line this file
 * draws, and it is the line that was missing.
 */

/** One conversation as the server lists it. */
export type ConversationRow = {
  id: string;
  title: string;
  tab: string;
  archived: boolean;
  /** When the server last wrote to it — the list's own order, carried so a row can show it. */
  savedAt: string;
  /**
   * How many turns the server says it holds. The row is the durable fact; the seat's in-memory
   * thread can be empty for a frame while the history is still on its way, and a greeting keyed on
   * that emptiness introduces her twice in one conversation (measured 2026-11-03).
   */
  messageCount: number;
};

export type ConversationsOptions = {
  /** The package the conversation belongs to (`prompt_sessions.id`). */
  sessionId: string;
  /** Whose row it is; every call carries it, because every endpoint is scoped to a person. */
  userId: string;
};

/** The id of the row a seat should be in: the newest one that is not archived. */
export function newest(rows: ConversationRow[]): ConversationRow | null {
  return rows.find((row) => !row.archived) ?? null;
}

/** The rows that are still live, newest first — what is left after a removal. */
export function live(rows: ConversationRow[]): ConversationRow[] {
  return rows.filter((row) => !row.archived);
}

/**
 * The package's conversations, newest first.
 *
 * `include_archived` is on: an archived thread is still a row the person may want to see, and a
 * seat that asked for live rows only would answer "none" over a package that has history. The
 * caller decides what to draw; this decides nothing.
 */
export async function listForPackage(
  options: ConversationsOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<ConversationRow[]> {
  const { sessionId, userId } = options;
  if (!sessionId) return [];
  const res = await fetchImpl(
    `/api/conversations?session_id=${encodeURIComponent(sessionId)}&include_archived=true`,
    { headers: { 'X-User-ID': userId } },
  );
  if (!res.ok) throw new Error(`the conversations could not be read (HTTP ${res.status})`);
  const body = (await res.json()) as { conversations?: unknown };
  if (!Array.isArray(body?.conversations)) throw new Error('the conversations did not come back as a list');
  return (body.conversations as Array<Record<string, unknown>>)
    .map((c) => ({
      id: String(c?.id ?? ''),
      title: String(c?.title || '(untitled)'),
      tab: String(c?.tab || 'chat'),
      archived: c?.is_archived === true,
      savedAt: String(c?.updated_at ?? ''),
      messageCount: Number(c?.message_count ?? 0),
    }))
    .filter((row) => row.id);
}

/**
 * ALL OF DESIGN'S CONVERSATIONS — the Design Chat's read, and no seat reads the whole system.
 *
 * The owner, 2026-11-03: the Chat seat for Design is *"the all of the design chats … already
 * pre-filtered to design chat"*; the console is only the global console's chats, and each tab its
 * own. The server filters by the owning package's type: `design_tab` and `design_session`. The
 * design catalogues (the system cards) and the other rooms are not this list.
 */
export async function listForDesign(
  options: ConversationsOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<ConversationRow[]> {
  const { userId } = options;
  const res = await fetchImpl(
    '/api/conversations?include_archived=true&design_only=true',
    { headers: { 'X-User-ID': userId } },
  );
  if (!res.ok) throw new Error(`the conversations could not be read (HTTP ${res.status})`);
  const body = (await res.json()) as { conversations?: unknown };
  if (!Array.isArray(body?.conversations)) throw new Error('the conversations did not come back as a list');
  return (body.conversations as Array<Record<string, unknown>>)
    .map((c) => ({
      id: String(c?.id ?? ''),
      title: String(c?.title || '(untitled)'),
      tab: String(c?.tab || 'chat'),
      archived: c?.is_archived === true,
      savedAt: String(c?.updated_at ?? ''),
      messageCount: Number(c?.message_count ?? 0),
    }))
    .filter((row) => row.id);
}

/** A new conversation on this package. Returns its id. */
export async function create(
  options: ConversationsOptions,
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const { sessionId, userId } = options;
  const res = await fetchImpl('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
    body: JSON.stringify({ session_id: sessionId || undefined, title }),
  });
  if (!res.ok) throw new Error(`a new conversation could not be started (HTTP ${res.status})`);
  const body = (await res.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) throw new Error('the new conversation came back without an id');
  return id;
}

/**
 * Point the PACKAGE at a conversation.
 *
 * The package's own column is what a reload reads, so a seat that moves without this line comes
 * back to the thread it left — which is the defect people report as "it did not save where I was".
 */
export async function pointPackageAt(
  options: ConversationsOptions,
  conversationId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const { sessionId, userId } = options;
  if (!sessionId) return;
  const res = await fetchImpl(`/api/prompt-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  if (!res.ok) throw new Error(`the package could not be pointed at that conversation (HTTP ${res.status})`);
}

/** Remove one conversation. */
export async function remove(
  options: ConversationsOptions,
  conversationId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const { userId } = options;
  const res = await fetchImpl(`/api/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
    headers: { 'X-User-ID': userId },
  });
  if (!res.ok) throw new Error(`that conversation could not be removed (HTTP ${res.status})`);
}

/** A conversation's title, written when a new one is started from a real first turn. */
export async function retitle(
  options: ConversationsOptions,
  conversationId: string,
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const { userId } = options;
  const res = await fetchImpl(`/api/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`the title could not be written (HTTP ${res.status})`);
}

/**
 * THE THREE THINGS A SEAT NEEDS ON OPEN, IN ONE CALL: the list, the conversation to open, and —
 * when the package had none — the one it made.
 *
 * Rule 4 is the reason this is one function: "a package always has at least one conversation" is
 * not a rule any caller may skip, and a caller that reads the list and then decides for itself
 * will one day decide "zero" and leave a seat with nowhere to write.
 */
export async function openForPackage(
  options: ConversationsOptions,
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rows: ConversationRow[]; conversationId: string; created: boolean }> {
  const rows = await listForPackage(options, fetchImpl);
  const top = newest(rows);
  if (top) return { rows, conversationId: top.id, created: false };
  const id = await create(options, title, fetchImpl);
  await pointPackageAt(options, id, fetchImpl);
  const after = await listForPackage(options, fetchImpl);
  return { rows: after, conversationId: id, created: true };
}

/**
 * Rule 6: remove one conversation and say where the seat goes.
 *
 * The seat itself is not moved here — it has the state — but the DECISION is here: the newest
 * row that is left, or a brand-new conversation when nothing is left. A caller that decided this
 * for itself is how a seat ended up on a deleted id.
 */
export async function removeAndChooseNext(
  options: ConversationsOptions,
  conversationId: string,
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ rows: ConversationRow[]; next: string; created: boolean }> {
  await remove(options, conversationId, fetchImpl);
  const rows = await listForPackage(options, fetchImpl);
  const top = newest(rows);
  if (top) return { rows, next: top.id, created: false };
  const id = await create(options, title, fetchImpl);
  await pointPackageAt(options, id, fetchImpl);
  const after = await listForPackage(options, fetchImpl);
  return { rows: after, next: id, created: true };
}
