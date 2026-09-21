/**
 * output-footer-area — THE FOOTER BLOCK, BELOW THE OUTPUT COLUMN.
 *
 * Figma: `40001123-6689`, imported 2026-09-20 from the Figma Dev Mode MCP server
 * (`get_design_context` on 127.0.0.1:3845), which returns the reference code, the node
 * annotations, and the asset exports — the three things a code-only read does not carry.
 *
 * THE LAYERS, by the name the designer has on them:
 *
 *   40001123:6689  output-footer-area       column  gap 7   pad 10/20/20/20  #CBE6E3
 *   40001123:6692  gripper-prompt-input-chat-menu   7 tall  row  pad 0/10  CENTER
 *   40001123:6693  (the gripper's own box)
 *                  Meatballs              24.649×4.051  rotate 180  — ONE SVG IMAGE
 *   40001123:6690  chat-output-footer      column  gap 10  pad 7/14  justify END
 *                                          -scale-y-100 (drawn flipped on the Y axis)
 *                                          rgba(117,142,135,0.35)  border-b 1px
 *                                          rgba(117,142,135,0.5)  radius 8
 *                                          shadows inset 0 2 4 rgba(0,0,0,0.25) and
 *                                          inset 0 -2 5 rgba(0,0,0,0.15)
 *   40001123:6722  (control row)           row  gap 9  CENTER  w-full
 *   40001123:6723  (mark cluster)          307 wide  row  gap 20  CENTER
 *   40001123:6829  (plugin group)          54 wide  row  CENTER
 *   40001123:6830  "Function - loads cards form console in prompt area"  54 wide  radius 6
 *                                          drop-shadow -4 -4 5 / 4 4 5 rgba(0,0,0,0.15)
 *   40001123:6831  btn-label               column
 *   40001123:6832  the text in it          58 wide  Arial Rounded MT Bold Regular 12px
 *                                          #3D515B  "Active" / "Plugins "
 *   40001124:7035  forum 1                 32×32  fill #3D515B
 *   40001123:6728  chat history            32×32  fill #507274  (deactivated in appearance,
 *                                          but really selected)
 *   40001123:6732  add-new-conversation    32×32  fill #3D515B
 *   40001123:6724  user--feedback 1        32×32  fill #3D515B
 *   40001123:6738  "Function - loads cards form console in prompt area"  156 wide
 *                                          drop-shadow -4 -4 5 / 4 4 5 rgba(0,0,0,0.15)
 *   40001123:6739  btn-label               156×35
 *   40001123:6740  the credit line         Arial Rounded MT Bold Regular 9px  #3D515B
 *                                          12px leading  RIGHT / BOTTOM
 *                                          "Created by John Travis Holt"
 *                                          "Raibach.net © 2026 Raibach IDS"
 *
 * WHAT THE IMPORT CORRECTED, against the first pass:
 *
 *   1. THE MEATBALLS IS ONE IMAGE, NOT FOUR DOTS. The reference code draws `imgMeatballs`
 *      (24.649×4.051, `rotate-180`) as a single SVG. The first pass built four bordered
 *      spans from the ellipses a geometry read reports. The image is the drawing.
 *   2. THE CREDIT LINE IS ARIAL ROUNDED, NOT INTER. `40001123:6740` renders in
 *      `Arial_Rounded_MT_Bold:Regular` at 9px with 12px leading; the Inter Bell/Bold on the
 *      node is the style the runs inherit from, not what the text is drawn in. The `©` is the
 *      one run that keeps `#3d515b` explicitly.
 *   3. THE BUTTON SHADOW IS 5px, NOT 10px. `6830`/`6738` carry
 *      `-4px -4px 5px rgba(0,0,0,0.15), 4px 4px 5px rgba(0,0,0,0.15)` — the global "button drop"
 *      style says radius 10, the applied drop-shadow says 5.
 *   4. THE SHELL IS FLIPPED AND STROKED ON ONE EDGE. `6690` is drawn `-scale-y-100` with a
 *      `border-b`, not a full border — which is why it reads as a bottom edge in the drawing.
 *
 * ANNOTATIONS, verbatim from the drawing:
 *   the gripper — "This gripper pulls this window and everything above it up and expands the
 *   section below it. It does have a limit. … it's like a tool tray think of it that way and
 *   we'll have a limit and we need to work on that limit together"
 *   the component — "This belongs to this is the footer and this is where our plug-in tube bar
 *   will load. This is the default view. You can only see the first five tools for now."
 *   chat history — "deactivated in appearance, but it is really selected and the history will
 *   appear above in the output as a insert section."
 *   both buttons — "On click: dispatch URL (http://raibach.net) / Action: launch svae check
 *   before leaving application"
 *
 * THE ANNOTATIONS ARE NOT IMPLEMENTED. The buttons carry a dispatch-URL interaction and the
 * history mark a selected-but-dimmed state; this element draws the drawing and wires none of
 * that, because the host owns the action. Named here so the gap is visible rather than lost.
 *
 * THE TYPE IS BELOW THE FLOOR, ON PURPOSE AND FLAGGED. The credit line is 9px, under the 13px
 * minimum the owner's type rule sets. It is the file's value; if the rule is to win, this is
 * the one number that moves.
 */
