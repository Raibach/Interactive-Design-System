import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// A2UI TAG REGISTRY — Single source of truth for AI-addressable components
//
// ── WHAT THIS FILE IS ────────────────────────────────────────────────────────
// THE ALLOWLIST. It decides what may be rendered.
//
// Three files in this repository are called some version of "registry".
// This is the one that gates the AI. The other two are NOT this:
//
//   THE ALLOWLIST  frontend/src/shared/tag-registry.ts            ← you are here
//                  What may be rendered.
//   THE FIGMA MAP  frontend/src/components/registry.json
//                  Which Figma node each component came from.
//   THE SCHEMA     frontend/src/components/A2UI/catalogs/<pipeline>/catalog.json
//                  What the server validates a payload against (503 on unknown).
//                  ONE PER PIPELINE — prompt-composer, ecommerce, ... Each has
//                  its own catalogId, so a surface can only render its own.
//
// ─────────────────────────────────────────────────────────────────────────────
// Every component the AI can emit, modify, or query must be registered here.
// The registry serves three purposes:
//   1. Type-safe validation of AI commands before DOM injection (Gatekeeper)
//   2. JSON manifest export for the Python backend's system prompt
//   3. Audit trail — every tag interaction is logged with this schema
//
// Do NOT add props or events the AI shouldn't touch.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Base schema shared by all registry entries ────────────────────────────────
export const RegistryMetaSchema = z.object({
  tag: z.string(),
  // FOUR SURFACES, not three (2026-09-30). `design` is the Design room's own catalogue
  // (`catalogs/design-artifacts/catalog.json`, loaded per surface by `backend/deps.py`).
  // The same name may appear in more than one surface — the owner: *"they have to be entered
  // in composer, and then they have to be re-entered into the design"* — so an entry that
  // exists ONLY for Design says `design` here, and one that exists only for the Composer says
  // `composer`. `both` keeps the meaning it always had: console AND composer.
  surface: z.enum(['console', 'composer', 'design', 'both']),
  column: z.enum(['left', 'middle', 'right', 'console']).optional(),
  description: z.string(),
  constraints: z.array(z.string()).optional(),
});

export type RegistryMeta = z.infer<typeof RegistryMetaSchema>;

// ── COMPOSER — Left Column (Prompt Builder) ──────────────────────────────────

