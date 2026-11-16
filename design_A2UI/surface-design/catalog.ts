/**
 * THE DESIGN ROOM'S OWN CATALOG — the schema the server validates the room's payload against,
 * derived from the room's registry so the allowlist and the schema cannot disagree.
 *
 * One source of truth: `registry.ts` names the surface's own components and their props; this
 * file turns each of those names into a JSON Schema component. The primitive floor below is the
 * shared A2UI vocabulary any surface may emit; the room's names come from the registry.
 *
 * NOTHING HERE IS INVENTED. The six primitives, `$defs.CatalogComponentCommon` and
 * `$defs.theme` are the living Prompt Composer catalogue's own definitions, copied verbatim from
 * `frontend copy/src/components/A2UI/catalogs/prompt-composer/catalog.json`, exactly as the Chat
 * seat's catalogue carries them. Every prop is typed with the A2UI common types that file already
 * references, so a component prop is the binding form: a literal of its type, or `{ "path": "…" }`
 * (the spec's `DataBinding`).
 *
 *   string  -> common types `DynamicString`
 *   number  -> common types `DynamicNumber`
 *   boolean -> common types `DynamicBoolean`
 *   array   -> a literal array, or `DataBinding` — the common types declare no dynamic array;
 *              this is `DynamicStringList`'s shape without the string item type, because an
 *              array prop holds records
 *   object  -> `{ "type": "object" }`, exactly as the living catalogue types its object props:
 *              a data binding IS an object, so a `oneOf` of "object or binding" matches twice
 *              and is refused
 *
 * THE SERVER READS JSON, NOT TS. `catalog.json` beside this file is the exported
 * `DESIGN_SEAT_CATALOG` (indented `JSON.stringify`) and is the file the server loads. Re-export it
 * whenever `registry.ts` changes: the two are representations of one fact.
 */
import { DESIGN_SEAT_REGISTRY } from './registry';


const COMMON = 'https://a2ui.org/specification/v0_9/common_types.json';

const commonRef = (name: string) => ({ $ref: `${COMMON}#/$defs/${name}` });

type PropType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/** A prop value: the literal of its declared type, or a data-model path. */
const binding = (type: PropType): Record<string, unknown> => {
  switch (type) {
    case 'string':
      return commonRef('DynamicString');
    case 'number':
      return commonRef('DynamicNumber');
    case 'boolean':
      return commonRef('DynamicBoolean');
    case 'array':
      return { oneOf: [{ type: 'array' }, commonRef('DataBinding')] };
    case 'object':
      return { type: 'object' };
  }
};

const component = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
  placements: string[] = [],
) => ({
  type: 'object',
  allOf: [
    commonRef('ComponentCommon'),
    { $ref: '#/$defs/CatalogComponentCommon' },
    {
      type: 'object',
      description,
      properties: {
        component: { const: name },
        /*
         * THE STANDARD'S CHILD LIST, AND THE NAMED REGIONS BESIDE IT. `children` is the array of
         * ids the standard defines. A frame needs to say which region each child stands in, and
         * the standard's ChildList has no region names, so `placements` declares them: one
         * ComponentId per region the element actually draws. A child in `children` that no
         * placement names is reported by the renderer rather than drawn nowhere.
         */
        ...(placements.length
          ? {
              children: commonRef('ChildList'),
              placements: {
                type: 'object',
                description:
                  'The region each child stands in, keyed by the region name the element draws. '
                  + 'Every id here must also appear in `children`.',
                properties: Object.fromEntries(
                  placements.map((region) => [region, commonRef('ComponentId')]),
                ),
                additionalProperties: false,
              },
            }
          : {}),
        ...properties,
      },
      required: ['component', ...required],
    },
  ],
  unevaluatedProperties: false,
});

