/**
 * THE FOLDER'S OWN FOUR-LAYER CHECK.
 *
 * The catalogue says what the server accepts, the registry says which name maps to which tag, and
 * the elements say what may draw. This script joins them:
 *
 *   - every registry name is in the catalogue, and every catalogue name is either a registry name
 *     or a primitive;
 *   - the catalogue's union reaches every one of its names;
 *   - every tag is defined by an element somewhere the app builds (this folder, or the app's own
 *     component folder), and that element is imported by the entry chain that registers it;
 *   - the two exported files are byte-for-byte the source's own output, so the table and the list
 *     cannot be edited apart.
 *
 * Run from the repository root:
 *
 *   node design_A2UI/tests/four-layers.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '..');
const frontend = join(repo, 'frontend');
const appSource = join(frontend, 'src');

const registry = JSON.parse(readFileSync(join(root, 'surface-design/registry.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(join(root, 'surface-design/catalog.json'), 'utf8'));

const names = Object.keys(registry.components);
const tags = registry.components;
const definitions = new Map();
const importers = new Map();
const sourceFiles = [];

/*
 * BOTH TREES ARE THE RUNTIME. This folder owns most of the room's elements; four of them live in
 * the app's own component folder (`design-left-panel`, `design-middle-container`,
 * `component-preview`, `draft-preview`) and are registered by `frontend/src/components/lit/
 * register.ts`. A scan of this folder alone called those four missing while the room was drawing
 * them, which is the check lying about the drawing rather than finding a defect.
 */
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.vite' || entry === 'tests' || entry === 'dist'
      || entry.startsWith('.')) {
      continue;
    }
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) sourceFiles.push(path);
  }
}
walk(root);
walk(appSource);

for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/customElements\.define\(\s*['"]([^'"]+)['"]/g)) {
    if (!definitions.has(match[1])) definitions.set(match[1], file);
  }
  for (const match of text.matchAll(
    /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]/g,
  )) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (!spec) continue;
    const target = spec.startsWith('@design2/')
      ? join(root, spec.slice('@design2/'.length))
      : spec.startsWith('@/')
        ? join(appSource, spec.slice('@/'.length))
        : spec.startsWith('.')
          ? resolve(dirname(file), spec)
          : null;
    if (!target) continue;
    const found = [
      target,
      `${target}.ts`,
      `${target}.tsx`,
      join(target, 'index.ts'),
      join(target, 'index.tsx'),
    ].find((candidate) => {
      try {
        return statSync(candidate).isFile();
      } catch {
        return false;
      }
    });
    if (!found) continue;
    if (!importers.has(found)) importers.set(found, new Set());
    importers.get(found).add(file);
  }
}

const missingDefinition = [];
const missingImport = [];
for (const [name, tag] of Object.entries(tags)) {
  const file = definitions.get(tag);
  if (!file) {
    missingDefinition.push(`${name} -> ${tag}`);
    continue;
  }
  const users = importers.get(file);
  if (!users || !users.size) {
    missingImport.push(`${name} -> ${tag} (${relative(repo, file)})`);
  }
}

const catalogNames = new Set(Object.keys(catalog.components));
const missingCatalog = names.filter((name) => !catalogNames.has(name));

/*
 * THE PRIMITIVE FLOOR, READ FROM THE CATALOGUE'S OWN MARK. The primitives are the entries the
 * generator did not derive from the registry, and they carry `draft: true`; a catalogue name that
 * is neither in the registry nor marked draft is a hand edit the exporter would erase.
 */
const catalogueOnly = [...catalogNames].filter((name) => !names.includes(name));
const unclaimed = catalogueOnly.filter((name) => catalog.components[name]?.draft !== true);
const primitives = catalogueOnly.length - unclaimed.length;

const refs = (catalog.$defs?.anyComponent?.oneOf ?? []).map((row) => String(row?.$ref ?? ''));
const refNames = refs.map((ref) => ref.replace(/^#\/components\//, ''));
const missingRefs = [...catalogNames].filter((name) => !refNames.includes(name));
const unknownRefs = refNames.filter((name) => !catalogNames.has(name));

/*
 * THE EXPORT DRIFT. The two files beside the source are exports, never a second declaration.
 * The exporter's check mode rebuilds them and compares byte-for-byte; a hand edit fails here.
 */
let exportDetail = 'the exporter did not run';
let exportOk = false;
try {
  exportDetail = execFileSync(
    process.execPath,
    [join(frontend, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      join(root, 'tests', 'export-catalogs.mts'), '--check'],
    { cwd: frontend, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  exportOk = true;
} catch (error) {
  exportDetail = `${error?.stdout ?? ''}${error?.stderr ?? ''}`.trim()
    || String(error?.message ?? error);
}

console.log(`registry names: ${names.length}`);
console.log(`catalog components: ${catalogNames.size} (${primitives} primitives + ${names.length} room names)`);
console.log(`anyComponent refs: ${refs.length} (missing ${missingRefs.length}, unknown ${unknownRefs.length})`);
console.log(`missing definitions: ${missingDefinition.length}`);
for (const line of missingDefinition) console.log(`  ${line}`);
console.log(`missing imports: ${missingImport.length}`);
for (const line of missingImport) console.log(`  ${line}`);
console.log(`missing from catalogue: ${missingCatalog.length}`);
for (const line of missingCatalog) console.log(`  ${line}`);
console.log(`catalogue names no one claims: ${unclaimed.length}`);
for (const line of unclaimed) console.log(`  ${line}`);
console.log(`export drift: ${exportOk ? 'none' : 'FOUND'}`);
if (!exportOk) console.log(`  ${exportDetail}`);

if (
  missingDefinition.length
  || missingImport.length
  || missingCatalog.length
  || unclaimed.length
  || missingRefs.length
  || unknownRefs.length
  || !exportOk
) {
  process.exitCode = 1;
}
