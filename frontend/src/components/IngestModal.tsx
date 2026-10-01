import React, { useState, useEffect, useRef, type ReactNode } from "react";
// A region whose seat is elsewhere is rendered THROUGH React into that element (see the `seats`
// prop): it becomes a child of the element that owns the hole, instead of a loose node in the room
// container's light DOM.
import { createPortal } from "react-dom";
import { parseFigmaUrl } from "@/utils/figmaUrl";
import { loadDrawn, drawnBy, tagFor, type DrawnIndex } from "@/shared/component-drawn-by";
import { contractFor, catalogEntryFacts } from "@/shared/component-contract";
import { nodeIdentity, nodeLocation } from "@/shared/node-id";
// Side-effect import: registration is what makes the tag draw. An element that is never
// imported is never defined, and the layer tree below the drafts would be an empty box.
import "@/components/lit/figma-layers-view";
// The Design section's three columns are the Composer's own element. It is IMPORTED here rather
// than in main.tsx for the same reason the view above is: this section is what uses it, and the
// element already registers itself on import.
//
// THIS WAS A COPY FOR AN HOUR AND IS NOT ONE. The owner, 2026-09-30, reversing that call:
// *"I'm not gonna be able to copy. We're not gonna be able to copy. You're gonna have to use the
// same lit components in the same behavior inside of design… I want to just reuse the lit
// components for the composer. I will just replace what they hold."*
//
// So there is no `design-workspace-layout`. The same element serves every section, and what a
// section IS comes from what it puts in the slots — which is the part he intends to replace.
// The name of the copy went with it: a second tag would have been a second thing to maintain
// while both still had to behave the same.
import "@/components/lit/workspace-layout";

/**
 * Ingest Figma Design — the designer's end of the ingest pipeline.
 *
 * Paste a Figma URL and the backend generates the component but writes nothing: the
 * source comes back as a draft, previewed here as the real element (the dev server
 * compiles the draft on the fly), so a look costs nothing and leaves nothing behind.
 * Approve writes it into src/components/lit/, maps it to its Figma node, registers it
 * in the AI allowlist and declares it in the pipeline catalog; Discard drops it.
 */

/** How many uncommitted drafts may be held at once. */

/** Generated tags are `f-<figma node id>`. Anything else is never interpolated into the preview document. */
const TAG_RE = /^f-[A-Za-z0-9-]+$/;

/** One hit from the search: a node, where the name was found, and whether a component is there. */
interface FindHit {
  nodeId?: string;
  name?: string;
  type?: string;
  component?: string;
  file?: string;
  exists?: boolean;
  foundIn?: string;
}

/**
 * A layer of the design, opened from the tree — what was MEASURED about it.
 *
 * A layer is not a component and has no file; it has a node id, a type, a size, the layout it
 * imposes, its text, and — when it is an instance — the component it is an instance of. That is
 * the whole of what this application knows about it, so that is what the pane shows, with the
 * catalogue's answer beside it (`tag` empty means nothing draws it).
 */
interface LayerView {
  record?: string;
  tag?: string;
  id?: string;
  name?: string;
  type?: string;
  size?: [number, number] | null;
  text?: string;
  componentId?: string;
  fill?: string;
  layout?: Record<string, string | number> | null;
  typeStyle?: Record<string, string | number> | null;
}

/**
 * WHAT THE SEARCH IS ALLOWED TO SHOW — a hit about something that EXISTS.
 *
 * The endpoint answers from the Figma map, from the ingest record, and from Figma. A record-only
 * hit is a line in a log of what once happened: real, worth keeping for the audit, and not an
 * answer to "does this exist". Dropping them here is what keeps the search agreeing with the
 * list on the left, which is the catalogue and nothing else.
 */
function isCatalogueMatch(hit: FindHit): boolean {
  // A DRAFT IS NOT HISTORY, and it is not a claim about the catalogue either — it is work in
  // progress that the server is holding and that can be opened. The rule below is for log lines,
  // and applying it to a draft made the search deny the component that had just been ingested.
  if (hit.foundIn === "draft") return true;
  return hit.foundIn !== "record" || hit.exists === true;
}

interface DraftValidation {
  ok: boolean;
  error?: string;
  note?: string;
}

interface NodeSpec {
  id?: string;
  name?: string;
  type?: string;
  size?: [number, number];
  fill?: string;
  stroke?: { color?: string; weight?: number };
  radius?: number;
  effects?: string[];
  text?: string;
  type_style?: Record<string, string | number>;
  layout?: Record<string, string | number>;
}

interface AssembledResult {
  model?: string;
  /**
   * WHO WROTE THE CODE. `renderer` is the deterministic path — Figma's own measurements turned
   * into Lit by a pure function — and it is the only one of the three that carries no
   * interpretation, so the panel says so rather than treating "not the model" as a failure.
   */
  generatedBy?: "assembly-model" | "template" | "renderer";
  surface?: any;
  componentsFromModel?: string[];
  rejected?: string[];
  note?: string;
  error?: string;
  rawReply?: string;
  /** What the element does not carry from the design, and what to change. */
  compliance?: string[];
  /** The model call itself: model, mode, seconds, prompt and reply sizes. */
  call?: { model?: string; mode?: string; seconds?: number; promptChars?: number; specChars?: number; replyChars?: number; catalogComponents?: number };
  replyHead?: string;
  replyTail?: string;
}

interface Channels {
  rest?: string;
  mcp?: string;
  annotations?: number;
  /** Split, so a count that came from one channel cannot be read as coming from both. */
  annotationsBy?: { rest?: number; mcp?: number };
  descriptions?: number;
  /** Vectors and images MCP carried — the only channel that has them. */
  assets?: number;
  /**
   * The components THIS design uses, and which of them the designer wrote a description on. The
   * description lives on the component rather than on the layer, so it is read from the file's
   * component list — and the text travels with the ids, so it can be shown rather than counted.
   */
  componentsUsed?: string[];
  describedComponents?: string[];
  componentDescriptions?: Record<string, string>;
}

interface IngestResult {
  tag: string;
  components?: string[];
  drafts?: Record<string, string>;
  validation?: Record<string, DraftValidation>;
  assembled?: AssembledResult;
  channels?: Channels;
  /**
   * THE POST-BUILD VECTOR CHECK — what the element draws against what the design measured.
   *
   * Run in the pipeline after the model has built the component, over the vectors only for now.
   * Each entry names the vector and what differs, or says the artwork is missing or could not be
   * verified. A clean run says so in one line, so this list is never empty-and-silent about
   * whether the check ran at all.
   */
  vectorFindings?: string[];
  /** Present when the tag is already in the catalogue: approving will overwrite it. */
  alreadyInCatalogue?: { file: string; bytes: number; writtenAt: string } | null;

  mcp_parsed?: {
    annotations?: Record<string, string[]>;
    descriptions?: Record<string, string>;
    reference_code?: Record<string, string>;
    layout_info?: Record<string, Record<string, string>>;
    style_info?: Record<string, Record<string, string>>;
  };
  /**
   * A layer whose NAME the design system already has, on a DIFFERENT component — the copy case.
   * A question, because approving would put a second component under a name that exists.
   */
  nameCollisions?: Array<{
    name: string;
    nodeId: string;
    layerType?: string;
    existingTag: string;
    existingNodeId: string;
    existingFile?: string;
    /** The two halves of each id: which component each is, and where this instance sits. */
    existingIdentity?: string;
    nodeIdentity?: string;
    nodeLocation?: string;
  }>;
  /**
   * A layer that IS a component the design system already ships, in another location — the same
   * component reference, a different occurrence. NOT a question and nothing is written for it:
   * the design reusing its own design system. Reported so the screen can say so, instead of a
   * reader having to work out which of two identical names is which.
   */
  nameInstances?: Array<{
    name: string;
    nodeId: string;
    nodeLocation?: string;
    existingTag: string;
    existingNodeId: string;
    identity?: string;
  }>;
  rest_response?: any;
  details?: {
    target_node_id: string;
    target_node_name: string;
    target_node_type: string;
    components_found: string[];
    generated_files: string[];
    spec?: NodeSpec;
  };
}

interface RegistrationResult {
  figmaMap?: string;
  allowlist?: string;
  catalog?: string;
  countClaims?: string;
  /** Where this component's measured layer tree was written — approve is the only writer. */
  layers?: string;
  skipped?: string;
}

interface CatalogCheck {
  ran: boolean;
  ok?: boolean;
  verdict?: string;
  findings?: string[];
}

/** One thing that happened: the procession the session leaves behind. */
interface ActivityEntry {
  at: string;
  kind: "ingested" | "approved" | "discarded" | string;
  jobId: string;
  sessionId?: string;
  sessionTitle?: string;
  actor?: string;
  nodeId?: string;
  nodeName?: string;
  generatedBy?: string;
  error?: string | null;
  note?: string;
  /** Why a removal happened, as it was given at the time. Only removals carry one. */
  reason?: string;
  /**
   * THE SUBJECT OF THE EVENT, under whichever key this kind puts it. An approval carries `tags`
   * (a list, one per component it wrote); a removal and a refused removal carry `tag` (a single
   * name), and the tile read only the list — so the two kinds whose whole point is WHICH
   * component was removed were the two with nothing beside their timestamp.
   */
  tag?: string;
  rejected?: string[];
  tags?: string[];
  written?: string[];
  discarded?: string[];
  verdict?: string;
}

interface ComponentRecord {
  tag: string;
  file: string;
  exists: boolean;
  bytes: number;
  figmaMap?: { figmaName?: string; figmaNodeId?: string; status?: string; file?: string } | null;
  registered?: { figmaMap?: boolean; allowlist?: boolean; catalog?: boolean };
  firstSeen?: string | null;
  lastSeen?: string | null;
  approvedAt?: string | null;
  history?: ActivityEntry[];
}

interface DraftItem {
  /** Job id — also the path segment the preview module is served from. */
  id: string;
  url: string;
  notes: string;
  status: "processing" | "done" | "error" | "committed" | "removed";
  result?: IngestResult;
  error?: string;
  commitError?: string;
  discardError?: string;
  written?: string[];
  replaced?: Record<string, { previousBytes: number; nowBytes: number }>;
  /** Set when this component was taken out of the catalogue from here. */
  removal?: { tag: string; outcome?: Record<string, string>; verdict?: string };
  
  /**
   * Set when the row was OPENED to look at, not ingested. A viewed component is not a draft:
   * it is not waiting for anything, it does not hold a slot, and it does not belong in the
   * Drafts list — see `drafts` below for why that separation matters.
   */
  viewed?: boolean;
  /** Set when the row was opened by tag rather than ingested now. */
  record?: ComponentRecord;
  /**
   * THE DESIGNER'S ANSWER to a name collision, set by the question in the middle column:
   * the tag of the existing component to overwrite. Unset means "no" — the copy is added as
   * its own component — and that is what an unanswered question commits as.
   */
  overwriteTag?: string;
  registration?: RegistrationResult;
  catalogCheck?: CatalogCheck;
}

interface IngestModalProps {
  open: boolean;
  onClose: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** The prompt package this tool is open on — what it adds is part of that package's history. */
  sessionId?: string | null;
  /** Its title, so the outcome reads as the work it was, not an id. */
  sessionTitle?: string | null;
  /**
   * WHERE THIS RENDERS, WHICH IS A DIFFERENT QUESTION FROM WHAT IT DOES.
   *
   * `modal` (default) — a full-screen panel over everything, with a Close control. This is what
   * the left menu's own "Ingest Design" item opens, and it is unchanged.
   *
   * `section` — the same interface as a REGION of the surface, seated under the navigation the
   * way the Composer is rather than floating over it. The owner, 2026-09-30: "the overlay now is
   * not an overlay. It's actually built-in… It's not gonna be closed like a modal. So it should
   * seat itself underneath the navigation just like the composer does… make it a section now."
   *
   * So in `section` there is NO overlay positioning, NO z-index and NO Close — there is nothing
   * to close, because it is the tab's content and leaving the tab is how you leave it. Reset
   * stays: it clears what is held, which is a thing this tool does, not a way out of it.
   *
   * THE BODY IS SHARED. Only the frame differs, so the two can never drift into two tools.
   */
  variant?: 'modal' | 'section';

  /**
   * THE SEATS — WHERE EACH REGION IS LOADED, WHEN THE HOST HAS CONTAINERS FOR THE COLUMNS.
   *
   * A section's three regions carry `slot="left" | "middle" | "right"` and are handed to the room's
   * `<workspace-layout>`, which projects each into its named pane. That is the default and needs no
   * prop: the container's slots ARE the projection.
   *
   * A PANE IS NOT A CONTAINER, THOUGH. The design's middle column is its own element with a HOLE
   * (`design-middle-container`), and its content belongs INSIDE it. There is a measured second
   * reason as well (2026-09-30): nodes React appends to the room container's light DOM are
   * unmanaged by lit-html, which owns that same child list, so they are displaced when lit
   * re-renders — and every change in a slot's assignment makes workspace-layout re-baseline its
   * split. The owner felt both: *"I can't close the container. I can't grab a hold of the
   * grippers. It's jerking away from me."*
   *
   * So a host that HAS a container passes it here and the region is portaled INTO it: ONE instance
   * of this tool, ONE state, and each region seated in the element that owns its hole. A region
   * whose seat is absent is returned where it stands, exactly as before this prop existed.
   */
  seats?: Partial<Record<'left' | 'middle' | 'right', HTMLElement | null>>;

  /**
   * IS THE OUTPUT COLUMN DRAWING SOMETHING — the same fact a Run is for the Composer.
   *
   * The design's third column is collapsed until there is something to put in it — the owner,
   * 2026-09-30: *"whenever I click on Preview or submit that operates, just like run on the
   * composer. It's the same behavior when I select one of the components in the component tree
   * that operates just like run in the composer. if the Preview window is already open then
   * there's no reason to reopen it right, because it's open."* The Composer's rule is the same
   * rule by the same mechanism: its root carries no middle child at rest, and the column is drawn
   * when the surface puts something in it.
   *
   * WHICH COLUMN EXISTS IS THE HOST'S FACT, NOT THIS TOOL'S — the host owns the surface's tree, so
   * this tool only reports the fact the decision is made from: whether the Preview is drawing a
   * component. That is exactly the selection (`selected` — the item `preview` renders), so a
   * submitted node opens the column and so does picking a component, and they are one fact because
   * they are one thing on screen.
   *
   * IT IS NEVER LOWERED BY THIS TOOL. Deselecting is not a request to take the column away from
   * someone reading it, and a column that shuts itself under a person is the fault this layout
   * keeps having to fix (see the middle pane's `_onMiddleSlotChange`). The host ignores the
   * false half for the same reason.
   */
  onPreviewChange?: (hasPreview: boolean) => void;

  /**
   * A COMPONENT WAS PICKED — the host's cue to ASK THE ASSEMBLER FOR IT.
   *
   * The owner, 2026-09-30: *"when I click on something I'm sending a command to the AI assembler,
   * the rendering application — load that component — and it has to pull it from the catalog and it
   * has to grab its metadata."* The tool knows which component a person picked; the ROOM is
   * assembled from that, so the fact is reported rather than the tool drawing the room itself.
   */
}

