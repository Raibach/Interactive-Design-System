/**
 * THE OFFICIAL CLIENT BRIDGE FOR THE DESIGN ROOM'S CATALOGUE.
 *
 * The catalogue is the room's own `catalog.json`, loaded with the official `Catalog.fromJson` at
 * v0.9.1. Every component in it gets a React entry through `createComponentImplementation`; the
 * entry hands the resolved props to the custom element the room already draws. No drawing is
 * reimplemented here, and the live renderer is not imported.
 *
 * The registry is the room's name → tag map (`surface-design/registry.json`). The six spec
 * primitives come from `a2ui-primitives.ts`, which defines them as custom elements too, so the
 * same bridge covers the whole catalogue: 39 names, 39 elements.
 *
 * Children follow the protocol the room already uses: `children` is the array of ids, and
 * `placements` names the region each id stands in. A child in a named region is placed with a
 * `slot` attribute; a child with no region is left in the default slot. A templated child list is
 * refused by name rather than drawn as nothing.
 */
import React, {useLayoutEffect, useRef} from 'react';
import {Catalog, type ComponentApi} from '@a2ui/web_core/v0_9';
import {createComponentImplementation} from '@a2ui/react/v0_9';
import catalogDoc from '@design2/surface-design/catalog.json';
import registryDoc from '@design2/surface-design/registry.json';
import {A2UI_PRIMITIVES, A2UI_STRUCTURAL} from '@/components/lit/a2ui-primitives';

/* ── every element in the room, registered by side effect ─────────────────────────────────── */
import '@design2/chat/design-chat';
import '@design2/chat/chat-tab';
import '@design2/surface-design/surface/rail/navigation-bar';
import '@design2/chat/parts/design-chat-header';
import '@design2/chat/parts/design-chat-messages';
import '@design2/chat/parts/design-chat-action-bar';
import '@design2/chat/parts/design-chat-input';
import '@design2/chat/parts/design-prompt-textarea';
import '@design2/chat/parts/design-chat-plugin-tray';
import '@design2/chat/readout/output-header';
import '@design2/chat/parts/design-chat-fold';
import '@design2/chat/parts/design-sessions-feed';
import '@design2/chat/parts/design-error-banner';
import '@design2/chat/parts/design-small-dropdown';
import '@design2/chat/parts/design-user-response-bubble';
import '@design2/chat/parts/design-chat-product-tools';
import '@design2/chat/parts/design-chat-product-thread';
import '@design2/chat/thread/cards/work-status';
import '@design2/tools/tools-chat';
import '@design2/ux/chat';
import '@design2/ux/ux-app-frame';
import '@design2/approve/review-view';
import '@design2/surface-design/surface/frame/workspace';
import '@design2/chat/left/card-grid';
import '@design2/chat/left/repair-actions';
import '@design2/surface-design/surface/left-container/footer';
import '@design2/tools/figma-ingest-form';
import '@design2/tools/figma-layers-view';
import '@design2/tools/tools-tab';
import '@/components/lit/design-middle-container';
import '@/components/lit/component-preview';
import '@/components/lit/draft-preview';
import '@/components/lit/design-left-panel';
import '@/components/lit/a2ui-primitives';

/** Every catalogue name the room draws, and the tag that draws it. */
export const BRIDGED_TAGS: Record<string, string> = {
  ...A2UI_STRUCTURAL,
  ...A2UI_PRIMITIVES,
  ...(registryDoc as {components: Record<string, string>}).components,
};

/** Props the protocol uses for the tree, not for the element. */
const TREE_PROPS = new Set(['id', 'component', 'children', 'placements']);

type BridgeProps = {
  tag: string;
  props: Record<string, unknown>;
  buildChild: (id: string, basePath?: string) => React.ReactNode;
};

const childIdOf = (children: unknown): string[] => {
  if (children === undefined || children === null) return [];
  if (!Array.isArray(children)) {
    throw new Error(
      'the official bridge does not carry a templated child list; the room sends an array of ids',
    );
  }
  return children.map((child) => {
    if (typeof child !== 'string') {
      throw new Error('the official bridge refuses a child that is not an id');
    }
    return child;
  });
};

/**
 * The named region a child stands in, handed down through the React tree. The official factory
 * wraps each child in its own node layer, so the slot cannot be passed as a prop; the child's
 * `Bridged` reads it here and writes the `slot` attribute on the element itself, which is what
 * the parent's `<slot name="...">` projects.
 */
const SlotContext = React.createContext<{id: string; slot: string | null} | null>(null);

const childNodes = (
  children: unknown,
  placements: unknown,
  buildChild: BridgeProps['buildChild'],
): React.ReactNode[] => {
  const ids = childIdOf(children);
  const regions =
    placements && typeof placements === 'object' && !Array.isArray(placements)
      ? Object.entries(placements as Record<string, unknown>)
      : [];

  return ids.map((childId) => {
    const child = buildChild(childId);
    const region = regions.find(([, id]) => id === childId)?.[0] ?? null;
    return (
      <SlotContext.Provider key={childId} value={{id: childId, slot: region}}>
        {child}
      </SlotContext.Provider>
    );
  });
};

const Bridged: React.FC<BridgeProps> = ({tag, props, buildChild}) => {
  const ref = useRef<HTMLElement | null>(null);
  const placement = React.useContext(SlotContext);
  const {id, component: _component, children, placements, ...elementProps} = props;

  /*
   * THE PROPS ARE SET ON THE ELEMENT ITSELF. The binder has already resolved every dynamic value,
   * so the element receives the same values the Lit renderer would give it. Setting properties
   * rather than attributes keeps camelCase names (`sessionId`) and booleans intact.
   */
  useLayoutEffect(() => {
    const element = ref.current as unknown as Record<string, unknown> | null;
    if (!element) return;
    for (const [name, value] of Object.entries(elementProps)) {
      if (value !== undefined) element[name] = value;
    }
  }, [elementProps]);

  return React.createElement(
    tag,
    {
      ref: (el: HTMLElement | null) => { ref.current = el; },
      id: id as string | undefined,
      slot: placement?.slot ?? undefined,
      'data-a2ui-id': placement?.id ?? id,
    } as any,
    childNodes(children, placements, buildChild),
  );
};

/** The room's catalogue, with one official React entry for every component it names. */
export function createOfficialDesignCatalog(): Catalog<ComponentApi, any> {
  const catalog = Catalog.fromJson(catalogDoc as Record<string, any>, 'v0.9.1');
  const missing = [...catalog.components.keys()].filter((name) => !BRIDGED_TAGS[name]);
  if (missing.length > 0) {
    throw new Error(`the official bridge has no element for: ${missing.join(', ')}`);
  }

  const components = [...catalog.components.values()].map((api) => {
    const tag = BRIDGED_TAGS[api.name];
    return createComponentImplementation(api, ({props, buildChild}) => (
      <Bridged
        tag={tag}
        props={props as Record<string, unknown>}
        buildChild={buildChild}
      />
    ));
  });

  return catalog.derive({catalogId: catalog.id, components}) as unknown as Catalog<ComponentApi, any>;
}
