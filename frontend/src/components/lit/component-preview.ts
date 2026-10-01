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
  /** The job's id, when an ingest produced this — what an approve resolves. */
  jobId?: string;
  /** Free label/value facts to draw under the identity, in order. */
  facts?: Array<{ label: string; value: string }>;
  /** One line about what this is, from the row or the ingest. */
  note?: string;
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
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
        /* TRANSPARENT — THE EDGE IS THE FRAME (owner, 2026-09-30: *"there's backgrounds on the
           containers inside of the third column, they should be transparent"*). The room's own
           ground shows through, so the column does not read as a stack of panels bolted inside
           the canvas; the 1px edge is what makes a white component visible, which was the whole
           reason the React pane had an outline in the first place. */
        background: transparent;
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
      .note {
        margin: 0 0 10px;
        font-size: var(--ds-fs-sm);
        color: var(--ds-text);
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
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
    `,
  ];

  private _act(kind: 'preview-approve' | 'preview-discard' | 'preview-remove') {
    this.dispatchEvent(
      new CustomEvent(kind, {
        bubbles: true,
        composed: true,
        detail: { preview: this.preview },
      }),
    );
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
    if (!this._confirmingRemove) {
      this._confirmingRemove = true;
      // The label IS the confirmation, and this field is not reactive, so the render is asked for.
      this.requestUpdate();
      return;
    }
    this._confirmingRemove = false;
    this._act('preview-remove');
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

  render() {
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
            ?disabled=${this.busy}
            @click=${() => this._act('preview-approve')}
          >
            ${p.alreadyInCatalogue ? 'Approve & REPLACE the existing component' : 'Approve & add to catalogue'}
          </button>
          <button
            class="discard"
            type="button"
            ?disabled=${this.busy}
            @click=${() => this._act('preview-discard')}
          >
            Discard
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
                ?disabled=${this.busy}
                @click=${() => this._remove()}
              >
                ${this._confirmingRemove
                  ? `Click again to remove ${p.tag} from the catalogue`
                  : 'Remove from the catalogue'}
              </button>`
            : nothing}
        </span>
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