export function IngestModal({ open, onClose, apiFetch, sessionId, sessionTitle, variant = 'modal', seats, onPreviewChange }: IngestModalProps) {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  /**
   * Bumped by every ingest and every approve, to make the layer tree below the drafts re-read
   * its record. It is the only thing that tells that view something landed — the file it reads
   * is written by the backend, and nothing pushes.
   */
  const [layersKey, setLayersKey] = useState(0);
  /** Bumped by Reset: the tree folds back to its opening state. See resetAll. */
  const [resetKey, setResetKey] = useState(0);
  const [inputError, setInputError] = useState("");
  const [approving, setApproving] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [activityMode, setActivityMode] = useState<"session" | "history">("session");
  const [activitySource, setActivitySource] = useState<string>("");
  const [activityError, setActivityError] = useState<string>("");
  /**
   * How much record there is, and whether that is more than anyone asked for.
   *
   * The activity record is for auditing — nothing in this application reads it to decide
   * anything — so it is the one thing here that may be trimmed without touching a component.
   * It is never trimmed by itself: the size is reported, and the deletion is a thing the reader
   * does, with the number of days in front of them and a confirmation that states it cannot be
   * undone. A log that quietly cleans itself is a log you cannot trust the next time.
   */
  const [activityAudit, setActivityAudit] = useState<{
    fileKiB?: number | null;
    fileRows?: number | null;
    tableRows?: number | null;
    oldest?: string | null;
    warnAtKiB?: number;
    warnAtRows?: number;
    large?: boolean;
    why?: string;
    keepDays?: number;
    logFile?: string;
  } | null>(null);
  const [purgeDays, setPurgeDays] = useState<number | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string>("");
  const [purgeError, setPurgeError] = useState<string>("");
  const [discardNotice, setDiscardNotice] = useState<string>("");
  const [findResults, setFindResults] = useState<FindHit[] | null>(null);
  /** Guards a slow search landing after a Reset, or after a newer search. */
  const findToken = useRef(0);

  /**
   * WHAT DRAWS EACH COMPONENT — the name resolved by the renderer's own resolver, and the tag
   * resolved to a file by the element manifest. Null until it has been read, and `drawnBy`
   * answers `unknown` rather than "nothing draws it" until then: the two are different claims
   * and only one of them is a reason to stop looking for a file.
   */
  const [drawn, setDrawn] = useState<DrawnIndex | null>(null);
  /**
   * WHAT THE OUTPUT COLUMN IS FOR, SAID ONCE — see `onPreviewChange` on the props for the rule and
   * the owner's words. One place, derived from the one fact: the Preview is drawing the selected
   * item. (Derived here rather than from `selected`, which is declared further down this component:
   * a dependency array is evaluated during the render that calls the hook, and reading a `const`
   * before its declaration is a throw.)
   */
  useEffect(() => {
    onPreviewChange?.(items.some((item) => item.id === selectedId));
  }, [items, selectedId, onPreviewChange]);

  useEffect(() => {
    if (!open) return;
    // A WRITE REGENERATES THE MANIFEST — every approve and every removal runs the element
    // analyser — and `layersKey` is bumped by each one. So the first read is cached and every
    // read after a write is not, or the preview would describe the catalogue as it was.
    void loadDrawn(layersKey > 0).then(setDrawn);
  }, [open, layersKey]);

  /**
   * THE RECORD IS A SNAPSHOT, SO IT IS RE-READ WHEN THE CATALOGUE CHANGES.
   *
   * It is read when a component is opened, and a removal or an approval that happens afterwards
   * — here, in another tab, or from a re-ingest — leaves that copy describing a state that has
   * passed: a file that is gone, a component no longer in the catalogue. `layersKey` is bumped
   * by every write, so it is the signal that the snapshot may be wrong, and re-reading it is
   * what keeps the pane from asserting something the catalogue no longer says.
   */
  useEffect(() => {
    if (!open || layersKey === 0) return;
    const item = items.find((i) => i.id === selectedId);
    if (!item) return;
    /*
     * A DRAFT HAS NO CATALOGUE STATE TO RE-READ, and asking for one is not harmless.
     *
     * This effect exists to keep a REGISTERED component's snapshot from going stale. A draft is
     * not registered — nothing is written until the approve — so the record endpoint answers
     * about a component that does not exist yet, and attaching that answer makes the pane treat
     * the draft as registered: its preview switches off (the pane says "Nothing to render" about
     * a component it has just built and the dev server can compile), and a "Remove from
     * catalogue" button appears on something nobody has written. Reported 2026-09-29, on a draft
     * that had generated 4,970 characters and compiled.
     *
     * A draft is an item ingested here and not yet approved; `viewed` marks the ones opened from
     * the tree to look at, and those DO have catalogue state worth re-reading.
     */
    if (!item.viewed && item.status !== "committed") return;
    const tag = item.record?.tag ?? item.result?.tag;
    if (!tag) return;
    let alive = true;
    void (async () => {
      try {
        const res = await apiFetch(`/api/figma/component/${encodeURIComponent(tag)}`);
        const data = await res.json().catch(() => null);
        if (alive && res.ok && data) patchItem(item.id, { record: data as ComponentRecord });
      } catch {
        // A re-read that failed leaves the snapshot alone. It is not a reason to blank the pane,
        // and reporting it here would be a second, quieter readout of the same thing.
      }
    })();
    return () => {
      alive = false;
    };

  }, [open, layersKey]);

  /**
   * THE TREE IS A NAVIGATION, AND THIS IS THE WIRE. The layer view lists every component the
   * catalogue holds and raises `open-component` when a row is clicked; opening one is this
   * component's job, because the preview, the selection and the draft list all live here.
   * Bubbled and composed, so it crosses the element's shadow boundary to this wrapper.
   */
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onOpen = (event: Event) => {
      const tag = (event as CustomEvent<{ tag?: string }>).detail?.tag;
      if (!tag) return;
      // The pane shows ONE thing: a component opened here replaces a layer or a function that
      // was in it, or the two would sit on top of each other and the newest would be believed.
      setLayerView(null);
      setSourceView(null);
      void openByTag(tag);
    };
    // A FUNCTION OPENS THE CODE THAT WRITES IT. A tree row can show a component — it has a
    // name, a size and children — but a function has none of those; it lives in a file, so that
    // is what the middle pane shows. The tree sends the module it already resolved.
    const onFunction = (event: Event) => {
      const detail = (event as CustomEvent<{ tag?: string; event?: string; module?: string }>).detail ?? {};
      if (detail.tag && detail.module) {
        setLayerView(null);
        setSourceView({ tag: detail.tag, event: detail.event || "", module: detail.module });
      }
    };
    // A LAYER OPENS ITSELF. Most of a design's tree is not components — a frame, a vector, a
    // text node — and a row that did nothing when clicked answered "is it a component?" instead
    // of "what is it?". The measurement is what a layer has, so that is what is shown.
    const onLayer = (event: Event) => {
      const detail = (event as CustomEvent<LayerView>).detail;
      if (detail && detail.id) {
        setSourceView(null);
        setLayerView(detail);
      }
    };
    root.addEventListener("open-component", onOpen);
    root.addEventListener("open-function", onFunction);
    root.addEventListener("open-layer", onLayer);
    return () => {
      root.removeEventListener("open-component", onOpen);
      root.removeEventListener("open-function", onFunction);
      root.removeEventListener("open-layer", onLayer);
    };
    // IT DEPENDS ON `open`, AND THAT IS THE WHOLE BUG THIS FIXES. This component returns null
    // until it is opened, so an effect with no dependencies ran exactly once — while nothing was
    // mounted — found no root, and never attached the listener. The tree raised its event into
    // an empty room. Re-running when `open` flips means the listener goes on when the root
    // actually exists.
    //
    // openByTag is recreated per render but only closes over setters and the api client, so the
    // first one is as good as any.

  }, [open]);

  /**
   * A FUNCTION OPEN IN THE PREVIEW — the component's source, and which of its events was clicked.
   *
   * The file is FETCHED rather than imported: an import would be cached by the browser, so an
   * element edited since the page loaded would be shown as it was (the same trap the catalogue
   * and the Figma map both fell into).
   */
  const [sourceView, setSourceView] = useState<{ tag: string; event: string; module: string } | null>(null);
  const [sourceText, setSourceText] = useState<{ text: string; error: string } | null>(null);
  /** A design layer open in the preview, and which of its siblings was last asked for. */
  const [layerView, setLayerView] = useState<LayerView | null>(null);
  useEffect(() => {
    if (!sourceView) {
      setSourceText(null);
      return;
    }
    let alive = true;
    setSourceText(null);
    void (async () => {
      try {
        // IMPORTED RATHER THAN FETCHED, and the difference is not stylistic: the dev server
        // hands a `?raw` file over as a JavaScript template literal, so a fetch returns the
        // file's text wrapped in `export default \`…\`` with its backticks and dollar-braces
        // escaped — and unwrapping that by hand is a second parser for a format that is not
        // ours. Importing lets the engine do it: the default export IS the file.
        //
        // THE TIMESTAMP DEFEATS THE IMPORT CACHE, for the same reason everything else here
        // fetches fresh: an element edited since the page loaded would otherwise be shown as it
        // was, which is the bug the catalogue and the Figma map each had to have fixed.
        const mod: any = await import(
          /* @vite-ignore */ `/${sourceView.module}?raw&t=${Date.now()}`
        );
        const text = mod?.default ?? mod;
        if (alive) setSourceText({ text: String(text ?? ""), error: "" });
      } catch (e) {
        if (alive) setSourceText({ text: "", error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [sourceView]);
  const [findError, setFindError] = useState<string>("");
  const [finding, setFinding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  /**
   * THE ARMED REMOVAL BELONGS TO THE ROW IT WAS ARMED ON. `confirmRemove` is one flag for the
   * whole pane, and selecting a different row did not clear it — so arming on one component and
   * then clicking another left the second row's button reading "Confirm", and one click deleted
   * a component nobody had armed anything for. Deleting is the one act here that cannot be
   * undone from the screen, so the arming is dropped whenever the selection moves.
   */
  useEffect(() => {
    setConfirmRemove(false);
  }, [selectedId]);
  const [messages, setMessages] = useState<Array<{ role: "designer" | "grace"; text: string }>>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUrl("");
      setNotes("");
      setItems([]);
      setSelectedId(null);
      setShowDetails(false);
      setInputError("");
      setActivity([]);
      inputRef.current?.focus();
      void loadActivity();
    }
  }, [open]);

  const loadActivity = async (mode: "session" | "history" = activityMode) => {
    try {
      const query =
        mode === "session"
          ? sessionId
            ? `/api/figma/activity?limit=50&outcomes=true&sessionId=${encodeURIComponent(sessionId)}`
            : "/api/figma/activity?limit=30&outcomes=true"
          : "/api/figma/activity?limit=100";
      const res = await apiFetch(query);
      if (!res.ok) return;
      const data = await res.json();
      setActivity(data?.entries ?? []);
      setActivitySource(data?.source ?? "");
      setActivityAudit(data?.audit ?? null);
      setActivityError("");
    } catch (e) {
      // Not swallowed: if the record cannot be read, the panel says so — a history panel
      // that silently shows nothing is indistinguishable from a session that did nothing.
      setActivity([]);
      setActivityError(`The activity record could not be read: ${e instanceof Error ? e.message : e}`);
    }
  };

  /**
   * Trim the activity record older than `days`.
   *
   * DRY RUN FIRST, ALWAYS. The first call sends no `confirm`, and the server answers what it
   * WOULD delete; only a second call, made after that number is on screen, carries the
   * confirmation. Deleting a record and finding out afterwards how much went is not a thing a
   * person can undo, so the count is a gate rather than a receipt.
   */
  const purgeActivity = async (days: number, confirm: boolean) => {
    setPurgeBusy(true);
    setPurgeError("");
    try {
      const res = await apiFetch("/api/figma/activity/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, confirm }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `The purge failed (${res.status})`);
      if (!confirm) {
        setPurgeDays(days);
        setPurgeResult(
          `Trim to the last ${days} day${days === 1 ? "" : "s"} — entries older than ` +
            `${data?.cutoff ?? "the cutoff"} would be deleted from ${data?.deletes?.table ? "the table and the log file" : "the record"}. ` +
            `Components, the Figma map, the allowlist, the catalogue and the layer record are not touched.`
        );
        return;
      }
      setPurgeResult(
        `Deleted ${data?.removedFromTable ?? 0} row(s) from the table and ${data?.removedFromFile ?? 0} ` +
          `line(s) from the log file, keeping the last ${data?.days ?? days} days. ` +
          (data?.audit?.large
            ? `It is still large: ${data.audit.why}.`
            : `The record is now ${data?.audit?.fileKiB ?? "?"} KiB and ${data?.audit?.tableRows ?? "?"} rows.`)
      );
      setPurgeDays(null);
      await loadActivity();
    } catch (e) {
      setPurgeError(e instanceof Error ? e.message : "The purge failed.");
    } finally {
      setPurgeBusy(false);
    }
  };

  const isValidUrl = (u: string) => {
    try {
      const parsed = new URL(u);
      return parsed.hostname.includes("figma.com") || parsed.hostname.includes("figma.cc");
    } catch {
      return false;
    }
  };

  const isValidTag = (tag: string | undefined): tag is string => !!tag && TAG_RE.test(tag);

  /**
   * The module to render for an item, as a URL, or null when there is nothing to render.
   *
   * A CATALOGUE NAME IS NOT A FILE NAME. This built `lit/<name>.ts` and asked the tag test —
   * `f-…` — which a catalogue name fails, so most of the catalogue answered "no usable tag";
   * and for a name that got through, the flat path pointed at a file that does not exist:
   * `AgentFlow` is drawn by `lit/agent-flow.ts`, `role-tile` lives in `prompt-input/`, and
   * `Text` is drawn by the renderer itself. So the file is not guessed from the name any more
   * — `drawnBy` asks the app's own resolver (see shared/component-drawn-by.ts).
   *
   * THE MAP'S FILE STILL COMES FIRST when it records one: that is provenance written down,
   * and a recorded file beats a derived one.
   */
  const previewPath = (item: DraftItem): string | null => {
    const name = item.record?.tag ?? item.result?.tag;
    if (!name) return null;
    // WHAT THIS ITEM *IS* DECIDES WHAT IS DRAWN — never whether a record exists for its tag.
    //
    // The rule used to be `!item.record && status !== "committed"`, and that made the pane show
    // the WRONG THING for the most ordinary case there is: re-ingesting a component that is
    // already in the catalogue. The moment any write happened in the session, the re-read effect
    // attached a record to the selected item — and from then on this function took the branch
    // below and drew THE FILE ON DISK, the previously approved version, while the draft the
    // designer had just made sat in the server untouched. That is the "I'm seeing old drafts"
    // report, and it was this line: a draft is a draft because it has an unapproved result, not
    // because nothing else knows its name.
    if (item.status !== "committed" && item.status !== "removed" && item.result) {
      return TAG_RE.test(name) ? `/@figma-preview/${item.id}/${name}.ts` : null;
    }
    // Approved, or removed: what exists is the catalogue's own file, and that is what is shown.
    const mapped = item.record?.figmaMap?.file;
    if (mapped) return "/" + mapped.replace(/^frontend\//, "");
    const module = drawnBy(name, drawn).module;
    return module ? "/" + module : null;
  };

  /**
   * The record's file line, told the way the preview now tells it.
   *
   * THE RECORD ASKS THE BACKEND, and the backend infers `lit/<name>.ts` — so it answered "no
   * file" for 33 of the 39 components that DO draw. With the preview loading those very
   * components, the two lines would contradict each other on one screen, which is worse than
   * either being wrong on its own. The record's own answer is kept when it finds a file, bytes
   * and all; when it does not, the line says what draws the component instead of claiming
   * there is nothing.
   */
  const recordFileLine = (record: { tag?: string; exists?: boolean; bytes?: number }, draft = false) => {
    // THE PREVIEW IS NOT A MISSING COMPONENT. Nothing is written until the approve — that is
    // the pipeline's rule, not a failure — so a preview has no file, no registration and no map
    // entry by design. Describing it in the catalogue's language made an ordinary preview read
    // like a broken component, which is the question this line exists to stop being asked.
    if (draft)
      return { text: "preview — approving writes it into the catalogue", tone: "bg-gray-100 text-gray-600" };
    if (record.exists)
      return { text: `in the catalogue · ${record.bytes} bytes`, tone: "bg-green-100 text-green-800" };
    const drawnNow = drawnBy(record.tag ?? "", drawn);
    if (drawnNow.kind === "element")
      return {
        text: `drawn by ${String(drawnNow.module).replace(/^src\/components\//, "")}`,
        tone: "bg-green-100 text-green-800",
      };
    // THE RENDERER'S OWN COMPONENTS have no file of their own by design: a spec primitive is
    // not missing anything, so this is not a warning.
    if (drawnNow.kind === "renderer")
      return { text: "drawn by the renderer", tone: "bg-green-100 text-green-800" };
    // NOBODY COULD LOOK — never presented as "nothing draws it".
    if (drawnNow.kind === "unknown")
      return { text: "could not read what draws it", tone: "bg-amber-100 text-amber-800" };
    return { text: "nothing draws this", tone: "bg-red-100 text-red-800" };
  };


  /**
   * A submitted value is a Figma link or a component id. Ids are written by hand in every
   * shape ("F – 40001185–2176", "40001185-2176", "40001185:2176"), so they are normalised
   * to the tag the ingest creates: f-<node id with hyphens>.
   */
  const asTag = (value: string): string | null => {
    // Dash-like characters are first made into hyphens (an en dash typed between the two
    // halves of a node id is a separator, not noise), then the prefix and its spacing go.
    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/\s/g, "")
      .replace(/^f[-_]*/, "");
    if (!cleaned) return null;
    if (!/^[0-9]+[-:][0-9]+$/.test(cleaned)) return null;
    return `f-${cleaned.replace(":", "-")}`;
  };

  /**
   * Why Submit is off, in words. A disabled button that will not say what it wants is a
   * dead end: the field takes anything, and only the button knows what counts.
   */
  const submitBlocked = ""; // anything may be submitted: a link, an id, a tag, or a layer's name

  const isNodeShape = (value: string) => !!asTag(value);

  /**
   * Find nodes by the name the designer knows — a layer called "Frame 886987" is not an
   * address, so the file is searched for it and the hits are shown.
   *
   * ONLY WHAT EXISTS IS SHOWN. The endpoint answers from three places: the Figma map, the
   * ingest record, and Figma itself. The RECORD is a log of everything ever added — this
   * application's own data, written on every ingest and every removal — and a hit from it is a
   * line of history: a component that was removed months ago came back as a search result, sat
   * beside the real ones, and had to be explained away every time. So record-only hits are
   * dropped here. The list on the left is what exists, and the search must agree with it.
   *
   * FIGMA IS STILL ASKED, and it is the only thing here that needs Figma to be reachable: a
   * designer knows a layer by name, not by node id, so finding a node to INGEST means searching
   * the design file. It is the third step, tried only when the local two answered nothing, and
   * if Figma is closed that step fails on its own and the local answers still come back.
   */
  const findByName = async (query: string) => {
    const token = ++findToken.current;
    setFinding(true);
    setFindResults(null);
    setFindError("");
    try {
      const res = await apiFetch(`/api/figma/find?q=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `Search failed (${res.status})`);
      // A SLOWER SEARCH MUST NOT ANSWER A LATER ONE — nor land after a Reset, which clears the
      // list and would otherwise have it reappear a moment later by itself.
      if (token !== findToken.current) return;
      const results: FindHit[] = data?.results ?? [];
      const hits = results.filter(isCatalogueMatch);
      // ONE NODE HAS ONE COMPONENT, so a single hit is not a choice to offer — it is the answer,
      // and it is opened.
      if (hits.length === 1) {
        setFindResults(null);
        await openByTag(hits[0].component || hits[0].nodeId || "");
        return;
      }
      setFindResults(hits);
      if (hits.length === 0) {
        setFindError(
          `Nothing in the catalogue matches "${query}".` +
            (data?.raw ? ` The search answered: ${String(data.raw).slice(0, 200)}` : "")
        );
      }
    } catch (e) {
      if (token === findToken.current) setFindError(e instanceof Error ? e.message : "The search could not run.");
    } finally {
      if (token === findToken.current) setFinding(false);
    }
  };

  const openByTag = async (tag: string) => {
    const item: DraftItem = { id: `open-${tag}-${Date.now()}`, url: tag, notes: "", status: "processing", viewed: true };
    setItems((prev) => [...prev, item]);
    setSelectedId(item.id);
    setUrl("");
    setInputError("");
    try {
      // A node id is resolved as a node: where the design system already has a component for
      // it, the Figma map names that component and its tag is not f-<node id>. A tag that was
      // typed as a tag (f-…) is looked up directly.
      // A TAG, A NAME, OR A NODE ID — three kinds of input, two endpoints, and the split used to
      // be wrong for the most common one.
      //
      // `f-…` is a tag and `1234:5678` (or `1234-5678`) is a node id — both go to the node side
      // of the pipeline. Anything ELSE is a NAME the catalogue uses, and it belongs at the
      // component endpoint. This only recognised `f-…`, so every name was sent to the node
      // endpoint and came back "Not a Figma node id" — and since the tree lists catalogue NAMES,
      // every row a person clicked was that case. Opening a component from the tree could not
      // have worked.
      const raw = item.url.trim();
      const isTag = /^f-/i.test(raw);
      const looksLikeNodeId = /^\d+[:-]\d+$/.test(raw);
      const url =
        isTag || !looksLikeNodeId
          ? `/api/figma/component/${encodeURIComponent(tag)}`
          : `/api/figma/node/${encodeURIComponent(raw.replace(/-/g, ":"))}`;
      const res = await apiFetch(url);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `Could not open ${tag}`);
      patchItem(item.id, { status: "done", record: data as ComponentRecord });
    } catch (e) {
      patchItem(item.id, { status: "error", error: e instanceof Error ? e.message : `Could not open ${tag}` });
    }
  };

  // THERE IS NO CAP AND NO DRAFT COUNT ANY MORE, because there is no list for them to describe.
  // `items` still holds what has been ingested, so the preview can read it and the middle pane
  // can show it; but nothing accumulates in front of a person and nothing has to be cleared.
  // A viewed component is simply not one of them — see `viewed` on DraftItem.
  const selected = items.find((i) => i.id === selectedId) || null;

  /**
   * IS WHAT IS BEING PREVIEWED A DRAFT, OR A COMPONENT OF THE CATALOGUE?
   *
   * THE PREVIEW IS BLIND TO THE CATALOGUE WHILE IT IS A DRAFT. It does not read what the
   * catalogue says about the name, it does not ask what draws that name, and it does not load
   * the catalogue document — because the question a preview answers is "does this match my
   * Figma design", and the catalogue is not the design. The catalogue is surfaced once the
   * designer approves, which is the moment the component acquires standing (owner, 2026-09-29:
   * *"The preview should never touch or even know about the lit catalog at all or any assets
   * related to the lit catalog. It should be completely blind to the catalog. It only surfaces
   * the catalogue or explores the catalogue when the user hits approved."*).
   *
   * A DRAFT IS A DRAFT BECAUSE IT HAS AN UNAPPROVED RESULT — deliberately the same rule, and the
   * same expression, that `previewPath` resolves the module path by, so the two cannot disagree
   * about which of the two things is on screen.
   */
  const selectedIsDraft =
    !!selected && selected.status !== "committed" && selected.status !== "removed" && !!selected.result;

  const patchItem = (id: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const handleIngest = async () => {
    const typed = url.trim();
    // A NEW TASK REPLACES THE OLD ONE. Whatever is in the pane was the last thing asked for; the
    // field in front of you is the next thing, so the pane lets go of it. Every leftover goes
    // with it — a previous search's results, an open layer, an open function — or the screen
    // shows one task in the header and another in the middle, which is how a person ends up
    // asking whether the tool is telling the truth.
    setFindResults(null);
    setFindError("");
    setSourceView(null);
    setLayerView(null);
    setInputError("");
    const tag = asTag(typed);
    if (tag) {
      await openByTag(tag);
      return;
    }
    if (!isValidUrl(typed)) {
      // Not a link and not an id: the name of a layer, so the file is searched. The answer to
      // that is the LIST, not whatever component was open — so the selection is dropped and the
      // pane empties while the search runs, instead of holding the last thing in place until
      // something else happens to replace it.
      setSelectedId(null);
      await findByName(typed);
      return;
    }
    if (!isValidUrl(url)) {
      setInputError("That is neither a Figma URL nor a component id (f-1234-5678).");
      return;
    }
    const { fileKey, nodeId } = parseFigmaUrl(url);
    if (!fileKey || !nodeId) {
      setInputError("The URL needs a node — add ?node-id=… (a file link has no single component to ingest).");
      return;
    }

    const jobId = crypto.randomUUID();
    const item: DraftItem = { id: jobId, url, notes, status: "processing" };
    setItems((prev) => [...prev, item]);
    setSelectedId(jobId);
    setUrl("");
    setNotes("");
    setInputError("");
    inputRef.current?.focus(); // ready for the next paste

    try {
      const res = await apiFetch("/api/figma/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId, fileKey, nodeId, notes,
          sessionId: sessionId || "",
          sessionTitle: sessionTitle || "",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Failed to ingest");
      patchItem(jobId, { status: "done", result: data?.result ?? data });
      // The ingest measured this design and recorded its layers; read them now.
      setLayersKey((n) => n + 1);
      void loadActivity();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      patchItem(jobId, { status: "error", error: msg });
    }
  };

  const handleApprove = async (item: DraftItem) => {
    setApproving(true);
    patchItem(item.id, { commitError: undefined });
    try {
      const res = await apiFetch("/api/figma/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: item.id, overwriteTag: item.overwriteTag || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Approve failed");
      void loadActivity();
      patchItem(item.id, {
        status: "committed",
        written: data?.written ?? [],
        replaced: data?.replaced ?? {},
        registration: data?.registration ?? {},
        catalogCheck: data?.catalogCheck ?? {},
      });
      // Approving writes the component into the catalogue; read the layers back so the tree
      // shows the node it now belongs to.
      setLayersKey((n) => n + 1);
    } catch (e) {
      patchItem(item.id, { commitError: e instanceof Error ? e.message : "Approve failed" });
    } finally {
      setApproving(false);
    }
  };

  const askGrace = async () => {
    const q = question.trim();
    if (!q || !selected) return;
    const jobId = selected.record ? null : selected.id;
    setMessages((prev) => [...prev, { role: "designer", text: q }]);
    setQuestion("");
    if (!jobId) {
      setMessages((prev) => [...prev, { role: "grace", text: "That component is already in the catalogue — there is no draft to talk about. Ingest its node to build a new one, and ask me about that." }]);
      return;
    }
    setAsking(true);
    try {
      const res = await apiFetch("/api/figma/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, question: q }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "No answer");
      setMessages((prev) => [...prev, { role: "grace", text: data?.answer || "(no answer)" }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "grace", text: e instanceof Error ? e.message : "The model did not answer." }]);
    } finally {
      setAsking(false);
    }
  };

  const handleDiscard = async (item: DraftItem) => {
    // The row goes, always. A draft lives in the server's memory, so a server that cannot
    // be reached has already lost it — refusing to clear the row would hold the designer
    // hostage to a backend that is down. The server is still told, and if it cannot be
    // told, that fact is shown rather than hidden.
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (selectedId === item.id) setSelectedId(null);
    void loadActivity();
    if (item.record) return; // opened by tag: nothing was drafted
    try {
      const res = await apiFetch("/api/figma/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: item.id }),
      });
      if (!res.ok) throw new Error(`the server answered ${res.status}`);
      setDiscardNotice("");
    } catch (e) {
      setDiscardNotice(
        `A draft was cleared here but the server was not told: ${e instanceof Error ? e.message : e}. ` +
        `Nothing was written to the catalogue, so nothing is left behind.`
      );
    }
  };

  /**
   * Take the component out of the catalogue. Two clicks on purpose: the first arms it, the
   * second does it, because this changes what the AI can render and what the check counts.
   */
  const removeFromCatalogue = async (item: DraftItem) => {
    const tag = item.record?.tag ?? item.result?.tag;
    if (!tag) return;
    setRemoving(true);
    setConfirmRemove(false);
    try {
      const res = await apiFetch("/api/figma/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, reason: "removed from the tool" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `Removal failed (${res.status})`);
      patchItem(item.id, {
        status: "removed",
        removal: { tag, outcome: data?.outcome, verdict: data?.catalogCheck?.verdict },
        // THE SNAPSHOT GOES WITH IT. `record` was read when the component was opened and it
        // describes it as present — file, bytes, "in catalog". Keeping it left the pane saying
        // a removed component was in the catalogue, with its row already gone from the tree, so
        // the screen showed a component that nothing on the left admitted to. What is left is
        // the removal's own message, which is the true state.
        record: undefined,
      });
      // THE LIST HAS CHANGED, so read it again — and let the reader watch it happen. A removal
      // moves the count, and the tree would otherwise keep showing the component that was just
      // taken out, which reads as a removal that did not work.
      setLayersKey((n) => n + 1);
    } catch (e) {
      patchItem(item.id, { commitError: e instanceof Error ? e.message : "The removal failed." });
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  };

  /** Back to the opening state: nothing held, nothing selected, nothing said, and no answer left over from a search. */
  const resetAll = () => {
    const held = items.filter((i) => !i.record);
    setItems([]);
    setSelectedId(null);
    setMessages([]);
    setQuestion("");
    setShowDetails(false);
    setActivityMode("session");
    setInputError("");
    setDiscardNotice("");
    setUrl("");
    setNotes("");
    // THE LAST SEARCH IS PART OF WHAT IS ON SCREEN. It was not cleared, so a Reset left the
    // chips from the previous search sitting above an empty panel — an answer to a question
    // nobody had asked any more. The token is bumped too, so a search still in flight cannot
    // put them back a moment after the Reset.
    findToken.current += 1;
    setFinding(false);
    setFindResults(null);
    setFindError("");
    // AND SO IS A FUNCTION LEFT OPEN. The middle pane was showing that component's source and
    // went on showing it, which made the Reset look like it had done nothing — the pane is the
    // biggest thing on screen. The tree's own expansion is cleared by the `reset` counter: it
    // is state the element holds, so the host can only ask.
    setSourceView(null);
    setSourceText(null);
    setLayerView(null);
    setResetKey((n) => n + 1);
    void loadActivity();
    held.forEach((i) => {
      apiFetch("/api/figma/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: i.id }),
      }).catch(() => { /* the notice from handleDiscard covers this */ });
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleIngest();
    }
    if (e.key === "Escape") onClose();
  };

  /**
   * The preview document: the element, loaded from the temporary file this preview owns.
   *
   * THERE ARE NO FALLBACKS IN IT, AND THAT IS THE POINT. If the file is not there, if it does not
   * load, if the element draws nothing — the document SAYS SO. Nothing is substituted for it: no
   * retry that hides a slow failure, no sample content handed to an element so it draws something,
   * no blank page where the reason should be. A broken preview must look broken (owner,
   * 2026-09-29: *"I should see it broken… Is there a fallback, do we have fallbacks in place? All
   * fallbacks need to be removed related to this preview process. No fallback."*).
   */
  const previewSrcDoc = (item: DraftItem) => {
    // The path is worked out in one place, so the pane and this document can never disagree
    // about which module is being rendered — or about whether there is one.
    const modulePath = previewPath(item);
    const rawTag = item.record?.tag ?? item.result?.tag ?? "";
    // ── NO MODULE PATH IS STATED, NOT HIDDEN ────────────────────────────────
    // This returned an empty document, which is a blank pane with no reason in it — the one
    // outcome that cannot be told apart from a preview that works and draws nothing.
    if (!modulePath) {
      return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body style=\"margin:0;padding:16px;" +
        "font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#b91c1c\">" +
        "Nothing to render: this ingest produced no element to load" +
        (rawTag ? ` for ${rawTag}` : "") +
        ". There is no preview and nothing was substituted for one.</body></html>"
      );
    }
    // THE ELEMENT TAG, NOT THE NAME. A payload cannot name <AgentFlow> — the element is
    // <agent-flow> — and it is the tag this document has to instantiate and then look up
    // again, so both come from the one resolution the module path came from.
    const tag = tagFor(rawTag);
    // THE PREVIEW IS A TEMPORARY FILE IN A FOLDER OF ITS OWN, and this loads that file. The
    // backend writes it at the moment the preview comes into being (`.preview/<jobId>/<tag>.ts`,
    // outside `src/` and unrelated to the catalogue) and deletes it when the designer leaves,
    // discards, or asks for something else. So what is drawn here is exactly the file that
    // exists for this preview, and there is nothing cached anywhere else to be drawn instead.
    return (
      "<!DOCTYPE html>" +
      "<html>" +
      "<head>" +
      '<meta charset="UTF-8">' +
      // ── THE PREVIEW CANNOT REACH AN IMAGE, AND CANNOT ASK ANYTHING ANYWHERE ──
      // This is the rule made structural rather than promised. `img-src data: blob:` means an
      // image in a preview can only ever be bytes the ingest itself put in the draft: not
      // `/assets/figma-….svg`, not `src/assets/…`, not Figma's local server, not a path that
      // happens to share a name with something the repository already holds. A preview that
      // cannot load an image by path is a preview that cannot know an image by that name exists
      // anywhere — which is the whole of it (owner, 2026-09-29: *"the assets in Preview must be
      // blind to the assets, to images. If I load an image with the exact same name, it should
      // never even know that that image existed anywhere. All of that checking happens when the
      // user hits approved."*). `connect-src 'none'` is the same for everything else: the
      // document cannot fetch the catalogue, the manifest, the record or the backend.
      //
      // `script-src` keeps the origin because the component is WRITTEN IN LIT and the runtime is
      // served from the dev server — that is the framework, not the catalogue, and a preview that
      // cannot load lit draws nothing at all. Everything else is shut.
      '<meta http-equiv="Content-Security-Policy" content="' +
      "default-src 'none'; " +
      "script-src 'self' blob: 'unsafe-inline'; " +
      "style-src 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com; " +
      "img-src data: blob:; " +
      "connect-src 'none'; " +
      "frame-src 'none'; " +
      "base-uri 'none'; " +
      "form-action 'none'" +
      '">' +
      // The app loads Inter at 500-700 only; a design's measured weight can be outside
      // that (800 on the first node tested), so the preview loads the whole range and the
      // measured weight actually renders instead of being synthesised.
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">' +
      // THE CODE IS DRAWN EXACTLY AS THE INGEST WROTE IT, bare import and all. A blob module has no
      // hierarchy, so a root-relative specifier inside it cannot resolve ("Invalid relative url or
      // base scheme isn't hierarchical" — the error that named this). An import map resolves
      // against THE DOCUMENT instead, which does have an origin, so `from 'lit'` works untouched
      // and the pane renders the bytes the ingest produced rather than a rewritten copy of them.
      '<script type="importmap">' +
      JSON.stringify({ imports: { lit: new URL("/@id/lit", window.location.origin).href } }) +
      "</script>" +
      "<style>" +
      // NOT RESPONSIVE. The component is drawn at the size it was designed at — 775px wide
      // is 775px wide — and the pane scrolls when that is bigger than the space. Scaling it
      // to fit is what made it tiny and half of it disappear under the other column.
      "html, body { margin: 0; }" +
      "body { padding: 16px; background: #fafafa; font-family: Inter, system-ui, sans-serif; overflow: auto; }" +
      // THE ELEMENT'S OWN BOX, MADE VISIBLE — because an element with no content draws no
      // border, no background and nothing else, so a container being a container looks exactly
      // like a preview that failed. What you are seeing IS the element: its box, at its size,
      // drawing nothing inside. An outline says where it is (and costs no layout — outlines
      // never do), and the caption says which one it is, so the empty case and the broken case
      // can never be read as the same thing.
      "body > " + tag + " { outline: 1px dashed rgba(31,172,194,0.55); outline-offset: 4px; }" +
      "#preview-caption { font-family: ui-monospace, Menlo, monospace; font-size: 10px; color: #8a9499; margin-bottom: 8px; }" +
      "#preview-status { display: none; max-width: 520px; font-size: 13px; color: #b91c1c; font-family: ui-monospace, monospace; white-space: pre-wrap; text-align: left; }" +
      "</style>" +
      "</head>" +
      "<body>" +
      '<div id="preview-caption">' +
      "&lt;" + tag + "&gt; — the element itself, at the size the design measured. What it draws is what the design contains: nothing is passed to it and nothing is substituted for it." +
      "</div>" +
      // ── NOTHING IS HANDED TO THE ELEMENT ────────────────────────────────────
      // This used to instantiate the tag with invented props — `content="Sample content from
      // Figma"`, `label="Button Label"` and the rest — so an element that draws only when it is
      // given data would draw something. That is a fallback dressed as a preview: it shows a
      // component the design does not contain, and it hides the real finding, which is that the
      // design gave this element nothing. The element is instantiated bare.
      "<" + tag + "></" + tag + ">" +
      '<div id="preview-status"></div>' +
      '<script type="module">' +
      "const status = document.getElementById('preview-status');" +
      "const load = async () => {" +
      // ── ONE ATTEMPT, AND THE FAILURE IS DRAWN ───────────────────────────────
      // This retried five times with a growing delay, so a module that could not be loaded was
      // held off the screen for seconds and then reported — a slow failure presented as a slow
      // preview. There is no race to lose now: the file is written before the pane can ask for
      // it, so one attempt either loads it or says what went wrong.
      "  try {" +
      "    await import(" + JSON.stringify(modulePath) + " + '?t=' + Date.now());" +
      "    return;" +
      "  } catch (err) {" +
      "    status.style.display = 'block';" +
      "    status.textContent = 'Could not load ' + " + JSON.stringify(modulePath) +
      "      + ' — ' + (err && err.message ? err.message : err);" +
      "    return;" +
      "  }" +
      "};" +
      "load();" +
      "</script>" +
      "</body>" +
      "</html>"
    );
  };

  /**
   * The search hits, split by the question a person is actually asking: is it there?
   *
   * `matches` are components that exist now. `history` are lines in the ingest record — real,
   * worth showing, and NOT an answer to "does this exist", so they are never counted as
   * matches and never presented as the result of a search.
   */
  /**
   * WHAT GRACE SAYS ABOUT THE RECORD — and it must not claim a component the catalogue does not
   * have.
   *
   * It said "<tag> is in the catalogue and registered" whenever a record existed, so a component
   * that had been REMOVED was announced as present, in the same pane that said "nothing to
   * render" a few lines above it. Two readouts contradicting each other in one screen is how the
   * whole "which one is the truth" confusion started, and the record holds everything needed to
   * get it right: whether the catalogue declares it, whether the file is there, and whether a
   * removal is recorded.
   */
  const graceRecordLine = (() => {
    const r = selected?.record;
    if (!r) return "";
    if (r.registered?.catalog && r.exists) {
      return `${r.tag} is in the catalogue and registered${
        r.figmaMap?.figmaName ? ` from ${r.figmaMap.figmaName}` : ""
      }.`;
    }
    const removed = (r.history ?? []).find((h) => h.kind === "removed");
    if (removed) {
      return `${r.tag} is NOT in the catalogue — it was removed${
        removed.reason ? ` (${removed.reason})` : ""
      }.`;
    }
    return `${r.tag} is not in the catalogue${
      r.exists ? " — its file is there, but it is not registered" : ""
    }.`;
  })();

  /**
   * The function open in the preview: what the entry says about it, and where in the file the
   * event it was opened by is written. The whole file is shown below these — a function is read,
   * not glanced at — and these are the lines worth starting from.
   */
  /**
   * WHAT THE CATALOGUE SAYS THIS IS — fetched once, read per component.
   *
   * The preview shows the element, and for a container that is an empty frame: `ActionGroup`
   * renders `<slot>` and one button per item in a BOUND list, so with no payload and no data
   * there is genuinely nothing to draw. An empty pane that says nothing reads as a failure, so
   * the entry's own description sits above it — the sentence that explains the frame.
   */
  const [catalogEntry, setCatalogEntry] = useState<any | null>(null);
  useEffect(() => {
    // NOT WHILE A DRAFT IS PREVIEWED. Loading the catalogue document to explain a component that
    // is not in the catalogue yet is the preview knowing about the catalogue; the explanation is
    // for a component that IS in it, so that is the only case this reads for.
    if (!open || selectedIsDraft) {
      setCatalogEntry(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/src/components/A2UI/catalogs/prompt-composer/catalog.json", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const doc = await res.json();
        if (alive) setCatalogEntry(doc);
      } catch {
        // Not reported: this is an explanation, not a fact about the component, and the pane
        // says nothing extra rather than claiming the catalogue could not be read.
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, layersKey, selectedIsDraft]);

  const sourceContract = sourceView ? contractFor(sourceView.tag) : null;
  const sourceLines = sourceText?.text ? sourceText.text.split("\n") : [];
  const sourceMatches = sourceView?.event
    ? sourceLines.reduce<Array<{ n: number; text: string }>>((hits, line, i) => {
        if (hits.length < 12 && line.includes(sourceView.event)) hits.push({ n: i + 1, text: line.trim() });
        return hits;
      }, [])
    : [];

  /**
   * What the catalogue says about the selected component, and what draws it — FOR A COMPONENT
   * THAT IS IN THE CATALOGUE. While a draft is being previewed both are empty, on purpose: see
   * `selectedIsDraft`.
   */
  const selectedName = selected?.record?.tag ?? selected?.result?.tag ?? "";
  const selectedFacts = selectedIsDraft ? null : catalogEntryFacts(catalogEntry, selectedName);
  const selectedDrawn = selected && !selectedIsDraft ? drawnBy(selectedName, drawn) : null;

  /**
   * THE HISTORY OF WHAT IS SELECTED — for a draft as well as a component.
   *
   * A draft has no record of its own yet, but the thing it is about to become very often does:
   * re-importing a node whose component already exists, or approving a new draft under a name
   * that was approved and removed before, both land on a component with a past. That past is in
   * the record and the record is readable for it, so it is fetched and put in front of whoever
   * is about to act — which is the one moment it changes a decision.
   */
  const selectedTagForHistory = selected?.record?.tag ?? selected?.result?.tag ?? "";
  const [draftHistory, setDraftHistory] = useState<ActivityEntry[]>([]);
  useEffect(() => {
    // ── A DRAFT READS NO HISTORY ────────────────────────────────────────────
    // The record is catalogue state: whether this name is registered, which node it maps to,
    // whether it was approved and removed before. A preview reading it is a preview knowing the
    // catalogue, which is the thing this pane is not allowed to do — and the question it answers
    // ("this already exists as <tag>, replace it or use it?") is a question for the APPROVE, not
    // for the preview. Here it can only tell the preview what it is supposed to be checking
    // against the design.
    if (!open || selectedIsDraft || !selectedTagForHistory || selected?.record) {
      setDraftHistory([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await apiFetch(`/api/figma/component/${encodeURIComponent(selectedTagForHistory)}`);
          const data = await res.json().catch(() => null);
          if (alive && res.ok && data) setDraftHistory((data.history ?? []) as ActivityEntry[]);
        } catch {
          // A history that could not be read leaves the section saying so, not empty: "no events"
          // and "could not look" are the pair this whole application keeps apart.
          if (alive) setDraftHistory([]);
        }
      })();
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, selectedTagForHistory, selected?.record, layersKey, selectedIsDraft]);

  const selectedRecord = selected?.record ?? null;
  const selectedHistory: ActivityEntry[] = selected?.record?.history ?? draftHistory;

  const hasStagedPreview = items.some((i) => i.status !== "committed" && i.status !== "removed");

  /**
   * THE SCREEN SAYS WHEN IT LEAVES, AND THAT IS THE WHOLE MECHANISM ON THIS SIDE.
   *
   * There used to be a beat every thirty seconds here, keeping the cached component alive against a
   * ninety-second idle timer on the server. Both are gone (owner, 2026-09-29: *"I don't understand
   * why we've got a 90 second delay… you have created error suppression by holding it 90 seconds…
   * it doesn't feel honest to me."*). A timer that tidies up after something invisible is a second
   * path, and a second path is what makes a mechanism feel like a fallback.
   *
   * What is left is one rule: as the page goes — closing the tab, navigating away — it says so.
   * `pagehide` is the event a browser fires at that moment, and `sendBeacon` is the one request it
   * guarantees to deliver while a page unloads; a normal fetch is cancelled with the page. The
   * server drops the component after a five-second grace, which a RELOAD (which also fires
   * pagehide) cancels by simply arriving, so refreshing keeps it and closing the tab loses it.
   */
  useEffect(() => {
    if (!open || !hasStagedPreview) return;
    const leaving = () => {
      try {
        navigator.sendBeacon("/api/figma/preview/abandon");
      } catch {
        // Nothing to do and nothing to say: a page that is leaving cannot read a response. If it
        // never arrives, the entry stays until a new ingest replaces it — logged, not hidden.
      }
    };
    window.addEventListener("pagehide", leaving);
    return () => window.removeEventListener("pagehide", leaving);
  }, [open, hasStagedPreview, apiFetch]);

  /**
   * THE SAME EVENT RECORDED SEVERAL TIMES READS AS SEVERAL EVENTS.
   *
   * The record is honest — a document that was ingested, discarded, re-ingested and discarded
   * again leaves one row per act — but a run of identical rows at the same second tells a reader
   * nothing except that the panel was noisy, and noise is how a section stops being read. Rows
   * that say the same thing about the same subject at the same moment are collapsed to one, with
   * the count kept: the FACT is preserved, and the repetition is not mistaken for a history.
   */
  const collapsedHistory = selectedHistory.filter((h, i, all) => {
    const key = (x: ActivityEntry) =>
      `${x.at}|${x.kind}|${(x.tags || []).join(",")}|${x.tag || ""}|${x.error || ""}|${x.reason || ""}`;
    return i === 0 || key(h) !== key(all[i - 1]);
  });

  /**
   * A DRAFT — a node that was ingested and not yet approved.
   *
   * The distinction the record block could not make: a draft has no file, no registration and no
   * map entry BECAUSE the pipeline writes nothing until approval, not because something is
   * missing. Same chips, opposite meaning.
   */
  const isDraftItem = !!selected?.result && !selected?.record?.exists;

  /**
   * WHY THERE IS NOTHING TO DRAW — the answer when the component was REMOVED rather than never
   * built.
   *
   * A node opened from a search hit is often one that was approved and later taken out, and the
   * pane said "nothing to render" without saying which of the two it was — so an absence that
   * has a recorded reason read exactly like a failure. The record holds the removal and the
   * reason given at the time; this is the sentence that turns "nothing to render" into "you
   * removed it, on purpose".
   *
   * The recorded TIMESTAMP is deliberately not printed: those timestamps are known to be five
   * hours out and labelled Z, so showing one would show a wrong time. The reason is what is
   * trustworthy here, and it is the thing that solves the confusion.
   */
  const removedNote = (() => {
    const removed = (selected?.record?.history ?? []).find((h) => h.kind === "removed");
    if (!removed) return "";
    return ` It was removed from the catalogue${
      removed.reason ? ` — the record says: "${removed.reason}"` : " (no reason recorded)"
    }.`;
  })();

  /**
   * One hit as a tile. Drawn once and used by both lists so a record hit and a component
   * cannot come to look the same — the tile says which it is, and the list it sits in says it
   * again.
   */
  const renderFindHit = (r: FindHit) => (
    <button
      key={`${r.nodeId}-${r.name}`}
      onClick={() =>
        void openByTag(
              // A FIGMA-MAP HIT IS A COMPONENT, so it opens by its tag.
              // A RECORD HIT MAY NAME ONE THAT NO LONGER EXISTS — opening that can
              // only fail, and it failed four times in a row here. The record
              // still knows the NODE it came from, so that is what it opens; if
              // the node is gone from Figma too, the failure will at least be
              // about something that was actually asked for.
              r.foundIn === "figma-map" ? r.component || r.nodeId || "" : r.nodeId || r.component || ""
            )
      }
      className="min-w-[200px] max-w-[300px] flex-1 text-left rounded border border-gray-200 hover:border-blue-400 p-2"
    >
      <div className="text-xs text-gray-800 truncate">{r.name}</div>
      {/* WHERE IT WAS FOUND, WHICH IS NOT THE SAME AS IT EXISTING. `foundIn`
          says which of three places the match came from, and only one of them
          means the design system has a component: an entry in the Figma map.
          A hit from the ingest record is a line in a LOG — the tag beside it
          is what was written at the time, which may since have been removed.
          This line used to read "already a component: <tag>" for either one,
          so two removed components were listed as though they still existed. */}
      <div className="text-[11px] text-gray-500 font-mono truncate">
        {r.nodeId}
        {r.foundIn === "figma-map"
          ? r.component
            ? ` · a component: ${r.component}`
            : " · in the Figma map"
          : r.foundIn === "draft"
            ? ` · a draft, not approved yet${r.component ? ` (${r.component})` : ""}`
            : r.foundIn === "record"
            ? ` · in the ingest record only${r.component ? ` (written as ${r.component})` : ""}${
                r.exists ? "" : " — not in the catalogue now"
              }`
            : r.foundIn === "figma-file"
              ? " · in Figma only — not a component"
              : r.type
                ? ` · ${r.type}`
                : ""}
      </div>
    </button>
  );

  if (!open) return null;

  /*
   * THE THREE REGIONS ARE HANDED OVER, NOT WRAPPED (owner, 2026-09-30: "We're not replacing,
   * we're injecting").
   *
   * In `section` this component returns ITS THREE REGIONS AND NOTHING ELSE — a React
   * fragment, which creates no element of its own, so each region lands as a DIRECT CHILD of
   * the `<workspace-layout>` the ROOM renders. Slotting needs direct children, which is
   * exactly why the ingest must not bring a container of its own: a container inside a
   * container is the thing that made this look like a copy.
   *
   * NO PANEL, NO TITLE BAR, NO CLOSE IN A SECTION. Those are the MEDAL's chrome — the modal
   * is opened from the left menu and is unchanged, and it still wraps these same regions in
   * its own frame and its own container below.
   *
   * AND A REGION MAY BE SEATED IN A CONTAINER RATHER THAN IN A PANE (see the `seats` prop). The
   * default is no seats at all: the three regions are handed over exactly as they are, and the
   * host's `<workspace-layout>` projects each by its slot name. When the host has built an
   * element that owns the hole — the design's `design-middle-container` — it passes that element
   * as the region's seat, and React renders the region INTO it.
   */
  const seat = (name: 'left' | 'middle' | 'right', region: ReactNode): ReactNode => {
    /*
     * A HOST THAT NAMES A SEAT OWNS WHETHER THAT COLUMN IS DRAWN.
     *
     * Three cases, and the difference between the second and the third is the whole of the
     * output column's behaviour:
     *
     *   no `seats` at all          the default. The region is returned where it stands and the
     *                              host's own container projects it by its slot name.
     *   a seat is absent           this host has no container for that region, so the region is
     *                              handed over as always — unchanged behaviour for any host that
     *                              seats only some of its columns.
     *   a seat is present, NULL    THE COLUMN IS NOT DRAWN (yet). The region renders NOTHING.
     *                              This is the output column before there is anything to output:
     *                              the design's third column is collapsed until a draft exists,
     *                              and a region returned loose in the pane would open the column
     *                              it was supposed to wait for — its `slot="middle"` is on the
     *                              room container's own light DOM, which is exactly what makes
     *                              workspace-layout draw the pane.
     */
    if (!seats || !Object.prototype.hasOwnProperty.call(seats, name)) return region;
    const target = seats[name];
    if (!target) return null;
    /*
     * AND A SEAT MAY CARRY THE SHEET THE CONTENT IS STYLED BY, IN WHICH CASE THE CONTENT GOES
     * INSIDE IT RATHER THAN BESIDE IT. A container that adopts a stylesheet (the design's left
     * panel, `design-left-panel`) hosts the region in a plain div INSIDE its shadow tree, because
     * that is the only place a stylesheet it owns can reach the tool — the tool is styled with
     * Tailwind utilities, and a utility class cannot match inside a shadow tree it has no sheet in.
     * The seat says where that div is; a seat without one is a plain slot host and takes the
     * content as its light child, which is what the middle column still does.
     */
    const mount = target.shadowRoot?.querySelector<HTMLElement>('[data-ingest-mount]');
    return createPortal(region, mount ?? target);
  };

  const regions = (
    <>
        {/* LEFT RAIL — what to ingest, what is held, what it was generated from.
            IT SCALES. It carries the URL field, the drafts and the layer tree — and
            the tree is deeper and wider than anything else in this modal, so a fixed 360px was
            squeezing the column that needed the most room while the preview beside it had room
            to spare. A share of the viewport, bounded at both ends: the min stops it collapsing
            into a column the tree cannot be read in, the max stops it eating the preview on a
            very wide screen. The right column is deliberately left fixed — it is prose. */}
        {seat('left', (
        <div slot="left" className="w-full h-full border-r border-gray-100 overflow-y-auto p-4 flex flex-col gap-5">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Figma URL</label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="url"
                placeholder="https://www.figma.com/file/FILE_KEY/NAME?node-id=NODE_ID"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setInputError("");
                }}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
              <button
                onClick={handleIngest}
                disabled={!url.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Submit
              </button>
            </div>
            <input
              type="text"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            />
            {submitBlocked && <p className="text-xs text-amber-700">{submitBlocked}</p>}
            {inputError && <p className="text-xs text-red-600">{inputError}</p>}
          </div>

          {/* The facts of the selected draft */}
          {discardNotice && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 space-y-1">
              <div>{discardNotice}</div>
              <button onClick={() => setDiscardNotice("")} className="underline text-amber-800">dismiss</button>
            </div>
          )}

          {/* THE MATCHES ARE NOT SHOWN HERE ANY MORE. They belong where the thing they open
              appears — across the top of the middle column, over the preview. A list of things
              to open, sitting in the rail you are not looking at, is a list you scroll past. */}

          {/* THERE IS NO DRAFT LIST, ON PURPOSE.
              A designer is not assembling a backlog — they are looking at one thing and
              deciding about it. Ingesting puts it in the middle pane, and from there it is
              approved into the catalogue or it is not. There is no third state to come back
              to later and no cap to run into, which is what the list was: a queue of work
              waiting for a designer who had already moved on.
              The item still exists in memory while the pane is showing it, which is all the
              preview needs; nothing is "held" in any sense a person has to manage. */}

          {/* THE DESIGN'S OWN LAYERS, below the drafts and below the URL field.
              A draft above it is what the MODEL WROTE; this is what the DESIGN IS. The ingest
              has always measured the whole layer tree and then thrown it away, so a design
              could not be read back anywhere in this form — and two layers sharing a name
              could not be seen at all. The record is written by the ingest; `layersKey` is
              what makes this view re-read it after one lands, or after an approve.
              IT TAKES THE REST OF THE COLUMN. Everything above it is a fixed-height block, so
              this is what is left — filling it beats stopping at a cap and leaving dead space
              under a tree that has plenty more to show. The floor stops it vanishing on a short
              window; there the rail scrolls, as it always could. */}
          <div className="flex-1 min-h-[220px] flex">
            <figma-layers-view
              inline
              className="flex-1 min-h-0"
              node-id={selected?.result?.details?.target_node_id || undefined}
              refresh={layersKey}
              reset={resetKey}
              selected={selected?.record?.tag ?? selected?.result?.tag ?? ""}
            />
          </div>

        </div>))}

        {/* PREVIEW — the component at its own size, whole */}
        {seat('middle', (
        <div slot="middle" className="w-full h-full min-w-0 flex flex-col bg-gray-50">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white shrink-0 gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-gray-700">Preview</h3>
              {/* THE LABEL BESIDE THE ID, here as well as in the confirmation: the tag is
                  derived from the Figma node, so on its own it says which node this is without
                  saying what it is. The layer name is the only human label a component has. */}
              <div className="flex items-baseline gap-2 flex-wrap">
                {selected?.result?.details?.target_node_name && (
                  <span className="text-xs font-semibold text-gray-800">
                    {selected.result.details.target_node_name}
                  </span>
                )}
                {selected?.result?.tag && (
                  <code className="text-xs text-gray-500 font-mono">{selected.result.tag}</code>
                )}
              </div>
            </div>
            {selected && (
              <div className="flex items-center gap-2 shrink-0">
                {selected.status === "done" && (
                  <button
                    onClick={() => handleApprove(selected)}
                    disabled={approving}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
                  >
                    {approving
                      ? "Approving…"
                      : selected.result?.alreadyInCatalogue
                      ? "Approve & REPLACE the existing component"
                      : "Approve & add to catalogue"}
                  </button>
                )}
                <button
                  onClick={() => {
                    // Approved and opened-by-tag rows are in the catalogue; discarding them
                    // is not a thing this tool can do, so the button must not imply it. It
                    // closes the row. Removing a component from the catalogue is a
                    // deliberate act — file plus three registrations — not a button here.
                    if (selected.record || selected.status === "committed") {
                      setItems((prev) => prev.filter((i) => i.id !== selected.id));
                      setSelectedId(null);
                    } else {
                      void handleDiscard(selected);
                    }
                  }}
                  className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {selected.record || selected.status === "committed" ? "Close" : "Discard"}
                </button>
                {(selected.record || selected.status === "committed") && selected.status !== "removed" && (
                  <>
                    <button
                      onClick={() => (confirmRemove ? void removeFromCatalogue(selected) : setConfirmRemove(true))}
                      disabled={removing}
                      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        confirmRemove ? "bg-red-600 text-white hover:bg-red-700" : "bg-white border border-red-300 text-red-700 hover:bg-red-50"
                      }`}
                    >
                      {removing ? "Removing…" : confirmRemove ? "Confirm — remove from the catalogue" : "Remove from catalogue"}
                    </button>
                    {confirmRemove && (
                      <button
                        onClick={() => setConfirmRemove(false)}
                        className="rounded-md bg-gray-100 px-2 py-2 text-xs text-gray-600 hover:bg-gray-200"
                      >
                        cancel
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* A FAILURE THAT WAS SET AND NEVER SHOWN. `commitError` has been written by both the
              approve and the removal paths and rendered nowhere, so a failed approve — or a
              removal that could not run — retracted the button and said nothing at all. */}
          {selected?.commitError && (
            <div className="shrink-0 border-b border-red-200 bg-red-50 px-5 py-2">
              <p className="text-[11px] text-red-800">{selected.commitError}</p>
            </div>
          )}

          {/* THE QUESTION. A layer in this design carries a NAME the design system already has,
              under a DIFFERENT node id — so approving it would put a SECOND component under a
              name that already exists. That is the designer's call, not the ingest's, so it is
              asked here rather than decided quietly.
              "No" is not a refusal and is not the same as dismissing: it is the answer "add it
              as its own component", and it is what an unanswered question commits as. The last
              line always states which of the two approving will actually do, so the choice is
              never carried out silently. */}
          {/* TWO FACTS, SAID SEPARATELY, because they are different facts.
              A layer that IS a component the design system already ships, in another place, is
              the design reusing its own design system — nothing to ask and nothing to write, so
              it is stated and left alone. A layer whose name exists on a DIFFERENT component is
              the copy case, and that one is a question, because approving it would put a second
              component under a name that already exists.
              The two used to be one list, because the whole node id was compared: a second
              instance looked like a copy, and the answer the screen offered for a copy wrote one
              component's code over another component's file (2026-09-28). */}
          {selected?.status === "done" && (selected.result?.nameInstances?.length ?? 0) > 0 && (
            <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-5 py-2.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wide font-bold text-gray-600">
                  Same component, other place
                </span>
                <span className="text-xs text-gray-600">
                  {selected.result!.nameInstances!.length === 1
                    ? "one layer here is a component the design system already has"
                    : `${selected.result!.nameInstances!.length} layers here are components the design system already has`}
                </span>
              </div>
              <div className="mt-1.5 space-y-1">
                {selected.result!.nameInstances!.map((c) => (
                  <div key={`${c.existingTag}-${c.nodeId}`} className="text-xs text-gray-600">
                    <code className="font-mono font-bold">{c.name}</code>
                    {" — "}
                    <code className="font-mono">{c.existingTag}</code>
                    {", component "}
                    <code className="font-mono">{c.identity}</code>
                    {c.nodeLocation ? (
                      <>
                        {", this instance at "}
                        <code className="font-mono">{c.nodeLocation}</code>
                      </>
                    ) : null}
                    <span className="text-gray-500"> — the location is not part of the component</span>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                Nothing is written for these: the design is using a component it already ships.
              </div>
            </div>
          )}
          {selected?.status === "done" && (selected.result?.nameCollisions?.length ?? 0) > 0 && (
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wide font-bold text-amber-800">
                  Name already in the design system
                </span>
                <span className="text-xs text-amber-900">
                  {selected.result!.nameCollisions!.length === 1
                    ? "one layer here has a name that already exists on a different component"
                    : `${selected.result!.nameCollisions!.length} layers here have names that already exist on different components`}
                </span>
              </div>
              <div className="mt-1.5 space-y-1">
                {selected.result!.nameCollisions!.map((c) => (
                  <div key={c.existingTag} className="text-xs text-amber-900">
                    <code className="font-mono font-bold">{c.name}</code>
                    {" — this layer is component "}
                    <code className="font-mono">{c.nodeIdentity}</code>
                    {c.nodeLocation ? (
                      <>
                        {" at "}
                        <code className="font-mono">{c.nodeLocation}</code>
                      </>
                    ) : null}
                    {", and the design system's "}
                    <code className="font-mono">{c.existingTag}</code>
                    {" is component "}
                    <code className="font-mono">{c.existingIdentity ?? c.existingNodeId}</code>
                    {c.existingFile ? (
                      <span className="text-amber-700"> ({c.existingFile})</span>
                    ) : null}
                    <span className="text-amber-700"> — different components</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => patchItem(selected.id, { overwriteTag: undefined })}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected.overwriteTag
                      ? "bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
                      : "bg-amber-700 text-white"
                  }`}
                >
                  No — add it as a new component
                </button>
                {selected.result!.nameCollisions!.map((c) => (
                  <button
                    key={c.existingTag}
                    onClick={() => patchItem(selected.id, { overwriteTag: c.existingTag })}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected.overwriteTag === c.existingTag
                        ? "bg-amber-700 text-white"
                        : "bg-white border border-amber-300 text-amber-900 hover:bg-amber-100"
                    }`}
                  >
                    Yes — overwrite {c.existingTag}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-[11px] text-amber-800">
                {selected.overwriteTag
                  ? `Approving will write this design's component under ${selected.overwriteTag}, replacing that component.`
                  : "Approving will add a second component under this name."}
              </div>
            </div>
          )}

          {/* THE MATCHES, ACROSS THE TOP OF THE PREVIEW under its label. Horizontal, because
              they are a set of alternatives to pick from rather than a list to read down, and
              here because selecting one loads it into the pane below this row — the list and
              the thing it opens belong in the same column. */}
          {(finding || findError || (findResults?.length ?? 0) > 0) && (
            <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-2">
              {finding && <div className="text-xs text-gray-500">Searching the file…</div>}
              {findError && <div className="text-xs text-amber-700">{findError}</div>}
              {findResults && findResults.length > 0 && (
                <>
                  <div className="mb-1.5 text-xs text-gray-500">
                    {findResults.length} match{findResults.length === 1 ? "" : "es"} — open one:
                  </div>
                  <div className="flex flex-wrap gap-2">{findResults.map(renderFindHit)}</div>
                </>
              )}
            </div>
          )}

          {/* THE CONFIRMATION — what approving actually wrote, said once, in the middle.
              The left rail marks the FACT: the row says it is in the catalogue, and the tree
              marks the design it came from green. The detail belongs here, where there is room
              for it and one place to look, rather than as five lines inside a list row.
              Every line below is a value the commit returned, not a re-description of it, and a
              line with nothing to say is not drawn. */}
          {selected?.status === "committed" && (
            <div className="shrink-0 border-b border-green-200 bg-green-50 px-5 py-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wide font-bold text-green-800">
                  Added to the catalogue
                </span>
                {/* THE LABEL, not just the id. A component's tag is derived from the Figma node
                    (f-<node id>) and reads as an id because it is one; the only human name it
                    has is the Figma layer it was drawn from. Leading with the tag said what was
                    added without saying WHAT IT IS. */}
                {selected.result?.details?.target_node_name && (
                  <span className="text-sm font-semibold text-green-900">
                    {selected.result.details.target_node_name}
                  </span>
                )}
                {selected.result?.tag && (
                  <code className="text-xs font-mono text-green-900">{selected.result.tag}</code>
                )}
              </div>
              <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-green-900">
                {selected.result?.details?.target_node_name && (
                  <>
                    <span className="text-green-700">figma layer</span>
                    <span>{selected.result.details.target_node_name}</span>
                  </>
                )}
                {selected.result?.tag && (
                  <>
                    <span className="text-green-700">component</span>
                    <span className="font-mono">{selected.result.tag}</span>
                  </>
                )}
                {selected.written && selected.written.length > 0 && (
                  <>
                    <span className="text-green-700">files</span>
                    <span className="font-mono break-all">{selected.written.join(", ")}</span>
                  </>
                )}
                {selected.registration?.figmaMap && (
                  <>
                    <span className="text-green-700">figma map</span>
                    <span>{selected.registration.figmaMap}</span>
                  </>
                )}
                {selected.registration?.allowlist && (
                  <>
                    <span className="text-green-700">allowlist</span>
                    <span>{selected.registration.allowlist}</span>
                  </>
                )}
                {selected.registration?.catalog && (
                  <>
                    <span className="text-green-700">catalogue</span>
                    <span>{selected.registration.catalog}</span>
                  </>
                )}
                {selected.registration?.countClaims && (
                  <>
                    <span className="text-green-700">counts</span>
                    <span>{selected.registration.countClaims}</span>
                  </>
                )}
                {selected.registration?.layers && (
                  <>
                    <span className="text-green-700">layer record</span>
                    <span>{selected.registration.layers}</span>
                  </>
                )}
                {selected.registration?.skipped && (
                  <>
                    <span className="text-green-700">registration</span>
                    <span>{selected.registration.skipped}</span>
                  </>
                )}
              </div>
              {selected.catalogCheck?.verdict && (
                <div
                  className={`mt-1.5 text-xs ${
                    selected.catalogCheck.ok ? "text-green-800" : "text-amber-800"
                  }`}
                >
                  {selected.catalogCheck.verdict}
                </div>
              )}
            </div>
          )}

          {selected?.result?.details?.spec && (
            <SpecStrip
              spec={selected.result.details.spec}
              assembled={selected.result.assembled}
              channels={selected.result.channels}
            />
          )}

          {/* SHOW DETAILS — the accordion over an element's whole working life: what the design
              was, the code, the check, and — since 2026-09-29 — ITS HISTORY. The button appears
              whenever there is anything to put behind it, including for a component opened from
              the tree with no draft in train, because a past is worth reading before it is
              re-imported or overwritten, and that reader has no draft to look at. */}
          {selected && (selected.result || collapsedHistory.length > 0 || selectedRecord?.tag) && (
            <div className="border-b border-gray-100 bg-white shrink-0">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full text-left px-5 py-2 text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {showDetails ? "Hide Details" : "Show Details — what it was generated from, the code, and the catalog check"}
              </button>
              {showDetails && (
                <div className="px-5 pb-4 max-h-[48vh] overflow-y-auto space-y-3">
                  {selected.result && <DraftDetails item={selected} />}
                  <HistorySection
                    history={collapsedHistory}
                    record={selectedRecord}
                    tag={selectedName}
                  />
                </div>
              )}
            </div>
          )}

          {/* WHAT THIS IS, IN THE CATALOGUE'S OWN WORDS, above the frame it explains. A container
              renders an empty box — not a failure, and not the same thing as a component that
              failed to load, so the pane must not leave the two looking alike. */}
          {selected &&
            selectedFacts &&
            (selectedFacts.description ||
              selectedFacts.slots.length > 0 ||
              selectedDrawn?.kind === "renderer") && (
              <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-2 space-y-0.5">
                {selectedFacts.description && (
                  <p className="text-[11px] text-gray-600">{selectedFacts.description}</p>
                )}
                {selectedFacts.slots.length > 0 && (
                  <p className="text-[11px] text-gray-500">holds: {selectedFacts.slots.join(", ")}</p>
                )}
                {selectedDrawn?.kind === "renderer" && (
                  <p className="text-[11px] text-gray-500">
                    One of the A2UI primitives, drawn by the renderer rather than by a file. It is a
                    passive container — it draws what a payload slots into it, and one item per bound
                    list — so with no payload and no data there is nothing for it to draw.
                  </p>
                )}
              </div>
            )}

          {/* A DESIGN LAYER, OPENED FROM THE TREE — what was measured about it, which is
              everything this application knows: it is not a component and has no file. The
              catalogue's answer sits at the top, because whether the name is also a component is
              the fact most likely to be assumed and least likely to be true. */}
          {layerView && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-2 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                    {layerView.type ? `layer · ${layerView.type}` : "layer"}
                  </span>
                  <span className="text-xs font-semibold text-gray-900">{layerView.name || "(no name)"}</span>
                  <code className="text-[11px] text-gray-500 font-mono">{layerView.id}</code>
                  <button
                    onClick={() => setLayerView(null)}
                    className="ml-auto rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
                <p className="text-[11px] text-gray-600">
                  {layerView.tag
                    ? `A component of this catalogue: ${layerView.tag}.`
                    : "NOT a component of this catalogue — nothing draws it. It is a layer in the design: ingesting its node would make a component of it."}
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-auto bg-white p-4">
                {/* ── NOTHING HERE IS PULLED FROM STORAGE ────────────────────────
                    This pane used to draw the node's vendored pictures — `<img>` tags pointing
                    at `/assets/…` files written by an earlier approval, read out of the layer
                    record. That is a preview calling something from somewhere: the pictures were
                    not the design being previewed, they were whatever the repository happened to
                    be holding, and after a removal or an artwork change they were the PREVIOUS
                    version of it, drawn back onto the screen as though nothing had happened
                    (owner, 2026-09-29: *"preview should not be calling anything from anywhere, it
                    shouldn't be calling assets. It shouldn't be calling anything. It should only
                    read the file."*).

                    So this pane reads nothing. What it shows is what the ingest measured about
                    the layer — its own numbers, already in hand — and the design's artwork is
                    where it belongs, in the render, from the file. */}
                <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-[11px]">
                  {[
                    ["name", layerView.name || "(none)"],
                    ["type", layerView.type || "(none)"],
                    // THE TWO HALVES OF THE NODE, SPLIT, because reading them as one string is
                    // how a second instance came to look like a second component: everything
                    // before the semicolon is the component, everything after it is only the
                    // location this instance sits in.
                    ["node id", layerView.id || "(none)"],
                    ["component", nodeIdentity(layerView.id) || "(none)"],
                    [
                      "location",
                      nodeLocation(layerView.id) || "(not an instance — this node IS the component)",
                    ],
                    ["size", layerView.size ? `${layerView.size[0]} × ${layerView.size[1]}` : "(not measured)"],
                    ["text", layerView.text ? `"${layerView.text}"` : "(none — not a text layer)"],
                    ["fill", layerView.fill || "(none)"],
                    [
                      "instance of",
                      layerView.componentId
                        ? `${nodeIdentity(layerView.componentId)}${
                            nodeLocation(layerView.componentId)
                              ? `  (at ${nodeLocation(layerView.componentId)})`
                              : ""
                          }`
                        : "(not an instance)",
                    ],
                    [
                      "layout",
                      layerView.layout
                        ? Object.entries(layerView.layout)
                            .map(([k, v]) => `${k}=${v}`)
                            .join("  ")
                        : "(not a layout frame)",
                    ],
                    [
                      "type style",
                      layerView.typeStyle
                        ? Object.entries(layerView.typeStyle)
                            .map(([k, v]) => `${k}=${v}`)
                            .join("  ")
                        : "(none)",
                    ],
                    ["measured in", layerView.record ? `node ${layerView.record}` : "(unknown record)"],
                  ].map(([term, value]) => (
                    <div key={term} className="contents">
                      <dt className="text-gray-400 font-mono">{term}</dt>
                      <dd className="text-gray-800 font-mono break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {/* A FUNCTION, OPENED FROM THE TREE — the component's own source in the pane the
              element would have used, because that is where a function lives. Everything the
              entry declares about it is in the header: what it is for, what a payload may send
              it (the data it can be bound to), and which lines write the event that was clicked. */}
          {sourceView && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-2 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                    {sourceView.event ? `function · ${sourceView.event}` : "functions"}
                  </span>
                  <code className="text-xs font-mono text-gray-900">{sourceView.tag}</code>
                  <code className="text-[11px] text-gray-500 font-mono">{sourceView.module}</code>
                  <button
                    onClick={() => setSourceView(null)}
                    className="ml-auto rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Back to the element
                  </button>
                </div>
                {sourceContract?.description && (
                  <p className="text-[11px] text-gray-600">{sourceContract.description}</p>
                )}
                {sourceContract && (
                  <p className="text-[11px] text-gray-500">
                    {sourceContract.props.length
                      ? `accepts — what a payload may send it: ${sourceContract.props.join(", ")}`
                      : "accepts nothing: it declares no props"}
                  </p>
                )}
                {sourceView.event && (
                  <p className="text-[11px] text-gray-500">
                    {sourceMatches.length
                      ? `written on ${sourceMatches.length} line${sourceMatches.length === 1 ? "" : "s"}: ${sourceMatches
                          .map((m) => m.n)
                          .join(", ")}`
                      : `"${sourceView.event}" does not appear in the file`}
                  </p>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-auto bg-white">
                {sourceText === null ? (
                  <p className="p-4 text-xs text-gray-500">Reading {sourceView.module}…</p>
                ) : sourceText.error ? (
                  <p className="p-4 text-xs text-red-700">
                    The source could not be read: {sourceText.error}. This is not "the file is empty" —
                    nothing was fetched.
                  </p>
                ) : (
                  <>
                    {sourceMatches.length > 0 && (
                      <div className="border-b border-gray-100 bg-purple-50 px-4 py-2">
                        {sourceMatches.map((m) => (
                          <div key={m.n} className="flex gap-2 text-[11px] font-mono text-purple-900">
                            <span className="text-purple-400">{m.n}</span>
                            <span className="whitespace-pre-wrap break-all">{m.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <pre className="p-4 text-[11px] leading-relaxed font-mono text-gray-800 whitespace-pre-wrap break-words">
                      {sourceLines.map((l, i) => `${String(i + 1).padStart(5, " ")}│ ${l}`).join("\n")}
                    </pre>
                  </>
                )}
              </div>
            </div>
          )}

          <div className={`flex-1 min-h-0 p-4 ${sourceView || layerView ? "hidden" : ""}`}>
            {selected?.record && (
              <div className="m-4 mb-0 rounded-lg border border-gray-200 bg-white p-3 shrink-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono text-gray-900">{selected.record.tag}</code>
                  <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${recordFileLine(selected.record, isDraftItem).tone}`}>
                    {recordFileLine(selected.record, isDraftItem).text}
                  </span>
                  {!isDraftItem && selected.record.registered && (
                    <span className="text-[11px] text-gray-500">
                      {[
                        selected.record.registered.figmaMap && "mapped",
                        selected.record.registered.allowlist && "allowlisted",
                        selected.record.registered.catalog && "in catalog",
                      ].filter(Boolean).join(" · ") || "not registered"}
                    </span>
                  )}
                </div>
                {/* WHY THE DRAFT'S CHIPS ARE EMPTY. Its map line would read "(no map entry)" and
                    its registration "not registered" — both true, both expected, and both read as
                    a fault unless the block says which stage this is. */}
                {isDraftItem && (
                  <div className="text-[11px] text-gray-500">
                    This is the preview: nothing has been written yet — no file, no map entry, no
                    registration. Approving writes all of them, and the node's measured layers with
                    them. Discarding it removes it.
                  </div>
                )}
                <div className="text-xs text-gray-600">
                  {selected.record.figmaMap?.figmaName || "(no map entry)"}
                  {selected.record.figmaMap?.figmaNodeId ? ` · node ${selected.record.figmaMap.figmaNodeId}` : ""}
                  {selected.record.figmaMap?.status ? ` · ${selected.record.figmaMap.status}` : ""}
                </div>
                <div className="text-[11px] text-gray-500 font-mono">
                  {selected.record.firstSeen ? `first seen ${selected.record.firstSeen}` : "no record"}
                  {selected.record.approvedAt ? ` · approved ${selected.record.approvedAt}` : ""}
                </div>
                {(selected.record.history?.length ?? 0) > 0 && (
                  <details className="pt-1">
                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 underline">
                      its history ({selected.record.history!.length})
                    </summary>
                    <div className="mt-1 space-y-1">
                      {selected.record.history!.map((h, i) => (
                        <div key={i} className="text-[11px] text-gray-700">
                          <span className="font-mono text-gray-500">{h.at}</span> · {h.kind || "recorded"}
                          {h.sessionTitle ? ` · ${h.sessionTitle}` : ""}
                          {h.actor ? ` · by ${h.actor.replace("u:", "")}` : ""}
                          {h.written?.length ? ` · wrote ${h.written.join(", ")}` : ""}
                          {h.error ? <span className="text-red-700"> · {h.error}</span> : null}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {!selected && (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="text-4xl mb-2">👁️</div>
                  <p className="text-sm">
                    Paste a Figma URL to ingest a node, or a layer's name to find it — what you are
                    looking at now is nothing, and this pane says so rather than keeping the last
                    thing it held.
                  </p>
                </div>
              </div>
            )}
            {selected?.status === "processing" && (
              <div className="h-full flex items-center justify-center text-blue-600">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
                  <p className="text-sm">Generating the component…</p>
                </div>
              </div>
            )}
            {selected?.status === "error" && (
              <div className="h-full flex items-center justify-center text-red-600 p-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">⚠️</div>
                  <p className="font-medium">Ingestion failed</p>
                  <p className="text-sm mt-1">{selected.error}</p>
                </div>
              </div>
            )}
            {selected?.status === "removed" && (
              <div className="h-full flex items-center justify-center text-gray-400">
                <p className="text-sm">Removed from the catalogue — nothing to preview.</p>
              </div>
            )}

            {(selected?.status === "done" || selected?.status === "committed") &&
              previewPath(selected) && (
              <iframe
                key={`${selected.id}-${selected.result?.tag}`}
                title="Component Preview"
                className="w-full h-full border-0 bg-white rounded-lg shadow-sm"
                sandbox="allow-scripts allow-same-origin"
                srcDoc={previewSrcDoc(selected)}
              />
            )}
            {(selected?.status === "done" || selected?.status === "committed") &&
              !previewPath(selected) && (
              <div className="h-full flex items-center justify-center text-amber-600 p-4">
                <p className="text-sm text-center max-w-md">
                  Nothing to render —{" "}
                  {selectedIsDraft
                    ? "the ingest produced no element to draw, and a preview does not ask the catalogue what could draw it"
                    : `${drawnBy(selectedName, drawn).note}`}.
                  {removedNote}
                </p>
              </div>
            )}
          </div>

        </div>))}

        {/* RIGHT COLUMN — Grace. Errors, compliance and her answers live here, so the
            preview column stays what it is: the element. */}
        {seat('right', (
        <div slot="right" className="w-full h-full border-l border-gray-100 bg-white flex flex-col min-h-0">
          {/* THE PROCESSION — moved out of the left column and put ABOVE her, where it
              belongs: what was added is part of what she did. Eventually a slot in the chat
              output as part of the trace; for now a section at the top of this column. */}
          <div className="shrink-0 border-b border-gray-100">
          {/* The procession — one line per thing that happened, like a package's conversation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => { setShowActivity(!showActivity); if (!showActivity) void loadActivity(); }}
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {showActivity ? "▾" : "▸"} {activityMode === "session" ? "Added in this session" : "History"}
              </button>
              <div className="flex items-center gap-2">
                {showActivity && (
                  <button
                    onClick={() => {
                      const next = activityMode === "session" ? "history" : "session";
                      setActivityMode(next);
                      void loadActivity(next);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {activityMode === "session" ? "show all history" : "show this session"}
                  </button>
                )}
                <span className="text-xs text-gray-400">
                  {activity.length}{activitySource ? ` · ${activitySource}` : ""}
                </span>
              </div>
            </div>
            {showActivity && (
              <div className="space-y-1.5">
                {/* THE RECORD'S OWN SIZE, said plainly and only when it needs saying. This log is
                    for auditing and nothing reads it to decide anything, so it may be trimmed —
                    but never silently, and never by the application. It grows until someone is
                    told, and the trimming is that person's decision. */}
                {activityAudit?.large && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-2 space-y-1.5">
                    <div className="text-xs text-amber-900 font-medium">
                      The activity record is getting large — {activityAudit.why || "past its warning size"}.
                    </div>
                    <div className="text-[11px] text-amber-800">
                      It is an audit log: nothing in the application reads it to decide anything, so
                      old entries can be deleted without affecting a single component. It is not
                      deleted by itself — that is a decision, and this is where it is made.
                      {activityAudit.oldest ? ` Oldest entry: ${activityAudit.oldest}.` : ""}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setPurgeResult("");
                          setPurgeError("");
                          void purgeActivity(purgeDays ?? activityAudit.keepDays ?? 30, false);
                        }}
                        disabled={purgeBusy || purgeDays !== null}
                        className="rounded-md bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50 transition-colors"
                      >
                        Trim records older than {activityAudit.keepDays ?? 30} days
                      </button>
                      <span className="text-[11px] text-amber-700">
                        {activityAudit.fileKiB ?? "?"} KiB in {activityAudit.logFile} ·{" "}
                        {activityAudit.tableRows ?? "?"} rows in the table
                      </span>
                    </div>
                    {purgeResult && <div className="text-[11px] text-amber-900">{purgeResult}</div>}
                    {purgeDays !== null && (
                      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-amber-200">
                        <span className="text-[11px] font-medium text-amber-900">
                          Delete them? This cannot be undone.
                        </span>
                        <button
                          onClick={() => void purgeActivity(purgeDays, true)}
                          disabled={purgeBusy}
                          className="rounded-md bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
                        >
                          {purgeBusy ? "Deleting…" : `Yes — delete records older than ${purgeDays} days`}
                        </button>
                        <button
                          onClick={() => {
                            setPurgeDays(null);
                            setPurgeResult("Nothing was deleted.");
                          }}
                          disabled={purgeBusy}
                          className="rounded-md bg-white border border-amber-300 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                        >
                          No — keep everything
                        </button>
                      </div>
                    )}
                    {purgeError && <div className="text-[11px] text-red-800">{purgeError}</div>}
                  </div>
                )}
                {activityError && (
                  <pre className="text-xs text-red-700 font-mono whitespace-pre-wrap">{activityError}</pre>
                )}
                {!activityError && activity.length === 0 && (
                  <p className="text-xs text-gray-400">
                    Nothing added in this session yet. Approving a component adds it here and to
                    this package's history; the full record stays in backend/logs/figma-ingest.jsonl.
                  </p>
                )}
                {activity.map((a, i) => (
                  <div key={`${a.at}-${a.jobId}-${i}`} className="rounded border border-gray-200 p-2 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          a.kind === "approved"
                            ? "bg-green-500"
                            : a.kind === "discarded"
                            ? "bg-gray-400"
                            : a.kind === "removal-refused"
                            ? "bg-amber-500"
                            : a.error || (a.rejected?.length ?? 0) > 0
                            ? "bg-red-500"
                            : "bg-blue-500"
                        }`}
                      />
                      <span className="text-xs font-medium text-gray-800">{a.kind || "recorded"}</span>
                      <span className="text-[11px] text-gray-400 font-mono">
                        {(a.tags?.[0] || a.tag || a.discarded?.[0] || a.nodeName || a.nodeId || "").slice(0, 34)}
                      </span>
                      <span className="ml-auto text-[11px] text-gray-400">{a.at.slice(11, 19)}Z</span>
                    </div>
                    {a.generatedBy && a.kind === "ingested" && !a.error && (
                      <div className="text-[11px] text-gray-500">
                        built by {a.generatedBy === "assembly-model" ? "the assembly model" : "the template fallback"}
                      </div>
                    )}
                    {a.kind === "approved" && (
                      <div className="text-[11px] text-gray-700">
                        added {a.written?.join(", ") || (a.tags || []).join(", ")}
                      </div>
                    )}
                    {(a.sessionTitle || a.actor) && (
                      <div className="text-[11px] text-gray-500">
                        {a.sessionTitle ? `for ${a.sessionTitle}` : ""}
                        {a.sessionTitle && a.actor ? " · " : ""}
                        {a.actor ? `by ${a.actor.replace("u:", "")}` : ""}
                      </div>
                    )}
                    {a.error && <pre className="text-[11px] text-red-700 font-mono whitespace-pre-wrap">{a.error}</pre>}
                    {a.note && (
                      // A REFUSAL IS NOT A FAILURE, so its note is not red. `removal-refused` is
                      // the guard at work — the component is live on the front end and can only
                      // be replaced — and red would say something went wrong when nothing did.
                      <pre
                        className={`text-[11px] font-mono whitespace-pre-wrap ${
                          a.kind === "removal-refused" ? "text-amber-800" : "text-red-700"
                        }`}
                      >
                        {a.note}
                      </pre>
                    )}
                    {(a.rejected || []).map((r, j) => (
                      <pre key={j} className="text-[11px] text-red-700 font-mono whitespace-pre-wrap">{r}</pre>
                    ))}
                    {a.verdict && <div className="text-[11px] text-gray-600 font-mono">{a.verdict}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <h3 className="text-sm font-medium text-gray-700">Grace</h3>
            <p className="text-[11px] text-gray-500">
              What is wrong with this element, and what to change. Later this column is the chat itself.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {!selected && <p className="text-xs text-gray-400">Ingest or open a component and I will tell you what I made of it.</p>}

            {selected?.status === "processing" && <p className="text-xs text-blue-700">Building it…</p>}

            {selected?.record && (
              <div className="text-sm text-gray-800">
                <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-2">Grace</span>
                <div className="whitespace-pre-wrap">
                  {graceRecordLine}
                  {selected.record.history?.length ? ` I have ${selected.record.history.length} recorded events for it.` : ""}
                </div>
              </div>
            )}

            {/* confirmations — what the server said it did, not what we assume it did */}
            {selected?.status === "done" && !selected.record && selected.result?.assembled?.generatedBy === "assembly-model" && (
              <div className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-900">
                <span className="text-[10px] uppercase tracking-wide text-green-700 mr-2">Grace · built</span>
                <span className="whitespace-pre-wrap">
                  I built {selected.result.tag} from Figma node {selected.result.details?.target_node_id} (
                  {selected.result.details?.target_node_name}
                  {selected.result.details?.spec?.size ? `, ${selected.result.details.spec.size[0]}×${selected.result.details.spec.size[1]}` : ""}
                  ), reading both channels
                  {selected.result.channels?.assets ? ` — ${selected.result.channels.assets} vector asset(s) included` : ""}
                  . It compiles. Nothing is in the catalogue yet: approving writes it.
                </span>
              </div>
            )}
            {selected?.status === "committed" && (
              <div className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-900 space-y-1">
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-green-700 mr-2">Grace · added</span>
                  <span className="whitespace-pre-wrap">
                    {selected.result?.tag ?? selected.record?.tag ?? "The component"} is in the catalogue
                    {selected.written?.length ? ` as ${selected.written.join(", ")}` : ""}
                    {selected.replaced && Object.keys(selected.replaced).length
                      ? ", replacing the previous source (" +
                        Object.entries(selected.replaced)
                          .map(([t, r]) => `${t}: ${r.previousBytes} → ${r.nowBytes} bytes`)
                          .join(", ") +
                        ")"
                      : ""}
                    .
                  </span>
                </div>
                {selected.registration && (
                  <div className="text-[11px] text-green-800">
                    registered — {Object.entries(selected.registration).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </div>
                )}
                {selected.catalogCheck?.verdict && (
                  <div className="text-[11px] text-green-800">
                    the check now reads: {selected.catalogCheck.verdict}
                  </div>
                )}
                <div className="text-[11px] text-green-800">
                  It can be composed into a surface by its tag, and I have its dates and history if you open it by tag.
                </div>
              </div>
            )}

            {selected?.removal && (
              <div className="rounded border-2 border-red-200 bg-red-50 p-2 text-sm text-red-900 space-y-1">
                <div className="font-semibold">
                  {selected.removal.tag} is out of the catalogue.
                </div>
                <div>
                  The file and its registrations are gone. The record keeps who removed it and when, and
                  re-ingesting its node rebuilds it.
                </div>
                {selected.removal.outcome && (
                  <div className="text-[11px] text-red-800">
                    {Object.entries(selected.removal.outcome).filter(([k]) => k !== "error").map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </div>
                )}
                {selected.removal.verdict && (
                  <div className="text-[11px] text-red-800">the check now reads: {selected.removal.verdict}</div>
                )}
              </div>
            )}

            {/* her findings, straight from the ingest */}
            {selected?.error && (
              <div className="text-sm text-red-800">
                <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-2">Grace</span>
                <span className="whitespace-pre-wrap">I could not ingest it: {selected.error}</span>
              </div>
            )}
            {selected?.result?.assembled?.call && (
              <div className="rounded border border-gray-200 bg-gray-50 p-2 text-[11px] text-gray-600 font-mono space-y-0.5">
                <div>model {selected.result.assembled.call.model} · mode {selected.result.assembled.call.mode}</div>
                <div>
                  {selected.result.assembled.call.seconds}s · prompt {selected.result.assembled.call.promptChars} chars
                  {selected.result.assembled.call.specChars ? ` (${selected.result.assembled.call.specChars} measured design)` : ""}
                  {selected.result.assembled.call.replyChars !== undefined ? ` · reply ${selected.result.assembled.call.replyChars} chars` : ""}
                </div>
              </div>
            )}
            {selected?.result?.assembled?.generatedBy === "template" && (
              <div className="text-sm text-red-800">
                <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-2">Grace</span>
                <span className="whitespace-pre-wrap">
                  I did not build this one — what you are looking at is the template fallback, not my work.
                </span>
              </div>
            )}
            {[selected?.result?.assembled?.error, selected?.result?.assembled?.note, ...(selected?.result?.assembled?.rejected || [])]
              .filter(Boolean)
              .map((text, i) => (
                <div key={`r${i}`} className="text-sm text-red-800">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-2">Grace</span>
                  <pre className="whitespace-pre-wrap font-sans">{text}</pre>
                </div>
              ))}
            {(selected?.result?.assembled?.compliance || []).map((c, i) => (
              <div key={`c${i}`} className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
                <span className="text-[10px] uppercase tracking-wide text-amber-700 mr-2">Grace · compliance</span>
                <span className="whitespace-pre-wrap">{c}</span>
              </div>
            ))}
            {/* THE VECTOR CHECK — run after the component was built, so the icons are verified
                against the design rather than assumed. It sits with the compliance warnings
                because it is the same kind of fact, and it is its own labelled block because a
                wrong icon is fixed in a different place from a missing border-radius. */}
            {(selected?.result?.vectorFindings || []).map((v, i) => {
              const clean = /copied from the design exactly|could not be verified/.test(v);
              return (
                <div
                  key={`v${i}`}
                  className={`rounded border p-2 text-sm ${
                    clean
                      ? "border-gray-200 bg-gray-50 text-gray-700"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 mr-2">
                    Grace · vectors
                  </span>
                  <span className="whitespace-pre-wrap">{v}</span>
                </div>
              );
            })}
            {selected?.result?.assembled?.rawReply && (
              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer underline">my reply to the ingest, verbatim ({selected.result.assembled.rawReply.length} chars)</summary>
                <pre className="mt-1 text-[11px] leading-snug bg-gray-50 p-2 rounded overflow-x-auto max-h-56 font-mono whitespace-pre-wrap">
                  {selected.result.assembled.rawReply}
                </pre>
              </details>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "grace" ? "text-sm text-gray-800" : "text-sm text-blue-800"}>
                <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-2">
                  {m.role === "grace" ? "Grace" : "you"}
                </span>
                <span className="whitespace-pre-wrap">{m.text}</span>
              </div>
            ))}
          </div>

          {selected && !selected.record && selected.status !== "processing" && (
            <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-2 shrink-0">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void askGrace(); } }}
                placeholder="Ask me about it…"
                className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => void askGrace()}
                disabled={asking || !question.trim()}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {asking ? "…" : "Ask"}
              </button>
            </div>
          )}
        </div>))}

        {/* END COLUMNS */}
    </>
  );

  if (variant === 'section') return regions;

  return (
    <div
      ref={rootRef}
      className={
        // A SECTION BRINGS NO PANEL AND NO GROUND. The container the section renders IS the
        // THE ROOT IS THE MODAL'S ALONE. A section returned above — its three regions, handed
        // straight to the room's container — so everything from here down is the modal: the
        // white full-height panel, the "Ingest Figma Design" bar, and its own container holding
        // those same regions. The section branch that used to be in this expression is gone with
        // the section's return, which is why the comparison it made is gone too.
        'fixed inset-0 z-50 flex flex-col bg-white'
      }
      onKeyDown={handleKeyDown}
    >
      {/* THE TITLE BAR IS THE MODAL'S OWN — "Ingest Figma Design" and this row are the
          overlay's chrome, and a section's columns are the design's columns, so a section
          brings no title bar with it. The rail keeps its own Reset because Reset is the
          rail's control, not the frame's; Close is already modal-only below. */}
      {variant === 'modal' && (
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">Ingest Figma Design</h2>
          <p className="text-xs text-gray-500">
            {sessionTitle ? <span className="text-gray-700">{sessionTitle} · </span> : null}
            ingest a node, see what it built, then approve it into the catalogue or leave it
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
          {/* NO CLOSE IN A SECTION. There is nothing to close: the section IS the tab's content,
              so leaving the tab is how you leave it. Drawn only for the modal, which is the
              left menu's own door and still dismisses. */}
          {variant === 'modal' && (
            <button
              onClick={onClose}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
      )}

      {/*
        * THE THREE COLUMNS ARE THE COMPOSER'S OWN ELEMENT — the same tag, not a copy of it.
        *
        * The owner, 2026-09-30: *"capture the same three columns that we already have for
        * composer and seat our sections for the ingest process in the same architecture as the
        * composer… the container, the behavior of the movement, the flex columns, the
        * drag-to-resize — all of that is the same."* And then, on how: *"You're gonna have to use
        * the same lit components in the same behavior inside of design… I want to just reuse the
        * lit components for the composer. I will just replace what they hold."*
        *
        * So one element serves this section and the Composer, and the difference between them is
        * WHAT IS IN THE SLOTS — which is the part he will replace. The flex shares, the grippers,
        * the drag-to-resize, the collapse floors and the 3rd-column flip are shared by
        * construction rather than by two files agreeing.
        *
        * The three parts are the ones the ingest already had: the rail, the preview, Grace.
        */}
      <workspace-layout className="flex-1 min-h-0">{regions}</workspace-layout>
    </div>
  );
}

/** A failure shown in full — the model's error, each rejection, and its own reply. */
function AssemblyFailure({ assembled }: { assembled?: AssembledResult }) {
  const nothingWrong =
    !assembled || (assembled.generatedBy === "assembly-model" && !assembled.error && !(assembled.rejected?.length ?? 0));
  if (nothingWrong) return null;
  const rejected = assembled?.rejected ?? [];
  return (
    <div className="m-4 mb-0 rounded-lg border-2 border-red-300 bg-red-50 p-3 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚠️</span>
        <span className="text-sm font-semibold text-red-800">
          {assembled?.error
            ? "The assembly model did not build this component"
            : "Part of the assembly model's work was refused"}
        </span>
        {assembled?.generatedBy !== "assembly-model" && (
          <span className="text-xs bg-red-200 text-red-900 px-1.5 py-0.5 rounded">
            the preview below is the template fallback, not the model's work
          </span>
        )}
      </div>
      {assembled?.error && (
        <pre className="mt-2 text-xs text-red-900 font-mono whitespace-pre-wrap break-words">{assembled.error}</pre>
      )}
      {assembled?.note && (
        <pre className="mt-2 text-xs text-red-900 font-mono whitespace-pre-wrap break-words">{assembled.note}</pre>
      )}
      {rejected.length > 0 && (
        <div className="mt-2 space-y-1">
          {rejected.map((r, i) => (
            <pre key={i} className="text-xs text-red-900 font-mono whitespace-pre-wrap break-words">{r}</pre>
          ))}
        </div>
      )}
      {assembled?.rawReply && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-red-800 underline">
            the model's reply, verbatim ({assembled.rawReply.length} chars)
          </summary>
          <pre className="mt-1 text-[11px] leading-snug bg-white p-2 rounded overflow-x-auto max-h-64 font-mono whitespace-pre-wrap">
            {assembled.rawReply}
          </pre>
        </details>
      )}
    </div>
  );
}

/** The facts the component was built from — name, id, size, colour, radius, type. */
function SpecStrip({ spec, assembled, channels }: { spec: NodeSpec; assembled?: AssembledResult; channels?: Channels }) {
  const facts: Array<{ label: string; value: string; swatch?: string }> = [];
  if (spec.name) facts.push({ label: "layer", value: spec.name });
  if (spec.id) facts.push({ label: "node", value: spec.id });
  if (spec.type) facts.push({ label: "type", value: spec.type });
  if (spec.size) facts.push({ label: "size", value: `${spec.size[0]} × ${spec.size[1]}` });
  if (spec.fill) facts.push({ label: "fill", value: spec.fill, swatch: spec.fill });
  if (spec.stroke?.color) facts.push({ label: "stroke", value: `${spec.stroke.weight ?? 1}px ${spec.stroke.color}`, swatch: spec.stroke.color });
  if (spec.radius !== undefined) facts.push({ label: "radius", value: `${spec.radius}px` });
  if (spec.type_style?.fontSize) facts.push({ label: "type", value: `${spec.type_style.fontSize}px ${spec.type_style.fontWeight ?? ""}`.trim() });
  if (spec.layout?.layoutMode) facts.push({ label: "layout", value: String(spec.layout.layoutMode) });
  if (spec.text) facts.push({ label: "text", value: spec.text.length > 60 ? `${spec.text.slice(0, 60)}…` : spec.text });
  if (spec.effects?.length) facts.push({ label: "effects", value: spec.effects.join("; ") });

  return (
    <div className="px-5 py-2 border-b border-gray-100 bg-white shrink-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {facts.map((f) => (
          <span key={f.label} className="inline-flex items-center gap-1.5 text-gray-600">
            <span className="text-gray-400">{f.label}</span>
            {f.swatch && (
              <span
                className="inline-block w-3 h-3 rounded-sm border border-gray-300"
                style={{ background: f.swatch }}
              />
            )}
            <span className="font-mono text-gray-800 truncate max-w-[240px]">{f.value}</span>
          </span>
        ))}
        {channels && (
          <span className="inline-flex items-center gap-1.5 text-gray-600">
            <span className="text-gray-400">channels</span>
            <span
              className={`px-1.5 py-0.5 rounded ${
                channels.rest === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              REST {channels.rest === "success" ? "✓" : "✗"}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded ${
                channels.mcp === "success" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              MCP {channels.mcp === "success" ? "✓" : "—"}
            </span>
            {channels.mcp === "success" && (
              <span className="text-gray-500">
                {channels.annotations ?? 0} annotations · {channels.descriptions ?? 0} descriptions
              </span>
            )}
          </span>
        )}
        {assembled?.generatedBy && (
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded ${
                assembled.generatedBy === "assembly-model"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-200 text-red-900"
              }`}
            >
              {assembled.generatedBy === "assembly-model"
                ? `assembled by ${assembled.model ?? "the model"}`
                : assembled.generatedBy === "renderer"
                ? "rendered from the measurements"
                : "TEMPLATE FALLBACK — nothing else could build it"}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Everything the selected draft was generated from, plus the code itself. */
function DraftDetails({ item }: { item: DraftItem }) {
  const result = item.result;
  if (!result) return null;
  const drafts = Object.entries(result.drafts || {});
  const validation = result.validation || {};
  const broken = drafts.filter(([tag]) => validation[tag] && !validation[tag].ok);
  // The annotations REST carried, by the layer they are written on — see the Annotations
  // subsection below for why both channels have to be read.
  const restAnnotations = restAnnotationsOf(result.rest_response?.nodes);

  return (
    <div className="space-y-3">
      {broken.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
          <p className="font-medium">Generated code does not compile — approval will be refused:</p>
          {broken.map(([tag]) => (
            <pre key={tag} className="whitespace-pre-wrap font-mono">{tag}: {validation[tag].error}</pre>
          ))}
        </div>
      )}

      {result.details && (
        <DetailsSection title="Target Node" icon="🎯">
          <div className="space-y-1 text-xs text-gray-700">
            <div>{result.details.target_node_name} ({result.details.target_node_type})</div>
            <div className="font-mono text-gray-500">{result.details.target_node_id}</div>
            {result.details.components_found && result.details.components_found.length > 0 && (
              <div className="font-mono text-gray-500">components: {result.details.components_found.join(", ")}</div>
            )}
          </div>
        </DetailsSection>
      )}

      {item.catalogCheck?.verdict && (
        <DetailsSection title="Catalog Check" icon="🧾">
          <div className="space-y-2">
            <div className={`text-xs font-mono ${item.catalogCheck.ok ? "text-green-700" : "text-amber-700"}`}>
              {item.catalogCheck.verdict}
            </div>
            {(item.catalogCheck.findings?.length ?? 0) > 0 ? (
              <div className="space-y-1">
                {(item.catalogCheck.findings || []).map((f, i) => (
                  <pre
                    key={i}
                    className={`text-[11px] leading-snug p-2 rounded font-mono whitespace-pre-wrap ${
                      f.includes("[blocking]") ? "bg-red-50 text-red-800" : "bg-gray-50 text-gray-700"
                    }`}
                  >
                    {f}
                  </pre>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">The check listed no findings.</p>
            )}
            <p className="text-[11px] text-gray-500">
              Every finding here is the repository's own list: what the catalog declares versus what the
              elements and the app actually do. The count above is what the catalog holds, including the
              component just approved.
            </p>
          </div>
        </DetailsSection>
      )}

      {drafts.length > 0 && (
        <DetailsSection title="Generated Code (drafts)" icon="🧩">
          <div className="space-y-2">
            {drafts.map(([tag, code]) => (
              <details key={tag} className="border border-gray-200 rounded">
                <summary className="cursor-pointer px-2 py-1 text-xs font-mono text-gray-700">
                  {tag}.ts
                  {validation[tag] && !validation[tag].ok && <span className="text-red-600"> — does not compile</span>}
                </summary>
                <pre className="text-[11px] leading-snug bg-gray-50 p-2 rounded overflow-x-auto max-h-64 font-mono whitespace-pre-wrap">
                  {code}
                </pre>
              </details>
            ))}
          </div>
        </DetailsSection>
      )}

      {result.assembled?.surface && (
        <DetailsSection title="Assembled Surface" icon="🧠">
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              What {result.assembled.model ?? "the assembly model"} would present for this design —
              the surface the component is meant to be composed into.
            </p>
            {(result.assembled.rejected?.length ?? 0) > 0 && (
              <div className="text-xs text-amber-700 space-y-0.5">
                {result.assembled.rejected.map((r, i) => (
                  <div key={i}>Refused: {r}</div>
                ))}
              </div>
            )}
            {result.assembled.note && <div className="text-xs text-amber-700">{result.assembled.note}</div>}
            <pre className="text-[11px] leading-snug bg-gray-50 p-2 rounded overflow-x-auto max-h-64 font-mono whitespace-pre-wrap">
              {JSON.stringify(result.assembled.surface, null, 2)}
            </pre>
          </div>
        </DetailsSection>
      )}

      {result.mcp_parsed && (
        <DetailsSection title="MCP Data Captured" icon="🔍">
          {/* ── ANNOTATIONS, FROM BOTH CHANNELS ─────────────────────────────
              A designer's annotation comes back on the REST nodes — it is written on the layer —
              and MCP can carry it too. This section read only the MCP copy, so an annotation that
              arrived through REST (which is the usual case: `annotationsBy {rest: 1, mcp: 0}`)
              was counted and then shown nowhere, which is indistinguishable from not reading it
              at all (owner, 2026-09-29: *"I wrote an annotation in there to test it and I wanted
              to see if it came back — you're not showing me the annotation"*). */}
          <DetailSubsection
            title="Annotations"
            count={
              restAnnotations.length +
              Object.keys(result.mcp_parsed?.annotations || {}).length
            }
          >
            {restAnnotations.map(({ nodeId, labels }) => (
              <DetailNodeBlock key={`rest-${nodeId}`} nodeId={`${nodeId}  ·  REST`}>
                {labels.map((label, i) => (
                  <div key={i} className="text-xs text-amber-800 bg-amber-50 p-2 rounded font-mono whitespace-pre-wrap">
                    {label}
                  </div>
                ))}
              </DetailNodeBlock>
            ))}
            {Object.entries(result.mcp_parsed?.annotations || {}).map(([nodeId, anns]: [string, any]) => (
              <DetailNodeBlock key={`mcp-${nodeId}`} nodeId={`${nodeId}  ·  MCP`}>
                {(anns as string[]).map((ann, i) => (
                  <div key={i} className="text-xs text-amber-800 bg-amber-50 p-2 rounded font-mono whitespace-pre-wrap">
                    {ann}
                  </div>
                ))}
              </DetailNodeBlock>
            ))}
            {restAnnotations.length === 0 &&
              Object.keys(result.mcp_parsed?.annotations || {}).length === 0 && (
                <p className="text-xs text-gray-500 italic">
                  No annotations on any layer of this design, on either channel.
                </p>
              )}
          </DetailSubsection>

          {/* WHAT THE DESIGNER WROTE ABOUT THE COMPONENTS THIS DESIGN USES. The description is
              written on the component, not on the layer, so it is read from the file's component
              list — and the text is shown, because a count does not answer "did you see what I
              wrote?" */}
          {result.channels?.componentDescriptions &&
            Object.keys(result.channels.componentDescriptions).length > 0 && (
              <DetailSubsection
                title="Component descriptions"
                count={Object.keys(result.channels.componentDescriptions).length}
              >
                {Object.entries(result.channels.componentDescriptions).map(([nodeId, text]: [string, any]) => (
                  <DetailNodeBlock key={`desc-${nodeId}`} nodeId={nodeId}>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{text}</div>
                  </DetailNodeBlock>
                ))}
              </DetailSubsection>
            )}

          {result.mcp_parsed.descriptions && Object.keys(result.mcp_parsed.descriptions).length > 0 && (
            <DetailSubsection title="Descriptions" count={Object.keys(result.mcp_parsed.descriptions).length}>
              {Object.entries(result.mcp_parsed.descriptions).map(([nodeId, desc]) => (
                <DetailNodeBlock key={nodeId} nodeId={nodeId}>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{desc}</div>
                </DetailNodeBlock>
              ))}
            </DetailSubsection>
          )}
          {result.mcp_parsed.reference_code && Object.keys(result.mcp_parsed.reference_code).length > 0 && (
            <DetailSubsection title="Reference Code" count={Object.keys(result.mcp_parsed.reference_code).length}>
              {Object.entries(result.mcp_parsed.reference_code).map(([nodeId, code]) => (
                <DetailNodeBlock key={nodeId} nodeId={nodeId}>
                  <pre className="text-xs text-gray-700 bg-gray-50 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap max-h-48">
                    {code}
                  </pre>
                </DetailNodeBlock>
              ))}
            </DetailSubsection>
          )}
          {Object.keys(result.mcp_parsed).length === 0 && (
            <p className="text-sm text-gray-500 italic">No MCP data captured (Figma Desktop not running or file not loaded)</p>
          )}
        </DetailsSection>
      )}

      {result.rest_response && (
        <DetailsSection title="Figma REST API Response" icon="🌐">
          <DetailSubsection title="Nodes Returned" count={Object.keys(result.rest_response.nodes || {}).length}>
            {Object.entries(result.rest_response.nodes || {}).map(([nodeId, nodeData]: [string, any]) => (
              <DetailNodeBlock key={nodeId} nodeId={nodeId}>
                {nodeData?.document ? (
                  <RestLayerTree node={nodeData.document} />
                ) : (
                  <pre className="text-xs text-gray-700 bg-gray-50 p-2 rounded overflow-x-auto font-mono max-h-64">
                    {JSON.stringify(nodeData, null, 2)}
                  </pre>
                )}
              </DetailNodeBlock>
            ))}
          </DetailSubsection>
          {/* THE SIZE THE GATE MEASURED, and whether the renderer placed every key of it. A
              refusal is drawn in the pane; these are the numbers behind it. */}
          {(result as any).details?.spec && (
            <DetailSubsection title="Measured design (the renderer's input)" count={1}>
              <div className="text-[11px] text-gray-600 font-mono">
                root {String((result as any).details.spec.name ?? "")} · {(result as any).details.spec.size?.join(" × ")}
              </div>
            </DetailSubsection>
          )}
        </DetailsSection>
      )}
    </div>
  );
}

// Helper Components
function DetailsSection({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <details className="group border border-gray-200 rounded-lg bg-white">
      <summary className="flex items-center gap-2 p-3 cursor-pointer list-none">
        <span className="text-lg">{icon}</span>
        <span className="font-medium text-gray-900 text-sm">{title}</span>
        <span className="ml-auto text-xs text-gray-400 group-open:rotate-90 transition-transform">▶</span>
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

/**
 * "Its history" — one of the Show Details accordions, beside the target node, the code and the
 * check.
 *
 * The record has held this all along and it was only ever read as a debug tail after the fact.
 * It belongs behind the same one click as everything else about the element, because that is
 * where a reader goes before acting on it: re-importing the node, overwriting the component,
 * approving a new draft under a name that has a past. A decision made without the history is a
 * decision made twice, and the second one is the one that overwrites the first.
 *
 * The timestamps are printed exactly as recorded. They carry the timezone they were written in
 * and the suffixes records have gathered over months, and normalising them here to look tidier
 * would be this screen inventing a fact the record did not state.
 */
function HistorySection({
  history,
  record,
  tag,
}: {
  history: ActivityEntry[];
  record: ComponentRecord | null;
  tag: string;
}) {
  if (history.length === 0 && !record?.tag && !tag) return null;
  const shown = history.slice(0, 40);
  return (
    <DetailsSection title="Its history" icon="🕘">
      <div className="space-y-2">
        <div className="text-[11px] text-gray-500">
          {record?.tag
            ? `${record.tag} — every recorded event, newest first`
            : `${tag || "this node"} — every recorded event, newest first`}
        </div>

        {(record?.tag || tag) && (
          <div className="text-[11px] text-gray-500">
            {record ? (
              <>
                {record.exists
                  ? `file ${record.file} (${record.bytes} bytes)`
                  : `no file on disk (${record.file})`}
                {": "}
                {record.registered?.figmaMap ? "in the Figma map" : "not in the Figma map"}
                {", "}
                {record.registered?.allowlist ? "in the allowlist" : "not in the allowlist"}
                {", "}
                {record.registered?.catalog ? "declared in the catalogue" : "not declared in the catalogue"}
              </>
            ) : (
              "Not in the catalogue yet — approving is what writes it, and the events below are this node's past."
            )}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="text-xs text-gray-500">
            No events recorded for this yet. The record begins the moment an ingest reads it.
          </p>
        ) : (
          <ul className="space-y-1">
            {shown.map((h, i) => {
              const subject = h.tag || (h.tags || []).join(", ") || h.nodeName || h.nodeId || "";
              return (
                <li
                  key={`${h.at}-${h.kind}-${subject}-${i}`}
                  className="text-[11px] text-gray-700 flex flex-col gap-0.5 border-l-2 border-gray-200 pl-2"
                >
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-500">{h.at || "(no time recorded)"}</span>
                    <span className="font-medium text-gray-900">{h.kind || "recorded"}</span>
                    {subject ? <span className="font-mono text-gray-600">{subject}</span> : null}
                  </span>
                  <span className="flex items-center gap-2 flex-wrap text-gray-500">
                    {h.actor ? (
                      <span title={h.actor}>
                        by {h.actor.length > 12 ? `${h.actor.slice(0, 8)}…` : h.actor}
                      </span>
                    ) : null}
                    {h.sessionTitle ? <span>· in {h.sessionTitle}</span> : null}
                    {h.generatedBy ? <span>· built by {h.generatedBy}</span> : null}
                  </span>
                  {h.reason ? <span className="text-gray-600">— {h.reason}</span> : null}
                  {h.note ? <span className="text-gray-600">— {h.note}</span> : null}
                  {h.error ? <span className="text-red-700">— {h.error}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
        {history.length > shown.length && (
          <p className="text-[11px] text-gray-400">
            …and {history.length - shown.length} more, in the full record
            (backend/logs/figma-ingest.jsonl and the activity table).
          </p>
        )}
      </div>
    </DetailsSection>
  );
}

function DetailSubsection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-1">
        <span>{title}</span>
        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{count}</span>
      </div>
      <div className="ml-4 space-y-2">{children}</div>
    </div>
  );
}

function DetailNodeBlock({ nodeId, children }: { nodeId: string; children: ReactNode }) {
  return (
    <div className="border-l-2 border-gray-200 pl-3">
      <div className="text-xs font-mono text-gray-500 mb-1">Node: {nodeId}</div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Every annotation the REST response carried, by the layer it is written on.
 *
 * Annotations are attached to layers, and a layer can be anywhere in the tree — so this walks
 * whatever shape came back rather than assuming `nodes.<id>.document.annotations`, which is one
 * of several places they arrive.
 */
function restAnnotationsOf(nodes: any): Array<{ nodeId: string; labels: string[] }> {
  const out: Array<{ nodeId: string; labels: string[] }> = [];
  const walk = (n: any): void => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (Array.isArray(n.annotations) && n.annotations.length > 0) {
      const labels = n.annotations
        .map((a: any) => String(a?.labelMarkdown ?? a?.label ?? "").trim())
        .filter(Boolean);
      if (labels.length) out.push({ nodeId: String(n.id ?? n.name ?? "(unknown)"), labels });
    }
    Object.values(n).forEach(walk);
  };
  walk(nodes);
  return out;
}

/** Figma RGBA (0–1 floats) as hex, so a colour can be read rather than decoded. */function paintColor(c: { r?: number; g?: number; b?: number; a?: number } | undefined): string {
  if (!c) return "(none)";
  const h = (v: number) => Math.round((v ?? 0) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${h(c.r)}${h(c.g)}${h(c.b)}${(c.a ?? 1) !== 1 ? ` @${c.a}` : ""}`;
}

/**
 * EVERY LAYER OF THE DESIGN, WITH THE VALUES THAT WERE PULLED.
 *
 * This used to print each child as `{id, name, type}` — the three things that say nothing about
 * what the design looks like. The sizes, colours, padding, radii and annotations were all in the
 * response and none of them reached the screen, so the panel that exists to SHOW what was read
 * showed only that something had been read. An annotation written to test this came back through
 * REST and appeared nowhere (owner, 2026-09-29: *"I wrote an annotation in there to test it and I
 * wanted to see if it came back — you're not showing me the annotation"*).
 */
function RestLayerTree({ node, depth = 0 }: { node: any; depth?: number }) {
  if (!node) return null;
  const bb = node.absoluteBoundingBox || {};
  const fills = (node.fills || []).filter((f: any) => f.visible !== false);
  const strokes = (node.strokes || []).filter((s: any) => s.visible !== false);
  const layout = node.layoutMode
    ? `${node.layoutMode}${node.itemSpacing != null ? ` gap ${node.itemSpacing}` : ""}${
        node.primaryAxisAlignItems ? ` ${node.primaryAxisAlignItems}/${node.counterAxisAlignItems ?? "-"}` : ""
      }`
    : "";
  const padding = [node.paddingLeft, node.paddingTop, node.paddingRight, node.paddingBottom];
  const style = node.style;
  return (
    <div className={depth ? "ml-3 border-l border-gray-100 pl-2" : ""}>
      <div className="text-xs text-gray-800 font-mono">
        <span className="text-gray-400">{node.type}</span>{" "}
        <span className="font-semibold">{node.name}</span>{" "}
        <span className="text-gray-500">{node.id}</span>
      </div>
      <div className="text-[11px] text-gray-600 font-mono ml-2">
        {bb.width != null && (
          <div>
            size {bb.width} × {bb.height}
            {bb.x != null ? `   at (${bb.x}, ${bb.y})` : ""}
          </div>
        )}
        {fills.length > 0 && <div>fill {fills.map((f: any) => paintColor(f.color)).join(", ")}</div>}
        {strokes.length > 0 && (
          <div>
            stroke {strokes.map((s: any) => paintColor(s.color)).join(", ")} {node.strokeWeight ?? ""}
            {node.strokeAlign ? ` ${node.strokeAlign}` : ""}
          </div>
        )}
        {node.cornerRadius != null && <div>radius {node.cornerRadius}</div>}
        {node.rectangleCornerRadii && <div>radii {node.rectangleCornerRadii.join(" ")}</div>}
        {layout && <div>{layout}</div>}
        {padding.some((v: any) => v != null) && <div>padding L/T/R/B {padding.join(" / ")}</div>}
        {style && (
          <div>
            text {style.fontFamily} {style.fontSize}px/{style.fontWeight} lh {style.lineHeightPx}
            {style.textAlignVertical ? ` vertical ${style.textAlignVertical}` : ""}
          </div>
        )}
        {node.characters && <div className="whitespace-pre-wrap">text {JSON.stringify(node.characters)}</div>}
        {node.annotations?.length > 0 && (
          <div className="text-amber-700">
            ANNOTATION {node.annotations.map((a: any) => a.label).filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      {(node.children || []).map((c: any) => (
        <RestLayerTree key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}
