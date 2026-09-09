#!/usr/bin/env node
/**
 * fidelity-check.mjs — Figma→Lit STRUCTURAL fidelity harness.
 *
 * Detects tree-level drift between the live Figma Dev Mode MCP pull and the
 * Lit templates' `data-node-id` census. This is the structural check that
 * computed-style checks cannot see: doubled elements, missing nodes,
 * agent-invented ids.
 *
 * Status classes (owner-approved 2026-09-09):
 *   MATCH             id in pull, id in code, count 1:1
 *   MISSING-IN-CODE   id in pull, 0 refs in code           (code bookkeeping gap)
 *   EXTRA-IN-CODE     id in code, 0 in pull                (agent invented / stale id)
 *   DUPLICATED        id in pull, >1 refs in code          (doubled-element signature)
 *   INSTANCE-OF       clone-range id absent from code whose resolved data-name
 *                     matches a registry component. COUNTED AND REPORTED — never
 *                     silently suppressed (a hidden INSTANCE-OF is the new stale spec).
 *
 * INSTANCE-OF guardrail: only clone ids (present in the container pull but in NO
 * definition pull) whose resolved data-name has a registry entry qualify. Every
 * other clone stays MISSING-IN-CODE, so the label can never become a catch-all.
 *
 * READ-ONLY over components. Writes nothing except the report you ask for.
 *
 * Usage:
 *   node scripts/fidelity-check.mjs [--scope section|container|rail|accordion|components|all]
 *                                   [--mode live|cache] [--mcp URL] [--out base]
 *                                   [--capture]
 *
 * Change tracking: without --capture, every scope run diffs the fresh pull
 * against the last captured baseline (frontend/src/design/node-census.json)
 * and prints "FIGMA CHANGED SINCE BASELINE" (ADDED/REMOVED/COUNT-CHANGED).
 * With --capture, the current pulls become the new baseline. Version the
 * census file in git; `git diff` on it is the Figma change log.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // frontend/
const REPO = join(ROOT, '..');
const REGISTRY_PATH = join(REPO, 'frontend', 'src', 'components', 'registry.json');
const LIT_DIR = join(ROOT, 'src', 'components', 'lit');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const DEFAULT_MCP = 'http://127.0.0.1:3845/mcp';

// ── CLI ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt;
};
const SCOPE = opt('--scope', 'all');
const MODE = opt('--mode', 'live');
const OUT_BASE = opt('--out', null);
const MCP_URL = opt('--mcp', DEFAULT_MCP);
const CAPTURE = args.includes('--capture');

// Change-tracking baseline: captured from a known-good pull, diffed on every
// future run. git-version this file and `git diff` on it = the Figma change
// log (added/removed/duplicated nodes over time).
const CENSUS_PATH = join(DESIGN_DIR, 'node-census.json');

const SCOPES = {
  section: {
    root: '40000746:94',
    code: [join(LIT_DIR, 'prompt-input', '*.ts')],
  },
  container: {
    root: '40000746:6',
    code: [join(LIT_DIR, 'prompt-input', '*.ts'), join(LIT_DIR, 'prompt-section-editor.ts')],
  },
  rail: {
    root: '40000880:270',
    code: [join(LIT_DIR, 'prompt-input', 'prompt-container.ts')],
  },
  accordion: {
    root: '40000880:345',
    code: [
      join(LIT_DIR, 'prompt-input', 'prompt-input-section.ts'),
      join(LIT_DIR, 'prompt-input', 'role-tile.ts'),
    ],
  },
};

// ── small utils ──────────────────────────────────────────────────────
function expandFiles(patterns) {
  const out = [];
  for (const p of patterns) {
    if (p.includes('*')) {
      const dir = dirname(p);
      const pat = basename(p);
      for (const f of readdirSync(dir)) {
        if (f.endsWith('.ts') && (pat === '*.ts' ? true : f === pat)) out.push(join(dir, f));
      }
    } else {
      out.push(p);
    }
  }
  return [...new Set(out)].sort();
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function loadRegistry() {
  const reg = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  return reg.components;
}

function registryMatch(name, registry) {
  const target = norm(name);
  if (!target) return null;
  return registry.find(
    (c) => norm(c.figmaName) === target || norm(c.litComponent) === target,
  ) || null;
}

// ── MCP client (streamable-HTTP, SSE) ────────────────────────────────
let SESSION = null;
let JSON_ID = 0;

async function mcpCall(method, params = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (SESSION) headers['Mcp-Session-Id'] = SESSION;
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++JSON_ID, method, params }),
  });
  if (!SESSION) {
    const sid = res.headers.get('Mcp-Session-Id');
    if (sid) SESSION = sid;
  }
  const text = await res.text();
  const data = text.split(/\r?\n/).filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
  return data ? JSON.parse(data) : {};
}

async function mcpInitialize() {
  await mcpCall('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'fidelity-check', version: '1.0.0' },
  });
}

async function pullDesign(nodeId) {
  const r = await mcpCall('tools/call', {
    name: 'get_design_context',
    arguments: { nodeId, clientLanguages: 'typescript', clientFrameworks: 'lit', excludeScreenshot: true },
  });
  if (r.isError || r.error) throw new Error(`MCP error pulling ${nodeId}: ${JSON.stringify(r.error || r.result?.error)}`);
  const text = r.result?.content?.find((c) => c.type === 'text')?.text;
  if (!text) throw new Error(`Empty design context for node ${nodeId}`);
  return text;
}

function cachePullFor(nodeId) {
  const map = { '40000746:94': 'prompt-input-section', '40000746:6': null, '40000880:270': null, '40000880:345': 'prompt-accordion' };
  const f = map[nodeId];
  if (!f) throw new Error(`No design cache for node ${nodeId} — run --mode live`);
  const raw = JSON.parse(readFileSync(join(DESIGN_DIR, `${f}.json`), 'utf8'));
  const t = raw.result?.content?.find((c) => c.type === 'text')?.text;
  if (!t) throw new Error(`Cache ${f}.json has no text content`);
  return t;
}

// ── change-tracking baseline (node census) ───────────────────────────
function loadBaseline() {
  try { return JSON.parse(readFileSync(CENSUS_PATH, 'utf8')); } catch { return null; }
}

// Pull text → { root, nodes: { nodeId: { name, count } } } for one scope root.
function censusScope(sc, pullText) {
  const body = codeBody(pullText);
  const els = parseBody(body);
  const nodes = {};
  for (const el of els) {
    if (!el.nodeId) continue;
    if (!nodes[el.nodeId]) nodes[el.nodeId] = { name: resolvedName(el, els) || null, count: 0 };
    nodes[el.nodeId].count++;
  }
  return { root: SCOPES[sc].root, nodes };
}

// Compare a scope's current census against a previous baseline entry.
function diffBaseline(entry, cur) {
  const added = [], removed = [], changed = [];
  for (const [id, info] of Object.entries(cur.nodes)) {
    const prev = entry.nodes[id];
    if (!prev) added.push({ id, name: info.name });
    else if (prev.count !== info.count) changed.push({ id, name: info.name, from: prev.count, to: info.count });
  }
  for (const id of Object.keys(entry.nodes)) {
    if (!cur.nodes[id]) removed.push({ id, name: entry.nodes[id].name });
  }
  return { added, removed, changed };
}

function renderBaselineChange(bl) {
  const lines = [];
  if (bl.added.length) lines.push('  ADDED-IN-FIGMA:      ' + bl.added.map((x) => `${x.id} ${x.name || '(unnamed)'}`).join(' , '));
  if (bl.removed.length) lines.push('  REMOVED-IN-FIGMA:    ' + bl.removed.map((x) => `${x.id} ${x.name || '(unnamed)'}`).join(' , '));
  if (bl.changed.length) lines.push('  COUNT-CHANGED:       ' + bl.changed.map((x) => `${x.id} ${x.name || '(unnamed)'} ${x.from}→${x.to}`).join(' , '));
  return lines.length ? lines.join('\n') : '  (no changes vs baseline)';
}

// ── pull text → code body (strip instruction blocks) ─────────────────
function codeBody(text) {
  for (const cut of ['SUPER CRITICAL', '----block----']) {
    const i = text.indexOf(cut);
    if (i >= 0) return text.slice(0, i);
  }
  return text;
}

// ── minimal JSX element parser (quotes aware) ────────────────────────
function skipTag(s, from) {
  let q = null;
  for (let j = from; j < s.length; j++) {
    const ch = s[j];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === '>') return j;
  }
  return s.length;
}

function parseBody(body) {
  const els = [];
  const stack = [];
  let i = 0;
  const n = body.length;
  while (i < n) {
    const c = body[i];
    if (c === '<' && i + 1 < n && /[A-Za-z/!]/.test(body[i + 1])) {
      const closing = body[i + 1] === '/';
      const j = body[i + 1] === '!'
        ? body.indexOf('>', i) + 1
        : skipTag(body, i + (closing ? 2 : 1));
      const tagStr = body.slice(i + (closing ? 2 : 1), j);
      const slashEnd = tagStr.endsWith('/');
      const cleanTag = slashEnd ? tagStr.slice(0, -1) : tagStr;
      const mName = cleanTag.match(/^[A-Za-z][\w.-]*/);
      const el = {
        tag: mName ? mName[0] : '?',
        nodeId: (cleanTag.match(/data-node-id="([^"]+)"/) || [])[1],
        name: (cleanTag.match(/data-name="([^"]+)"/) || [])[1],
        start: i,
        end: -1,
        children: [],
      };
      if (closing) {
        const parent = stack.pop();
        if (parent) parent.end = i;
      } else if (slashEnd) {
        el.end = j + 1;
        if (stack.length) stack[stack.length - 1].children.push(el);
      } else {
        if (stack.length) stack[stack.length - 1].children.push(el);
        stack.push(el);
      }
      els.push(el);
      i = j + 1;
    } else {
      i++;
    }
  }
  for (const el of stack) if (el.end < 0) el.end = n;
  return els;
}

