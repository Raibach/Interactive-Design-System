/**
 * THE FAILURE LEDGER — the frontend half of the fail-loud boundary.
 *
 * Doctrine: READ-ME/THE_METHOD.md §"Fail loud" · READ-ME/IMPLEMENTATION_CONFORMANCE.md §1.
 *   "No silent fallbacks. No `except: return False`. … If assembly fails, return HTTP 503
 *    with diagnostics." and "An empty list and a check that never ran must never look the
 *    same." (frontend/scripts/catalog-check.mjs)
 *
 * The server already fails hard. `POST /api/ai/assemble-surface` answers a bad model with
 * HTTP 503 carrying the spec's four-field envelope — `code`, `surfaceId`, `path` (JSON
 * Pointer), `message` — and `backend/deps.py::validate_a2ui_components()` guarantees no
 * invalid UI crosses the wire. Zero-trust is directional that way: the server does not
 * trust the model.
 *
 * But a loud failure delivered to a reader that cannot parse it is, from the operator's
 * seat, silence. That was true here, verifiably, before this file existed:
 *
 *   WritingAreaIndex.tsx:1685  errorData.detail || errorData.message  → the §1 envelope is
 *                              an OBJECT, so errorDetail became "[object Object]" and all
 *                              four fields were lost on arrival.
 *   WritingAreaIndex.tsx:1687  } catch {}                             → a non-JSON 503 body
 *                              (proxy page, empty body) was discarded entirely, leaving the
 *                              operator the bare string "503".
 *   WritingAreaIndex.tsx:1923  startsWith('A2UI FAILURE:')            → dead branch: the
 *                              throw site at :1688 emits "A2UI Assembly Failed: ", so the
 *                              "show it directly" path could never run.
 *
 * So this module is the reader, and it is a HARDCODED TABLE on purpose. A failure that has
 * not been thought about lands in UNCLASSIFIED and says so out loud, rather than being
 * waved through by a heuristic — the same reason catalog-check refuses to call an unrun
 * check a pass.
 *
 * Every entry answers the four questions a person standing in front of a broken surface
 * actually asks, and nothing here is allowed to guess:
 *   WHAT    headline — one plain sentence
 *   WHY     cause    — the mechanism, stated as the most likely one, not as certainty
 *   WHERE   arrow    — a literal pointer glyph plus the exact thing to look at
 *   NOW     fix      — the next action available to this person, with file:line where known
 */

export interface FailureReport {
  /** Machine-ish label rendered by <error-banner code="…">. Free string per tag-registry. */
  code: string;
  /** One plain sentence: what happened. */
  headline: string;
  /** The mechanism. Stated as the most likely one, never as certainty. */
  cause: string;
  /** The next action available to this person. */
  fix: string;
  /** A literal pointer: glyph + the exact region/field to look at. */
  arrow: string;
  /** True only when re-issuing the same request is an honest suggestion. */
  retryable: boolean;
  /** Full, unfiltered diagnostics. Never truncated, never summarised away. */
  detail: string;
}

/** The spec's §1 envelope, pulled apart without losing a field. */
export interface ValidationEnvelope {
  code: string;
  surfaceId?: string;
  path?: string;
  message?: string;
}

