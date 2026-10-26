/**
 * THE COMPOSER'S SAVE — the one path that turns the surface into the package's row.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` on 2026-10-24 (Stage 2c.2) verbatim. The shell calls
 * the hook after the assembly and the conversation handler exist, and keeps the same handler ref
 * for the Save button, the decision dialog and the run pipeline.
 *
 * THE NAME IS SETTLED HERE AS WELL AS AT ASSEMBLY, because this is the boundary where a name
 * becomes permanent. The order is the surface's own title first, then the React copy, then the
 * repair's name only when this save is CREATING a package; an UPDATE is never renamed by a repair
 * that merely passes through it.
 */
import { API_BASE } from '@/shared/apiHelper';
import { deepFind } from '@/canvas/pageHelpers';
import { getStoredUserId } from '@/services/authService';
import { generateUuid } from '@/utils/uuid';
import { logger } from '@/lib/logger';
import { promptService, type PromptSection } from '@/services/promptService';

export interface ComposerSaveDeps {
  currentPromptSession: any;
  setCurrentPromptSession: any;
  isSavingRef: { current: boolean };
  currentPromptSessionRef: { current: string | null };
  hasUnsavedChangesRef: { current: boolean };
  repairTitleRef: { current: string | null };
  setIsSavingPrompt: any;
  headerTab: string | null;
  surfaceTitle: () => string;
  readWorkspaceState: () => Record<string, unknown> | undefined;
  handleConversationChange: (id: string | null, surface?: 'console' | 'composer') => void;
  assembleConsole: () => void;
  toast: any;
}

