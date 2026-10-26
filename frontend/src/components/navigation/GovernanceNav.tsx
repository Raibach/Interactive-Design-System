import { Fragment, useEffect, useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import raibachLogo from "@/assets/raibach-logo.jpg";

/**
 * GovernanceNav — the Governance room's left navigation, rendered in the SAME
 * page-level pattern as the shell rail (`LeftVerticalMenu`): a width-0, full-
 * height flex-row child whose content floats on absolute layers. That is what
 * puts the logo in the header band, exactly where every other section keeps it.
 *
 * ROUTING: this nav does not touch the React Router. The Governance "pages" live
 * INSIDE the embedded Langfuse app, so navigating means deep-linking that frame —
 * the shell's `onNavigate(href)` rewrites the embed's `src`. A nav-item click fires
 * that immediately and NEVER toggles the rail; the ONLY toggle is the header zone
 * (logo + rotating chevron) at the top.
 */

const LANGFUSE_PROJECT_ID = "51211b35-c875-4715-8040-33fccb624279";
const langfuseHref = (suffix: string) => `/project/${LANGFUSE_PROJECT_ID}${suffix}`;

/** The one shape every entry obeys: a label, a target, and an icon component. */
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Section header for the open panel; absent (or null) renders no header. */
  group?: string | null;
}

interface GovernanceNavProps {
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
const UsersIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const AlertsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
);
const PromptsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 4V6zM8 8h8M8 11h5" /></svg>
);
const PlaygroundIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M8 5.5v13l11-6.5z" /></svg>
);
const ScoresIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
);
const EvaluatorsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6zM9 12l2 2 4-4" /></svg>
);
const AnnotationIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 3a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" />
  </svg>
);
const DatasetsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>
);
const ExperimentsIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M9 3h6M10 3v5l-5 8a2 2 0 002 3h10a2 2 0 002-3l-5-8V3M7 14h10" /></svg>
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

// Langfuse's own sections, in the app's order, with the same group labels its
// sidebar uses (read from web/src/components/layouts/routes.tsx).
const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: langfuseHref(""), icon: HomeIcon, group: null },
  // No Dashboards entry — the list opens from the room's Home cog (settings
  // modal); a nav shortcut here would be a second door.
  // TRACING IS NOT HERE — removed 2026-10-14 on the owner's word: *"we could
  // remove trace now from the left hand navigation because Grace is handling
  // it."* The Trace button in her rail is the room's door to Tracing: it
  // deep-links the app AND carries the standing selection, so the table
  // re-marks what the seat features — a clean /traces jump from here could
  // never do that, and that path is exactly the one that left the featured
  // trace unmarked on the table (owner-reported the same day). The other
  // sections leave this nav the same way as the rail covers them; Home — and
  // the configuration-level items — stay (owner: *"you can click on the Home
  // icon on the left-hand side which will remain. It's just going to be more
  // high-level configuration than it is navigation."*).
  // SESSIONS IS NOT HERE (owner, 2026-10-24): it is the chat panel's own tab. The left
  // nav must not open a second Sessions interface.
  { label: "Users", href: langfuseHref("/users"), icon: UsersIcon, group: "Observability" },
  { label: "Alerts", href: langfuseHref("/alerts"), icon: AlertsIcon, group: "Observability" },
  { label: "Prompts", href: langfuseHref("/prompts"), icon: PromptsIcon, group: "Prompt Management" },
  { label: "Playground", href: langfuseHref("/playground"), icon: PlaygroundIcon, group: "Prompt Management" },
  { label: "Scores", href: langfuseHref("/scores"), icon: ScoresIcon, group: "Evaluation" },
  { label: "Evaluators", href: langfuseHref("/evals"), icon: EvaluatorsIcon, group: "Evaluation" },
  { label: "Human Annotation", href: langfuseHref("/annotation-queues"), icon: AnnotationIcon, group: "Evaluation" },
  { label: "Datasets", href: langfuseHref("/datasets"), icon: DatasetsIcon, group: "Evaluation" },
  { label: "Experiments", href: langfuseHref("/experiments"), icon: ExperimentsIcon, group: "Evaluation" },
  { label: "Settings", href: langfuseHref("/settings"), icon: SettingsIcon, group: null },
];

