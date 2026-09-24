/**
 * The triggers — what starts a prompt, in words a person already uses.
 *
 * ONE SOURCE, TWO VIEWS. The prompt row's capability menu reads this list, and so does a node's
 * menu on the canvas: the same question ("what starts this?") asked in the two places the work is
 * done. If the two drew their own lists they would drift, and the drift would look like the
 * canvas and the prompt disagreeing about the same prompt — the exact failure this application
 * exists to make impossible.
 *
 * PORTED FROM THE REFERENCE CANVAS. Its first step asks "what triggers this workflow?" and
 * answers with a catalogue of integrations (Telegram, Notion, Airtable…) plus a catch-all,
 * "Other ways" — errors, file changes, a schedule. That QUESTION and that LIST are the feature.
 * The vocabulary is not: an integration name means something to someone who has already wired one
 * up and nothing to the person this application is built for.
 *
 * So each entry is the same idea said plainly, and each writes a token into the row — the shape a
 * tool writes (`{{tool:name}}`) — so a row holds one kind of thing and the server reads one shape.
 * `when-you-run` is the one that is true today for every prompt: a person pressing Run. The rest
 * are the flow's future, listed where they will be chosen rather than promised somewhere else.
 */

export interface Trigger {
  /** A person's words. Never the key. */
  name: string;
  /** What the row holds, and the only thing that identifies it. */
  token: string;
  /** One line about what it means, shown while the pointer is over it. */
  hint: string;
}

export const TRIGGERS: Trigger[] = [
  {
    name: 'When you press Run',
    token: '{{trigger:when-you-run}}',
    hint: 'The prompt runs when you ask it to. This is how every prompt works today.',
  },
  {
    name: 'On a schedule',
    token: '{{trigger:on-a-schedule}}',
    hint: 'It runs by itself at a time you choose — every morning, every Monday.',
  },
  {
    name: 'When a message arrives',
    token: '{{trigger:on-a-message}}',
    hint: 'It starts when someone sends it something to work on.',
  },
  {
    name: 'When a file changes',
    token: '{{trigger:on-a-file-change}}',
    hint: 'It starts when a document it watches is updated.',
  },
  {
    name: 'When a form is filled in',
    token: '{{trigger:on-a-form}}',
    hint: 'It starts when someone submits a form.',
  },
  {
    name: 'When something goes wrong',
    token: '{{trigger:on-a-failure}}',
    hint: 'It starts when an earlier run fails.',
  },
];

/**
 * WHICH TRIGGER A ROW HOLDS — read from the row's own text, so nothing can drift.
 *
 * There is no stored copy on purpose. A row either contains the token or it does not, which makes
 * the badge beside the control, the tick in the menu and the mark on the rail three readers of one
 * fact. A stored copy is how a row edited by hand goes on claiming a trigger it no longer carries.
 */
export function triggerIn(content: string): Trigger | null {
  const m = /\{\{trigger:([A-Za-z0-9_-]+)\}\}/.exec(String(content || ''));
  if (!m) return null;
  const token = `{{trigger:${m[1]}}}`;
  return TRIGGERS.find((t) => t.token === token) ?? { name: m[1], token, hint: '' };
}

/** The tools a row already holds, read the same way and for the same reason. */
export function toolsIn(content: string): Set<string> {
  return new Set(
    Array.from(String(content || '').matchAll(/\{\{tool:([A-Za-z0-9_-]+)\}\}/g)).map((m) => `{{tool:${m[1]}}}`),
  );
}

/**
 * WRITE A TRIGGER INTO A ROW'S TEXT — one per row, replaced rather than accumulated.
 *
 * Two triggers on one module is a state the interface should make impossible: "every morning" and
 * "when a form arrives" are two different prompts wearing one row. Choosing a trigger replaces the
 * one already there, and choosing the one that is already there clears it. Clearing is a real
 * answer — it leaves the row starting however the application starts it, which is how every prompt
 * run by hand works.
 *
 * Pure, so both views call the same function with the same result and neither can invent its own
 * idea of what a re-pick means.
 */
export function withTrigger(content: string, token: string): string {
  const had = String(content || '').includes(token);
  const stripped = String(content || '').replace(/\{\{trigger:[A-Za-z0-9_-]+\}\}[ \t]*\n?/g, '').trim();
  // `.replace` with its own literal, deliberately: a shared /g regex carries `lastIndex` between
  // calls, which is how a replace-only-the-second-time bug is born.
  return had ? stripped : `${token}\n${stripped}`.trim();
}
