/**
 * The left column's section vocabulary, declared once.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * A prompt row's `type` is written in FOUR places, with four spellings, and
 * nothing compares them:
 *
 *   1. THE SCHEMA — enforced, loaded at startup, exits 1 if it fails.
 *        `system-role · user-role · tool-call · few-shot · constraints`
 *        tag-registry.ts:47 (PromptSectionSchema) and the `type` enum in
 *        A2UI/catalogs/prompt-composer/catalog.json (also ecommerce).
 *   2. THE EDITOR — the value actually stored in `_sections[].type`:
 *        'system' | 'user' | 'agent' | 'tool-call' | 'custom-data'
 *        | 'custom'   (prompt-section-editor.ts:248, "Add Section")
 *        | roleName   (:306, the section NAME written into `type` — any string)
 *   3. THE LABELS — TYPE_LABELS: ten keys for eight ideas.
 *   4. THE RUN — CORE_ROLES (WritingAreaIndex.tsx:2656): ten DISPLAY STRINGS.
 *        It matches on `name`, and the save path overwrites `type` with `name`
 *        (:783 `type: s.name as PromptSection['type']`), so what persists — and
 *        what the server keys `core_roles` on — is a presentation string.
 *
 * The left column ships five seats. FOUR are now declared in the schema —
 * `system-role`, `user-role`, `agent-role`, `tool-call` — and one is not:
 * `custom-data`, which is attached material rather than a role. The schema also
 * declares two seats that nothing ships: `few-shot` and `constraints`.
 *
 * `agent-role` was ADDED to the enum, because it is the most-used role in the
 * product and the schema had no seat for it. The schema was behind the product,
 * not the other way round.
 *
 * And of the shared seats, only `tool-call` was originally WRITTEN in the
 * canonical spelling; the editor wrote 'system', 'user' and 'agent'
 * (prompt-section-editor.ts:161-163). So a value-level comparison against the
 * enum matched ONE of five, while a seat-level comparison, after normalising,
 * matched THREE. Two different numbers — and quoting the wrong one is how the
 * mismatch went unnoticed.
 *
 * Nothing has broken, because sections reach the server as free-form JSON —
 * `context: JSON.stringify({ core_roles, custom_roles })` (WritingAreaIndex:2669)
 * — and teacher.py:223 merely json.loads()es it. The enum never gates that path.
 *
 * WHAT THIS FILE DOES
 * ───────────────────
 * Declares the seats once, names the disagreement, and normalises what can be
 * normalised WITHOUT inventing a mapping nobody has decided. Readings that
 * cannot be settled from the code live in UNDECIDED rather than being guessed.
 *
 * A diagram shape keys off `id` — a stable canonical string. Never off a label:
 * a label is presentation and may be renamed by the user.
 */

/**
 * The values the schema enum accepts.
 *
 * `agent-role` was added because the enum had no seat for the most-used role in
 * the product. This is NOT a hand-copy any more: src/test/promptSections.test.ts
 * reads the live `PromptSectionSchema` and asserts this list equals its options,
 * so the two cannot drift apart again.
 *
 * Four places carry this enum and all four were updated together:
 *   tag-registry.ts:47   (the zod schema — enforced)
 *   tag-registry.ts:686  (TAG_REGISTRY's descriptor)
 *   catalogs/prompt-composer/catalog.json
 *   catalogs/ecommerce/catalog.json
 */
export const SCHEMA_SECTION_TYPES = [
  'system-role',
  'user-role',
  'agent-role',
  'tool-call',
  'few-shot',
  'constraints',
  // Added when Context became a seat the menu offers. It was fillable through
  // <update_context> but was not in this enum, so it was a seat the schema would
  // not admit to — the row below it in SECTION_TYPES has said inSchema: false
  // since it was written, and that stopped being true when it gained a tile.
  'context',
] as const;

export type SchemaSectionType = (typeof SCHEMA_SECTION_TYPES)[number];

