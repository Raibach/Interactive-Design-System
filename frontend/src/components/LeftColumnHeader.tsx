/**
 * LeftColumnHeader — Main Header Frame
 *
 * Lives inside the Main Content Area (right of LeftVerticalMenu), spanning
 * full width. This is the top-level frame for branding, navigation, and
 * prompt management controls.
 *
 * ─────────────────────────────
 * OUTER WRAPPER (flex-row)
 * ├── LeftVerticalMenu        ← far-left nav strip (collapsed by default)
 * └── Main Content (flex-col)
 *     ├── LeftColumnHeader    ← ** THIS COMPONENT **
 *     │   ├── ROW 1: Brand / Navigation (golden bg)
 *     │   │   LEFT:  LOGO_PLACEHOLDER
 *     │   │   RIGHT: NAV_TABS_PLACEHOLDER
 *     │   │
 *     │   └── ROW 2: Prompt Management Bar (white bg)
 *     │       LEFT:  PROMPT_TITLE_PLACEHOLDER
 *     │       RIGHT: PROMPT_CONTROLS → VERSION, TAGS, ID, AUTHOR,
 *     │               SCORE, COLUMN_FLIP
 *     │
 *     └── ResizableSplitter   ← 3 prompt columns
 *         ├── Left Column  (editor / chat when flipped)
 *         ├── Right Column (chat / editor when flipped)
 *         └── Third Column (injectable middle slot)
 * ─────────────────────────────
 *
 * COLUMN_FLIP is the final control in Row 2 — a deliberate config action
 * (not a drag) that swaps left/right column positions via layout state.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ColumnFlipToggle } from "@/components/ColumnFlipToggle";
import VersionManager from "./VersionManager";
import { getStoredUserId } from "@/services/authService";

interface LeftColumnHeaderProps {
  // === ROW 1 PROPS ===
  logo?: React.ReactNode;
  navTabs?: React.ReactNode;

  /*
   * ROW 2'S PROPS ARE GONE WITH ROW 2. `promptTitle`, `version`, `currentVersion`,
   * `tags`, `promptId`, `author`, `score`, `onTitleChange`, `flipped` and `onToggleFlip`
   * were the prompt management bar's, and that bar is <left-column-header> in the surface
   * now. Leaving them here would have been a second, ignored way to set the same values.
   */

  // === NAVIGATION ===
  activeTab?: string | null;
  onTabChange?: (tabId: string | null) => void;
}

