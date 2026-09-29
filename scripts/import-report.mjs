#!/usr/bin/env node
/**
 * import-report.mjs — design import report (annotated vs missing vs unmapped).
 *
 * Pulls get_design_context for every registry component's Figma node, extracts
 * the Dev Mode annotation (attribute name untrusted: /^data-.*annotation/i),
 * and emits a report the human and the application can both read.
 *
 * Status per component:
 *   ✓ ANNOTATED    — an annotation was found on its node or a descendant
 *   ⚠ MISSING      — node pulled, zero annotations anywhere (a §5 gap)
 *   ✗ NO-NODE      — registry entry has null figmaNodeId (nothing to pull)
 *   ✗ PULL-FAIL    — MCP pull errored
 *
 * Output:
 *   stdout        — human-readable report + §5 gap list
 *   --out base    — also writes base.json (machine-readable) + base.txt
 *
 * Usage:
 *   node scripts/import-report.mjs [--mcp URL] [--out base]
 *
 * This is the report the application's "import from Figma" flow will surface:
 * which components succeeded, which are still un-annotated, and (via the
 * registry `provenance` field) which behavior is verbatim vs inferred.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // frontend/
const REGISTRY_PATH = join(ROOT, 'src', 'components', 'registry.json');
const DEFAULT_MCP = 'http://127.0.0.1:3845/mcp';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt; };
const MCP_URL = opt('--mcp', DEFAULT_MCP);
const OUT_BASE = opt('--out', null);

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

// Pair each annotation with the data-node-id it is attached to (own vs descendant).
function extractAnnotations(text) {
  const found = [];
  for (const m of text.matchAll(/<(\w+)([^>]*?)data-node-id="([^"]+)"([^>]*?)>/g)) {
    const allAttrs = m[2] + ' ' + m[4];
    const name = (allAttrs.match(/data-name="([^"]*)"/) || [])[1];
    for (const am of allAttrs.matchAll(ANNOTATION)) {
      found.push({ nodeId: m[3], name, attribute: am[1], value: am[2] });
    }
  }
  return found;
}

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));

await mcpCall('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'import-report', version: '1.0.0' } });

const rows = [];
for (const c of registry.components) {
  const nodeId = c.figmaNodeId;
  if (!nodeId) { rows.push({ litComponent: c.litComponent, figmaName: c.figmaName, nodeId: null, status: 'NO-NODE', annotations: [] }); continue; }
  let annotations = [], err = null;
  try {
    const r = await mcpCall('tools/call', { name: 'get_design_context', arguments: { nodeId, clientLanguages: 'typescript', clientFrameworks: 'lit', excludeScreenshot: true } });
    if (r.isError || r.error) err = JSON.stringify(r.error || r.result?.error);
    else { const text = r.result?.content?.find((x) => x.type === 'text')?.text || ''; annotations = extractAnnotations(text); }
  } catch (e) { err = e.message; }
  const own = annotations.some((a) => a.nodeId === nodeId);
  const status = err ? 'PULL-FAIL' : (own ? 'ANNOTATED' : (annotations.length ? 'DESCENDANT-ONLY' : 'MISSING'));
  rows.push({ litComponent: c.litComponent, figmaName: c.figmaName, nodeId, status, annotations, err, provenance: c.provenance || null });
}

const summary = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
const gaps = rows.filter((r) => r.status !== 'ANNOTATED');

const lines = [];
lines.push('DESIGN IMPORT REPORT');
lines.push('====================');
lines.push(`generated: ${new Date().toISOString()}`);
lines.push(`mcp: ${MCP_URL}`);
lines.push(`summary: ${JSON.stringify(summary)}`);
lines.push('');
for (const r of rows) {
  const icon = { ANNOTATED: '✓', 'DESCENDANT-ONLY': '⚠', MISSING: '⚠', 'NO-NODE': '✗', 'PULL-FAIL': '✗' }[r.status] || '?';
  lines.push(`${icon} [${r.status}] ${r.litComponent}  (${r.figmaName}${r.nodeId ? ' · ' + r.nodeId : ' · no node'})`);
  if (r.err) lines.push(`     error: ${r.err}`);
  for (const a of r.annotations) {
    const own = a.nodeId === r.nodeId ? 'own' : 'desc';
    lines.push(`     ${a.attribute} [${a.nodeId} ${own}]: ${a.value}`);
  }
}
lines.push('');
lines.push('GAP REPORT (§5) — components with zero annotations (need designer annotation):');
for (const g of gaps) {
  const why = g.status === 'NO-NODE' ? 'no figmaNodeId' : (g.status === 'PULL-FAIL' ? 'pull failed' : (g.status === 'DESCENDANT-ONLY' ? 'only descendant annotations (self un-annotated)' : 'zero annotations'));
  lines.push(`  ⚠ ${g.litComponent} (${g.figmaName}) — ${why}`);
}
const report = lines.join('\n');
console.log(report);
if (OUT_BASE) {
  writeFileSync(`${OUT_BASE}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), mcp: MCP_URL, summary, rows, gaps: gaps.map((g) => g.litComponent) }, null, 2));
  writeFileSync(`${OUT_BASE}.txt`, report);
  console.log(`\nreport → ${OUT_BASE}.json / .txt`);
}
