/**
 * THE CHAT OUTPUT SLOT HAS TWO FRAMES AND TWO FILLS, AND ONLY ONE OF THEM GOES LIGHT.
 *
 * The measured failure, 2026-09-24: the results state painted the CONTAINER as well as the
 * card, so the whole output slot read as one light slab and the green ring the drawing puts
 * around the card was gone. The owner, at the screen: "when I go to the chat output the
 * entire container now is a light color. It should've only been the inside."
 *
 * The two frames are the drawing's own and the catalog records both (registry.json): the
 * container "output-output-results-area-container" #40001130:5059, fill #CBE6E3 in both
 * states, and the card it holds "chat-output-area-results" #40001130:5060, which is the one
 * that wears the results colour.
 *
 * jsdom has no layout and computes no colours, so what is asserted here is the thing that
 * was actually wrong: WHICH SELECTOR CARRIES THE RESULTS FILL. It is a structural test on
 * purpose — there is no DOM assertion that can tell two backgrounds apart in jsdom, and the
 * defect is not a colour value, it is a selector. See AGENTS-instructions/OUTPUT-STYLING.md
 * R4, which records the rule and the earlier reverted attempts around it.
 */
import { describe, it, expect } from 'vitest';
import { ChatHeader } from '@/components/lit/chat-header';

const css = (ChatHeader as unknown as { styles: { cssText?: string } }).styles.cssText ?? '';

/** Every rule whose selector carries the results flag. */
const resultsRules = (): string[] => css.match(/:host\(\[has-results\]\)[^{]*\{[^}]*\}/g) ?? [];

describe('<chat-header> — the results fill stays on the card', () => {
  it('has a stylesheet to read (guards the two tests below)', () => {
    expect(css).toContain('.shell');
  });

  it('paints the card while the thread carries results', () => {
    expect(css).toContain(':host([has-results]) .shell { background: #F7F8F2; }');
  });

  it('never paints the container the card sits in', () => {
    // The container is the block's own #CBE6E3 in both states. A has-results rule naming
    // .output-area is the defect this file exists for — it erases the drawing's edge.
    const rules = resultsRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).not.toMatch(/\.output-area/);
  });
});