export default function LeftColumnHeader({
  logo,
  navTabs,
  activeTab: externalActiveTab,
  onTabChange,
}: LeftColumnHeaderProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<string | null>("composer");
  const activeTab = externalActiveTab ?? internalActiveTab;
  const setActiveTab = onTabChange ?? setInternalActiveTab;

  /*
   * THE TITLE'S STATE IS GONE, with the bar that held it. `isEditingTitle`, `editedTitle`,
   * the input ref, the save-on-blur and the sync effect were all this file's, and all of
   * them live in <left-column-header> now — one owner each, and the one that owns it is
   * the one that draws it.
   */

  /*
   * EVALUATION IS DISABLED, on the owner's instruction (2026-09-18). Drawn and inert: the tab
   * is in the design and he asked for it disabled, not for it gone — so it keeps its place in
   * the row, takes no click, and says what it is (aria-disabled, a title, a muted label) rather
   * than looking like a tab that is broken. Everything else in the row still works.
   */
  const navTabDefs = [
    { id: 'console', label: 'Console' },
    { id: 'composer', label: 'Composer' },
    { id: 'evaluation', label: 'Evaluation', disabled: true },
    { id: 'variables', label: 'Variables' },
    { id: 'metadata', label: 'Metadata' },
  ];

  // ── Embla carousel for nav tabs — no dragFree so tabs stay
  //     in place during splitter resize operations ──
  const [navCarouselRef, navApi] = useEmblaCarousel({
    align: "start",
    dragFree: false,
    containScroll: "trimSnaps",
  });
  const [navCanScrollPrev, setNavCanScrollPrev] = useState(false);
  const [navCanScrollNext, setNavCanScrollNext] = useState(false);

  useEffect(() => {
    if (!navApi) return;
    const onSelect = () => {
      setNavCanScrollPrev(navApi.canScrollPrev());
      setNavCanScrollNext(navApi.canScrollNext());
    };
    navApi.on("select", onSelect);
    navApi.on("reInit", onSelect);
    onSelect();
    return () => {
      navApi.off("select", onSelect);
      navApi.off("reInit", onSelect);
    };
  }, [navApi]);

  return (
    <div
      id="left-column-header"
      data-ui-id="main-header-frame"
      data-ui-type="layout"
      data-ui-description="Main header frame — branding, nav, and prompt management controls"
      className="flex flex-col"
      style={{ 
        flexShrink: 0,
        minHeight: '56px',
        maxHeight: '100vh',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
      }}
    >
      {/* ════════════════════════════════════════════════════════════
          ROW 1: Brand / Navigation bar (golden/amber background)
          ════════════════════════════════════════════════════════════ */}
      <div
        data-ui-id="brand-nav-bar"
        data-ui-type="navigation"
        data-ui-description="Brand logo and navigation tabs"
        className="flex items-center justify-between px-4"
        style={{
          backgroundColor: "#110E1F",
          minHeight: "56px",
        }}
      >
        {/* LOGO — fixed width, centered below 768px, left-aligned above */}
        <div
          data-lit-id="brand-logo"
          data-lit-type="content-area"
          data-lit-description="Brand logo — fixed width, centers at mobile, left-aligned at desktop"
          className="flex items-center gap-3 select-none md:justify-start justify-center md:pl-0 pl-[48px]"
          style={{ flex: "1 1 0%", minWidth: 0 }}
        >
          {logo ?? null}
        </div>

        {/* NAV_TABS — hidden below 768px (rolls into hamburger) */}
        <div
          data-lit-id="nav-tabs-carousel"
          data-lit-type="carousel"
          data-lit-description="Horizontal carousel nav — hidden below 768px, rolls into mobile hamburger"
          className="items-center gap-1 min-w-0 md:flex hidden"
        >
          {navTabs ?? (
            <div className="flex items-center gap-1 min-w-0">
              {/* Left arrow */}
              <button
                data-lit-id="nav-carousel-prev"
                data-lit-type="carousel-arrow"
                onClick={() => navApi?.scrollPrev()}
                disabled={!navCanScrollPrev}
                className="shrink-0 p-1 rounded-full transition-opacity"
                style={{ opacity: navCanScrollPrev ? 0.7 : 0.2 }}
                aria-label="Scroll tabs left"
              >
                <ChevronLeft className="w-4 h-4" style={{ color: "#1a1a1a" }} />
              </button>

              {/* Carousel viewport */}
              <div ref={navCarouselRef} className="overflow-hidden min-w-0">
                <div className="flex gap-1">
                  {navTabDefs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const isDisabled = (tab as { disabled?: boolean }).disabled === true;
                    return (
                      <button
                        key={tab.id}
                        data-lit-id={`nav-tab-${tab.id}`}
                        data-lit-type="tab"
                        data-lit-parent="nav-tabs-carousel"
                        /*
                         * A TAB IS NOT A TOGGLE. This read `isActive ? null : tab.id`, so
                         * clicking the tab you were ALREADY on set the header tab to null —
                         * and a null tab renders the workspace slot, which is the composer's.
                         * Clicking Console therefore landed you on Composer (owner,
                         * 2026-09-18: "when I click console, if it's already selected,
                         * instead of reloading the page it moves to composer").
                         *
                         * The rule he gave is simpler than what was here: "clicking a tab
                         * that's already selected reloads that surface." So the click always
                         * reports the tab it names; the host decides what a repeat means —
                         * for the console, re-assemble it; for the composer, a fresh package,
                         * which is what it has always meant.
                         */
                        disabled={isDisabled}
                        aria-disabled={isDisabled || undefined}
                        title={isDisabled ? 'Not wired up yet' : undefined}
                        onClick={() => { if (!isDisabled) setActiveTab(tab.id); }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${isDisabled ? 'cursor-default' : 'cursor-pointer'}`}
                        style={{
                          color: "#EBEBEB",
                          backgroundColor: isActive && !isDisabled ? "rgba(0,0,0,0.10)" : "transparent",
                          border: isActive && !isDisabled ? "1px solid #3e243c" : "1px solid transparent",
                        }}
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 opacity-70">
                          <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right arrow */}
              <button
                data-lit-id="nav-carousel-next"
                data-lit-type="carousel-arrow"
                onClick={() => navApi?.scrollNext()}
                disabled={!navCanScrollNext}
                className="shrink-0 p-1 rounded-full transition-opacity"
                style={{ opacity: navCanScrollNext ? 0.7 : 0.2 }}
                aria-label="Scroll tabs right"
              >
                <ChevronRight className="w-4 h-4" style={{ color: "#1a1a1a" }} />
              </button>
            </div>
          )}
        </div>

        {/* IDENTITY CHIP — always visible, every tab.
            A2UI honesty: the console assembles packages owned by THIS identity.
            If the console looks empty, check this id against the package owner. */}
        <div style={{ flex: "1 1 0%", display: "flex", justifyContent: "flex-end", minWidth: 0 }}>
          <div
            data-lit-id="identity-chip"
            data-lit-type="content-area"
            data-lit-description="Active user identity — console assembles packages owned by this user"
            className="shrink-0 font-mono text-xs px-2 py-1 rounded select-all md:block hidden"
            style={{ color: "rgba(0,0,0,0.75)", backgroundColor: "rgba(255,255,255,0.35)" }}
            title={`Active identity: ${getStoredUserId()}\nThe console assembles prompt packages owned by this user.`}
          >
            u:{getStoredUserId().slice(0, 8)}…{getStoredUserId().slice(-4)}
          </div>
        </div>
      </div>

      {/*
        ROW 2 — THE PROMPT MANAGEMENT BAR — IS GONE FROM HERE, and it is not coming back.

        It was the title, the version, the tags, the id, the author, the score and the
        column flip. It now lives INSIDE the surface as <left-column-header> (row 2 of
        this file moved wholesale, including its values), and the reason is the title:
        while this file owned it, the title was React state behind a callback, so the AI
        had no path to read it and no way to set it. In the surface it binds to
        /session/title like every other value, which is what lets Grace name a package.

        What stays here is ROW 1 — the brand, the Console/Composer/Evaluation/Variables/
        Metadata tabs and the identity chip. That is SHELL NAVIGATION, not the prompt's
        own furniture: it switches which surface is on screen, and it belongs to the shell
        that decides that. The owner, 2026-09-28: "the buttons above it with the console,
        composer, evaluation, metadata, variables — that is a part of the react shell and
        that would stay outside of the surface."
      */}
    </div>
  );
}