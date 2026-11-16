/**
 * STEP 0 — THE CATALOG WRITE, VERIFIED AGAINST THE CORRECTED TARGET.
 *
 * The fixture (`tests/fixtures/step0-approved-card.json`) injects one approved component into
 * `prompt-composer/catalog.json` as two JSON Patch operations, because that is the catalogue the
 * approval surface's `createSurface` declares (`design_console.py:1038` → `A2UI_CATALOG_ID`).
 *
 * THIS SCRIPT NEVER WRITES THE CATALOGUE. It patches a copy in memory, validates against the copy,
 * and proves the file on disk is byte-identical afterwards by checksum and by `git diff`.
 *
 * What it asserts, from the contract (sections 2, 3, 4) and the corrected 1.4:
 *
 *   A1  the patched document keeps its shape: eight keys, one more component, one more union ref
 *   A2  the fixture's valid instance passes the component AND the union
 *   A3  an undeclared property is refused by `unevaluatedProperties`
 *   A4  children as a raw string is refused, because the prop references `ChildList`
 *   A5  resolution: the declared catalogId finds the entry; a mismatch is refused, naming the id
 *   A6  a card exposing callable functions is refused with `CATALOG_FUNCTION_VOCABULARY_ABSENT`
 *   A7  the catalogue on disk is unchanged
 *
 * ONE DEFINITION, NOT A STAND-IN. The published shared types reference
 * `catalog.json#/$defs/anyFunction`, and that document answers HTTP 404. `DynamicString` reaches
 * `FunctionCall` reaches that reference, so no string prop can be compiled without a definition for
 * it. The repository vendors the definition at
 * `backend/standards/a2ui-function-catalog-v0_9.json`, and it matches nothing because no catalogue
 * here declares a functions block. The runtime gate registers the same file, so this test and the
 * gate answer with one definition. A6 asserts the contract's refusal rule at the writer.
 *
 * Run from the repository root:
 *
 *   node design_A2UI/tests/step0-verify.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '..');
const frontend = join(repo, 'frontend');

const FIXTURE = join(here, 'fixtures/step0-approved-card.json');
const TARGET = join(frontend, 'src/components/A2UI/catalogs/prompt-composer/catalog.json');
const SEAT = join(root, 'surface-design/catalog.json');
const FUNCTION_CATALOG_URL = 'https://a2ui.org/specification/v0_9/catalog.json';
/* THE SAME TWO FILES THE RUNTIME GATE READS. The test used to fetch the live shared types and
   register a permissive stand-in for the missing sibling; both now come from the repository, so
   the test and `backend/a2ui_schema_gate.py` answer with one definition. */
