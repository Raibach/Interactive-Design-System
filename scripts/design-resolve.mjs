#!/usr/bin/env node
/**
 * design-resolve.mjs — THE ENGINE READ. Step one: one element, one property, the resolved value.
 *
 * WHY THIS EXISTS. Everything before this read the app's styling by PARSING its CSS with a
 * parser written for this repository. That parser has been wrong in almost every round of
 * this work: a comment between two rules hid a real border; an apostrophe in a tag comment
 * swallowed two instances; a quoted class turned a per-instance variant into a global one; an
 * inherited line-height read as "not declared"; `var(--chat-bg, #ffffff)` was filed as no
 * value at all while the screen painted #FFFFFF. The code runs, and the engine that resolves a
 * value is the browser's — so the read asks IT, and this file is that read.
 *
 * THE TEST IS §3e CRITERION 2, in the plan page: `--chat-bg` must come back as an opaque white,
 * NOT `var(--chat-bg, #ffffff)` and NOT "not declared". The panel's rule is
 * `background: var(--chat-bg, #ffffff)` and `src/index.css` declares `--chat-bg: #FFFFFF`, so a
 * working read returns `rgb(255, 255, 255)` for the panel's container (`40001119:6027`).
 *
 * Usage:
 *   node scripts/design-resolve.mjs                      # criterion 2, and nothing else
 *   node scripts/design-resolve.mjs --node 40001119:6027 --prop backgroundColor
 *   node scripts/design-resolve.mjs --list               # every marked element and its background
 *
 * The browser is reached through the host's own browser client (the same one the session's
 * browser tools use): ZCODE_PLUGIN_ROOT must point at the plugin root. If it is absent, or the
 * app is not answering, this fails with the exact error — it does not route around it.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const APP = process.env.DESIGN_APP_URL || 'http://127.0.0.1:5001/';
// The sign-in gate is a stub: PinGate writes these two keys itself.
const SESSION = [
  "localStorage.setItem('grace_is_authenticated','true')",
  "localStorage.setItem('grace_user_role','student')",
].join('; ');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const NODE_ID = opt('--node', '40001119:6027');
const PROP = opt('--prop', 'backgroundColor');
const LIST = args.includes('--list');


/* ── THE ARTWORK, FROM THE ASSET ITSELF ────────────────────────────────────────────────
 * An icon is not a box. The file draws a VECTOR with its own extents inside a frame; the app
 * draws the whole SVG scaled into a CSS box, so the artwork lands at
 *     rendered = box × extents ÷ viewBox
 * and an app that compares the box reports a pass while drawing the drawing 1.25px narrow.
 * These two functions are that arithmetic, and nothing else: geometry read from the asset,
 * no hand-tuned pixel anywhere.
 *
 * The path extents are read COMMAND BY COMMAND — a scan for number pairs is wrong for most
 * paths (`M3.25 15.4375V17.0625H6.97604…` is x/y, then y, then x) and reported the wrong
 * artwork once already.
 */
