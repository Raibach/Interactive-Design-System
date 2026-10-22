/**
 * PRODUCT ROOM TYPES — shared between the shell and the room's own hooks.
 *
 * `DraftPayloadShape` was declared inside the shell component; it moved here when the draft effect
 * became `useProductDraft`, so both files name the same shape without importing each other.
 */
export type DraftPayloadShape = {
  label?: string;
  nodes: Array<Record<string, unknown>>;
  positions?: Record<string, { x: number; y: number }>;
};
