/**
 * <component-preview> — the middle column's preview: what a RUN loaded.
 *
 * WHY IT EXISTS. The Design room has two run triggers and no destination. Submit in the rail runs
 * the ingest, and clicking a row in the catalogue tree runs the open — and both are supposed to
 * display what they loaded in the column beside them, exactly as the ingest form's Preview pane
 * does and exactly as RUN does on the Composer. The owner, 2026-09-30: *"the run function is
 * supposed to launch the third column and show the preview… submit is run, selecting one of those
 * components in that list is a run function. It's supposed to display it."* Until this element
 * existed there was nothing in the surface that could draw a component at all: the ingest's
 * Preview is React inside the modal, and the column's container had a mount for it and no content.
 *
 * IT DRAWS WHAT IT IS GIVEN, AND IT DOES NOT FETCH. `preview` arrives from the data model
 * (`/session/preview`), written by the shell from the answer the ingest already returned or from
 * the row the tree already lists. This element parses nothing, calls nothing, and decides nothing
 * about what a component is — a second reader of the ingest would be a second answer.
 *
 * THE ACTIONS ARE EVENTS, NOT CALLS. Approve and Discard dispatch `preview-approve` /
 * `preview-discard` and the shell runs them (`POST /api/figma/commit` for the first — the same call
 * the modal's green button makes). The element never writes to the catalogue: approving writes
 * files and rows, and that is not a view's job.
 *
 * UNSET IS NOT EMPTY, the rule this repository runs on. `preview === undefined` is "no run has
 * happened yet" and it says so in words, because an empty preview pane and a preview of nothing
 * are different claims and only one of them is true here.
 */
import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

/** What a run loaded. Composed by the shell; every field is optional because a run answers what it can. */
export interface PreviewState {
  /** What kind of run produced this: the ingest, or a row opened from the list. */
  source?: 'ingest' | 'open';
  /** The tag the component is published under, e.g. f-40001207-3559. */
  tag?: string;
  /** The human name — the Figma layer it was drawn from. */
  name?: string;
  /** The Figma node behind it. */
  nodeId?: string;
  /** True when the catalogue already holds this tag, so approving replaces rather than adds. */
  alreadyInCatalogue?: boolean;
  /**
   * THE COMPONENT THIS DESIGN ALREADY IS — the catalogue entry whose layer name matches this
   * design's. The name is the identity, so this is a NAME LOOKUP and nothing about the existing
   * component's measured values is read (that would be interpreting one design against another).
   */
  existing?: { tag?: string; nodeId?: string; approvedAt?: string };
  /** The job's id, when an ingest produced this — what an approve resolves. */
  jobId?: string;
  /** Free label/value facts to draw under the identity, in order. */
  facts?: Array<{ label: string; value: string }>;
  /** One line about what this is, from the row or the ingest. */
  note?: string;
  /** True while the discard request is in flight — the button says so and turns. */
  discarding?: boolean;
  /** True while the approval is in flight — the button says so and turns. */
  approving?: boolean;
  /** The tag the approval wrote, once it has. The confirmation is read from this. */
  approvedTag?: string;
  /** The child patterns this design stands on — each with its name, tag and whether it replaces. */
  patterns?: Array<Record<string, any>>;
  /**
   * THE STAGE AN APPROVAL OR A REMOVAL HAS REACHED, as the server records it. It is the real step
   * that is running — never an animation standing in for progress — and a failure stops here with
   * the stage named.
   */
  progress?: string;
  /** True while the removal request is in flight — the button says so and turns. */
  removing?: boolean;
  /** True once the component has been removed: the actions are gone and the readout says so. */
  removed?: boolean;
  /** TRUE WHILE THE INGEST RUNS. The column is open and says what it is doing, never blank. */
  pending?: boolean;
  /**
   * THE DRAWN DECLARATIONS PER LAYER, as the component's own stylesheet carries them.
   *
   * A LIST, NOT A SUMMARY (owner, 2026-10-26): *"You need to show the specs as a list of specs like
   * this `display: flex; width: 662px; padding: 13px 38px; …`"*. Read from the draft the preview
   * loads, so a reader can put the list beside the drawing and compare it with Figma without
   * trusting a count.
   */
  specs?: Array<{
    path?: string; name?: string; type?: string; selector?: string;
    declarations?: string[]; display?: string[];
  }>;
  /**
   * EVERY FACT THE INGEST READ, layer by layer: what Figma stated, what the component carries,
   * and the verdict. This is the list the designer compares against the Figma file — a count is
   * not a list, and a summary cannot be checked against anything.
   */
  readings?: Array<{
    layer?: string; path?: string; fact?: string; source?: string; drawn?: string;
    verdict?: string; why?: string;
  }>;
  /**
   * EVERY ANNOTATION IN THE FILE — the designer's notes quoted verbatim, and the property marks
   * with the properties they expose. No exception and no slice: if the file carries it, it is here.
   */
  annotations?: Array<{
    layer?: string; path?: string; nodeId?: string; note?: string | null;
    properties?: string[]; kind?: string;
  }>;
  /** Every step the ingest took, in order, as it happened. */
  steps?: Array<{ at?: string; text?: string }>;
  /** The source the preview loads — the component the drawing is built from. */
  componentSource?: string;
  sourceBytes?: number;
  /**
   * THE DATA BINDING, SHOWN AND NEVER SUBSTITUTED: the values this component will be given, from the
   * application's own rows (`/session/elements` — one `design_master` row per component). A preview
   * may know the DATA its component receives — the owner, 2026-09-30: *"it does not have to be blind
   * to the data binding. It can load the data binding as part of the preview"* — while staying blind
   * to the code the application ships. The drawing above is never faked with them, so a designer sees
   * both what the design draws and what the component will be handed, and can tell the two apart.
   */
  values?: Array<{ field: string; value: string }>;
  /**
   * LAYERS WHOSE NAME THE DESIGN SYSTEM ALREADY HAS ON A DIFFERENT COMPONENT — the question the
   * designer answers before approving (see `_collisionQuestion`). The ingest measures them.
   */
  collisions?: Array<{
    name: string;
    nodeId: string;
    nodeIdentity?: string;
    nodeLocation?: string;
    existingTag: string;
    existingNodeId: string;
    existingIdentity?: string;
    existingFile?: string;
  }>;
  /** Layers that ARE a component the design system already ships, elsewhere. Stated, not asked. */
  instances?: Array<{
    name: string;
    nodeId: string;
    nodeLocation?: string;
    existingTag: string;
    existingNodeId: string;
    identity?: string;
  }>;
  /** The designer's answer to the collision question: the tag to overwrite, or null/absent for "add it". */
  collisionAnswer?: string | null;
}

