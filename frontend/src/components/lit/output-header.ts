/**
 * output-header — THE READOUT BLOCK, ABOVE THE CONVERSATIONS BAR.
 *
 * Figma: `40001119-6308`, re-imported 2026-09-20 from the design.
 *
 * THE LAYERS, by the name the designer has on them TODAY:
 *
 *   40001119:6308  output-header               540×83   column  HUG/HUG  gap 5  pad 16/20/0/20
 *                                                        #CBE6E3  primary CENTER
 *   40001119:6309  chat-output-readout-area    500×55   row  HUG/FIXED  gap 10  pad 7/10
 *                                                        rgba(117,142,135,0.35)  1px INSIDE
 *                                                        rgba(117,142,135,0.5)  radius 8
 *                                                        2 INNER_SHADOWs — inset 0 -2 5
 *                                                        rgba(0,0,0,0.15), inset 0 2 4
 *                                                        rgba(0,0,0,0.25)
 *   40001123:6763  textarea                    450×40   row  FIXED/FIXED  gap 10  counter CENTER
 *   40001123:6750  the text in it              450×43   Arial Rounded MT Bold 400 12px  lh 20px
 *                                                        #3D515B  LEFT / CENTER
 *   40001124:7096  model-readout-tokens-etc    20×20    FIXED/FIXED  — the mark
 *   40001123:6773  gripper-prompt-input-chat-menu  500×7  row FILL/FIXED gap 10 pad 0/10 CENTER
 *   40001123:6774  Meatballs                   480×4.05 row FILL/HUG gap 4 pad 1/2 CENTER
 *   40001123:6775-6779  Ellipse 209/210/207/206/208  2.16×2.05  2px rgba(147,58,69,0.5)
 *
 * RENAMED SINCE THE LAST DRAW, same node ids: `output-header-area` → `output-header`, and
 * `chat-output-header` → `chat-output-readout-area`. A rename is the same layer with a new
 * label, so the ids held and only the names moved — which is why the names lead here.
 *
 * This element replaces the one deleted at the owner's instruction, and it is drawn ABOVE the
 * conversations bar (`output-conversations-area`, 40001119:6317) — the drawing stacks the
 * readout first, then conversations, then approvals, then the response card.
 */
import { LitElement, html, css } from 'lit';
import modelMark from '@/assets/figma-readout-model-mark.svg';

export class OutputHeader extends LitElement {
  /** The status line. Empty draws the drawing's own sample. */
  declare line: string;
  /** Whether the seat could attribute this conversation. False reads "unattributed". */
  declare attributed: boolean;
  declare tokens: string;
  declare calls: string;

  static properties = {
    line: { type: String },
    attributed: { type: Boolean },
    tokens: { type: String },
    calls: { type: String },
  };

