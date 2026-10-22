/**
 * THE GOVERNANCE ROOM'S TRACE READS — the shell-side source behind the seat's trace
 * views (`trace-context-header`, `trace-tree`, `trace-detail`).
 *
 * WHY THIS TALKS TO THE APP'S OWN tRPC, AND NOT A BACKEND PROXY (measured 2026-10-13,
 * the day this was written): this Langfuse deployment runs v4 `events_only` mode, and in
 * that mode the whole classic public read API (`/api/public/traces…`, `/observations`,
 * `/scores`) is refused by the fork itself — "This endpoint is not available on
 * deployments running in Langfuse v4 events_only mode" — so a backend proxy holding the
 * API keys CANNOT read this data, whatever keys it holds. The app's own read path in
 * this mode is its internal tRPC (`events.byTraceId`, `events.batchIO`), reading the
 * events store under the page's session. The room embeds that app SAME-ORIGIN (the frame
 * is served under this app's `/governance` section), so this module speaks exactly that
 * protocol to exactly that origin, as the signed-in person — the seat then draws what
 * the app itself would draw, because it reads the same bytes. Nothing here holds a key
 * or talks to another host. When the room goes native (Stage 3), the reads stay here and
 * only the transport changes.
 *
 * THE PROTOCOL — read off the requests the app itself makes, then verified live against
 * the running instance (200s, real payloads):
 *   GET  {base}/api/trpc/events.byTraceId?input=<encodeURIComponent(JSON.stringify(env))>
 *   POST {base}/api/trpc/events.batchIO          body = JSON.stringify(env)
 * where `env` is tRPC's superjson transformer envelope:
 *   no Dates      { json: <payload> }
 *   with Dates    { json: { …ISO strings… }, meta: { values: { "<path>": ["Date"] }, v: 1 } }
 * Responses carry the same envelope under `result.data`; this module unwraps `.json` and
 * keeps timestamps as their ISO strings — the view layer formats strings, never Dates.
 *
 * IT IS A SOURCE, NOT A VIEW — the trace-source.ts split, one room over: the elements
 * are views that draw bound values; the SHELL calls this module and writes the result
 * into them. All errors are thrown with their real reason (the honesty rule): a read
 * that failed must never render as "no data".
 */

/** One node of the trace, as the seat's views draw it. Plain JSON — no Date objects. */
export interface GovTraceObservation {
  id: string;
  parentObservationId: string | null;
  type: string;
  name: string | null;
  startTime: string;
  endTime: string | null;
  /** Seconds. */
  latency: number | null;
  /** USD. */
  totalCost: number | null;
  totalTokens: number | null;
  level: string | null;
  statusMessage: string | null;
  model: string | null;
  environment: string | null;
  userId: string | null;
  sessionId: string | null;
  /** Server-provided on every row — the name the list's "Trace Name" column reads. */
  traceName: string | null;
}

/** The trace as a whole — synthesized from its observations, the same way the app does. */
export interface GovTraceSummary {
  id: string;
  name: string | null;
  /** ISO — the earliest observation's start. */
  startTime: string;
  latency: number | null;
  /** Sum over observations; null when nothing carries one ("—", never a fake $0). */
  totalCost: number | null;
  totalTokens: number | null;
  sessionId: string | null;
  userId: string | null;
  observationCount: number;
}

export interface GovTraceBundle {
  trace: GovTraceSummary;
  observations: GovTraceObservation[];
}

/** One observation's I/O, as `events.batchIO` returns it (stringified, the app's own format). */
export interface GovObservationIO {
  input: string | null;
  output: string | null;
  metadata: string | null;
}

