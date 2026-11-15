/**
 * THE UX SEAT'S ACTIONS — the send path, the greeting, the reply, the workspace context, the
 * conversation create, the sessions lane and the tab press.
 *
 * Moved from `ux-chat-seat.ts` without a rule changed. Each function takes the seat it acts for;
 * `connectedCallback` (and the constructor, for the one path the default open can reach before
 * connection) puts them on the element, so the seat's own methods, its template and the place
 * modules keep calling the same names.
 */
import { logger } from '@/lib/logger';
import { uxCapture } from '@/shared/uxCapture';
import { eventBus } from '@/shared/event-bus';
import { autoAdviceOn, declineAutoAdvice } from '@/shared/autoAdvice';
import { markSectionTaught, sectionTaught } from '@/shared/sectionTeaching';
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
import type { SessionsLaneRow } from '../ux-chat-seat';

/**
 * The trace button's `AI:` line, verbatim from Figma "trace-button" state=Default.
 * Clicking Trace is a PROMPT: the reply renders in this thread like any answer.
 */
const TRACE_PROMPT =
  'Load the latest activity and report tokens, cost, latency and evaluation for this session.';

/**
 * THE WAY OUT, ASKED FOR IN EVERY ADVISORY TURN. One line, used in both advisory requests, so
 * the button reads the same wherever it appears.
 */
const OFFER_THE_WAY_OUT =
  'Finish with one more button, exactly [No thanks](action:no-advice), so they can '
  + 'dismiss what you offered and carry on without answering you.';

const NEW_PROMPT_HELLO =
  'Introduce yourself in a sentence or two, and ask what they want to work on. '
  + 'Do not guess what they are building, do not list what you can do, and offer '
  + 'no suggestions and no buttons — there is nothing yet to have an opinion about.';


