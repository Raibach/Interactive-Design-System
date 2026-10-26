/**
 * THE FIGMA INGESTION PACKAGE — the Tools tab's whole process, loaded as one unit.
 *
 * Owner, 2026-10-18: *"you're gonna have to package the Figma ingestion process. You're gonna have
 * to load it separately."* So this folder is that package: the Tools seat, its assembly door, its
 * ingest path, its preview and its action surface. The room imports THIS entry, and the entry is
 * loaded on its own (a dynamic import from `design/DesignRoom.tsx`) — the Figma process is not
 * part of the room's file and is not part of `WritingAreaIndex`.
 *
 * NOTHING IN HERE IS SHARED WITH THE CONSOLE. Same Lit components, same styling, same look —
 * different engine, different conversation, different actions.
 */
export { default } from "./ToolsSeat";
export type { ToolsSeatProps } from "./ToolsSeat";
