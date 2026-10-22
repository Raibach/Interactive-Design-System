/**
 * THE SHELL'S WINDOW-EVENT WIRING — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * WHY IT LIVES HERE. The page was one 11,700-line component holding every room's wiring at once;
 * this effect alone was 635 lines. Moved, not rewritten: the statement's text is identical and
 * every name it closes over is passed in by name, so the listeners register, fire and clean up
 * exactly as they did inside the page.
 *
 * WHAT IT OWNS. The `window` events the assembled rooms and the shell's own controls dispatch —
 * save-template, run-requested, the tab-switch asks, the rail's tool events — plus their
 * teardown. Every listener this effect adds is removed in its cleanup.
 *
 * THE DEPENDENCY LIST IS THE CONTRACT. `ShellEventDeps` is the complete set of things the effect
 * needs from the page; if the effect starts reaching for something new, the compiler refuses until
 * that name is added here — which is the point of the move.
 */
import { useEffect } from 'react';
import { deepFind } from '@/canvas/pageHelpers';
import { logger } from '@/lib/logger';
import { rowForAddedNode, type FlowSeatInput } from '@/shared/agentFlow';
import { seatIdOf } from '@/shared/promptSections';
import { withTrigger } from '@/shared/triggers';

/** Exactly what the effect needs from the shell, by name. */
export interface ShellEventDeps {
  consoleRendererRef: any;
  deletePackageRef: any;
  handleConversationChange: any;
  handleRepairFinding: any;
  handleSavePromptRef: any;
  handleTabChangeWithGate: any;
  headerTab: any;
  patchSectionAt: any;
  publishFlowFromRows: any;
  readLiveOutput: any;
  setWorkspaceTree: any;
  showDraftColumn: any;
  showOutputColumn: any;
  surfaceSections: any;
}

