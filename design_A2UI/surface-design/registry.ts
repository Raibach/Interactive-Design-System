/**
 * THE DESIGN ROOM'S OWN REGISTRY — the allowlist for the surface's own names.
 *
 * A self-describing surface carries this file: every name the room's payload may use, the tag this
 * folder renders for it, and the props and events the element declares. It is read from the
 * elements, not invented: a prop here that the element does not declare is a payload writing into
 * nothing, and the renderer reports exactly that at the leaf.
 *
 * THE NAMES THE ROOM OWNS ARE ITS TWO ELEMENTS. The seat is not here: the room's frame names a
 * chat, `takeChat` removes it, and the shell places the standing tab's own seat in the right
 * column (`inject.ts`). The left column's content is a surface of its own, drawn by its own
 * renderer, so its names belong to that surface and not to this file.
 *
 * The names follow the living catalogue's convention — a surface name that is not the tag — and
 * the payload names them the same way: `design-workspace` is drawn by `<design2-workspace>`.
 */
import { CHAT_SEAT_REGISTRY } from '../chat/registry';
import { APPROVE_REGISTRY } from '../approve/registry';
import { TOOLS_REGISTRY } from '../tools/registry';
import { UX_REGISTRY } from '../ux/registry';

export interface SurfaceRegistryEntry {
  tag: string;
  surface: 'design';
  description: string;
  props: Record<string, { type: 'string' | 'number' | 'boolean' | 'object' | 'array'; optional?: boolean }>;
  events: string[];
  /**
   * THE NAMED REGIONS THIS ELEMENT DRAWS, in the order its own shadow tree declares them. A
   * payload names a child in `children` (the standard's array) and says which region it stands in
   * through the `placements` map: `{"left": "card-grid"}`. The catalogue declares both, so a child
   * with no region is a refusal rather than a node that draws nowhere.
   */
  placements?: string[];
}

