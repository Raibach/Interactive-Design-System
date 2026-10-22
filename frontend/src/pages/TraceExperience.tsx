/**
 * THE TRACE EXPERIENCE — ITS OWN PAGE, IN ITS OWN FILE.
 *
 * Owner, 2026-10-17: *"the left vertical navigation on the chat can remain the same — icons
 * determine what loads inside of this area … you're gonna have to make a separate file for
 * that trace."* This page is that separate file. It is the trace surface and nothing else:
 * no chat thread, no conversations, no evals list — the rail's other icons load their own
 * surfaces, never this one.
 *
 * WHAT IT DRAWS. The catalogue's own trace elements, registered by the side-effect imports:
 *   <trace-context-header>   the facts strip (id, name, metrics, session, user)
 *   <trace-tree>             the observation tree with its toolbar (Search, Expand/Collapse,
 *                            View Options, Tree | Timeline | Graph)
 *   <trace-detail>           the selected node's detail strip
 * They are VIEWS: they fetch nothing. This page is the source — it reads through the same
 * module the room's seat reads (`lib/governance-trace-source.ts`), so both surfaces show the
 * same bytes; a node click writes `selected` into this page's own address.
 *
 * THE ADDRESS IS THE INPUT: `/trace-experience?project=<projectId>` loads the newest trace;
 * `&trace=<traceId>` opens that one; `&selected=<observationId>` marks the node.
 *
 * STYLING. The elements carry their own; this page paints no chrome of its own.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
// Side-effect imports: registration is what makes the tags draw.
import '@/components/lit/trace-context-header';
import '@/components/lit/trace-tree';
import '@/components/lit/trace-detail';
import {
  fetchGovFirstTrace,
  fetchGovTrace,
  type GovTraceBundle,
} from '@/lib/governance-trace-source';

const GOV_BASE = '/governance';

const TraceExperience: React.FC = () => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const treeRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; bundle: GovTraceBundle }
    | { kind: 'failed'; reason: string }
  >({ kind: 'idle' });

  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('project') ?? '';
  const traceId = params.get('trace') ?? '';
  const selectedId = params.get('selected') ?? '';

  /* THE READ — this page's own fetch, its real failure said out loud. */
  useEffect(() => {
    if (!projectId) {
      setState({ kind: 'failed', reason: 'No project in the address — add ?project=<projectId>.' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    void (async () => {
      try {
        const id = traceId || (await fetchGovFirstTrace(GOV_BASE, projectId));
        if (!id) {
          if (!cancelled) setState({ kind: 'failed', reason: 'This project has no traces yet.' });
          return;
        }
        const bundle = await fetchGovTrace(GOV_BASE, projectId, id, null, selectedId || null);
        if (!cancelled) setState({ kind: 'ready', bundle });
      } catch (err) {
        if (!cancelled) setState({ kind: 'failed', reason: `The trace could not be read — ${String(err)}` });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, traceId, selectedId]);

  /* THE WRITE — the values the trace views declare. */
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const observation = selectedId
      ? (state.bundle.observations.find((o) => o.id === selectedId) ?? null)
      : null;
    const header = headerRef.current as (HTMLElement & Record<string, unknown>) | null;
    const tree = treeRef.current as (HTMLElement & Record<string, unknown>) | null;
    const detail = detailRef.current as (HTMLElement & Record<string, unknown>) | null;
    if (header) {
      header.trace = state.bundle.trace;
      header.observation = observation;
    }
    if (tree) {
      tree.trace = state.bundle.trace;
      tree.observations = state.bundle.observations;
      tree.selectedId = observation?.id ?? null;
    }
    if (detail) {
      detail.trace = state.bundle.trace;
      detail.observation = observation;
      detail.observations = state.bundle.observations;
    }
  }, [state, selectedId]);

  /* THE PICK — recorded in this page's own address, nowhere else. */
  const onSelect = useCallback((event: Event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (!id) return;
    const next = new URLSearchParams(window.location.search);
    next.set('selected', id);
    window.history.replaceState(null, '', `${window.location.pathname}?${next.toString()}`);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.addEventListener('trace-node-selected', onSelect);
    return () => host.removeEventListener('trace-node-selected', onSelect);
  }, [onSelect]);

  return (
    <div ref={hostRef} className="flex h-screen min-h-0 flex-col overflow-hidden">
      {state.kind === 'failed' ? (
        <p className="m-0 p-4 text-[14px] text-[#e66]">{state.reason}</p>
      ) : (
        <>
          <trace-context-header ref={headerRef as unknown as React.RefObject<HTMLElement>} />
          <div className="flex min-h-0 flex-1 flex-col">
            <trace-tree ref={treeRef as unknown as React.RefObject<HTMLElement>} className="min-h-0 flex-1" />
            <trace-detail ref={detailRef as unknown as React.RefObject<HTMLElement>} />
          </div>
        </>
      )}
    </div>
  );
};

export default TraceExperience;

/**
 * THE THREE TAGS THIS PAGE DRAWS, DECLARED FOR JSX.
 *
 * Each element registers its own class in `HTMLElementTagNameMap`; the React tree is a
 * different type space, so the production build refused them until they were named here. The
 * props are plain HTML attributes with a loose ref, which is exactly how this page uses them —
 * `<trace-feed>` next door follows the same pattern.
 */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'trace-context-header': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'trace-tree': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'trace-detail': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
