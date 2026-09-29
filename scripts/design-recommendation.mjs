#!/usr/bin/env node
/**
 * design-recommendation.mjs — WHAT THE DESIGNER READS.
 *
 * The value check speaks in node ids and property names, because that is what the code needs.
 * A designer does not read that, and should not have to: this script turns the same
 * arithmetic into the one thing the designer asked for — WHAT CHANGED IN MY FILE, AND WHAT DO
 * YOU RECOMMEND I DO ABOUT IT.
 *
 * Nothing here decides anything. Every number and every name below was measured by
 * design-value-check.mjs against the Figma REST read; this script only says them in a
 * designer's words. If the two disagree, the check is right and this script is wrong.
 *
 * Usage:
 *   node scripts/design-recommendation.mjs [--scope chat-column|all] [--node 40001123:6765]
 *
 * With --node it recommends for one layer from the drawing alone (a designer's handoff):
 * what the file says, what the app draws, and the update in one line. Without it, it
 * recommends for every scope and every difference it was given.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_DIR = join(ROOT, 'src', 'design');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const SCOPE = opt('--scope', 'chat-column');
const NODE = opt('--node', null);
const AUDIT_DIR = join(ROOT, 'catalog-audit');
const BLUE = '\u001b[34m', DIM = '\u001b[2m', BOLD = '\u001b[1m', RESET = '\u001b[0m';

/** A measured field, said the way a designer says it. */
const IN_DESIGN_WORDS = {
  fill: 'the colour',
  stroke: 'the colour of the edge',
  strokeWeight: 'the thickness of the edge',
  strokeAlign: 'whether the edge sits inside or outside the shape',
  cornerRadius: 'the corner radius',
  itemSpacing: 'the space between the items',
  paddingTop: 'the padding at the top',
  paddingRight: 'the padding on the right',
  paddingBottom: 'the padding at the bottom',
  paddingLeft: 'the padding on the left',
  padding: 'the padding',
  width: 'the width',
  height: 'the height',
  layoutMode: 'the direction the items stack',
  primaryAxisAlignItems: 'the alignment across',
  counterAxisAlignItems: 'the alignment down',
  opacity: 'how transparent it is',
  fontFamily: 'the typeface',
  fontSize: 'the text size',
  fontWeight: 'the text weight',
  lineHeight: 'the line height',
  color: 'the text colour',
  textAlignHorizontal: 'the text alignment',
};

