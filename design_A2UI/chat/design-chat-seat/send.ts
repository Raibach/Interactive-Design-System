/**
 * THE SEAT'S SEND PATH — what happens between a person's words and her answer.
 *
 * Moved from `design-chat-seat.ts` without a rule changed. The session lane's query takes its own
 * road; a person's turn is recorded, the seat is moved off a stored query, the turn is posted to
 * the model with the package and conversation it belongs to, and the answer is turned into turns
 * and drawn. The request is one call to `/api/teacher/query`; the reply is processed by
 * `./replies`.
 */
import { logger } from '@/lib/logger';
import { uxCapture } from '@/shared/uxCapture';
import * as input from '../input/actions';

export async function sendAction(
  host: any,
  text: string,
  opts: { silent?: boolean; asked?: boolean } = {},
): Promise<void> {
    text = (text ?? '').trim();
    if (!text || host._sending) return;
    /* THE SESSIONS TAB DOES NOT SPEAK — IT ASKS. This check sits ABOVE the tab flip below,
       because that flip would otherwise drag the person into the chat tab and turn their
       query into a conversation turn, which is the exact thing the owner ruled out
       (2026-10-18). Only a person's own utterance reaches this branch: `silent`/`asked`
       sends are the app talking to itself and never arrive from this input. */
    if (host.activeTab === 'sessions') {
      void host._runSessionsLane(text);
      return;
    }
    /* THE PERSON'S OWN TURN, RECORDED — AND NOTHING IT SAID. The capture vocabulary has no
       content dimension; `kind` is a name, not words. Silent sends (arrivals, run reviews) are
       the app talking to itself and are not the person's act, so they are not sent. The seat's
       session is the composer package when it belongs to one — that is the flow the record
       ties the interaction to. */
    if (!opts.silent) {
      uxCapture(
        'message_sent',
        'chat-panel',
        { kind: 'person' },
        host.sessionId ? { flow: host.sessionId } : {},
      );
    }
    /* A CHAT TURN IS NEVER WRITTEN INTO A QUERY RECORD. A stored query holds one user message —
       the words that were turned into a filter — and a conversation of that kind is not a
       thread. Sending here releases the binding, so the turn starts a real conversation
       instead of adding prose to a record the lane owns. */
    if (host._currentRowIsLane()) host._moveSeatTo('');
    /*
     * A QUESTION IS ASKED IN THE CHAT TAB — AND NOWHERE ELSE.
     *
     * Governance's rail law: the conversations live in Chat, the other tabs carry views
     * of the thing being worked (the owner, 2026-10-13: *"if anyone wants to chat, it has
     * to shift back to the chat tab … the user is going to have to manually go back to
     * the trace that they were working on"*). So a person who types — or presses send —
     * while looking at Trace, Tools or any other view lands in the thread, because that
     * is where their turn is going to be drawn. THE TRIGGER IS THE SEND ONLY: focusing
     * the input, clicking a rail tab, or simply looking at a view never flips anything,
     * and the return to a view is the person's own click, never automatic. Approvals is
     * exempt: the console's recorded rule draws the thread there on purpose (the tab a
     * person asks the governance system its report from). Silent turns never flip —
     * nothing the person did raised them.
     */
    if (
      !opts.silent
      && host.activeTab !== 'chat'
      && host.activeTab !== 'approvals'
    ) {
      host.activeTab = 'chat';
    }
    /*
     * THE HARD STOP — SHE IS NOT MADE TO SPEAK INTO A PACKAGE THAT HAS ALREADY RUN.
     *
     * This is the one place it is enforced, and it is enforced HERE because every rule that was
     * supposed to be quiet — the arrival greeting, the run's own conversation being adopted, the
     * console hello, whatever the host asks for — arrives through this function. Gating the rules
     * individually is what let her keep talking: each new path into a send had to remember a rule
     * it did not know about. The owner, 2026-09-24: "Grace needs to stop talking unless she's asked
     * a question … stop questioning me."
     *
     * WHAT IS NOT SILENCED: the person's own turn (`silent` is false — that is the question she is
     * answering), the RUN REVIEW, which is the app asking her to judge a prompt before a run that
     * has not happened yet, and — the third kind, added 2026-10-02 — THE TURN A PERSON ASKED FOR BY
     * PRESSING A CONTROL (`asked`). Everything else — a greeting, a suggestion, a note of her own —
     * waits until the person asks, which is the whole of the rule.
     *
     * ON `asked`, AND WHY IT IS A FLAG AND NOT A NEW CHANNEL. The owner, 2026-10-02, on the canvas's
     * ✨ Ask Grace: "a person pressing the button absolutely counts as 'the person asking'… there is
     * no difference between a user typing a manual command or clicking an explicit, contextual
     * button tile." The rule above exists to stop her speaking UNINVITED; a press is an invitation,
     * and leaving the button dead is the failure it reads as. The flag is passed by exactly one
     * caller — `_onHostAsk`, the receiver of `a2ui:ask-grace` — and every dispatcher of that event
     * in this tree is a person's press: the Run gate and Apply all (both carry `review: 'run'`), the
     * canvas's trash and ✨, and the seat menu's "what is this seat for". It is a flag on the SEND
     * and not a new event, because a second channel would be a second authority on whether a person
     * asked. NOTE WHAT DOES NOT CHANGE: `person_turn` stays false (`!opts.silent`), so the app's
     * wording is never written into the thread as the person's words — the defect the owner found
     * on 2026-10-01.
     */
    if (opts.silent && !opts.asked && !host._reviewingRun && host._hasResultTurns) return;
    /*
     * THE CHAT DOES NOT REASON, AND THAT IS A MEASUREMENT, NOT A PREFERENCE.
     *
     * It used to reason on every turn the person typed. Measured on this provider, the
     * reasoning is the whole of what they waited for: 2000 reasoning tokens took 36.2
     * seconds and produced no answer at all once the ceiling was reached — 55 tokens a
     * second, which is simply the model's speed. A turn with it off answers in two to
     * ten seconds.
     *
     * The owner, 2026-09-28, after watching several: "make it zero".
     *
     * WHAT REPLACES IT IS STRUCTURE, NOT THINKING. Reasoning is what the model spends
     * when the choice set is wide, and the answer to a wide set is to narrow it before
     * the call rather than to pay for it during — which is what this codebase does for
     * every surface, and what the Few Shot seat exists for on the prompt side. The asks
     * already do it: the ones that state the shape come back in two seconds.
     */
    const wantsReasoning = false;
    // THE WRITE PATH IS CHECKED TOO, not just the read (2026-09-18). `_loadHistory` refuses a
    // conversation the package's own list contradicts; this is the same guard before a turn
    // is sent, because a foreign id in the property would otherwise be WRITTEN to — the
    // server trusts a client-supplied conversation id, so the seat is where it stops.
    if (host.conversationId && !host._conversationBelongsToPackage(host.conversationId)) return;
    /*
     * ── AND THE TURN IS NOT SENT INTO A ROOM SHE HAS NO WORDS FOR ──────────────────────────────
     *
     * THE OWNER, 2026-10-01: *"There are no fallbacks in the system."* This seat answered every
     * room with the composer's script when the surface had bound none, so a room with no identity
     * spoke in another room's voice — the failure the owner saw as *"she's saying the wrong thing…
     * she's a different thing in each room"* — and nothing anywhere said so. The room states her
     * words now (`_seat_grace` in routes/ai.py binds them; see `_gracePrompt`), and a room that
     * states none gets a refusal instead of an answer from a stranger.
     *
     * THE PERSON'S OWN TURN IS STILL DRAWN. Their sentence stays in the thread — losing it would
     * take their words away as well as her answer — and the defect is the turn beside it, so what
     * is said is said once and in the place they are already reading.
     *
     * BEFORE THE `_sending` FLAG AND BEFORE THE FETCH: nothing is sent, no usage is recorded
     * against the conversation, and no held Run is disturbed — a turn that never left does not
     * block the next one.
     */
    const grace = host._gracePrompt();
    if (grace.ok === false) {
      host._local = [
        ...host._local,
        { role: 'user', content: text },
        {
          role: 'assistant',
          alert: true,
          content:
            `I cannot answer in this room: ${grace.why}. ` +
            'The turn was not sent. This is a defect in the surface, not in what you asked — ' +
            'the room has to state who I am here before I speak in it.',
        },
      ];
      host._scrollThreadToBottom();
      try {
        logger.error('[chat-panel] refused a turn: the surface bound no words for this room', {
          conversationId: host.conversationId ?? null,
          sessionId: host.sessionId ?? null,
          instructions: host.instructions ?? '',
          graceLiveContext: host.graceLiveContext,
        });
      } catch (logError) {
        console.error('[chat-panel] the logger refused the refusal:', logError);
      }
      return;
    }
    const before = host._local.length;
    if (!opts.silent) {
      host._local = [...host._local, { role: 'user', content: text }];
      host._scrollThreadToBottom();
    }
    host._sending = true;
    /*
     * THE WORK CARD OPENS FOR EVERY ANSWER — the person's own turn AND the app's own asks
     * (owner, 2026-10-16: *"I'm seeing a pop as if it's a fixed text… I need to see the
     * model thinking. I wanna see spinning. I want to see the standard model behavior
     * inside of a chat window… I do not want to see text popping in there because I know
     * that is not real."*). Silent turns used to draw NOTHING, so every arrival's reply —
     * a room greeting, the section's introduction — landed with no thinking beat, and a
     * real model answer with an unseen wait reads as injected text. What stays silent is
     * only the ASK (it is never written as the person's turn); the WAIT is drawn — the
     * thinking card, the elapsed time, her actual seconds.
     */
    host._workActive = true;
    host._workStage = 'thinking';
    if (host._workTimer) clearTimeout(host._workTimer);
    // THE ROOM-AGNOSTIC CAP: a seat in a room that never builds must still end. The
    // no-build fallback below fires first for those seats; this cap is the last resort.
    host._workTimer = window.setTimeout(() => host._endWork(), 30000) as unknown as number;
    host.requestUpdate();
    let answered = false;
    /*
     * A CLEAN VERDICT IS SILENT, and this is the flag that keeps the silence in both
     * places a turn lands — the thread and the pending list. The review still runs and
     * the Run still waits on it; what is skipped is only the drawing of her "everything
     * is in place 🍾" reply, which is the same sentence every time and reads as noise
     * rather than news (the owner, 2026-09-24: "it seems fake"). A blocked verdict —
     * real news — is shown and held exactly as before.
     */
    let silentVerdict = false;

    try {
      host._abort = new AbortController();
      const turnUrl = '/api/teacher/query';
      const resp = await fetch(turnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': host._userId(),
          /* THE LEDGER ATTRIBUTES THE CALL TO THE SEAT IT WAS ABOUT. The middleware reads these
             two headers and never the body (a body read there deadlocks the request); without
             them the usage row names no package and the header can only show the user's totals. */
          'X-Package-Session': String(host.sessionId ?? ''),
          'X-Conversation-ID': String(host.conversationId ?? ''),
        },
        body: JSON.stringify({
          question: text,
          context: grace.text,
          mode: 'chat',
          /*
           * THE PERSON'S OWN TURN REASONS; THE PANEL'S ASK DOES NOT.
           *
           * Reasoning is what makes this wait long — the model is a reasoning
           * model, and `chat` is the one mode that turns thinking on, because a
           * person's message can be complicated and thinking about it is worth
           * the seconds. A seat description is not complicated: the sentence is
           * already written and handed over in the same request. There is nothing
           * to work out, and the delay was the whole of what a person noticed.
           *
           * This is the project's own rule, not a new one: reasoning belongs to
           * the chat input and the reply to it, and a summary or a tag pass does
           * not reason. Measured on this provider, reasoning off returned the same
           * valid answer in 1.53s where reasoning on took 6.05s.
           */
          reasoning: wantsReasoning,
          reasoning_style: 'chain_of_thought',
          include_memory: true,
          /*
           * WHO SPOKE — FALSE WHEN THE PANEL IS THE ONE ASKING.
           *
           * A silent send is the app asking Grace to open a conversation: the `question` is
           * an INSTRUCTION she is given ("A person has just landed on the console — the index
           * of every package they have built…"), and nobody typed it. The server records her
           * reply either way, and records the question only when a person said it — without
           * this, the instruction came back as the person's own turn the next time the thread
           * was read. The owner, 2026-09-23: "now it says a person has landed on the console —
           * the index of every package they have built …"
           */
          person_turn: !opts.silent,
          /*
           * WHICH TURNS ARE REVIEWS, so the server knows which replies are verdicts.
           * A clean `<run_ok/>` verdict is not recorded (see silentVerdict below and
           * the server's own note in routes/teacher.py): the thread was filling with
           * the same canned congratulations every run, and a record of the gate
           * passing is not what the person needs to read back.
           */
          run_review: host._reviewingRun,
          // No temperature here. It used to send 0.45 while the request model defaulted
          // to 0.45 and the backend passed it straight through — three homes for one
          // number, and three numbers waiting to disagree. `chat` has ONE: CHAT_TEMPERATURE
          // in grace_gui.py, chosen by mode, because this element does not own how she is
          // prompted.
          session_id: host.sessionId,
          conversation_id: host.conversationId,
        }),
        signal: host._abort.signal,
      });
      const data = await resp.json().catch(() => ({}));
      // THE SERVER'S ANSWER IS THE THREAD — adopted whenever it DIFFERS, not only when the
      // seat holds none. The server may have moved the thread: a CLOSED conversation starts
      // a new one (routes/teacher.py), and a seat that keeps the old id writes nothing into
      // the thread it is drawing — the reply is shown and then lost on reload. The move is
      // SHOWN, not silent.
      const returned = typeof data?.conversation_id === 'string' && data.conversation_id ? data.conversation_id : '';
      if (returned && returned !== host.conversationId) {
        const moved = !!host.conversationId;
        host.conversationId = returned;
        if (moved) {
          window.dispatchEvent(new CustomEvent('a2ui:system-message', {
            detail: {
              role: 'assistant',
              content: 'The previous conversation was closed — this reply continues in a new one.',
            },
          }));
        }
        host.dispatchEvent(
          new CustomEvent('conversation-change', {
            bubbles: true,
            composed: true,
            detail: { conversationId: returned },
          }),
        );
        // The header's list is re-read too: the server just created this thread (a first
        // turn in a package with none), and the count should say so now rather than wait
        // for the next assembly. Without this the row was in the database but not in the
        // list until a reload — measured live 2026-09-24.
        void host._readPackageConversations(host._userId());
      }
      /*
       * THE PERSON'S TURN IS ANNOUNCED — THE ROOM BUILDS AS THEY SPEAK (owner, 2026-10-03:
       * *"we don't need that [button] — just give her a prompt and she starts building"*). This
       * fires AFTER the server has answered AND after the thread adoption above, so it carries
       * the conversation the turn actually landed in, and the turn is PERSISTED — a room that
       * builds on this event (the Product room's host) reads "the thread's last person message"
       * and is guaranteed to find THIS one. Silent turns — the app's own instructions to her —
       * never announce; nobody typed them. The event is generic: rooms take from it what they
       * need — Product remounts its stage; Governance reads the text (added 2026-10-13) for
       * the ask-listener that pivots the room to a trace when the person asks for one.
       */
      if (!opts.silent) {
        window.dispatchEvent(new CustomEvent('a2ui:person-turn', {
          /* AND THE TURN'S OWN WORDS (2026-10-13 late) — additive: the governance room
             reads them to answer an ask (“I want to look at trace” pivots the room;
             see WritingAreaIndex's ask-listener). Every existing listener takes these
             events unchanged. */
          detail: { conversationId: host.conversationId, sessionId: host.sessionId, text },
        }));
      }
      // The measured cost of this call, attributed to the conversation it
      // served. The host's accumulator only accepts calls whose
      // conversation_id matches this seat's — so the footer shows THIS
      // conversation's numbers, never session totals.
      if (data?.usage && typeof data.usage.total_tokens === 'number') {
        window.dispatchEvent(
          new CustomEvent('a2ui:usage', {
            detail: {
              ...data.usage,
              sessionId: host.sessionId ?? null,
              conversation_id: typeof data.usage.conversation_id === 'string'
                ? data.usage.conversation_id
                : (host.conversationId ?? null),
            },
          }),
        );
      }
      if (data?.error) {
        host._local = [...host._local, { role: 'assistant', content: `Error: ${data.error}` }];
      } else {
        const raw = String(data?.content ?? '(no answer)');
        const reply = host._processReply(raw);
        // THE VERDICT IS READ BEFORE THE REPLY IS DRAWN, because a clean one is not
        // drawn at all (see silentVerdict above): `_processReply` set `_runVerdict`
        // from the tag, and the tag has already been stripped from the prose.
        silentVerdict = host._reviewingRun && host._runVerdict === 'ok';
        if (reply && !silentVerdict) {
          if (!host.productTools) {
            host._local = [
              ...host._local,
              // HER VERDICT IS DRAWN AS WHAT IT IS. A reply that stopped a Run is an ALERT — the
              // person pressed a button and is owed a stop sign, not another remark in the
              // conversation. See ChatMessage.alert and the turn's own outline rule.
              { role: 'assistant', content: reply, alert: host._reviewingRun && host._runVerdict === 'blocked' },
            ];
          }
          /*
           * THE PRODUCT ROOM DOES NOT ECHO THIS REPLY (2026-10-06, the app-design port):
           * the record is the ENGINE's, and every line of it — the builder's spoken steps
           * and the `Finished in Ns.` that carries the ✓ — arrives through the room's live
           * poll of the engine's own conversation with its `messageType` intact. Appending
           * this route's reply here would draw the same sentence twice.
           */
        }
        answered = true;
      }
      /*
       * THE HELD RUN IS SETTLED IN THE finally BELOW, for every outcome — a reply, a refusal,
       * a connection error, or the person stopping the turn. See there.
       */
      // A TURN THAT DID NOT PERSIST IS SAID IN THE THREAD. The server answered it but could
      // not write it down (routes/teacher.py `persistence_error`: a failed lookup, a failed
      // create, a failed message write); without this the person reads a reply that is gone
      // on reload, and nothing anywhere says so.
      if (typeof data?.persistence_error === 'string' && data.persistence_error) {
        host._local = [
          ...host._local,
          { role: 'assistant', content: `⚠️ Not saved — ${data.persistence_error}` },
        ];
      }
      // AND EVERY OTHER WARNING THIS TURN PRODUCED — drawn in the thread and written to the
      // app logger, which the Trace tab reads (the owner, 2026-09-18: "we need to report it
      // in the console trace"). Empty on a clean turn.
      if (Array.isArray(data?.warnings)) {
        for (const warning of data.warnings) {
          host._local = [...host._local, { role: 'assistant', content: `⚠️ ${String(warning)}` }];
          try {
            logger.warn(`[chat] ${String(warning)}`, {
              conversationId: host.conversationId ?? null,
              sessionId: host.sessionId ?? null,
            });
          } catch (logError) {
            // A logger that throws must not cost the turn — but the fact that it threw is
            // itself said, on the console (the gate counts `pass`, not a named failure).
            console.error('[chat-panel] the logger refused a turn warning:', logError, warning);
          }
        }
      }
    } catch (err) {
      if (host._abort?.signal.aborted) {
        host._local = [...host._local, { role: 'assistant', content: 'Stopped.' }];
      } else {
        const why = err instanceof Error ? err.message : String(err);
        host._local = [...host._local, { role: 'assistant', content: `Connection error: ${why}` }];
      }
    } finally {
      /*
       * THE HELD RUN IS SETTLED HERE, ONCE, WHATEVER HAPPENED.
       *
       * `<run_ok/>` released it inside _processReply. This is the other half: a run she did NOT
       * clear has to be told so, because the host is showing it as busy and silence would leave
       * the button spinning with nothing coming. "Silence is not consent" cuts both ways — no
       * verdict is not a yes, and it is not a wait either.
       *
       * IN THE finally AND NOT THE try, because the outcomes that most need it are the ones that
       * never reach the end of the try: a connection error, or the person stopping the turn.
       * Either way the person is looking at a spinner they must be able to get out of.
       *
       * A turn that is not a run review owes nothing and dispatches nothing.
       */
      if (host._reviewingRun) {
        host._reviewingRun = false;
        if (host._runVerdict !== 'ok') {
          window.dispatchEvent(new CustomEvent('a2ui:run-blocked'));
        }
      }
      host._runVerdict = '';
      // Her reply (or the failure) just landed — the column follows it down.
      host._scrollThreadToBottom();
      /*
       * AND ONLY NOW MAY THE SCREEN CHANGE. Everything above this line is her turn arriving; the
       * run is the one effect that rearranges the page, so it goes last — see `_pendingRun`.
       */
      host._releaseQueuedRun();
      // A turn that was ANSWERED while this seat had no conversation lives only here:
      // the backend refused to write it (no row to bind it to yet), so it is held and
      // handed over by flushPendingTurns when the first Save creates the package's
      // conversation. Failed turns are not held — an error is not a thing that was said.
      if (answered && !host.conversationId && !silentVerdict) {
        // The owner is recorded with the FIRST pending turn: spoken before any package
        // existed (owner null) they are owed to whatever Save creates one; spoken INSIDE a
        // package they belong to it and to no other (see flushPendingTurns).
        if (!host._pending.length) host._pendingOwner = host.sessionId ? String(host.sessionId) : null;
        host._pending = [...host._pending, ...host._local.slice(before)];
      }
      host._sending = false;
      host._abort = null;
      /* THE READOUT IS RE-READ ON THE REAL EVENT, WITH NO DELAY. The ledger write and this read
         are separate server facts; the read answers what is there and says so if it cannot. */
      void host._readUsageSummary();
      if (host._workActive && host._workStage === 'thinking') {
        // NO BUILD WAS ANNOUNCED IN THIS ROOM — the reply was the whole turn. Give the build's
        // announcement one beat to beat us to it, then close the card. (A room that builds
        // announces 'building' within that beat and ends the card later, on 'idle'.)
        if (host._workTimer) clearTimeout(host._workTimer);
        host._workTimer = window.setTimeout(() => host._endWork(), 1500) as unknown as number;
      }
      host.requestUpdate();
    }
}

/** THE SEND BUTTON — the input place owns the press; the seat's send does the work. */
export function sendCommandAction(host: any): void {
  input.sendAction(host);
}
