/**
 * The A2UI envelope boundary — the two labels that used to be ignored.
 *
 * Every operation the server emits is labeled with the format version it is
 * written in and the surface it belongs to (backend/routes/ai.py:754–790). The
 * shell read neither, so a v1.0 answer drew silently as v0.9.1, and an answer
 * carrying two surfaces became one pile holding parts of each.
 *
 * What is pinned here is the REFUSAL, and that it refuses by returning nothing:
 * a partial reading is exactly the silent wrong surface this replaces. The
 * envelopes below are the ones the server builds, verbatim.
 */
import { describe, it, expect } from 'vitest';
import {
  readA2UIEnvelope,
  envelopeRefusalError,
  applyComponentUpdate,
  SUPPORTED_A2UI_VERSIONS,
} from '@/shared/a2ui-envelope';
import { classifyFailure } from '@/shared/error-registry';

const CATALOG_ID = 'https://raibach.net/a2ui/catalogs/prompt-composer/v0_9_1/catalog.json';

/** One surface, as three operations — createSurface, then the two channels. */
const surface = (id: string, model: Record<string, unknown>, components: unknown[]) => [
  { version: 'v0.9.1', createSurface: { surfaceId: id, catalogId: CATALOG_ID } },
  { version: 'v0.9.1', updateComponents: { surfaceId: id, components } },
  { version: 'v0.9.1', updateDataModel: { surfaceId: id, path: '/', value: model } },
];