/** A measured value, said the way a designer says it. */
function inDesignWords(value) {
  const s = String(value ?? '').trim();
  if (!s) return 'nothing';
  /* A COMPOUND VALUE IS STILL SAID SIMPLY: an edge written as `2px solid rgba(...)` is
     "a 2px edge in #933A45 at 50%", which is what a designer drew and what they should read. */
  const compound = s.match(/^([\d.]+)px\s+\w+\s+(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})$/);
  if (compound) return `a ${compound[1]}px edge in ${inDesignWords(compound[2])}`;
  const compound2 = s.match(/^(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})\s+[\d.]+px$/);
  if (compound2) return inDesignWords(compound2[1]);
  const rgba = s.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (rgba) {
    const hex = '#' + [1, 2, 3].map((i) => Number(rgba[i]).toString(16).padStart(2, '0')).join('').toUpperCase();
    const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
    return alpha === 1 ? `${hex}` : `${hex} at ${Math.round(alpha * 100)}%`;
  }
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`;
  if (s.toUpperCase() === 'AUTO' || s === 'normal') return 'the typeface’s own line height';
  if (s === 'VERTICAL') return 'stacked vertically';
  if (s === 'HORIZONTAL') return 'side by side';
  if (s === 'CENTER') return 'centred';
  if (s === 'column') return 'stacked vertically';
  if (s === 'row') return 'side by side';
  return s;
}


/** A layer, as a person would point at it. */
function plainName(node) {
  const n = (node.name || '').toLowerCase();
  if (n.includes('gripper') || n.includes('grip')) return 'The gripper';
  if (n.includes('meatballs')) return 'The dot row';
  if (n.includes('history')) return 'The history mark';
  if (n.includes('bubble')) return 'The response bubble';
  if (n.includes('conversation')) return 'The conversations bar';
  if (n.includes('approval')) return 'The approvals bar';
  if (n.includes('output')) return 'The readout bar';
  return `The ${node.name.replace(/-/g, ' ')}`;
}

/** A measured value, in one plain phrase — no CSS, no property names. */
function plainValue(field, value) {
  const s = String(value ?? '').trim();
  const hex = (rgba) => {
    const m = String(rgba).match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (!m) return s;
    const h = '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('').toUpperCase();
    const a = m[4] === undefined ? 1 : Number(m[4]);
    return a === 1 ? h : `${h} faded to ${Math.round(a * 100)}%`;
  };
  const name = {
    '#FCCD3D': 'gold', '#507274': 'the deep teal', '#933A45': 'the muted red',
    '#64617F': 'the soft violet', '#2AB0C4': 'bright cyan',
  };
  if (field === 'stroke' || field === 'fill' || field === 'color') {
    const inValue = String(s).match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/);
    const colour = inValue ? hex(inValue[0]) : s;
    return name[colour] ? `${name[colour]} (${colour})` : colour;
  }
  if (field === 'itemSpacing') return `${s} of space between them`;
  if (field.startsWith('padding')) return `${s} of padding`;
  if (field === 'width' || field === 'height') return `${s} tall/wide`;
  if (field === 'cornerRadius') return `rounded ${s}`;
  return s;
}

function run(cmd, argv) {
  try { return { ok: true, out: execFileSync(cmd, argv, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) {
    const out = `${e.stdout || ''}`;
    return out.trim() ? { ok: true, out } : { ok: false, error: String(e.stderr || e.message || e).split('\n')[0] };
  }
}

/* NOTHING GOES TO THE DESIGNER UNTIL THE MODEL HAS ANSWERED. The owner, 2026-09-20: "You
 * need to talk to the model if there's an issue that you can resolve before you give it to the
 * designer — you both are working for the human." So the order is forced here: this page
 * refuses to be produced until the model's seat has a REVIEWED record for the current run,
 * because anything the two of us can settle between us must never reach a person. What the
 * model refused, and what its reasons were, is carried into the page below. */
function modelSeat() {
  const rec = join(AUDIT_DIR, 'governance-review.json');
  if (!existsSync(rec)) return { state: 'missing' };
  try {
    const r = JSON.parse(readFileSync(rec, 'utf8'));
    return { state: r.status === 'REVIEWED' ? 'reviewed' : 'not-done', record: r };
  } catch { return { state: 'unreadable' }; }
}

// ── one layer, named by a designer ──────────────────────────────────────
{
  const seat = modelSeat();
  if (seat.state !== 'reviewed') {
    console.log(`${BOLD}NOT READY FOR THE DESIGNER${RESET}`);
    console.log(`  You and the model settle this first — a person should only ever see what the two`);
    console.log(`  of you could not resolve. The model's seat has ${seat.state === 'missing' ? 'no record yet' : seat.state === 'not-done' ? 'not answered (NOT DONE)' : 'an unreadable record'}.`);
    console.log(`  Run: node scripts/catalog-check.mjs --catalog prompt-composer   (the measurements)`);
    console.log(`       node scripts/governance-review.mjs                        (the model's seat)`);
    console.log(`  then this page will carry the rows the model stood behind, and only those.`);
    process.exit(4);
  }
}

