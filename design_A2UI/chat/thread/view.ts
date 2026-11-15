/**
 * THE THREAD'S VIEW — the output card: the one scroller, the thread or the tab's own view, and
 * the drawn scrollbar.
 *
 * The thread place of the conversation/messages/input extraction named in RULES.md. It takes the
 * seat through `ThreadHost` and owns no state: the seating, the scroll and the lane are the
 * seat's; this file is the drawing of the card and its four views (the thread, the trace fold,
 * the sessions feed and the host's own view slot).
 */
import { html, nothing, type TemplateResult } from 'lit';
import '../parts/design-chat-header';
import '../parts/design-chat-fold';
import '../parts/design-chat-messages';
import '../parts/design-chat-product-thread';
import '../parts/design-sessions-feed';

export interface ThreadHost {
  _hasResultTurns: boolean;
  _showsThread: boolean;
  _chatTopView(): boolean;
  _inspectionReports: Array<{ content?: unknown }>;
  activeTab: string;
  _approvalsOpen: boolean;
  _traceOpen: boolean;
  _tabClaimant(tab: string): boolean;
  _viewSlotted(): boolean;
  _emptyViewLine(): unknown;
  _historyError: string;
  productTools: boolean;
  productRunning: boolean;
  productRunStartedAt?: number;
  productExpectedMinutes?: number;
  _thread: unknown[];
  _workActive: boolean;
  _workStage: string;
  _spent: Set<string>;
  _spentTurn: string;
  _stepsDone(): string[];
  _laneRows: unknown;
  _laneReceipt: string;
  _laneError: string;
  _laneBusy: boolean;
  _showScrollBar: boolean;
  _railVisible: boolean;
  _scrollMax: number;
  _scrollPos: number;
  _thumbH: number;
  _thumbTop: number;
  _onOutputScroll(e: Event): void;
  _onSlotChange(): void;
  _onSessionsLaneClear(): void;
  _onThumbDown(e: MouseEvent): void;
  requestUpdate(): void;
}

export const threadView = (host: ThreadHost): TemplateResult => html`
  <design2-chat-header card data-slot="session" .hasResults=${host._hasResultTurns}>
    <div class="content-scroll" @scroll=${host._onOutputScroll}>
      <div class="content-header"><slot name="content-header"></slot></div>
    ${host._showsThread
      ? html`${host._chatTopView()
          ? html`<div class="chat-top">
              <slot name="view" @slotchange=${host._onSlotChange}></slot>
            </div>`
          : nothing}
        ${host.activeTab === 'approvals' && host._inspectionReports.length
          ? html`<div class="fold-wrap">
              <design2-chat-fold
                label="Inspections"
                count=${`${host._inspectionReports.length} filed`}
                ?open=${host._approvalsOpen}
                @fold-toggle=${(e: CustomEvent<{ open: boolean }>) => { host._approvalsOpen = e.detail.open; host.requestUpdate(); }}
              >
                <div class="inspection-reports">
                  ${host._inspectionReports.map(
                    (r) => html`<article class="inspection-report">
                      ${String(r.content || '')
                        .split('\n')
                        .map((line) => {
                          const t = line.trim();
                          if (!t) return nothing;
                          const cls = t.startsWith('‼')
                            ? 'line-attention'
                            : t.startsWith('✓')
                              ? 'line-ok'
                              : t.startsWith('INSPECTION')
                                ? 'line-head'
                                : 'line-body';
                          return html`<div class=${cls}>${t}</div>`;
                        })}
                    </article>`,
                  )}
                </div>
              </design2-chat-fold>
            </div>`
          : nothing}
        ${host._historyError
          ? html`<p class="conversation-none" role="alert">${host._historyError}</p>`
          : nothing}
        ${host.productTools
          ? html`<design2-chat-product-thread
              .messages=${host._thread}
              ?running=${host.productRunning}
              .runStartedAt=${host.productRunStartedAt || 0}
              .expectedMinutes=${host.productExpectedMinutes || 0}
            ></design2-chat-product-thread>`
          : html`<design2-chat-messages
              .messages=${host._thread}
              .sending=${host._workActive}
              .stage=${host._workStage}
              .spentActions=${[...host._spent]}
              .spentTurn=${host._spentTurn}
              .doneActions=${host._stepsDone()}
            ></design2-chat-messages>`}`
      : host.activeTab === 'trace' && !host._tabClaimant('trace')
        ? html`<div class="fold-wrap">
            <design2-chat-fold
              label="Trace"
              ?open=${host._traceOpen}
              @fold-toggle=${(e: CustomEvent<{ open: boolean }>) => { host._traceOpen = e.detail.open; host.requestUpdate(); }}
            >
              <slot name="view" @slotchange=${host._onSlotChange}></slot>
              ${host._viewSlotted()
                ? nothing
                : html`<div class="view-waiting" role="status">
                    ${host._emptyViewLine()}
                  </div>`}
            </design2-chat-fold>
          </div>`
        : host.activeTab === 'sessions'
          ? html`<div class="sessions-out">
              <design2-sessions-feed
                .queryRows=${host._laneRows}
                .receipt=${host._laneReceipt}
                .laneError=${host._laneError}
                ?laneBusy=${host._laneBusy}
                @sessions-lane-clear=${host._onSessionsLaneClear}
              ></design2-sessions-feed>
            </div>`
          : html`<div class="view-slot tab-${host.activeTab || 'none'}">
              <slot name="view" @slotchange=${host._onSlotChange}></slot>
              ${host._viewSlotted()
                ? nothing
                : html`<div class="view-waiting" role="status">
                    ${host._emptyViewLine()}
                  </div>`}
            </div>`}
    </div>
    ${host._showScrollBar && host._railVisible
      ? html`<div class="scroll-rail">
          <div
            class="scroll-thumb"
            role="scrollbar"
            aria-orientation="vertical"
            aria-label="Scroll the chat"
            aria-valuemin="0"
            aria-valuemax=${host._scrollMax}
            aria-valuenow=${host._scrollPos}
            style=${`height: ${host._thumbH}px; top: ${host._thumbTop}px`}
            @mousedown=${host._onThumbDown}
          ></div>
        </div>`
      : nothing}
  </design2-chat-header>
`;
