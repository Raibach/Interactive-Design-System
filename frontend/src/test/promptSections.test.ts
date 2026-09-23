/**
 * The left column's vocabulary, pinned.
 *
 * The old arrangement had no test, and four spellings of the same idea. What is
 * pinned here is not the spelling — it is the AGREEMENT between the two authors
 * that were never compared: the schema enum and the UI's seats.
 *
 *   Originally they agreed on ONE value. `agent-role` had no seat in the enum at
 *   all, though it is the most-used role in the product. After the fix:
 *
 *     declared + shipped:   system-role · user-role · agent-role · tool-call
 *     shipped, not a role:  custom-data   (attached material)
 *     declared, no tile:    few-shot · constraints
 *
 *   The drift tests at the bottom read the LIVE `PromptSectionSchema` instead of
 *   trusting a copy — a copy is what drifted in the first place.
 *
 * And what is pinned hardest is the Run path. `CORE_ROLE_LABELS` replaces a
 * hand-typed list at WritingAreaIndex.tsx:2656 that decides whether a section
 * reaches the model as a core role or is dumped into custom_roles. Deriving it
 * from one declaration means a new seat cannot be silently dropped by a list
 * nobody remembered to update — and this test is what proves the derivation
 * still reproduces the literal it replaced.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SECTION_TYPES,
  SECTION_MENU_TYPES,
  SECTION_TYPE_LABELS,
  CORE_ROLE_LABELS,
  SCHEMA_SECTION_TYPES,
  DECLARED_BUT_UNSHIPPED,
  SHIPPED_BUT_UNDECLARED,
  LEGACY_TYPE_ALIASES,
  UNDECIDED,
  normalizeSectionType,
  isUndecidedType,
  strictSectionType,
  resolveSectionName,
} from '@/shared/promptSections';
import { PromptSectionSchema, TAG_REGISTRY } from '@/shared/tag-registry';

/**
 * Remarks stripped before a pattern scan.
 *
 * Necessary because the honest place to WRITE ABOUT a fallback is a comment —
 * `promptSections.ts` names its own `|| 'custom'` in prose precisely so it is
 * not hidden. A scan that counted the quotation would punish the documentation
 * and reward the silence. Heuristic, and it errs toward reading code only: a
 * string literal containing `//` before a match would be truncated. There is no
 * such literal today.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** frontend/src — the root of the fallback scan at the bottom of this file. */
const SRC = dirname(dirname(fileURLToPath(import.meta.url)));

/** Every .ts/.tsx under src, minus this directory (tests are not app code). */
function sourceFiles(dir: string = SRC): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === 'node_modules') continue;
      out.push(...sourceFiles(p));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
  return out;
}

/** Verbatim from WritingAreaIndex.tsx:2656. Do not tidy this. */
const CORE_ROLES_AS_TYPED = [
  'System Role', 'User Role', 'Agent Role', 'System', 'User', 'Agent',
  'Context', 'Constraints', 'Few Shot', 'Tool Call',
];

describe('the vocabulary it replaces', () => {
  it('reproduces CORE_ROLES exactly — same strings, no extras, none missing', () => {
    expect(new Set(CORE_ROLE_LABELS)).toEqual(new Set(CORE_ROLES_AS_TYPED));
    expect(CORE_ROLE_LABELS).toHaveLength(CORE_ROLES_AS_TYPED.length);
  });

  it('reproduces the menu tiles the user actually sees, with a description each', () => {
    // System Role is absent because it is sticky — always the first row, no menu.
    // Few Shot, Constraints and Context are here because they are offered now
    // rather than only declared, and Custom Data wears the label "Custom Skill".
    expect(SECTION_MENU_TYPES.map((m) => ({ type: m.type, label: m.label }))).toEqual([
      { type: 'user-role', label: 'User Role' },
      { type: 'agent-role', label: 'Agent Role' },
      { type: 'tool-call', label: 'Tool Call' },
      { type: 'custom-data', label: 'Custom Skill' },
      { type: 'few-shot', label: 'Few Shot' },
      { type: 'constraints', label: 'Constraints' },
      { type: 'context', label: 'Context' },
    ]);
  });

  it('gives every tile a description a person could act on', () => {
    // The tile's fly-out and the chat's reply are the SAME sentence, so an empty
    // one is a seat nobody can be told about. Length is the only mechanical
    // check available; the rest is read by a person.
    for (const tile of SECTION_MENU_TYPES) {
      expect(tile.description.length, tile.type).toBeGreaterThan(80);
    }
  });

  it('keeps every label TYPE_LABELS already served', () => {
    // The ten keys the editor looked up, none of them dropped.
    for (const key of ['system', 'user', 'agent', 'assistant', 'tool-call',
      'custom-data', 'few-shot', 'context', 'constraints', 'custom']) {
      expect(SECTION_TYPE_LABELS[key], `missing label for "${key}"`).toBeTruthy();
    }
    expect(SECTION_TYPE_LABELS.assistant).toBe('Agent Role');
  });
});

