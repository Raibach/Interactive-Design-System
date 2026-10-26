/**
 * THE CONSOLE ROOM'S OWN STATE (owner, 2026-10-23) — moved out of the shell into the
 * room's folder, following the Product room's template.
 *
 * The console's surface is the assembled A2UI tree the model sends; the room owns the tree,
 * its renderer and the derived cards. Nothing of the Composer's is written here.
 */
import { useRef, useState } from 'react';

export function useConsoleRoomState() {
  /* THE CONSOLE'S ASSEMBLED TREE — the room's own copy of what the model drew. */
  const [consoleTree, setConsoleTree] = useState<{
    components: any[];
    dataModel: Record<string, any>;
  }>({ components: [], dataModel: {} });

  /* THE RENDERER THAT DRAWS THE TREE — the room's own element. */
  const consoleRendererRef = useRef<any>(null);

  /* THE CARDS, DERIVED FROM THE TREE'S OWN MODEL — null means no surface yet. */
  const assembledConsoleCards = Array.isArray(consoleTree.dataModel.cards)
    ? (consoleTree.dataModel.cards as any[])
    : null;

  return {
    consoleTree,
    setConsoleTree,
    consoleRendererRef,
    assembledConsoleCards,
  };
}
