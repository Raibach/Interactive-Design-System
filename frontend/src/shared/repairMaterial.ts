/**
 * repairMaterial — what a repair prompt ASKS A PERSON FOR, and what the app can
 * hand them instead of an empty box.
 *
 * A repair prompt is a tool for the person, not an essay for a model. Three rules,
 * and they are the whole module:
 *
 *   1. A check that needs a value shows a FIELD where that value goes. The field is a
 *      LABEL — `Provenance (required):` — and under it the value lines. Nothing else.
 *   2. The field ARRIVES FILLED whenever the app can derive a true value, so accepting
 *      the app's answer is pressing Run.
 *   3. A field the app cannot fill is not EXPLAINED IN THE PROMPT. The prompt is the
 *      artifact the model reads; a sentence in it addressed to the person is read by
 *      the wrong reader, and the person reads it in the one place they are not looking
 *      — a textarea they did not open. So the answer travels on `choices`, and the
 *      question is asked in the CHAT, by the assistant, with a button per answer
 *      (`repairAsk`). `Provenance (required):` is the whole field; the two words the
 *      person can answer are on the buttons, where they can be pressed.
 *
 * Where a suggestion comes from — never guessed:
 *   - `provenance-missing`: the checker's own list of the event names the element
 *     dispatches (the finding's `dispatchedEvents`, measured by
 *     scripts/catalog-check.mjs over `new CustomEvent('…')`). The marking default
 *     is `inferred`; Run reads the Figma annotation through the Tool Call and marks
 *     `verbatim` whatever the annotation spells out.
 *   - `node-id-absent`: the node id the finding already carries.
 *   - `container-undeclared`: the container name the finding already quotes.
 *   - `annotation-missing` / `annotation-prose`: nothing at all. The four fields the
 *     checker names (Data / On click / State / A11y) arrive as four bare labels —
 *     `Data:` — because the annotation is the design's own words, and writing them out
 *     of the element's code would invert which one is the source. What each line is for
 *     is said in the CHAT, once, when the prompt is built (`repairAsk`); the events the
 *     element already fires are named once, in the Agent seat's instruction, not under
 *     a field.
 *
 * Nothing else goes under a label: no gloss on a name the person already knows, no
 * argument for the finding, no restatement of the rule the check already applied. They
 * came here to make one edit, and the field says what that edit is.
 *
 * The FORM IS TEXT, in the section's own textarea. `formFields` reads that text
 * back, so what the person sees, what the model receives and what the flag
 * reports are one thing — not a template plus a private copy of its meaning.
 */

/** The finding, as far as this module is concerned. A subset of CatalogFinding. */
export interface RepairFinding {
  check: string;
  what?: string | null;
  fix?: string | null;
  component?: string | null;
  nodeId?: string | null;
  file?: string | null;
  owner?: string | null;
  /** The event names the component's own source dispatches (see dispatchNames in the check). */
  dispatchedEvents?: string[] | null;
}

export interface RepairField {
  /** The field's name, as it appears in the form (and in the guide, where it has one). */
  label: string;
  /** True when the fix cannot be made without a value here. Drives the red flag. */
  required: boolean;
  /** Value lines the app derived. Empty when the app has nothing true to offer. */
  suggestion: string[];
  /**
   * The answers this field can take, when they are a closed set — DATA, never prose.
   *
   * A choice carries its own value lines, so pressing the button writes exactly what
   * the app would have written if it had derived the answer itself. The prompt never
   * shows them: nothing on the label line names them, and no reader of the prompt is
   * asked anything. They are read by `repairAsk`, which puts them in the chat as
   * buttons (`[designer (verbatim)]`), which is where a person answers.
   *
   * Absent where the answer is not enumerable — a node id, a file path, the four
   * annotation lines. There the chat asks in words and the person says it; the field
   * stays `required` and empty until the answer arrives.
   */
  choices?: RepairAnswer[];
}

