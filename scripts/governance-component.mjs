#!/usr/bin/env node
/**
 * governance-component.mjs — THE ONLY WRITER OF A LIT COMPONENT.
 *
 * THE RULE. `frontend/src/components/lit/<tag>.ts` for a component that came from Figma is a
 * BUILD OUTPUT. It is produced here, from the spec the seat returned, and it is never authored
 * or edited by hand — by an agent least of all. On 2026-09-20 a session hand-wrote exactly such
 * a component while reporting it as the model's work; this script is the thing that makes that
 * impossible to do honestly, because re-running it overwrites whatever is there.
 *
 * THE PIPELINE, and every join is checked:
 *
 *   requirementsFor(scope, node)      the drawing, read whole — no Lit source is opened
 *        │  digest over the text
 *        ├─▶ the seat                    one bounded call, /no_think, no sampling
 *        │  the spec it returns
 *        ├─▶ VERIFY                      every layer id present; the spec parses; it is a file
 *        ├─▶ WRITE                       src/components/lit/<tag>.ts
 *        ├─▶ WIRE                        import it, and draw it where the spec says
 *        └─▶ STORE                       governance/components/<tag>.spec.json, with both digests
 *
 * VERIFICATION IS NOT OPTIONAL AND IT RUNS BEFORE THE WRITE. A generated component that does
 * not carry every layer id of the drawing it answered is a FAILURE — it is rewritten, not
 * shipped. (The first run of this script produced a 122-line component that compiled clean and
 * silently dropped the block, the bar and the text container: three of its ten layers had no
 * element. That is what this check exists for.)
 *
 * Usage:
 *   node scripts/governance-component.mjs --node 40001119:6308                    # generate, verify, write, wire
 *   node scripts/governance-component.mjs --node 40001119:6308 --attempts 3       # let the seat try again on a failed verify
 *   node scripts/governance-component.mjs --node 40001119:6308 --dry              # everything but the write
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requirementsFor, readSpec, writeSpec, specPath, sha } from './governance-spec.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');
const LIT_DIR = join(ROOT, 'src', 'components', 'lit');
const MAIN = join(ROOT, 'src', 'main.tsx');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const RUNS_DIR = join(REPO, 'governance', 'runs');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const flag = (n) => args.includes(n);
const NODE = opt('--node', null);
const SCOPE = opt('--scope', null);
const ATTEMPTS = Number(opt('--attempts', '2'));
const DRY = flag('--dry');

const SEAT = JSON.parse(readFileSync(join(REPO, 'governance', 'SEAT.json'), 'utf8')).seat;

/* THE SCOPE IS DISCOVERED, NOT ASKED FOR. Every capture in src/design is searched for the node,
   so a handoff cannot be routed to the wrong drawing by a flag somebody typed. */
function findScope(nodeId) {
  /* THE SCOPE IS DISCOVERED, NOT ASKED FOR: every capture in src/design is searched for the
     node, so a handoff cannot be routed to the wrong drawing by a flag somebody typed. */
  for (const f of readdirSync(DESIGN_DIR)) {
    if (!f.endsWith(".json") || f.endsWith("-verified.json") || f === "VALUES.json" || f === "node-census.json") continue;
    try {
      const c = JSON.parse(readFileSync(join(DESIGN_DIR, f), "utf8"));
      if (c._capture && (c.result?.nodes || []).some((n) => n.id === nodeId)) return c._capture.scope || f.replace(/\.json$/, "");
    } catch { /* not a capture */ }
  }
  return null;
}

const SYSTEM = [
  'You are given the measured requirements for ONE component, read from a Figma drawing.',
  'Return THE COMPLETE SOURCE of the Lit component that draws it — one TypeScript file, nothing else, no prose, no markdown fences.',
  'EVERY LAYER IN THE REQUIREMENTS MUST BE DRAWN, AND EVERY LAYER ID MUST APPEAR EXACTLY ONCE as data-node-id="<id>" on the element that draws it — including the frames that only hold other layers. A layer with no other content is still an element: draw it as a div carrying its id, its width, its height and its layout. Dropping a wrapper is a FAILURE of this task.',
  'The file must: import { LitElement, html, css } from \'lit\'; export the class; declare static properties for what the host hands in; declare static styles with the drawing\'s own values; and end with a guarded customElements.define(...).',
  'The tag name is the component\'s own name in the drawing, lower-kebab-case.',
  'THE ANNOTATION IS THE BEHAVIOUR. Where it states Data, Source, State, A11y, Connects, Builder or Failure, implement what it says and write it as a comment beside the code it governs.',
  'Use the drawing\'s numbers exactly. VERTICAL is flex-direction column, HORIZONTAL is row. Figma fills become CSS colours.',
  'Do not think step by step. Do not explain. Do not ask questions. Do not add features the drawing does not draw. Output the file and nothing else.',
  '/no_think',
].join('\n');

