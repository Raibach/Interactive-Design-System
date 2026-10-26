/**
 * THE CONSOLE'S OWN THREE CARD ACTIONS — open, create, delete.
 *
 * They used to be the Composer's: a card click called a bridge that reached into the Composer's
 * assembly, the New button called the Composer's create request, and a confirmed delete called
 * the Composer's delete. One room's control changed another room's package. The Console's folder
 * owns them now; the shell still decides where a request takes the person, because that is
 * navigation and the shell is where navigation lives.
 */
import { useCallback, useEffect } from 'react';
import { isDemoMode } from '@/shared/appConfig';
import { promptService } from '@/services/promptService';
import type { ProductOpenAction } from '@/rooms/product/productSurface';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConsoleCardActionsDeps {
  /** The cards this console is drawing, from its own assembled surface. */
  assembledConsoleCards: any[] | null;
  /** The console's own tree writer. The delete takes its card out of this list. */
  setConsoleTree: (updater: unknown) => void;
}

export function useConsoleCardActions({ assembledConsoleCards, setConsoleTree }: ConsoleCardActionsDeps) {
  /**
   * A CARD OPENS THE ROOM THAT OWNS IT. The card carries its package's room:
   *
   *   design   the Design room's Tools seat, on the element the card names
   *   product  the Product room, through the same open_room action the surface protocol uses
   *   other    the Composer, which assembles the package
   *
   * The Console says WHICH room and WHICH thing. The shell performs the tab change — it already
   * hears `navigate-tab`, `a2ui:action` and `composer:open` — so the Console never reaches for
   * another room's state.
   */
  const openCard = useCallback((sessionId: string) => {
    if (!sessionId || !UUID_RE.test(sessionId)) return;
    const openedCard = (Array.isArray(assembledConsoleCards) ? assembledConsoleCards : [])
      .find((c) => String(c?.id) === String(sessionId));

    if (openedCard?.room_domain === 'design') {
      const elementKey = String((openedCard as any)?.element_key || '');
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tabId: 'design' } }));
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('design-tools-open', { detail: { openTag: elementKey } }));
      });
      return;
    }

    if (openedCard?.room_domain === 'product') {
      const builderProjectId = (openedCard as any)?.builder_project?.project_id ?? null;
      const message: ProductOpenAction = {
        version: 'v0.9',
        action: {
          name: 'open_room',
          surfaceId: 'console',
          sourceComponentId: sessionId,
          context: {
            room: 'product',
            project_id: builderProjectId ? String(builderProjectId) : null,
          },
        },
      };
      window.dispatchEvent(new CustomEvent('a2ui:action', { detail: message }));
      return;
    }

    window.dispatchEvent(new CustomEvent('composer:open', { detail: { sessionId } }));
  }, [assembledConsoleCards]);

  /** The New button asks the shell for a blank Composer. The Composer assembles it. */
  const createPrompt = useCallback((): void => {
    window.dispatchEvent(new CustomEvent('composer:create'));
  }, []);

  /**
   * A CONFIRMED DELETE IS THE CONSOLE'S OWN (the card's arm→confirm is the whole confirmation).
   * The row goes, and the card leaves this room's list. Nothing here reaches into the Composer:
   * if the deleted package was open there, the Composer is not mounted while the Console is, and
   * a package it opens next is read from the database.
   */
  useEffect(() => {
    const onCardDelete = (event: Event) => {
      const sessionId = String((event as CustomEvent)?.detail?.sessionId ?? '');
      if (!sessionId) return;
      void (async () => {
        if (isDemoMode()) return;
        try {
          await promptService.deletePromptSession(sessionId, true);
          setConsoleTree((prev: any) => {
            const tree = prev as { components: any[]; dataModel: Record<string, any> };
            const model = (tree.dataModel ?? {}) as Record<string, unknown>;
            const cards = Array.isArray(model.cards) ? (model.cards as unknown[]) : null;
            if (!cards) return tree;
            const next = cards.filter((c) => String((c as { id?: unknown })?.id ?? '') !== String(sessionId));
            if (next.length === cards.length) return tree;
            return { ...tree, dataModel: { ...model, cards: next } };
          });
        } catch (error) {
          console.error('Failed to delete prompt session:', error);
        }
      })();
    };
    window.addEventListener('card-delete', onCardDelete);
    return () => window.removeEventListener('card-delete', onCardDelete);
  }, [setConsoleTree]);

  /** The grid owns its own page; the event is recorded so a control never speaks into a room
      with nobody in it. */
  useEffect(() => {
    const onCardPage = (event: Event) => {
      console.log('[console] page', ((event as CustomEvent).detail || {}));
    };
    window.addEventListener('card-page', onCardPage);
    return () => window.removeEventListener('card-page', onCardPage);
  }, []);

  return { openCard, createPrompt };
}
