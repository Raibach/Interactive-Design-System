#!/usr/bin/env node
/**
 * governance-review.mjs — THE MODEL'S SEAT: it reads the audits, and answers.
 *
 * THE ARITHMETIC DECIDES EVERY FACT. This script does not ask a model whether a value is
 * right — catalog-check.mjs and design-value-check.mjs have already compared every value
 * that can be compared, and their findings ARE the evidence. What the model is admitted
 * to is the REVIEWER seat (the same shape as backend/governance_inspector.py, where the
 * auditor classifies and a second model reports agreement): it reads the findings and
 * says, row by row, whether the evidence supports the row — and what the repair is.
 *
 * ONE BOUNDED CALL, TEMPERATURE 0, NO TOOLS, NO RETRIES. A 14B model does not reason here
 * and is not asked to: it looks at one list, looks at the other, and answers with the same
 * rows. The owner's words, 2026-09-20: "I don't want it reasoning, I don't want it
 * thinking, I want it zero temperature … looks at one, looks at the other, compiles the
 * statute you need to build your Lit component and it's done."
 *
 * A RUN WHERE THE MODEL DOES NOT ANSWER IS STORED AS **NOT DONE**, NEVER AS A PASS.
 * ("A failed run is recorded, not replaced.") The record says which happened, and the exit
 * code says it too:
 *
 *   0  the review completed — the working tree may still be RED; read the record
 *   1  the review completed and the tree is RED (blocking findings stand)
 *   2  NOT DONE — the model did not answer, or answered something that is not the asked
 *      shape. Nothing about the tree is claimed by this run.
 *   3  the audits themselves could not run
 *
 * Usage:
 *   node scripts/governance-review.mjs [--catalog prompt-composer] [--scope chat-column]
 *                                      [--url http://127.0.0.1:1234/v1] [--model KEY]
 *                                      [--max-rows 40] [--dry]
 *
 * The model URL and key come from backend/.env (INSPECTION_MODEL_URL / INSPECTION_MODEL_ID)
 * unless --url/--model say otherwise. `--dry` prints the sheet and the exact prompt and
 * exits without calling anything.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');
const AUDIT_DIR = join(ROOT, 'catalog-audit');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const CATALOG = opt('--catalog', 'prompt-composer');
const SCOPE = opt('--scope', 'chat-column');
const MAX_ROWS = Number(opt('--max-rows', '40'));
const DRY = args.includes('--dry');

function envValue(name, fallback = '') {
  try {
    const text = readFileSync(join(REPO, 'backend', '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* said below: the env file is optional, the defaults are explicit */ }
  return fallback;
}
/* THE SEAT IS DECLARED IN governance/SEAT.json, AND THAT IS WHAT IS READ.
   Precedence, highest first: an explicit flag, then the governance manifest, then the
   environment. The manifest outranks backend/.env deliberately — on 2026-09-20 the env file
   carried INSPECTION_MODEL_ID=qwen2.5-coder-0.5b-instruct while governance/ shipped a
   Qwen3-14B, so a session that trusted the environment loaded a 0.5B, the seat failed three
   ways in a row, and the model was effectively guessed. The governance folder is the
   authority for how this system is governed; a stale environment variable is not. */
const SEAT_PATH = join(REPO, 'governance', 'SEAT.json');
let SEAT = null;
try { SEAT = JSON.parse(readFileSync(SEAT_PATH, 'utf8')).seat ?? null; } catch { SEAT = null; }
if (!SEAT || !SEAT.model) {
  console.error(`[governance-review] no seat is declared in ${SEAT_PATH}.`);
  console.error('  The seat\'s model is declared there, not in backend/.env — a model nobody chose must not govern.');
  process.exit(2);
}
const URL_BASE = opt('--url', SEAT.url || envValue('INSPECTION_MODEL_URL', 'http://127.0.0.1:1234/v1'));
const MODEL = opt('--model', SEAT.model);
/* THE CAP IS THE REPLY'S ROOM, and it is not cosmetic. At 4096 the 14B's 35-row answer was
   cut mid-array, JSON.parse failed, and a run that had done the whole job was stored NOT DONE
   — which reads as "the model did not answer" when the truth is that it was never given room
   to finish. Declared in the manifest so the cap is a decision, not a default nobody saw. */
const MAX_OUT = Number(opt('--max-tokens', String(SEAT.maxOutputTokens || 16384)));
// The native API is at the ROOT, not under the OpenAI base path (measured 2026-09-18 in
// governance_inspector.py): concatenating them asked for /v1/api/v1/chat and LM Studio
// answered HTTP 200 with an error payload, which a careless client reads as a blank pass.
const ROOT_URL = URL_BASE.endsWith('/v1') ? URL_BASE.slice(0, -3) : URL_BASE;

