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
import { isCardLocked, lockedCardSentence } from "@/rooms/design/cardLifecycle";
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
   * A kept session to reopen — a session card clicked on the design console (owner, 2026-11-01).
   * The room hands the id over; the assembly then builds this tab IN that session, so its
   * conversation, its title, its address and its notes are the ones on screen.
   */
  openSession?: string | null;
  /**
   * THE DESIGN SYSTEM A CARD ASKED FOR (owner, 2026-11-02). A system card's key is `system:<id>`
   * and the id is the catalogue's own name; the tab is then built in THAT catalogue through the
   * assembly's own door (`render-design:<system>`). Null means the tab's default catalogue.
   */
  openSystem?: string | null;
  /**
   * THE TAB PRESS COUNT (owner, 2026-11-07). Every press of the Tools tab is a new session, and a
   * press whose session id is already empty changes none of the other props — so the press itself
   * has to be a value this seat can see. It increments on each press, and the assembly effect
   * reads it; a card open carries both its id and the press.
   */
  press?: number;
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

/**
 * THE SAME THREE VALUES? — compared as a person means them, so surrounding space is not an edit.
 *
 * Owner, 2026-11-02, on the question asked when leaving Tools: *"there is no need to [ask] if
 * nothing has changed after opening."* A reopened session already carries its title, its address
 * and its notes, and asking whether to keep them when not one of them was touched is a question
 * about a decision already made.
 */
function sameFields(
  a: { title: string; url: string; notes: string },
  b: { title: string; url: string; notes: string },
): boolean {
  return a.title.trim() === b.title.trim()
    && a.url.trim() === b.url.trim()
    && a.notes.trim() === b.notes.trim();
}