export class ComponentPreview extends LitElement {
  static properties = {
    preview: { type: Object },
    busy: { type: Boolean },
    message: { type: String },
  };

  declare preview: PreviewState | undefined;
  declare busy: boolean;
  declare message: string;

  /**
   * Whether the Remove button is armed. Deliberately NOT a reactive property: it is a state of the
   * button, not a fact about the component, and nothing outside this element has any business
   * reading or setting it. A render is asked for by hand when it changes.
   */
  private _confirmingRemove = false;

  /**
   * WHICH CHILD PATTERNS THE DESIGNER HAS TICKED. New patterns start ticked; an existing pattern
   * starts unticked, because replacing a component is a deliberate act and never a default. The
   * set belongs to one preview and is rebuilt when the preview's tag changes.
   */
  private _patternChecked = new Set<string>();

  constructor() {
    super();
    this.preview = undefined;
    this.busy = false;
    this.message = '';
  }

  static styles = [
    designTokens,
    css`
      /* No backticks in this stylesheet: it is a tagged template literal. */
      :host {
        display: block;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        overflow-y: auto;
      }
      .head {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 16px;
        border-top: 1px solid var(--ds-rule);
      }
      .title {
        font-size: var(--ds-fs-md);
        font-weight: var(--ds-weight);
        color: var(--ds-text-strong);
      }
      /* The layer name, then the tag — the ingest pane's own order (name, then the id under it). */
      .subject {
        font-size: var(--ds-fs-sm);
        color: var(--ds-text-strong);
      }
      .tag {
        font-family: 'IBM Plex Mono', 'IBM Plex Mono', Menlo, monospace;
        font-size: var(--ds-fs-meta);
        color: var(--ds-muted);
      }
      /* THE ACTIONS, PUSHED TO THE TRAILING EDGE — the header's own row, as the ingest pane has it. */
      .actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .body { padding: 12px 16px; }
      /*
       * THE DATA BINDING'S OWN BLOCK — the values the component will be given, in the same
       * label/value grammar the facts below use and separated from the drawing by its own edge, so
       * the two are never read as one list: the facts are about the component, these are what it is
       * handed. It borrows this stylesheet's dl/dt/dd rules rather than restating them. No backticks
       * in this stylesheet: it is a tagged template literal.
       */
      .binding {
        margin: 12px 16px 0;
        padding: 10px 12px;
        border: 1px solid var(--ds-rule);
        border-radius: var(--ds-radius);
      }
      .bhead {
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 700;
        color: var(--ds-muted);
        margin-bottom: 8px;
      }
      /*
       * THE FRAME THE COMPONENT IS DRAWN IN — the React preview's own outline, kept and stated.
       * A 1px edge in the design system's rule colour, on the surface token, with room around the
       * child: a white component on a white pane has no edge of its own, and the box is what makes
       * it visible. It also gives the child a box to be measured against, so a component that
       * draws wider than the column scrolls inside the frame instead of pushing the room.
       */
      .frame {
        margin: 50px 16px 0;
        padding: 12px;
        border: 1px solid var(--ds-rule);
        border-radius: var(--ds-radius);
        /* WHITE, AND ONLY THIS BOX (owner, 2026-10-25: "make the background on the output pane
           white, just the container for the element, not the entire column"). The drawing's own
           frame is the white surface; the column around it keeps the room's ground. This replaces
           the 2026-09-30 transparent rule for this pane. */
        background: #ffffff;
        min-height: 120px;
        max-height: 46vh;
        overflow: auto;
        display: flex;
        /*
         * CENTRED, IN BOTH DIRECTIONS (owner, 2026-09-30: *"center the component Vertically and
         * horizontally whenever it displays there"*). It used to sit in the top-left corner, which
         * is where a component lands by default and not where it reads: the column is wider than
         * most of these drawings, so the whole right half was empty while the component was pressed
         * against the left edge.
         *
         * CENTRED BY THE CHILD'S OWN MARGIN, not by the container's justify/align properties — and
         * that difference is the whole reason this is two lines. A flex container that centres its
         * items can strand one: with justify-content: center, a child WIDER than the frame overflows
         * equally in both directions, and the overflow on the START side cannot be scrolled to — the
         * left of the component becomes unreachable in the pane that exists to show it. An auto
         * margin is defined to give way instead: centred while there is room, and the moment there
         * is not, it resolves to zero and the child starts at the frame's edge, where scrolling
         * reaches it (CSS Flexbox, "auto margins on flex items"). So the child centres itself, and a
         * component bigger than its frame stays whole.
         */
      }
      ::slotted(*) {
        margin: auto;
      }
      /*
       * THE OUTLINE AROUND THE COMPONENT ITSELF — the same dashed edge the ingest form's preview
       * draws around what it renders (IngestModal.previewSrcDoc, and the same line in
       * draft-preview's document), for the reason the owner gave when it went missing: *"a dotted
       * outline that wrapped around the component when it displays, especially if they're white so
       * that you can see it somehow — that's gone too."*
       *
       * ONLY WHEN THE COMPONENT IS WHAT IS IN THE SLOT. A run that OPENED a component puts that
       * element here, bare, and a white component on this ground has no edge of its own — the
       * outline is what makes it visible. A run that ingested a draft puts the draft-preview
       * element here instead, and there the component is drawn INSIDE that element's sandboxed
       * document, which carries this same outline around the element it instantiates; outlining the
       * iframe as well would draw a second dashed box around the pane rather than around the
       * component. So the frame asks the one thing it knows — which kind of run this is — and draws
       * the edge where the component is.
       */
      .frame.element-in-frame ::slotted(*) {
        outline: 1px dashed rgba(31, 172, 194, 0.55);
        outline-offset: 4px;
      }
      dl {
        display: grid;
        grid-template-columns: minmax(90px, auto) 1fr;
        gap: 6px 14px;
        margin: 0;
      }
      dt {
        font-size: var(--ds-fs-meta);
        color: var(--ds-muted);
      }
      dd {
        margin: 0;
        font-size: var(--ds-fs-meta);
        color: var(--ds-text);
        overflow-wrap: anywhere;
      }
      /* THE RING ITSELF AT THE EXACT MIDDLE OF THE COLUMN. Centring the ring and the message
         together leaves the ring above the middle by half the message; the ring is what the eye
         follows, so it is placed at 50%/50% by margin (not transform, which the rotation needs) and
         the message hangs beneath it. */
      /* WHILE PENDING THE HOST IS A COLUMN WITH A REAL SIZE, so the centre exists. */
      /* A COMPONENT THAT HAS BEEN REMOVED HAS NO ACTIONS: the readout is the whole answer. */
      :host([data-removed]) .actions {
        display: none;
      }
      .btnspin.dark {
        border-color: rgba(185, 28, 28, 0.25);
        border-top-color: #b91c1c;
      }
      :host([data-pending]) {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-width: 240px;
        min-height: 260px;
      }
      /*
       * WHAT APPROVING WILL WRITE — the standing block, above the actions, that names the
       * component this design already is and lists every child pattern with a tick. It is not a
       * sentence in the note: prose gets pruned, a block that states a fact does not.
       */
      .writes {
        margin: 0 0 12px;
        border: 1px solid var(--ds-rule);
        border-left: 3px solid #b5884a;
        border-radius: var(--ds-radius, 6px);
        padding: 10px 12px;
      }
      /* THE STAGE LINE — the real step that is running, under the note and above the block. */
      .progress {
        margin: 6px 0 10px;
        padding-left: 9px;
        border-left: 2px solid #b5884a;
        font-size: 12px;
        line-height: 1.45;
        color: var(--ds-text);
      }
      .whead {
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 700;
        color: var(--ds-muted);
      }
      .wroot {
        margin: 6px 0 0;
        font-size: 12px;
        line-height: 1.5;
        color: var(--ds-text);
      }
      .wroot code,
      .ptag {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
      }
      .plist {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 8px;
      }
      .prow {
        display: grid;
        grid-template-columns: 16px auto 1fr;
        gap: 2px 8px;
        align-items: baseline;
        font-size: 12px;
        color: var(--ds-text);
        cursor: pointer;
      }
      .prow.off {
        cursor: default;
        opacity: 0.7;
      }
      .prow input {
        margin: 0;
      }
      .pname {
        font-weight: 600;
        color: var(--ds-text-strong);
      }
      .ptag {
        color: var(--ds-muted);
      }
      .pstate {
        grid-column: 2 / -1;
        font-size: 11px;
        color: var(--ds-muted);
      }
      .prow.exists .pstate {
        color: #92400e;
      }
      /* THE REPLACEMENT WARNING — a readout above the actions, never a button label. */
      .replacewarn {
        margin: 0 0 12px;
        border: 1px solid #b91c1c;
        border-left: 4px solid #b91c1c;
        border-radius: var(--ds-radius, 6px);
        background: rgba(185, 28, 28, 0.06);
        padding: 10px 12px;
      }
      .rwtitle {
        font-size: 12px;
        font-weight: 700;
        color: #b91c1c;
        text-transform: none;
      }
      .rwbody {
        margin: 5px 0 9px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--ds-text);
      }
      .rwbody code {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
      }
      .rwactions {
        display: flex;
        gap: 8px;
      }
      .rwgo {
        border: none;
        border-radius: var(--ds-radius, 6px);
        background: #b91c1c;
        color: #fff;
        padding: 6px 12px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .rwstop {
        border: 1px solid rgba(35, 67, 84, 0.3);
        border-radius: var(--ds-radius, 6px);
        background: transparent;
        padding: 6px 12px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .pending {
        position: relative;
        flex: 1 1 auto;
        width: 100%;
        min-height: 240px;
        box-sizing: border-box;
      }
      .bigspin {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 26px;
        height: 26px;
        box-sizing: border-box;
        border-radius: 50%;
        border: 3px solid rgba(35, 67, 84, 0.18);
        border-top-color: var(--ds-amber, #b58b00);
        /* THE TRANSLATE IS IN THE KEYFRAMES TOO, or the animation would overwrite the centring
           transform on its first frame and drop the ring by half its size. */
        transform: translate(-50%, -50%);
        animation: bigspin 0.9s linear infinite;
      }
      @keyframes bigspin {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }
      .ptext {
        position: absolute;
        left: 50%;
        top: calc(50% + 24px);
        transform: translateX(-50%);
        width: 80%;
        max-width: 420px;
        text-align: center;
        font-size: var(--ds-fs-sm);
        color: var(--ds-text);
        overflow-wrap: anywhere;
      }
      .note {
        margin: 0 0 10px;
        font-size: var(--ds-fs-sm);
        color: var(--ds-text);
      }
      /* ACCORDIONS: each result collapses on its own, so the panel is long only when a reader asks
         it to be. The specs section opens; each layer inside it is collapsed until opened, which is
         what keeps a fifteen-layer component readable. */
      .acc {
        margin: 0 0 12px;
        border: 1px solid rgba(35, 67, 84, 0.12);
        border-radius: var(--ds-radius, 6px);
        background: rgba(35, 67, 84, 0.02);
      }
      .acc > summary {
        padding: 7px 10px;
        font-size: 11px;
        font-weight: 600;
        color: var(--ds-text);
        cursor: pointer;
        list-style-position: inside;
      }
      .acc[open] > summary {
        border-bottom: 1px solid rgba(35, 67, 84, 0.08);
      }
      .speclayer {
        border-top: 1px solid rgba(35, 67, 84, 0.06);
      }
      .speclayer > summary {
        padding: 5px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        list-style-position: inside;
      }
      .speclayer > pre {
        margin: 0;
        padding: 4px 10px 8px 24px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        line-height: 1.45;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      /* THE SPECS LIST — one block per layer, no inner scroll. The panel itself scrolls; a second
         scrollbar inside a list inside a panel is a trap for the wheel. */
      .specs {
        margin: 0 0 12px;
        padding: 8px 10px;
        border: 1px solid rgba(35, 67, 84, 0.12);
        border-radius: var(--ds-radius, 6px);
        background: rgba(35, 67, 84, 0.03);
      }
      .spec + .spec {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(35, 67, 84, 0.08);
      }
      .spechead {
        font-size: 11px;
        font-weight: 600;
        color: var(--ds-text);
        margin-bottom: 3px;
      }
      .specsel {
        font-family: 'IBM Plex Mono', monospace;
        font-weight: 400;
        opacity: 0.6;
      }
      .spec pre {
        margin: 0;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        line-height: 1.45;
        color: var(--ds-text);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      /* THE STEPS AND THE SOURCE — both are evidence, both are shown whole. */
      .steps,
      .src {
        margin: 0 0 12px;
        border: 1px solid rgba(35, 67, 84, 0.12);
        border-radius: var(--ds-radius, 6px);
      }
      .step {
        padding: 2px 10px;
        font-size: 11px;
        line-height: 1.5;
      }
      .sat {
        font-family: 'IBM Plex Mono', monospace;
        opacity: 0.5;
        margin-right: 6px;
      }
      .src pre {
        margin: 0;
        padding: 8px 10px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        line-height: 1.45;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      /* THE ANNOTATIONS — every one, quoted, with its layer. A note is the designer's words; a
         property mark names what it exposes. Neither is shortened. */
      .annots {
        margin: 0 0 12px;
        border: 1px solid rgba(35, 67, 84, 0.12);
        border-radius: var(--ds-radius, 6px);
      }
      .annot {
        padding: 6px 10px;
        border-top: 1px solid rgba(35, 67, 84, 0.06);
      }
      .alayer {
        font-size: 11px;
        font-weight: 600;
      }
      .apath {
        font-family: 'IBM Plex Mono', monospace;
        font-weight: 400;
        opacity: 0.6;
      }
      .anote {
        font-size: 12px;
        line-height: 1.5;
        margin-top: 2px;
      }
      .aprop {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        margin-top: 2px;
      }
      /* THE READINGS — every fact, one line each, scrollable. The verdict is the last column so a
         reader scans down the values and stops where the word is not "drawn". */
      .readings {
        margin: 0 0 12px;
        border: 1px solid rgba(35, 67, 84, 0.12);
        border-radius: var(--ds-radius, 6px);
      }
      .readhead {
        padding: 6px 10px;
        background: rgba(35, 67, 84, 0.06);
        font-size: 11px;
        font-weight: 600;
      }
      .reading {
        display: grid;
        grid-template-columns: 1.4fr 1fr 1.2fr 1.2fr 0.7fr;
        gap: 8px;
        padding: 3px 10px;
        font-size: 11px;
        line-height: 1.5;
        border-top: 1px solid rgba(35, 67, 84, 0.06);
      }
      .reading.differs,
      .reading.not-read,
      .reading.not-drawn,
      .reading.uncomparable {
        background: rgba(185, 28, 28, 0.06);
      }
      .reading.accepted {
        opacity: 0.72;
      }
      .rlayer {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rfact {
        font-family: 'IBM Plex Mono', monospace;
      }
      .rvalue,
      .rdrawn {
        font-family: 'IBM Plex Mono', monospace;
        overflow-wrap: anywhere;
      }
      .rverdict {
        font-weight: 600;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px 16px;
      }
      button {
        padding: 7px 14px;
        border-radius: var(--ds-radius);
        font: inherit;
        font-size: var(--ds-fs-sm);
        font-weight: var(--ds-weight);
        cursor: pointer;
      }
      button.approve {
        border: none;
        background: var(--ds-green);
        color: #fff;
      }
      /* THE DISCARD SPINNER — the button's own, while the removal is in flight. */
      .btnspin {
        display: inline-block;
        width: 10px;
        height: 10px;
        margin-right: 6px;
        vertical-align: -1px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.45);
        border-top-color: #fff;
        animation: btnspin 0.8s linear infinite;
      }
      @keyframes btnspin { to { transform: rotate(360deg); } }
      button.discard {
        border: 1px solid var(--ds-rule);
        background: #fff;
        color: var(--ds-text-strong);
      }
      /*
       * REMOVE IS QUIETER THAN DISCARD AND LOUDER WHEN IT IS ARMED. Discard throws away a preview
       * that was never written; Remove deletes something the catalogue is holding, so it is drawn
       * in the warning colour rather than as another neutral button — and while it is armed it
       * fills, which is the same shape the collision question's chosen answer uses, so "this is the
       * one that will act" reads the same way in both places.
       */
      button.remove {
        border: 1px solid #dc2626;
        background: #fff;
        color: #b91c1c;
      }
      button.remove:hover:not(:disabled) {
        background: #fef2f2;
      }
      button.remove[data-armed='true'] {
        background: #dc2626;
        border-color: #dc2626;
        color: #fff;
      }
      button:disabled { opacity: 0.4; cursor: not-allowed; }
      .message {
        margin: 0;
        padding: 0 16px 14px;
        font-size: var(--ds-fs-meta);
        color: var(--ds-amber);
      }
      /*
       * THE QUESTION, IN THE INGEST TOOL'S OWN DRESSING (IngestModal.tsx, the amber block under the
       * preview's header): amber, because it is a decision and not a failure; the answers on one
       * row, with the standing one filled in; and the consequence spelled out under them so a
       * person never has to remember what they chose. It sits exactly where the tool puts it —
       * under the header, above the drawing — because that is where the eye is when the ingest
       * lands. No backticks in this stylesheet: it is a tagged template literal.
       */
      .question {
        margin: 0 16px 12px;
        padding: 10px 12px;
        border: 1px solid var(--ds-amber);
        border-radius: var(--ds-radius);
        background: #fffbeb;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .question.instance {
        background: #f8fafc;
        border-color: var(--ds-rule);
      }
      .qhead {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
      }
      .qlabel {
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 700;
        color: #92400e;
      }
      .question.instance .qlabel {
        color: var(--ds-muted);
      }
      .qlede {
        font-size: var(--ds-fs-sm);
        color: #78350f;
      }
      .question.instance .qlede {
        color: var(--ds-text);
      }
      .qline {
        font-size: var(--ds-fs-meta);
        color: #78350f;
        line-height: 1.5;
      }
      .question.instance .qline {
        color: var(--ds-text);
      }
      .qline code {
        font-family: 'IBM Plex Mono', 'IBM Plex Mono', Menlo, monospace;
        font-weight: 600;
      }
      .qa {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 2px;
      }
      .qbtn {
        padding: 5px 10px;
        border-radius: var(--ds-radius);
        border: 1px solid #d97706;
        background: #fff;
        color: #92400e;
        font: inherit;
        font-size: 12px;
        font-weight: var(--ds-weight);
        cursor: pointer;
      }
      .qbtn.chosen {
        background: #b45309;
        border-color: #b45309;
        color: #fff;
      }
      .qbtn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .qconsequence {
        font-size: 11px;
        color: #92400e;
      }
      .empty {
        margin: 0;
        padding: 16px;
        font-size: var(--ds-fs-sm);
        color: var(--ds-muted);
        max-width: 46ch;
      }
      .warn {
        margin: 8px 0 0;
        font-size: 12px;
        color: #a3331f;
        line-height: 1.4;
      }
    `,
  ];