// ── 1. the audits: the evidence this review is about ────────────────────
function run(cmd, argv) {
  try {
    return { ok: true, out: execFileSync(cmd, argv, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    // A non-zero exit is a RESULT for the audit (it is RED) — its stdout is still the
    // report. A throw without stdout is a run that did not happen.
    const out = `${e.stdout || ''}`;
    if (out.trim()) return { ok: true, out, exit: e.status };
    return { ok: false, error: String(e.stderr || e.message || e).split('\n')[0] };
  }
}

const auditRun = run('node', [join('scripts', 'catalog-check.mjs'), '--catalog', CATALOG]);
if (!auditRun.ok) {
  console.error(`[governance-review] the catalog audit did not run: ${auditRun.error}`);
  process.exit(3);
}
const reportPath = join(AUDIT_DIR, `${CATALOG}.json`);
if (!existsSync(reportPath)) {
  console.error(`[governance-review] the audit ran but wrote no report at ${reportPath}`);
  process.exit(3);
}
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const valueRun = run('node', [join('scripts', 'design-value-check.mjs'), '--capture', SCOPE, '--json']);
if (!valueRun.ok) {
  console.error(`[governance-review] the design-value check did not run: ${valueRun.error}`);
  process.exit(3);
}
const values = JSON.parse(valueRun.out.trim().split('\n').pop());

// ── 2. the sheet: what the model is shown, and nothing else ─────────────
const findings = (report.findings || []).filter((f) => f.level !== 'pass');
const rows = findings.slice(0, MAX_ROWS).map((f, i) => ({
  n: i + 1,
  id: f.id,
  check: f.check,
  level: f.level,
  where: f.component || f.nodeId || f.file || '',
  what: String(f.what || '').slice(0, 400),
  fix: String(f.fix || '').slice(0, 300),
}));

const sheet = {
  catalog: CATALOG,
  counts: report.counts,
  valueCheck: {
    capture: values.capture,
    layers: values.layers,
    compared: values.compared,
    discrepancies: values.discrepancies.length,
    unclaimed: values.unclaimed.length,
    notDeclared: values.notDeclared.length,
  },
  findings: rows,
  findingsTotal: findings.length,
  truncated: Math.max(0, findings.length - rows.length),
};

const SYSTEM = [
  'You are the reviewer of a design-system audit. You do not search, you do not compute, and you do not have tools.',
  'You are given a list of rows. Each row is already a measured finding with its evidence.',
  /* NO REASONING, NO QUESTIONS, NO GUESSING. The owner, 2026-09-20: "Disable all reasoning…
     It needs to just do what it's told. There's no questions… if it doesn't know something it
     should just fail." The seat is not a place to work anything out — every row arrives already
     measured, so there is nothing to derive and nothing to ask. A row the evidence does not
     support is a refusal carrying its reason; it is never an invented answer. */
  'Do not think step by step. Do not explain your reasoning. Do not ask questions. Answer immediately.',
  'Answer ONLY with a JSON object, no prose, in exactly this shape:',
  '{"verdict":"RED"|"GREEN","rows":[{"n":<number>,"agrees":"yes"|"no","reason":"<short>","suggestion":"<short>"}],"note":"<one sentence>"}',
  'For every row you were given, output one entry with its n.',
  '"yes" when the row states its evidence. "no" plus a reason and a suggestion when it does not — a refusal is allowed and must carry both.',
  'NEVER invent, NEVER guess, and NEVER leave a row out. If you cannot give an answer you stand behind, refuse that row with "no" and say why — failing is the correct outcome, a made-up answer is not.',
  'Do not invent rows. Do not add fields. Do not explain. One JSON object, nothing else.',
  /* THE SOFT SWITCH. The seat's model is a Qwen3 (governance/model-governance/Qwen3-14B-MLX-4bit),
     and Qwen3 reasons by default: it emits a long chain of thought and only then the reply,
     which is how a 2048-token budget got spent entirely on thinking and the run was recorded
     as "the model did not answer". `/no_think` is Qwen3's own documented switch for turning
     that off. The owner's rule is "disable all reasoning… it needs to just do what it's told",
     so the seat asks for the reply and not the working. */
  '/no_think',
].join('\n');

const USER = `ROWS (${rows.length} of ${findings.length}):\n${JSON.stringify(sheet, null, 1)}`;

if (DRY) {
  console.log('── SYSTEM ──\n' + SYSTEM);
  console.log('── USER ──\n' + USER);
  console.log(`\n[governance-review] --dry: nothing was sent. ${rows.length} row(s) would be reviewed on ${MODEL}.`);
  process.exit(0);
}

/* THE ANSWER IS THE `message` ITEM, NOT THE MODEL'S THOUGHTS. LM Studio's /api/v1/chat
   replies with a LIST: a thinking model puts its chain of thought in a `reasoning` item and
   its reply in a `message` item. Reading the list's first item read the THOUGHTS as the
   answer — 6353 characters of "1. Analyze the Request" parsed as a flat diff, no JSON
   anywhere in it, and the run stored NOT DONE while the model had in fact been asked and had
   in fact been working. The seat's rule is that a run the model does not ANSWER is NOT DONE;
   a run it did answer is not. So take the message, and when there is none, say so plainly
   rather than treating thinking as a reply. */
function readAnswer(body) {
  const output = body.output;
  if (Array.isArray(output)) {
    const messages = output.filter((o) => o && typeof o === 'object' && o.type === 'message' && o.content);
    if (messages.length) return { answer: messages.map((o) => String(o.content)).join('\n'), why: null };
    const thoughts = output.filter((o) => o && typeof o === 'object' && o.content).map((o) => String(o.content)).join('\n');
    if (thoughts) return { answer: thoughts, why: 'the model answered with reasoning and no message — the seat asks for a reply, not a thought process' };
    return { answer: null, why: 'the model answered with no content' };
  }
  return { answer: body.output ?? body.content ?? body.response ?? null, why: null };
}

// ── 3. one bounded call ────────────────────────────────────────────────
const started = Date.now();
let answer = null, callError = null;
try {
  const res = await fetch(`${ROOT_URL}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      system_prompt: SYSTEM,
      input: USER,
      /* NO TEMPERATURE. The seat does not want variation — it wants the answer to the rows it
         was given, once. The owner, 2026-09-20: "it doesn't need a temperature. It needs to
         just do what it's told." Sampling is the mechanism by which a model invents; there is
         nothing here to sample around. */
      max_output_tokens: MAX_OUT,
    }),
  });
  const body = await res.json();
  // HTTP 200 with an error payload is a FAILURE, never a quiet blank.
  if (body.error) callError = String(body.error);
  else ({ answer, why: callError } = readAnswer(body));
} catch (e) {
  callError = String(e.message || e);
}
const seconds = Math.round((Date.now() - started) / 1000) / 1;

// ── 4. the record: completed or NOT DONE, never replaced ────────────────
const record = {
  at: new Date().toISOString(),
  catalog: CATALOG,
  scope: SCOPE,
  model: MODEL,
  url: URL_BASE,
  seconds,
  evidence: sheet,
  answer: answer ?? null,
  error: callError,
  status: 'NOT DONE',
  missingRows: [],
};

let parsed = null;
if (answer) {
  const m = String(answer).match(/\{[\s\S]*\}/);
  try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
  if (parsed && Array.isArray(parsed.rows)) {
    const answered = new Set(parsed.rows.map((r) => Number(r.n)));
    record.missingRows = rows.filter((r) => !answered.has(r.n)).map((r) => r.n);
    // A REVIEW THAT DROPS ROWS IS NOT A REVIEW. Every row asked about must come back — a
    // model that silently skips the one row that matters is the failure this guards.
    record.status = record.missingRows.length ? 'NOT DONE' : 'REVIEWED';
  }
}

/* A REFUSAL IS ROUTED, AND THE ROUTING IS NOT THE MODEL'S TO DECIDE. Every finding
   already carries the side that owns it (`owner: pipeline | designer`), measured by the
   audit — so a refusal against a designer-owned row goes back to the designer, with the
   model's reason and suggestion attached, and a refusal against the pipeline's rows comes
   back to whoever builds the component. The model supplies the words; the audit supplied
   the destination. */
if (record.status === 'REVIEWED') {
  const byN = new Map(rows.map((r) => [r.n, r]));
  record.refusals = [];
  record.toDesigner = [];
  record.toCode = [];
  for (const r of parsed.rows) {
    const row = byN.get(Number(r.n));
    if (!row) continue;
    const entry = {
      n: row.n, id: row.id, owner: (findings.find((f) => f.id === row.id) || {}).owner || 'pipeline',
      where: row.where, reason: String(r.reason || '').slice(0, 300), suggestion: String(r.suggestion || '').slice(0, 300),
    };
    if (String(r.agrees).toLowerCase() === 'no') {
      record.refusals.push(entry);
      (entry.owner === 'designer' ? record.toDesigner : record.toCode).push(entry);
    }
  }
}

writeFileSync(join(AUDIT_DIR, 'governance-review.json'), JSON.stringify(record, null, 2));

// ── 5. what the run says ────────────────────────────────────────────────
const blocking = (report.counts && report.counts.blocking) || 0;
console.log(`[governance-review] ${record.status} — ${MODEL} · ${seconds}s · ${rows.length} row(s)`);
if (callError) console.log(`   the model did not answer: ${callError}`);
if (record.missingRows.length) console.log(`   the model answered without rows: ${record.missingRows.join(', ')}`);
if (record.status !== 'REVIEWED') {
  console.log(`   stored as NOT DONE at ${join('catalog-audit', 'governance-review.json')} — nothing about the tree is claimed by this run.`);
  process.exit(2);
}
console.log(`   the model answered${parsed.note ? `: ${String(parsed.note).slice(0, 200)}` : ''}`);
if ((record.refusals || []).length) {
  console.log(`   refused ${record.refusals.length} row(s) — ${record.toDesigner.length} back to the designer, ${record.toCode.length} to the code:`);
  for (const r of record.refusals) {
    console.log(`     #${r.n} ${r.id} [${r.owner}] ${r.reason}${r.suggestion ? ` → ${r.suggestion}` : ''}`);
  }
}
console.log(`   the audits stand as measured: ${blocking} blocking · ${sheet.counts.advisory} advisory · value check ${values.discrepancies.length} discrepancy(ies)`);
console.log(`   record → ${join('catalog-audit', 'governance-review.json')}`);
process.exit(blocking ? 1 : 0);
