/**
 * DesignRoom — THE DESIGN TAB'S OWN FILE: ONE INTERFACE, AND THE ENGINES THAT FEED IT.
 *
 * Owner, 2026-10-18: *"It's a navigation that runs down the middle of the page… that navigation
 * carries each tab's chat content — not a different chat, just what's loaded inside of it."* And:
 * *"column content is an injection point. It's an insert… you can't move to a whole new page."*
 *
 * SO THERE IS ONE INTERFACE (`DesignInterface`): the rail and the chat, assembled once and kept.
 * The console engine's surface is its host. The Figma engine is HEADLESS — it assembles its own
 * content and its own actions, and injects its left column and its conversation into that same
 * interface. Nothing here swaps a surface for another surface.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import DesignSeatShell from "@/rooms/design/DesignSeatShell";
/* THE TOOLS RAIL BELONGS TO THIS ROOM (2026-10-21). It used to be imported by the global
   registry, which rides the boot chunk — so `tools-tab` + `figma-layers-view` (55 kB, 1.08 s
   through the tunnel) were fetched before the console could paint, for a panel that only exists
   after this room opens. The registry no longer imports it; this room does. */
import "@/tools/ToolsTab";
/* THE DESIGN ROOM'S OWN FRAME (owner, 2026-10-25): the three-column layout as this room's own
   file, retagged `design-workspace`, so a change made for Design cannot reach another room's
   frame and another room's frame cannot reach Design's. */
import "@/rooms/design/design-workspace";
// THE TOOLS TAB'S OWN CONTAINER (owner, 2026-10-25): the chat's layout, for Tools only.
import "@/rooms/design/tools/tools-workspace";
// THE COLUMN FOOTER — the Composer bar's plate, empty (owner, 2026-10-25).
import "@/rooms/design/design-left-footer";
// THE UX APPLICATION'S FRAME LIVES IN THIS ROOM NOW (owner, 2026-10-25): its only consumer.
import "@/rooms/design/ux/ux-app-frame";
import type { Content } from "@/rooms/design/tools/content";

/* THE FIGMA ENGINE IS ITS OWN PACKAGE, LOADED SEPARATELY — and it draws no surface of its own. */
const ToolsSeat = lazy(() => import("@/rooms/design/tools"));

export type DesignRoomProps = {
  /** The shell's global "an assembly is running" flag, handed to the engine that assembles. */
  onAssemblingChange?: (busy: boolean) => void;
};

export default function DesignRoom({ onAssemblingChange }: DesignRoomProps) {
  /** Is the Tools tab the standing one? Then the Figma content is what is injected. */
  const [toolsStanding, setToolsStanding] = useState(false);
  /** The Figma engine is mounted on first activation and kept — its content stays warm. */
  const [toolsOpened, setToolsOpened] = useState(false);
  /** What the headless Figma engine reported, ready to inject. */
  const [injected, setInjected] = useState<Content | null>(null);
  /** An element a design card asked to open — opened by the Figma engine once it has assembled. */
  const [openTag, setOpenTag] = useState<string | null>(null);

  /* THE RAIL IS THE NAVIGATION. It does not select a page; it selects what is injected. */
  const onTab = useCallback((tab: string) => {
    if (tab === "tools") {
      setToolsOpened(true);
      setToolsStanding(true);
    } else {
      setToolsStanding(false);
    }
  }, []);

  const onContent = useCallback((content: Content) => {
    setInjected(content);
  }, []);

  /* The shell asks for the Figma content (a card click) or for the console (the Design button). */
  useEffect(() => {
    const onTools = (event: Event) => {
      const tag = String((event as CustomEvent<{ openTag?: string }>)?.detail?.openTag ?? "");
      setToolsOpened(true);
      setToolsStanding(true);
      setOpenTag(tag || null);
    };
    const onConsole = () => {
      setToolsStanding(false);
      setOpenTag(null);
    };
    window.addEventListener("design-tools-open", onTools);
    window.addEventListener("design-console-open", onConsole);
    return () => {
      window.removeEventListener("design-tools-open", onTools);
      window.removeEventListener("design-console-open", onConsole);
    };
  }, []);

  return (
    <>
      <DesignSeatShell injected={injected} toolsStanding={toolsStanding} onTab={onTab} />
      {toolsOpened ? (
        <Suspense fallback={null}>
          <ToolsSeat
            headless
            active={toolsStanding}
            onContent={onContent}
            onAssemblingChange={onAssemblingChange}
            openTag={openTag}
          />
        </Suspense>
      ) : null}
    </>
  );
}
