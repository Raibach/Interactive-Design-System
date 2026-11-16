/**
 * THE SURFACE'S LOAD — the top tab press: read the door once, name the surface, mount once.
 *
 * The door's answer is ONE surface: one surface id, one list of parts, one data model. This file
 * does not remove the chat, the left column or anything else from that answer. The tree the door
 * sent is the tree the renderer draws; the tab's own rows are selected by `components.ts`, not by
 * cutting the door's answer apart.
 *
 * NOTHING HERE RESOLVES A BINDING. The renderer resolves `{path}` values against the data model;
 * a value this file resolved by hand would be a second binding path, and the person would see a
 * value the renderer could not update.
 */
import { getStoredUserId } from '@/services/authService';
import { readA2UIEnvelope, envelopeRefusalError } from '@/shared/a2ui-envelope';
import { loadSystemRegistry } from '@/shared/a2uiRegistries';
import '@/a2ui/officialRenderer';

/** One surface tree: the flat component list and the model its props bind against. */
export type Tree = { components: unknown[]; dataModel: Record<string, unknown> };

/** The system whose registry the surface's names resolve through. */
export const SURFACE_SYSTEM = 'surface-design';

/**
 * THIS PAGE LOAD'S OWN NAME. The room is read more than once while it settles, and the Console's
 * session is made once for a load, not once per read (owner, 2026-11-16). Every read in this
 * document carries this name, so the second read is handed the session the first one made; a
 * reload is a new name and therefore a new session.
 */
const SURFACE_LOAD_ID = crypto.randomUUID();

/** The drawing surface: the shell's renderer element, used through the properties it publishes. */
export type SurfaceRenderer = HTMLElement & {
  components: unknown[];
  dataModel: Record<string, unknown>;
  surfaceId: string;
  system: string;
  updateComplete: Promise<unknown>;
  shadowRoot: ShadowRoot | null;
};

export type SurfaceLoad = {
  /** The one surface's id, from the door's own `createSurface` message. */
  surfaceId: string;
  /** The door's whole tree: frame, left, middle and right, with the tab rows selected later. */
  tree: Tree;
  /** The names the catalogue allows. The final tree is refused against this before it is drawn. */
  allowed: Set<string>;
};

/**
 * READ THE DOOR. A refusal keeps the door's own words and names the address, because a bare "Not
 * Found" reads as the room being broken; the truth is usually the server not carrying this door.
 */
export async function readSurface(): Promise<SurfaceLoad> {
  const res = await fetch('/api/design/console', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': getStoredUserId(),
      'X-Surface-Load': SURFACE_LOAD_ID,
    },
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = String(
      (raw as { detail?: unknown; error?: unknown })?.detail
      ?? (raw as { detail?: unknown; error?: unknown })?.error
      ?? '',
    ).trim();
    throw new Error(
      `the design console door (POST /api/design/console) answered ${res.status}`
      + (detail ? ` — ${detail}` : ''),
    );
  }
  const read = readA2UIEnvelope(raw);
  if (read.ok === false) throw envelopeRefusalError(read.refusal);

  const surfaceId = read.reading.surfaceId;
  if (!surfaceId) {
    throw new Error(
      'the design console door answered without a surface id; the room cannot address the '
      + 'surface it drew.',
    );
  }

  /* THE FINAL TREE'S OWN SCHEMA. The server validates the door's answer; the browser composes
     the tab's rows afterwards, so the same catalogue is read here and the composition is checked
     against it before anything reaches the renderer.
     THE SERVER'S DOOR, NOT A SOURCE PATH: `/src/...` exists only on the dev server, so the built
     tunnel served its page document there and the room failed with "Unexpected token '<'". */
  const catalogRes = await fetch(`/api/catalog/${encodeURIComponent(SURFACE_SYSTEM)}`);
  if (!catalogRes.ok) {
    throw new Error(
      `the surface catalogue could not be read (HTTP ${catalogRes.status}); nothing was drawn.`,
    );
  }
  const catalog = await catalogRes.json() as { components?: Record<string, unknown> };
  const allowed = new Set(Object.keys(catalog.components ?? {}));

  /*
   * AND THE INGESTION LIST, WHICH IS NOT THE ASSEMBLY CATALOGUE. The room's catalogue above is the
   * assembly truth: its names come from the Lit catalogue, and Figma feeds that catalogue through
   * the approval gate. The prompt-composer file below is the INGESTION partition the Tools tab's
   * tree lists; a selected row can be named in the preview, so its name is admitted for that one
   * preview. It is a bridge, not a second assembly authority: the preview's selected name is the
   * only reason these names are here, and the cleaner end state is the preview drawing by the
   * element's Lit tag. A file that cannot be read is stated, not skipped, because the tools tab's
   * own names would then be refused.
   */
  const toolsRes = await fetch('/api/catalog/prompt-composer');
  if (!toolsRes.ok) {
    throw new Error(
      `the tools catalogue could not be read (HTTP ${toolsRes.status}); the tools tab's names `
      + `cannot be admitted, so nothing was drawn.`,
    );
  }
  const toolsCatalog = await toolsRes.json() as { components?: Record<string, unknown> };
  for (const name of Object.keys(toolsCatalog.components ?? {})) allowed.add(name);

  return {
    surfaceId,
    tree: {
      components: read.reading.components as unknown[],
      dataModel: read.reading.dataModel as Record<string, unknown>,
    },
    allowed,
  };
}

