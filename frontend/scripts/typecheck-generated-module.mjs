/**
 * Type-check one generated component module without writing it to disk.
 *
 * Reads the module text on stdin, serves it to the TypeScript compiler from memory, and prints a
 * JSON report. The module's two imports are mapped to small declarations of their own shapes, so
 * the check answers one question: does every declared parameter and every use of it in this file
 * type-check under strict rules? It says nothing about the catalogue and writes nothing.
 */
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const source = readFileSync(0, 'utf8');
const virtualFile = '/virtual/generated.ts';

// The relative seam import is replaced in the in-memory copy: a relative specifier cannot be
// declared ambiently, and the seam's own types are not what this check is about.
const ATTACH = 'virtual-attach';
const body = source.replace(/(from\s+)(['"])\.\/behaviour\/attach\2/g, `$1'${ATTACH}'`);

const ambientFile = '/virtual/ambient.d.ts';
const ambient = `
declare module 'lit' {
  export class LitElement extends HTMLElement {
    static properties: Record<string, unknown>;
    static styles: unknown;
    connectedCallback(): void;
    disconnectedCallback(): void;
    render(): unknown;
    dispatchEvent(event: Event): boolean;
  }
  export const html: (strings: TemplateStringsArray, ...values: unknown[]) => unknown;
  export const css: (strings: TemplateStringsArray, ...values: unknown[]) => unknown;
}
declare module '${ATTACH}' {
  export function attachBehaviour(element: HTMLElement, tag: string): void;
  export function detachBehaviour(element: HTMLElement, tag: string): void;
  export function behaviourProperties(tag: string): Record<string, unknown>;
}
`;

const options = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  skipLibCheck: true,
  noUnusedLocals: false,
  noUnusedParameters: false,
  noImplicitAny: true,
  types: [],
};

const host = ts.createCompilerHost(options, true);
const getSourceFile = host.getSourceFile.bind(host);
const fileExists = host.fileExists.bind(host);
const readFile = host.readFile.bind(host);

host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
  if (fileName === virtualFile) {
    return ts.createSourceFile(fileName, body, languageVersion, true);
  }
  if (fileName === ambientFile) {
    return ts.createSourceFile(fileName, ambient, languageVersion, true);
  }
  return getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
};
host.fileExists = (fileName) =>
  fileName === virtualFile || fileName === ambientFile || fileExists(fileName);
host.readFile = (fileName) => {
  if (fileName === virtualFile) return body;
  if (fileName === ambientFile) return ambient;
  return readFile(fileName);
};

const program = ts.createProgram({ rootNames: [ambientFile, virtualFile], options, host });
const diagnostics = ts.getPreEmitDiagnostics(program);
const messages = diagnostics.map((diagnostic) => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (!diagnostic.file || diagnostic.start === undefined) {
    return { file: '', line: 0, column: 0, code: diagnostic.code, message };
  }
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return {
    file: diagnostic.file.fileName,
    line: line + 1,
    column: character + 1,
    code: diagnostic.code,
    message,
  };
});

process.stdout.write(JSON.stringify({ ok: messages.length === 0, diagnostics: messages }, null, 2));
process.exit(messages.length === 0 ? 0 : 1);
