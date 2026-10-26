/**
 * <ProductRoomContainer> — THE PRODUCT ROOM OWNS ITS OWN STATE.
 *
 * The room used to be a branch of `pages/WritingAreaIndex.tsx`: its project, its gate, its
 * seat, its poller and its foot wiring all lived in the shell's render. That made the shell
 * the owner of Product's memory: leaving the tab did not destroy anything, and a Product
 * flag could still be read after another tab was on screen.
 *
 * This file moves the ownership here. The container is mounted only while Product is the
 * selected tab; unmounting it destroys every value below. The shell keeps only a small
 * boundary: the project a Console card asked for, the callback that says the request was
 * taken, and the shared chat/write helpers the room's draft machinery already used.
 *
 * The markup is unchanged: this file renders the existing <ProductRoom>, and every comment in
 * that file still describes the room it draws.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { API_BASE } from '@/shared/apiHelper';
import { ProductRoom } from '@/rooms/product/ProductRoom';
import type { ProductOpenAction } from '@/rooms/product/productSurface';
import { useProductRoomState } from '@/rooms/product/useProductRoomState';
import { useProductSeat } from '@/rooms/product/useProductSeat';
import { useProductEntry } from '@/rooms/product/useProductEntry';
import { useOpenProductRoom } from '@/rooms/product/useOpenProductRoom';
import { useCheckBuilderEngine } from '@/rooms/product/useCheckBuilderEngine';
import { useProductAttachment } from '@/rooms/product/useProductAttachment';
import { useProductFootWiring } from '@/rooms/product/useProductFootWiring';
import { useProductConversationPoll } from '@/rooms/product/useProductConversationPoll';
import { useProductDraft } from '@/rooms/product/useProductDraft';
import { useProductThread } from '@/rooms/product/useProductThread';
import { useProductBuildWireframe } from '@/rooms/product/useProductBuildWireframe';
import { useProductNodeEdit } from '@/rooms/product/useProductNodeEdit';
import { useWriteProductDraftPayload } from '@/rooms/product/useWriteProductDraftPayload';
import { useWriteProductArtifactPayload } from '@/rooms/product/useWriteProductArtifactPayload';

export interface ProductRoomContainerProps {
  /** A Console card's protocol action, waiting to be taken. Null when none was sent. */
  requestedAction: ProductOpenAction | null;
  /** The room has taken the action; the shell may clear it. */
  onRequestConsumed: () => void;
}