/** THE SEND PATH — the person's words recorded, posted, and answered. */
export async function sendTurnAction(
  host: any,
  text: string,
  opts: { silent?: boolean; asked?: boolean } = {},
): Promise<void> {
    text = (text ?? '').trim();
    if (!text || host._sending) return;
    /* THE UX TURN IS THE APPLICATION'S CHAT, behind the same composer. */
    if (host.activeTab === 'ux') {
      void host._uxSend(text, opts);
      return;
    }
    /* THE UX TURN IS ITS OWN FUNCTION, BEHIND THE SAME COMPOSER. It never flips the tab,
       never writes the legacy store, and never borrows another tab's thread. */
    if (host.activeTab === 'ux') {
      void host._uxSend(text, opts);
      return;
    }
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
      && host.activeTab !== 'ux'
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
          ux: host.activeTab === 'ux',
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

/** THE REPLY'S OWN PROCESSING — the answer read once into turns. */
export function processReplyAction(host: any, content: string): string {
    const write = (target: string, value: string) => {
      window.dispatchEvent(new CustomEvent('set-left-column-text', { detail: { content: value, target } }));
    };

    const writeTags: Array<{ regex: RegExp; target: string }> = [
      { regex: /<update_agent>([\s\S]*?)<\/update_agent>/g, target: 'System Role' },
      { regex: /<update_user>([\s\S]*?)<\/update_user>/g, target: 'User Role' },
      { regex: /<update_agent_role>([\s\S]*?)<\/update_agent_role>/g, target: 'Agent Role' },
      { regex: /<update_tool_call>([\s\S]*?)<\/update_tool_call>/g, target: 'Tool Call' },
      { regex: /<update_tool>([\s\S]*?)<\/update_tool>/g, target: 'Tool Call' },
      { regex: /<update_few_shot>([\s\S]*?)<\/update_few_shot>/g, target: 'Few Shot' },
      { regex: /<update_context>([\s\S]*?)<\/update_context>/g, target: 'Context' },
      { regex: /<update_constraints>([\s\S]*?)<\/update_constraints>/g, target: 'Constraints' },
    ];
    /*
     * A REPLY TO AN OFFER MAY NOT WRITE. When the panel asked her a question on its
     * own behalf — a seat was chosen, offer what could go in it — the person has not
     * chosen anything yet, and the answer must not appear in the prompt before they
     * do. She is told to offer buttons, and she is also TOLD, by the control-surface
     * list in her own instructions, that `<update_constraints>` writes into that seat
     * directly. Obeying both would put words in the prompt nobody picked.
     *
     * So the tags are stripped and NOT executed on that turn. The words stay in her
     * reply where they can be read, and the buttons remain the only way in. The flag
     * is cleared here, so it covers exactly one reply: the person's next message
     * keeps every one of its powers.
     */
    const offeringOnly = host._offerOnly;
    host._offerOnly = false;
    if (!offeringOnly) {
      for (const { regex, target } of writeTags) {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          write(target, match[1].trim());
        }
      }
    }
    for (const { regex } of writeTags) content = content.replace(regex, '');

    const addRoleRegex = /<add_role\s+name="([^"]+)">([\s\S]*?)<\/add_role>/g;
    let addMatch: RegExpExecArray | null;
    while ((addMatch = addRoleRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('add-prompt-role', {
        detail: { roleName: addMatch[1].trim(), placeholder: addMatch[2].trim() },
      }));
    }
    content = content.replace(addRoleRegex, '');

    const removeRoleRegex = /<remove_role\s+name="([^"]+)"\s*\/>/g;    let remMatch: RegExpExecArray | null;
    while ((remMatch = removeRoleRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('remove-prompt-role', {
        detail: { roleName: remMatch[1].trim() },
      }));
    }
    content = content.replace(removeRoleRegex, '');

    if (/<clear_all\s*\/>/.test(content)) {
      window.dispatchEvent(new CustomEvent('clear-left-column'));
      content = content.replace(/<clear_all\s*\/>/g, '');
    }
    /*
     * SHE ASKS FOR THE RUN — and the ask is RECORDED here rather than carried out here.
     *
     * THIS IS THE ONE EFFECT THAT CHANGES THE WHOLE SCREEN. Every other tag in this function
     * writes into something the person is already looking at — a seat, a title, the thread —
     * and their eyes are there. A run takes the middle column, folds the prompt and starts a
     * spinner on the button, and doing that from INSIDE this function happens while her
     * sentence is still a string in this element: nothing of the reply has been drawn yet, so
     * the screen rearranges first and the words that explain it arrive after. Measured
     * 2026-09-23, watched at the screen: "we got to visually connect the run feature … give
     * grace enough time to give her back at her output."
     *
     * So it is queued (see `_pendingRun`), and `_send` releases it once her reply has been
     * appended and painted. Nothing about the run changes — the same event, the same spinner,
     * the same canvas — only the order of two things the person sees.
     */
    if (/<run_prompt\s*\/>/.test(content)) {
      host._pendingRun = 'asked';
      content = content.replace(/<run_prompt\s*\/>/g, '');
    }
    /*
     * HER VERDICT ON A PROMPT SHE WAS ASKED TO REVIEW — the answer to a Run that was held.
     *
     * A RUN THAT HAS BEEN STOPPED STAYS STOPPED UNLESS SHE CLEARS IT. The host asks her to
     * review before a run and holds it; `<run-ok/>` is her saying it is ready, and only
     * that releases it. Anything else — a `<run-blocked>` tag, or no tag at all — leaves
     * the run held, and her prose says what is wrong.
     *
     * SILENCE IS NOT CONSENT, deliberately. If she forgets the tag, or her reply is
     * interrupted, the run does not proceed on a default. The failure that prevents is a
     * prompt with a problem she named going through anyway because the machinery assumed
     * a missing answer meant yes.
     *
     * BOTH FORMS OF THE BLOCKED TAG COME OFF, because she writes both. She is asked for the
     * self-closing shape, and she answered with a bare `<run_blocked>` — measured 2026-09-23,
     * a held Run whose reply drew the tag as text under her sentence. The paired form keeps
     * its body stripped with it; a lone tag is simply removed.
     */
    if (/<run_ok\s*\/>/.test(content)) {
      host._runVerdict = 'ok';
      // QUEUED, NOT DISPATCHED — the same reason as `<run_prompt/>` above: the run takes the
      // screen, and her sentence saying it is ready has to be on screen before it does.
      host._pendingRun = 'approved';
      content = content.replace(/<run_ok\s*\/>/g, '');
    }
    if (/<run_blocked\s*\/?>/.test(content)) host._runVerdict = 'blocked';
    content = content
      .replace(/<run_blocked>[\s\S]*?<\/run_blocked>/g, '')
      .replace(/<\/?run_blocked\s*\/?>/g, '');
    if (/<save\s*\/>/.test(content)) {
      host._emitCommand('save-button', { state: 'idle', label: 'Save' });
      content = content.replace(/<save\s*\/>/g, '');
    }
    /*
     * THE PACKAGE'S TITLE — the one piece of the prompt that used to have no path at all.
     *
     * It was React state behind a callback the shell handed down, so nothing the AI could
     * reach could read or set it. <left-column-header> moved into the surface for exactly
     * this reason, and this is the tag that uses it: a name in, the same rename the bar's
     * own field runs, and the database, the console card and the header all follow because
     * there is one writer.
     *
     * Stripped from the prose like every other tag, so the person reads a sentence about
     * the name rather than the name wearing angle brackets.
     */
    const titleRegex = /<set_title>([\s\S]*?)<\/set_title>/g;
    let titleMatch: RegExpExecArray | null;
    while ((titleMatch = titleRegex.exec(content)) !== null) {
      const title = titleMatch[1].trim();
      if (title) window.dispatchEvent(new CustomEvent('set-prompt-title', { detail: { title } }));
    }
    content = content.replace(titleRegex, '');
    /*
     * THE PACKAGE'S DESCRIPTION, WHICH HAD NO WRITER AT ALL.
     *
     * The description is the line under the name on the console card — and the review before a
     * Run asks for it by name. She tried to write it, and the tag she reached for was invented,
     * because the app had given her none: measured 2026-09-23, `<set_description>…</set_description>`
     * in a reply, drawn as nothing, with the description left empty and her sentence saying it was
     * added.
     *
     * Same shape as the title on purpose: one tag, one write, one place the value lives. The
     * handler is the shell's, next to the title's, because the description is a property of the
     * package rather than of anything inside the surface.
     */
    const descRegex = /<set_description>([\s\S]*?)<\/set_description>/g;
    let descMatch: RegExpExecArray | null;
    while ((descMatch = descRegex.exec(content)) !== null) {
      const description = descMatch[1].trim();
      if (description) {
        window.dispatchEvent(new CustomEvent('set-package-description', { detail: { description } }));
      }
    }
    content = content.replace(descRegex, '');
    /*
     * A TOOL, NAMED — inserted into the seat it belongs in, the same way the seat's own
     * Functions / Tools menu inserts it. The name must be one the register answers to: an
     * invented tool is a step that cannot happen, and the editor reports it rather than
     * writing a token nothing can resolve.
     */
    /*
     * TWO ROWS MERGED, FROM HER OWN TAG — `<merge_role from="agent_role" into="Agent Role"/>`.
     * The attribute form is the one that reads clearly for a pair, and it is what she reaches
     * for: names are what the tag is about, and a bare "a b" would be a guess about which is
     * which.
     */
    const mergeRegex = /<merge_role\s+from="([^"]+)"\s+into="([^"]+)"\s*\/>/g;
    let mergeMatch: RegExpExecArray | null;
    while ((mergeMatch = mergeRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('merge-seat', {
        detail: { from: mergeMatch[1].trim(), into: mergeMatch[2].trim() },
      }));
    }
    content = content.replace(mergeRegex, '');

    const moveRegex = /<move_tool\s+name="([^"]+)"\s+into="([^"]+)"\s*\/>/g;
    let moveMatch: RegExpExecArray | null;
    while ((moveMatch = moveRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('move-tool', {
        detail: { name: moveMatch[1].trim(), into: moveMatch[2].trim() },
      }));
    }
    content = content.replace(moveRegex, '');

    const setSeatRegex = /<set_seat\s+name="([^"]+)"\s*>([\s\S]*?)<\/set_seat>/g;
    let seatMatch: RegExpExecArray | null;
    while ((seatMatch = setSeatRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('set-left-column-text', {
        detail: { target: seatMatch[1].trim(), content: seatMatch[2].trim() },
      }));
    }
    content = content.replace(setSeatRegex, '');

    const toolRegex = /<insert_tool>([\s\S]*?)<\/insert_tool>/g;
    let toolMatch: RegExpExecArray | null;
    while ((toolMatch = toolRegex.exec(content)) !== null) {
      const name = toolMatch[1].trim();
      if (name) window.dispatchEvent(new CustomEvent('insert-tool', { detail: { name } }));
    }
    content = content.replace(toolRegex, '');
    if (/<eval_grounding\s*\/>/.test(content)) {
      window.dispatchEvent(new CustomEvent('ai-eval-grounding'));
      content = content.replace(/<eval_grounding\s*\/>/g, '');
    }

    const showVersionRegex = /<show_version>(\d+)<\/show_version>/g;
    let verMatch: RegExpExecArray | null;
    while ((verMatch = showVersionRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('ai-show-version', {
        detail: { version: parseInt(verMatch[1], 10) },
      }));
    }
    content = content.replace(showVersionRegex, '');

    const reassembleRegex = /<reassemble-console\s+([^>]*?)\s*\/?>/g;
    let reassembleMatch: RegExpExecArray | null;
    while ((reassembleMatch = reassembleRegex.exec(content)) !== null) {
      const attrs = reassembleMatch[1];
      const sortMatch = attrs.match(/sort="([^"]*)"/);
      const filterMatch = attrs.match(/filter="([^"]*)"/);
      window.dispatchEvent(new CustomEvent('a2ui:console-command', {
        detail: {
          sort: sortMatch ? sortMatch[1] : undefined,
          filter: filterMatch ? filterMatch[1] : undefined,
        },
      }));
    }
    content = content.replace(reassembleRegex, '');

    // Third-column surface tags, routed through the gatekeeper like the React seat.
    const emitTag = (tag: string, props: Record<string, string>) => {
      eventBus.emit({
        tag,
        sessionId: host.sessionId ?? null,
        command: tag,
        timestamp: new Date().toISOString(),
        props,
      } as never);
    };

    const attrTag = (regex: RegExp): [string, Record<string, string>] => {
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        const props: Record<string, string> = {};
        const attrRegex = /(\w+)="([^"]*)"/g;
        let am: RegExpExecArray | null;
        while ((am = attrRegex.exec(m[1])) !== null) props[am[1]] = am[2];
        return [m[0], props];
      }
      return ['', {}];
    };

    const projectCard = attrTag(/<project-card-element\s+([^>]*?)\s*\/?>/g);
    if (projectCard[0]) emitTag('project-card-element', projectCard[1]);
    content = content.replace(/<project-card-element\s+([^>]*?)\s*\/?>/g, '');

    const addButton = attrTag(/<add-button\s+([^>]*?)\s*\/?>/g);
    if (addButton[0]) emitTag('add-button', addButton[1]);
    content = content.replace(/<add-button\s+([^>]*?)\s*\/?>/g, '');

    const setHtmlRegex = /<set-html\s+content="([^"]*)"\s*\/?>/g;
    let htmlMatch: RegExpExecArray | null;
    while ((htmlMatch = setHtmlRegex.exec(content)) !== null) {
      emitTag('set-html', { content: htmlMatch[1] });
    }
    content = content.replace(setHtmlRegex, '');

    if (/<clear-surface\s*\/>/.test(content)) {
      emitTag('clear-surface', {});
      content = content.replace(/<clear-surface\s*\/>/g, '');
    }

    return content.trim();
}

