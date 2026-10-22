/**
 * THE EVALS INFORMATION, PUT INTO THE CHAT OUTPUT — nothing redesigned.
 *
 * Owner, 2026-10-17: *"don't redesign anything … You're just injecting the information …
 * You just take the exact information and stick it into the chat output — we'll design it
 * later."* This module does exactly that and no more: it finds a seat, puts the catalogue's
 * own <evals-index> into the seat's existing view slot as that tab's view (`view-tab="eval"`
 * — the seat's own per-tab rule now draws it), reads the evaluators from the same database
 * the governance app reads, and writes them into the element. A row click is handed out as
 * `evaluator-select` for whoever wants it.
 *
 * IT LIVES OUTSIDE THE ROOM PAGE AND THE SEAT (owner's architecture line): no line of
 * `WritingAreaIndex.tsx` or `chat-panel.ts` carries evals wiring; this module mounts itself
 * into whatever seat appears, the same way a browser extension would.
 *
 * NO STYLING HERE. The element carries its own styling; this file only binds values.
 */
import '@/components/lit/evals-index';

const MOUNTED = new WeakSet<Element>();

type IndexEl = HTMLElement & {
  data?: unknown;
  selectedId?: string;
  /** 'reading' while a fetch is in flight; true once `data` is written. */
  __bound?: boolean | 'reading';
};

/** The project id the governance frame is showing, or null. The frame lives in another
    pane of the room (not beside the seat), so it is found by walking the document, shadow
    roots included: the first address naming /project/<id> is the room's project. */
function projectIdOf(): string | null {
  const seen: Element[] = [];
  const walk = (root: ParentNode) => {
    root.querySelectorAll('*').forEach((el) => {
      seen.push(el);
      if ((el as Element & { shadowRoot?: ShadowRoot }).shadowRoot) {
        walk((el as Element & { shadowRoot: ShadowRoot }).shadowRoot);
      }
    });
  };
  walk(document);
  for (const el of seen) {
    const src = el.getAttribute('src') ?? '';
    const m = src.match(/\/project\/([^/?#]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

/** Put the index into one seat, once. */
async function mountInto(seat: Element): Promise<void> {
  if (MOUNTED.has(seat)) return;
  MOUNTED.add(seat);

  const el = document.createElement('evals-index') as IndexEl;
  el.setAttribute('slot', 'view');
  el.setAttribute('view-tab', 'eval');
  seat.appendChild(el);

  el.addEventListener('evaluator-select', ((e: CustomEvent<{ id?: string }>) => {
    const id = e.detail?.id;
    if (!id) return;
    (el as { selectedId?: string }).selectedId = id;
    window.dispatchEvent(new CustomEvent('governance:evaluator-select', { detail: { id } }));
  }) as EventListener);
}

/**
 * WRITE THE DATA — retried until it lands.
 *
 * Measured 2026-10-17: the seat appears before the governance frame's address does, so a
 * one-shot read at mount time found no project and the index sat on its honest loading line
 * forever. Mounting stays once-only; only the READ repeats, and it stops for good the moment
 * `data` is written. A failed read leaves the loading line standing and says why in the console
 * — it never draws a stand-in list.
 */
async function bindIndex(el: IndexEl): Promise<void> {
  if (el.__bound) return;
  const projectId = projectIdOf();
  if (!projectId) return; // the frame is not in the room yet — the next tick tries again
  el.__bound = 'reading';
  try {
    const res = await fetch(`/api/governance/evaluators?project_id=${encodeURIComponent(projectId)}`);
    if (!res.ok) {
      console.warn('[evals] the evaluators index answered', res.status);
      el.__bound = false;
      return;
    }
    el.data = await res.json();
    el.__bound = true;
  } catch (err) {
    console.warn('[evals] the evaluators index could not be read', err);
    el.__bound = false;
  }
}

/** Watch for seats and mount into each once; keep trying the read until it lands. */
function watch(): void {
  const mount = (seat: Element) => {
    void mountInto(seat);
    const el = Array.from(seat.children).find(
      (c) => c.tagName.toLowerCase() === 'evals-index',
    ) as IndexEl | undefined;
    if (el) void bindIndex(el);
  };
  const scan = (root: ParentNode) => {
    root.querySelectorAll?.('chat-panel').forEach((seat) => void mount(seat));
  };
  scan(document);
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        const el = n as Element;
        if (el.tagName.toLowerCase() === 'chat-panel') void mount(el);
        else scan(el);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  // The frame's address (the project id) lands after the seat; this tick is what meets it.
  window.setInterval(() => scan(document), 800);
}

watch();
