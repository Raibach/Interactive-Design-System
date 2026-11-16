/**
 * EXPORT THE SEAT'S TWO DECLARATIONS FROM THEIR ONE SOURCE.
 *
 * `surface-design/registry.ts` is the source. `registry.json` is the name→tag half the shell's
 * renderer reads; `catalog.json` is the schema the server checks. Both files beside the source
 * are exports of it, never a second declaration. Run from `frontend`:
 *
 *   npx tsx ../design_A2UI/tests/export-catalogs.mts
 */
import { writeFileSync } from 'node:fs';
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

writeFileSync(
  join(root, 'surface-design', 'registry.json'),
  `${JSON.stringify(registry, null, 2)}\n`,
);
writeFileSync(
  join(root, 'surface-design', 'catalog.json'),
  `${JSON.stringify(DESIGN_SEAT_CATALOG, null, 2)}\n`,
);

console.log(`registry.json: ${Object.keys(registry.components).length} names`);
console.log(`catalog.json: ${Object.keys(DESIGN_SEAT_CATALOG.components).length} components`);
