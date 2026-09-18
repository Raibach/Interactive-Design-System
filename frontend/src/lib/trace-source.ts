/**
 * The Trace view's SOURCE — everything this page can observe about itself, in one
 * stream, and the values that get written to the surface's `/trace` path.
 *
 * WHY THIS IS A MODULE AND NOT THE ELEMENT. `<trace-feed>` used to reach for its
 * own data: it subscribed to the app logger and polled Sentry's global scope from
 * inside `connectedCallback`. That made the component a source rather than a view
 * — it could show what it could find, never what it was given, and every seat that
 * wanted a trace paid for its own poller. The A2UI contract is the other way round
 * (Data-Binding.md): a component displays a value from the data model by `{path}`,
 * and something else writes that path. This module is that something else, and
 * telemetry is app-global — one observer is the right number.
 *
 * WHAT IT OBSERVES, and why each one earns its place:
 *
 *   log         the app's own logger, by subscription. Carries the structured
 *               `data` the logger already accepts and this module used to DROP.
 *   network     every fetch: method, path, status, duration. This is what turns
 *               "POST /api/ai/assemble-surface" into "... → 200 · 7.9s", and it is
 *               the only millisecond-accurate account of the console's own calls
 *               that exists without a Sentry token.
 *   error       window error + unhandled rejection. The two failures that
 *               otherwise leave no trace anywhere.
 *   event       the surface's forwarded actions (`a2ui-event`) and its
 *               system/usage/user messages — what the UI was asked to do.
 *   audit       a summary of the catalog audit, read from the response the app
 *               already fetches. No second request.
 *   perf        long tasks (>50ms) — main-thread stalls, which is what "the
 *               console feels slow" usually means in practice.
 *   breadcrumb  Sentry's global scope, polled. In a DEV build this is empty by
 *               construction (`lib/sentry.ts` returns early unless MODE is
 *               production), so it is one of several sources and not the base.
 *
 * It starts at MODULE LOAD, not at first subscribe. The first assembly fires
 * before the shell's effects run, and telemetry that misses the very request it
 * exists to explain is not worth having. Nothing here touches the DOM.
 *
 * NOT REACT AND NOT LIT. It holds no framework state, so the writer (the shell)
 * and any second reader share exactly one list.
 */

import { logger } from '@/lib/logger';

/** What produced a line. The feed colours and labels by this. */
export type TraceKind =
  | 'log'
  | 'network'
  | 'error'
  | 'event'
  | 'audit'
  | 'perf'
  | 'breadcrumb';

/** One line in the feed. */
export interface TraceEntry {
  id: string;
  timestamp: number;
  kind: TraceKind;
  level: string;
  message: string;
  /** A second line: an error stack, a response summary, a payload. */
  detail?: string;
  /** Milliseconds, for the kinds that take time. */
  durationMs?: number;
  /** HTTP status, for network lines. */
  status?: number;
}

/** What the surface's `/trace` path holds. Written as one object. */
export interface TraceSnapshot {
  entries: TraceEntry[];
  breadcrumbCount: number;
}

/** Sentry's breadcrumb shape, as far as this module reads it. */
interface Breadcrumb {
  category?: string;
  message?: string;
  level?: string;
  timestamp?: number;
}

const MAX_ENTRIES = 100;
const POLL_INTERVAL = 2000;

/**
 * Log lines arrive in bursts (an assembly logs half a dozen at once) and every
 * notification costs the shell a data-model write and a surface render. Coalescing
 * the burst into one write keeps a noisy seam from becoming a render loop.
 */
const COALESCE_MS = 250;

/** A main-thread task longer than this is a stall worth naming. */
const LONG_TASK_MS = 50;

let entries: TraceEntry[] = [];
let breadcrumbCount = 0;
let seq = 0;
let started = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * The object handed to readers, rebuilt only when the values actually change.
 * Identity matters: the writer compares the snapshot it already wrote against the
 * new one, and a fresh object every poll would write the same data forever.
 */
let current: TraceSnapshot = { entries: [], breadcrumbCount: 0 };

const listeners = new Set<(snapshot: TraceSnapshot) => void>();

/** The values as they stand. Same object until something actually changed. */
export function traceSnapshot(): TraceSnapshot {
  return current;
}

function publish(): void {
  current = { entries, breadcrumbCount };
  for (const listener of listeners) {
    try {
      listener(current);
    } catch {
      // A reader that throws is that reader's problem — never the source's.
    }
  }
}

/** One write per burst, not one per line. */
function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    publish();
  }, COALESCE_MS);
}

function add(entry: Omit<TraceEntry, 'id'>): void {
  seq += 1;
  entries = [{ id: entry.kind + '-' + seq, ...entry }, ...entries].slice(0, MAX_ENTRIES);
  scheduleFlush();
}

