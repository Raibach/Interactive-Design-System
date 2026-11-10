/** The preview's state shape: the drawing, its facts, its child patterns, and the approval state. */

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
  /**
   * THE CHAT OWNS THE ACTIONS. The third column draws the component and its facts; the approval
   * and the diagnostic actions are said in the conversation, so the buttons are not drawn here.
   */
  chatControls?: boolean;
  /** The workflow step drawn at the top of the body: Pending acceptance, Accepted, Approved. */
  status?: string;
  /** True once the designer accepted the drawing; the approval writes the catalogue. */
  accepted?: boolean;
  /** Free label/value facts to draw under the identity, in order. */
  facts?: Array<{ label: string; value: string }>;
  /** One line about what this is, from the row or the ingest. */
  note?: string;
  /**
   * THE SAME NOTE, LINE BY LINE (owner, 2026-11-01: *"format this text … so that the user can read it
   * easier. Right now it's just one huge block."*). Each entry draws on its own line; `note` is the
   * fallback for a host that still sends one string, so nothing that speaks the old shape is lost.
   */
  noteLines?: string[];
  /**
   * WHAT COULD NOT BE READ OR DRAWN, one sentence each, drawn as a list under the note. A COUNT IS
   * NOT ENOUGH: each entry names the layer, the fact and the value found, so a person can go and
   * check it. This is the same list the backend produced; the element only lays it out.
   */
  unread?: string[];
  /** How many stated facts the run read — the denominator the list is missing from. */
  factsRead?: number;
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
    verdict?: string; why?: string; chosen?: string;
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
