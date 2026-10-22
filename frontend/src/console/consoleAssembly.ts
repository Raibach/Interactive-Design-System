/**
 * THE ASSEMBLY TRANSPORT — extracted from `WritingAreaIndex.tsx` on 2026-10-21
 * (console extraction Phase 1a). This module carries NO tab's behavior: it posts one intent and
 * its context to `/api/ai/assemble-surface` and returns either the raw envelope or the
 * transport facts, so the caller's failure classifier keeps every byte it had.
 *
 * The package headers are written HERE because the governance ledger attributes a call by
 * HEADERS only — a body read inside that middleware deadlocked these very POSTs (measured
 * 2026-10-03, a curl that never came back).
 */
import { API_BASE } from "@/shared/apiHelper";
import { parseValidationEnvelope } from "@/shared/error-registry";

export interface AssemblyContext {
  current_surface?: string;
  has_unsaved_changes?: boolean;
  session_id?: string | null;
  session_title?: string;
  category?: string;
  /** The repair brief — carried only when a repair launched this assembly. */
  repair_brief?: string[] | null;
}

export interface AssemblyTransportFailure {
  httpStatus: number;
  body?: unknown;
  rawBody: string;
  /** The human sentence the caller throws: the envelope's message, the detail, or the raw body. */
  message: string;
}

export type AssemblyTransportResult =
  | { ok: true; rawData: unknown }
  | { ok: false; failure: AssemblyTransportFailure };

export async function postAssembleSurface(options: {
  intent: string;
  context?: AssemblyContext;
  userId: string;
  signal: AbortSignal;
  limit?: number;
}): Promise<AssemblyTransportResult> {
  const { intent, context, userId, signal, limit = 500 } = options;

  // THE PACKAGE THIS CALL IS ABOUT: the context when it names one, the intent when it does.
  const fromIntent =
    typeof intent === "string" && intent.includes(":") ? intent.split(":")[1].trim() : "";
  const ctx = context as { session_id?: string; conversation_id?: string } | undefined;
  const packageSession = String(ctx?.session_id || fromIntent || "");
  const packageHeaders: Record<string, string> = {};
  if (packageSession) {
    packageHeaders["X-Package-Session"] = packageSession;
    if (ctx?.conversation_id) packageHeaders["X-Conversation-Id"] = String(ctx.conversation_id);
  }

  const response = await fetch(`${API_BASE}/ai/assemble-surface?limit=${limit}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": userId,
      ...packageHeaders,
    },
    body: JSON.stringify({ intent, context }),
    signal,
  });

  if (!response.ok) {
    // Read the body as TEXT first. A non-JSON error page must survive, and the §1 envelope is
    // an OBJECT that stringified to "[object Object]" in the old path (measured) — text()
    // cannot fail that way.
    const rawBody = await response.text();
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      // Not JSON. rawBody already holds the truth; parsedBody stays undefined and the caller's
      // classifier falls back to status + raw text instead of inventing a shape.
    }
    console.error("🔴 [A2UI] Backend error", response.status, parsedBody ?? rawBody);

    // §1 says the envelope's `message` is the human sentence — prefer it. Never let its absence
    // collapse the status into a bare number: the raw body is the fallback.
    const envelope = parseValidationEnvelope(parsedBody);
    const detailFromBody =
      typeof parsedBody === "object" && parsedBody !== null
        ? (parsedBody as { detail?: unknown }).detail
        : undefined;
    const message =
      envelope?.message ??
      (typeof detailFromBody === "string" ? detailFromBody : undefined) ??
      (rawBody.trim() || `${response.status} ${response.statusText}`);
    return {
      ok: false,
      failure: { httpStatus: response.status, body: parsedBody, rawBody, message },
    };
  }

  return { ok: true, rawData: await response.json() };
}
