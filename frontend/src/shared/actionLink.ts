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
 * The action of a `set-description` button: the package's one-line description is `text`.
 *
 * NOT `write-seat`, AND THAT IS THE WHOLE POINT. The description belongs to the PACKAGE — the
 * line under its name in the library — and not to any seat of the prompt. She offered it as a
 * button, and `write-seat` is the shape she reaches for, so a description sent down that path
 * would add a row called "description" to the prompt: a seat that changes what runs, for a
 * value that does not.
 *
 * BOTH SPELLINGS ARE READ. She wrote `set-description|<the words>` — one separator, no name —
 * while every other action in this file is `name:arg`. A reader that insisted on the colon
 * turned her button into a message to the model, which then said it had added a description.
 * Tolerant here, once, rather than teaching her a spelling and hoping.
 */
export const SET_DESCRIPTION = 'set-description';

export function setDescriptionAction(description: string): string {
  return `${SET_DESCRIPTION}:${encodeActionArg(description)}`;
}

export function parseDescriptionAction(action: string): { description: string } | null {
  const m = String(action ?? '').match(/^set[-_]description\s*[:|]\s*([\s\S]+)$/);
  if (!m) return null;
  // Encoded when it came from this file's own writer; raw when it came from her. Both are the
  // words, and decoding a raw string is the identity.
  const description = decodeActionArg(unescapeParens(m[1])).trim();
  return description ? { description } : null;
}

/** Her payloads carry raw parens, which the render would end the link on. Undo that once. */
function unescapeParens(raw: string): string {
  return raw.replace(/%28/gi, '(').replace(/%29/gi, ')');
}

/**
 * The action of a `merge-seat` button: move `from`'s words into `into`, and drop `from`.
 *
 * WHY THIS IS AN ACTION AND NOT TWO WRITES. Two rows standing for one step is the mistake a
 * person makes by typing, and the repair is to put both texts in one row — which she could
 * attempt with `<update_agent_role>the whole merged text</update_agent_role>` followed by a
 * removal. That route goes through a model, which means the words come back REPHRASED: a
 * 400-character identity returned as 380 characters of almost-the-same sentence. The person's
 * text is theirs; a merge that rewrites it is a merge that loses it.
 *
 * So the move happens in the app, on the strings themselves — append, then remove — and the
 * words arrive exactly as they were typed.
 */
export const MERGE_SEAT = 'merge-seat';

export function mergeSeatAction(from: string, into: string): string {
  return `${MERGE_SEAT}:${[from, into].map(encodeActionArg).join(ACTION_ARG_SEP)}`;
}

export function parseMergeSeatAction(action: string): { from: string; into: string } | null {
  const head = `${MERGE_SEAT}:`;
  if (!String(action ?? '').startsWith(head)) return null;
  const parts = String(action).slice(head.length).split(ACTION_ARG_SEP).map(decodeActionArg);
  const [from, into] = parts;
  if (!from || !into) return null;
  return { from, into };
}

/**
 * The action of a `set-seat` button: this seat's text BECOMES `text` — it is not appended to.
 *
 * `write-seat` ADDS to a seat, which is right when the person is being given words to start
 * from. The repairs she is asked to offer are the other kind: a seat that holds a tool block it
 * should not, or placeholder text instead of an identity, is fixed by REPLACING what is there.
 *
 * She reached for this one herself, as a made-up action (`clean-agent-role`), which the app
 * reported as something it does not know how to do. The intent was right; the name was hers.
 */
export const SET_SEAT = 'set-seat';

export function setSeatAction(seat: string, text: string): string {
  return `${SET_SEAT}:${[seat, text].map(encodeActionArg).join(ACTION_ARG_SEP)}`;
}

export function parseSetSeatAction(action: string): { seat: string; text: string } | null {
  const head = `${SET_SEAT}:`;
  if (!String(action ?? '').startsWith(head)) return null;
  const parts = String(action).slice(head.length).split(ACTION_ARG_SEP).map(decodeActionArg);
  const [seat, text] = parts;
  if (!seat || text === undefined) return null;
  return { seat, text };
}

