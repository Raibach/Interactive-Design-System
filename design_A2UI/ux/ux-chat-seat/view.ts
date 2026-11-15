/**
 * THE UX SEAT'S VIEW — the column's frame, the rail, the five boxes and the page's own prechat,
 * as one template.
 *
 * Moved from `ux-chat-seat.ts` without a rule changed. It reads the seat it is handed; it holds no
 * state and starts no work.
 */
import { html, nothing } from 'lit';
import historyIcon from '@/assets/figma-chat-history-icon.svg';
import logoAsset from '@/components/lit/assets/chat-logo-carbon.svg';

/** The seat, as this view reads it. */
export function seatView(host: any) {
    /*
     * A SEAT MARKED `productRoom` HAS NO OTHER FACE (owner, 2026-10-06: *"no fallbacks in this
     * application … I would rather it just be a blank page than have a fallback."*). Until the
     * product binding lands — `productTools: true`, set by the room once the engine's carrier
     * answers — this seat draws NOTHING: no tray, no messages branch, no chrome. Every other
     * seat has `productRoom` unset and renders fully as before.
     */
    if (host.productRoom && !host.productTools) return html``;
    const seated = host._seatSlotted();
    const usage = host.usage ?? {};
    const attributed = host.usage?.attributed === true;
    const unannotated = (host.unannotatedInUse ?? []).length > 0;
    return html`
      <!-- THE COLUMN'S SPACER — "chat-left-spacer" #40001085:2598, and it is this
           component's first child, not the host's.

           THE DESIGN PUTS THREE SIBLINGS IN ONE CONTAINER: "right-column-panel-
           container" #40001066:3272 holds spacer (x -14857, w 20), rail (x -14837,
           w 74) and panel (x -14763, w 540), with paddingTop 10 and a fill behind
           all three. THIS element is that container in the app, so the strip is
           rendered here — beside the rail and the panel — and the container's own
           padding and fill reach it, which they could not while it was a sibling of
           the pane outside this component. That was the fault behind three visible
           symptoms: the strip standing 10px proud of the rail, showing the shell
           through its transparency instead of the container's fill, and covering the
           container's top inset band.

           The drag STARTS here too, on this element, and leaves as the rail's own
           declared contract — right-column-drag-start, which the allowlist has
           declared all along and nothing emitted. The host owns the widths, so the
           host does the sizing; the component owns the grip, so the component
           raises the gesture. -->
      <div
        class="gripper-chat"
        data-node-id="40001085:1470"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the chat column"
        @pointerdown=${host._onGripDown}
      >
        <!-- Figma "Meatballs-for-spacer-between-columns" #40001085:1478. One glyph,
             two colours, from the two states of set "chat-left-spacer"
             #40001085:2598: state=Default strokes #B4B4B4, state=Hover strokes
             #7E72E3. Drawn with currentColor so the hover is a colour change and not
             a second asset. -->
        <svg width="10" height="38" viewBox="0 0 10 38" fill="none" aria-hidden="true">
          <ellipse cx="5.35914" cy="2.08103" rx="1.08108" ry="1.02564" transform="rotate(-90 5.35914 2.08103)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.35914" cy="8.56736" rx="1.08108" ry="1.02564" transform="rotate(-90 5.35914 8.56736)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.35914" cy="15.0537" rx="1.08108" ry="1.02564" transform="rotate(-90 5.35914 15.0537)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.56422" cy="22.081" rx="1.08108" ry="1.02564" transform="rotate(-90 5.56422 22.081)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.56422" cy="28.5674" rx="1.08108" ry="1.02564" transform="rotate(-90 5.56422 28.5674)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.56422" cy="35.0537" rx="1.08108" ry="1.02564" transform="rotate(-90 5.56422 35.0537)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <slot
        class=${seated ? 'seat' : 'seat empty'}
        @slotchange=${host._onSlotChange}
      ></slot>
      ${seated
        ? nothing
        : html`
            <design2-ux-chat-navigation-bar
              active-tab=${host.activeTab}
              ?rail-owned-by-host=${host.railOwnedByHost}
              allowed-tabs=${host.allowedTabs || 'chat,tools,approvals,ux,settings'}
              tab-labels=${host.tabLabels}
              disabled-tabs=${host.disabledTabs}
              ?collapsed=${host.collapsed}
              ?unread=${host._unread}
              ?approval-waiting=${host._approvalWaiting}
              @tab-change=${host._onTabChange}
              @collapse-toggle=${host._onCollapseToggle}
            >
              <img slot="logo" src=${logoAsset} width="50" height="50" alt="Grace" />
            </design2-ux-chat-navigation-bar>
            <div class="panel tab-${host.activeTab || 'none'} ${host.collapsed ? 'collapsed' : ''}">
              <!-- The listener sits on the WRAPPER so it hears conversation-select
                   from the Conversations dropdown below and from the thread. -->
              <div class="chat-output-wrapper" @conversation-select=${host._onConversationSelect}
                     @toggle-output-window=${host._onOutputWindow}
                     @remove-output-window=${host._onOutputWindow}>
                <!-- THE STATUS BLOCK IS ABSENT WHEN IT HAS NOTHING TO SAY, not merely empty.
                     chat-header draws nothing inside such a block, but the ELEMENT would still
                     be there — and it is :first-child, so the leading block's deeper top
                     padding (20px, the drawing's own value for the first block) landed on an
                     empty box while the bar below it kept 10 and sat tight against the top
                     (owner, 2026-09-19). Absent, the block after it leads and takes the 20. -->
                <!-- THE TOP PANEL IS ALWAYS DRAWN — it is the first block of the output
                     area in v.4b (#40001119:6308), not a conditional one. It was gated on
                     _hasStatusLine, so a seat with no status text lost the block entirely
                     and the Conversations bar took the top. The owner, 2026-09-20: "you
                     left out the top panel." The drawing stacks four blocks and the status
                     line is the first of them; whether it HAS anything to say is
                     chat-header's business, not whether the block exists.
                     THE TOKEN READOUT LIVES HERE NOW, not in the foot: the owner,
                     2026-09-20: "The top panel contains Tokens: 0, it doesn't go into
                     footer anymore." The drawing's status line is the readout line — the
                     numbers are joined into it by chat-header, which is where the navy
                     bar's readouts went when it was replaced. -->
                <!-- THE OTHER TWO BARS, AS v.4b DRAWS THEM. The wireframe stacks three
                     single-line bars above the response card — the session status
                     (#40001119:6309), "23 Conversations" (#40001119:6318) and
                     "23 Ready for approval" (#40001119:6579) — and each sits on its own
                     #CBE6E3 block. The numbers here are the panel's own: the package's
                     conversations and the reports filed for approval. The wireframe's
                     "23" is sample copy and is not drawn — a count that is not the real
                     count is the one thing a status bar must never say. The Conversations
                     bar is the drawing; the SELECTOR that used to hang under it
                     ("chat-output-slot-area" #40001085:1521) is switched off below. -->
                <!-- THE LEADING BAR OPENS THE CONVERSATIONS — the owner, 2026-09-19: "I should be
                     able to go to the chat at the top and it should expand so that I can see the
                     message that you just archived." It is the list's header, so it acts like
                     one: click (or Enter/Space) to open it, and the rows below come from the same
                     read as the count — the package's own conversations, ARCHIVED ONES INCLUDED,
                     which is how a conversation this seat archived stays reachable. -->
                <!-- THE CONVERSATIONS BAR'S OWN LAYERS, from the file: the block 40001119:6317
                     holds #40001126:2014 (500x7, centred), its row #40001126:2015, and five
                     dots #40001126:2016-2020. Each copy of this bar carries its own ids.
                     RE-POINTED: the designer re-drew this gripper, so the file deleted
                     40001123:6765-6771 and created the same layer under new ids — same name,
                     same size, same place in the block. The markers follow the layer the file
                     draws today; a marker left on a dead id claims nothing and compares
                     nothing. (The re-draw also dropped the gold accent dot: all five now carry
                     the one stroke, as the readout's five already did.) -->
                <design2-ux-output-header
                  line=${host._statusLine}
                  ?attributed=${attributed}
                  ?readout-filled=${host._statusContentSlotted}
                >
                  <!-- THE ROOM'S READOUT STRIP RELAYS THROUGH HERE (owner, 2026-10-13 late
                       — the trace facts go in THIS bar). A room appends its strip to this
                       seat with slot="status-content"; the relay forwards it into the
                       bar's own door (readout-content). Empty elsewhere: nothing is
                       forwarded and the bar is exactly what it always was. -->
                  <slot name="status-content" slot="readout-content" @slotchange=${host._onStatusSlotChange}></slot>
                </design2-ux-output-header>
                <!-- THE CONVERSATION FURNITURE STEPS OUT WHERE A ROOM'S OWN VIEW SHOWS
                     (owner, 2026-10-13 late: "you can remove the conversation panel …
                     in the trace view. We don't need it there." — and the trace view
                     STAYS: the correction was "in the trace view", not removing it).
                     When the active tab's claimant is a host view (the trace room's
                     tree on Trace, its detail on Preview), this bar is not drawn — a
                     tab showing its own view shows THE VIEW, nothing appended. Every
                     other tab and every other room: unchanged. -->
                ${host._outputWindows.includes('conversations')
                  ? html`<design2-ux-chat-header
                  data-slot="conversations"
                  status-text=${(() => {
                    const n = host.activeTab === 'approvals' ? 0 : (host._conversationRows?.length ?? 0);
                    // The drawing's copy is "23 Conversations"; one of them is one conversation.
                    return `${n} ${n === 1 ? 'Conversation' : 'Conversations'}`;
                  })()}
                  role="button"
                  tabindex="0"
                  aria-expanded=${host._conversationsOpen ? 'true' : 'false'}
                  aria-label="Show this package's conversations"
                  icon=${historyIcon}
                  icon-node="40001123:6745"
                  icon-size="22"
                  block-node="40001119:6317"
                  bar-node="40001119:6318"
                  text-node="40001123:6744"
                  grip-node="40001126:2014"
                  grip-row-node="40001126:2015"
                  grip-dots="40001126:2016,40001126:2017,40001126:2018,40001126:2019,40001126:2020"
                  dm-sans
                  ?open=${host._conversationsOpen}
                  @click=${host._toggleConversations}
                  @keydown=${host._onConversationsKey}
                >
                  <!-- THE NEW-CONVERSATION MARK, BESIDE THE BAR'S OWN (owner, 2026-11-03: *"The
                       tools has a new chat button … that new chat button should also be on the
                       chat conversations"*). It starts the same conversation the seat's own
                       start path starts; the press stops at the button so the bar does not
                       also fold the card. -->
                  <button
                    slot="bar-actions"
                    class="conv-new"
                    type="button"
                    title="New conversation"
                    aria-label="New conversation"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      host._startNewConversation();
                    }}
                  >+</button>
                  <!-- THE LIST IS ALWAYS INSIDE THE CARD (owner, 2026-10-31: *"you can't hide the
                       conversations when I expand it, they have to expand with the drag"*). A press
                       on the bar and a pull on the dots both resize the card; neither takes the
                       rows away. -->
                  <ul class="conversation-list">${host._conversationRowsForList()}</ul>
                  ${host._listNote ? html`<p class="conv-note" role="status">${host._listNote}</p>` : nothing}
                </design2-ux-chat-header>`
                  : nothing}
                <!-- THE DROPDOWN IS OUT OF THE TOP; ITS CAPABILITY IS NOT. See the
                     _conversationsTopSlot field above: v.4b draws no selector here, and the
                     owner's plan is that conversations open from the footer's own mark
                     (#40001119:6622), so the block is switched off rather than deleted. -->
                ${host._conversationsTopSlot
                  ? html`
                      <div class="output-slot">
                        <design2-ux-small-dropdown label="Conversations">
                          ${host._conversationItems()}
                        </design2-ux-small-dropdown>
                      </div>
                    `
                  : nothing}
                ${unannotated
                  ? html`<design2-ux-error-banner
                      code="UNANNOTATED-IN-USE"
                      message="A component in use was generated without its catalog annotation — its behaviour is being invented downstream."
                    ></design2-ux-error-banner>`
                  : nothing}
                <!-- THE REPAIR LIST IS NOT DRAWN HERE ANY MORE. It was a permanent
                     sibling in this template — a console list above the composer in
                     every assembly, owned by the panel rather than by the surface that
                     has the findings. It arrives the same way the trace view does, in
                     the "view" slot below: chat-panel draws the slot, the surface fills
                     it. See chat-repair-actions and the console assembler. -->
                <!-- THE CONTENT SLOT — the design's "Current content goes here"
                     (chat-output-simple-slot-area #40001085:2373, whose note reads
                     "holds plain text output and inserted functions").
                     The CHAT tab shows the thread; every other tab shows whatever
                     the host slots into the "view" slot — Trace, Versions, Tools or
                     Approvals. One slot, four views: the slot stays generic and the
                     view decides, which is the same split as the dropdown. -->
                <!-- A HOST-FILLABLE SLOT ABOVE THE WORK — the hole a host fills with
                     whatever belongs at the top of the content: the canvas's own
                     events, a run's notes, a summary of what is being worked on. The
                     same idea as the "view" slot one level down, and EMPTY BY DEFAULT
                     ON PURPOSE: the wrapper takes no height and paints nothing when
                     nothing is slotted, so every existing assembly is unchanged.
                     Anything slotted here brings its own height, border and disclosure. -->
                <!-- THE ONE SCROLLER. Everything below the conversations dropdown and
                     above the composer moves under a single scrollbar on this column's
                     right edge: the repairs, the thread, whatever view the rail selected.
                     There are no inner scrollers here any more — a repair list that
                     scrolls inside a column that also scrolls is two scrollbars for one
                     movement, and the owner's rule is one (2026-09-18). It also means a
                     list GROWS as long as it is: 500 repairs is 500 rows down, which is
                     the incentive to clean them up, and a cap would hide exactly that. -->
                <!-- THE RESPONSE CARD — v.4b's fourth block is the card itself
                     (#40001119:6327 / its block :6326): the same shell as the bars with
                     the response inside it. The scroller and every view that was in the
                     output area before are inside it, unchanged: the thread, the trace
                     fold, the view slot, the content-header slot. -->
                <design2-ux-chat-header card data-slot="session" .hasResults=${host._hasResultTurns}>
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
                            <design2-ux-chat-fold
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
                            </design2-ux-chat-fold>
                          </div>`
                        : nothing}
                      ${host._historyError
                        ? html`<p class="conversation-none" role="alert">${host._historyError}</p>`
                        : nothing}
                      ${host.productTools
                        ? html`<design2-ux-chat-product-thread
                            .messages=${host._thread}
                            ?running=${host.productRunning}
                            .runStartedAt=${host.productRunStartedAt || 0}
                            .expectedMinutes=${host.productExpectedMinutes || 0}
                          ></design2-ux-chat-product-thread>`
                        : host.activeTab === 'ux' && host._uxLoaded && !host._historyError
                            && !host._thread.some((turn) => turn.role === 'user')
                          ? html`<design2-posthog-prechat
                              @ux-prechat-send=${(e: CustomEvent<{ prompt?: string }>) =>
                                void host._uxSend(String(e.detail?.prompt || ''), { asked: true })}
                              @ux-prechat-fill=${(e: CustomEvent<{ prompt?: string; hint?: string }>) =>
                                host._uxFill(`${String(e.detail?.prompt || '')}${e.detail?.hint ? ` ${e.detail.hint}` : ''}`)}
                            ></design2-posthog-prechat>`
                          : html`<design2-ux-chat-messages
                              .messages=${host._thread}
                              .sending=${host._workActive}
                              .stage=${host._workStage}
                              .spentActions=${[...host._spent]}
                              .spentTurn=${host._spentTurn}
                              .doneActions=${host._stepsDone()}
                            ></design2-ux-chat-messages>`}`
                    : host.activeTab === 'trace' && !host._tabClaimant('trace')
                      ? html`<div class="fold-wrap">
                          <design2-ux-chat-fold
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
                          </design2-ux-chat-fold>
                        </div>`
                      : host.activeTab === 'sessions'
                        ? html`<div class="sessions-out">
                            <design2-ux-sessions-feed
                              .queryRows=${host._laneRows}
                              .receipt=${host._laneReceipt}
                              .laneError=${host._laneError}
                              ?laneBusy=${host._laneBusy}
                              @sessions-lane-clear=${host._onSessionsLaneClear}
                            ></design2-ux-sessions-feed>
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
                  <!-- THE DRAWN SCROLLBAR, INSIDE THE CARD. It is a SIBLING of the scroller
                       and a child of the card, so it holds the card's right edge while the
                       conversation travels under it — the card owns position: relative for
                       it (see chat-header). Nothing at all when the content fits
                       (_railVisible false); a 4px thumb over the card when it does not —
                       _syncScrollThumb holds its length and offset. -->
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
                </design2-ux-chat-header>
              </div>
              <div class="chat-input-wrapper">
                <design2-ux-chat-action-bar
                  model-label=${host.modelLabel ?? 'Models'}
                  trailing=${host._seatIsConsole === false ? 'console' : 'agent'}
                  composer-package=${host.composerPackageId ?? ''}
                  ?busy=${host._sending}
                  ?has-text=${host._draft.trim().length > 0}
                  @send-input-to-model=${host._onSendCommand}
                  @stop-model-thinking=${host._onStopCommand}
                ></design2-ux-chat-action-bar>
                <design2-ux-chat-input
                  .height=${host.inputHeight}
                  @message-sent=${host._onMessageSent}
                  @keydown=${host._onComposerKey}
                >
                  <design2-ux-prompt-textarea
                    placeholder="chat input"
                    @value-input=${host._onDraftInput}
                    @paste=${host._onProductPaste}
                  ></design2-ux-prompt-textarea>
                </design2-ux-chat-input>
                <!-- THE TRAY IS v.4b's FOOT. The navy <design2-ux-chat-footer> that stood here is
                     REPLACED: the drawing does not draw it, and the owner's ruling is that
                     the drawing is the truth — "If the design doesn't draw it, then it's
                     been replaced. This is the new truth replace it." Its token readouts are
                     a live FUNCTION, and a function does not leave with a drawing, so they
                     move onto this bar and take its treatment — the same move that put them
                     on the navy bar when the #CFD7D5 bar it replaced went away. -->
                <!-- v.4b's foot, OR THE PRODUCT ROOM'S OWN TOOLS (owner, 2026-10-06:
                     "all of these stubs go. And you're gonna put the products wiring
                     down."). The flag is the product room's binding alone — every other
                     seat keeps the tray (its five marks retired 2026-10-14; label and
                     credit alone — see its header). See <design2-ux-chat-product-tools>. -->
                ${host.productTools
                  ? html`<design2-ux-chat-product-tools
                      .figmaConnected=${host.productFigmaConnected}
                      .githubConnected=${host.productGithubConnected}
                      .visualEditActive=${host.productVisualEditActive}
                      @product-attach=${(e: CustomEvent<{ files: File[] }>) =>
                        host._forwardProductAttach(e.detail.files)}
                      @product-tool=${(e: CustomEvent<{ tool: string }>) =>
                        host._forwardProductTool(e.detail.tool)}
                    ></design2-ux-chat-product-tools>`
                  : html`<design2-ux-chat-plugin-tray></design2-ux-chat-plugin-tray>`}
              </div>
            </div>
          `}
    `;
}