function pathPointExtents(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const take = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  let i = 0, cmd = null;
  let cx = 0, cy = 0;                      // THE CURRENT POINT — `H` and `V` carry one axis only
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M': case 'L': case 'T': { const x = num(), y = num(); cx = rel ? cx + x : x; cy = rel ? cy + y : y; take(cx, cy); break; }
      case 'H': { const x = num(); cx = rel ? cx + x : x; take(cx, cy); break; }
      case 'V': { const y = num(); cy = rel ? cy + y : y; take(cx, cy); break; }
      case 'C': { num(); num(); num(); num(); const x = num(), y = num(); cx = rel ? cx + x : x; cy = rel ? cy + y : y; take(cx, cy); break; }
      case 'S': case 'Q': { num(); num(); const x = num(), y = num(); cx = rel ? cx + x : x; cy = rel ? cy + y : y; take(cx, cy); break; }
      case 'A': { num(); num(); num(); num(); num(); const x = num(), y = num(); cx = rel ? cx + x : x; cy = rel ? cy + y : y; take(cx, cy); break; }
      case 'Z': break;
      default: i++; break;
    }
  }
  /* LIMIT, SAID PLAINLY: the extremes of a curve are read from its END POINTS and control
     points, not from the curve itself, so an asset whose artwork is all curves can report a
     slightly larger box than it paints. None of the mark assets here use curves. */
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** One asset → its viewBox and the artwork's extents inside it. */
function artworkOf(svgText) {
  const vb = (svgText.match(/viewBox\s*=\s*"([^"]+)"/) || [])[1];
  const box = vb ? vb.trim().split(/[\s,]+/).map(Number) : [0, 0, 0, 0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const m of svgText.matchAll(/<path[^>]*\sd\s*=\s*"([^"]+)"/g)) {
    const e = pathPointExtents(m[1]);
    if (!Number.isFinite(e.minX)) continue;
    minX = Math.min(minX, e.minX); minY = Math.min(minY, e.minY);
    maxX = Math.max(maxX, e.maxX); maxY = Math.max(maxY, e.maxY);
  }
  const ext = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  return { viewBox: { w: box[2], h: box[3] }, extents: ext };
}

/** The size the artwork actually renders at, given the CSS box the app gives the asset. */
function renderedArtwork(artwork, box) {
  return {
    w: box.w * artwork.extents.w / artwork.viewBox.w,
    h: box.h * artwork.extents.h / artwork.viewBox.h,
  };
}

