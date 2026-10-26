/**
 * THE GOVERNANCE ROOM'S WIRING — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged; every name it closes over arrives through `deps`, so the
 * behaviour is the page's own. The dependency list is the contract: a new name in the effect is a
 * compile error here until it is declared in the interface below.
 */
// The Sessions tab's view — registered here because THIS room mounts it. Without the import
// the tag is an empty box, which is what the tab had before.
import '@/components/lit/sessions-feed';
import { API_BASE } from '@/shared/apiHelper';
import { assignProps } from '@/components/lit/a2ui-renderer';
import { fetchGovFirstTrace, fetchGovRoomMetrics } from '@/lib/governance-trace-source';
import { getStoredUserId } from '@/services/authService';
import { governanceToolUrl } from '@/shared/appConfig';
import { markArrival } from '@/shared/arrival';
import { useEffect, useLayoutEffect } from 'react';

/** Exactly what the block needs from the shell, by name. */
export interface UseGovernanceRoomDeps {
  GOVERNANCE_SEAT_TABS: any;
  assertPaneWidth: any;
  governanceComposerPackageRef: any;
  governanceEmbedRef: any;
  governanceEvalsSeatRef: any;
  governanceLayoutRef: any;
  governanceSeatRef: any;
  governanceSectionPrefix: any;
  governanceTraceElsRef: any;
  governanceTraceSelRef: any;
  headerTab: any;
  navigateGovernanceTool: any;
  openComposerRef: any;
  setGovernanceEvalsSeat: any;
  setGovernanceGripActive: any;
  setGovernanceTraceSig: any;
}