describe('the two authors disagree on exactly one seat, and that is on the record', () => {
  it('leaves no seat the schema declares without a tile', () => {
    // Few Shot, Constraints and Context were declared and unshipped. The chat
    // could write to all three — its own tags carry <update_few_shot>,
    // <update_constraints> and <update_context> — while a person had no way to
    // create the seat. They are offered now, so the gap is empty.
    expect(DECLARED_BUT_UNSHIPPED).toEqual([]);
  });

  it('leaves exactly ONE shipped seat undeclared: custom-data', () => {
    expect(SHIPPED_BUT_UNDECLARED).toEqual(['custom-data']);
  });

  it('shares SEVEN seats once spelling is normalised — it was one', () => {
    const shared = SECTION_TYPES
      .filter((t) => t.inSchema && (t.inMenu || t.sticky))
      .map((t) => t.id);
    expect(shared).toEqual([
      'system-role', 'user-role', 'agent-role', 'tool-call',
      'few-shot', 'constraints', 'context',
    ]);
  });

  it('shares SIX in the menu — System is sticky and has no menu', () => {
    const shared = SECTION_TYPES
      .filter((t) => t.inSchema && t.inMenu)
      .map((t) => t.id);
    expect(shared).toEqual([
      'user-role', 'agent-role', 'tool-call', 'few-shot', 'constraints', 'context',
    ]);
  });

  it('matches the enum at VALUE level only once — and that is why it hid', () => {
    // The literal values the editor writes today: the defaults
    // (prompt-section-editor.ts:155-157), the menu tiles, `custom` (:248).
    // Only one of the five looked like the enum, so a spot-check passed.
    const writtenToday = ['system', 'user', 'agent', 'tool-call', 'custom-data'];
    const matching = writtenToday.filter((v) =>
      (SCHEMA_SECTION_TYPES as readonly string[]).includes(v));
    expect(matching).toEqual(['tool-call']);
  });

  it('records agent-role as declared AND shipped — the gap is closed', () => {
    const agent = SECTION_TYPES.find((t) => t.id === 'agent-role');
    expect(agent).toBeDefined();
    expect(agent!.inMenu).toBe(true);
    expect(agent!.inSchema).toBe(true);
    expect(agent!.core).toBe(true);
  });
});

describe('normalising what can be decided', () => {
  it('maps every legacy spelling to its canonical id', () => {
    expect(normalizeSectionType('system')).toBe('system-role');
    expect(normalizeSectionType('user')).toBe('user-role');
    expect(normalizeSectionType('agent')).toBe('agent-role');
    expect(normalizeSectionType('assistant')).toBe('agent-role');
  });

  it('accepts a canonical id unchanged', () => {
    expect(normalizeSectionType('tool-call')).toBe('tool-call');
  });

  it('accepts a display label and returns the id', () => {
    expect(normalizeSectionType('System Role')).toBe('system-role');
    expect(normalizeSectionType('Custom Skill')).toBe('custom-data');
  });

  it('still resolves the label the seat wore before it was renamed', () => {
    // The id never changed, so a section already on disk under "Custom Data"
    // must still find its home. Renaming a label is free; orphaning stored rows
    // is not.
    expect(normalizeSectionType('Custom Data')).toBe('custom-data');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(normalizeSectionType('  SYSTEM  ')).toBe('system-role');
    expect(normalizeSectionType('Few Shot')).toBe('few-shot');
  });

  it('substitutes custom for an empty type — the ONE fallback, named not hidden', () => {
    // This is pinned as a fallback, not presented as correct behaviour: a row
    // with no type is silently labelled Custom instead of failing. The lenient
    // reader is for data already on disk. Anything NEW calls strictSectionType(),
    // which refuses this input outright.
    expect(normalizeSectionType(undefined)).toBe('custom');
    expect(normalizeSectionType(null)).toBe('custom');
    expect(normalizeSectionType('')).toBe('custom');
  });
});

