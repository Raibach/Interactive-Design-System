/**
 * THE COMPOSER OWNS THE COMPOSER.
 *
 * Everything in this file used to live in `pages/WritingAreaIndex.tsx`: the package, the Save,
 * the repair, the drawing's publishers, the canvas's writers, the column's views, the run's
 * dependencies and the window events that speak about them. The page kept calling them and
 * handing the Composer's actions to the Console and the Product, so one room's control could
 * change another room's package.
 *
 * The hook is called by the Composer's room, which is mounted only while the Composer tab is
 * selected. Leaving the tab therefore destroys this state; nothing of the Composer survives in
 * the page. The page keeps three boundary facts it genuinely owns: whether there is unsaved work
 * (for navigation), which package is open (for the traffic record), and the tab.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '@/shared/apiHelper';
import { deepFind, loadCanvasElements } from '@/canvas/pageHelpers';
import { logger } from '@/lib/logger';
import { getStoredUserId } from '@/services/authService';
import { readA2UIEnvelope, envelopeRefusalError, applyComponentUpdate } from '@/shared/a2ui-envelope';
import { buildRepairSections } from '@/shared/repairSections';
import { repairAsk, repairBrief } from '@/shared/repairMaterial';
import {
  buildRepairFlow,
  type FlowNote,
  type FlowPosition,
  type FlowSeatInput,
  type RepairRunFacts,
} from '@/shared/agentFlow';
import { packageTitle, packageDescription } from '@/shared/packageFacts';
import { declaredName } from '@/shared/promptSections';
import { applyReadiness, applyRepair, correctionFromAnswer, readRepairTarget } from '@/shared/repairApply';
import { actionLink, fillFieldAction } from '@/shared/actionLink';
import {
  fetchCatalogHealth,
  isCatalogAuditDisabled,
  queuedRepair,
  reconcileRepairs,
  settleRepairs,
  type RepairStages,
} from '@/shared/catalogHealth';
import { useRepairStages } from '@/shared/repairStages';
import { subscribeTrace, traceSnapshot, type TraceSnapshot } from '@/lib/trace-source';
import { useAiOrchestrator } from '@/shared/ai-orchestrator';
import { eventBus } from '@/shared/event-bus';
import { useRestorePackageWorkspace } from '@/canvas/useRestorePackageWorkspace';
import { useComposerPackageStack } from '@/rooms/composer/useComposerPackageStack';
import { useComposerPackageActions } from '@/rooms/composer/useComposerPackageActions';
import { useComposerAssembly } from '@/rooms/composer/useComposerAssembly';
import { useComposerEventListeners } from '@/rooms/composer/useComposerEventListeners';
import type { UseRunPipelineDeps } from '@/canvas/useRunPipeline';

/** The three boundary facts the shell owns, plus the console refresh it performs after a save. */
export interface ComposerProviderShell {
  hasUnsavedChangesRef: { current: boolean };
  activePackageRef: { current: string | null };
  headerTab: string | null;
  setHeaderTab: (tab: string) => void;
  headerTabRef: { current: string | null };
  toast: any;
  /** The shell's console assembly, asked for after a save so the card list catches up. */
  assembleConsole: () => Promise<unknown> | void;
}

