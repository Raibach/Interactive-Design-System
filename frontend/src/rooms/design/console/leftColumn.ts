/**
 * leftColumn — THE DESIGN ROOM'S LEFT COLUMN, AND THE STANDING TAB'S APPLICATION.
 *
 * The room's frame draws the three-column layout; this file owns what stands in the left column:
 *
 *   Chat  → the console's own application (the card grid), supplied by `useDesignConsole`;
 *   Tools → the Figma ingestion application, supplied by its headless module;
 *   UX    → the analytics application's frame, loaded once and kept.
 *
 * It also owns the column's assembly cover, the UX door's own refusal, and the row-selected
 * listener that marks the row an approve wrote. `DesignSeatShell` creates the ref and calls
 * `ensureLeftColumn` once; every draw calls `placeLeftColumn` with the standing tab's facts.
 */
import { useEffect, type RefObject } from 'react';
import { posthogToolUrl } from '@/shared/appConfig';
import { DESIGN_POSTHOG_LANDING_PATH } from '@/rooms/design/designTool';
import type { Tree } from '@/rooms/design/inject';
import type { Content } from '@/rooms/design/tools/content';
import type { DesignConsoleApp } from './useDesignConsole';

/* THE UX TAB'S APPLICATION SCREEN — AND THE NAME THE CHAT'S HEADER CARRIES. The left frame lands
   on the seeded project's Product analytics scene, and the chat's first header line says the same
   thing, so what the person reads above the thread matches the screen beside it (owner,
   2026-10-19: *"if I'm chatting inside of a particular thing like product analytics you could put
   that at the top"*). One pair of constants, one place. */
export const UX_APP_SECTION = 'Product analytics';
const UX_APP_LANDING_PATH = DESIGN_POSTHOG_LANDING_PATH;
const uxAppLanding = (): string => `${posthogToolUrl()}${UX_APP_LANDING_PATH}`;

export type DesignLeft = {
  host: HTMLElement;
  renderer: any;
  frame: HTMLElement;
};

/**
 * THE ROW THAT CHANGED IS THE ANSWER — an approve has no message: the list re-reads and the row
 * that was written is marked. The event is the ingest's own; this listener only forwards the tag
 * to the layer tree that draws it.
 */
export function useDesignRowSelection(leftRef: RefObject<DesignLeft | null>): void {
  useEffect(() => {
    const onRowSelected = (event: Event) => {
      const tag = String((event as CustomEvent<{ tag?: string }>).detail?.tag ?? '');
      const renderer = leftRef.current?.renderer as any;
      const layers = renderer?.shadowRoot?.querySelector?.('figma-layers-view') as any;
      if (layers && tag) layers.selected = tag;
    };
    window.addEventListener('design-row-selected', onRowSelected as EventListener);
    return () => window.removeEventListener('design-row-selected', onRowSelected as EventListener);
  }, [leftRef]);
}

/**
 * THE LEFT CONTAINER — DEDICATED, CREATED ONCE. The host is re-parented when the layout is a new
 * element; its renderer and UX frame are never re-created, so switching tabs does not reload
 * either application.
 */
export function ensureLeftColumn(
  layout: HTMLElement,
  leftRef: RefObject<DesignLeft | null>,
): DesignLeft {
  const existing = leftRef.current;
  if (existing) {
    if (existing.host.parentElement !== layout) layout.appendChild(existing.host);
    return existing;
  }
  const host = document.createElement('div');
  host.setAttribute('slot', 'left');
  host.setAttribute('data-design-left', '');
  host.style.cssText =
    'position:relative;display:flex;flex-direction:column;height:100%;min-height:0;width:100%;';
  const renderer = document.createElement('design-renderer');
  renderer.setAttribute('data-design-left-renderer', '');
  renderer.style.cssText = 'display:block;flex:1 1 auto;min-height:0;width:100%;';
  const ux = document.createElement('ux-app-frame');
  ux.style.cssText = 'display:none;flex:1 1 auto;min-height:0;width:100%;';
  host.appendChild(renderer);
  host.appendChild(ux);

  /*
   * THE ASSEMBLY RING (owner, 2026-10-25: "add a spinner like the others we have in the react
   * shell to the assembly of the tools palette"). The house ring — 26px, a 3px track, one
   * quarter turning — drawn over the column's own ground while the tool assembles and gone the
   * moment it has content. No cover and no sentence: the same ring the rooms' waits wear.
   * The keyframes live in a <style> beside it because this column sits inside a shadow tree,
   * where a document stylesheet cannot reach.
   */
  const spinStyle = document.createElement('style');
  spinStyle.textContent = '@keyframes design-left-spin{to{transform:rotate(360deg)}}';
  host.appendChild(spinStyle);
  const spin = document.createElement('div');
  spin.setAttribute('data-design-left-spin', '');
  spin.setAttribute('aria-hidden', 'true');
  spin.style.cssText =
    'position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
    'flex-direction:column;gap:16px;pointer-events:none;z-index:2;';
  const spinRing = document.createElement('div');
  // THE CONSOLE'S VIOLET (owner, 2026-10-25: "make the spinner purple") — the same ring the
  // console's wait wears.
  spinRing.style.cssText =
    'width:26px;height:26px;border-radius:50%;' +
    'border:3px solid rgba(126,114,227,0.6);border-top-color:rgb(126,114,227);' +
    'animation:design-left-spin 900ms linear infinite;';
  const spinText = document.createElement('p');
  // THE SENTENCE (owner, 2026-10-25): what the wait is for, said plainly under the ring.
  spinText.textContent = 'Assembling design tools surface…';
  spinText.style.cssText =
    'margin:0;font-size:13px;font-weight:500;color:#582846;' +
    'font-family:"IBM Plex Sans",system-ui,sans-serif;';
  spin.appendChild(spinRing);
  spin.appendChild(spinText);
  host.appendChild(spin);

  layout.appendChild(host);
  leftRef.current = { host, renderer, frame: ux };
  return leftRef.current;
}

