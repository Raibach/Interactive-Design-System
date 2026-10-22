/**
 * THE PRODUCT ROOM'S ENTRY — moved out of `pages/WritingAreaIndex.tsx` (2026-10-21, owner:
 * *"writing area index is just a shell that navigates to these sections"*).
 *
 * When the Product tab is entered the ROOM decides for itself:
 *
 *   · no builder address configured → nothing to check or birth against, so it does nothing (a
 *     demo without its builder service);
 *   · otherwise it asks the engine's health and, with NO project open, hands the decision to the
 *     bridge — whose rule is the holding position (owner, 2026-10-06: *"that's what you're doing
 *     when you click on … product tab … you're creating a new project"*): a HELD project with work
 *     in it is reopened (a reload, a restored tab — *"entering is coming back, not starting over"*),
 *     anything else births a new project/package. On the demo too: the engine it births against is
 *     the hosted one, reached through the bridge like everything else.
 *
 * The shell's only part is telling the room which tab is active.
 */
import { useEffect } from 'react';
import { builderToolUrl } from '@/shared/appConfig';

export interface UseProductEntryArgs {
  headerTab: string | null | undefined;
  productRoomProjectId: string | null;
  openProductRoom: () => void | Promise<void>;
  checkBuilderEngine: () => void | Promise<void>;
}

export function useProductEntry({
  headerTab,
  productRoomProjectId,
  openProductRoom,
  checkBuilderEngine,
}: UseProductEntryArgs) {
  useEffect(() => {
    if ((headerTab || '') !== 'product') return;
    if (!builderToolUrl()) return;
    void checkBuilderEngine();
    if (!productRoomProjectId) void openProductRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTab]);
}
