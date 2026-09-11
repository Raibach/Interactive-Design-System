/**
 * <a2ui-renderer> — the boundary and the protocol, held down.
 *
 * The renderer guards its input in several places, and every one of those guards
 * is invisible when it works: a malformed payload renders an error block instead
 * of throwing, which looks the same as nothing having happened. So they are
 * pinned here.
 *
 * The distinction these tests are built around: at runtime nothing typechecks a
 * Lit property. A host assigns `components` through a ref, and the value crossed
 * a network boundary — so the declared `A2UIComponent[]` is a claim about the
 * author's intent, not a fact about the value. Every case below hands the element
 * something the type system would have rejected.
 */
import { describe, it, expect } from 'vitest';
import { resolveBinding, componentProps, resolveTag } from '@/components/lit/a2ui-renderer';

const mount = async (props: Record<string, unknown>) => {
  const el = document.createElement('a2ui-renderer') as HTMLElement & Record<string, any>;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  // Lit injects its stylesheet INTO the shadow root, so `textContent` always
  // starts with the element's CSS. Reading it raw means "renders nothing" can
  // never be asserted — the style block is always there. Strip it, then trim.
  const css = el.shadowRoot?.querySelector('style')?.textContent ?? '';
  const text = (el.shadowRoot?.textContent ?? '').replace(css, '').trim();
  el.remove();
  return { el, text };
};

// ── binding: the join between the two channels ──────────────────────────────

describe('resolveBinding', () => {
  it('walks a path through nested objects and arrays', () => {
    const model = { cards: [{ title: 'First' }, { title: 'Second' }] };
    expect(resolveBinding({ path: '/cards/1/title' }, model)).toBe('Second');
  });

  it('returns undefined when the path overruns the model, rather than throwing', () => {
    expect(resolveBinding({ path: '/cards/9/title' }, { cards: [] })).toBeUndefined();
    expect(resolveBinding({ path: '/missing/deeply/nested' }, {})).toBeUndefined();
  });

  it('returns undefined for a non-object model without throwing', () => {
    // A host can assign anything. None of these may raise.
    expect(resolveBinding({ path: '/a' }, null as unknown as Record<string, unknown>)).toBeUndefined();
    expect(resolveBinding({ path: '/a' }, undefined as unknown as Record<string, unknown>)).toBeUndefined();
    expect(resolveBinding({ path: '/a' }, 'a string' as unknown as Record<string, unknown>)).toBeUndefined();
  });

  it('does NOT treat a bare string as a path', () => {
    // "/usr/bin" and "/v2/chat" are legitimate copy. Guessing here would corrupt
    // real content, so only the object form binds.
    expect(resolveBinding('/cards/0/title', { cards: [{ title: 'x' }] })).toBe('/cards/0/title');
    expect(resolveBinding('plain text', {})).toBe('plain text');
  });

  it('passes through objects that carry no path', () => {
    const literal = { notAPath: true };
    expect(resolveBinding(literal, {})).toBe(literal);
  });

  it('leaves primitives and arrays alone', () => {
    expect(resolveBinding(3, {})).toBe(3);
    expect(resolveBinding(true, {})).toBe(true);
    const arr = [1, 2];
    expect(resolveBinding(arr, {})).toBe(arr);
  });
});

describe('componentProps', () => {
  it('binds non-structural props and drops structure', () => {
    const model = { label: 'Send' };
    const props = componentProps(
      { id: 'b1', component: 'Button', children: ['x'], label: { path: '/label' }, weight: 2 },
      model,
    );
    expect(props).toEqual({ label: 'Send', weight: 2 });
    expect(props).not.toHaveProperty('id');
    expect(props).not.toHaveProperty('component');
    expect(props).not.toHaveProperty('children');
  });

  it('binding does not happen without a model, and does not throw', () => {
    const props = componentProps({ id: 'b1', component: 'Button', label: { path: '/label' } });
    expect(props.label).toBeUndefined();
  });
});

// ── name resolution: primitives, composites, allowlist, nothing ─────────────

describe('resolveTag', () => {
  it('resolves spec primitives the renderer owns', () => {
    expect(resolveTag('Text')).toMatch(/^a2ui-/);
    expect(resolveTag('Column')).toMatch(/^a2ui-/);
  });

  it('resolves a composite to the design-system element it really is', () => {
    // Not a casing guess: folding `SectionEditor` would give `section-editor`,
    // which resolves to nothing and reads as a missing component.
    expect(resolveTag('SectionEditor')).toBe('prompt-section-editor');
    expect(resolveTag('CompiledOutput')).toBe('compiled-output-viewer');
  });

  it('returns null for a name nothing claims, so the caller can report it', () => {
    expect(resolveTag('NotARealComponent')).toBeNull();
    expect(resolveTag('')).toBeNull();
  });
});

// ── the boundary: values the type system would have rejected ────────────────

describe('malformed payload', () => {
  it('reports a non-array instead of throwing', async () => {
    const { text } = await mount({ components: { not: 'an array' } });
    expect(text).toContain('must be an array');
  });

  it('reports a null payload instead of throwing', async () => {
    const { text } = await mount({ components: null });
    expect(text).toContain('must be an array');
  });

  it('renders nothing, silently, for an empty list', async () => {
    // An empty list is Grace saying "no surface", not an error.
    const { text } = await mount({ components: [] });
    expect(text).toBe('');
  });
});

describe('malformed entries', () => {
  it('skips an entry that cannot be keyed, and reports it', async () => {
    const { text } = await mount({
      components: [{ id: 'root', component: 'Column' }, 'not an object', { component: 'Text' }],
    });
    expect(text).toContain('Malformed entry');
  });
});

describe('duplicate ids', () => {
  it('reports the collision rather than letting one component disappear', async () => {
    // ids are the join key for `children`. A Map cannot hold two, so without this
    // the references meant for the first copy point silently at the second.
    const { text } = await mount({
      components: [
        { id: 'root', component: 'Column', children: ['dup'] },
        { id: 'dup', component: 'Text', text: 'first' },
        { id: 'dup', component: 'Text', text: 'second' },
      ],
    });
    expect(text).toContain('Duplicate id');
  });
});

describe('root resolution', () => {
  it('names the likely root when the configured id is absent', async () => {
    // The A2UI spec does not require the root to be called "root"; only this
    // repo's prompt does. The error must say which id to use.
    const { text } = await mount({
      components: [
        { id: 'surface', component: 'Column', children: ['child'] },
        { id: 'child', component: 'Text', text: 'hi' },
      ],
    });
    expect(text).toContain('No root component');
    expect(text).toContain('nothing lists as a child');
    expect(text).toContain('surface');
  });

  it('renders when root-id matches', async () => {
    const { text } = await mount({
      rootId: 'surface',
      components: [{ id: 'surface', component: 'Column' }],
    });
    expect(text).not.toContain('No root component');
  });
});