describe('readA2UIEnvelope', () => {
  it('reads the surface label, the catalog and both channels from the shape the server sends', () => {
    const read = readA2UIEnvelope(
      surface('main', { cards: [{ id: 'a', title: 'First' }] }, [
        { id: 'root', component: 'Column', children: ['grid'] },
        { id: 'grid', component: 'ConsoleCardGrid', items: { path: '/cards' } },
      ]),
    );

    expect(read.ok).toBe(true);
    if (read.ok === false) return;
    expect(read.reading.surfaceId).toBe('main');
    expect(read.reading.catalogId).toBe(CATALOG_ID);
    expect(read.reading.components).toHaveLength(2);
    expect(read.reading.dataModel.cards).toEqual([{ id: 'a', title: 'First' }]);
  });

  it('refuses a version it does not implement, and hands back no components at all', () => {
    // A v1.0 envelope used to be read with v0.9.1 rules. The difference is only
    // visible as a surface that is empty or wrong, with nothing said about why.
    const read = readA2UIEnvelope([
      { version: 'v1.0', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Column' }] } },
      { version: 'v1.0', updateDataModel: { surfaceId: 'main', path: '/', value: { cards: [] } } },
    ]);

    expect(read.ok).toBe(false);
    if (read.ok === true) return;
    expect(read.refusal.code).toBe('UNSUPPORTED-VERSION');
    expect(read.refusal.message).toContain('v1.0');
    // The message names what WOULD work, so the report is actionable.
    expect(read.refusal.message).toContain(`v${SUPPORTED_A2UI_VERSIONS[0]}`);
    expect('reading' in read).toBe(false);
  });

  it('accepts the version with or without its leading v — both spellings are on the wire', () => {
    const read = readA2UIEnvelope([
      { version: '0.9.1', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Column' }] } },
    ]);

    expect(read.ok).toBe(true);
    if (read.ok === false) return;
    expect(read.reading.components).toHaveLength(1);
  });

  it('refuses an answer that describes two surfaces instead of merging them', () => {
    const read = readA2UIEnvelope([
      ...surface('main', { cards: [] }, [{ id: 'root', component: 'Column' }]),
      ...surface('composer', { session: {} }, [{ id: 'root', component: 'Column' }]),
    ]);

    expect(read.ok).toBe(false);
    if (read.ok === true) return;
    expect(read.refusal.code).toBe('SURFACE-CONFLICT');
    expect(read.refusal.detail.surfaceIds).toEqual(['main', 'composer']);
    expect('reading' in read).toBe(false);
  });

  it('applies updateDataModel where its path points, in order, and a null deletes the key', () => {
    // `path` is the third label that was ignored: every value was written at the
    // root, so two operations naming different paths could not both survive.
    const read = readA2UIEnvelope([
      { version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/cards', value: [{ id: 'a', title: 'Old' }] } },
      { version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/cards/0/title', value: 'New' } },
      { version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/cards/0/stale', value: 'x' } },
      { version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/cards/0/stale', value: null } },
    ]);

    expect(read.ok).toBe(true);
    if (read.ok === false) return;
    const cards = read.reading.dataModel.cards as Array<Record<string, unknown>>;
    // The array survived being walked through: `/cards/0/title` addresses an
    // element by index, and a copy that coerced it to an object would delete the
    // list on the way to the field.
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe('New');
    expect('stale' in cards[0]).toBe(false);
  });

  it('reads a version-less envelope as one unnamed surface, and says that is what it did', () => {
    const read = readA2UIEnvelope([
      { updateComponents: { components: [{ id: 'root', component: 'Column' }] } },
    ]);

    expect(read.ok).toBe(true);
    if (read.ok === false) return;
    expect(read.reading.surfaceId).toBeNull();
    expect(read.reading.notes.join(' ')).toContain('no operation named a surface');
  });

  it('discards a components channel that is not an array instead of half-rendering it', () => {
    const read = readA2UIEnvelope([
      { version: 'v0.9.1', updateComponents: { surfaceId: 'main', components: { id: 'root' } } },
    ]);

    expect(read.ok).toBe(true);
    if (read.ok === false) return;
    expect(read.reading.components).toEqual([]);
    expect(read.reading.notes.join(' ')).toContain('not an array');
  });
});

describe('an envelope refusal reaches the failure ledger', () => {
  it('classifies as ENVELOPE-REFUSED, so the banner names what happened', () => {
    const read = readA2UIEnvelope([{ version: 'v1.0', updateComponents: { surfaceId: 'main', components: [] } }]);
    expect(read.ok).toBe(false);
    if (read.ok === true) return;

    const report = classifyFailure(envelopeRefusalError(read.refusal), {
      intent: 'render-console',
      httpStatus: 200,
    });

    expect(report.code).toBe('ENVELOPE-REFUSED');
    expect(report.headline).toContain('refused');
    // The reason travels with it: a 200 that refused its own envelope must not be
    // reportable as an unclassified failure.
    expect(report.detail).toContain('v1.0');
  });
});

/**
 * AN UPDATE IS AN OPERATION, NOT A REPLACEMENT — the half a Run needs.
 *
 * `render-session` writes `/` and there is nothing to write over, so reading an envelope
 * against an empty model was right by accident for every assembly this shell had. A RUN is the
 * first one that updates a surface which is already on screen and already carrying facts the
 * server does not have: the person's rows, their conversation, the places they dragged nodes to.
 * It writes `/run` and it names an id that is already in the tree — so the base model and the
 * by-id merge are what make it an update rather than an amnesia.
 *
 * Measured 2026-09-23 (READ-ME/CONTINUE-HERE.md §00c): before this, the Run patched the
 * component list by hand — `setOutputColumn('flow')` built AgentCanvas, AgentFlow,
 * OutputControls and CanvasFooter in TypeScript — so the third column was the one surface the
 * protocol did not build.
 */
describe('a Run updates the surface it is already looking at', () => {
  const runEnvelope = [
    { version: 'v0.9.1', createSurface: { surfaceId: 'main', catalogId: CATALOG_ID } },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'main',
        components: [
          { id: 'root', component: 'workspace-layout', theme: 'dark', children: { left: 'left-col', middle: 'middle-column', right: 'right-col' } },
          { id: 'middle-column', component: 'AgentCanvas', theme: 'dark', children: { header: 'middle-column-header', flow: 'middle-column-flow', footer: 'middle-column-footer' } },
          { id: 'middle-column-flow', component: 'AgentFlow', theme: 'dark', flow: { path: '/session/middle_column/flow' } },
        ],
      },
    },
    {
      version: 'v0.9.1',
      updateDataModel: { surfaceId: 'main', path: '/run', value: { ai_message: 'Assembling the drawing.', llm_used: true } },
    },
  ];

  it('leaves the model it was handed alone, except for the path the update names', () => {
    const live = {
      session: { id: 's-1', left_column: { sections: [{ name: 'System Role', content: 'the person typed this' }] } },
      trace: { entries: [] },
    };
    const read = readA2UIEnvelope(runEnvelope, live);
    expect(read.ok).toBe(true);
    if (read.ok === false) return;
    // THE ROWS ARE STILL THE PERSON'S — a root write would have replaced the whole model, which
    // is why the Run's assembly writes a PATH.
    expect(read.reading.dataModel.session).toEqual(live.session);
    expect(read.reading.dataModel.trace).toEqual({ entries: [] });
    expect(read.reading.dataModel.run).toEqual({ ai_message: 'Assembling the drawing.', llm_used: true });
    // AND THE SURFACE THE CALLER HANDED IN IS NOT MUTATED: the shell may still be rendering it.
    expect('run' in live).toBe(false);
  });

  it('merges components by id: updated in place, new ones added, the rest untouched', () => {
    const live = [
      { id: 'root', component: 'workspace-layout', children: { left: 'left-col', right: 'right-col' } },
      { id: 'left-col', component: 'prompt-section-editor', sections: { path: '/session/left_column/sections' } },
      { id: 'right-col', component: 'chat-panel', conversationId: { path: '/session/right_column/conversation_id' } },
      { id: 'middle-column', component: 'compiled-output-viewer', content: { path: '/session/middle_column/compiled_output' } },
    ];
    const read = readA2UIEnvelope(runEnvelope, { session: {} });
    expect(read.ok).toBe(true);
    if (read.ok === false) return;

    const merged = applyComponentUpdate(live, read.reading.components) as any[];
    const byId = (id: string) => merged.find((c) => c.id === id);
    // THE COLUMN IS A CANVAS NOW, under the id the layout already pointed at.
    expect(byId('middle-column').component).toBe('AgentCanvas');
    expect(byId('middle-column').children.flow).toBe('middle-column-flow');
    expect(byId('middle-column-flow').component).toBe('AgentFlow');
    // THE COLUMNS BESIDE IT ARE THE SAME OBJECTS — not copies, not re-created.
    expect(byId('left-col')).toBe(live[1]);
    expect(byId('right-col')).toBe(live[2]);
    // THE VIEWER IS REPLACED IN PLACE, because the middle keeps its id: the column that showed
    // the compiled output IS the column that now holds the canvas. Nothing is orphaned and
    // nothing is duplicated — the layout's pointer needed no change, which is the point of
    // stating the id to the model rather than letting it invent one.
    expect(merged.filter((c) => c.component === 'compiled-output-viewer')).toHaveLength(0);
    // 4 + ONE: the drawing is the only genuinely new entry (the layout root and the middle column
    // are updated in place, by id). A merge that added the canvas as a second component would put
    // two things in the middle column's slot, which is the duplicate-id failure the renderer
    // reports.
    expect(merged).toHaveLength(5);
  });

  it('keeps what the update does not mention, and never invents a component', () => {
    const live = [
      { id: 'root', component: 'workspace-layout', children: { left: 'left-col', right: 'right-col' } },
      { id: 'left-col', component: 'prompt-section-editor', sections: { path: '/session/left_column/sections' } },
      { id: 'trace-view', component: 'TraceFeed', entries: { path: '/trace/entries' } },
    ];
    // An entry with no id cannot be joined by id, so it is dropped rather than merged blindly —
    // the renderer reports a malformed payload itself, and this is not the place to guess.
    const update = [{ component: 'AgentCanvas' }, { id: 'trace-view', component: 'TraceFeed', entries: { path: '/trace/entries' } }];
    const merged = applyComponentUpdate(live, update) as any[];
    expect(merged).toHaveLength(3);
    // WHAT THE UPDATE DOES NOT NAME IS THE SAME OBJECT — not a copy, not re-created.
    expect(merged[1]).toBe(live[1]);
    // AND WHAT IT DOES NAME IS ITS OWN ENTRY: the update is the newer truth about that component.
    expect(merged[2]).toBe(update[1]);
  });
});
