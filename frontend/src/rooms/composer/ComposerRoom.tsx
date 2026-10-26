/**
 * <ComposerRoom> — THE COMPOSER'S SURFACE, IN ITS OWN ROOM.
 *
 * The room calls the Composer's provider, which owns the package, the Save, the repair, the run
 * and the drawing's writers. The room itself draws: the assembly ring with its one honest
 * sentence, the failure panel that names what happened, and the renderer the surface arrives in.
 *
 * The ground belongs to the box behind this; the host paints no fill of its own.
 */
import { useEffect } from 'react';
import '@/rooms/composer/composer-chat-panel';
import '@/rooms/composer/composer-workspace';
import { deepFind } from '@/canvas/pageHelpers';
import { useRunPipeline } from '@/canvas/useRunPipeline';
import { markArrival } from '@/shared/arrival';
import { ComposerDecisionDialog } from '@/rooms/composer/ComposerDecisionDialog';
import {
  useComposerProvider,
  type ComposerProviderShell,
} from '@/rooms/composer/useComposerProvider';

export interface ComposerRoomProps {
  /** The renderer that draws the Composer's surface. */
  composerRendererRef: { current: any };
  /** The request the shell hands in: a package to open, or a blank Composer. */
  pendingIntent?: { intent: string; context?: Record<string, unknown> } | null;
  onIntentConsumed?: () => void;
  /** The three boundary facts and the console refresh the shell owns. */
  shell: ComposerProviderShell;
}

