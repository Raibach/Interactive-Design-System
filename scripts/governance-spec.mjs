#!/usr/bin/env node
/**
 * governance-spec.mjs — THE SPEC STORE, AND THE DIGESTS THAT MAKE IT AN AUTHORITY.
 *
 * THE PROBLEM THIS SOLVES. On 2026-09-20 a session read the capture, chose which node to send
 * to the seat, wrote the prompt, took the spec the seat returned, and then HAND-WROTE the Lit
 * component from it — choosing tags, translating numbers, dropping what it judged redundant
 * and inventing behaviour the handoff never stated. The model measured and specified; the
 * agent decided; and the layer that exists to check the agent was being operated by it.
 *
 * THE FIX IS A CHAIN WITH A HASH AT EVERY JOIN:
 *
 *   Figma ──capture──▶ requirements ──SHA──▶ spec ──SHA──▶ component source
 *                       (src/design)        (governance/components)   (src/components/lit)
 *
 * Nothing in that chain is a file somebody can edit into agreement with itself. The
 * requirements hash is over the DRAWING READ — so a spec is pinned to the exact requirements it
 * answered, and a capture that moves invalidates the spec rather than being quietly absorbed.
 * The source hash is over the bytes the generator produces — so a hand edit is detectable by
 * arithmetic, not by asking anyone to admit it.
 *
 * WHAT IT IS NOT: it does not choose nodes, does not prompt, and does not write components.
 * It records what was read, what was answered, and the two hashes that bind them.
 *
 * Usage:
 *   node scripts/governance-spec.mjs --node 40001119:6308                      # show the requirements + digest
 *   node scripts/governance-spec.mjs --node 40001119:6308 --record <file.json>  # store a spec the seat returned
 *   node scripts/governance-spec.mjs --check                                    # every stored spec against its capture
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const SPEC_DIR = join(REPO, 'governance', 'components');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const flag = (n) => args.includes(n);

export const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** The kebab tag a layer name yields. The name is the designer's; this only spells it. */
export const tagOf = (name) => String(name || 'component').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * THE REQUIREMENTS, READ FROM THE DRAWING AND NOTHING ELSE.
 *
 * Every layer under the node, every value the read measured, and the annotation — which is
 * where the behaviour is written and is the only place it is written. NO LIT SOURCE IS READ,
 * so nothing produced from this can be a diff against an implementation: there is no
 * implementation in the room. That is the whole point, and it is why this is a separate
 * function from anything in design-value-check.mjs.
 */
export function requirementsFor(scope, nodeId) {
  const cap = JSON.parse(readFileSync(join(DESIGN_DIR, `${scope}.json`), 'utf8'));
  const by = Object.fromEntries(cap.result.nodes.map((n) => [n.id, n]));
  if (!by[nodeId]) return null;
  const lines = [];
  const walk = (id, depth) => {
    const n = by[id]; if (!n) return;
    const p = [];
    const push = (k, v) => { if (v !== undefined && v !== null && v !== '') p.push(`${k}=${v}`); };
    push('w', n.w); push('h', n.h);
    push('layout', n.layout);
    push('sizing', n.sizingH || n.sizingV ? `${n.sizingH || ''}/${n.sizingV || ''}` : '');
    push('gap', n.gap);
    if (n.pad) push('pad', `T${n.pad.paddingTop} R${n.pad.paddingRight} B${n.pad.paddingBottom} L${n.pad.paddingLeft}`);
    push('primary', n.primaryAlign); push('counter', n.counterAlign);
    push('fill', n.fill);
    push('stroke', n.stroke ? `${n.stroke}${n.strokeW !== undefined ? ` w=${n.strokeW}` : ''}` : '');
    push('radius', n.radius); push('opacity', n.opacity);
    if (n.text) push('text', `${n.text.family} ${n.text.weight} ${n.text.size}px lh=${n.text.lh} align=${n.text.align} color=${n.fill} chars="${n.text.characters}"`);
    lines.push(`${'  '.repeat(depth)}${n.id}  ${n.type}  ${n.name}   [${p.join(' · ')}]`);
    for (const a of n.annotations || []) lines.push(`${'  '.repeat(depth + 1)}ANNOTATION: ${String(a).replace(/\n/g, ' | ')}`);
    for (const ch of n.children || []) walk(ch, depth + 1);
  };
  walk(nodeId, 0);
  const text = lines.join('\n');
  const root = by[nodeId];
  return {
    nodeId,
    scope,
    name: root.name,
    tag: tagOf(root.name),
    layerIds: Object.keys(by).filter((id) => {
      let cur = by[id];
      while (cur) { if (cur.id === nodeId) return true; cur = cur.parent ? by[cur.parent] : null; }
      return false;
    }),
    text,
    digest: sha(text),
    captureDigest: sha(readFileSync(join(DESIGN_DIR, `${scope}.json`), 'utf8')),
  };
}

