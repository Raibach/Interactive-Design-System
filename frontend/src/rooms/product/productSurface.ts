/**
 * THE PRODUCT SURFACE — the room's identity and the Console card's door.
 *
 * The seat's data does not live here. Its conversation ids and its thread are written
 * directly from the bridge's room and conversation endpoints (see `useProductSeat`), the
 * same binding the room used before the migration. A second model between that data and the
 * seat only gave the room two places to look for the same conversation.
 */
export const PRODUCT_SURFACE_ID = 'product-room';
/**
 * THE PRODUCT ROOM'S RAIL, AND ONLY THE TABS IT USES (owner, 2026-10-26: *"remove these icons from
 * Product Tab chat"* — Evals, Trace and Tools). The seat still knows those ids; this room no longer
 * offers them, so its rail carries Chat, Approvals and Settings.
 */
export const PRODUCT_SEAT_TABS = 'chat,approvals,settings';

/** The Console card's protocol action that opens this room on a project. */
export interface ProductOpenAction {
  version: 'v0.9';
  action: {
    name: 'open_room';
    surfaceId: 'console';
    sourceComponentId: string;
    context: { room: 'product'; project_id: string | null };
  };
}