/** THE ARRIVAL GREETING — she opens the conversation when the room was entered. */
export function greetingAction(host: any): void {
    /*
     * A SEAT THAT CAME UP WITH NOTHING TO READ IS AN ARRIVAL, WHETHER OR NOT ONE WAS ANNOUNCED.
     *
     * The seat's own facts are enough to know it: it has a PACKAGE (`sessionId`), it has no
     * conversation, and there is therefore no thread to read. None of that needs an announcement to
     * establish — and depending on one is how a dead screen happened. The owner, 2026-09-24: "if
     * there's no conversation and you load the thing, a conversation gets created and Grace starts
     * talking." Measured the same evening, from the other end: seven consecutive opens of exactly
     * such a package, each with the seat demonstrably up and reading its own package (both of its
     * reads in the backend log), and NOT ONE create and NOT ONE greeting.
     *
     * THE HISTORY QUESTION IS ALREADY ANSWERED when there is no conversation — the same fact
     * `_loadHistory` records when it is handed an empty id — so the greeting must not wait on an
     * attempt that a missing `conversationId` never starts. That wait is the trap the note below
     * describes; this is the other side of it.
     *
     * AND ONLY WHEN THE PACKAGE IS KNOWN TO HAVE NOTHING: the list read has to have come back and
     * have come back EMPTY. An unread list is not an empty one, and treating it as one is how she
     * greeted a package whose conversations — with a finished run in them — were sitting in the
     * very list being fetched.
     *
     * A FAILED READ IS NOT AN EMPTY ONE EITHER, which is why this asks for a REAL array: the row
     * list is only ever assigned from a successful read, so `null` means "this seat could not find
     * out", and "I could not find out" is never a reason to create a conversation.
     */
    const rowsKnown = Array.isArray(host._conversationRows);
    const rows = rowsKnown ? host._conversationRows! : [];
    const currentRow = rows.find((row) => String(row.id) === String(host.conversationId));
    /*
     * THE GREETING BELONGS TO A PACKAGE WITH NOTHING TO READ (owner, 2026-11-03). The Chat's list
     * is its own package's list; an empty newest thread beside other conversations is not a
     * reason to introduce her again. It takes no other conversations, or one empty one; a failed
     * list read is neither.
     */
    const onlyConversationIsEmpty =
      rowsKnown &&
      (rows.length === 0 ||
        (rows.length === 1 && !!currentRow && (currentRow.messageCount ?? 0) === 0));
    if (!host._wantsGreeting && host.sessionId && !host.conversationId
      && Array.isArray(host._conversationRows) && host._conversationRows.length === 0) {
      host._historyChecked = true;
      host._takeArrival('resume');
    }
    /*
     * A CONVERSATION THAT HOLDS NOTHING IS THE SAME ARRIVAL — the Tools seat's own rule, applied
     * here. The rule above needs the seat to have NO conversation at all; a package whose one
     * conversation exists and is empty took no arrival, and this function returned before she was
     * ever asked. That is the tab that opens on an empty thread with no word in it. The emptiness
     * is only claimed once both reads have answered, and `_sending` is excluded so the greeting
     * cannot fire on top of a turn already in flight.
     */
    if (!host._wantsGreeting && !host._sending && host.sessionId
      && host._conversationsRead && host._historyChecked && !host._historyError
      && onlyConversationIsEmpty
      && (host.messages?.length ?? 0) === 0 && host._local.length === 0) {
      host._takeArrival('resume');
    }
    const kind = host._wantsGreeting;
    /*
     * A PACKAGE ALWAYS HAS SOMEWHERE TO TALK, AND OPENING ONE WITH NOTHING MAKES IT.
     *
     * The owner, 2026-09-24: "if there's no conversation and you load the thing, a conversation
     * gets created and Grace starts talking." A package whose conversations have all been
     * deleted has no thread: the seat binds nothing, there is nothing to load, and — this is
     * the part that made it a dead screen rather than an empty one — `_loadHistory` is started
     * by a CHANGE of `conversationId`, so with no id coming there was no attempt, and the
     * greeting waits on that attempt forever.
     *
     * SO THE SEAT MAKES ONE, by the app's one path for it (`_startNewConversation`, the same
     * code the foot's add mark runs): the conversation is created for this package, the
     * package's own column is repointed at it, and the seat moves in. The move is what
     * completes the history attempt, and her greeting then lands in a real thread — with
     * somewhere for the person's next sentence to be written.
     *
     * IT IS ABOVE THE HISTORY GATE ON PURPOSE, because the gate is exactly what cannot open
     * until a conversation exists. And it fires ONCE per package (`_conversationEnsured`):
     * renders are many, and a create that failed must not be retried every frame — the foot's
     * add mark is the person's own way to ask again.
     *
     * AND IT IS KEYED ON THE FACT, NOT ON THE ANNOUNCEMENT. It used to require `kind === 'resume'`,
     * so a seat that was never handed an arrival — for whatever reason, in whichever order its
     * host got there — created nothing at all, which is a package that can never be given its
     * first conversation. `sessionId` is the same fact the arrival was carrying: THIS IS A
     * PACKAGE'S SEAT, so a package's conversation is what it is owed. A composer with no package
     * has no `sessionId` and is still left alone.
     */
    /* THE PAGE OPENS ITS DEFAULT; IT DOES NOT MANUFACTURE ONE (owner, 2026-11-07). This block
       used to create a conversation whenever the seat had a package and no conversation bound
       yet — which is every open, before the list is read — and that is the blank chat a person
       saw on every click. Creation now belongs to ONE place only: the read that returns zero
       rows, after it succeeds. Opening never creates anything. */
    if (!kind || host._greeted || !host._historyChecked) return;
    /* THE OPEN COMES FIRST. While the default thread is being read or created, the greeting must
       not start a turn of its own: that turn would be in flight when the create finishes, and the
       hello meant for the new thread would be dropped as a second send. `_creatingConversation`
       covers the create, `_openingDefault` the read before it. */
    if (host._historyError || host._sending || host._openingDefault || host._creatingConversation) return;
    /*
     * AND NOTHING IS DECIDED ABOUT THIS PACKAGE UNTIL ITS OWN LIST HAS BEEN READ.
     *
     * "HAS THIS PACKAGE RUN?" is answered by the package's own record — an archived conversation
     * (a Run files its results in a thread of its own and archives the one it replaced), or the
     * results in its thread. Both halves arrive ASYNCHRONOUSLY, so for the first frames of an open
     * the answer is not "no", it is NOT KNOWN YET — and a rule that treats "not known" as "no"
     * sends exactly the turn it was written to prevent.
     *
     * Measured 2026-09-24 in Postgres, on the owner's own package (Insurance Technology Scout):
     * ten greeting turns written into the results conversation between 21:04 and 21:19, not one
     * person's turn among them, one per open. Each open fetched the list, and the greeting went out
     * on the frames BEFORE it came back. The owner, watching it: "every time I load and open a card
     * that has been processed already and run … she loads and spins and it pushes the content out
     * of view." The spinner is hers, and the content it pushes is the results they opened the card
     * to read.
     *
     * A PACKAGE'S SEAT WAITS; A COMPOSER DOES NOT. `_readPackageConversations` returns at once for
     * a seat with no `sessionId`, so `_conversationsRead` is only ever awaited where there is
     * something to read. This is a wait of one fetch, and a wait is not an answer.
     */
    if (host.sessionId && !host._conversationsRead) return;
    /*
     * THE TWO "NO OFFER" RULES ARE APPLIED WHERE THE OFFER IS WRITTEN, NOT HERE.
     *
     * They used to `return` from this point — a package that had already been Run, and one where
     * the person had pressed "No thanks" — and a return here is a SILENT SEAT: the arrival was
     * spent, nothing was drawn, nothing was said, and the screen looked exactly like a broken
     * load. The owner, 2026-09-24: "every time you arrive she's supposed to say something … she
     * only makes recommendations before run; once run, she stops recommending." RECOMMENDATIONS
     * STOP — SHE DOES NOT. Both rules choose the words at the end of this function.
     */

    const empty = (host.messages?.length ?? 0) === 0 && host._local.length === 0;
    if (kind === 'blank' && !empty) return;
    /*
     * A PACKAGE WITH NOTHING IN IT IS A NEW PROMPT.
     *
     * This used to say nothing at all, and saying nothing is what a dead screen looks like.
     * The case that found it is a package whose conversations have all been deleted: there is
     * no thread to load, the person is looking at an empty card beside a prompt with no words
     * in it either, and she — who should be the one thing on that screen — was absent. The
     * owner, 2026-09-24: "if the user deletes all the conversations and there's no conversation
     * to load … it's just loading a blank screen … Grace needs to just treat the prompt like
     * it's brand new."
     *
     * SO SHE DOES. The prompt IS new: nothing has been written in it and nothing has been said
     * about it. She introduces herself and asks what they want to work on — the same hello a
     * blank composer gets (NEW_PROMPT_HELLO), because it is the same situation.
     *
     * AND IT IS SAFE WITHOUT A CONVERSATION, which is the other half of the owner's rule and
     * was already true on the server: her greeting is a turn the app asked for (`person_turn`
     * false), so the backend answers it and does NOT write it down, and the person's first turn
     * is what creates the conversation (routes/teacher.py — it reuses the newest conversation
     * the package already owns, or makes one). Nothing here has to invent a thread.
     */
    /*
     * A PACKAGE WITH NOTHING TO READ IS A NEW PROMPT — and NO CONVERSATION is that state,
     * whatever is written in the prompt's seats.
     *
     * The test used to be "has anything been said in it or written in it" (`_packageHasSomething`),
     * which over a package whose conversations have all been deleted answers YES — the seats still
     * hold the person's words — so she skipped the hello and offered next steps about a thread that
     * no longer exists. The owner, 2026-09-24: "if the user removes all conversations and there's
     * zero and there's nothing to load, you have to engage the model … she needs to create a
     * default conversation, say hello, because that's considered a PRE-RUN state." A package with
     * no conversation is that state: the audit trail starts here, so she starts it the way she
     * starts any new prompt.
     *
     * A CONVERSATION WITH TURNS IS STILL READ. This is only true when the seat has no thread to
     * read (`conversationId` empty — the create above is still in flight on that first frame) or
     * the package is empty in both senses, which is the case this rule was written for.
     */
    const nothingToRead = kind === 'resume'
      && onlyConversationIsEmpty
      && (!host.conversationId || !host._packageHasSomething()
          || (host.conversationId && host._historyChecked && !host._historyError
              && !(host.messages?.length)));
    /*
     * AND IT WAITS FOR THE ANSWER WHEN THERE IS ONE COMING. A panel with a session may be the
     * console's or a package's, and that is a server fact (`_readSeatScope`); greeting before it
     * arrives is greeting on a guess. A panel with NO session cannot be the console — a console
     * seat always carries one — so the blank composer's hello does not wait for anything.
     */
    if (host._seatIsConsole === null && host.sessionId) return;
    /*
     * AND THE ARRIVAL IS NOT SPENT WHILE IT WAITS.
     *
     * This flag used to be set near the top of the function, ABOVE the gate that waits for the
     * seat's scope — so an arrival that landed while that read was still in flight was marked
     * answered and then returned unanswered, and the read's own retry (see _readSeatScope)
     * found `_greeted` already true and did nothing. The greeting was lost for the whole life
     * of that seat, and whether it was lost came down to which of two fetches answered first.
     * Measured 2026-09-24: the owner opened a package and she never appeared — "even on a new
     * composer she doesn't even pop up" — and then she did, on another open. A WAIT IS NOT AN
     * ANSWER, so the arrival is only spent once there is nothing left to wait for.
     *
     * AND THE THREAD IS PART OF WHAT IT WAITS FOR (owner, 2026-11-02). A conversation that has
     * not been READ yet cannot be judged empty, so a seat holding an id it has not read waits one
     * more frame instead of spending the arrival on a guess — which is how the Tools tab came up
     * with no thinking and no words.
     */
    if (host.sessionId && host.conversationId && !host._historyChecked) return;
    host._greeted = true;
    /*
     * THE EVALS BUTTON IS THE TRIGGER — AND SHE TALKS THE SAME WAY ON BOTH ICONS (owner,
     * 2026-10-16: *"She has to talk whenever you click the eval's button. That's the
     * trigger"* + *"Keep in mind this is the exact same thing we're going to do on the
     * console so there's no difference — these two behaviors in the chat are exactly the
     * same"*). ABOVE THE CONSOLE BRANCH ON PURPOSE: the console's own hello used to
     * swallow this arrival — its branch returns for every kind once the seat is known to
     * be the console — so the trigger sat DEAD on the console while it worked in
     * governance. ONE branch, both seats; the words are hers either way.
     *
     * SHE SPEAKS ONCE — THE CONVERSATION STAYS (owner, 2026-10-16 late: *"Every time I
     * click evaluator, she starts talking again, so this is not the flow I want … make her
     * speak one time and reload that ID of that conversation every single time a click is
     * done after that … an LLM should not repeat itself."*). The introduction is said
     * once per conversation; every later click leaves it exactly as it stands — the
     * room's announce re-seats the column and the Evals tab draws the conversation, so
     * the SAME conversation comes back into view, word for word, and nothing new is
     * written. The repetition an earlier version produced was THIS FILE re-asking her on
     * every click (a welcome-back prompt per click); the model never repeated itself —
     * the machinery did. A removed (or new) conversation starts over: the mark is keyed
     * to the conversation's own id.
     */
    if (kind === 'evaluators') {
      // No conversation seated yet — the ensure above is creating one, and the next pass
      // (after its history read) runs this branch for real.
      if (!host.conversationId) return;
      if (sectionTaught('evaluators', host.conversationId)) return;
      markSectionTaught('evaluators', host.conversationId);
      void host._send(
        'A person has just opened the EVALUATORS area — the quality-signal place of this system. '
        + 'Introduce it in no more than three short sentences, then ask whether they would like more '
        + 'details. Nothing more — no lists, no depth. Offer no buttons.',
        { silent: true },
      );
      return;
    }
    if (host._seatIsConsole === true) {
      /*
       * SHE SAYS HELLO WHEN THERE IS NOTHING TO READ — and the test is the THREAD, not whether a
       * conversation row exists.
       *
       * A conversation begins with a person, not with a load (the owner, 2026-09-23: "there's no
       * reason to add a new greeting if the user has not engaged with the console chat … the AI is
       * not the conversation. It's a human being that initiates the conversation"). The first
       * version of this rule read `if (host.conversationId) return` — "she greets only a console
       * with no conversation" — and it silenced her on a console that HAS an empty one: measured
       * 2026-09-23, a conversation existed with 0 messages, so no greeting, and the owner's report
       * was exactly what that looks like from the seat: "This is gone again. The model has
       * disappeared from console again."
       *
       * THE EMPTINESS IS THE FACT, and it is the same test the blank composer uses (`empty`, above):
       * nothing from the surface's history and nothing spoken locally. An empty conversation reads
       * as empty, a conversation with words in it reads as words, and the greeting therefore happens
       * once per thread: she says hello, her reply is written into that conversation, and every load
       * after it reads her own words back instead of saying them again.
       */
      if (!empty) return;
      void host._send(
        'A person has just landed on the console — the index of every package they have built. '
        + 'This screen is an index and nothing more: a card per package, with its name and its one '
        + 'line, and nothing open. YOUR WORK HERE IS ORGANISATION — finding, filtering and sorting '
        + 'their prompts — and NOT writing into one. The seats, the tools and the writes all belong '
        + 'to a package, in that package\'s own chat; there is no prompt open here to write into. '
        + 'Introduce yourself in a sentence or two, say what this screen is and that you can help '
        + 'them find, filter or sort what is in it, and ask what they are looking for. Do NOT '
        + 'describe, quote or comment on any particular package — naming one is reading over their '
        + 'shoulder. Offer no buttons.',
        { silent: true },
      );
      return;
    }
    /*
     * AND THE GOVERNANCE ROOM GETS ITS OWN HELLO (owner, 2026-10-14: *"she should say something
     * on land when people load the page even if it's tucked away to the right … that seat in
     * governance doesn't seem to have any awareness of where she is"*). Same rule as the
     * console's — the THREAD's emptiness is the fact — and the same once-per-thread life: her
     * reply is written into the conversation and every load after reads her own words back.
     * She is told what THIS room is (its rail, its trace facts, the work that belongs to it)
     * and chooses her own words.
     */
    if (kind === 'governance') {
      if (!empty) return;
      void host._send(
        'A person has just opened the governance room — the room that watches what the system '
        + 'did: its traces, what the models cost and how long they took, and the seats that read '
        + 'them. This column is the room\'s own chat, always beside the surface. Their rail is '
        + 'Chat, Trace, Preview, Approve, Evals, States and Repairs; when they select a trace, '
        + 'what is on screen is given to you as the TRACE ON SCREEN facts. YOUR WORK HERE IS '
        + 'READING WITH THEM — what the room shows, where something lives, what a trace says — '
        + 'and NOT writing into the app. Introduce yourself in a sentence or two, say what this '
        + 'room watches and that you can help them read, question or check the work in it, and '
        + 'ask what they would like to look at. Offer no buttons.',
        { silent: true },
      );
      return;
    }
    /*
     * AND A CONSOLE ARRIVAL IS NOT A PACKAGE'S TO ANSWER. Reaching here with it means this seat is
     * known NOT to be the console (the branch above took the console's own case, and a panel whose
     * scope has not been read returned earlier still), so greeting here would be a package
     * answering the library's arrival — the mirror of the bug this addressing exists to fix.
     */
    if (kind === 'console') return;
    if (kind === 'blank') {
      /*
       * THE SAME ONCE-PER-CONVERSATION RULE AS THE OFFER BELOW. A blank composer's hello was
       * guarded only by `empty`, which is enough while her reply is written down — the mark
       * makes it a fact about the conversation rather than about what happened to be drawn.
       */
      if (host.conversationId) {
        if (sectionTaught('arrival', host.conversationId)) return;
        markSectionTaught('arrival', host.conversationId);
      }
      void host._send(
        'A person has just opened a blank composer and has not said anything yet. '
        + NEW_PROMPT_HELLO,
        { silent: true },
      );
      return;
    }

    if (nothingToRead) {
      // The same hello, for the other door into a prompt with nothing in it — see the note
      // where `nothingToRead` is decided.
      void host._send(
        'A person has just opened an existing package that is empty — no seats filled and '
        + 'nothing said in it — so it is a new prompt that already has a name. ' + NEW_PROMPT_HELLO,
        { silent: true },
      );
      return;
    }

    /*
     * AND THIS IS WHERE THE OFFER IS MADE — OR IS NOT MADE, WHICH IS THE WHOLE OF THE TWO RULES.
     *
     * RECOMMENDATIONS BELONG TO THE FIRST VISIT BEFORE A RUN. They are the learning experience:
     * they are how somebody finds out what the machine does with what they wrote, so they come
     * once, before the work has run, and never again. shared/autoAdvice.ts carries the owner's rule
     * in full — "Recommendations are really only for the first before run … once they process a run
     * they're gonna have to ask her for enhancements" — and it names this function as the place the
     * gate is applied. The other rule is the person's own: "No thanks" takes the seat out of
     * volunteering, so the next package they open is not proposed to either.
     *
     * BOTH RULES CHOOSE THE WORDS HERE; NEITHER OF THEM RETURNS EARLIER. A `return` above is a
     * SILENT SEAT — the arrival spent, nothing drawn, nothing said, and a screen that reads as
     * broken — which is why the version of this branch that returned was wrong and is reverted
     * here. What the rules decide is whether a turn is sent AT ALL: an offer she is not going to
     * make must not be paid for with a model call.
     *
     * AND A PACKAGE THAT HAS RUN IS NOT PROPOSED TO. The gate is a fact about the WORK — the
     * results in its thread, or the archived conversation a Run left in its own list — and it is
     * read BEFORE this point, once the list has come back (see the wait above). The owner,
     * 2026-09-24: "whenever the application has run and I reopen the card I should see the results
     * not the model at the bottom of the screen thinking." Reopening a package that has run is
     * somebody coming back to READ it; she waits to be asked.
     */
    const offering = autoAdviceOn() && !host._hasResultTurns;
    if (!offering) return;
    /*
     * SHE SPEAKS ONCE PER CONVERSATION — THE THREAD THEN STAYS (owner, 2026-10-17: *"the design
     * tab the chat is loading every time someone clicks on it … it's only supposed to do it one
     * time that's one conversation and that's the conversation that stays until the user deletes
     * it or creates a new one."*).
     *
     * This offer had no mark of its own: every arrival on a package re-asked her, so a rail tab
     * tapped ten times wrote ten introductions into the same thread — the repetition the owner
     * saw, produced by this file and not by the model. The Evals section was given this mark on
     * 2026-10-16 for exactly the same reason; an arrival is no different, so it uses the same
     * rule and the same store: `shared/sectionTeaching`, keyed by the CONVERSATION's own id.
     *
     * A new conversation has not been taught, and a deleted one takes its mark with it, so the
     * first open after either speaks again — which is the whole of the behaviour he asked for.
     */
    if (sectionTaught('arrival', host.conversationId)) return;
    markSectionTaught('arrival', host.conversationId);
    host._offerOnly = true;
    void host._send(
      'A person has just opened an existing piece of work. You can see the conversation '
      + 'so far and the prompt as it stands. Say briefly where the work is — one or two '
      + 'sentences, concrete, about THIS prompt — then offer two or three things to do '
      + 'next as buttons: [short label](action:write-seat:the seat|the words to put in it) '
      + 'for anything you would write into a seat, or [short label](action:the request) '
      + 'for anything you would do yourself. Keep labels to a few words and use no '
      + 'parentheses inside a button. Ask which one they want and wait. '
      + OFFER_THE_WAY_OUT,
      { silent: true },
    );
}