/* ── CRITERION 3 (§3e): the artwork, not the box ─────────────────────────────────────── */
if (args.includes('--criterion3') || args.length === 0) {
  const { readFileSync } = await import('node:fs');
  const ASSET = 'src/assets/figma-readout-model-mark.svg';
  const BOX = { w: 20, h: 20 };                       // icon-size="20" on the readout instance
  /* THE EXPECTED SIZE IS THE FILE'S OWN ARTWORK, read from the capture — never a number typed
     into this script (the first version carried it from memory, and the criterion above it was
     wrong by a whole axis). The artwork of a mark is every VECTOR under its frame, unioned. */
  const capture = JSON.parse(readFileSync(new URL('../src/design/chat-column.json', import.meta.url), 'utf8'));
  const nodes = capture.result.nodes;
  const under = new Set(['40001124:7096']);
  for (let grew = true; grew;) {
    grew = false;
    for (const n of nodes) if (n.parent && under.has(n.parent) && !under.has(n.id)) { under.add(n.id); grew = true; }
  }
  const vecs = nodes.filter((n) => under.has(n.id) && n.type === 'VECTOR');
  if (!vecs.length) { console.error('[resolve] FAIL: no vector under 40001124:7096 in the capture — the layer moved'); process.exit(1); }
  const FILE_VECTOR = { w: Math.max(...vecs.map((v) => v.w)), h: Math.max(...vecs.map((v) => v.h)) };
  const art = artworkOf(readFileSync(new URL('../' + ASSET, import.meta.url), 'utf8'));
  const drawn = renderedArtwork(art, BOX);
  const f2 = (n) => Number(n.toFixed(2));
  console.log(JSON.stringify({
    asset: ASSET,
    viewBox: art.viewBox,
    extents: { x: f2(art.extents.x), y: f2(art.extents.y), w: f2(art.extents.w), h: f2(art.extents.h) },
    box: BOX,
    artworkRendered: { w: f2(drawn.w), h: f2(drawn.h) },
    fileVector: FILE_VECTOR,
    delta: { w: f2(drawn.w - FILE_VECTOR.w), h: f2(drawn.h - FILE_VECTOR.h) },
    boxThatWouldLandIt: { w: f2(FILE_VECTOR.w * art.viewBox.w / art.extents.w), h: f2(FILE_VECTOR.h * art.viewBox.h / art.extents.h) },
  }, null, 1));
  const ok = Math.abs(drawn.w - FILE_VECTOR.w) < 0.01 && Math.abs(drawn.h - FILE_VECTOR.h) < 0.01;
  console.log(`[resolve] criterion 3 — box ${BOX.w}x${BOX.h} · artwork renders ${f2(drawn.w)}x${f2(drawn.h)} · file artwork ${FILE_VECTOR.w}x${FILE_VECTOR.h} · ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}

const pluginRoot = process.env.ZCODE_PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT;
if (!pluginRoot) {
  console.error('[resolve] FAIL: ZCODE_PLUGIN_ROOT is not set — the browser client lives at');
  console.error('            $ZCODE_PLUGIN_ROOT/scripts/browser-client.mjs and cannot be guessed.');
  process.exit(2);
}

const { setupBrowserRuntime } = await import(pathToFileURL(join(pluginRoot, 'scripts', 'browser-client.mjs')).href);
await setupBrowserRuntime({ globals: globalThis });

const browser = await agent.browsers.get('iab');
await browser.visibility?.set?.(false);          // the read is not a performance
const tab = await browser.tabs.new();
try {
  await tab.goto(APP);
  await tab.playwright.waitForLoadState({ state: 'domcontentloaded' });
  await tab.playwright.evaluate(`() => { ${SESSION}; }`);
  await tab.goto(APP);
  await tab.playwright.waitForLoadState({ state: 'domcontentloaded' });
  await tab.playwright.waitForTimeout(3500);      // the Lit column mounts after the gate

  const read = `() => {
    const maps = new Map();
    const roots = [document];
    for (let i = 0; i < roots.length; i++) {
      for (const el of roots[i].querySelectorAll('*')) {
        if (el.shadowRoot) roots.push(el.shadowRoot);
        const id = el.getAttribute && el.getAttribute('data-node-id');
        if (id && !maps.has(id)) maps.set(id, el);
      }
    }
    if (${LIST ? 'true' : 'false'}) {
      const out = [];
      for (const [id, el] of maps) {
        const s = getComputedStyle(el);
        out.push({ id, tag: el.tagName.toLowerCase(), background: s.backgroundColor, color: s.color, font: s.fontFamily.split(',')[0] + ' ' + s.fontWeight });
      }
      return { marked: maps.size, rows: out };
    }
    const el = maps.get(${JSON.stringify(NODE_ID)});
    if (!el) return { found: false, marked: maps.size, screen: document.body.innerText.slice(0, 80) };
    const s = getComputedStyle(el);
    return {
      found: true,
      id: ${JSON.stringify(NODE_ID)},
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 48),
      property: ${JSON.stringify(PROP)},
      resolved: s.getPropertyValue(${JSON.stringify(PROP)}).trim() || s[${JSON.stringify(PROP)}],
      /* the declaration the element's own rule carries, for contrast: the read must return a
         VALUE even where the code says var() */
      inlineOrDeclared: el.style.getPropertyValue(${JSON.stringify(PROP)}) || null,
      fontFamily: s.fontFamily, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
    };
  }`;
  const result = await tab.playwright.evaluate(read);
  console.log(JSON.stringify(result, null, 1));

  // THE TEST: criterion 2 says an opaque white, not a var() and not an absence.
  if (!LIST) {
    const ok = typeof result.resolved === 'string'
      && /^rgba?\(\s*255\s*,\s*255\s*,\s*255\s*(,\s*1\s*)?\)$/.test(result.resolved);
    console.log(`[resolve] criterion 2 (--chat-bg resolves to an opaque white): ${ok ? 'PASS' : 'FAIL'} — got ${JSON.stringify(result.resolved)}`);
    process.exit(ok ? 0 : 1);
  }
} catch (e) {
  console.error(`[resolve] FAIL: ${String(e.message || e)}`);
  process.exit(3);
} finally {
  await tab.close();
}
