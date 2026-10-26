/**
 * THE ASSEMBLY CALLBACK — every intent, one path — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged and the callback is returned, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { API_BASE } from '@/shared/apiHelper';
import { classifyFailure, parseValidationEnvelope } from '@/shared/error-registry';
import { envelopeRefusalError, readA2UIEnvelope } from '@/shared/a2ui-envelope';
import { getStoredUserId } from '@/services/authService';
import { logger } from '@/lib/logger';
import { applyComposerSurface, applyDecisionSurface, ROOM_SURFACES } from '@/rooms/composer/applyComposerSurface';
import { useCallback } from 'react';

/**
 * THE SURFACES THAT OWN THEIR PANE. Each of these rooms draws its own surface and never asks
 * the model for one, so a shell assembly that lands seconds after the click may not pull the
 * person back out of it (owner, 2026-10-21: *"stop the snap back"*). Measured on a cold
 * session: the boot console assembly was still in flight when the click landed on Product —
 * the tab moved, and the landing wrote `console` back over it about a second later.
 */

/** Exactly what the callback needs from the shell, by name. */
export interface UseAssembleSurfaceDeps {
  AI_STANDBY_MESSAGE: any;
  ASSEMBLY_TIMEOUT_MS: any;
  consoleAssemblyControllerRef: any;
  currentPromptSessionRef: any;
  hasUnsavedChangesRef: any;
  /** The tab as it stands NOW — a landing may not pull somebody out of a room (2026-10-21). */
  headerTabRef: any;
  isConsoleAssemblyInFlightRef: any;
  lastAssemblyIntentRef: any;
  repairAskRef: any;
  repairTitleRef: any;
  setAiAssemblyFailed: any;
  setAiAssemblyMessage: any;
  setAiAssemblyReport: any;
  setAiDecision: any;
  setConsoleTree: any;
  setCurrentPromptSession: any;
  setHeaderTab: any;
  setIsAIAssembling: any;
  setIsFailureAcknowledged: any;
  setWorkspaceTree: any;
}