/** A button inside her turn was pressed — the named paths. */
export function replyHandling(host: any, e: Event): void {
    const text = String((e as CustomEvent).detail?.text ?? '');
    if (!text) return;
    /*
     * THE BRACKETS COME OFF FIRST. A button's action arrives as `[<action>]` —
     * that is the wire the retired seat's buttons sent and the seat still sends
     * it. Parsing the raw text meant every action failed to match, because the
     * string began with `[` rather than with the action name, so a write-seat
     * button fell through to the model and the seat it was supposed to fill was
     * never written. The unwrapping is here because this is where the envelope and
     * the action are separated; below it, `text` is an action.
     */
    const action = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
    /* THE UX THREAD'S ONE ACTION: take the person to a screen. The frame validates the
       path; nothing here decides where the application may go. */
    if (action.startsWith('ux-nav:')) {
      window.dispatchEvent(new CustomEvent('ux-app-navigate', { detail: { path: action.slice('ux-nav:'.length) } }));
      return;
    }
    /*
     * A PRESSED BUTTON IS SPENT, WHATEVER IT WAS — recorded before anything else can fail,
     * because the press has happened either way and the row is a list the person is working
     * down. The owner, 2026-09-23: "when I click Fill User Role that button should change
     * state ... by deactivating one when it's done that lets the user know it's a list."
     *
     * AND THE MARK BELONGS TO ONE TURN. `turn` comes from <design2-ux-chat-messages>, which knows which
     * turn the button sat in; without it a mark kept by action alone would draw the SECOND
     * Confirm this conversation ever offered as already pressed, because every proposing reply
     * ends with the same confirm link. See ChatMessages.spentTurn.
     *
     * Kept on the SEAT, not on the turn: the thread is re-rendered from the surface's messages
     * on every assembly, and a mark carried in the message would go with it. The seat outlives
     * its own re-renders.
     */
    host._spentTurn = String(((e as CustomEvent).detail?.turn as string) ?? '');
    host._spent.add(action);
    host.requestUpdate();
    /*
     * THE WAY OUT IS HANDLED HERE, NOT SENT. "Skip the advice" is not a question and a
     * dismissal should not cost a model call and three seconds to be acknowledged. The
     * offer is withdrawn and nothing goes to her.
     */
    if (action === NO_ADVICE) {
      host._withdrawOffer();
      return;
    }
    const edit = parseWriteSeatAction(action);
    if (edit) {
      window.dispatchEvent(new CustomEvent('a2ui:write-seat', { detail: edit }));
      return;
    }
    /*
     * A TOOL IS AN EDIT TOO, AND A DIFFERENT ONE. `write-seat` carries words for a seat;
     * this carries the NAME of a tool, and the words come from the register — a tool inserted
     * from here has to be byte-for-byte what the seat's own Tools menu inserts, or the prompt
     * would say one thing when a person put it in and another when she did. See the editor's
     * `_onInsertTool`.
     */
    const tool = parseWriteToolAction(action);
    if (tool) {
      window.dispatchEvent(new CustomEvent('insert-tool', { detail: tool }));
      return;
    }
    /*
     * THE PACKAGE'S DESCRIPTION, OFFERED AS A BUTTON.
     *
     * She writes this one herself, and she reaches for `set-description|<the words>` — not the
     * two-part form every other action uses. Measured 2026-09-23, in the stored conversation:
     * `[Add description](action:set-description|Add a short description for the package)` was
     * pressed, did not parse, and went back to the model as a message — so the person watched a
     * button turn into a sentence and a model call, and the work it promised happened only
     * because she happened to write the tag in her reply.
     *
     * THE SPELLING IS TAKEN AS SHE WRITES IT: the name, then a separator that may be either
     * `:` or `|`, then the words. One reader, so the two forms cannot drift.
     */
    const described = parseDescriptionAction(action);
    if (described) {
      window.dispatchEvent(new CustomEvent('set-package-description', { detail: described }));
      return;
    }
    /*
     * TWO ROWS FOR ONE STEP, MERGED — an edit like the others, performed by the app so the words
     * are moved rather than retyped. See the editor's `_onMergeSeat` and actionLink's note on why
     * a write followed by a removal is not the same thing.
     */
    const merge = parseMergeSeatAction(action);
    if (merge) {
      window.dispatchEvent(new CustomEvent('merge-seat', { detail: merge }));
      return;
    }
    /*
     * A TOOL MOVED TO ANOTHER STEP, AND A ROW'S TEXT REPLACED. Both are repairs she was already
     * offering — as `move-tool:search-the-internet` and `clean-agent-role` — and both came back
     * to the person as "this app does not know how to do that". The intent was right and the
     * names were hers; the capability was missing. See actionLink.
     */
    const move = parseMoveToolAction(action);
    if (move) {
      window.dispatchEvent(new CustomEvent('move-tool', { detail: move }));
      return;
    }
    const replaced = parseSetSeatAction(action);
    if (replaced) {
      window.dispatchEvent(new CustomEvent('set-left-column-text', {
        detail: { target: replaced.seat, content: replaced.text },
      }));
      return;
    }
    /*
     * A REQUEST SHE ALREADY OFFERS AS A BUTTON — translated, never handed over as a token.
     * `review-prompt` has been on her first message of every session since the beginning; see
     * actionLink's note for why it is a sentence she receives and not a word she reads back.
     */
    const asked = requestForAction(action);
    if (asked) {
      void host._send(asked);
      return;
    }
    /*
     * APPLY ALL — the whole list, worked in one press.
     *
     * The seat applies nothing itself: the repairs are writes into the prompt, and the writers
     * live in the host (`merge-seat`, `move-tool`). So this hands the request over and the host
     * applies what the checklist marks as the app's own, then re-derives the list and either runs
     * the held Run or asks her about what is left. See actionLink's note on FIX_ALL.
     */
    if (String(action).trim().toLowerCase() === FIX_ALL) {
      window.dispatchEvent(new CustomEvent('a2ui:fix-all'));
      return;
    }
    /*
     * RUN IT — HER OWN BUTTON, AND THE NAME WAS HERS.
     *
     * The review instruction has ended with "offer to run it" since the beginning, and she did:
     * a champagne message and a button reading [Run it](action:run). The app knew no action
     * called `run`, so a person told their prompt was ready pressed it and got "this app does
     * not know how to do that (run)" — measured 2026-09-23. See actionLink's note on RUN.
     *
     * IT RELEASES THE HELD RUN, it does not start a fresh one: she has just read this prompt and
     * cleared it, so the press is the same approval `<run_ok/>` is. With nothing held the host
     * ignores it (handleRunApproved says why) — nothing runs unreviewed.
     */
    if (parseRunAction(action)) {
      window.dispatchEvent(new CustomEvent('a2ui:run-approved'));
      return;
    }
    /*
     * BUILD THE WIREFRAME — the product room's compile, released by her own button.
     *
     * THE OWNER'S SHAPE, VERBATIM (2026-10-03 evening): *"they're basically prompting Grace and
     * she's doing everything… It only allows them to imagine and vibe-code structure or features
     * — they cannot design in it."* The ask is the THREAD's last person turn, read server-side
     * by the compile — the button carries no words of its own, so what gets built cannot drift
     * from what was said. The host answers by compiling and applying through the one draft store
     * (see WritingAreaIndex's build handler); a refusal comes back as her words in the thread.
     */
    if (parseBuildWireframeAction(action)) {
      window.dispatchEvent(new CustomEvent('a2ui:build-wireframe'));
      return;
    }
    /*
     * EDIT THE SELECTED TILE — the scoped op, STOLEN FROM THE EXAMPLE (see actionLink's note on
     * EDIT_NODE, and the route's own note for the borrowed contract): the host holds the stage's
     * own selection (`draft-select`), and the route edits exactly that node — the model answers
     * with the tile only, never the layout.
     */
    if (parseEditNodeAction(action)) {
      window.dispatchEvent(new CustomEvent('a2ui:edit-node'));
      return;
    }
    /*
     * SAVE THE PACKAGE — the blocker list's first item, and a name she reached for.
     *
     * IT IS THE APP'S OWN SAVE, not a second one written for her: `save-button` is the command
     * `<save-button/>` emits and the one the host answers by reading the sections off the surface.
     *
     * THERE ARE SEVERAL DOORS TO THIS WRITE, AND THAT IS THE DESIGN — the control bar's Save, the
     * keyboard, her `<save/>` tag, and now the button she offers in the thread — because a person
     * saves from wherever their hand happens to be, and redundancy is a usability feature rather
     * than a cost to trim (CANVAS-AND-PROMPT §1: "Redundancy is the feature here. Two ways to do
     * one thing is the cost; a person who can start at either end is the return"). ONE command
     * stands behind all of them: the doors are the usability, the command is what keeps a save a
     * save. See actionLink's note on SAVE — with this name unknown, every repair below it in her
     * list was moot, because a draft has no record yet.
     */
    if (parseSaveAction(action)) {
      // The same command the `<save/>` tag sends — one command, many doors: a tag in her reply, a
      // press on the button she offered, the bar, or the keyboard. See _emitCommand for why the
      // SHAPE matters (the shorthand both save paths used to send was blocked by the gatekeeper).
      host._emitCommand('save-button', { state: 'idle', label: 'Save' });
      return;
    }
    /* NAME THE PACKAGE — the writer already existed (`set-prompt-title`, also dispatched when she
     * writes `<set_title>`); only the button's name was missing. See actionLink's note. */
    const titled = parseSetTitleAction(action);
    if (titled) {
      window.dispatchEvent(new CustomEvent('set-prompt-title', { detail: { title: titled.title } }));
      return;
    }
    // The one destructive repair, as a button: the same act as `<remove_role name="X"/>`.
    const removed = parseRemoveSeatAction(action);
    if (removed) {
      window.dispatchEvent(new CustomEvent('remove-prompt-role', { detail: { roleName: removed.seat } }));
      return;
    }
    /*
     * A COMMAND NOBODY HANDLES IS SAID SO, NOT SENT.
     *
     * A button is either an edit this app knows how to make or a question for her — and when it
     * is neither, sending it to the model is the worst available answer: she replies to the
     * wire format as though it were a request and says she has done the thing (measured
     * 2026-09-23 — "I'll add a short description for the package" over a button that had
     * already failed to parse), so the person is told the work is done by the one path that
     * cannot fail loudly.
     *
     * WHICH IS WHICH IS NOT DECIDED BY THE SHAPE. "confirm" and "set-description" are both one
     * token, and one of them is her own answer that must reach her. So her two words are named
     * (HER_ANSWERS, the vocabulary her instructions fix) and everything else that reads like a
     * command — one token, or carrying a `:` or a `|` — is reported here instead.
     *
     * A sentence with spaces in it is a question, and goes to her as one, exactly as before.
     */
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
    // A button carries words she wrote, so the shape is known and there is nothing to
    // work out. Reasoning is off for every chat turn; see _send's note.
    void host._send(text);
}

