#!/usr/bin/env node
/**
 * prepare_design_system.mjs — THE DETERMINISTIC HALF, IN ITS FIRST REAL FORM (2026-10-03).
 *
 * wireframe-lab/IMPORT-A-DESIGN-SYSTEM.md named this automation `prepare_design_system.py`; it
 * landed as a `.mjs` beside the catalogue tools it belongs to (this folder is Node tooling, and
 * the source it reads — a package's Custom Elements Manifest in node_modules — is the toolchain's
 * own neighbourhood). The name is corrected here, visibly, the way the record demands.
 *
 * WHAT IT DOES: reads a design system's OWN machine-readable source and writes its partition —
 * `wireframe-lab/catalogs/<id>/catalog.json` (the catalogue entries) and `registry.json` (the
 * name→tag table). It PROPOSES and DECLARES; it never accepts and it never touches another
 * catalogue. That keeps the law: the machine measures, a person accepts (the accept list this
 * run is given IS the person's act, recorded in the entries' `accepted` mark).
 *
 * THE MEASUREMENT RULES, all fail-loud-or-leave-out — never guess:
 *   · a prop's type maps from the manifest's own text: `boolean` / `string` / `number`, an
 *     inline string union (`"a" | "b"`), or an enum TYPE NAME (e.g. `BUTTON_KIND`) resolved from
 *     the package's own `es/components/<comp>/defs` file — only when every member it declares is
 *     a string literal (measured string), otherwise the prop is LEFT OUT and printed;
 *   · a prop whose type nobody stated (`null`, `any`, an unresolved name) is LEFT OUT, printed —
 *     the manifest discipline: a measured subset, never a guessed type;
 *   · a container is a tag whose manifest declares a DEFAULT slot (`""`) — its catalogue entry
 *     gains `children` so the compile may put things inside it (the room's container rule).
 *
 * USAGE:
 *   node scripts/prepare_design_system.mjs \
 *     --manifest frontend/node_modules/@carbon/web-components/custom-elements.json \
 *     --package-root frontend/node_modules/@carbon/web-components \
 *     --id carbon --label "Carbon" \
 *     --accept cds-button,cds-card,cds-checkbox,cds-select,cds-text-input,cds-textarea
 *   Add --all to also write every other tag as a PROPOSAL (draft: false) — see the cost note the
 *   run prints before it writes them.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const manifestPath = arg('manifest');
const packageRoot = arg('package-root');
const systemId = arg('id');
const systemLabel = arg('label');
const accept = new Set(String(arg('accept', '')).split(',').map((s) => s.trim()).filter(Boolean));
const writeAll = process.argv.includes('--all');

if (!manifestPath || !packageRoot || !systemId || !systemLabel) {
  console.error('missing args — see the header of this file for the exact usage');
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(resolve(REPO, manifestPath), 'utf8'));

// TWO MANIFEST FORMATS, ONE READER. The modern Custom Elements Manifest groups declarations
// under `modules`; Carbon's package ships the older flat `tags` list (its tooling's format).
// Both carry the same facts — name, attributes with type and default, slots — so both are read.
const tags = manifest.tags
  ? manifest.tags
  : (manifest.modules ?? []).flatMap((m) =>
      (m.declarations ?? []).filter((d) => d.customElement && d.tagName).map((d) => ({
        name: d.tagName,
        description: d.description,
        attributes: (d.members ?? [])
          .filter((x) => x.kind === 'field' && x.attribute)
          .map((x) => ({ name: x.attribute, type: x.type?.text ?? null, default: x.default })),
        slots: d.slots,
      }))
    );

const skipped = [];
const stringLiteral = /^"([^"]*)"(\s*\|\s*"[^"]*")*$/;

/** Resolve an enum TYPE NAME against the package's own defs — measured, or nothing.
 *  BOTH compiled spellings are read (`NAME = "value"` and `NAME["MEMBER"] = "value"`) and BOTH
 *  files are tried (the declarations first, the compiled output after) — found by regenerating
 *  once and watching BUTTON_KIND, the button's whole VARIANT vocabulary, fall out on the floor:
 *  the first version stopped at the compiled file's first empty match instead of continuing. */
function resolveEnum(component, typeName) {
  for (const ext of ['d.ts', 'js']) {
    const p = resolve(REPO, packageRoot, 'es', 'components', component, `defs.${ext}`);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    const members = [
      ...[...text.matchAll(new RegExp(`${typeName}\\s*[=:]\\s*"([^"]*)"`, 'g'))],
      ...[...text.matchAll(new RegExp(`${typeName}\\["[A-Z0-9_]+"\\]\\s*=\\s*"([^"]*)"`, 'g'))],
    ];
    if (members.length === 0) continue; // not in this file — the next one may carry it
    // Only a string-valued enum is measurable as a string. A numeric or mixed enum is NOT
    // guessed — it is left out with its reason.
    const numeric = new RegExp(`${typeName}(\\[[A-Z0-9_]+\\])?\\s*[=:]\\s*\\d`).test(text);
    if (!numeric) return 'string';
    return null;
  }
  return null;
}

