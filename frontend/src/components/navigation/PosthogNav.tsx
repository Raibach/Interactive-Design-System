/**
 * PosthogNav — the UX tab's left navigation, the Governance room's nav pattern applied
 * to the analytics application (owner, 2026-10-22: *"moving the navigation out next and
 * making it match the styling and structure of the governance left NAV"*).
 *
 * It is a faithful structural copy of `@/components/navigation/GovernanceNav.tsx`: the
 * same collapsed rail, the same expandable panel, the same dark fill and typography. What
 * changes is the list it carries — the analytics application's own sections, in its own
 * order, each deep-linking the framed application. No PostHog styling is invented here:
 * the frame's app is PostHog, but THIS nav is the house rail, so it wears the house rail's
 * styling, exactly as the governance rail does for Langfuse.
 *
 * ROUTING: this nav does not touch the React Router. The UX tab's pages live INSIDE the
 * framed application, so navigating means deep-linking that frame — `onNavigate(href)`
 * dispatches `ux-navigate`, which `ux-app-frame` consumes (the same event the chat's
 * screen commands dispatch). A nav-item click fires that immediately and never toggles
 * the rail; the ONLY toggle is the header zone (logo + rotating chevron) at the top.
 */

import { Fragment, useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import raibachLogo from "@/assets/raibach-logo.jpg";

const POSTHOG_PROJECT_ID = "1";
const posthogHref = (suffix: string) => `/project/${POSTHOG_PROJECT_ID}${suffix}`;

/** The one shape every entry obeys: a label, a target, and an icon component. */
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Section header for the open panel; absent (or null) renders no header. */
  group?: string | null;
}

interface PosthogNavProps {
  /** Deep-links the embedded app — the nav's single navigation exit. */
  onNavigate?: (href: string) => void;
  /** The embedded app's current path, used to mark the active section. */
  activePath?: string;
}

type IconProps = { className?: string };
const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const HomeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5" /></svg>
);
const InsightsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
);
const WebIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></svg>
);
const ReplayIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M4 4h16v16H4zM4 4l5 5M20 20l-5-5" /><path d="M9 13.5l6-3-6-3z" /></svg>
);
const DashboardIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
);
const ExperimentIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M9 3h6M10 3v5l-5 8a2 2 0 002 3h10a2 2 0 002-3l-5-8V3M7 14h10" /></svg>
);
const FlagIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></svg>
);
const SurveyIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M4 6h16v12H4z" /><path d="M8 10h8M8 14h5" /></svg>
);
const PersonsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const ActionsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></svg>
);
const ActivityIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
);
const SettingsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const ChevronIcon = ({ rotated }: { rotated: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4 text-gray-400 shrink-0"
    style={{
      transform: rotated ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
    }}
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

// The analytics application's own sections, in the order its own sidebar lists the
// core products, with the group labels its catalogue uses (Analytics / Product
// engineering / Data). Every route is a real screen of the framed application.
const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: posthogHref("/home"), icon: HomeIcon, group: null },
  { label: "Product analytics", href: posthogHref("/insights"), icon: InsightsIcon, group: "Analytics" },
  { label: "Web analytics", href: posthogHref("/web"), icon: WebIcon, group: "Analytics" },
  { label: "Session replay", href: posthogHref("/replay"), icon: ReplayIcon, group: "Analytics" },
  { label: "Dashboards", href: posthogHref("/dashboards"), icon: DashboardIcon, group: "Analytics" },
  { label: "Experiments", href: posthogHref("/experiments"), icon: ExperimentIcon, group: "Product engineering" },
  { label: "Feature flags", href: posthogHref("/feature_flags"), icon: FlagIcon, group: "Product engineering" },
  { label: "Surveys", href: posthogHref("/surveys"), icon: SurveyIcon, group: "Product engineering" },
  { label: "Persons", href: posthogHref("/persons"), icon: PersonsIcon, group: "Data" },
  { label: "Actions", href: posthogHref("/actions"), icon: ActionsIcon, group: "Data" },
  { label: "Activity", href: posthogHref("/activity"), icon: ActivityIcon, group: "Data" },
  { label: "Settings", href: posthogHref("/settings"), icon: SettingsIcon, group: null },
];

