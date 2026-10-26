/**
 * THE COMPOSER'S REMAINING ACTIONS — the delete, the draft loop, the two column views, the
 * conversation adoption and the create request.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` on 2026-10-24. The page calls this hook once and
 * passes the values it still owns: the column writer, the Console tree writer, the tab, the URL
 * search parameters and the live output reader. Everything else is the package's own.
 */
import { useCallback, useEffect } from 'react';
import { API_BASE } from '@/shared/apiHelper';
import { deepFind, loadDraftElements } from '@/canvas/pageHelpers';
import { loadSystemRegistry } from '@/shared/a2uiRegistries';
import { logger } from '@/lib/logger';
import { isDemoMode } from '@/shared/appConfig';
import { promptService } from '@/services/promptService';
import type { DraftPayloadShape } from '@/rooms/product/types';

export interface ComposerActionsDeps {
  workspaceTree: any;
  setWorkspaceTree: any;
  currentPromptSession: any;
  setCurrentPromptSession: any;
  currentPromptSessionObjRef: any;
  draftPayloadRef: any;
  setColumnView: any;
  headerTab: string | null;
  hasUnsavedChangesRef: any;
  searchParams: any;
  setSearchParams: any;
  readCompiledOutput: () => string;
}

export function useComposerPackageActions(deps: ComposerActionsDeps) {
  const {
    workspaceTree,
    setWorkspaceTree,
    currentPromptSession,
    setCurrentPromptSession,
    currentPromptSessionObjRef,
    draftPayloadRef,
    setColumnView,
    headerTab,
    hasUnsavedChangesRef,
    searchParams,
    setSearchParams,
    readCompiledOutput,
  } = deps;

  /** The views a column can show in each state. */
  const COLUMN_VIEWS_RUN = ['flow', 'output', 'draft'];
  const COLUMN_VIEWS_DRAFT = ['output', 'draft'];
  const COLUMN_VIEWS_OUTPUT = ['output'];

  const sayInThread = useCallback((content: string): void => {
    window.dispatchEvent(new CustomEvent('a2ui:system-message', {
      detail: { role: 'assistant', content },
    }));
  }, []);

  /**
   * THE DRAFT IS TOLD WHICH DESIGN SYSTEM IT DRAWS FROM — a live property write, like the header's
   * view. The visible canvas is the one the person is looking at; a hidden tree's canvas draws
   * nothing, so its box is the honest discriminator.
   */
  const writeDraftSystem = useCallback((system: string): void => {
    let frames = 0;
    const write = (): void => {
      const candidates: Array<HTMLElement & { system?: string }> = [];
      const walk = (root: ParentNode): void => {
        root.querySelectorAll('draft-canvas').forEach((el) => candidates.push(el as HTMLElement & { system?: string }));
        root.querySelectorAll('*').forEach((el) => {
          const shadow = (el as HTMLElement).shadowRoot;
          if (shadow) walk(shadow);
        });
      };
      walk(document);
      const visible = candidates.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) ?? candidates[0];
      if (visible) {
        if (visible.system !== system) visible.system = system;
        return;
      }
      if (++frames < 60) setTimeout(write, 60);
    };
    // IMMEDIATE FIRST, THEN TIMER RETRIES — NOT rAF. A timer fires in a hidden pane.
    write();
    setTimeout(write, 60);
  }, []);

  const writeDraftPayload = useCallback((payload: unknown): void => {
    setWorkspaceTree((prev: any) => {
      const model = { ...((prev.dataModel ?? {}) as Record<string, any>) };
      const session = { ...((model.session ?? {}) as Record<string, any>) };
      const middle = { ...((session.middle_column ?? {}) as Record<string, any>) };
      middle.draft = payload;
      session.middle_column = middle;
      model.session = session;
      return { ...prev, dataModel: model };
    });
  }, [setWorkspaceTree]);

  /* A drag is one write: the model follows it, and the package's conversation keeps it. */
  useEffect(() => {
    const onDraftNodeMoved = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as {
        nodeId?: unknown; x?: unknown; y?: unknown;
      };
      const nodeId = typeof detail.nodeId === 'string' ? detail.nodeId : '';
      const at = (typeof detail.x === 'number' && typeof detail.y === 'number')
        ? { x: detail.x, y: detail.y }
        : null;
      const payload = draftPayloadRef.current;
      if (!nodeId || !at || !payload) return;
      const next: DraftPayloadShape = {
        ...payload,
        positions: { ...(payload.positions ?? {}), [nodeId]: at },
      };
      draftPayloadRef.current = next;
      writeDraftPayload(next);
      const conversationId = String(((currentPromptSessionObjRef.current as any)?.conversationId) || '');
      if (!conversationId) {
        sayInThread('That drag was not saved: this package has no conversation to keep its draft in.');
        return;
      }
      void (async () => {
        try {
          const res = await fetch(
            `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/draft`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next),
            },
          );
          if (!res.ok) {
            const refused = (await res.json().catch(() => null)) as { detail?: string } | null;
            throw new Error(String(refused?.detail || `HTTP ${res.status}`));
          }
        } catch (err) {
          sayInThread(
            'That drag was not saved to this conversation: '
            + `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
    };
    window.addEventListener('draft-node-moved', onDraftNodeMoved);
    return () => window.removeEventListener('draft-node-moved', onDraftNodeMoved);
  }, [writeDraftPayload, sayInThread, currentPromptSessionObjRef, draftPayloadRef]);

  const showDraftColumn = useCallback(async (): Promise<void> => {
    // The element must exist before the tree names it.
    await loadDraftElements();
    /*
     * THE PACKAGE'S CHOSEN DESIGN SYSTEM IS LOADED BEFORE THE TREE NAMES ANY COMPONENT. Absent is
     * a real answer; a load that fails throws, so the switch fails loud.
     */
    const system = String(
      ((currentPromptSessionObjRef.current as any)?.metadata?.design_system) || '',
    );
    if (system) await loadSystemRegistry(system);
    /*
     * THE STORED LAYOUT, READ BEFORE THE VIEW OPENS. Absent is a real answer; a read that fails
     * does not open the draft at all.
     */
    const conversationId = String(((currentPromptSessionObjRef.current as any)?.conversationId) || '');
    if (conversationId) {
      try {
        const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/draft`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { draft?: unknown };
        draftPayloadRef.current = (body?.draft as DraftPayloadShape | null) ?? null;
      } catch (err) {
        sayInThread(
          'The draft was not opened: this conversation\'s layout could not be read '
          + `(${err instanceof Error ? err.message : String(err)}). Nothing was changed.`,
        );
        return;
      }
      writeDraftPayload(draftPayloadRef.current);
    }
    const comps = Array.isArray(workspaceTree?.components) ? workspaceTree.components : [];
    const container = comps.find((c: any) => c?.component === 'RoomEmbed');
    const flowId = (container?.children as Record<string, unknown> | undefined)?.flow;
    const j = typeof flowId === 'string' ? comps.findIndex((c: any) => c?.id === flowId) : -1;
    if (j < 0) {
      // THE VIEW IS NOT CLAIMED WHEN THE COLUMN IS NOT THERE (2026-10-25): the header
      // used to say "draft" while nothing changed on the canvas.
      logger.warn('the draft was asked for, but there is no column to draw it in', {
        hasContainer: Boolean(container),
        hasFlow: typeof flowId === 'string',
      });
      return;
    }
    setWorkspaceTree((prev: any) => {
      const prevComps = Array.isArray(prev.components) ? prev.components : [];
      const next = prevComps.slice();
      next[j] = {
        id: flowId as string,
        component: 'draft-canvas',
        draft: { path: '/session/middle_column/draft' },
      };
      return { ...prev, components: next };
    });
    setColumnView('draft', COLUMN_VIEWS_DRAFT);
    writeDraftSystem(system);
  }, [currentPromptSessionObjRef, draftPayloadRef, sayInThread, setColumnView, setWorkspaceTree, writeDraftPayload, writeDraftSystem, workspaceTree]);

  /* The header is told what this column can show, on arrival too. */
  useEffect(() => {
    const comps = Array.isArray(workspaceTree?.components) ? workspaceTree.components : [];
    if (!comps.some((c: any) => c?.component === 'OutputControls')) return;
    const header = deepFind<HTMLElement & { views?: string[] }>('output-controls');
    if (!header || !(Array.isArray(header.views) && header.views.length)) {
      setColumnView('output', COLUMN_VIEWS_OUTPUT, true);
    }
  }, [workspaceTree, setColumnView]);

  const showOutputColumn = useCallback(() => {
    setWorkspaceTree((prev: any) => {
      const comps = Array.isArray(prev.components) ? prev.components : [];
      const next = comps.slice();
      /*
       * THE COLUMNS ARE FOUND BY ROLE, NEVER BY ID. Every assembly names its own components;
       * the role belongs to the layout.
       */
      const r = next.findIndex((c: any) => c?.component === 'composer-workspace');
      const root = r >= 0 ? next[r] : null;
      const childMap: Record<string, unknown> = { ...((root?.children as Record<string, unknown>) ?? {}) };
      const middleId =
        (childMap.middle as string | undefined) ??
        next.find((c: any) =>
          c?.component === 'compiled-output-viewer'
          || c?.component === 'RoomEmbed'
          || c?.component === 'draft-canvas')?.id;
      const i = middleId ? next.findIndex((c: any) => c?.id === middleId) : -1;
      if (i < 0) return prev;
      const have = next[i];
      if (have?.component === 'compiled-output-viewer' && have?.content?.path) return prev;

      const doomed = new Set<string>();
      const collect = (id: string): void => {
        if (doomed.has(id)) return;
        doomed.add(id);
        const comp = next.find((c: any) => c?.id === id);
        for (const childId of Object.values((comp?.children as Record<string, unknown>) ?? {})) {
          if (typeof childId === 'string' && childId !== middleId) collect(childId);
        }
      };
      for (const childId of Object.values((have?.children as Record<string, unknown>) ?? {})) {
        if (typeof childId === 'string') collect(childId);
      }

      next[i] = {
        id: middleId,
        component: 'compiled-output-viewer',
        content: { path: '/session/middle_column/compiled_output' },
      };
      delete childMap.middle;
      for (let idx = next.length - 1; idx >= 0; idx -= 1) {
        if (doomed.has(next[idx]?.id)) next.splice(idx, 1);
      }
      if (root) next[r] = { ...root, children: childMap };
      return { ...prev, components: next };
    });
    setColumnView('output', COLUMN_VIEWS_OUTPUT);
  }, [setColumnView, setWorkspaceTree]);

  const readLiveOutput = (): string => readCompiledOutput();

  const handleCreateNewPrompt = async (_title?: string) => {
    /* THE COMPOSER ASKS THE SHELL FOR A BLANK SURFACE. The request is the Composer's; the tab
       change is navigation, and the shell answers `composer:create` with it. */
    window.dispatchEvent(new CustomEvent('composer:create'));
  };

  // Auto-create prompt from title query param (e.g., /prompts?title=My+Prompt)
  useEffect(() => {
    const titleParam = searchParams.get('title');
    if (titleParam && !currentPromptSession) {
      handleCreateNewPrompt(titleParam);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const deletePackage = useCallback(async (sessionId: string) => {
    if (isDemoMode()) return;
    try {
      await promptService.deletePromptSession(sessionId, true);
      if (currentPromptSession?.id === sessionId) setCurrentPromptSession(null);
    } catch (error) {
      console.error('Failed to delete prompt session:', error);
    }
  }, [currentPromptSession?.id, setCurrentPromptSession]);

  const handleConversationChange = useCallback((conversationId: string | null, surface: 'console' | 'composer' = 'composer') => {
    if (surface === 'console') return;
    if (currentPromptSession && (conversationId === null || currentPromptSession.conversationId !== conversationId)) {
      setCurrentPromptSession((prev: any) => prev ? { ...prev, conversationId: conversationId ?? null } : null);
      if (currentPromptSessionObjRef.current) {
        currentPromptSessionObjRef.current = { ...currentPromptSessionObjRef.current, conversationId: conversationId ?? null };
      }
      setWorkspaceTree((prev: any) => {
        const session = prev.dataModel.session ?? {};
        const right = session.right_column ?? {};
        if ((right.conversation_id ?? null) === conversationId) return prev;
        return {
          ...prev,
          dataModel: {
            ...prev.dataModel,
            session: { ...session, right_column: { ...right, conversation_id: conversationId } },
          },
        };
      });
    }
  }, [currentPromptSession, currentPromptSessionObjRef, setCurrentPromptSession, setWorkspaceTree]);

  return {
    COLUMN_VIEWS_RUN,
    sayInThread,
    writeDraftSystem,
    writeDraftPayload,
    showDraftColumn,
    showOutputColumn,
    readLiveOutput,
    handleCreateNewPrompt,
    deletePackage,
    handleConversationChange,
  };
}
