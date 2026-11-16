/**
 * EXPORT THE SEAT'S TWO DECLARATIONS FROM THEIR ONE SOURCE.
 *
 * `surface-design/registry.ts` is the source. `registry.json` is the name→tag half the shell's
 * renderer reads; `catalog.json` is the schema the server checks. Both files beside the source
 * are exports of it, never a second declaration. Run from `frontend`:
 *
 *   npx tsx ../design_A2UI/tests/export-catalogs.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESIGN_SEAT_CATALOG } from '../surface-design/catalog';
import { DESIGN_SEAT_REGISTRY } from '../surface-design/registry';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const registry = {
  system: 'surface-design',
  components: Object.fromEntries(
    Object.entries(DESIGN_SEAT_REGISTRY).map(([name, entry]) => [name, entry.tag]),
  ),
};

const registryText = `${JSON.stringify(registry, null, 2)}\n`;
const catalogText = `${JSON.stringify(DESIGN_SEAT_CATALOG, null, 2)}\n`;
const registryPath = join(root, 'surface-design', 'registry.json');
const catalogPath = join(root, 'surface-design', 'catalog.json');

/*
 * `--check` IS THE DRIFT GUARD. It builds both documents from the source exactly as the write
 * below does, and compares them to the files on disk. A hand edit to either file, or a registry
 * change that was not exported, is reported by name and exits non-zero. `four-layers.mjs` calls
 * this mode, so the folder's own check proves the table and the list are one fact.
 */
if (process.argv.includes('--check')) {
  const same = (path: string, expected: string): boolean => {
    try {
      return readFileSync(path, 'utf8') === expected;
    } catch {
      return false;
    }
  };
  const drift: string[] = [];
  if (!same(registryPath, registryText)) drift.push('registry.json');
  if (!same(catalogPath, catalogText)) drift.push('catalog.json');
  if (drift.length) {
    console.error(
      `export check FAILED: ${drift.join(', ')} ${drift.length === 1 ? 'does' : 'do'} not match `
      + 'the source. Run the exporter to write them.',
    );
    process.exit(1);
  }
  console.log('export check: registry.json and catalog.json match their source');
  process.exit(0);
}

writeFileSync(registryPath, registryText);
writeFileSync(catalogPath, catalogText);

console.log(`registry.json: ${Object.keys(registry.components).length} names`);
console.log(`catalog.json: ${Object.keys(DESIGN_SEAT_CATALOG.components).length} components`);