export interface SectionTypeDef {
  /** Canonical, stable. This is what a diagram shape keys off. */
  id: string;
  /** What a person reads on the row. Renameable presentation. */
  label: string;
  /**
   * WHAT THIS SEAT IS FOR, in plain words, for someone who has never been taught
   * the vocabulary. It is shown when a person hovers a tile in the seat menu and
   * again in the chat when they pick one, so it has to make sense to somebody who
   * does not know what a prompt is.
   *
   * It says what the seat is for and why it matters. It does not describe the
   * field or the mechanics — a definition of the word is not a reason to use it.
   */
  description: string;
  /** Present in the enforced schema enum? */
  inSchema: boolean;
  /** Offered by the left column's role menu (SECTION_MENU_TYPES)? */
  inMenu: boolean;
  /** Slot 0: no menu, not draggable, not deletable. */
  sticky?: boolean;
  /** On Run this goes to core_roles, not custom_roles. */
  core: boolean;
  /** Alt spellings that may arrive as a section NAME (the repair flow uses these). */
  legacyNames?: string[];
  /** Where the value comes from, so the next reader does not have to grep. */
  source: string;
}

/**
 * Every seat the system knows about, shipped or only declared.
 *
 * `inSchema` is a fact about the enum, not a wish. Two of these eight are false
 * today — `custom-data` and `context` — and they are false on purpose: neither is
 * a role, and the enum is not the gate they pass through. Before `agent-role` was
 * added, four were false, and that was not on purpose.
 */
export const SECTION_TYPES: SectionTypeDef[] = [
  {
    id: 'system-role', label: 'System Role', inSchema: true, inMenu: false,
    sticky: true, core: true, legacyNames: ['System'],
    description:
      'The standing instruction. Who the assistant is and how it should behave, ' +
      'said once and read on every request. This is the first thing it is told and ' +
      'it applies to everything that follows — which is why it sits at the top and ' +
      'cannot be moved or removed.',
    source: 'sticky, no menu (prompt-input-section.ts:29); default row (prompt-section-editor.ts:155)',
  },
  {
    id: 'user-role', label: 'User Role', inSchema: true, inMenu: true,
    core: true, legacyNames: ['User'],
    description:
      'What the person asks for, or the material they bring. Write it the way it ' +
      'would arrive in real use — the question, the record, the pasted data — so the ' +
      'assistant is prepared for the actual input rather than an ideal version of it.',
    source: 'SECTION_MENU_TYPES; repair writes name "User" (WritingAreaIndex:1350)',
  },
  {
    id: 'agent-role', label: 'Agent Role', inSchema: true, inMenu: true,
    core: true, legacyNames: ['Agent'],
    description:
      'What the assistant does with the request: the work, the order it happens in, ' +
      'and what it hands back. Most prompts put their real instruction here. If the ' +
      'System Role says who it is, this is what it is being asked to do.',
    source: 'SECTION_MENU_TYPES. Added to the schema enum — it had no seat, though it is the most-used role in the product',
  },
  {
    id: 'tool-call', label: 'Tool Call', inSchema: true, inMenu: true,
    core: true,
    description:
      'Where the work reaches outside itself — a lookup, a service, a file. A tool ' +
      'inserted here writes its own words into this seat, so you can read what will ' +
      'be sent and change it before anything runs.',
    source: 'SECTION_MENU_TYPES; the only seat that was ALWAYS shared, and the only one originally spelled canonically',
  },
  {
    id: 'custom-data', label: 'Custom Skill', inSchema: false, inMenu: true,
    core: false,
    description:
      'A procedure of your own. Where a person writes down how something should be ' +
      'done — the steps, the rules, the order — and keeps it as a skill the system ' +
      'can follow later, rather than typing it again each time.',
    // THE LABEL MOVED; THE ID DID NOT. The id is the identity and does not
    // change — anything already stored as `custom-data` still resolves here.
    // What changed is what a person reads: the seat is where someone writes a
    // procedure of their own, and "Custom Data" said the opposite of that.
    source: 'SECTION_MENU_TYPES — the schema enum has NO custom-data seat',
  },
  {
    id: 'few-shot', label: 'Few Shot', inSchema: true, inMenu: true,
    core: true,
    description:
      'Worked examples. Show two or three pairs of a question and the answer it ' +
      'should have produced, and the assistant copies their shape instead of ' +
      'guessing at it. Showing an answer teaches a format far better than ' +
      'describing one.',
    // OFFERED NOW, AND IT ALWAYS COULD BE FILLED. The chat's write tags have
    // carried <update_few_shot> all along (grace_gui.py), so the model could put
    // words here while a person had no way to make the seat. A seat the model can
    // fill and a person cannot is half a feature.
    source: 'SECTION_MENU_TYPES. Was schema-only: declared, never given a tile',
  },
  {
    id: 'constraints', label: 'Constraints', inSchema: true, inMenu: true,
    core: true,
    description:
      'The rules that must not be broken — what it must never say, never assume, ' +
      'never leave out. Kept apart from the instruction on purpose, so a limit can ' +
      'be tightened without rewriting the brief that explains the work.',
    source: 'SECTION_MENU_TYPES. Was schema-only: declared, never given a tile',
  },
  {
    id: 'context', label: 'Context', inSchema: true, inMenu: true,
    core: true,
    description:
      'The facts it needs and does not have. Design rules, a specification, ' +
      'anything retrieved and pasted in — the material the work depends on, kept ' +
      'separate from the instruction so it can be swapped without touching it.',
    source: 'TYPE_LABELS:50; the 145px RAG row (prompt-section-editor.ts:371)',
  },
];

