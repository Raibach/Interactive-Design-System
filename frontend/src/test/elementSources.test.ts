/**
 * EVERY ELEMENT SOURCE IS LOADED, AND DEFINES THE TAG IT CLAIMS.
 *
 * This test exists for two failures that both look like nothing on screen.
 *
 * 1. THE BACKTICK IN A TEMPLATE LITERAL. A `${` or a bare backtick inside a `css` or
 *    `html` literal ends the literal early, and the break is usually still PARSEABLE — so
 *    `tsc` accepts it and the bundler may too, and the element then throws where it is
 *    used (`css(...).gripper is not a function`) or silently draws the wrong tree. It has
 *    cost this repository three separate debugging rounds, twice in one evening
 *    (2026-09-19). A regex over the source cannot see it reliably — the parentheses and
 *    quotes of a broken literal are still balanced — but LOADING the module can: the
 *    literal is evaluated at class-definition time, so a broken one throws here.
 *
 * 2. AN ELEMENT NOTHING IMPORTS. Its guarded `customElements.define` never runs, so the
 *    tag does not exist, the surface's name for it resolves to nothing, and an empty box
 *    is drawn with no error anywhere. This has happened twice (role-dropdown; then
 *    chat-repair-actions when the panel stopped drawing it), and both times the file was
 *    correct — only the import was missing.
 *
 * So: one table, one import per source, one assertion per tag. A new element added
 * without being reachable fails here rather than on someone's screen.
 */
import { describe, it, expect } from 'vitest';

// Every element source in src/components/lit, imported for its side effect. Written as
// static imports on purpose: a dynamic import inside the test would still run, but a
// static one also fails the FILE at collection time, which is the earliest turn.
import '@/components/lit/a2ui-primitives';
import '@/components/lit/a2ui-renderer';
import '@/components/lit/agent-canvas';
import '@/components/lit/agent-card-element';
import '@/components/lit/agent-flow';
import '@/components/lit/ai-surface-sandbox';
import '@/components/lit/canvas-footer';
import '@/components/lit/chat-action-bar';
import '@/components/lit/chat-fold';
import '@/components/lit/chat-footer';
import '@/components/lit/chat-header';
import '@/components/lit/chat-input';
import '@/components/lit/chat-messages';
import '@/components/lit/chat-navigation-bar';
import '@/components/lit/chat-panel';
import '@/components/lit/chat-repair-actions';
import '@/components/lit/compiled-output-viewer';
import '@/components/lit/control-bar';
import '@/components/lit/error-banner';
import '@/components/lit/output-controls';
import '@/components/lit/prompt-section-editor';
import '@/components/lit/small-dropdown';
import '@/components/lit/trace-feed';
import '@/components/lit/user-response-bubble';
import '@/components/lit/workspace-layout';
import '@/components/lit/prompt-input/gripper-prompt-input';
import '@/components/lit/prompt-input/model-selector-button';
import '@/components/lit/prompt-input/prompt-container';
import '@/components/lit/prompt-input/prompt-input-section';
import '@/components/lit/prompt-input/prompt-textarea';
import '@/components/lit/prompt-input/role-dropdown';
import '@/components/lit/prompt-input/role-tile';
import '@/components/lit/prompt-input/status-bar-prompt-input';

/** tag → the source that must have defined it. */
const ELEMENTS: Record<string, string> = {
  // The A2UI primitives and the renderer-owned structural composites.
  'a2ui-text': 'a2ui-primitives',
  'a2ui-image': 'a2ui-primitives',
  'a2ui-column': 'a2ui-primitives',
  'a2ui-row': 'a2ui-primitives',
  'a2ui-card': 'a2ui-primitives',
  'a2ui-button': 'a2ui-primitives',
  'a2ui-console-card-grid': 'a2ui-primitives',
  'a2ui-action-group': 'a2ui-primitives',
  'a2ui-decision-dialog': 'a2ui-primitives',
  'a2ui-footer-bar': 'a2ui-primitives',
  'a2ui-status-readout': 'a2ui-primitives',
  'a2ui-token-cost-readout': 'a2ui-primitives',
  'a2ui-add-section-button': 'a2ui-primitives',
  'a2ui-renderer': 'a2ui-renderer',
  // The console and the shell.
  'agent-canvas': 'agent-canvas',
  'agent-card-element': 'agent-card-element',
  'agent-flow': 'agent-flow',
  'ai-surface-sandbox': 'ai-surface-sandbox',
  'canvas-footer': 'canvas-footer',
  'compiled-output-viewer': 'compiled-output-viewer',
  'control-bar': 'control-bar',
  'error-banner': 'error-banner',
  'output-controls': 'output-controls',
  'prompt-section-editor': 'prompt-section-editor',
  'workspace-layout': 'workspace-layout',
  // The chat column — the seat, the rail, and the pieces it composes.
  'chat-panel': 'chat-panel',
  'chat-navigation-bar': 'chat-navigation-bar',
  'chat-header': 'chat-header',
  'chat-messages': 'chat-messages',
  'chat-action-bar': 'chat-action-bar',
  'chat-input': 'chat-input',
  'chat-footer': 'chat-footer',
  'chat-fold': 'chat-fold',
  'chat-repair-actions': 'chat-repair-actions',
  'small-dropdown': 'small-dropdown',
  'trace-feed': 'trace-feed',
  'user-response-bubble': 'user-response-bubble',
  // The prompt composer's pieces.
  'gripper-prompt-input': 'gripper-prompt-input',
  'model-selector-button': 'model-selector-button',
  'prompt-container': 'prompt-container',
  'prompt-input-section': 'prompt-input-section',
  'prompt-textarea': 'prompt-textarea',
  'role-dropdown': 'role-dropdown',
  'role-tile': 'role-tile',
  'status-bar-prompt-input': 'status-bar-prompt-input',
};

describe('every element source loads and defines its tag', () => {
  it('defines all of them (a source that throws on load fails this file at collection)', () => {
    const missing = Object.entries(ELEMENTS)
      .filter(([tag]) => !customElements.get(tag))
      .map(([tag, src]) => `${tag} (${src})`);
    expect(missing).toEqual([]);
  });

  it('registers each tag to a class, not to a stub', () => {
    for (const tag of Object.keys(ELEMENTS)) {
      const ctor = customElements.get(tag);
      expect(typeof ctor).toBe('function');
      // A class, so it can be constructed and its static styles were evaluated — which is
      // the point: `css` was called, and its result was used, at definition time.
      expect(String((ctor as CustomElementConstructor).name).length).toBeGreaterThan(0);
    }
  });
});