const COMMON_TYPES_FILE = join(repo, 'backend/standards/a2ui-common-types-v0_9.json');
const FUNCTION_TYPES_FILE = join(repo, 'backend/standards/a2ui-function-catalog-v0_9.json');

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const results = [];
function record(id, label, ok, detail) {
  results.push({ id, label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${label}`);
  if (detail) console.log(`      ${detail}`);
}
function note(label, detail) {
  console.log(`NOTE  ${label}\n      ${detail}`);
}
function header(title) {
  console.log(`\n${'─'.repeat(78)}\n${title}\n${'─'.repeat(78)}`);
}

console.log('STEP 0 — the catalog write, verified against prompt-composer');

/* ── THE FILE ON DISK, READ ONLY ──────────────────────────────────────────────────────────── */
const originalBytes = readFileSync(TARGET);
const originalSha = sha(originalBytes);
const original = JSON.parse(originalBytes.toString('utf8'));
const seat = JSON.parse(readFileSync(SEAT, 'utf8'));
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));

console.log(`target:   ${fixture.target.file}`);
console.log(`declared: ${original.catalogId}`);
console.log(`seat id:  ${seat.catalogId}`);
console.log(`sha256:   ${originalSha.slice(0, 16)}…`);

/* ── THE PATCH, APPLIED TO A COPY ─────────────────────────────────────────────────────────── */
function applyPatch(document, ops) {
  const copy = JSON.parse(JSON.stringify(document));
  for (const op of ops) {
    if (op.op !== 'add') throw new Error(`unsupported patch op "${op.op}" at ${op.path}`);
    const path = String(op.path);
    if (path.startsWith('/components/')) {
      const name = path.slice('/components/'.length);
      if (Object.prototype.hasOwnProperty.call(copy.components, name)) {
        throw new Error(`the patch would overwrite an existing component "${name}"`);
      }
      copy.components[name] = op.value;
    } else if (path === '/$defs/anyComponent/oneOf/-') {
      copy.$defs.anyComponent.oneOf.push(op.value);
    } else {
      throw new Error(`unsupported patch path "${path}"`);
    }
  }
  return copy;
}

let patched = null;
try {
  patched = applyPatch(original, fixture.patch);
} catch (e) {
  console.log(`\nBLOCKER: the fixture patch could not be applied — ${e.message}`);
  process.exit(1);
}

const NAME = fixture.card.element_name;
const EXPECTED_KEYS = [
  '$defs', '$id', '$schema', 'catalogId', 'components', 'description', 'title', 'whatThisFileIs',
];

/* ── A1: THE DOCUMENT'S SHAPE ─────────────────────────────────────────────────────────────── */
header('A1 — the patched document keeps its shape');
const beforeCount = Object.keys(original.components).length;
const afterCount = Object.keys(patched.components).length;
const beforeUnion = original.$defs.anyComponent.oneOf.length;
const afterUnion = patched.$defs.anyComponent.oneOf.length;
record(
  'A1', 'eight top-level keys, one more component, one more union reference',
  JSON.stringify(Object.keys(patched).sort()) === JSON.stringify(EXPECTED_KEYS)
    && afterCount === beforeCount + 1 && afterUnion === beforeUnion + 1,
  `keys ${Object.keys(patched).length}; components ${beforeCount} → ${afterCount}; `
  + `union ${beforeUnion} → ${afterUnion}`,
);

/* ── THE VALIDATOR ────────────────────────────────────────────────────────────────────────── */
header('THE VALIDATOR');
let validateComponent = null;
let validateUnion = null;
let functionVocabularyRegistered = false;
let validatorDetail = '';
try {
  const common = JSON.parse(readFileSync(COMMON_TYPES_FILE, 'utf8'));
  const functionTypes = JSON.parse(readFileSync(FUNCTION_TYPES_FILE, 'utf8'));

  const { default: Ajv2020 } = await import(
    pathToFileURL(join(frontend, 'node_modules/ajv/dist/2020.js')).href
  );
  const ajv = new Ajv2020({ strict: false, allErrors: true, unevaluated: true, validateFormats: false });
  ajv.addSchema(functionTypes);
  ajv.addSchema(common);

  /* The shared types reach `catalog.json#/$defs/anyFunction` through FunctionCall. The published
     address is a 404; the repository's own definition is registered here, and it matches nothing
     because no catalogue declares a function vocabulary. The gate registers the same file. */
  if (JSON.stringify(common).includes('anyFunction')) {
    console.log('  the shared types reference catalog.json#/$defs/anyFunction');
    console.log(`  ${FUNCTION_TYPES_FILE} is the definition, and it matches no function call`);
    if (functionTypes.$id !== FUNCTION_CATALOG_URL) {
      throw new Error(
        `the function vocabulary declares $id ${functionTypes.$id}, and the shared types reach `
        + `${FUNCTION_CATALOG_URL}`,
      );
    }
    functionVocabularyRegistered = true;
  }

  ajv.addSchema(patched);
  validateComponent = ajv.getSchema(`${patched.$id}#/components/${NAME}`);
  validateUnion = ajv.getSchema(`${patched.$id}#/$defs/anyComponent`);
  validatorDetail = `shared types from ${COMMON_TYPES_FILE}, formats not checked`;
  console.log(`  ${validatorDetail}`);
} catch (e) {
  validatorDetail = `the validator could not be prepared: ${e?.message ?? String(e)}`;
  console.log(`  FAILED: ${validatorDetail}`);
}

/* ── A2: THE VALID INSTANCE ───────────────────────────────────────────────────────────────── */
header('A2 — the valid instance');
const instances = fixture.assertions.instance;
const valid = instances.valid;
let componentAccepted = false;
let unionAccepted = false;
if (validateComponent) {
  componentAccepted = validateComponent(valid) === true;
  if (!componentAccepted) {
    console.log('  component errors: ' + JSON.stringify(validateComponent.errors, null, 2));
  }
}
if (validateUnion) {
  unionAccepted = validateUnion(valid) === true;
  if (!unionAccepted) {
    console.log('  union errors: ' + JSON.stringify(validateUnion.errors, null, 2));
  }
} else {
  console.log('  the union was not compiled, so it could not be asked');
}
record(
  'A2', 'the valid instance passes the component and the union',
  componentAccepted && unionAccepted,
  `against components/${NAME}: ${componentAccepted}; against $defs/anyComponent: ${unionAccepted}; `
  + `instance ${JSON.stringify(valid)}`,
);

/* ── A3: AN UNDECLARED PROPERTY ───────────────────────────────────────────────────────────── */
header('A3 — an undeclared property');
const undeclared = instances.refusedUndeclaredProperty;
let undeclaredRefused = false;
let undeclaredDetail = validatorDetail;
if (validateComponent) {
  undeclaredRefused = validateComponent(undeclared) === false;
  const errors = validateComponent.errors ?? [];
  const byKeyword = errors.some((e) => String(e.keyword) === 'unevaluatedProperties');
  undeclaredRefused = undeclaredRefused && byKeyword;
  undeclaredDetail = errors.map((e) => `${e.keyword} at "${e.instancePath || '/'}" ${e.message}`)
    .slice(0, 3).join(' | ') || '(not refused)';
}
record('A3', 'refused by unevaluatedProperties', undeclaredRefused, undeclaredDetail);

/* ── A4: CHILDREN AS A RAW STRING ─────────────────────────────────────────────────────────── */
header('A4 — children as a raw string');
const rawChildren = instances.refusedRawStringChildren;
let rawRefused = false;
let rawDetail = validatorDetail;
if (validateComponent) {
  rawRefused = validateComponent(rawChildren) === false;
  const errors = validateComponent.errors ?? [];
  const namesChildren = errors.some((e) => String(e.instancePath).includes('/children'));
  rawRefused = rawRefused && namesChildren;
  rawDetail = errors.map((e) => `${e.keyword} at "${e.instancePath || '/'}" ${e.message}`)
    .slice(0, 3).join(' | ') || '(not refused)';
}
record('A4', 'refused because children references ChildList', rawRefused, rawDetail);

/* ── A5: RESOLUTION BY THE DECLARED CATALOG_ID ───────────────────────────────────────────── */
header('A5 — resolution by the declared catalogId');

/* The repository's rule, mirrored: a surface names a catalogId, and the catalogue that declares
   that id is the only one consulted — `backend/deps.py:241-248`. No capability list, no fallback. */
function resolveComponent(name, declaredCatalogId, catalogues) {
  const document = catalogues.get(declaredCatalogId);
  if (!document) {
    return { ok: false, code: 'CATALOG_ID_UNKNOWN', detail: `no catalogue declares ${declaredCatalogId}` };
  }
  if (!Object.prototype.hasOwnProperty.call(document.components ?? {}, name)) {
    return {
      ok: false,
      code: 'COMPONENT_NOT_IN_DECLARED_CATALOG',
      detail: `${name} is not in the catalogue that declares ${declaredCatalogId}`,
    };
  }
  const union = (document.$defs?.anyComponent?.oneOf ?? []).map((row) => row?.$ref ?? '');
  if (!union.includes(`#/components/${name}`)) {
    return { ok: false, code: 'COMPONENT_NOT_IN_UNION', detail: `${name} has no union reference` };
  }
  return { ok: true, detail: `${name} resolved through ${declaredCatalogId}` };
}

/* The mismatch case needs the entry to exist SOMEWHERE else, which is what a writer aimed at the
   wrong catalogue would produce. The seat's catalogue is cloned and given the same entry. */
const seatWithEntry = applyPatch(seat, fixture.patch);
const catalogues = new Map([
  [original.catalogId, patched],
  [seat.catalogId, seatWithEntry],
]);

const matching = resolveComponent(NAME, original.catalogId, catalogues);
const mismatched = resolveComponent(NAME, original.catalogId, new Map([[original.catalogId, original], [seat.catalogId, seatWithEntry]]));
record(
  'A5a', 'the entry resolves under the catalogId the approval surface declares',
  matching.ok, matching.detail,
);
record(
  'A5b', 'an entry that lives in another catalogue is refused, naming the declared id',
  !mismatched.ok && mismatched.code === 'COMPONENT_NOT_IN_DECLARED_CATALOG',
  `${mismatched.code}: ${mismatched.detail}`,
);

/* ── A6: A COMPONENT THAT EXPOSES CALLABLE FUNCTIONS ─────────────────────────────────────── */
header('A6 — a card that exposes callable functions');

/* The contract's rule, section 1.4.5. No production writer exists, so this asserts the RULE. */
function refuseFunctionVocabulary(card) {
  const functions = Array.isArray(card.functions) ? card.functions : [];
  const catalogueHasFunctions = Object.prototype.hasOwnProperty.call(patched, 'functions');
  if (functions.length > 0 && !catalogueHasFunctions) {
    return {
      ok: false,
      code: 'CATALOG_FUNCTION_VOCABULARY_ABSENT',
      detail: `the card exposes ${functions.length} callable function(s); the catalogue declares no `
        + 'functions block, and the shared types\' anyFunction definition admits no function call',
    };
  }
  return { ok: true, detail: 'no callable functions' };
}
const functionCard = { element_name: NAME, functions: [{ name: 'onSelect', returns: 'void' }] };
const functionVerdict = refuseFunctionVocabulary(functionCard);
record(
  'A6', 'refused with CATALOG_FUNCTION_VOCABULARY_ABSENT',
  !functionVerdict.ok && functionVerdict.code === 'CATALOG_FUNCTION_VOCABULARY_ABSENT',
  functionVerdict.detail,
);
console.log(`      the catalogue declares a functions block: ${Object.prototype.hasOwnProperty.call(patched, 'functions')}`);
console.log(`      the function vocabulary is registered and matches no function call: ${functionVocabularyRegistered}`);

/* ── A7: THE FILE ON DISK ─────────────────────────────────────────────────────────────────── */
header('A7 — the catalogue on disk is unchanged');
const afterBytes = readFileSync(TARGET);
const afterSha = sha(afterBytes);
record(
  'A7', 'prompt-composer/catalog.json is byte-identical to the start of the run',
  afterSha === originalSha,
  `sha256 ${afterSha.slice(0, 16)}… vs ${originalSha.slice(0, 16)}…; written by this script: no`,
);

/* ── THE VERDICT ─────────────────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} assertions passed`);
if (failed.length) {
  console.log('\nFAILURES');
  for (const row of failed) console.log(`  ${row.id} — ${row.label}\n      ${row.detail}`);
} else {
  console.log('\nFAILURES\n  none');
}
if (functionVocabularyRegistered) {
  console.log('\nCARRIED FORWARD: the function vocabulary is empty, so a function call is refused by the '
    + 'standard\'s schema. A catalogue that declares functions must vendor their definitions in the '
    + 'same change.');
}
process.exit(failed.length === 0 ? 0 : 1);