  /**
   * APPROVING A REPLACEMENT TAKES A SECOND PRESS, AND THE REASON IS A READOUT.
   *
   * Owner, 2026-10-26: *"We're gonna have to tell the user they're replacing it — that can't be the
   * label inside of a button, it has to be an error message or warning message that pops up upon
   * the attempt to approve it, and then the user will have to confirm."* So the first press does
   * not write: it draws the warning above the actions, naming the component that will be replaced.
   * The button's own label stays neutral; the sentence carries the fact.
   */
  private _confirmingApprove = false;

  private _act(kind: 'preview-approve' | 'preview-discard' | 'preview-remove', confirmed = false) {
    if (kind === 'preview-approve' && this.preview?.alreadyInCatalogue && !confirmed) {
      this._confirmingApprove = true;
      this.requestUpdate();
      return;
    }
    this.dispatchEvent(
      new CustomEvent(kind, {
        bubbles: true,
        composed: true,
        detail: {
          preview: this.preview,
          // WHICH CHILD PATTERNS THE APPROVAL SHOULD WRITE. The shell sends these tags, and the
          // server writes exactly those and leaves every other pattern untouched.
          patterns: kind === 'preview-approve' ? [...this._patternChecked] : undefined,
        },
      }),
    );
  }

  private _togglePattern(tag: string, checked: boolean): void {
    if (!tag) return;
    if (checked) this._patternChecked.add(tag);
    else this._patternChecked.delete(tag);
    this.requestUpdate();
  }

