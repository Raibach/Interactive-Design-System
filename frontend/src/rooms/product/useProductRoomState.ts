/**
 * THE PRODUCT ROOM'S OWN STATE — moved out of `pages/WritingAreaIndex.tsx` verbatim
 * (2026-10-21).
 *
 * The page names none of this any more: it calls this hook once and passes what the room needs.
 * Every comment below came with its declaration — they are the room's record of why each value
 * exists, and they belong beside it, not in the shell.
 */
import { useRef, useState } from 'react';
import type { ProductChatPanel } from '@/rooms/product/product-chat-panel';

export function useProductRoomState() {
  /*
   * THE PRODUCT ROOM'S OWN STATE (2026-10-03) — the same shape and the same law as Design's:
   * this room's assembly writes THESE two, and no path from Products writes the Composer's
   * `currentPromptSession`. A PRODUCT SESSION IS A PACKAGE (title, owners, conversations,
   * saving — exactly the Composer's data shape); `currentProductSession` is "which package is
   * open"; the draft the stage draws arrives INSIDE the tree's data model at
   * `/session/draft` — the server reads it before the tree names the element, so a failed
   * read can never draw as an empty stage.
   */
  const [productTree, setProductTree] = useState<{ components: any[]; dataModel: Record<string, any> }>(
    { components: [], dataModel: {} },
  );
  const [currentProductSession, setCurrentProductSession] = useState<Record<string, any> | null>(null);
  /*
   * WHICH PROJECT THE ROOM IS OPENED ON (2026-10-04) — the bridge's second half. A console
   * card for a builder project carries `builder_project.project_id` (routes/builder_bridge.py
   * writes it); a click on that card writes the id HERE and the room's embed loads
   * `/project/<id>`. null = the tool's dashboard. A direct Product-tab click also lands on
   * null — the dashboard is the room's home.
   */
  const [productRoomProjectId, setProductRoomProjectId] = useState<string | null>(null);
  /* THE GATE'S SEAT HAND IS GONE (2026-10-23): the room has no cover to settle. The seat binds
     on its own clock and draws nothing until it does. */
  /*
   * THE STAGE'S REFRESH KEY (2026-10-06 — the chat absorption). `a2ui:person-turn` fires only
   * after the server answered, which for this room means the ENGINE'S BUILD LANDED; bumping
   * this key remounts the embed so the stage re-reads the project. See the handler below.
   */
  const [productStageKey, setProductStageKey] = useState(0);
  /*
   * THE GRIP'S SAFETY NET (owner, 2026-10-06: *"On product, I cannot resize the browser with the
   * gripper… it's not resizable. It needs to be movable… apply that gripper and slide effects
   * that we have on console and the other seats to the chat gripper inside of product."*).
   *
   * THE ROOM'S GEOMETRY IS WHY: the chat strip's whole gesture rides DOCUMENT-level moves (the
   * seat's own measured design — pointer capture was tried and rejected: "it hangs onto your
   * cursor"), and the strip's LEFT NEIGHBOUR in this room is the builder IFRAME — the moment the
   * hand crosses from the strip into the frame, the frame's document swallows every move and the
   * drag freezes (console has no iframe beside it, which is why the same strip works there).
   * While this flag is true the room draws a transparent fixed overlay — the builder app's own
   * resize draws the same (`fixed inset-0 z-50`) — so every move of the gesture stays in THIS
   * document. PRODUCT-ONLY, ROOM-SIDE: the seat element is untouched.
   */
  const [productGripActive, setProductGripActive] = useState(false);
  /* Read by the long-lived drag listener below — a listener registered once keeps the render
     it was registered on, so it reads THROUGH the ref (the file's own rule for Save). */
  const currentProductSessionRef = useRef<Record<string, any> | null>(null);
  /* The drag listener's payload copy for THIS room — kept by the product renderer effect from
     the assembly's own read (the server read it BEFORE the tree named the element). */
  const productDraftPayloadRef = useRef<{
    label?: string;
    nodes: Array<Record<string, unknown>>;
    positions?: Record<string, { x: number; y: number }>;
  } | null>(null);
  /* WHICH TILE IS SELECTED IN THIS ROOM — the stage's own fact (`draft-select`), held here so a
     scoped edit can name it (the stolen `edit-node` op; see the edit handler's note). Only the
     VISIBLE stage takes clicks, so no guard is needed to keep the Composer's canvas out. */
  const productSelectedNodeRef = useRef<string | null>(null);
  /* AND THE PRODUCT ROOM'S RENDERER — the same one-ref-per-renderer rule, one room further
     (2026-10-03). */
  const productRendererRef = useRef<any>(null);
  /* THE PRODUCT ROOM'S TWO COLUMNS (2026-10-05): the room's own workspace handle — the
     frame the chat's gripper and rail address — and the seat's. Plain refs: neither value
     is state and nothing re-renders on their account. */
  const productLayoutRef = useRef<HTMLDivElement | null>(null);
  const productSeatRef = useRef<ProductChatPanel | null>(null);
  /*
   * THE PAGE ON THE STAGE (2026-10-03, late — the artifact era). `productArtifactRef` mirrors
   * `session.artifact` in the tree, exactly as the draft ref above mirrors `session.draft`: the
   * host HOLDS the page — the sandbox is IN-SESSION (nothing reaches the database until Save /
   * Submit lands, a later slice on the owner's word) — writes it into the tree on every build,
   * and sends it back with every ask so she can keep what the request keeps. One name for one
   * fact: the tree's slot is `session.artifact`, written here and nowhere else.
   */
  const productArtifactRef = useRef<string | null>(null);

  return {
    productTree, setProductTree,
    currentProductSession, setCurrentProductSession,
    productRoomProjectId, setProductRoomProjectId,
    productStageKey, setProductStageKey,
    productGripActive, setProductGripActive,
    currentProductSessionRef,
    productDraftPayloadRef,
    productSelectedNodeRef,
    productRendererRef,
    productLayoutRef,
    productSeatRef,
    productArtifactRef,
  };
}