/** One answer a person can press: the word on the button, and the lines it writes. */
export interface RepairAnswer {
  /** The word on the button. Short — it is read at a glance, next to its twin. */
  label: string;
  /** The value lines this answer writes under the field's label. */
  value: string[];
}

/** A `RepairAnswer`, plus the field it answers — enough to build a button. */
export interface FiledRepairAnswer extends RepairAnswer {
  field: string;
}

export interface RepairMaterial {
  /** What the check needs, in the check's own terms (the System section states it). */
  need: string;
  /** The lines the person fills with the missing information — the User seat. */
  fields: RepairField[];
  /** What the APP says to the agent about those lines — appended to the agent. */
  instruction?: string;
}

/** A field read back out of the form text. */
export interface ParsedRepairField {
  label: string;
  required: boolean;
  /** True when the block is marked as the app's suggestion, not the person's answer. */
  suggested: boolean;
  /** True when nothing stands under the label. */
  empty: boolean;
  value: string;
}

/**
 * The four fields the checker names in its own fix — "Rewrite using the field format
 * (Data / On click / State / A11y)".
 *
 * The label alone is the request: `Data:` says the value goes here, and the chat says
 * what the value is for. What used to stand here was an instruction to the person,
 * written into the prompt — read by the model, which is the wrong reader, and by the
 * person in a box they had not opened. It is now a sentence in the chat.
 */
const ANNOTATION_FIELDS: string[] = ['Data', 'On click', 'State', 'A11y'];

/**
 * What each check needs in order to be repaired.
 *
 * A prompt that carries only the VERDICT cannot repair anything: the model reads
 * the finding, finds no material, and says so. Measured — a real Run answered
 * "the material supplied contains no field values to mark … not the component
 * body." So the prompt states what this check needs, and when that is a person's
 * material it says so outright, so the reply is the REQUEST rather than an
 * invented fix.
 *
 * Keyed by the checker's own `check` id (scripts/catalog-check.mjs), so a new
 * check with no entry falls through to DEFAULT_CHECK_NEED instead of guessing.
 * (Moved here from WritingAreaIndex.tsx when the fields were added beside it —
 * the sentence and the field are two halves of one answer.)
 */
export const CHECK_NEEDS: Record<string, string> = {
  'provenance-missing':
    "the component's own body and its Figma annotation — a per-field map can only be written from the fields themselves",
  'node-unresolved':
    "the component's real Figma node id — the one recorded is not in the file",
  'node-id-absent':
    'the element that renders each Figma node, and the node id it should carry',
  'component-missing':
    'the file that should hold the component, or confirmation that the registry entry is wrong',
  'annotation-missing':
    'an annotation written on the VARIANT in Figma (Data / On click / State / A11y)',
  'annotation-prose':
    'that same note rewritten in the field format (Data / On click / State / A11y)',
  'geometry-drift':
    "a DECISION, not material: the Figma node moves to the container's constraint, or the constraint changes once in the catalogue",
  'attr-hardcoded':
    'nothing further — the change is mechanical: drop the expected-name constant, match by regex, record what was seen',
  'container-undeclared':
    'the container the component renders inside, added to its registry entry',
  'event-unheard':
    'the listener for the event, or a mark that the action is undefined in Figma',
  'tag-inert': 'a Lit element plus a catalog entry, or removal from the allowlist',
  'element-unclaimed': 'the allowlist entry and the catalog schema, so the element can be reached',
  'schema-absent': 'the catalog schema entry, or removal from the allowlist',
  'allowlist-absent': 'the allowlist entry, or removal from the schema',
  'primitive-missing': 'the component copied unchanged from catalogs/primitives/catalog.json',
  'primitive-drift':
    'the component made identical to the primitives catalog — changed THERE if the change is for every theme',
  'check-could-not-run':
    'the input the check itself was missing (a token, an artifact) — this one is about the checker, not the design',
};
export const DEFAULT_CHECK_NEED =
  'whatever this check is missing — it is not in this prompt, so name what you need.';