function resolvedName(el, els) {
  if (el.name) return el.name;
  const stk = [el];
  while (stk.length) {
    const e = stk.pop();
    if (e !== el && e.name) return e.name;
    stk.push(...e.children);
  }
  return null;
}
// ── code census ──────────────────────────────────────────────────────
function scanCodeFiles(patterns) {
  const census = new Map(); // id -> [{file, line}]
  for (const f of expandFiles(patterns)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/data-node-id="([^"]+)"/g)) {
      const rel = f.replace(REPO + '/', '');
      const line = src.slice(0, m.index).split('\n').length;
      if (!census.has(m[1])) census.set(m[1], []);
      census.get(m[1]).push({ file: rel, line });
    }
  }
  return census;
}

// ── row classification ───────────────────────────────────────────────
const STATUS_PRIORITY = { DUPLICATED: 0, 'EXTRA-IN-CODE': 1, 'MISSING-IN-CODE': 2, 'INSTANCE-OF': 3, MATCH: 4 };

/**
 * Build the diff rows for one scope.
 * @param pullText    MCP pull text (or cache text) for the scope root
 * @param codeCensus  Map<id, {file,line}[]> from template scan
 * @param defs        Set of definition ids (from the section pull) used to
 *                    decide whether a pull-only id is a clone instance
 * @param registry    registry.json components array
 * @param scopeName   human label for reporting
 */
