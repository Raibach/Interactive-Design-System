#!/usr/bin/env node
/**
 * apply-carbon-system.mjs — CARBON BECOMES A DESIGN SYSTEM, AND ITS TYPE BECOMES THE APP'S.
 *
 * This is the one script that performs, idempotently, everything the owner approved on
 * 2026-10-25: add Carbon as a dedicated design system to the ingest, and make IBM Plex —
 * Carbon's type — the one face the whole application speaks.
 *
 * It is run from the repository (cwd = frontend/) either by hand (`node scripts/apply-carbon-system.mjs`)
 * or by the Design seat's "Apply Carbon" button, which calls the server and the server runs it.
 * Every step checks what already stands and writes only what is missing, so running it twice
 * changes nothing the second time.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = join(FRONTEND, 'src/components/A2UI/catalogs/carbon');
const FONT_DIR = join(FRONTEND, 'public/fonts');
const log = [];
const say = (line) => { log.push(line); console.log(line); };

/* ── 1. THE CARBON CATALOGUE ─────────────────────────────────────────────────── */
const CARBON_TAGS = [
  'accordion','action-set','ai-label','ai-skeleton','badge-indicator','big-number','breadcrumb','button',
  'card','chat-button','checkbox','coachmark','code-snippet','combo-box','combo-button','contained-list',
  'content-switcher','copy','copy-button','data-table','date-picker','dialog','dropdown','edit-in-place',
  'file-uploader','form','link','list','loading','modal','multi-select','notification','number-input',
  'overflow-menu','password-input','popover','progress-bar','progress-indicator','radio-button','search',
  'select','skeleton','skip-to-content','slider','structured-list','switch','tabs','tag','textarea',
  'text-input','tile','time-picker','toast','toggle','tooltip','tree-view','truncate','ui-shell',
];
function buildCatalog() {
  const common = () => ({
    type: 'object',
    allOf: [
      { $ref: 'https://a2ui.org/specification/v0_9/common_types.json#/$defs/ComponentCommon' },
      { $ref: '#/$defs/CatalogComponentCommon' },
      { type: 'object', properties: { component: { const: null } } },
    ],
    required: ['component'],
  });
  const components = {};
  for (const tag of CARBON_TAGS) {
    const entry = common();
    entry.allOf[2].properties.component.const = `cds-${tag}`;
    entry.allOf[2].description =
      `IBM Carbon Design System's <cds-${tag}> web component (Carbon v2, the installed ` +
      '@carbon/web-components package), declared here so the Carbon system can be named ' +
      'by the ingest and its assemblies.';
    components[`cds-${tag}`] = entry;
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://raibach.net/a2ui/catalogs/carbon/v0_9_1/catalog.json',
    title: 'Carbon',
    whatThisFileIs:
      "CARBON, IBM'S DESIGN SYSTEM, AS A DEDICATED CATALOGUE (owner, 2026-10-25). The entries " +
      'are the Carbon Web Components the package already ships; the designer selects this system ' +
      'in the ingest and the tool applies Carbon\u2019s type \u2014 IBM Plex \u2014 when it stands.',
    description: 'IBM Carbon Design System catalogue for the ingest: the cds-* web components of @carbon/web-components v2.',
    catalogId: 'https://raibach.net/a2ui/catalogs/carbon/v0_9_1/catalog.json',
    components,
    $defs: {
      CatalogComponentCommon: {
        type: 'object',
        properties: {
          weight: {
            type: 'number',
            description:
              'The relative weight of this component within a Row or Column (CSS flex-grow). ' +
              'Only valid for direct children of Row or Column.',
          },
        },
      },
    },
  };
}
mkdirSync(CATALOG_DIR, { recursive: true });
const catalogPath = join(CATALOG_DIR, 'catalog.json');
const nextCatalog = JSON.stringify(buildCatalog(), null, 1);
const hadCatalog = existsSync(catalogPath) && readFileSync(catalogPath, 'utf8') === nextCatalog;
writeFileSync(catalogPath, nextCatalog);
say(hadCatalog ? 'carbon catalogue: already stands, nothing written' : `carbon catalogue: written (${CARBON_TAGS.length} components)`);

/* ── 2. THE IBM PLEX FILES ───────────────────────────────────────────────────── */
const PLEX_FILES = ['plex-sans-var-latin.woff2', 'plex-mono-regular.woff2', 'plex-mono-medium.woff2', 'plex-mono-bold.woff2'];
const missing = PLEX_FILES.filter((f) => !existsSync(join(FONT_DIR, f)));
if (missing.length) {
  say(`plex files missing: ${missing.join(', ')} — take them once from the official @ibm/plex package (SIL OFL) into public/fonts/ and run this again`);
} else {
  say(`plex files: all ${PLEX_FILES.length} present (${PLEX_FILES.map((f) => f + ' ' + Math.round(statSync(join(FONT_DIR, f)).size / 1024) + 'k').join(', ')})`);
}