/**
 * The first quoted token in a check's own sentence.
 *
 * Three checks already name their subject in quotes in the text they emit
 * ("Renders inside the \"chat-menu-item\" container…", `Dispatches
 * "section-collapse-toggle" and nothing listens`). The check quoted it; reading
 * it back is the check speaking, not this module guessing. Where a check stops
 * quoting, there is no suggestion and the field asks for the value instead —
 * which is the designed outcome, not a fallback that hides the change.
 */
function quotedIn(text?: string | null): string | null {
  const m = /"([^"\n]{1,80})"/.exec(String(text ?? ''));
  return m ? m[1] : null;
}

/**
 * A field the app can fill: the value lines are the app's, so the label carries
 * `suggested` and the person's whole act is pressing Run — or editing what stands
 * there. The marking is on the label line because that is the line a person reads.
 */
function suggestedField(label: string, value: string[]): RepairField {
  return { label, required: true, suggestion: value };
}

/**
 * A field only a person can fill — no suggestion, and (when the answers are a closed
 * set) the answers themselves, as data.
 *
 * There is no prose on this field. The prompt says what value goes here by naming it;
 * what the person has to decide is asked in the chat, where the answers are buttons.
 */
function askedField(label: string, choices?: RepairAnswer[]): RepairField {
  return choices?.length
    ? { label, required: true, suggestion: [], choices }
    : { label, required: true, suggestion: [] };
}

/**
 * The provenance block, filled when the checker listed the invented events.
 *
 * With a list, the person reads a marking and presses Run. Without one, the whole entry
 * is marked in one word — `verbatim` for an entry the designer specified, `inferred` for
 * one we wrote. Both are the two answers the registry's own convention names
 * (components/registry.json: `provenanceConvention`, which also carries the one-word
 * form on a container), so the button writes a value the registry already accepts.
 */
function provenanceField(f: RepairFinding): RepairField {
  const events = (f.dispatchedEvents ?? []).map((e) => String(e)).filter(Boolean);
  if (events.length) {
    return suggestedField('Provenance', [
      '"provenance": {',
      ...events.map((n, i) => `  "${n}": "inferred"${i === events.length - 1 ? '' : ','}`),
      '}',
    ]);
  }
  return askedField('Provenance', [
    { label: 'designer — verbatim', value: ['"provenance": "verbatim"'] },
    { label: 'AI — inferred', value: ['"provenance": "inferred"'] },
  ]);
}

/** The four labels the person fills in — the annotation that is missing. */
function annotationFields(): RepairField[] {
  return ANNOTATION_FIELDS.map((label) => ({ label, required: false, suggestion: [] }));
}

/**
 * Checks whose repair needs nothing typed: the change is mechanical, or the
 * missing thing is the checker's own input rather than the design's. Listed
 * explicitly, so an unknown check falls through to a field that ASKS instead of
 * being silently treated as needing nothing.
 */
const NO_FIELDS = new Set([
  'attr-hardcoded',
  'tag-inert',
  'schema-absent',
  'allowlist-absent',
  'schema-unreachable',
  'element-unclaimed',
  'primitive-missing',
  'primitive-drift',
  'check-could-not-run',
  'clean-no-jsx',
  'doc-claim-drift',
  'open-items-register',
]);