function diffScope(pullText, codeCensus, defs, registry, scopeName) {
  const body = codeBody(pullText);
  const els = parseBody(body);
  const pullCount = new Map();
  const pullName = new Map();
  for (const el of els) {
    if (!el.nodeId) continue;
    pullCount.set(el.nodeId, (pullCount.get(el.nodeId) || 0) + 1);
    if (!pullName.has(el.nodeId)) pullName.set(el.nodeId, resolvedName(el, els));
  }
  const allIds = new Set([...pullCount.keys(), ...codeCensus.keys()]);
  const rows = [];
  for (const id of allIds) {
    const countFig = pullCount.get(id) || 0;
    const refs = codeCensus.get(id) || [];
    const countCode = refs.length;
    const name = pullName.get(id) || '(code-only)';
    let status;
    if (!countFig) {
      status = 'EXTRA-IN-CODE';
    } else if (!countCode) {
      // pull-only: clone instance (present in container pull, not in the
      // definition pull) AND its resolved name matches a registry component.
      const isClone = !defs.has(id);
      const reg = isClone ? registryMatch(name, registry) : null;
      status = isClone && reg ? 'INSTANCE-OF' : 'MISSING-IN-CODE';
    } else if (countCode > 1) {
      status = 'DUPLICATED';
    } else {
      status = 'MATCH';
    }
    rows.push({
      id, name: name || '(unnamed)', countFig, countCode,
      inFigma: countFig ? 'Y' : 'N', inCode: countCode ? 'Y' : 'N',
      status, refs,
    });
  }
  rows.sort((a, b) =>
    STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
    a.id.localeCompare(b.id));
  const summary = {};
  for (const r of rows) summary[r.status] = (summary[r.status] || 0) + 1;
  return { scopeName, rows, summary, els, pullCount };
}

// ── snapshot extraction for a component subtree ──────────────────────
function collectSubtreeIds(rootEl, els) {
  const ids = new Set();
  const stk = [rootEl];
  while (stk.length) {
    const e = stk.pop();
    if (e.nodeId) ids.add(e.nodeId);
    stk.push(...e.children);
  }
  return ids;
}
// ── report formatting ────────────────────────────────────────────────
function pad(s, w) { s = String(s); return s + ' '.repeat(Math.max(0, w - s.length)); }

