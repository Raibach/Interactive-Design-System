/* SHELL DECOMPOSITION TOOL — inventory / analyse / move for statements inside the shell
   component. `inventory` and `analyse` are read-only. `move` copies the statement's text
   unchanged into its own module and splices the shell by exact line range.
   Scratch tool — delete after the pass. */
const ts = require('typescript');
const fs = require('fs');

const SHELL = 'src/pages/WritingAreaIndex.tsx';
const src = fs.readFileSync(SHELL, 'utf8');
const sf = ts.createSourceFile(SHELL, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;

function component() {
  let found = null;
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'Index' && n.body) { found = n; return; }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!found) throw new Error('component Index not found');
  return found;
}

/* local name -> import description */
function importMap() {
  const map = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const mod = st.moduleSpecifier.text;
    const c = st.importClause;
    if (c.name) map.set(c.name.text, { mod, form: 'default', name: 'default', typeOnly: !!c.isTypeOnly });
    const b = c.namedBindings;
    if (!b) continue;
    if (ts.isNamespaceImport(b)) map.set(b.name.text, { mod, form: 'namespace', name: '*', typeOnly: !!c.isTypeOnly });
    else for (const el of b.elements) {
      map.set(el.name.text, {
        mod,
        form: 'named',
        name: el.propertyName ? el.propertyName.text : el.name.text,
        typeOnly: !!(el.isTypeOnly || c.isTypeOnly),
      });
    }
  }
  return map;
}

/* names declared at module scope in the shell (would be a circular import if moved out) */
function moduleScopeNames() {
  const names = new Set();
  for (const st of sf.statements) {
    if (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isEnumDeclaration(st) || ts.isClassDeclaration(st)) {
      if (st.name) names.add(st.name.text);
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.add(d.name.text);
    } else if (ts.isFunctionDeclaration(st) && st.name) names.add(st.name.text);
  }
  return names;
}

const GLOBALS = new Set([
  'window','document','console','setTimeout','clearTimeout','setInterval','clearInterval',
  'requestAnimationFrame','cancelAnimationFrame','requestIdleCallback','cancelIdleCallback',
  'localStorage','sessionStorage','fetch','JSON','Object','Array','Promise','Math','Date','URL',
  'URLSearchParams','FormData','Blob','File','FileReader','Event','CustomEvent','HTMLElement',
  'Node','Element','customElements','crypto','performance','queueMicrotask','AbortController',
  'AbortSignal','DOMException','Intl','Number','String','Boolean','RegExp','Error','Map','Set',
  'WeakMap','WeakSet','structuredClone','navigator','location','history','alert','confirm','prompt',
  'atob','btoa','TextEncoder','TextDecoder','CSS','getComputedStyle','Image','ResizeObserver',
  'MutationObserver','IntersectionObserver','KeyboardEvent','MouseEvent','PointerEvent','DragEvent',
  'NodeFilter','ShadowRoot','DocumentFragment','undefined','globalThis','React','Symbol','Function',
  'parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','scrollTo',
  'matchMedia','ReadableStream','Response','Request','Headers','WebSocket','Notification','require',
  'WebAssembly','SharedArrayBuffer','ArrayBuffer','Uint8Array','Float32Array','TextMetrics','Option',
  'ImageData','Path2D','OffscreenCanvas','CanvasRenderingContext2D','WebGLRenderingContext',
  /* TypeScript lib types that appear in annotations — they are not values the shell can pass. */
  'Record','Partial','Pick','Omit','Required','Readonly','Exclude','Extract','NonNullable',
  'Parameters','ReturnType','InstanceType','Awaited','Uppercase','Lowercase','Capitalize',
  'Uncapitalize','PropertyKey','ThisType','Iterable','Iterator','IteratorResult','PromiseLike',
  'ArrayLike','EventListener','EventListenerObject','EventListenerOptions','AddEventListenerOptions',
  'EventTarget','EventInit','CustomEventInit','EventMap','HTMLElementTagNameMap','NodeList',
  'HTMLDivElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','HTMLFormElement',
  'HTMLSelectElement','HTMLImageElement','HTMLAnchorElement','HTMLIFrameElement','HTMLCanvasElement',
  'HTMLVideoElement','HTMLAudioElement','HTMLSpanElement','HTMLLabelElement','HTMLStyleElement',
  'FocusEvent','InputEvent','WheelEvent','TouchEvent','AnimationEvent','TransitionEvent','ClipboardEvent',
  'BeforeUnloadEvent','MessageEvent','ErrorEvent','XMLHttpRequest','DOMParser','FileList','DataTransfer',
  'MediaQueryList','CSSStyleDeclaration','Storage','DOMRect','DOMRectReadOnly','Range','Selection',
  'Document','Window','HTMLCollection','DOMTokenList','DOMRectList','HTMLHeadElement','HTMLBodyElement',
]);

