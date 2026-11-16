/**
 * THE FOLDER'S OWN FOUR-LAYER CHECK.
 *
 * The catalogue says what the server accepts, the registry says which name maps to which tag, and
 * the elements say what may draw. This script joins the three: every registry name is in the
 * catalogue, every tag has an element definition, and every defining module is imported by the
 * folder's own entry chain. A name with no importer is a component that cannot draw.
 *
 * Run from the repository root:
 *
 *   node design_A2UI/tests/four-layers.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const registry = JSON.parse(readFileSync(join(root, 'surface-design/registry.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(join(root, 'surface-design/catalog.json'), 'utf8'));

const names = Object.keys(registry.components);
const tags = registry.components;
const definitions = new Map();
const importers = new Map();
const sourceFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.vite' || entry === 'tests' || entry.startsWith('.')) {
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
    missingImport.push(`${name} -> ${tag} (${relative(root, file)})`);
  }
}

const catalogNames = new Set(Object.keys(catalog.components));
const missingCatalog = names.filter((name) => !catalogNames.has(name));
const anyRefs = catalog.$defs?.anyComponent?.oneOf?.length ?? 0;
const primitives = catalogNames.size - names.length;

console.log(`registry names: ${names.length}`);
console.log(
  `catalog components: ${catalogNames.size} (${primitives} primitives + ${names.length} room names)`,
);
console.log(`anyComponent refs: ${anyRefs}`);
console.log(`missing definitions: ${missingDefinition.length}`);
for (const line of missingDefinition) console.log(`  ${line}`);
console.log(`missing imports: ${missingImport.length}`);
for (const line of missingImport) console.log(`  ${line}`);
console.log(`missing from catalogue: ${missingCatalog.length}`);
for (const line of missingCatalog) console.log(`  ${line}`);

if (
  missingDefinition.length
  || missingImport.length
  || missingCatalog.length
  || anyRefs !== catalogNames.size
) {
  process.exitCode = 1;
}