/** One line of structured data, flattened. Empty when there is nothing to add. */
function describeData(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    let shown: string;
    if (typeof value === 'object') {
      try {
        shown = JSON.stringify(value);
      } catch {
        shown = '[unserialisable]';
      }
    } else {
      shown = String(value);
    }
    parts.push(key + '=' + (shown.length > 120 ? shown.slice(0, 120) + '…' : shown));
  }
  return parts.length ? parts.join('  ') : undefined;
}

/** Origin-stripped for same-origin calls, host + path for anything else. */
function shortUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) return parsed.pathname + parsed.search;
    return parsed.host + parsed.pathname;
  } catch {
    return url;
  }
}

// ── 1. the app's own logger ───────────────────────────────────────────────────

function readLogger(): void {
  logger.subscribe((entry) => {
    add({
      kind: 'log',
      level: String(entry?.level ?? 'info'),
      message: String(entry?.message ?? ''),
      detail: describeData((entry as { data?: unknown })?.data),
      timestamp: Number(entry?.timestamp ?? Date.now()),
    });
  });
}

// ── 2. every fetch: method, path, status, duration ────────────────────────────

interface FetchMarked {
  __traceObserved?: boolean;
}

/**
 * Wraps `window.fetch` once. Guarded by a marker on the window, not by a module
 * flag, so a second copy of this module — a duplicated chunk, a test importing it
 * twice — cannot wrap the wrapper and record every request twice.
 *
 * The response is returned untouched; the only read is a `clone()` of the audit
 * response, which costs the caller nothing.
 */
function observeFetch(): void {
  const w = window as Window & FetchMarked;
  if (w.__traceObserved) return;
  const original = w.fetch;
  if (typeof original !== 'function') return;
  w.__traceObserved = true;

  w.fetch = function tracedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const method = String(
      init?.method ?? (typeof input === 'object' && input && 'method' in input ? input.method : 'GET'),
    ).toUpperCase();
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const started = Date.now();
    const shown = shortUrl(url);

    return original.call(w, input as RequestInfo, init).then(
      (response) => {
        const ms = Date.now() - started;
        add({
          kind: 'network',
          level: response.ok ? 'info' : response.status >= 500 ? 'error' : 'warning',
          message: method + ' ' + shown,
          status: response.status,
          durationMs: ms,
          timestamp: Date.now(),
        });
        void summarizeAudit(url, response);
        return response;
      },
      (error: unknown) => {
        // A rejected fetch is the case that looks like nothing happened: no
        // status, no response, and the caller's catch is the only witness.
        add({
          kind: 'network',
          level: 'error',
          message: method + ' ' + shown + ' — request failed',
          durationMs: Date.now() - started,
          detail: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
        throw error;
      },
    );
  } as typeof window.fetch;
}

/**
 * The catalog audit, read from the response the app ALREADY requested — so the
 * feed can state the audit's shape without a second call for it.
 */
function summarizeAudit(url: string, response: Response): void {
  if (!url.includes('/api/catalog/audit')) return;
  void response
    .clone()
    .json()
    .then((body: { counts?: Record<string, unknown>; catalog?: unknown }) => {
      const c = (body?.counts ?? {}) as Record<string, number>;
      add({
        kind: 'audit',
        level: Number(c.blocking) > 0 ? 'warning' : 'info',
        message:
          'Catalog audit (' + String(body?.catalog ?? 'catalog') + '): ' +
          String(c.total ?? '?') + ' findings · ' +
          String(c.blocking ?? 0) + ' blocking · ' +
          String(c.checksRan ?? '?') + '/' + String(c.checksKnown ?? '?') + ' checks ran',
        detail:
          'pipeline=' + String(c.pipeline ?? '?') + '  designer=' + String(c.designer ?? '?') +
          '  passed=' + String(c.passed ?? '?'),
        timestamp: Date.now(),
      });
    })
    .catch(() => {
      // Not JSON, or the body was already consumed by the caller. Silent on
      // purpose: a missing audit summary must not become a trace error.
    });
}

// ── 3. the failures that otherwise leave no trace ─────────────────────────────

function observeErrors(): void {
  window.addEventListener('error', (e) => {
    const err = e as ErrorEvent;
    // Resource failures (an <img> that 404s) also fire this event and carry no
    // message. They are not exceptions; recording them as errors would drown the
    // real ones.
    if (!err.message) return;
    add({
      kind: 'error',
      level: 'error',
      message: err.message,
      detail: err.filename
        ? shortUrl(err.filename) + ':' + String(err.lineno ?? 0) + ':' + String(err.colno ?? 0)
        : undefined,
      timestamp: Date.now(),
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    add({
      kind: 'error',
      level: 'error',
      message: 'Unhandled rejection: ' +
        (reason instanceof Error ? reason.message : String(reason)),
      detail: reason instanceof Error && reason.stack
        ? reason.stack.split('\n').slice(1, 4).join('\n').trim()
        : undefined,
      timestamp: Date.now(),
    });
  });
}

// ── 4. what the surface was asked to do ───────────────────────────────────────

function observeSurfaceEvents(): void {
  // <a2ui-renderer> re-emits every component event as `a2ui-event`, tagged with
  // the id of the component that raised it. Listening here is how the feed shows
  // the surface's own actions alongside the requests they cause.
  window.addEventListener('a2ui-event', (e) => {
    const { sourceId, type, payload } = ((e as CustomEvent).detail || {}) as {
      sourceId?: string;
      type?: string;
      payload?: unknown;
    };
    add({
      kind: 'event',
      level: 'info',
      message: 'ui ' + String(type ?? 'event') + ' ← ' + String(sourceId ?? '?'),
      detail: describeData(payload),
      timestamp: Date.now(),
    });
  });

  for (const name of ['a2ui:system-message', 'a2ui:user-message', 'a2ui:usage']) {
    window.addEventListener(name, (e) => {
      add({
        kind: 'event',
        level: 'info',
        message: 'ui ' + name.replace('a2ui:', ''),
        detail: describeData((e as CustomEvent).detail),
        timestamp: Date.now(),
      });
    });
  }
}

// ── 5. main-thread stalls ─────────────────────────────────────────────────────

function observeLongTasks(): void {
  if (typeof PerformanceObserver !== 'function') return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const ms = Math.round(entry.duration);
        if (ms < LONG_TASK_MS) continue;
        add({
          kind: 'perf',
          level: ms >= 200 ? 'warning' : 'info',
          message: 'Main thread blocked for ' + String(ms) + 'ms',
          durationMs: ms,
          timestamp: Date.now(),
        });
      }
    });
    // `longtask` is not implemented everywhere — Chrome and Edge only. A browser
    // that lacks it throws here, and the feed simply has one source fewer.
    observer.observe({ type: 'longtask', buffered: false } as PerformanceObserverInit);
  } catch {
    // Unsupported entry type. Not a trace failure.
  }
}

