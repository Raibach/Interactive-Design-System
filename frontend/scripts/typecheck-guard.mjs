#!/usr/bin/env node
/**
 * typecheck-guard.mjs — make sure a type-check actually checks something.
 *
 * tsconfig.json in this repository is a SOLUTION file:
 *
 *     { "files": [], "references": [ tsconfig.app.json, tsconfig.node.json ] }
 *
 * So `tsc --noEmit -p tsconfig.json` has NO INPUTS. It exits 0 having read
 * nothing, and will happily pass a file with a syntax error in it — which is
 * exactly what happened: it reported clean on a broken tag-registry.ts for a
 * whole session while `npm run build` (which runs `tsc -b`) kept failing. A
 * green check that inspects an empty set is worse than no check, because it is
 * believed.
 *
 * This guard asserts the shape is what we expect and that every referenced
 * project actually declares inputs, so `tsc -b` cannot quietly become vacuous
 * either. Run it before a type-check; fail loud, since its whole purpose is to
 * stop a silent pass.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname);
const ROOT = resolve(HERE, '..');
const readJson = (p) => JSON.parse(stripJsonc(readFileSync(p, 'utf8')));

/**
 * tsconfig files are JSONC — TypeScript allows comments — so a plain JSON.parse
 * rejects every one of them. Strip comments and trailing commas first. Kept
 * deliberately small: it only has to survive config files, not arbitrary input.
 */
function stripJsonc(text) {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (c === '\n') { inLine = false; out += c; }
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') { inBlock = false; i += 1; }
      continue;
    }
    if (inString) {
      out += c;
      if (c === '\\') { out += next ?? ''; i += 1; } else if (c === '"') { inString = false; }
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && next === '/') { inLine = true; i += 1; continue; }
    if (c === '/' && next === '*') { inBlock = true; i += 1; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

const root = readJson(join(ROOT, 'tsconfig.json'));
const rootInputs = (root.files?.length ?? 0) + (root.include?.length ?? 0);

if (rootInputs === 0 && (root.references?.length ?? 0) === 0) {
  console.error(
    'typecheck-guard: tsconfig.json declares neither inputs nor references.\n' +
    '  Nothing would be checked. Point it at source, or add project references.',
  );
  process.exit(1);
}

if (rootInputs === 0) {
  console.log(`typecheck-guard: solution root (${root.references.length} project reference(s)) — checking them, not this file.`);
}

let empty = 0;
for (const ref of root.references ?? []) {
  const p = join(ROOT, ref.path);
  const projectFile = existsSync(p) ? p : `${p}.json`;
  if (!existsSync(projectFile)) {
    console.error(`typecheck-guard: reference "${ref.path}" does not exist (looked for ${projectFile}).`);
    empty += 1;
    continue;
  }
  const project = readJson(projectFile);
  const inputs = (project.files?.length ?? 0) + (project.include?.length ?? 0);
  if (inputs === 0) {
    console.error(
      `typecheck-guard: ${ref.path} declares no inputs — a project that checks nothing.\n` +
      '  Add "include" (or "files") so tsc has source to compile.',
    );
    empty += 1;
  } else {
    console.log(`typecheck-guard: ${ref.path} — ${inputs} input pattern(s).`);
  }
}

if (empty > 0) process.exit(1);
console.log('typecheck-guard: ok');