export default function PosthogNav({ onNavigate, activePath }: PosthogNavProps) {
  // The rail's one source of truth, collapsed by default. Only the persistent
  // toggle button below mutates it — never a nav-item click.
  const [isCollapsed, setIsCollapsed] = useState(true);
  // THE RAIL STAYS IN THE DOM WHILE COLLAPSED (owner, 2026-10-22: *"we don't want our
  // Japanese screen to snap and pop and snag on the tracks"*). The 56px rail sits BEHIND the
  // opaque panel, so as the panel slides shut it reveals the rail smoothly — the old
  // mount-only-after-close gate made the rail vanish to the edge and then pop back in. No gate;
  // the panel's own slide IS the reveal.

  // The section the embedded app is standing in, as a NavItem href — detail
  // routes keep their parent section lit, exactly like the app's own sidebar.
  const activeHref = (() => {
    if (!activePath) return null;
    const projectMatch = activePath.match(/^\/project\/[^/]+(\/([^/?]+))?/);
    if (!projectMatch) return null; // not a project page — no section is active
    const seg = projectMatch[2];
    if (!seg) return posthogHref("/home");
    const suffixForSeg: Record<string, string> = {
      home: "/home",
      insights: "/insights", insight: "/insights",
      web: "/web",
      replay: "/replay", recordings: "/replay",
      dashboards: "/dashboards", dashboard: "/dashboards",
      experiments: "/experiments", experiment: "/experiments",
      feature_flags: "/feature_flags", feature_flag: "/feature_flags",
      surveys: "/surveys", survey: "/surveys",
      persons: "/persons", person: "/persons",
      actions: "/actions", action: "/actions",
      activity: "/activity",
      settings: "/settings",
    };
    const suffix = suffixForSeg[seg];
    return suffix ? posthogHref(suffix) : null;
  })();

  return (
    <div
      id="posthog-nav"
      className="flex-shrink-0"
      style={{ position: "fixed", top: 0, left: 0, height: "100%", zIndex: 1000, width: 0 }}
    >
      {/* THE COLLAPSED RAIL'S FILL — 0.75, starting BELOW the header zone
          (top: 56px) so the header's own 0.75 is never stacked on a second 0.75
          layer. Mounts only once the panel has fully closed.
          PINNED BOTH EDGES — NOT h-full (the governance rail's fix, carried over:
          `top-14 h-full` is exactly 56px taller than the viewport and hides a
          scrollable sliver behind the shell that slides everything up). */}
      {isCollapsed && (
        <div
          className="absolute left-0 top-14 bottom-0 w-14"
          style={{ backgroundColor: "rgb(17, 14, 31)" }}
        />
      )}

      {/* THE ONE PERSISTENT TOGGLE — logo + chevron in a single control that
          renders in EVERY state and never unmounts. It holds the 0.75 fill
          itself, sits at the room's top-left, and is the ONLY control that
          flips isCollapsed. */}
      <button
        data-lit-id="posthog-nav-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 60,
          width: isCollapsed ? 56 : 310,
          height: 56,
          display: "flex",
          alignItems: "center",
          paddingLeft: 8,
          backgroundColor: "rgb(17, 14, 31)",
          border: "none",
          cursor: "pointer",
          transitionProperty: "width",
          transitionDuration: "0.3s",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        title={isCollapsed ? "Open navigation" : "Close navigation"}
        aria-label={isCollapsed ? "Open navigation" : "Close navigation"}
      >
        <img src={raibachLogo} alt="Raibach" className="rounded object-cover shrink-0" style={{ width: 28, height: 28 }} />
        {!isCollapsed && (
          <div className="flex flex-col items-start leading-tight flex-1 min-w-0" style={{ marginLeft: 8 }}>
            <span style={{ color: "#ffffff", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: 700, letterSpacing: "-0.02em", fontSize: "18px" }}>RAIBACH IDS</span>
            <span style={{ color: "#ffffff", letterSpacing: "0.06em", fontSize: "11px", fontWeight: 600 }}>Interactive Design System</span>
          </div>
        )}
        <span style={{ display: "flex", marginLeft: isCollapsed ? 2 : "auto", marginRight: isCollapsed ? 0 : 12 }}>
          <ChevronIcon rotated={!isCollapsed} />
        </span>
      </button>

      {/* THE COLLAPSED STRIP — icons below the header zone. Each deep-links the
          frame on a single click and never touches isCollapsed. Same gate as
          the fill: it does not exist while the panel is open or animating. */}
      {isCollapsed && (
        <TooltipProvider delayDuration={150}>
          <div
            data-lit-id="posthog-nav-strip"
            className="absolute left-0 top-14 w-14 flex flex-col items-center gap-1 py-2"
          >
            {NAV_ITEMS.map((item) => (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onNavigate?.(item.href)}
                    className={`w-9 h-9 flex items-center justify-center transition-colors ${item.href === activeHref ? "text-[#CBE6E3]" : "text-white"}`}
                    aria-label={item.label}
                  >
                    <item.icon className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="border-0"
                  style={{ backgroundColor: "rgb(17, 14, 31)", color: "#ffffff" }}
                >
                  <span className="text-xs font-medium">{item.label}</span>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}

      {/* THE OPEN PANEL — 0.75, starting BELOW the header zone (top: 56px) so it
          never overlaps the toggle's own 0.75 fill (no stacking). Width animates
          0 ↔ 310 with the same curve as the toggle. It holds NO second logo and
          NO second button: the persistent toggle above is the rail's only header. */}
      <div
        className="flex flex-col overflow-hidden"
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          zIndex: 55,
          height: "calc(100% - 56px)",
          width: isCollapsed ? 0 : 310,
          backgroundColor: "rgb(17, 14, 31)",
          borderRight: isCollapsed ? "none" : "1px solid rgba(255,255,255,0.08)",
          boxShadow: isCollapsed ? "none" : "8px 0 24px rgba(0, 0, 0, 0.45)",
          transitionProperty: "width",
          transitionDuration: "0.3s",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {!isCollapsed && (
          <div style={{ minWidth: 310, height: "100%", display: "flex", flexDirection: "column" }}>
            <div className="flex flex-col flex-1 p-3 gap-1 overflow-y-auto">
              {NAV_ITEMS.map((item, i) => {
                const prev = i > 0 ? NAV_ITEMS[i - 1] : null;
                const showHeader = item.group && item.group !== prev?.group;
                return (
                  <Fragment key={item.href}>
                    {showHeader && (
                      <div className="pt-3 pb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{item.group}</div>
                    )}
                    <button
                      onClick={() => onNavigate?.(item.href)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${item.href === activeHref ? "bg-white/15 text-white" : "text-gray-200 hover:bg-white/10 hover:text-white"}`}
                    >
                      <span className="w-5 h-5 flex items-center justify-center"><item.icon className="w-5 h-5" /></span>
                      <span>{item.label}</span>
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
