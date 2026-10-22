/**
 * PRODUCT CONVERSATION POLL — the product room's 2.5s poller: engine conversation -> seat thread, run status, and the unsaved-work ref. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged; every name it closes over arrives through `deps`, so the
 * behaviour is the page's own. The dependency list is the contract: a new name in the effect is a
 * compile error here until it is declared in the interface below.
 */
import { API_BASE } from '@/shared/apiHelper';
import { useEffect } from 'react';

/** Exactly what the block needs from the shell, by name. */
export interface UseProductConversationPollDeps {
  hasUnsavedChangesRef: any;
  headerTab: any;
  productRoomProjectId: any;
  productSeatRef: any;
}

export function useProductConversationPoll(deps: UseProductConversationPollDeps) {
  const { hasUnsavedChangesRef, headerTab, productRoomProjectId, productSeatRef } = deps;
  useEffect(() => {
    if ((headerTab || '') !== 'product') return;
    if (!productRoomProjectId) return;
    let cancelled = false;
    let seen = -1; // baseline on the first successful read
    /*
     * THE POLLER RIDES ITS OWN CHANNEL (owner, 2026-10-06 — the live run must show exactly
     * like the app's; ROOT CAUSE FOUND AND MEASURED LIVE). The seat's send holds
     * `/api/teacher/query` open for the WHOLE build (the bridge waits the run out), and on
     * the dev origin a second request QUEUES BEHIND it: measured tonight, a probe fetch
     * waited 4.1 SECONDS behind a 4-second run, while the ticks should have come every 2.5.
     * So the poller never read `init` during a seat-run, the building row never armed, and
     * the whole thread landed at once on completion (the owner's exact report: "it's
     * thinking … then 2 build steps / Finished in 47s. / Completed"). On the local stack the
     * polls therefore ask the backend DIRECTLY — CORS already allows http://localhost:5001
     * (backend/main.py) — while every other door keeps the proxy; on a deployed origin the
     * relative path IS the single origin. Same values, unqueued. PRODUCT-ONLY: this poller
     * is the product room's alone.
     *
     * AND THE SWITCH IS THE PAGE'S LOCATION, NOT THE DEMO FLAG (2026-10-06, late — found
     * live on production: the deployed page was polling http://localhost:8000 — the
     * VISITOR'S machine — "Access to fetch at 'http://localhost:8000/…' … blocked by CORS
     * policy" every 2.5s in the console, and Chrome's "wants to access other apps and
     * services on this device" box on the owner's screen). The old branch read "demo →
     * relative, otherwise → the Mac" — true while the only states were the deployed demo
     * and a local run; the moment the demo flag went off, production fell to the local
     * branch. NO DEPLOYED PAGE MAY EVER PHONE A VISITOR'S MACHINE: a loopback-host page
     * asks the backend directly (the queue reason above); every deployed origin keeps the
     * relative path.
     */
    const POLL_BASE = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
      ? 'http://localhost:8000/api'
      : API_BASE;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(
            `${POLL_BASE}/builder/projects/${encodeURIComponent(productRoomProjectId)}/conversation`,
          );
          const body = (await res.json().catch(() => null)) as
            | { ok?: boolean; messages?: Array<{ role?: string; content?: string }> }
            | null;
          if (cancelled || !body?.ok) return;
          // THE RUN'S OWN FACTS RIDE EACH POLL (2026-10-06, the app-design port): the
          // engine's status + start clock become the seat's `productRunning` /
          // `productRunStartedAt` — the thread's building row and its estimate ladder read
          // them exactly as the app's RunProgress reads the same fields from its engine.
          const pollSeat = productSeatRef.current;
          if (pollSeat) {
            const status = String((body as { status?: string }).status || 'idle');
            const started = (body as { runStartedAt?: string }).runStartedAt;
            // THE ENGINE'S OWN ESTIMATE RIDES EACH POLL TOO (2026-10-06, the app-design port):
            // the app's RunProgress fills against `agent/status.expectedMinutes` when the
            // engine sent one, and climbs its ladder when it did not — same field, same rule.
            const expected = (body as { expectedMinutes?: number }).expectedMinutes;
            pollSeat.productRunning = status === 'init';
            pollSeat.productRunStartedAt = started ? (Date.parse(started) || 0) : 0;
            pollSeat.productExpectedMinutes =
              typeof expected === 'number' && expected > 0 ? expected : 0;
          }
          const msgs = (body.messages || []).filter((m) => String(m.content || '').trim());
          // ENTRY CANNOT LEAVE AN EMPTY SEAT (2026-10-06, measured live): the room binds the
          // thread once at entry, and ONE failed read there left the chat empty for the whole
          // visit — the seat held nothing while the engine held the whole record (the owner's
          // "the product tab is not loading the seat"). So the poller heals it: if the first
          // successful read finds the seat's bound thread EMPTY while the engine has messages,
          // the entire history is delivered now — the person's prompts included, because the
          // seat has no local copy of history to echo. After that it is the normal feed.
          const seatEmpty =
            pollSeat !== null &&
            (pollSeat.messages?.length ?? 0) === 0 &&
            (((pollSeat as unknown as { _thread?: unknown[] })._thread?.length) ?? 0) === 0;
          const healTick = seen < 0 && seatEmpty && msgs.length > 0;
          if (seen < 0) {
            seen = healTick ? 0 : msgs.length;
            if (!healTick) return;
          }
          // DID THIS TICK BRING A NEW PERSON'S TURN? — the delta since the last read (on the
          // heal tick, the whole history). That is the product's "content changed": the moment
          // the exit gate's same ref must be consulted (below).
          const newUserTurn = msgs.slice(seen).some((m) => String(m.role || '') === 'user');
          // EVERY NEW AGENT MESSAGE RIDES IN WITH ITS OWN TYPE (2026-10-06, the app-design
          // port): the thread groups by `messageType`, so the poller no longer hand-picks
          // two transient lines — it hands the seat exactly what the engine wrote, in order.
          // The person's own prompts are skipped: the seat echoes those the moment they are
          // sent (a 2.5s-late echo of your own sentence is not the app's behavior).
          for (let i = seen; i < msgs.length; i++) {
            const m = msgs[i] as { role?: string; content?: string; messageType?: string | null };
            if (String(m.role || 'assistant') === 'user' && !healTick) continue;
            window.dispatchEvent(
              new CustomEvent('a2ui:system-message', {
                detail: {
                  // On a heal tick the REAL role rides (history includes the person's own
                  // prompts); in the live feed users are skipped — the seat echoed them.
                  role: healTick && String(m.role) === 'user' ? 'user' : 'assistant',
                  content: String(m.content || ''),
                  messageType: m.messageType ?? null,
                },
              }),
            );
          }
          if (msgs.length > seen) seen = msgs.length;
          // THE GATE'S SAME REF, RAISED FROM THE ENGINE'S OWN FACTS — the Composer's rule (see
          // the beforeunload effect): a spoken turn is unsaved work until the project resolves
          // (save-as-draft / publish / discard; `guardProductExit` clears the same ref on every
          // resolution). The guard's own endpoint answers whether anything is at risk — a
          // published project has nothing left to lose — and it is asked ONLY on ticks that
          // brought a new person's turn, so quiet ticks make no requests.
          if (newUserTurn) {
            void (async () => {
              try {
                const st = await fetch(
                  `${POLL_BASE}/builder/state?project_id=${encodeURIComponent(productRoomProjectId)}`,
                );
                const s = (await st.json().catch(() => null)) as
                  | { ok?: boolean; published?: boolean; has_work?: boolean }
                  | null;
                if (s?.ok && !s.published && s.has_work) hasUnsavedChangesRef.current = true;
              } catch { /* unreadable → the exit guard asks again on the way out */ }
            })();
          }
        } catch {
          /* engine down or a transient read — the next tick tries again */
        }
      })();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [headerTab, productRoomProjectId]);
}