function fieldsFor(f: RepairFinding): RepairField[] {
  switch (f.check) {
    case 'provenance-missing':
      return [provenanceField(f)];
    case 'node-id-absent': {
      const id = f.nodeId ? String(f.nodeId) : '';
      return id
        ? [suggestedField('Node id', [`data-node-id="${id}"`])]
        : [askedField('Node id')];
    }
    case 'node-unresolved':
      return [askedField('Node id')];
    case 'component-missing':
      return [askedField('File')];
    case 'annotation-missing':
    case 'annotation-prose':
      // Four bare labels — "the missing information", which is the person's to enter.
      // What each line is for, and what to do with the four, is spoken in the chat
      // (`repairAsk`) and on the agent side (`annotationInstruction`), never in the
      // prompt, which holds information and no advice.
      return annotationFields();
    case 'geometry-drift':
      // Two answers, and they are the whole decision: move the node, or change the
      // constraint once. Nothing is derivable — a person picks one.
      return [
        askedField('Decision', [
          { label: 'move the node to the constraint', value: ['move the node to the constraint + the numbers'] },
          { label: 'change the constraint once, in the catalogue', value: ['change the constraint once, in the catalogue'] },
        ]),
      ];
    case 'container-undeclared': {
      const name = quotedIn(f.what);
      return name
        ? [suggestedField('Container', [`"container": "${name}"`])]
        : [askedField('Container')];
    }
    case 'event-unheard': {
      const event = quotedIn(f.what);
      // The check's own fix names both answers ("Wire a listener, or mark it"), so the
      // field offers exactly those two — and the event the check quoted, where it did.
      return [
        askedField('Listener', [
          {
            label: event ? `wire the listener for "${event}"` : 'wire the listener',
            value: [event ? `wire the listener for "${event}"` : 'wire the listener'],
          },
          {
            label: 'mark it undefined in Figma',
            value: ['// TODO(behavior): action undefined in Figma'],
          },
        ]),
      ];
    }
    default:
      if (NO_FIELDS.has(f.check)) return [];
      return [askedField('Material')];
  }
}

/**
 * What the APP says, appended to the agent, for an annotation repair.
 *
 * The two sides are different people's words: the missing information goes on the User
 * seat, typed by the person who has it; this is the app speaking to the agent about
 * what to do with it. So it says where the note goes, what each of the four lines
 * holds (one sentence, so the agent is not guessing), and the names the code already
 * fires — the agent is the one writing the note, and those are the names it will meet.
 */
function annotationInstruction(f: RepairFinding): string {
  const where = f.nodeId
    ? `${f.component || 'this component'} — Figma node ${f.nodeId}`
    : f.component || 'this component';
  const events = (f.dispatchedEvents ?? []).map((e) => String(e)).filter(Boolean);
  return [
    `Write the annotation for ${where} from the four lines on the User seat: Data, On click, State, A11y. Write nothing for a line the person left empty — an empty line is not an invitation to guess.`,
    events.length
      ? `The code already fires ${events.join(', ')} — say which of those are real and which we invented.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * What the APP says, appended to the agent, for a provenance repair.
 *
 * The answer is the person's, and it decides a word the registry reads — so the agent is
 * told to place it, not to reason about it, and what to do when it has not arrived. An
 * agent that fills the line itself turns a decision about what we invented into a claim
 * about what the designer did.
 */
function provenanceInstruction(f: RepairFinding): string {
  const where = f.component ? `${f.component}'s` : "the component's";
  return [
    `Mark ${where} registry entry verbatim or inferred exactly as the Provenance line on the User seat says, and invent no marking of your own.`,
    'If that line is still empty the answer has not arrived — say which line is missing and stop.',
  ].join('\n');
}

/** What this check needs, in the check's own terms. */
export function repairNeed(check: string): string {
  return CHECK_NEEDS[check] ?? DEFAULT_CHECK_NEED;
}

/** The need, the lines to fill, and what the app tells the agent, for one finding. */
export function repairMaterialFor(finding: RepairFinding): RepairMaterial {
  const need = repairNeed(finding.check);
  if (finding.check === 'annotation-missing' || finding.check === 'annotation-prose') {
    // Four bare labels for the person, and the app's instruction for the agent beside
    // them: the missing information is the person's to write, and it is not the app's
    // job to guess it — so it does not sit in the User seat at all.
    return { need, fields: annotationFields(), instruction: annotationInstruction(finding) };
  }
  if (finding.check === 'provenance-missing') {
    return { need, fields: fieldsFor(finding), instruction: provenanceInstruction(finding) };
  }
  return { need, fields: fieldsFor(finding) };
}

/**
 * The form as it lands in the textarea: one line per field — `Label:` carrying the
 * field's state in brackets (`Provenance (required):`) — and under it the value lines,
 * where the app has derived them. Four things are load-bearing here:
 *
 *   1. NO LINE IS DECORATED. No `#`, no marker, no hard wrapping mid-sentence; the
 *      box soft-wraps each line to the column.
 *   2. The flags stand on the label line, which the parse already reads line by line,
 *      so `required` and `suggested` cannot describe a state the field is not in.
 *   3. Nothing but those two kinds of line: a label, and the value under it.
 *   4. NOTHING IS ADDRESSED TO THE PERSON. The prompt is what the model reads, so a
 *      sentence here asking a person a question is read by the wrong reader — and by
 *      the person only if they open the box. The question is asked in the chat, with
 *      the answers as buttons (`repairAsk`); a field with no value and no chat ask
 *      would be an empty label, and there is no repair that produces one: every field
 *      that arrives empty is named by an ask, and every field with choices has its
 *      answers on the buttons.
 */
export function renderRepairForm(fields: RepairField[]): string {
  return fields
    .map((f) => {
      const flags = [f.required ? 'required' : '', f.suggestion.length ? 'suggested' : ''].filter(Boolean);
      const label = `${f.label}${flags.length ? ` (${flags.join(', ')})` : ''}:`;
      return [label, ...f.suggestion.map((l) => `  ${l}`)].join('\n');
    })
    .join('\n');
}

/** Every label this module can emit. Parsing stops at anything else. */
const FORM_LABELS = new Set(
  [
    ...ANNOTATION_FIELDS,
    'Provenance',
    'Node id',
    'File',
    'Decision',
    'Container',
    'Listener',
    'Material',
  ].map((l) => l.toLowerCase()),
);
const LABEL_LINE = /^([A-Za-z][A-Za-z0-9 ]{0,20}?)(?:\s*\(([^)]*)\))?\s*:/;

