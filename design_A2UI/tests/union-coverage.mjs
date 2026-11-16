/**
 * THE UNION COVERAGE CHECK — every name a catalogue declares can be named in a payload.
 *
 * A catalogue's `$defs.anyComponent.oneOf` is the set the validator can reach. A component in the
 * `components` map that the union does not reference is a name the catalogue declares and the
 * gate cannot admit. Measured 2026-11-16: the Composer's list held 75 and its union 59, so 16
 * names could not be used in any payload.
 *
 * A catalogue with NO `anyComponent` block is skipped and said so. The carbon partition reaches
 * its components through the map alone; inventing a union there would change its contract.
 *
 *   node design_A2UI/tests/union-coverage.mjs          check every catalogue
 *   node design_A2UI/tests/union-coverage.mjs --write  add every missing reference, in order
 *
 * The write inserts text into the existing block; it does not re-serialise the document, so the
 * rest of the catalogue stays byte-for-byte as it was.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const catalogues = join(root, '..', 'frontend', 'src', 'components', 'A2UI', 'catalogs');
const write = process.argv.includes('--write');

let failed = false;

for (const entry of readdirSync(catalogues).sort()) {
  const path = join(catalogues, entry, 'catalog.json');
  let isFile = false;
  try {
    isFile = statSync(path).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) continue;

  const text = readFileSync(path, 'utf8');
  const catalog = JSON.parse(text);
  const names = Object.keys(catalog.components ?? {});
  const union = catalog?.$defs?.anyComponent;
  if (!union) {
    console.log(`${entry}: no anyComponent union — skipped (its components map is its reachability)`);
    continue;
  }

  const refs = (union.oneOf ?? []).map((row) => String(row?.$ref ?? ''));
  const missing = names.filter((name) => !refs.includes(`#/components/${name}`));
  const unknown = refs
    .map((ref) => ref.replace(/^#\/components\//, ''))
    .filter((name) => !names.includes(name));

  if (write && missing.length) {
    const unionStart = text.indexOf('"anyComponent"');
    const oneOfStart = unionStart >= 0 ? text.indexOf('"oneOf": [', unionStart) : -1;
    const oneOfEnd = oneOfStart >= 0 ? text.indexOf('      ],', oneOfStart) : -1;
    if (oneOfStart < 0 || oneOfEnd < 0) {
      console.error(`${entry}: the oneOf block could not be located; nothing was written`);
      failed = true;
      continue;
    }
    const before = text.slice(0, oneOfEnd);
    const lastBrace = before.lastIndexOf('        }');
    if (lastBrace < 0) {
      console.error(`${entry}: the last reference could not be located; nothing was written`);
      failed = true;
      continue;
    }
    const head = `${before.slice(0, lastBrace)}        },\n`;
    const added = missing
      .map((name) => `        {\n          "$ref": "#/components/${name}"\n        }`)
      .join(',\n');
    writeFileSync(path, `${head}${added}\n${text.slice(oneOfEnd)}`);
    console.log(`${entry}: added ${missing.length} reference(s)`);
  }

  const after = JSON.parse(readFileSync(path, 'utf8'));
  const afterRefs = (after?.$defs?.anyComponent?.oneOf ?? []).map((row) => String(row?.$ref ?? ''));
  const remaining = names.filter((name) => !afterRefs.includes(`#/components/${name}`));

  console.log(
    `${entry}: ${names.length} components, ${afterRefs.length} union refs, `
    + `missing ${remaining.length}, unknown ${unknown.length}`,
  );
  for (const name of remaining) console.log(`  missing ${name}`);
  for (const name of unknown) console.log(`  unknown ${name}`);
  if (remaining.length || unknown.length) failed = true;
}

if (failed) process.exitCode = 1;
