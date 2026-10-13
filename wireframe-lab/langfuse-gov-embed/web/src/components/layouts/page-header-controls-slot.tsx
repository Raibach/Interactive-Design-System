import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Header "controls slot" — lets a deeply nested component (typically a list
 * table) render controls such as the time-range picker and auto-refresh button
 * next to the page title, mirroring the Home dashboard layout.
 *
 * The shared {@link Page} component renders a {@link PageHeaderControlsSlotTarget}
 * inside the header's left cluster and exposes it through context. Descendants
 * portal into it via {@link PageHeaderControlsPortal}. State stays wherever it
 * already lives (e.g. the table owns the refresh handlers) — only the rendered
 * DOM moves into the header.
 */
const PageHeaderControlsSlotContext = createContext<{
  slot: HTMLDivElement | null;
  setSlot: (node: HTMLDivElement | null) => void;
  titleSlot: HTMLDivElement | null;
  setTitleSlot: (node: HTMLDivElement | null) => void;
} | null>(null);

export function PageHeaderControlsSlotProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [titleSlot, setTitleSlot] = useState<HTMLDivElement | null>(null);
  const value = useMemo(
    () => ({ slot, setSlot, titleSlot, setTitleSlot }),
    [slot, titleSlot],
  );
  return (
    <PageHeaderControlsSlotContext.Provider value={value}>
      {children}
    </PageHeaderControlsSlotContext.Provider>
  );
}

/**
 * Rendered by {@link Page} into the header's left cluster. Uses `display:
 * contents` so the empty target adds no layout box; portaled children become
 * direct flex items of the surrounding cluster.
 */
export function PageHeaderControlsSlotTarget() {
  const ctx = useContext(PageHeaderControlsSlotContext);
  if (!ctx) return null;
  return <div className="contents" ref={ctx.setSlot} />;
}

/**
 * Portals its children into the page header's controls slot. Renders nothing
 * when there is no slot (e.g. the component is used outside of {@link Page},
 * such as embedded in a tab or dialog).
 */
export function PageHeaderControlsPortal({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = useContext(PageHeaderControlsSlotContext);
  if (!ctx?.slot) return null;
  return createPortal(children, ctx.slot);
}

/**
 * RAIBACH IDS (2026-10-12, owner's header pass): the title-row slot — rendered
 * by {@link Page} in the title row, between the title cluster and the right
 * actions. A table's search box (or a future page message) portals here and
 * flexes across the remaining width; overflowing text truncates. Empty on
 * pages that don't use it — an empty flex-1 box changes nothing visually.
 */
export function PageHeaderTitleSlotTarget() {
  const ctx = useContext(PageHeaderControlsSlotContext);
  if (!ctx) return null;
  return <div className="min-w-0 flex-1" ref={ctx.setTitleSlot} />;
}

/**
 * Portals its children into the title-row slot, wrapped in a `min-w-0 flex-1`
 * box so the content stretches and truncates instead of overflowing.
 * Differences from {@link PageHeaderControlsPortal}:
 *  · `enabled={false}` renders the children untouched in place (pages that
 *    don't opt in keep their old layout).
 *  · With no slot (table embedded outside a `Page`), children render inline
 *    rather than vanishing — a missing header must never remove the search.
 */
export function PageHeaderTitleSlotPortal({
  enabled = true,
  children,
}: {
  enabled?: boolean;
  children: ReactNode;
}) {
  const ctx = useContext(PageHeaderControlsSlotContext);
  if (!enabled) return <>{children}</>;
  const wrapped = <div className="min-w-0 flex-1">{children}</div>;
  if (!ctx?.titleSlot) return wrapped;
  return createPortal(wrapped, ctx.titleSlot);
}
