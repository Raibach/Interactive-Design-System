/**
 * PRODUCT SEAT — binds the product room's seat: the rail's tabs, the pane width, the settled hand, and the gate's second hand. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged; every name it closes over arrives through `deps`, so the
 * behaviour is the page's own. The dependency list is the contract: a new name in the effect is a
 * compile error here until it is declared in the interface below.
 */
import { API_BASE } from '@/shared/apiHelper';
import { assignProps } from '@/components/lit/a2ui-renderer';
import { getStoredUserId } from '@/services/authService';
import { useEffect } from 'react';

/** Exactly what the block needs from the shell, by name. */
export interface UseProductSeatDeps {
  PRODUCT_SEAT_TABS: any;
  assertPaneWidth: any;
  dropProductGateWhenAllLanded: any;
  headerTab: any;
  productLayoutRef: any;
  productRoomProjectId: any;
  productSeatRef: any;
  productSeatSettledRef: any;
}

export function useProductSeat(deps: UseProductSeatDeps) {
  const { PRODUCT_SEAT_TABS, assertPaneWidth, dropProductGateWhenAllLanded, headerTab, productLayoutRef, productRoomProjectId, productSeatRef, productSeatSettledRef } = deps;
  useEffect(() => {
    if ((headerTab || '') !== 'product') return;
    const seat = productSeatRef.current;
    if (!seat || !productRoomProjectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const roomRes = await fetch(
          `${API_BASE}/builder/projects/${encodeURIComponent(productRoomProjectId)}/room`,
          { method: 'POST', headers: { 'X-User-ID': getStoredUserId() } },
        );
        const room = (await roomRes.json().catch(() => null)) as
          | { ok?: boolean; session_id?: string; conversation_id?: string; label?: string }
          | null;
        if (!room?.ok || !room.session_id || !room.conversation_id) {
          /* THE CARRIER SAID NO — SETTLED, so the cover can lift onto the honest blank seat
             (see the seat-settled note at the refs). */
          if (!cancelled) {
            productSeatSettledRef.current = true;
            dropProductGateWhenAllLanded();
          }
          return;
        }
        const convRes = await fetch(
          `${API_BASE}/builder/projects/${encodeURIComponent(productRoomProjectId)}/conversation`,
        );
        const conv = (await convRes.json().catch(() => null)) as
          | { ok?: boolean; messages?: Array<{ role?: string; content?: string }> }
          | null;
        if (cancelled) return;
        // THE ENGINE'S OWN VOCABULARY, CARRIED THROUGH (2026-10-06): the app's chat design
        // groups BY `messageType` — `regular` (the person's prompt), `starting` / `building`
        // (a run's steps), `finished` (the completed card with its ✓), `error` (stops and
        // failures). The transient filter that used to live here is GONE with the port: the
        // steps ARE the design now — "Starting a new run…", "Writing the app…", the
        // builder's spoken lines — exactly as the app's own thread draws them.
        const thread = (conv?.messages || [])
          .filter((m) => String(m.content || '').trim())
          .map((m) => ({
            role: String(m.role || 'assistant'),
            content: String(m.content),
            messageType: (m as { messageType?: string | null }).messageType ?? null,
          }));
        // NO VOICE BUT THE BUILDER'S (owner, 2026-10-06: *"take out grace … She is not
        // supposed to be involved in this conversation. It's a conversation with the
        // product team and their design and I want to use app builder not grace"*). The
        // earlier greeting — a welcome drawn over a blank thread — is gone. While the
        // thread is empty the seat's thread draws the APP'S OWN empty state ("What do you
        // want to build?" / "Describe your idea below", see `chat-product-thread`), and
        // every word in this conversation afterwards is the engine's own.
        const messages = thread;
        const unreported = assignProps(seat, {
          sessionId: room.session_id,
          conversationId: room.conversation_id,
          packageTitle: String(room.label || ''),
          allowedTabs: PRODUCT_SEAT_TABS,
          messages,
          // THE SEAT'S REQUIRED SCRIPT — PLUMBING, NOT A VOICE. Owner, 2026-10-06: "we're
          // not taking Grace's behavior in the chat. We're using the application's behavior
          // in the chat" — "just a styling treatment to the existing capabilities." The seat
          // refuses sends into a room that binds no `instructions` (chat-panel's
          // `_gracePrompt`), so the room must state something; on the builder path this text
          // never reaches any model — the seam runs the engine on the person's own words and
          // answers with the builder's. It is written as the room's facts, not as a script
          // for her to speak.
          instructions:
            'The Product room\'s chat carries the local app builder\'s own conversation: the person\'s turns are prompts to the builder, and the replies are the builder\'s own words.',
          // AND THE ROOM STATES WHERE HER LIVE FACTS COME FROM. The seat's third state:
          // `undefined` is refused outright ("a surface that omits it is refused by the seat
          // rather than defaulted" — the catalogs say it, `_gracePrompt` enforces it). FALSE
          // is the product room's truth: the room's script carries what she needs, and this
          // room binds no workspace seats for `_buildWorkspaceContext()` to read — TRUE would
          // append an empty block. The live facts here are the engine's (the project and its
          // conversation), which arrive as the bound thread above, not through her workspace.
          graceLiveContext: false,
          // A TAB CLICK IS NOT A TURN — PRODUCT-ROOM BINDING ONLY. Owner, 2026-10-06: "this
          // chat is not universal. It belongs to product only." The seat's default is
          // `tracePrompt: true`, so a Trace-tab click sends its trace script as a turn —
          // measured live today: the click filed a turn and, on a dead carrier, Grace
          // answered in the room. False: tabs switch views and nothing more; only the
          // person's own words are prompts. Stated HERE, in the room's own binding, so every
          // other seat keeps its behavior untouched.
          tracePrompt: false,
          // THE PRODUCT FOOT IS THE APPLICATION'S OWN TOOLS (owner, 2026-10-06: *"all of
          // these stubs go. And you're gonna put the products wiring down"*): the seat swaps
          // its v.4b tray for the app's own attach · Figma · GitHub · visual-edit row —
          // wired by the effect below into the product's real doors (the engine's upload
          // endpoint, the embedded builder's own modals and visual editor). Product-room
          // binding only: every other seat keeps the tray.
          productTools: true,
        });
        if (unreported.length) {
          console.warn(`[product seat] unreported bindings: ${unreported.join(', ')}`);
        }
        /* THE SEAT IS UP — the third hand lands, and the pane's width is asserted once more
           from a beat where the room is certainly measurable (see `assertPaneWidth`). */
        productSeatSettledRef.current = true;
        assertPaneWidth(productLayoutRef.current);
        dropProductGateWhenAllLanded();
      } catch {
        /* A FAILED CARRIER FETCH LEAVES THE SEAT INVISIBLE, NOT DEFAULTED (owner, 2026-10-06 —
           no fallbacks): with `productRoom` set and no binding landed, the seat draws NOTHING —
           the v.4b face never returns — and the next entry tries again. Settled all the same:
           a cover must not go on standing over a chat that will never arrive. */
        if (!cancelled) {
          productSeatSettledRef.current = true;
          dropProductGateWhenAllLanded();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [headerTab, productRoomProjectId]);
}
