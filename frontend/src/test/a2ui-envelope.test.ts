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
