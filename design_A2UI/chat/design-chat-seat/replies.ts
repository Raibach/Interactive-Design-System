/**
 * THE SEAT'S REPLIES — the answer's own processing, and the buttons inside her turn.
 *
 * Moved from `design-chat-seat.ts` without a rule changed. `processReplyAction` reads the model's
 * answer once and turns it into the turns the thread draws; the reply's fifteen named paths live
 * in `thread/actions/reply.ts`, and the "No thanks" withdrawal lives here with them.
 */
import { declineAutoAdvice } from '@/shared/autoAdvice';
import { eventBus } from '@/shared/event-bus';
import * as thread from '../thread/actions/reply';

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

/** A button inside her turn was pressed. */
export function actionSend(host: any, e: Event): void {
  thread.replyAction(host, e);
}

/** "No thanks" — withdraw the offer in the last turn, and stop volunteering. */
export function withdrawOfferAction(host: any): void {
    declineAutoAdvice();
    const turns = host._local.slice();
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      if (turns[i].role !== 'assistant') continue;
      const stripped = String(turns[i].content ?? '').replace(/\[[^\]]*\]\(action:[^)]*\)/g, '').trimEnd();
      if (stripped === String(turns[i].content ?? '').trimEnd()) return; // nothing to withdraw
      turns[i] = { ...turns[i], content: stripped };
      host._local = turns;
      host.requestUpdate();
      return;
    }
}
