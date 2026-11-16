/**
 * leftColumn — THE DESIGN ROOM'S LEFT COLUMN, AND THE ONE THING THE ROOM ASKS OF IT.
 *
 * The column itself is a tree child now: the console's grid, the Tools form and tree, the UX
 * application frame. This file keeps the one listener that speaks to it — an approve writes a row,
 * and the layer tree draws that row as selected. The listener reads the one renderer, not a second
 * one: there is no second drawing.
 */
import { useEffect, type RefObject } from 'react';

export function useDesignRowSelection(rendererRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const onRowSelected = (event: Event) => {
      const tag = String((event as CustomEvent<{ tag?: string }>).detail?.tag ?? '');
      const renderer = rendererRef.current;
      const layers = renderer?.shadowRoot?.querySelector?.('design2-figma-layers-view') as
        | (HTMLElement & { selected?: string })
        | null;
      if (layers && tag) layers.selected = tag;
    };
    window.addEventListener('design-row-selected', onRowSelected as EventListener);
    return () => window.removeEventListener('design-row-selected', onRowSelected as EventListener);
  }, [rendererRef]);
}
