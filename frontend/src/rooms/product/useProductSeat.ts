/**
 * PRODUCT SEAT — binds the product room's seat to the application's own conversation.
 *
 * The binding is the same one the room used before the migration: the bridge's room endpoint
 * returns the carrier's ids, its conversation endpoint returns the engine's thread, and the
 * thread is written onto the seat in the same call as the ids. The seat is never left holding
 * ids without the words that belong to them.
 *
 * The Product chat is the application's chat. It is not a second, independently loaded chat.
 */
import { API_BASE } from '@/shared/apiHelper';
import { assignProps } from '@/components/lit/a2ui-renderer';
import { getStoredUserId } from '@/services/authService';
import { useEffect } from 'react';
import { PRODUCT_SEAT_TABS } from '@/rooms/product/productSurface';

export interface UseProductSeatDeps {
  headerTab: any;
  productRoomProjectId: any;
  productSeatRef: any;
}

export function useProductSeat({ headerTab, productRoomProjectId, productSeatRef }: UseProductSeatDeps) {
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
          /* THE CARRIER SAID NO — the seat stands empty; nothing covers it. */
          return;
        }
        const convRes = await fetch(
          `${API_BASE}/builder/projects/${encodeURIComponent(productRoomProjectId)}/conversation`,
        );
        const conv = (await convRes.json().catch(() => null)) as
          | { ok?: boolean; messages?: Array<{ role?: string; content?: string; messageType?: string | null }> }
          | null;
        if (cancelled) return;
        /* THE ENGINE'S OWN VOCABULARY, CARRIED THROUGH: the app's chat groups by
           `messageType` — `regular`, `starting`, `building`, `finished`, `error`. */
        const messages = (conv?.messages || [])
          .filter((m) => String(m.content || '').trim())
          .map((m) => ({
            role: String(m.role || 'assistant'),
            content: String(m.content),
            messageType: m.messageType ?? null,
          }));
        const target = productSeatRef.current;
        if (!target) return;
        const unreported = assignProps(target, {
          sessionId: room.session_id,
          conversationId: room.conversation_id,
          packageTitle: String(room.label || ''),
          allowedTabs: PRODUCT_SEAT_TABS,
          /* THE ROOM'S OWN CONVERSATION — the Product tab's one row in the database, carried by
             the bridge. It is the room's own data, never a studio package list. */
          conversations: [{
            id: room.conversation_id,
            title: String(room.label || 'Conversation'),
            tab: 'chat',
          }],
          /* THE APPLICATION'S THREAD, IN THE SAME CALL AS ITS IDS. The seat's own history read
             is skipped when the thread is already here; the poller continues from the same
             conversation for anything that arrives later. */
          messages,
          instructions:
            "The Product room's chat carries the local app builder's own conversation: the person's turns are prompts to the builder, and the replies are the builder's own words.",
          graceLiveContext: false,
          tracePrompt: false,
          productTools: true,
          productRoom: true,
        });
        if (unreported.length) {
          console.warn(`[product seat] unreported bindings: ${unreported.join(', ')}`);
        }
      } catch {
        /* A FAILED CARRIER FETCH LEAVES THE SEAT INVISIBLE, NOT DEFAULTED (owner, 2026-10-06 —
           no fallbacks): with `productRoom` set and no binding landed, the seat draws NOTHING. */
      }
    })();
    return () => { cancelled = true; };
  }, [headerTab, productRoomProjectId]);
}
