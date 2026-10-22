/**
 * sectionTeaching — whether a conversation has been taught a section, and the mark
 * that keeps it from being taught twice.
 *
 * THE FACT: the governance room's Evals button opens the application's Evaluators
 * section, and the first time a person lands there she explains what the section is
 * (owner, 2026-10-16: *"she should talk to the user about [it] … however, she should
 * not talk about it every single time they click on the button. Once a conversation
 * is established related to this information — and that usually happens the first
 * time [they] click on the eval button — that conversation stays seated in there
 * until the user adds to it or removes it. If the user removes it, then she starts
 * all over."*).
 *
 * THE UNIT IS THE CONVERSATION — not the seat, not the tab, not the page. She
 * explains once per conversation, whatever is clicked afterwards; a conversation
 * that has been removed (or a new one started) has not been taught, so the next
 * click explains again.
 *
 * PERSISTED, unlike shared/autoAdvice's flag, and the difference is the kind of
 * fact. That file's note says a preference must not outlive the tab because it has
 * no visible switch — right for a preference. This is not a preference: it is a
 * fact about a durable record. The conversation itself outlives the tab (it lives
 * in the server's store), so its teaching must too, or every reload would make her
 * repeat herself into the same thread. Keyed by the conversation's own id, so
 * nothing but that conversation can ever be marked by accident.
 */

const PREFIX = 'raibach:section-taught:';

/** Has this conversation already been taught this section? */
export function sectionTaught(section: string, conversationId: string): boolean {
  if (!conversationId) return false;
  try {
    return window.localStorage.getItem(PREFIX + section + ':' + conversationId) === '1';
  } catch {
    // A storage refusal reads as "not taught yet" — the cost is one repeated
    // explanation, never a silent section.
    return false;
  }
}

/** Spend it — one teaching per conversation, and no model call on any later click. */
export function markSectionTaught(section: string, conversationId: string): void {
  if (!conversationId) return;
  try {
    window.localStorage.setItem(PREFIX + section + ':' + conversationId, '1');
  } catch {
    // A storage refusal only costs the once-per-conversation guarantee; nothing
    // else reads this mark.
  }
}