  /**
   * WHAT APPROVING WILL WRITE, STATED BEFORE ANY PRESS — the root and every child pattern.
   *
   * Owner, 2026-10-26: *"I'm trying to replace it. I might be trying to replace it… it should show
   * me what's there, what's being overwritten."* The root's line names the component and its
   * approval date; each pattern is a row with a checkbox, so replacing a child is a choice the
   * designer makes here rather than a consequence of pressing Approve. The block renders nothing
   * when nothing exists and no pattern is drafted — an empty frame is a claim that there is
   * something to show.
   */
  private _writes(p: PreviewState) {
    const patterns = Array.isArray(p.patterns) ? p.patterns : [];
    const rootTag = String(p.existing?.tag ?? '');
    if (!rootTag && !patterns.length) return nothing;
    const approved = p.existing?.approvedAt ? String(p.existing.approvedAt).slice(0, 10) : '';
    return html`
      <div class="writes">
        <div class="whead">${rootTag ? 'Already in the catalogue' : 'What approving writes'}</div>
        ${rootTag
          ? html`<p class="wroot">
              This design already exists as <code>${rootTag}</code>${approved
                ? html`, approved ${approved}`
                : nothing}. Approving replaces it. Its own measured values were not read — the
              match is the layer name.
            </p>`
          : nothing}
        ${patterns.length
          ? html`<div class="plist">
              ${patterns.map((entry) => {
                const tag = String(entry.tag ?? '');
                const drafted = entry.drafted !== false;
                // THE REASON IS THE SERVER'S OR IT IS NOTHING. A panel that supplies a cause of
                // its own is a second answer beside the measured one (owner: never interpret).
                const state = !drafted
                  ? `Not written${entry.reason ? ` — ${entry.reason}` : '.'}`
                  : entry.replaces
                    ? 'Existing — tick to replace it'
                    : 'New — will be added';
                return html`<label class="prow ${entry.replaces ? 'exists' : 'new'} ${drafted ? '' : 'off'}">
                  <input
                    type="checkbox"
                    .checked=${this._patternChecked.has(tag)}
                    ?disabled=${!drafted}
                    @change=${(event: Event) =>
                      this._togglePattern(tag, (event.target as HTMLInputElement).checked)}
                  />
                  <span class="pname">${entry.name || tag}</span>
                  <code class="ptag">${tag}</code>
                  <span class="pstate">${state}</span>
                </label>`;
              })}
            </div>`
          : nothing}
      </div>
    `;
  }