function mapType(component, tag, attr) {
  const raw = String(attr.type ?? '').replace(/\s*\|\s*undefined\s*$/, '').trim();
  if (raw === 'boolean') return 'boolean';
  if (raw === 'string') return 'string';
  if (raw === 'number') return 'number';
  if (stringLiteral.test(raw)) return 'string';
  if (/^[A-Z][A-Z0-9_]*$/.test(raw)) {
    const resolved = resolveEnum(component, raw);
    if (resolved) return resolved;
    skipped.push(`${tag}.${attr.name}: enum '${raw}' does not resolve to string values`);
    return null;
  }
  skipped.push(`${tag}.${attr.name}: type ${raw === '' ? '(unstated)' : `'${raw}'`} cannot be measured`);
  return null;
}

/** One catalogue entry, the exact shape the ingest writes — one reader for both. */
function entryFor(tag, acceptedAt, acceptedBy) {
  const component = tag.name.replace(/^cds-/, '');
  const properties = { component: { const: tag.name } };
  for (const attr of tag.attributes ?? []) {
    if (['class', 'style'].includes(attr.name)) continue;
    const mapped = mapType(component, tag.name, attr);
    if (mapped) properties[attr.name] = { type: mapped };
  }
  const slots = (tag.slots ?? []).map((s) => (s.name === '' ? 'default' : s.name));
  if (slots.includes('default')) {
    const children = {};
    for (const slot of slots) children[slot] = { type: 'array' };
    properties.children = { type: 'object', properties: children };
  }
  const entry = {
    type: 'object',
    allOf: [
      { $ref: 'https://a2ui.org/specification/v0_9/common_types.json#/$defs/ComponentCommon' },
      {
        type: 'object',
        description:
          `${(tag.description ?? '').split('\n')[0]} Generated from ${systemLabel}'s own Custom `
          + `Elements Manifest (the ${manifestPath} the package ships) by `
          + 'scripts/prepare_design_system.mjs — types MEASURED, unmappable props left out.',
        properties,
      },
    ],
    draft: accept.has(tag.name),
    proposed: { source: `${manifestPath}#${tag.name}`, at: acceptedAt },
  };
  if (accept.has(tag.name)) entry.accepted = { at: acceptedAt, by: acceptedBy };
  return entry;
}

const stamp = new Date().toISOString().slice(0, 19);
const chosen = tags.filter((t) => accept.has(t.name));
const missing = [...accept].filter((a) => !tags.some((t) => t.name === a));
if (missing.length) {
  console.error(`the accept list names tags the manifest does not declare: ${missing.join(', ')}`);
  process.exit(1);
}

const extra = tags.filter((t) => !accept.has(t.name));
console.log(`manifest: ${tags.length} tags; accepting ${chosen.length}: ${chosen.map((t) => t.name).join(', ')}`);
console.log(`NOT written: ${extra.length} more tags — every one of them would ride the compile's contract and her vocabulary in tokens. Re-run with --all to write them as proposals when that bill is wanted.`);
if (skipped.length) {
  console.log(`props LEFT OUT (measured subset, never guessed):`);
  for (const line of skipped) console.log(`  · ${line}`);
}

const componentMap = {};
for (const tag of chosen) componentMap[tag.name] = entryFor(tag, stamp, 'accept list of this generation run (person-directed)');
if (writeAll) {
  for (const tag of extra) componentMap[tag.name] = entryFor(tag, stamp, '');
}

const catalog = {
  title: `${systemLabel} (generated)`,
  catalogId: `https://raibach.net/a2ui/catalogs/${systemId}/v0_9_1/catalog.json`,
  whatThisFileIs:
    `Written by scripts/prepare_design_system.mjs on ${stamp} from ${systemLabel}'s own Custom `
    + 'Elements Manifest. Props are MEASURED from it (unmappable ones left out, printed by the '
    + 'run); the accept list of that run is the person-directed act that flips draft to true. '
    + 'The elements themselves are the vendor package\u2019s own Lit components \u2014 nothing is copied.',
  components: componentMap,
};
const registry = {
  system: systemId,
  components: Object.fromEntries(chosen.map((t) => [t.name, t.name])),
};

const outDir = join(REPO, 'wireframe-lab', 'catalogs', systemId);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(join(outDir, 'registry.json'), JSON.stringify(registry, null, 2) + '\n');

// THE LINK IS PART OF THE PARTITION — the ingest's own rule (backend/routes/figma.py), learned
// again here the hard way: the Carbon partition existed in the lab and the app could not see it
// ("no catalogue partition named 'carbon'") until the app tree pointed at it. The lab is the
// source; the app tree holds ONE symlink per partition; the generator writes BOTH halves so
// they cannot drift (or be forgotten) apart.
const linkPath = join(REPO, 'frontend', 'src', 'components', 'A2UI', 'catalogs', systemId);
if (!existsSync(linkPath)) {
  const { symlinkSync, relative } = await import('node:fs');
  symlinkSync(relative(dirname(linkPath), outDir), linkPath);
  console.log(`linked the app tree: ${linkPath} -> ${relative(dirname(linkPath), outDir)}`);
} else {
  console.log(`the app-tree link already exists: ${linkPath}`);
}
console.log(`wrote ${outDir}/catalog.json (${Object.keys(componentMap).length} entries) and registry.json (${Object.keys(registry.components).length} maps)`);
