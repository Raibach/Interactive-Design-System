/**
 * ToolsSeat — THE TOOLS TAB'S OWN FILE, AND THE FIGMA SECTION'S NEW HOME.
 *
 * Owner, 2026-10-18: *"that section was loading by default when you selected design and I'm just
 * trying to move it and its chat which goes with it to the tools tab."* So this file is the move:
 * the `render-design` section — its three columns, its ingest form, its layer tree, its preview,
 * and ITS OWN CHAT (`chat-panel`, emitted in this section's own tree, bound to this section's own
 * conversation) — lives here now, not in the shell and not in the console's seat.
 *
 * THE BARRIER IS THE POINT. This seat's chat is this tab's agent: it carries this tab's own
 * conversation, its own instructions and its own actions. It knows nothing about the Console's
 * conversation, and the Console's seat knows nothing about this one. Nothing is shared here
 * except the Lit components and the styling.
 *
 * WHAT CAME ACROSS, UNCHANGED: the assembly door (`/api/ai/assemble-surface`, intent
 * `render-design`), the renderer effect that reads the seats out of the drawn tree, the ingest
 * submit path (`/api/figma/ingest`), the preview setter, the width effect, and the whole action
 * surface — approve, discard, remove, collision answer, row open, card open. The code is the
 * shell's, moved; it was not re-derived.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/shared/apiHelper";
import { apiFetch } from "@/shared/apiFetch";
import { readA2UIEnvelope, envelopeRefusalError } from "@/shared/a2ui-envelope";
import { markArrival } from "@/shared/arrival";
import { componentProps, resolveTag } from "@/components/lit/a2ui-renderer";
import { buildContent, type Content } from "./content";
import { parseFigmaUrl } from "@/utils/figmaUrl";
import { generateUuid } from "@/utils/uuid";

/**
 * THE VALUES THE COMPONENT WILL BE GIVEN — the data binding, for the preview to show.
 *
 * Moved with the preview it serves. The preview carries the values, not only the drawing — and
 * they come from THE DATABASE ROWS the room already holds (`session/elements`, one
 * `design_master` row per component), never from the catalogue's declaration of itself and
 * never invented. A tag with no row yields nothing — a component being created for the first
 * time has no data yet, and an empty list is that fact.
 */
function previewValues(rows: any[], tag: string): Array<{ field: string; value: string }> {
  const row = rows.find((r) => r?.id === tag || r?.name === tag || r?.key === tag);
  if (!row) return [];
  const values: Array<{ field: string; value: string }> = [];
  if (row.name) values.push({ field: "name", value: String(row.name) });
  if (row.description) values.push({ field: "description", value: String(row.description) });
  // The address the row is known by, when it says something the name does not (the tree's own rule
  // for its second line): the catalogue key, which is `f-<node id>` for a generated component.
  if (row.key && row.key !== row.name) values.push({ field: "code", value: String(row.key) });
  return values;
}

export type ToolsSeatProps = {
  /** The shell's global "an assembly is running" flag — the room's cover and spinner. */
  onAssemblingChange?: (busy: boolean) => void;
  /**
   * An element to open once this seat has assembled — a design card clicked on the console.
   * The room hands it over rather than the seat guessing: the click is the console's, and the
   * opening is this seat's.
   */
  openTag?: string | null;
  /**
   * HEADLESS — THE ENGINE PROVIDES CONTENT, IT DOES NOT DRAW A SURFACE (owner, 2026-10-18). The
   * room owns ONE interface (rail + chat + columns); this engine's job is its own assembly, its
   * own ingest/preview actions, and reporting the content to inject into that interface.
   */
  headless?: boolean;
  /**
   * IS THIS TAB STANDING? A tab and its left column are ONE UNIT (owner, 2026-10-18): the Figma
   * engine's actions — ingest, approve, discard, remove, row open — answer only while the Tools
   * content is the one standing. A chat on another tab must not drive this column.
   */
  active?: boolean;
  /** The engine's application and the chat information it stands for, reported to the room. */
  onContent?: (content: Content) => void;
};