export function useAssembleSurface(deps: UseAssembleSurfaceDeps) {
  const { AI_STANDBY_MESSAGE, ASSEMBLY_TIMEOUT_MS, consoleAssemblyControllerRef, currentPromptSessionRef, hasUnsavedChangesRef, headerTabRef, isConsoleAssemblyInFlightRef, lastAssemblyIntentRef, repairAskRef, repairTitleRef, setAiAssemblyFailed, setAiAssemblyMessage, setAiAssemblyReport, setAiDecision, setConsoleTree, setCurrentPromptSession, setHeaderTab, setIsAIAssembling, setIsFailureAcknowledged, setWorkspaceTree } = deps;
  return useCallback(async (intent: string, context?: {
    current_surface?: string;
    has_unsaved_changes?: boolean;
    session_id?: string | null;
    session_title?: string;
    category?: string;
    /** The repair brief — see `repairBrief`. Carried only when a repair launched this
     *  assembly, and declared here because a field the model does not declare is dropped
     *  in silence (see AISurfaceContext in backend/routes/ai.py). */
    repair_brief?: string[] | null;
  }) => {
    // ✅ DEDUP: If already in flight, skip (user spamming refresh)
    if (isConsoleAssemblyInFlightRef.current) {
      console.log('🤖 [A2UI] Request already in flight - skipping duplicate');
      return;
    }

    // ✅ ABORT: Cancel any previous request that might still be pending
    if (consoleAssemblyControllerRef.current) {
      console.log('🤖 [A2UI] Aborting previous request');
      consoleAssemblyControllerRef.current.abort();
    }

    console.log(`🤖 [A2UI] Assembling surface with intent: ${intent}`, context ? `context: ${JSON.stringify(context)}` : '');
    isConsoleAssemblyInFlightRef.current = true;
    setIsAIAssembling(true);
    setAiAssemblyFailed(false);
    setAiAssemblyReport(null);
    setIsFailureAcknowledged(false);
    // Recorded so Retry re-runs the request that actually failed rather than a guess.
    lastAssemblyIntentRef.current = intent;
    setAiAssemblyMessage(AI_STANDBY_MESSAGE);

    // Create new abort controller for this request
    const controller = new AbortController();
    consoleAssemblyControllerRef.current = controller;

    // Client-side timeout: ASSEMBLY_TIMEOUT_MS (120s, declared at the top of this file).
    //
    // This cap is the OUTER bound and it is deliberately loose: it exists to stop a
    // request that is truly dead, not to police latency. THE REAL BUDGET IS THE
    // SERVER'S — grace_gui.LLM_TIMEOUT is 20s per attempt with max_retries=1, so a
    // surface gives up at 40s worst case and returns its own 503 naming the budget that
    // expired. A client cap BELOW the server's is the failure mode this number exists
    // to avoid: it aborts a call the backend goes on to finish, and the abort reads as
    // a network failure rather than a timeout with a reason. That is what happened when
    // this was 10s against a cold call measured at ~13.5s.
    //
    // The catalog check does NOT come through here — it has its own fetch with
    // no client cap, because it can legitimately run long (measured 5.4–17.4s on
    // a 12 KB prompt). If it ever moves back onto this path, revisit this number.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Transport facts, carried to the catch as FACTS rather than re-derived from the thrown
    // message. The message is for humans; this is for the reader (shared/error-registry).
    // Declared here because the catch is the only place that classifies a failure, and by
    // then `response` is long out of scope.
    let failureTransport: { httpStatus?: number; body?: unknown; rawBody?: string } = {};

    try {
      timeoutId = setTimeout(() => controller.abort(), ASSEMBLY_TIMEOUT_MS);

      // ═══════════════════════════════════════════════════════════════════
      // SINGLE UNIFIED ENDPOINT - A2UI v0.9 COMPLIANT
      // Include context so AI knows about unsaved changes
      // ═══════════════════════════════════════════════════════════════════
      const response = await fetch(`${API_BASE}/ai/assemble-surface?limit=500`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': getStoredUserId(),
          // THE PACKAGE THIS CALL IS ABOUT (2026-10-03) — the governance ledger attributes a
          // call by HEADERS, never by reading a body (a body read in that middleware deadlocked
          // these very POSTs — measured at 12:54, a curl that never came back). The id rides the
          // context when it names one, and the intent when the intent names one.
          ...(() => {
            const fromIntent = typeof intent === 'string' && intent.includes(':') ? intent.split(':')[1].trim() : '';
            const ctx = context as { session_id?: string; conversation_id?: string } | undefined;
            const packageSession = String(ctx?.session_id || fromIntent || '');
            if (!packageSession) return {};
            const headers: Record<string, string> = { 'X-Package-Session': packageSession };
            if (ctx?.conversation_id) headers['X-Conversation-Id'] = String(ctx.conversation_id);
            return headers;
          })(),
        },
        body: JSON.stringify({ intent, context }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Read the body as TEXT first.
        //
        // The previous version called response.json() inside a bare `catch {}` and fell back
        // to the bare status string. Two consequences, both live and both verified: a
        // non-JSON error page was discarded entirely, and the §1 envelope — an OBJECT —
        // stringified to "[object Object]", so all four of its fields were lost at the last
        // meter. That is also why the "A2UI FAILURE:" branch in the catch below could never
        // match: the throw site emitted a different prefix. text() cannot fail that way.
        const rawBody = await response.text();
        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          // Not JSON. rawBody already holds the truth; parsedBody stays undefined and the
          // classifier falls back to status + raw text instead of inventing a shape.
        }
        failureTransport = {
          httpStatus: response.status,
          body: parsedBody,
          rawBody,
        };
        console.error('🔴 [A2UI] Backend error', response.status, parsedBody ?? rawBody);

        // §1 says the envelope's `message` is the human sentence — prefer it. Never let its
        // absence collapse the status into a bare number: the raw body is the fallback.
        const envelope = parseValidationEnvelope(parsedBody);
        const detailFromBody =
          typeof parsedBody === 'object' && parsedBody !== null
            ? (parsedBody as { detail?: unknown }).detail
            : undefined;
        throw new Error(
          envelope?.message
            ?? (typeof detailFromBody === 'string' ? detailFromBody : undefined)
            ?? (rawBody.trim() || `${response.status} ${response.statusText}`),
        );
      }

      const rawData = await response.json();

      // ═══════════════════════════════════════════════════════════════════
      // A2UI v0.9.1 ENVELOPE BOUNDARY — version and surface are read, not assumed.
      //
      // Every operation is labeled with the format version it is written in and
      // the surface it belongs to. Both labels used to be ignored: the operations
      // were piled together, the last updateComponents and the last
      // updateDataModel won, and *which surface was on screen* was guessed from
      // the shape of the data model. So a v1.0 answer drew silently as v0.9.1,
      // and an answer carrying two surfaces became one pile holding parts of
      // each. readA2UIEnvelope() reads both labels and REFUSES rather than
      // guessing — see src/shared/a2ui-envelope.ts for the wire shape.
      // ═══════════════════════════════════════════════════════════════════
      const read = readA2UIEnvelope(rawData);
      // `read.ok === false`, not `!read.ok`: this project compiles with
      // strictNullChecks off, where truthiness does not narrow a union — only
      // equality against the literal does.
      if (read.ok === false) {
        const { code, message, detail } = read.refusal;
        console.error(
          `🤖 [A2UI] ENVELOPE REFUSED — ${code}\n` +
          `  ${message}\n` +
          `  detail: ${JSON.stringify(detail)}\n` +
          `  CAUSE: ${
            code === 'UNSUPPORTED-VERSION'
              ? 'the answer is written in a format version this shell does not implement'
              : 'the answer describes surfaces this shell cannot hold at once'
          }.\n` +
          `  Refusing beats guessing: parsing it anyway draws an empty or wrong\n` +
          `  surface, and says nothing about why.`,
        );
        // Thrown into the assembly failure path on purpose: the surface is
        // cleared, the assembly is marked failed, and the reason is NAMED and
        // shown. A refusal nobody sees is the same defect as the silent
        // mis-reading it replaces.
        throw envelopeRefusalError(read.refusal);
      }

      const reading = read.reading;
      const assembledComponents = reading.components as any[];
      // The page reads a few well-known keys off the model (cards, usage,
      // session) — the same keys the server puts there. The renderer is handed
      // the model as it is; it walks paths, it does not read this shape.
      const dataModel = reading.dataModel as Record<string, any>;
      // ── WHAT THE ASSEMBLY COULD NOT READ, INTO THE TRACE ───────────────────
      // The backend collects every failure it survived into the model's `warnings`
      // (routes/ai.py `_warn`); the trace is where those are looked at (lib/trace-source
      // subscribes to this logger). A degraded assembly says so instead of looking clean.
      if (Array.isArray(dataModel.warnings)) {
        for (const warning of dataModel.warnings) {
          logger.warn(`[assembly] ${String(warning)}`, { surfaceId: reading.surfaceId ?? null });
        }
      }
      for (const note of reading.notes) console.warn(`🤖 [A2UI] ${note}`);
      console.log(
        `🤖 [A2UI] Envelope surface: "${reading.surfaceId ?? '(unnamed)'}"` +
        `${reading.catalogId ? ` · catalog ${reading.catalogId}` : ''}`,
      );
      console.log(`🤖 [A2UI] Model-supplied components:`, assembledComponents.map((c: any) => c?.component || c?.id));
      console.log(`🤖 [A2UI] Data model received:`, Object.keys(dataModel));

      // Hand both channels to the surface renderer as props.
      //
      // WHICH RENDERER IS DECIDED BELOW, by the same inference the view uses — a
      // tree goes to the slot it was assembled for and nowhere else. The
      // assignment cannot happen here: `surface` is not known until the model has
      // been read, and assigning first is what put the composer's columns on the
      // console (measured 2026-09-17) and dropped the cards from the screen.
      //
      // The component list is passed even when empty: an empty list is Grace
      // saying "no surface", and the renderer draws nothing for it. Keeping the
      // previous tree on screen instead would make a deliberately cleared surface
      // look stuck — indistinguishable from a renderer that had stopped
      // listening, which is the exact failure this wiring exists to make visible.

      // A2UI v0.9.1: the surface LABEL is the spec's `surfaceId`, and it is read by
      // the envelope boundary above (readA2UIEnvelope) — it names which surface these
      // operations belong to. It is not the same question as WHICH VIEW to show:
      // the server mounts the console, the composer and the decision dialog all on
      // the one surface `main`, so the view is still inferred from the data model
      // itself — decision payload → decision dialog, cards → console grid, session
      // payload → composer. Two questions, two answers; this used to be one guess.
      const surface = dataModel.decision_type
        ? 'decision'
        : Array.isArray(dataModel.cards)
          ? 'console'
          : dataModel.session
            ? 'composer'
            : 'console';
      console.log(`🤖 [A2UI] Surface inferred from data model: ${surface}`);

      // The tree now goes to the slot it belongs to. A decision payload is drawn
      // on the composer's side — it is the composer's own question, asked in the
      // composer's column — so anything that is not the console goes to the
      // workspace tree.
      if (surface === 'console') {
        setConsoleTree({ components: assembledComponents, dataModel });
      } else {
        // THE MIDDLE PANE IS A RUN'S PANE — the canvas takes it, and until then a
        // package opens as two columns: the prompt, and Grace. The model's assembly
        // sometimes returns a middle child (the compiled-output viewer); rendering
        // it puts an extra panel on screen at open, holding old run output, when the
        // results already live in Grace's chat. Strip the middle slot on arrival;
        // a Run assembles its own column and takes the pane then, and the viewer
        // component stays in the list so "back to output" can find it by role.
        setWorkspaceTree({
          components: assembledComponents.map((c: any) => {
            if (
              (c?.component === 'workspace-layout' || c?.component === 'composer-workspace') &&
              c.children &&
              typeof c.children === 'object' &&
              !Array.isArray(c.children)
            ) {
              const { middle: _middle, ...rest } = c.children as Record<string, unknown>;
              return { ...c, children: rest };
            }
            return c;
          }),
          dataModel,
        });
      }

      const assemblyTime = dataModel.assembly_time_ms || 0;
      const aiMessage = dataModel.ai_message || '';

      // ── SHE SPEAKS WHEN SHE WAS ASKED, AND IS SILENT WHEN SHE WAS NOT ────────
      // The history here is worth keeping: this was suppressed entirely ("an assembly
      // is not a turn in the conversation — nobody asked"), then re-enabled for every
      // assembly, and the owner's verdict on that is the second one: opening a package,
      // switching a tab or loading the console is not a question, and a column that
      // greets you on every one of them reads as a machine talking to itself.
      //
      // The one assembly that IS an ask is a repair: the brief rides the assembly and
      // comes back as her sentence, which is how a repair tells the person what is open.
      // So that is the condition — a repair brief, not "the model produced a message".
      if (aiMessage.trim() && (context?.repair_brief?.length ?? 0) > 0) {
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: { role: 'assistant', content: aiMessage.trim() },
        }));
      }
      // The measured cost of this action, straight from the provider's usage
      // report — the readout in Grace's seat shows this and nothing else.
      if (dataModel.usage && typeof dataModel.usage.total_tokens === 'number') {
        // The spend belongs to the surface it came from, so it carries that
        // surface's session id. Without it, every listener in every open
        // conversation pulls the same number — the contract scopes a chat panel
        // to its own conversationId (catalog.json -> ChatPanel).
        window.dispatchEvent(new CustomEvent('a2ui:usage', {
          detail: { ...dataModel.usage, sessionId: dataModel.session_id || currentPromptSessionRef.current || null },
        }));
      }
      console.log(`🤖 [A2UI] Surface assembled in ${assemblyTime}ms`);
      console.log(`🤖 [A2UI] Grace says: ${aiMessage}`);

      // ═══════════════════════════════════════════════════════════════════
      // Process based on surface type
      // ═══════════════════════════════════════════════════════════════════
      if (surface === 'console') {
        const cards = dataModel.cards || [];
        if (!Array.isArray(cards)) {
          throw new Error("AI did not return valid cards - surface cannot render without AI");
        }
        // No setState here. These cards ARE `dataModel.cards`, and the data model was
        // handed to the renderer two lines up — the console's one authority. A React
        // copy kept in step beside them is what let the drawn console and the console
        // this file believed in differ in the first place.
        if (!ROOM_SURFACES.has(headerTabRef?.current || '')) setHeaderTab('console');
        console.log(`✅ [A2UI] Console assembled with ${cards.length} cards`);

      } else if (surface === 'composer') {
        applyComposerSurface({ dataModel, setCurrentPromptSession, hasUnsavedChangesRef, repairTitleRef, headerTabRef, setHeaderTab, repairAskRef });
      } else if (surface === 'decision') {
        applyDecisionSurface({ dataModel, setAiDecision });
      }

      setAiAssemblyFailed(false);
      setAiAssemblyReport(null);

    } catch (error) {
      clearTimeout(timeoutId);
      setIsAIAssembling(false);

      // ── THE FALLBACK: the brief had nowhere to land ──────────────────────────
      // The assembly failed, so there is no greeting to carry the ask. Post the app's
      // own sentence after all — as the FALLBACK, not as the design. It exists because
      // a repair whose assembly gives up must still tell the person what is open; the
      // alternative is a form with no explanation and no way in, which is the state
      // this whole path replaced.
      //
      // Skipped when this request was SUPERSEDED rather than failed — a newer assembly is
      // already on its way and the brief will ride that one — so it is guarded on the
      // controller for the same reason the timeout branch below is.
      if (repairAskRef.current && consoleAssemblyControllerRef.current === controller) {
        const unspoken = repairAskRef.current;
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: {
            role: 'assistant',
            content: [unspoken.text, unspoken.buttons].filter(Boolean).join('\n\n'),
          },
        }));
        repairAskRef.current = null;
        console.log('[repair] the assembly did not land — the app-authored ask stands in as the fallback');
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      const isAbort = error instanceof Error && (
        error.name === 'AbortError' ||
        errMsg.toLowerCase().includes('aborted') ||
        errMsg.toLowerCase().includes('signal')
      );
      if (isAbort) {
        if (consoleAssemblyControllerRef.current === controller) {
          // This request itself timed out — see ASSEMBLY_TIMEOUT_MS.
          console.error(
            `[A2UI] ASSEMBLY TIMED OUT\n` +
            `  intent: ${intent}\n` +
            `  timeout: ${ASSEMBLY_TIMEOUT_MS}ms\n` +
            `  error.name: ${error instanceof Error ? error.name : 'N/A'}\n` +
            `  error.message: ${errMsg}\n` +
            `  timestamp: ${new Date().toISOString()}\n` +
            `  CAUSE: Backend did not respond within ${ASSEMBLY_TIMEOUT_MS / 1000}s. Typical causes: a cold model call slower than usual, backend down, or network failure.\n` +
            `  FIX: Check backend logs for the request matching this timestamp. Look for "A2UI FAILURE" or PERF TRACE lines.`
          );
          // Classified, not hand-written. The client cap fired — but classifyFailure reads the
          // actual thrown error and the transport facts, so a real 503 that raced the cap is
          // reported as a 503 rather than being re-labelled a timeout by proximity.
          const report = classifyFailure(error, { intent, ...failureTransport });
          setAiAssemblyReport(report);
          setAiAssemblyMessage(report.headline);
          setIsFailureAcknowledged(false);
          setAiAssemblyFailed(true);
          setCurrentPromptSession(null);
          // The surface goes with them. <a2ui-renderer> holds its last tree until it
          // is handed a new one, so a failure that left the previous components in
          // state would draw a stale console beside the error — the one thing that
          // looks like a renderer that stopped listening. No envelope, no surface.
          // The console's cards are READ from this model, so clearing it is also what
          // clears them: there is no second list left holding the failed assembly.
          // Cleared for the surface that FAILED, not for both: the other slot's
          // tree is not stale — it is simply not what this request was for.
          if (intent === 'render-console') setConsoleTree({ components: [], dataModel: {} });
          else setWorkspaceTree({ components: [], dataModel: {} });
        } else {
          // Previous request was aborted because a newer user action (tab click, etc.) superseded it
          console.log('[A2UI] Previous assembly superseded by newer request (normal)');
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[A2UI] ASSEMBLY FAILED\n` +
          `  intent: ${intent}\n` +
          `  error.type: ${error instanceof Error ? error.constructor.name : typeof error}\n` +
          `  error.name: ${error instanceof Error ? error.name : 'N/A'}\n` +
          `  error.message: ${errorMessage}\n` +
          `  error.stack: ${error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 5).join('\n    ') : 'N/A'}\n` +
          `  timestamp: ${new Date().toISOString()}\n` +
          `  state: aiAssemblyFailed=true, currentPromptSession=null, the failed surface's tree cleared (cards go with it)`
        );
        // The branch that used to live here tested `errorMessage.startsWith('A2UI FAILURE:')`
        // against a message the throw site prefixed differently ("A2UI Assembly Failed: "), so
        // it could never match and the structured payload was never shown directly. The
        // classifier replaces it: the §1 envelope travels in `failureTransport` as an OBJECT,
        // so its code / surfaceId / path / message survive instead of becoming "[object Object]".
        const report = classifyFailure(error, { intent, ...failureTransport });
        setAiAssemblyReport(report);
        setAiAssemblyMessage(report.headline);
        setIsFailureAcknowledged(false);
        setAiAssemblyFailed(true);
        setCurrentPromptSession(null);
        // Same reason as the timeout branch above: the renderer paints its last
        // tree until it is handed another, and a stale surface beside a failure
        // reads as a live one. Cleared, so the error is the only thing on screen —
        // and with the model cleared there are no cards left to disagree with it.
        if (intent === 'render-console') setConsoleTree({ components: [], dataModel: {} });
        else setWorkspaceTree({ components: [], dataModel: {} });
      }
    } finally {
      isConsoleAssemblyInFlightRef.current = false;
      consoleAssemblyControllerRef.current = null;
      setIsAIAssembling(false);
    }
  }, [setHeaderTab]);
}
