/**
 * <EmbeddedWarmup> — THE ROOMS' EMBEDDED PROGRAMS START BEFORE THE ROOM IS OPENED.
 *
 * Development opens the canvas program, Product opens the builder, and Design opens PostHog.
 * Each is a separate application: on a cold load the browser has none of its files, so the room
 * waits for that program to boot in front of the person. This starts each one after the
 * studio's first screen, in order, so the wait is spent while the person is still reading the
 * gate instead of after they click the room. Design's address is the room's own landing path,
 * not the bare /posthog root (which answers 404). GOVERNANCE IS NOT WARMED (owner, 2026-10-25):
 * the room mounts its own Langfuse frame, so a second hidden boot made two copies and
 * shortened nothing the person sees. One copy only.
 *
 * IT IS NOT A FALLBACK AND IT DRAWS NOTHING. The frames are one pixel, off-screen, and hidden
 * from assistive technology; they exist only to make the program and its files ready. A room
 * that has no address is not warmed, and a visitor on a deployed origin has no address at all
 * (see the loopback law in appConfig), so nothing reaches a visitor's own computer.
 */
import { useEffect } from 'react';
import { designPostHogLanding } from '@/rooms/design/designTool';
import {
  appConfigReady,
  builderToolUrl,
  developmentToolUrl,
} from '@/shared/appConfig';

/** One warm-up per page load; a second mount would start the programs twice. */
let warmupStarted = false;

export function EmbeddedWarmup() {
  useEffect(() => {
    if (warmupStarted) return;
    warmupStarted = true;

    const frames: HTMLIFrameElement[] = [];
    let cancelled = false;

    const warmOne = (src: string): void => {
      if (!src || cancelled) return;
      const frame = document.createElement('iframe');
      frame.src = src;
      frame.title = '';
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = [
        'position:fixed',
        'left:-10000px',
        'top:0',
        'width:1px',
        'height:1px',
        'border:0',
        'opacity:0',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(frame);
      frames.push(frame);
      // The program has been asked to start; the files and the server-side warm-up remain
      // useful after the frame is gone. Keep it long enough for a cold Next.js/Langfuse boot,
      // then release the memory.
      window.setTimeout(() => {
        frame.remove();
        const at = frames.indexOf(frame);
        if (at >= 0) frames.splice(at, 1);
      }, 60000);
    };

    const start = (): void => {
      if (cancelled) return;
      /*
       * ONE AT A TIME. Development's canvas boots first, then the Design room's PostHog, then
       * the Product room's builder. Starting all three at once would compete with the first
       * screen's own files, which is the wait this is meant to remove.
       */
      const programs = [
        developmentToolUrl(),
        designPostHogLanding(),
        builderToolUrl(),
      ];
      let index = 0;
      const next = (): void => {
        if (cancelled || index >= programs.length) return;
        warmOne(programs[index]);
        index += 1;
        window.setTimeout(next, 8000);
      };
      // AFTER THE FIRST SCREEN, NOT BEFORE IT.
      const idle = (window as unknown as {
        requestIdleCallback?: (fn: () => void) => number;
      }).requestIdleCallback;
      if (idle) idle(next);
      else window.setTimeout(next, 1500);
    };

    void appConfigReady().then(start).catch(() => {
      // appConfig announces its own failure; there is no address to warm.
    });

    return () => {
      cancelled = true;
      frames.forEach((frame) => frame.remove());
    };
  }, []);

  return null;
}