/** Off-vocabulary inputs that map cleanly. Safe: pure spelling. */
export const LEGACY_TYPE_ALIASES: Record<string, string> = {
  system: 'system-role',
  user: 'user-role',
  agent: 'agent-role',
  assistant: 'agent-role',
  few_shot: 'few-shot',
  'few shot': 'few-shot',
  tool_call: 'tool-call',
  custom_data: 'custom-data',
  // The seat's LABEL was renamed from "Custom Data" to "Custom Skill" and the id
  // was not, so a section already on disk under the old display name must still
  // find its home. This is the alias that keeps that true.
  'custom data': 'custom-data',
};

/**
 * Readings that CANNOT be decided from the code. Listed, never guessed.
 *
 * Anything here that also reaches a diagram is a reason not to draw yet.
 */
export const UNDECIDED: Array<{ value: string; seenAt: string; why: string; decided?: string }> = [
  {
    value: 'custom',
    seenAt: 'prompt-section-editor.ts:248 ("Add Section")',
    why: 'The menu tile is "Custom Data" (custom-data); Add Section creates "Custom Role N" with type "custom". Whether a free-form extra row is the same seat is a product decision, not a rename.',
    decided: '2026-09-23 — YES, and it is a row like any other. The owner, on the assistant being unable to add one: "she should be able to insert a section right into the prompt… I can do it by going to custom… it creates the role and then I have to change the name." So a write to a name with no declared seat makes a row with type custom and that name (prompt-section-editor `_seatFor`), which is exactly the row the person\'s own path makes. It is NOT a declared seat: a diagram still cannot name its kind, and agentFlow draws it as an unresolved seat rather than refusing it — the same treatment the person\'s own Custom row already gets.',
  },
  {
    value: '<any string>',
    seenAt: 'prompt-section-editor.ts:306 (_onAddRole)',
    why: 'An AI-driven add-role writes the section NAME into `type`. A row named "Hero Specs" is stored with type "Hero Specs". Until this is narrowed, `type` cannot be trusted as an id — and a diagram keyed on it would draw rows it cannot name.',
  },
];

/**
 * One comparison, three readers.
 *
 * The lookup used to be written out once here and once in isUndecidedType, and
 * a strict reader would have made a third copy. Three copies of the same
 * comparison is precisely how the four vocabularies drifted in the first place.
 * There is one comparison now; the readers differ only in what they do with its
 * ANSWER.
 */
type SectionTypeResolution =
  | { kind: 'empty' }
  | { kind: 'seat'; id: string; how: 'alias' | 'id' | 'label' }
  | { kind: 'undecided'; raw: string };

