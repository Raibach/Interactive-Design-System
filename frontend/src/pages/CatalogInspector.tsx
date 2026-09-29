/**
 * The catalogue inspector — the real structure of catalog.json, on screen.
 *
 * WHAT THIS PAGE IS. A reader, not an editor. It mounts two elements:
 *   <catalog-schema-view>  one catalogue exactly as the file writes it — the document's
 *                          own fields, `components`, each entry in the shape that entry
 *                          actually uses (flat, or allOf behind two shared $refs), each
 *                          entry's `properties` and `required`, each property's real
 *                          schema, and `$defs`.
 *   <figma-layers-view>    the layer tree the ingest measured for a design, overlaid —
 *                          what the DESIGN contains, which is a different question from
 *                          what the catalogue declares.
 *
 * IT WAS BUILT BECAUSE THE STRUCTURE KEPT BEING DESCRIBED IN PROSE AND KEPT COMING BACK
 * WRONG. A description of this file is a claim; the file is the thing. So the page holds no
 * summaries of its own — everything on screen is a value read out of the catalogue or out
 * of the ingest's record, with their own key names.
 *
 * THE TWO ELEMENTS STAY IN STEP. The layer overlay follows whichever catalogue is selected
 * above it, via the `catalog-change` event the reader dispatches — an overlay still showing
 * one pipeline's layers while a different catalogue is on screen is a screen contradicting
 * itself.
 *
 * THE ELEMENTS ARE IMPORTED HERE, not in main.tsx, and that is a deliberate difference from
 * the elements registered there. Every element in main.tsx is one the A2UI surface can name,
 * so its tag has to exist before any surface renders. These two are not assemblable, are
 * declared in no catalog.json, and belong to one route — so they register with the route
 * that uses them. <catalog-schema-view> loads its catalogue lazily (import.meta.glob), so
 * opening the composer never pays for a catalogue nobody asked to see.
 *
 * READ-ONLY. Nothing on this page writes: not the catalogue, not the ingest's record, not
 * the ledger. The defects it shows are drawn as facts and left where they are.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
// Side-effect imports: registration is what makes the tags draw. An element that is never
// imported is never defined, and these would render as empty boxes.
import '@/components/lit/catalog-schema-view';
import '@/components/lit/figma-layers-view';

export const CatalogInspector: React.FC = () => {
  const [pipeline, setPipeline] = useState('prompt-composer');
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ catalogId?: string }>).detail;
      if (detail?.catalogId) setPipeline(detail.catalogId);
    };
    host.addEventListener('catalog-change', onChange);
    return () => host.removeEventListener('catalog-change', onChange);
  }, []);

  return (
    <div ref={hostRef} className="flex h-screen flex-col overflow-hidden bg-white">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#e3e8ea] px-4 py-2">
        <Link
          to="/"
          className="text-[12px] font-semibold text-[#2793a3] no-underline hover:underline"
        >
          ← Composer
        </Link>
        <span className="text-[12px] text-[#7a8790]">
          catalog.json, read as the JSON Schema it is
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <catalog-schema-view />
      </div>
      {/* THE LAYER READER, AS AN OVERLAY. It sits over the catalogue rather than beside it
          because it answers a different question, and because it is the piece still to be
          designed. Closed by default; the header button opens it. */}
      <figma-layers-view pipeline={pipeline} />
    </div>
  );
};

export default CatalogInspector;