/** The tRPC transformer envelope for one call's input. */
function envelope(payload: Record<string, unknown>, datePaths: string[] = []): Record<string, unknown> {
  if (datePaths.length === 0) return { json: payload };
  return {
    json: payload,
    meta: { values: Object.fromEntries(datePaths.map((path) => [path, ['Date']])), v: 1 },
  };
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function pickObservation(raw: Record<string, unknown>): GovTraceObservation {
  return {
    id: String(raw.id ?? ''),
    parentObservationId: asString(raw.parentObservationId),
    type: String(raw.type ?? 'SPAN'),
    name: asString(raw.name),
    startTime: String(raw.startTime ?? ''),
    endTime: asString(raw.endTime),
    latency: asNumber(raw.latency),
    totalCost: asNumber(raw.totalCost),
    totalTokens: asNumber(raw.totalUsage),
    level: asString(raw.level),
    statusMessage: asString(raw.statusMessage),
    model: asString(raw.model),
    environment: asString(raw.environment),
    userId: asString(raw.userId),
    sessionId: asString(raw.sessionId),
    traceName: asString(raw.traceName),
  };
}

/**
 * THE SYNTHESIS — the same rules the app's own adapter (`eventsToTraceAdapter.ts`) uses,
 * because in v4 a trace is not a row: it is computed from its observations.
 *   primary  — the observation the person selected (the URL's `peek`/`observation` id)
 *              when it is in the set; else the parentless root; else the earliest.
 *   name     — the primary's server-provided `traceName` first (the field the list's
 *              "Trace Name" column reads), then its own name.
 *   latency  — the primary's own latency; computed from earliest start → latest end
 *              only when the primary carries none.
 *   cost/tokens — summed over observations; null when NO observation carries one, so
 *              the views can say "—" instead of a fabricated $0.
 */
function synthesizeTrace(
  traceId: string,
  observations: GovTraceObservation[],
  preferredId?: string | null,
): GovTraceSummary {
  const sorted = [...observations].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  const earliest = sorted[0];
  const root = observations.find((o) => !o.parentObservationId);
  const preferred = preferredId ? observations.find((o) => o.id === preferredId) : undefined;
  const primary = preferred ?? root ?? earliest;

  const endTimes = observations
    .map((o) => (o.endTime ? new Date(o.endTime).getTime() : null))
    .filter((t): t is number => t !== null);
  const computedLatency =
    endTimes.length > 0 && earliest
      ? (Math.max(...endTimes) - new Date(earliest.startTime).getTime()) / 1000
      : null;

  const costs = observations.map((o) => o.totalCost).filter((c): c is number => c !== null);
  const tokens = observations.map((o) => o.totalTokens).filter((t): t is number => t !== null);

  const traceName = primary?.traceName ?? primary?.name ?? null;

  return {
    id: traceId,
    name: traceName,
    startTime: earliest?.startTime ?? '',
    latency: primary?.latency ?? computedLatency,
    totalCost: costs.length > 0 ? costs.reduce((sum, c) => sum + c, 0) : null,
    totalTokens: tokens.length > 0 ? tokens.reduce((sum, t) => sum + t, 0) : null,
    sessionId: primary?.sessionId ?? null,
    userId: primary?.userId ?? null,
    observationCount: observations.length,
  };
}

/** A failed read states its real reason — callers surface it, never hide it. */
export class GovTraceReadError extends Error {
  constructor(public readonly endpoint: string, public readonly status: number, detail: string) {
    super(`Langfuse read failed (${endpoint}, HTTP ${status}): ${detail}`);
    this.name = 'GovTraceReadError';
  }
}

async function readJson(endpoint: string, resp: Response): Promise<Record<string, unknown>> {
  const text = await resp.text();
  if (!resp.ok) throw new GovTraceReadError(endpoint, resp.status, text.slice(0, 300));
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    throw new GovTraceReadError(endpoint, resp.status, `unparseable response: ${String(e)}`);
  }
  const error = parsed.error as { message?: string } | undefined;
  if (error) throw new GovTraceReadError(endpoint, resp.status, error.message ?? 'tRPC error');
  return parsed as Record<string, unknown>;
}

/** The envelope's payload — `result.data.json` — with the tRPC error already ruled out. */
function payloadOf(parsed: Record<string, unknown>, endpoint: string): unknown {
  const result = parsed.result as { data?: { json?: unknown } } | undefined;
  if (!result?.data || !('json' in result.data)) {
    throw new GovTraceReadError(endpoint, 200, 'response carried no result.data.json');
  }
  return result.data.json;
}

/**
 * READ ONE TRACE — its observations, and the summary synthesized above.
 * `base` is the room's section URL without a trailing slash (e.g. `/governance`);
 * `timestampIso` is the URL's `timestamp` param when the reporter carried one — the
 * app passes it through the same way.
 */
export async function fetchGovTrace(
  base: string,
  projectId: string,
  traceId: string,
  timestampIso: string | null,
  preferredObservationId: string | null,
): Promise<GovTraceBundle> {
  const input: Record<string, unknown> = { projectId, traceId };
  const datePaths: string[] = [];
  if (timestampIso) {
    input.timestamp = timestampIso;
    datePaths.push('timestamp');
  }
  const endpoint = 'events.byTraceId';
  const url = `${base}/api/trpc/${endpoint}?input=${encodeURIComponent(JSON.stringify(envelope(input, datePaths)))}`;
  const parsed = await readJson(endpoint, await fetch(url, { credentials: 'include' }));
  const data = payloadOf(parsed, endpoint) as { observations?: Record<string, unknown>[] };
  if (!Array.isArray(data.observations)) {
    throw new GovTraceReadError(endpoint, 200, 'response carried no observations array');
  }
  const observations = data.observations.map(pickObservation);
  return { trace: synthesizeTrace(traceId, observations, preferredObservationId), observations };
}

