#!/usr/bin/env node
/**
 * import-audit.mjs — GOVERNANCE LAYER 1: Import Provenance & Pipeline Audit.
 *
 * Every Figma → Lit import pass must produce a machine-readable audit record.
 * The audit is the boundary between "the design said this" and "the system
 * guessed this." Nothing crosses that boundary unlabeled.
 *
 * States (every component gets exactly one):
 *   VERBATIM         name/structure/behavior all from Figma; no inference.
 *   STRUCTURAL_ONLY  visual shell; no annotation; behavior stubbed TODO.
 *   INFERRED         something generated NOT in the Figma data.
 *   MANUAL           `managed: "manual"` — skipped every pass.
 *   FAILED           node could not be resolved (pull/instance→variant).
 *
 * Hard rules enforced here:
 *   1. No silent inference — every invented field lands in `inferred[]`.
 *   2. Annotation text stored verbatim + SHA-256.
 *   3. `annotationAttrSeen` records the exact attribute the endpoint emitted.
 *   4. FAILED ≠ empty (STRUCTURAL_ONLY).
 *   5. Zero annotations across the whole pass → exit non-zero.
 *   6. MANUAL components are skipped, never pulled.
 *
 * Output: frontend/.figma-cache/import-audit/{timestamp}.json (append-only)
 *         + stdout human report.
 *
 * Usage: node scripts/import-audit.mjs [--mcp URL] [--file-key KEY] [--root id1,id2]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = join(ROOT, 'src', 'components', 'registry.json');
const AUDIT_DIR = join(ROOT, '.figma-cache', 'import-audit');
const DEFAULT_MCP = 'http://127.0.0.1:3845/mcp';
const DEFAULT_FILE_KEY = '20UPR2KQMsbAxlo5NJb1se';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt; };
const MCP_URL = opt('--mcp', DEFAULT_MCP);
const FILE_KEY = opt('--file-key', DEFAULT_FILE_KEY);
const ROOT_ARG = opt('--root', null);
const ROOT_NODES = ROOT_ARG ? ROOT_ARG.split(',').map((s) => s.trim()).filter(Boolean) : null;

let SESSION = null, JSON_ID = 0;
async function mcpCall(method, params = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (SESSION) headers['Mcp-Session-Id'] = SESSION;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: ++JSON_ID, method, params }) });
  if (!SESSION) { const sid = res.headers.get('Mcp-Session-Id'); if (sid) SESSION = sid; }
  const text = await res.text();
  const data = text.split(/\r?\n/).filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
  return data ? JSON.parse(data) : {};
}

const ANNOTATION = /(data-[a-zA-Z0-9-]*annotation[a-zA-Z0-9-]*)\s*=\s*"([^"]*)"/gi;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function extractAnnotations(text) {
  const found = [];
  for (const m of text.matchAll(/<(\w+)([^>]*?)data-node-id="([^"]+)"([^>]*?)>/g)) {
    const allAttrs = m[2] + ' ' + m[4];
    for (const am of allAttrs.matchAll(ANNOTATION)) found.push({ nodeId: m[3], attribute: am[1], value: am[2] });
  }
  return found;
}

function extractEvents(litFile) {
  try {
    const src = readFileSync(litFile, 'utf8');
    return [...new Set([...src.matchAll(/dispatchEvent\(\s*new\s+CustomEvent\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
  } catch { return []; }
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
const components = ROOT_NODES
  ? registry.components.filter((c) => ROOT_NODES.includes(c.figmaNodeId))
  : registry.components;

await mcpCall('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'import-audit', version: '1.0.0' } });

const annotationAttrSeen = new Set();
const records = [];

for (const c of components) {
  const base = { figmaNodeId: c.figmaNodeId, figmaName: c.figmaName, litTag: c.litComponent, litFile: c.file, registryEntry: `registry.json#${c.litComponent}` };
  if (c.managed === 'manual') { records.push({ ...base, state: 'MANUAL', annotation: { found: false }, inferred: [], gaps: [], skipped: true }); continue; }
  if (!c.figmaNodeId) { records.push({ ...base, state: 'FAILED', annotation: { found: false }, inferred: [], gaps: [], error: 'no figmaNodeId in registry' }); continue; }
  let annotations = [], err = null;
  try {
    const r = await mcpCall('tools/call', { name: 'get_design_context', arguments: { nodeId: c.figmaNodeId, clientLanguages: 'typescript', clientFrameworks: 'lit', excludeScreenshot: true } });
    if (r.isError || r.error) err = JSON.stringify(r.error || r.result?.error);
    else { const text = r.result?.content?.find((x) => x.type === 'text')?.text || ''; annotations = extractAnnotations(text); for (const a of annotations) annotationAttrSeen.add(a.attribute); }
  } catch (e) { err = e.message; }
  if (err) { records.push({ ...base, state: 'FAILED', annotation: { found: false }, inferred: [], gaps: [], error: err }); continue; }
  const own = annotations.filter((a) => a.nodeId === c.figmaNodeId);
  if (!own.length) {
    records.push({ ...base, state: 'STRUCTURAL_ONLY', annotation: { found: false }, inferred: [], gaps: ['no annotation on this node'], descendantAnnotations: annotations.map((a) => ({ nodeId: a.nodeId, attribute: a.attribute, value: a.value })) });
    continue;
  }
  const text = own[0].value;
  const structured = /^\s*On click\s*:/m.test(text);
  const record = { ...base, state: structured ? 'VERBATIM' : 'INFERRED', annotation: { found: true, attribute: own[0].attribute, text, sha256: sha256(text), verbatim: true }, inferred: [], gaps: [] };
  if (!structured) record.inferred = extractEvents(c.file).map((e) => ({ field: 'event.name', value: e, reason: 'annotation is prose, no `On click:` field' }));
  records.push(record);
}

const summary = records.reduce((a, r) => { a[r.state] = (a[r.state] || 0) + 1; return a; }, {});
summary.scanned = records.length;
const totalAnnotations = records.reduce((n, r) => n + (r.annotation?.found ? 1 : 0), 0);
const pass = stamp();
const audit = { pass, fileKey: FILE_KEY, rootNodes: ROOT_NODES || registry.components.filter((c) => c.figmaNodeId).map((c) => c.figmaNodeId), tool: 'com.figma.mcp/get_design_context', annotationAttrSeen: [...annotationAttrSeen].sort(), summary, components: records };

mkdirSync(AUDIT_DIR, { recursive: true });
let file = join(AUDIT_DIR, `${pass}.json`);
let n = 1;
while (existsSync(file)) { file = join(AUDIT_DIR, `${pass}-${n}.json`); n++; }
writeFileSync(file, JSON.stringify(audit, null, 2) + '\n');

const pad = (s) => String(s).padEnd(17);
const lines = [];
lines.push(`IMPORT AUDIT — ${pass}`);
lines.push(`  ${pad('VERBATIM')} ${summary.VERBATIM || 0}   ✅ design and code agree`);
lines.push(`  ${pad('STRUCTURAL_ONLY')} ${summary.STRUCTURAL_ONLY || 0}   ⚠️  designer: ${summary.STRUCTURAL_ONLY || 0} components need annotations`);
lines.push(`  ${pad('INFERRED')} ${summary.INFERRED || 0}   ⚠️  designer: ${summary.INFERRED || 0} annotations need structured format`);
lines.push(`  ${pad('MANUAL')} ${summary.MANUAL || 0}   ⏭  skipped by design`);
lines.push(`  ${pad('FAILED')} ${summary.FAILED || 0}   🔧 pipeline: ${summary.FAILED || 0} resolution failures`);
const inferredRows = records.filter((r) => r.state === 'INFERRED' && r.inferred.length);
if (inferredRows.length) { lines.push(''); lines.push('  INFERRED FIELDS (needs authoring fix):'); for (const r of inferredRows) lines.push(`    ${r.litTag}  → ${r.inferred.map((i) => `${i.field}: "${i.value}"`).join(', ')}`); }
const structuralRows = records.filter((r) => r.state === 'STRUCTURAL_ONLY');
if (structuralRows.length) { lines.push(''); lines.push('  STRUCTURAL_ONLY (needs annotation):'); for (const r of structuralRows) lines.push(`    ${r.figmaNodeId || '(no node)'}  ${r.figmaName}`); }
const failedRows = records.filter((r) => r.state === 'FAILED');
if (failedRows.length) { lines.push(''); lines.push('  FAILED (needs pipeline fix):'); for (const r of failedRows) lines.push(`    ${r.litTag}  ${r.error}`); }
lines.push('');
lines.push(`  audit → ${file}`);
console.log(lines.join('\n'));

if (totalAnnotations === 0) {
  console.error('\n[import-audit] FAIL: 0 annotations found across the pass. The matcher or the scope is wrong — not that designers wrote nothing.');
  process.exit(1);
}