export function ProductRoomContainer(
  { requestedAction, onRequestConsumed }: ProductRoomContainerProps,
) {
    /* THE ROOM'S OWN VOICE (2026-10-24): its thread line and its draft canvas are written by
       the Product's folder, never borrowed from the Composer. */
    const { sayInThread, writeDraftSystem } = useProductThread();
    const {
      productTree, setProductTree,
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
    } = useProductRoomState();

    /* THE ROOM'S TAB IS THIS FILE. It is mounted only while Product is selected, so every
       hook that used to read `headerTab` reads the room's own constant instead. */
    const headerTab = 'product';

    const [builderEngineDown, setBuilderEngineDown] = useState(false);

    const checkBuilderEngine = useCheckBuilderEngine({ setBuilderEngineDown });
    const creatingProductProjectRef = useRef(false);
    const openProductRoom = useOpenProductRoom({
      creatingProductProjectRef,
      setBuilderEngineDown,
      setProductRoomProjectId,
    });

    /* THE CONSOLE CARD'S ACTION LANDS BEFORE THE ROOM DECIDES WHAT TO OPEN. The entry effect
       below is told the action's project so it does not birth or resume a different project
       in the same commit; this effect then writes that project into the room's own state. */
    const requestedProjectId = requestedAction?.action.context.project_id ?? null;
    useEffect(() => {
      if (!requestedAction) return;
      if (requestedProjectId) setProductRoomProjectId(requestedProjectId);
      onRequestConsumed();
    }, [requestedAction, requestedProjectId, onRequestConsumed, setProductRoomProjectId]);

    useProductEntry({
      checkBuilderEngine,
      headerTab,
      openProductRoom,
      productRoomProjectId,
      requestedProjectId,
    });

    /* THE EXIT GUARD IS GONE (owner, 2026-10-23). It was a leftover from the container that
       was repurposed as a template; leaving the room asks nothing and writes nothing. */

    /* THE GATE IS GONE (owner, 2026-10-23). The builder draws at full opacity from its first
       frame; the room's own gate hook, its three hands and its ten-second frame-hiding rule are
       no longer called. */

    /* THE SEAT'S FIRST FACE — the room's own workspace copy (product-workspace) owns the width
       and the column's open state. This effect marks the seat as the room's before its first
       paint and opens the layout's chat column the way the old shell did. */
    useLayoutEffect(() => {
      const seat = productSeatRef.current;
      if (seat) {
        seat.productRoom = true;
        seat.collapsed = false;
      }
      /* THE CHAT LOADS OPEN AT 600, ON THE LAYOUT'S OWN TERMS (owner, 2026-10-06, revised the
         same night: 600, superseding his own earlier 550). The room's own workspace copy
         declares where the column stands on load through `chatLoadWidth`, and
         `isThirdOpen = true` opens it on entry. Both are PROPERTIES through the ref, never
         JSX attributes (Lit's boolean converter reads any present attribute as true). A drag
         is still the person's, exactly as in every other room. */
      const layout = productLayoutRef.current as (HTMLElement & {
        chatLoadWidth?: number;
        isThirdOpen?: boolean;
        requestUpdate?: () => void;
      }) | null;
      if (layout) {
        layout.chatLoadWidth = 600;
        layout.isThirdOpen = true;
        layout.requestUpdate?.();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useProductSeat({
      headerTab,
      productRoomProjectId,
      productSeatRef,
    });

    /* THE SEAT IS BOUND FROM THE APPLICATION'S OWN CONVERSATION (see useProductSeat):
       the bridge's room ids and the engine's thread are written onto the seat together. */

    const uploadProductAttachment = useProductAttachment({ productRoomProjectId });

    useProductFootWiring({
      headerTab,
      productLayoutRef,
      productRoomProjectId,
      productSeatRef,
      setProductGripActive,
      uploadProductAttachment,
    });

    useProductConversationPoll({
      headerTab,
      productRoomProjectId,
      productSeatRef,
    });

    /* PRODUCT'S RENDERER — the legacy stage mirror. It stays with the room so nothing of
       Product's drawing lives in the shell. The ref is not attached by the current pane
       (the builder frame replaced the stage), so this effect is quiet; it is moved, not
       deleted, because the stage may return. */
    useEffect(() => {
      const el = productRendererRef.current;
      if (!el) return;
      el.components = productTree.components;
      el.dataModel = productTree.dataModel;
      const model = (productTree.dataModel ?? {}) as Record<string, any>;
      writeDraftSystem(String((model.session ?? {}).design_system || ''));
      productDraftPayloadRef.current = ((model.session ?? {}).draft ?? null);
      productArtifactRef.current = ((model.session ?? {}).artifact ?? null);
    }, [productTree, writeDraftSystem, productRendererRef, productDraftPayloadRef, productArtifactRef]);

    const writeProductDraftPayload = useWriteProductDraftPayload({ setProductTree });
    const writeProductArtifactPayload = useWriteProductArtifactPayload({ setProductTree });

    useProductDraft({
      currentProductSessionRef,
      productArtifactRef,
      productDraftPayloadRef,
      productSelectedNodeRef,
      sayInThread,
      writeProductArtifactPayload,
      writeProductDraftPayload,
    });
    useProductBuildWireframe({ currentProductSessionRef, productDraftPayloadRef, sayInThread, writeProductDraftPayload });
    useProductNodeEdit({ currentProductSessionRef, productDraftPayloadRef, productSelectedNodeRef, sayInThread, writeProductDraftPayload });

    /*
     * THE BUILDER SAID IT PUBLISHED — the room's own card sync. Keeping it here means the
     * listener exists only while the room is on screen.
     */
    useEffect(() => {
      const onPublished = () => {
        void fetch(`${API_BASE}/builder/sync`, { method: 'POST' });
      };
      window.addEventListener('builder-published', onPublished);
      return () => window.removeEventListener('builder-published', onPublished);
    }, []);

    /*
     * A PERSON TURN MEANS THE BUILD LANDED. The stage re-reads the project by remounting the
     * embed; the listener belongs to the room, so it exists only while the room is on screen.
     */
    useEffect(() => {
      const onPersonTurn = () => setProductStageKey((k) => k + 1);
      window.addEventListener('a2ui:person-turn', onPersonTurn);
      return () => window.removeEventListener('a2ui:person-turn', onPersonTurn);
    }, [setProductStageKey]);

    return (
      <ProductRoom
        builderEngineDown={builderEngineDown}
        productGripActive={productGripActive}
        productRoomProjectId={productRoomProjectId}
        productStageKey={productStageKey}
        productLayoutRef={productLayoutRef}
        productSeatRef={productSeatRef}
      />
    );
}