import { LitElement, html, css } from 'lit';
import meatballs from '@/assets/figma-footer-meatballs.svg';
import forumMark from '@/assets/figma-footer-forum.svg';
import historyMark from '@/assets/figma-footer-history.svg';
import addMark from '@/assets/figma-footer-add-conversation.svg';
import feedbackMark from '@/assets/figma-footer-feedback.svg';

export class OutputFooterArea extends LitElement {
  /** The credit line. Empty draws the drawing's own. */
  declare credit: string;
  /** The Active/Plugins label. Empty draws the drawing's own. */
  declare pluginLabel: string;
  /** Whether the history mark is drawn in its selected-but-deactivated state. */
  declare historySelected: boolean;
  /** Whether the gripper may be grabbed. The host owns what pulling it does. */
  declare gripEnabled: boolean;

  static properties = {
    credit: { type: String },
    pluginLabel: { type: String, attribute: 'plugin-label' },
    historySelected: { type: Boolean, attribute: 'history-selected' },
    gripEnabled: { type: Boolean, attribute: 'grip-enabled' },
  };

  static styles = css`
    /* 40001123:6689 — output-footer-area: column, gap 7, pad 10/20/20/20, #CBE6E3, CENTER. */
    :host { display: block; }
    .area {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 7px;
      padding: 10px 20px 20px 20px;
      background-color: #cbe6e3;
      box-sizing: border-box;
    }

    /* 40001123:6692 — gripper-prompt-input-chat-menu: 7 tall, row, pad 0/10, CENTER, w-full. */
    .gripper {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 7px;
      padding: 0 10px;
      flex: 0 0 auto;
      box-sizing: border-box;
    }
    /* 40001123:6693 "Meatballs" — ONE SVG image, 24.649×4.051, drawn rotate-180. */
    .meatballs {
      display: block;
      width: 24.649px;
      height: 4.051px;
      transform: rotate(180deg);
    }

    /* 40001123:6690 "chat-output-footer" — column, gap 10, pad 7/14, justify END, w-500,
       drawn -scale-y-100, rgba(117,142,135,0.35), border-b 1px rgba(117,142,135,0.5),
       radius 8, and its two inset shadows on an overlay that inherits the radius. */
    .shell-wrap {
      display: flex;
      flex: 1 0 0;
      align-items: center;
      justify-content: center;
      min-height: 1px;
      position: relative;
      width: 100%;
    }
    .shell-flip {
      transform: scaleY(-1);
      flex: 0 0 auto;
      height: 100%;
    }
    .shell {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-end;
      gap: 10px;
      height: 100%;
      width: 500px;
      padding: 7px 14px;
      border-bottom: 1px solid rgba(117, 142, 135, 0.5);
      border-radius: 8px;
      box-sizing: border-box;
    }
    /* The fill and the inset shadows ride an overlay that inherits the corner radius. */
    .shell::before {
      content: '';
      position: absolute;
      inset: 0;
      background-color: rgba(117, 142, 135, 0.35);
      border-radius: inherit;
      pointer-events: none;
    }
    .shell::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow:
        inset 0 2px 4px 0 rgba(0, 0, 0, 0.25),
        inset 0 -2px 5px 0 rgba(0, 0, 0, 0.15);
    }
    .controls-flip { transform: scaleY(-1); flex: 0 0 auto; width: 100%; }

    /* 40001123:6722 — the control row: row, gap 9, CENTER, w-full. */
    .controls {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 9px;
      width: 100%;
    }

    /* 40001123:6723 — the mark cluster: 307 wide, row, gap 20, CENTER. */
    .marks {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 20px;
      width: 307px;
      flex: 0 0 auto;
    }
    /* 40001123:6829 — the plugin group: 54 wide, row, CENTER. */
    .plugin-group {
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 54px;
      flex: 0 0 auto;
    }

    /* 40001123:6830 / 40001123:6738 "Function - loads cards form console in prompt area" —
       radius 6, drop-shadow -4 -4 5 / 4 4 5 rgba(0,0,0,0.15). */
    .btn {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      flex: 0 0 auto;
      box-shadow:
        -4px -4px 5px 0 rgba(0, 0, 0, 0.15),
        4px 4px 5px 0 rgba(0, 0, 0, 0.15);
      box-sizing: border-box;
    }
    .btn.plugins { width: 54px; }
    .btn.credit { width: 156px; align-self: stretch; height: 100%; }

    /* 40001123:6831 / 40001123:6739 "btn-label". */
    .btn-label { display: flex; flex-direction: column; align-items: flex-start; }
    .btn-label.credit { height: 35px; width: 156px; flex: 0 0 auto; }

    /* 40001123:6832 — Arial Rounded MT Bold Regular 12px, #3D515B, w-58. Each line takes the
       font's own leading. */
    .btn-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-family: 'Arial Rounded MT Bold', system-ui, sans-serif;
      font-weight: 400;
      font-size: 12px;
      color: #3d515b;
      width: 58px;
      word-break: break-word;
      margin: 0;
    }
    .btn-text p { margin: 0; line-height: normal; }

    /* 40001123:6740 — Arial Rounded MT Bold Regular 9px, 12px leading, #3D515B, RIGHT/BOTTOM.
       The © run keeps the fill explicitly; the rest inherit it. */
    .credit-text {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      width: 100%;
      font-family: 'Arial Rounded MT Bold', system-ui, sans-serif;
      font-weight: 400;
      font-size: 9px;
      color: #3d515b;
      text-align: right;
      word-break: break-word;
      margin: 0;
    }
    .credit-text p { margin: 0; }
    .credit-text .credit-fill { color: #3d515b; }

    /* 40001124:7035 / 40001123:6728 / 40001123:6732 / 40001123:6724 — the 32×32 marks. */
    .mark { display: block; width: 32px; height: 32px; flex: 0 0 auto; }
  `;