/**
 * READ ONE OBSERVATION'S I/O — `events.batchIO`, the same one-row call the app makes
 * when a node is opened. The window is the trace's observation span (min → max start
 * time), exactly the window the app computes; `truncated: false` asks for the full I/O.
 */
export async function fetchGovObservationIO(
  base: string,
  projectId: string,
  traceId: string,
  observationId: string,
  windowStartIso: string,
  windowEndIso: string,
): Promise<GovObservationIO> {
  const endpoint = 'events.batchIO';
  const input: Record<string, unknown> = {
    projectId,
    traceId,
    observations: [{ id: observationId, traceId }],
    minStartTime: windowStartIso,
    maxStartTime: windowEndIso,
    truncated: false,
  };
  const body = JSON.stringify(envelope(input, ['minStartTime', 'maxStartTime']));
  const parsed = await readJson(
    endpoint,
    await fetch(`${base}/api/trpc/${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body,
    }),
  );
  const rows = payloadOf(parsed, endpoint);
  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) throw new GovTraceReadError(endpoint, 200, 'response carried no I/O row');
  return {
    input: asString(row.input),
    output: asString(row.output),
    metadata: asString(row.metadata),
  };
}

/** The batchIO window the app uses: min → max observation START times (ISO in, ISO out). */
export function observationWindow(observations: GovTraceObservation[]): { start: string; end: string } | null {
  const times = observations
    .map((o) => new Date(o.startTime).getTime())
    .filter((t) => Number.isFinite(t));
  if (times.length === 0) return null;
  return {
    start: new Date(Math.min(...times)).toISOString(),
    end: new Date(Math.max(...times)).toISOString(),
  };
}

/**
 * THE NEWEST TRACE — one row of the events list, the same call the app's own Traces
 * page makes for its first page. Verified live 2026-10-13: the default order is newest
 * first, `orderBy: null` is the app's own default, and an array orderBy is a 400.
 *
 * CURRENTLY UNWIRED, ON PURPOSE. It backed the room's default-first-trace rule for part
 * of one evening; the owner reversed that the same night: *"She doesn't open by default.
 * She only opens whenever someone selects a row in the table."* Her opening — and every
 * trace read — now rides the ROW SELECTION alone (the reporter flow). The read stays
 * here whole because it is measured and correct: the day a surface legitimately needs
 * "the newest trace of this project", this is that call, verified — not reconstructed.
 */
export async function fetchGovFirstTrace(
  base: string,
  projectId: string,
): Promise<string | null> {
  const endpoint = 'events.all';
  const input = {
    projectId,
    filter: [],
    searchQuery: null,
    searchType: ['id', 'content'],
    orderBy: null,
    page: 1,
    limit: 1,
  };
  const url = `${base}/api/trpc/${endpoint}?input=${encodeURIComponent(JSON.stringify(envelope(input)))}`;
  const parsed = await readJson(endpoint, await fetch(url, { credentials: 'include' }));
  const data = payloadOf(parsed, endpoint) as { observations?: Record<string, unknown>[] };
  const first = Array.isArray(data.observations) ? data.observations[0] : undefined;
  if (!first) return null;
  const traceId = asString(first.traceId);
  if (!traceId) throw new GovTraceReadError(endpoint, 200, 'first row carried no traceId');
  return traceId;
}

/**
 * THE ROOM'S LANDING METRICS — what the readout bar features when NO trace is selected (owner,
 * 2026-10-14: *"put something in our header box when you land on the dashboard … maybe model
 * metrics/usage"*). One page of the newest observations (`events.all`), aggregated here because
 * there is no count-and-sum endpoint to borrow: rows are observation-shaped and each carries its
 * trace id, cost, tokens and model. `truncated` says the page filled — the numbers then cover
 * the NEWEST `limit` observations and the strip says so; they are never presented as a whole
 * window they might not be. 100 IS THE ENDPOINT'S OWN CEILING — measured 2026-10-14:
 * `events.all` answers HTTP 400 (`Too big: expected number to be <=100`) for anything larger;
 * the first version asked for 250, so the landing read never bound.
 */
export interface GovRoomMetrics {
  traces: number;
  observations: number;
  totalCost: number | null;
  totalTokens: number | null;
  model: string | null;
  truncated: boolean;
}

export async function fetchGovRoomMetrics(
  base: string,
  projectId: string,
  limit = 100,
): Promise<GovRoomMetrics> {
  const endpoint = 'events.all';
  const input = {
    projectId,
    filter: [],
    searchQuery: null,
    searchType: ['id', 'content'],
    orderBy: null,
    page: 1,
    limit,
  };
  const url = `${base}/api/trpc/${endpoint}?input=${encodeURIComponent(JSON.stringify(envelope(input)))}`;
  const parsed = await readJson(endpoint, await fetch(url, { credentials: 'include' }));
  const data = payloadOf(parsed, endpoint) as { observations?: Record<string, unknown>[] };
  const rows = Array.isArray(data.observations) ? data.observations : [];
  const traceIds = new Set<string>();
  let cost: number | null = null;
  let tokens: number | null = null;
  const modelCounts = new Map<string, number>();
  for (const raw of rows) {
    const traceId = asString(raw.traceId);
    if (traceId) traceIds.add(traceId);
    const c = asNumber(raw.totalCost);
    if (c !== null) cost = (cost ?? 0) + c;
    const t = asNumber(raw.totalUsage);
    if (t !== null) tokens = (tokens ?? 0) + t;
    const m = asString(raw.model);
    if (m) modelCounts.set(m, (modelCounts.get(m) ?? 0) + 1);
  }
  let model: string | null = null;
  let best = 0;
  for (const [name, n] of modelCounts) {
    if (n > best) {
      best = n;
      model = name;
    }
  }
  return {
    traces: traceIds.size,
    observations: rows.length,
    totalCost: cost,
    totalTokens: tokens,
    model,
    truncated: rows.length >= limit,
  };
}

/** One score row, ScoreDomain-shaped (camelCase) as `events.scoresForTrace` returns it. */
export interface GovTraceScore {
  id: string;
  name: string;
  dataType: string | null;
  value: number | null;
  stringValue: string | null;
  observationId: string | null;
}

/**
 * READ THE TRACE'S SCORES — `events.scoresForTrace`, the call the app makes for the
 * same screens. Rows are ScoreDomain (camelCase); `observationId` is null on
 * trace-level scores. The verified live response for a scoreless trace is `[]`.
 */
export async function fetchGovTraceScores(
  base: string,
  projectId: string,
  traceId: string,
  timestampIso: string | null,
): Promise<GovTraceScore[]> {
  const endpoint = 'events.scoresForTrace';
  const input: Record<string, unknown> = { projectId, traceId };
  const datePaths: string[] = [];
  if (timestampIso) {
    input.timestamp = timestampIso;
    datePaths.push('timestamp');
  }
  const url = `${base}/api/trpc/${endpoint}?input=${encodeURIComponent(JSON.stringify(envelope(input, datePaths)))}`;
  const parsed = await readJson(endpoint, await fetch(url, { credentials: 'include' }));
  const rows = payloadOf(parsed, endpoint);
  if (!Array.isArray(rows)) throw new GovTraceReadError(endpoint, 200, 'response carried no scores array');
  return rows.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      dataType: asString(r.dataType),
      value: asNumber(r.value),
      stringValue: asString(r.stringValue),
      observationId: asString(r.observationId),
    };
  });
}

/**
 * READ THE OBSERVATION COMMENT COUNTS — `comments.getCountByObjectType`, the one
 * bulk call the app makes for the tree's comment badges. The response is a superjson
 * MAP: `result.data.json` is an array of `[observationId, count]` pairs and the meta
 * says `["map"]` (verified live 2026-10-13 against the running instance — an empty
 * project answers with `json: []`). Returns a plain id→count record.
 */
export async function fetchGovObservationCommentCounts(
  base: string,
  projectId: string,
): Promise<Record<string, number>> {
  const endpoint = 'comments.getCountByObjectType';
  const input = { projectId, objectType: 'OBSERVATION' };
  const url = `${base}/api/trpc/${endpoint}?input=${encodeURIComponent(JSON.stringify(envelope(input)))}`;
  const parsed = await readJson(endpoint, await fetch(url, { credentials: 'include' }));
  const rows = payloadOf(parsed, endpoint);
  if (!Array.isArray(rows)) throw new GovTraceReadError(endpoint, 200, 'response carried no Map entries');
  const counts: Record<string, number> = {};
  for (const entry of rows) {
    if (Array.isArray(entry) && entry.length >= 2) {
      counts[String(entry[0])] = Number(entry[1]) || 0;
    }
  }
  return counts;
}