/** THE WORKSPACE CONTEXT — the facts she is given about the room. */
export function workspaceContext(host: any): string {
    const parts: string[] = [];

    /*
     * THE PACKAGE ITSELF, FIRST — its name and its description.
     *
     * These are the two things she is asked to check before a Run, and until now she was given
     * neither: her context carried the prompt's seats and the output, and nothing about the
     * package they belong to. So she spoke about them from memory, and memory here is the
     * review request she read minutes ago — measured 2026-09-23: "The package still has no
     * description" over a package whose description was already saved.
     *
     * STATED EVEN WHEN EMPTY, and that is the point of the line rather than an oversight: "(none)"
     * is a fact, a missing key is a question, and a model asked a question answers it.
     */
    parts.push('=== THIS PACKAGE ===');
    parts.push(`name: ${String(host.packageTitle ?? '').trim() || '(none)'}`);
    parts.push(`description: ${String(host.packageDescription ?? '').trim() || '(none)'}`);

    let sections: any[] = [];
    try {
      const src = host.leftColumnContent;
      if (Array.isArray(src)) {
        // The live path: the array itself, written by the host on every edit.
        sections = src;
      } else if (src) {
        const parsed = JSON.parse(src);
        sections = Array.isArray(parsed?.sections)
          ? parsed.sections
          : Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      sections = [];
    }

    const leftParts = sections
      .filter((s) => s && (s.name || s.section || s.role || s.type))
      .map((s: any) => {
        const name = s.name || s.section || s.role || s.type || 'Section';
        const content = String(s.content || '').trim();
        return content
          ? `### ${name}\n${content.split('\n').map((l: string) => `  ${l}`).join('\n')}`
          : `### ${name}\n  (empty)`;
      });

    if (leftParts.length > 0) {
      parts.push('=== PROMPT INPUT AREA (what the user is building) ===');
      parts.push(...leftParts);
    }

    if (host.compiledOutput && host.compiledOutput.trim()) {
      parts.push('');
      parts.push('=== OUTPUT PANEL ===');
      parts.push(host.compiledOutput.trim());
    }

    /*
     * THE TOOLS THAT ACTUALLY EXIST — the same list the menu offers and the assembly
     * prompts carry, read from the same table.
     *
     * Without it she does the only thing she can with the Tool Call step: INVENTS a name.
     * Observed before this was added — "I've proposed a generic tool named web_search;
     * give me the exact API or tool name if yours differs" — which puts a call in the
     * prompt that nothing can make. A step whose whole purpose is to reach a real system
     * cannot be written from imagination.
     *
     * Names and one line each: the same words the menu's fly-out shows and the prompt
     * carries, so all three say one thing. The bodies are not here — they arrive when a
     * tool is actually inserted.
     */
    /*
     * THE CONSOLE IS NOT TOLD ABOUT TOOLS, and that is the whole of the tools rule.
     *
     * The owner, 2026-09-23: the console "is a search filter organizational chat interface. You're
     * not going to be doing prompt engineering or prompt adjustments on Grace on the console,
     * because she's tied to the package console in the database" — and its row declares no tools,
     * so it has none. Handing it the register was an invitation to offer a tool into a prompt that
     * is not open, which is exactly the cross-package drift the console must not have. Its own
     * controls are named in her instructions instead (`<reassemble-console …>`).
     *
     * A PACKAGE KEEPS THE REGISTER, deliberately: it is the catalogue of what EXISTS, and it is
     * what stops her inventing a tool name into an empty Tool Call step (see the note above). The
     * gate is `!== true` rather than `=== false` so a failed scope read does not silently strip a
     * package of the catalogue it needs — only a seat KNOWN to be the console goes without.
     *
     * See READ-ME/CHAT-CONVERSATION.md §11 for the decision and what it costs.
     */
    if (host._tools?.length && host._seatIsConsole !== true) {
      parts.push('');
      const runnable = host._tools.filter((t) => t.canRun);
      parts.push(`=== TOOLS AVAILABLE (${host._tools.length} — these are the only ones that exist) ===`);
      parts.push(
        runnable.length
          ? `These ${runnable.length} actually run: ${runnable.map((t) => t.name).join(', ')}.`
          : 'None of them run yet — nothing answers any of these names.',
      );
      parts.push('A tool marked (cannot run yet) can be written into a prompt, and pressing Run');
      parts.push('will not make it do anything. Offer one only when the person asks for it by name.');
      for (const tool of host._tools) {
        parts.push(`  ${tool.name}${tool.canRun ? '' : ' (cannot run yet)'} — ${tool.summary}`);
      }
    }

    if (host.consoleCards && host.consoleCards.length > 0) {
      parts.push('');
      parts.push(`=== CONSOLE — PROMPT LIBRARY (${host.consoleCards.length} packages) ===`);
      host.consoleCards.filter(Boolean).forEach((c: any, i: number) => {
        const facts = [
          c.category ? `category: ${c.category}` : null,
          (c.team_name || c.team) ? `team: ${c.team_name || c.team}` : null,
          (c.model_name || c.model) ? `model: ${c.model_name || c.model}` : null,
          c.status ? `status: ${c.status}` : null,
          typeof c.version === 'number' ? `v${c.version}` : null,
          c.message_count ? `${c.message_count} messages` : null,
          c.likes ? `${c.likes} likes` : null,
          c.lastUsed ? `last used ${String(c.lastUsed).slice(0, 10)}` : null,
        ].filter(Boolean);
        parts.push(`${i + 1}. "${c.title || '(untitled)'}"${facts.length ? ` — ${facts.join(', ')}` : ''}`);
        const desc = String(c.description || '').trim().replace(/\s+/g, ' ').slice(0, 120);
        parts.push(`   id: ${c.id || '(no id)'}${desc ? ` | ${desc}` : ''}`);
      });
    }

    /*
     * THE TRACE BESIDE HER — the governance room's own facts (see the `governanceTrace`
     * property). Stated ONLY when the room wrote them, which it does only once the person
     * has selected one; the numbers are the same ones the header and the tree draw, so her
     * words and the screen agree. The node's raw I/O is deliberately NOT here: it can be
     * orders of magnitude larger than the conversation, and the person can open the
     * Preview tab to read it — she is told what is on screen and where to look, not made
     * to recite it.
     */
    const traceFacts = host.governanceTrace;
    if (traceFacts && typeof traceFacts === 'object') {
      const t = traceFacts as Record<string, unknown>;
      parts.push('');
      parts.push('=== TRACE ON SCREEN (what the person has selected in this room) ===');
      parts.push(`trace id: ${String(t.id ?? '(unknown)')}`);
      if (t.name) parts.push(`name: ${String(t.name)}`);
      if (t.startTime) parts.push(`started: ${String(t.startTime)}`);
      if (typeof t.latency === 'number') parts.push(`latency: ${t.latency.toFixed(2)} seconds`);
      if (typeof t.totalCost === 'number') parts.push(`cost: $${t.totalCost}`);
      if (typeof t.totalTokens === 'number') parts.push(`tokens: ${t.totalTokens}`);
      if (t.sessionId) parts.push(`session: ${String(t.sessionId)}`);
      if (t.userId) parts.push(`user: ${String(t.userId)}`);
      if (typeof t.observationCount === 'number') parts.push(`observations: ${t.observationCount}`);
      const node = host.governanceObservation;
      if (node && typeof node === 'object') {
        const n = node as Record<string, unknown>;
        parts.push(`selected node: ${String(n.name ?? '(unnamed)')} (${String(n.type ?? 'SPAN')})`);
        if (typeof n.latency === 'number') parts.push(`  its latency: ${n.latency.toFixed(2)} seconds`);
        if (typeof n.totalCost === 'number') parts.push(`  its cost: $${n.totalCost}`);
        if (typeof n.totalTokens === 'number') parts.push(`  its tokens: ${n.totalTokens}`);
        if (n.model) parts.push(`  model: ${String(n.model)}`);
        if (n.level && n.level !== 'DEFAULT') parts.push(`  level: ${String(n.level)}`);
        if (n.statusMessage) parts.push(`  status: ${String(n.statusMessage)}`);
      }
      parts.push('Its full input/output is readable in this room\'s Preview tab.');
    }

    return parts.join('\n');
}

/** THE NEW CONVERSATION — created, named and pointed at. */
export async function conversationCreate(host: any): Promise<void> {
    const userId = host._userId();
    const scope = host._seatIsConsole === null
      ? await host._readSeatScope(userId)
      : (host._seatIsConsole ? 'console' : 'package');
    if (scope === 'unknown') {
      // The gate could not be read, so nothing is attempted — and the reason is said rather
      // than shown as a button that quietly does nothing.
      host._historyError =
        'Whether this chat is the console’s could not be read, so nothing was changed — no conversation was archived.';
      host.requestUpdate();
      return;
    }
    /*
     * A PACKAGE STARTS ITS OWN CONVERSATION TOO — this was one half of a deadlock.
     *
     * It returned here and did nothing at all: no request, no note, no message (measured
     * 2026-09-23 — zero fetches). And the seat's other control, the trash, refused to remove the
     * conversation you were in ("start a new one, then remove it"). So a package's one row could
     * not be removed, and no second row could be started to move off it — a person cleaning up had
     * no move at all. The owner: "I'm not able to delete conversations from the packages. It's just
     * basic CRUD process I thought."
     *
     * WHAT IT DOES IS THE PLAIN THING: create a conversation for THIS package and move the seat
     * into it, leaving the one just left in the list, where it can be returned to or deleted. The
     * console's flow ARCHIVES its predecessor instead — that is the console's own act and it stays
     * there (the owner, 2026-09-19: "this is the only place that this global chat is associated …
     * don't just apply it to both areas"). A package's list is the person's to keep or clear, which
     * is what CRUD means here.
     *
     * THE SESSION IS REPOINTED, the same hop the console's flow makes: the seat's conversation id
     * comes from this session's own column, so moving the column is what makes a reload land in the
     * new thread instead of resurrecting the old one.
     */
    if (scope === 'package') {
      host._historyError = '';
      try {
        /* THE MECHANICS ARE THE SHARED MODULE'S. It creates, points the package, moves the seat
           and reads the list BEFORE returning, so a greeting fired after it can never be refused
           by the seat's own ownership guard. */
        await host._conversationModule.createPackageConversation.call(
          host._conv(), userId, host._successorTitle() ?? 'New Chat',
        );
        /* A NEW CONVERSATION OPENS WITH HER OWN WORD, not with an empty card — the Tools seat's
           own rule, applied here (owner, 2026-11-07). The turn lands in the thread just created;
           `_greeted` stops the arriving path from saying it twice. */
        host._greeted = true;
        void host._send(
          'A person has just started a new chat in the design room — '
          + 'the Chat tab, where the design work and the console are discussed. '
          + 'They have said nothing yet. ' + NEW_PROMPT_HELLO,
          { silent: true },
        );
        host.requestUpdate();
      } catch (err) {
        host._historyError =
          `A new conversation could not be started: ${String((err as Error)?.message ?? err)}`;
        host.requestUpdate();
      }
      return;
    }
    const leaving = host.conversationId;
    const title = host._firstTurnTitle();
    const writing = host._conversationWrite;
    host._historyError = '';
    try {
      if (leaving && title) {
        await writing(`/api/conversations/${leaving}`, 'PUT', { title }, userId);
      }
      if (leaving) {
        await writing(`/api/conversations/${leaving}/archive`, 'POST', undefined, userId);
      }
      const created = await writing(
        '/api/conversations',
        'POST',
        { session_id: host.sessionId ?? undefined, title: host._successorTitle() },
        userId,
      );
      const next = typeof created?.id === 'string' ? created.id : '';
      if (!next) throw new Error('the new conversation came back without an id');
      if (host.sessionId) {
        await writing(`/api/prompt-sessions/${host.sessionId}`, 'PUT', { conversation_id: next }, userId);
      }
      // The seat moves, exactly as it does when a conversation is picked from the list.
      host.messages = [];
      host._local = [];
      host._inspectionReports = [];
      host.conversationId = next;
      // AND THE COUNT MOVES WITH IT: one archived, one created — the package's total is
      // what the leading bar counts, so it is re-read rather than guessed at.
      void host._readPackageConversations(userId);
      // NO GREETING EVENT, AND NO ASSEMBLY. The owner, 2026-09-19: "I don't care about a
      // greeting. I care that the conversations create and then are they retrievable" — and
      // a greeting raised by re-assembling would reload the whole surface, which this must
      // never do: everything a new conversation touches stays inside this chat.
      host.dispatchEvent(
        new CustomEvent('conversation-change', {
          bubbles: true,
          composed: true,
          detail: { conversationId: next },
        }),
      );
    } catch (err) {
      const why = String((err as Error)?.message ?? err);
      host._historyError = `A new conversation could not be started, so this one is still yours: ${why}`;
      host.requestUpdate();
    }
}

/** THE SESSIONS LANE — words in, the validated filter's rows out. */
export async function sessionsLane(host: any, text: string): Promise<void> {
    host._clearDraft();
    host._laneBusy = true;
    host._laneError = '';
    host.requestUpdate();
    try {
      const res = await fetch('/api/governance/sessions/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': host._userId() },
        /* THE SESSION ID IS WHAT MAKES THE QUERY A RECORD (owner, 2026-10-18): the lane writes
           the query onto the session seat as a conversation, and a capture without a seat has
           nowhere to be filed. A capture that fails is reported by the route, not hidden. */
        body: JSON.stringify({
          text,
          session_id: host.sessionId ?? '',
          /* NO project_id HERE. This seat does not carry one — it carries the PACKAGE session —
             and the route treats the column as optional. Declaring a property the element does
             not have is what made the production build fail; the capture only needs the seat. */
        }),
      });
      /* THE BODY IS READ AS TEXT AND PARSED ONCE — "could not parse" is an outcome to report,
         not a null to work around (the same rule the feed's own read follows). */
      const raw = await res.text();
      let payload: {
        status?: string;
        error?: string;
        explain?: string;
        count?: number;
        filter?: Array<{ column?: string; operator?: string; value?: unknown }>;
        sessions?: SessionsLaneRow[];
        capture?: { captured?: boolean; conversationId?: string; error?: string };
      } | null;
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        throw new Error(
          `the lane answered with something that is not JSON (HTTP ${res.status}): ${raw.slice(0, 160)}`,
        );
      }
      if (!res.ok || payload?.status !== 'ok') {
        throw new Error(String(payload?.error || `HTTP ${res.status}`));
      }
      if (!Array.isArray(payload.sessions)) {
        throw new Error('the lane answered without a sessions list');
      }
      host._laneRows = payload.sessions;
      const said = String(payload.explain ?? '').trim();
      const filters = (payload.filter ?? [])
        .map((f) => {
          const value = Array.isArray(f.value) ? `[${f.value.join(', ')}]` : String(f.value ?? '');
          return `${f.column ?? '?'} ${f.operator ?? '?'} ${value}`;
        })
        .join(' · ');
      host._laneReceipt = said && filters ? `${said} — ${filters}` : said || filters;
      const n = typeof payload.count === 'number' ? payload.count : payload.sessions.length;
      host._laneReceipt = `${host._laneReceipt} · ${n} session${n === 1 ? '' : 's'}`;
      /* THE RECORD APPEARS IN THE LIST AT ONCE (owner, 2026-10-18: *"I can go back as a user and
         select that conversation in sessions"*). The row is the record the route just wrote — not
         a copy kept here. A capture that FAILED is said on the receipt line instead of leaving a
         person believing they can come back to something that was never filed. */
      const capture = payload.capture;
      if (capture && capture.captured && capture.conversationId) {
        const known = (host.conversations ?? []).some(
          (c) => String(c.id) === String(capture.conversationId),
        );
        if (!known) {
          host.conversations = [
            { id: String(capture.conversationId), title: text, tab: 'sessions' },
            ...(host.conversations ?? []),
          ];
        }
      } else if (capture && capture.captured === false) {
        host._laneReceipt = `${host._laneReceipt} · NOT RECORDED — ${capture.error ?? 'the query could not be filed'}`;
      }
    } catch (err) {
      host._laneRows = null;
      host._laneReceipt = '';
      host._laneError = err instanceof Error ? err.message : String(err);
    } finally {
      host._laneBusy = false;
      host.requestUpdate();
    }
}

