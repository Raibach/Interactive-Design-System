// THE SHELL'S REACH INTO THE SURFACE IS DEEP, OR IT DOES NOT HAPPEN.
//
// Every Lit element the shell needs lives inside one or more shadow roots
// (<a2ui-renderer> draws the surface inside its own), so a document-level query finds
// NOTHING and the code beside it fails silently. That is not a theory — it is how three
// controls were dead at once, measured 2026-09-18:
//
//   · the Run spinner wrote `isRunning` through `document.querySelectorAll('control-bar'|
//     'canvas-footer')` — nothing was found, so the control never spun;
//   · "a fresh composer starts clean" called `document.querySelector('chat-panel')
//     ?.clearThread?.()` — never found, so the thread was never emptied;
//   · the save read column widths through an event round trip nothing answered.
//
// All three now go through `deepFind` (or through the element that owns the fact). This
// test is the pin: a document-level query for a SURFACE tag in the shell is the bug, and
// it cannot come back without a red test naming it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES = join(HERE, '..', 'pages');

/** Comments name the rule; only code is checked. Line comments and block-comment lines. */
const code = (file: string): string =>
  readFileSync(join(PAGES, file), 'utf8')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .filter((line) => !/^\s*\*/.test(line))
    .join('\n');

const SURFACE_TAGS =
  'chat-panel|control-bar|canvas-footer|workspace-layout|agent-canvas|agent-flow|compiled-output-viewer|prompt-section-editor|a2ui-renderer|trace-feed|output-controls';

describe('the shell reaches the surface through deepFind, never through document', () => {
  for (const file of ['WritingAreaIndex.tsx', 'ConsolePage.tsx']) {
    it(`${file} holds no document-level query for a surface tag`, () => {
      const hits = [...code(file).matchAll(
        new RegExp(`document\\.querySelector(?:All)?\\(\\s*['"\`](?:${SURFACE_TAGS})['"\`]`, 'g'),
      )].map((m) => m[0]);
      expect(hits, `found: ${hits.join(', ')}`).toEqual([]);
    });
  }
});
