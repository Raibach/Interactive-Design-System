/**
 * ConsolePage - the CONSOLE's host states.
 *
 * The surface itself — Grace's greeting and her ConsoleCardGrid — is drawn by
 * <a2ui-renderer> from the updateComponents tree she sent. This component does NOT
 * draw a second copy of it from the data model; that duplication was the reason the
 * renderer used to be mounted off-screen.
 *
 * What is left here is what is genuinely the host's:
 *   · the states a surface cannot state — loading, failed, waiting, zero packages
 *   · the two card events, routed to the host's intents (the card's own arm→confirm
 *     is the only delete confirmation — the host deletes on `card-delete`, no modal).
 *
 * NO FALLBACKS. NO HIDDEN FETCHES. NO ERROR SUPPRESSION. If AI fails, show the error.
 */
import { useEffect, useRef, useState } from "react";
import { getStoredUserId } from "@/services/authService";
// The classified failure, when the shell has one. Optional: ConsolePage still renders a
// plain sentence if all it was handed is a string.
import type { FailureReport } from "@/shared/error-registry";

// A card id is only a real prompt-package key when it is a UUID.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A2UI re-assembly request — dispatched when the user asks for a fresh
 * assembly. WritingAreaIndex listens and re-runs the render-console intent
 * through the AI. No webpage reloads — navigation is an AI command.
 */
const requestReassembly = () => {
  window.dispatchEvent(new CustomEvent('a2ui:console-command', { detail: { reason: 'user-retry' } }));
};

interface ConsolePageProps {
  onOpenPrompt?: (sessionId: string) => void;
  // No onDeletePrompt: deletion has ONE host path — the shell's own `card-delete`
  // listener (WritingAreaIndex) → deletePackage. This page used to delete as well, so
  // one confirmed delete issued TWO permanent DELETEs of the same package.
  onCreateNew?: (title: string) => void;
  refreshKey?: number;
  aiAssembledCards?: any[] | null;
  isParentLoading?: boolean;
  errorMessage?: string | null;
  /** The classified failure, when the shell has one. Adds code / pointer / fix / detail. */
  errorReport?: FailureReport | null;
  loadingMessage?: string;
}