  /** The drawing's own credit line (#40001123:6740), when the seat hands none. */
  private static readonly SAMPLE_CREDIT = 'Created by John Travis Holt\nRaibach.net © 2026 Raibach IDS';
  /** The drawing's own plugin label (#40001123:6832). */
  private static readonly SAMPLE_PLUGIN = 'Active\nPlugins';

  /** The two lines of the credit, with the one run the file fills explicitly. */
  private _creditLines(): unknown[] {
    const raw = this.credit?.trim() || OutputFooterArea.SAMPLE_CREDIT;
    const [first = '', second = ''] = raw.split('\n');
    // "Raibach.net © 2026 Raibach IDS" — the © is drawn as its own filled run.
    const parts = second.split(/(©)/g);
    return [
      html`<p>${first}</p>`,
      html`<p>${parts.map((p) =>
        p === '©' ? html`<span class="credit-fill">${p}</span>` : html`${p}`,
      )}</p>`,
    ];
  }

  /** The two lines of the Active/Plugins label. */
  private _pluginLines(): unknown[] {
    const raw = this.pluginLabel?.trim() || OutputFooterArea.SAMPLE_PLUGIN;
    return raw.split('\n').map((l) => html`<p>${l}</p>`);
  }

  render() {
    return html`
      <div class="area" data-node-id="40001123:6689" data-name="output-footer-area">
        <div
          class="gripper"
          data-node-id="40001123:6692"
          data-name="gripper-prompt-input-chat-menu"
          role=${this.gripEnabled === false ? 'presentation' : 'separator'}
          aria-hidden=${this.gripEnabled === false ? 'true' : 'false'}
        >
          <div data-node-id="40001123:6693" data-name="Meatballs">
            <img class="meatballs" data-name="Meatballs" src=${meatballs} alt="" />
          </div>
        </div>

        <div class="shell-wrap" data-node-id="40001123:6690">
          <div class="shell-flip">
            <div class="shell" data-name="chat-output-footer">
              <div class="controls-flip">
                <div class="controls" data-node-id="40001123:6722">
                  <div class="marks" data-node-id="40001123:6723">
                    <div class="plugin-group" data-node-id="40001123:6829">
                      <div
                        class="btn plugins"
                        data-node-id="40001123:6830"
                        data-name="Function - loads cards form console in prompt area"
                      >
                        <div class="btn-label" data-node-id="40001123:6831" data-name="btn-label">
                          <div class="btn-text" data-node-id="40001123:6832">${this._pluginLines()}</div>
                        </div>
                      </div>
                    </div>
                    <img class="mark" data-node-id="40001124:7035" data-name="forum 1" src=${forumMark} alt="" />
                    <img class="mark" data-node-id="40001123:6728" data-name="chat history" src=${historyMark} alt="" />
                    <img class="mark" data-node-id="40001123:6732" data-name="add-new-conversation" src=${addMark} alt="" />
                    <img class="mark" data-node-id="40001123:6724" data-name="user--feedback 1" src=${feedbackMark} alt="" />
                  </div>
                  <div
                    class="btn credit"
                    data-node-id="40001123:6738"
                    data-name="Function - loads cards form console in prompt area"
                  >
                    <div class="btn-label credit" data-node-id="40001123:6739" data-name="btn-label">
                      <div class="credit-text" data-node-id="40001123:6740">${this._creditLines()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('output-footer-area')) {
  customElements.define('output-footer-area', OutputFooterArea);
}

declare global {
  interface HTMLElementTagNameMap {
    'output-footer-area': OutputFooterArea;
  }
}
