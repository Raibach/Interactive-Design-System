/**
 * THE DESIGN ROOM'S SURFACE — assembly, render, then the injection, in that order — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged; every name it closes over arrives through `deps`, so the
 * behaviour is the page's own. The dependency list is the contract: a new name in the effect is a
 * compile error here until it is declared in the interface below.
 */
import { useEffect } from 'react';

/** Exactly what the block needs from the shell, by name. */
export interface UseDesignSurfaceDeps {
  designPreviewOpen: any;
  designRendererRef: any;
  designTree: any;
}

export function useDesignSurface(deps: UseDesignSurfaceDeps) {
  const { designPreviewOpen, designRendererRef, designTree } = deps;
  useEffect(() => {
    const el = designRendererRef.current;
    if (!el) return;
    /*
     * THE TREE THIS ROOM DRAWS, with the third column added once there is something for it —
     * see `designPreviewOpen` for the rule and the owner's words. An UNREFERENCED component in
     * the list is inert to the renderer, which is why the server can declare
     * `design-middle-container` without drawing it: the reference below is what draws the column,
     * and nothing else about the assembly changes.
     */
    const comps = designTree.components as any[];
    const openOutput =
      designPreviewOpen && comps.some((c) => c?.component === "design-middle-container");
    el.components = openOutput
      ? comps.map((c) =>
          c?.id === "root" && c.children && !c.children.middle
            ? { ...c, children: { ...c.children, middle: "design-middle" } }
            : c,
        )
      : comps;
    el.dataModel = designTree.dataModel;
    /*
     * ── AND THEN THE INJECTION — AFTER THE RENDER, NEVER BEFORE ────────────────────────
     *
     * THE ORDER IS THE OWNER'S, and it is the whole mechanism (2026-09-30): *"the assembly
     * happens. The render of this container happens and then the injection happens. It's in
     * an order."*
     *
     *   1. `components` and `dataModel` are assigned above — that is the ASSEMBLY.
     *   2. `await el.updateComplete` waits for the container to have been DRAWN — that is the
     *      RENDER. Awaiting is not politeness: assigning `components` only SCHEDULES Lit's
     *      update, so a query made in the same tick finds an empty shadow root, reports "no
     *      container", and the room then draws empty with nothing to explain it.
     *   3. The container is found and handed to React as a portal target — the INJECTION. It
     *      can only happen here, because before the render there is no element to inject into.
     *
     * WHAT IS FOUND is the room's own `<workspace-layout>`, read from THIS renderer's shadow
     * root — `el.shadowRoot`, never `document`: the element is drawn inside the shadow tree,
     * where no document-level query can see it. That boundary is the same one that made Save
     * write nothing until the model was read instead of the DOM.
     */
    let cancelled = false;
    /* Listeners this effect adds to the assembled room, removed when the effect re-runs or the
       room unmounts — an effect that leaves them behind stacks one per assembly. Declared HERE,
       beside `cancelled`, because both belong to the same effect's lifetime. */
    void (async () => {
      try {
        await el.updateComplete;
      } catch {
        // `updateComplete` does not reject in Lit. If it ever does, the query still runs and
        // reports no container rather than taking the effect — and the room — down with it.
      }
      if (cancelled) return;
      /*
      /* THE UX COLUMN IS GONE (2026-10-21): the rail no longer offers it, nothing here
         mounts the framed application, and no sign-in is requested for it. */
    })();
    return () => {
      cancelled = true;
    };
  }, [designTree, designPreviewOpen]);
}