export default function ToolsSeat({ onAssemblingChange, openTag, openSession, openSystem, press, headless, active, onContent }: ToolsSeatProps) {
  /**
   * THE CATALOGUE A VISIT DEFAULTS TO — the official one, and the design console's own card for it
   * (`system:prompt-composer`) names this same id, so pressing that card asks for what already
   * stands instead of asking for a different build.
   */
  const DEFAULT_CATALOGUE_SYSTEM = "prompt-composer";
  /**
   * THE SYSTEM THIS VISIT IS IN, readable inside effects that must not re-run when it changes.
   * The catalogue write below runs with the tree's other wiring, so it reads this rather than
   * taking `openSystem` as a dependency and rebuilding the whole section on a card press.
   */
  const loadedSystemRef = useRef(DEFAULT_CATALOGUE_SYSTEM);
  loadedSystemRef.current = String(openSystem ?? "").trim() || DEFAULT_CATALOGUE_SYSTEM;
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
  /*
   * THE LOCKOUT, READ BEFORE ANY ACTION. The session's lifecycle is the server's answer
   * (`card_state`) and its own `locked` flag. Every handler that could re-ingest, save or close
   * this card reads the ref, so a stale element cannot drive a locked card even if the canvas
   * is still in the DOM for one frame.
   */
  const treeSession = ((designTree.dataModel as Record<string, any>)?.session ?? {}) as Record<string, any>;
  const treeCardState = String(treeSession.card_state ?? "");
  const treeLocked = treeSession.locked === true || isCardLocked(treeCardState);
  const lockedRef = useRef(false);
  lockedRef.current = treeLocked;
  const lockedStateRef = useRef("");
  lockedStateRef.current = treeCardState;
  const [currentDesignSession, setCurrentDesignSession] = useState<Record<string, any> | null>(null);
  /**
   * WHICH ASSEMBLY OWNS THE SCREEN. Two reads can be in flight — a card pressed while the previous
   * tab's read still runs, or a tab press during a card's read — and the server answers them in
   * whatever order it finishes. Only the newest may write the tree, or an older answer lands on
   * the screen after the newer one and the person sees the session they already left.
   */
  const assemblySeqRef = useRef(0);

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
  const assembleDesignSurface = useCallback(async (reopenSessionId?: string | null, system?: string | null, seq?: number) => {
    /*
     * WHICH CATALOGUE THE TAB IS BUILT IN. The assembly's own door already carries it: an intent of
     * `render-design:<system>` resolves THAT design system's container and its catalogue, and plain
     * `render-design` is the default. A card that names a system asks through this door; a visit
     * that names none asks exactly as it always has.
     */
    const wanted = String(system ?? "").trim();
    // A CARD NAMES ITS SYSTEM, INCLUDING THE DEFAULT ONE. The default card carries the same
    // catalogue the plain tab reads, and it also owns the chat: *"These chats are not global. They
    // are specific to the card."* A visit that names no system at all still asks plainly.
    const intent = wanted ? `render-design:${wanted}` : "render-design";
    const response = await apiFetch(`${API_BASE}/ai/assemble-surface`, {
      method: "POST",
      // A KEPT SESSION'S ID TRAVELS WITH THE ASK (owner, 2026-11-01). Without it the server builds
      // the tab in its own working row; with it, the tab is built in THAT session — its
      // conversation, its title, its address and its notes. The server decides whether the id is
      // this person's own kept session; an id it will not adopt opens the working row instead.
      body: JSON.stringify({
        intent,
        ...(reopenSessionId ? { session_id: reopenSessionId } : {}),
      }),
    });
    const rawData = await response.json();
    const read = readA2UIEnvelope(rawData);
    if (read.ok === false) {
      console.error(`🤖 [A2UI] ENVELOPE REFUSED for render-design — ${read.refusal.code}: ${read.refusal.message}`);
      throw envelopeRefusalError(read.refusal);
    }
    const reading = read.reading;
    /* AN ANSWER FROM A READ THE PERSON HAS ALREADY MOVED PAST IS NOT DRAWN. */
    if (seq !== undefined && seq !== assemblySeqRef.current) return;
    setDesignTree({
      // THE TOOLS TAB'S CHAT IS DESIGN'S CHAT. The section still names its seat `chat-panel`;
      // the seat draws `design-chat` — Design's own element. The rename touches no binding:
      // every prop path lands on the same property names.
      components: (reading.components as any[]).map((c) =>
        c?.component === "chat-panel" ? { ...c, component: "design-chat" } : c,
      ),
      dataModel: (() => {
        const model = reading.dataModel as Record<string, any>;
        if (restoredQueryRef.current === null) return model;
        return {
          ...model,
          session: { ...(model?.session ?? {}), design_query: restoredQueryRef.current },
        };
      })(),
    });
    setCurrentDesignSession((reading.dataModel as Record<string, any>)?.session ?? null);
    /*
     * EVERY ASSEMBLY IS A NEW VISIT'S PAGE. The seat is kept mounted across visits, so the flags
     * of the visit that was left must not decide this one's leave question. The saved preview is
     * read from the session and marked restored below; the conversation carries its own history.
     */
    failureRecordedRef.current = false;
    keptThisVisitRef.current = false;
    previewRef.current = null;
    liveConversationRef.current = null;
    setDesignPreviewOpen(false);
    /*
     * THE FORM'S THREE VALUES COME FROM THE SAME ANSWER. On a reopened session they are the ones
     * it was kept with; on a fresh visit they are empty. Seeded HERE, once per assembly, and not
     * from a watcher: a watcher would rewrite the fields while the person was typing in them.
     */
    const assembled = (reading.dataModel as Record<string, any>)?.session?.form ?? {};
    formFieldsRef.current = {
      title: String(assembled.title ?? ""),
      url: String(assembled.url ?? ""),
      notes: String(assembled.notes ?? ""),
    };
    // AND WHERE THE VISIT STARTED. A reopened session's own values are not work to save.
    formBaselineRef.current = { ...formFieldsRef.current };
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
    /* THE STANDING TAB IS THE ONE THAT ASSEMBLES. A Home press clears the opened session and sets
       this seat down; without this guard it would still read a new Tools session in the
       background, on a tab the person is not looking at. A card open sets the tab standing in
       the same event, so its id still arrives with `active` true. */
    if (!active && !openSession) return;
    /* THE PRESS IS THE SESSION BOUNDARY. The nonce makes every Tools press assemble, even when
       the id it carries is the same empty value as the last one; the flag the save and discard
       set stands down because this read is the fresh session they asked for. */
    needsAssemblyRef.current = false;
    const seq = ++assemblySeqRef.current;
    let cancelled = false;
    /*
     * THE PAGE STARTS WITH NO SESSION. Until the server names this visit's row, there is no
     * session on this page — and a failed read must not leave the PREVIOUS visit's row standing
     * as this page's record, or leaving would discard a session this page never opened.
     */
    setDesignTree({ components: [], dataModel: {} });
    setCurrentDesignSession(null);
    void (async () => {
      try {
        // A CARD'S KEPT SESSION IS THE ASK, WHEN THERE IS ONE (2026-11-01). The id changes when a
        // session card is pressed, so this effect re-runs and the tab is rebuilt in that session.
        // A DESIGN SYSTEM'S CARD IS THE OTHER ASK (2026-11-02): the system rebuilds the tab in that
        // catalogue, and either ask alone leaves the other at its default.
        await assembleDesignSurface(openSession ?? null, openSystem ?? null, seq);
      } catch (err) {
        // The refusal is reported, never swallowed: the room drew nothing because the door said
        // no, and the reason is the server's own words.
        console.error('🤖 [A2UI] the tools seat could not assemble:', err);
        const message = `**The Tools page could not be opened.** ${
          err instanceof Error ? err.message : String(err)
        }`;
        window.dispatchEvent(
          new CustomEvent("a2ui:system-message", {
            detail: { role: "assistant", content: message, alert: true, tab: "tools" },
          }),
        );
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
    /* `active` is read by the guard but is NOT a dependency: a card's read starts while the
       console is still standing, and making the Tools tab standing when the content lands would
       otherwise run this effect a second time and read the same card again. */
  }, [assembleDesignSurface, openTag, openSession, openSystem, press]);

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
         its rail shows Tools. The conversation is the engine's own, carried by the surface.

         FOUND BY ITS MARK, NOT ITS TAG (2026-10-31). The Tools tab draws `tools-chat` now, its own
         element, so a lookup by the room's tag would find nothing. The shell writes
         `data-design-chat` on every container it opens, and that mark finds the seat whatever its
         tag is. */
      const seat = (roomEl?.querySelector("[data-design-chat]") as
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
   * THE LOG LINE IS WRITTEN BY THE SEAT THAT MADE THE RUN. The chat element also writes host
   * lines, but only while it is bound to a conversation; an ingest can fail before that binding
   * exists, and the line was then drawn locally and lost. The seat knows this session's own
   * conversation, so it writes the line there first and then hands it to the chat with
   * `persisted` set — the chat draws it and does not write a second copy.
   */
  const persistIngestLine = useCallback(async (content: string, alert: boolean): Promise<boolean> => {
    const session = (designTreeRef.current.dataModel as Record<string, any>)?.session ?? {};
    const conversationId =
      liveConversationRef.current || String(session?.right_column?.conversation_id ?? "");
    if (!conversationId) return false;
    const response = await apiFetch(
      `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "assistant",
          content,
          metadata: { source: "host", alert },
        }),
      },
    );
    if (!response.ok) throw new Error(`the conversation answered ${response.status}`);
    return true;
  }, []);

  /**
   * ONE LINE IN THE CHAT, WRITTEN ONCE. The seat writes the line into the session's conversation
   * first, then hands it to the chat with `persisted` set, so the chat draws it and does not write
   * a second copy. This is the same path the ingest's pass and failure lines use; the accept,
   * approve, remove and existing-component messages go through it so every workflow step is in
   * the card's log and survives a reload.
   */
  const sayInChat = useCallback(
    async (content: string, alert = false): Promise<void> => {
      let stored = false;
      try {
        stored = await persistIngestLine(content, alert);
      } catch (error) {
        console.error("the workflow line could not be saved:", error);
      }
      window.dispatchEvent(
        new CustomEvent("a2ui:system-message", {
          detail: {
            role: "assistant",
            content,
            alert,
            persisted: stored,
            tab: "tools",
          },
        }),
      );
    },
    [persistIngestLine],
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
      const detail = (event as CustomEvent<{ title?: string; url?: string; notes?: string }>).detail ?? {};
      const typed = String(detail.url ?? "").trim();
      if (!typed || designIngestBusy) return;
      /* THE VAULT LOCK. A queued card is not re-ingested; the server refuses it too, and the
         workspace panel has already replaced this form with the read-only ledger. */
      if (lockedRef.current) {
        setDesignIngest({ busy: false, message: lockedCardSentence(lockedStateRef.current) });
        return;
      }
      /*
       * THE FORM'S THREE VALUES, WRITTEN WHERE THE FORM READS THEM. The submitted title was
       * discarded here before — the handler read only the URL and the notes — so the name the
       * person typed never reached the session or the left column. One write, before the request,
       * and the session row, the form and Save all see the same three values.
       */
      const submitted = {
        title: String(detail.title ?? ""),
        url: String(detail.url ?? ""),
        notes: String(detail.notes ?? ""),
      };
      formFieldsRef.current = submitted;
      setDesignTree((prev) => {
        const session = (prev.dataModel as Record<string, any>)?.session ?? {};
        const form = { ...(session.form ?? {}), ...submitted };
        return { ...prev, dataModel: { ...prev.dataModel, session: { ...session, form } } };
      });

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
      let applied = false;
      let failureReported = false;
      /**
       * ONE FAILURE, ONE TURN. The poll and the long request both see the same refusal; without
       * this guard each reported it and the chat showed the same failure twice.
       */
      const reportFailure = (raw: string, code: string) => {
        if (failureReported) return;
        failureReported = true;
        reportIngestFailure(raw, code);
      };
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        window.dispatchEvent(new CustomEvent('ingest-settled'));
      };
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
        /*
         * ONE ANSWER PATH, TWO DOORS. The long POST carries the finished result, and the status
         * poll carries the same result once the job says "done". Whichever arrives first applies
         * it; the other stands down. That is how a late poll stops painting a spinner over a
         * finished read, and how a lost long response is not a reason to wait forever.
         */
        const applyIngestResult = (result: Record<string, any>, jobId: string): void => {
        const details = (result.details ?? {}) as Record<string, any>;
        /*
         * THE DESIGN NAMES THE SESSION WHEN NOBODY HAS. The person may leave the Title empty and
         * let the design speak for itself; then the node's own name becomes the title the left
         * column shows and the name the card is saved under. A title the person typed is never
         * overwritten.
         */
        const designName = String(details.target_node_name ?? "").trim();
        if (designName && !formFieldsRef.current.title.trim()) {
          formFieldsRef.current = { ...formFieldsRef.current, title: designName };
          setDesignTree((prev) => {
            const session = (prev.dataModel as Record<string, any>)?.session ?? {};
            const form = { ...(session.form ?? {}), title: designName };
            return { ...prev, dataModel: { ...prev.dataModel, session: { ...session, form } } };
          });
        }
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
          | { jobId?: string; tag?: string; module?: string; script?: string; modulePath?: string; moduleUrl?: string }
          | null;
        const hasAddress = !!draft?.script || !!draft?.moduleUrl;
        // THE COMPILE VERDICT, carried from the form: `validation` is the ingest's own esbuild
        // verdict per tag; a tag with no entry is not a failure.
        const validation = (result.validation ?? {}) as Record<string, { ok?: boolean; error?: string }>;
        const builtTag = String(result.tag ?? details.target_tag ?? "");
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
        /* NO FONT LINE, BECAUSE NOTHING IS REPLACED (owner, 2026-11-01). The draft now carries the
           family the design states; the line that stood here claimed the application would draw its
           own face instead, which is no longer true. The faces are in the fact list, per layer. */
        const fontLine = "";
        /* THE FACE QUESTION (plan 1.5, 2026-11-03). The backend names every family the design
           states that this system does not ship, with the layers that state it. The sentence and
           the two choices are handed to the chat as one event; the chat owns the words in the
           thread, and its buttons own the two acts. Nothing is decided here. */
        const fontNotice = (result as any)?.fidelity?.fontNotice as
          | { statement?: string; faces?: Array<{ family?: string; layers?: string[] }> }
          | null
          | undefined;
        const fontFaces = (Array.isArray(fontNotice?.faces) ? fontNotice!.faces : [])
          .map((face) => ({
            family: String(face?.family ?? "").trim(),
            layers: (Array.isArray(face?.layers) ? face!.layers! : []).map(String).filter(Boolean),
          }))
          .filter((face) => face.family);
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
        /* THE SECOND READING. The same node was measured over REST and over Figma's desktop MCP,
           and the backend's own sentence says how many facts the two channels agree on and what
           each disagreement is. It leads the answer because it says how much of the answer has a
           second opinion behind it — an unread second channel is not agreement. */
        const twoPass = (result as any)?.twoPass as
          | { summary?: string; mcpError?: string | null; counts?: Record<string, number>;
              rows?: Array<Record<string, any>> }
          | undefined;
        const twoPassLine = String(twoPass?.summary || "");
        /* HOW THE DESIGN WAS READ — one line, and only when there is something to say. It stands
           above the verdict because it is a statement about the READING, not about the design: an
           answer that needed a second ask says so, and an answer that answered first time says
           nothing rather than a line nobody needs. */
        const readRecord = (result as any)?.read as
          | { summary?: string; attempts?: Array<Record<string, any>>; answeredBy?: number }
          | undefined;
        const readLine = String(readRecord?.summary || "");
        /* WHICH CHANNEL EACH FACT CAME FROM (plan 1.3, 2026-11-03). The two-pass rows carry the
           chosen source per layer and fact; the reading rows are the table the person reads. The
           merge is by the layer's name and the fact's name, the same two facts the two reports
           already print. A fact the second pass did not reconcile keeps no source rather than a
           guessed one. */
        const chosenByFact = new Map<string, string>();
        for (const row of Array.isArray(twoPass?.rows) ? twoPass!.rows! : []) {
          const key = `${String(row?.layer ?? "")}\u0000${String(row?.fact ?? "")}`;
          if (row?.chosen && key !== "\u0000") chosenByFact.set(key, String(row.chosen));
        }
        const readingsWithSource = ((((result.fidelity as Record<string, any> | undefined)?.readings) ?? []) as Array<Record<string, any>>)
          .map((row) => ({
            ...row,
            chosen: chosenByFact.get(`${String(row?.layer ?? "")}\u0000${String(row?.fact ?? "")}`) ?? "",
          }));
        setDesignPreview({
          source: "ingest",
          // THE PREVIEW IS ISOLATED: it reads the Figma file and draws it. The status is the
          // workflow step, not the gate: Pending acceptance, then Accepted, then Approved.
          status: "Pending acceptance",
          accepted: false,
          // THE CHAT OWNS THE ACTIONS. The third column draws the component and the file's own
          // metadata; accept, approve and discard are said in the conversation.
          chatControls: true,
          tag: builtTag,
          // THE WHOLE MEASURED TREE, so the list can open the component it just ingested. Every
          // layer, nested, with the names and sizes the design states.
          tree: ((result as any)?.details?.spec as Record<string, any> | undefined) ?? null,
          // THE CATALOGUE WRITE SET IS NOT PART OF THE PREVIEW. The preview compares nothing
          // against the system; approval names the children the server wrote in the chat.
          patterns: [],
          // THE DRAWN DECLARATIONS PER LAYER — the specs list the panel shows beside the drawing.
          specs: ((details.specs as Array<Record<string, any>> | undefined) ?? []),
          // THE GATE'S READINGS ARE NOT DRAWN HERE. The preview is a read of the file, not a
          // comparison report; the exact gap is said in the chat and kept in the activity row.
          readings: [],
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
          /*
           * THE CATALOGUE COMPARISON, CARRIED FOR THE APPROVAL QUEUE — NOT DRAWN HERE.
           *
           * The preview is ephemeral and blind: it draws the design's own facts and nothing about
           * the catalogue. The comparison the ingest made — whether the tag already exists, the
           * entry whose layer name matches, the layers whose names already exist on other
           * components — is approval material. It travels with the run, under this one field, so
           * the approval reads it; no renderer in the preview reads it.
           */
          approvalFacts: {
            alreadyInCatalogue: !!result.alreadyInCatalogue,
            existing: existingName?.tag ? existingName : undefined,
            collisions: Array.isArray(result.nameCollisions) ? result.nameCollisions : [],
            instances: Array.isArray(result.nameInstances) ? result.nameInstances : [],
          },
          jobId,
          draft,
          // THE DATA BINDING, IN THE PREVIEW — what this component will be given, from the rows
          // the database holds. A tag with no row yet carries an empty list, which is a component
          // being created rather than a value being hidden.
          values: previewValues(
            ((designTree.dataModel as Record<string, any>)?.session?.elements ?? []) as any[],
            builtTag,
          ),
          // THE PREVIEW'S ONE LINE IS THE WORKFLOW STEP. The comparison report is not drawn here;
          // the chat carries it, and the activity row keeps the exact profile. The preview reads
          // the Figma file and draws it, and nothing else.
          noteLines: [
            "Read from the Figma file. Accept the drawing to hold it for approval.",
            replacedPreview ? "The preview you had open was replaced by this one — nothing needed discarding first." : "",
            hasAddress ? "" : `Nothing to render — no compiled module came back (job ${jobId}).`,
          ].filter(Boolean),
          // THE GATE'S GAPS ARE NOT PREVIEW CONTENT. The chat names them; the preview is isolated.
          unread: [],
          factsRead: undefined,
          note: "Read from the Figma file. Accept the drawing to hold it for approval.",
          facts: [
            { label: "Designer notes", value: String(notes.length) },
            { label: "Figma node", value: String(details.target_node_id ?? nodeId) },
            details.target_node_name ? { label: "Layer", value: String(details.target_node_name) } : null,
            details.target_node_type ? { label: "Type", value: String(details.target_node_type) } : null,
            details.target_node_size ? { label: "Size", value: String(details.target_node_size) } : null,
          ].filter(Boolean) as Array<{ label: string; value: string }>,
        });
        /*
         * THE CHAT IS ASKED THE FACE QUESTION (plan 1.5). The event is the seat's own, not the
         * general system-message channel: the room keeps other tabs' seats warm, and a sentence
         * broadcast to all of them would appear in a thread the ingest never touched. The Tools
         * chat is the only listener.
         */
        if (fontFaces.length) {
          window.dispatchEvent(
            new CustomEvent("design-face-offer", {
              detail: { statement: String(fontNotice?.statement ?? ""), faces: fontFaces },
            }),
          );
        }
        /*
         * THE DRAWING IS THE RESULT; THE DIFFERENCES ARE THE REPORT. The preview is already
         * standing above this line. A fact that did not match is named in the chat, and the run's
         * own steps stay in the third column, so the designer can read what was built as well as
         * what failed. Nothing is thrown away because the proof was not complete.
         */
        const blocking = Array.isArray((result as any)?.fidelity?.blocking)
          ? ((result as any).fidelity.blocking as string[])
          : [];
        if (blocking.length) {
          /*
           * THE FAILURE LEADS WITH THE ACTION, NOT THE COVERAGE. The person is reading this to
           * know what to fix. The unexamined keys are the thing to fix; the exact profile is the
           * record beneath them; the other differences follow. The 666-fact verdict and the
           * two-channel coverage stay in the activity record and the preview's own report, where
           * a reader who wants the measurements can find them.
           */
          const validationFailure = (result as any)?.validationFailure as
            | { profile?: string; keys?: string[] }
            | null;
          const validationKeys = Array.isArray(validationFailure?.keys)
            ? validationFailure.keys
            : [];
          const validationKeySet = new Set(validationKeys);
          const remainingBlocking = validationKeySet.size
            ? blocking.filter(
                (one) =>
                  !Array.from(validationKeySet).some((key) => one.includes(`\`${key}\``)),
              )
            : blocking;
          const exactness = (result as any)?.fidelity?.exactness as
            | { exact?: number; compared?: number; unexamined?: number }
            | null;
          const exactLine =
            typeof exactness?.exact === "number" && typeof exactness?.compared === "number"
              ? `The gate compared ${exactness.compared} visual facts and ${exactness.exact} carry the design's own values exactly` +
                (typeof exactness?.unexamined === "number" && exactness.unexamined > 0
                  ? `; ${exactness.unexamined} stated key(s) have no examination.`
                  : ".")
              : "";
          const keysLine = validationKeys.length
            ? [
                [
                  `The design states ${validationKeys.length === 1 ? "a key" : `${validationKeys.length} keys`} that no examination covers:`,
                  ...validationKeys.map((key) => {
                    const meaning: Record<string, string> = {
                      arcData:
                        "the geometry of a vector arc; the drawing does not read it. Fix: read the arc data and draw the arc",
                      componentProperties:
                        "the values an instance carries from its component; the component does not carry them. Fix: read the instance's property values and carry them",
                      maxWidth:
                        "the maximum width a layer may take; the drawing does not apply it. Fix: read the maximum width and apply it",
                    };
                    return `- \`${key}\` — ${
                      meaning[key] ??
                      "no examination covers this key. Fix: add an examination for it, or declare it configuration"
                    }.`;
                  }),
                ].join("\n"),
                "The component is drawn, and it may be wrong where these keys apply.",
              ].join("\n\n")
            : "";
          const actionLine = validationKeys.length
            ? `**What to do:** add an examination for ${validationKeys.length === 1 ? "that key" : "each named key"}, or declare it configuration if it needs no drawing. Then run the ingest again.`
            : "**What to do:** read the named differences below, fix the drawing or the measurement, then run the ingest again.";
          const profile = String(validationFailure?.profile ?? "");
          const content = [
            validationKeys.length
              ? "**The drawing is shown; the design is not fully examined.**"
              : "**The drawing is shown with differences.**",
            keysLine,
            exactLine,
            actionLine,
            profile ? "```\n" + profile + "\n```" : "",
            remainingBlocking.length
              ? "**Other differences:**\n" + remainingBlocking.map((one) => `- ${one}`).join("\n")
              : "",
            "**Do you accept the drawing as it stands?** [Accept](action:preview-accept) or [Discard](action:preview-discard).",
          ]
            .filter((part) => part)
            .join("\n\n");
          reportFailure(content, "fidelity");
          /* THE FAILURE HAS ONE HOME. The chat carries it; the form and the preview stay about
             the work, not the report. */
          setDesignIngest({ busy: false, message: "" });
        } else {
          // THE INGEST PASSED — THE CHAT ASKS THE APPROVAL QUESTION. The third column draws the
          // component and its facts; the two actions live in the conversation.
          /*
           * THE PASS IS THE SERVER'S OWN SENTENCE, NOT A BLANKET. "Every stated fact is drawn
           * exactly" was written here, before the gate's answer was read, and it claimed more than
           * the gate measured: the server's verdict names how many facts it read, how many were
           * drawn, and how many ask for no drawing. The count follows it.
           */
          const passedContent =
            "**The ingest is ready.**\n\n" +
            (exactLine ? `${exactLine}\n\n` : "") +
            "The drawing is in the third column with the file's own facts. Do you accept it?\n\n" +
            "[Accept](action:preview-accept) or [Discard](action:preview-discard).";
          void (async () => {
            let stored = false;
            try {
              stored = await persistIngestLine(passedContent, false);
            } catch (error) {
              console.error("the ingest success line could not be saved:", error);
            }
            window.dispatchEvent(
              new CustomEvent("a2ui:system-message", {
                detail: {
                  role: "assistant",
                  content: passedContent,
                  persisted: stored,
                  tab: "tools",
                },
              }),
            );
          })();
        }
        /* THE CHAT OPENS WITH THE ANSWER. The approval question lives there, and the default
           arrangement after an ingest is her standing beside the drawing. */
        window.dispatchEvent(new CustomEvent("design-chat-open", { detail: { tab: "tools" } }));
        // The ingest also recorded this design's layers — read them back so the tree shows the
        // node it just wrote, which is what the modal does with its own `layersKey`.
        /* THE DIAGNOSTIC ZONE IS NOT A SECOND FAILURE REPORT. The chat carries the failure and
           its next action; the form carries only the working state and the reason Submit is
           blocked. The refresh still runs, so the layer tree shows what the run measured. */
        setDesignIngest({ busy: false, message: "", refresh: Date.now() });
        };

        stepTimer = window.setInterval(async () => {
          try {
            const status = await apiFetch(`${API_BASE}/figma/ingest/${jobId}?t=${Date.now()}`);
            if (status.status === 404) {
              // THE SERVER NO LONGER HOLDS THIS JOB — and that is not "still working". The job
              // lives in the server's memory, so a restart takes it away. Say so, and stop.
              window.clearInterval(stepTimer);
              setDesignPreview(null);
              setDesignIngestBusy(false);
              const restartMessage =
                `The server no longer holds job ${jobId}. It may have restarted. ` +
                "Submit the design again.";
              reportFailure(restartMessage, "404");
              setDesignIngest({ busy: false, message: "" });
              settle();
              return;
            }
            if (!status.ok) return;
            const payload = (await status.json()) as {
              status?: string;
              error?: string | null;
              result?: Record<string, any> | null;
              steps?: Array<{ at?: string; text?: string }>;
            };
            const steps = Array.isArray(payload.steps) ? payload.steps : [];
            if (payload.status === "error") {
              window.clearInterval(stepTimer);
              setDesignPreview(null);
              setDesignIngestBusy(false);
              const jobError = String(payload.error || "the server gave no reason");
              reportFailure(jobError, "the job");
              setDesignIngest({ busy: false, message: "" });
              settle();
              return;
            }
            if (payload.status === "done") {
              window.clearInterval(stepTimer);
              setDesignIngestBusy(false);
              /*
               * THE JOB IS DONE, SO THE ANSWER IS TAKEN HERE. The status answer carries the same
               * result as the long request; taking it here is what makes the answer unavoidable.
               * A late poll can no longer paint "pending" over a finished read, and a lost long
               * response is not a reason to wait. One answer path, two doors.
               */
              if (!applied) {
                if (payload.result) {
                  applied = true;
                  applyIngestResult(payload.result, jobId);
                } else {
                  const noResult =
                    `The job is done but its status carries no result (job ${jobId}). ` +
                    "This is a defect in the ingest's answer, not a wait.";
                  reportFailure(noResult, "the job");
                  setDesignPreview(null);
                  setDesignIngest({ busy: false, message: "" });
                }
              }
              settle();
              return;
            }
            /*
             * STILL WORKING. THE SPINNER SAYS STANDBY; THE STEPS ARE NOT REPEATED HERE. The run's
             * step list belongs to the third column's own disclosure, and the chat carries the
             * result when there is one. A pending pane that repeats every step is a third copy of
             * the same log.
             */
            if (previewRef.current?.pending === true) {
              setDesignPreview({
                source: "ingest",
                pending: true,
                tag: "",
                name: "",
                note: "Processing — reading the Figma file. Standby.",
                values: [],
                steps,
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
            notes: submitted.notes,
            /* THE VISIT'S OWN ROW, NOT THE ROOM'S CONTAINER. `design_session_id` is the Tools tab
               session this page works in — the row Save relabels into the card. `session.id` is
               the Design container that holds every visit, so activity filed against it could
               never be found from a card. The activity record and the card now name one row. */
            sessionId: String(
              currentDesignSession?.design_session_id ?? currentDesignSession?.id ?? "",
            ),
            /* THE NAME THE PERSON GAVE THE WORK, else the session's own name. The container is
               called "Design"; that is the room, not this design. */
            sessionTitle:
              submitted.title.trim() || String(currentDesignSession?.title ?? ""),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          /*
           * THE BOUNDARY IS NOT REWRITTEN. A string detail is shown as it arrived; a structured
           * detail keeps its exception type, its message and its stack traceback, with the real
           * newlines rather than an escaped JSON line. The same raw text goes to the chat and to
           * the diagnostic zone above the layer tree.
           */
          const detail = (data as { detail?: unknown } | null)?.detail;
          let raw: string;
          if (typeof detail === "string") {
            raw = detail;
          } else if (detail && typeof detail === "object") {
            const structured = detail as {
              type?: string;
              error?: string;
              traceback?: string;
            };
            const head = structured.type
              ? `${structured.type}: ${structured.error ?? ""}`.trim()
              : String(structured.error ?? "");
            raw = [head, String(structured.traceback ?? "")]
              .filter((part) => part)
              .join("\n\n") || JSON.stringify(detail);
          } else {
            raw = JSON.stringify(data ?? "Failed to ingest");
          }
          /*
           * THE MECHANICAL PROFILE IS SAID IN THE CHAT, WHERE THE PERSON READS THE FAILURE. It is
           * not copied into the form's diagnostic zone: that zone is for the working state and
           * the reason Submit is blocked, and a second copy of the report there is the duplicate
           * the owner rejected.
           */
          if (raw.startsWith("[ERROR_TYPE]: INGEST_VALIDATION_FAILURE")) {
            reportFailure(raw, String(res.status));
            setDesignPreview(null);
            setDesignIngest({ busy: false, message: "" });
            return;
          }
          reportFailure(raw, String(res.status));
          setDesignPreview(null);
          setDesignIngest({ busy: false, message: "" });
          return;
        }
        // ── THE INGEST'S ANSWER BECOMES THE PREVIEW ────────────────────────────────────────────
        // Read exactly as the modal reads it (`data?.result ?? data`), because it is the same
        // response: the tag it built, the node it measured, and whether the catalogue already
        // held that tag — which is what makes the approve button say REPLACE instead of add.
        const result = (data?.result ?? data ?? {}) as Record<string, any>;
        if (!applied) {
          applied = true;
          applyIngestResult(result, jobId);
        }
      } catch (err) {
        // THE PENDING COLUMN IS CLEARED WHEN THE INGEST FAILS: a spinner that keeps turning after
        // the answer has already come back is a claim that work is still happening. The boundary
        // is the exception's own name, message and stack; the form and the chat show that text.
        const boundary =
          err instanceof Error
            ? `${err.name}: ${err.message}\n\n${err.stack ?? ""}`
            : String(err);
        setDesignPreview(null);
        reportFailure(boundary, "no response");
        setDesignIngest({ busy: false, message: "" });
      } finally {
        if (stepTimer !== undefined) window.clearInterval(stepTimer);
        setDesignIngestBusy(false);
        // Success, a refusal, a network failure — every outcome settles the room's wait, once.
        settle();
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
  }, [designIngestBusy, setDesignIngest, currentDesignSession, persistIngestLine]);

  /*
   * ══ THE FIELDS AS THEY ARE TYPED, AND THE PREVIEW AS IT LANDED ═══════════════════════════════
   *
   * SAVE AT THE FOOT OF THE COLUMN reads three things: the title, the Figma address and the notes
   * AS TYPED, not as submitted, because a person names the work and presses SAVE without running
   * an ingest first. The form announces them on every keystroke (`ingest-field-change`) and the
   * seat keeps the latest. The preview is kept the same way, for the one line that stands for the
   * middle column's drawing in the session's saved output.
   *
   * THIS SEAT'S OWN VALUES, still: neither ref is read by the Composer or the console.
   */
  const formFieldsRef = useRef<{ title: string; url: string; notes: string }>({
    title: "",
    url: "",
    notes: "",
  });
  /**
   * WHAT THIS VISIT OPENED WITH. The question asked on leaving Tools is worth asking only when
   * something changed since the visit began, and this is the only value that can say so: a
   * reopened session starts with its own title, address and notes already filled in, and without
   * this they read as unsaved work the person never typed. It is set where the form is seeded and
   * again after a successful save, because what was just kept is the new starting point.
   */
  const formBaselineRef = useRef<{ title: string; url: string; notes: string }>({
    title: "",
    url: "",
    notes: "",
  });
  const previewRef = useRef<Record<string, any> | null>(null);
  /**
   * THE INGEST'S FAILURE IS SAID IN THE CHAT, NOT IN THE FORM. The left column holds the catalogue
   * and the pending state; a diagnostic is a conversation turn. The raw error is kept so the chat's
   * copy action reads exactly what the server said, and the chat is opened so the person sees it.
   */
  const failureTextRef = useRef("");
  const reportIngestFailure = useCallback((raw: string, code: string) => {
    /*
     * THE FAILURE IS A CHANGE TO THIS SESSION, whether or not the drawing survived it. Set before
     * the write below, because the person must be able to keep the record even when the line's
     * write itself fails: the leave question is how the session, and the failure with it, is kept.
     */
    failureRecordedRef.current = true;
    /*
     * THE SERVER'S ERROR, VERBATIM, IN THE CONVERSATION AND ON THE SCREEN. The line used to be a
     * client block: a header, a canned cause, a canned repair and a code fence around the raw
     * text. The record then held the wrapper, not what the server said, and the chat's alert state
     * was the only thing that made it an error. The message now stores the server's own words; the
     * HTTP status is the one prefix kept, because it is the system's own code; `alert: true` is
     * the state that draws it as an error, live and after a reload.
     */
    const httpCode = /^\d{3}$/.test(code) ? `HTTP ${code}` : "";
    const content = [httpCode, raw].filter(Boolean).join("\n\n");
    failureTextRef.current = content;
    void (async () => {
      let stored = false;
      try {
        stored = await persistIngestLine(content, true);
      } catch (error) {
        /* THE LINE COULD NOT BE WRITTEN. The chat is handed the line with `persisted` false, so
           its own write is still offered; a failure there is said by the chat itself. */
        console.error("the ingest failure line could not be saved:", error);
      }
      window.dispatchEvent(
        new CustomEvent("a2ui:system-message", {
          detail: {
            role: "assistant",
            content,
            alert: true,
            code,
            persisted: stored,
            tab: "tools",
          },
        }),
      );
      /*
       * THE CHAT IS OPENED, THE LEFT COLUMN IS NOT RE-ARRANGED. The layout lives inside the seat's
       * shadow root, so a document query here can never find it — the earlier version did exactly
       * that and silently opened nothing. The event crosses the boundary; the shell holds the seat
       * and asks that page's own workspace to open her, at the width she already has.
       */
      window.dispatchEvent(new CustomEvent("design-chat-open", { detail: { tab: "tools" } }));
    })();
  }, [persistIngestLine]);
  useEffect(() => {
    const say = (content: string) =>
      window.dispatchEvent(
        new CustomEvent("a2ui:system-message", {
          detail: { role: "assistant", content, tab: "tools" },
        }),
      );
    const onCopy = () => {
      const text = failureTextRef.current;
      const clipboard = navigator.clipboard;
      if (!text) return;
      if (!clipboard) {
        say("The clipboard is not available here. Select the raw error and copy it.");
        return;
      }
      void clipboard.writeText(text).catch(() => {
        say("The copy did not complete. Select the raw error and copy it.");
      });
    };
    window.addEventListener("design-copy-diagnostic", onCopy);
    return () => window.removeEventListener("design-copy-diagnostic", onCopy);
  }, []);
  /**
   * THE PREVIEW'S OWN TWO ACTIONS, reachable from the save question (2026-11-01). They are defined
   * inside the effect that wires the pane's buttons; the question is asked elsewhere, so the pair
   * is kept here and called with the same event shape those handlers read — nothing is duplicated
   * and no second approve exists.
   */
  const previewActionsRef = useRef<{
    approve?: (preview: Record<string, any>) => Promise<void>;
    discard?: (preview: Record<string, any>) => Promise<void>;
  }>({});
  const designTreeRef = useRef(designTree);
  designTreeRef.current = designTree;
  /*
   * THE CHAT'S LIVE CONVERSATION, NOT THE ONE THE ASSEMBLY STARTED WITH. The seat writes every
   * move to the package's own column; this ref carries the same id to SAVE, because the data model
   * below is a snapshot taken at assembly. Writing it into the tree instead would change the
   * content the room re-injects, and the shell would rebind the seat to the package's older id.
   */
  const liveConversationRef = useRef<string | null>(null);
  /**
   * THE FILTER THE CONVERSATION REMEMBERS, HELD ACROSS A TREE REPLACEMENT. The seat can read the
   * stored value before this room's assembly answers, and the assembly's own data model does not
   * carry it — so a write onto the old tree is erased by the new one. This ref is re-applied to
   * every assembled tree, which is what makes the restore survive the order they arrive in.
   */
  const restoredQueryRef = useRef<string | null>(null);
  /* A DISCARDED VISIT BUILDS FRESH ON THE NEXT PRESS, and no row is made in between. */
  const needsAssemblyRef = useRef(false);
  /*
   * A RECORDED FAILURE IS PART OF THE SESSION'S ACTIVITY. It is not a field and not a draft, so
   * the leave test could not see it: a failed run clears the drawing and leaves the fields as
   * they were, the visit was thrown away without a question, and the failure went with its
   * conversation. This fact makes the failure a change the leave question asks about, so Save
   * keeps it with the card and Discard removes it only by an explicit answer.
   */
  const failureRecordedRef = useRef(false);
  const saveBusyRef = useRef(false);

  useEffect(() => {
    const onFieldChange = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; url?: string; notes?: string }>).detail ?? {};
      const fields = {
        title: String(detail.title ?? ""),
        url: String(detail.url ?? ""),
        notes: String(detail.notes ?? ""),
      };
      formFieldsRef.current = fields;
      /*
       * THE DATA MODEL IS THE FORM'S OWN STORE. The three fields are bound to
       * `/session/form/...`, and every data-model write re-applies those props. Keeping the typed
       * values only in a ref meant the next write — an ingest step, a save state, a preview —
       * reset the fields to their assembly-time values and wiped the address the person pasted.
       * Writing them back to the same paths makes the bound value the truth, so no later write
       * can erase what the person typed.
       */
      setDesignTree((prev) => {
        const session = (prev.dataModel as Record<string, any>)?.session ?? {};
        const form = { ...(session.form ?? {}), ...fields };
        return { ...prev, dataModel: { ...prev.dataModel, session: { ...session, form } } };
      });
    };
    window.addEventListener("ingest-field-change", onFieldChange);
    return () => window.removeEventListener("ingest-field-change", onFieldChange);
  }, []);

  /*
   * THE TABLE'S FILTER IS PART OF THE CONVERSATION'S STATE (owner, 2026-11-02: reopen "in the exact
   * state they were left in"). The tree writes the filter, the seat records it with the scroll, and
   * the stored value is handed back here when the conversation opens.
   */
  useEffect(() => {
    const remember = (query: string) => {
      window.dispatchEvent(new CustomEvent("table-query-changed", { detail: { query } }));
    };
    const onQuery = (event: Event) => {
      const query = String((event as CustomEvent<{ query?: string }>).detail?.query ?? "");
      restoredQueryRef.current = query;
      setDesignTree((prev) => {
        const session = (prev.dataModel as Record<string, any>)?.session ?? {};
        if (String(session.design_query ?? "") === query) return prev;
        return { ...prev, dataModel: { ...prev.dataModel, session: { ...session, design_query: query } } };
      });
      remember(query);
    };
    const onRestore = (event: Event) => {
      const query = String((event as CustomEvent<{ query?: string }>).detail?.query ?? "");
      restoredQueryRef.current = query;
      setDesignTree((prev) => {
        const session = (prev.dataModel as Record<string, any>)?.session ?? {};
        if (String(session.design_query ?? "") === query) return prev;
        return { ...prev, dataModel: { ...prev.dataModel, session: { ...session, design_query: query } } };
      });
    };
    window.addEventListener("layers-query", onQuery);
    window.addEventListener("conversation-table-query", onRestore);
    /* ASK FOR THE STORED FILTER WHEN THIS TAB STANDS (2026-11-02). The seat may have read it before
       this listener existed, and an event nobody heard is a value lost; the room asks each time it
       can hear — on mount and on every press of the tab. */
    if (activeRef.current) window.dispatchEvent(new CustomEvent("table-query-request"));
    return () => {
      window.removeEventListener("layers-query", onQuery);
      window.removeEventListener("conversation-table-query", onRestore);
    };
  }, [active]);

  /*
   * THE CHAT'S CONVERSATION IS THE SESSION PACKAGE'S CONVERSATION — THE SAME TIE THE GLOBAL
   * CONSOLE KEEPS (owner, 2026-11-02: *"it has to be tied to the package … based on the user …
   * it's already built in the global console"*).
   *
   * The Tools seat writes every move to the package's own column. The data model this pane saves
   * from is a snapshot taken at assembly, so without this line a SAVE taken after the person moved
   * to another chat — pressed +, picked a row, or deleted one — wrote the conversation the tab
   * opened with, or a deleted one. The card then reopened on the wrong thread.
   */
  useEffect(() => {
    const onConversationChange = (event: Event) => {
      if (!activeRef.current) return;
      const detail = (event as CustomEvent<{ conversationId?: string }>).detail;
      /* AN EMPTY ID IS A FACT TOO: removing the last chat leaves the seat on none, and a save
         taken then must write none rather than the row that was just deleted. */
      if (!detail || typeof detail.conversationId !== "string") return;
      liveConversationRef.current = detail.conversationId;
    };
    window.addEventListener("conversation-change", onConversationChange);
    return () => window.removeEventListener("conversation-change", onConversationChange);
  }, []);

  /** The footer's two values — the same kind of write the ingest form's own state is given. */
  const setDesignSave = useCallback((patch: { saving?: boolean; result?: string }) => {
    setDesignTree((prev) => {
      const session = (prev.dataModel as Record<string, any>)?.session ?? {};
      const next: Record<string, any> = { ...session };
      if ("saving" in patch) next.saving = Boolean(patch.saving);
      if ("result" in patch) next.save_result = String(patch.result ?? "");
      return { ...prev, dataModel: { ...prev.dataModel, session: next } };
    });
  }, []);

  /*
   * ══ SAVE KEEPS THE VISIT AS A SESSION ════════════════════════════════════════════════════════
   *
   * The act at the foot of this column saves THE TOOLS TAB'S OWN SESSION ROW — the id the assembly
   * hands over as `design_session_id`, not the room's container. It goes through the Composer's own
   * door, `POST /api/ai/save-surface`, with the three columns the Composer writes: the left column
   * (the title, the address and the notes, as sections), the middle column (what the drawing is,
   * said in words) and the right column (this session's conversation).
   *
   * KEEPING IT IS WHAT MAKES THE NEXT ENTRY A NEW SESSION. The server relabels the row
   * `design_session`, which frees the tab's one-per-tab slot, so the next assembly creates a fresh
   * untitled row and its own conversation. Nothing is cleared here: the person stays in the session
   * they just kept until they leave the tab.
   */
  const saveDesignSession = useCallback(async (options: { force?: boolean; output?: string; newSession?: boolean } = {}) => {
    if (saveBusyRef.current) return;
    /* THE VAULT LOCK, BEFORE THE REQUEST. The server answers 423 as well; this is the immediate
       refusal the person sees, and it keeps the locked card's fields from being read as work. */
    if (lockedRef.current) {
      setDesignSave({ result: lockedCardSentence(lockedStateRef.current) });
      return;
    }
    const sessionValue = ((designTreeRef.current.dataModel as Record<string, any>)?.session ??
      {}) as Record<string, any>;
    const sessionId = String(sessionValue.design_session_id ?? "");
    const conversationId = liveConversationRef.current
      ?? String(sessionValue.right_column?.conversation_id ?? "");
    const fields = formFieldsRef.current;
    const title = fields.title.trim();
    const url = fields.url.trim();
    const notes = fields.notes.trim();

    if (!title && !url && !notes && !conversationId) {
      setDesignSave({ result: "There is nothing to save yet — name the work, or paste its Figma address." });
      return;
    }
    if (!sessionId) {
      setDesignSave({ result: "This tab has no session yet — the room has not answered with one." });
      return;
    }

    saveBusyRef.current = true;
    setDesignSave({ saving: true, result: "" });
    try {
      const preview = previewRef.current;
      // THE MIDDLE COLUMN, SAID IN WORDS. The session stores the text of what the column shows —
      // the tag, the component's name and how many values were measured — because a kept session
      // is read by people who did not watch the ingest happen.
      const measured = Array.isArray(preview?.values) ? preview.values.length : 0;
      const output =
        options.output ??
        (preview
          ? [preview.tag, preview.name, measured ? `${measured} measured values` : ""]
              .filter(Boolean)
              .join(" · ")
          : "");
      const sections = [
        { section: "Title", content: title },
        { section: "Figma URL", content: url },
        { section: "Notes", content: notes },
      ].filter((s) => s.content);

      const response = await apiFetch(`${API_BASE}/ai/save-surface`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          title: title || "Untitled",
          left_column: { sections },
          middle_column: { compiled_output: output },
          right_column: { conversation_id: conversationId || null },
          /* THE RUN IS SAVED WITH THE SESSION. The preview carries the compiled drawing, the
             facts that were compared, the values, the steps and the measured tree; the server
             stores it on the record, and the card's own page applies it on reopen. */
          preview: preview ?? null,
        }),
      });
      const answer = await response.json().catch(() => null);
      if (!response.ok) throw new Error(answer?.detail || `the server answered ${response.status}`);
      keptThisVisitRef.current = true;
      /*
       * THE CARD COMES FROM THE SERVER, IN THE CONSOLE'S OWN SHAPE. The save's answer carries a
       * title and a description, not a card; building one here was a second shape, and it drew a
       * hard-coded Pending state with empty colours. This read is the console's own builder for
       * one record, so the card's state, colour and category are the record's.
       */
      const cardRead = await apiFetch(
        `${API_BASE}/design/cards/${encodeURIComponent(sessionId)}`,
      );
      let card: Record<string, any> | null = null;
      let cardReadNote = "";
      if (cardRead.ok) {
        const cardAnswer = (await cardRead.json().catch(() => null)) as
          | { card?: Record<string, any> }
          | null;
        card = cardAnswer?.card ?? null;
        if (!card?.id) cardReadNote = "the read returned no card";
      } else {
        const reason = await cardRead.text().catch(() => "");
        cardReadNote = `the read answered ${cardRead.status}${
          reason ? ` — ${reason.slice(0, 200)}` : ""
        }`;
      }
      /* THE CARD THE SAVE JUST WROTE IS THE RECORD'S OWN ANSWER. A save puts the card in the
         Supervisor Queue, so the page must lock in the same act: the session's lifecycle is
         written into the tree, and the workspace panel turns into the read-only ledger. */
      const cardLocked = Boolean(
        card && (card.locked === true || isCardLocked(card.state)),
      );
      if (card?.id) {
        setDesignTree((prev) => {
          const current = ((prev.dataModel as Record<string, any>)?.session ?? {}) as Record<string, any>;
          return {
            ...prev,
            dataModel: {
              ...prev.dataModel,
              session: {
                ...current,
                kept: true,
                card_state: String(card.state ?? ""),
                locked: cardLocked,
                reviewer: String(card.reviewer ?? ""),
                routing: card.routing ?? {},
              },
            },
          };
        });
      }
      if (card?.id && !cardLocked) {
        window.dispatchEvent(new CustomEvent("design-card-saved", { detail: { card } }));
      }
      // WHAT WAS JUST KEPT IS THE NEW STARTING POINT, so leaving again without a change is silent.
      formBaselineRef.current = { ...formFieldsRef.current };
      /* A KEPT SESSION IS A CARD NOW. The visit that made it is finished, so the next press of the
         tab is a new session — the card is how that work comes back, not the tab. */
      needsAssemblyRef.current = true;
      setDesignSave({
        saving: false,
        result: card?.id
          ? cardLocked
            ? `Kept. Its card is in the Supervisor Queue (${String(card.state)}); it is read-only until the supervisor answers.`
            : "Kept. Its card stands on the Design console."
          : `Kept. Its card could not be read back (${cardReadNote}); it will appear when the console is read again.`,
      });
      /*
       * THE FOOTER'S CREATE NEW STARTS THE NEXT SESSION HERE. The card is already saved; the room's
       * own Tools press starts the next working row and gives the tab a new visit. A plain Save
       * leaves this one standing, as before.
       */
      if (options.newSession) {
        window.dispatchEvent(
          new CustomEvent("design-tools-open", { detail: { openSession: "" } }),
        );
      }
    } catch (e) {
      setDesignSave({ saving: false, result: e instanceof Error ? e.message : String(e) });
    } finally {
      saveBusyRef.current = false;
    }
  }, [setDesignSave]);

  /*
   * THROWING THE WORK AWAY DOES NOT THROW THE SESSION AWAY.
   *
   * A session is the record: its conversation, its ingest activity and its decisions. The server
   * closes the visit as a card with the state Closed, so the record can be read again and the
   * card can be handed on. Nothing is removed: a visit that did no work is still a session that
   * began and ended. The next press of Tools builds a new working row. Nothing here deletes a
   * conversation or an activity row, and a card the visit opened is never treated as the visit.
   */
  const discardDesignSession = useCallback(async (options: { newSession?: boolean } = {}) => {
    const sessionValue = (designTreeRef.current.dataModel as Record<string, any>)?.session ?? {};
    const sessionId = String(sessionValue.design_session_id ?? "");
    if (!sessionId) return;
    /* THE VAULT LOCK. A queued card is not discarded, closed or altered by its owner. */
    if (lockedRef.current) {
      setDesignSave({ result: lockedCardSentence(lockedStateRef.current) });
      return;
    }
    /* WHAT A DISCARD LEAVES BEHIND: the visit's local state goes; the record stands on the server. */
    const forgetVisit = (redraw: boolean) => {
      liveConversationRef.current = null;
      previewRef.current = null;
      formFieldsRef.current = { title: "", url: "", notes: "" };
      formBaselineRef.current = { title: "", url: "", notes: "" };
      keptThisVisitRef.current = false;
      failureRecordedRef.current = false;
      needsAssemblyRef.current = true;
      if (redraw) {
        setDesignPreview(null);
        setDesignIngest({ busy: false, message: "", refresh: Date.now() });
      }
    };
    /*
     * A KEPT CARD IS NOT THE VISIT. After a successful save the working tree still names the
     * saved card; closing it as a visit would change the card. The card stands; only the visit's
     * local state is cleared.
     */
    if (keptThisVisitRef.current) {
      forgetVisit(true);
      if (options.newSession) {
        window.dispatchEvent(
          new CustomEvent("design-tools-open", { detail: { openSession: "" } }),
        );
      }
      return;
    }
    try {
      const response = await apiFetch(
        `${API_BASE}/design/sessions/${encodeURIComponent(sessionId)}/close`,
        { method: "POST" },
      );
      const answer = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(answer?.detail || `the server answered ${response.status}`);
      }
      /*
       * THE CARD'S NEW STATE REACHES THE CONSOLE NOW. The close changed the record; the console's
       * grid is given the server's own card, so the live card reads Closed without a second page
       * read and without the grid inventing a state.
       */
      const cardRead = await apiFetch(
        `${API_BASE}/design/cards/${encodeURIComponent(sessionId)}`,
      );
      if (cardRead.ok) {
        const cardAnswer = (await cardRead.json().catch(() => null)) as
          | { card?: Record<string, any> }
          | null;
        const card = cardAnswer?.card;
        if (card?.id) {
          window.dispatchEvent(new CustomEvent("design-card-saved", { detail: { card } }));
        }
      }
      forgetVisit(false);
      if (options.newSession) {
        window.dispatchEvent(
          new CustomEvent("design-tools-open", { detail: { openSession: "" } }),
        );
      }
    } catch (e) {
      setDesignSave({
        saving: false,
        result: `That session could not be closed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }, [setDesignSave]);

  /*
   * SHE NAMED A COMPONENT IN THE TABLE (owner, 2026-11-02). The chat sends the key it read from the
   * table's own context; this answers with the table's three facts at once — the filter, the mark,
   * and the open component in the third column. A key the table does not hold moves nothing and
   * says so, which is the rule the rest of this room runs on.
   */
  useEffect(() => {
    const onFind = (event: Event) => {
      const tag = String((event as CustomEvent<{ tag?: string }>).detail?.tag ?? "").trim();
      if (!tag) return;
      const rows = (((designTreeRef.current.dataModel as Record<string, any>)?.session?.elements ?? []) as any[]);
      const row = rows.find((r) => String(r?.key ?? r?.id ?? "") === tag)
        ?? rows.find((r) => String(r?.id ?? "") === tag);
      if (!row) {
        setDesignSave({ saving: false, result: `The table does not hold “${tag}”, so nothing moved.` });
        return;
      }
      setDesignSave({ saving: false, result: "" });
      const name = String(row?.name ?? "");
      window.dispatchEvent(new CustomEvent("table-query-changed", { detail: { query: name } }));
      setDesignTree((prev) => {
        const session = (prev.dataModel as Record<string, any>)?.session ?? {};
        return {
          ...prev,
          dataModel: { ...prev.dataModel, session: { ...session, design_query: name, design_selected: tag } },
        };
      });
      window.dispatchEvent(new CustomEvent("open-component", { detail: { tag } }));
    };
    window.addEventListener("find-component", onFind);
    return () => window.removeEventListener("find-component", onFind);
  }, [setDesignSave]);

  useEffect(() => {
    const onDiscard = (event: Event) => {
      const newSession = Boolean(
        (event as CustomEvent<{ newSession?: boolean }>).detail?.newSession,
      );
      void discardDesignSession({ newSession });
    };
    window.addEventListener("design-save-discard", onDiscard);
    return () => window.removeEventListener("design-save-discard", onDiscard);
  }, [discardDesignSession]);

  /* LEAVING TOOLS ENDS THE VISIT (owner, 2026-11-07). The working session is removed; a card the
     visit opened is kept by its own mark, so `discardDesignSession` decides by the record, not by
     this event's name. The next press of Tools is a new session. */
  useEffect(() => {
    const onLeaveVisit = () => { void discardDesignSession(); };
    window.addEventListener("design-tools-leave", onLeaveVisit);
    return () => window.removeEventListener("design-tools-leave", onLeaveVisit);
  }, [discardDesignSession]);

  /* THE NEXT PRESS OF THE TAB IS THE NEXT SESSION — unless a card asked for a particular one, in
     which case that card's own assembly below is the answer and this stands aside. */
  useEffect(() => {
    if (!needsAssemblyRef.current) return;
    if (openSession) {
      needsAssemblyRef.current = false;
      return;
    }
    if (!active) return;
    needsAssemblyRef.current = false;
    const system = loadedSystemRef.current;
    const seq = ++assemblySeqRef.current;
    /* THE NEXT SESSION STARTS WITH NO SESSION OF ITS OWN until the server names it. */
    setDesignTree({ components: [], dataModel: {} });
    setCurrentDesignSession(null);
    void assembleDesignSurface(null, system === DEFAULT_CATALOGUE_SYSTEM ? null : system, seq)
      .catch((err) => {
        setDesignSave({
          saving: false,
          result: `This session could not be started: ${String((err as Error)?.message ?? err)}`,
        });
      });
  }, [active, openSession, assembleDesignSurface, setDesignSave]);

  useEffect(() => {
    const onSave = (event: Event) => {
      // A LEAVE'S SAVE IS FORCED. The person already answered the leave question, so the preview's
      // own "Save anyway / Approve / Cancel" question is not asked a second time. A manual Save
      // carries no force and keeps that question. A create-new save also starts the next session.
      const detail = (event as CustomEvent<{ force?: boolean; newSession?: boolean }>).detail ?? {};
      void saveDesignSession({
        force: Boolean(detail.force),
        newSession: Boolean(detail.newSession),
      });
    };
    window.addEventListener("design-left-save", onSave);
    return () => window.removeEventListener("design-left-save", onSave);
  }, [saveDesignSession]);

  /*
   * ══ THE ANSWER TO THE SAVE QUESTION ═════════════════════════════════════════════════════════
   *
   * The room draws the question (the seat is headless and draws nothing), and answers by action:
   *
   *   approve — the pane's own approve runs; the session is then kept with the approved component.
   *   save    — the pane's own discard runs, so the temporary folder is not left held, and the
   *             session is kept with a line saying the preview was not kept. This is the button the
   *             owner asked for: the save is still possible, and it says what it costs.
   *   cancel  — nothing. The preview stays on screen and nothing is written.
   */
  useEffect(() => {
    const onAnswer = async (event: Event) => {
      const action = String((event as CustomEvent<{ action?: string }>).detail?.action ?? "");
      if (!action || action === "cancel") return;
      const standing = previewRef.current;
      const tag = String(standing?.tag ?? "");
      if (action === "approve") {
        if (standing) await previewActionsRef.current.approve?.(standing);
        await saveDesignSession({ force: true, output: tag ? `approved: ${tag}` : "approved" });
        return;
      }
      if (action === "save") {
        if (standing) await previewActionsRef.current.discard?.(standing);
        await saveDesignSession({ force: true, output: tag ? `preview not kept: ${tag}` : "" });
      }
    };
    window.addEventListener("design-save-decision-answer", onAnswer);
    return () => window.removeEventListener("design-save-decision-answer", onAnswer);
  }, [saveDesignSession]);

  /*
   * ══ THE QUESTION THE ROOM ASKS WHEN THE PERSON LEAVES TOOLS ═════════════════════════════════
   *
   * The room owns the rail and is the only place that knows a tab press happened, so it asks the
   * standing seat a question before it moves: this listener fills that answer in, synchronously,
   * in the caller's own object. The seat is the only thing that knows whether the visit holds
   * anything unsaved — the title, the address and the notes as typed, and whether this visit has
   * already been kept. Nothing is stored on the element and no second copy of these values exists.
   */
  const keptThisVisitRef = useRef(false);
  useEffect(() => {
    const onAsk = (event: Event) => {
      /*
       * THE TOOLS PAGE ANSWERS ONLY WHILE IT STANDS. The seat is kept mounted across visits, so a
       * question asked while another tab stands must not be answered with this page's last visit;
       * that is how leaving the design console for the global console asked about a Tools session
       * that was not on screen.
       */
      if (!activeRef.current) return;
      const answer = (event as CustomEvent<{
        work?: boolean;
        kept?: boolean;
        title?: string;
        failure?: boolean;
        changed?: boolean;
        draft?: boolean;
      }>).detail;
      if (!answer) return;
      const fields = formFieldsRef.current;
      /* A LOCKED CARD HAS NO UNSAVED WORK TO DECIDE. Save and Discard are both refused by the
         state machine, so asking the question would offer two actions that cannot run. Leaving
         is allowed; the card and its activity stay in the Supervisor Queue. */
      if (lockedRef.current) {
        answer.work = false;
        answer.kept = true;
        answer.changed = false;
        answer.draft = false;
        answer.title = fields.title.trim();
        return;
      }
      /* THE QUESTION IS ABOUT A CHANGE, NOT ABOUT A NON-EMPTY FIELD. Owner, 2026-11-02: *"there is
         no need to [ask] if nothing has changed after opening."* A reopened session already carries
         its title, address and notes, so their being filled in says nothing about unsaved work.
         A preview standing IS work: it was made in this visit and it dies on discard. */
      const changed = !sameFields(fields, formBaselineRef.current);
      /* A DRAFT MADE IN THIS VISIT IS WORK; A COMPONENT MERELY OPENED IS NOT. The preview stands
         for both, and counting the object itself made every visit that looked at a component ask
         the leave question with nothing changed. The draft is the preview the ingest produced
         here; an opened catalogue component carries `source: "open"`. */
      const preview = previewRef.current;
      const draftInThisVisit =
        String(preview?.source ?? '') === 'ingest' && preview?.restored !== true;
      /*
       * A RECORDED FAILURE IS WORK. The failed run clears the preview and leaves the form as it
       * was, so the two tests above cannot see it; without this the visit was thrown away without
       * a question and the failure went with its conversation. The person is told which of the
       * two kinds of work the question is about.
       */
      const holdsWork = draftInThisVisit || changed || failureRecordedRef.current;
      answer.work = holdsWork;
      answer.failure = failureRecordedRef.current;
      /* THE TWO FACTS A SAVED CARD NEEDS TO TELL ITS OWN CASE. A failure on a card is already in
         the card's conversation; a field or a draft made since it was opened is not saved yet. */
      answer.changed = changed;
      answer.draft = draftInThisVisit;
      /* A CARD IS ALREADY KEPT. A card reopened from the console must not be asked about as if its
         work were only here; the session's own `kept` fact says so, and the visit can end without
         holding it for the next press. */
      answer.kept = keptThisVisitRef.current
        || Boolean((designTreeRef.current.dataModel as Record<string, any>)?.session?.kept);
      answer.title = fields.title.trim();
    };
    window.addEventListener("design-save-ask", onAsk);
    return () => window.removeEventListener("design-save-ask", onAsk);
  }, []);

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
    // WHAT THE MIDDLE COLUMN HOLDS, kept where SAVE can read it: a save happens in this seat, not
    // in the drawing, and the drawing is a shadow-root element no save handler can query.
    previewRef.current = preview;
    setDesignTree((prev) => {
      const session = (prev.dataModel as Record<string, any>)?.session ?? {};
      const tag = preview?.tag ? String(preview.tag) : "";

      // WHAT THIS SURFACE CAN DRAW, DECIDED BEFORE THE TREE IS WALKED. `resolveTag` is the
      // renderer's OWN resolver — imported, not re-implemented — so this can never disagree with
      // what would be drawn. Computed ABOVE the map because the map reads it.
      const resolved = preview && tag ? resolveTag(tag) : null;
      const drawable = !!resolved && !!customElements.get(resolved);

      const draft = preview?.source === "ingest" ? preview?.draft ?? null : null;
      const drawsDraft = !!draft?.script || !!draft?.moduleUrl;

      // AND WHEN AN INGEST ANSWERS WITHOUT A MODULE, NOTHING IS DRAWN. IT IS NOT FALLEN BACK:
      // drawing the catalogue's element under the tag is how a designer who had just changed the
      // design was shown the approved component instead. A missing module means the answer cannot
      // say WHAT it built, so the honest drawing is none, with the reason on the preview.
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
   * THE RUN THAT WAS SAVED WITH THE CARD COMES BACK WITH IT. The server puts the stored preview on
   * `/session/preview`; this applies it through the same setter a live run uses, so the third
   * column, the facts, the values, the steps and the compiled drawing are the ones the session was
   * saved with. A live run's own preview is already the ref, so this stands aside for it.
   */
  useEffect(() => {
    const saved = (designTree.dataModel as Record<string, any> | undefined)?.session?.preview;
    if (!saved || typeof saved !== "object") return;
    if (previewRef.current === saved) return;
    /* `restored` separates the card's stored preview from a draft made in this visit: the stored
       drawing is work the card already holds, and it must not make the leave question ask. */
    setDesignPreview({ ...saved, restored: true } as Record<string, any>);
  }, [designTree, setDesignPreview]);

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
        // THE CHAT OWNS THE ACTION FOR AN EXISTING COMPONENT TOO. The preview draws the component
        // and its metadata; the only action is Remove, and the model offers it in the conversation.
        chatControls: true,
        status: "In the catalogue",
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
      // THE MODEL ANSWERS THE CLICK. The component is in the catalogue, so the only action is
      // removal; the offer is in the conversation, not a second set of buttons on the preview.
      const componentName = row?.name ?? tag;
      void sayInChat(
        `**${componentName}** is in the catalogue. Its metadata is in the third column. ` +
          `The only action here is to remove it. Do you want to remove it?\n\n` +
          `[Remove](action:preview-remove) or [Keep it](action:preview-keep).`,
      );
      // THE QUESTION IS IN THE CHAT, SO THE CHAT IS OPENED. A model that asks into a collapsed
      // panel has not engaged; the person sees the offer where the answer is.
      window.dispatchEvent(new CustomEvent("design-chat-open", { detail: { tab: "tools" } }));
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

    /*
     * ACCEPT IS THE DESIGNER'S ANSWER TO THE DRAWING, AND IT IS A STEP OF ITS OWN. The ingest
     * message asks whether the drawing is the design they want; Accept holds it for approval
     * without writing anything to the catalogue. The status changes to Accepted, and the chat
     * offers the approval that writes the component and its children.
     */
    const onPreviewAccept = (event: Event) => {
      const preview =
        (event as CustomEvent<{ preview?: Record<string, any> }>).detail?.preview ??
        previewRef.current;
      if (!preview?.jobId) return;
      setDesignPreview({
        ...preview,
        accepted: true,
        status: "Accepted — ready for approval",
        noteLines: ["Accepted. Approve to add it and its children to the catalogue."],
        note: "Accepted. Approve to add it and its children to the catalogue.",
      });
      void sayInChat(
        "**Accepted.** The drawing is held for approval. " +
          "[Approve & add to catalogue](action:preview-approve) or " +
          "[Discard](action:preview-discard).",
      );
    };

    /* THE DESIGNER'S ANSWER TO AN EXISTING COMPONENT: keep it, and nothing changes. */
    const onPreviewKeep = () => {
      void sayInChat("Kept in the catalogue. Nothing was removed.");
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
          status: "Approved — added to the catalogue",
          accepted: true,
          chatControls: true,
          tag,
          name: String(preview?.name ?? tag),
          alreadyInCatalogue: true,
          note: confirmation,
          noteLines: [confirmation],
          values: previewValues(rowsOf(), tag),
          specs: (record?.specs as Array<Record<string, any>> | undefined) ?? [],
          readings: (record?.readings as Array<Record<string, any>> | undefined) ?? [],
          annotations: (record?.annotations as Array<Record<string, any>> | undefined) ?? [],
          componentSource: String(record?.source ?? ""),
          sourceBytes: Number(record?.sourceBytes ?? 0),
        });
        setDesignIngest({ busy: false, message: "", refresh: Date.now() });
        void sayInChat(confirmation);
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
        const removalNote = `Removed ${tag} from the catalogue — its file, Figma map entry, allowlist entry, catalogue entry and layer record are deleted.`;
        setDesignPreview(
          preview
            ? {
                ...preview,
                removing: false,
                removed: true,
                alreadyInCatalogue: false,
                status: "Removed from the catalogue",
                note: removalNote,
                noteLines: [removalNote],
              }
            : null,
        );
        setDesignIngest({ busy: false, message: "", refresh: Date.now() });
        void sayInChat(removalNote);
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
    const withPreview = (event: Event): Event => {
      const detail = ((event as CustomEvent).detail ?? {}) as Record<string, any>;
      return new CustomEvent(event.type, {
        detail: { ...detail, preview: detail.preview ?? previewRef.current },
      });
    };
    const gOpen = onlyWhenStanding(onOpenComponent);
    const gCard = onlyWhenStanding(onDesignCardOpen);
    const gAccept = onlyWhenStanding((event: Event) => onPreviewAccept(withPreview(event)));
    const gKeep = onlyWhenStanding(onPreviewKeep);
    const gApprove = onlyWhenStanding((event: Event) => onPreviewApprove(withPreview(event)));
    const gDiscard = onlyWhenStanding((event: Event) => onPreviewDiscard(withPreview(event)));
    const gRemove = onlyWhenStanding((event: Event) => onPreviewRemove(withPreview(event)));
    const gCollision = onlyWhenStanding(onCollisionAnswer);
    /*
     * THE PANE'S TWO ACTIONS, HANDED TO THE SAVE QUESTION (2026-11-01). The question is answered
     * outside this effect, and the person's answer must run the SAME approve and discard the pane's
     * own buttons run. Wrapped in the event shape those handlers already read, so there is one
     * approve and one discard in the seat and no second copy of either.
     */
    previewActionsRef.current = {
      approve: (preview) =>
        onPreviewApprove(new CustomEvent("preview-approve", { detail: { preview } })),
      discard: (preview) =>
        onPreviewDiscard(new CustomEvent("preview-discard", { detail: { preview } })),
    };
    window.addEventListener("open-component", gOpen);
    window.addEventListener("card-open", gCard);
    window.addEventListener("preview-accept", gAccept);
    window.addEventListener("preview-keep", gKeep);
    window.addEventListener("preview-approve", gApprove);
    window.addEventListener("preview-discard", gDiscard);
    window.addEventListener("preview-remove", gRemove);
    window.addEventListener("preview-collision-answer", gCollision);

    // ── THE CATALOGUE THE TAB IS IN, WRITTEN TO THE MODEL ──────────────────────────────────
    // Owner, 2026-10-26: *"We only need the official one."* The rail offers no choice, so the
    // default is the official catalogue and nothing else — and this corrects a stored choice left
    // by an earlier session.
    // OWNER, 2026-11-02, AMENDS THE DEFAULT AND NOT THE RULE: *"the card should just open the tool
    // with the loaded DS, which this one is the default."* A design system's card names a catalogue,
    // and that name is what the tab is in; a visit that names none is still the official one.
    setDesignTree((prev: any) => {
      const session = (prev.dataModel as Record<string, any>)?.session ?? {};
      const wanted = loadedSystemRef.current;
      if (session.design_catalogue === wanted) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, design_catalogue: wanted },
        },
      };
    });
    return () => {
      window.removeEventListener("open-component", gOpen);
      window.removeEventListener("card-open", gCard);
      window.removeEventListener("preview-accept", gAccept);
      window.removeEventListener("preview-keep", gKeep);
      window.removeEventListener("preview-approve", gApprove);
      window.removeEventListener("preview-discard", gDiscard);
      window.removeEventListener("preview-remove", gRemove);
      window.removeEventListener("preview-collision-answer", gCollision);
    };
  }, [designTree, setDesignIngest, setDesignPreview, sayInChat]);

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
