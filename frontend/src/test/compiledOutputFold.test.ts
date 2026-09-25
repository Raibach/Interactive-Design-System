/**
 * <compiled-output-viewer> — the whole-file answer, announced instead of pasted.
 *
 * A repair answer hands back an ENTIRE file, because that is the contract the
 * write path enforces (`applyRepair` overwrites a file; `applyReadiness` rejects a
 * patch or a cut-off file). So a one-word change arrived as sixty lines of code in
 * the pane that shows the answer, and the line that said what had happened sat
 * above it in a wall. A long fenced block is now one line — language, line count,
 * a way to open it — and short snippets are untouched, because they were never
 * the wall.
 *
 * The fold was the viewer's own button machinery; it is now the native `<details>`
 * element the shared marked renderer emits (shared/richText) — one summary line,
 * the block inside, opened by the browser's own summary-click toggle. What is
 * pinned here is the same behavior under the new mechanism: the block is
 * announced rather than shown, a click opens it and closes it, and each long
 * block folds on its own.
 */
import { describe, it, expect } from 'vitest';
import '@/components/lit/compiled-output-viewer';

type ViewerEl = HTMLElement & {
  content: string;
  viewMode: 'rendered' | 'raw';
  updateComplete: Promise<unknown>;
};

const mount = async (content: string) => {
  const el = document.createElement('compiled-output-viewer') as ViewerEl;
  el.content = content;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

const fake = (marker: string, lines: number) =>
  Array.from({ length: lines }, (_, i) => `const ${marker}${i} = ${i};`);

const block = (marker: string, lines: number, lang = 'ts') =>
  [`\`\`\`${lang}`, ...fake(marker, lines), '```'].join('\n');

/** The answer as a repair writes it: the verdict, then the whole file back. */
const answerWithFile = (lines: number) =>
  ['RESULT: renamed the flag.', '', block('fileLine', lines), '', 'DONE'].join('\n');

/** The fold, by its details element: one per long fenced block. */
const folds = (el: ViewerEl) =>
  Array.from(el.shadowRoot!.querySelectorAll('details.fold')) as HTMLDetailsElement[];

describe('compiled-output-viewer folds a long fenced block', () => {
  it('announces the block with its language and line count, and leaves it closed', async () => {
    const el = await mount(answerWithFile(60));

    expect(folds(el)).toHaveLength(1);
    const summary = folds(el)[0].querySelector('summary')!;
    expect(summary.textContent).toContain('ts');
    expect(summary.textContent).toContain('60 lines');
    expect(folds(el)[0].hasAttribute('open')).toBe(false);
    // The verdict above the fold still reads.
    expect(el.shadowRoot!.querySelector('.md')!.textContent).toContain('RESULT: renamed the flag.');
  });

  it('opens the block on one click and closes it again', async () => {
    const el = await mount(answerWithFile(60));

    const details = folds(el)[0];
    details.querySelector('summary')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;
    expect(details.hasAttribute('open')).toBe(true);
    expect(details.querySelector('pre')!.textContent).toContain('const fileLine0 = 0;');
    expect(details.querySelector('pre')!.textContent).toContain('const fileLine59 = 59;');

    details.querySelector('summary')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;
    expect(details.hasAttribute('open')).toBe(false);
  });

  it('leaves a short snippet unfolded — it was never the wall', async () => {
    const el = await mount(['Run this:', '', block('cmd', 3, 'bash')].join('\n'));

    expect(folds(el)).toHaveLength(0);
    expect(el.shadowRoot!.querySelector('.md pre')!.textContent).toContain('const cmd0 = 0;');
  });

  it('folds each long block on its own, so a click opens the one that was clicked', async () => {
    const el = await mount([block('first', 60), '', block('second', 20)].join('\n'));

    const all = folds(el);
    expect(all).toHaveLength(2);
    all[1].querySelector('summary')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;

    expect(all[1].hasAttribute('open')).toBe(true);
    expect(all[0].hasAttribute('open')).toBe(false);
    expect(all[1].querySelector('pre')!.textContent).toContain('const second0 = 0;');
    expect(all[1].querySelector('pre')!.textContent).not.toContain('first0');
  });

  it('shows the whole block in Raw, the pane\'s own escape hatch', async () => {
    const el = await mount(answerWithFile(60));

    el.viewMode = 'raw';
    await el.updateComplete;

    // The viewer's raw <pre> is class "raw". It used to be "output raw": the
    // class "output" carried the scroll container when the whole column was one
    // pane, and it now belongs to .output-body — the scrolling region inside the
    // drawn output area (40000909:4165). The assertion is unchanged: Raw shows
    // the whole block, unfolded.
    const raw = el.shadowRoot!.querySelector('pre.raw');
    expect(raw).not.toBeNull();
    expect(raw!.textContent).toContain('const fileLine59 = 59;');
    expect(folds(el)).toHaveLength(0);
  });
});

/**
 * The chip in the meta row. It read "empty" over 3,834 characters of restored answer,
 * measured 2026-09-17, because its only value was the constructor's default and nothing
 * in this app assigns `status`. What it says now comes from the pane it sits in — unless a
 * surface supplies the spec's own word, which still wins.
 */
describe('<compiled-output-viewer> — the status chip describes the pane', () => {
  const chip = (el: ViewerEl) => {
    const s = el.shadowRoot!.querySelector('.status');
    return s ? s.textContent!.trim() : null;
  };

  it('says empty only when the pane is empty', async () => {
    const el = await mount('');
    expect(chip(el)).toBe('empty');
  });

  it('says complete when there is an answer on screen', async () => {
    const el = await mount('Line 1 — RESULT: DONE. The annotation is written.');
    expect(chip(el)).toBe('complete');
  });

  it.each([
    ['Error: 500 Internal Server Error'],
    ['⚠️ Run failed.'],
    ['(No output returned.)'],
  ])('says error for the app\'s own failure marker: %s', async (text) => {
    const el = await mount(text);
    expect(chip(el)).toBe('error');
  });

  it('lets a surface\'s own status win, which is the spec\'s contract', async () => {
    const el = (await mount('Answer')) as ViewerEl & { status: string };
    el.status = 'streaming';
    await el.updateComplete;
    expect(chip(el)).toBe('streaming');
  });
});