  /**
   * REMOVING TAKES TWO CLICKS, because it is the one action here that destroys work.
   *
   * The first click ARMS it and the second does it, and the label changes between them to name the
   * tag — so the person confirms the component they think they are confirming rather than the one
   * they clicked past. That is why it is not a single button like Approve: approving writes a file
   * that the next approve replaces, while removing deletes the component, its registrations, its
   * layer record and its artwork, and there is nothing left on screen to undo it from (owner,
   * 2026-09-30: *"add a delete option at the top whenever the user selects a component in the lit
   * catalogue and I can remove it"*).
   */
  private _remove(): void {
    // THE FIRST CLICK ONLY ARMS. The confirmation is a readout above the actions, never the
    // button's label (owner, 2026-10-26: *"that can't be the label inside of a button, it has to be
    // an error message or warning message… and then the user will have to confirm"*).
    this._confirmingRemove = true;
    this.requestUpdate();
  }

  /**
   * AN ARMED REMOVAL BELONGS TO THE COMPONENT IT WAS ARMED ON.
   *
   * The preview changes without this element being rebuilt — the shell rebinds it when a different
   * row is clicked — so an arm set while looking at one component would survive into the next one
   * and the second click would remove the component the person had just opened. Disarming on every
   * change of `preview` makes the two clicks necessarily land on the same component, which is the
   * only thing that makes the confirmation mean anything.
   */
  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('preview') && this._confirmingRemove) this._confirmingRemove = false;
    // A NEW PREVIEW GETS ITS OWN TICKS, BEFORE THE FIRST PAINT — so the boxes are drawn in the
    // state the approval would send, not one render behind it.
    if (changed.has('preview') && this.preview?.tag !== (changed.get('preview') as any)?.tag) {
      this._patternChecked = new Set(
        (this.preview?.patterns ?? [])
          .filter((entry) => entry.drafted !== false && !entry.replaces)
          .map((entry) => String(entry.tag ?? '')),
      );
    }
  }

  /**
   * THE QUESTION THE DESIGNER HAS TO ANSWER, and the sentence for the case that is not one.
   *
   * CARRIED FROM THE INGEST TOOL, WORD FOR WORD (IngestModal.tsx, "Name already in the design
   * system"): a layer whose NAME the design system already has on a DIFFERENT component means
   * approving this adds a SECOND component under a name that exists — so it is asked here rather
   * than decided quietly, and "No" is not a refusal: it is the answer "add it as its own
   * component", which is what an unanswered question commits as. The last line always states which
   * of the two approving will actually do, so the choice is never carried out silently.
   *
   * IT IS A QUESTION, SO IT CARRIES THE ANSWER. The two answers are events
   * (`preview-collision-answer`), because a view never writes to the catalogue: the shell records
   * the answer and sends it with the approve. The answer itself is state — the shell writes it
   * back into the preview the same way it writes everything else — so this element can draw which
   * answer is standing without keeping a copy of its own.
   *
   * AND A LAYER THAT IS THE SAME COMPONENT ELSEWHERE IS NOT A QUESTION. The design reusing its own
   * design system is stated and left alone: nothing is written for it, and nothing is asked.
   */
  private _collisionQuestion(p: PreviewState) {
    const collisions = Array.isArray(p.collisions) ? p.collisions : [];
    const instances = Array.isArray(p.instances) ? p.instances : [];
    if (!collisions.length && !instances.length) return nothing;

    const answer = p.collisionAnswer ?? '';
    return html`
      ${collisions.length
        ? html`
            <div class="question">
              <div class="qhead">
                <span class="qlabel">Name already in the design system</span>
                <span class="qlede"
                  >${collisions.length === 1
                    ? 'one layer here has a name that already exists on a different component'
                    : `${collisions.length} layers here have names that already exist on different components`}</span
                >
              </div>
              ${collisions.map(
                (c) => html`
                  <div class="qline">
                    <code>${c.name}</code> — this layer is component <code>${c.nodeIdentity ?? c.nodeId}</code
                    >${c.nodeLocation ? html` at <code>${c.nodeLocation}</code>` : nothing}, and the design
                    system's <code>${c.existingTag}</code> is component
                    <code>${c.existingIdentity ?? c.existingNodeId}</code>${c.existingFile
                      ? html` (${c.existingFile})`
                      : nothing}
                    — different components
                  </div>
                `,
              )}
              <div class="qa">
                <button
                  class="qbtn ${answer ? '' : 'chosen'}"
                  type="button"
                  ?disabled=${this.busy}
                  @click=${() => this._answer('')}
                >
                  No — add it as a new component
                </button>
                ${collisions.map(
                  (c) => html`
                    <button
                      class="qbtn ${answer === c.existingTag ? 'chosen' : ''}"
                      type="button"
                      ?disabled=${this.busy}
                      @click=${() => this._answer(c.existingTag)}
                    >
                      Yes — overwrite ${c.existingTag}
                    </button>
                  `,
                )}
              </div>
              <div class="qconsequence">
                ${answer
                  ? `Approving will write this design's component under ${answer}, replacing that component.`
                  : 'Approving will add a second component under this name.'}
              </div>
            </div>
          `
        : nothing}
      ${instances.length
        ? html`
            <div class="question instance">
              <div class="qhead">
                <span class="qlabel">Same component, other place</span>
                <span class="qlede"
                  >${instances.length === 1
                    ? 'one layer here IS a component the design system already ships, drawn elsewhere'
                    : `${instances.length} layers here ARE components the design system already ships, drawn elsewhere`}</span
                >
              </div>
              ${instances.map(
                (i) => html`
                  <div class="qline">
                    <code>${i.name}</code> — the design system's <code>${i.existingTag}</code>
                    ${i.identity ? html` (component <code>${i.identity}</code>)` : nothing} IS this layer's
                    component${i.nodeLocation ? html`, drawn at <code>${i.nodeLocation}</code>` : nothing}.
                    Nothing is written for it.
                  </div>
                `,
              )}
            </div>
          `
        : nothing}
    `;
  }

  /**
   * THE VALUES THE COMPONENT WILL BE GIVEN — drawn beside the drawing, named as what they are.
   *
   * IT IS A LIST AND NOT A SUBSTITUTION, and the difference is the whole point: the drawing above
   * shows the design as it is (its own sample words, because a preview instantiates the element bare
   * — see `draft-preview`), and this block shows the data the component will receive in the room. A
   * reader who saw the values painted into the drawing could not tell a bound component from one
   * whose design happens to contain those words.
   *
   * NOTHING HERE IS INVENTED: the values come from the application's rows, and a component with no
   * row yet carries none — which is a component being created, said by the absence of the block.
   */
  private _binding(p: PreviewState) {
    const values = Array.isArray(p.values) ? p.values : [];
    if (!values.length) return nothing;
    return html`
      <div class="binding">
        <div class="bhead">The data this component is given</div>
        <dl>
          ${values.map((v) => html`<dt>${v.field}</dt><dd>${v.value}</dd>`)}
        </dl>
      </div>
    `;
  }

  private _answer(overwriteTag: string) {
    this.dispatchEvent(
      new CustomEvent('preview-collision-answer', {
        bubbles: true,
        composed: true,
        detail: { overwriteTag: overwriteTag || null },
      }),
    );
  }

  /**
   * THE HOST CARRIES THE PENDING STATE, because it is the host that has to have a size.
   *
   * Measured 2026-10-26 in the real room: the element was 15 pixels wide while pending. Its
   * content was absolutely positioned, so it contributed no width and the host sized to nothing —
   * there was no column to centre in. The attribute lets the host declare its own width and height
   * for exactly this state, and the drawing path is untouched.
   */
  /** Keeps the pending pane the size of the column it sits in, without CSS guessing. */
  private _pendingObserver: ResizeObserver | null = null;

  private _sizeToParent(active: boolean): void {
    if (!active) {
      this.style.width = '';
      this.style.height = '';
      this._pendingObserver?.disconnect();
      this._pendingObserver = null;
      return;
    }
    const parent = this.parentElement;
    if (!parent) return;
    const apply = () => {
      // MEASURED, NOT GUESSED: the pane takes the column's own box, so fifty percent of it is the
      // column's centre. `width: 100%` resolved to zero here because the element is slotted, and a
      // ring centred in a zero-width box is not centred — it is invisible.
      this.style.width = `${parent.clientWidth}px`;
      this.style.height = `${parent.clientHeight}px`;
    };
    apply();
    if (!this._pendingObserver) {
      this._pendingObserver = new ResizeObserver(apply);
      this._pendingObserver.observe(parent);
    }
  }

  protected updated(changed: Map<string, unknown>): void {
    this.toggleAttribute('data-pending', !!this.preview?.pending);
    this.toggleAttribute('data-removed', !!this.preview?.removed);
    this._sizeToParent(!!this.preview?.pending);
    // A NEW PREVIEW IS A NEW QUESTION: an armed replacement must not carry over to another design.
    if (changed.has('preview') && this.preview?.tag !== (changed.get('preview') as any)?.tag) {
      this._confirmingApprove = false;
    }
  }

  render() {
    // THE INGEST IS RUNNING: THE COLUMN IS OPEN AND SAYS SO. Owner, 2026-10-26: *"in the third
    // column opens then you drop the spinner there so that the user is not staring at a blank
    // third column while it's ingesting."*
    if (this.preview?.pending) {
      return html`<div class="pending">
        <span class="bigspin" aria-hidden="true"></span>
        <p class="ptext">${this.preview.note || "Ingesting — reading the node from Figma…"}</p>
      </div>`;
    }
    // NO RUN YET. Said in words: an empty pane and a preview of nothing are different claims.
    if (this.preview === undefined || this.preview === null) {
      return html`
        <p class="empty">
          Nothing loaded yet. Paste a Figma link and Submit, or pick a component from the list on the left.
        </p>
      `;
    }

    const p = this.preview;
    const facts = p.facts ?? [];
    return html`
      ${this.message ? html`<p class="message">${this.message}</p>` : nothing}
      ${this._collisionQuestion(p)}
      <!--
        THE DRAWING, IN A FRAME THAT CANNOT BE INVISIBLE.
        The React preview put a visible outline around the component, and its reason is the reason
        this frame exists: a component can be white on white, and then a preview of it is a blank
        pane that looks like a failure. So the component is drawn inside a bordered box, on the
        design system's own surface token, with the box's edge doing the work the background
        cannot. What is drawn is a CHILD OF THE SURFACE, named by the shell and instantiated by the
        renderer — the element never reaches for a tag of its own, because a surface's children come
        from the envelope and from nothing else.
      -->
      <div class="frame ${p.source === "open" ? "element-in-frame" : ""}">
        <slot name="draw"></slot>
      </div>
      ${this._binding(p)}
      <div class="body">
        ${p.note ? html`<p class="note">${p.note}</p>` : nothing}
        ${p.progress ? html`<p class="progress" role="status">${p.progress}</p>` : nothing}
        ${this._writes(p)}
        ${this._confirmingRemove && p.alreadyInCatalogue
          ? html`<div class="replacewarn" role="alert">
              <div class="rwtitle">Remove ${p.tag} from the catalogue?</div>
              <p class="rwbody">
                This deletes the component's file, its Figma map entry, its allowlist entry, its
                catalogue entry and its layer record. It can be ingested again, but the removal is
                recorded, and the component is gone from the catalogue until then.
              </p>
              <div class="rwactions">
                <button class="rwgo" type="button" @click=${() => {
                  this._confirmingRemove = false;
                  this._act('preview-remove');
                }}>Remove ${p.tag}</button>
                <button class="rwstop" type="button" @click=${() => {
                  this._confirmingRemove = false;
                  this.requestUpdate();
                }}>Cancel</button>
              </div>
            </div>`
          : nothing}
        ${this._confirmingApprove && p.alreadyInCatalogue
          ? html`<div class="replacewarn" role="alert">
              <div class="rwtitle">This will REPLACE a component that is already in the catalogue</div>
              <p class="rwbody">
                The design you are approving is already in the catalogue as
                <code>${p.tag}</code>. Approving now replaces that component — its file, its Figma
                map entry, its allowlist entry and its catalogue entry. Nothing else is touched.
              </p>
              ${(p.patterns ?? []).filter(
                (entry) => entry.replaces && this._patternChecked.has(String(entry.tag ?? '')),
              ).length
                ? html`<p class="rwbody">
                    Patterns that will be replaced as well:
                    ${(p.patterns ?? [])
                      .filter(
                        (entry) => entry.replaces && this._patternChecked.has(String(entry.tag ?? '')),
                      )
                      .map((entry) => html`<code>${entry.name}</code> (${entry.tag}) `)}
                  </p>`
                : nothing}
              <div class="rwactions">
                <button class="rwgo" type="button" @click=${() => {
                  this._confirmingApprove = false;
                  this._act('preview-approve', true);
                }}>Replace ${p.tag} and approve</button>
                <button class="rwstop" type="button" @click=${() => {
                  this._confirmingApprove = false;
                  this.requestUpdate();
                }}>Cancel</button>
              </div>
            </div>`
          : nothing}
        ${(p.specs ?? []).length
          ? html`<details class="acc" open>
              <summary>Specs — ${(p.specs ?? []).length} layer(s)</summary>
              ${(p.specs ?? []).map(
                (s) => html`<details class="speclayer">
                  <summary>
                    ${s.name || s.path}${s.type ? html` <span class="specsel">${s.type}</span>` : nothing}
                  </summary>
                  <pre>${(s.display ?? s.declarations ?? []).join(";\n")};</pre>
                </details>`
              )}
            </details>`
          : nothing}
        ${(p.annotations ?? []).length
          ? html`<details class="acc" open>
              <summary>Annotations — every one the file carries, ${(p.annotations ?? []).length}</summary>
              <div class="annots">
              ${(p.annotations ?? []).map(
                (a) => html`<div class="annot">
                  <div class="alayer">${a.layer} <span class="apath">${a.path || ""}</span></div>
                  ${a.note
                    ? html`<div class="anote">“${a.note}”</div>`
                    : html`<div class="aprop">property mark: ${(a.properties ?? []).join(", ") || "(none named)"}</div>`}
                </div>`
              )}
              </div>
            </details>`
          : nothing}
        ${(p.readings ?? []).length
          ? html`<details class="acc" open>
              <summary>
                Facts read, layer by layer — what Figma stated, what the component carries, and the
                verdict. ${(p.readings ?? []).length} facts.
              </summary>
              <div class="readings">
              ${(p.readings ?? []).map(
                (r) => html`<div class="reading ${r.verdict || ''}">
                  <span class="rlayer">${r.layer}</span>
                  <code class="rfact">${r.fact}</code>
                  <span class="rvalue">${r.source || "—"}</span>
                  ${r.drawn ? html`<span class="rdrawn">→ ${r.drawn}</span>` : nothing}
                  <span class="rverdict">${r.verdict}</span>
                </div>`
              )}
              </div>
            </details>`
          : nothing}
        ${p.componentSource
          ? html`<details class="acc">
              <summary>
                The component source the preview loads — ${p.sourceBytes ?? (p.componentSource || '').length} bytes
              </summary>
              <div class="src"><pre>${p.componentSource}</pre></div>
            </details>`
          : nothing}
        ${facts.length
          ? html`
              <dl>
                ${facts.map((f) => html`<dt>${f.label}</dt><dd>${f.value}</dd>`)}
              </dl>
            `
          : nothing}
      </div>
      <div class="head">
        <span class="title">Preview</span>
        ${p.name || p.tag ? html`<span class="subject">${p.name || p.tag}</span>` : nothing}
        ${p.tag ? html`<span class="tag">${p.tag}</span>` : nothing}
        ${/*
          THE HEAD SITS AT THE BOTTOM NOW (owner, 2026-10-01): *"move it to the bottom of that
          column instead of at the top… I want it underneath the last readout on that page."*
          It sat at the top — where the React ingest pane puts its header and buttons — from the
          one-for-one translation until this instruction. The identity and the three actions read
          under the facts now, and the bar carries a top edge instead of a bottom one.
        */ ''}
        <span class="actions">
          <button
            class="approve"
            type="button"
            ?disabled=${this.busy || p.approving || p.discarding || p.removing}
            @click=${() => this._act('preview-approve')}
          >
            ${p.approving
              ? html`<span class="btnspin" aria-hidden="true"></span>Approving — writing it into the catalogue…`
              : 'Approve & add to catalogue'}
          </button>
          <button
            class="discard"
            type="button"
            ?disabled=${this.busy || p.discarding || p.removing}
            @click=${() => this._act('preview-discard')}
          >
            ${p.discarding
              ? html`<span class="btnspin" aria-hidden="true"></span>Discarding…`
              : 'Discard'}
          </button>
          ${/*
            REMOVE, AND ONLY WHEN THERE IS SOMETHING TO REMOVE. A draft that has never been
            approved is not in the catalogue, so there is nothing to take out of it — Discard is
            the whole of that case. The header's own note says the map is one-for-one and names
            this button: *"its buttons on the right — Approve, Close, Remove"*. It was missing.
          */ ''}
          ${p.alreadyInCatalogue
            ? html`<button
                class="remove"
                type="button"
                data-armed=${this._confirmingRemove ? 'true' : 'false'}
                ?disabled=${this.busy || p.removing}
                @click=${() => this._remove()}
              >
                ${p.removing
                  ? html`<span class="btnspin dark" aria-hidden="true"></span>Removing…`
                  : 'Remove from the catalogue'}
              </button>`
            : nothing}
        </span>
        ${this._confirmingRemove
          ? html`<p class="warn">
              This next click deletes ${p.tag} from the catalogue and its file. Bringing it back
              will require re-ingesting it — the record keeps who removed it, not a copy of it.
            </p>`
          : nothing}
      </div>
    `;
  }
}

if (!customElements.get('component-preview')) customElements.define('component-preview', ComponentPreview);

declare global {
  interface HTMLElementTagNameMap {
    'component-preview': ComponentPreview;
  }
}
