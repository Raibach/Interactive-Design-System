import { useState, useCallback } from "react";

interface NotificationGateOptions {
  /** Initial tab override */
  initialTab?: string;
  /** A2UI: onNavigate removed - navigation is AI-driven, not URL-based */
}

interface NotificationGateReturn {
  /** Current header tab */
  headerTab: string | null;
  /** Set the header tab directly */
  setHeaderTab: (tab: string | null) => void;
  /** Intercept tab change */
  handleHeaderTabChange: (tabId: string | null) => void;
}

// A2UI: tabToPath removed - no URL routing, AI assembles surfaces

/**
 * The header tab and its persisted value. The notification barrier this hook was named for is
 * gone: the shell switches tabs plainly, and nothing waits behind a cover. What remains is the
 * fact the whole shell reads — which tab is selected — and the stored name a return visit lands on.
 */
export function useNotificationGate(options?: NotificationGateOptions): NotificationGateReturn {
  const { initialTab } = options || {};
  // A2UI: onNavigate removed - AI controls surfaces, not URL routing
  const [headerTab, setHeaderTabState] = useState<string | null>(() => {    /*
     * THE FRONT PAGE IS THE CONSOLE, FROM THE FIRST FRAME — not from the effect that corrects it.
     *
     * The caller computes the intent from the URL (`WritingAreaIndex`:
     * `initialTab: routeSessionId ? "composer" : "console"`), and this preferred the PERSISTED tab
     * over it. So on "/" the person's last tab won: whoever works in the composer had
     * `activeHeaderTab === "composer"`, React's first commit handed the Composer's box the tab,
     * and the room painted the composer's ground — its base #582846 (the plum) plus the
     * composer's own image — for the frames between that commit and the mount effect that flips
     * the tab back to the console. The owner, 2026-09-24, in a browser where the in-app one could
     * not show it: "it flashes purple, which is something wrong with the code."
     *
     * AND THE RULE WAS ALREADY WRITTEN DOWN, over that effect: "The persisted tab (localStorage
     * 'activeHeaderTab') must NOT dictate what the front page assembles." It was applied a frame
     * too late. Here it is applied at the only moment that can matter — the first render.
     *
     * EVERYTHING ELSE IS UNCHANGED: a package in the URL still opens on the tab the person last
     * had, which is what the persisted value is for, and `setHeaderTab` below still writes it on
     * every change.
     */
    if (initialTab === "console") return "console";
    /*
     * A SAVED TAB IS A CLAIM ABOUT THE PRESENT, AND IT CAN GO STALE.
     *
     * `localStorage.activeHeaderTab` is never cleared, so anyone whose browser holds a tab id
     * that no longer exists — `evaluation`, `variables` and `metadata` were removed from the
     * header on 2026-09-30 — would be restored onto a tab the row does not draw. The failure was
     * transient and self-correcting (the header highlights nothing, the sandbox projects the
     * workspace slot, and the next tab change overwrites the value), but "transient" is not a
     * reason to keep a value the application no longer recognises.
     *
     * The list is the header's own, from LeftColumnHeader's navTabDefs — the same five the
     * protocol declares in tag-registry.ts. A stale id falls back to the intent the caller
     * passed, which is what a first visit gets.
     *
     * ── AND A STUB IS NOT SOMEWHERE TO BE RESTORED ONTO (2026-10-01) ──────────────────────────
     * Development and Governance are drawn as stubs — visible, in order, and doing
     * nothing when clicked (owner: *"these items on the navigation and our shell at the top should
     * be stubs. They shouldn't do anything at this time."*). They are still KNOWN names, so they
     * stay in the list above; what they cannot be is a RESTORE TARGET. A browser whose last tab
     * was one of them would otherwise open straight onto an unbuilt compartment on every visit —
     * which is the complaint itself, arriving through localStorage instead of through a click, and
     * surviving a reload. So the two lists are separate on purpose: a name the application
     * RECOGNISES, and a place it can LAND.
     *
     * ── AND PRODUCT, GOVERNANCE AND DEVELOPMENT LEFT THE STUBS ───────────────────────────────
     * Product and Governance left on 2026-10-03; Development left on 2026-10-04, when its room
     * was dropped under the tab. All three are real rooms now — their own branches, their own
     * renderers — so all three are places the application can LAND: a browser whose last tab
     * was any of them opens there, which is what a room is for. No stub remains.
     */
    const KNOWN_TABS = ['console', 'composer', 'design', 'product', 'development', 'governance'];
    const LANDABLE_TABS = ['console', 'composer', 'design', 'product', 'development', 'governance'];
    const saved = localStorage.getItem("activeHeaderTab");
    if (saved && LANDABLE_TABS.includes(saved)) return saved;
    return initialTab && LANDABLE_TABS.includes(initialTab) ? initialTab : "console";
  });

  const setHeaderTab = (tab: string | null) => {
    setHeaderTabState(tab);
    if (tab) {
      localStorage.setItem("activeHeaderTab", tab);
    }
  };

  const handleHeaderTabChange = useCallback(
    (tabId: string | null) => {
      // A2UI: Just update internal state - AI assembly handles surface changes
      if (tabId !== headerTab) {
        setHeaderTab(tabId);
      }
    },
    [headerTab],
  );

  return {
    headerTab,
    setHeaderTab,
    handleHeaderTabChange,
  };
}
