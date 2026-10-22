/**
 * uxCapture — the browser's half of the element capture door.
 *
 * WHAT IT DOES. Mints and persists an anonymous session id, queues interaction events, and
 * posts them in batches to `POST /api/elements/events` — same origin, no token, no vendor.
 * The door (backend/routes/element_events.py) owns every rule; this file only carries facts to
 * it. A refused batch is reported on the console WITH the refusals and is NOT retried: a
 * refusal means the emitter sent something the vocabulary does not name — a bug in our code,
 * not a fact about a person — and a silent retry would repeat the bug out of sight.
 *
 * WHAT MAY BE PASSED AS A DIMENSION. A name, a label, an enum or a number. NEVER message text,
 * NEVER prompt text, NEVER a person's words. `message_sent` has no text dimension at all, and
 * this module never reads the payload's text.
 *
 * THE SESSION ID IS THE ONLY IDENTITY. It is minted here (never server-side: two people would
 * collide into one identity) and kept in localStorage so a return visit is the same anonymous
 * session. Where storage is blocked, one id is kept in memory for THIS document — stated here
 * because those events are not joinable past the page's lifetime.
 *
 * NO UNBOUNDED QUEUE. Interaction data that cannot be delivered is reported and dropped; a
 * browser queue that grows forever is its own failure mode. A 422 is logged with the door's
 * reasons; a network error is logged with the error.
 */

import { API_BASE } from './apiHelper';

export type UxMetric = 'action' | 'message_sent' | 'command_received';

export type SurfaceMetric = 'surface_opened';

export type UxDimensionValue = string | number | boolean;

export interface UxCaptureContext {
  /** The component's instance id inside its assembly (the renderer's `comp.id`). */
  instanceId?: string;
  /** The assembly's own surface id, when the payload carries one. */
  surface?: string;
  /** When an assembled surface has a conversation, and the caller honestly holds it. */
  conversationId?: string;
  /**
   * THE BUSINESS PROCESS the emitting surface belongs to — the composer package's session id.
   * It is part of the counter's bucket, so an element's performance is attributable to the
   * flow it served. Omit when the emitter is not bound to a package.
   */
  flow?: string;
}

interface QueuedEvent {
  session_id: string;
  metric: UxMetric | SurfaceMetric;
  /** Element events only — the catalogue tag. Surface events carry `surface` instead. */
  component?: string;
  dimensions?: Record<string, UxDimensionValue>;
  at: string;
  instance_id?: string;
  surface?: string;
  conversation_id?: string;
  flow?: string;
}

const SESSION_STORAGE_KEY = 'raibach:ux-session';
const FLUSH_DELAY_MS = 250;
const MAX_BATCH = 100;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

let memorySessionId: string | null = null;

function sessionId(): string {
  try {
    let id = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked: one id for this document. Never an empty id — the door refuses those.
    if (!memorySessionId) memorySessionId = crypto.randomUUID();
    return memorySessionId;
  }
}

let queue: QueuedEvent[] = [];
let flushTimer: number | null = null;

async function flush(): Promise<void> {
  if (!queue.length) return;

  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(batch.length);
  if (queue.length) scheduleFlush();

  try {
    const response = await fetch(`${API_BASE}/elements/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      // keepalive lets a flush started on pagehide finish after the document goes away.
      keepalive: true,
    });

    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // The status is the fact; the body was not JSON. Report what is known.
      }
      console.error(
        `[uxCapture] the capture door refused ${batch.length} event(s) — HTTP ${response.status}`,
        body,
      );
    }
  } catch (error) {
    console.error(
      `[uxCapture] the capture door could not be reached — ${batch.length} event(s) were not delivered`,
      error,
    );
  }
}

function scheduleFlush(): void {
  if (!isBrowser || flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DELAY_MS);
}

/** Record one interaction. The metric must exist in the door's vocabulary (v1). */
export function uxCapture(
  metric: UxMetric,
  component: string,
  dimensions: Record<string, UxDimensionValue> = {},
  context: UxCaptureContext = {},
): void {
  if (!isBrowser) return;
  if (!component) {
    // A component tag is the one thing the door cannot resolve for us — say so loudly.
    console.error(`[uxCapture] "${metric}" has no component tag — the event was not sent`);
    return;
  }

  const event: QueuedEvent = {
    session_id: sessionId(),
    metric,
    component,
    at: new Date().toISOString(),
    ...(Object.keys(dimensions).length ? { dimensions } : {}),
    ...(context.instanceId ? { instance_id: context.instanceId } : {}),
    ...(context.surface ? { surface: context.surface } : {}),
    ...(context.conversationId ? { conversation_id: context.conversationId } : {}),
    ...(context.flow ? { flow: context.flow } : {}),
  };

  queue.push(event);
  scheduleFlush();
}

/**
 * Record that a SURFACE opened — a screen, not an element. Same queue, same door, its own table
 * (`design_surface_events`). The surface id is the fact; no content rides with it.
 */
export function uxCaptureSurfaceOpen(surface: string): void {
  if (!isBrowser) return;
  if (!surface) {
    console.error('[uxCapture] surface_opened has no surface id — the event was not sent');
    return;
  }
  const event: QueuedEvent = {
    session_id: sessionId(),
    metric: 'surface_opened',
    surface,
    at: new Date().toISOString(),
  };
  queue.push(event);
  scheduleFlush();
}

if (isBrowser) {
  // A page being left still flushes what it has. `keepalive` above makes the request survive.
  window.addEventListener('pagehide', () => {
    void flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
