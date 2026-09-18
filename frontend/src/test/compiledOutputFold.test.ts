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
 * What is pinned here is that the block is NOT rendered until it is asked for,
 * that asking works, and that the index-keyed state opens the block that was
 * clicked rather than every block of the same length.
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

const heads = (el: ViewerEl) =>
  Array.from(el.shadowRoot!.querySelectorAll('.fold-head')) as HTMLElement[];

describe('compiled-output-viewer folds a long fenced block', () => {
  it('announces the block with its language and line count, and does not render it', async () => {
    const el = await mount(answerWithFile(60));

    expect(heads(el)).toHaveLength(1);
    expect(heads(el)[0].textContent).toContain('ts');
    expect(heads(el)[0].textContent).toContain('60 lines');
    expect(heads(el)[0].getAttribute('aria-expanded')).toBe('false');
    // The sixty lines are not on screen, and the verdict above them still is.
    expect(el.shadowRoot!.querySelector('.fold pre')).toBeNull();
    expect(el.shadowRoot!.querySelector('.md')!.textContent).toContain('RESULT: renamed the flag.');
    expect(el.shadowRoot!.querySelector('.md')!.textContent).not.toContain('fileLine59');
  });

  it('opens the block on one click and closes it again', async () => {
    const el = await mount(answerWithFile(60));

    heads(el)[0].click();
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('.fold pre');
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain('const fileLine0 = 0;');
    expect(pre!.textContent).toContain('const fileLine59 = 59;');
    expect(heads(el)[0].getAttribute('aria-expanded')).toBe('true');

    heads(el)[0].click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.fold pre')).toBeNull();
  });

  it('leaves a short snippet unfolded — it was never the wall', async () => {
    const el = await mount(['Run this:', '', block('cmd', 3, 'bash')].join('\n'));

    expect(heads(el)).toHaveLength(0);
    expect(el.shadowRoot!.querySelector('.md pre')!.textContent).toContain('const cmd0 = 0;');
  });

  it('folds each long block on its own, so a click opens the one that was clicked', async () => {
    const el = await mount([block('first', 60), '', block('second', 20)].join('\n'));

    expect(heads(el)).toHaveLength(2);
    heads(el)[1].click();
    await el.updateComplete;

    const pres = Array.from(el.shadowRoot!.querySelectorAll('.fold pre'));
    expect(pres).toHaveLength(1);
    expect(pres[0].textContent).toContain('const second0 = 0;');
    expect(pres[0].textContent).not.toContain('first0');
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
    expect(heads(el)).toHaveLength(0);
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