export function ComposerRoom({
  composerRendererRef,
  pendingIntent,
  onIntentConsumed,
  shell,
}: ComposerRoomProps) {
  const composer = useComposerProvider(shell);

  /*
   * THE RUN LISTENERS MOUNT WITH THE ROOM. The pipeline reads the package, the canvas and the
   * surface; while the Composer is on screen it is the only place a run can start.
   */
  useRunPipeline(composer.runDeps);

  const {
    aiAssemblyMessage,
    aiAssemblyFailed,
    aiAssemblyReport,
    isFailureAcknowledged,
    aiDecision,
    handleAIDecisionAction,
    assembleThenRepairs,
  } = composer;

  /* THE ROOM TELLS THE SHELL WHEN ITS APPLICATION IS BUILT, NOT WHEN IT MOUNTED. Mounting the
     room is neither of the two ends the ring waits for: the surface landed, or the failure
     spoke. The shell's copy of this ring holds while the assembly is in flight. */
  const composerLoading = composer.isAIAssembling
    || (!aiAssemblyFailed && composer.workspaceTree.components.length === 0);
  useEffect(() => {
    if (composerLoading) return;
    window.dispatchEvent(new CustomEvent('room-ready', { detail: { room: 'composer' } }));
  }, [composerLoading]);

  /*
   * THE ROOM ASKS FOR ITS OWN SURFACE. A card, a route or the tab leaves the request here; the
   * room consumes it once and calls its own assembly. A blank Composer clears the thread first,
   * as the tab click always did.
   */
  useEffect(() => {
    if (!pendingIntent) return;
    onIntentConsumed?.();
    const { intent, context } = pendingIntent;
    if (intent === 'render-composer') {
      const seat = deepFind<HTMLElement & { clearThread?: () => void }>('composer-chat-panel');
      seat?.clearThread?.();
    }
    /* A REPAIR ASKED FOR FROM ANOTHER ROOM'S SEAT. The request carries the finding's id; the
       repair itself — the file, the prompt, the save and the announcement — is the Composer's. */
    if (intent.startsWith('repair:')) {
      const findingId = intent.slice('repair:'.length);
      void composer.handleRepairFinding(findingId, { current_surface: shell.headerTab || 'composer' });
      return;
    }
    /* THE COMPOSER ANNOUNCES A PACKAGE IT OPENS. The card that asked for it no longer reaches
       into the Composer's repair state; opening a package ends any repair, and the seat is told
       which package it is about to answer for. */
    const openingSessionId = intent.startsWith('render-session:')
      ? intent.slice('render-session:'.length)
      : '';
    if (openingSessionId) {
      composer.repairSectionsRef.current = null;
      composer.repairFindingRef.current = null;
      markArrival('resume', openingSessionId);
      window.dispatchEvent(new CustomEvent('a2ui:composer-opened', {
        detail: { kind: 'resume', sessionId: openingSessionId },
      }));
    }
    /* A BLANK COMPOSER STATES WHAT THE PERSON IS LEAVING. The room knows its own unsaved flag,
       so the request is complete before it leaves this file. */
    const effectiveContext = intent === 'render-composer'
      ? {
          current_surface: shell.headerTab || 'console',
          has_unsaved_changes: composer.hasUnsavedChangesRef.current,
          session_id: null,
          session_title: '',
        }
      : context;
    void Promise.resolve(assembleThenRepairs(intent, effectiveContext)).then(() => {
      void composer.refreshEvaluations?.();
      composer.setPromptLoadKey?.((k: number) => k + 1);
    });
  }, [pendingIntent, assembleThenRepairs, onIntentConsumed, composer.refreshEvaluations, composer.setPromptLoadKey, shell.headerTab]);

  /*
   * THE ROOM DRAWS ITS OWN SURFACE. The tree feed, the busy flag, the compiled output and the
   * prompt header's id and version are writes into the Composer's own elements.
   */
  useEffect(() => {
    const el = composerRendererRef.current;
    if (!el) return;
    el.components = composer.workspaceTree.components;
    el.dataModel = composer.workspaceTree.dataModel;
  }, [composer.workspaceTree, composerRendererRef]);

  useEffect(() => {
    composer.writeBusyToSurface(composer.isSavingPrompt, composer.isComposerRunning);
  }, [composer.isSavingPrompt, composer.isComposerRunning, composer.writeBusyToSurface]);

  useEffect(() => {
    composer.writeCompiledOutputToSurface(composer.currentPromptSession?.compiledOutput ?? '');
  }, [composer.currentPromptSession?.compiledOutput, composer.writeCompiledOutputToSurface]);

  useEffect(() => {
    const header = deepFind<HTMLElement & { promptId?: string; version?: number }>('left-column-header');
    if (!header) return;
    header.promptId = composer.currentPromptSession?.id || '';
    header.version = composer.currentPromptSession?.currentVersion || 0;
  }, [composer.workspaceTree, composer.currentPromptSession?.id, composer.currentPromptSession?.currentVersion]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flex: '1 1 0%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <ComposerDecisionDialog decision={aiDecision} onAction={handleAIDecisionAction} />
      {aiAssemblyFailed ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', overflow: 'auto' }}>
          {/* ALERT, DON'T BLOCK: the ✕ acknowledges the HEADLINE only. The diagnostics below stay
              until a successful assembly replaces them. */}
          {!isFailureAcknowledged && (
            <error-banner
              code={aiAssemblyReport?.code || 'ASSEMBLY-FAILED'}
              message={aiAssemblyMessage}
              {...(aiAssemblyReport?.retryable ? { retry: true } : {})}
            ></error-banner>
          )}

          {aiAssemblyReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* THE POINTER. A literal glyph plus the exact region. */}
              {(() => {
                const parts = aiAssemblyReport.arrow.split(' ');
                const glyph = parts.shift() ?? '';
                return (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span aria-hidden="true" style={{ fontSize: '22px', lineHeight: 1, color: '#B45309' }}>{glyph}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400E' }}>{parts.join(' ')}</span>
                  </div>
                );
              })()}
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '3px' }}>What happened</div>
                <div style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>{aiAssemblyReport.headline}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '3px' }}>Why</div>
                <div style={{ fontSize: '13px', color: '#374151' }}>{aiAssemblyReport.cause}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '3px' }}>What to do now</div>
                <div style={{ fontSize: '13px', color: '#374151' }}>{aiAssemblyReport.fix}</div>
              </div>
              <details style={{ marginTop: '2px' }}>
                <summary style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', cursor: 'pointer' }}>Raw diagnostics — verbatim, nothing filtered</summary>
                <pre style={{ fontSize: '11px', fontFamily: "'IBM Plex Mono', 'IBM Plex Mono', Menlo, monospace", color: '#374151', margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '10px' }}>{aiAssemblyReport.detail}</pre>
              </details>
            </div>
          )}
        </div>
      ) : (
        <a2ui-renderer key="composer-render" ref={composerRendererRef} />
      )}
    </div>
  );
}