export function useComposerSave(depsRef: { current: ComposerSaveDeps | null }) {


  const handleSavePrompt = async (
    compiledOutput?: string,
    providedSections?: any[],
    opts?: { keepSurface?: boolean; title?: string },
  ) => {
    const deps = depsRef.current;
    if (!deps) return;
    const {
      currentPromptSession,
      setCurrentPromptSession,
      isSavingRef,
      currentPromptSessionRef,
      hasUnsavedChangesRef,
      repairTitleRef,
      setIsSavingPrompt,
      headerTab,
      surfaceTitle,
      readWorkspaceState,
      handleConversationChange,
      assembleConsole,
      toast,
    } = deps;

    console.log('🔵 [SAVE] Save button clicked! Current session:', currentPromptSession?.id);
    // Serialization guard: prevent concurrent save operations.
    //
    // Wait for the save in flight: the id it is about to write is the id this caller needs.
    if (isSavingRef.current) {
      const deadline = Date.now() + 20000;
      console.log('⏸️ [CRUD] Save already in flight — waiting for it to land instead of skipping');
      while (isSavingRef.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      if (isSavingRef.current) {
        // THE SECOND PRESS IS NOT DROPPED IN SILENCE (2026-10-25): a save that could
        // not start says so, and the person presses again.
        toast?.({ title: 'Save did not start', description: 'The previous save is still in flight. Press Save again.' });
        return;
      }
      // The first save has landed; this call proceeds with the newer edits.
    }
    isSavingRef.current = true;
    setIsSavingPrompt(true);

    // ══════════════════════════════════════════════════════════════════════
    // A2UI: IMMEDIATE GRACE FEEDBACK — User sees response the moment they click
    // This is Grace acknowledging the command, not a static spinner.
    // Dispatches event so ResponsivePromptBuilder shows spinner on button.
    // ══════════════════════════════════════════════════════════════════════
    window.dispatchEvent(new CustomEvent('save-template-start'));

    try {
      let allSections: { name: string; content: string }[] = [];

      if (providedSections && providedSections.length > 0) {
        // ══════════════════════════════════════════════════════════════════════
        // ONLY PATH: sections from the Lit <prompt-section-editor>.
        // The Lit editor is the source of truth — it owns the shadow DOM textareas.
        // Both save-template and save-requested events pass sections here.
        // ══════════════════════════════════════════════════════════════════════
        allSections = providedSections.map((s: any) => ({
          name: s.name || s.section || s.role || s.type || 'Section',
          content: s.content || ''
        }));
        console.log('📦 [SAVE] Using sections from Lit editor:', allSections.length);
      } else {
        // ── NO SECTIONS: The Lit editor ref is empty or not mounted.
        // This means the composer surface hasn't loaded yet — bail out.
        console.warn('⚠️ [SAVE] No sections available — Lit editor not mounted or empty. Aborting save.');
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: { role: 'assistant', content: '⚠️ Nothing to save — the composer has no sections yet.' }
        }));
        isSavingRef.current = false;
        setIsSavingPrompt(false);
        window.dispatchEvent(new CustomEvent('save-template-end'));
        return;
      }

      // Build sections array - include ALL sections, even empty ones
      const sections: PromptSection[] = allSections.map((s) => ({
        id: generateUuid(),
        type: s.name as PromptSection['type'],
        content: s.content,
      }));

      console.log('📸 [SAVE] Capturing surface state:', {
        totalSections: sections.length,
        sectionNames: sections.map(s => s.type),
      });

      // ══════════════════════════════════════════════════════════════════════
      // GUARD: Do not send CRUD requests with a null session ID.
      // The backend CREATE path is functional, but we must not hit the
      // UPDATE path (PUT /api/prompt-sessions/null) which crashes PostgreSQL.
      // If no valid session ID exists, the save will use the CREATE path.
      // ══════════════════════════════════════════════════════════════════════
      const sessionId = currentPromptSessionRef.current;
      const isValidSessionId = sessionId && sessionId !== 'null' && sessionId.length > 0;
      // The name is settled here as well as at assembly, because THIS is the
      // boundary where a name becomes permanent — and Run is save-then-run when the
      // package has never been saved, so here is often the only chance it gets.
      // Order: what the session carries, then the repair that spawned it — but only
      // when this save is CREATING a package (`!isValidSessionId`). An UPDATE of an
      // existing package must never be renamed by a repair that merely happens to be
      // queued behind an unsaved-changes gate.
      // `opts.title` is the repair's own name, handed in by the caller that is
      // CREATING the package. Repair cannot leave it in `repairTitleRef` for this
      // to read: the assembly consumes that ref when the surface lands (see the
      // composer branch) and the closure here is still the pre-assembly render.
      // It is ignored for an UPDATE, like every other rename path: an existing
      // package is not renamed by a repair that merely passes through it.
      const title = (opts?.title && !isValidSessionId ? opts.title : null)
        /*
         * THE SURFACE'S OWN TITLE, BEFORE THE REACT COPY.
         *
         * The bar lives in the surface now, so a name given to a draft lives there too —
         * and it is the NEWEST name, where `currentPromptSession.title` is whatever the
         * last save returned. Read in this order, a prompt named and then saved keeps the
         * name the person gave it; read the other way round it would be saved under the
         * previous name, or under the timestamp fallback for a package being created.
         */
        || surfaceTitle()
        || currentPromptSession?.title
        || (repairTitleRef.current && !isValidSessionId ? repairTitleRef.current : null)
        || `Prompt - ${new Date().toLocaleString()}`;

      console.log('🤖 [AI] Calling AI save endpoint...');

      // ── THE WIDTHS, READ OFF THE ELEMENT THAT OWNS THEM ────────────────────
      //
      // The widths are the layout's own numbers — it renders the panes — so the host reads
      // them at the save exactly the way it reads workspaceState off the canvas (see the
      // place read below), through the same shadow-piercing helper.
      const columnWidths = deepFind<
        HTMLElement & { widths?: () => { left: number | null; chat: number } }
      >('composer-workspace')?.widths?.();

      // ── The place, as the operator left it ──
      //
      // READ BY ITS ONE READER (readWorkspaceState, above the save) — the Run's own state
      // write (saveRunState) reads the same facts through the same code, so the two writers
      // of `metadata.workspace` cannot drift apart. It reads the live elements: the layout's
      // left column, the canvas's seat and pan/zoom, the drawing's graph, and the column a
      // Run assembled (run_column, owner 2026-10-05) — each present only when it is on
      // screen, so a half-record cannot rearrange anything the server already holds.
      const workspace = readWorkspaceState();

      const savePayload = {
        session_id: isValidSessionId ? sessionId : undefined,
        title,
        left_column: {
          sections: sections.map((s, index) => ({
            section: s.type,
            role: s.type,
            content: s.content,
            position: index,
            visible: true,
          })),
        },
        middle_column: {
          compiled_output: compiledOutput || '',
        },
        right_column: {
          conversation_id: currentPromptSession?.conversationId || null,
        },
        column_widths: columnWidths,
        workspace,
      };

      const response = await fetch(`${API_BASE}/ai/save-surface`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': getStoredUserId(),
        },
        body: JSON.stringify(savePayload),
      });

      if (!response.ok) {
        throw new Error(`AI save failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`🤖 [AI] ${result.ai_message}`);

      if (!result.session_id) {
        throw new Error('AI save response missing session_id');
      }

      const savedSession = await promptService.getPromptSession(result.session_id);
      setCurrentPromptSession(savedSession);
      currentPromptSessionRef.current = savedSession.id;

      hasUnsavedChangesRef.current = false;
      // The repair name has now been written down; it must not follow this user
      // into the next package they save.
      repairTitleRef.current = null;

      // THE THREAD THAT WAS SPOKEN BEFORE THE PACKAGE EXISTED IS WRITTEN DOWN WITH IT.
      //
      // A turn spoken before the first Save has no conversation to live in — the backend
      // refuses it by design ("this turn will not be persisted": conversations.session_id
      // is NOT NULL, so there is nothing to bind it to) and it lives only in the seat. The
      // Save creates the package's conversation; without this hop that conversation starts
      // empty, and the person who reopens their package finds their own words missing —
      // the thread beside them is whatever the conversation carries, and an empty one
      // carries nothing. The pending turns travel in order; turns the backend already
      // owns are not touched. A save made from the console (a repair launched into a
      // package) skips this: its seat is the console's, not the package's.
      const savedConversationId = savedSession.conversationId || undefined;
      if (headerTab !== 'console' && savedConversationId) {
        const seat = deepFind<HTMLElement & { flushPendingTurns?: (id: string, sessionId?: string) => Promise<number> }>('composer-chat-panel');
        let written = 0;
        if (seat?.flushPendingTurns) {
          try {
            written = await seat.flushPendingTurns(savedConversationId, savedSession.id);
          } catch (err) {
            // NOT SWALLOWED. The flush writes the thread that was spoken before this package
            // existed; if it fails, those turns stay pending and the next Save retries — but
            // nobody was told, which is exactly the defect this line removes. The logger's
            // warn/error reach the Trace tab (lib/trace-source subscribes to it).
            logger.error('the pre-save thread could not be written into the package conversation', {
              conversationId: savedConversationId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        if (written) {
          console.log(`💬 [SAVE] ${written} turn(s) spoken before the package existed written into ${savedConversationId}`);
        }
        // The model learns the id through the ONE writer that already owns this fact —
        // the seat's own adoption path — so a re-render cannot drop it and every later
        // turn persists server-side instead of waiting for the next Save.
        handleConversationChange(savedConversationId, 'composer');
      }

      // If user is on console, re-assemble to show updated cards.
      // If on composer, just update the session state (already done above).
      //
      // NOT when the caller is putting a prompt IN the column (`keepSurface`): a
      // save made at launch (Repair) would otherwise swap the composer — and the
      // repair prompt inside it — for the package list it was launched from.
      if (headerTab === 'console' && !opts?.keepSurface) {
        assembleConsole();
      }

      // ✅ Toast: save succeeded
      toast({
        title: "Template saved",
        description: `Saved with ${allSections.length} sections`,
        duration: 3000,
      });
    } catch (error) {
      console.error('❌ [CRUD] Save failed:', error);
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      // ✅ Toast: save failed
      toast({
        title: "Save failed",
        description: errMsg,
        variant: "destructive",
        duration: 5000,
      });
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: { role: 'assistant', content: `⚠️ Save failed: ${errMsg}` }
      }));
    } finally {
      isSavingRef.current = false;
      setIsSavingPrompt(false);
      // Signal to ResponsivePromptBuilder that save is complete
      window.dispatchEvent(new CustomEvent('save-template-end'));
    }
  };

  return { handleSavePrompt };
}
