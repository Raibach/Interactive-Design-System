/**
 * <chat-repair-actions> — the catalog checker's findings, drawn in the chat panel.
 *
 * It is a VIEW, injected into the chat panel's simple slot by the surface:
 *
 *   chat-panel  "children": { "view": ["trace-view", "repair-view"] }
 *   repair-view "component": "chat-repair-actions", "findings": { "path": "/findings" }
 *
 * The panel draws the slot; the surface fills it. It used to be a permanent sibling in
 * the panel's own template, which made the panel responsible for a list it does not own
 * — and put a console feature above the composer in every assembly.
 *
 * THE ROWS ARRIVE READY TO DRAW. `text` and `level` are composed by the writer, in
 * Python, from the report the checker already wrote (frontend/catalog-audit/<pipeline>
 * .json). This element composes no sentence about a finding and decides no severity: a
 * view that re-words a finding is a second author of it, and the two would disagree.
 *
 * Data flows one way: rows IN, `repair-finding` OUT. It never fetches the audit, never
 * applies a repair, and never decides urgency.
 *
 * Unset is not empty. `findings === undefined` means the surface has not bound the path
 * yet and draws its waiting state; `findings === []` means the checker found nothing
 * open, which is a different and better claim.
 */
import { LitElement, html, css, nothing } from 'lit';
// THE DESIGN'S OWN CHEVRON, the same imported artwork the Conversations dropdown uses —
// one asset, two places, so the two disclosures cannot look like different controls.
// This header had none at all: it opened and closed with nothing to say it could.
import arrowDropDown from '../../assets/figma-9598a83b0a4eb9b9fc9c226f302689fd4f7075df.svg';
import { designTokens } from '@/shared/design-tokens';

/** One row, as the writer composes it. Nothing here is derived on the client. */
export interface ChatRepairRow {
  /** The finding's id — what `repair-finding` reports, and what the repair resolves. */
  id: string;
  /** The sentence to draw, already composed. */
  text: string;
  /** Resolved by the writer from the checker's own severity rule. */
  level?: 'advisory' | 'blocking';
}

export class ChatRepairActions extends LitElement {
  static properties = {
    /** Rows, blocking first, composed by the writer. Undefined = not bound yet. */
    findings: { type: Array },
    /**
     * Optional per-finding marks — Record<findingId, 'repair' | 'done'> — written by
     * the shell while a repair is in flight. Unset draws no mark; the element never
     * guesses that a repair is done, because only a new report can settle one.
     */
    stages: { type: Object },
    collapsed: { type: Boolean },
  };

  declare findings: ChatRepairRow[] | undefined;
  declare stages: Record<string, 'repair' | 'done'> | undefined;
  declare collapsed: boolean;

  constructor() {
    super();
    this.findings = undefined;
    this.stages = undefined;
    /*
     * COLLAPSED BY DEFAULT — the owner's instruction, 2026-09-18: "the catalogue checker
     * list collapsed by default."
     *
     * The history is worth keeping, because it has been both ways. It first defaulted
     * collapsed as a SIBLING ABOVE THE THREAD: expanded with 52 findings it measured
     * 3,309px and pushed the composer below the fold, which read as "the chat input is
     * missing". It then defaulted EXPANDED, because in the panel's view hole it cannot do
     * that — the hole is a bounded, scrolling region and the list is capped at 240px.
     *
     * Both of those were about containment. This one is about ATTENTION: 29 open findings
     * is a wall of text above a conversation that has not started yet, and the first thing
     * a person should meet in this seat is Grace, not the checker. The list is one click
     * away, its header carries the count either way, and an EMPTY check still says so in
     * full (see the render: a header with nothing under it is the one case that is never
     * hidden).
     */
    this.collapsed = true;
  }