function resolveSectionType(raw: unknown): SectionTypeResolution {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return { kind: 'empty' };
  /*
   * THE SEPARATOR IS NOT PART OF THE NAME.
   *
   * `agent_role` and `agent role` and `agent-role` are one seat written three ways, and only the
   * third was understood. The alias table below had grown entries for exactly this reason —
   * `tool_call`, `few_shot`, `custom_data` were each added by hand when one came up — and the two
   * nobody had hit yet were `agent_role` and `user_role`. Measured 2026-09-23: her button said
   * `write-seat:agent_role|…`, the name resolved to nothing, and the write MADE A NEW ROW called
   * `agent_role` beside the Agent Role seat. The owner, watching it: "she added an additional
   * agent role with an underscore instead of using the existing one."
   *
   * So the comparison happens on a form where spaces and underscores are hyphens, and the aliases
   * that remain in the table are the ones that are genuinely DIFFERENT WORDS (`system` for
   * `system-role`, `assistant` for `agent-role`) rather than one word spelled differently.
   */
  const sep = s.replace(/[\s_]+/g, '-');
  const alias = LEGACY_TYPE_ALIASES[s] ?? LEGACY_TYPE_ALIASES[sep];
  if (alias) return { kind: 'seat', id: alias, how: 'alias' };
  if (SECTION_TYPES.some((t) => t.id === sep)) return { kind: 'seat', id: sep, how: 'id' };
  const byLabel = SECTION_TYPES.find((t) => t.label.toLowerCase().replace(/[\s_]+/g, '-') === sep);
  if (byLabel) return { kind: 'seat', id: byLabel.id, how: 'label' };
  return { kind: 'undecided', raw: s };
}

/**
 * The LENIENT reader — for data that is already on disk.
 *
 * Decidable readings are normalised. Undecidable ones are PRESERVED — returned
 * unchanged rather than given a home nobody agreed to.
 *
 * The ONE substitution it makes is `empty → 'custom'`, and it is named here
 * rather than buried in a `||`: a row that arrives with no type is silently
 * labelled Custom instead of failing. That IS a fallback. It is pre-existing
 * (prompt-section-editor.ts:136: `s.type || s.role || 'custom'` before this
 * module existed) and it is kept only because rewiring the load path is a
 * separate decision — see strictSectionType() for the reader that refuses.
 */
export function normalizeSectionType(raw: unknown): string {
  const r = resolveSectionType(raw);
  if (r.kind === 'seat') return r.id;
  if (r.kind === 'undecided') return r.raw; // preserved, never guessed
  return 'custom'; // the one fallback — see the note above
}

/** True when a value has no canonical seat yet (see UNDECIDED). */
export function isUndecidedType(raw: unknown): boolean {
  return resolveSectionType(raw).kind === 'undecided';
}

/**
 * The STRICT reader — refuses rather than substitutes.
 *
 * For any NEW path. It returns a canonical id when the value has a decided
 * seat, and THROWS for everything else: an empty type, an unknown value, or one
 * of the UNDECIDED ones. There is no third outcome and no default.
 *
 * `where` is REQUIRED, so the failure names its caller. A stack trace with no
 * label is where a substitution goes to hide.
 *
 * Legacy spellings are not an error: `system`, `user`, `agent`, `assistant` are
 * settled renames (LEGACY_TYPE_ALIASES), so they resolve. What throws is a value
 * whose home nobody has decided — including `'custom'`.
 *
 * The load path deliberately still uses the lenient reader. Switching it is a
 * one-symbol change per site, and it should be a decision, not a side effect.
 */
export function strictSectionType(raw: unknown, where: string): string {
  const r = resolveSectionType(raw);
  if (r.kind === 'seat') return r.id;
  if (r.kind === 'empty') {
    throw new Error(
      `[promptSections] ${where}: a section arrived with no type. Refusing to ` +
        `substitute 'custom' — a row with no seat is a malformed row, not a Custom row.`,
    );
  }
  throw new Error(
    `[promptSections] ${where}: "${r.raw}" has no seat in the section vocabulary. ` +
      `It is listed in UNDECIDED (shared/promptSections.ts) — decide what it is and add ` +
      `it to SECTION_TYPES, or stop sending it. Refusing to guess.`,
  );
}

