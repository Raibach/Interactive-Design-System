/**
 * THE SEAT'S CONNECTIONS — what it listens to while it stands, and what it lets go when it leaves.
 *
 * Moved from `design-chat-seat.ts` without a rule changed. The handlers are the seat's own
 * arrow-function fields, so the listener and the remover are the same function; a new binding
 * here would leave a listener on the window that nothing can remove.
 *
 * The room's messages, the section's refusals, the model's status, the product room's opening,
 * the approval pulse, the window resize and the reply's own button all arrive here.
 */
import { consumeArrival } from '@/shared/arrival';
import { sendAction, sendCommandAction } from './send';
import { processReplyAction, actionSend, withdrawOfferAction } from './replies';

export function connectSeat(host: any): void {
    /*
     * THE SEND AND REPLY ACTIONS ARE PUT ON THE ELEMENT, NOT WRAPPED IN IT. The seat's own methods,
     * its template and `thread/actions/reply.ts` call these names; the functions behind them live
     * in `./send` and `./replies`, and this is the one place they are bound to the seat.
     */
    host._send = (text: string, opts?: { silent?: boolean; asked?: boolean }) =>
      sendAction(host, text, opts);
    host._onSendCommand = () => sendCommandAction(host);
    host._processReply = (content: string) => processReplyAction(host, content);
    host._onActionSend = (e: Event) => actionSend(host, e);
    host._withdrawOffer = () => withdrawOfferAction(host);
    // THE WORK CARD'S OTHER HALF — the room's host announces its build (see `_onGraceStatus`).
    window.addEventListener('a2ui:grace-status', host._onGraceStatus as EventListener);
    /*
     * THE OPENING MAY HAVE BEEN ANNOUNCED BEFORE THIS SEAT EXISTED. A composer
     * announces itself in the same commit that creates this element, so the event
     * can be gone by the time there is anything to hear it — measured, and the
     * reason the announcement is also recorded (shared/arrival). This is the other
     * half of that: the record is consumed on arrival, and the greeting waits for
     * the history attempt either way.
     */
    // FOR THIS SEAT ONLY. A record left by another seat's arrival stays where it is — see
    // shared/arrival: eating it here is how the seat it was addressed to never hears it.
    const arrived = consumeArrival(host.sessionId ?? null);
    if (arrived) host._takeArrival(arrived.kind);
    void host._loadTools();
    window.addEventListener('a2ui:system-message', host._onHostSay);
    // A write that landed nowhere is reported where the person is already reading. The editor
    // is inside this same surface and has been dispatching this all along with nothing on the
    // other end — see _onWriteFailed.
    window.addEventListener('section-write-failed', host._onWriteFailed as EventListener);
    window.addEventListener('a2ui:ask-grace', host._onHostAsk as EventListener);
    window.addEventListener('a2ui:composer-opened', host._onComposerOpened as EventListener);
    // A chat button's answer arrives here from <design2-chat-messages> and goes down the one send
    // path this seat has — the same one the input uses.
    host.addEventListener('chat-action-send', host._onActionSend);
    // The thumb's length depends on the region's height, so a window resize re-measures it.
    window.addEventListener('resize', host._onOutputScroll);
    // THE APPROVALS' SIGNAL — the Approve icon pulses when the person has something waiting.
    host.addEventListener('design-approval-count', host._onApprovalCount as EventListener);
    window.addEventListener('design-approval-changed', host._onApprovalChanged);
    void host._readApprovalWaiting();
}

export function disconnectSeat(host: any): void {
    window.removeEventListener('a2ui:system-message', host._onHostSay);
    window.removeEventListener('section-write-failed', host._onWriteFailed as EventListener);
    window.removeEventListener('a2ui:ask-grace', host._onHostAsk as EventListener);
    window.removeEventListener('a2ui:grace-status', host._onGraceStatus as EventListener);
    window.removeEventListener('a2ui:composer-opened', host._onComposerOpened as EventListener);
    host.removeEventListener('chat-action-send', host._onActionSend);
    window.removeEventListener('resize', host._onOutputScroll);
    host.removeEventListener('design-approval-count', host._onApprovalCount as EventListener);
    window.removeEventListener('design-approval-changed', host._onApprovalChanged);
    host._outputRO?.disconnect();
    host._outputRO = null;
    if (host._deleteTimer) {
      clearTimeout(host._deleteTimer);
      host._deleteTimer = null;
    }
    // A GESTURE CANNOT OUTLIVE THE ELEMENT — the strip's document listeners come off here as
    // well as on the release. See `_releaseGrip` for what a survivor does to the layout.
    host._releaseGrip();
}
