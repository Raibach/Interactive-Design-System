/**
 * THE THREAD'S ACTION LINKS — the buttons inside a turn.
 *
 * A reply's words carry `[label](action:…)` links; this file turns them into buttons and owns
 * the two ways a button is done: the prompt says so (`doneActions`, derived from the seats) and
 * the person pressed it (`spentActions`, remembered by the seat for its own turn). The press is
 * dispatched by the element through `onSend`; nothing here reaches the seat directly.
 */
import { html, css, type TemplateResult } from 'lit';
import {
  HER_ANSWERS,
  BUILD_WIREFRAME,
  EDIT_NODE,
} from '@/shared/actionLink';
import { stripControlTags } from '@/shared/plainText';

export interface ActionLinkSegment {
  text?: string;
  label?: string;
  action?: string;
}

export interface ActionLinkState {
  doneActions: string[];
  spentActions: string[];
  spentTurn: string;
  onSend: (e: Event, action: string, turn: string) => void;
}

/** A turn's words split into text and action links. Only her turns are stripped of control tags. */
export const actionSegments = (content: string, isAssistant: boolean): ActionLinkSegment[] => {
  const shown = isAssistant ? stripControlTags(content) : content;
  return shown.split(/(\[.*?\]\(action:[^)]+\))/g).map((part) => {
    const match = part.match(/^\[(.*?)\]\(action:([^)]+)\)$/);
    return match ? { label: match[1], action: match[2] } : { text: part };
  });
};

/**
 * ONE BUTTON OF HER OFFER — pressed or still waiting.
 *
 * `disabled` on a spent one, so it cannot be pressed twice. A press lasts for the package, except
 * for her two answer words, `build-wireframe` and `edit-node`: those answer THIS turn (a later
 * `[Confirm]` is a different question; a later build or edit is the next instruction), so their
 * ✓ is scoped to the turn they were pressed in.
 */
export const actionButton = (
  label: unknown,
  action: unknown,
  turn: string,
  state: ActionLinkState,
): TemplateResult => {
  const a = String(action);
  const turnScoped = HER_ANSWERS.includes(a) || a === BUILD_WIREFRAME || a === EDIT_NODE;
  const spent =
    state.doneActions.includes(a) ||
    (turnScoped
      ? turn !== '' && state.spentTurn === turn && state.spentActions.includes(a)
      : state.spentActions.includes(a));
  return html`<button
    class="action ${spent ? 'spent' : ''}"
    data-action=${action}
    ?disabled=${spent}
    @click=${(e: Event) => state.onSend(e, String(action), turn)}
  >${label}</button>`;
};

export const actionLinkStyles = css`
  /* THE CHAT'S BUTTONS — the wire format's action links, drawn with the same wash the user's
     turn uses (owner, 2026-09-19: "use that for all your buttons inside of the chat"),
     never the Conversations dropdown. */
  .turn .action {
    font: inherit;
    color: inherit;
    background: var(--chat-user-bg, #eef2f7);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 6px;
    padding: 3px 10px;
    margin: 2px 4px 2px 0;
    cursor: pointer;
    transition: background 0.12s;
  }
  .turn .action:hover { background: rgba(255, 255, 255, 0.16); }
  /* A BUTTON THAT HAS BEEN PRESSED IS SPENT — it says so, and it stops answering.
     The fill goes, the ink is held at the card's colour (a spent button is still a label the
     person may want to re-read), and the check plus the absence of fill marks it. */
  .turn .action.spent {
    background: transparent;
    border-color: rgba(23, 23, 23, 0.12);
    color: inherit;
    cursor: default;
    padding-left: 4px;
  }
  .turn .action.spent::before { content: '\\2713\\00a0'; }
  .turn .action.spent:hover { background: transparent; }
  .turn .action.spent:disabled { pointer-events: none; }
`;