describe('preserving what cannot be decided', () => {
  it('returns an unknown value unchanged instead of guessing a home for it', () => {
    // _onAddRole writes the section NAME into `type` (prompt-section-editor.ts:306).
    expect(normalizeSectionType('Hero Specs')).toBe('hero specs');
    expect(isUndecidedType('Hero Specs')).toBe(true);
  });

  it('does not claim "custom" has a seat — it is listed as undecided', () => {
    expect(isUndecidedType('custom')).toBe(true);
    expect(UNDECIDED.some((u) => u.value === 'custom')).toBe(true);
  });

  it('every UNDECIDED entry names where it was seen and why it is open', () => {
    for (const u of UNDECIDED) {
      expect(u.seenAt).toMatch(/\.tsx?:\d+/);
      expect(u.why.length).toBeGreaterThan(60);
    }
  });

  it('a decided value is never reported as undecided', () => {
    for (const alias of Object.keys(LEGACY_TYPE_ALIASES)) {
      expect(isUndecidedType(alias), alias).toBe(false);
    }
    for (const t of SECTION_TYPES) {
      expect(isUndecidedType(t.id), t.id).toBe(false);
      expect(isUndecidedType(t.label), t.label).toBe(false);
    }
  });
});

describe('the declaration itself', () => {
  it('copies the schema enum verbatim', () => {
    expect(SCHEMA_SECTION_TYPES).toEqual([
      'system-role', 'user-role', 'agent-role', 'tool-call', 'few-shot', 'constraints', 'context',
    ]);
  });

  it('declares exactly one sticky seat, and it is System Role', () => {
    const sticky = SECTION_TYPES.filter((t) => t.sticky).map((t) => t.id);
    expect(sticky).toEqual(['system-role']);
  });

  it('excludes Custom Data from core roles, as the literal did', () => {
    expect(CORE_ROLE_LABELS).not.toContain('Custom Data');
  });

  it('gives every seat a source, so the next reader need not grep', () => {
    for (const t of SECTION_TYPES) {
      expect(t.source.length, t.id).toBeGreaterThan(10);
    }
  });

  it('has unique ids', () => {
    const ids = SECTION_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * The two readers, side by side.
 *
 * The lenient one exists so data already on disk keeps rendering. The strict one
 * exists so NEW code cannot inherit a substitution it never asked for. Pinning
 * both here is the point: a change that makes the strict reader lenient — the
 * easy mistake — fails immediately.
 */
describe('the strict reader — refuses instead of substituting', () => {
  it('returns a canonical id for every seat we declare', () => {
    for (const t of SECTION_TYPES) {
      expect(strictSectionType(t.id, 'test'), t.id).toBe(t.id);
      expect(strictSectionType(t.label, 'test'), t.label).toBe(t.id);
    }
  });

  it('resolves a legacy spelling — a settled rename is not an error', () => {
    for (const [alias, id] of Object.entries(LEGACY_TYPE_ALIASES)) {
      expect(strictSectionType(alias, 'test'), alias).toBe(id);
    }
  });

  it('throws for an empty type rather than calling the row Custom', () => {
    for (const empty of [undefined, null, '', '   ']) {
      expect(() => strictSectionType(empty, 'test'), String(empty)).toThrow(/no type/);
    }
  });

  it('throws for a value listed in UNDECIDED', () => {
    expect(() => strictSectionType('custom', 'test')).toThrow(/no seat/);
  });

  it('throws for a free-form rename rather than inventing a seat', () => {
    expect(() => strictSectionType('Hero Specs', 'test')).toThrow(/no seat/);
  });

  it('names its caller — the reason `where` is required', () => {
    expect(() => strictSectionType('custom', 'prompt-section-editor.ts:_normalizeSection'))
      .toThrow(/prompt-section-editor\.ts:_normalizeSection/);
  });

  it('reports the offending value verbatim, so the fix needs no debugger', () => {
    expect(() => strictSectionType('Hero Specs', 'test')).toThrow(/"hero specs"/);
  });

  it('never returns a value that has no seat — no input reaches a silent default', () => {
    // If any of these stopped throwing, `custom` would be a de-facto seat again.
    for (const bad of ['custom', 'Hero Specs', '', undefined, null]) {
      expect(() => strictSectionType(bad, 'test'), String(bad)).toThrow();
    }
  });
});

describe('the silent fallbacks that still exist, pinned by count', () => {
  /**
   * A `|| 'custom'` is a substitution: the row renders as Custom and nothing
   * says the data was malformed. These are the sites that still do it. They are
   * listed rather than fixed because they sit on the load path for data already
   * on disk; changing them is a decision, not a tidy-up.
   *
   * The counts are pinned so a NEW one cannot appear without this test failing
   * and the site being added here on purpose. The direction of travel is DOWN:
   * when a site is moved onto strictSectionType(), lower its number.
   */
  const EXPECTED_FALLBACK_SITES: Record<string, number> = {
    'components/lit/prompt-input/prompt-input-section.ts': 1,
    'components/lit/prompt-section-editor.ts': 2,
    // 3 → 2 on 2026-09-17: the composer's host JSX was removed from this file.
    // It parsed the package's left column itself, substituting `|| 'custom'` per
    // section type; the assembled surface binds `sections` instead.
    'pages/WritingAreaIndex.tsx': 2,
  };

  it('are exactly the sites recorded here — none added, none silently removed', () => {
    const found: Record<string, number> = {};
    for (const file of sourceFiles()) {
      const code = stripComments(readFileSync(file, 'utf8'));
      const hits = [...code.matchAll(/\|\|\s*['"]custom['"]/g)].length;
      if (hits) found[relative(SRC, file).replaceAll('\\', '/')] = hits;
    }
    expect(found).toEqual(EXPECTED_FALLBACK_SITES);
  });

  it('the vocabulary module holds none — it names its fallback in prose instead', () => {
    const text = readFileSync(join(SRC, 'shared', 'promptSections.ts'), 'utf8');
    expect(stripComments(text)).not.toMatch(/\|\|\s*['"]custom['"]/);
    // Stripped from a SCAN, not from the file: the fallback is still named in
    // prose, which is the whole point — a reader must not have to infer it.
    expect(text).toMatch(/the one fallback/);
  });

  it('and the undecided-value guard has a caller path — it is exported, not decoration', () => {
    // isUndecidedType had no production caller when it was written. It is still
    // the guard for the undecided set, and it now shares one resolver with the
    // strict reader rather than repeating the comparison a second time.
    for (const u of UNDECIDED) {
      const value = u.value === '<any string>' ? 'Hero Specs' : u.value;
      expect(isUndecidedType(value), value).toBe(true);
      expect(() => strictSectionType(value, 'test'), value).toThrow();
    }
  });
});

/**
 * The copy-vs-live check.
 *
 * `SCHEMA_SECTION_TYPES` is a copy of an enum that is declared in FOUR places
 * (tag-registry twice, plus two catalog.json files). Copies drift — that is the
 * whole finding behind D11. So the copy is not trusted here: it is compared
 * against the zod schema the app actually enforces, and against TAG_REGISTRY's
 * own descriptor. If someone edits the enum in one place and not the others,
 * this fails instead of shipping.
 */
describe('the copy cannot drift from the live schema again', () => {
  const liveEnum = (PromptSectionSchema.shape.props as any).shape.type;
  const liveOptions: string[] = liveEnum.options;

  it('reads a non-empty enum out of the enforced schema', () => {
    expect(liveOptions.length).toBeGreaterThan(0);
  });

  it('SCHEMA_SECTION_TYPES equals the enforced enum, element for element', () => {
    expect([...SCHEMA_SECTION_TYPES]).toEqual(liveOptions);
  });

  it("TAG_REGISTRY's own descriptor lists the same values, in the same order", () => {
    const descriptor = (TAG_REGISTRY as any)['prompt-section'].props.type.values;
    expect(descriptor).toEqual(liveOptions);
  });

  it('accepts agent-role — the seat that had no home', () => {
    expect(liveEnum.safeParse('agent-role').success).toBe(true);
  });

  it('still REFUSES custom-data, which stays undeclared and is not a role', () => {
    // Not an oversight left behind: custom-data is attached material. It reaches
    // the model through custom_roles, which this enum does not gate.
    expect(liveEnum.safeParse('custom-data').success).toBe(false);
  });

  it('refuses the old short spellings, so a re-introduced one fails loudly', () => {
    for (const short of ['system', 'user', 'agent']) {
      expect(liveEnum.safeParse(short).success, short).toBe(false);
    }
  });
});

/**
 * The names a WRITE can use.
 *
 * Two writers put text into the left column — the window events
 * (`set-left-column-text`, `force-set-section`, `fill-field`) and the assistant's
 * `<update_*>` tags — and each names the seat it writes to. The comparison used to be
 * exact, and the two shapes of prompt in this app name the same seat differently: a
 * composer says "User Role" / "System Role" / "Agent Role", and a repair prompt says
 * "User" / "System" / "Agent". So a write that named one shape while the other was in the
 * column matched nothing, changed nothing, and said nothing — the failure that reads to a
 * person as a surface that ignores them.
 *
 * What is pinned here is that the three spellings of one seat resolve, in both directions
 * and in both shapes of column, and that a seat the column does NOT have stays unresolved
 * rather than being redirected into a seat nobody named.
 */
describe('a write finds its seat by any of the names that seat answers to', () => {
  const COMPOSER = ['System Role', 'User Role', 'Tool Call', 'Few Shot', 'Context', 'Constraints'];
  const REPAIR = ['System', 'User', 'Tool Call', 'Agent'];

  it('resolves the canonical label, the id, and the short name to one index', () => {
    expect(resolveSectionName('User Role', COMPOSER)).toBe(1);
    expect(resolveSectionName('user-role', COMPOSER)).toBe(1);
    expect(resolveSectionName('User', REPAIR)).toBe(1);
    expect(resolveSectionName('User Role', REPAIR)).toBe(1);
    expect(resolveSectionName('Agent Role', REPAIR)).toBe(3);
    expect(resolveSectionName('System Role', REPAIR)).toBe(0);
    expect(resolveSectionName('tool-call', REPAIR)).toBe(2);
  });

  it('reads the name case- and space-insensitively, as both writers send it', () => {
    expect(resolveSectionName('  user role  ', COMPOSER)).toBe(1);
    expect(resolveSectionName('USER', REPAIR)).toBe(1);
  });

  it('lets the requested spelling win over a variant, so no seat is shadowed', () => {
    // Both names exist in this column and they are different seats: an exact match must
    // never be displaced by the legacy short name of another seat.
    const both = ['System Role', 'User', 'User Role'];
    expect(resolveSectionName('User', both)).toBe(1);
    expect(resolveSectionName('User Role', both)).toBe(2);
  });

  it('leaves a seat this column does not have unresolved', () => {
    // Constraints is a real seat — in a composer. A repair prompt has no such section,
    // and "there is nowhere to put this" is the true answer; redirecting it into Agent
    // would write a rule into a seat nobody named.
    expect(resolveSectionName('Constraints', REPAIR)).toBe(-1);
    expect(resolveSectionName('Few Shot', REPAIR)).toBe(-1);
    expect(resolveSectionName('Nothing Like This', COMPOSER)).toBe(-1);
    expect(resolveSectionName('', COMPOSER)).toBe(-1);
    expect(resolveSectionName('User', [])).toBe(-1);
  });

  it('lists the spellings from the one declaration, so a new seat is reachable', () => {
    for (const def of SECTION_TYPES) {
      for (const name of [def.label, def.id, ...(def.legacyNames ?? [])]) {
        expect(resolveSectionName(name, [def.label]), `${def.id} via ${name}`).toBe(0);
      }
    }
  });
});