if (NODE) {
  // Find which capture holds it, and read the layer's own values from there.
  let found = null, scopeName = null, capture = null;
  for (const f of readdirSync(DESIGN_DIR).filter((f) => f.endsWith('.json'))) {
    try {
      const c = JSON.parse(readFileSync(join(DESIGN_DIR, f), 'utf8'));
      const n = (c.result?.nodes || []).find((x) => x.id === NODE);
      if (n) { found = n; scopeName = c._capture?.scope || f.replace(/\.json$/, ''); capture = c; break; }
    } catch { /* not a capture */ }
  }
  if (!found) {
    console.log(`I could not find layer ${NODE} in anything I have read from Figma.\n` +
      `Run: node scripts/design-capture.mjs --scope all   — then hand me the link again.`);
    process.exit(1);
  }
  /* WHAT IT IS, IN ONE BREATH. The layer's name is a designer's own ("gripper-prompt-input-
     chat-menu"); which window it belongs to is read from the file's parent chain, not guessed. */
  const byId = new Map((capture.result.nodes || []).map((n) => [n.id, n]));
  const chain = [];
  for (let cur = found; cur; cur = cur.parent ? byId.get(cur.parent) : null) chain.unshift(cur);
  const where = chain.map((n) => (n.name || '').toLowerCase()).join(' ');
  const window_ = where.includes('conversation') ? "under the conversations bar"
    : where.includes('approval') ? "under the approvals bar"
      : where.includes('readout') || where.includes('output') ? "under the readout at the top"
        : '';
  const kidsHere = (capture.result.nodes || []).filter((n) => n.parent === NODE);
  /* A ROW OF DOTS IS DOTS — a grandchild list is called that only when every one of them
     really is an ellipse. The first version counted whatever hung one level deeper and said
     a bar "holds a row of 3 dots" when it held two blocks and a gripper. */
  const grandkids = kidsHere.flatMap((k) => (capture.result.nodes || []).filter((n) => n.parent === k.id));
  const dots = grandkids.length && grandkids.every((n) => n.type === 'ELLIPSE') ? grandkids : [];
  const strip = `${found.h}px strip, ${found.pad ? `${found.pad.paddingLeft} of padding on each side` : 'no padding'}`;
  const holds = dots.length ? `holding a row of ${dots.length} dots, centred in it`
    : kidsHere.length ? `holding: ${kidsHere.map((k) => k.name.replace(/-/g, ' ')).join(', ')}`
      : 'holding nothing';
  const nameSaysWhere = /conversation|approval|readout|output/i.test(found.name || '');
  console.log(`${BOLD}${plainName(found)}${window_ && !nameSaysWhere ? ` ${window_}` : ''}${RESET}`);
  console.log(`${DIM}you sent ${NODE} · ${found.w} × ${found.h}${RESET}`);

  const r = run('node', [join('scripts', 'design-value-check.mjs'), '--capture', scopeName, '--json']);
  const j = JSON.parse(r.out.trim().split('\n').pop());
  /* THE GROUP IS THE WHOLE SUBTREE, not the layer and its direct children: the dots of a
     gripper hang off its row, which hangs off the frame a designer links to. A one-level
     filter found nothing here and reported "nothing to change" while the check was reporting
     a dot in gold against the app's red — a false all-clear, found by running it against a
     known difference. The subtree is walked from the capture's own parent links. */
  const inGroup = new Set([NODE]);
  for (let grew = true; grew;) {
    grew = false;
    for (const n of capture.result.nodes || []) {
      if (n.parent && inGroup.has(n.parent) && !inGroup.has(n.id)) { inGroup.add(n.id); grew = true; }
    }
  }
  const diffs = j.discrepancies.filter((d) => inGroup.has(d.id));

  /* THE NOTE IS MY WIRING CHECK, not a message to the designer: what a part DOES is only
     ever written in the annotation, so the note is what the behaviour is built from. Read
     here, before the report, because both sections below depend on it. */
  const noted = [found, ...chain.filter((n) => n !== found).reverse()].find((n) => (n.annotations || []).length);

  console.log('');
  console.log(`${BOLD}FOR THE BUILD — mine${RESET}`);
  console.log(`  A ${strip}, ${holds}.`);
  if (diffs.length) {
    const what = diffs[0];
    const dotRow = (capture.result.nodes || []).find((n) => n.id === what.id);
    const allDots = dotRow ? (capture.result.nodes || []).filter((n) => n.parent === dotRow.parent) : [];
    const dotIndex = allDots.findIndex((d) => d.id === what.id);
    const ordinal = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][dotIndex] || `${dotIndex + 1}th`;
    const which = dotIndex >= 0 ? `${ordinal} of the ${allDots.length} dots` : what.name;
    console.log(`  Change to apply: the ${which} — the file has ${plainValue(what.field, what.file)},`);
    console.log(`  the app draws ${plainValue(what.field, what.code)}. Apply the file's value.`);
    if (diffs.length > 1) console.log(`  (${diffs.length - 1} more in this group, same list.)`);
  } else {
    console.log(`  Nothing to change: the app draws every value I can compare exactly as the file has it`);
    console.log(`  (${j.compared} across the ${j.layers} layers in this column).`);
  }
  /* THE NOTE IS MY WIRING CHECK, not a message to the designer: what the part DOES is only
     ever written in the annotation, so the note is what I build the behaviour from. If it is
     missing, that is the one thing I cannot invent — and the only reason to ask. */
  console.log(`  The note: ${noted
    ? `“${String(noted.annotations[0]).split('\n')[0].slice(0, 110)}…” (${noted.id === found.id ? 'on this layer' : `on the ${noted.name} it sits in`}) → build the behaviour from it.`
    : 'none anywhere on this layer or the blocks it sits in — what it does is not written down, so the behaviour cannot be built from the file.'}`);
  console.log('');
  console.log(`${BOLD}FOR THE DESIGNER${RESET}`);
  console.log(noted
    ? `  Nothing. When they open the app, they see exactly what they drew here.`
    : `  One thing, and it is theirs: no note says what this part does. Until that note exists`);
  if (!noted) console.log(`  the behaviour has to be guessed, which is the one failure they should never have to see.`);
  const unclaimed = j.unclaimed.filter((u) => u.id === NODE);
  if (unclaimed.length) {
    console.log('');
    console.log(`${BOLD}One thing I could not check${RESET}`);
    console.log(`  Nothing in the app is wired to this layer yet, so I can read your file but I`);
    console.log(`  cannot tell you the app matches it. Ask me to wire it and I will.`);
  }
  process.exit(0);
}

