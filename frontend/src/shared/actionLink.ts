/**
 * actionLink — the wire format behind a chat button.
 *
 * A button in the chat is not a `<button>`. It is a line of text — `[label](action:…)`
 * — because that is what survives a model's reply, and `renderMessageContent` is what
 * turns the line into something a person can press. Two properties of that format are
 * load-bearing, and both were true only by luck until they were written here:
 *
 *   1. The action may NOT contain `)`. The render splits on
 *      `/\[.*?\]\(action:[^)]+\)/g`, so a `)` inside the payload ends the link early
 *      and the button stops being a button — it becomes visible punctuation in Grace's
 *      sentence. `encodeURIComponent` does NOT escape `( ) ! ' * ~`, so a value with a
 *      JSON fragment or a sentence in it would break the link. The parens are escaped
 *      here, once, for every argument of every action.
 *   2. The label may not contain `]`, and never needs to: it is the word on the button.
 *
 * Everything a person might answer is an argument of one action — the section it goes
 * to, the field inside it, the value itself — so the three are encoded together and
 * read back together. `|` is the separator and never appears raw in an argument, which
 * is why a value containing `|`, a newline, or a quote still arrives whole.
 *
 * `plainText.ts` sets `action:` links aside before it strips markers, so a label with
 * an em dash or parentheses reaches the button intact.
 */

/** One argument of an action, safe inside `(action:…)` — including the parens. */
export function encodeActionArg(value: string): string {
  return encodeURIComponent(String(value ?? ''))
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/** The inverse. A malformed escape returns what it read rather than throwing. */
export function decodeActionArg(raw: string): string {
  try {
    return decodeURIComponent(String(raw ?? ''));
  } catch {
    return String(raw ?? '');
  }
}

/** The separator between encoded arguments. Legal in an encoded argument; absent raw. */
export const ACTION_ARG_SEP = '|';

/** `[label](action:payload)` — the only place this shape is written. */
export function actionLink(label: string, action: string): string {
  // Brackets out of the label: `]` would end it early, and `[` would let the render
  // start the label somewhere else. A label is the word on the button; it needs neither.
  return `[${String(label ?? '').replace(/[[\]]/g, '')}](action:${action})`;
}

/** The action of a `fill-field` button: write `value` under `field` in `section`. */
export const FILL_FIELD = 'fill-field';

export function fillFieldAction(section: string, field: string, value: string): string {
  return `${FILL_FIELD}:${[section, field, value].map(encodeActionArg).join(ACTION_ARG_SEP)}`;
}

/**
 * Read a `fill-field` action back. `null` for anything else — including a payload
 * that lost an argument on the way, which is reported rather than acted on.
 */
export function parseFillFieldAction(
  action: string,
): { section: string; field: string; value: string } | null {
  const head = `${FILL_FIELD}:`;
  if (!String(action ?? '').startsWith(head)) return null;
  const parts = String(action).slice(head.length).split(ACTION_ARG_SEP).map(decodeActionArg);
  const [section, field, value] = parts;
  if (!section || !field || value === undefined) return null;
  return { section, field, value };
}

/** The action of a `write-seat` button: put `value` in `section`, making it if absent. */
export const WRITE_SEAT = 'write-seat';

export function writeSeatAction(section: string, value: string): string {
  return `${WRITE_SEAT}:${[section, value].map(encodeActionArg).join(ACTION_ARG_SEP)}`;
}

/**
 * Read a `write-seat` action back.
 *
 * DIFFERENT FROM `fill-field` IN THE ONE WAY THAT MATTERS HERE: the seat does not
 * have to exist. A step she offers is often "add this seat and put this in it" —
 * the person has not made the seat yet, which is why they are being offered the
 * step at all. `fill-field` finds the section by name and REFUSES when there is
 * none, so a button built on it would do nothing on exactly the prompt it is most
 * useful for.
 */
export function parseWriteSeatAction(action: string): { section: string; value: string } | null {
  const head = `${WRITE_SEAT}:`;
  if (!String(action ?? '').startsWith(head)) return null;
  const parts = String(action).slice(head.length).split(ACTION_ARG_SEP).map(decodeActionArg);
  const [section, value] = parts;
  if (!section || value === undefined || value === '') return null;
  return { section, value };
}

/**
 * `no-advice` — the way out of what she just offered.
 *
 * She ends an advisory turn with suggestions, and a suggestion you do not want is a
 * suggestion you have to get past. This is the button that gets past it: pressed, the
 * offer is withdrawn and NOTHING is sent. It is handled by the app for the same reason
 * `write-seat` is — sending it to her would spend a model call to be told "understood",
 * and a dismissal is the one thing that should cost nothing.
 *
 * It takes no arguments. There is nothing to say.
 */
export const NO_ADVICE = 'no-advice';