export const DESIGN_ROOM_REGISTRY: Record<string, SurfaceRegistryEntry> = {
  'design-workspace': {
    tag: 'design2-workspace',
    surface: 'design',
    description:
      'THE ROOM: the frame and its five slots — left-header, left, left-footer, middle and right — '
      + 'and the grips that resize and collapse them.',
    props: {
      isThirdOpen: { type: 'boolean', optional: true },
      leftCollapsed: { type: 'boolean', optional: true },
      chatLoadWidth: { type: 'number', optional: true },
      chatOverlaysContent: { type: 'boolean', optional: true },
      leftLedgerText: { type: 'string', optional: true },
      leftAssembling: { type: 'boolean', optional: true },
    },
    events: ['resize-start', 'resize', 'resize-end', 'third-column-toggle'],
    placements: ['left-header', 'left', 'left-footer', 'middle', 'right'],
  },
  /*
   * THE CONSOLE IS THE DEFAULT CONTENT of this surface's middle... it is the left column's
   * application in the console's frame. The payload names it and the room draws it; the element
   * is this folder's own copy.
   */
  ConsoleCardGrid: {
    tag: 'design2-console-card-grid',
    surface: 'design',
    description:
      'THE CONSOLE GRID: the design packages, two rows at a time, paged to the pane it is drawn '
      + 'in. Each card is the room\'s own copy of the console card.',
    props: {
      items: { type: 'array', optional: true },
    },
    events: ['card-open'],
  },
  /*
   * THE CATALOGUE CHECKER'S FINDINGS, drawn inside the seat's own view slot. The payload carries
   * this node beside the chat and the seat projects it into its slot; the room builds it.
   */
  'chat-repair-actions': {
    tag: 'design2-repair-actions',
    surface: 'design',
    description:
      'THE REPAIR LIST: the catalogue checker\'s findings, blocking first, with the marks a '
      + 'repair in flight writes.',
    props: {
      findings: { type: 'array', optional: true },
      stages: { type: 'object', optional: true },
      collapsed: { type: 'boolean', optional: true },
    },
    events: [],
  },
  /*
   * THE SEAT IS ONE NODE OF THIS SURFACE. The room's payload names its chat, and the seat's own
   * entry is the single declaration of that name — composed here so the two files cannot state
   * different tags or props for it.
   */
  'chat-panel': CHAT_SEAT_REGISTRY['chat-panel'],
  'design-left-footer': {
    tag: 'design2-left-footer',
    surface: 'design',
    description:
      'THE LEFT COLUMN\'S FOOT: the Save control, the next-session control, the selected '
      + 'component\'s Delete control and the host\'s own answer under them. It draws and '
      + 'dispatches; the seat that holds the session decides what saving and deleting mean.',
    props: {
      result: { type: 'string', optional: true },
      busy: { type: 'boolean', optional: true },
      hideNew: { type: 'boolean', optional: true },
      selected: { type: 'string', optional: true },
    },
    events: ['design-left-save', 'design-left-new', 'component-delete'],
  },
  /*
   * THE TOOLS COLUMN'S THREE NAMES. The tools run composes them into the room's tree, and their
   * elements live in the app's own component folder (`frontend/src/components/lit/`), registered
   * by the app's entry — they are the runtime layer for these names. They are declared here so the
   * catalogue the door validates and the table the renderer resolves state one fact: before this,
   * the three names existed only in a catalogue file the exporter would have erased.
   */
  'design-middle-container': {
    tag: 'design-middle-container',
    surface: 'design',
    description:
      'THE MIDDLE COLUMN: the composer\'s output header over the hole a run\'s preview is loaded '
      + 'into. It is drawn only when the tree places a child in its middle region.',
    props: {
      outputType: { type: 'string', optional: true },
    },
    events: [],
    placements: ['middle'],
  },
  'component-preview': {
    tag: 'component-preview',
    surface: 'design',
    description:
      'THE PREVIEW PANEL: what a run loaded, its facts and its two actions. It draws what the '
      + 'model hands it and dispatches the actions; it never writes to the catalogue.',
    props: {
      preview: { type: 'object', optional: true },
      busy: { type: 'boolean', optional: true },
      message: { type: 'string', optional: true },
    },
    events: [
      'preview-approve',
      'preview-discard',
      'preview-remove',
      'preview-patterns',
      'preview-collision-answer',
    ],
  },
  'draft-preview': {
    tag: 'draft-preview',
    surface: 'design',
    description:
      'THE DRAFT DRAWING: a component the ingest produced, drawn from its own file rather than '
      + 'from a catalogue name.',
    props: {
      draft: { type: 'object', optional: true },
    },
    events: [],
  },
  /*
   * THE TOOLS TAB'S OWN DRAWINGS. The tools door emits these two names (`routes/tools_surface.py`),
   * and the seat renders them with its own elements — the same face the application drew, under
   * this folder's names. Registered here because a name the surface cannot map is a refusal, and
   * the Tools tab is part of this surface.
   */
  'figma-ingest-form': {
    tag: 'design2-figma-ingest-form',
    surface: 'design',
    description: 'THE INGEST FORM: the Figma address, the notes and Submit.',
    props: {
      title: { type: 'string', optional: true },
      url: { type: 'string', optional: true },
      notes: { type: 'string', optional: true },
      busy: { type: 'boolean', optional: true },
      message: { type: 'string', optional: true },
    },
    events: ['ingest-submit'],
  },
  'figma-layers-view': {
    tag: 'design2-figma-layers-view',
    surface: 'design',
    description:
      'THE CATALOGUE TREE: the measured layers, the filter and the catalogue head above them.',
    props: {
      pipeline: { type: 'string', optional: true },
      nodeId: { type: 'string', optional: true },
      tree: { type: 'object', optional: true },
      inline: { type: 'boolean', optional: true },
      refresh: { type: 'number', optional: true },
      busy: { type: 'boolean', optional: true },
      reset: { type: 'number', optional: true },
      selected: { type: 'string', optional: true },
      query: { type: 'string', optional: true },
      open: { type: 'boolean', optional: true },
      showHead: { type: 'boolean', optional: true },
    },
    events: [],
  },
  ToolsTab: {
    tag: 'design2-tools-tab',
    surface: 'design',
    description: 'THE TOOLS TAB: the ingest form over the catalogue tree.',
    props: {
      pipeline: { type: 'string', optional: true },
      nodeId: { type: 'string', optional: true },
      refresh: { type: 'number', optional: true },
      busy: { type: 'boolean', optional: true },
      message: { type: 'string', optional: true },
      selected: { type: 'string', optional: true },
      inline: { type: 'boolean', optional: true },
    },
    events: [],
  },
  'design-left-panel': {
    tag: 'design-left-panel',
    surface: 'design',
    description: 'THE TOOLS LEFT PANEL: the form and the catalogue tree, in the left column.',
    props: {},
    events: [],
    placements: ['left'],
  },
};

/**
 * THE SEAT'S WHOLE ALLOWLIST — the chat's eighteen names, the four tab components, and the
 * room's seven, in one table. The shell's loader reads the name→tag half of this file as
 * `registry.json`; the page gate is the same table, so a name the seat does not declare draws
 * nothing and is reported by name.
 */
export const DESIGN_SEAT_REGISTRY: Record<string, SurfaceRegistryEntry> = {
  ...CHAT_SEAT_REGISTRY,
  ...TOOLS_REGISTRY,
  ...UX_REGISTRY,
  ...APPROVE_REGISTRY,
  ...DESIGN_ROOM_REGISTRY,
};