  static styles = css`
    /* 40001119:6308 "output-header" — 540 wide, HUG/HUG, column, gap 5, pad 16/20/0/20,
       #CBE6E3, primary CENTER (the blocks centre across the column). */
    :host {
      display: block;
    }
    .area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      padding: 16px 20px 0 20px;
      background-color: #CBE6E3;
      box-sizing: border-box;
    }

    /* 40001119:6309 "chat-output-readout-area" — 500×55, row, HUG/FIXED, gap 10, pad 7/10,
       rgba(117,142,135,0.35), 1px INSIDE rgba(117,142,135,0.5), radius 8, and the two
       INNER_SHADOWs the drawing sets on this layer. */
    .readout-area {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      align-self: stretch;
      height: 55px;
      padding: 7px 10px;
      background-color: rgba(117, 142, 135, 0.35);
      border: 1px solid rgba(117, 142, 135, 0.5);
      border-radius: 8px;
      box-shadow: inset 0px -2px 5px 0px rgba(0, 0, 0, 0.15), inset 0px 2px 4px 0px rgba(0, 0, 0, 0.25);
      box-sizing: border-box;
    }

    /* 40001123:6763 "textarea" — 450×40, row, gap 10, counter CENTER. */
    .textarea {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      flex: 1 1 auto;
      min-width: 0;
      height: 40px;
    }

    /* 40001123:6750 — the line: Arial Rounded MT Bold 400 at 12, 20px leading, #3D515B, in its
       box. The text box is 450×43 against the 450×40 frame above it — the drawing's geometry. */
    .line {
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
      font-weight: 400;
      font-size: 12px;
      line-height: 20px;
      color: #3D515B;
      text-align: left;
      margin: 0;
      flex: 1 1 auto;
      min-width: 0;
    }

    /* 40001124:7096 "model-readout-tokens-etc" — 20×20, FIXED/FIXED. */
    .mark-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }
    .mark-icon { display: block; }

    /* 40001123:6773 — the gripper: 500×7, row, FILL/FIXED, gap 10, pad 0/10, CENTER. */
    .gripper {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 10px;
      align-self: stretch;
      height: 7px;
      padding: 0 10px;
      box-sizing: border-box;
    }
    /* 40001123:6774 "Meatballs" — 480×4.05, row, FILL/HUG, gap 4, pad 1/2, CENTER. */
    .meatballs {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 1px 2px;
      flex: 1 1 auto;
      box-sizing: border-box;
    }
    /* 40001123:6775-6779 — five dots: 2.16×2.05, a 2px stroke at rgba(147,58,69,0.5). */
    .dot {
      display: block;
      width: 2.16px;
      height: 2.05px;
      border: 2px solid rgba(147, 58, 69, 0.5);
      border-radius: 50%;
      box-sizing: border-box;
    }
  `;

  /** The drawing's own line (#40001123:6750), when the seat hands none. */
  private static readonly SAMPLE =
    'Analyzing: Session 222 | support Customer Session Duration: 28.495s Closed QA: 89.38% Sample text';

  /** Data: the seat's status, and the usage figures it is handed. Failure: unattributed. */
  private get _line(): string {
    const parts = [this.line?.trim() || OutputHeader.SAMPLE];
    if (this.tokens !== undefined) {
      parts.push(`Tokens: ${this.attributed ? (this.tokens || '0') : 'unattributed'}`);
      if (this.calls) parts.push(`Calls: ${this.attributed ? this.calls : 'unattributed'}`);
    }
    return parts.join('  |  ');
  }

  render() {
    return html`
      <div class="area" data-node-id="40001119:6308" data-layer-name="output-header">
        <div class="readout-area" data-node-id="40001119:6309" data-layer-name="chat-output-readout-area" role="status">
          <div class="textarea" data-node-id="40001123:6763" data-layer-name="textarea">
            <p class="line" data-node-id="40001123:6750" data-layer-name="Analyzing: Session 222 | support Customer Session Duration: 28.495s Closed QA: 89.38% Sample text">${this._line}</p>
          </div>
          <div class="mark-box" data-node-id="40001124:7096" data-layer-name="model-readout-tokens-etc">
            <img
              class="mark-icon"
              data-node-id="40001124:7442"
              data-layer-name="model-icon"
              src=${modelMark}
              alt=""
            />
          </div>
        </div>
        <div class="gripper" data-node-id="40001123:6773" data-layer-name="gripper-prompt-input-chat-menu" aria-hidden="true">
          <div class="meatballs" data-node-id="40001123:6774" data-layer-name="Meatballs">
            <span class="dot" data-node-id="40001123:6775" data-layer-name="Ellipse 209"></span>
            <span class="dot" data-node-id="40001123:6776" data-layer-name="Ellipse 210"></span>
            <span class="dot" data-node-id="40001123:6777" data-layer-name="Ellipse 207"></span>
            <span class="dot" data-node-id="40001123:6778" data-layer-name="Ellipse 206"></span>
            <span class="dot" data-node-id="40001123:6779" data-layer-name="Ellipse 208"></span>
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('output-header')) customElements.define('output-header', OutputHeader);

declare global {
  interface HTMLElementTagNameMap {
    'output-header': OutputHeader;
  }
}