  static styles = [
    designTokens,
    css`
      :host { display: block; }
      .panel {
        border: 1px solid var(--ds-rule);
        border-radius: var(--ds-radius);
        background: var(--ds-surface);
        font-family: var(--ds-font);
        font-size: var(--ds-fs-sm);
        color: var(--ds-text);
      }
      /* The chevron's box, to the master's own geometry: 40x30 padded to 7, holding the
         14x13 artwork, dim at 50% and full when the list is open — the same values the
         small-dropdown's chevron uses, because it is the same drawing. */
      .header .chevron {
        flex-shrink: 0;
        margin-left: auto;
        width: 40px;
        height: 30px;
        padding: 7px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s ease;
      }
      .header .chevron img {
        display: block;
        width: 14px;
        height: 13px;
        opacity: 0.5;
        transition: opacity 0.15s ease;
      }
      .header[aria-expanded='false'] .chevron { transform: rotate(180deg); }
      .header[aria-expanded='false'] .chevron img { opacity: 1; }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: var(--ds-surface-muted);
        border-radius: var(--ds-radius) var(--ds-radius) 0 0;
        font: inherit;
        font-weight: var(--ds-weight);
        color: var(--ds-navy);
        cursor: pointer;
        text-align: left;
      }
      .chip {
        padding: 1px 8px;
        border-radius: var(--ds-radius-pill);
        font-size: var(--ds-fs-label);
        font-weight: var(--ds-weight);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .chip.blocking { background: var(--ds-red-tint); color: var(--ds-red); }
      .chip.count { background: var(--ds-teal-tint); color: var(--ds-navy); }
      .waiting {
        padding: 8px 12px;
        color: var(--ds-muted);
        font-size: var(--ds-fs-sm);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0 12px 8px;
        /* NO CAP, AND NO SCROLLER OF ITS OWN. This list used to stop at 240px and scroll
           inside itself, which was right while it was a sibling above the thread and the
           column around it did not scroll. The owner's rule now (2026-09-18) is ONE
           scrollbar for the whole column, and his reason for letting the list run long is
           worth keeping in mind before anyone caps it again: "those are incentives to
           make the user clean up their repairs." Five hundred repairs is five hundred
           rows down — and a cap would hide exactly the thing that motivates the person to
           shorten it. The column's scroller (chat-panel's .content-scroll) does the
           moving. */
      }
      li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--ds-rule-soft);
      }
      li:last-child { border-bottom: none; }
      .level {
        flex: 0 0 auto;
        padding: 1px 6px;
        border-radius: var(--ds-radius-sm);
        font-size: var(--ds-fs-meta);
        font-weight: var(--ds-weight);
      }
      .level.blocking { background: var(--ds-red-tint); color: var(--ds-red); }
      .level.advisory { background: var(--ds-grey-tint); color: var(--ds-muted); }
      .text { flex: 1 1 auto; min-width: 0; }
      .stage { flex: 0 0 auto; font-weight: var(--ds-weight); }
      .stage.done { color: var(--ds-green); }
      .stage.repair { color: var(--ds-amber); }
      button.repair {
        flex: 0 0 auto;
        padding: 3px 10px;
        border: 1px solid var(--ds-teal);
        border-radius: var(--ds-radius-sm);
        background: var(--ds-teal-tint);
        color: var(--ds-navy);
        font: inherit;
        font-weight: var(--ds-weight);
        cursor: pointer;
      }
      button.repair:hover { background: var(--ds-surface-hover); }
    `,
  ];

  private _counts(): { blocking: number; advisory: number } {
    const out = { blocking: 0, advisory: 0 };
    for (const f of this.findings ?? []) {
      if (f?.level === 'blocking') out.blocking += 1;
      else out.advisory += 1;
    }
    return out;
  }

  private _repair(findingId: string) {
    this.dispatchEvent(
      new CustomEvent('repair-finding', {
        bubbles: true,
        composed: true,
        detail: { findingId },
      }),
    );
  }

  private _toggle() {
    this.collapsed = !this.collapsed;
  }

  render() {
    // NOTHING TO DRAW AT ALL — the surface has not bound the path. Distinct from an
    // empty list, which says the checker found nothing open.
    if (this.findings === undefined) {
      return html`<div class="panel"><p class="waiting">Waiting for the surface to bind /findings…</p></div>`;
    }

    const rows = this.findings;
    if (!rows.length) return nothing;
    const counts = this._counts();
    return html`
      <div class="panel">
        <button
          class="header"
          type="button"
          aria-expanded=${this.collapsed ? 'false' : 'true'}
          @click=${this._toggle}
        >
          Catalog check — ${rows.length} open
          ${counts.blocking ? html`<span class="chip blocking">${counts.blocking} blocking</span>` : ''}
          <span class="chip count">${counts.advisory} advisory</span>
          <!-- The chevron goes at the far end, as the Conversations dropdown draws it:
               down and dim while the list is open, turned and full blue while it is shut. -->
          <span class="chevron" aria-hidden="true"><img src=${arrowDropDown} width="14" height="13" alt="" /></span>
        </button>
        ${this.collapsed
          ? nothing
          : html`
            <ul>
              ${rows.map((f) => {
                const stage = this.stages?.[f.id];
                return html`
                  <li>
                    <!-- THE ACTION LEADS THE ROW. The owner's instruction, 2026-09-18:
                         the Repair button belongs on the LEFT — "it should be on the
                         left side always for the most part" — not shoved against the
                         rail by a growing text column. The stage mark takes the same
                         place when a row has left the button behind, so the row's first
                         column means one thing whatever state it is in; the sentence
                         then runs right and gets the width it needs. -->
                    ${stage === 'done'
                      ? html`<span class="stage done">completed</span>`
                      : stage === 'repair'
                        ? html`<span class="stage repair">in repair</span>`
                        : html`<button class="repair" type="button" @click=${() => this._repair(f.id)}>Repair</button>`}
                    <span class="level ${f.level === 'blocking' ? 'blocking' : 'advisory'}">${f.level ?? 'advisory'}</span>
                    <span class="text">${f.text}</span>
                  </li>
                `;
              })}
            </ul>
          `}
      </div>
    `;
  }
}

if (!customElements.get('chat-repair-actions')) customElements.define('chat-repair-actions', ChatRepairActions);

declare global {
  interface HTMLElementTagNameMap {
    'chat-repair-actions': ChatRepairActions;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-repair-actions': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatRepairActions> & {
          ref?: React.Ref<ChatRepairActions>;
        },
        ChatRepairActions
      >;
    }
  }
}