export const PromptSectionSchema = z.object({
  tag: z.literal('prompt-section'),
  props: z.object({
    type: z.enum(['system-role', 'user-role', 'agent-role', 'tool-call', 'few-shot', 'constraints', 'context']),
    content: z.string(),
    order: z.number(),
    state: z.enum(['idle', 'editing', 'saving', 'error']).default('idle'),
  }),
  events: z.tuple([
    z.literal('section-update'),
    z.literal('section-remove'),
    z.literal('section-reorder'),
  ]),
  surface: z.literal('composer'),
  column: z.literal('left'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const SaveButtonSchema = z.object({
  tag: z.literal('save-button'),
  props: z.object({
    state: z.enum(['idle', 'saving', 'saved', 'error']).default('idle'),
    label: z.string().default('Save'),
  }),
  events: z.tuple([z.literal('save-click')]),
  surface: z.literal('composer'),
  column: z.literal('left'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── COMPOSER — Middle Column (Output & Trace) ────────────────────────────────

export const OutputPanelSchema = z.object({
  tag: z.literal('output-panel'),
  props: z.object({
    content: z.string(),
    status: z.enum(['empty', 'streaming', 'complete', 'error']).default('empty'),
    model: z.string().optional(),
    tokens: z.number().optional(),
  }),
  events: z.tuple([z.literal('copy-output')]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const VersionTraceSchema = z.object({
  tag: z.literal('version-trace'),
  props: z.object({
    sessionId: z.string().uuid(),
    activeVersion: z.number().optional(),
    versions: z.array(z.object({
      version: z.number(),
      timestamp: z.string(),
      summary: z.string(),
    })).optional(),
  }),
  events: z.tuple([z.literal('version-select'), z.literal('version-compare')]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── COMPOSER — Right Column (Chat) ───────────────────────────────────────────

export const ChatPanelSchema = z.object({
  tag: z.literal('chat-panel'),
  props: z.object({
    conversationId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    state: z.enum(['idle', 'streaming', 'error']).default('idle'),
  }),
  events: z.tuple([z.literal('message-sent'), z.literal('command-received')]),
  surface: z.literal('both'),
  column: z.literal('right'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── CONSOLE — Homepage Grid ──────────────────────────────────────────────────

export const AgentCardSchema = z.object({
  tag: z.literal('agent-card'),
  props: z.object({
    id: z.string().uuid(),
    title: z.string(),
    category: z.string().optional(),
    function: z.string().optional(),
    categoryColor: z.string().optional(),
    categoryTitleColor: z.string().optional(),
    categoryTextColor: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['active', 'archived', 'draft']).default('active'),
    version: z.number().default(1),
    likes: z.number().default(0),
    state: z.enum(['idle', 'loading', 'error']).default('idle'),
  }),
  events: z.tuple([z.literal('card-open'), z.literal('card-delete'), z.literal('card-archive')]),
  surface: z.literal('console'),
  column: z.literal('console'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const FilterPillSchema = z.object({
  tag: z.literal('filter-pill'),
  props: z.object({
    category: z.string(),
    label: z.string(),
    active: z.boolean().default(false),
  }),
  events: z.tuple([z.literal('filter-toggle')]),
  surface: z.literal('console'),
  column: z.literal('console'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const SearchBarSchema = z.object({
  tag: z.literal('search-bar'),
  props: z.object({
    placeholder: z.string().default('Search…'),
    value: z.string().default(''),
    state: z.enum(['idle', 'searching', 'complete']).default('idle'),
  }),
  events: z.tuple([z.literal('search-change'), z.literal('search-submit')]),
  surface: z.literal('console'),
  column: z.literal('console'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── UNIVERSAL — Any Column/Surface ───────────────────────────────────────────

export const ErrorBannerSchema = z.object({
  tag: z.literal('error-banner'),
  props: z.object({
    code: z.string().optional(),
    message: z.string(),
    retry: z.boolean().default(false),
  }),
  events: z.tuple([z.literal('error-dismiss'), z.literal('error-retry')]),
  surface: z.literal('both'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── STRUCTURAL — Sandbox Viewport (P5: registered 2026-07-26) ───────────────

export const AiSurfaceSandboxSchema = z.object({
  tag: z.literal('ai-surface-sandbox'),
  props: z.object({
    'is-ai-assembling': z.boolean().default(false),
    'header-tab': z.enum(['console', 'composer', 'design', 'product', 'development', 'governance']).default('console'),
  }),
  events: z.tuple([]),
  surface: z.literal('both'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── COMPOSER — Middle Column — Lexical Editor Tool ──────────────────────────

export const LoadToolSchema = z.object({
  tag: z.literal('load_tool'),
  props: z.object({
    name: z.enum(['lexical-editor']),
    content: z.string().optional(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const CloseToolSchema = z.object({
  tag: z.literal('close_tool'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── Editor Content Tags ─────────────────────────────────────────────────────

export const SetContentSchema = z.object({
  tag: z.literal('set_content'),
  props: z.object({
    content: z.string(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const InsertTextSchema = z.object({
  tag: z.literal('insert_text'),
  props: z.object({
    text: z.string(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const AppendTextSchema = z.object({
  tag: z.literal('append_text'),
  props: z.object({
    text: z.string(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── Editor Formatting Tags ──────────────────────────────────────────────────

export const FormatTextSchema = z.object({
  tag: z.literal('format_text'),
  props: z.object({
    type: z.enum(['bold', 'italic', 'underline', 'strikethrough', 'code']),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const FormatBlockSchema = z.object({
  tag: z.literal('format_block'),
  props: z.object({
    type: z.enum(['h1', 'h2', 'h3', 'paragraph', 'quote', 'code', 'ul', 'ol', 'checklist']),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const FormatAlignSchema = z.object({
  tag: z.literal('format_align'),
  props: z.object({
    type: z.enum(['left', 'center', 'right', 'justify']),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const FormatFontSchema = z.object({
  tag: z.literal('format_font'),
  props: z.object({
    family: z.string().optional(),
    size: z.string().optional(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const ClearFormattingSchema = z.object({
  tag: z.literal('clear_formatting'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── Editor Insert Tags ──────────────────────────────────────────────────────

export const InsertTableSchema = z.object({
  tag: z.literal('insert_table'),
  props: z.object({
    rows: z.coerce.number().default(3),
    cols: z.coerce.number().default(3),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const InsertLinkSchema = z.object({
  tag: z.literal('insert_link'),
  props: z.object({
    url: z.string(),
    text: z.string().optional(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const InsertHorizontalRuleSchema = z.object({
  tag: z.literal('insert_horizontal_rule'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const InsertCodeBlockSchema = z.object({
  tag: z.literal('insert_code_block'),
  props: z.object({
    language: z.string().optional(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const InsertImageSchema = z.object({
  tag: z.literal('insert_image'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── Editor Navigation Tags ──────────────────────────────────────────────────

// ── Editor View Control Tags ────────────────────────────────────────────────

export const ToggleCodeViewSchema = z.object({
  tag: z.literal('toggle_code_view'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const ToggleLockSchema = z.object({
  tag: z.literal('toggle_lock'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── Editor AI-Assisted Tags ─────────────────────────────────────────────────

export const CheckWritingSchema = z.object({
  tag: z.literal('check_writing'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const ApplySuggestionSchema = z.object({
  tag: z.literal('apply_suggestion'),
  props: z.object({
    id: z.string(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const DismissSuggestionSchema = z.object({
  tag: z.literal('dismiss_suggestion'),
  props: z.object({
    id: z.string(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ── Editor Speech Tags ──────────────────────────────────────────────────────

export const StartDictationSchema = z.object({
  tag: z.literal('start_dictation'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const StopDictationSchema = z.object({
  tag: z.literal('stop_dictation'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRY — Master map of every AI-addressable tag
// ═══════════════════════════════════════════════════════════════════════════════

// ── Prompt Input Pattern (Figma 40000746-94 / 40000746-6) ────────────────────
// Individually named components from the designer's Figma layers, each a
// registered Lit element. Spec: READ-ME/PROMPT_INPUT_SECTION_SPEC.md

export const PromptContainerSchema = z.object({
  tag: z.literal('prompt-container'),
  props: z.object({
    formatLabel: z.string().optional(),
    tokensLabel: z.string().optional(),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('left'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const PromptInputSectionSchema = z.object({
  tag: z.literal('prompt-input-section'),
  props: z.object({
    name: z.string(),
    type: z.string(),
    content: z.string(),
    sticky: z.boolean().default(false),
    minHeight: z.number().default(45),
  }),
  events: z.tuple([
    z.literal('section-content-input'),
    z.literal('section-menu-select'),
    z.literal('section-collapse-toggle'),
  ]),
  surface: z.literal('composer'),
  column: z.literal('left'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const GripperPromptInputSchema = z.object({
  tag: z.literal('gripper-prompt-input'),
  props: z.object({}),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('left'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const RoleTileSchema = z.object({
  tag: z.literal('role-tile'),
  props: z.object({
    label: z.string(),
    showMenu: z.boolean().default(true),
  }),
  events: z.tuple([z.literal('role-menu-toggle'), z.literal('role-tile-collapse-toggle')]),
  surface: z.literal('composer'),
  column: z.literal('left'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const StatusBarPromptInputSchema = z.object({
  tag: z.literal('status-bar-prompt-input'),
  props: z.object({
    icons: z.array(z.string()).default([]),
  }),
  events: z.tuple([]),
  surface: z.literal('composer'),
  column: z.literal('left'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const PromptTextareaSchema = z.object({
  tag: z.literal('prompt-textarea'),
  props: z.object({
    value: z.string(),
    placeholder: z.string().optional(),
    minHeight: z.number().default(45),
  }),
  events: z.tuple([z.literal('value-input')]),
  surface: z.literal('composer'),
  column: z.literal('left'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const ModelSelectorButtonSchema = z.object({
  tag: z.literal('model-selector-button'),
  props: z.object({
    label: z.string().default('Models'),
  }),
  events: z.tuple([z.literal('model-selector-toggle')]),
  surface: z.literal('composer'),
  column: z.literal('middle'),
  description: z.string(),
  constraints: z.array(z.string()),
});

export const TAG_REGISTRY = {
  // Composer — Left Column
  'prompt-container': {
    tag: 'prompt-container',
    surface: 'composer',
    column: 'left',
    description: 'Bordered container (Figma 40000746-6) hosting stacked prompt-input-sections with the vertical format rail (Response Format A / tokens readout).',
    props: {
      formatLabel: { type: 'string', optional: true },
      tokensLabel: { type: 'string', optional: true },
    },
    events: [],
    constraints: ['sections slot only accepts prompt-input-section'],
  },
  'prompt-input-section': {
    tag: 'prompt-input-section',
    surface: 'composer',
    column: 'left',
    description: 'One prompt input row (Figma 40000746-94): gripper + role-tile + Functions / Tools + status rail + textarea.',
    props: {
      name: { type: 'string' },
      type: { type: 'string' },
      content: { type: 'string' },
      sticky: { type: 'boolean', default: false },
      minHeight: { type: 'number', default: 45 },
    },
    events: ['section-content-input', 'section-menu-select', 'section-collapse-toggle'],
    constraints: ['System Role section is sticky: first, no menu, not draggable, not deletable'],
  },
  'gripper-prompt-input': {
    tag: 'gripper-prompt-input',
    surface: 'composer',
    column: 'left',
    description: 'Meatballs drag handle (49×37) — the only drag anchor of a prompt-input-section.',
    props: {},
    events: [],
    constraints: ['drag is anchored here only'],
  },
  'role-tile': {
    tag: 'role-tile',
    surface: 'composer',
    column: 'left',
    description: 'Role label tile (357×43) with Arrow_drop_down menu toggle.',
    props: {
      label: { type: 'string' },
      showMenu: { type: 'boolean', default: true },
    },
    events: ['role-menu-toggle', 'role-tile-collapse-toggle'],
    constraints: ['System Role tile renders without the menu'],
  },
  'status-bar-prompt-input': {
    tag: 'status-bar-prompt-input',
    surface: 'composer',
    column: 'left',
    description: 'Vertical activity rail (40px) — Database_fill + lightning_alt_fill_light icons grow with prompt activity.',
    props: {
      icons: { type: 'array', default: [] },
    },
    events: [],
    constraints: [],
  },
  'prompt-textarea': {
    tag: 'prompt-textarea',
    surface: 'composer',
    column: 'left',
    description: 'Active-data textarea (50% white, #767676 stroke, r=6) — Inter 600 16px/25px #000.',
    props: {
      value: { type: 'string' },
      placeholder: { type: 'string', optional: true },
      minHeight: { type: 'number', default: 45 },
    },
    events: ['value-input'],
    constraints: [],
  },
  'model-selector-button': {
    tag: 'model-selector-button',
    surface: 'composer',
    column: 'middle',
    description: 'Model selector button (Figma 40000909-4322) — "Models" label in the Prompt Output accordion header.',
    props: {
      label: { type: 'string', default: 'Models' },
    },
    events: ['model-selector-toggle'],
    constraints: [],
  },
  'control-bar': {
    tag: 'control-bar',
    surface: 'composer',
    column: 'left',
    description:
      'The left column\'s bottom bar — Figma "Left-column-ControlBar" (#40000761:261), drawn as the LAST child of the left column\'s container (#40000954:23865), below the prompt input area. A 36px undo circle, "Save Template ⌘ S" on white, "RUN ⌘ ⏎" on the gold gradient: row, justify flex-end, padding 13px 38px, fill #B5CCCE, radius 0 0 10px 0. Its three controls dispatch `undo-click`, `save-click`, `run-click`, which the shell already listens for — the element existed and drew correctly while nothing mounted it, so those handlers were waiting on a bar that was never on screen.',
    props: {
      isSaving: { type: 'boolean', optional: true },
      isRunning: { type: 'boolean', optional: true },
      saveShortcut: { type: 'string', optional: true },
      runShortcut: { type: 'string', optional: true },
    },
    events: ['undo-click', 'save-click', 'run-click'],
    constraints: [
      'belongs in workspace-layout\'s "left-footer" slot — the bottom of the left column, never inside the scrolling body',
      'isSaving / isRunning arrive as data-model bindings, not as props the shell assigns',
    ],
  },
  'save-button': {
    tag: 'save-button',
    surface: 'composer',
    column: 'left',
    description: 'Save the current prompt session as a new version.',
    props: {
      state: { type: 'enum', values: ['idle', 'saving', 'saved', 'error'], default: 'idle' },
      label: { type: 'string', default: 'Save' },
    },
    events: ['save-click'],
    constraints: ['cannot save while Run is in progress'],
  },

  // Composer — Middle Column

  // Composer — Right Column / Both
  // THE OUTPUT PANEL — one element drawing every block of the output area. The drawing
  // stacks four of them (#40001119:6308 the readout, #40001119:6317 the conversations,
  // #40001123:6978 the approvals, #40001119:6326 the response card), each with its own
  // annotation; this element draws the shell they share, and the figma map carries one
  // row per block so a finding names the panel the drawing names.
  'chat-header': {
    tag: 'chat-header',
    surface: 'both',
    column: 'right',
    description:
      'One block of the chat column output area: the card, and on a bar the grip row under the card. Draws the readout line — the seat status joined with the usage figures — and the model mark at the card trailing edge. Dispatches no events of its own: a block is a readout, and the controls a bar carries belong to its host.',
    props: {
      statusText: { type: 'string', optional: true },
      status: { type: 'string', optional: true },
      sessionLabel: { type: 'string', optional: true },
      sessionName: { type: 'string', optional: true },
      duration: { type: 'string', optional: true },
      qaScore: { type: 'string', optional: true },
      card: { type: 'boolean', default: false },
      tokens: { type: 'number', optional: true },
      inTokens: { type: 'number', optional: true },
      outTokens: { type: 'number', optional: true },
      calls: { type: 'number', optional: true },
      lastCall: { type: 'string', optional: true },
      unattributed: { type: 'boolean', optional: true },
    },
    events: [],
    constraints: [
      'the usage figures belong to the readout panel alone — a bar the host gives no figure to shows its text and nothing else',
      'the readout panel is sticky: always drawn, never removed, never moved',
    ],
  },

  'output-header': {
    tag: 'output-header',
    surface: 'both',
    column: 'right',
    description:
      'The readout block — Figma 40001119-6308, drawn above the conversations bar. The seat status line, the usage figures it is handed, the model mark at the trailing edge, and its own gripper.',
    props: {
      line: { type: 'string', optional: true },
      attributed: { type: 'boolean', optional: true },
      tokens: { type: 'string', optional: true },
      calls: { type: 'string', optional: true },
    },
    events: [],
    constraints: [
      'Data: the readout line — the seat\'s own status, and the usage figures it is handed: tokens, calls',
      'Source: the seat\'s conversation; never another scope\'s totals',
      'State: always drawn — the leading block of the output area; never moved',
      'A11y: role="status"',
      'Failure: a seat that cannot resolve its own conversation reads "unattributed"',
    ],
    layers: [
      { nodeId: '40001119:6308', name: "output-header", type: 'FRAME', size: '540 × 83' },
      { nodeId: '40001119:6309', name: "chat-output-readout-area", type: 'FRAME', size: '500 × 55' },
      { nodeId: '40001123:6763', name: "textarea", type: 'FRAME', size: '450 × 40' },
      { nodeId: '40001123:6750', name: "Analyzing: Session 222 | support Customer Session Duration: 28.495s Closed QA: 89.38% Sample text", type: 'TEXT', size: '450 × 43' },
      { nodeId: '40001124:7096', name: "model-readout-tokens-etc", type: 'IMAGE-SVG', size: '20 × 20' },
      { nodeId: '40001124:7442', name: "model-icon", type: 'FRAME', size: '18.75 × 17.5  (carried by export)' },
      { nodeId: '40001124:7097', name: "Vector", type: 'VECTOR', size: '18.75 × 17.5  (carried by export)' },
      { nodeId: '40001123:6773', name: "gripper-prompt-input-chat-menu", type: 'FRAME', size: '500 × 7' },
      { nodeId: '40001123:6774', name: "Meatballs", type: 'FRAME', size: '480 × 4.05' },
      { nodeId: '40001123:6775', name: "Ellipse 209", type: 'ELLIPSE', size: '2.16 × 2.05' },
      { nodeId: '40001123:6776', name: "Ellipse 210", type: 'ELLIPSE', size: '2.16 × 2.05' },
      { nodeId: '40001123:6777', name: "Ellipse 207", type: 'ELLIPSE', size: '2.16 × 2.05' },
      { nodeId: '40001123:6778', name: "Ellipse 206", type: 'ELLIPSE', size: '2.16 × 2.05' },
      { nodeId: '40001123:6779', name: "Ellipse 208", type: 'ELLIPSE', size: '2.16 × 2.05' },
    ],
  },

  'output-footer-area': {
    tag: 'output-footer-area',
    surface: 'both',
    column: 'right',
    description:
      'The footer block — Figma 40001123-6689. The output column\'s closing shell: the Active/Plugins control, the four 32x32 panel marks, the credit line in its own button, and the block\'s own gripper. This is where the plug-in tool bar loads; the drawing\'s default view shows the first five tools.',
    props: {
      credit: { type: 'string', optional: true },
      pluginLabel: { type: 'string', optional: true },
      historySelected: { type: 'boolean', optional: true },
      gripEnabled: { type: 'boolean', optional: true },
    },
    events: [],
    constraints: [
      'The gripper pulls the window and everything above it up, expanding the section below — it has a limit the drawing does not yet define',
      'chat history is drawn deactivated in appearance but really selected: the history appears above in the output as an insert section',
      'Both buttons carry "On click: dispatch URL (http://raibach.net) / launch save check before leaving application" — the host owns the action, this element draws it',
      'The credit line is Arial Rounded MT Bold 9px, below the 13px type floor — flagged, drawn as the file states it',
    ],
    layers: [
      { nodeId: '40001123:6689', name: "output-footer-area", type: 'FRAME', size: 'col · gap 7 · pad 10/20/20/20' },
      { nodeId: '40001123:6692', name: "gripper-prompt-input-chat-menu", type: 'FRAME', size: '7 tall · pad 0/10' },
      { nodeId: '40001123:6693', name: "Meatballs", type: 'IMAGE-SVG', size: '24.649 × 4.051 · rotate 180' },
      { nodeId: '40001124:7035', name: "forum 1", type: 'IMAGE-SVG', size: '32 × 32 · fill #3D515B' },
      { nodeId: '40001123:6728', name: "chat history", type: 'IMAGE-SVG', size: '32 × 32 · fill #507274' },
      { nodeId: '40001123:6732', name: "add-new-conversation", type: 'IMAGE-SVG', size: '32 × 32 · fill #3D515B' },
      { nodeId: '40001123:6724', name: "user--feedback 1", type: 'IMAGE-SVG', size: '32 × 32 · fill #3D515B' },
      { nodeId: '40001123:6690', name: "chat-output-footer", type: 'FRAME', size: '500 · radius 8 · 2 inset shadows' },
      { nodeId: '40001123:6722', name: "", type: 'FRAME', size: 'row · gap 9' },
      { nodeId: '40001123:6723', name: "", type: 'FRAME', size: '307 · row · gap 20' },
      { nodeId: '40001123:6829', name: "", type: 'FRAME', size: '54 · row' },
      { nodeId: '40001123:6830', name: "Function - loads cards form console in prompt area", type: 'FRAME', size: '54 · radius 6 · 2 drop shadows' },
      { nodeId: '40001123:6831', name: "btn-label", type: 'FRAME', size: 'col' },
      { nodeId: '40001123:6832', name: "Active / Plugins", type: 'TEXT', size: '58 · Arial Rounded MT Bold 12px #3D515B' },
      { nodeId: '40001123:6738', name: "Function - loads cards form console in prompt area", type: 'FRAME', size: '156 · radius 6 · 2 drop shadows' },
      { nodeId: '40001123:6739', name: "btn-label", type: 'FRAME', size: '156 × 35' },
      { nodeId: '40001123:6740', name: "Created by John Travis Holt / Raibach.net © 2026 Raibach IDS", type: 'TEXT', size: 'Arial Rounded MT Bold 9px / 12px #3D515B right-bottom' },
    ],
  },

  'chat-panel': {
    tag: 'chat-panel',
    surface: 'both',
    column: 'right',
    description: 'AI conversation interface. Shared between Console and Composer.',
    props: {
      conversationId: { type: 'string', format: 'uuid', optional: true },
      sessionId: { type: 'string', format: 'uuid', optional: true },
      state: { type: 'enum', values: ['idle', 'streaming', 'error'], default: 'idle' },
      /**
       * WHO SHE IS IN THE ROOM THAT BINDS THIS. A surface that binds it owns her instructions for
       * its own turns; a surface that does not gets the Composer's script, unchanged. Design binds
       * it so that she answers as the design system assistant instead of reasoning about prompt
       * pipelines over a component tree — the fault the owner found on 2026-09-30: *"she's not
       * talking, she's not thinking, because some dumb ass AI has put a hardcoded mess in there."*
       */
      instructions: { type: 'string', optional: true },
    },
    events: ['message-sent', 'command-received'],
    constraints: [],
  },
  // THE RESPONSE ROW — v.4b's "user-response-bubble" (#40001119:6352), the row the
  // output card draws for something the person said. It is the user's turn in a
  // thread and nothing more: the fill, the radius and the mark are the design's, and
  // the node carries NO annotation, so it declares no events. That is the honest
  // state of a wireframe component, and the reason it is safe to allowlist: an
  // element that cannot emit anything cannot invent a behaviour downstream.
  'user-response-bubble': {
    tag: 'user-response-bubble',
    surface: 'both',
    column: 'right',
    description:
      'One response row in the chat output card — the design\'s "user-response-bubble" (Figma #40001119:6352): a 6px-radius #CBE6E3 row holding a 19×19 mark and one line of 13/20 type. The fill follows the seat\'s own --chat-user-bg when it sets one, so the console keeps its palette and every other seat gets the drawing\'s colour.',
    props: {
      'text': { type: 'string', optional: true },
    },
    events: [],
    constraints: [
      'No event: the Figma node carries no annotation, so nothing here is invented',
      'The host supplies the line; the wireframe\'s own copy is sample text',
    ],
  },
  'trace-feed': {
    tag: 'trace-feed',
    surface: 'both',
    column: 'right',
    description:
      'Live telemetry feed, drawn in the chat panel\'s "view" slot when the rail\'s Trace button is selected. It READS NOTHING: the app logger and Sentry\'s global-scope breadcrumbs are read by lib/trace-source.ts and written into the surface model by the shell, and this element binds entries from /trace/entries (newest first) and breadcrumbCount from /trace/breadcrumbCount. Unset entries is its waiting state — an empty list means the app has logged nothing, which is a different claim.',
    props: {
      entries: { type: 'array', optional: true },
      breadcrumbCount: { type: 'number', optional: true },
    },
    events: [],
    constraints: [
      'a view, not a source: both values arrive as data-model bindings',
      'belongs in chat-panel\'s "view" slot, and a surface that emits chat-panel fills it',
    ],
  },
  'eval-feed': {
    tag: 'eval-feed',
    surface: 'both',
    column: 'right',
    description:
      'The judged runs of one package, drawn in the chat panel\'s "view" slot when the rail\'s Evals button is selected — the same one generic hole the trace view is injected into. A VIEW: it fetches nothing and judges nothing. The backend\'s /evaluations endpoint stores one row per run (verdict cleared/failed/running/error, the judge\'s sentence, run-at, trigger) and the shell binds the list from /session/middle_column/evaluations. Unset is its waiting state — an empty list is the claim that this package has run and nothing has been judged, which is a different thing.',
    props: {
      evaluations: { type: 'array', optional: true },
    },
    events: [],
    constraints: [
      'a view, not a source: every row arrives already judged, as a data-model binding',
      'belongs in chat-panel\'s "view" slot beside the trace view — the panel draws the slot, the surface fills it',
    ],
  },
  'chat-repair-actions': {
    tag: 'chat-repair-actions',
    surface: 'both',
    column: 'right',
    description:
      'The catalog checker\'s open findings, drawn in the chat panel\'s "view" slot — the same one generic hole the trace view is injected into (the design\'s "chat-output-simple-slot-area" #40001085:2373, annotated "holds plain text output and inserted functions", PLURAL). A VIEW: it fetches nothing, composes no sentence about a finding and decides no severity. The writer maps the report the checker already wrote (frontend/catalog-audit/<pipeline>.json) into rows of {id, text, level} and binds them to /findings. Unset is its waiting state — an empty list is the claim that the checker found nothing open, which is a different thing.',
    props: {
      findings: { type: 'array', optional: true },
      stages: { type: 'object', optional: true },
      collapsed: { type: 'boolean', default: true },
    },
    events: ['repair-finding'],
    constraints: [
      'a view, not a source: every row arrives already composed, as a data-model binding',
      'belongs in chat-panel\'s "view" slot beside the trace view — the panel draws the slot, the surface fills it',
    ],
  },

  // Console — Homepage Grid
  'agent-card': {
    tag: 'agent-card',
    surface: 'console',
    column: 'console',
    description: 'A prompt session card in the console grid.',
    props: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      category: { type: 'string', optional: true },
      function: { type: 'string', optional: true },
      status: { type: 'enum', values: ['active', 'archived', 'draft'], default: 'active' },
      version: { type: 'number', default: 1 },
      likes: { type: 'number', default: 0 },
      state: { type: 'enum', values: ['idle', 'loading', 'error'], default: 'idle' },
    },
    // `card-archive` used to be declared here and was emitted by nobody (the card's own note
    // says so: "Only `card-delete` was ever emitted by anyone"). A declared event with no
    // dispatcher is a control a reader believes exists.
    events: ['card-open', 'card-delete'],
    constraints: ['id must be a valid session UUID'],
  },

  // Structural — Sandbox Viewport
  'ai-surface-sandbox': {
    tag: 'ai-surface-sandbox',
    surface: 'both',
    description: 'Shadow DOM-isolated A2UI rendering sandbox. Structural viewport that wraps console/composer content. AI must NOT render child components outside the named slots.',
    props: {
      'is-ai-assembling': { type: 'boolean', default: false },
      'header-tab': { type: 'enum', values: ['console', 'composer', 'design', 'product', 'development', 'governance'], default: 'console' },
    },
    events: [],
    constraints: [
      'AI must not render child components outside named slots',
      'Only one slot is visible at a time — controlled by is-ai-assembling and header-tab',
      'Named slots: spinner, console, workspace',
    ],
  },

  // Structural — right-column navigation. A real element (lit/chat-navigation-bar.ts)
  // that the schema already listed and this allowlist did not, so the gatekeeper
  // rejected it and the renderer could not resolve the name.
  'chat-navigation-bar': {
    tag: 'chat-navigation-bar',
    surface: 'both',
    description: 'Right-column tab rail — chat, trace, tools, evaluation, variables, metadata — filtered by the user’s departmental role. Carries the catalog-health marker on the chat tab.',
    props: {
      'active-tab': { type: 'string', default: 'chat' },
      'collapsed': { type: 'boolean', default: false },
      'allowed-tabs': { type: 'string', default: '' },
      'health-count': { type: 'number', default: 0 },
      'health-state': { type: 'enum', values: ['ok', 'loading', 'unknown'], default: 'loading' },
    },
    // The `right-column-drag-*` events were declared here and had no dispatcher: the rail's
    // own dot-grid grip went with the column rework, "along with the right-column-drag-*
    // events it was the only emitter of" (see the element's own note). The drag that
    // remains is the spacer's, and it is the layout's `resize-start/move/end`.
    events: ['tab-change', 'collapse-toggle'],
    constraints: [
      'Tabs are filtered by allowed-tabs; a list matching no known tab shows all rather than an empty bar',
      "health-state 'unknown' must never render the same as a clean result",
      'Never gated on is-ai-assembling — the seat must not disappear while a surface loads',
    ],
  },

  // Structural — role selector inside a prompt-input-section. Also a real element
  // (lit/prompt-input/role-dropdown.ts) that was missing from this list.
  'role-dropdown': {
    tag: 'role-dropdown',
    surface: 'composer',
    description: 'Role-selector dropdown for a prompt-input-section: lists the available roles plus a remove action.',
    props: {
      'id': { type: 'string', default: '' },
    },
    events: ['role-select', 'role-remove'],
    constraints: [
      'Selecting a role sets it and closes the menu — it does not add a section',
    ],
  },

  // Universal
  'error-banner': {
    tag: 'error-banner',
    surface: 'both',
    description: 'Inline error banner with optional retry.',
    props: {
      code: { type: 'string', optional: true },
      message: { type: 'string' },
      retry: { type: 'boolean', default: false },
    },
    events: ['error-dismiss', 'error-retry'],
    constraints: [],
  },

  // ── Lexical Editor — Lifecycle ───────────────────────────────────────────
  'load_tool': {
    tag: 'load_tool',
    surface: 'composer',
    column: 'middle',
    description: 'Load a tool into the third column. Currently supports lexical-editor.',
    props: {
      name: { type: 'enum', values: ['lexical-editor'] },
      content: { type: 'string', optional: true },
    },
    events: [],
    constraints: ['name must be a registered tool'],
  },
  'close_tool': {
    tag: 'close_tool',
    surface: 'composer',
    column: 'middle',
    description: 'Close the active tool and return to output view.',
    props: {},
    events: [],
    constraints: [],
  },

  // ── Lexical Editor — Content ─────────────────────────────────────────────
  'set_content': {
    tag: 'set_content',
    surface: 'composer',
    column: 'middle',
    description: 'Replace the entire editor content with new text.',
    props: {
      content: { type: 'string' },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'insert_text': {
    tag: 'insert_text',
    surface: 'composer',
    column: 'middle',
    description: 'Insert text at the current cursor position.',
    props: {
      text: { type: 'string' },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'append_text': {
    tag: 'append_text',
    surface: 'composer',
    column: 'middle',
    description: 'Append text to the end of the document.',
    props: {
      text: { type: 'string' },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },

  // ── Lexical Editor — Formatting ──────────────────────────────────────────
  'format_text': {
    tag: 'format_text',
    surface: 'composer',
    column: 'middle',
    description: 'Apply inline text formatting to selection.',
    props: {
      type: { type: 'enum', values: ['bold', 'italic', 'underline', 'strikethrough', 'code'] },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'format_block': {
    tag: 'format_block',
    surface: 'composer',
    column: 'middle',
    description: 'Convert the current block to a heading, paragraph, quote, code block, or list.',
    props: {
      type: { type: 'enum', values: ['h1', 'h2', 'h3', 'paragraph', 'quote', 'code', 'ul', 'ol', 'checklist'] },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'format_align': {
    tag: 'format_align',
    surface: 'composer',
    column: 'middle',
    description: 'Set text alignment.',
    props: {
      type: { type: 'enum', values: ['left', 'center', 'right', 'justify'] },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'format_font': {
    tag: 'format_font',
    surface: 'composer',
    column: 'middle',
    description: 'Change font family or size.',
    props: {
      family: { type: 'string', optional: true },
      size: { type: 'string', optional: true },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'clear_formatting': {
    tag: 'clear_formatting',
    surface: 'composer',
    column: 'middle',
    description: 'Remove all formatting from the current selection.',
    props: {},
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },

  // ── Lexical Editor — Insert ──────────────────────────────────────────────
  'insert_table': {
    tag: 'insert_table',
    surface: 'composer',
    column: 'middle',
    description: 'Insert a table with the specified rows and columns.',
    props: {
      rows: { type: 'number', default: 3 },
      cols: { type: 'number', default: 3 },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'insert_link': {
    tag: 'insert_link',
    surface: 'composer',
    column: 'middle',
    description: 'Insert a hyperlink.',
    props: {
      url: { type: 'string' },
      text: { type: 'string', optional: true },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'insert_horizontal_rule': {
    tag: 'insert_horizontal_rule',
    surface: 'composer',
    column: 'middle',
    description: 'Insert a horizontal divider line.',
    props: {},
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'insert_code_block': {
    tag: 'insert_code_block',
    surface: 'composer',
    column: 'middle',
    description: 'Insert a syntax-highlighted code block.',
    props: {
      language: { type: 'string', optional: true },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'insert_image': {
    tag: 'insert_image',
    surface: 'composer',
    column: 'middle',
    description: 'Trigger image upload dialog.',
    props: {},
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },

  // ── Lexical Editor — Navigation ──────────────────────────────────────────

  // ── Lexical Editor — View Control ────────────────────────────────────────
  'toggle_code_view': {
    tag: 'toggle_code_view',
    surface: 'composer',
    column: 'middle',
    description: 'Toggle between rich text and code view.',
    props: {},
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'toggle_lock': {
    tag: 'toggle_lock',
    surface: 'composer',
    column: 'middle',
    description: 'Toggle editor read-only lock.',
    props: {},
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },

  // ── Lexical Editor — AI-Assisted ─────────────────────────────────────────
  'check_writing': {
    tag: 'check_writing',
    surface: 'composer',
    column: 'middle',
    description: 'Run grammar and style check on the document.',
    props: {},
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'apply_suggestion': {
    tag: 'apply_suggestion',
    surface: 'composer',
    column: 'middle',
    description: 'Accept a writing suggestion by ID.',
    props: {
      id: { type: 'string' },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'dismiss_suggestion': {
    tag: 'dismiss_suggestion',
    surface: 'composer',
    column: 'middle',
    description: 'Reject a writing suggestion by ID.',
    props: {
      id: { type: 'string' },
    },
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },

  // ── Lexical Editor — Speech ──────────────────────────────────────────────
  'start_dictation': {
    tag: 'start_dictation',
    surface: 'composer',
    column: 'middle',
    description: 'Start speech-to-text dictation.',
    props: {},
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },
  'stop_dictation': {
    tag: 'stop_dictation',
    surface: 'composer',
    column: 'middle',
    description: 'Stop speech-to-text dictation.',
    props: {},
    events: [],
    constraints: ['requires lexical-editor to be loaded'],
  },

  // ── A2UI v0.9.1 LIT-PORTED WORKSPACE COMPONENTS (model is architect) ──────
  // These are the exact tags the backend now instructs the LLM to emit for
  // composer surfaces. They replace the old React tree (PromptWorkspace,
  // ResponsivePromptBuilder, MiddleColumnSlot) inside slot="workspace".
  'prompt-section-editor': {
    tag: 'prompt-section-editor',
    surface: 'composer',
    column: 'left',
    description: 'Lit Web Component (port of ResponsivePromptBuilder + DnD). Manages prompt sections (System/User/Tool/Few Shot/Context/Constraints + custom). Supports add/remove/reorder via events, textareas, left-rail icons, and path binding to /session/left_column/sections. AI emits this; React shell only hosts it.',
    props: {
      sections: { type: 'array', optional: true },
      sessionId: { type: 'string', optional: true },
      isRunning: { type: 'boolean', optional: true },
    },
    events: ['section-update', 'section-add', 'section-remove', 'section-reorder'],
    constraints: [],
  },
  'compiled-output-viewer': {
    tag: 'compiled-output-viewer',
    surface: 'composer',
    column: 'middle',
    description: 'Lit Web Component (port of MiddleColumnSlot output logic). Streams compiled prompt output, shows tokens/cost/model, copy, regenerate, raw vs rendered toggle, status. Binds to /session/middle_column/compiled_output. No React fallback inside the surface.',
    props: {
      content: { type: 'string', optional: true },
      status: { type: 'string', optional: true },
      model: { type: 'string', optional: true },
      tokens: { type: 'number', optional: true },
      isRunning: { type: 'boolean', optional: true },
      sessionId: { type: 'string', optional: true },
    },
    events: ['copy-output', 'regenerate-requested', 'clear-output'],
    constraints: [
      'RECORDED NESTING (2026-09-18): instantiates the published <model-selector-button> from its own template — the element is a registry entry with its own node id, so it is instantiated, never re-implemented. One of the two recorded exceptions to the flat-adjacency rule, recorded rather than hidden.',
    ],
  },
  'agent-flow': {
    tag: 'agent-flow',
    surface: 'composer',
    column: 'middle',
    description:
      'The flow, drawn — the output column\'s canvas, swapped in when a Run begins and the prompt docks to its rail. It is a VIEW and fetches nothing: shared/agentFlow.ts builds the graph (nodes, edges, the rows it could not name, and the steps it did not draw) from facts the app already holds — the prompt\'s own seats (canonical ids from promptSections.ts, never labels), the finding, and the run\'s own responses — and the shell writes it to /session/middle_column/flow. Unset flow is its waiting state; an empty node list is the claim that there is nothing to draw, which is a different thing.',
    props: {
      flow: { type: 'object', optional: true },
    },
    events: ['flow-opened', 'flow-node-added', 'flow-node-moved', 'flow-connect', 'flow-select', 'flow-action', 'flow-drawn'],
    constraints: [
      'a view, not a source: the whole graph arrives as one data-model binding',
      'takes the middle column on Run; the compiled output is reached again through the column\'s own selector and Clear',
      'the node body is one function — the Figma node replaces it without touching the canvas',
      'ASSEMBLED ON RUN (2026-09-23): the chain this view is part of is emitted by the model against this catalog — /api/ai/assemble-surface, intent render-run, assembled when a person presses RUN. It used to be written by WritingAreaIndex.setOutputColumn by hand, which is the protocol violation READ-ME/CONTINUE-HERE.md §00c records.',
    ],
  },
  'agent-canvas': {
    tag: 'agent-canvas',
    surface: 'composer',
    column: 'middle',
    description:
      'THE PLUG-IN — the drawing and Grace\'s seat as one place, implemented as a CONTAINER. It declares its slots and the ENVELOPE fills them: the drawing in "flow", the column\'s own header and foot in "header"/"footer" — NOT her seat: the element renders no seat slot and she is never moved in (owner, 2026-09-18: "there\'s no difference between the canvas Grace and the new-package Grace, so there\'s no reason to replace anything") — the same model workspace-layout uses for its columns, and the only one this protocol allows, because children come from the adjacency list and never from a component\'s own template (AGENTS-instructions/Core-Concept.md: "surfaces cannot nest"). It fetches nothing, draws no node, and dispatches no events of its own. What it OWNS is behaviour around its slots: the seat\'s column (its width, its motion, the gripper that sizes it and lets go on every channel) and the link between the halves — a picked node marks the turn about it and opens her, a clicked turn brings its node into view. It does NOT own her bindings: conversation-id and the rest are the envelope\'s bindings on her seat, which is what makes her a SURFACE SEAT (it aggregates only its own conversation, and renders "unattributed" rather than borrowing another scope\'s numbers). Sheet: AGENTIC_EDITOR/11-THE-PLUGIN.md.',
    props: {
      theme: { type: 'string', optional: true },
      collapsed: { type: 'boolean', optional: true },
    },
    events: [],
    constraints: [
      'a container, not a wrapper: its template holds slots and no component — an element that renders an element is nesting, and surfaces cannot nest',
      'filled by name from the envelope: "header", "flow" (the drawing) and "footer" — NOT "seat": the element renders no seat slot, because she is never moved into the canvas ("there\'s no difference between the canvas Grace and the new-package Grace", owner 2026-09-18)',
      'one Grace — a surface mounts this OR a bare chat-panel, never both',
      'her bindings belong to the envelope, not to this element',
      'ASSEMBLED ON RUN (2026-09-23): the model emits this component and its three slots (render-run in backend/routes/ai.py), applied to the live tree by id. It used to be written by WritingAreaIndex.setOutputColumn by hand.',
    ],
  },
  'canvas-footer': {
    tag: 'canvas-footer',
    surface: 'composer',
    column: 'middle',
    description:
      'The canvas column\'s FOOT, built from the ControlBar master ("left-column-control bar" 40000761:261, instance 40001096:3241): 70px, fill #B5CCCE, bottom-right radius 10, padding 13px 38px, the master\'s three button treatments. It carries a slot for the host\'s own controls and the canvas\'s TONE SWITCH — the drawing ships a mid-tone and a dark surface, and this is what chooses between them. It was the standalone playground\'s own chrome first, which is why the application had no foot and no tone switch: a row of markup on one page is a row no other page can have. It EMITS and does not reach — theme-change carries {theme}, and the host writes it onto the drawing, because a footer does not know where the canvas is.',
    props: {
      theme: { type: 'string', optional: true },
    },
    events: ['theme-change'],
    constraints: [
      'the master\'s numbers, not re-invented: 70px, #B5CCCE, radius 0 0 10px 0, padding 13px 38px',
      'controls sit at the LEFT: the strip spans the column and her seat can lie over its right end',
      'it emits theme-change; the host writes the tone, never this element',
      'ASSEMBLED ON RUN (2026-09-23): the model emits the foot as one of the canvas\'s three slots (render-run), and it survives what a Run replaces because it is the COLUMN\'s, not the body\'s. It used to be written by WritingAreaIndex.setOutputColumn by hand.',
    ],
  },
  'left-column-header': {
    tag: 'left-column-header',
    surface: 'composer',
    column: 'left',
    description:
      'The prompt\'s own bar, above the sections: what this package is called, which version is on screen, and what is known about it. MOVED OUT OF THE REACT SHELL (2026-09-28) so the TITLE is a value of the surface like every other — while it was owned by the shell it could only be changed through a callback handed down, with no path and no tag, so nothing the AI could reach could read or set it. This is row 2 of the old LeftColumnHeader; row 1 (the Console/Composer/Evaluation/Variables/Metadata tabs, the logo, the identity chip) is SHELL NAVIGATION and stays in the shell — the owner, 2026-09-28: "that is a part of the react shell and that would stay outside of the surface". CARRIED, NOT INVENTED: colours, sizes and spacing are the React bar\'s own, which that file\'s docstring says came from the design. WIRED: the title (editable here, settable by the AI), the version label, the package id (display only — the owner reads it while testing; a customer need not). PLACEHOLDERS, drawn and inert with a dashed underline and aria-disabled so they do not read as broken: tags, author, score. INACTIVE: flip — "you don\'t have to do the flip function. You can just keep that inactive at the moment". The version LIST and restore are still the React VersionManager\'s and are marked as not yet moved.',
    props: {
      title: { type: 'string', optional: true },
      version: { type: 'number', optional: true },
      promptId: { type: 'string', optional: true },
    },
    events: ['title-change'],
    constraints: [
      'the title is the reason this moved: it is a surface value now, so the AI can read it and write it',
      'an empty submit is a CANCEL — blurring an empty field does not clear a title',
      'tags, author and score are placeholders by the owner\'s instruction: "if they\'re not active at the moment, just mark them as placeholders"',
      'flip is drawn and takes no click, by the same instruction',
      'row 1 of the old header is navigation and is NOT in this element',
    ],
  },
  'output-controls': {
    tag: 'output-controls',
    surface: 'composer',
    column: 'middle',
    description:
      'The middle column\'s header row — the design\'s "output-vontrols" (node 40001034:1186), two children exactly as drawn: the selector tile (40001034:1187, its text run 40001034:1190) and the published <model-selector-button>. It is its own element because the header belongs to the COLUMN and not to the body under it: the flow view takes the column on Run, and the header went with the output viewer until this existed. A PLACEHOLDER BY THE OWNER\'S INSTRUCTION (2026-09-18): "that could just be a placeholder, it doesn\'t have to do anything… add the element to the canvas and that way it\'ll be there when we get ready to wire it up". The tile therefore renders with its design tag and role and opens no menu — the menu is not in the Figma pull, and what it is FOR (switching between the canvas view, the raw output, and more to come) is the owner\'s specification, not a trace. Sheet: AGENTIC_EDITOR/10-TODO.md P6.',
    props: {
      outputType: { type: 'string', optional: true },
    },
    events: [],
    constraints: [
      'the column\'s header, not the body\'s: it is drawn in every view of the middle column',
      'the tile is inert until the menu is designed — absent behaviour, not invented behaviour',
      'RECORDED NESTING (2026-09-18): the model control is the published <model-selector-button>, instantiated from this element\'s own template, never restyled — the one place this protocol\'s flat-adjacency rule is knowingly excepted, and it is recorded rather than hidden',
      'ASSEMBLED ON RUN (2026-09-23): the model emits this as the canvas\'s "header" slot (render-run), which is the point of it being its own element. It used to be written by WritingAreaIndex.setOutputColumn by hand.',
    ],
  },
  /**
   * THE DESIGN ROOM'S MIDDLE COLUMN — the Composer's middle column with a hole in it.
   *
   * WHY IT EXISTS. Design's columns hold the ingest tool's regions, and content has to be loaded
   * INSIDE a column rather than beside it. The Composer's middle column is
   * `compiled-output-viewer`, which owns its whole body and has NO slot — nothing can be loaded
   * inside it. The owner ruled on exactly this case (2026-09-30): *"If you have to make a
   * different component because you can't figure out how to load something inside of it, then
   * build a different lit component for the design section."*
   *
   * WHAT IT IS: `<output-controls>` — the entry above, the Composer's own header row, instantiated
   * unchanged — over a real slot named `middle`. The ingest's middle region already declares
   * `slot="middle"`, so it lands in the hole with no change to the tool. The frame's geometry is
   * the column's; no colour, radius or shadow is invented.
   *
   * DESIGN ONLY. The Composer's surface never names it and the Composer's renderer never draws it,
   * which is what makes this an addition rather than a change to the Composer's column.
   */
  'design-middle-container': {
    tag: 'design-middle-container',
    surface: 'design',
    column: 'middle',
    description: 'The Design room\'s middle column: the Composer\'s own <output-controls> header row over a MOUNT inside its shadow tree (`data-ingest-mount`), where the ingest\'s Preview is rendered. It exists because the Composer\'s column body (<compiled-output-viewer>) has no slot, so nothing can be loaded inside it. Design only: the Composer never draws it.',
    props: {
      outputType: { type: 'string', optional: true },
    },
    events: [],
    constraints: [
      'the hole is the point: content is loaded INTO this element, never beside it',
      'LOOSE CONTENT IN THE ROOM IS THE BUG THIS FIXES (measured 2026-09-30): nodes React appends to the room container\'s light DOM are unmanaged by lit-html, which owns that same child list, and every change in the slot\'s assignment makes workspace-layout re-baseline its split — the owner: "I can\'t close the container. I can\'t grab a hold of the grippers. It\'s jerking away from me"',
      'the mount is inside the shadow tree ON PURPOSE: a slot would leave the content in its own tree, where the tool\'s Tailwind classes cannot match (no document sheet reaches into the renderer\'s root), and the preview would arrive unformatted',
      'the header row is the Composer\'s <output-controls>, instantiated unchanged — never a second copy of that row',
      'the output container is a separate element and belongs in this element\'s hole',
      'THE COLUMN IS DRAWN ONLY WHEN THE TREE REFERENCES IT: render-design declares this component and does not put it in the layout\'s children, so the third column is collapsed until the ingest reports its first draft — the Composer\'s own contract for its middle column ("the shell moves the flow view into it at Run time")',
    ],
  },
  /**
   * THE DESIGN ROOM'S LEFT COLUMN — the Composer's panel frame with a hole in it.
   *
   * WHY IT EXISTS. The owner, 2026-09-30, on the running room: *"it is loading underneath the
   * container the design renderer has to render it inside of the container."* Design's left
   * column drew the Composer's prompt editor (the Agent Role tile, "Functions | Tools", the empty
   * textarea) and the ingest's rail sat BELOW it, loose in the pane. The panel itself is part of
   * the frame — *"it's the same panel that we have the prompt / agent prompt inputs, and it's
   * called left column"* — so the frame stays and its contents are replaced, which is the owner's
   * rule for the whole exercise: *"I will just replace what they hold."*
   *
   * WHAT IT IS: `<prompt-container>` — the Composer's own panel, instantiated unchanged and never
   * restyled — over a `<slot name="left">`, and the SURFACE fills that slot: `render-design` names a
   * child in this component's `children.left` and the renderer instantiates it there (today
   * `<figma-layers-view>`, the ingestion rail's own component tree).
   *
   * WHY A SLOT, AND WHY THE MOUNT THAT PRECEDED IT IS GONE (measured 2026-09-30). The mount was a
   * div inside this element's shadow tree (`data-ingest-mount`) holding the ingestion tool's React
   * rail, because a slot projects a light child and leaves it in ITS OWN tree, where the tool's
   * Tailwind utility classes — selectors in a DOCUMENT stylesheet — cannot match inside this
   * renderer's shadow root. The tool arrived unformatted (the rail measured `display: block`,
   * `overflow-y: visible`, its URL field 153px wide) and its component list could not be scrolled.
   * The tool is now not loaded into this room at all — a React tree inside a surface is forbidden,
   * and measured on the live page, it drew BENEATH the room and pushed the layout to y = −129 — so
   * the mount has nothing left to hold. A catalogue element needs none: it carries its styles in its
   * own shadow root, and only its box comes from this frame (`::slotted(*)`).
   *
   * DESIGN ONLY. The Composer's surface never names it and the Composer's renderer never draws it.
   */
  'design-left-panel': {
    tag: 'design-left-panel',
    surface: 'design',
    column: 'left',
    description: 'The Design room\'s left column: the Composer\'s own <prompt-container> panel frame with a `<slot name="left">` in it, and the surface fills that slot — render-design names its child in this component\'s `children.left` and the renderer instantiates it there. It exists because the panel is part of the frame while the Composer\'s prompt editor is not. Design only: the Composer never draws it.',
    props: {
      formatLabel: { type: 'string', optional: true },
      tokensLabel: { type: 'string', optional: true },
    },
    events: [],
    constraints: [
      'THE PANE IS FILLED BY THE SURFACE, BY ID: content is projected into the panel by `<slot name="left">`, and the envelope names it in `children.left` — nothing mounts itself in, and no host appends a node',
      'the frame is the Composer\'s <prompt-container>, instantiated unchanged — never a second copy of that panel',
      'the hole is a SLOT and the mount it once carried is gone: the mount existed for the ingestion tool\'s React rail, which no longer loads into this room (it drew beneath the room, layout measured at y = −129), and a catalogue element carries its own styles so it needs none',
      'the frame gives the projected child its BOX and nothing else (`::slotted(*)` — fill the hole, min-height: 0): whether the child scrolls, and what it scrolls, is the child\'s own business',
      'both rail labels default to empty on purpose: "Agent Prompt" and a token/cost readout are the labels for a prompt panel, and this column holds the section\'s components — the rail draws no text rather than text that is not true',
    ],
  },
  /**
   * THE MIDDLE COLUMN'S PREVIEW — what a RUN loaded.
   *
   * THE DESTINATION THE ROOM WAS MISSING. It has two run triggers — Submit in the rail, and a row
   * clicked in the catalogue tree — and neither had anywhere to display: the ingest's Preview is
   * React inside the modal, and the column's container had a mount for it and no content. The
   * owner, 2026-09-30: *"the run function is supposed to launch the third column and show the
   * preview… submit is run, selecting one of those components in that list is a run function."*
   *
   * IT DRAWS AND DISPATCHES. `preview` arrives from `/session/preview`, written by the shell from
   * the answer the ingest already returned or from the row the tree already lists — so there is no
   * second reader of the ingest here — and its two actions are events the shell answers
   * (`preview-approve` → the same `POST /api/figma/commit` the modal's green button makes,
   * `preview-discard`). A view never writes to the catalogue.
   *
   * AND A THIRD ACTION, `preview-remove`, WHICH DESTROYS RATHER THAN WRITES: it takes the component
   * out of everything the catalogue holds it in, so the button that fires it takes two clicks and
   * its arm is released whenever the preview changes. The call it runs is the one the ingest form
   * already makes (`POST /api/figma/remove`).
   */
  'component-preview': {
    tag: 'component-preview',
    surface: 'design',
    column: 'middle',
    description: 'The Design room\'s middle column: what a RUN loaded — the component a Submit ingested, or the row a person clicked in the catalogue tree. Draws the identity, the facts the run returned, and the two actions; fetches nothing and decides nothing, because the shell owns the state and the calls.',
    props: {
      /** Bound to /session/preview. Undefined = no run yet, which is said in words. */
      preview: { type: 'object', optional: true },
      /** Set by the HOST while an approve or a re-read is in flight. */
      busy: { type: 'boolean', optional: true },
      /** A line under the actions — a refusal, or why the approve did not go through. */
      message: { type: 'string', optional: true },
    },
    events: ['preview-approve', 'preview-discard', 'preview-remove', 'preview-collision-answer'],
    constraints: [
      'IT DRAWS AND DISPATCHES ONLY: no fetch, no parse, no decision about what a component is — a second reader of the ingest would be a second answer',
      'the state arrives from `/session/preview`, written by the shell: the ingest answer for a Submit, the catalogue row for a click. It is the same shape either way, which is what makes one column serve two run triggers',
      'UNSET IS NOT EMPTY: no preview bound draws "nothing loaded yet" in words, because an empty pane and a preview of nothing are different claims',
      'it never writes to the catalogue: `preview-approve` is an EVENT, and the shell runs `POST /api/figma/commit` — approving writes files and rows, which is not a view\'s job',
      'THE COLUMN IS OPENED BY THE HOST, like the Composer\'s: `design-middle` is declared and the layout does not reference it until a run has something to show (the shell adds the reference). An unreferenced column is collapsed — that is workspace-layout\'s own contract, not a style',
    ],
  },
  /**
   * THE DRAFT ITSELF, DRAWN — the component an ingest just built, loaded from its temporary file.
   *
   * WHY IT EXISTS. The frame above DESCRIBES a run; this one DRAWS one, and it exists because the
   * room was drawing the wrong thing. On Submit the shell named the draft's TAG as the component to
   * draw, and the renderer resolved that name through the catalogue — so a re-ingest of a node the
   * catalogue already holds (the ordinary case: the designer edited Figma and submitted the same
   * node again) drew the APPROVED element while the fresh draft sat in the server untouched. The
   * owner, 2026-09-30: *"when I go to preview a change, I'm not seeing a change. I'm seeing the old
   * lit component because it has the same name. It's just reloading it from the lit catalog. I want
   * to use the temporary folder."*
   *
   * THE TAG IS NOT AN ADDRESS. A draft and an approved component can share a name, so a client given
   * the NAME has to guess; this element is given the FILE — `moduleUrl` on the ingest result, which
   * is the file the backend wrote into `.preview/<jobId>/` — and it loads exactly that. No catalogue
   * element is reached for by name here, and none can be: the tag drawn is the draft's own, taken
   * verbatim, and the module is the one the server named.
   *
   * THE BLINDNESS IS THE MECHANISM. It owns the same sandboxed document the ingest form's Preview
   * pane builds — the same CSP, the same import map, the same one attempt at the same single module
   * — and that CSP is what makes a preview unable to impersonate the catalogue: `img-src data:
   * blob:` means an image can only be bytes the ingest put in the draft, and `connect-src 'none'`
   * means the document cannot fetch the catalogue, the record or the backend. The catalogue is
   * surfaced only when the designer approves.
   *
   * DESIGN ONLY. It is this room's third column; the Composer's RUN moves its own view into its own
   * column, and this element is never drawn there.
   */
  'draft-preview': {
    tag: 'draft-preview',
    surface: 'design',
    column: 'middle',
    description: 'The Design room\'s third column when the run was an INGEST: the draft, drawn. It loads the temporary file the ingest wrote (`.preview/<jobId>/<tag>.ts`, carried on the ingest result as `moduleUrl`) inside the same sandboxed document the ingest form\'s Preview pane builds — the same CSP, the same import map, the same single-module load — and it draws nothing else. It fetches nothing, decides nothing, and never reaches for a catalogue element by name: a draft and an approved component can share a name, and the FILE is what tells them apart.',
    props: {
      /**
       * Bound to /session/preview/draft as {"path": "/session/preview/draft"}: {jobId, tag,
       * modulePath, moduleUrl}, written by the shell from the ingest result — the identity travels
       * on the same channel as everything else, never as a prop the element works out itself.
       * Unset = no ingest has produced a draft, which is said in words.
       */
      draft: { type: 'object', optional: true },
    },
    events: [],
    constraints: [
      'THE FILE, NOT THE NAME: it draws `moduleUrl` — the temporary file under `.preview/<jobId>/` — so a re-ingest of a component the catalogue already holds shows the DRAFT, not the approved element. Given the tag alone, the renderer resolves it through the catalogue, and that resolution is the defect this element removes',
      'IT NEVER REACHES FOR A CATALOGUE ELEMENT BY NAME: the element tag it instantiates is the draft\'s own, verbatim (and a tag that is not a custom element name is refused in words), and the module is the one the server named. It imports no resolver and reads no manifest',
      'THE BLINDNESS IS STRUCTURAL, not a promise: the sandboxed document and its CSP are the mechanism — `img-src data: blob:` (an image can only be bytes the ingest put in the draft, never `/assets/…` or a path that shares a name with the repository), `connect-src \'none\'` (it cannot fetch the catalogue, the manifest, the record or the backend), `script-src \'self\'` kept only for Lit, which is the framework and not the catalogue',
      'IT DRAWS AND DECIDES NOTHING ELSE: no facts, no buttons, no fetching — the identity and the two actions belong to <component-preview>, the frame it sits inside, and the state arrives from `/session/preview/draft`, written by the shell from the answer the ingest already returned',
      'THE DOCUMENT IS A PURE FUNCTION OF WHAT IS LOADED, so a re-render (an approve, a note that changed) does not reload the frame: Lit skips an attribute binding whose value is unchanged, and what the designer is looking at stays the thing they were looking at',
      'NOTHING IS SUBSTITUTED FOR THE BREAK: no retry, no sample props, no blank page — a module that cannot be loaded says so in the pane, where the designer is looking',
    ],
  },
  /**
   * THE INGEST RAIL'S TOP HALF — the Figma URL field, the Notes field and Submit.
   *
   * THE HALF THAT WAS MISSING, and the owner asked for it twice before it existed: *"where is the
   * Figma input? … why would you leave out the most important part the input field for the link and
   * the notes?"* The rail's bottom half is `figma-layers-view` (the tree, reused). The catalogues
   * had NO element that draws a text field of this kind — `prompt-textarea` is the composer's own
   * section field, and `role-dropdown` and `model-selector-button` take no text — so the input could
   * not be named by any surface until something drew it. This is that element, and it is a
   * TRANSLATION of the ingest form's own fields rather than a second design: the same two fields
   * with the same words.
   *
   * IT DRAWS AND DISPATCHES, AND NOTHING ELSE. It fetches nothing and ingests nothing: the parsing
   * (`@/utils/figmaUrl`) and the endpoint (`POST /api/figma/ingest`) already exist, and a view that
   * fetched would be a second implementation of the ingest. On Submit it dispatches `ingest-submit`
   * with `{url, notes}` VERBATIM, because deciding whether a typed string is a Figma URL, a node tag
   * (`f-1234-5678`) or a layer's name is `handleIngest`'s logic and not the element's.
   *
   * `busy` AND `message` ARE THE HOST'S. Only the caller that made the call knows when it finished,
   * and only it knows why Submit is blocked — so the element decides neither.
   */
  'figma-ingest-form': {
    tag: 'figma-ingest-form',
    surface: 'design',
    column: 'left',
    description: 'The ingest rail\'s top half: the Figma URL field, the Notes field and Submit, translated from the ingestion form. Draws and dispatches only — on Submit it emits `ingest-submit` with `{url, notes}` verbatim, and the shell runs `POST /api/figma/ingest`, the same call the modal makes.',
    props: {
      /** Prefilled URL. The field stays editable either way. */
      url: { type: 'string', optional: true },
      /** Prefilled notes — optional in the form and optional in the ingest. */
      notes: { type: 'string', optional: true },
      /** Set by the HOST while an ingest is in flight; locks the fields and reads "Ingesting…". */
      busy: { type: 'boolean', optional: true },
      /** A line under the fields — a refusal, or why Submit is blocked. The host's words. */
      message: { type: 'string', optional: true },
    },
    events: ['ingest-submit'],
    constraints: [
      'IT DRAWS AND DISPATCHES ONLY: it never fetches, never parses the typed string, and never calls the ingest — the parsing and the endpoint already exist and are not reimplemented in an element',
      '`ingest-submit` carries the RAW TEXT ({url, notes}) because what a typed string MEANS — a Figma URL, a node tag (f-1234-5678), or a layer\'s name — is `IngestModal.handleIngest`\'s logic, and one place decides it',
      '`busy` and `message` are the HOST\'S to set: only the caller that made the call knows when it finished, and only it knows why Submit is blocked',
      'the fields are the ingest form\'s own two, with the ingest\'s own words — a TRANSLATION of that form, not a second design and not a restyle',
      'it is the TOP of the left column and the tree is the bottom: the slot takes both, in that order',
    ],
  },
  /**
   * THE INGESTION LEFT RAIL'S OWN COMPONENT TREE — the element the ingest form draws in its left
   * column, reused here. NOTHING NEW IS BUILT FOR THIS COLUMN, and that is the whole point: the
   * owner, 2026-09-30, after a session went and authored a list component instead —
   * *"I've been telling you all morning long... you will not build it."* The rail already had the
   * element; what it did not have was the two registrations that let a SURFACE name it. It has them
   * now, and this entry is one of the two.
   *
   * WHAT IT DRAWS (the ingest form's left column, above the Preview): the catalogue strip — every
   * catalogue the build knows (`design-artifacts`, `prompt-composer`, `ecommerce`, `primitives`)
   * with its entry count; the selected catalogue's head and `catalogId`; then "Declared in this
   * catalogue" — one row per component carrying its shape (`allOf(3)` / `flat`), its Figma node, the
   * file that DRAWS it (`drawn by lit/<file>`), and a status dot from the checker's own audit. It is
   * the same element, instantiated unchanged and never restyled.
   *
   * IT READS THE BUILD, AND THAT IS ITS NATURE, NOT AN OVERSIGHT: the catalogues come from
   * `import.meta.glob` over `catalogs/*​/catalog.json` and the audit from
   * `/api/catalog/audit/<pipeline>`. There is no data-model binding for those and none should be
   * invented — the files ARE the source, and a copy of them in the data model would be a second
   * catalogue that could disagree with the first.
   *
   * WHY `pipeline` IS A CATALOGUE NAME AND NOT THE SESSION'S. It selects a FOLDER under
   * `src/components/A2UI/catalogs/`. The room's data model carries `/session/catalogue/system`,
   * whose value is `raibach-ids` — a design SYSTEM, not a catalogue — so binding this prop to that
   * path would name a catalogue that does not exist and the tree would draw its "no catalogue"
   * failure. `render-design` sends `prompt-composer`: it is the element's own default, it is what
   * the ingest form shows, and it is the catalogue the section's 58 rows are declared in.
   *
   * THE STRIP IS LIVE INSIDE THE ELEMENT. Clicking a catalogue at the top sets this element's own
   * `pipeline` and re-reads, so switching catalogues needs no host and no event round trip.
   *
   * BOTH PLACES. In `design-artifacts` (this room's own catalogue) and in `prompt-composer`, because
   * the catalog audit validates the names `routes/ai.py` emits against prompt-composer — the owner's
   * *"entered in composer, and then ... re-entered into the design"*, enforced rather than advised.
   *
   * DESIGN ONLY at present: the Composer's surface never names it.
   */
  'figma-layers-view': {
    tag: 'figma-layers-view',
    surface: 'design',
    column: 'left',
    description: 'The ingestion left rail\'s own component tree, reused unchanged: the catalogue strip, the selected catalogue\'s head, and one row per declared component carrying its shape (`allOf(3)` / `flat`), its Figma node, the file that draws it (`drawn by lit/<file>`), and a status dot from the checker\'s audit. Reads the catalogues off the build (`import.meta.glob`) and the audit from `/api/catalog/audit/<pipeline>` — it takes no binding for those, and the strip switches catalogues inside the element itself.',
    props: {
      /** A catalogue FOLDER name (prompt-composer, design-artifacts, ecommerce, primitives). */
      pipeline: { type: 'string', optional: true },
      /** Show one node's tree instead of the whole declared list. */
      nodeId: { type: 'string', optional: true },
      /** Sit in the flow of the column rather than float over the screen. */
      inline: { type: 'boolean', optional: true },
      /** Bumped by the host to force a re-read — after an ingest lands, or a commit. */
      refresh: { type: 'number', optional: true },
      /** Bumped by the host to fold the tree back to its opening state. */
      reset: { type: 'number', optional: true },
      /** The component the host has open, so the tree can mark it. */
      selected: { type: 'string', optional: true },
      /** Whether the tree is drawn open. */
      open: { type: 'boolean', optional: true },
    },
    events: ['catalog-change', 'open-component', 'open-layer', 'open-function'],
    constraints: [
      'REUSED, NOT REBUILT: this is the ingest form\'s own element, instantiated unchanged and never restyled. It was entered in the catalogue precisely so that nothing new had to be authored for this column',
      '`pipeline` is a CATALOGUE FOLDER name, never a design system or a session title. Binding it to `/session/catalogue/system` names a catalogue that does not exist (`raibach-ids` is a design system) and the tree reports it rather than drawing',
      'IT READS THE BUILD ON PURPOSE: catalogues from `import.meta.glob` over `catalogs/*​/catalog.json`, audit from `/api/catalog/audit/<pipeline>`. No data-model binding for those exists or should be invented — the files are the source, and a copy in the model would be a second catalogue that can disagree',
      'the catalogue strip is live INSIDE the element: a click sets its own `pipeline` and re-reads, so no host and no event round trip are needed to switch catalogues',
      'it DISPATCHES `open-component`, `open-layer` and `open-function` to open what it is showing. Nothing in the Design room answers them yet: opening a component for review is the ingest tool\'s job and it is NOT wired here — the tree draws and marks, it does not yet open',
    ],
  },
  'workspace-layout': {
    tag: 'workspace-layout',
    surface: 'composer',
    column: undefined,
    description: 'Lit Web Component (exact port of PromptWorkspace + ResizableSplitter resize/gripper/double-click logic). Provides the 3-column resizable host with CSS vars, mouse handlers, and named slots "left" | "middle" | "right". AI emits this as the container; it hosts prompt-section-editor, compiled-output-viewer, and chat-panel.',
    // `leftWidth`/`rightWidth` used to be declared here and were never properties of the
    // element — nothing read them, and the save's widths read was a round trip to an event
    // nobody answers. The widths are the element's own rendered numbers; the host reads
    // them through the shadow root at Save (`workspace-layout.widths()`), like the canvas's
    // workspaceState.
    props: {
      isThirdOpen: { type: 'boolean', optional: true },
    },
      events: ['resize-start', 'resize', 'resize-end', 'third-column-toggle'],
      constraints: [
        'must contain prompt-section-editor (left), compiled-output-viewer (middle), chat-panel (right)',
        'IT DOCKS HER FOR THE DESIGN ROOM\'S RUNS AND FOR NOTHING ELSE (2026-10-01). `ingest-submit` (the form) and `open-component` (a catalogue row) close the right column to its rail, because in that room the output is a drawing that wants the width (owner: *"dock the chat when someone clicks submit or tries to view one of our components… dock Grace to give the user full view"*). A COMPOSER Run does NOT dock her, and that is deliberate: the owner reversed exactly that on 2026-09-24, because the prompt contents, the tool results and the run\'s answer all land in her column, so docking at the click hid the output the Run produces. Verified in a page: `open-component` and `ingest-submit` take her 637 → 104; `flow-view-ready` leaves her open at 610. Only the layout on screen obeys — a hidden composer must not have her shut behind the operator\'s back — and nothing re-closes her on render, so an operator who reopens her keeps her open',
      ],
  },
  // Ingested from Figma — System_Role (40001204:5752)
  'f-40001204-5752': {
    tag: 'f-40001204-5752',
    surface: 'composer',
    description: 'Generated from Figma node 40001204:5752 (System_Role). Implemented by <f-40001204-5752> in src/components/lit/f-40001204-5752.ts.',
    props: {
      content: { type: 'string', optional: true },
      disabled: { type: 'boolean', optional: true },
    },
    events: [],
  },
  // Ingested from Figma — catalog-component-node-raibach-ids (40001207:3497)
  /**
   * THE CATALOGUE'S COMPONENT ROW — one component of the catalogue, drawn as the row the list shows.
   *
   * WHY IT IS DECLARED THIS WAY (owner, 2026-09-30): *"I need you to use this lit element for the
   * component level in the list on the left column: f-40001207-3497 … I do not need to see anything
   * but the name and the f-code and the description in these tiles. The other data should be in the
   * metadata in the preview panel."* So the four props below are the row's three facts plus the
   * chevron's state, and `figma-layers-view` instantiates this element once per declared component —
   * it does not draw a row of its own beside it. The facts the row no longer shows (the shape, what
   * draws it, whether the app sends it, its property count, the audit's verdict, the Figma node)
   * travel with the click instead, into the preview panel.
   *
   * THE PROPS IT DECLARED BEFORE (`content`, `justify`, `align`) WERE NEVER IMPLEMENTED — the
   * element's own `static properties` was empty, so this allowlist described three things that did
   * not exist anywhere. They are REPLACED rather than kept beside the real ones: the manifest the
   * model is handed is built from this file, and a prop that is not real is the class of untruth
   * this registry exists to prevent.
   *
   * ITS STATUS WELL IS A SLOT, filled by the tree (`status`), and it is the design's own box: the
   * node the generator measured named it `slot-status-icon-container`. One mark goes in it — the
   * audit's verdict, or the purple in-use mark when the verdict is clean (owner: *"just add the
   * green dot or purple, or amber not both"*) — and the dot's colour is the tree's, not this
   * element's, because whether a component is used and whether the audit is happy are facts about
   * the build rather than about the row.
   */
  'f-40001207-3497': {
    tag: 'f-40001207-3497',
    surface: 'composer',
    description:
      'THE CATALOGUE\'S COMPONENT ROW: one component, drawn as the row the left column lists — the name, the code it is addressed by, and the catalogue\'s own description of it, with a chevron that expands the row and a status well the host fills with one mark. Implemented by <f-40001207-3497> in src/components/lit/f-40001207-3497.ts, generated from Figma node 40001207:3497 and now driven by the tree that lists the catalogue.',
    props: {
      /** What the catalogue calls it — the Figma layer\'s name for a generated component. */
      name: { type: 'string', optional: true },
      /** The catalogue\'s own key for it: `f-40001207-3497`, or a kebab name like `trace-feed`. */
      code: { type: 'string', optional: true },
      /** What it is, in the catalogue\'s words, cut to its first sentence by the row that passes it. */
      description: { type: 'string', optional: true },
      /** Whether the row is expanded — the chevron\'s state, reported back as `chevron-toggle`. */
      open: { type: 'boolean', optional: true },
    },
    events: ['chevron-toggle'],
  },
  // Ingested from Figma — catalog-node-raibach-ids (40001207:3559)
  'f-40001207-3559': {
    tag: 'f-40001207-3559',
    surface: 'composer',
    description: 'Generated from Figma node 40001207:3559 (catalog-node-raibach-ids). Implemented by <f-40001207-3559> in src/components/lit/f-40001207-3559.ts.',
    props: {
      content: { type: 'string', optional: true },
      justify: { type: 'string', optional: true },
      align: { type: 'string', optional: true },
    },
    events: [],
  },
  // Ingested from Figma — layout-id-component (40001206:2888)
  'f-40001206-2888': {
    tag: 'f-40001206-2888',
    surface: 'composer',
    description: 'Generated from Figma node 40001206:2888 (layout-id-component). Implemented by <f-40001206-2888> in src/components/lit/f-40001206-2888.ts.',
    props: {
      content: { type: 'string', optional: true },
      justify: { type: 'string', optional: true },
      align: { type: 'string', optional: true },
    },
    events: [],
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// DERIVED TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TagName = keyof typeof TAG_REGISTRY;
export type TagEntry = (typeof TAG_REGISTRY)[TagName];

/**
 * CATALOG TIERS — the design-system grouping.
 *
 * The tier is DERIVED from each entry's `surface`, never restated. One home per
 * fact: change a component's surface and its tier follows, so the two can't
 * disagree — which is how the schema and the allowlist drifted apart.
 *
 *   primitives        shared by every theme. Renders anywhere, and is FIXED ONCE:
 *                     it appears in each theme's report, so repairing it clears
 *                     it from all of them at the same time.
 *   prompt-composer    theme one
 *   console            theme two (the console homepage surface)
 *   design-artifacts   theme three — the Design room's own catalogue
 *                      (catalogs/design-artifacts/catalog.json, loaded per surface by
 *                      backend/deps.py). A name can belong to this tier AND the Composer's:
 *                      the two files are the "both places" the owner asked for, and a name
 *                      that exists only for Design is listed here and nowhere else.
 *
 * Membership is NOT permission. The tier says which catalog OWNS a component;
 * roles say who may SEE it. Those are deliberately separate questions — some
 * operators will see components others don't, and that belongs in the role
 * layer, not here.
 */
const TAG_NAMES = Object.keys(TAG_REGISTRY) as TagName[];

export const CATALOG_TIERS = {
  primitives: TAG_NAMES.filter((t) => TAG_REGISTRY[t].surface === 'both'),
  'prompt-composer': TAG_NAMES.filter((t) => TAG_REGISTRY[t].surface === 'composer'),
  console: TAG_NAMES.filter((t) => TAG_REGISTRY[t].surface === 'console'),
  'design-artifacts': TAG_NAMES.filter((t) => TAG_REGISTRY[t].surface === 'design'),
} as const;

export type CatalogTier = keyof typeof CATALOG_TIERS;

/** Which tier owns a tag. Defaults to `primitives` — the shared floor. */
export function tierOf(tag: TagName): CatalogTier {
  return (Object.keys(CATALOG_TIERS) as CatalogTier[])
    .find((tier) => (CATALOG_TIERS[tier] as readonly TagName[]).includes(tag)) ?? 'primitives';
}

/** Tags the AI is permitted to emit inside the island (composer surface) */
export const AI_PLAYGROUND_TAGS: TagName[] = [
  // Composer — Left Column
  'save-button',
  // Composer — Middle Column
  // Lexical Editor — Lifecycle
  'load_tool',
  'close_tool',
  // Lexical Editor — Content
  'set_content',
  'insert_text',
  'append_text',
  // Lexical Editor — Formatting
  'format_text',
  'format_block',
  'format_align',
  'format_font',
  'clear_formatting',
  // Lexical Editor — Insert
  'insert_table',
  'insert_link',
  'insert_horizontal_rule',
  'insert_code_block',
  'insert_image',
  // Lexical Editor — Navigation
  // Lexical Editor — View Control
  'toggle_code_view',
  'toggle_lock',
  // Lexical Editor — AI-Assisted
  'check_writing',
  'apply_suggestion',
  'dismiss_suggestion',
  // Lexical Editor — Speech
  'start_dictation',
  'stop_dictation',
  // Shared
  'chat-panel',
  'error-banner',
  // A2UI v0.9.1 Lit-ported workspace (model is the architect)
  'prompt-section-editor',
  'compiled-output-viewer',
  'workspace-layout',
  'f-40001204-5752',
  'f-40001207-3497',
  'f-40001207-3559',
  'f-40001206-2888',
];

/** Tags belonging to the shell — AI must never touch these */
export const SHELL_TAGS: TagName[] = [
  'ai-surface-sandbox',  // P5: structural viewport — React shell owns this frame
  'agent-card',
];

/** Tags shared between both surfaces */
export const SHARED_TAGS: TagName[] = [
  'chat-panel',
  'error-banner',
];

// ═══════════════════════════════════════════════════════════════════════════════
// JSON MANIFEST — for Python backend / AI system prompt
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the full tag registry as a JSON manifest string.
 * The Python backend loads this to include in the AI's system prompt.
 */
export function getTagManifest(): string {
  return JSON.stringify(TAG_REGISTRY, null, 2);
}

/**
 * Returns only the AI playground tags as a JSON manifest.
 * This is the subset the AI is actually allowed to emit.
 */
export function getAiPlaygroundManifest(): string {
  const playground: Record<string, unknown> = {};
  for (const tag of AI_PLAYGROUND_TAGS) {
    playground[tag] = TAG_REGISTRY[tag];
  }
  return JSON.stringify(playground, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GATEKEEPER — validates AI commands before DOM injection
// ═══════════════════════════════════════════════════════════════════════════════

export interface AiCommand {
  sessionId: string;
  command: string;
  tag: string;
  props?: Record<string, unknown>;
  timestamp: string;
}

export interface GatekeeperResult {
  valid: boolean;
  tag?: TagName;
  error?: string;
}

/**
 * Validates an AI-emitted command against the registry.
 * Returns { valid: true, tag } on success, or { valid: false, error } on failure.
 */
export function validateTag(command: AiCommand): GatekeeperResult {
  const tagName = command.tag as TagName;

  if (!(tagName in TAG_REGISTRY)) {
    return { valid: false, error: `Unknown tag: "${command.tag}". Not in registry.` };
  }

  if (!AI_PLAYGROUND_TAGS.includes(tagName)) {
    return {
      valid: false,
      error: `Tag "${command.tag}" is a shell component. AI cannot manipulate shell elements.`,
    };
  }

  const entry = TAG_REGISTRY[tagName];

  // Validate required props exist
  if (command.props) {
    for (const [key, def] of Object.entries(entry.props)) {
      const propDef = def as { type: string; optional?: boolean };
      if (!propDef.optional && !(key in command.props)) {
        return {
          valid: false,
          error: `Missing required prop "${key}" for tag "${command.tag}".`,
        };
      }
    }
  }

  return { valid: true, tag: tagName };
}