export type PlaceLeftColumnInput = {
  left: DesignLeft;
  railTab: string;
  toolsStanding?: boolean;
  injected?: Content | null;
  consoleApp: DesignConsoleApp | null;
  /** The console's tree after the chat entry is taken out — the card grid binds its data model. */
  tree: Tree;
};

/** Draw the standing tab's application in the left column. No structure is re-created here. */
export function placeLeftColumn({
  left,
  railTab,
  toolsStanding,
  injected,
  consoleApp,
  tree,
}: PlaceLeftColumnInput): void {
  /* THE ASSEMBLY RING — up while the tool has nothing to draw, gone the moment it does. The
     black cover stays removed; this is the ring alone, over the column's own ground. */
  const spin = left.host.querySelector('[data-design-left-spin]') as HTMLElement | null;
  if (spin) {
    const assembling = Boolean(toolsStanding) && !injected;
    spin.style.display = assembling ? 'flex' : 'none';
  }

  if (railTab === 'ux') {
    left.renderer.style.display = 'none';
    /*
     * THE PROGRAM IS PROBED ON EVERY ENTRY (owner, 2026-10-18: *"it just spins and loads of white
     * page"*). A sign-in that succeeded earlier is not proof the program is alive — the stack can
     * be stopped while this room stays open — so the door is asked again, and the frame is shown
     * ONLY when it answers. A stopped program is stated in the column with the door's own words;
     * an empty white iframe is never drawn over it.
     */
    left.frame.style.display = 'none';
    const showUxError = (text: string) => {
      let box = left.host.querySelector('[data-ux-error]') as HTMLElement | null;
      if (!box) {
        box = document.createElement('div');
        box.setAttribute('data-ux-error', '');
        box.style.cssText =
          'padding:16px;font-size:14px;color:#a31545;line-height:1.5;max-width:640px;white-space:pre-line;';
        left.host.appendChild(box);
      }
      box.textContent = text;
    };
    /* THE DOOR IS THE ADDRESS (owner, 2026-10-21: governance is the template). The frame is
       same-origin at /posthog, so the old loopback-host gate is gone: there is no visitor machine
       to protect from, and an empty door means no address is configured for this build — the
       column says so and draws nothing. */
    const doorUrl = posthogToolUrl();
    if (!doorUrl) {
      showUxError('The UX program has no address configured for this build, so this column draws nothing.');
    }
    if (doorUrl) {
      left.host.querySelector('[data-ux-error]')?.remove();
      const frameEl = left.frame as HTMLElement & { src?: string };
      /* THE APP IS LOADED ONCE (2026-10-21). The src is set only when the frame has none, so a
         switch away and back keeps the application it already loaded. */
      if (!frameEl.src) frameEl.src = uxAppLanding();
      left.frame.style.display = 'block';
    }
    return;
  }

  left.frame.style.display = 'none';
  left.renderer.style.display = 'block';
  /* THE UX TAB'S MESSAGE BELONGS TO THE UX TAB — the box is removed when any other tab owns the
     column (owner, 2026-10-18: it was showing underneath the Figma program). */
  left.host.querySelector('[data-ux-error]')?.remove();
  /* THE STANDING TAB OWNS THE LEFT COLUMN. Tools draws its own application, and draws NOTHING
     while that application is still assembling — the console's grid belongs to Chat and must
     never stand in for a tool that has not reported yet. */
  const app = toolsStanding
    ? injected
      ? { rootId: injected.leftId, components: injected.components, dataModel: injected.dataModel }
      : null
    : consoleApp?.leftId
      ? { rootId: consoleApp.leftId, components: consoleApp.components, dataModel: tree.dataModel }
      : null;
  if (app) {
    left.renderer.rootId = app.rootId;
    left.renderer.components = app.components;
    left.renderer.dataModel = app.dataModel;
  } else if (toolsStanding) {
    left.renderer.components = [];
  }
}