export function useGovernanceRoom(deps: UseGovernanceRoomDeps) {
  const { GOVERNANCE_SEAT_TABS, assertPaneWidth, governanceComposerPackageRef, governanceEmbedRef, governanceEvalsSeatRef, governanceLayoutRef, governanceSeatRef, governanceSectionPrefix, governanceTraceElsRef, governanceTraceSelRef, headerTab, navigateGovernanceTool, openComposerRef, setGovernanceEvalsSeat, setGovernanceGripActive, setGovernanceTraceSig } = deps;
  /* THE ROOM'S CONTAINER LOADS CLOSED — moved here from the shell's own layout effect (owner,
     2026-10-23: *"the tab layer should be collapsed just like the console"*). The property write,
     never the attribute (Lit's boolean converter reads any present attribute as true), and a
     LAYOUT effect so the first paint is already closed rather than open for a frame. */
  useLayoutEffect(() => {
    if ((headerTab || '') !== 'governance') return;
    const layoutNow = governanceLayoutRef.current as { isThirdOpen?: boolean } | null;
    if (layoutNow) layoutNow.isThirdOpen = false;
  }, [headerTab, governanceLayoutRef]);
  useEffect(() => {
    if ((headerTab || '') !== 'governance') return;
    const seat = governanceSeatRef.current;
    if (!seat) return;
    /*
     * THE ROOM OPENS THE APPLICATION ON ITS HOME (owner, 2026-10-23: *"governance should load
     * the homepage"*). The application restores its own last route on load, so a room left on an
     * evaluator or a session came back to that page. The room states home on entry: the project
     * root, the same address the embed is created with.
     */
    const homeSrc = governanceEmbedRef.current?.getAttribute('src') ?? governanceToolUrl();
    const homeMatch = String(homeSrc).match(/\/project\/([^/?#]+)/);
    if (homeMatch) {
      navigateGovernanceTool(`/project/${decodeURIComponent(homeMatch[1])}`);
    }
    /*
     * AND THE GRIP'S SAFETY NET RIDES HERE (see `governanceGripActive`): the layout's own
     * `resize-start`/`resize-end` — dispatched on itself when the chat strip's gesture
     * begins and ends — raise and lower the room's transparent drag overlay, so the hand's
     * moves keep reaching this document while it is over the frame beside the strip. The
     * Product room's wiring, one room over.
     */
    const layout = governanceLayoutRef.current;
    const onGripStart = () => setGovernanceGripActive(true);
    const onGripEnd = () => setGovernanceGripActive(false);
    layout?.addEventListener('resize-start', onGripStart);
    layout?.addEventListener('resize-end', onGripEnd);
    /*
     * THE ROOM'S TRACE VIEWS MOUNT HERE — three elements in this seat's OWN doors (the
     * placement-first pass, owner's rule 2026-10-13; the facts strip's home corrected by
     * the same owner the same night — it lives in the seat's readout bar, see its mount
     * below): the TREE in the view slot claiming the Trace tab, the DETAIL claiming the
     * Preview tab (`view-tab` attributes — the seat's per-tab door; the rail label is the
     * room's own `tab-labels`, id `tools` stays). They are VIEWS: every value
     * they draw is written by the read effect below from lib/governance-trace-source.ts;
     * when the room goes native these slots stay and only the reads change transport.
     */
    const headerEl = document.createElement('trace-context-header') as HTMLElement;
    /* INTO THE SEAT'S READOUT BAR — WHERE THE OWNER POINTED (2026-10-13 late: *"That
       header information doesn't go there. It goes here"* — at the bar that draws
       "Analyzing: Session 222 | …", top of the column). The seat relays a
       `status-content` slot into <output-header>'s own door; the bar's built-in line
       (and its drawing sample) steps aside while the strip stands. NOT a tab view: the
       bar keeps saying which trace is on the table whatever the rail shows. */
    headerEl.setAttribute('slot', 'status-content');
    /* THE EVALS EXPERIENCE WEARS THE SAME READOUT — its bar says "Model usage" with the
       room's real facts, never the chat drawing sample (owner, 2026-10-17). */
    const evalsHeaderEl = document.createElement('trace-context-header') as HTMLElement;
    evalsHeaderEl.setAttribute('slot', 'status-content');
    governanceEvalsSeatRef.current?.append(evalsHeaderEl);
    const treeEl = document.createElement('trace-tree') as HTMLElement;
    treeEl.setAttribute('slot', 'view');
    treeEl.setAttribute('view-tab', 'trace');
    const detailEl = document.createElement('trace-detail') as HTMLElement;
    detailEl.setAttribute('slot', 'view');
    detailEl.setAttribute('view-tab', 'tools');
    /*
     * NO SESSIONS FEED HERE (owner, 2026-10-23). The Sessions tab belongs to the evals seat, and
     * THAT seat draws its own `sessions-feed` when its sessions tab is open. A second feed mounted
     * on the shared seat loaded at room entry, selected its first row before any tab was clicked,
     * and navigated the middle away from the home page — the feed's default pick is meant to fire
     * when the Sessions tab opens, not on arrival.
     */
    treeEl.addEventListener('trace-node-selected', ((e: CustomEvent<{ id?: string }>) => {
      const id = e.detail?.id;
      if (!id) return;
      /* The tree names the node; the seat's state answers — a view never selects itself. */
      setGovernanceTraceSig((prev) => (prev ? { ...prev, obsId: id } : prev));
    }) as EventListener);
    /* AND THE TREE'S VIEW OPTIONS REACH THE DETAIL — Collapse System Prompts is ONE
       preference across the fork's two panels, and this shell is the hub between ours. */
    treeEl.addEventListener('trace-prefs', ((e: CustomEvent<{ collapseSystemPrompt?: boolean }>) => {
      if (typeof e.detail?.collapseSystemPrompt !== 'boolean') return;
      assignProps(detailEl, { collapseSystemPrompt: e.detail.collapseSystemPrompt });
    }) as EventListener);
    /*
     * THE TRACE CLICK — THE APP GOES TO ITS LIST, AND THE DEFAULT SELECTS ITSELF (owner,
     * 2026-10-13: *"selecting trace loads the default first one in the table. Period … the
     * first item in the table should be highlight[ed]"* — and why: *"the interface itself
     * is teaching them with defaults"*). Nothing here opens her column or fetches a trace:
     * the LATEST row is CLICKED the way a hand clicks it (the measured pointer sequence —
     * the fork's row handler does not answer a bare synthetic click; the checkbox cell
     * ignores clicks, the time cell answers), and from there everything rides the one
     * selection channel — the reporter carries the pick out, the shell opens her, the
     * read fills the views, the row keeps the highlight. One mechanism, so the parts
     * cannot disagree. With a selection already standing the click is just the tab.
     *
     * AND "DEFAULT" MEANS THE LATEST, NEVER AN ARBITRARY ROW (owner, same night: *"you
     * can't just pick an arbitrary line in the table and call it default — default has to
     * be the latest one … or else it'll eventually get pushed way down"*) — see
     * `selectLatestTableRow`'s own note for the mechanism.
     */
    const governanceFrameDoc = (): Document | null => {
      try {
        const embed = governanceEmbedRef.current as unknown as { shadowRoot?: ShadowRoot } | null;
        const iframe = embed?.shadowRoot?.querySelector('iframe') as HTMLIFrameElement | null;
        return iframe?.contentDocument ?? null;
      } catch {
        return null;
      }
    };
    const selectLatestTableRow = async (): Promise<void> => {
      if (governanceTraceSelRef.current.bundle) return; // a selection already stands
      /* FIVE SECONDS, THE HOUSE STANDARD (owner, 2026-10-22). This was fifteen — measured on the
         Evals→Trace round trip — and it is a ceiling, not a delay: the moment rows exist the pick
         happens. Five seconds is how long a room may ask the app to show its table before the
         seat says the tables are not arriving. */
      const deadline = Date.now() + 5000;
      let rows: HTMLElement[] = [];
      while (Date.now() < deadline && rows.length === 0) {
        rows = [...(governanceFrameDoc()?.querySelectorAll<HTMLElement>('tr[data-row-index]') ?? [])];
        if (rows.length === 0) await new Promise((r) => setTimeout(r, 150));
      }
      if (rows.length === 0) return; // an empty project: nothing to select, nothing opens
      /*
       * THE DEFAULT IS THE LATEST TRACE — NEVER AN ARBITRARY ROW (owner, 2026-10-13 late:
       * *"you can't just pick an arbitrary line in the table and call it default — default
       * has to be the latest one … so it's always changing every time there's an update …
       * or else it'll eventually get pushed way down."*). The row's own time cell (td[1] —
       * the cell the row handler answers) carries its start time; the row with the MAXIMUM
       * is the latest, whatever order the table is showing. Rows whose time cannot be read
       * are skipped; if NO row reads, the pick falls back to the FIRST row — a FALLBACK
       * ONLY: the app's own default sort is newest-first, so the two agree in practice,
       * and this comment says so rather than pretending position is the rule.
       */
      const timeOf = (row: HTMLElement): number => {
        const m = (row.querySelectorAll('td')[1]?.textContent ?? row.textContent ?? '')
          .match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
        return m ? Date.parse(`${m[1]}T${m[2]}`) : Number.NaN;
      };
      const latestRow = (list: HTMLElement[]): HTMLElement => {
        let pick = list[0];
        let best = Number.NaN;
        for (const row of list) {
          const t = timeOf(row);
          if (Number.isNaN(t)) continue;
          if (Number.isNaN(best) || t > best) {
            best = t;
            pick = row;
          }
        }
        return pick;
      };
      /* THE CELL IS RESOLVED AT PRESS TIME, NEVER CAPTURED (2026-10-17, measured on the
         Evals→Trace flip): arriving from another app page the table re-renders a beat after it
         paints, and a captured cell is then DETACHED — events dispatched into a detached node
         reach nobody, and the tree sat waiting while fifty rows stood on screen. Each press
         re-reads the live table and takes the latest row. */
      const pressLatestRow = (): boolean => {
        const fresh = [...(governanceFrameDoc()?.querySelectorAll<HTMLElement>('tr[data-row-index]') ?? [])];
        if (fresh.length === 0) return false;
        const row = latestRow(fresh);
        const cell = (row.querySelectorAll('td')[1] as HTMLElement | undefined) ?? row;
        const box = cell.getBoundingClientRect();
        const at = {
          bubbles: true,
          composed: true,
          cancelable: true,
          view: cell.ownerDocument.defaultView ?? window,
          clientX: Math.round(box.x + box.width / 2),
          clientY: Math.round(box.y + box.height / 2),
          button: 0,
        };
        cell.dispatchEvent(new PointerEvent('pointerdown', { ...at, pointerId: 1, isPrimary: true, buttons: 1 }));
        cell.dispatchEvent(new MouseEvent('mousedown', { ...at, buttons: 1 }));
        cell.dispatchEvent(new PointerEvent('pointerup', { ...at, pointerId: 1, isPrimary: true, buttons: 0 }));
        cell.dispatchEvent(new MouseEvent('mouseup', { ...at, buttons: 0 }));
        cell.dispatchEvent(new MouseEvent('click', at));
        return true;
      };
      /* ROWS STAND BEFORE THE APP'S HANDLERS DO (2026-10-17): one settle beat, then the
         sequence; if the selection still never lands, a second and third beat. A real hand
         never noticed the wait; the synthetic sequence did. */
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? 350 : 500));
        if (governanceTraceSelRef.current.bundle) return;
        pressLatestRow();
      }
    };
    /*
     * THE TABLE ALWAYS INDICATES WHAT IS DISPLAYED — THE TOGGLE LAW (owner, 2026-10-13
     * late: "you can either select a table[item] or you can select the trace navigation …
     * we have to indicate on the table a default"). With a STANDING selection, the app
     * re-navigates WITH ITS OWN SELECTION PARAMS (the v4 dialect: peek = observation = the
     * root's id), so the table re-marks that row — the clean `/traces` url used to wash the
     * params out and leave the table unmarked (measured: mark gone, the seat still
     * displaying the trace). Returns true when it navigated with a selection; false lets
     * the caller run the default chain. One helper, so the Trace button, the ask-pivot and
     * any future door cannot disagree about what the table says.
     */
    const navigateTracesWithSelection = (projectId: string): boolean => {
      const selNow = governanceTraceSelRef.current;
      const bundleNow = selNow.bundle;
      if (!bundleNow) return false;
      /* THE APP'S OWN PEEK ID IS THE MARK THE TABLE HEARS (measured 2026-10-13 late: a
         re-navigation built from a different parentless observation lit NO row — the
         app's own row click had used another id for the same trace). Same dialect the
         app writes, or the table stays dark. */
      const peekNow = selNow.peekId && bundleNow.observations.some((o) => o.id === selNow.peekId)
        ? selNow.peekId
        : (bundleNow.observations.find((o) => !o.parentObservationId) ?? bundleNow.observations[0] ?? null)?.id ?? null;
      if (!peekNow) return false;
      navigateGovernanceTool(
        `/project/${projectId}/traces?peek=${peekNow}&observation=${peekNow}&traceId=${bundleNow.trace.id}`,
      );
      return true;
    };
    /* THE EVALS EXPERIENCE'S OWN RAIL — a click there that is not Evals hands the room back
       to the shared seat and re-raises the same `tab-change` on it, so the room's one handler
       (trace default, navigation) runs exactly as it does from the shared rail. */
    const onEvalsSeatTab = ((e: CustomEvent<{ tab?: string }>) => {
      const tab = String(e.detail?.tab ?? '');
      if (!tab || tab === 'eval') return;
      const seatNow = governanceSeatRef.current;
      if (seatNow) {
        seatNow.activeTab = tab;
        seatNow.dispatchEvent(new CustomEvent('tab-change', { detail: { tab }, bubbles: true, composed: true }));
      }
      setGovernanceEvalsSeat(false);
    }) as EventListener;
    governanceEvalsSeatRef.current?.addEventListener('tab-change', onEvalsSeatTab);
    /* A ROW PICK IN THE EVALS EXPERIENCE LOADS THAT EVALUATOR IN THE MIDDLE (owner, 2026-10-17:
       *"it was loading the evaluator when I selected it inside of the chat and it was doing what
       it was supposed to do"*) — the app's own detail page, the same address its list uses. */
    const onEvalsPick = ((e: CustomEvent<{ id?: string }>) => {
      const id = String(e.detail?.id ?? '');
      if (!id) return;
      const embedPick = governanceEmbedRef.current;
      const srcPick = embedPick?.getAttribute('src') ?? governanceToolUrl();
      const matchPick = String(srcPick).match(/\/project\/([^/?#]+)/);
      if (!matchPick) return;
      navigateGovernanceTool(`/project/${decodeURIComponent(matchPick[1])}/evals/${encodeURIComponent(id)}`);
    }) as EventListener;
    /* A RULE CLICK OPENS THE RULE'S OWN EDIT PAGE IN THE MIDDLE (owner, 2026-10-17: the middle
       is *"the place where you edit the rule and you edit the evaluator … it's really the edit
       create function"*). /evals/rules/<id> renders the app's EditRuleDialog over an empty
       page body — no rules index behind it, same as the new-rule seat. */
    const onRulePick = ((e: CustomEvent<{ id?: string }>) => {
      const id = String(e.detail?.id ?? '');
      if (!id) return;
      const embedRule = governanceEmbedRef.current;
      const srcRule = embedRule?.getAttribute('src') ?? governanceToolUrl();
      const matchRule = String(srcRule).match(/\/project\/([^/?#]+)/);
      if (!matchRule) return;
      navigateGovernanceTool(
        `/project/${decodeURIComponent(matchRule[1])}/evals/rules/${encodeURIComponent(id)}`,
      );
    }) as EventListener;
    /* AND ITS ADD BUTTON OPENS THE APP'S OWN SETUP — evaluators → /evals/new, rules →
       /evals/rules/new (the setup as its OWN PAGE, no index behind it; owner, 2026-10-17:
       *"Remove the index, which is appearing in the background. Load the modal as its own
       seat just like evaluator."*). THE INDEXES ARE NOT SHOWN IN THE MIDDLE — add lands on
       setup, a row click lands on a page. */
    const onEvalsAdd = ((e: CustomEvent<{ mode?: string }>) => {
      const embedAdd = governanceEmbedRef.current;
      const srcAdd = embedAdd?.getAttribute('src') ?? governanceToolUrl();
      const matchAdd = String(srcAdd).match(/\/project\/([^/?#]+)/);
      if (!matchAdd) return;
      const pid = decodeURIComponent(matchAdd[1]);
      navigateGovernanceTool(
        e.detail?.mode === 'rules' ? `/project/${pid}/evals/rules/new` : `/project/${pid}/evals/new`,
      );
    }) as EventListener;
    governanceEvalsSeatRef.current?.addEventListener('evaluator-select', onEvalsPick);
    governanceEvalsSeatRef.current?.addEventListener('rule-select', onRulePick);
    governanceEvalsSeatRef.current?.addEventListener('evals-add', onEvalsAdd);
    /* A SESSION CARD OPENS THAT SESSION'S OWN PAGE IN THE MIDDLE (owner, 2026-10-17: *"of
       course it needs to open up the actual session"*). The card says which session was
       pressed; this shell turns it into the app's own address — /project/<id>/sessions/
       <session>, the same shape the app's Sessions table links to — so the middle loads the
       REAL session, not a copy of it. NOTHING ELSE MOVES: no tab changes, no seat is shown
       or hidden, the rail stays where the person left it. One press, one address, one pane. */
    const onSessionPick = ((e: CustomEvent<{ session?: string }>) => {
      const session = String(e.detail?.session ?? '');
      if (!session) return;
      const embedSession = governanceEmbedRef.current;
      const srcSession = embedSession?.getAttribute('src') ?? governanceToolUrl();
      const matchSession = String(srcSession).match(/\/project\/([^/?#]+)/);
      if (!matchSession) return;
      navigateGovernanceTool(
        `/project/${decodeURIComponent(matchSession[1])}/sessions/${encodeURIComponent(session)}`,
      );
    }) as EventListener;
    seat.addEventListener('session-select', onSessionPick);
    governanceEvalsSeatRef.current?.addEventListener('session-select', onSessionPick);
    seat.addEventListener('tab-change', ((e: CustomEvent<{ tab?: string }>) => {
      /* THE EVALS BUTTON OPENS THE APPLICATION'S EVALUATORS SECTION (owner, 2026-10-16:
         *"I want to make [the] eval's button open up the evaluator's tab from the
         application"* — "just like trace loads"). The same door the Trace button uses, and
         at the same moment the section's teaching is announced: the SEAT decides whether
         the person has heard it yet (once per conversation — shared/sectionTeaching +
         chat-panel). No default selection rides this one: there is nothing to load until
         the room has its own evaluators in it (the owner's own staging: *"the evaluators
         will load eventually … I'm not doing it right now"*). */
      if (e.detail?.tab === 'eval') {
        const embedEval = governanceEmbedRef.current;
        const srcEval = embedEval?.getAttribute('src') ?? governanceToolUrl();
        const matchEval = String(srcEval).match(/\/project\/([^/?#]+)/);
        if (matchEval) {
          const projectEval = decodeURIComponent(matchEval[1]);
          /* THE EVALS EXPERIENCE STANDS IN THE ROOM — its own file, told which project it is
             about and which tab it is. The model control reads the app's own model data; the
             room binds nothing else. */
          const evalsSeatNow = governanceEvalsSeatRef.current;
          if (evalsSeatNow) assignProps(evalsSeatNow, {
            projectId: projectEval,
            activeTab: 'eval',
          });
          setGovernanceEvalsSeat(true);
          /* NO INDEX IN THE MIDDLE (owner, 2026-10-17: *"We're not gonna be showing them anymore
             inside of the middle of the layout of the section where the application loads the
             iframe … and if you click on one of the eval's, it'll take you to the governance
             tab."*). The tab opens the app on the NEWEST evaluator's own page — the same edit
             surface a row click uses — and on the create page when the list is empty. The app's
             evaluators index is never loaded here. */
          void (async () => {
            try {
              const res = await fetch(
                `/api/governance/evaluators?project_id=${encodeURIComponent(projectEval)}`,
              );
              const body = (await res.json().catch(() => null)) as
                | { status?: string; evaluators?: Array<{ id: string }> }
                | null;
              const newest = body && body.status !== 'error' ? body.evaluators?.[0]?.id : null;
              navigateGovernanceTool(
                newest
                  ? `/project/${projectEval}/evals/${encodeURIComponent(newest)}`
                  : `/project/${projectEval}/evals/new`,
              );
            } catch {
              navigateGovernanceTool(`/project/${projectEval}/evals/new`);
            }
          })();
        }
        return;
      }
      /* SESSIONS IS THE EVALS SEAT'S OWN TAB (governance/QUERY-LANES.md: "seat = tab, and each
         seat carries its own criteria for searching its own data"). The evals seat already owns
         the sessions branch — it mounts `sessions-feed`, which selects its first row by default
         and marks it purple — and it is the element that owns a query lane's send path. The
         shared seat does not, so sending the tab there left the sessions view with no seat of
         its own. The middle still receives the selected session through `session-select`. */
      if (e.detail?.tab === 'sessions') {
        const embedSessions = governanceEmbedRef.current;
        const srcSessions = embedSessions?.getAttribute('src') ?? governanceToolUrl();
        const matchSessions = String(srcSessions).match(/\/project\/([^/?#]+)/);
        if (matchSessions) {
          assignProps(governanceEvalsSeatRef.current, {
            projectId: decodeURIComponent(matchSessions[1]),
            activeTab: 'sessions',
          });
          setGovernanceEvalsSeat(true);
        }
        return;
      }
      /* ANY OTHER TAB RETURNS THE ROOM TO THE SHARED SEAT. */
      setGovernanceEvalsSeat(false);
      if (e.detail?.tab !== 'trace') return;
      const embed = governanceEmbedRef.current;
      const srcNow = embed?.getAttribute('src') ?? governanceToolUrl();
      const match = String(srcNow).match(/\/project\/([^/?#]+)/);
      if (!match) return;
      const projectId = decodeURIComponent(match[1]);
      if (navigateTracesWithSelection(projectId)) return;
      navigateGovernanceTool(`/project/${projectId}/traces`);
      void selectLatestTableRow();
      /* THE TRACE READS FOR ITSELF (owner, 2026-10-17: *"Trace is disconnected … can you not
         load two separate data flows in the same component."*). The app's table is ONE flow —
         the row press above. This is the OTHER: our own read of the newest trace straight from
         the app's API (fetchGovFirstTrace, measured and kept for exactly this). A grace period
         comes first so the row flow wins when it lands; if the table is slow, empty, or the
         middle is showing another page, the seat still draws from this read. A failure says
         its real reason. */
      window.setTimeout(() => {
        if (governanceTraceSelRef.current.bundle) return;
        void (async () => {
          try {
            const base = `${window.location.origin}${governanceSectionPrefix()}`;
            const traceId = await fetchGovFirstTrace(base, projectId);
            if (!traceId) return;
            if (governanceTraceSelRef.current.bundle) return;
            setGovernanceTraceSig({
              projectId,
              traceId,
              obsId: null,
              timestampIso: null,
              peekId: null,
            });
          } catch (err) {
            console.warn('[trace] independent read failed:', err);
          }
        })();
      }, 2500);
    }) as EventListener);
    seat.addEventListener('open-composer', (() => {
      /* THE SEAT'S OWN PROPERTY IS THE TRUTH — the resolution wrote it there, and it is
         what the button was drawn from (the ref only carries the value across entries). */
      const packageId = governanceSeatRef.current?.composerPackageId ?? '';
      if (!packageId) return;
      openComposerRef.current?.(packageId);
    }) as EventListener);
    /*
     * DOWNLOAD JSON — the fly-out's own download, honored from the header (owner,
     * 2026-10-13: *"All we need is the download button"*). The header asks; the SHELL
     * writes the file, because the shell is what holds the data (the same split as
     * every other read here). The payload is what this room has actually READ for the
     * trace on screen — the bundle (trace + observations) plus the scores it fetched —
     * never a fresh fetch invented at click time, and never a placeholder file.
     */
    seat.addEventListener('trace-download', (() => {
      const sel = governanceTraceSelRef.current;
      const bundle = sel.bundle;
      if (!bundle) return;
      const payload = {
        trace: bundle.trace,
        observations: bundle.observations,
        scores: sel.scores ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trace-${bundle.trace.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      /* APPENDED, THEN REVOKED LATE — the standard pattern for an anchor download: the
         element must sit in the document (some engines ignore a detached click), and a
         synchronous revoke can cancel the download the click just started. Measured
         2026-10-13: this automated browser's own downloads are disabled (a BARE anchor
         click lands no file in it either), so arrival is the owner's one-click check —
         everything up to the click is verified (trace-download fires, the anchor clicks,
         and the blob carries the real trace: id, observations, scores). */
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    }) as EventListener);
    /*
     * THE ASK PIVOTS THE ROOM (owner, 2026-10-13 late: *"if I tell her I want to look
     * at trace — can she pivot the whole process in the whole viewport back to trace
     * without me having to click on anything?"*). The seat announces every real person
     * turn on the window (a2ui:person-turn — fired after the answer landed, carrying
     * the turn's own words); when those words ask for the trace, THE ROOM answers: the
     * seat flips to the trace tab and the app goes to its traces list — if nothing
     * stands selected, the first item loads itself and the table shows it highlighted
     * (the rail button's own default chain — ONE mechanism, nothing invented). Her
     * reply still answers in words; the pivot is the room's, never fabricated into
     * her mouth. The match is deliberately plain: a word-level trace/traces/tracing.
     */
    const onGovPersonTurn = ((e: CustomEvent<{ text?: string; sessionId?: string }>) => {
      const detail = e.detail ?? {};
      const seatNow = governanceSeatRef.current;
      if (detail.sessionId && seatNow?.sessionId && detail.sessionId !== seatNow.sessionId) return;
      const asked = String(detail.text ?? '');
      if (!/\btrac(e|es|ing)\b/i.test(asked)) return;
      if (seatNow) seatNow.activeTab = 'trace';
      const embed = governanceEmbedRef.current;
      const srcNow = embed?.getAttribute('src') ?? governanceToolUrl();
      const match = String(srcNow).match(/\/project\/([^/?#]+)/);
      if (!match) return;
      const pid = decodeURIComponent(match[1]);
      if (!navigateTracesWithSelection(pid)) {
        navigateGovernanceTool(`/project/${pid}/traces`);
        void selectLatestTableRow();
      }
    }) as EventListener;
    window.addEventListener('a2ui:person-turn', onGovPersonTurn);
    seat.append(headerEl, treeEl, detailEl);
    governanceTraceElsRef.current = { header: headerEl, tree: treeEl, detail: detailEl };
    /* THE LAST TRACE STANDS — re-entry restores what the seat was showing, WITHOUT opening
       the column or flipping the tab: those ride a fresh selection only (the read effect
       re-applies the node's I/O because the elements are new — `els` mismatch). */
    const prevSel = governanceTraceSelRef.current;
    if (prevSel.bundle) {
      const observation = prevSel.obsId
        ? (prevSel.bundle.observations.find((o) => o.id === prevSel.obsId) ?? null)
        : null;
      assignProps(headerEl, { trace: prevSel.bundle.trace, observation });
      assignProps(treeEl, {
        trace: prevSel.bundle.trace,
        observations: prevSel.bundle.observations,
        selectedId: observation?.id ?? null,
      });
      if (prevSel.scores || prevSel.commentCounts) {
        assignProps(treeEl, { scores: prevSel.scores ?? [], commentCounts: prevSel.commentCounts ?? {} });
        assignProps(detailEl, { scores: prevSel.scores ?? [] });
      }
      assignProps(detailEl, { trace: prevSel.bundle.trace, observation, io: undefined, observations: prevSel.bundle.observations });
      const seatForRestore = governanceSeatRef.current;
      if (seatForRestore) {
        assignProps(seatForRestore, { governanceTrace: prevSel.bundle.trace, governanceObservation: observation, composerPackageId: governanceComposerPackageRef.current, disabledTabs: '' });
      }
    }
    let cancelled = false;
    /* AND THE LANDING READOUT — with no trace selected the bar features the room itself (owner,
       2026-10-14: *"we need to put something in our header box when you land on the dashboard …
       maybe model metrics/usage"*). Read once per room open; a selection supersedes it (the read
       effect's own header writes above it). A failed read leaves the bar as it was — never a
       claimed number (the read module throws its real reason; the catch says it loudly). */
    {
      /* THE ROOM'S ADDRESS ARRIVES WITH THE ASSEMBLY — the frame's src can be a beat behind this
         effect, so the read WAITS for it (bounded, cancelled-safe) instead of giving up on the
         first look; silence here is how a feature nobody sees gets built. */
      let metricsTries = 0;
      const readRoomMetrics = () => {
        if (cancelled) return;
        /* WHICHEVER VOICE HAS THE ADDRESS — the embed's `src` property, its attribute, or the
           tool URL: the first candidate that NAMES `/project/<id>` wins. The old chain trusted
           any non-null property (`'' ?? attr` never falls through), so an empty string while
           the app booted kept every retry matching nothing — while the attribute carried a
           project address from the first render (the JSX binds src={governanceToolUrl()}, and
           the tool URL names the project). Found 2026-10-14: two natural room opens left the
           bar unbound. A candidate without `/project/` is skipped, never trusted. */
        const embedNow = governanceEmbedRef.current as unknown as { src?: string } | null;
        const candidates = [embedNow?.src, governanceEmbedRef.current?.getAttribute('src'), governanceToolUrl()];
        let srcNow = '';
        for (const candidate of candidates) {
          const value = String(candidate ?? '');
          if (/\/project\/[^/?#]+/.test(value)) {
            srcNow = value;
            break;
          }
        }
        const matchNow = srcNow.match(/\/project\/([^/?#]+)/);
        if (!matchNow) {
          if (metricsTries++ < 10) window.setTimeout(readRoomMetrics, 500);
          else console.warn('[governance readout] room address never arrived — metrics not read');
          return;
        }
        const pidNow = decodeURIComponent(matchNow[1]);
        /* ONE RETRY ON A REFUSED READ — a transient failure must not blank the landing facts
           for the whole room open; only the SECOND failure is said out loud, as before. */
        const fetchOnce = (attempt: number) => {
          void fetchGovRoomMetrics(`${window.location.origin}${governanceSectionPrefix()}`, pidNow)
            .then((metrics) => {
              if (cancelled) return;
              assignProps(headerEl, { metrics });
              assignProps(evalsHeaderEl, { metrics });
            })
            .catch((err) => {
              if (attempt < 2) {
                window.setTimeout(() => fetchOnce(attempt + 1), 750);
                return;
              }
              console.warn('[governance readout] room metrics unavailable:', err);
            });
        };
        fetchOnce(1);
      };
      readRoomMetrics();
    }
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/builder/governance/room`, {
          method: 'POST',
          headers: { 'X-User-ID': getStoredUserId() },
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; session_id?: string; conversation_id?: string; label?: string }
          | null;
        if (cancelled) return;
        if (!body?.ok || !body.session_id || !body.conversation_id) {
          /* THE CARRIER SAID NO — the seat stays on its honest blank face. */
          return;
        }
        const unreported = assignProps(seat, {
          sessionId: body.session_id,
          conversationId: body.conversation_id,
          packageTitle: String(body.label || 'Governance'),
          allowedTabs: GOVERNANCE_SEAT_TABS,
          /* PREVIEW IS DEACTIVATED UNTIL A TRACE IS SELECTED (owner, 2026-10-13) — the
             rail keeps the button visible and dark; the selection is what lights it.
             The read paths below rewrite this the moment a selection stands. */
          disabledTabs: governanceTraceSelRef.current.bundle ? '' : 'tools',
          /* THE ROOM'S OWN WORDS FOR THE FOURTH BUTTON (owner, 2026-10-13: *"tools changed
             to preview on the chat"*). The ID stays `tools` — ids are the stable key — and
             the room renames the LABEL because ITS hole shows the trace detail preview,
             not the composer's tool registry. Other rooms bind no map and keep "Tools". */
          tabLabels: '{"tools":{"label":"Preview","tooltip":"Preview the selected trace detail"}}',
          instructions:
            'The Governance room carries the governance team\'s own conversations. Answer briefly and about the work in front of the person.',
          /* TRUE NOW — THIS ROOM HAS EYES (2026-10-13): the shell reads the trace the
             person selects (lib/governance-trace-source.ts) and writes it onto the seat
             as `governanceTrace`/`governanceObservation`, so her turn context carries the
             TRACE ON SCREEN block — the plan's §3.8 seam, live. Still never a default:
             the room states it, the seat appends it. */
          graceLiveContext: true,
          // A tab click is not a turn (the product room's measurement).
          tracePrompt: false,
          /* THE ROOM OPENS ON THE CHAT (owner, 2026-10-23: *"first of all the governance panel
             should default to chat when you load it"*). Without this, a seat reused across room
             entries kept whichever tab was last clicked — Sessions, Evals — and the room looked
             like it had opened on a view rather than on her. The binding runs on every entry, so
             each load starts on Chat. */
          activeTab: 'chat',
        });
        if (unreported.length) {
          console.warn(`[governance seat] unreported bindings: ${unreported.join(', ')}`);
        }
        /* AND THE EVALS SEAT GETS THE SAME RAIL WORDS — the labels are the room's, not the
           copy's defaults. */
        const evalsSeatBound = governanceEvalsSeatRef.current;
        if (evalsSeatBound) {
          assignProps(evalsSeatBound, {
            allowedTabs: GOVERNANCE_SEAT_TABS,
            tabLabels: '{"tools":{"label":"Preview","tooltip":"Preview the selected trace detail"}}',
            disabledTabs: governanceTraceSelRef.current.bundle ? '' : 'tools',
            packageTitle: 'Evaluators',
            /* THE EVALS TAB DRAWS THE EVALUATORS (owner, 2026-10-23: *"It shouldn't draw her
               conversation. It's supposed to draw evals."*). `evalsTalk` is NOT bound: it made
               the seat's Evals tab draw her thread instead of the index, and the thread it drew
               was empty because this seat is never given a session or a conversation. The
               evaluators index is read by the element itself from
               `/api/governance/evaluators`, so with no flag the tab draws the rows. */
          });
        }
        /* THE ROOM'S OWN ARRIVAL (owner, 2026-10-14: *"she should say something on land when people
           load the page even if it's tucked away to the right"*). Marked HERE — the one place the
           seat is bound with the room's session in hand — so it fires once per room open, addressed
           to this room's session (no other seat answers it); only a thread with nothing in it is
           greeted (the panel's own rule). The record carries it if the seat is not up yet; the
           event carries it if one is already up. */
        markArrival('governance', body.session_id);
        window.dispatchEvent(new CustomEvent('a2ui:composer-opened', { detail: { kind: 'governance', sessionId: body.session_id } }));
        /* THE SEAT IS UP — assert the pane's width from a beat where the room is measurable. */
        assertPaneWidth(governanceLayoutRef.current);
      } catch {
        /* a failed room fetch leaves the seat as it stands. */
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener('a2ui:person-turn', onGovPersonTurn);
      layout?.removeEventListener('resize-start', onGripStart);
      layout?.removeEventListener('resize-end', onGripEnd);
      governanceEvalsSeatRef.current?.removeEventListener('tab-change', onEvalsSeatTab);
      governanceEvalsSeatRef.current?.removeEventListener('evaluator-select', onEvalsPick);
      governanceEvalsSeatRef.current?.removeEventListener('rule-select', onRulePick);
      governanceEvalsSeatRef.current?.removeEventListener('evals-add', onEvalsAdd);
      seat.removeEventListener('session-select', onSessionPick);
      governanceEvalsSeatRef.current?.removeEventListener('session-select', onSessionPick);
      evalsHeaderEl.remove();
      setGovernanceEvalsSeat(false);
      setGovernanceGripActive(false);
    };
  }, [headerTab]);
}