/**
 * Read the form back out of the text.
 *
 * Returns only fields, so the finding's own sentence and the check's fix pass
 * through unnoticed — the same whitelist that keeps the render honest keeps the
 * parse honest. A value may sit on the label line (`Data: role = …`) or under it.
 *
 * `required` and `suggested` are read off the label line's own brackets, where the
 * render puts them — not inferred from anything else in the text.
 *
 * LEGACY, and deliberately still read: a line that is a bracketed `[ type here: … ]`
 * is the app asking, so it is not a value. The current render writes no such line —
 * the question moved into the chat — but packages saved before that change are in the
 * database, and a stale slot must read as an empty field rather than as an answer
 * someone typed. The test is the phrase "type here", not the brackets: a person's own
 * bracketed value (`Data: [open, closed]`) is an answer and reads as one.
 */
const LEGACY_SLOT_LINE = /^\[\s*type here\b[^\]]*\]$/i;

export function formFields(content: string): ParsedRepairField[] {
  const out: ParsedRepairField[] = [];
  let label: string | null = null;
  let sameLine = '';
  let block: string[] = [];
  let required = false;
  let suggested = false;
  const isSlot = (l: string) => LEGACY_SLOT_LINE.test(l.trim());
  const flush = () => {
    if (label === null) return;
    const rest = sameLine.trim();
    const value = [
      ...(rest && !isSlot(rest) ? [rest] : []),
      ...block.map((l) => l.trim()).filter((l) => l && !isSlot(l)),
    ]
      .filter(Boolean)
      .join('\n');
    out.push({ label, required, suggested, empty: !value, value });
    label = null;
    sameLine = '';
    block = [];
    required = false;
    suggested = false;
  };
  for (const line of String(content ?? '').split('\n')) {
    const m = LABEL_LINE.exec(line);
    if (m && FORM_LABELS.has(m[1].trim().toLowerCase())) {
      flush();
      label = m[1].trim();
      sameLine = line.slice(m[0].length);
      block = [];
      const flags = (m[2] ?? '').toLowerCase().split(',').map((s) => s.trim());
      required = flags.includes('required');
      suggested = flags.includes('suggested');
    } else if (label !== null) {
      block.push(line);
    }
  }
  flush();
  return out;
}

