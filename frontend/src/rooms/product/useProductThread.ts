/**
 * THE PRODUCT'S OWN VOICE AND ITS OWN DRAFT CANVAS.
 *
 * The room used to receive both from the Composer's actions. That made one room's helper the
 * other room's behaviour: a change to the Composer's thread line or to the design system it
 * writes would reach into the Product without the Product being touched. The two functions
 * live here now, with the room they speak for.
 */
import { useCallback } from 'react';

export function useProductThread() {
  /** A line in the room's own thread. A display channel: it writes nothing and asks nothing. */
  const sayInThread = useCallback((content: string): void => {
    window.dispatchEvent(new CustomEvent('a2ui:system-message', {
      detail: { role: 'assistant', content },
    }));
  }, []);

  /**
   * THE DRAFT IS TOLD WHICH DESIGN SYSTEM IT DRAWS FROM — a live property write, the same
   * writer the Composer uses for its own draft. The visible canvas is the one the person is
   * looking at; a hidden tree's canvas draws nothing, so its box is the honest discriminator.
   */
  const writeDraftSystem = useCallback((system: string): void => {
    let frames = 0;
    const write = (): void => {
      const candidates: Array<HTMLElement & { system?: string }> = [];
      const walk = (root: ParentNode): void => {
        root.querySelectorAll('draft-canvas').forEach((el) => candidates.push(el as HTMLElement & { system?: string }));
        root.querySelectorAll('*').forEach((el) => {
          const shadow = (el as HTMLElement).shadowRoot;
          if (shadow) walk(shadow);
        });
      };
      walk(document);
      const visible = candidates.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) ?? candidates[0];
      if (visible) {
        if (visible.system !== system) visible.system = system;
        return;
      }
      if (++frames < 60) setTimeout(write, 60);
    };
    // IMMEDIATE FIRST, THEN TIMER RETRIES — NOT rAF. A timer fires in a hidden pane.
    write();
    setTimeout(write, 60);
  }, []);

  return { sayInThread, writeDraftSystem };
}
