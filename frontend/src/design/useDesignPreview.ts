/**
 * THE DESIGN PREVIEW — the column that shows a chosen component — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged and the callback is returned, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { resolveTag } from '@/components/lit/a2ui-renderer';
import { useCallback } from 'react';

/** Exactly what the callback needs from the shell, by name. */
export interface UseDesignPreviewDeps {
  setDesignTree: any;
}

export function useDesignPreview(deps: UseDesignPreviewDeps) {
  const { setDesignTree } = deps;
  return useCallback((preview: Record<string, any> | null) => {
    setDesignTree((prev) => {
      const session = (prev.dataModel as Record<string, any>)?.session ?? {};
      const tag = preview?.tag ? String(preview.tag) : "";

      /*
       * WHAT THIS SURFACE CAN DRAW, DECIDED BEFORE THE TREE IS WALKED.
       *
       * A REFERENCE TO AN ELEMENT THAT DOES NOT EXIST IS NOT DRAWN. The renderer reports it
       * faithfully ("Resolved to <agent-flow>, which no element defines — nothing was drawn"), and
       * that report is correct but it is not what this room should say: this room draws the design
       * system's components, and what has no element here is named in words on the preview instead
       * of drawn as a hole. `resolveTag` is the renderer's OWN resolver — imported, not
       * re-implemented — so this can never disagree with what would be drawn.
       *
       * AND IT IS COMPUTED HERE, ABOVE THE MAP, FOR A MEASURED REASON: the callback below reads it,
       * and the callback runs while the chain is being built. Declared after the chain it was in its
       * temporal dead zone — `Cannot access 'drawable' before initialization` — which threw inside
       * this element's effect and took the whole page down through the error boundary. The crash the
       * owner saw was mine, and it was a `const` in the wrong place, not a leftover React callback.
       */
      const resolved = preview && tag ? resolveTag(tag) : null;
      const drawable = !!resolved && !!customElements.get(resolved);

      /*
       * ── AND WHICH RUN PRODUCED THIS, BECAUSE THE TWO ARE DRAWN DIFFERENTLY ──────────────────
       *
       * A SUBMIT PRODUCES A DRAFT; A CLICK PRODUCES A COMPONENT. The two are NOT interchangeable
       * even when they carry the same name — and that is the ordinary case here: a designer edits
       * Figma and submits a node the catalogue already holds, so the draft's tag and the approved
       * component's tag are the same string. Drawing that string means asking the renderer to
       * resolve it, and the renderer resolves a name through the CATALOGUE — so the room drew the
       * approved component and the fresh draft was never on screen at all. The owner, 2026-09-30:
       * *"when I go to preview a change, I'm not seeing a change. I'm seeing the old lit component
       * because it has the same name. It's just reloading it from the lit catalog. I want to use the
       * temporary folder and it should be blind to whatever is in the lit catalog until I click
       * approve."*
       *
       * SO A DRAFT IS DRAWN BY ITS FILE AND A CLICK BY ITS NAME. The draft's address travels on the
       * ingest result (`preview.draft`: jobId, tag, modulePath, moduleUrl — the temporary file the
       * backend wrote under `.preview/<jobId>/`), and `<draft-preview>` loads exactly that file
       * inside a sandboxed document that cannot read the catalogue at all. A ROW CLICK KEEPS ITS
       * CURRENT PATH: that component IS in the catalogue, so resolving its name is not a guess —
       * it is the answer, and its bindings come with it.
       */
      const draft = preview?.source === "ingest" ? preview?.draft ?? null : null;
      const drawsDraft = !!draft?.moduleUrl;

      /*
       * ── AND WHEN AN INGEST ANSWERS WITHOUT AN ADDRESS, NOTHING IS DRAWN. IT IS NOT FALLEN BACK.
       *
       * The tempting line here is "no address, so draw the catalogue's element under the tag" — and
       * that line IS the defect this column was fixed to remove: it is how a designer who had just
       * changed the design was shown the approved component instead. A missing address means the
       * answer cannot say WHICH file it built, so the honest drawing is none, with the reason on the
       * preview where the designer is looking. Substituting the catalogue's element would put a
       * component on screen under a name that has two candidates — the exact ambiguity that started
       * this (owner, 2026-09-30: *"I'm not seeing a change. I'm seeing the old lit component because
       * it has the same name."*). A row clicked in the tree keeps the catalogue path, because there
       * the component IS the catalogue's and the name is not ambiguous.
       */
      const drawsCatalogue = preview?.source !== "ingest" && !!preview && !!tag && drawable;

      const components = prev.components
        .filter((c: any) => {
          // ONE RUN DRAWS ONE THING, so whichever drawing this run did not produce is REMOVED
          // rather than left in the list — a stale entry kept behind is an entry a reference could
          // still point at.
          if (c.id === "preview-draw") return drawsDraft;
          if (c.id === "preview-target") return drawsCatalogue;
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
          // THE PREVIEW NAMES ITS OWN DRAWING, by id, per the adjacency rule. The renderer
          // instantiates it into the frame's slot — the frame component-preview renders — so the
          // component a run loaded is DRAWN, not only described. A tag the resolver cannot claim is
          // reported inside that frame by the renderer itself, never silently skipped.
          if (c.id === "preview") {
            return {
              ...c,
              children: drawsDraft
                ? { draw: "preview-draw" }
                : drawsCatalogue
                  ? { draw: "preview-target" }
                  : {},
            };
          }
          // THE DRAFT, DRAWN FROM ITS OWN FILE. The element is bound to `/session/preview/draft` —
          // the address the ingest returned — and it loads that module in a sandboxed document. No
          // catalogue name is resolved for this drawing, which is the whole point of it.
          if (c.id === "preview-draw") {
            return { ...c, component: "draft-preview", draft: { path: "/session/preview/draft" } };
          }
          if (c.id === "preview-target") return { ...c, component: tag || c.component };
          return c;
        });

      // The entry the reference points at. Emitted by the SHELL because WHICH component to draw is
      // the run's answer and not the assembly's — the same reason the Composer's RUN moves a view
      // into its middle column instead of the assembly guessing what was run.
      if (drawsDraft) {
        if (!components.some((c: any) => c.id === "preview-draw")) {
          components.push({
            id: "preview-draw",
            component: "draft-preview",
            draft: { path: "/session/preview/draft" },
          });
        }
      } else if (drawsCatalogue && !components.some((c: any) => c.id === "preview-target")) {
        /*
         * PUSHED ONLY WHEN IT IS NOT THERE, and the guard is the whole of a bug the surface reported
         * on itself (measured 2026-09-30): *"Surface has 1 problem — these were NOT rendered as
         * written. preview-target ai-surface-sandbox: Duplicate id "preview-target" — ids are the
         * join key for children, so the later entry replaced the earlier one."*
         *
         * The filter above KEEPS this entry while a catalogue component is being drawn, so pushing it
         * again on every row click made two entries under one id — and the renderer's report is
         * exactly right about the consequence: one of them was thrown away, silently, at render
         * time. The entry's `component` is kept current by the map above (`component: tag ||
         * c.component`), so this push exists for the FIRST row and nothing else.
         */
        // AND IT CARRIES THE COMPONENT'S OWN BINDINGS. Measured on the first build of this: the
        // entry named the tag and nothing else, so the preview drew a real <trace-feed> whose
        // `entries` prop was unset — the component rendered, in its frame, saying "waiting for the
        // surface to bind /trace/entries". That is not that component's empty state; it is THIS
        // ROOM holding the rows and not handing them over, and the owner read it on screen exactly
        // as the failure it is (2026-09-30: *"I need to see failures. It should fail loud. Waiting
        // for the surface to bind /trace/entries."*). So the room's OWN entry for the same
        // component is cloned when there is one (the room already names TraceFeed as `trace-view`,
        // bound to `/trace/entries`), and its paths come with it. Where the room holds no entry for
        // that component, the bare name is all there is — and that component's own empty state is
        // then the truth, not a defect.
        //
        // THE TWIN IS FOUND BY THE ELEMENT, NOT BY THE SPELLING. Comparing `c.component === tag`
        // missed the pairing that matters: the room's entry says `TraceFeed` and the tree's row says
        // `trace-feed`, and those are two names for one element — `resolveTag` is the app's own
        // answer to "which element does this name draw", so it is the answer used here. Two names
        // for one element matched by string equality is how an element came to be drawn without the
        // data that was sitting in the model beside it.
        const twin = prev.components.find(
          (c: any) =>
            c.id !== "preview-target" &&
            c.id !== "preview-draw" &&
            typeof c.component === "string" &&
            resolveTag(c.component) === resolved,
        );
        components.push({ ...(twin ? { ...twin } : {}), id: "preview-target", component: tag });
      }

      return {
        ...prev,
        components,
        dataModel: {
          ...prev.dataModel,
          session: {
            ...session,
            /*
             * `/session/preview` IS WHAT THE FRAME DRAWS (component-preview: identity, facts, the two
             * actions) AND `/session/preview/draft` IS WHAT THE DRAWING LOADS — the last ingest's
             * address, read by <draft-preview> for the frame's "draw" slot. One run, one write, and
             * the two readers take the half that is theirs; nothing derives the other's half.
             */
            preview: preview ?? undefined,
          },
        },
      };
    });
  }, []);
}
