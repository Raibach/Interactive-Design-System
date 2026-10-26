/**
 * THE COMPOSER'S HALF OF THE ASSEMBLY — what a `render-composer` or `render-session` answer
 * becomes on screen.
 *
 * Moved out of `console/useAssembleSurface.ts` on 2026-10-24 (Stage 2c.1) with no behavior
 * change. The fetch, the envelope and the failure classification stay in the hook; this file
 * reads the model the server returned and writes the Composer's own state. The Console keeps its
 * own branch in the hook.
 */
import { markArrival } from '@/shared/arrival';

export const ROOM_SURFACES = new Set([
  'composer',
  'console',
  'product',
  'development',
  'governance',
  'design',
]);

export interface ApplyComposerSurfaceDeps {
  dataModel: Record<string, any>;
  setCurrentPromptSession: any;
  hasUnsavedChangesRef: { current: boolean };
  repairTitleRef: { current: string | null };
  headerTabRef: { current: string | null };
  setHeaderTab: (tab: string) => void;
  repairAskRef: { current: { text: string; buttons: string } | null };
}

export function applyComposerSurface({
  dataModel,
  setCurrentPromptSession,
  hasUnsavedChangesRef,
  repairTitleRef,
  headerTabRef,
  setHeaderTab,
  repairAskRef,
}: ApplyComposerSurfaceDeps) {
  // Extract session from data model
  const session = dataModel.session || {};
  const sections = session.left_column?.sections || [];
  const metadata = dataModel.metadata || {};

  // Map raw_content if available, otherwise construct from sections
  const leftColumnContent = session.left_column?.raw_content || JSON.stringify({
    sections: sections.map((s: any, i: number) => ({
      name: s.name || s.section || s.role || 'Section',
      content: s.content || '',
      type: s.type || s.role || s.name || 'custom',
      position: i,
      visible: true,
    }))
  });

  const assembledSession = {
    id: session.id || null,
    userId: 'default-user',
    title: session.title || dataModel.suggested_title || 'New Prompt Agent',
    /*
     * THE DESCRIPTION RIDES THE SAME HOP AS THE WORKSPACE BELOW, and for the same reason:
     * the surface holds it (`/session/description`) and this object did not carry it, so the
     * row's copy was undefined for every package opened — and the pre-Run review, which read
     * this copy, told the person their description was missing while the seat beside the Run
     * read it off the surface and disabled the button that would have added it. One fact and
     * one reader now (shared/packageFacts), and this is the copy that reader falls back to.
     */
    description: session.description || '',
    leftColumnContent,
    compiledOutput: session.middle_column?.compiled_output || '',
    conversationId: session.right_column?.conversation_id || null,
    isActive: true,
    isArchived: false,
    currentVersion: metadata.version || 1,
    createdAt: metadata.created_at || new Date().toISOString(),
    updatedAt: metadata.updated_at || new Date().toISOString(),
    lastAccessedAt: metadata.last_accessed_at || new Date().toISOString(),
    metadata: {},
    is_unsaved: session.is_unsaved ?? !session.id,
    // THE PLACE IT WAS LEFT, carried through the assembly the way column_widths is —
    // the backend puts it under /metadata/workspace, and without this hop the reopen
    // never saw it: the restore effect reads currentPromptSession.workspace, and a
    // session built here without it reopens "where it was left" only in the record.
    workspace: metadata.workspace || undefined,
  };

  setCurrentPromptSession(assembledSession as any);
  /*
   * A LANDED SURFACE IS THE LOADED STATE, NOT AN EDIT.
   *
   * `assembledSession.is_unsaved` means "this package has never been saved" — a draft. The
   * Save control reads it, and that is its own fact. The EXIT GATE asks a different question:
   * has the person changed anything since this surface landed? At the moment it lands, the
   * answer is no, even for a blank Composer with its three starter seats. Only typing and
   * programmatic edits arm the gate afterwards (`_section-update` and the input listener).
   *
   * Measured 2026-10-25: opening the Composer from the Console showed Save/Discard on an
   * untouched Composer, because the draft's `is_unsaved` was copied into this ref.
   */
  hasUnsavedChangesRef.current = false;

  // A repair names its own package, and this is where it lands — not in the
  // click handler. A repair can be stopped by the unsaved-changes gate and
  // resumed by the user's answer, and every resumed assembly arrives HERE;
  // naming it at click time would leave the resumed one called "Untitled
  // Prompt". Only a fresh package is renamed: repairing from inside an open
  // package is an edit of that package, not a new one.
  if (repairTitleRef.current && (assembledSession.is_unsaved || !assembledSession.id)) {
    const repairTitle = repairTitleRef.current;
    repairTitleRef.current = null;
    setCurrentPromptSession((prev: any) =>
      prev ? { ...prev, title: repairTitle, is_unsaved: true } : prev,
    );
  }
  if (!ROOM_SURFACES.has(headerTabRef?.current || '')) setHeaderTab('composer');
  /*
   * A SURFACE HAS OPENED — the seat may greet.
   *
   * WHICH SURFACE MATTERS. A composer with no package behind it is a blank
   * page: she introduces herself. An EXISTING package is a place the work was
   * left: she greets from where it stopped, which is useful whether or not
   * the thread has turns — the turns are what she is greeting about. The
   * package's id is what tells them apart; a composer being drafted has none.
   *
   * SAID TWICE, ON PURPOSE, because the seat may not exist yet. This host
   * cannot tell the seat apart from the console's — the only property that
   * differs arrives as an empty array here rather than as absent — and the
   * seat is created by the commit this handler is part of, so an event alone
   * is fired before there is anything to hear it. Measured: announced here,
   * nothing happened; the same event a moment later produced the greeting
   * immediately. So the fact is RECORDED as well as sent (shared/arrival),
   * and whichever reaches the seat first is the one that works.
   */
  const arrivalKind = session.id ? 'resume' : 'blank';
  // Only a BLANK composer is announced from here. A package opening is
  // announced by handleOpenPromptFromConsole, where "a package is being
  // opened" is a fact rather than something inferred from an id being
  // present — and this branch also runs when a session surface is re-applied
  // without anybody opening anything.
  if (arrivalKind === 'blank') {
    markArrival('blank');
    window.dispatchEvent(new CustomEvent('a2ui:composer-opened', {
      detail: { kind: 'blank' },
    }));
  }

  // ── HER GREETING, WHEN IT IS ANSWERING SOMETHING ───────────────────────
  // Every other assembly's ai_message is deliberately NOT posted (see the note
  // where `aiMessage` is read): an assembly is not a turn, and nobody asked. A
  // REPAIR is the exception — the person clicked REPAIR and is looking at a form
  // they cannot finish alone, so the message that describes it answers what they
  // just did.
  //
  // The flag is the SERVER's, set only when the brief actually rode this assembly.
  // So the greeting is posted only when she was really given it, and a repair whose
  // brief went missing does not fake one.
  // Her reply was posted above, by the surface branch — this adds only the half she
  // must NOT author: one button per answer, wired to `fill-field`. Sent as its own
  // message on purpose. Hers is prose and these are app-rendered controls, and a
  // reader can tell those apart; fused into one bubble they would not be able to.
  if (dataModel.repair_brief && repairAskRef.current?.buttons) {
    window.dispatchEvent(new CustomEvent('a2ui:system-message', {
      detail: { role: 'assistant', content: repairAskRef.current.buttons },
    }));
    console.log('[repair] answer buttons attached under her reply');
  }
  // Either way the ask is consumed: a stale ask must not fire on a later assembly.
  if (dataModel.repair_brief) repairAskRef.current = null;

  console.log(`✅ [A2UI] Composer assembled with ${sections.length} sections`);
}

export interface ApplyDecisionSurfaceDeps {
  dataModel: Record<string, any>;
  setAiDecision: any;
}

export function applyDecisionSurface({ dataModel, setAiDecision }: ApplyDecisionSurfaceDeps) {
  // ═══════════════════════════════════════════════════════════════════════════════
  // A2UI v0.9: AI-driven decision dialog
  // AI returns a decision surface when user action requires confirmation
  // ═══════════════════════════════════════════════════════════════════════════════
  const decisionType = dataModel.decision_type;
  const actions = dataModel.actions || [];
  const aiMessage = dataModel.ai_message || 'Please make a choice.';
  const pendingIntent = dataModel.pending_intent || '';
  const sessionId = dataModel.session_id || null;

  console.log(`🤖 [A2UI] Decision surface: ${decisionType}`, { actions, pendingIntent });

  setAiDecision({
    show: true,
    message: aiMessage,
    actions,
    pending_intent: pendingIntent,
    decision_type: decisionType,
    session_id: sessionId,
  });
}
