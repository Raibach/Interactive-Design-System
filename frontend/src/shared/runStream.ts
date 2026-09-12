/**
 * Consuming a streamed Run.
 *
 * POST /api/teacher/query/stream answers with Server-Sent Events: the tool fetch,
 * the model's own reasoning, then the answer as it is written. A Run takes ~28s,
 * and the output column used to show nothing at all for the whole of it — which is
 * indistinguishable from a hung app.
 *
 * `EventSource` cannot be used here: it only does GET, and this is a POST with a
 * body (the prompt config and the tool calls). So the frames are read off the
 * response body by hand. That is also why the parsing is a separate, pure function
 * with its own test — the last time this code assumed a stream shape it did not
 * get, the output column stayed empty and reported "(No output returned.)".
 */

export type RunStreamEvent =
  | { type: 'status'; stage?: string; message?: string }
  | { type: 'reasoning'; delta?: string }
  | { type: 'content'; delta?: string }
  | { type: 'done'; content?: string; usage?: Record<string, unknown>; tool_warnings?: string[]; conversation_id?: string | null }
  | { type: 'error'; message?: string };

/**
 * Split a buffer into whole frames plus whatever is left over.
 *
 * Frames are separated by a blank line, and a chunk from the network can end
 * anywhere — mid-frame, mid-JSON, even mid-character. The remainder must be kept
 * and prepended to the next chunk, or every frame that straddles a chunk boundary
 * is silently lost.
 */
export function parseSseBuffer(buffer: string): { events: RunStreamEvent[]; rest: string } {
  const events: RunStreamEvent[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    // A frame may carry several `data:` lines; per the SSE spec they join with \n.
    const data = part
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as RunStreamEvent);
    } catch {
      // A frame that cannot be parsed is dropped, not guessed at — but it is said
      // out loud, because a silent drop here is a missing line in the panel.
      console.warn('[run stream] unparseable frame', data.slice(0, 120));
    }
  }
  return { events, rest };
}

export type RunStreamHandlers = {
  onStatus?: (message: string, stage: string) => void;
  onReasoning?: (delta: string) => void;
  onContent?: (delta: string) => void;
  onDone?: (event: Extract<RunStreamEvent, { type: 'done' }>) => void;
  onError?: (message: string) => void;
};

export type RunStreamOutcome = 'done' | 'error' | 'incomplete';

/**
 * Read a streamed Run to completion.
 *
 * The three outcomes are three different things and the caller must treat them so:
 *
 *   'done'        a `done` frame arrived — the run finished.
 *   'error'       the endpoint spoke and named a failure (the model or the provider
 *                 failed). The stream DID work; re-running would be a second spend
 *                 for the same failure, so the caller reports it and stops.
 *   'incomplete'  nothing arrived that the endpoint meant: no body, no frames, or
 *                 the connection dropped mid-flight. Only this one is worth falling
 *                 back to the blocking route for.
 *
 * A boolean here would have collapsed 'error' and 'incomplete' — which is exactly
 * the distinction that decides whether a click costs one call or two.
 */
export async function consumeRunStream(
  resp: Response,
  handlers: RunStreamHandlers,
  signal?: AbortSignal,
): Promise<RunStreamOutcome> {
  const reader = resp.body?.getReader();
  if (!reader) return 'incomplete';

  const decoder = new TextDecoder();
  let buffer = '';
  let outcome: RunStreamOutcome = 'incomplete';
  let sawAnyFrame = false;

  while (outcome === 'incomplete') {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch { /* already closed */ }
      return 'incomplete';
    }
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const { events, rest } = parseSseBuffer(buffer);
    buffer = rest;

    for (const event of events) {
      sawAnyFrame = true;
      switch (event.type) {
        case 'status':
          handlers.onStatus?.(event.message || '', event.stage || '');
          break;
        case 'reasoning':
          if (event.delta) handlers.onReasoning?.(event.delta);
          break;
        case 'content':
          if (event.delta) handlers.onContent?.(event.delta);
          break;
        case 'done':
          handlers.onDone?.(event);
          outcome = 'done';
          break;
        case 'error':
          handlers.onError?.(event.message || 'The run failed.');
          outcome = 'error';
          break;
        default:
          break;
      }
    }
  }

  // Frames arrived but none of them was an ending: the stream was cut off. Nothing
  // was claimed, and the caller should fall back.
  if (!sawAnyFrame) return 'incomplete';
  return outcome;
}