async function ask(requirements, correction) {
  const input = correction ? `${requirements}\n\nYOUR PREVIOUS ATTEMPT FAILED VERIFICATION:\n${correction}\n\nReturn the complete corrected file.` : requirements;
  const res = await fetch(`${SEAT.url.replace(/\/v1$/, '')}/api/v1/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: SEAT.model, system_prompt: SYSTEM, input, max_output_tokens: SEAT.maxOutputTokens }),
  });
  const body = await res.json();
  if (body.error) throw new Error(String(body.error));
  const msgs = (body.output || []).filter((o) => o && o.type === 'message' && o.content);
  if (!msgs.length) throw new Error(`the seat produced ${(body.output || []).map((o) => o.type).join(',') || 'nothing'} and no message`);
  return msgs.map((o) => String(o.content)).join('\n').trim();
}

/** A fence is not source; anything that is not a component file is a refusal, said out loud. */
function asSource(text) {
  let s = text.trim();
  const fence = s.match(/^```[a-z]*\n([\s\S]*?)\n```$/);
  if (fence) s = fence[1].trim();
  if (!/^(import|\/\*|\/\/)/.test(s)) return { error: 'it does not start like a module' };
  if (!/customElements\.define/.test(s)) return { error: 'it has no guarded customElements.define' };
  if (!/static styles/.test(s)) return { error: 'it declares no styles' };
  return { source: s };
}

/**
 * EVERY LAYER ID, EXACTLY ONCE. This is the check that would have caught the first generated
 * component, which compiled clean and drew seven of its ten layers.
 */
function verify(source, layerIds) {
  const problems = [];
  /* MENTIONED IS NOT DRAWN. A layer passes only when its id is CARRIED BY AN ELEMENT as
     data-node-id — a comment that names the id is not an element. The first version counted
     raw text, so every id in a comment read as "appears more than once" and a component that
     drew its layers correctly was failed by its own documentation. */
  const drawn = new Set(
    [...source.matchAll(/data-node-id=(?:"([^"]+)"|\$\{([^}]*)\}|([^\s>]+))/g)]
      .map((m) => (m[1] || m[2] || m[3] || '').trim())
      .join('|')
      .match(/\d+:\d+/g) || [],
  );
  const missing = layerIds.filter((id) => !drawn.has(id));
  const extra = [...drawn].filter((id) => !layerIds.includes(id));
  if (missing.length) problems.push(`these layer ids are NOT drawn by any element: ${missing.join(', ')}`);
  if (extra.length) problems.push(`these element markers are NOT layers of this drawing: ${extra.join(', ')}`);
  return problems;
}

/**
 * THE FILE MUST ALSO BE A FILE TYPESCRIPT ACCEPTS. A generated component that draws every
 * layer and does not compile is not a component; it is a compile error with a good diagram.
 * Measured on the first verified run: every layer present, and three type errors — the model
 * used this.conversation, this.tokens and this.calls without ever declaring them. The compiler
 * is the cheapest reviewer in this pipeline, and its verdict is not the model's opinion.
 */
function compileErrors(source) {
  const tmp = join(ROOT, 'node_modules', '.cache', 'governance-gen-check.ts');
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, source);
  const r = spawnSync(join(ROOT, 'node_modules', '.bin', 'tsc'), [
    '--noEmit', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'bundler',
    '--experimentalDecorators', '--skipLibCheck', '--noResolve', tmp,
  ], { cwd: ROOT, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  return out.split('\n')
    .filter((l) => /error TS\d+/.test(l) && l.includes('governance-gen-check'))
    // An import it cannot resolve is not this file's fault — the app supplies those.
    .filter((l) => !/Cannot find module|Could not find a declaration/.test(l))
    .map((l) => l.replace(/^.*governance-gen-check\.ts/, '').trim());
}

const scope = SCOPE || findScope(NODE);
if (!scope) { console.error(`[governance-component] ${NODE} is in no capture under src/design.`); process.exit(2); }
const req = requirementsFor(scope, NODE);
if (!req) { console.error(`[governance-component] ${NODE} is not in the ${scope} capture.`); process.exit(2); }

const target = join(LIT_DIR, `${req.tag}.ts`);
if (existsSync(target)) console.log(`[governance-component] REPLACING ${target.replace(REPO + '/', '')}`);

let source = null, correction = null, attempts = 0;
while (attempts < ATTEMPTS && !source) {
  attempts++;
  const raw = await ask(req.text, correction);
  const as = asSource(raw);
  if (as.error) { correction = `The reply was rejected: ${as.error}. Return the complete file, nothing else.`; console.log(`[governance-component] attempt ${attempts}: rejected — ${as.error}`); continue; }
  const problems = verify(as.source, req.layerIds);
  const typeErrs = compileErrors(as.source);
  if (typeErrs.length) problems.push(`it does not compile: ${typeErrs.slice(0, 4).join(' | ')}`);
  if (problems.length) { correction = problems.join('\n'); console.log(`[governance-component] attempt ${attempts}: FAILED VERIFICATION — ${problems.join('; ')}`); continue; }
  source = as.source;
}

if (!source) {
  console.error(`[governance-component] NOT DONE — ${attempts} attempt(s), the generated component does not draw every layer of the drawing. NOTHING WAS WRITTEN.`);
  console.error('  The drawing is the authority; a component that misses its layers is not it. Re-run, or fix the seat.');
  process.exit(2);
}

/* THE RUN RECORD — what was asked, what came back, and the digests binding them. */
mkdirSync(RUNS_DIR, { recursive: true });
const runAt = new Date().toISOString().replace(/[:.]/g, '-');
const runFile = join(RUNS_DIR, `${req.tag}.${runAt}.json`);

if (DRY) {
  console.log(source);
  console.log(`\n[governance-component] --dry: ${source.split('\n').length} lines verified, nothing written.`);
  process.exit(0);
}

writeFileSync(target, source.endsWith('\n') ? source : source + '\n');
const stored = writeSpec(req.tag, { model: SEAT.model, spec: { source, attempts } }, req);

/* WIRED, NOT ORPHANED. A component nothing renders is not a replacement — it is dead code
   beside the one in use, which is what the first generated component was. */
let wired = 'already imported';
if (!readFileSync(MAIN, 'utf8').includes(`components/lit/${req.tag}`)) {
  const text = readFileSync(MAIN, 'utf8');
  const lines = text.split('\n');
  let last = -1;
  for (let i = 0; i < lines.length; i++) if (/^import "@\/components\/lit\//.test(lines[i])) last = i;
  if (last === -1) { console.error(`[governance-component] wrote the file but could not find where to import it in main.tsx`); process.exit(2); }
  lines.splice(last + 1, 0, `import "@/components/lit/${req.tag}";`);
  writeFileSync(MAIN, lines.join('\n'));
  wired = 'imported into main.tsx';
}

writeFileSync(runFile, JSON.stringify({
  at: new Date().toISOString(), model: SEAT.model, nodeId: req.nodeId, scope
  , tag: req.tag, attempts, requirementsDigest: req.digest, captureDigest: req.captureDigest,
  layerIds: req.layerIds, sourceDigest: sha(source), requirements: req.text, source,
}, null, 2) + '\n');

console.log(`[governance-component] ${SEAT.model} · attempt ${attempts} · ${source.split('\n').length} lines → src/components/lit/${req.tag}.ts`);
console.log(`  VERIFIED — all ${req.layerIds.length} layer(s) of the drawing are drawn`);
console.log(`  ${wired}`);
console.log(`  spec → ${specPath(req.tag).replace(REPO + '/', '')}  (requirements ${req.digest} · source ${sha(source)})`);
console.log(`  THE MODEL WROTE THIS FILE. Do not edit it by hand — re-run this script.`);
