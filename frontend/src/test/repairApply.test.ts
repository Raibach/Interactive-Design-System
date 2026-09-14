/**
 * The answer -> file contract. These pin the three things that decide whether a
 * repair touches a file at all:
 *
 *   parsing      only the asked-for shape yields a file (`FILE: <path>` + one
 *                fenced block). The prose answer that started all this — a
 *                sentence saying the correction was applied — yields NOTHING, so
 *                the app writes nothing and says so instead of agreeing.
 *   readiness    a cut-off, patch-shaped or unchanged answer is refused BEFORE a
 *                byte moves. This is the difference between a missing correction
 *                and a broken component.
 *   the reason   every refusal is a sentence a person can read, because that
 *                sentence is what the chat shows.
 */
import { describe, expect, it } from 'vitest';
import { applyReadiness, correctionFromAnswer } from '@/shared/repairApply';

const FILE = 'frontend/src/components/lit/prompt-input/prompt-container.ts';

/** A file big enough that the half-length rule is in play. */
const original = [
  '/**',
  ' * prompt-container — the composer.',
  ' */',
  ...Array.from({ length: 40 }, (_, i) => `const rail${i} = 'rail text ${i}';`),
  'export default rail0;',
  '',
].join('\n');

describe('correctionFromAnswer — the shape the Agent seat asks for', () => {
  it('reads the path and the whole file out of the answer', () => {
    const answer = [
      'RESULT: DONE',
      'The provenance block is added to the container.',
      '',
      `FILE: ${FILE}`,
      '```ts',
      '/**',
      ' * prompt-container — the composer.',
      ' */',
      'export default rail0;',
      '```',
    ].join('\n');

    const found = correctionFromAnswer(answer);
    expect(found).not.toBeNull();
    expect(found!.path).toBe(FILE);
    expect(found!.content).toContain('prompt-container');
    expect(found!.content.endsWith('\n')).toBe(true);
    // The RESULT line and the prose stay OUT of the file.
    expect(found!.content).not.toContain('RESULT:');
    expect(found!.content).not.toContain('The provenance block');
  });

  it('accepts a backticked path and a bare fence', () => {
    const answer = `FILE: \`${FILE}\`\n\`\`\`\nconst x = 1;\n\`\`\`\n`;
    const found = correctionFromAnswer(answer);
    expect(found!.path).toBe(FILE);
    expect(found!.content).toBe('const x = 1;\n');
  });

  it('finds nothing in a prose answer — the failure this exists to prevent', () => {
    // The real answer, verbatim in shape: a claim of an applied correction, a
    // self-invented verification, and no file anywhere. Nothing may be written.
    const answer = [
      'Correction applied in frontend/src/components/lit/prompt-input/prompt-container.ts:',
      'each field now carries a provenance marker.',
      '',
      'Verification: the annotation reads verbatim, matching the design exactly.',
      '',
      'The finding holds.',
    ].join('\n');

    expect(correctionFromAnswer(answer)).toBeNull();
  });

  it('ignores a fence that comes BEFORE the file label', () => {
    const answer = `\`\`\`json\n{"design": true}\n\`\`\`\n\nFILE: ${FILE}\n\`\`\`ts\nconst y = 2;\n\`\`\`\n`;
    expect(correctionFromAnswer(answer)!.content).toBe('const y = 2;\n');
  });

  it('returns nothing when the label has no block under it', () => {
    expect(correctionFromAnswer(`FILE: ${FILE}\n\nHere is what I would change: add a marker.`)).toBeNull();
  });

  it('returns nothing when there is no label at all', () => {
    expect(correctionFromAnswer('```ts\nconst z = 3;\n```')).toBeNull();
    expect(correctionFromAnswer('')).toBeNull();
  });
});

describe('applyReadiness — what may replace a file', () => {
  const grown = original.replace('export default rail0;', 'const provenance = "verbatim";\nexport default rail0;');

  it('accepts a whole file that carries the change', () => {
    const ready = applyReadiness(original, grown);
    expect(ready.ok).toBe(true);
    expect(ready.ok && ready.content).toContain('const provenance = "verbatim";');
  });

  it('keeps the file ending in a newline', () => {
    const noNewline = grown.replace(/\n+$/, '');
    const ready = applyReadiness(original, noNewline);
    expect(ready.ok && ready.content.endsWith('\n')).toBe(true);
  });

  it('refuses the file unchanged — nothing to apply', () => {
    const ready = applyReadiness(original, original);
    expect(ready.ok).toBe(false);
    expect(ready.ok === false && ready.reason).toContain('unchanged');
  });

  it('refuses a cut-off answer, and says how short it came back', () => {
    const ready = applyReadiness(original, original.slice(0, 300));
    expect(ready.ok).toBe(false);
    expect(ready.ok === false && ready.reason).toMatch(/lines where the file has/);
  });

  it('refuses an answer that leaves a brace open', () => {
    const ready = applyReadiness(original, `${grown}\nexport const broken = {\n`);
    expect(ready.ok).toBe(false);
    expect(ready.ok === false && ready.reason).toContain('curly brace');
  });

  it('refuses a patch — this app replaces whole files', () => {
    const patch = `--- a/${FILE}\n+++ b/${FILE}\n@@ -1,3 +1,3 @@\n-old\n+new\n`;
    const ready = applyReadiness(original, patch);
    expect(ready.ok).toBe(false);
    expect(ready.ok === false && ready.reason).toContain('cannot apply a diff');
  });

  it('refuses an empty answer', () => {
    const ready = applyReadiness(original, '   \n');
    expect(ready.ok).toBe(false);
    expect(ready.ok === false && ready.reason).toContain('no file');
  });

  it('does not apply the half-length rule to a tiny file', () => {
    // 3 short lines -> 2 is a legitimate edit, not a cut-off answer.
    const ready = applyReadiness('a\nb\nc\n', 'a\nb\n');
    expect(ready.ok).toBe(true);
  });
});
