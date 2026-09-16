/**
 * chatSeat — Grace's seat: ONE conversation, held above the layout swap.
 *
 * WHY THIS IS NOT COMPONENT STATE
 * ───────────────────────────────
 * It was `useState` inside InteractiveChatInterface, and that component is mounted in two
 * places: the console's resizable right pane, and the composer's `workspace-layout` right
 * slot. Those two are mutually exclusive by tab, so this build has always had *one seat on
 * screen* and *two seats in the tree*. The cost of that only shows when something speaks.
 *
 * Measured 2026-09-15: a repair is launched from the console's catalog list, the surface
 * assembly fails, and the fallback posts the ask into the console's instance. The next
 * assembly then succeeds and sets `headerTab` to 'composer' — which UNMOUNTS the console
 * instance and DISCARDS its state. The message had been posted (the log said so, and the
 * fallback line is in it), and there was nowhere left holding it: searched the DOM for its
 * text, absent. That is the whole of "she is silent when I load a repair".
 *
 * So the conversation lives here, above the swap. A tab switch cannot destroy it, and a
 * message posted while one view is mounted is still there in the other.
 *
 * ONE LISTENER, ALSO HERE
 * ──────────────────────
 * The listener for `a2ui:system-message` used to be installed by the component — one per
 * instance. With a single seat on screen that was harmless by accident. With the seat made
 * persistent it would append every synthetic message once per mounted instance, so it is
 * installed here, once, and a message posted is a message heard exactly once.
 *
 * It is installed at MODULE LOAD, not in an effect, for the same reason the state is here:
 * the seat has to be able to HEAR a message when no seat is mounted, or a repair launched
 * from the console is spoken to an empty room.
 *
 * The shape is deliberately the shape `useState` had — a value or an updater, so both
 * `set([])` and `set(prev => ...)` are accepted — which is why the twenty call sites in
 * the component did not have to change to become correct.
 */
import { useSyncExternalStore } from 'react';

export interface ChatSeatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type Updater<T> = T[] | ((prev: T[]) => T[]);

let messages: ChatSeatMessage[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function snapshot(): ChatSeatMessage[] {
  return messages;
}

/** `useState`'s own contract: a value, or a function of the previous value. */
export function setChatSeatMessages<T extends ChatSeatMessage = ChatSeatMessage>(
  next: Updater<T>,
): void {
  const resolved = typeof next === 'function'
    ? (next as (prev: T[]) => T[])(messages as T[])
    : next;
  // A no-op write is still a write the seat should not hear about; but an unchanged
  // reference is what React compares, so returning early here would be the bug, not the
  // optimisation. Everything that appends produces a new array.
  messages = resolved as ChatSeatMessage[];
  emit();
}

/**
 * THE CONVERSATION THIS SEAT BELONGS TO — and the write.
 *
 * `conversations.session_id` is NOT NULL in the schema: a conversation belongs to a prompt
 * PACKAGE, and `conversation_messages` cascades from it. So the package is the thing the
 * history hangs off, and everything said in this seat about that package belongs in it.
 *
 * It did not work that way. `conversationStorage.addMessage` was called from exactly two
 * places — the person's typed turn, and her LLM reply — so every message that arrives any
 * OTHER way was never written down: each surface greeting she writes, and the repair
 * guidance, which are the messages that make her her. A reload brought back the typed
 * exchange and silently lost everything she had said about the work.
 *
 * The seat is the one funnel every message passes through, so it is the one place that can
 * write them all down. The sink is set by the mounted seat (it holds the conversation id and
 * the storage call); the two paths that already persist themselves keep doing so and are not
 * routed through here, so nothing is written twice.
 */
let conversationId: string | null = null;
let persist: ((conversationId: string, content: string) => void) | null = null;

/** Point the seat at the package's conversation. Null before one exists. */
export function setChatSeatConversation(id: string | null): void {
  conversationId = id || null;
}

/** How a seat message reaches the database. Set once by the mounted seat. */
export function setChatSeatPersister(
  fn: ((conversationId: string, content: string) => void) | null,
): void {
  persist = fn;
}

/** Append one turn to the seat — what every synthetic speaker uses, and it is written down. */
export function appendChatSeatMessage(m: ChatSeatMessage): void {
  setChatSeatMessages((prev) => [...prev, m]);
  // Written as it arrives, not on some later save: a message that is only in React state is
  // gone the moment the seat unmounts, which is the defect this whole module exists for.
  if (m.role === 'assistant' && conversationId && persist) {
    persist(conversationId, m.content);
  }
}

/** Empty the seat. A new conversation does this; so does a test. */
export function clearChatSeat(): void {
  messages = [];
  emit();
}

/** The seat as it is right now — for a caller outside React (a log, a script, a test). */
export function readChatSeat(): ChatSeatMessage[] {
  return messages;
}

/**
 * The seat, as a component sees it. Generic so a caller keeps its own message type and no
 * call site had to be retyped: `useChatSeat<ChatMessage>()`.
 */
export function useChatSeat<T extends ChatSeatMessage = ChatSeatMessage>():
  [T[], (next: Updater<T>) => void] {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  return [current as T[], setChatSeatMessages];
}

// ── Installed once, at module load. See the note at the top. ──────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('a2ui:system-message', (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    // An empty content is not a turn. Dropped rather than appended, because a blank bubble
    // in the conversation reads as the assistant having said nothing on purpose.
    if (!detail.content) return;
    appendChatSeatMessage({ role: detail.role || 'assistant', content: detail.content });
  });
}