/**
 * The action of a `move-tool` button: take tool `name` out of wherever it sits and put it in `into`.
 *
 * THE REPAIR FOR A TOOL IN THE WRONG STEP, and she asked for it by this name before it existed —
 * "Move tool to Tool Call step" was offered, pressed, and answered with "this app does not know
 * how to do that". A tool may legitimately live beside the agent that uses it, so moving one is
 * not a correction of a mistake; it is the person deciding where the step belongs, and the app
 * moving the words without putting them through a model.
 */
export const MOVE_TOOL = 'move-tool';

export function moveToolAction(name: string, into: string): string {
  return `${MOVE_TOOL}:${[name, into].map(encodeActionArg).join(ACTION_ARG_SEP)}`;
}

export function parseMoveToolAction(action: string): { name: string; into: string } | null {
  const head = `${MOVE_TOOL}:`;
  if (!String(action ?? '').startsWith(head)) return null;
  const parts = String(action).slice(head.length).split(ACTION_ARG_SEP).map(decodeActionArg);
  const [name, into] = parts;
  if (!name) return null;
  return { name, into: into || 'Tool Call' };
}

/**
 * A BUTTON THAT ASKS HER TO DO THE THING SHE OFFERS: "Review the whole prompt".
 *
 * It is not an edit and not one of her answers — it is a REQUEST, and a request has to reach her
 * as a SENTENCE. She has offered this button since her first message of the session, and pressing
 * it used to hand her the literal token `review-prompt`; when the app learned to refuse tokens it
 * did not recognise, the person was told "this app does not know how to do that" instead. Neither
 * is a review.
 *
 * So a small number of tokens are TRANSLATED, and the translation is what she receives. The list
 * is deliberately short: every entry is a button she was already writing, not a new vocabulary.
 */
export const REVIEW_PROMPT = 'review-prompt';

/**
 * APPLY ALL — the one button that works the whole list of blockers at once.
 *
 * The owner, 2026-09-23: "she should automatically run it… we should just give a user the ability
 * to apply all. Previously she was handing those over one at a time, which we don't want."
 *
 * It is a TOKEN and not a sentence, unlike `review-prompt`, because pressing it makes the app DO
 * something: the repairs the checklist marks as the app's own are applied, the list is re-derived,
 * and then either the Run goes or she is asked about what is left. So it is translated into an
 * event the host hears, and the host owns the writers.
 */
export const FIX_ALL = 'fix-all';

/**
 * RUN — her own button, offered at the end of a cleared review, and the name was HERS.
 *
 * The review instruction has ended with "offer to run it" since the beginning, and she did: a
 * champagne sentence and `[Run it](action:run)`. The app knew no action called `run`, so a person
 * who had just been told their prompt was ready pressed it and was answered *"⚠️ That button asks
 * for something this app does not know how to do (run)"* — measured in the app, 2026-09-23.
 *
 * THE THIRD TIME THIS CLASS HAS COST A PERSON SOMETHING (`move-tool`, then `clean-agent-role`,
 * both of which were hers too), so the rule this file already states is applied here rather than
 * restated: implement the name she reached for, AND name the action in her instructions so she
 * does not have to be lucky. Both halves are required — a matcher alone leaves the next reply to
 * chance, and an instruction alone breaks every button already sitting in a thread.
 *
 * IT IS AN APPROVAL, NOT A FRESH RUN. She has just read this prompt and cleared it, so the press
 * releases the Run her own review is holding — the same path `<run_ok/>` takes
 * (`a2ui:run-approved`). Pressed with nothing held, the host ignores it, exactly as it ignores an
 * approval: nothing may run unreviewed because of a button about some other turn.
 */
export const RUN = 'run';