/** The primitive floor every surface may draw — the living catalogue's six, definition for definition. */
const PRIMITIVES = {
  Text: {
    draft: true,
    type: 'object',
    allOf: [
      commonRef('ComponentCommon'),
      { $ref: '#/$defs/CatalogComponentCommon' },
      {
        type: 'object',
        properties: {
          component: { const: 'Text' },
          text: {
            ...commonRef('DynamicString'),
            description:
              'The text content to display. Simple Markdown supported (no HTML, images, or links).',
          },
          variant: {
            type: 'string',
            description:
              "A hint for the base text style. 'greeting' is the Grace welcome-message style used at the top of assembled surfaces.",
            enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body', 'greeting'],
            default: 'body',
          },
        },
        required: ['component', 'text'],
      },
    ],
    unevaluatedProperties: false,
  },
  Image: {
    draft: true,
    type: 'object',
    allOf: [
      commonRef('ComponentCommon'),
      { $ref: '#/$defs/CatalogComponentCommon' },
      {
        type: 'object',
        properties: {
          component: { const: 'Image' },
          url: {
            ...commonRef('DynamicString'),
            description:
              'The URL of the image. Must be a registered catalog ID from the A2UI Image Catalog (raibach-logo, card-bg-design-system, card-img-default, molecule-logo).',
          },
          description: {
            ...commonRef('DynamicString'),
            description: 'Accessibility text for the image (WCAG 2.1 AA required).',
          },
          fit: {
            type: 'string',
            enum: ['contain', 'cover', 'fill', 'none', 'scaleDown'],
            default: 'cover',
          },
          variant: {
            type: 'string',
            enum: [
              'icon',
              'avatar',
              'smallFeature',
              'mediumFeature',
              'largeFeature',
              'header',
            ],
            default: 'mediumFeature',
          },
        },
        required: ['component', 'url'],
      },
    ],
    unevaluatedProperties: false,
  },
  Row: {
    draft: true,
    type: 'object',
    allOf: [
      commonRef('ComponentCommon'),
      { $ref: '#/$defs/CatalogComponentCommon' },
      {
        type: 'object',
        description: 'A layout component that arranges its children horizontally.',
        properties: {
          component: { const: 'Row' },
          children: {
            ...commonRef('ChildList'),
            description:
              'Defines the children by ID reference. Use explicitList for fixed children or template for data-driven lists.',
          },
          justify: {
            type: 'string',
            enum: ['center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'start', 'stretch'],
            default: 'start',
          },
          align: {
            type: 'string',
            enum: ['start', 'center', 'end', 'stretch'],
            default: 'stretch',
          },
        },
        required: ['component', 'children'],
      },
    ],
    unevaluatedProperties: false,
  },
  Column: {
    draft: true,
    type: 'object',
    allOf: [
      commonRef('ComponentCommon'),
      { $ref: '#/$defs/CatalogComponentCommon' },
      {
        type: 'object',
        description: 'A layout component that arranges its children vertically.',
        properties: {
          component: { const: 'Column' },
          children: {
            ...commonRef('ChildList'),
            description: 'Defines the children by ID reference.',
          },
          justify: {
            type: 'string',
            enum: ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'],
            default: 'start',
          },
          align: {
            type: 'string',
            enum: ['center', 'end', 'start', 'stretch'],
            default: 'stretch',
          },
        },
        required: ['component', 'children'],
      },
    ],
    unevaluatedProperties: false,
  },
  Card: {
    draft: true,
    type: 'object',
    allOf: [
      commonRef('ComponentCommon'),
      { $ref: '#/$defs/CatalogComponentCommon' },
      {
        type: 'object',
        properties: {
          component: { const: 'Card' },
          child: {
            ...commonRef('ComponentId'),
            description: 'The ID of the single child component to be rendered inside the card.',
          },
        },
        required: ['component', 'child'],
      },
    ],
    unevaluatedProperties: false,
  },
  Button: {
    draft: true,
    type: 'object',
    allOf: [
      commonRef('ComponentCommon'),
      { $ref: '#/$defs/CatalogComponentCommon' },
      {
        type: 'object',
        properties: {
          component: { const: 'Button' },
          child: {
            ...commonRef('ComponentId'),
            description: 'The ID of the child component (typically a Text for the label).',
          },
          variant: {
            type: 'string',
            enum: ['default', 'primary', 'borderless'],
            default: 'default',
          },
          action: commonRef('Action'),
        },
        required: ['component', 'child', 'action'],
      },
    ],
    unevaluatedProperties: false,
  },
};

/** The room's own names, each with its registry props as data-bindable values. */
const ROOM_COMPONENTS = Object.fromEntries(
  Object.entries(DESIGN_SEAT_REGISTRY).map(([name, entry]) => {
    const required = Object.entries(entry.props)
      .filter(([, spec]) => !spec.optional)
      .map(([prop]) => prop);
    return [
      name,
      component(
        name,
        entry.description,
        Object.fromEntries(
          Object.entries(entry.props).map(([prop, spec]) => [prop, binding(spec.type)]),
        ),
        required,
        entry.placements ?? [],
      ),
    ];
  }),
);

const ALL_COMPONENTS = { ...PRIMITIVES, ...ROOM_COMPONENTS };

export const DESIGN_SEAT_CATALOG = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://raibach.net/a2ui/catalogs/surface-design/v0_9_1/catalog.json',
  title: 'Raibach Design A2UI — Room catalog',
  whatThisFileIs:
    'THE ROOM\'S SCHEMA. What the room\'s server validates its payload against — an unknown ' +
    'component fails loud with HTTP 503. Derived from surface-design/registry.ts so the allowlist ' +
    'and the schema cannot disagree; catalog.json beside this file is the export the server loads.',
  description:
    'Custom A2UI v0.9.1 catalog for the Design A2UI room. The room draws only the components ' +
    'named here: the frame and the left column\'s foot, derived from the room\'s registry, plus ' +
    'the primitive floor.',
  catalogId: 'https://raibach.net/a2ui/catalogs/surface-design/v0_9_1/catalog.json',
  components: ALL_COMPONENTS,
  $defs: {
    CatalogComponentCommon: {
      type: 'object',
      properties: {
        weight: {
          type: 'number',
          description:
            'The relative weight of this component within a Row or Column (CSS flex-grow). Only valid for direct children of Row or Column.',
        },
      },
    },
    theme: {
      type: 'object',
      properties: {
        primaryColor: {
          type: 'string',
          description: 'Primary brand color in hex format.',
          pattern: '^#[0-9a-fA-F]{6}$',
        },
        iconUrl: {
          type: 'string',
          format: 'uri',
          description: 'URL for an image identifying the agent or tool.',
        },
        agentDisplayName: {
          type: 'string',
          description: 'Display name for the agent or tool that created the surface.',
        },
      },
      additionalProperties: true,
    },
    /** The schema reaches every component: the catalog check refuses one the union misses. */
    anyComponent: {
      oneOf: Object.keys(ALL_COMPONENTS).map((name) => ({ $ref: `#/components/${name}` })),
      discriminator: { propertyName: 'component' },
    },
  },
};