/** THE RAIL'S PRESS — the tab that was pressed. */
export function tabPress(host: any, e: Event): void {
    const tab = String((e as CustomEvent).detail?.tab ?? '');
    if (!tab) {
      host.collapsed = true;
      return;
    }
    host.collapsed = false;
    /*
     * THE ROOM OWNS THE RAIL — the press is navigation for the ROOM, not a switch inside this
     * seat. It is announced and nothing here moves: the seat keeps its tab, its conversation and
     * its thread, and the room reveals the container that belongs to the pressed tab. Switching
     * here instead is what made the chats read as global (owner, 2026-10-25: *"There's been a
     * misunderstanding … that these chats are global. They're not, they're specific to the tab
     * you're on."*).
     */
    if (host.railOwnedByHost) {
      host.dispatchEvent(
        new CustomEvent('tab-change', {
          detail: { tab },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    host.activeTab = tab;
    /*
     * EACH TAB TALKS IN ITS OWN CONVERSATION. Approvals is a different process from the chat
     * (conversations.tab — the column the schema always had), and the console opens both
     * conversations under its one session. Switching tabs therefore switches which
     * conversation this seat reads and writes, so Approvals lands exactly where that process
     * left off — the owner, 2026-09-19: "the user is right where that particular process left
     * off." Tabs with no conversation of their own (versions, tools, trace, repair) keep the
     * chat's.
     */
    const list = host.conversations ?? [];
    const match = list.find((c) => String(c.tab || 'chat') === tab)
      ?? list.find((c) => String(c.tab || 'chat') === 'chat');
    if (match && match.id && String(match.id) !== host.conversationId) {
      host.messages = [];
      host._local = [];
      host.conversationId = String(match.id);
    }
    // The VIEW switches either way; only a seat that has a run is asked the
    // question. See `tracePrompt`.
    if (tab === 'trace' && host.tracePrompt) void host._send(TRACE_PROMPT);
    /*
     * AND THE ROOM MAY WANT TO KNOW — the tab is announced OUT the same way the rail
     * announces it IN. A room with nothing selected can answer the Trace click itself
     * (the governance room moves the app to its Traces section, opens this column and
     * loads the newest trace — the owner's rule, 2026-10-13). An element never reaches
     * into its host; it says what happened and the host decides.
     */
    host.dispatchEvent(
      new CustomEvent('tab-change', {
        detail: { tab },
        bubbles: true,
        composed: true,
      }),
    );
}
