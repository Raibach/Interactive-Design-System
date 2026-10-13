/* eslint-disable @repo/no-style-props */
import { EnvLabelBadge } from "@/src/components/EnvLabelBadge";
import { useEnvLabel } from "@/src/hooks/useEnvLabel";
import { type LangfuseItemType } from "@/src/components/ItemBadge";
import { EntityTitle } from "@/src/components/EntityTitle";
import BreadcrumbComponent from "@/src/components/layouts/breadcrumb";
import {
  PageHeaderControlsSlotTarget,
  PageHeaderTitleSlotTarget,
} from "@/src/components/layouts/page-header-controls-slot";
import { InAppAiAgentButton } from "@/src/components/nav/in-app-ai-agent-button";
import { TopbarBrand } from "@/src/components/nav/topbar-brand";
import { useHasAppSidebar } from "@/src/components/nav/sidebar-presence";
import { useIsInAppAgentLauncherVisible } from "@/src/features/in-app-agent";
import { SidebarTrigger } from "@/src/components/ui/sidebar";
import {
  PageTabs,
  type PageTabsProps,
} from "@/src/components/layouts/page-tabs";
import { cn } from "@/src/utils/tailwind";
import { type ReactNode } from "react";
import {
  APP_SHELL_CHROME_ROW_CLASS,
  APP_SHELL_CHROME_ROW_TEST_ID,
} from "@/src/components/layouts/app-shell-chrome";

const containerLayoutClassName =
  "lg:mx-auto lg:w-full lg:max-w-screen-lg lg:px-8 xl:max-w-screen-xl 2xl:max-w-[1400px]";

export type PageHeaderProps = {
  title?: string;
  breadcrumb?: { name: string; href?: string }[];
  actionButtonsLeft?: React.ReactNode; // Right-side actions (buttons, etc.)
  actionButtonsRight?: React.ReactNode; // Right-side actions (buttons, etc.)
  actionButtonsRightClassName?: string;
  /** Mobile-only primary action rendered directly beside the page title. Use
   * this when collapsing the action would add an unnecessary overflow menu. */
  mobileActionButtons?: ReactNode;
  /** Mobile-only: the same actions rendered as full-width labeled menu rows
   * (icon + label), for the compact header's `⋯` overflow. Pages pass a
   * `layout="menu"` variant of their actions here (mirrors the table peek's
   * `actionsMenu`). When omitted, the mobile header falls back to folding the
   * inline `actionButtonsRight`/`actionButtonsLeft` nodes as-is. Desktop
   * `PageHeader` ignores this. The render callback can hand off focus through the stable menu trigger
   * before opening another panel, without delayed trigger focus restoration. */
  actionButtonsMenu?:
    | ReactNode
    | ((control: {
        closeMenu: (options?: { handoffFocus?: boolean }) => void;
      }) => ReactNode);
  help?: { description: React.ReactNode; href?: string; className?: string };
  titleTooltip?: string;
  itemType?: LangfuseItemType;
  container?: boolean;
  tabsProps?: PageTabsProps;
  className?: string;
  /** Bottom border and bottom padding; pages whose own strip follows the
   * header directly turn both off so title and strip read as one block. */
  divider?: boolean;
  showSidebarTrigger?: boolean;
  leadingControl?: ReactNode;
  titleBadges?: ReactNode;
  breadcrumbBadges?: ReactNode;
};