export default function ConsolePage({
  onOpenPrompt,
  onCreateNew,
  aiAssembledCards = null,
  isParentLoading = false,
  errorMessage = null,
  errorReport = null,
  loadingMessage = "Assembling your console..."
}: ConsolePageProps) {

  // ── Card events · card-open is this page's; card-delete is not ─────────────
  // <agent-card-element> dispatches `card-open` when the card body is clicked; opening
  // a package is an assembly, so it goes back out to the host rather than happening
  // here. `card-delete` (dispatched after the card's own arm→confirm, the only
  // confirmation) has exactly ONE host — the shell's listener beside its deletePackage —
  // and this page used to delete as well, so every confirmed delete ran twice.

  // The listener below is registered ONCE (empty deps), while the host passes a new
  // inline handler on every render — and the one that matters reads the OPEN session.
  // A ref holds the current handler so the listener never calls the one from the first
  // render, which would have opened against stale state.
  const liveHandlers = useRef({ onOpenPrompt });
  useEffect(() => {
    liveHandlers.current = { onOpenPrompt };
  });

  useEffect(() => {
    // `composed`, so it crosses the renderer's shadow boundary and arrives here as a
    // plain window event — no ref into the surface, no per-card wiring.
    const onCardOpen = (e: Event) => {
      const sessionId = (e as CustomEvent).detail?.sessionId;
      if (typeof sessionId === 'string' && UUID_RE.test(sessionId)) {
        console.log('[ConsolePage] card-open:', sessionId);
        liveHandlers.current.onOpenPrompt?.(sessionId);
      }
    };
    window.addEventListener('card-open', onCardOpen);
    return () => {
      window.removeEventListener('card-open', onCardOpen);
    };
  }, []);

  // ── The banner's ✕ ────────────────────────────────────────────────────────
  //
  // <error-banner> always renders a dismiss control, so it has to DO something — a control
  // that renders and does nothing is the `tag-inert` finding the banner was written to fix.
  // Acknowledging hides the HEADLINE only; the diagnostics and the Retry button stay, and
  // the acknowledgement is per-failure-TEXT: a different failure re-raises the banner, the
  // same failure re-reported does not, because the operator has already read it.
  const [isFailureAcknowledged, setIsFailureAcknowledged] = useState(false);
  useEffect(() => {
    setIsFailureAcknowledged(false);
  }, [errorMessage]);

  // The pointer, split so the glyph can be large and the target legible. Rendered as a
  // literal arrow rather than a sentence: "an error occurred" is not a location.
  const arrowParts = (errorReport?.arrow ?? '').split(' ');
  const arrowGlyph = arrowParts.shift() ?? '';
  const arrowRest = arrowParts.join(' ');

  // ✅ STRICT A2UI RULE #1: If parent is loading, show spinner INSIDE this surface only
  if (isParentLoading) {
    return (
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center gap-4" style={{ minHeight: "calc(100vh - 120px)" }}>
        <div className="w-8 h-8 border-3 border-[#507274] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#507274] text-sm font-medium font-['Inter'] animate-pulse">{loadingMessage}</p>
      </div>
    );
  }

  // ✅ STRICT A2UI RULE #2: If there's an error, SHOW IT with retry option
  //
  // This used to be a raw <pre> holding whatever string arrived — and what usually arrived
  // was "Assembly failed: [object Object]", because the §1 envelope was stringified upstream.
  // It now renders the DECLARED A2UI error surface (<error-banner>, catalog-registered and
  // granted to every role) plus the four things a person needs: what happened, why, WHERE
  // (a literal pointer), and what to do now. Raw diagnostics stay available, verbatim.
  if (errorMessage) {
    return (
      <div className="flex-1 w-full h-full overflow-auto p-4" style={{ minHeight: "calc(100vh - 120px)" }}>
        <div className="mx-auto w-full max-w-4xl flex flex-col gap-3">
          {!isFailureAcknowledged && (
            <error-banner
              code={errorReport?.code || 'ASSEMBLY-FAILED'}
              message={errorMessage}
            ></error-banner>
          )}

          {errorReport ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3 text-left">
              <div className="flex items-baseline gap-3">
                <span aria-hidden="true" className="text-2xl leading-none text-amber-700">{arrowGlyph}</span>
                <span className="text-xs font-semibold text-amber-800">{arrowRest}</span>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">What happened</div>
                <div className="text-[13px] font-semibold text-gray-900">{errorReport.headline}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Why</div>
                <div className="text-[13px] text-gray-700">{errorReport.cause}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">What to do now</div>
                <div className="text-[13px] text-gray-700">{errorReport.fix}</div>
              </div>
              <details>
                <summary className="text-[11px] font-bold text-gray-500 cursor-pointer">Raw diagnostics — verbatim, nothing filtered</summary>
                <pre className="mt-1.5 text-[11px] font-mono text-gray-700 whitespace-pre-wrap break-words bg-gray-50 border border-gray-200 rounded p-2.5">{errorReport.detail}</pre>
              </details>
            </div>
          ) : (
            <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-left">
              <pre className="text-red-600 font-mono text-xs whitespace-pre-wrap break-words">{errorMessage}</pre>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={requestReassembly}
              className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry Assembly
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ STRICT A2UI RULE #3: null cards = the AI event has NOT arrived yet.
  // Never claim "empty" while the surface is still waiting for the AI.
  if (!aiAssembledCards) {
    return (
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center gap-4" style={{ minHeight: "calc(100vh - 120px)" }}>
        <div className="w-8 h-8 border-3 border-[#507274] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#507274] text-sm font-medium font-['Inter'] animate-pulse">Waiting for AI assembly…</p>
      </div>
    );
  }

  // ✅ STRICT A2UI RULE #4: The AI assembled successfully and the truth is:
  // this user owns ZERO prompt packages. State it exactly — with the
  // identity that was queried — and offer the two honest intents:
  // create a package (composer intent) or re-assemble (AI command).
  if (aiAssembledCards.length === 0) {
    const uid = getStoredUserId();
    return (
      <div className="flex-1 w-full h-full flex items-center justify-center" style={{ minHeight: "calc(100vh - 120px)" }}>
        <div className="bg-white border-2 border-[#507274] rounded-2xl p-8 max-w-lg text-center">
          <h2 className="text-[#234354] text-xl font-bold mb-2">AI assembled — 0 packages</h2>
          <p className="text-gray-600 mb-1 text-sm">
            The console assembled successfully. No prompt packages exist for user
            <span className="font-mono text-xs bg-gray-100 px-1 rounded ml-1">{uid.slice(0, 8)}…{uid.slice(-4)}</span>
          </p>
          <p className="text-gray-500 mb-6 text-xs">
            If you expected packages here, you may be signed in as a different identity than the package owner.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => onCreateNew?.(`New Prompt Agent • ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`)}
              className="px-6 py-2 bg-[#234354] text-white font-semibold rounded-lg hover:bg-[#1a2f3d] transition-colors"
            >
              Create in Composer
            </button>
            <button
              onClick={requestReassembly}
              className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              Re-assemble
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ AI assembled cards successfully — the SURFACE is drawn by <a2ui-renderer>
  // The card's arm→confirm is the only confirmation; the grid is drawn by the
  // surface renderer, so this component returns nothing extra for the
  // "cards present" case.
  return null;
}
