#!/usr/bin/env node
/**
 * corrections-add.mjs — append one row to corrections.json.
 *
 *   npm run corrections:add -- --finding "check:<class>[:<subject>]" --receipt <commit>
 *                              [--on YYYY-MM-DD] [--witness "..."]
 *
 * Why a writer and not a text editor: the ledger's first cell is matched against
 * CHECK_INVENTORY by catalog-check, and a class typed wrong is a BLOCKING finding. A
 * writer that refuses a bad class at the moment of typing is far cheaper than a build
 * that fails later and names a row nobody remembers writing.
 *
 * The ledger is JSON (it was CORRECTIONS.md until 2026-09-18 — a machine-read ledger is
 * not a markdown file): the row is appended to `rows` and the file is written back with
 * its shape, comments and prose fields untouched.
 *
 * The script refuses three things, each for the same reason — a row that cannot be
 * checked is a row that will rot:
 *   · a class this repository does not run        (nothing could ever fail it)
 *   · a receipt that does not resolve to a commit (nothing to look at)
 *   · a finding already recorded                  (two rows, and no way to tell which is stale)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // frontend/
const REPO = join(ROOT, '..');
const LEDGER = join(REPO, 'corrections.json');
const CHECKER = join(ROOT, 'scripts', 'catalog-check.mjs');

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : null; };

const finding = (opt('--finding') || '').trim();
const receipt = (opt('--receipt') || '').trim();
const witness = (opt('--witness') || 'the run derives it again').trim();
const on = (opt('--on') || new Date().toISOString().slice(0, 10)).trim();

const usage = 'usage: npm run corrections:add -- --finding "check:<class>[:<subject>]" '
  + '--receipt <commit> [--on YYYY-MM-DD] [--witness "..."]';

if (!finding || !receipt) { console.error(usage); process.exit(2); }
if (!/^check:[a-z0-9-]+(:.+)?$/.test(finding)) {
  console.error(`not a ledger id: ${finding}\n${usage}`);
  process.exit(2);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) {
  console.error(`--on must be YYYY-MM-DD, got: ${on}`);
  process.exit(2);
}

// 1 · the class must be one this repository runs
const classes = [...readFileSync(CHECKER, 'utf8').matchAll(/\{ id: '([a-z0-9-]+)'/g)].map((m) => m[1]);
const cls = finding.slice('check:'.length).split(':')[0];
if (!classes.includes(cls)) {
  const near = classes.filter((c) => c.includes(cls.slice(0, 6)) || cls.includes(c.slice(0, 6)));
  console.error(`"${cls}" is not a check in CHECK_INVENTORY — nothing could ever fail this row.`);
  if (near.length) console.error(`did you mean: ${near.join(', ')}`);
  process.exit(2);
}

// 2 · the receipt must be a commit in this repository
try {
  execFileSync('git', ['cat-file', '-e', `${receipt}^{commit}`], { cwd: REPO, stdio: 'pipe' });
} catch {
  console.error(`"${receipt}" is not a commit in this repository. A correction nobody can open is a note.`);
  process.exit(2);
}

// 3 · one row per finding, and the file must be the ledger's shape
let ledger;
try {
  ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
} catch (e) {
  console.error(`corrections.json is missing or unreadable: ${e.message}`);
  process.exit(2);
}
if (!Array.isArray(ledger.rows)) {
  console.error('corrections.json has no "rows" array — the checker reads that and nothing else.');
  process.exit(2);
}
if (ledger.rows.some((r) => r && r.finding === finding)) {
  console.error(`already recorded: ${finding}\nUpdate that row's receipt instead of adding a second one.`);
  process.exit(1);
}

ledger.rows.push({ finding, corrected: on, receipt, witness });
writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');

console.log(`recorded: ${finding} — ${on} — ${receipt}`);
console.log('Now prove it holds:  cd frontend && npm run catalog:check');
console.log('A row that still derives fails the run. That is the point of the row.');