export function useComposerProvider(shell: ComposerProviderShell) {
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── THE PACKAGE ─────────────────────────────────────────────────────────── */
  const stack = useComposerPackageStack({ hasUnsavedChangesRef: shell.hasUnsavedChangesRef });
  const {
    currentPromptSession,
    setCurrentPromptSession,
    isSavingPrompt,
    setIsSavingPrompt,
    promptLoadKey,
    setPromptLoadKey,
    isSavingRef,
    currentPromptSessionRef,
    currentPromptSessionObjRef,
    storedWidthsRef,
    runApprovedRef,
    heldRunRef,
    handleSavePromptRef,
    hasUnsavedChangesRef,
    draftPayloadRef,
    workspaceTree,
    setWorkspaceTree,
    workspaceTreeRef,
    surfaceDataModelRef,
    surfaceSections,
    writeTitleToSurface,
    writeDescriptionToSurface,
    patchSectionAt,
    writeSectionsToSurface,
    writeCompiledOutputToSurface,
    writeBusyToSurface,
    writeFlowToSurface,
    writeEvaluationsToSurface,
    readWorkspaceState,
    saveRunState,
    handleSavePrompt,
    handlePromptDescriptionChange,
    handlePromptTitleChange,
    saveDepsRef,
    assembledRunColumnRef,
  } = stack;

  /** The package id the traffic door attributes a surface event to. */
  useEffect(() => {
    shell.activePackageRef.current = currentPromptSession?.id ?? null;
  }, [currentPromptSession?.id, shell.activePackageRef]);

  const [isComposerRunning, setIsComposerRunning] = useState(false);

  /* ── THE REPAIR'S OWN STATE ──────────────────────────────────────────────── */
  const [catalogFindings, setCatalogFindings] = useState<any[] | null>(null);
  const [repairStages, setRepairStages] = useRepairStages();
  const repairSectionsRef = useRef<any[] | null>(null);
  const repairTitleRef = useRef<string | null>(null);
  const repairFindingRef = useRef<string | null>(null);
  const repairAskRef = useRef<{ text: string; buttons: string } | null>(null);

  /* ── THE FLOW'S OWN REFS ─────────────────────────────────────────────────── */
  const flowInputRef = useRef<{ finding: FlowNote | null; sections: FlowSeatInput[]; label: string } | null>(null);
  const carriedPositionsRef = useRef<FlowPosition[]>([]);
  const flowFactsRef = useRef<RepairRunFacts>({});
  const publishFlowRef = useRef<() => void>(() => {});

  /* ── THE COLUMN'S HEADER, AND WHAT IT IS SHOWING ─────────────────────────── */
  const setColumnView = useCallback((view: string, views: string[], onlyIfUnset = false): void => {
    let frames = 0;
    const write = (): void => {
      const header = deepFind<HTMLElement & { view?: string; views?: string[] }>('output-controls');
      if (header) {
        if (onlyIfUnset && (header.view || (Array.isArray(header.views) && header.views.length))) return;
        if (header.view !== view) header.view = view;
        const same = Array.isArray(header.views) && header.views.length === views.length
          && header.views.every((v, i) => v === views[i]);
        if (!same) header.views = [...views];
        return;
      }
      if (++frames < 40) requestAnimationFrame(write);
    };
    requestAnimationFrame(write);
  }, []);

  /* ── THE OUTPUT, READ THE WAY EVERY LISTENER READS IT ────────────────────── */
  const surfaceCompiledOutput = useCallback((): string => {
    const out = (surfaceDataModelRef.current as any)?.session?.middle_column?.compiled_output;
    if (typeof out === 'string' && out.length > 0) return out;
    return currentPromptSessionObjRef.current?.compiledOutput || '';
  }, [surfaceDataModelRef, currentPromptSessionObjRef]);

  /* THE SAVE IS REACHABLE BY EVERY PATH THAT PRESSES IT — the control bar, the canvas foot,
     the chat's own save command, the repair's launch and the Save-or-Discard dialog. THAT
     dialog calls with nothing, so a missing reading is taken from the surface here rather than
     aborting: the person pressed Save, and the prompt is on the screen. */
  handleSavePromptRef.current = (compiledOutput, providedSections, opts) =>
    handleSavePrompt(
      compiledOutput ?? surfaceCompiledOutput(),
      providedSections && providedSections.length ? providedSections : surfaceSections(),
      opts,
    );

  /* ── THE REMAINING PACKAGE ACTIONS ───────────────────────────────────────── */
  const actions = useComposerPackageActions({
    workspaceTree,
    setWorkspaceTree,
    currentPromptSession,
    setCurrentPromptSession,
    currentPromptSessionObjRef,
    draftPayloadRef,
    setColumnView,
    headerTab: shell.headerTab,
    hasUnsavedChangesRef,
    searchParams,
    setSearchParams,
    readCompiledOutput: surfaceCompiledOutput,
  });
  const {
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
  } = actions;

  /* ── THE PACKAGE'S FACTS, AS THE SURFACE HOLDS THEM ──────────────────────── */
  const surfaceSession = useCallback((): { title?: unknown; description?: unknown } => {
    return (surfaceDataModelRef.current as { session?: { title?: unknown; description?: unknown } })?.session ?? {};
  }, [surfaceDataModelRef]);

  const surfaceTitle = useCallback((): string => {
    return packageTitle(surfaceSession(), currentPromptSessionObjRef.current?.title);
  }, [surfaceSession, currentPromptSessionObjRef]);

  const surfaceDescription = useCallback((): string => {
    return packageDescription(surfaceSession(), currentPromptSessionObjRef.current?.description);
  }, [surfaceSession, currentPromptSessionObjRef]);

  /**
   * THE FIRST SPOKEN TURN HAS A HOME. A conversation belongs to a package, so a blank Composer
   * cannot save one. This creates the draft package — hidden from the Console — and its
   * conversation BEFORE the turn is sent, so both messages are written immediately and no Save
   * is involved. Save later turns the draft into a finished package.
   */
  const ensurePackage = useCallback(async (): Promise<{ sessionId: string; conversationId: string | null } | null> => {
    const openId = currentPromptSessionRef.current;
    if (openId) {
      return {
        sessionId: openId,
        conversationId: currentPromptSessionObjRef.current?.conversationId ?? null,
      };
    }
    try {
      const res = await fetch(`${API_BASE}/prompt-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
        body: JSON.stringify({
          title: surfaceTitle() || 'Untitled Prompt',
          room_domain: 'composer',
          draft: true,
        }),
      });
      if (!res.ok) {
        const raw = (await res.text()).trim();
        throw new Error(raw || `HTTP ${res.status}`);
      }
      const body = await res.json();
      const session = body?.session;
      if (!session?.id) throw new Error('the package row came back without an id');
      const conversationId = typeof session.conversation_id === 'string' ? session.conversation_id : null;
      const normalized = { ...session, conversationId: conversationId ?? session.conversationId ?? null };
      setCurrentPromptSession(normalized);
      currentPromptSessionRef.current = session.id;
      currentPromptSessionObjRef.current = normalized;
      setWorkspaceTree((prev: any) => {
        const model = prev?.dataModel ?? {};
        const current = model.session ?? {};
        const right = current.right_column ?? {};
        return {
          ...prev,
          dataModel: {
            ...model,
            session: {
              ...current,
              id: session.id,
              right_column: { ...right, conversation_id: conversationId },
            },
          },
        };
      });
      return { sessionId: session.id, conversationId };
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      sayInThread(
        `The conversation was not sent: the package could not be created (${why}). Nothing was written.`,
      );
      return null;
    }
  }, [currentPromptSessionRef, currentPromptSessionObjRef, surfaceTitle, setCurrentPromptSession, setWorkspaceTree, sayInThread]);

  /* THE SEAT ASKS BY EVENT, THE COMPOSER ANSWERS. The element and the React provider never
     reach into each other; the request names its own nonce and the answer carries the ids. */
  useEffect(() => {
    const onEnsure = (event: Event) => {
      const nonce = String((event as CustomEvent).detail?.nonce || '');
      if (!nonce) return;
      void ensurePackage().then((made) => {
        window.dispatchEvent(new CustomEvent('composer:package-ready', {
          detail: { nonce, sessionId: made?.sessionId, conversationId: made?.conversationId ?? null },
        }));
      });
    };
    window.addEventListener('composer:ensure-package', onEnsure as EventListener);
    return () => window.removeEventListener('composer:ensure-package', onEnsure as EventListener);
  }, [ensurePackage]);

  /* ── THE JUDGE'S INPUTS AND THE RUN'S REVIEW ─────────────────────────────── */
  const askOf = useCallback((sections: any[]): string => {
    const pick = (type: string): string => {
      const row = sections.find((s) => s?.type === type);
      return typeof row?.content === 'string' ? row.content.trim() : '';
    };
    const ask = [pick('user'), pick('agent')].filter(Boolean).join('\n\n');
    return ask.slice(0, 6000);
  }, []);

  const readToolRegister = useCallback(async (): Promise<any[]> => {
    try {
      const resp = await fetch(`${API_BASE}/ai/tools`);
      if (!resp.ok) return [];
      const data = await resp.json().catch(() => null);
      return Array.isArray(data) ? data : Array.isArray(data?.tools) ? data.tools : [];
    } catch {
      return [];
    }
  }, []);

  const toolsThatCannotRun = useCallback(async (held: any[], register?: any[]): Promise<string[]> => {
    try {
      const list: any[] = register ?? (await readToolRegister());
      const reachOut = list
        .filter((t) => t?.kind === 'call' && !t?.runner && t?.name)
        .map((t) => String(t.name));
      if (!reachOut.length) return [];
      const text = held.map((s: any) => String(s?.content ?? '')).join('\n').toLowerCase();
      return reachOut.filter((name) => text.includes(name.toLowerCase()));
    } catch {
      return [];
    }
  }, [readToolRegister]);

  const firstLineOf = (text: string): string =>
    ((text || '').split('\n').find((l) => l.trim()) || '').trim().slice(0, 96);

  const refreshEvaluations = useCallback(async () => {
    const sessionId = currentPromptSessionObjRef.current?.id ?? currentPromptSessionRef.current;
    if (!sessionId) return;
    const res = await fetch(`${API_BASE}/prompt-sessions/${sessionId}/evaluations`);
    if (!res.ok) {
      logger.error('the evaluations list could not be fetched', { sessionId, status: res.status });
      return;
    }
    const data = await res.json();
    writeEvaluationsToSurface(Array.isArray(data.evaluations) ? data.evaluations : []);
  }, [currentPromptSessionObjRef, currentPromptSessionRef, writeEvaluationsToSurface]);

  /* ── THE RUN'S THIRD COLUMN ──────────────────────────────────────────────── */
  const assembleThirdColumn = useCallback(async (): Promise<{
    components: unknown[];
    dataModel: Record<string, any>;
  }> => {
    const tree = workspaceTreeRef.current;
    const components = Array.isArray(tree.components) ? tree.components : [];
    const root = components.find((c: any) => c?.component === 'composer-workspace') ?? null;
    const slots: Record<string, unknown> = { ...((root?.children as Record<string, unknown>) ?? {}) };
    const middleId = (slots.middle as string | undefined)
      ?? components.find((c: any) => c?.component === 'compiled-output-viewer' || c?.component === 'RoomEmbed')?.id
      ?? '';
    delete slots.middle;

    const session = tree.dataModel?.session ?? {};
    const rows = Array.isArray(session.left_column?.sections) ? session.left_column.sections : [];
    const run = {
      layoutId: root?.id ?? 'root',
      middleId,
      slots,
      package: {
        id: currentPromptSessionObjRef.current?.id ?? null,
        title: session.title || currentPromptSessionObjRef.current?.title || 'Untitled Prompt',
        rows: rows.length,
        seats: rows.map((r: any) => declaredName(r)).filter(Boolean),
      },
    };

    const response = await fetch(`${API_BASE}/ai/assemble-surface?limit=500`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
      body: JSON.stringify({ intent: 'render-run', context: { session_id: session.id ?? null, run } }),
    });
    if (!response.ok) {
      const raw = await response.text();
      throw new Error(raw.trim() || `${response.status} ${response.statusText}`);
    }
    const reading = readA2UIEnvelope(await response.json(), tree.dataModel);
    if (reading.ok === false) throw envelopeRefusalError(reading.refusal);
    for (const note of reading.reading.notes) console.warn(`🤖 [A2UI] run: ${note}`);
    return { components: reading.reading.components, dataModel: reading.reading.dataModel };
  }, [workspaceTreeRef, currentPromptSessionObjRef]);

  const applyThirdColumn = useCallback((update: { components: unknown[]; dataModel: Record<string, any> }) => {
    setWorkspaceTree((prev: any) => ({
      components: applyComponentUpdate(prev.components, update.components),
      dataModel: update.dataModel,
    }));
  }, [setWorkspaceTree]);

  /* ── THE DRAWING IS A FUNCTION OF THE ROWS ───────────────────────────────── */
  const publishRepairFlow = useCallback(() => {
    const input = flowInputRef.current;
    if (!input) return;
    writeFlowToSurface(buildRepairFlow({
      label: input.label,
      finding: input.finding,
      sections: input.sections,
      run: flowFactsRef.current,
      carried: carriedPositionsRef.current,
    }));
  }, [writeFlowToSurface]);

  const publishFlowFromRows = useCallback((added?: unknown, rowsNow?: FlowSeatInput[]) => {
    const input = flowInputRef.current;
    if (!input) return;
    const rows = rowsNow ?? (surfaceSections() as FlowSeatInput[]);
    const identity = (s: { type?: unknown; name?: unknown } | null | undefined): string =>
      `${s?.type ?? ''}\u0000${s?.name ?? ''}`;
    const sections = added && !rows.some((s) => identity(s) === identity(added as { type?: unknown; name?: unknown }))
      ? [...rows, added as FlowSeatInput]
      : rows;
    writeFlowToSurface(buildRepairFlow({
      label: input.label,
      finding: input.finding,
      sections,
      run: flowFactsRef.current,
      carried: carriedPositionsRef.current,
    }));
  }, [surfaceSections, writeFlowToSurface]);

  useEffect(() => {
    publishFlowRef.current = publishRepairFlow;
  }, [publishRepairFlow]);

  /* ── THE CANVAS AND THE DRAWING, TOLD THEIR FACTS ────────────────────────── */
  const canvasInsetRef = useRef<{ ro: ResizeObserver | null; chat: Element | null }>({ ro: null, chat: null });

  const syncCanvasInset = useCallback((): void => {
    const flow = deepFind<HTMLElement & { viewportInset?: number }>('agent-flow');
    const chat = deepFind<HTMLElement>('composer-chat-panel');
    const held = canvasInsetRef.current;
    if (chat && chat !== held.chat) {
      held.ro?.disconnect();
      held.ro = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncCanvasInset())
        : null;
      held.ro?.observe(chat);
      held.chat = chat;
    }
    if (!flow) return;
    const f = flow.getBoundingClientRect();
    if (f.width < 2) return;
    const c = chat?.getBoundingClientRect() ?? null;
    const covered = c && c.left > f.left + 1 && c.left < f.right
      ? Math.max(0, Math.round(f.right - c.left))
      : 0;
    if (flow.viewportInset !== covered) flow.viewportInset = covered;
  }, []);

  useEffect(() => {
    syncCanvasInset();
    window.addEventListener('resize', syncCanvasInset);
    return () => {
      window.removeEventListener('resize', syncCanvasInset);
      canvasInsetRef.current.ro?.disconnect();
      canvasInsetRef.current = { ro: null, chat: null };
    };
  }, [syncCanvasInset]);

  const setCanvasHolding = useCallback((holding: boolean): void => {
    let frames = 0;
    const write = (): void => {
      const canvas = deepFind<HTMLElement & { holding?: boolean }>('room-embed');
      if (canvas) {
        if (canvas.holding !== holding) canvas.holding = holding;
        return;
      }
      if (++frames < 40) requestAnimationFrame(write);
    };
    requestAnimationFrame(write);
  }, []);

  const setCanvasRunning = useCallback((running: boolean): void => {
    let frames = 0;
    const write = (): void => {
      const flow = deepFind<HTMLElement & { running?: boolean }>('agent-flow');
      if (flow) {
        if (flow.running !== running) flow.running = running;
        return;
      }
      if (++frames < 40) requestAnimationFrame(write);
    };
    requestAnimationFrame(write);
  }, []);

  const rowsForDecision = useCallback((): any[] => {
    const editor = deepFind<HTMLElement & { sections?: unknown[] }>('prompt-section-editor');
    if (Array.isArray(editor?.sections) && editor.sections.length) return editor.sections as any[];
    const fromSurface = surfaceSections();
    if (fromSurface.length) return fromSurface;
    const fromRepair = repairSectionsRef.current || [];
    if (fromRepair.length) return fromRepair;
    try {
      const raw = currentPromptSessionObjRef.current?.leftColumnContent;
      return raw ? (JSON.parse(raw).sections || []) : [];
    } catch {
      return [];
    }
  }, [surfaceSections, currentPromptSessionObjRef]);

  /* ── THE REPAIR'S VERDICTS AND ITS WRITE ─────────────────────────────────── */
  const speakRepairVerdict = (content: string) => {
    window.dispatchEvent(new CustomEvent('a2ui:system-message', {
      detail: { role: 'assistant', content },
    }));
  };

  const settleRepair = async (findingId: string) => {
    const health = await fetchCatalogHealth();
    if (isCatalogAuditDisabled(health)) return;
    if (health.state !== 'ok') {
      console.warn(`[repair] the check did not answer — ${findingId} stays in repair`);
      speakRepairVerdict('Not checked — the check did not answer. Still on the list.');
      return;
    }
    const stillDerived = health.report.findings.map((f) => f.id);
    setRepairStages((s) => settleRepairs(s, [findingId], stillDerived));
    const stillThere = stillDerived.includes(findingId);
    speakRepairVerdict(
      stillThere
        ? 'Not done — the fresh check still finds it.'
        : 'Done — the fresh check no longer finds it.'
    );

    if (flowInputRef.current) {
      flowFactsRef.current = {
        ...flowFactsRef.current,
        verdict: {
          cleared: !stillThere,
          sentence: stillThere ? 'the fresh check still finds it' : 'the fresh check no longer finds it',
        },
      };
      publishFlowRef.current();
    }

    {
      const sessionId = currentPromptSessionRef.current;
      if (sessionId) {
        try {
          const res = await fetch(`${API_BASE}/prompt-sessions/${sessionId}/evaluations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verdict: stillThere ? 'failed' : 'cleared',
              sentence: stillThere ? 'the fresh check still finds it' : 'the fresh check no longer finds it',
              trigger: 'Repair',
            }),
          });
          if (!res.ok) {
            logger.error('the check verdict could not be recorded', { sessionId, status: res.status });
          }
        } catch (e) {
          logger.error('the check verdict never reached the backend', { sessionId, error: String(e) });
        }
      }
      void refreshEvaluations();
    }

    void saveRunState();
  };

  type WriteOutcome = {
    written: boolean;
    checked: boolean;
    report?: { path: string; bytes?: number; backup?: string; linesBefore?: number; linesAfter?: number };
  };

  const writeAnswerBack = async (answer: string, findingId: string): Promise<WriteOutcome> => {
    const finding = (catalogFindings || []).find((f: any) => f.id === findingId);
    const target = finding?.file as string | undefined;
    const correction = correctionFromAnswer(answer);
    const nothing: WriteOutcome = { written: false, checked: false };

    if (!correction) {
      speakRepairVerdict('Nothing written — the answer had no file in it.');
      return nothing;
    }
    if (target && correction.path !== target) {
      speakRepairVerdict(
        `Nothing written — the answer rewrote \`${correction.path}\`, not \`${target}\`.`,
      );
      return nothing;
    }

    const original = await readRepairTarget(correction.path);
    if (original === null) {
      speakRepairVerdict(`Nothing written — could not read \`${correction.path}\`.`);
      return nothing;
    }

    const ready = applyReadiness(original, correction.content);
    if (ready.ok === false) {
      speakRepairVerdict(`Nothing written — the answer ${ready.reason}.`);
      console.warn(`[repair] refused before writing ${correction.path}: ${ready.reason}`);
      return nothing;
    }

    const result = await applyRepair({ path: correction.path, content: ready.content });
    if (!result.ok) {
      speakRepairVerdict(`Nothing written — ${result.reason}.`);
      console.warn(`[repair] the write was refused for ${correction.path}: ${result.reason}`);
      return nothing;
    }

    const checked = result.check?.ran === true;
    speakRepairVerdict(
      `Written \`${result.path}\` — ${result.lines_after} lines (was ${result.lines_before}), ` +
      `backup \`${result.backup}\`.` +
      (checked
        ? ''
        : ` Check did not run (${result.check?.why || 'no reason given'}) — still on the list.`),
    );
    return {
      written: true,
      checked,
      report: {
        path: result.path ?? correction.path,
        bytes: result.bytes,
        backup: result.backup,
        linesBefore: result.lines_before,
        linesAfter: result.lines_after,
      },
    };
  };

  const pushRepairSections = (sections: any[]) => {
    writeSectionsToSurface(sections);
  };

  /* ── THE CHECKER'S FINDINGS ──────────────────────────────────────────────── */
  const loadCatalogFindings = useCallback(async () => {
    try {
      const health = await fetchCatalogHealth();
      if (isCatalogAuditDisabled(health)) return;
      if (health.state !== 'ok') {
        console.error(
          `[catalog] the check did not answer (${health.state}) — the repairs have nothing ` +
            'to resolve against. Run it: cd frontend && npm run catalog:check',
        );
        return;
      }
      const open = health.report.findings.filter((f) => f.level !== 'pass');
      setCatalogFindings(open);
      const suppressed = open.filter((f: { check?: string }) => f.check === 'error-suppression');
      if (suppressed.length) {
        logger.warn(
          `${suppressed.length} swallowed failure(s) recorded on the governed path — each one hides something from the person`,
          { check: 'error-suppression', count: suppressed.length, where: 'frontend/catalog-audit/*.json' },
        );
      }
      setRepairStages((s) => reconcileRepairs(s, open.map((f) => f.id)));
      console.log(`[catalog] ${open.length} open finding(s) read from the checker's report`);
    } catch (e) {
      console.error('[catalog] the report could not be read:', e);
    }
  }, [setRepairStages]);

  /* ── THE COMPOSER'S ASSEMBLY ─────────────────────────────────────────────── */
  const assembly = useComposerAssembly({
    currentPromptSessionRef,
    setCurrentPromptSession,
    setWorkspaceTree,
    hasUnsavedChangesRef,
    repairSectionsRef,
    repairAskRef,
    repairTitleRef,
    headerTabRef: shell.headerTabRef,
    setHeaderTab: shell.setHeaderTab,
    setConsoleTree: () => {},
    loadCatalogFindings,
    handleSavePromptRef,
  });
  const { assembleThenRepairs } = assembly;

  /* ── REPAIR → A PROMPT, NOT A FIX ────────────────────────────────────────── */
  const handleRepairFinding = async (
    findingId: string,
    surfaceContext?: { current_surface?: string; session_id?: string | null; session_title?: string },
  ) => {
    const finding = (catalogFindings || []).find((f: any) => f.id === findingId);
    if (!finding) {
      console.warn('[repair] finding is no longer in the report:', findingId);
      return;
    }

    const fileText = finding.file ? await readRepairTarget(finding.file) : null;
    if (finding.file && !fileText) {
      console.warn(
        `[repair] could not read ${finding.file} — nothing can be written to it, ` +
        'and the prompt will ask for COULD NOT CHECK instead of a file',
      );
    }

    const sections = buildRepairSections(finding, fileText || undefined);
    repairSectionsRef.current = sections;

    const repairTitle = `Repair — ${finding.check}${finding.component ? ` on ${finding.component}` : ''}`;
    repairTitleRef.current = repairTitle;

    const repairTargetSessionId = surfaceContext?.session_id !== undefined
      ? surfaceContext.session_id
      : (currentPromptSession?.id || null);
    const repairOpensFreshPackage = !repairTargetSessionId;

    const userSeat = sections.find((s: any) => s.type === 'user');
    const repairSeatName = userSeat?.name || 'User';
    const ask = repairAsk(finding, repairSeatName, userSeat?.content);
    const brief = repairBrief(finding, repairSeatName, userSeat?.content);
    const repairAskButtons = ask
      ? ask.answers
          .map((a) => actionLink(a.label, fillFieldAction(repairSeatName, a.field, a.value.join('\n'))))
          .join('  ')
      : '';
    repairAskRef.current = ask ? { text: ask.text, buttons: repairAskButtons } : null;

    await assembleThenRepairs('render-composer', {
      current_surface: surfaceContext?.current_surface ?? (shell.headerTab || 'composer'),
      has_unsaved_changes: hasUnsavedChangesRef.current,
      session_id: repairTargetSessionId,
      session_title: surfaceContext?.session_title || repairTitle,
      repair_brief: brief,
    });

    pushRepairSections(sections);

    if (repairOpensFreshPackage) {
      const writeItDown = (attempt = 0) => {
        if (isSavingRef.current && attempt < 40) {
          setTimeout(() => writeItDown(attempt + 1), 300);
          return;
        }
        void handleSavePromptRef.current?.('', sections, { keepSurface: true, title: repairTitle });
      };
      writeItDown();
    }

    repairFindingRef.current = findingId;
    setRepairStages((s) => queuedRepair(s, findingId));
  };

  /* ── THE PACKAGE OPENS WHERE IT WAS LEFT ─────────────────────────────────── */
  useRestorePackageWorkspace({
    COLUMN_VIEWS_RUN,
    assembledRunColumnRef,
    carriedPositionsRef,
    currentPromptSession,
    currentPromptSessionRef,
    setColumnView,
    setWorkspaceTree,
    storedWidthsRef,
    writeFlowToSurface,
  });

  /* ── EVERY WRITE INTO THE COLUMN LANDS BACK IN THE MODEL ─────────────────── */
  useEffect(() => {
    const handler = (e: Event) => {
      const { index, section } = (e as CustomEvent).detail || {};
      if (typeof index === 'number' && index >= 0 && section) {
        patchSectionAt(index, section);
        // EVERY SECTION EDIT IS UNSAVED WORK (2026-10-25): only repair edits armed the
        // exit warning before, so a normal edit could be lost with no word.
        hasUnsavedChangesRef.current = true;
      }
      const held = repairSectionsRef.current;
      if (!held || !section || typeof index !== 'number' || index < 0 || index >= held.length) return;
      const next = held.slice();
      next[index] = { ...next[index], ...section };
      repairSectionsRef.current = next;
    };
    window.addEventListener('section-update', handler);

    const onSectionAdd = (e: Event) => {
      const section = ((e as CustomEvent).detail || {}).section;
      if (!section) return;
      patchSectionAt(null, section);
      hasUnsavedChangesRef.current = true;
      publishFlowFromRows(section);
    };
    window.addEventListener('section-add', onSectionAdd);

    const onSectionRemove = (e: Event) => {
      const { index, name } = ((e as CustomEvent).detail || {}) as { index?: number; name?: string };
      if (typeof index !== 'number' || index < 0) return;
      setWorkspaceTree((prev: any) => {
        const session = prev.dataModel.session ?? {};
        const left = session.left_column ?? {};
        const have: any[] = Array.isArray(left.sections) ? left.sections : [];
        if (index >= have.length) return prev;
        const named = (s: any) => String(s?.name || s?.section || s?.role || s?.type || '');
        if (name && named(have[index]) !== String(name)) return prev;
        const sections = have.filter((_: any, i: number) => i !== index);
        return {
          ...prev,
          dataModel: { ...prev.dataModel, session: { ...session, left_column: { ...left, sections } } },
        };
      });
      hasUnsavedChangesRef.current = true;
    };
    window.addEventListener('section-remove', onSectionRemove);

    const onSectionReorder = (e: Event) => {
      const { from, to } = ((e as CustomEvent).detail || {}) as { from?: number; to?: number };
      if (typeof from !== 'number' || typeof to !== 'number') return;
      if (from < 0 || to < 0 || from === to) return;
      setWorkspaceTree((prev: any) => {
        const session = prev.dataModel.session ?? {};
        const left = session.left_column ?? {};
        const have: any[] = Array.isArray(left.sections) ? left.sections : [];
        if (from >= have.length || to >= have.length) return prev;
        const sections = have.slice();
        const [moved] = sections.splice(from, 1);
        sections.splice(to, 0, moved);
        return {
          ...prev,
          dataModel: { ...prev.dataModel, session: { ...session, left_column: { ...left, sections } } },
        };
      });
      hasUnsavedChangesRef.current = true;
    };
    window.addEventListener('section-reorder', onSectionReorder);

    return () => {
      window.removeEventListener('section-update', handler);
      window.removeEventListener('section-add', onSectionAdd);
      window.removeEventListener('section-remove', onSectionRemove);
      window.removeEventListener('section-reorder', onSectionReorder);
    };
  }, [surfaceSections, writeSectionsToSurface, patchSectionAt, publishFlowFromRows, setWorkspaceTree, hasUnsavedChangesRef]);

  /* THE SESSION'S COPY IS A SEED, NOT AN OVERWRITER. */
  useEffect(() => {
    if (repairSectionsRef.current) {
      writeSectionsToSurface(repairSectionsRef.current);
      return;
    }
    if (surfaceSections().length > 0) return;
    try {
      const raw = currentPromptSession?.leftColumnContent
        ? JSON.parse(currentPromptSession.leftColumnContent).sections || []
        : [];
      const normalized = raw
        .map((s: any) => s && typeof s === 'object' ? {
          name: s.name || s.section || s.role || s.type || 'Section',
          content: s.content || '',
          type: s.type || s.role || s.name || 'custom',
          position: s.position,
          visible: s.visible !== false,
        } : null)
        .filter(Boolean);
      if (normalized.length > 0) {
        writeSectionsToSurface(normalized);
      }
    } catch (e) {
      console.warn('[A2UI] Failed to write sections into the composer column', e);
    }
  }, [currentPromptSession?.leftColumnContent, promptLoadKey, writeSectionsToSurface, surfaceSections]);

  /* THE REPAIR PROMPT WINS OVER THE COMPOSER'S OWN SECTIONS. */
  useEffect(() => {
    const want = repairSectionsRef.current;
    if (!want) return;
    writeSectionsToSurface(want);
  });

  /* ── UNSAVED WORK ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChangesRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChangesRef]);

  useEffect(() => {
    const handleContentChange = () => {
      hasUnsavedChangesRef.current = true;
    };
    const handleInputEvent = (e: Event) => {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const origin = (path[0] ?? e.target) as HTMLElement | undefined;
      if (!origin) return;
      const isField = origin.tagName === 'TEXTAREA' || origin.tagName === 'INPUT';
      if (!isField) return;
      const inSection = path.some(
        (n) => n instanceof HTMLElement && n.hasAttribute && n.hasAttribute('data-section-name'),
      ) || !!origin.closest?.('[data-section-name]');
      if (inSection) handleContentChange();
    };
    document.addEventListener('input', handleInputEvent);
    window.addEventListener('prompt-content-changed', handleContentChange);
    window.addEventListener('add-prompt-role', handleContentChange);
    window.addEventListener('remove-prompt-role', handleContentChange);
    return () => {
      document.removeEventListener('input', handleInputEvent);
      window.removeEventListener('prompt-content-changed', handleContentChange);
      window.removeEventListener('add-prompt-role', handleContentChange);
      window.removeEventListener('remove-prompt-role', handleContentChange);
    };
  }, [hasUnsavedChangesRef]);

  /* ── AI COMMANDS → THE COMPONENTS THEY NAME ──────────────────────────────── */
  const { lastCommand } = useAiOrchestrator({ sessionId: currentPromptSession?.id ?? null });
  useEffect(() => {
    if (!lastCommand) return;
    console.log('[AI Orchestrator] Last command:', lastCommand.tag, lastCommand.props);
  }, [lastCommand]);

  useEffect(() => {
    if (!currentPromptSession) return;
    const unsubSave = eventBus.on('save-button', () => {
      const sections = surfaceSections();
      const compiledOutput = surfaceCompiledOutput();
      handleSavePromptRef.current?.(compiledOutput, sections);
    });
    const unsubSection = eventBus.on('prompt-section', (cmd) => {
      const { type, content } = cmd.props || {};
      if (!type) return;
      window.dispatchEvent(new CustomEvent('add-prompt-role', {
        detail: { roleName: type, placeholder: content || '' },
      }));
    });
    return () => {
      unsubSave();
      unsubSection();
    };
  }, [currentPromptSession, surfaceSections, surfaceCompiledOutput, handleSavePromptRef]);

  /* ── THE ERROR BANNER'S OWN CONTROLS ─────────────────────────────────────── */
  useEffect(() => {
    const handleRetry = () => {
      void assembleThenRepairs(assembly.lastAssemblyIntentRef.current);
    };
    const handleDismiss = () => {
      assembly.setIsFailureAcknowledged(true);
    };
    window.addEventListener('error-retry', handleRetry);
    window.addEventListener('error-dismiss', handleDismiss);
    return () => {
      window.removeEventListener('error-retry', handleRetry);
      window.removeEventListener('error-dismiss', handleDismiss);
    };
  }, [assembleThenRepairs, assembly.lastAssemblyIntentRef, assembly.setIsFailureAcknowledged]);

  /* ── THE CATALOG'S ACCEPT ACT ────────────────────────────────────────────── */
  useEffect(() => {
    const onCatalogAccept = async (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { system?: string; name?: string };
      const system = String(detail.system || '');
      const name = String(detail.name || '');
      if (!system || !name) return;
      let ok = false;
      try {
        const res = await fetch(`${API_BASE}/catalog/${encodeURIComponent(system)}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        ok = res.ok;
      } catch {
        ok = false;
      }
      window.dispatchEvent(new CustomEvent('catalog-accept-settled', {
        detail: { system, name, ok },
      }));
    };
    window.addEventListener('catalog-accept', onCatalogAccept);
    return () => window.removeEventListener('catalog-accept', onCatalogAccept);
  }, []);

  /* ── THE TRACE, WRITTEN INTO THE COMPOSER'S OWN MODEL ────────────────────── */
  useEffect(() => {
    const merge = (prev: any, trace: TraceSnapshot) =>
      prev.dataModel.trace === trace
        ? prev
        : { ...prev, dataModel: { ...prev.dataModel, trace } };
    setWorkspaceTree((prev: any) => merge(prev, traceSnapshot()));
    return subscribeTrace((trace) => setWorkspaceTree((prev: any) => merge(prev, trace)));
  }, [workspaceTree.components, setWorkspaceTree]);

  /* ── THE SAVE'S DEPENDENCIES, READ AT CALL TIME ──────────────────────────── */
  saveDepsRef.current = {
    currentPromptSession,    setCurrentPromptSession,
    isSavingRef,
    currentPromptSessionRef,
    hasUnsavedChangesRef,
    repairTitleRef,
    setIsSavingPrompt,
    headerTab: shell.headerTab,
    surfaceTitle,
    readWorkspaceState,
    handleConversationChange,
    assembleConsole: shell.assembleConsole,
    toast: shell.toast,
  };

  /* ── THE RUN'S DEPENDENCIES ──────────────────────────────────────────────── */
  const runDeps: UseRunPipelineDeps = {
    COLUMN_VIEWS_RUN,
    applyThirdColumn,
    askOf,
    assembleThirdColumn,
    assembledRunColumnRef,
    catalogFindings,
    currentPromptSessionObjRef,
    currentPromptSessionRef,
    firstLineOf,
    flowFactsRef,
    flowInputRef,
    handleOpenPromptFromConsole: (sessionId: string) => {
      window.dispatchEvent(new CustomEvent('composer:open', { detail: { sessionId } }));
    },
    handlePromptDescriptionChange,
    handlePromptTitleChange,
    handleSavePromptRef,
    heldRunRef,
    publishRepairFlow,
    readLiveOutput,
    readToolRegister,
    refreshEvaluations,
    repairFindingRef,
    repairSectionsRef,
    repairTitleRef,
    rowsForDecision,
    runApprovedRef,
    saveRunState,
    setAiAssemblyFailed: assembly.setAiAssemblyFailed,
    setAiAssemblyMessage: assembly.setAiAssemblyMessage,
    setAiAssemblyReport: assembly.setAiAssemblyReport,
    setCanvasHolding,
    setCanvasRunning,
    setColumnView,
    setCurrentPromptSession,
    setIsComposerRunning,
    setIsFailureAcknowledged: assembly.setIsFailureAcknowledged,
    setPromptLoadKey,
    settleRepair,
    speakRepairVerdict,
    surfaceDescription,
    surfaceSections,
    surfaceTitle,
    syncCanvasInset,
    toolsThatCannotRun,
    writeAnswerBack,
  };

  /* ── THE COMPOSER'S OWN EVENTS ───────────────────────────────────────────── */
  useComposerEventListeners({
    handleConversationChange,
    headerTab: shell.headerTab,
    patchSectionAt,
    publishFlowFromRows,
    readLiveOutput,
    setWorkspaceTree,
    showDraftColumn,
    showOutputColumn,
    surfaceSections,
    handleSavePromptRef,
  });

  return {
    ...stack,
    ...actions,
    ...assembly,
    isComposerRunning,
    catalogFindings,
    repairStages,
    repairSectionsRef,
    repairTitleRef,
    repairFindingRef,
    repairAskRef,
    flowInputRef,
    carriedPositionsRef,
    flowFactsRef,
    setColumnView,
    surfaceCompiledOutput,
    surfaceTitle,
    surfaceDescription,
    refreshEvaluations,
    assembleThirdColumn,
    applyThirdColumn,
    publishRepairFlow,
    publishFlowFromRows,
    syncCanvasInset,
    setCanvasHolding,
    setCanvasRunning,
    rowsForDecision,
    speakRepairVerdict,
    settleRepair,
    writeAnswerBack,
    pushRepairSections,
    handleRepairFinding,
    loadCatalogFindings,
    setRepairStages,
    setCatalogFindings,
    runDeps,
    shell,
  };
}