/** Where a component's spec lives. One file per component, named by the designer's own name. */
export const specPath = (tag) => join(SPEC_DIR, `${tag}.spec.json`);

/** Read a stored spec, or null. */
export function readSpec(tag) {
  const p = specPath(tag);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/** Store the spec the seat returned, bound to the requirements it answered. */
export function writeSpec(tag, spec, req) {
  mkdirSync(SPEC_DIR, { recursive: true });
  const record = {
    _whatThisIs: 'The seat\'s build spec for one component, and the digests that bind it to the drawing it answered. The component source in src/components/lit/ is a BUILD OUTPUT of this file — do not hand-edit that source; regenerate it.',
    tag,
    nodeId: req.nodeId,
    scope: req.scope,
    requirementsDigest: req.digest,
    captureDigest: req.captureDigest,
    layerIds: req.layerIds,
    model: spec.model,
    at: new Date().toISOString(),
    spec: spec.spec,
  };
  writeFileSync(specPath(tag), JSON.stringify(record, null, 2) + '\n');
  return record;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const NODE = opt('--node', null);
  const SCOPE = opt('--scope', 'chat-column');
  const RECORD = opt('--record', null);

  if (flag('--check')) {
    mkdirSync(SPEC_DIR, { recursive: true });
    const files = readdirSync(SPEC_DIR).filter((f) => f.endsWith('.spec.json'));
    if (!files.length) { console.log('[governance-spec] no specs stored yet.'); process.exit(0); }
    let stale = 0;
    for (const f of files) {
      const s = JSON.parse(readFileSync(join(SPEC_DIR, f), 'utf8'));
      const req = requirementsFor(s.scope, s.nodeId);
      if (!req) { console.log(`  ${s.tag.padEnd(24)} the node is not in the ${s.scope} capture — the drawing moved`); stale++; continue; }
      if (req.digest !== s.requirementsDigest) { console.log(`  ${s.tag.padEnd(24)} STALE — the drawing changed since this spec answered it`); stale++; continue; }
      console.log(`  ${s.tag.padEnd(24)} current · ${s.layerIds.length} layer(s) · answered ${s.at}`);
    }
    process.exit(stale ? 2 : 0);
  }

  if (!NODE) {
    console.log('usage: node scripts/governance-spec.mjs --node <id> [--scope <scope>] [--record <spec.json>]');
    console.log('       node scripts/governance-spec.mjs --check');
    process.exit(2);
  }

  const req = requirementsFor(SCOPE, NODE);
  if (!req) { console.error(`[governance-spec] ${NODE} is not in the ${SCOPE} capture.`); process.exit(2); }

  if (RECORD) {
    const spec = JSON.parse(readFileSync(RECORD, 'utf8'));
    const rec = writeSpec(req.tag, spec, req);
    console.log(`[governance-spec] stored ${specPath(req.tag).replace(REPO + '/', '')}`);
    console.log(`  tag ${rec.tag} · node ${rec.nodeId} · ${rec.layerIds.length} layer(s) · requirements ${rec.requirementsDigest}`);
  } else {
    console.log(req.text);
    console.log('');
    console.log(`tag:        ${req.tag}`);
    console.log(`layers:     ${req.layerIds.length}`);
    console.log(`requirements digest: ${req.digest}`);
    console.log(`capture digest:      ${req.captureDigest}`);
  }
}