const PageHeader = ({
  title,
  itemType,
  actionButtonsLeft,
  actionButtonsRight,
  actionButtonsRightClassName,
  breadcrumb,
  help,
  titleTooltip,
  tabsProps,
  container = false,
  className,
  divider = true,
  showSidebarTrigger = true,
  leadingControl,
  titleBadges,
  breadcrumbBadges,
}: PageHeaderProps) => {
  const hasAppSidebar = useHasAppSidebar();
  const envLabel = useEnvLabel();
  const isInAppAgentLauncherVisible = useIsInAppAgentLauncherVisible();
  // The sidebar trigger + brand mark only make sense where a real AppSidebar
  // exists to toggle/mirror. On the sidebar-less MinimalLayout (public/shared
  // trace and session views) show the page's own leadingControl instead — no
  // hamburger opening an empty sheet, no orphaned brand mark.
  const showSidebarChrome = showSidebarTrigger && hasAppSidebar;
  // RAIBACH IDS (2026-10-12): the top chrome row renders ONLY when it carries
  // something — with the shell owning navigation and the breadcrumb gone, an
  // empty band must not stand over the page. Pages that hoist controls into
  // the slot below keep this row alive because their breadcrumb prop is set
  // (every current hoisting page passes one); a future breadcrumb-less
  // hoisting page must pass `leadingControl` to keep the row.
  // REVERT: drop the conditional and restore the row unconditionally.
  const hasTopRowContent =
    showSidebarChrome ||
    !!leadingControl ||
    envLabel.visible ||
    (breadcrumb?.length ?? 0) > 0 ||
    !!breadcrumbBadges ||
    isInAppAgentLauncherVisible;
  return (
    <div
      className={cn([
        "top-banner-offset bg-background sticky z-30 w-full",
        divider && "border-b",
        className,
      ])}
      id="page-header"
    >
      <div className="flex flex-col justify-center">
        {/* Top Row — carries hoisted page controls (e.g. the time range) on
            pages that use the slot; rises from natural height and collapses
            when empty (the sidebar and its junction border are deleted).
            Container max-width only caps the inner content so settings pages
            don't leave a gap. */}
        {hasTopRowContent && (
        <div
          data-testid={APP_SHELL_CHROME_ROW_TEST_ID}
          className={APP_SHELL_CHROME_ROW_CLASS}
        >
          <div
            className={cn(
              // RAIBACH IDS (2026-10-12): the sidebar is gone — the 43px
              // alignment line and the junction border went with it; rows
              // take their natural height and an empty band collapses.
              "flex h-full w-full flex-wrap items-center justify-between gap-x-3 gap-y-px px-3 leading-none",
              container && containerLayoutClassName,
            )}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {showSidebarChrome ? (
                <>
                  <SidebarTrigger />
                  {/* Brand the app in the top bar while the sidebar (which
                      owns the logo) is off-canvas below `md`. Hidden on
                      desktop where the sidebar logo is visible. */}
                  <TopbarBrand className="md:hidden" />
                </>
              ) : (
                leadingControl && (
                  <div className="flex items-center">{leadingControl}</div>
                )
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                {envLabel.visible && <EnvLabelBadge region={envLabel.region} />}
                <BreadcrumbComponent items={breadcrumb} />
                {breadcrumbBadges}
              </div>
            </div>
            {/* Slot for page-level controls (time range, auto-refresh)
                hoisted from a list table via PageHeaderControlsPortal.
                Empty on pages that don't use it. */}
            <div className="flex flex-wrap items-center gap-2">
              <PageHeaderControlsSlotTarget />
              {isInAppAgentLauncherVisible && <InAppAiAgentButton />}
            </div>
          </div>
        </div>
        )}

        {/* Bottom Row */}
        <div>
          <div
            className={cn(
              // RAIBACH IDS (2026-10-12): no forced min-height — the sidebar's
              // 44px alignment is dead; an empty row collapses and content
              // rows take their natural height (owner: "close up this space
              // ... the same at the top and the sides").
              "flex w-full flex-wrap items-center justify-between gap-1 px-4 md:flex-nowrap",
              divider ? "py-1" : "min-h-0 pt-3 pb-0",
              container && containerLayoutClassName,
            )}
          >
            {/* Left side content */}
            <div className="flex min-w-0 grow flex-wrap items-center md:grow-0">
              <div className="mr-2 flex min-w-0 items-center gap-2">
                {/* RAIBACH IDS (2026-10-12): title is optional — the shell
                    names the room; a page may drop its title block (the
                    Dashboards page does). REVERT: restore the unconditional
                    block and the required `title` field in PageHeaderProps. */}
                {title && (
                  <div className="max-w-md min-w-0 md:max-w-none">
                    <EntityTitle
                      as="h2"
                      type={itemType}
                      title={title}
                      tooltip={titleTooltip}
                      help={help}
                      data-testid="page-header-title"
                    />
                  </div>
                )}
                {titleBadges && (
                  <div className="ml-1 flex items-center gap-1">
                    {titleBadges}
                  </div>
                )}
              </div>
              {actionButtonsLeft && (
                <div className="flex flex-wrap items-center gap-1 self-center">
                  {actionButtonsLeft}
                </div>
              )}
            </div>

            {/* RAIBACH IDS (2026-10-12, owner's header pass): the title-row
                slot — a table's search box hoists here and flexes across the
                remaining width (truncating on overflow) instead of stacking
                below as its own full-width row. Empty on pages that don't
                use it. REVERT: delete this target. */}
            <PageHeaderTitleSlotTarget />

            {/* Right side content. Pages can override the default alignment
                when wrapped actions should retain a shared right edge. */}
            <div
              className={cn(
                "flex flex-wrap items-center gap-1",
                actionButtonsRightClassName,
              )}
            >
              {actionButtonsRight}
            </div>
          </div>

          {tabsProps && <PageTabs {...tabsProps} />}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
