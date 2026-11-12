/**
 * chatTurn — THE TRANSPORT OF ONE CHAT TURN, SHARED BY EVERY TAB.
 *
 * WHAT IS HERE: the request to the model door, the parse of its answer, and the
 * classification of a failure. WHAT IS NOT: a tab's instructions, its screen
 * context, its conversation list, its store, or any drawing. Those belong to the
 * tab's own slice (`rooms/design/<tab>/`), which imports this module and nothing
 * of another tab's seat.
 *
 * A FAILURE IS DATA, NEVER A THROW AND NEVER A MADE-UP ANSWER. The caller draws
 * `failure.reason`, which is the server's own words when it had any. Nothing here
 * substitutes a sentence for a missing answer.
 */
import { getStoredUserId } from '@/services/authService';

export const TEACHER_TURN_URL = '/api/teacher/query';

export type ChatTurnFailureKind =
  /** The request never reached the door. */
  | 'network'
  /** The door answered, with a status that is not 2xx. */
  | 'http'
  /** The door answered 2xx with a body that is not JSON. */
  | 'unreadable'
  /** The door answered 2xx with JSON that carries no content. */
  | 'empty';

export interface ChatTurnFailure {
  kind: ChatTurnFailureKind;
  /** The HTTP status when a response arrived; `null` when the transport failed. */
  status: number | null;
  /** The most specific reason available: the server's own words, or the transport's. */
  reason: string;
}

export interface ChatTurnRequest {
  question: string;
  context?: string;
  conversationId?: string;
  /** The Design tab this turn belongs to (`ux`, `chat`, `tools`). */
  designTab?: string;
  /** The prompt package, for the legacy package path. */
  sessionId?: string;
  /** Defaults to `chat`; a run is not a chat turn and should not call this. */
  mode?: string;
  includeMemory?: boolean;
  personTurn?: boolean;
}

export interface ChatTurnSuccess {
  ok: true;
  content: string;
  /** Empty when the door named no conversation. The caller decides what to do with that. */
  conversationId: string;
  /** The door saved the answer but could not write it; empty when it was saved. */
  persistenceError: string;
  /** The door's own warnings, in its words. */
  warnings: string[];
}

export interface ChatTurnError {
  ok: false;
  failure: ChatTurnFailure;
}

export type ChatTurnResult = ChatTurnSuccess | ChatTurnError;

/**
 * THE EXPLICIT NARROW. This project compiles with `strict: false`, where TS 5.9 does
 * not narrow a literal discriminant, so every caller uses this guard rather than an
 * `if (result.ok)` it cannot rely on.
 */
export function isChatTurnError(result: ChatTurnResult): result is ChatTurnError {
  return !result.ok;
}

interface TeacherTurnPayload {
  content?: string;
  error?: string;
  detail?: string;
  conversation_id?: string;
  persistence_error?: string;
  warnings?: string[];
}

function failed(
  kind: ChatTurnFailureKind,
  status: number | null,
  reason: string,
): ChatTurnError {
  return { ok: false, failure: { kind, status, reason } };
}

export async function sendChatTurn(request: ChatTurnRequest): Promise<ChatTurnResult> {
  const body: Record<string, unknown> = {
    question: request.question,
    context: request.context,
    mode: request.mode ?? 'chat',
    reasoning: false,
    reasoning_style: 'chain_of_thought',
    include_memory: request.includeMemory ?? true,
    person_turn: request.personTurn ?? true,
  };
  if (request.designTab) body.design_tab = request.designTab;
  if (request.sessionId) body.session_id = request.sessionId;
  if (request.conversationId) body.conversation_id = request.conversationId;

  let response: Response;
  try {
    response = await fetch(TEACHER_TURN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return failed('network', null, (e as Error).message || 'the turn door could not be reached');
  }

  let payload: TeacherTurnPayload | null = null;
  try {
    payload = (await response.json()) as TeacherTurnPayload;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const reason =
      payload?.detail ||
      payload?.error ||
      `the turn door answered ${response.status} with no readable reason`;
    return failed(payload ? 'http' : 'unreadable', response.status, reason);
  }

  if (!payload) {
    return failed('unreadable', response.status, `the turn door answered ${response.status} with a body that is not JSON`);
  }

  if (typeof payload.content !== 'string' || !payload.content.trim()) {
    const reason =
      payload.detail || payload.error || `the turn door answered ${response.status} with no content`;
    return failed('empty', response.status, reason);
  }

  return {
    ok: true,
    content: payload.content,
    conversationId: payload.conversation_id ? String(payload.conversation_id) : '',
    persistenceError: payload.persistence_error ? String(payload.persistence_error) : '',
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((warning) => String(warning)) : [],
  };
}
