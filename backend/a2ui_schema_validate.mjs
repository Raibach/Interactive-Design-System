/**
 * THE RUNTIME SCHEMA GATE — the validator the backend calls, on the same library and settings as
 * the tooling (`design_A2UI/tests/step0-verify.mjs`), so a payload that passes here passes there.
 *
 * It is a separate process on purpose: the backend is Python, the reference validator for this
 * standard is Ajv 2020-12, and a Python implementation would be a second answer to the same
 * question. One question, one answer.
 *
 * NOTHING IS SUBSTITUTED. The shared types are read from the vendored copy on disk. If a `$ref`
 * inside them names a document that does not exist, Ajv raises and the error is reported as a
 * COMPILATION failure for that component — never as a pass, never as a warning.
 *
 * stdin:  { catalogue | cataloguePath, commonTypesPath, functionTypesPath, mode: "validate" |
 *           "survey", components }
 * stdout: { ok: boolean, catalogId, mode, results: [...], fatal?: string }
 *
 *   validate  each item is a payload component; the schema for its name is compiled and asked.
 *   survey    each item is a component NAME; only compilation is attempted, which answers "how
 *             many of this catalogue's components can this standard even describe".
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const frontend = join(repo, 'frontend');

/** Ajv resolves from the front end, which is the one place it is installed. */
function loadAjv() {
  const require = createRequire(join(frontend, 'package.json'));
  const entry = require.resolve('ajv/dist/2020');
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const loaded = require(entry);
  return loaded.default ?? loaded;
}

function readStdin() {
  return new Promise((resolveInput, rejectInput) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolveInput(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', rejectInput);
  });
}

function describeErrors(errors, limit = 6) {
  return (errors ?? []).slice(0, limit).map((error) => ({
    path: error.instancePath || '/',
    keyword: error.keyword,
    message: error.message,
    params: error.params,
  }));
}

const request = JSON.parse(await readStdin());
const catalogue = request.catalogue
  ? request.catalogue
  : JSON.parse(readFileSync(request.cataloguePath, 'utf8'));
const commonTypes = JSON.parse(readFileSync(request.commonTypesPath, 'utf8'));
const mode = request.mode === 'survey' ? 'survey' : 'validate';
const items = Array.isArray(request.components) ? request.components : [];

const output = { ok: true, mode, catalogId: catalogue.catalogId, results: [] };

/*
 * THE SIBLING DOCUMENT THE SHARED TYPES REACH. `FunctionCall` requires an instance to match
 * `catalog.json#/$defs/anyFunction`; that reference resolves to the address this file carries, and
 * the published address answers HTTP 404. The repository vendors the definition, and it is required
 * here: without it no entry with a text, number or true/false property can be compiled, and a gate
 * that cannot compile must say so rather than report the entry as valid.
 */
let functionTypes;
try {
  if (!request.functionTypesPath) {
    throw new Error('no functionTypesPath was given, and FunctionCall requires one');
  }
  functionTypes = JSON.parse(readFileSync(request.functionTypesPath, 'utf8'));
} catch (error) {
  output.ok = false;
  output.fatal = `the function vocabulary could not be read: ${error?.message ?? String(error)}`;
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

let ajv;
try {
  const Ajv2020 = loadAjv();
  ajv = new Ajv2020({ strict: false, allErrors: true, unevaluated: true, validateFormats: false });
  ajv.addSchema(functionTypes);
  ajv.addSchema(commonTypes);
  ajv.addSchema(catalogue);
} catch (error) {
  output.ok = false;
  output.fatal = `the validator could not be built: ${error?.message ?? String(error)}`;
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

const base = catalogue.$id;
for (let index = 0; index < items.length; index += 1) {
  const item = items[index];
  const name = mode === 'survey' ? String(item) : String(item?.component ?? '');
  const row = { index, name, compiled: false, ok: false, errors: [], compileError: '' };

  let validate;
  try {
    validate = ajv.getSchema(`${base}#/components/${name}`);
  } catch (error) {
    /* An unresolvable `$ref` is a fact about the standard, not about this payload. It is stated. */
    row.compileError = String(error?.message ?? error);
    output.results.push(row);
    /* eslint-disable-next-line no-continue */
    continue;
  }
  if (!validate) {
    row.compileError = `the catalogue declares no component "${name}"`;
    output.results.push(row);
    continue;
  }
  row.compiled = true;
  if (mode === 'survey') {
    row.ok = true;
    output.results.push(row);
    continue;
  }
  try {
    row.ok = validate(item) === true;
    if (!row.ok) row.errors = describeErrors(validate.errors);
  } catch (error) {
    row.compileError = `validation threw: ${error?.message ?? String(error)}`;
  }
  output.results.push(row);
}

process.stdout.write(JSON.stringify(output));