export default function GovernanceNav({ onNavigate, activePath }: GovernanceNavProps) {
  // The rail's one source of truth, collapsed by default. Only the persistent
  // toggle button below mutates it — never a nav-item click.
  const [isCollapsed, setIsCollapsed] = useState(true);
  // THE RAIL MOUNTS ONLY ONCE THE PANEL HAS FULLY CLOSED (300ms = the width
  // transition below). While the panel is open OR animating, the collapsed rail
  // is not in the DOM at all — so it can never show through or beside it.
  const [railVisible, setRailVisible] = useState(true);
  useEffect(() => {
    if (!isCollapsed) {
      setRailVisible(false);
      return undefined;
    }
    const t = setTimeout(() => setRailVisible(true), 300);
    return () => clearTimeout(t);
  }, [isCollapsed]);

  // The section the embedded app is standing in, as a NavItem href — detail
  // routes keep their parent section lit, exactly like Langfuse's own sidebar.
  const activeHref = (() => {
    if (!activePath) return null;
    const projectMatch = activePath.match(/^\/project\/[^/]+(\/([^/?]+))?/);
    if (!projectMatch) return null; // not a project page — no section is active
    const seg = projectMatch[2];
    if (!seg) return langfuseHref("");
    const suffixForSeg: Record<string, string> = {
      traces: "/traces", trace: "/traces", observations: "/traces",
      sessions: "/sessions", session: "/sessions",
      users: "/users",
      alerts: "/alerts",
      prompts: "/prompts", prompt: "/prompts",
      playground: "/playground",
      scores: "/scores", score: "/scores",
      evals: "/evals", evaluators: "/evals", evaluation: "/evals",
      "annotation-queues": "/annotation-queues",
      datasets: "/datasets", dataset: "/datasets",
      experiments: "/experiments", experiment: "/experiments",
      settings: "/settings",
    };
    const suffix = suffixForSeg[seg];
    return suffix ? langfuseHref(suffix) : null;
  })();

  return (
    <div
      id="governance-nav"
      className="relative h-full flex-shrink-0"
      style={{ zIndex: 50, width: 0 }}
    >
      {/* THE COLLAPSED RAIL'S FILL — 0.75, starting BELOW the header zone
          (top: 56px) so the header's own 0.75 is never stacked on a second 0.75
          layer. Mounts only once the panel has fully closed.
          PINNED BOTH EDGES — NOT h-full (fixed 2026-10-13 night, owner-reported: "it slides
          up and there's a white bar at the bottom"). `top-14 h-full` made this fill
          exactly 56px TALLER than the viewport (top 56 + 100vh), so the shell's
          overflow-hidden row had 56px of hidden scrollable content underneath it — and any
          focus/scroll reaching the room below the fold scrolled it to the bottom, sliding
          the whole shell (header included) up out of the window with a blank band left at
          the foot. top-14 + bottom-0 sizes it to the exact span it was always meant to
          cover and leaves nothing scrollable behind. */}
      {isCollapsed && railVisible && (
        <div
          className="absolute left-0 top-14 bottom-0 w-14"
          style={{ backgroundColor: "rgba(17, 14, 31, 0.75)" }}
        />
      )}

      {/* THE ONE PERSISTENT TOGGLE — logo + chevron in a single control that
          renders in EVERY state and never unmounts. It holds the 0.75 fill
          itself, sits at the page's top-left (the header band), and is the ONLY
          control that flips isCollapsed. paddingLeft is fixed at 8px in both
          states, so the logo's rect is identical collapsed and open. */}
      <button
        data-lit-id="gov-nav-toggle"
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
          backgroundColor: "rgba(17, 14, 31, 0.75)",
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
          embed on a single click and never touches isCollapsed. Same gate as
          the fill: it does not exist while the panel is open or animating. */}
      {isCollapsed && railVisible && (
        <TooltipProvider delayDuration={150}>
          <div
            data-lit-id="gov-nav-strip"
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
                  style={{ backgroundColor: "rgba(17, 14, 31, 0.75)", color: "#ffffff" }}
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
          0 ↔ 310 with the same curve as the toggle, so nothing in the layout
          moves. It holds NO second logo and NO second button: the persistent
          toggle above is the rail's only header. */}
      <div
        className="flex flex-col overflow-hidden"
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          zIndex: 55,
          height: "calc(100% - 56px)",
          width: isCollapsed ? 0 : 310,
          backgroundColor: "rgba(17, 14, 31, 0.75)",
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