/**
 * Write a value under one field's label — the one edit a chat button makes.
 *
 * `content` in, `content` out: the field's own lines are replaced, the label line keeps
 * its name and its `required` flag, and every other line of the seat is left exactly as
 * it was. `null` when this text holds no such field, so the caller can say the write
 * landed nowhere instead of reporting a change that did not happen.
 *
 * `suggested` is dropped from the label line. That flag means "these lines are the app's
 * derivation, check them and press Run"; a value written by a choice is the PERSON'S
 * answer, and leaving the flag would have the section claim the app derived something it
 * was just told.
 */
export function writeFieldValue(content: string, label: string, value: string): string | null {
  const want = String(label ?? '').trim().toLowerCase();
  const lines = String(content ?? '').split('\n');
  const labelAt = (line: string) => {
    const m = LABEL_LINE.exec(line);
    return m && FORM_LABELS.has(m[1].trim().toLowerCase()) ? m : null;
  };
  const at = lines.findIndex((line) => labelAt(line)?.[1].trim().toLowerCase() === want);
  if (at < 0) return null;

  const match = labelAt(lines[at])!;
  let end = at + 1;
  while (end < lines.length && !labelAt(lines[end])) end++;

  const flags = (match[2] ?? '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter((f) => f === 'required');
  const labelLine = `${match[1].trim()}${flags.length ? ` (${flags.join(', ')})` : ''}:`;
  const valueLines = String(value ?? '')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => `  ${l.trim()}`);

  return [...lines.slice(0, at), labelLine, ...valueLines, ...lines.slice(end)].join('\n');
}

export interface RepairPromptFlag {
  kind: 'needs-you' | 'no-values' | 'suggested' | 'none';
  text: string;
}

/**
 * What the section should say about its own prompt, read from the prompt.
 *
 * Three states, and in each the text is a STATE, not an instruction: an empty field
 * marked required is something the person has to answer, the form holds no values at
 * all, or the app's suggestion is standing and the only thing left is the confirmation
 * Run performs. A prompt with no fields is `none`: nothing to say, nothing to flag.
 *
 * The two states that used to instruct — `type your answer where it says [ type here ]`
 * — cannot any more: the ask is a sentence in the chat, next to the buttons that answer
 * it, and a section flag that repeated it would be a second copy of a question with its
 * answers missing.
 */
export function repairPromptFlag(content: string): RepairPromptFlag {
  const fields = formFields(content);
  if (!fields.length) return { kind: 'none', text: '' };
  const missing = fields.filter((f) => f.required && f.empty).map((f) => f.label);
  if (missing.length) return { kind: 'needs-you', text: `Waiting on you: ${missing.join(', ')}` };
  if (!fields.some((f) => !f.empty)) {
    return { kind: 'no-values', text: 'Nothing written yet' };
  }
  if (fields.some((f) => f.suggested)) {
    return { kind: 'suggested', text: 'Suggestion in place — press Run to apply it' };
  }
  return { kind: 'none', text: '' };
}

/**
 * The question the CHAT asks about a repair prompt — the other half of `choices`.
 *
 * A repair field with no value is a hole in the artifact, and the person who can fill it
 * is in the chat, not in the textarea. So the prompt carries the field (`Provenance
 * (required):`) and the chat carries the ask: one plain sentence naming what is still
 * open, and — where the answers are a closed set — one button per answer. Pressing a
 * button writes that answer into the field (`writeFieldValue`), which is the same text
 * the app would have written had it derived the answer itself.
 *
 * `null` when there is nothing to ask: every field carries a value, or the repair needs
 * nothing typed. Nothing is asked about a field that already has an answer, and no
 * second question is asked after the first is answered — the ask is read from the prompt
 * text, so it stops the moment the text stops being open.
 *
 * `seatName` is the section the fields live in, as the column names it, so the sentence
 * points at a seat the person can see.
 */
export interface RepairAsk {
  /** The assistant's sentence: what is still open, in plain words. */
  text: string;
  /** The field labels this ask is about, in the form's own order. */
  fields: string[];
  /** The answers the person can press. Empty when the answer is theirs to say. */
  answers: FiledRepairAnswer[];
}

