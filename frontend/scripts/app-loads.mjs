#!/usr/bin/env node
/**
 * DOES THE APP ACTUALLY LOAD?
 *
 * The check that was missing. On 2026-09-29 a crash inside the ingest panel reached the owner
 * because the verification before it was "it compiles", "the endpoints answer", "the services are
 * up" — none of which notice a page that throws while React renders. A blank screen passed all
 * three.
 *
 * So this loads the real page in a real browser engine and asks the only question that matters:
 * did it render, and did anything throw? Exit code 0 means yes to the first and no to the second.
 *
 *   node scripts/app-loads.mjs [url]
 *
 * Chrome is required (it is already on this machine and used elsewhere in this repo). No new
 * dependency: the DevTools protocol is driven over a WebSocket with nothing but node built-ins.
 */
import { spawn } from 'node:child_process';

const url = process.argv[2] || 'http://127.0.0.1:5001/';
const PORT = 9451;
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chromePath = CHROME_CANDIDATES.find((p) => {
  try { return require('node:fs').existsSync(p); } catch { return false; }
}) || CHROME_CANDIDATES[0];

const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--user-data-dir=/tmp/app-loads-profile', 'about:blank',
], { stdio: 'ignore' });

const problems = [];
try {
  let up = false;
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { up = true; break; } } catch {}
    await sleep(250);
  }
  if (!up) { console.error('✗ chrome did not start — this check could not run'); process.exit(2); }

  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      problems.push('EXCEPTION: ' + (d.exception?.description || d.text || '').split('\n')[0]);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      problems.push('CONSOLE ERROR: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    }
  });
  await new Promise((r) => ws.addEventListener('open', r));
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url });
  await sleep(9000);

  // DID ANYTHING RENDER? The rail is the first thing the app draws; a blank page has no buttons.
  const probe = await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = document.querySelectorAll('button').length;
      const text = (document.body.innerText || '').trim().length;
      return JSON.stringify({ buttons, textLength: text, html: document.body.innerHTML.length });
    })()`,
    returnByValue: true,
  });
  const state = JSON.parse(probe.result?.result?.value || '{}');

  const rendered = (state.buttons || 0) >= 3 && (state.textLength || 0) > 20;
  console.log(`page: ${url}`);
  console.log(`  buttons: ${state.buttons}, text: ${state.textLength} chars, dom: ${state.html} bytes`);
  if (!rendered) problems.push('NOTHING RENDERED — the page loaded but the app drew no interface');
  ws.close();
} finally {
  chrome.kill();
}

if (problems.length) {
  console.error('\n✗ THE APP DOES NOT LOAD CLEANLY:');
  for (const p of problems.slice(0, 8)) console.error('   ' + p);
  process.exit(1);
}
console.log('\n✓ the app loads and renders with no console errors');
