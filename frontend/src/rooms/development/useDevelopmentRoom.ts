/**
 * THE DEVELOPMENT ROOM'S BEHAVIOUR — moved out of `pages/WritingAreaIndex.tsx`
 * (2026-10-21), the Product room's architecture applied to this one.
 *
 * Two statements live here, both unchanged in substance from the page:
 *   1. the container loads CLOSED and the rail's list is the room's own;
 *   2. the room's seat binds the room's OWN package (its own conversation), never another
 *      room's.
 *
 * THE MOUNT IS THE CONDITION (2026-10-24): <DevelopmentBox> mounts this room only while
 * Development is selected, so neither statement waits on a tab any more. A check left behind
 * would make the room's own first paint skip.
 */
import { useEffect, useLayoutEffect } from 'react';
import { assignProps } from '@/components/lit/a2ui-renderer';
import { API_BASE } from '@/shared/apiHelper';
import { getStoredUserId } from '@/services/authService';

/**
 * THE ROOM'S OWN RAIL LIST (owner, 2026-10-05): *"Remove versions from the chat rail menu
 * on the right column … development section."* The rail's rule for an EMPTY list is "show
 * everything" — and this seat starts empty, so Versions was drawn by default, by nobody's
 * decision. This is every drawable tab of the rail (chat-navigation-bar's own vocabulary;
 * the nav bar decides the order, this list only decides membership) with Versions left
 * out: the rail the room had, one button shorter. It lands twice — as the seat's first
 * fill (the closed-on-entry layout effect) and as the rule over the package's bound list
 * (the seat effect; an empty bound list is the rail's "everything", which through this
 * room's rule is THIS list, never the full rail with Versions back on).
 */
/**
 * THIS ROOM'S RAIL, AND ONLY THE TABS IT USES (owner, 2026-10-26: *"Remove these from
 * development"* — Trace, Tools, States and Repairs). The seat still knows those ids; this room no
 * longer offers them.
 */
export const DEVELOPMENT_SEAT_TABS = 'chat,approvals,eval,settings';

export interface UseDevelopmentRoomDeps {
  developmentLayoutRef: { current: any };
  developmentSeatRef: { current: any };
}

export function useDevelopmentRoom({ developmentLayoutRef, developmentSeatRef }: UseDevelopmentRoomDeps) {
  /**
   * THE DEVELOPMENT ROOM'S CONTAINER LOADS CLOSED — the Product pair's mirror (owner,
   * 2026-10-05), one room over and for the same reasons, stated once in Product: `isThirdOpen`
   * is set as a PROPERTY through the ref (never a JSX attribute — Lit's boolean converter
   * reads any present attribute, "false" included, as true), nothing is written on the panel,
   * and `useLayoutEffect` so the first paint is already the closed column. The same first
   * paint settles the rail's list (DEVELOPMENT_SEAT_TABS).
   */
  useLayoutEffect(() => {
    const el = developmentLayoutRef.current;
    if (el) el.isThirdOpen = false;
    /* The rail's opening state (see DEVELOPMENT_SEAT_TABS): written only while the seat
       carries no list — an empty list is the rail's "everything", and the seat effect below
       never leaves it empty once the room's package is bound, so this fills the room's
       own answer, never overrides a loaded one. */
    const seat = developmentSeatRef.current;
    if (seat && !seat.allowedTabs) seat.allowedTabs = DEVELOPMENT_SEAT_TABS;
  }, [developmentLayoutRef, developmentSeatRef]);

  /**
   * THE DEVELOPMENT ROOM HAS ITS OWN CHAT NOW — ITS OWN PACKAGE, ITS OWN CONVERSATIONS
   * (owner, 2026-10-06: *"developers are going to have a package, they're gonna have chats
   * related to the conversation ID … development processes that are [not] shared … only for
   * development."* — after watching the room borrow another room's seat: *"It doesn't seem
   * to own its own chat. It seems to be borrowing a chat from product … un-bind those."*).
   *
   * The bridge ensures the room's OWN package (a `prompt_sessions` row marked `dev_room`,
   * hidden from the console's cards) with its own conversation, and the seat binds THAT —
   * the same per-room isolation Product keeps. The rail is the room's own list
   * (DEVELOPMENT_SEAT_TABS, Versions never offered). Where a development turn should GO
   * once sent (the platform assistant today, exactly as in the Composer; the tool's own
   * agent someday) is the owner's call — not guessed here.
   */
  useEffect(() => {
    const seat = developmentSeatRef.current;
    if (!seat) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/builder/development/room`, {
          method: 'POST',
          headers: { 'X-User-ID': getStoredUserId() },
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; session_id?: string; conversation_id?: string; label?: string }
          | null;
        if (cancelled) return;
        if (!body?.ok || !body.session_id || !body.conversation_id) {
          /* THE ROOM SAID NO — the seat stands as it is; nothing covers it either way. */
          return;
        }
        const unreported = assignProps(seat, {
          sessionId: body.session_id,
          conversationId: body.conversation_id,
          packageTitle: String(body.label || 'Development'),
          allowedTabs: DEVELOPMENT_SEAT_TABS,
          // THE ROOM'S REQUIRED SCRIPT — PLUMBING, NOT A VOICE (the product room's rule, one
          // room over). The seat refuses a room that binds no words; these words are the
          // room's facts. What ANSWERS a development turn today is the platform's own
          // assistant, exactly as in the Composer — stated so, not dressed up.
          instructions:
            'The Development room carries the development team\'s own conversations. Answer briefly and about the work in front of the person.',
          // The seat's third state — omitted is REFUSED, not defaulted (see chat-panel's
          // `_gracePrompt`). False: this room binds no workspace seats for her to read.
          graceLiveContext: false,
          // A tab click is not a turn (the product room's measurement, one room over).
          tracePrompt: false,
        });
        if (unreported.length) {
          console.warn(`[development seat] unreported bindings: ${unreported.join(', ')}`);
        }
      } catch {
        /* a failed room fetch leaves the seat as it stands — the next entry tries again. */
      }
    })();
    return () => { cancelled = true; };
  }, [developmentSeatRef]);
}