function freeNames(startLine, endLine) {
  const block = src.split('\n').slice(startLine - 1, endLine).join('\n');
  const wrapped = ts.createSourceFile('block.tsx', `function __w() {\n${block}\n}`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declared = new Set();
  const referenced = new Set();
  const bind = (name) => {
    if (!name) return;
    if (ts.isIdentifier(name)) declared.add(name.text);
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const el of name.elements) if (ts.isBindingElement(el)) bind(el.name);
    }
  };
  const walk = (node) => {
    if (ts.isVariableDeclaration(node)) bind(node.name);
    else if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      if (node.name && ts.isIdentifier(node.name)) declared.add(node.name.text);
      for (const p of node.parameters) bind(p.name);
    } else if (ts.isCatchClause(node) && node.variableDeclaration) bind(node.variableDeclaration.name);
    else if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node) || ts.isClassDeclaration(node)) {
      if (node.name) declared.add(node.name.text);
    }
    if (ts.isIdentifier(node)) {
      const p = node.parent;
      let isRef = true;
      if (p) {
        if (ts.isPropertyAccessExpression(p) && p.name === node) isRef = false;
        else if (ts.isPropertyAssignment(p) && p.name === node) isRef = false;
        else if (ts.isMethodDeclaration(p) && p.name === node) isRef = false;
        else if (ts.isPropertyDeclaration(p) && p.name === node) isRef = false;
        else if (ts.isPropertySignature(p) && p.name === node) isRef = false;
        else if (ts.isTypeLiteralNode(p)) isRef = false;
        else if (ts.isQualifiedName(p) && p.right === node) isRef = false;
        else if (ts.isJsxAttribute(p) && p.name === node) isRef = false;
        else if ((ts.isJsxOpeningElement(p) || ts.isJsxClosingElement(p) || ts.isJsxSelfClosingElement(p)) && p.tagName === node) isRef = false;
        else if (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) isRef = false;
        else if (ts.isBindingElement(p) && p.name === node) isRef = false;
        else if (ts.isBindingElement(p) && p.propertyName === node) isRef = false;
        else if (ts.isVariableDeclaration(p) && p.name === node) isRef = false;
        else if (ts.isParameter(p) && p.name === node) isRef = false;
      }
      if (isRef) referenced.add(node.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(wrapped);
  return [...referenced].filter((n) => !declared.has(n) && !GLOBALS.has(n)).sort();
}

function partition(startLine, endLine) {
  const imports = importMap();
  const moduleNames = moduleScopeNames();
  const free = freeNames(startLine, endLine);
  return {
    imports: free.filter((n) => imports.has(n)).map((n) => ({ local: n, ...imports.get(n) })),
    blocked: free.filter((n) => !imports.has(n) && moduleNames.has(n)),
    deps: free.filter((n) => !imports.has(n) && !moduleNames.has(n)),
  };
}

function importLines(list) {
  const byMod = new Map();
  for (const i of list) {
    if (!byMod.has(i.mod)) byMod.set(i.mod, []);
    byMod.get(i.mod).push(i);
  }
  const out = [];
  for (const [mod, items] of byMod) {
    const def = items.find((i) => i.form === 'default');
    const ns = items.find((i) => i.form === 'namespace');
    const named = items.filter((i) => i.form === 'named');
    let s = 'import ';
    if (def) s += (def.typeOnly ? 'type ' : '') + def.local;
    if (ns) s += (def ? ', ' : '') + `* as ${ns.local}`;
    if (named.length) {
      if (def || ns) s += ', ';
      s += `{ ${named.map((i) => (i.typeOnly ? 'type ' : '') + (i.name === i.local ? i.local : `${i.name} as ${i.local}`)).join(', ')} }`;
    }
    out.push(`${s} from '${mod}';`);
  }
  return out;
}

const mode = process.argv[2] || 'inventory';
const comp = component();

/* THE END LINE IS NEVER TYPED BY HAND. Given a start line, the component's own statement list
   decides where the statement ends — two hand-typed ranges were one line short and left the
   statement's closing line in the page (2026-10-21, twice). Pass 0 or omit the end. */
function resolveEnd(start, end) {
  if (end) return end;
  const st = comp.body.statements.find((s) => lineOf(s.getStart(sf)) === start);
  if (!st) {
    console.error('REFUSING — no statement starts at line', start);
    process.exit(1);
  }
  return lineOf(st.getEnd());
}

if (mode === 'inventory') {
  const rows = comp.body.statements.map((st) => ({
    lines: lineOf(st.getEnd()) - lineOf(st.getStart(sf)) + 1,
    start: lineOf(st.getStart(sf)),
    end: lineOf(st.getEnd()),
    head: src.slice(st.getStart(sf), st.getEnd()).split('\n')[0].trim().slice(0, 88),
  }));
  rows.sort((a, b) => b.lines - a.lines);
  console.log(`statements: ${rows.length}`);
  for (const r of rows.slice(0, Number(process.argv[3] || 12))) {
    console.log(String(r.lines).padStart(6), String(r.start).padStart(6), String(r.end).padStart(6), ' ', r.head);
  }
} else if (mode === 'analyse') {
  const start = Number(process.argv[3]);
  const end = resolveEnd(start, Number(process.argv[4]) || 0);
  console.log(JSON.stringify(partition(start, end), null, 2));
} else if (mode === 'move') {
  const start = Number(process.argv[3]);
  const end = resolveEnd(start, Number(process.argv[4]) || 0);
  const outPath = process.argv[5];
  const hook = process.argv[6];
  const title = process.argv[7] || hook;
  const part = partition(start, end);
  if (part.blocked.length) {
    console.error('REFUSING — these names are declared at module scope in the shell (moving them would create a cycle):', part.blocked.join(', '));
    process.exit(1);
  }
  const lines = src.split('\n');
  const block = lines.slice(start - 1, end);
  const deps = part.deps;
  const head = `/**
 * ${title} — moved out of \`pages/WritingAreaIndex.tsx\` verbatim.
 *
 * The statement's text is unchanged; every name it closes over arrives through \`deps\`, so the
 * behaviour is the page's own. The dependency list is the contract: a new name in the effect is a
 * compile error here until it is declared in the interface below.
 */
${importLines(part.imports).join('\n')}

/** Exactly what the block needs from the shell, by name. */
export interface ${hook[0].toUpperCase() + hook.slice(1)}Deps {
${deps.map((d) => `  ${d}: any;`).join('\n')}
}

export function ${hook}(deps: ${hook[0].toUpperCase() + hook.slice(1)}Deps) {
${deps.length ? `  const { ${deps.join(', ')} } = deps;\n` : ''}${block.join('\n')}
}
`;
  fs.writeFileSync(outPath, head, 'utf8');
  const call = [
    `  /* MOVED (2026-10-21): the ${end - start + 1}-line block now lives in \`${outPath.replace('src/', '@/').replace(/\.tsx?$/, '')}\`.`,
    `     Same statement, same deps, passed by name. */`,
    `  ${hook}({ ${deps.join(', ')} });`,
  ];
  const next = [...lines.slice(0, start - 1), ...call, ...lines.slice(end)];
  const anchor = next.findIndex((l) => l.includes('from "@/canvas/pageHelpers"'));
  if (anchor === -1) {
    console.error('REFUSING — import anchor not found');
    process.exit(1);
  }
  const imp = `import { ${hook} } from "${outPath.replace('src/', '@/').replace(/\.tsx?$/, '')}";`;
  if (!next.some((l) => l === imp)) next.splice(anchor + 1, 0, imp);
  fs.writeFileSync(SHELL, next.join('\n'), 'utf8');
  console.log(`moved ${end - start + 1} lines → ${outPath}; deps=${deps.length}; shell ${lines.length} → ${next.length} lines`);
} else if (mode === 'move-cb') {
  /* Move a `const NAME = useCallback(...)` statement into a hook that RETURNS the callback, so the
     page's call sites keep their own name and signature. */
  const start = Number(process.argv[3]);
  const end = resolveEnd(start, Number(process.argv[4]) || 0);
  const outPath = process.argv[5];
  const hook = process.argv[6];
  const name = process.argv[7];
  const title = process.argv[8] || hook;
  const part = partition(start, end);
  if (part.blocked.length) {
    console.error('REFUSING — module-scope names would create a cycle:', part.blocked.join(', '));
    process.exit(1);
  }
  const lines = src.split('\n');
  const block = lines.slice(start - 1, end);
  const prefix = `const ${name} = `;
  const at = block[0].indexOf(prefix);
  if (at === -1) {
    console.error('REFUSING — line', start, 'does not declare', name, ':', JSON.stringify(block[0].slice(0, 80)));
    process.exit(1);
  }
  block[0] = block[0].slice(0, at) + 'return ' + block[0].slice(at + prefix.length);
  const deps = part.deps;
  const iface = `${hook[0].toUpperCase() + hook.slice(1)}Deps`;
  const body = `/**
 * ${title} — moved out of \`pages/WritingAreaIndex.tsx\` verbatim.
 *
 * The statement's text is unchanged and the callback is returned, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
${importLines(part.imports).join('\n')}

/** Exactly what the callback needs from the shell, by name. */
export interface ${iface} {
${deps.map((d) => `  ${d}: any;`).join('\n')}
}

export function ${hook}(deps: ${iface}) {
${deps.length ? `  const { ${deps.join(', ')} } = deps;\n` : ''}${block.join('\n')}
}
`;
  fs.writeFileSync(outPath, body, 'utf8');
  const mod = outPath.replace('src/', '@/').replace(/\.tsx?$/, '');
  const call = [
    `  /* MOVED (2026-10-21): the ${end - start + 1}-line callback now lives in \`${mod}\`, returned by a hook. */`,
    `  const ${name} = ${hook}({ ${deps.join(', ')} });`,
  ];
  const next = [...lines.slice(0, start - 1), ...call, ...lines.slice(end)];
  const anchor = next.findIndex((l) => l.includes('from "@/canvas/pageHelpers"'));
  if (anchor === -1) {
    console.error('REFUSING — import anchor not found');
    process.exit(1);
  }
  const imp = `import { ${hook} } from "${mod}";`;
  if (!next.some((l) => l === imp)) next.splice(anchor + 1, 0, imp);
  fs.writeFileSync(SHELL, next.join('\n'), 'utf8');
  console.log(`moved ${end - start + 1} lines → ${outPath}; deps=${deps.length}; shell ${lines.length} → ${next.length} lines`);
} else if (mode === 'move-fn') {
  /* Move an `async function NAME(...) {...}` declaration into a hook that RETURNS it. The
     declaration text is unchanged, so every call site keeps its own name and signature. */
  const start = Number(process.argv[3]);
  const end = resolveEnd(start, Number(process.argv[4]) || 0);
  const outPath = process.argv[5];
  const hook = process.argv[6];
  const name = process.argv[7];
  const title = process.argv[8] || hook;
  const part = partition(start, end);
  if (part.blocked.length) {
    console.error('REFUSING — module-scope names would create a cycle:', part.blocked.join(', '));
    process.exit(1);
  }
  const lines = src.split('\n');
  const block = lines.slice(start - 1, end);
  const deps = part.deps;
  const iface = `${hook[0].toUpperCase() + hook.slice(1)}Deps`;
  const body = `/**
 * ${title} — moved out of \`pages/WritingAreaIndex.tsx\` verbatim.
 *
 * The declaration's text is unchanged and the hook returns it, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
${importLines(part.imports).join('\n')}

/** Exactly what the function needs from the shell, by name. */
export interface ${iface} {
${deps.map((d) => `  ${d}: any;`).join('\n')}
}

export function ${hook}(deps: ${iface}) {
${deps.length ? `  const { ${deps.join(', ')} } = deps;\n` : ''}${block.join('\n')}

  return ${name};
}
`;
  fs.writeFileSync(outPath, body, 'utf8');
  const mod = outPath.replace('src/', '@/').replace(/\.tsx?$/, '');
  const call = [
    `  /* MOVED (2026-10-21): the ${end - start + 1}-line function now lives in \`${mod}\`, returned by a hook. */`,
    `  const ${name} = ${hook}({ ${deps.join(', ')} });`,
  ];
  const next = [...lines.slice(0, start - 1), ...call, ...lines.slice(end)];
  const anchor = next.findIndex((l) => l.includes('from "@/canvas/pageHelpers"'));
  if (anchor === -1) {
    console.error('REFUSING — import anchor not found');
    process.exit(1);
  }
  const imp = `import { ${hook} } from "${mod}";`;
  if (!next.some((l) => l === imp)) next.splice(anchor + 1, 0, imp);
  fs.writeFileSync(SHELL, next.join('\n'), 'utf8');
  console.log(`moved ${end - start + 1} lines → ${outPath}; deps=${deps.length}; shell ${lines.length} → ${next.length} lines`);
} else if (mode === 'cut') {
  /* Replace a block with one line of your own — for markup, which belongs in a component. */
  const start = Number(process.argv[3]);
  const end = resolveEnd(start, Number(process.argv[4]) || 0);
  const replacement = process.argv[5] || '';
  const lines = src.split('\n');
  const next = [...lines.slice(0, start - 1), replacement, ...lines.slice(end)];
  fs.writeFileSync(SHELL, next.join('\n'), 'utf8');
  console.log(`cut ${end - start + 1} lines; shell ${lines.length} → ${next.length} lines`);
} else if (mode === 'extract-jsx') {
  /*
   * Move a JSX branch into a component VERBATIM. The block must be a fragment (`<>` … `</>`).
   * The children are dedented by their own common indent and re-indented into the component,
   * so every comment survives byte-for-byte; only the indent changes. The shell keeps one
   * `<Component ... />` line, and the prop names are the ones passed in argv[8].
   */
  const start = Number(process.argv[3]);
  const end = resolveEnd(start, Number(process.argv[4]) || 0);
  const outPath = process.argv[5];
  const name = process.argv[6];
  const importPath = process.argv[7];
  const props = (process.argv[8] || '').split(',').map((s) => s.trim()).filter(Boolean);
  const lines = src.split('\n');
  const block = lines.slice(start - 1, end);
  if (block[0].trim() !== '<>' || block[block.length - 1].trim() !== '</>') {
    console.error('REFUSING — the block is not a fragment: first "' + block[0].trim() + '", last "' + block[block.length - 1].trim() + '"');
    process.exit(1);
  }
  const children = block.slice(1, -1);
  const indents = children.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
  const base = Math.min(...indents);
  const body = children.map((l) => (l.trim() ? ' '.repeat(6) + l.slice(base) : '')).join('\n');
  const component = `/**
 * <${name}> — the room's pane, moved out of \`pages/WritingAreaIndex.tsx\` verbatim
 * (2026-10-21).
 *
 * The markup is unchanged: every comment in it is the room's own record of why it looks the way
 * it does. What changed is only WHERE it lives — the names it used to close over arrive as
 * props, and that list is the contract.
 */
import React from 'react';
import { builderToolUrl, isDemoMode } from '@/shared/appConfig';
import productAssemblyBackground from '@/assets/product-assembly-bg.webp';

export interface ${name}Props {
${props.map((p) => `  ${p}: any;`).join('\n')}
}

export function ${name}({ ${props.join(', ')} }: ${name}Props) {
  /*
   * ONE ROOM, ONE WAIT (owner, 2026-10-21: *"one slides around one slides next to it … a lot
   * happening when I click on the product tab with spinners"*). MEASURED on a Product click,
   * one second in: two amber rings on screen together — the pane's own empty state centred
   * over the left column ("Opening the project…", x=694) and the room's gate ring centred over
   * the whole pane ("Standing up the builder…", x=746), 52px apart. Two statements of the same
   * moment. The gate's is the honest one (it lifts on the frame's load), so while a gate stands
   * the pane's empty state does not draw its own; with no gate (engine down, no builder URL,
   * tool down) or after the gate has lifted, it speaks alone.
   */
  const gateStands =
    Boolean(builderToolUrl()) && !productToolDown && !builderEngineDown && !productGateDown;

  return (
    <>
${body}
    </>
  );
}
`;
  fs.writeFileSync(outPath, component, 'utf8');
  const pad = lines[start - 1].match(/^ */)[0];
  const call = `${pad}<${name} ${props.map((p) => `${p}={${p}}`).join(' ')} />`;
  const next = [...lines.slice(0, start - 1), call, ...lines.slice(end)];
  const anchor = next.findIndex((l) => l.includes('from "@/canvas/pageHelpers"'));
  if (anchor === -1) {
    console.error('REFUSING — import anchor not found');
    process.exit(1);
  }
  const imp = `import { ${name} } from "${importPath}";`;
  if (!next.some((l) => l === imp)) next.splice(anchor + 1, 0, imp);
  fs.writeFileSync(SHELL, next.join('\n'), 'utf8');
  console.log(`extracted ${end - start + 1} lines → ${outPath} (${props.length} props); shell ${lines.length} → ${next.length} lines`);
}