// ── 6. Sentry's breadcrumbs ───────────────────────────────────────────────────

/** The newest breadcrumb Sentry is holding, if it is one not already shown. */
function pollSentry(): void {
  void import('@sentry/react')
    .then((Sentry) => {
      let scopeData: Breadcrumb[] | undefined;
      try {
        const scope = Sentry.getGlobalScope() as unknown as { _breadcrumbs?: Breadcrumb[] };
        scopeData = scope?._breadcrumbs;
      } catch {
        return; // Sentry internals moved; keep what the feed already has.
      }
      if (!scopeData || scopeData.length === 0) return;
      if (scopeData.length !== breadcrumbCount) {
        breadcrumbCount = scopeData.length;
        scheduleFlush();
      }
      const latest = scopeData[scopeData.length - 1];
      const ts = Number(latest?.timestamp ?? 0) * 1000;
      if (!ts) return;
      if (entries.some((e) => e.kind === 'breadcrumb' && e.timestamp === ts)) return;
      add({
        kind: 'breadcrumb',
        level: latest.level === 'warn' ? 'warning' : String(latest.level ?? 'info'),
        message: '[' + String(latest.category ?? 'breadcrumb') + '] ' + String(latest.message ?? ''),
        timestamp: ts,
      });
    })
    .catch(() => {
      // Sentry not present in this build; the other sources still feed the view.
    });
}

// ── start ─────────────────────────────────────────────────────────────────────

/**
 * Start observing. Idempotent, and called at module load rather than at first
 * subscribe — see the header: the first assembly happens before the shell mounts,
 * and missing it would mean the feed cannot explain its own first request.
 */
function ensureStarted(): void {
  if (started) return;
  started = true;
  const install = (fn: () => void) => {
    try {
      fn();
    } catch {
      // One source failing to install must not cost the others.
    }
  };
  install(readLogger);
  install(observeFetch);
  install(observeErrors);
  install(observeSurfaceEvents);
  install(observeLongTasks);
  install(() => {
    pollSentry();
    pollTimer = setInterval(pollSentry, POLL_INTERVAL);
  });
}

ensureStarted();

/** Dev-only escape hatch so a test can stop the poller. */
export function stopTraceSource(): void {
  if (pollTimer) clearInterval(pollTimer);
  if (flushTimer) clearTimeout(flushTimer);
  pollTimer = null;
  flushTimer = null;
  started = false;
}

/**
 * Subscribe to the trace values. The listener is called immediately with what is
 * already known, so a subscriber never has to ask separately — and the path it
 * writes is populated from the first commit rather than only after the first line.
 */
export function subscribeTrace(listener: (snapshot: TraceSnapshot) => void): () => void {
  ensureStarted();
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