export interface FailureContext {
  /** The intent that was in flight, e.g. `render-composer`. */
  intent: string;
  /** HTTP status, when the failure had a response at all. */
  httpStatus?: number;
  /** Parsed response body, when one parsed. */
  body?: unknown;
  /** Raw response text — retained even when it is NOT json. */
  rawBody?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Read the §1 envelope out of whatever the transport actually delivered.
 *
 * FastAPI puts it under `detail`; the spec puts the four fields under `error`. `detail` is
 * sometimes a JSON *string* rather than an object, so one level of unwrapping is required —
 * that is a real shape this endpoint produces, not defensive padding.
 *
 * Returns null when the body is not a §1 envelope at all. Null is honest: it means "this
 * failure did not come from the validation boundary", and the caller then classifies on the
 * status instead of inventing a code.
 */
export function parseValidationEnvelope(body: unknown): ValidationEnvelope | null {
  const outer = asRecord(body);
  if (!outer) return null;

  let detail: unknown = outer.detail ?? outer.error ?? body;
  if (typeof detail === 'string') {
    const trimmed = detail.trim();
    if (trimmed.startsWith('{')) {
      try {
        detail = JSON.parse(trimmed);
      } catch {
        // Not JSON after all. Leave it as the string; the caller records it verbatim
        // rather than dropping it — that is the whole point of this file.
      }
    }
  }

  const rec = asRecord(detail);
  if (!rec) return null;

  // Spec shape is { error: { code, surfaceId, path, message } }; tolerate the flat shape.
  const inner = asRecord(rec.error) ?? rec;
  const code = str(inner.code);
  if (!code) return null;

  return {
    code,
    surfaceId: str(inner.surfaceId),
    path: str(inner.path),
    message: str(inner.message),
  };
}

/**
 * The hardcoded table. Keyed by the code the report carries.
 *
 * `arrow` uses a literal glyph so the pointer is visible without reading the sentence:
 *   ▼  the fault is BELOW this banner — on the surface it was assembling
 *   ↳  the fault is BEHIND the request — server side / logs
 *   ⤴  the fault is UPSTREAM of this screen — the model's own output
 */
const LEDGER: Record<string, Omit<FailureReport, 'detail'>> = {
  'MODEL-NONCONFORMING-JSON': {
    code: 'MODEL-NONCONFORMING-JSON',
    headline: 'The model replied, but not with an A2UI envelope the server would accept.',
    cause:
      'The LLM returned text the assembly pipeline could not parse as JSON. Per R7 the server '
      + 'refuses to render a partial surface, so nothing was drawn.',
    fix:
      'Retry. If it repeats, the assembly prompt or the model itself is the problem — check the '
      + 'backend log line "A2UI FAILURE" for this timestamp.',
    arrow: "⤴ the model's raw output — see the backend log for the rejected text.",
    retryable: true,
  },
  'CATALOG-REJECT': {
    code: 'CATALOG-REJECT',
    headline: 'The server refused a component that is not in the trusted catalog.',
    cause:
      'The model emitted a component whose type is not in catalogs/prompt-composer/catalog.json. '
      + 'backend/deps.py::validate_a2ui_components() rejected it with VALIDATION_FAILED before it '
      + 'could reach this screen. That is the zero-trust boundary working as designed.',
    fix:
      'Read the JSON Pointer in `path` below — it names the exact component index. Either the '
      + 'model drifted, or the component genuinely belongs in the catalog. Do not relax the '
      + 'validator to make this go away.',
    arrow: '▼ the component index named by `path` below, and catalog.json.',
    retryable: true,
  },
  'MODEL-EMPTY-RESPONSE': {
    code: 'MODEL-EMPTY-RESPONSE',
    headline: 'The model returned an empty or unusable surface.',
    cause:
      'The provider answered without usable content. No fallback UI was substituted — an empty '
      + 'result and a working one must never look the same.',
    fix: 'Retry. If it persists, check provider status and the backend log for this timestamp.',
    arrow: '⤴ the model call — see backend logs.',
    retryable: true,
  },
  'ASSEMBLY-503': {
    code: 'ASSEMBLY-503',
    headline: 'The backend refused to assemble the surface.',
    cause: 'A 503 from /api/ai/assemble-surface whose body did not match a known envelope.',
    fix: 'The full body is printed below, verbatim. Match it against backend logs.',
    arrow: '↳ the backend — full response body below.',
    retryable: true,
  },
  'PROVIDER-OVERLOADED': {
    code: 'PROVIDER-OVERLOADED',
    headline: 'The AI service is temporarily at capacity.',
    cause:
      'The model server answered "too busy" / "service unavailable" — its capacity is saturated, '
      + 'not this app. The request never reached the model.',
    // THE MODEL IS NAMED, AND IT IS NO LONGER DEEPSEEK (2026-09-24). Assembly and chat both run
    // on the local Qwen9B behind the tunnel, so a message pointing at DeepSeek would send an
    // operator to a service this app no longer calls.
    fix:
      'Wait a moment and retry. If it repeats, the model server itself is saturated — check that '
      + 'LM Studio is still serving and that the tunnel has not started throttling.',
    arrow: '⤴ the model server — Qwen9B on LM Studio (or the tunnel to it).',
    retryable: true,
  },
  'ASSEMBLY-TIMEOUT': {
    code: 'ASSEMBLY-TIMEOUT',
    headline: 'The assembly request was abandoned before the backend answered.',
    cause:
      'The client-side cap elapsed (ASSEMBLY_TIMEOUT_MS). Typical causes: a cold model call slower '
      + 'than the cap, the backend down, or the network dropping the request.',
    // A COLD LOCAL CALL IS THE LIKELIER CAUSE NOW, and it is a real one: LM Studio unloads an
    // idle model after its TTL, so the first assembly after an idle hour pays for a JIT load
    // before it assembles anything. A retry lands warm.
    fix:
      'Retry — a cold model call has been measured near the cap, and the retry usually lands warm '
      + 'because the model is then loaded. If it repeats, check the tunnel and raise '
      + 'LLM_TIMEOUT_ASSEMBLY (backend) / ASSEMBLY_TIMEOUT_MS (this client) together.',
    arrow: '↳ the backend — it may still be working on the request that just timed out.',
    retryable: true,
  },
  'BACKEND-UNREACHABLE': {
    code: 'BACKEND-UNREACHABLE',
    headline: 'The browser could not reach the backend at all.',
    cause:
      'fetch() failed before any HTTP status existed — the process is not listening, the port '
      + 'moved, or the request never left the machine.',
    fix: 'Confirm the API is up, then retry. Nothing was assembled and nothing was persisted.',
    arrow: '↳ the API process and its port.',
    retryable: true,
  },
  'ROUTE-MISSING': {
    code: 'ROUTE-MISSING',
    headline: 'The backend answered, and does not have that route.',
    cause:
      'HTTP 404 from the API. The frontend called an endpoint the backend does not serve — the '
      + 'contract and the routing table disagree with each other.',
    fix:
      'Do not add a client-side fallback. Either the route is unwired in backend/routes/, or a '
      + 'caller named it wrong — fix whichever declaration is the false one.',
    arrow: '↳ the endpoint named in the detail below, and backend/routes/.',
    retryable: false,
  },
  'BACKEND-500': {
    code: 'BACKEND-500',
    headline: 'The backend raised while handling the request.',
    cause: 'An unhandled server error. The response body carries whatever the server said.',
    fix: 'Open the backend log for this timestamp — the traceback is there, not here.',
    arrow: '↳ the backend traceback for this request.',
    retryable: true,
  },
  // The envelope's own labels were refused. Not a server fault and not a model
  // fault in the usual sense: the shell was handed a protocol it cannot read, and
  // said so instead of drawing a guess. See shared/a2ui-envelope.ts.
  'ENVELOPE-REFUSED': {
    code: 'ENVELOPE-REFUSED',
    headline: 'The shell refused an A2UI envelope rather than draw a guess at it.',
    cause:
      'The response carried a format version this shell does not implement, or described more '
      + 'than one surface — and <a2ui-renderer> holds exactly one. Both were previously read as '
      + 'if they were v0.9.1 and one surface, which produced an empty or mixed screen with no '
      + 'warning at all.',
    fix:
      'Reproduce the request and read the refusal detail below: it names the version(s) the '
      + 'producer stamped, or the surfaceIds it sent. A version means this shell and its producer '
      + 'disagree about the wire format; two surfaces mean the shell needs a mount point per '
      + 'surface before it can draw both.',
    arrow: '⤴ the producer of the envelope — it named a format the shell cannot read.',
    retryable: false,
  },
  'UNCLASSIFIED': {
    code: 'UNCLASSIFIED',
    headline: 'Something failed that this ledger has no entry for.',
    cause:
      'The failure did not match any known signature. It is reported rather than absorbed, because '
      + 'an unclassified failure is a gap in this table — not a small failure.',
    fix:
      'Read the raw detail below, then add an entry to frontend/src/shared/error-registry.ts. Do '
      + 'not widen a catch to hide it.',
    arrow: '▼ the raw detail below — unknown signature.',
    retryable: true,
  },
};

const KNOWN_CODES = Object.keys(LEDGER);

function mentions(haystack: string, ...needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

/**
 * Classify a thrown failure into a report.
 *
 * Pure, total, and never returns null: every failure gets a code, and the ones this ledger
 * has not seen admit that they are unknown. There is no branch that returns "nothing went
 * wrong" — that branch is what this file exists to delete.
 */
export function classifyFailure(error: unknown, ctx: FailureContext): FailureReport {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : '(no stack)';
  const status = ctx.httpStatus;
  const envelope = parseValidationEnvelope(ctx.body);

  let code: string;
  if (name === 'EnvelopeRefusalError') {
    // The shell refused the envelope's OWN labels (version / surface), so the
    // code is read off the error rather than matched against its sentence: the
    // producer's version string is free text, and a signature over it would be
    // a heuristic standing in for a fact the refusal already carries.
    code = 'ENVELOPE-REFUSED';
  } else if (name === 'AbortError' || mentions(message, 'aborted', 'signal is aborted')) {
    code = 'ASSEMBLY-TIMEOUT';
  } else if (envelope) {
    // The server spoke the spec, so trust the code IT chose — unless this ledger has no
    // entry for it, in which case still show it (under the catalog-reject shape, since a
    // §1 envelope always means the validation boundary refused something) rather than
    // silently downgrading a real VALIDATION_FAILED to "unclassified".
    code = KNOWN_CODES.includes(envelope.code) ? envelope.code : 'CATALOG-REJECT';
  } else if (mentions(message, 'service is too busy', 'service_unavailable', 'service unavailable')) {
    // The provider answered, and its answer is "we are at capacity". Not a fault in the
    // shell or the model — an upstream outage, and the person deserves a "try again
    // later" rather than a raw 503 payload.
    code = 'PROVIDER-OVERLOADED';
  } else if (status === 404) {
    code = 'ROUTE-MISSING';
  } else if (status === 500) {
    code = 'BACKEND-500';
  } else if (status === 503) {
    code = mentions(message, 'invalid json', 'not valid json', 'jsondecode')
      ? 'MODEL-NONCONFORMING-JSON'
      : mentions(message, 'empty', 'no content')
        ? 'MODEL-EMPTY-RESPONSE'
        : 'ASSEMBLY-503';
  } else if (
    mentions(message, 'failed to fetch', 'networkerror', 'load failed', 'network request failed')
  ) {
    code = 'BACKEND-UNREACHABLE';
  } else {
    code = 'UNCLASSIFIED';
  }

  const entry = LEDGER[code] ?? LEDGER['UNCLASSIFIED'];

  const lines: string[] = [
    `intent:    ${ctx.intent}`,
    `code:      ${entry.code}`,
    `http:      ${status ?? '(no response)'}`,
    `error:     ${name}: ${message}`,
  ];
  if (envelope) {
    lines.push(
      `envelope:  code=${envelope.code}`
        + ` surfaceId=${envelope.surfaceId ?? '—'}`
        + ` path=${envelope.path ?? '—'}`,
    );
    if (envelope.message) lines.push(`spec-says: ${envelope.message}`);
  }
  if (ctx.rawBody) lines.push(`body:      ${ctx.rawBody}`);
  lines.push(`stack:\n${stack}`);

  return { ...entry, detail: lines.join('\n') };
}

/** Every code this ledger can emit — exported so a test can assert each one is reachable. */
export const FAILURE_CODES = KNOWN_CODES;