function renderTable(rows) {
  const w = { id: 14, name: 26, f: 7, c: 7, cf: 11, cc: 10, st: 14 };
  const head = [
    pad('node id', w.id), pad('name', w.name), pad('inFigma', w.f), pad('inCode', w.c),
    pad('countFig', w.cf), pad('countCode', w.cc), pad('status', w.st),
  ].join(' | ');
  const sep = '-'.repeat(head.length);
  const lines = [sep, head, sep];
  for (const r of rows) {
    lines.push([
      pad(r.id, w.id), pad(r.name, w.name), pad(r.inFigma, w.f), pad(r.inCode, w.c),
      pad(r.countFig, w.cf), pad(r.countCode, w.cc), pad(r.status, w.st),
    ].join(' | '));
  }
  lines.push(sep);
  return lines.join('\n');
}

function renderSummary(summary) {
  const order = ['MATCH', 'MISSING-IN-CODE', 'EXTRA-IN-CODE', 'DUPLICATED', 'INSTANCE-OF'];
  return order.map((k) => `${k} ${summary[k] || 0}`).join(' · ');
}

function renderGapList(rows) {
  const gap = rows.filter((r) => r.status === 'MISSING-IN-CODE' || r.status === 'INSTANCE-OF');
  if (!gap.length) return '   (none — every pull id is carried in code)';
  return gap.map((r) => `   ${pad(r.id, 14)} ${r.name}`).join('\n');
}

function renderRefs(r) {
  if (r.status === 'DUPLICATED' && r.refs.length > 1) {
    return '    doubles at: ' + r.refs.map((x) => `${x.file}:${x.line}`).join(' , ');
  }
  return '';
}

function buildReport(scope, diff, calibration = null) {
  const out = [];
  out.push(`scope: ${scope}`);
  const fail = diff.rows.filter((r) => r.status !== 'MATCH' && r.status !== 'INSTANCE-OF');
  const dup = diff.rows.filter((r) => r.status === 'DUPLICATED');
  out.push('');
  out.push('── PULL-ONLY IDS (in Figma, 0 refs in code) ──────────────────────────');
  out.push(renderGapList(diff.rows));
  if (dup.length) {
    out.push('');
    out.push('── DUPLICATED REFS (doubled element signature) ─────────────────────');
    for (const r of dup) out.push(`   ${r.id}  x${r.countCode}` + renderRefs(r));
  }
  out.push('');
  out.push('── DIFF TABLE ───────────────────────────────────────────────────────');
  out.push(renderTable(diff.rows));
  out.push('');
  out.push('── SUMMARY ──────────────────────────────────────────────────────────');
  out.push(`   ${renderSummary(diff.summary)}`);
  if (calibration) {
    out.push('');
    out.push('── CALIBRATION (gripper groups) ────────────────────────────────────');
    out.push(`   ${calibration}`);
  }
  out.push('');
  out.push(`verdict: ${fail.length ? `FAIL ${fail.length} (${fail[0].status})` : 'PASS — tree is clean'}`);
  return out.join('\n');
}
// ── main ─────────────────────────────────────────────────────────────
const FAILURES = new Set(['DUPLICATED', 'EXTRA-IN-CODE', 'MISSING-IN-CODE']);

