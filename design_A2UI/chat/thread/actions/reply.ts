/**
 * THE REPLY'S BUTTONS — a pressed action inside a turn.
 *
 * A button is either an edit this app knows how to make or a question for her. The fifteen named
 * paths below are the edits; a sentence with spaces is a question and goes to the model; anything
 * that reads like a command and matches nothing is said in the thread as an alert, never sent.
 *
 * The press is marked spent before anything else runs: the press happened either way, and the
 * mark belongs to the turn it sat in (the thread re-renders from the surface's messages, so a
 * mark carried in a message would go with it — this one lives on the seat).
 */
import {
  parseWriteSeatAction,
  parseWriteToolAction,
  parseDescriptionAction,
  parseMergeSeatAction,
  parseMoveToolAction,
  parseSetSeatAction,
  parseRemoveSeatAction,
  parseRunAction,
  parseSaveAction,
  parseSetTitleAction,
  parseBuildWireframeAction,
  parseEditNodeAction,
  requestForAction,
  HER_ANSWERS,
  NO_ADVICE,
  FIX_ALL,
} from '@/shared/actionLink';

export interface ReplyActionHost {
  _spent: Set<string>;
  _spentTurn: string;
  _local: unknown[];
  requestUpdate(): void;
  _withdrawOffer(): void;
  _send(text: string): Promise<void>;
  _emitCommand(tag: string, props?: Record<string, unknown>): void;
}

export const replyAction = (host: ReplyActionHost, e: Event): void => {
  const text = String((e as CustomEvent).detail?.text ?? '');
  if (!text) return;
  // The brackets come off first: a button's action arrives as `[<action>]`.
  const action = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
  host._spentTurn = String(((e as CustomEvent).detail?.turn as string) ?? '');
  host._spent.add(action);
  host.requestUpdate();

  // THE WAY OUT IS HANDLED HERE, NOT SENT: a dismissal costs no model call.
  if (action === NO_ADVICE) {
    host._withdrawOffer();
    return;
  }
  const edit = parseWriteSeatAction(action);
  if (edit) {
    window.dispatchEvent(new CustomEvent('a2ui:write-seat', { detail: edit }));
    return;
  }
  // A TOOL IS AN EDIT TOO; the words come from the register, so they are byte-for-byte the
  // same as the Tools menu's own insert.
  const tool = parseWriteToolAction(action);
  if (tool) {
    window.dispatchEvent(new CustomEvent('insert-tool', { detail: tool }));
    return;
  }
  const described = parseDescriptionAction(action);
  if (described) {
    window.dispatchEvent(new CustomEvent('set-package-description', { detail: described }));
    return;
  }
  // TWO ROWS FOR ONE STEP, MERGED — moved, never retyped.
  const merge = parseMergeSeatAction(action);
  if (merge) {
    window.dispatchEvent(new CustomEvent('merge-seat', { detail: merge }));
    return;
  }
  const move = parseMoveToolAction(action);
  if (move) {
    window.dispatchEvent(new CustomEvent('move-tool', { detail: move }));
    return;
  }
  const replaced = parseSetSeatAction(action);
  if (replaced) {
    window.dispatchEvent(
      new CustomEvent('set-left-column-text', {
        detail: { target: replaced.seat, content: replaced.text },
      }),
    );
    return;
  }
  // A REQUEST SHE ALREADY OFFERS AS A BUTTON — translated, never handed over as a token.
  const asked = requestForAction(action);
  if (asked) {
    void host._send(asked);
    return;
  }
  // APPLY ALL — the whole list, worked in one press; the host applies what is the app's own.
  if (String(action).trim().toLowerCase() === FIX_ALL) {
    window.dispatchEvent(new CustomEvent('a2ui:fix-all'));
    return;
  }
  // RUN IT — it releases the held run; with nothing held the host ignores it.
  if (parseRunAction(action)) {
    window.dispatchEvent(new CustomEvent('a2ui:run-approved'));
    return;
  }
  if (parseBuildWireframeAction(action)) {
    window.dispatchEvent(new CustomEvent('a2ui:build-wireframe'));
    return;
  }
  if (parseEditNodeAction(action)) {
    window.dispatchEvent(new CustomEvent('a2ui:edit-node'));
    return;
  }
  // SAVE — the same command every other door sends; one command behind all the doors.
  if (parseSaveAction(action)) {
    host._emitCommand('save-button', { state: 'idle', label: 'Save' });
    return;
  }
  const titled = parseSetTitleAction(action);
  if (titled) {
    window.dispatchEvent(new CustomEvent('set-prompt-title', { detail: { title: titled.title } }));
    return;
  }
  const removed = parseRemoveSeatAction(action);
  if (removed) {
    window.dispatchEvent(new CustomEvent('remove-prompt-role', { detail: { roleName: removed.seat } }));
    return;
  }
  // A COMMAND NOBODY HANDLES IS SAID SO, NOT SENT: one token, or carrying `:` or `|`, and not
  // one of her own answers. A sentence with spaces is a question and falls through.
  if (!HER_ANSWERS.includes(action) && (/^[^\s]+$/.test(action) || /[:|]/.test(action))) {
    host._local = [
      ...host._local,
      {
        role: 'assistant',
        content:
          `⚠️ That button asks for something this app does not know how to do (${action.slice(0, 80)}), ` +
          'so nothing was changed. Tell me which step you want and I will do it here.',
        alert: true,
      },
    ];
    host.requestUpdate();
    return;
  }
  void host._send(text);
};
