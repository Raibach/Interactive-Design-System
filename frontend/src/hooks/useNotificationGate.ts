import { useState, useCallback } from "react";

interface NotificationGateOptions {
  /** Initial tab override */
  initialTab?: string;
  /** A2UI: onNavigate removed - navigation is AI-driven, not URL-based */
}

interface NotificationGateReturn {
  /** Whether the loading barrier is currently shown */
  tabLoading: boolean;
  /** Whether composer is in approval mode */
  approvalMode: boolean;
  /** Current header tab */
  headerTab: string | null;
  /** Set the header tab directly (for internal use after barrier completes) */
  setHeaderTab: (tab: string | null) => void;
  /** Clear approval mode */
  clearApprovalMode: () => void;
  /** Intercept tab change — shows barrier unless suppressed */
  handleHeaderTabChange: (tabId: string | null) => void;
  /** Called when user picks a notification action */
  handleNotificationAction: (value: string) => void;
  /** Called when barrier completes or is skipped */
  finishTabChange: () => void;
  /** Called when user checks "Don't show this type" */
  handleSuppressNotification: (type: string) => void;
  /** Check if a notification type is suppressed */
  isNotificationSuppressed: (type: string) => boolean;
}

// A2UI: tabToPath removed - no URL routing, AI assembles surfaces

/**
 * Manages the notification gate barrier between Console ↔ Composer navigation.
 * Encapsulates tab state, loading state, approval mode, and notification preferences.
 */
export function useNotificationGate(options?: NotificationGateOptions): NotificationGateReturn {
  const { initialTab } = options || {};
  // A2UI: onNavigate removed - AI controls surfaces, not URL routing
  const [headerTab, setHeaderTabState] = useState<string | null>(() => {
    /*
     * THE FRONT PAGE IS THE CONSOLE, FROM THE FIRST FRAME — not from the effect that corrects it.
     *
     * The caller computes the intent from the URL (`WritingAreaIndex`:
     * `initialTab: routeSessionId ? "composer" : "console"`), and this preferred the PERSISTED tab
     * over it. So on "/" the person's last tab won: whoever works in the composer had
     * `activeHeaderTab === "composer"`, React's first commit handed
     * `<ai-surface-sandbox header-tab="composer">`, and the sandbox painted the composer's ground —
     * its base #582846 (the plum) plus the composer's own image — and projected the composer's
     * slot, for the frames between that commit and the mount effect that flips the tab back to the
     * console. The owner, 2026-09-24, in a browser where the in-app one could not show it: "it
     * flashes purple, which is something wrong with the code."
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
     * ── AND PRODUCT AND GOVERNANCE LEFT THE STUBS (2026-10-03) ───────────────────────────────
     * Both are real rooms now — their own branches, `render-product` / `render-governance`,
     * their own renderers — so they are places the application can LAND: a browser whose last
     * tab was either opens there, which is what a room is for. Development is the last stub.
     */
    const KNOWN_TABS = ['console', 'composer', 'design', 'product', 'development', 'governance'];
    const LANDABLE_TABS = ['console', 'composer', 'design', 'product', 'governance'];
    const saved = localStorage.getItem("activeHeaderTab");
    if (saved && LANDABLE_TABS.includes(saved)) return saved;
    return initialTab && LANDABLE_TABS.includes(initialTab) ? initialTab : "console";
  });
  const [tabLoading, setTabLoading] = useState(false);
  const [approvalMode, setApprovalMode] = useState(false);

  const setHeaderTab = (tab: string | null) => {
    setHeaderTabState(tab);
    if (tab) {
      localStorage.setItem("activeHeaderTab", tab);
    }
  };

  const isNotificationSuppressed = useCallback((type: string): boolean => {
    try {
      const raw = localStorage.getItem("graceSettings");
      if (!raw) return false;
      const s = JSON.parse(raw);
      return s?.notifications?.[type] === false;
    } catch {
      return false;
    }
  }, []);

  const handleSuppressNotification = useCallback((type: string) => {
    try {
      const raw = localStorage.getItem("graceSettings");
      const s = raw ? JSON.parse(raw) : {};
      if (!s.notifications) s.notifications = {};
      s.notifications[type] = false;
      localStorage.setItem("graceSettings", JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, []);

  const handleHeaderTabChange = useCallback(
    (tabId: string | null) => {
      // A2UI: Just update internal state - AI assembly handles surface changes
      if (tabId !== headerTab) {
        setHeaderTab(tabId);
      }
    },
    [headerTab],
  );

  const handleNotificationAction = useCallback((value: string) => {
    if (value === "approve") {
      setApprovalMode(true);
      (window as any).__tabTarget = "composer";
    } else if (value === "view") {
      (window as any).__tabTarget = "console";
    }
  }, []);

  const finishTabChange = useCallback(() => {
    const target = (window as any).__tabTarget;
    setTabLoading(false);
    if (target) {
      setHeaderTab(target);
      // A2UI: No URL navigation - AI controls surfaces
    }
    delete (window as any).__tabTarget;
  }, []);

  const clearApprovalMode = useCallback(() => setApprovalMode(false), []);

  return {
    tabLoading,
    approvalMode,
    headerTab,
    setHeaderTab,
    clearApprovalMode,
    handleHeaderTabChange,
    handleNotificationAction,
    finishTabChange,
    handleSuppressNotification,
    isNotificationSuppressed,
  };
}