async function main() {
  const registry = loadRegistry();
  const reports = [];
  let globalFail = 0;

  if (MODE === 'live') await mcpInitialize();
  const pullFor = MODE === 'live' ? pullDesign : cachePullFor;

  // Section pull is the definition set for every scope (clone-range detection).
  const sectionText = await pullFor('40000746:94');
  const defs = new Set();
  for (const el of parseBody(codeBody(sectionText))) if (el.nodeId) defs.add(el.nodeId);

  const scopes = SCOPE === 'all' ? ['section', 'container', 'rail', 'accordion', 'components'] : [SCOPE];

  const baseline = loadBaseline();
  const captured = {};
  const baselineNotes = new Map(); // scope -> rendered change section

  for (const sc of scopes) {
    try {
      if (sc === 'components') {
        const byNode = new Map(); // nodeId -> pulled text
        const seen = new Set();
        for (const c of registry) {
          if (!c.figmaNodeId || c.status !== 'built') continue;
          if (seen.has(c.litComponent)) continue;
          seen.add(c.litComponent);
          const nodeId = c.figmaNodeId;
          if (!byNode.has(nodeId)) byNode.set(nodeId, await pullFor(nodeId));
          const codeCensus = scanCodeFiles([join(REPO, c.file)]);
          const el = parseBody(codeBody(byNode.get(nodeId)));
          const rootEl = el.find((e) => e.nodeId === nodeId);
          const sub = rootEl ? collectSubtreeIds(rootEl, el) : new Set([nodeId]);
          const subRows = [];
          const subIds = new Set([...sub, ...codeCensus.keys()]);
          for (const id of subIds) {
            const refs = codeCensus.get(id) || [];
            const countCode = refs.length;
            const countFig = sub.has(id) ? 1 : 0;
            const nameEl = el.find((e) => e.nodeId === id);
            const name = nameEl ? resolvedName(nameEl, el) : '(code-only)';
            let status;
            if (!countFig) status = 'EXTRA-IN-CODE';
            else if (!countCode) {
              const reg = !defs.has(id) ? registryMatch(name, registry) : null;
              status = !defs.has(id) && reg ? 'INSTANCE-OF' : 'MISSING-IN-CODE';
            } else {
              status = countCode > 1 ? 'DUPLICATED' : 'MATCH';
            }
            subRows.push({ id, name: name || '(unnamed)', countFig, countCode, inFigma: countFig ? 'Y' : 'N', inCode: countCode ? 'Y' : 'N', status, refs });
          }
          subRows.sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.id.localeCompare(b.id));
          const summary = {};
          for (const r of subRows) summary[r.status] = (summary[r.status] || 0) + 1;
          const compReport = buildReport(`${c.litComponent} (${c.figmaName}, node ${nodeId})`, { rows: subRows, summary });
          reports.push(compReport);
          console.log(compReport);
          console.log();
          for (const r of subRows) if (FAILURES.has(r.status)) globalFail++;
        }
        continue;
      }

      const text = await pullFor(SCOPES[sc].root);
      const codeCensus = scanCodeFiles(SCOPES[sc].code);
      const diff = diffScope(text, codeCensus, defs, registry, sc);

      // Change-tracking: census this pull, diff vs baseline, or stage for capture.
      const census = censusScope(sc, text);
      let baselineNote = null;
      if (baseline?.scopes?.[sc]) {
        baselineNote = renderBaselineChange(diffBaseline(baseline.scopes[sc], census));
      }
      if (CAPTURE) captured[sc] = census;
      baselineNotes.set(sc, baselineNote);
      let calibration = null;
      if (sc === 'rail') {
        const gripGrops = [...diff.pullCount.keys()].filter((id) => {
          const el = diff.els.find((e) => e.nodeId === id);
          return el && (resolvedName(el, diff.els) || '').toLowerCase().startsWith('gripper');
        }).length;
        const instrumented = diff.rows.filter((r) =>
          (r.name || '').toLowerCase().startsWith('gripper') && r.inCode === 'Y').length;
        calibration = `gripper groups: Figma pull ${gripGrops} · in code ${instrumented} · layers panel = (you count)`;
      }
      const report = buildReport(sc, diff, calibration);
      const full = baselineNotes.get(sc)
        ? `${report}\n\n── FIGMA CHANGED SINCE BASELINE (${sc}) ───────────────────\n${baselineNotes.get(sc)}`
        : report;
      reports.push(full);
      console.log(full);
      console.log();
      for (const r of diff.rows) if (FAILURES.has(r.status)) globalFail++;
    } catch (err) {
      reports.push(`scope ${sc}: ERROR — ${err.message}`);
      console.error(`scope ${sc}: ERROR — ${err.message}`);
      globalFail++;
    }
  }

  if (CAPTURE) {
    const out = {
      _meta: { capturedAt: new Date().toISOString(), mode: MODE, source: 'get_design_context census' },
      scopes: Object.fromEntries(
        Object.entries(captured).map(([k, v]) => [k, { root: v.root, nodes: v.nodes }]).sort(([a], [b]) => a.localeCompare(b)),
      ),
    };
    writeFileSync(CENSUS_PATH, JSON.stringify(out, null, 2) + '\n');
    console.log(`\nbaseline captured -> ${CENSUS_PATH}`);
  }

  if (OUT_BASE) {
    writeFileSync(`${OUT_BASE}.txt`, reports.join('\n\n'));
    writeFileSync(`${OUT_BASE}.json`, JSON.stringify({ mode: MODE, mcp: MCP_URL, scopes: reports }, null, 2));
    console.log(`\nreport written to ${OUT_BASE}.txt / .json`);
  }

  process.exitCode = globalFail ? 1 : 0;
}

await main();