/**
 * `save` — the blocker list's own first item, and the name she reached for.
 *
 * Measured in the app 2026-09-23: a package that had never been saved, and her review correctly
 * said so first — *"The package has never been saved, so there is nothing to run yet"* — offering
 * `[Save the package](action:save)`. The app's save is reachable from a tag she may write
 * (`<save-button/>`, which the panel turns into the `save-button` command) and from the control
 * bar's button, but not from an ACTION called `save`, so the person was told the app did not know
 * how to do it — and with it unknown, every other repair in the list was moot: a draft has no
 * record to write a title or a description into. Same class as `move-tool`, `clean-agent-role` and
 * `run` (see RUN above): the intent was right and the name was missing.
 *
 * THE LONG SPELLINGS ARE THE SAME INTENT. `save-package` and `save-template` are what the two
 * buttons in this app are called, and a person reading her sentence cannot tell which the app
 * meant — so all three save.
 */
export const SAVE = 'save';

/** The action of a "Save the package" button. Whole word only; `save-as` is not a save here. */
export function parseSaveAction(action: unknown): boolean {
  const word = String(action ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  return word === SAVE || word === 'save-package' || word === 'save-template';
}

/**
 * `set-title|<the name>` — naming the package, the second of the two names she reached for.
 *
 * Measured with the first: `[Name the package](action:set-title|Precise Professional Assistant)`
 * was answered "this app does not know how to do that (set-title…)". The WRITER existed the whole
 * time — `set-prompt-title`, which the panel already dispatches when she writes `<set_title>` in
 * her reply — so this is the same shape as `set-description`: a token she writes, translated into
 * the write the app already owns.
 *
 * THE WRITER IS ONE; THE WAYS IN ARE THE POINT. Her tag, her button, and a person typing in the
 * bar are three doors onto the same write, because naming a package should not depend on which
 * part of the screen the person happens to be looking at (CANVAS-AND-PROMPT §1: redundancy is
 * the feature). A second WRITER would be the mistake; a second door is the design.
 *
 * The two-part spelling and the raw form are both read, like the description's, because a model
 * that has just written one of them may write the other next.
 */
export const SET_TITLE = 'set-title';

export function parseSetTitleAction(action: unknown): { title: string } | null {
  const m = String(action ?? '').match(/^set[-_]title\s*[:|]\s*([\s\S]+)$/);
  if (!m) return null;
  const raw = m[1].trim();
  if (!raw) return null;
  // Encoded when it came from this file's own writer; raw when it came from her. Both are ours.
  const title = raw.replace(/%28/gi, '(').replace(/%29/gi, ')').trim();
  return title ? { title } : null;
}

/**
 * The action of a "Run it" button. The long spellings are the same intent written out, and the
 * separators are folded the way `requestForAction` folds them (`run_prompt` and `run-prompt` are
 * one word) — but the match is on the WHOLE word: `rerun` is not a run, and a substring test is
 * how an unknown word becomes a wrong action.
 */
export function parseRunAction(action: unknown): boolean {
  const word = String(action ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  return word === RUN || word === 'run-it' || word === 'run-prompt';
}

/** What she is asked when that button is pressed — the same review, asked in words. */
export const REVIEW_PROMPT_REQUEST = [
  'The person has pressed Review. Read the prompt as it stands, in the workspace above.',
  'Name something only if it is actually wrong with THIS prompt, and name EVERYTHING that is',
  'wrong in this same reply — one sentence each, with a button for each fix the person can press.',
  'Do not recite the requirements. If nothing is wrong, congratulate them in one short sentence',
  'starting with a bottle — 🍾 — and offer to run it as a button spelled exactly',
  '[Run it](action:run): a person who has just worked a list of fixes should be told they',
  'finished, not left to infer it — and should be able to act on it in one press.',
].join(' ');

/**
 * A REQUEST WITH NO WORDS IN IT IS STILL A REQUEST — it is the person's words that are missing.
 *
 * Measured 2026-09-23: her blocker list offered `[Name it](action:set-title)` with no name in the
 * action, because the name is the person's to choose and she does not know it. The app answered
 * "this app does not know how to do that (set-title)" — which is false, and worse than false: the
 * app DOES know how to name a package, and what was missing was a question. So a bare `set-title`
 * or `set-description` is handed back to her as words (the same shape as `review-prompt`), she asks
 * for the name in one sentence, and the person's answer comes back as the spelled button
 * (`set-title|<their words>`), which the writers above already handle.
 *
 * NOTHING IS INVENTED AND NOTHING IS SUBSTITUTED: the app does not choose a name for the person's
 * package, and it does not pretend the button worked. It asks.
 */
export const SET_TITLE_REQUEST = [
  'The person pressed "Name it" — they want to name this package themselves, and the name is',
  'theirs to choose, which is why the button carried none. Ask them, in one short sentence, what',
  'they would like it called. Do not suggest a name and do not name it yourself.',
].join(' ');

export const SET_DESCRIPTION_REQUEST = [
  'The person pressed "Add a description" without words — the description is theirs to write,',
  'which is why the button carried none. Ask them, in one short sentence, what the package should',
  'say about itself. Do not write one for them.',
].join(' ');

/** A request-token, turned into the words she should receive. Null when it is not one of them. */
export function requestForAction(action: string): string | null {
  const name = String(action ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (name === REVIEW_PROMPT) return REVIEW_PROMPT_REQUEST;
  if (name === SET_TITLE) return SET_TITLE_REQUEST;
  if (name === SET_DESCRIPTION) return SET_DESCRIPTION_REQUEST;
  return null;
}

/**
 * THE TWO WORDS SHE READS BACK — her own answers to her own offer.
 *
 * Her instructions fix them: "The words are fixed: Confirm and Not now." They are not commands
 * the app performs; they are the person's reply, and they go to her as a message like typed
 * words would. They are named here because the panel has to tell them apart from a BUTTON THAT
 * ASKS FOR SOMETHING THE APP CANNOT DO — and the shape does not say which is which: "confirm"
 * and "set-description" are both single tokens.
 */
export const HER_ANSWERS = ['confirm', 'not-now'];

/**
 * The action of a `remove-seat` button: take row `seat` out of the prompt.
 *
 * The tag form (`<remove_role name="X"/>`) has existed all along; this is the same act as a
 * button, because a repair the person cannot press is a repair they have to type out. It is the
 * only destructive action in the set, so it is also the one she is told to ask about first.
 */
export const REMOVE_SEAT = 'remove-seat';

export function removeSeatAction(seat: string): string {
  return `${REMOVE_SEAT}:${encodeActionArg(seat)}`;
}

export function parseRemoveSeatAction(action: string): { seat: string } | null {
  const head = `${REMOVE_SEAT}:`;
  if (!String(action ?? '').startsWith(head)) return null;
  const seat = decodeActionArg(String(action).slice(head.length)).trim();
  return seat ? { seat } : null;
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

/**
 * The action of a `write-tool` button: put tool `name` into its seat, as the menu does.
 *
 * A TOOL IS NOT WORDS, WHICH IS WHY THIS IS NOT `write-seat`. The seat's own Functions /
 * Tools menu inserts a tool as two things at once: a line naming the tool, and the tool's
 * own text under it. `_insertTool` reads the text from the register when the menu is used.
 * A button carrying the tool's NAME reaches the same code, so a tool inserted from the chat
 * and a tool inserted by hand produce the same seat — the person can read what will run, and
 * the prompt says which tool it names.
 *
 * The name is the register's own (`tools.name`), never a label: the token written into the
 * prompt has to match a row.
 */
export const WRITE_TOOL = 'write-tool';

export function writeToolAction(name: string): string {
  return `${WRITE_TOOL}:${encodeActionArg(name)}`;
}

/** Read a `write-tool` action back. `null` for anything else, or a missing name. */
export function parseWriteToolAction(action: string): { name: string } | null {
  const head = `${WRITE_TOOL}:`;
  if (!String(action ?? '').startsWith(head)) return null;
  const name = decodeActionArg(String(action).slice(head.length)).trim();
  if (!name || name.includes(ACTION_ARG_SEP)) return null;
  return { name };
}