export function repairAsk(
  finding: RepairFinding,
  seatName = 'User',
  content?: string,
): RepairAsk | null {
  const unfilled = repairMaterialFor(finding).fields.filter((f) => f.suggestion.length === 0);
  // When the seat's own text is handed in, the ask is about what is STILL open in it: a
  // field the person has already answered — by typing, or by pressing a button — is never
  // asked about twice, and a form with nothing left open produces no ask at all. Without
  // the text, the finding's own material is the whole of what is open, which is the state
  // a repair is launched with.
  const answered = content === undefined
    ? null
    : new Set(formFields(content).filter((f) => !f.empty).map((f) => f.label.toLowerCase()));
  const open = answered
    ? unfilled.filter((f) => !answered.has(f.label.toLowerCase()))
    : unfilled;
  if (!open.length) return null;

  const subject = finding.component ? ` for ${finding.component}` : '';
  const closed = open.filter((f) => f.choices?.length);
  const spoken = open.filter((f) => !f.choices?.length);
  const list = (fields: RepairField[]) => fields.map((f) => f.label).join(', ');

  const sentences: string[] = [];
  if (closed.length === 1 && open.length === 1) {
    sentences.push(
      `The repair${subject} needs one answer from you, in the ${seatName} section: ${list(closed)}.`,
    );
  } else if (closed.length) {
    sentences.push(
      `The repair${subject} needs answers from you, in the ${seatName} section: ${list(closed)}.`,
    );
  }
  if (spoken.length === 1) {
    sentences.push(
      `One line in that section is yours to write — ${list(spoken)}. Tell me it here and I will write it in.`,
    );
  } else if (spoken.length > 1) {
    sentences.push(
      `${spoken.length} lines in that section are yours to write — ${list(spoken)}. ` +
        'Tell me them here and I will write them in.',
    );
  }

  return {
    text: sentences.join(' '),
    fields: open.map((f) => f.label),
    answers: closed.flatMap((f) => (f.choices ?? []).map((c) => ({ ...c, field: f.label }))),
  };
}

/**
 * What each annotation line is FOR — the designer's own guide,
 * catalog-audit/FIGMA/ANNOTATION_FIGMA_GUIDE.md §"Field-by-field".
 */
const ANNOTATION_LINE_MEANING: Record<string, string> = {
  'Data': 'what this component binds to (e.g. workspace.activeItem.role)',
  'On click': 'the event fired and its payload (e.g. dispatch role-select { role: <tile label> })',
  'State': "the variant's state (e.g. open / closed)",
  'A11y': 'accessibility role, and where the label comes from (e.g. role="menu")',
};

/**
 * The repair, described to the model that GUIDES the person — not to the repair
 * model. Carried as surface context `repair_brief`; never written into the repair
 * prompt itself.
 */
export function repairBrief(
  finding: RepairFinding,
  seatName = 'User',
  content?: string,
): string[] {
  const material = repairMaterialFor(finding);
  const bare = material.fields.filter((f) => (f.suggestion ?? []).length === 0).map((f) => f.label);
  const lines: string[] = [
    '=== REPAIR OPEN — WHAT THE PERSON IN FRONT OF IT IS MISSING ===',
    (finding.component ? finding.component + ' — ' : '') + finding.check,
  ];
  if (bare.length) {
    lines.push('LINES THEY HAVE TO WRITE — the app has no true value to offer for these:');
    for (const label of bare) {
      const meaning = ANNOTATION_LINE_MEANING[label] || '';
      lines.push(meaning ? label + ' — ' + meaning : label);
    }
    lines.push('The form shows these labels BARE, so what they mean reaches the person only if you say it. Say what each line you ask for is FOR, in these words. Invent no meaning of your own, and do not fill one in for them.');
  } else {
    lines.push('Nothing is left to write — every line the form asks for is already answered.');
  }
  return lines;
}