/** id → label, plus the legacy spellings, so no existing lookup breaks. */
export const SECTION_TYPE_LABELS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const t of SECTION_TYPES) m[t.id] = t.label;
  for (const [alias, id] of Object.entries(LEGACY_TYPE_ALIASES)) {
    const def = SECTION_TYPES.find((t) => t.id === id);
    if (def) m[alias] = def.label;
  }
  m.custom = 'Custom';
  return m;
})();

/** The role tiles the menu offers: shipped and not sticky. System has no menu. */
export const SECTION_MENU_TYPES: Array<{ type: string; label: string; description: string }> =
  SECTION_TYPES.filter((t) => t.inMenu && !t.sticky).map((t) => ({
    type: t.id,
    label: t.label,
    description: t.description,
  }));

/**
 * The display strings the Run path must treat as core roles.
 *
 * Derived, not typed twice: a seat added to SECTION_TYPES with `core: true`
 * can no longer be silently dropped into custom_roles by a list nobody updated.
 *
 * Reproduces the literal it replaces (WritingAreaIndex.tsx:2656) exactly —
 * every core label, plus the short names the repair flow writes. Asserted in
 * src/test/promptSections.test.ts.
 */
export const CORE_ROLE_LABELS: string[] = [
  ...SECTION_TYPES.filter((t) => t.core).map((t) => t.label),
  ...SECTION_TYPES.filter((t) => t.core).flatMap((t) => t.legacyNames ?? []),
];

/** Seats the schema declares that the left column has no tile for. */
export const DECLARED_BUT_UNSHIPPED: string[] = SECTION_TYPES.filter(
  (t) => t.inSchema && !t.inMenu && !t.sticky,
).map((t) => t.id);

/** Seats the left column ships that the schema enum does not know. */
export const SHIPPED_BUT_UNDECLARED: string[] = SECTION_TYPES.filter(
  (t) => t.inMenu && !t.inSchema,
).map((t) => t.id);

/**
 * Every spelling by which a WRITE can name one seat: the canonical label, the id, and
 * the short names the repair flow writes (`System`, `User`, `Agent`).
 *
 * `SECTION_TYPES` already carries those short names as `legacyNames`, because the
 * repair path writes them; this is the same list, read from the same declaration, for
 * the direction the write travels in.
 */
export function sectionNameVariants(requested: string): string[] {
  const raw = String(requested ?? '').trim().toLowerCase();
  if (!raw) return [];
  const out = [raw];
  const resolved = resolveSectionType(requested);
  if (resolved.kind === 'seat') {
    const def = SECTION_TYPES.find((t) => t.id === resolved.id);
    if (def) {
      for (const name of [def.label, def.id, ...(def.legacyNames ?? [])]) {
        const low = name.toLowerCase();
        if (!out.includes(low)) out.push(low);
      }
    }
  }
  return out;
}

/**
 * Which of `names` the requested seat IS — the index, or -1 when this column holds no
 * such seat.
 *
 * Why this exists. Two writers put text into the left column — the window events
 * `set-left-column-text` / `force-set-section`, and the AI's `<update_*>` tags — and
 * both used to compare the requested name to each section's name EXACTLY. A repair
 * prompt names its seats `System` / `User` / `Tool Call` / `Agent`; a composer names
 * them `System Role` / `User Role` / `Tool Call` / `Agent Role`. So "write the User
 * Role" against a repair prompt matched nothing, fell through, and the write vanished
 * with no error anywhere — the failure mode that makes a surface feel uncontrollable.
 *
 * The requested name wins if it is literally present, so an exact match can never be
 * displaced by a variant. Beyond that the spellings are the ones this file already
 * declares: the label, the id, and the legacy short names.
 *
 * A seat this column does not have stays UNRESOLVED — `Constraints` in a repair
 * prompt is not a `User`, and guessing would write a value into a seat nobody named.
 * The caller reports the miss (prompt-section-editor dispatches `section-write-failed`).
 */
export function resolveSectionName(requested: string, names: string[]): number {
  const want = sectionNameVariants(requested);
  if (!want.length) return -1;
  const have = (names ?? []).map((n) => String(n ?? '').trim().toLowerCase());
  for (const spelling of want) {
    const idx = have.indexOf(spelling);
    if (idx !== -1) return idx;
  }
  return -1;
}