export function useShellEventListeners(deps: ShellEventDeps) {
  const { consoleRendererRef, deletePackageRef, handleConversationChange, handleRepairFinding, handleSavePromptRef, handleTabChangeWithGate, headerTab, patchSectionAt, publishFlowFromRows, readLiveOutput, setWorkspaceTree, showDraftColumn, showOutputColumn, surfaceSections } = deps;
  useEffect(() => {
    const onRepairFinding = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { findingId?: string };
      if (detail.findingId) {
        void handleRepairFinding(detail.findingId, { current_surface: headerTab || 'composer' });
      }
    };
    const onConversationChange = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { conversationId?: string };
      /*
       * AN EMPTY ID IS A FACT, NOT A MISSING ONE — and dropping it cost a save.
       *
       * This returned on any falsy id, so the one case that needed the model to hear it was the
       * one thrown away: the seat moving OFF a conversation (the person removed the thread they
       * were in — see _removeConversation). The model kept the deleted id, Save wrote it into
       * `prompt_sessions.conversation_id`, and the foreign key refused it — "AI save failed: 500",
       * the owner, 2026-09-23: "if we fix the conversation ID and it works, then suddenly saving a
       * prompt doesn't work anymore." `undefined` is still nothing to report; an EMPTY STRING is
       * "this place has no conversation", and it is written like any other value.
       */
      if (detail.conversationId === undefined) return;
      // Which tree raised it decides which path is written. Both seats dispatch this same
      // event, and each reads its conversation from its own path — the composer's seat from
      // /session/right_column/conversation_id, the console's from /console/conversation_id —
      // so the event's path through the DOM is what says which one spoke. The renderer in
      // the path is the surface.
      const path = typeof (event as Event & { composedPath?: () => EventTarget[] }).composedPath === 'function'
        ? (event as Event & { composedPath: () => EventTarget[] }).composedPath()
        : [];
      const consoleSpeaking = !!consoleRendererRef.current && path.includes(consoleRendererRef.current);
      // An empty id travels as NULL — the one value that means "no conversation here", and the one
      // the save can write into a nullable foreign key.
      handleConversationChange(detail.conversationId || null, consoleSpeaking ? 'console' : 'composer');
    };
    /**
     * THE CANVAS'S OWN FOUR EVENTS.
     *
     * All new names, all heard HERE, in the same pass that emits them: an emitted
     * event with no listener is what the catalog audit reports as event-unheard, and
     * it also reads to a person as a control that works. What each does today is
     * stated rather than invented:
     *
     *   flow-node-moved  the node is where the person put it. Positions live in the
     *                    element for now; this records them so a decision to persist
     *                    them has somewhere to start.
     *   flow-select      the selection, recorded. Clicking a node asks nothing of
     *                    Grace YET — how she speaks about the flow is the open
     *                    question in AGENTIC_EDITOR/06, not a guess to make here.
     *   flow-connect     a connection drawn by hand. The graph's edges come from the
     *                    run, so this records what the canvas cannot yet do.
     *   flow-action      the node toolbar and the canvas controls.
     *
     * Everything lands in the app logger, which is the operator's own view — the
     * Trace tab reads it. Honest, and out of Grace's seat until we decide her words.
     */
    const onFlowNodeMoved = (event: Event) => {
      logger.info('flow node moved', ((event as CustomEvent).detail || {}) as Record<string, unknown>);
    };
    /**
     * THE LINK, BOTH WAYS — the floor this view was missing.
     *
     * A picked note is a question about a piece of the conversation, and the playground has
     * answered it since the canvas existed: the turn about that note is marked in her thread,
     * her header says what the note is, and a click on that turn puts the note back under the
     * person's eye. In the app NONE of it happened, and the reason is structural: her column
     * and the drawing are SIBLINGS here (the drawing in the middle pane, she in the right), so
     * the two elements never meet. The canvas unit listens for `flow-select` to mark her turn —
     * but she is not its child any more, so it finds no seat to mark; and the turn's
     * `turn-click` never crosses out of the right pane into the middle one. The page is the one
     * place that knows both halves, so the wiring lives here — the playground's own rule:
     * "Neither view reaches into the other… the wiring between them is here, in the host."
     *
     * WHAT SHE DOES ABOUT A PICK — opening her column, 650 wide — is deliberately NOT here:
     * the element that owns her width hears `flow-select` itself and performs it.
     */
    const onFlowSelect = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { nodeId?: string | null };
      logger.info('flow select', detail as Record<string, unknown>);
      const nodeId = detail.nodeId ?? null;
      const panel = deepFind<HTMLElement & { statusText?: string }>('chat-panel');
      const messages = panel?.shadowRoot?.querySelector('chat-messages') as
        | (HTMLElement & { highlightNodeId?: string | null })
        | null;
      if (messages) messages.highlightNodeId = nodeId;
      if (!nodeId || !panel) return;
      const nodes = deepFind<HTMLElement & { flow?: { nodes?: Array<{ id: string; title: string; kind: string; state: string }> } }>('agent-flow')?.flow?.nodes ?? [];
      const node = nodes.find((n) => n.id === nodeId);
      if (node) panel.statusText = `${node.title} | ${node.kind} — State: ${node.state}`;
    };
    /** And the other half: a turn clicked is its note brought back under the eye. */
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
      // The view's own gestures are not news: one line per wheel notch would bury
      // the operator's feed under the canvas's zoom.
      if (action === 'zoom' || action === 'fit') return;
      /*
       * ONE READER OF THE DRAWING, for the branches below that need a node's own facts. The type
       * carries `rowIndex` because a node knows the address of the row it is (see FlowNode) — the
       * same address the trigger branch reads. It used to be declared per-branch, which is how two
       * readers of one fact drift.
       */
      type FlowNodeShape = {
        id: string; family: string; kind: string; title: string; subtitle?: string; rowIndex?: number;
      };
      const nodeById = (nodeId: string): FlowNodeShape | undefined =>
        (deepFind<HTMLElement & { flow?: { nodes?: FlowNodeShape[] } }>('agent-flow')?.flow?.nodes ?? [])
          .find((n) => n.id === nodeId);
      /*
       * ▶ RUN THIS STEP — THE SAME RUN PATH THE FOOT'S PLAY MAKES.
       *
       * The toolbar's play was DEAD: it emitted `flow-action{action:'run'}` and the only thing that
       * answered was the logger line at the bottom of this handler — measured 2026-10-02 by driving
       * the app: the event recorded, nothing happened. It now dispatches the same `run-requested`
       * the canvas footer's Play dispatches, so there is ONE run path: the review gate holds it when
       * it must, the same spinner runs, and the drawing locks for the run's flight (setCanvasRunning).
       * Nothing is ever executed "for one step" — a step is what a Run does.
       */
      if (action === 'run') {
        window.dispatchEvent(new CustomEvent('run-requested'));
        return;
      }
      /*
       * ✨ ASK GRACE ABOUT THIS — HER OWN CHANNEL, WITH THE NODE'S OWN FACTS.
       *
       * The same division of labour as the delete branch below: the request carries what the node IS
       * (whether it is a row, its kind, its title, the first of its line, its row's address when it
       * has one) so her answer is about THIS node — and nothing is written and nothing is asked of
       * the person. She answers in the thread, which is where this app does its talking.
       */
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
      /*
       * DELETING A NODE IS DELETING ITS ROW — AND SHE IS THE ONE WHO ASKS.
       *
       * The brief's last increment: "Removing a node removes its row — through `remove-seat`, and
       * with her asking first, exactly as a row removal does today" (READ-ME/CANVAS-AND-PROMPT.md
       * §4.5). So this does NOT delete anything. It tells her what was pressed and hands her the
       * facts, and the removal happens the way every other removal in this app happens: as a
       * button she offers and the person presses (`remove-seat:<name>`, the one destructive repair
       * that already exists — see actionLink).
       *
       * WHAT SHE IS GIVEN, so her sentence is about THIS node: whether it is a row at all, which
       * row, and whether that row holds words — because "remove it" costs nothing on an empty row
       * and costs work on a written one, and only one of those deserves a warning. A STEP node is
       * not a row (it is what a Run does — the answer, the write, the check), so it cannot be
       * removed here, and she says so rather than offering a button that would remove nothing.
       */
      if (action === 'delete') {
        const nodeId = String(detail.nodeId || '');
        const node = nodeById(nodeId);
        if (!node) return;
        // Matched on the canonical id first — see the note in the `trigger` branch: a node wears the
        // seat's LABEL and a row answers to its own name, so a name comparison misses.
        const rows = surfaceSections();
        const row = rows.find((s: any) => String(seatIdOf(s) || '') === String(node.kind || ''))
          ?? rows.find((s: any) =>
            String(s?.name || '').trim().toLowerCase() === String(node.title || '').trim().toLowerCase());
        const isRow = node.family === 'seat' && Boolean(row);
        /*
         * THE TRASH REMOVES, AND SAYS SO. This used to ask instead: it handed her the facts and
         * waited for a button, so pressing Delete did NOTHING visible — the owner, 2026-09-24:
         * "I can't delete anything… there is no functionality here."
         *
         * He is the authority on that rule and he has just replaced it. The reasoning it was built
         * on still holds — a destructive act should not be silent — so the act is now LOUD in the
         * other direction: the row goes (the same `remove-prompt-role` write the rest of the app
         * uses, so the drawing rebuilds from the rows and the node goes with it), and she is TOLD,
         * in her own voice, as a record rather than a question. The node in front of the person is
         * the confirmation; a second one is a quiz.
         *
         * A STEP is still refused, and that has not changed: a step is what a Run did, so there is
         * nothing here to remove, and she says so rather than a control that quietly does nothing.
         */
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
        // AND THE DRAWING FOLLOWS THE ROW OUT — handed the rows as this writer knows them, so the
        // node goes in the same breath as the row. The element's own `section-remove` still updates
        // the model; this is the picture keeping step with it rather than waiting for a commit.
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
      /*
       * A TRIGGER CHOSEN ON THE DRAWING IS WRITTEN INTO ITS ROW — the other half of the symmetry
       * the owner asked for: "edits on the canvas should be reflected in the prompt, edits on the
       * prompt should be reflected in the canvas; it's a learning tool."
       *
       * The canvas emitted the choice and nothing else, because it holds no copy of the row's text
       * and must not invent one. The row is found the way the delete branch finds it — by the name
       * the node wears, which is the row's own name — and the new text is computed by the ONE
       * function that knows what a re-pick means (`withTrigger`, shared by both views), then
       * written through the one writer the editor already listens to. So the row changes, the
       * graph rebuilds from the rows, and the node comes back wearing the same trigger the menu
       * now ticks: one fact, one writer, two views.
       */
      if (action === 'trigger') {
        const nodeId = String(detail.nodeId || '');
        const token = String(detail.token || '');
        if (!nodeId || !token) return;
        const node = nodeById(nodeId);
        if (!node || node.family !== 'seat') {
          // A step is what a run does; nothing starts it but the run it belongs to. Reported rather
          // than silently dropped, because a control that does nothing reads as a broken control.
          logger.warn('a trigger was chosen on a node that is not a row', { nodeId });
          return;
        }
        const rows = surfaceSections();
        /*
         * BY PATH FIRST, THEN BY CANONICAL ID, THEN BY NAME — in that order, and the order is the
         * point. The node carries `rowIndex`, which IS the address of its row in the model
         * (`/session/left_column/sections`), so the common case is an index lookup with nothing to
         * misspell — A2UI's own rule for an action's context (Data-Binding.md: a data reference is
         * resolved "by path in the data model or by value"). The id and name fallbacks stay for a
         * caller that has no index: an older payload, or a node the builder did not place.
         */
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
        // THE WRITE IS AN UPDATE AT A PATH, WHICH IS A2UI'S OWN SHAPE. Data-Binding.md: a data
        // reference "is resolvable either by path in the data model or by value". Handling-User-
        // Actions.md: an action carries `context`, "a hand-picked VIEW of that state", and the
        // renderer resolves its paths before dispatch. So the node's `rowIndex` IS the address of
        // its row, and the edit lands at `/session/left_column/sections/<index>` through the host's
        // one writer for that path. The binding then re-assigns the rows to the editor element, and
        // the drawing is rebuilt from them — the same direction of travel as every model update in
        // this application, with no window event and no name to re-match.
        const index = typeof detail.rowIndex === 'number' && (detail.rowIndex as number) >= 0 && (detail.rowIndex as number) < rows.length
          ? (detail.rowIndex as number)
          : rows.indexOf(row);
        if (index < 0) {
          logger.warn('a trigger was chosen with no addressable row to write it into', { nodeId: detail.nodeId });
          return;
        }
        const nextContent = withTrigger(String((row as { content?: string }).content || ''), token);
        patchSectionAt(index, { ...row, content: nextContent });
        // AND THE DRAWING FOLLOWS THE WRITE, NOT THE MODEL'S NEXT COMMIT — the rows are handed to
        // the rebuild because this caller is the one that just changed them. See publishFlowFromRows.
        const nextRows = rows.map((r: any, i: number) => (i === index ? { ...r, content: nextContent } : r)) as FlowSeatInput[];
        publishFlowFromRows(undefined, nextRows);
      }
      logger.info(`flow action: ${action}`, detail);
    };
    /**
     * THE AGENT BUTTON RUNS THE COMPOSER'S OWN CONTROL.
     *
     * Its annotation (#40001120:6641) reads:
     *   On click:  dispatch loads-cards-form-console-in-prompt-area   ← the element does this
     *   Connects:  loads the console's prompt packages into the left column
     * and the owner, 2026-09-19, on what the click should do: "it's not opening a new [package]…
     * you can use the same controls that you have on composer." So it calls the composer's own
     * control — the same `handleTabChangeWithGate('composer')` the Composer tab calls — which
     * starts a FRESH package (session_id null, title empty) and never reloads the card the
     * person had open. Nothing new is invented for it; if the two ever diverge, they diverge in
     * that one function.
     *
     * (The event NAME is the old function's, kept because it is the name the design's note
     * dispatches — a name is an address, and the note is where this one is written down.)
     */
    const onAgentButton = () => {
      void handleTabChangeWithGate('composer');
    };
    /**
     * ...AND THE SAME BUTTON POINTS THE OTHER WAY FROM A PACKAGE. There it reads "Console" and
     * opens the console — the same `handleTabChangeWithGate('console')` the Console tab calls,
     * so the two directions are one pair of controls rather than two lookalikes.
     * The element decides which name to dispatch from the seat it was told it is
     * (chat-panel reads that from the session row); this end only listens.
     */
    const onOpenConsole = () => {
      void handleTabChangeWithGate('console');
    };
    window.addEventListener('open-console', onOpenConsole);
    window.addEventListener('loads-cards-form-console-in-prompt-area', onAgentButton);
    window.addEventListener('repair-finding', onRepairFinding);
    window.addEventListener('conversation-change', onConversationChange);
    /**
     * THE CANVAS ANNOUNCES ITSELF — AND SHE SAYS WHAT IT HOLDS.
     *
     * This is the two halves of one loop. The canvas stays the clean working area: it
     * emits `flow-opened` with what it was handed (counts, and every row it could not
     * name or step it did not draw). The sentence is HIS app's, spoken through the
     * same channel the repair verdicts use, so the drawing and the conversation agree
     * about what just happened — the canvas never carries the noise itself.
     *
     * The seat is where it lands; nothing about the conversation model changes.
     */

    /**
     * THE BLANK ONES ARE NEWS TOO, and they ride the announcement the canvas already makes.
     *
     * A seat with nothing written in it used to pass in silence — an empty tile and a quiet
     * chat — so the most likely first move in this demo (open a prompt nobody has written in,
     * run it) produced a picture and no words. The owner, 2026-09-18: "we need to send her a
     * notification for blank nodes, and tell her to load a section in the chat that represents
     * them… just simply say they're blank — would you like to work on this one?"
     *
     * The turn carries the node's id and its name, which is what makes it a CARD rather than a
     * sentence: clicking it points the canvas at the seat it is about.
     */
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
      // THE BLANKS FIRST, THEN THE SUMMARY — and from HERE, not from a second listener.
      //
      // They used to be two `flow-opened` listeners: a named one for this summary, and an
      // INLINE arrow for the blank seats that the effect's cleanup never removed. The effect
      // re-runs while a run progresses, so the inline one stacked up — measured in the running
      // app: 88 copies of two sentences (2 blanks x 44 accumulated listeners) while this summary
      // spoke once, which is exactly how the duplication looked on screen (owner, 2026-09-18:
      // "when I run, Grace output — it duplicates"). One event, one listener, one place to
      // remove it. Order kept: the seats are spoken before the sentence about the flow.
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
      /*
       * AND THE SAME TWO FACTS GO WHERE THE PERSON IS ALREADY LOOKING: the message line at the
       * top of her column. That line is the readout for whatever is on screen — the note you
       * picked, or what this drawing could not say — and the owner pointed these facts at it
       * (2026-09-18: "Those messages should appear at the very top of Grace… that's where we're
       * supposed to have messages like [tool-call: the prompt names no tool…]"). The words are
       * the graph's own, unchanged, so the drawing's omission and her sentence cannot drift.
       * The DRAWING no longer prints them: it never narrates (see agent-flow's render).
       */
      const notes: string[] = [];
      if (d.unresolved?.length) {
        notes.push(
          `${d.unresolved.length} row${d.unresolved.length === 1 ? '' : 's'} could not be named: ${d.unresolved.join(', ')}`,
        );
      }
      if (d.absent?.length) notes.push(d.absent.map((a) => `${a.step}: ${a.why}`).join(' · '));
      const readout = deepFind<HTMLElement & { statusText?: string }>('chat-panel');
      if (readout && notes.length) readout.statusText = notes.join(' · ');
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: { role: 'assistant', content: line },
      }));
    };
    /**
     * A NODE THE PERSON PULLED OUT OF THE CANVAS IS A ROW IN THE PROMPT.
     *
     * THIS USED TO SAY THE OPPOSITE, and it was honest then: the node was a draft, the drawing
     * had it and the package did not, and nothing was saved. That is the thing this replaces.
     * The brief's one invariant is that every node action has a prompt meaning or it does not
     * exist, because a node that lives in the drawing and nowhere else is a lie told by the
     * picture — and the picture is what a person trusts most (READ-ME/CANVAS-AND-PROMPT.md §2).
     *
     * SO THE ADD IS A WRITE, through the person's own path rather than a second one. `_seatFor`
     * in <prompt-section-editor> already makes a row that is not there — named from the
     * declaration, label and type together, never a spelling the drawing invented — and it is
     * reached by the same `set-left-column-text` a chat button uses. The row starts EMPTY: the
     * words are the person's own, and they are one set of words whether typed in the row or read
     * off the node. The drawing is rebuilt from the rows the moment it lands (publishFlowFromRows
     * through the `section-add` listener), which is also what retires the element's draft.
     *
     * AND WHEN IT CANNOT BE DONE, GRACE SAYS SO — she is on the right, watching, and this is
     * her half of it. Two refusals, both hers to deliver:
     *   · a kind no seat is declared for — a row invented for it would be drawn with a shape
     *     nobody agreed on (promptSections' UNDECIDED rule);
     *   · a row the prompt already has — where the only write available would SET that row's
     *     content and erase words the person cannot see.
     * Making a mistake on the canvas is ALLOWED, and the node may sit there red. What is not
     * allowed is silence about it: this is a training tool as much as it is a flow, and the
     * person learns by being told, in her words, that it does not work here.
     */
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
    window.addEventListener('flow-node-moved', onFlowNodeMoved);
    window.addEventListener('flow-node-added', onFlowNodeAdded);
    window.addEventListener('flow-select', onFlowSelect);
    window.addEventListener('turn-click', onTurnClick);
    window.addEventListener('flow-connect', onFlowConnect);
    window.addEventListener('flow-action', onFlowAction);
    /**
     * THE TONE SWITCH ASKS, THE HOST WRITES — the same split as every other write here.
     *
     * <canvas-footer> carries the master's tone control and emits `theme-change`; it does
     * not reach across the tree to restyle a sibling, because a footer does not know where
     * the drawing is (and an element that did would be the wrong model twice over). Two
     * things take the tone: the CONTAINER, whose ground her column stands on, and the
     * DRAWING itself, which owns the ink and the grid.
     */
    const onThemeChange = (event: Event) => {
      const theme = String((event as CustomEvent).detail?.theme ?? '');
      setWorkspaceTree((prev) => {
        const comps = Array.isArray(prev.components) ? prev.components : [];
        /*
         * BY ROLE, NOT BY ID — the tone reaches the three components that take it: the CONTAINER
         * (whose ground her column stands on), the DRAWING (which owns the ink and the grid) and
         * the column's FOOT (its own tone switch). This listed the ids the host used to invent
         * (`canvas-footer-view`, `flow-view`) and the model names its components now, so two of the
         * three silently stopped taking the tone: the switch moved the canvas and left the foot and
         * the drawing behind. The component NAMES are the contract — they are what the catalog
         * validates and what the assembly emits. The owner, on the class of fault: "one fact, one
         * reader" (READ-ME/CONTINUE-HERE.md §4).
         */
        const takesTheme = (c: any) =>
          c?.component === 'RoomEmbed'
          || c?.component === 'AgentFlow'
          || c?.component === 'CanvasFooter';
        const next = comps.map((c: any) => (takesTheme(c) ? { ...c, theme } : c));
        return { ...prev, components: next };
      });
    };
    window.addEventListener('theme-change', onThemeChange);

    /**
     * THE FOOT'S CONTROLS, WIRED TO THE PATHS THAT ALREADY EXIST — none of them is new.
     *
     *   canvas-play   the same run the control bar's RUN makes: this dispatches the request
     *                 the editor's own button dispatches, so there is one run path, not two
     *   canvas-reset  the way back that the column's own selector was supposed to give: the
     *                 middle column returns to the last output (showOutputColumn)
     *   canvas-save   the same save as Save Template, which is also what a Run does before
     *                 it runs — the owner's "save options… when they run and when they exit"
     *
     * A control that emitted into the void would be the `tag-inert` finding this repo keeps
     * writing checks for: every event here has a listener in the same change.
     */
    const onCanvasPlay = () => window.dispatchEvent(new CustomEvent('run-requested'));
    const onCanvasReset = () => {
      showOutputColumn();
      /*
       * AND THE REST OF THE PLACE GOES BACK WITH IT. The swap above takes the canvas out of the
       * middle column; the ARRANGEMENT — the prompt out of its rail, her column open at her
       * width — belongs to the layout that lays it out, so the layout is ASKED to put it back
       * (owner, 2026-09-18: "it should just reset it… it doesn't look like it does"). Before
       * this, Reset left the prompt docked where the Run had put it and her column wherever the
       * last drag had left it: the canvas left, and nothing else did.
       */
      deepFind<HTMLElement & { resetArrangement?: () => void }>('workspace-layout')
        ?.resetArrangement?.();
    };
    /* THE FOOT SAYS IT IS WORKING, BECAUSE IT IS. The save control carried no state while
       the write was in flight (owner, 2026-09-21: "it's not got a spinner like the other
       buttons… to let the user know it's doing something"). Set here and cleared in the
       finally below, so the spinner lasts exactly as long as the save — no timer, no
       minimum display time, no fake progress. */
    const setFooterSaving = (saving: boolean) => {
      setWorkspaceTree((prev) => {
        const comps = Array.isArray(prev.components) ? prev.components : [];
        /*
         * BY ROLE, NOT BY ID, and this one was invisible until the owner looked at the button:
         * "same spinner was on the save button but now it's gone." It matched `canvas-footer-view`
         * — an id the HOST handed the footer when it wrote the canvas itself — so once the model
         * began assembling the column (read-run; the footer is `<middle id>-footer` now) this map
         * matched nothing, and the canvas's Save spun only in the version of the app that no
         * longer exists. A miss here is silent by construction, which is why the id had to go.
         */
        const isFooter = (c: any) =>
          c?.component === 'CanvasFooter' || c?.component === 'canvas-footer';
        const next = comps.map((c: any) => (isFooter(c) ? { ...c, saving } : c));
        return { ...prev, components: next };
      });
    };
    const onCanvasSave = async () => {
      // THE FOOT'S SAVE TAKES THE SAME TWO READINGS its siblings do — the control bar's Save and
      // the surface's own save-template both hand the save the sections and the live output.
      // This one called it with NO arguments, and a save with no sections throws on the way to
      // its payload: the foot logged "[CRUD] Save failed", no request was sent, and nothing was
      // written (owner, 2026-09-18: "the save feature on the canvas is not saving"). Same two
      // helpers as the others, so there is still exactly one way to read the column and one way
      // to save it.
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
    /**
     * THE CONSOLE TOLD US IT TURNED A PAGE. It carries no data the shell must act on — the
     * grid owns its own page — but an event nobody hears is the `event-unheard` finding this
     * repo keeps writing checks for, and it is right: a control that says something into a
     * room with nobody in it is a wire connected at one end. So the page change is recorded,
     * like the canvas's own events are.
     */
    /**
     * A CARD SAID IT WAS DELETED. Its own two-step confirm is the whole confirmation (arm,
     * then CONFIRM), so this deletes and takes the card out of the list — see deletePackage:
     * no re-assembly, because the packages are a list in the data model.
     */
    const onCardDelete = (event: Event) => {
      const sessionId = String((event as CustomEvent).detail?.sessionId ?? '');
      if (sessionId) void deletePackageRef.current(sessionId);
    };
    window.addEventListener('card-delete', onCardDelete);

    const onCardPage = (event: Event) => {
      logger.info('console page', ((event as CustomEvent).detail || {}) as Record<string, unknown>);
    };
    window.addEventListener('card-page', onCardPage);
    /**
     * THE COLUMN'S HEADER ASKED FOR ANOTHER VIEW — the one control `<output-controls>` owns, and
     * the host is what performs it (the header does not know where the column's body lives).
     *
     * 'flow' IS NOT HANDLED HERE, deliberately: the drawing exists only while a Run has put one
     * there, and the header only offers it in that state — so a 'flow' choice can only mean "the
     * view you are already in", which the element already refuses to emit (see `_choose`).
     */
    const onViewChange = (event: Event) => {
      const view = String((event as CustomEvent).detail?.view || '');
      if (view === 'draft') void showDraftColumn();
      else if (view === 'output') showOutputColumn();
    };
    window.addEventListener('view-change', onViewChange);
    window.addEventListener('canvas-play', onCanvasPlay);
    window.addEventListener('canvas-reset', onCanvasReset);
    window.addEventListener('canvas-save', onCanvasSave);
    window.addEventListener('flow-opened', onFlowOpened);
    return () => {
      window.removeEventListener('open-console', onOpenConsole);
      window.removeEventListener('loads-cards-form-console-in-prompt-area', onAgentButton);
      window.removeEventListener('repair-finding', onRepairFinding);
      window.removeEventListener('conversation-change', onConversationChange);
      window.removeEventListener('flow-node-moved', onFlowNodeMoved);
      window.removeEventListener('flow-node-added', onFlowNodeAdded);
      window.removeEventListener('flow-select', onFlowSelect);
      window.removeEventListener('turn-click', onTurnClick);
      window.removeEventListener('flow-connect', onFlowConnect);
      window.removeEventListener('flow-action', onFlowAction);
      window.removeEventListener('card-delete', onCardDelete);
      window.removeEventListener('card-page', onCardPage);
      window.removeEventListener('view-change', onViewChange);
      window.removeEventListener('canvas-play', onCanvasPlay);
      window.removeEventListener('canvas-reset', onCanvasReset);
      window.removeEventListener('canvas-save', onCanvasSave);
      window.removeEventListener('theme-change', onThemeChange);
      window.removeEventListener('flow-opened', onFlowOpened);
    };
  }, [handleRepairFinding, handleConversationChange, handleTabChangeWithGate, headerTab]);
}