export default function ToolsSeat({ onAssemblingChange, openTag, headless, active, onContent }: ToolsSeatProps) {
  /* Read by every action listener: a stale closure would answer for the wrong tab. */
  const activeRef = useRef(Boolean(active));
  activeRef.current = Boolean(active);
  /*
   * THIS SEAT'S TWO VALUES, and the console's are not among them. `designTree` is the surface
   * `render-design` emits; `currentDesignSession` is the design container the server resolves —
   * this seat's conversation owner. No path from here writes the Composer's or the Console's
   * state.
   */
  const [designTree, setDesignTree] = useState<{ components: any[]; dataModel: Record<string, any> }>(
    { components: [], dataModel: {} },
  );
  const [currentDesignSession, setCurrentDesignSession] = useState<Record<string, any> | null>(null);

  /*
   * THE SEATS READ OUT OF THE DRAWN TREE. The section is a surface, not React markup: its
   * `workspace-layout` and the columns inside it exist only in the renderer's shadow root, so
   * they are read after the render and held as elements — the same three reads the shell made.
   */
  const [designRoomEl, setDesignRoomEl] = useState<HTMLElement | null>(null);
  const [designMiddleSeat, setDesignMiddleSeat] = useState<HTMLElement | null>(null);
  const [designLeftSeat, setDesignLeftSeat] = useState<HTMLElement | null>(null);

  /*
   * IS THE THIRD COLUMN DRAWN YET? — no, until there is something to put in it. The surface
   * declares `design-middle-container` and does not reference it; this flag is what adds the
   * reference when a run produced something to draw. One writer, and it only ever opens.
   */
  const [designPreviewOpen, setDesignPreviewOpen] = useState(false);

  /*
   * WAS A PREVIEW OPEN WHEN THE FORM WAS SUBMITTED? A re-submit REPLACES the preview (the backend
   * empties the temporary folder before writing the new one, and evicts the previous job), so no
   * discard is required. This ref carries that fact into the answer, which says so in words —
   * measured, not assumed: the previous folder is gone and the new module is the one served.
   */
  const previewOpenRef = useRef(false);
  useEffect(() => {
    previewOpenRef.current = designPreviewOpen;
  }, [designPreviewOpen]);

  /** The tool's report — stable, so the tool's effect is not re-run by a new identity. */
  const onDesignPreviewChange = useCallback((hasPreview: boolean) => {
    if (hasPreview) setDesignPreviewOpen(true);
  }, []);

  /** The ingest form's busy flag — one call at a time from this form. */
  const [designIngestBusy, setDesignIngestBusy] = useState(false);

  /* THIS SEAT'S OWN RENDERER — a separate instance, never the Composer's or the Console's. */
  const designRendererRef = useRef<any>(null);

  /* The width effect's memory: whether each shape has been established since the room drew. */
  const roomShapeSetRef = useRef(false);
  const previewWidthSetRef = useRef(false);

  /**
   * THE SEAT'S DOOR — `render-design`, the section that came with the tab.
   *
   * It asks the server for `render-design`, which resolves the DESIGN CONTAINER and emits a
   * surface keyed to it, and writes exactly two values: `designTree` and `currentDesignSession`.
   * `currentPromptSession` is not in this body, so no path from this seat can write the
   * Composer's state — blindness by construction rather than by a guard somebody has to remember.
   */
  const assembleDesignSurface = useCallback(async () => {
    const response = await apiFetch(`${API_BASE}/ai/assemble-surface`, {
      method: "POST",
      body: JSON.stringify({ intent: "render-design" }),
    });
    const rawData = await response.json();
    const read = readA2UIEnvelope(rawData);
    if (read.ok === false) {
      console.error(`🤖 [A2UI] ENVELOPE REFUSED for render-design — ${read.refusal.code}: ${read.refusal.message}`);
      throw envelopeRefusalError(read.refusal);
    }
    const reading = read.reading;
    setDesignTree({
      // THE TOOLS TAB'S CHAT IS DESIGN'S CHAT. The section still names its seat `chat-panel`;
      // the seat draws `design-chat` — Design's own element. The rename touches no binding:
      // every prop path lands on the same property names.
      components: (reading.components as any[]).map((c) =>
        c?.component === "chat-panel" ? { ...c, component: "design-chat" } : c,
      ),
      dataModel: reading.dataModel as Record<string, any>,
    });
    setCurrentDesignSession((reading.dataModel as Record<string, any>)?.session ?? null);
  }, []);

  /*
   * THE SEAT ASSEMBLES WHEN IT LOADS — its own door, asked by its own file. That is the move the
   * owner asked for: this section used to assemble because the DESIGN tab was selected; now it
   * assembles because the TOOLS tab loaded it.
   *
   * AND A CARD CLICK'S ELEMENT IS OPENED AFTER THE ASSEMBLY, not before: the row-click path reads
   * the room's own rows, so an `open-component` sent at a tree that is still empty would open a
   * preview over nothing. Two frames after the answer lands, the tree is committed and the
   * listeners are holding it.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await assembleDesignSurface();
      } catch (err) {
        // The refusal is reported, never swallowed: the room drew nothing because the door said
        // no, and the reason is the server's own words.
        console.error('🤖 [A2UI] the tools seat could not assemble:', err);
        return;
      }
      if (cancelled || !openTag) return;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!cancelled) {
            window.dispatchEvent(new CustomEvent('open-component', { detail: { tag: openTag } }));
          }
        });
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [assembleDesignSurface, openTag]);

  /*
   * ── ASSEMBLY, THEN RENDER, THEN THE INJECTION — IN THAT ORDER ────────────────────────────
   *
   *   1. `components` and `dataModel` are assigned — the ASSEMBLY.
   *   2. `await el.updateComplete` waits for the container to have been DRAWN — the RENDER.
   *      Assigning `components` only SCHEDULES Lit's update, so a query made in the same tick
   *      finds an empty shadow root and the room draws empty with nothing to explain it.
   *   3. The seats are read from the shadow root and handed to React — the INJECTION. They can
   *      only be read here, because before the render there is no element to read.
   *
   * WHAT IS READ is this renderer's own shadow root — `el.shadowRoot`, never `document`: the
   * elements are drawn inside the shadow tree, where no document-level query can see them.
   */
  useEffect(() => {
    const el = designRendererRef.current;
    if (headless) return;
    if (!el) return;
    /* THE SURFACE IS DRAWN AS ASSEMBLED — its chat is a SURFACE SEAT emitted by this engine's own
       envelope, with its own conversation-id and session-id, and the renderer assembles it in the
       layout. Nothing is lifted out and nothing is bound by hand. */
    const comps = designTree.components as any[];
    const openOutput =
      designPreviewOpen && comps.some((c) => c?.component === "design-middle-container");
    el.components = openOutput
      ? comps.map((c) =>
          c?.id === "root" && c.children
            ? {
                ...c,
                // THE CHAT STANDS OPEN IN EVERY ENGINE (see workspace-layout.ts:656 —
                // `el.collapsed = !isThirdOpen`); only the middle column waits for a run.
                isThirdOpen: true,
                children: c.children.middle
                  ? c.children
                  : { ...c.children, middle: "design-middle" },
              }
            : c,
        )
      : comps.map((c) => (c?.id === "root" ? { ...c, isThirdOpen: true } : c));
    el.dataModel = designTree.dataModel;

    let cancelled = false;
    void (async () => {
      try {
        await el.updateComplete;
      } catch {
        // `updateComplete` does not reject in Lit. If it ever does, the query still runs and
        // reports no container rather than taking the effect — and the room — down with it.
      }
      if (cancelled) return;
      // Passing the element itself, not a copy of it: on a re-assembly that keeps the same
      // container, React bails out of the state update and the injected regions are NOT
      // remounted — the ingest keeps what it holds across a data-model-only change.
      const roomEl = (el.shadowRoot?.querySelector('design-workspace') as HTMLElement | null) ?? null;
      setDesignRoomEl(roomEl);
      // AND THE MIDDLE COLUMN'S CONTAINER, read in the same pass for the same reason: it does not
      // exist until the tree has been drawn. It is the element that OWNS the hole — the preview
      // is loaded inside it rather than left loose beside it in the pane.
      setDesignMiddleSeat(
        (el.shadowRoot?.querySelector('design-middle-container') as HTMLElement | null) ?? null,
      );
      // AND THE LEFT COLUMN'S PANEL, read in the same pass and for the same reason. It OWNS the
      // hole the rail is loaded into.
      const panelEl = (el.shadowRoot?.querySelector('design-left-panel') as HTMLElement | null) ?? null;
      if (panelEl) {
        try {
          await (panelEl as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
        } catch {
          // The same courtesy as above: a child that never settles must not take the effect down.
        }
      }
      if (cancelled) return;
      setDesignLeftSeat(panelEl);
      /* THE SELECTOR ARRIVES ON THE ICON THAT WAS PRESSED: this engine is standing for Tools, so
         its rail shows Tools. The conversation is the engine's own, carried by the surface. */
      const seat = (roomEl?.querySelector("design-chat") as
        | (HTMLElement & { allowedTabs?: string; activeTab?: string })
        | null) ?? null;
      if (seat) {
        seat.activeTab = "tools";
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [designTree, designPreviewOpen]);

  /*
   * THE INGEST FORM'S TWO CHANNELS — both through the DATA MODEL, which is where this system
   * puts content. Patching the emitted COMPONENT does not reach anything: the renderer re-applies
   * props when the DATA MODEL changes, so `session/ingest` is what the form's `busy`/`message`
   * and the tree's `refresh` are bound to. One write, and every bound prop is re-handed.
   */
  const setDesignIngest = useCallback(
    (patch: { busy?: boolean; message?: string; refresh?: number }) => {
      setDesignTree((prev) => {
        const session = (prev.dataModel as Record<string, any>)?.session ?? {};
        const ingest = { busy: false, message: "", refresh: 0, ...(session.ingest ?? {}), ...patch };
        return {
          ...prev,
          dataModel: {
            ...prev.dataModel,
            session: { ...session, ingest },
          },
        };
      });
    },
    [],
  );

  /*
   * ══ THE INGEST FORM, ANSWERED HERE ═══════════════════════════════════════════════════════════
   *
   * The left column holds the ingestion rail: `figma-ingest-form` (the Figma URL, the Notes and
   * Submit) over `figma-layers-view` (the catalogue tree). The FORM dispatches `ingest-submit`
   * with the raw text and nothing else; this is the half that decides what a typed string means
   * and runs the same call the modal runs — `POST /api/figma/ingest` with
   * `{jobId, fileKey, nodeId, notes, sessionId, sessionTitle}`.
   *
   * THE REFUSALS ARE THE INGEST'S OWN WORDS, VERBATIM — copied from `IngestModal.handleIngest`
   * (2026-10-18: "we worked very hard on that react component … to make sure that the messages and
   * the feedback were all accurate"). A second wording for one refusal is a second answer to the
   * same question, and the two would drift.
   *
   * WHAT IS NOT HERE, SAID PLAINLY: a typed node tag and a typed layer name are the modal's other
   * two paths; neither is wired into this seat, and the form reports that rather than failing
   * silently.
   */
  useEffect(() => {
    const onIngestSubmit = async (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string; notes?: string }>).detail ?? {};
      const typed = String(detail.url ?? "").trim();
      if (!typed || designIngestBusy) return;

      setDesignIngestBusy(true);
      setDesignIngest({ busy: true, message: "" });
      // ONE PREVIEW AT A TIME, AND THE NEW ONE REPLACES THE OLD WITHOUT ASKING. The backend empties
      // the folder before writing, so there is nothing to discard first; the answer says so.
      const replacedPreview = previewOpenRef.current;
      // THE THIRD COLUMN OPENS WITH THE SPINNER, NOT BLANK. The poll below replaces this note with
      // each real step; the answer replaces the whole state when it lands.
      setDesignPreview({
        source: "ingest",
        pending: true,
        tag: "",
        name: "",
        note: "Ingesting — reading the node from Figma…",
        values: [],
      });
      let stepTimer: number | undefined;
      try {
        const neitherUrlNorTag = "That is neither a Figma URL nor a component id (f-1234-5678).";
        const needsANode =
          "The URL needs a node — add ?node-id=… (a file link has no single component to ingest).";

        if (/^f-\d/.test(typed)) {
          setDesignIngest({
            busy: false,
            message: `Opening a component by tag (${typed}) is not wired into this room yet — paste the Figma link with ?node-id=… to ingest, or pick the component in the list.`,
          });
          return;
        }
        if (!/^https?:\/\//i.test(typed)) {
          setDesignIngest({
            busy: false,
            message: `${neitherUrlNorTag} Searching by layer name is not wired into this room yet.`,
          });
          return;
        }
        const { fileKey, nodeId } = parseFigmaUrl(typed);
        if (!fileKey || !nodeId) {
          setDesignIngest({ busy: false, message: needsANode });
          return;
        }
        const jobId = generateUuid();
        // ── THE STEPS, AS THEY HAPPEN ─────────────────────────────────────────────────────────
        // The backend records a real step each time the work advances: reading the node, then one
        // line per layer it checks, then building and compiling. This polls that list and puts the
        // last line under the form's spinner, so the wait shows what is happening rather than an
        // unexplained turn. `?t=` busts any cache, because a cached "processing" is a step that
        // never moves.
        stepTimer = window.setInterval(async () => {
          try {
            const status = await apiFetch(`${API_BASE}/figma/ingest/${jobId}?t=${Date.now()}`);
            if (!status.ok) return;
            const payload = (await status.json()) as { steps?: Array<{ text?: string }> };
            const steps = Array.isArray(payload.steps) ? payload.steps : [];
            const last = steps[steps.length - 1]?.text;
            if (last) {
              setDesignIngest({ busy: true, message: String(last) });
              setDesignPreview({
                source: "ingest",
                pending: true,
                tag: "",
                name: "",
                note: String(last),
                values: [],
              });
            }
          } catch {
            // The ingest request itself reports a failure; a failed poll is not a second error.
          }
        }, 700);
        // THE ROOM SAYS WORK STARTED — here, where the request actually starts, and not at the
        // submit: the guards above can return without a request, and a wait that nothing would
        // end must not begin. The settle goes out in `finally` for the same reason, backwards.
        window.dispatchEvent(new CustomEvent('ingest-started'));
        const res = await apiFetch(`${API_BASE}/figma/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // One id for the job, held here because the preview carries it: an approve resolves
            // this job, so the value that goes out is the value the preview must hand back.
            jobId,
            fileKey,
            nodeId,
            notes: String(detail.notes ?? ""),
            sessionId: currentDesignSession?.id ?? "",
            sessionTitle: currentDesignSession?.title ?? "",
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || "Failed to ingest");
        // ── THE INGEST'S ANSWER BECOMES THE PREVIEW ────────────────────────────────────────────
        // Read exactly as the modal reads it (`data?.result ?? data`), because it is the same
        // response: the tag it built, the node it measured, and whether the catalogue already
        // held that tag — which is what makes the approve button say REPLACE instead of add.
        const result = (data?.result ?? data ?? {}) as Record<string, any>;
        const details = (result.details ?? {}) as Record<string, any>;
        /*
         * THE DRAFT'S OWN ADDRESS, TAKEN FROM THE ANSWER AND NOT WORKED OUT HERE. The backend
         * writes the draft to a temporary file and returns where it put it (`result.preview`).
         * THE TAG ALONE IS NOT AN ADDRESS: a re-ingest of a node the catalogue already holds
         * builds a draft under the same tag as the approved element, so a client left to derive
         * the path would draw the approved component instead of the change. The seat derives
         * nothing and passes the answer's own fields through. IT IS ALSO WHY NO `component` IS
         * NAMED FOR THE DRAWING.
         */
        const draft = (result.preview ?? null) as
          | { jobId?: string; tag?: string; modulePath?: string; moduleUrl?: string }
          | null;
        const hasAddress = !!draft?.moduleUrl;
        // THE COMPILE VERDICT, carried from the form: `validation` is the ingest's own esbuild
        // verdict per tag; a tag with no entry is not a failure.
        const validation = (result.validation ?? {}) as Record<string, { ok?: boolean; error?: string }>;
        const builtTag = String(result.tag ?? details.target_tag ?? "");
        // THE QUESTION THE DESIGNER HAS TO ANSWER, carried with the preview: the layers whose NAME
        // the catalogue already has on a DIFFERENT component, and the layers that ARE a component
        // it already ships. An unanswered question commits as "add it as its own component".
        const collisions = Array.isArray(result.nameCollisions) ? result.nameCollisions : [];
        const instances = Array.isArray(result.nameInstances) ? result.nameInstances : [];
        const compile = validation[builtTag];
        const compileFailed = compile?.ok === false;
        const compileLine = compileFailed
          ? `Generated code does not compile — approval will be refused: ${builtTag}: ${
              compile?.error || "the compiler gave no message"
            }.`
          : "Built from the Figma node you submitted. Approving writes it into the catalogue.";
        /* THE PROOF, IN THE FORM'S OWN WORDS — how many values were compared, and which ones the
           component does not carry exactly. A count alone is not evidence, so every line that is
           not exact names the layer, the fact, the Figma value and the drawn value: `x 16, y 20 →
           x 16, y 21`. The full table (every layer, every fact) is kept per job and read at
           `/api/figma/ingest/<job>/facts`; the note shows the first six and counts the rest. */
        /* THE ANSWER LEADS WITH WHAT COULD NOT BE READ. The owner's instruction (2026-10-26):
           *"Just report it. Say I can't read this, or I built it anyway and did not read this,
           this, this. That's how I can diagnose problems."* So the note opens with the verdict
           sentence and the named gaps, and every count below it is evidence — never the headline.
           A count computed over only the comparable facts said "100%" beside a named failure, and
           that is the suppression this panel must not do. */
        const verdict = String((result as any)?.fidelity?.verdict || "");
        const unread = Array.isArray((result as any)?.fidelity?.unread)
          ? ((result as any).fidelity.unread as Array<Record<string, any>>)
          : [];
        const unreadLines = unread.map((row) => String(row.sentence || "")).filter(Boolean);
        const unreadMore = "";
        const coverageGaps = Array.isArray((result as any)?.fidelity?.omissions)
          ? ((result as any).fidelity.omissions as string[])
          : [];
        const coverageLine = coverageGaps.length
          ? `I could not account for ${coverageGaps.length} key(s) the design states: ${coverageGaps.join(", ")}.`
          : "";
        /* WHAT IS IN THE FILE, NOT IN THE PROGRAM. Only contradictions between the file's own
           numbers appear here, with the arithmetic — so a designer can go and fix their file, and
           knows the difference. Everything in `unread` above is the pipeline's. */
        const designFindings = Array.isArray((result as any)?.fidelity?.design)
          ? ((result as any).fidelity.design as Array<Record<string, any>>)
          : [];
        const designLine = designFindings
          .map((row) => `In your file — ${row.layer}: ${row.observation}`)
          .join(" ");
        /* THE FONT WARNING, SAID TO THE DESIGNER: the design names a face this system does not
           ship, and the application will draw its one face instead. Not a defect of the design and
           not a hidden match — a warning, at the top, with the layers. */
        const fonts = Array.isArray((result as any)?.fidelity?.fonts)
          ? ((result as any).fidelity.fonts as Array<Record<string, any>>)
          : [];
        const fontLine = fonts.length
          ? `FONT WARNING — ${fonts.length} layer(s) use ${[
              ...new Set(fonts.map((f) => String(f.stated || "")))
            ].join(", ")}, which this system does not ship. The application will draw ${String(
              fonts[0]?.drawn || "IBM Plex Sans"
            )} in place of it: ${fonts
              .map((f) => String(f.layer || ""))
              .join(", ")}.`
          : "";
        /* WHAT THE FILE ITSELF SAYS, in the designer's own words. A note is quoted verbatim; a
           property mark is named with the properties it exposes. Nothing is summarised. */
        const annotations = Array.isArray((result as any)?.fidelity?.annotations)
          ? ((result as any).fidelity.annotations as Array<Record<string, any>>)
          : [];
        const notes = annotations.filter((a) => a.kind === "note" && a.note);
        const props = annotations.filter((a) => a.kind === "property");
        /* THE LAYER NAME, AND WHETHER THE CATALOGUE ALREADY HAS IT. A name lookup only: the
           approved component's own values are never read or compared, because that would be the
           AI interpreting one design against another. */
        const existingName = (result as any)?.existingName as
          | { tag?: string; nodeId?: string; approvedAt?: string }
          | null
          | undefined;
        const exactness = (result as any)?.fidelity?.exactness as
          | { exact?: number; compared?: number; differs?: number; percent?: number }
          | undefined;
        const exactLine = exactness
          ? `Of the facts I could compare, ${exactness.exact ?? 0} of ${exactness.compared ?? 0} carry the design's own values exactly (${exactness.percent ?? 0}%).`
          : "";
        /* AND WHAT MOVED SINCE THE LAST TIME THIS NODE WAS MEASURED. This is the line the
           one-pixel test reads: a second ingest of the same node carries the previous
           measurement beside it, so the answer names the fact that changed, with both values —
           `position: x 16, y 20 → x 16, y 21`. An exact drawing of a CHANGED design and an exact
           drawing of the SAME design report the same count, and only this line tells them apart. */
        const changes = (result as any)?.changesSinceLast as
          | { jobId?: string; designChanged?: boolean; changed?: Array<Record<string, any>>;
              addedCount?: number; removedCount?: number }
          | null
          | undefined;
        const changedRows = Array.isArray(changes?.changed) ? changes!.changed : [];
        const changeLine = changes
          ? changedRows.length
            ? `Changed since the last ingest (${changes.jobId}) — ${changedRows
                .map((row) => `${row.layer} ${row.fact}: ${row.delta}`)
                .join(" · ")}`
            : `No value changed since the last ingest (${changes.jobId}) — the same design measured twice.`
          : "";
        setDesignPreview({
          source: "ingest",
          tag: builtTag,
          // THE WHOLE MEASURED TREE, so the list can open the component it just ingested. Every
          // layer, nested, with the names and sizes the design states.
          tree: ((result as any)?.details?.spec as Record<string, any> | undefined) ?? null,
          // THE PATTERNS THIS DESIGN STANDS ON, so the replacement warning can name a child that
          // will be replaced as well as the root.
          patterns: (((details.componentSet as Array<Record<string, any>> | undefined) ?? [])),
          // THE DRAWN DECLARATIONS PER LAYER — the specs list the panel shows beside the drawing.
          specs: ((details.specs as Array<Record<string, any>> | undefined) ?? []),
          // EVERY FACT READ, layer by layer, with the value and its verdict — the list, not a count.
          readings: (((result.fidelity as Record<string, any> | undefined)?.readings) ?? []) as Array<
            Record<string, any>
          >,
          // EVERY ANNOTATION, unsliced — the notes verbatim and the property marks.
          annotations: (((result.fidelity as Record<string, any> | undefined)?.annotations) ?? []) as Array<
            Record<string, any>
          >,
          // THE WHOLE RUN AND THE WHOLE ARTIFACT: every step the ingest took, and the source the
          // preview loads. Nothing summarised (owner: "don't try to prune. Give it all").
          steps: ((details.steps as Array<Record<string, any>> | undefined) ?? []),
          componentSource: String(details.source ?? ""),
          sourceBytes: Number(details.sourceBytes ?? 0),
          name: details.target_node_name ?? "",
          nodeId: details.target_node_id ?? nodeId,
          alreadyInCatalogue: !!result.alreadyInCatalogue,
          // THE COMPONENT THIS DESIGN ALREADY IS, as the block above the actions — not a sentence
          // inside the note, so a later pruning of prose cannot remove the fact.
          existing: existingName?.tag ? existingName : undefined,
          jobId,
          draft,
          collisions,
          instances,
          // THE DATA BINDING, IN THE PREVIEW — what this component will be given, from the rows
          // the database holds. A tag with no row yet carries an empty list, which is a component
          // being created rather than a value being hidden.
          values: previewValues(
            ((designTree.dataModel as Record<string, any>)?.session?.elements ?? []) as any[],
            builtTag,
          ),
          // THE ANSWER STARTS UNSET, and unset means "add it as its own component".
          collisionAnswer: null,
          // THE FORM'S OWN WORDS, IN THE ORDER A DIAGNOSIS NEEDS: what could not be read first,
          // then the named gaps, then what changed, then the compile state, and the count last as
          // evidence. A success line never comes before a failure line.
          // THE NOTE IS A STATUS LINE, NOT AN ESSAY. The detail is beneath it as lists — every
          // layer's declarations, every annotation, every fact. Paragraphs that repeat a count the
          // lists already show are noise (owner, 2026-10-26: *"the rest of the paragraphs and
          // pontifications are not necessary to keep them for now"*).
          // EVERYTHING IS SAID (owner, 2026-10-26: *"don't try to prune. Give it all and then
          // we'll prune it together… I want you to be honest about what you're saying, what you're
          // reading and what's being used to build the component in the preview."*). The lists below
          // carry the detail; this line carries every sentence the backend produced, in order, and
          // no array is sliced.
          note: [
            verdict,
            unreadLines.join(" "),
            coverageLine,
            designLine,
            fontLine,
            replacedPreview ? "The preview you had open was replaced by this one — nothing needed discarding first." : "",
            changeLine,
            compileLine,
            exactLine,
            hasAddress ? "" : `Nothing to render — no draft address came back (job ${jobId}).`,
          ]
            .filter(Boolean)
            .join(" "),
          facts: [
            // STATED EITHER WAY. "It compiles" is a fact the form reports, and a fact left out
            // when it is fine, and out when it is not, is silence in both directions.
            { label: "Compiles", value: compileFailed ? "no — the approval will be refused" : "yes" },
            // THE LAYER NAME IS THE IDENTITY: whether it is already in the catalogue, by name.
            { label: "Layer name", value: existingName?.tag ? `already ${existingName.tag}` : "new" },
            { label: "Fonts replaced", value: String(fonts.length) },
            { label: "Designer notes", value: String(notes.length) },
            { label: "Could not read or draw", value: String(unread.length) },
            { label: "In your file", value: String(designFindings.length) },
            {
              label: "Exact, of the facts compared",
              value: exactness ? `${exactness.exact ?? 0} / ${exactness.compared ?? 0}` : "not measured",
            },
            { label: "Changed", value: changes ? String(changedRows.length) : "first ingest" },
            { label: "Figma node", value: String(details.target_node_id ?? nodeId) },
            details.target_node_name ? { label: "Layer", value: String(details.target_node_name) } : null,
            details.target_node_type ? { label: "Type", value: String(details.target_node_type) } : null,
            details.target_node_size ? { label: "Size", value: String(details.target_node_size) } : null,
          ].filter(Boolean) as Array<{ label: string; value: string }>,
        });
        // The ingest also recorded this design's layers — read them back so the tree shows the
        // node it just wrote, which is what the modal does with its own `layersKey`.
        setDesignIngest({ busy: false, message: "", refresh: Date.now() });
      } catch (err) {
        // THE PENDING COLUMN IS CLEARED WHEN THE INGEST FAILS: a spinner that keeps turning after
        // the answer has already come back is a claim that work is still happening.
        setDesignPreview(null);
        setDesignIngest({
          busy: false,
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        if (stepTimer !== undefined) window.clearInterval(stepTimer);
        setDesignIngestBusy(false);
        // Success, a refusal, a network failure — every outcome settles the room's wait.
        window.dispatchEvent(new CustomEvent('ingest-settled'));
      }
    };
    /* ONLY THE STANDING TAB ACTS: this listener belongs to the Tools unit, so it answers while
       the Tools content is the one in the left column — never from another tab's chat. */
    const onSubmit = (event: Event) => {
      if (!activeRef.current) return;
      void onIngestSubmit(event);
    };
    window.addEventListener("ingest-submit", onSubmit);
    return () => window.removeEventListener("ingest-submit", onSubmit);
  }, [designIngestBusy, setDesignIngest, currentDesignSession]);

  /*
   * ══ THE TWO RUN TRIGGERS, AND THE COLUMN THEY LAUNCH ═════════════════════════════════════════
   *
   * On the Composer, RUN moves a view into the middle column and `workspace-layout` draws it.
   * Here the same two facts are needed: something to draw (the preview state) and the layout
   * REFERENCING the middle column — a column the tree does not reference is collapsed, which is
   * workspace-layout's own contract and not a style. This function is both halves at once,
   * because they are one act. Clearing it (null) closes the column again.
   *
   * A SUBMIT PRODUCES A DRAFT; A CLICK PRODUCES A COMPONENT. The two are NOT interchangeable even
   * when they carry the same name — the ordinary case here, since a designer edits Figma and
   * submits a node the catalogue already holds. So a draft is drawn BY ITS FILE (`draft-preview`,
   * loading the temporary module the backend wrote) and a click BY ITS NAME (the catalogue's own
   * element). Drawing a draft's name would resolve through the catalogue and show the old
   * component — the defect this column was fixed to remove.
   */
  const setDesignPreview = useCallback((preview: Record<string, any> | null) => {
    setDesignTree((prev) => {
      const session = (prev.dataModel as Record<string, any>)?.session ?? {};
      const tag = preview?.tag ? String(preview.tag) : "";

      // WHAT THIS SURFACE CAN DRAW, DECIDED BEFORE THE TREE IS WALKED. `resolveTag` is the
      // renderer's OWN resolver — imported, not re-implemented — so this can never disagree with
      // what would be drawn. Computed ABOVE the map because the map reads it.
      const resolved = preview && tag ? resolveTag(tag) : null;
      const drawable = !!resolved && !!customElements.get(resolved);

      const draft = preview?.source === "ingest" ? preview?.draft ?? null : null;
      const drawsDraft = !!draft?.moduleUrl;

      // AND WHEN AN INGEST ANSWERS WITHOUT AN ADDRESS, NOTHING IS DRAWN. IT IS NOT FALLEN BACK:
      // drawing the catalogue's element under the tag is how a designer who had just changed the
      // design was shown the approved component instead. A missing address means the answer
      // cannot say WHICH file it built, so the honest drawing is none, with the reason on the
      // preview where the designer is looking.
      const drawsCatalogue = preview?.source !== "ingest" && !!preview && !!tag && drawable;

      // ONE NODE PER SELECTION (owner, 2026-10-25): the drawing's node used one fixed id, so the
      // renderer re-used that node and every second row left the FIRST component on screen. The
      // id carries the tag, so choosing another row is another node and the output swaps.
      const targetId = tag ? `preview-target:${tag}` : "preview-target";
      const components = prev.components
        .filter((c: any) => {
          // ONE RUN DRAWS ONE THING, so whichever drawing this run did not produce is REMOVED
          // rather than left in the list — a stale entry kept behind is an entry a reference
          // could still point at.
          if (c.id === "preview-draw") return drawsDraft;
          if (typeof c.id === "string" && c.id.startsWith("preview-target")) return false;
          return true;
        })
        .map((c: any) => {
          // THE LAYOUT REFERENCES THE COLUMN — a column nothing references is not drawn.
          if (c.id === "root") {
            if (!c.children || typeof c.children !== "object") return c;
            const children = { ...c.children };
            if (preview) children.middle = "design-middle";
            else delete children.middle;
            return { ...c, children };
          }
          // THE PREVIEW NAMES ITS OWN DRAWING, by id, per the adjacency rule.
          if (c.id === "preview") {
            return {
              ...c,
              children: drawsDraft
                ? { draw: "preview-draw" }
                : drawsCatalogue
                  ? { draw: targetId }
                  : {},
            };
          }
          // THE DRAFT, DRAWN FROM ITS OWN FILE — bound to `/session/preview/draft`, the address
          // the ingest returned. No catalogue name is resolved for this drawing.
          if (c.id === "preview-draw") {
            return { ...c, component: "draft-preview", draft: { path: "/session/preview/draft" } };
          }
          return c;
        });

      // The entry the reference points at. Emitted by the SEAT because WHICH component to draw is
      // the run's answer and not the assembly's.
      if (drawsDraft) {
        if (!components.some((c: any) => c.id === "preview-draw")) {
          components.push({
            id: "preview-draw",
            component: "draft-preview",
            draft: { path: "/session/preview/draft" },
          });
        }
      } else if (drawsCatalogue) {
        /*
         * AND IT CARRIES THE COMPONENT'S OWN BINDINGS: the entry names the tag and the room's
         * own entry for the same element (found by the ELEMENT, via `resolveTag`, not by the
         * spelling) is cloned so its paths come with it. Where the room holds no entry for that
         * component, the bare name is all there is — and that component's own empty state is then
         * the truth, not a defect.
         */
        const twin = prev.components.find(
          (c: any) =>
            c.id !== "preview-draw" &&
            typeof c.component === "string" &&
            !String(c.id).startsWith("preview-target") &&
            resolveTag(c.component) === resolved,
        );
        components.push({ ...(twin ? { ...twin } : {}), id: targetId, component: tag });
      }

      return {
        ...prev,
        components,
        dataModel: {
          ...prev.dataModel,
          session: {
            ...session,
            // `/session/preview` IS WHAT THE FRAME DRAWS (component-preview: identity, facts, the
            // two actions) AND `/session/preview/draft` IS WHAT THE DRAWING LOADS. One run, one
            // write, and the two readers take the half that is theirs.
            preview: preview ?? undefined,
            // THE TREE THE INGEST JUST MEASURED, for the list's own arrow. It is written from the
            // answer's own measured tree — the same walk the facts use — so a row in the list and
            // a fact in the answer cannot name a layer differently. Cleared with the preview.
            ingest: {
              ...(session.ingest ?? {}),
              tree: preview?.tree ?? undefined,
            },
          },
        },
      };
    });
  }, []);

  /*
   * ══ THE COLUMNS' WIDTHS — ONE PLACE THAT DECIDES THEM, AT THE MOMENTS THAT DECIDE THEM ══════
   *
   * `setColumnWidths` records a width as the operator's decision, and an effect keyed on the whole
   * tree fights that decision on every re-render — after an approve, after a second selection,
   * over a width just set by hand (measured 2026-09-30: a run put the column at 650, the next row
   * selection put it back to 380). So each shape is established at the one moment it is the
   * room's business — the room drawing, and the preview column appearing — and whatever happens
   * to the width afterwards stands.
   *
   * AND "APPLIED" MEANS THE CALL ACTUALLY LANDED: the first tree that arrives has no
   * `workspace-layout` to speak to yet, so the attempt retries frame by frame and gives up
   * quietly — an element that never appears is a room that is not drawn.
   */
  useEffect(() => {
    if (!designTree.components.length) return;

    // WHETHER THE COLUMN IS OPEN IS THE TREE'S FACT — the one line `setDesignPreview` writes for a
    // Submit and for a selected row alike — and reading it back off the DOM would be a second
    // answer to it.
    const root = designTree.components.find((c: any) => c.id === "root") as
      | { children?: Record<string, unknown> }
      | undefined;
    const previewOpen = !!root?.children?.middle;
    if (!previewOpen) previewWidthSetRef.current = false;

    let equalise = false;
    if (previewOpen && !previewWidthSetRef.current) equalise = true;
    else if (!previewOpen && !roomShapeSetRef.current) equalise = true;
    if (!equalise) return;

    let frames = 0;
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      const ws = (designRendererRef.current as any)?.shadowRoot?.querySelector("design-workspace");
      if (ws?.splitEqually) {
        ws.splitEqually();
        if (previewOpen) previewWidthSetRef.current = true;
        else roomShapeSetRef.current = true;
        return;
      }
      if (++frames >= 40) return;
      requestAnimationFrame(apply);
    };
    apply();
    return () => {
      cancelled = true;
    };
  }, [designTree]);

  /*
   * ══ THIS SEAT'S ACTION SURFACE ═══════════════════════════════════════════════════════════════
   *
   * Every button this tab owns is answered HERE and nowhere else: a row clicked in the tree, the
   * preview's approve / discard / remove / collision answer, and a card on the design home. These
   * are the Tools tab's actions — they are not the Console's, and the Console has no path to them.
   */
  useEffect(() => {
    /** The room's own rows, read fresh — the rows a row-click resolves against. */
    const rowsOf = () => ((designTree.dataModel as Record<string, any>)?.session?.elements ?? []) as any[];

    // ── RUN ONE: A ROW CLICKED IN THE TREE ──────────────────────────────────────────────────────
    // `figma-layers-view` is a NAVIGATION and says so in its own words. It dispatches
    // `open-component` and this is the answer.
    const onOpenComponent = async (event: Event) => {
      const detail = (
        event as CustomEvent<{
          tag?: string;
          facts?: Array<{ label: string; value: string }>;
          description?: string;
        }>
      ).detail;
      const tag = String(detail?.tag ?? "");
      if (!tag) return;
      /*
       * THE ROW'S OTHER FACTS ARRIVE WITH THE CLICK. A component row shows three things — the
       * name, the code and the description — and the rest is metadata in the preview panel. That
       * data is measured by the TREE, so the tree sends it with the click and this writes it
       * down; re-deriving it here would be a second reader of the same facts, and the two would
       * eventually disagree about the row the designer is looking at.
       *
       * THE ROOM'S OWN MODEL STILL CONTRIBUTES what the catalogue cannot know: which catalogues
       * declared the tag, whether it was ingested, when, and the last verdict. Labels already
       * carried by the click are skipped, so the panel never shows one fact twice.
       */
      const carried = Array.isArray(detail?.facts) ? detail.facts : [];
      const carriedLabels = new Set(carried.map((f) => f.label));
      const row = rowsOf().find((r) => r.id === tag || r.name === tag || r.key === tag);
      // WHAT THIS SURFACE CAN DRAW, SAID RATHER THAN LEFT AS A HOLE. The Composer's canvas pair
      // are catalogue entries but not elements of this interface — a row like that gets its facts
      // and one sentence, which is the truth about it.
      // ── THE ELEMENT HAS TO EXIST ON THE PAGE, NOT ONLY IN THE CATALOGUE ──────────────────────
      // The generated files are registered by a build-time glob in `components/lit/ingested.ts`.
      // A file written by an approval AFTER this page loaded is not in that list, so the row said
      // "declared in the catalogue but has no element on this surface" — true of the page, false of
      // the catalogue. Importing the component's own file here defines it now; a hand-built
      // component is already defined, and a missing file is reported in the panel rather than drawn
      // as a blank frame.
      let elementError = "";
      if (/^f-/.test(tag)) {
        try {
          await import(/* @vite-ignore */ `/src/components/lit/${tag}.ts`);
        } catch (error) {
          elementError = error instanceof Error ? error.message : String(error);
        }
      }
      const resolvedTag = resolveTag(tag);
      const drawableHere = !!resolvedTag && !!customElements.get(resolvedTag);
      // ── THE SAME DISPLAY AS AN INGEST ─────────────────────────────────────────────────────────
      // A row opened from the catalogue shows the record kept at approval: the drawn declarations
      // per layer, every fact read, every annotation and the source. ONE display, used in both
      // places (owner, 2026-10-26). A component approved before that record existed answers with
      // the declarations and the source and says which part is missing.
      const record = await apiFetch(`${API_BASE}/figma/component/${encodeURIComponent(tag)}`)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
      setDesignPreview({
        source: "open",
        tag,
        name: row?.name ?? tag,
        specs: (record?.specs as Array<Record<string, any>> | undefined) ?? [],
        readings: (record?.readings as Array<Record<string, any>> | undefined) ?? [],
        annotations: (record?.annotations as Array<Record<string, any>> | undefined) ?? [],
        componentSource: String(record?.source ?? ""),
        sourceBytes: Number(record?.sourceBytes ?? 0),
        // THE SAME DATA BINDING A DRAFT CARRIES: a row opened from the list is the component the
        // catalogue holds, and these are the values it is given in the room.
        values: previewValues(rowsOf(), tag),
        note: elementError
          ? `The catalogue holds ${tag}, and its file could not be loaded: ${elementError}. Nothing is drawn, and this is not an empty component.`
          : drawableHere
          ? /*
             * THE DESCRIPTION IN FULL, FROM THE ROW THAT CARRIED IT. The tile shows the catalogue's
             * first sentence; the whole text is what belongs in the panel. Where neither the tree
             * nor the model has one, that absence is said rather than left blank — a blank line
             * under a drawn component reads as "there is nothing to know about this one", a claim
             * nobody made.
             */
            detail?.description ||
            row?.description ||
            `No description is recorded for "${tag}" on this surface — the element is drawn, and what is known about it is not.`
          : `${row?.name ?? tag} is declared in the catalogue but has no element on this surface${resolvedTag ? ` (${resolvedTag})` : ""} — its drawing belongs to the Composer's run view, and this column draws the design system's components.`,
        alreadyInCatalogue: row ? !row.removed : true,
        facts: (() => {
          /*
           * THE ROW'S OWN FACTS FIRST — they are about the component itself. The room's model
           * follows with what only it knows. AND NOTHING IS SAID TWICE: two labels carrying one
           * sentence is not two facts (the model's `status` and its last verdict are often the
           * same catalog-check string), so a label already carried by the click is skipped, and so
           * is a value already shown — whichever label reached it first keeps it.
           */
          const said = new Set(carried.map((f) => f.value));
          const add = (f: { label: string; value: string } | null) => {
            if (!f || said.has(f.value)) return null;
            said.add(f.value);
            return f;
          };
          /*
           * THE VERDICT IS LISTED BEFORE THE STATUS, so that a row whose status IS the verdict —
           * which is most of these rows, the catalog-check string — shows it once, under the label
           * that names it: "Last verdict". A row whose status is a status is untouched.
           */
          return [
            ...carried,
            add(row?.catalogs ? { label: "Catalogues", value: String(row.catalogs) } : null),
            add(row?.last_ingest?.verdict ? { label: "Last verdict", value: String(row.last_ingest.verdict) } : null),
            add(
              row?.figma?.node_id && !carriedLabels.has("Figma node")
                ? { label: "Figma node", value: String(row.figma.node_id) }
                : null,
            ),
            add(row?.status ? { label: "Ingestion", value: String(row.status) } : null),
          ].filter(Boolean) as Array<{ label: string; value: string }>;
        })(),
      });
      // AND THE ROW IS MARKED AS THE OPEN ONE (owner, 2026-10-25): the list highlights the
      // selected row from the model, so the mark stands with the rest of the state.
      setDesignTree((prev: any) => {
        const session = (prev.dataModel as Record<string, any>)?.session ?? {};
        if (session.design_selected === tag) return prev;
        return {
          ...prev,
          dataModel: { ...prev.dataModel, session: { ...session, design_selected: tag } },
        };
      });
    };

    // ── THE PREVIEW'S ACTS ──────────────────────────────────────────────────────────────────────
    /*
     * THE STAGES OF A WRITE, AS THE SERVER RECORDS THEM. An approval and a removal are lists of
     * real stages, and the pane names the one running now rather than showing an unexplained turn.
     * The request that starts the work is the request that finishes it, so a small address returns
     * the list while it runs: `GET /api/figma/steps/<id>`, with a timestamp so a cached answer
     * cannot freeze a readout that is still moving.
     */
    const watchStages = (opId: string, base: Record<string, any> | null) => {
      if (!opId) return () => {};
      const timer = window.setInterval(async () => {
        try {
          const res = await apiFetch(`${API_BASE}/figma/steps/${opId}?t=${Date.now()}`);
          if (!res.ok) return;
          const data = (await res.json()) as { steps?: Array<{ text?: string }> };
          const steps = Array.isArray(data.steps) ? data.steps : [];
          const last = steps[steps.length - 1]?.text;
          if (last) setDesignPreview({ ...(base ?? {}), progress: String(last) });
        } catch {
          // The request itself reports its own failure; a missed poll is not a second error.
        }
      }, 500);
      return () => window.clearInterval(timer);
    };

    const onPreviewApprove = async (event: Event) => {
      const detail = (event as CustomEvent<{ preview?: Record<string, any>; patterns?: string[] }>)
        .detail;
      const preview = detail?.preview;
      // THE TICKED CHILD PATTERNS, as the panel drew them. A pattern the designer left unticked is
      // not written and not touched — the server is told which tags to write and writes those.
      const chosenPatterns = Array.isArray(detail?.patterns) ? detail!.patterns : undefined;
      const jobId = preview?.jobId;
      // A row opened from the list has no job behind it: that component is already in the
      // catalogue, and approving it is not a thing this room can do. Said plainly rather than
      // firing a call that cannot succeed.
      if (!jobId) {
        setDesignIngest({ busy: false, message: "That component is already in the catalogue — there is nothing to approve. Approve is for a component an ingest just built." });
        return;
      }
      setDesignIngest({ busy: true, message: "" });
      // THE PANEL SAYS IT IS APPROVING, so the wait is reported where the button is rather than
      // only in the form. It used to be silent: the button stayed live and the pane closed when
      // the answer arrived, which is the silence the owner named.
      const approveOp = generateUuid();
      const stopApprovalStages = watchStages(
        approveOp,
        preview ? { ...preview, approving: true, progress: "Starting the approval…" } : null,
      );
      setDesignPreview(
        preview
          ? { ...preview, approving: true, progress: "Starting the approval…" }
          : null,
      );
      try {
        const res = await apiFetch(`${API_BASE}/figma/commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            /*
             * THE DESIGNER'S ANSWER OUTRANKS THE TAG'S OWN HISTORY. A collision answer names the
             * component this draft is to be written UNDER, replacing it — that is the one thing
             * the question exists for. With no answer, the room keeps the behaviour it had: a tag
             * the catalogue already holds is replaced by this draft (the re-ingest case), and a
             * new one is added. An unanswered collision commits as its own component, which is
             * the default the panel states in words.
             */
            overwriteTag: preview?.collisionAnswer || (preview?.alreadyInCatalogue ? preview?.tag : undefined),
            patternTags: chosenPatterns,
            opId: approveOp,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail || "Approve failed");
        const tag = String(preview?.tag ?? "");
        const registration = (data?.registration ?? {}) as Record<string, unknown>;
        const patterns = (registration.patterns ?? {}) as {
          added?: string[];
          replaced?: string[];
          skipped?: Array<{ tag?: string; reason?: string }>;
          leftAlone?: string[];
        };
        // THE CHILDREN ARE NAMED IN THE CONFIRMATION, added, replaced, or NOT WRITTEN with the
        // reason. A pattern that was skipped is the thing the designer must see.
        const patternText = [
          patterns.added?.length ? `Patterns added: ${patterns.added.join(", ")}.` : "",
          patterns.replaced?.length ? `Patterns replaced: ${patterns.replaced.join(", ")}.` : "",
          patterns.skipped?.length
            ? `Patterns not written: ${patterns.skipped
                .map((entry) => `${entry.tag} (${entry.reason})`)
                .join("; ")}.`
            : "",
          // LEFT ALONE IS AN OUTCOME, NOT A FAILURE: the designer left the box unticked, so the
          // component that was there is still there, unchanged.
          patterns.leftAlone?.length
            ? `Patterns left as they were: ${patterns.leftAlone.join(", ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        const confirmation =
          `Added to the catalogue as ${tag}.` +
          (registration.figmaMap ? ` Figma map: ${String(registration.figmaMap)}.` : "") +
          (registration.allowlist ? ` Allowlist: ${String(registration.allowlist)}.` : "") +
          (registration.catalog ? ` Catalogue: ${String(registration.catalog)}.` : "") +
          (patternText ? ` ${patternText}` : "");
        // ── THE PANEL STAYS OPEN, SHOWING WHAT WAS WRITTEN ────────────────────────────────────
        // The draft's file is deleted by the approval, so the pane switches to the component the
        // catalogue now holds — the same display as selecting that row — with the confirmation at
        // the top. Closing the column and saying nothing is what the owner saw, and it read as a
        // failure.
        const record = await apiFetch(`${API_BASE}/figma/component/${encodeURIComponent(tag)}`)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null);
        setDesignPreview({
          source: "open",
          tag,
          name: String(preview?.name ?? tag),
          alreadyInCatalogue: true,
          note: confirmation,
          values: previewValues(rowsOf(), tag),
          specs: (record?.specs as Array<Record<string, any>> | undefined) ?? [],
          readings: (record?.readings as Array<Record<string, any>> | undefined) ?? [],
          annotations: (record?.annotations as Array<Record<string, any>> | undefined) ?? [],
          componentSource: String(record?.source ?? ""),
          sourceBytes: Number(record?.sourceBytes ?? 0),
        });
        setDesignIngest({ busy: false, message: confirmation, refresh: Date.now() });
        window.dispatchEvent(
          new CustomEvent("design-row-selected", { detail: { tag } }),
        );
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        // THE READOUT ENDS ON THE FAILURE, in the same place the stages were named.
        setDesignPreview(preview ? { ...preview, approving: false, progress: text } : null);
        /* A PREVIEW IS NOT A JOB, AND THERE IS ONLY ONE. When it is no longer held — discarded,
           approved, or replaced by a newer ingest — the preview is gone for good, and that is a
           state to state, not a server error to relay. */
        if (/no drafts held/i.test(text)) {
          setDesignPreview(null);
          setDesignIngest({ busy: false, message: "" });
          return;
        }
        setDesignIngest({ busy: false, message: text || "Approve failed" });
      } finally {
        stopApprovalStages();
      }
    };

    /*
     * ── THE DESIGNER'S ANSWER TO THE COLLISION QUESTION ─────────────────────────────────────────
     *
     * The panel asks and dispatches the answer; this records it on the preview so the approve can
     * send it and the panel draws which answer is standing. It writes the SEAT's state and never
     * the catalogue: approving is what writes, and the answer is one of the things approve carries.
     *
     * THE ANSWER IS READ BACK OFF THE PREVIEW rather than kept in a second variable: the preview
     * is where every other fact about this run lives, and a copy beside it would be a second place
     * that can disagree about what was chosen.
     */
    const onCollisionAnswer = (event: Event) => {
      const overwriteTag = (event as CustomEvent<{ overwriteTag?: string | null }>).detail?.overwriteTag ?? null;
      const current = (designTree.dataModel as Record<string, any>)?.session?.preview;
      if (!current) return;
      setDesignPreview({ ...current, collisionAnswer: overwriteTag });
    };

    /*
     * DISCARD, AND THE TEMPORARY FILE GOES WITH IT: this clears the pane AND tells the server
     * (`POST /api/figma/discard` — the same call the modal's own discard makes), so the draft does
     * not stay held after a discard. A row opened from the list has no draft and nothing to
     * discard.
     */
    const onPreviewDiscard = async (event: Event) => {
      const preview = (event as CustomEvent<{ preview?: Record<string, any> }>).detail?.preview;
      const jobId = preview?.draft?.jobId ?? preview?.jobId;
      if (!jobId) {
        setDesignPreview(null);
        setDesignIngest({ busy: false, message: "" });
        return;
      }
      // THE PANEL STAYS OPEN WHILE THE REMOVAL RUNS, AND THE BUTTON SAYS SO. Clearing the pane
      // first removed the button before it could report anything, so a discard was a click with no
      // evidence. The button now turns until the server has answered, and the pane closes on that
      // answer — the request is the delay, and it is the only delay there is.
      setDesignPreview(preview ? { ...preview, discarding: true } : null);
      try {
        const res = await apiFetch(`${API_BASE}/figma/discard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        if (!res.ok) throw new Error(`the server answered ${res.status}`);
        setDesignPreview(null);
        setDesignIngest({ busy: false, message: "", refresh: Date.now() });
      } catch (err) {
        setDesignPreview(null);
        // THE PANE IS CLEARED EITHER WAY, AND THE FAILURE IS SAID RATHER THAN SWALLOWED. The draft
        // lives in the server's memory, so a server that cannot be reached has already lost it —
        // holding the pane open would hold the designer hostage to a backend that is down. But a
        // discard that never arrived is a fact, and this sentence is the same one the ingest form
        // shows for the same failure, so the two panes cannot disagree about what happened.
        setDesignIngest({
          busy: false,
          message:
            `A draft was cleared here but the server was not told: ${err instanceof Error ? err.message : String(err)}. ` +
            `Nothing was written to the catalogue, so nothing is left behind — the temporary file stays in frontend/.preview until a new ingest replaces it or the screen leaves.`,
          refresh: Date.now(),
        });
      }
    };

    /*
     * REMOVE, AND IT IS THE CALL THE INGEST FORM ALREADY MAKES.
     *
     * `POST /api/figma/remove` takes a component out of everything the catalogue holds it in — its
     * file, the Figma map, the allowlist, the catalogue, the layer record and the artwork it was
     * written with (`_remove_component`, backend/routes/figma.py) — so this runs that call and
     * nothing else. A view never writes to the catalogue: the panel asks, and this is the asking.
     *
     * THE CONFIRMATION IS THE PANEL'S, NOT THIS ONE'S — by the time this runs the person has named
     * the component twice. A FAILURE IS SAID RATHER THAN SWALLOWED, in the panel where the click
     * was made, and "nothing was removed" is the only thing that can be promised when the server
     * could not be reached, because the server may have removed it and failed on the reply.
     */
    const onPreviewRemove = async (event: Event) => {
      const preview = (event as CustomEvent<{ preview?: Record<string, any> }>).detail?.preview;
      const tag = String(preview?.tag ?? "");
      if (!tag) return;
      setDesignIngest({ busy: true, message: "" });
      // THE PANEL SAYS IT IS REMOVING. A removal deletes the file, every registration, the record,
      // the artwork, regenerates the manifest and runs the catalogue audit — it is not instant, and
      // the button used to close the pane before it began, which read as a dead control.
      const removeOp = generateUuid();
      const stopRemovalStages = watchStages(
        removeOp,
        preview ? { ...preview, removing: true, progress: "Starting the removal…" } : null,
      );
      setDesignPreview(
        preview ? { ...preview, removing: true, progress: "Starting the removal…" } : null,
      );
      try {
        const res = await apiFetch(`${API_BASE}/figma/remove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tag,
            opId: removeOp,
            reason: "removed from the catalogue preview",
            // THE CATALOGUE THE PERSON IS STANDING IN (owner, 2026-10-25): the server removes
            // the row from THIS catalogue. Without it the removal always edited the ingest's own
            // catalogue, so the row in ecommerce or carbon stayed and only the shared
            // registrations changed — the component was deactivated, not removed.
            catalog:
              String((designTree.dataModel as Record<string, any>)?.session?.design_catalogue || "") ||
              undefined,
          }),
        });
        if (!res.ok) {
          /*
           * A REFUSAL IS NOT A FAILURE, AND IT CARRIES ITS REASON. `409` is the liveness guard at
           * work: the component is named by the application's own code and removing it would break
           * what names it. The server sends `{note, namedBy, nextStep}` — the files that name it
           * and what to do — so this shows THAT rather than "the server answered 409", which would
           * leave the person with a number and no next step. Any other status has no such body and
           * falls back to the status, which is the honest thing to show when nothing else is known.
           */
          const body = await res.json().catch(() => null);
          const detail = body?.detail;
          if (detail && typeof detail === "object" && detail.note) {
            throw new Error(`${detail.note} ${detail.nextStep ?? ""}`.trim());
          }
          throw new Error(
            typeof detail === "string" ? detail : `the server answered ${res.status}`,
          );
        }
        // THE PANEL STAYS WITH THE ANSWER: what was removed, and that the actions are gone.
        setDesignPreview(
          preview
            ? {
                ...preview,
                removing: false,
                removed: true,
                alreadyInCatalogue: false,
                note: `Removed ${tag} from the catalogue — its file, Figma map entry, allowlist entry, catalogue entry and layer record are deleted.`,
              }
            : null,
        );
        setDesignIngest({ busy: false, message: `Removed ${tag} from the catalogue.`, refresh: Date.now() });
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        // THE PANEL KEEPS THE REASON AND STOPS SAYING "REMOVING…": a spinner left turning after a
        // failure claims work that has stopped. The stage line keeps the failure, so the readout
        // ends on the stage that stopped rather than vanishing.
        setDesignPreview(
          preview ? { ...preview, removing: false, progress: text } : null,
        );
        setDesignIngest({
          busy: false,
          message: `Nothing was removed: ${text} The catalogue still holds ${tag} until a removal lands.`,
          refresh: Date.now(),
        });
      } finally {
        stopRemovalStages();
      }
    };

    /*
     * A CARD ON THE DESIGN HOME OPENS THAT ELEMENT. `ConsoleCardGrid` dispatches `card-open` with
     * the card's id. On the Design home the grid is bound to `/session/elements`, so that id is an
     * element key — the key `figma-layers-view` rows already send. This answers it with the same
     * `open-component` event the tree uses, and only when the id IS one of this room's elements, so
     * the console's own cards (packages, product projects) are never captured here.
     */
    const onDesignCardOpen = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const id = String(detail.id ?? detail.sessionId ?? "");
      if (!id) return;
      const elements = (((designTree?.dataModel as Record<string, any>)?.session?.elements) ?? []) as any[];
      const isDesignElement = elements.some((r) => String(r?.id) === id || String(r?.key) === id);
      if (!isDesignElement) return;
      window.dispatchEvent(new CustomEvent("open-component", { detail: { tag: id } }));
    };

    const onlyWhenStanding = (fn: (event: Event) => unknown) => (event: Event) => {
      if (!activeRef.current) return;
      void fn(event);
    };
    const gOpen = onlyWhenStanding(onOpenComponent);
    const gCard = onlyWhenStanding(onDesignCardOpen);
    const gApprove = onlyWhenStanding(onPreviewApprove);
    const gDiscard = onlyWhenStanding(onPreviewDiscard);
    const gRemove = onlyWhenStanding(onPreviewRemove);
    const gCollision = onlyWhenStanding(onCollisionAnswer);
    window.addEventListener("open-component", gOpen);
    window.addEventListener("card-open", gCard);
    window.addEventListener("preview-approve", gApprove);
    window.addEventListener("preview-discard", gDiscard);
    window.addEventListener("preview-remove", gRemove);
    window.addEventListener("preview-collision-answer", gCollision);

    // ── ONE CATALOGUE, WRITTEN TO THE MODEL ────────────────────────────────────────────────
    // Owner, 2026-10-26: *"We only need the official one."* The rail no longer offers a choice, so
    // the model's fact is the official catalogue and nothing else. This also corrects a stored
    // choice from an earlier session: the binding reads `/session/design_catalogue`, and a name
    // left there would point the list at a catalogue that is no longer offered.
    setDesignTree((prev: any) => {
      const session = (prev.dataModel as Record<string, any>)?.session ?? {};
      if (session.design_catalogue === "prompt-composer") return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, design_catalogue: "prompt-composer" },
        },
      };
    });
    return () => {
      window.removeEventListener("open-component", gOpen);
      window.removeEventListener("card-open", gCard);
      window.removeEventListener("preview-approve", gApprove);
      window.removeEventListener("preview-discard", gDiscard);
      window.removeEventListener("preview-remove", gRemove);
      window.removeEventListener("preview-collision-answer", gCollision);
    };
  }, [designTree, setDesignIngest, setDesignPreview]);

  /*
   * THE CONTENT REPORT — every time this engine's tree changes, the room is told what to inject
   * and what the chat should be bound to. Headless only: a drawn seat needs none of this.
   */
  useEffect(() => {
    if (!headless) return;
    const content = buildContent(designTree);
    if (content) onContent?.(content);
  }, [headless, designTree, onContent]);

  /*
   * THIS SEAT'S CHAT IS IN ITS OWN TREE — the `chat-panel` the `render-design` surface emits,
   * bound to this section's conversation. Nothing is drawn over it and nothing is mounted around
   * it from here.
   */
  if (headless) return null;
  return <design-renderer ref={designRendererRef} />;
}
