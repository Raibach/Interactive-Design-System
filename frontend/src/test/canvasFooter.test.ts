/**
 * <canvas-footer> — the play control says it is working.
 *
 * The owner, 2026-09-23, pressing Run: "there's no spinner … you need to put a spinner on the
 * stop button or on the run button so that a user knows there's activity." The RUN button in
 * the prompt's own bar has had one all along (control-bar: `isRunning` draws a spinner and
 * "Running…") — but a Run DOCKS that bar to its rail, so the control wearing the spinner folds
 * away at the exact moment the work starts. The canvas foot is the bar that stays on screen
 * once the drawing arrives, which makes it the one that has to say the run is in flight.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/canvas-footer';
import type { CanvasFooter } from '@/components/lit/canvas-footer';

type El = CanvasFooter & { updateComplete: Promise<unknown> };

const mounted: El[] = [];

const mount = async (): Promise<El> => {
  const el = document.createElement('canvas-footer') as El;
  document.body.appendChild(el);
  await el.updateComplete;
  mounted.push(el);
  return el;
};

const play = (el: El): HTMLButtonElement => el.shadowRoot!.querySelector('#canvas-play') as HTMLButtonElement;

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

describe('<canvas-footer> — the play control while a run is in flight', () => {
  it('idle: it names the action, and carries no spinner to explain', async () => {
    const el = await mount();
    el.running = false;
    await el.updateComplete;

    expect(play(el).textContent).toContain('Play the run');
    expect(play(el).querySelector('.spin')).toBeNull();
    expect(play(el).disabled).toBe(false);
  });

  it('running: a spinner and Running…, and a second press cannot start a second run', async () => {
    const el = await mount();
    el.running = true;
    await el.updateComplete;

    // DRAWN, not only disabled — the disabled attribute alone said nothing a person could see.
    expect(play(el).querySelector('.spin')).toBeTruthy();
    expect(play(el).textContent).toContain('Running…');
    expect(play(el).disabled).toBe(true);
    // AND SPOKEN: the label changes and it is announced as it changes.
    expect(play(el).getAttribute('aria-live')).toBe('polite');
  });

  it('the save control keeps its own spinner — the two states are not one flag', async () => {
    // Save and Run are separate facts, and a run in flight must not claim the package is
    // being saved (or the reverse). Both dress the same way, which is the point.
    const el = await mount();
    el.saving = true;
    await el.updateComplete;
    const save = el.shadowRoot!.querySelector('#canvas-save') as HTMLButtonElement;
    expect(save.querySelector('.spin')).toBeTruthy();
    expect(save.textContent).toContain('Saving…');
    expect(play(el).querySelector('.spin')).toBeNull();
  });
});