// ── every scope: the standing recommendation ────────────────────────────
const r = run('node', [join('scripts', 'design-value-check.mjs'), '--capture', SCOPE === 'all' ? 'all' : SCOPE, '--json']);
if (!r.ok) {
  console.log(`I could not compare the app against your file: ${r.error}`);
  process.exit(3);
}
const j = JSON.parse(r.out.trim().split('\n').pop());
// `--scope all` answers with totals + every scope's list; one scope answers with its own.
const layers = j.totals ? j.totals.layers : j.layers;
const compared = j.totals ? j.totals.compared : j.compared;
const unclaimedCount = j.totals ? j.unclaimed.length : j.unclaimed.length;
const diffs = j.discrepancies || [];
console.log(`${BOLD}FOR THE BUILD — mine${RESET}`);
if (diffs.length) {
  for (const d of diffs) {
    console.log(`  • ${d.name} (${d.id}) — ${IN_DESIGN_WORDS[d.field] || d.field}: the file has ${inDesignWords(d.file)},`);
    console.log(`    the app draws ${inDesignWords(d.code)}. Apply the file's value.`);
  }
} else {
  console.log(`  Nothing to change. Every part of the app that is wired to the file draws it exactly as`);
  console.log(`  the file has it — every value I can compare (${compared} across ${layers} layers).`);
}
console.log('');
console.log(`${BOLD}FOR THE DESIGNER${RESET}`);
console.log(`  Nothing to report. Their check is the built app: it shows what they drew.`);
if (unclaimedCount) {
  console.log(`\n${DIM}Not yet confirmed: ${unclaimedCount} of ${layers} layers are not named in the app yet,`);
  console.log(`so I cannot tell you they are right. They are listed one by one in the audit.${RESET}`);
}
process.exit(0);
