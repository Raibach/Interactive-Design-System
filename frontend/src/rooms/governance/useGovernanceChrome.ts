/**
 * THE GOVERNANCE ROOM'S NAVIGATION AND LOCATION REPORTER — moved out of
 * `pages/WritingAreaIndex.tsx` (2026-10-21), the Product room's architecture applied to this
 * room.
 *
 * Three statements live here, unchanged in substance from the page:
 *   1. `governanceSectionPrefix()` — the door: the tool's address may be a same-origin path.
 *   2. `navigateGovernanceTool(path)` — the nav's own write onto the frame.
 *   3. the reporter — the app posts its pathname back, and a trace selection rides that same
 *      report into the seat.
 */
import { useEffect, useRef, useState } from 'react';
import { governanceToolUrl } from '@/shared/appConfig';

export interface UseGovernanceChromeDeps {
  governanceEmbedRef: { current: any };
  governanceLayoutRef: { current: any };
  governanceSeatRef: { current: any };
  governanceTraceSelRef: { current: { traceId: string | null } };
  setGovernanceTraceSig: any;
}

export function useGovernanceChrome({
  governanceEmbedRef,
  governanceLayoutRef,
  governanceSeatRef,
  governanceTraceSelRef,
  setGovernanceTraceSig,
}: UseGovernanceChromeDeps) {
  /* THE ROOM'S LEFT NAV IS THE SHELL'S (owner, 2026-10-09): the Governance items live in the
     shell's left navigation and drive this embed. Each click writes the target route onto the
     frame and marks that section active. */
  const [governancePath, setGovernancePath] = useState('');
  /* THE EVALS SECTION'S ENTRY EDGE — records whether the app's location is /evals, so the
     shell can react to the section's entry (the reporter polls; polling is not loading). */
  const governanceWasOnEvalsRef = useRef(false);

  /* THE SECTION PREFIX (2026-10-10, the door): governanceToolUrl() may be a same-origin PATH
     ("/governance/project/…"). It is derived per navigation so a nav href
     ("/project/<id>/traces") lands as <origin><section><href>, and the reporter's pathnames —
     which carry the section — normalize back to the nav's own shape. */
  const governanceSectionPrefix = () => {
    try {
      const abs = new URL(governanceToolUrl(), window.location.href);
      const marker = abs.pathname.indexOf("/project/");
      return marker > 0 ? abs.pathname.slice(0, marker) : "";
    } catch {
      return "";
    }
  };

  const navigateGovernanceTool = (path: string) => {
    const base = governanceToolUrl();
    if (!base) return;
    try {
      const abs = new URL(base, window.location.href);
      const url = abs.origin + governanceSectionPrefix() + path;
      const embed = governanceEmbedRef.current;
      if (!embed) return;
      setGovernancePath(path);
      /* THE FRAME CAN DRIFT AWAY FROM ITS `src` (2026-10-09, owner-reported):
         the embedded app routes itself with the history API, which moves the
         document without rewriting the iframe's `src` attribute. A plain
         attribute write is then a no-op when the target equals the current
         `src` — the Home button would set the SAME url and the frame would not
         move (measured in the room: after the app landed on its org chooser,
         clicking Home left the frame there). So when `src` already names the
         target, navigate the window directly; browsers allow navigating a
         cross-origin frame (reading it is what is blocked). */
      if (embed.getAttribute('src') !== url) {
        embed.setAttribute('src', url);
      } else {
        embed.navigateTo(url);
      }
    } catch {
      /* URL() only throws on an unparseable base — unreachable after the emptiness check */
    }
  };

  /* THE APP REPORTS ITS LOCATION BACK (2026-10-09): the frame proxy injects a tiny reporter
     into the embedded app that postMessages its pathname on change, so the shell nav can mark
     the active section even when the person navigates inside the app. */
  useEffect(() => {
    const onLangfuseLocation = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: string } | null;
      if (!data || data.type !== 'langfuse-location' || typeof data.path !== 'string') return;
      try {
        if (event.origin !== new URL(governanceToolUrl(), window.location.href).origin) return;
      } catch {
        return;
      }
      /* THE SECTION COMES OFF BEFORE MATCHING (2026-10-10): under the door the app
         reports "/governance/project/…"; the nav's hrefs and its active-match regex
         are section-free. */
      const section = governanceSectionPrefix();
      const normalized = section && data.path.startsWith(section)
        ? (data.path.slice(section.length) || "/")
        : data.path;
      setGovernancePath(normalized);
      const pathOnly = normalized.split('?')[0];
      const onEvals = /\/evals(\/|$)/.test(pathOnly);
      governanceWasOnEvalsRef.current = onEvals;
      /*
       * THE SELECTION RIDES THE SAME REPORT — the interim channel, dies when the room goes
       * native. The app writes its own selection into the URL, and the reporter above
       * already carries it: a row click lands `?peek=<root obs>&observation=<same
       * id>&traceId=<trace>&timestamp=<ISO>` (verified live 2026-10-13) and navigation
       * inside the peek moves `observation` while `traceId` stays — the fork's v4 dialect.
       * A ROW CLICK IS THE TRACE (peek equals observation, or no observation at all) and
       * draws state 1; anything else is a NODE open and draws state 2. Only /traces routes
       * speak here — a peek on Sessions or Models is another surface's detail, not this
       * seat's.
       */
      try {
        const [pathPart, queryPart] = normalized.split('?');
        if (!/\/traces(\/|$)/.test(pathPart)) return;
        const params = new URLSearchParams(queryPart ?? '');
        const projectMatch = pathPart.match(/\/project\/([^/]+)/);
        const traceSeg = pathPart.match(/\/traces\/([^/]+)$/);
        const traceId = params.get('traceId') ?? traceSeg?.[1] ?? null;
        if (!traceId || !projectMatch) return;
        const peek = params.get('peek');
        const observation = params.get('observation');
        const isRowClick = !observation || observation === peek;
        const obsId = isRowClick ? null : observation;
        const projectId = decodeURIComponent(projectMatch[1]);
        const timestampIso = params.get('timestamp') ?? null;
        setGovernanceTraceSig((prev: any) => {
          if (prev && prev.traceId === traceId && prev.obsId === obsId && prev.peekId === peek) return prev;
          return { projectId, traceId, obsId, timestampIso, peekId: peek };
        });
        /* A FRESH SELECTION OPENS HER COLUMN ON THE TRACE TAB — the fly-out's replacement.
           Fired only when the trace actually changes; a node click inside the same trace
           never re-opens or re-flips anything, and the return to a view stays the person's
           own click, never automatic. */
        if (governanceTraceSelRef.current.traceId !== traceId) {
          const layout = governanceLayoutRef.current;
          /* THROUGH HER OWN DOOR — `openChat` is the rail's act made public; a plain
             property write is refused once a hand has closed her (see the method's note),
             and this click is the person's own hand. */
          if (layout) layout.openChat();
          const seat = governanceSeatRef.current;
          if (seat) seat.activeTab = 'trace';
        }
      } catch {
        /* a malformed path is not a selection — the nav highlight above already took it */
      }
    };
    window.addEventListener('message', onLangfuseLocation);
    return () => window.removeEventListener('message', onLangfuseLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { governancePath, governanceSectionPrefix, navigateGovernanceTool };
}