/* ── 3. THE FONT SHEET ───────────────────────────────────────────────────────── */
const SHEET = `/*
 * THE SITE'S FONT SHEET — the one place the faces are declared.
 *
 * WHAT IT CARRIES. Two families, self-hosted from this origin, both IBM's (owner, 2026-10-25:
 * Carbon becomes a dedicated design system, and Carbon's type — IBM Plex — becomes the one
 * face the whole application speaks):
 *
 *   · IBM Plex Sans — the application face, everywhere the interface and the chat speak.
 *   · IBM Plex Mono — code, figures and everything that must align.
 *
 * The Inter and Nunito faces this sheet used to declare are replaced; their files stay on
 * disk until the last page built against them is gone.
 *
 * WHERE THE FILES COME FROM. The variable Sans and the Mono weights were taken once from
 * the official @ibm/plex package (SIL OFL) and now ship from this origin — nothing in this
 * chain calls an external font host.
 */
@font-face {
  font-family: 'IBM Plex Sans';
  font-style: normal;
  font-weight: 100 700;
  font-display: swap;
  src: url('/fonts/plex-sans-var-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/plex-mono-regular.woff2') format('woff2');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/plex-mono-medium.woff2') format('woff2');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/plex-mono-bold.woff2') format('woff2');
}
`;
const sheetPath = join(FONT_DIR, 'fonts.css');
if (existsSync(sheetPath) && readFileSync(sheetPath, 'utf8').includes("font-family: 'IBM Plex Sans'")) {
  say('font sheet: already declares IBM Plex, nothing written');
} else {
  writeFileSync(sheetPath, SHEET);
  say('font sheet: rewritten with the IBM Plex faces');
}

/* ── 4. THE FAMILY SWEEP ─────────────────────────────────────────────────────── */
// CARBON OWNS THE APPLICATION'S OWN FURNITURE, NEVER A MEASURED DESIGN.
// This sweep walks every source file under `src/` and rewrites font families by text. That is
// how five ingested components changed from Figma's `Inter` to `IBM Plex Sans` while the Figma
// map still declared the typeface `verbatim` — a measured design translated by a styling pass,
// with no record that it happened (owner's ruling, 2026-10-26: *"Figma wins, no exception"*).
//
// A generated component is named for its Figma node (`f-<node>-<node>.ts`) and is the one kind of
// file this repository promises to copy exactly, so it is skipped here and nowhere else may it be
// rewritten. A preview folder is not under `src/` at all.
const GENERATED_COMPONENT = /\/components\/lit\/f-\d+-\d+\.ts$/;
const REPLACEMENTS = [
  ["'Inter'", "'IBM Plex Sans'"],
  ["'Nunito'", "'IBM Plex Sans'"],
  ['"Inter"', '"IBM Plex Sans"'],
  ["font-family: Inter, system-ui", 'font-family: "IBM Plex Sans", system-ui'],
  ["ui-monospace", "'IBM Plex Mono'"],
  ["'SF Mono'", "'IBM Plex Mono'"],
  ["SFMono-Regular", "'IBM Plex Mono'"],
  ["'IBM Plex Sans', 'IBM Plex Sans'", "'IBM Plex Sans'"],
];
const sweepDirs = [join(FRONTEND, 'src')];
const sweepFiles = [join(FRONTEND, 'index.html')];
for (const dir of sweepDirs) {
  for (const name of readdirSync(dir, { recursive: true })) {
    const p = join(dir, name);
    if (statSync(p).isFile() && /\.(ts|tsx|css|html)$/.test(p)) sweepFiles.push(p);
  }
}
let sweptFiles = 0;
let sweptHits = 0;
let untouched = 0;
for (const p of sweepFiles) {
  if (GENERATED_COMPONENT.test(p)) {
    untouched += 1;
    continue;
  }
  let text = readFileSync(p, 'utf8');
  let changed = false;
  for (const [from, to] of REPLACEMENTS) {
    while (text.includes(from)) {
      text = text.split(from).join(to);
      changed = true;
      sweptHits += 1;
    }
  }
  if (changed) {
    writeFileSync(p, text);
    sweptFiles += 1;
  }
}
say(`family sweep: ${sweptHits} replacements across ${sweptFiles} files; `
  + `${untouched} generated component(s) left exactly as measured`);

/* ── 5. THE CATALOG TREE ─────────────────────────────────────────────────────── */
try {
  const out = execFileSync('npm', ['run', 'catalog:tree'], { cwd: FRONTEND, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  say('catalog tree: regenerated (' + out.trim().split('\n').filter((l) => l.includes('catalogue')).join('; ') + ')');
} catch (e) {
  say(`catalog tree: FAILED — ${(e.stderr || String(e)).slice(0, 300)}`);
}

console.log('\nDONE. ' + log.filter((l) => l.includes(':')).length + ' steps ran; every step is idempotent.');
