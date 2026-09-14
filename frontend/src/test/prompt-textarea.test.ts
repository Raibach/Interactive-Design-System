/**
 * <prompt-textarea> — the box whose height was not its text's height.
 *
 * Measured live on a repair prompt (Console → Repair, prompt-container
 * provenance-missing), after the app had pushed all four sections in:
 *
 *   section    inline height   text needed   hidden by `overflow: hidden`
 *   System          45px          154px            109px
 *   User            45px          429px            384px   ← the fillable form
 *   Tool Call       45px           79px             34px
 *   Agent          154px          154px              0px
 *
 * 45px is the design's MINIMUM for a System/text section, and it is what the box
 * had measured while it was still empty. The re-measure sat behind a guard —
 * "only if the DOM value and the `value` property disagree" — and the app's own
 * pushes satisfy that guard's opposite by construction, because the binding sets
 * both in the same commit. So the box measured on the paths that could not have
 * content to measure (a keystroke, and the empty first paint) and skipped the one
 * path that always does (the host setting `value`). The 12-line repair form was on
 * screen only down to its second line until someone typed in it. (The form has since
 * been cut to one line per field — every explanation line is gone — which changes the
 * text, not the rule this file pins.)
 *
 * What is pinned here is the RULE, not the pixel values: the height is the text's
 * height, whoever set the text, with `min-height` as a floor and nothing as a
 * ceiling. The ceiling is the part worth pinning hardest — a cap would have kept
 * the form out of sight while looking like a deliberate layout decision, which is
 * the shape this bug arrived in.
 *
 * NOT coverable here: the width-change re-measure (a narrower column wraps the
 * same text onto more lines). jsdom has no ResizeObserver, so `connectedCallback`
 * takes its early-return branch. Verified live instead — the User box at 680px
 * wide is 429px tall, squeezed to 320px it re-measures to 754px, and back to
 * 429px, with zero clipped pixels at every width.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/prompt-input/prompt-textarea';
import { renderRepairForm, repairMaterialFor } from '@/shared/repairMaterial';

type TextareaEl = HTMLElement & {
  value: string;
  placeholder: string;
  minHeight: number;
  updateComplete: Promise<unknown>;
};

/** The inner <textarea> Lit renders, plus the tools to give it a fake extent. */
const mount = async (value = '', minHeight = 45) => {
  const el = document.createElement('prompt-textarea') as TextareaEl;
  el.value = value;
  el.minHeight = minHeight;
  document.body.appendChild(el);
  await el.updateComplete;
  // The first measure is scheduled (a frame later) and not run inline, so let it
  // land before the test starts asserting on the box's height.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  // jsdom lays nothing out, so scrollHeight is always 0 — the height a real browser
  // would report is supplied explicitly, as the text it would have measured.
  let scrollHeight = 0;
  Object.defineProperty(ta, 'scrollHeight', { configurable: true, get: () => scrollHeight });

  return {
    el,
    ta,
    /** What the text needs, in the browser that actually wraps it. */
    textNeeds(px: number) {
      scrollHeight = px;
    },
    /** A programmatic push, exactly as <prompt-input-section> does it. */
    async push(next: string) {
      el.value = next;
      await el.updateComplete;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    },
    /** The one path that measured all along: a keystroke. */
    type(next: string) {
      ta.value = next;
      ta.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    },
  };
};

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * The User seat for the finding this file was measured on (prompt-container,
 * provenance-missing), built by the module that ships it — so the fixture cannot drift
 * away from the text the box is actually handed.
 */
const FORM = renderRepairForm(
  repairMaterialFor({
    check: 'provenance-missing',
    component: 'prompt-container',
    nodeId: '40000746:6',
    what: 'No provenance block. Nothing marks which fields came from the design and which were invented.',
    fix: 'Add a "provenance" object marking each field verbatim or inferred.',
  }).fields,
);

describe('prompt-textarea is as tall as its text', () => {
  it('measures the text the app pushed in, not the empty box it measured first', async () => {
    const box = await mount();
    expect(box.ta.style.height).toBe('45px'); // the empty box: the design floor

    box.textNeeds(429); // what the text needs, as the browser would report it
    await box.push(FORM);

    expect(box.ta.value).toBe(FORM);
    expect(box.ta.style.height).toBe('429px');
  });

  it('has no ceiling — a ceiling would hide a form rather than a row of chrome', async () => {
    const box = await mount();
    box.textNeeds(5000); // longer than any window; the column scrolls, not the box
    await box.push(`${FORM}\n${FORM}`);

    expect(box.ta.style.height).toBe('5000px');
  });

  it('comes back down to the floor when the text fits again', async () => {
    const box = await mount();
    box.textNeeds(429);
    await box.push(FORM);
    expect(box.ta.style.height).toBe('429px');

    box.textNeeds(25); // one line
    await box.push('One line.');

    expect(box.ta.style.height).toBe('45px');
  });

  it('treats minHeight as a floor, never as the height', async () => {
    const box = await mount('', 145); // the design's RAG floor
    box.textNeeds(60); // less text than the floor allows
    await box.push('Two lines\nof context.');

    expect(box.ta.style.height).toBe('145px');
  });

  it('still measures on a keystroke, without waiting for a frame', async () => {
    const box = await mount();
    box.textNeeds(75);
    box.type('typing');

    expect(box.ta.style.height).toBe('75px');
  });

  it('declares no max-height of its own', async () => {
    const box = await mount('', 45);
    const css = Array.from(box.el.shadowRoot!.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n');

    expect(css).toContain('overflow: hidden'); // the clip that made a short box final
    expect(css).not.toMatch(/max-height/);
  });
});
