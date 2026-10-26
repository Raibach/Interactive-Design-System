/**
 * THE COMPOSER'S WINDOW-EVENT WIRING — the half of `canvas/useShellEventListeners.ts` that
 * belongs to the Composer's own surface.
 *
 * Moved out on 2026-10-24 with the statements unchanged. The shell keeps the two navigation
 * asks (`open-console`, `loads-cards-form-console-in-prompt-area`) and the Console keeps its
 * card events; everything here speaks about the Composer's prompt, its drawing, its save or its
 * repair, and it is mounted only while the Composer room is.
 */
import { useEffect } from 'react';
import { deepFind } from '@/canvas/pageHelpers';
import { logger } from '@/lib/logger';
import { seatIdOf } from '@/shared/promptSections';
import { withTrigger } from '@/shared/triggers';
import { rowForAddedNode, type FlowSeatInput } from '@/shared/agentFlow';

export interface ComposerEventDeps {
  handleConversationChange: any;
  headerTab: any;
  patchSectionAt: any;
  publishFlowFromRows: any;
  readLiveOutput: any;
  setWorkspaceTree: any;
  showDraftColumn: any;
  showOutputColumn: any;
  surfaceSections: any;
  handleSavePromptRef: any;
}

export function useComposerEventListeners(deps: ComposerEventDeps) {
  const {
    handleConversationChange,
    headerTab,
    patchSectionAt,
    publishFlowFromRows,
    readLiveOutput,
    setWorkspaceTree,
    showDraftColumn,
    showOutputColumn,
    surfaceSections,
    handleSavePromptRef,
  } = deps;

  useEffect(() => {
    const onConversationChange = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { conversationId?: string };
      /*
       * AN EMPTY ID IS A FACT, NOT A MISSING ONE — and dropping it cost a save. `undefined` is
       * still nothing to report; an EMPTY STRING is "this place has no conversation", and it is
       * written like any other value.
       *
       * While this room is mounted, the seat that raises the event is the Composer's own: the
       * Console's seat writes its conversation in its own room.
       */
      if (detail.conversationId === undefined) return;
      handleConversationChange(detail.conversationId || null, 'composer');
    };
    const onFlowNodeMoved = (event: Event) => {
      logger.info('flow node moved', ((event as CustomEvent).detail || {}) as Record<string, unknown>);
    };
    const onFlowSelect = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { nodeId?: string | null };
      logger.info('flow select', detail as Record<string, unknown>);
      const nodeId = detail.nodeId ?? null;
      const panel = deepFind<HTMLElement & { statusText?: string }>('composer-chat-panel');
      const messages = panel?.shadowRoot?.querySelector('chat-messages') as
        | (HTMLElement & { highlightNodeId?: string | null })
        | null;
      if (messages) messages.highlightNodeId = nodeId;
      if (!nodeId || !panel) return;
      const nodes = deepFind<HTMLElement & { flow?: { nodes?: Array<{ id: string; title: string; kind: string; state: string }> } }>('agent-flow')?.flow?.nodes ?? [];
      const node = nodes.find((n) => n.id === nodeId);
      if (node) panel.statusText = `${node.title} | ${node.kind} — State: ${node.state}`;
    };
    const onTurnClick = (event: Event) => {
      const nodeId = (((event as CustomEvent).detail || {}) as { nodeId?: string }).nodeId ?? '';
      if (!nodeId) return;
      deepFind<HTMLElement & { focusNode?: (id: string) => void }>('agent-flow')?.focusNode?.(nodeId);
    };
    const onFlowConnect = (event: Event) => {
      logger.info('flow connect', ((event as CustomEvent).detail || {}) as Record<string, unknown>);
    };
    const onFlowAction = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as Record<string, unknown>;
      const action = String(detail.action || '');
      if (action === 'zoom' || action === 'fit') return;
      type FlowNodeShape = {
        id: string; family: string; kind: string; title: string; subtitle?: string; rowIndex?: number;
      };
      const nodeById = (nodeId: string): FlowNodeShape | undefined =>
        (deepFind<HTMLElement & { flow?: { nodes?: FlowNodeShape[] } }>('agent-flow')?.flow?.nodes ?? [])
          .find((n) => n.id === nodeId);
      if (action === 'run') {
        window.dispatchEvent(new CustomEvent('run-requested'));
        return;
      }
      if (action === 'ask') {
        const node = nodeById(String(detail.nodeId || ''));
        if (!node) return;
        const rowAddress = typeof node.rowIndex === 'number' ? ` Its row is index ${node.rowIndex} in the prompt.` : '';
        const line = node.subtitle ? ` Its line reads: "${String(node.subtitle).slice(0, 200)}".` : '';
        window.dispatchEvent(new CustomEvent('a2ui:ask-grace', {
          detail: {
            request: `A person pressed "Ask Grace" on the node called "${node.title}" on the canvas. That node is `
              + (node.family === 'seat'
                ? `a ROW of the prompt — the ${node.kind} row.${rowAddress}${line}`
                : `a STEP of the Run (${node.kind}) — part of what the prompt's execution does, not a row of it.${line}`)
              + ' Say in one or two sentences what it is and what it does in this flow. Do not offer a button and do not change anything.',
          },
        }));
        return;
      }
      if (action === 'delete') {
        const nodeId = String(detail.nodeId || '');
        const node = nodeById(nodeId);
        if (!node) return;
        const rows = surfaceSections();
        const row = rows.find((s: any) => String(seatIdOf(s) || '') === String(node.kind || ''))
          ?? rows.find((s: any) =>
            String(s?.name || '').trim().toLowerCase() === String(node.title || '').trim().toLowerCase());
        const isRow = node.family === 'seat' && Boolean(row);
        if (!isRow) {
          window.dispatchEvent(new CustomEvent('a2ui:ask-grace', {
            detail: {
              request: `A person pressed Delete on the node called "${node.title}" on the canvas. That node is not a `
                + 'row of the prompt — it is part of what a Run does (the answer, the write, the check), so '
                + 'there is nothing to remove and no button to offer. Say that in one sentence: what it is, '
                + 'and that it goes when the prompt that produced it changes.',
            },
          }));
          return;
        }
        const rowName = String((row as { name?: string }).name ?? node.title);
        const words = String((row as { content?: string }).content || '').trim().length;
        window.dispatchEvent(new CustomEvent('remove-prompt-role', { detail: { roleName: rowName } }));
        const at = rows.indexOf(row);
        if (at >= 0) {
          publishFlowFromRows(undefined, rows.filter((_: any, i: number) => i !== at) as FlowSeatInput[]);
        }
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: {
            role: 'assistant',
            content: `Removed the ${node.title} row — the node and the row are the same fact, so it went from both.`
              + (words ? ` ${words} characters were in it, and they are gone with it.` : ''),
          },
        }));
      }
      if (action === 'trigger') {
        const nodeId = String(detail.nodeId || '');
        const token = String(detail.token || '');
        if (!nodeId || !token) return;
        const node = nodeById(nodeId);
        if (!node || node.family !== 'seat') {
          logger.warn('a trigger was chosen on a node that is not a row', { nodeId });
          return;
        }
        const rows = surfaceSections();
        const byIndex = typeof detail.rowIndex === 'number' && detail.rowIndex >= 0
          ? rows[detail.rowIndex as number]
          : undefined;
        const row = byIndex
          ?? rows.find((s: any) => String(seatIdOf(s) || '') === String(node.kind || ''))
          ?? rows.find((s: any) =>
            String(s?.name || '').trim().toLowerCase() === String(node.title || '').trim().toLowerCase());
        if (!row) {
          logger.warn('a trigger was chosen on a node with no row to write it into', { nodeId, title: node.title });
          return;
        }
        const index = typeof detail.rowIndex === 'number' && (detail.rowIndex as number) >= 0 && (detail.rowIndex as number) < rows.length
          ? (detail.rowIndex as number)
          : rows.indexOf(row);
        if (index < 0) {
          logger.warn('a trigger was chosen with no addressable row to write it into', { nodeId: detail.nodeId });
          return;
        }
        const nextContent = withTrigger(String((row as { content?: string }).content || ''), token);
        patchSectionAt(index, { ...row, content: nextContent });
        const nextRows = rows.map((r: any, i: number) => (i === index ? { ...r, content: nextContent } : r)) as FlowSeatInput[];
        publishFlowFromRows(undefined, nextRows);
      }
      logger.info(`flow action: ${action}`, detail);
    };
    const speakBlankSeats = (blanks: Array<{ id: string; title: string }> | undefined) => {
      for (const node of blanks ?? []) {
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: {
            role: 'assistant',
            content: `"${node.title}" is blank — nothing has been written in this seat yet. Want to work on this one?`,
            nodeId: node.id,
            label: node.title,
          },
        }));
      }
    };
    const onFlowOpened = (event: Event) => {
      const d = ((event as CustomEvent).detail || {}) as {
        label?: string;
        notes?: number;
        seats?: number;
        blanks?: Array<{ id: string; title: string }>;
        steps?: number;
        unresolved?: string[];
        absent?: Array<{ step: string; why: string }>;
      };
      logger.info('flow opened', d as Record<string, unknown>);
      speakBlankSeats(d.blanks);
      const count = (n: number | undefined, one: string): string =>
        `${n ?? 0} ${(n ?? 0) === 1 ? one : one + 's'}`;
      let line = `The flow is up — ${d.label || 'this run'}: `
        + `${count(d.notes, 'note')}, ${count(d.seats, 'seat')}, ${count(d.steps, 'step')}.`;
      if (d.unresolved?.length) {
        line += ` One row I cannot name yet — ${d.unresolved.join(', ')} — so it is drawn without a seat claimed.`;
      }
      if (d.absent?.length) {
        line += ` Not drawn: ${d.absent.map((a) => a.step).join(', ')} — ${d.absent.map((a) => a.why).join('; ')}.`;
      }
      const notes: string[] = [];
      if (d.unresolved?.length) {
        notes.push(
          `${d.unresolved.length} row${d.unresolved.length === 1 ? '' : 's'} could not be named: ${d.unresolved.join(', ')}`,
        );
      }
      if (d.absent?.length) notes.push(d.absent.map((a) => `${a.step}: ${a.why}`).join(' · '));
      const readout = deepFind<HTMLElement & { statusText?: string }>('composer-chat-panel');
      if (readout && notes.length) readout.statusText = notes.join(' · ');
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: { role: 'assistant', content: line },
      }));
    };
    const onFlowNodeAdded = (event: Event) => {
      const d = ((event as CustomEvent).detail || {}) as { nodeId?: string; kind?: string };
      logger.info('flow node added', d as Record<string, unknown>);
      const said = (content: string) => {
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: { role: 'assistant', content },
        }));
      };
      const answer = rowForAddedNode(String(d.kind ?? ''), surfaceSections() as FlowSeatInput[]);
      if (answer.why === 'undeclared') {
        said(`That node is not a row this prompt can hold, so it was not added. `
          + `Its kind — "${d.kind || 'unnamed'}" — is not one of the seats a prompt has.`);
        return;
      }
      if (answer.why === 'already') {
        said(`This prompt already has a ${answer.label} row, and the node is that row — `
          + `so nothing was added, and nothing in it was touched.`);
        return;
      }
      window.dispatchEvent(new CustomEvent('set-left-column-text', {
        detail: { target: answer.section, content: '' },
      }));
      said(`Added a ${answer.label} row to the prompt. Write in either place — `
        + `the row and the node are the same thing.`);
    };
    const onThemeChange = (event: Event) => {
      const theme = String((event as CustomEvent).detail?.theme ?? '');
      setWorkspaceTree((prev: any) => {
        const comps = Array.isArray(prev.components) ? prev.components : [];
        const takesTheme = (c: any) =>
          c?.component === 'RoomEmbed'
          || c?.component === 'AgentFlow'
          || c?.component === 'CanvasFooter';
        const next = comps.map((c: any) => (takesTheme(c) ? { ...c, theme } : c));
        return { ...prev, components: next };
      });
    };
    const onCanvasPlay = () => window.dispatchEvent(new CustomEvent('run-requested'));
    const onCanvasReset = () => {
      showOutputColumn();
      deepFind<HTMLElement & { resetArrangement?: () => void }>('composer-workspace')
        ?.resetArrangement?.();
    };
    const setFooterSaving = (saving: boolean) => {
      setWorkspaceTree((prev: any) => {
        const comps = Array.isArray(prev.components) ? prev.components : [];
        const isFooter = (c: any) =>
          c?.component === 'CanvasFooter' || c?.component === 'canvas-footer';
        const next = comps.map((c: any) => (isFooter(c) ? { ...c, saving } : c));
        return { ...prev, components: next };
      });
    };
    const onCanvasSave = async () => {
      const sections = surfaceSections();
      const compiledOutput = readLiveOutput();
      console.log('[canvas-footer] save-click →', sections.length, 'sections +', compiledOutput.length, 'chars of output from the surface');
      setFooterSaving(true);
      try {
        await handleSavePromptRef.current?.(compiledOutput, sections);
      } finally {
        setFooterSaving(false);
      }
    };
    const onViewChange = (event: Event) => {
      const view = String((event as CustomEvent).detail?.view || '');
      if (view === 'draft') void showDraftColumn();
      else if (view === 'output') showOutputColumn();
    };
    window.addEventListener('conversation-change', onConversationChange);
    window.addEventListener('flow-node-moved', onFlowNodeMoved);
    window.addEventListener('flow-node-added', onFlowNodeAdded);
    window.addEventListener('flow-select', onFlowSelect);
    window.addEventListener('turn-click', onTurnClick);
    window.addEventListener('flow-connect', onFlowConnect);
    window.addEventListener('flow-action', onFlowAction);
    window.addEventListener('theme-change', onThemeChange);
    window.addEventListener('view-change', onViewChange);
    window.addEventListener('canvas-play', onCanvasPlay);
    window.addEventListener('canvas-reset', onCanvasReset);
    window.addEventListener('canvas-save', onCanvasSave);
    window.addEventListener('flow-opened', onFlowOpened);
    return () => {
      window.removeEventListener('conversation-change', onConversationChange);
      window.removeEventListener('flow-node-moved', onFlowNodeMoved);
      window.removeEventListener('flow-node-added', onFlowNodeAdded);
      window.removeEventListener('flow-select', onFlowSelect);
      window.removeEventListener('turn-click', onTurnClick);
      window.removeEventListener('flow-connect', onFlowConnect);
      window.removeEventListener('flow-action', onFlowAction);
      window.removeEventListener('theme-change', onThemeChange);
      window.removeEventListener('view-change', onViewChange);
      window.removeEventListener('canvas-play', onCanvasPlay);
      window.removeEventListener('canvas-reset', onCanvasReset);
      window.removeEventListener('canvas-save', onCanvasSave);
      window.removeEventListener('flow-opened', onFlowOpened);
    };
  }, [handleConversationChange, headerTab]);
}