/**
 * READ ONE CONVERSATION'S TURNS — the surface's own hydration for a tab whose seat is a pure
 * renderer (owner's ruling, 2026-11-16: the Approve seat owns no conversation state, and the
 * surface states what it draws at `/surface/turns`). A failure is thrown with its status; the
 * caller states it in the room rather than drawing an empty thread as if the record were empty.
 */
export async function readConversationTurns(
  conversationId: string,
): Promise<Array<{ role?: string; content?: string }>> {
  const id = String(conversationId ?? '');
  if (!id) return [];
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}/messages?limit=200`, {
    headers: { 'X-User-ID': getStoredUserId() },
  });
  if (!res.ok) {
    throw new Error(
      `the conversation ${id.slice(0, 8)}… could not be read (HTTP ${res.status}); the tab's `
      + `thread is not drawn from a guess.`,
    );
  }
  const data = (await res.json().catch(() => ({}))) as { messages?: Array<Record<string, unknown>> };
  return (data.messages ?? []).map((row) => ({
    role: String(row.role ?? 'assistant'),
    content: String(row.content ?? ''),
  }));
}

/** THE SEAT'S TABLE, BEFORE THE FIRST DRAW. A failure is the caller's to state; it is not hidden. */
export async function loadSurfaceRegistry(): Promise<void> {
  await loadSystemRegistry(SURFACE_SYSTEM);
}

/**
 * CREATE THE SURFACE'S RENDERER. It is the shell's renderer element — the seat does not own one —
 * told which registry table to resolve the surface's names through and which surface it draws.
 */
export function createSurfaceRenderer(surfaceId: string, tab: string): SurfaceRenderer {
  const renderer = document.createElement('a2ui-official-renderer') as SurfaceRenderer;
  renderer.setAttribute('data-design-seat-renderer', tab);
  renderer.setAttribute('data-surface-id', surfaceId);
  renderer.style.cssText = 'display:block;width:100%;height:100%;min-height:0;';
  renderer.surfaceId = surfaceId;
  renderer.system = SURFACE_SYSTEM;
  return renderer;
}

/**
 * DRAW THE TREE. The components are assigned when the tree's identity changed; the data model is
 * assigned every time, because a rail press moves values while the frame stands. The renderer's
 * own data-only update keeps the elements and writes the new values through their bindings.
 */
export function drawSurface(
  renderer: SurfaceRenderer,
  tree: Tree & { key: string },
  drawnKey: string,
  allowed: Set<string>,
): string {
  /* THE TREE THE BROWSER DRAWS IS THE TREE THE CATALOGUE ALLOWS. `components.ts` composes the
     tab's rows in the browser; this is the last gate before a node reaches the renderer. */
  const refused = (tree.components as { component?: unknown }[])
    .map((component) => String(component?.component ?? ''))
    .filter((name) =>
      !(allowed.has(name) || name.startsWith('f-') || name.startsWith('design2-f-')),
    );
  if (refused.length) {
    throw new Error(
      `the surface's final tree names ${refused.length} component(s) the catalogue does not `
      + `allow: ${Array.from(new Set(refused)).join(', ')}`,
    );
  }
  if (tree.key !== drawnKey) {
    renderer.components = tree.components;
  }
  renderer.dataModel = tree.dataModel;
  return tree.key;
}
