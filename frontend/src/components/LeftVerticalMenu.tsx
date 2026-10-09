import { API_BASE } from "@/shared/apiHelper";
import { apiFetch } from "@/shared/apiFetch";
import { isDemoMode } from "@/shared/appConfig";
import { Fragment, useState, useEffect } from "react";
import raibachLogo from "../assets/raibach-logo.jpg";
import { IngestModal } from "./IngestModal";

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

interface LeftVerticalMenuProps {
  onNewChat?: () => void;
  onUploadDocument?: () => void;
  /** The header tab the surrounding shell is on — "console" vs "composer". */
  currentTab?: string;
  /** Writes a Langfuse route onto the Governance embed — the shell nav's deep-link. */
  onNavigateGovernance?: (path: string) => void;
  /** The embedded app's current path, so the active section can be marked. */
  activeGovernancePath?: string;
  // Received and destructured since the real login landed (routes/auth.py + PinGate),
  // but not declared here, so the tree did not typecheck and `npm run build` failed
  // with TS2339 on the destructuring below. Declared, not wired: LogoutIcon exists at
  // :205 and nothing renders it yet, so there is still no control to press.
  onSignOut?: () => void;
  userName?: string;
  userAvatar?: string;
}


// List icon for prompts
const ListIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
    <path d="M5 5h10M5 10h10M5 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="3" cy="5" r="1" fill="currentColor" />
    <circle cx="3" cy="10" r="1" fill="currentColor" />
    <circle cx="3" cy="15" r="1" fill="currentColor" />
  </svg>
);


// Box/component icon
const ComponentIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
    <rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="2" y="11" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11" y="11" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

// Raibach Interactive Design logo
const StarburstIcon = ({ logo }: { logo?: string }) => (
  <img 
    src={logo} 
    alt="Raibach" 
    className="w-7 h-7 rounded object-cover"
  />
);

// Plus icon
const PlusIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
    <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Chat icon
const ChatIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
    <path
      d="M2 6a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6l-4 3V6z"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

// Folder icon
const FolderIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
    <path
      d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

// (The Ingest and Upload icons went with their menu items — owner, 2026-10-01: *"remove it
// completely"*, then *"remove upload document"*.)

// Helper to make authenticated API calls with required X-User-ID header
// Uses the stored user ID via getStoredUserId() — same pattern as every other file
// MOVED to `@/shared/apiFetch` (2026-09-30): the Design tab renders the ingest interface as a
// section of the surface, so this is no longer the menu's own helper. Imported, not redefined.

export default function LeftVerticalMenu({
  onNewChat,
  onUploadDocument,
  onNavigateGovernance,
  activeGovernancePath,
  onSignOut,
  userName = "User",
  userAvatar,
  currentTab = "console",
}: LeftVerticalMenuProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  /** THE NAV ITSELF, OPEN OR CLOSED — closed by default: the shell shows the R and nothing else. */
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [promptList, setPromptList] = useState<Array<{id:string;title:string;updated_at:string}>>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [componentList, setComponentList] = useState<Array<{name:string;id:string;description?:string}>>([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [loadingPromptId, setLoadingPromptId] = useState<string | null>(null);
  const [ingestModalOpen, setIngestModalOpen] = useState(false);
  // The prompt package currently open — the ingest tool records what it adds against it.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState<string | null>(null);

  // Detect mobile breakpoint — collapse to hamburger below 768px (2-card break)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /*
   * THE DESIGN ARTIFACTS TAB OPENS THIS MODAL, and this listener is the whole of that wiring.
   *
   * The header tab dispatches `open-ingest` from the shell (WritingAreaIndex,
   * `handleTabChangeWithGate`); the component that ALREADY owns the ingest modal answers it.
   * Nothing moved, and IngestModal itself was not touched — the owner, 2026-09-30: "design
   * artifacts tab will open up exactly what we have now on ingestion… You can just add a link
   * to that actually you don't even have to change it. You don't have to move it."
   *
   * The event convention is this shell's own (`start-new-prompt`, `navigate-console`). The
   * "Ingest Design" menu item that ran these same three lines is gone (owner, 2026-10-01), so the
   * header's tab is this modal's one remaining entry point.
   */
  useEffect(() => {
    const onOpenIngest = () => {
      // The demo does not ingest: /api/catalog/ingest and the whole figma-ingest
      // family are refused server-side (demo_policy.py), so the modal must not open.
      if (isDemoMode()) return;
      setIngestModalOpen(true);
      setIsNavOpen(false);
      handleCollapse();
    };
    window.addEventListener("open-ingest", onOpenIngest);
    return () => window.removeEventListener("open-ingest", onOpenIngest);
  }, []);

  // Hamburger icon
  const HamburgerIcon = () => (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  const handleItemClick = (id: string, callback?: () => void) => {
    /* THE "ingest" BRANCH IS GONE WITH ITS MENU ITEM (owner, 2026-10-01: *"remove it
       completely"*). The modal is still reachable: the header's ingest tab dispatches
       `open-ingest`, which the listener below answers. */
    if (expandedItem === id) {
      setExpandedItem(null);
      setIsExpanded(false);
    } else {
      setExpandedItem(id);
      setIsExpanded(true);
      callback?.();
    }
  };

  // Fetch prompts when prompts panel opens
  useEffect(() => {
    if (expandedItem === "prompts") {
      setPromptsLoading(true);
      apiFetch(`${API_BASE}/prompts`)
        .then(r => r.json())
        .then(d => setPromptList((d.prompts || d.sessions || []).slice(0, 30)))
        .catch((err) => console.error('[LeftVerticalMenu] Failed to fetch prompts:', err))
        .finally(() => setPromptsLoading(false));
    }
    if (expandedItem === "components") {
      setComponentsLoading(true);
      fetch(`${API_BASE}/figma/config`)
        .then(r => r.json())
        .then(fc => {
          if (fc.connected && fc.file_key) {
            return fetch(`${API_BASE}/figma/file`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({file_key:fc.file_key})});
          }
          throw new Error("not connected");
        })
        .then(r => r.json())
        .then(d => {
          const comps = d.components ? Object.values(d.components) : [];
          setComponentList(comps.map((c:any) => ({name:c.name,id:c.key||c.node_id||c.id,description:c.description})));
        })
        .catch((err) => console.error('[LeftVerticalMenu] Failed to fetch components:', err))
        .finally(() => setComponentsLoading(false));
    }
  }, [expandedItem]);

  const handleDeletePrompt = async (e: React.MouseEvent, promptId: string) => {
    e.stopPropagation();
    // Belt to the hidden button's braces: the demo's DELETE is refused server-side,
    // so the action must die here rather than round-trip to a 403.
    if (isDemoMode()) return;
    if (!confirm('Delete this prompt?')) return;
    const r = await apiFetch('/api/prompt-sessions/' + promptId + '?permanent=true', { method: 'DELETE' });
    if (!r.ok) {
      alert('Failed to delete prompt. Please try again.');
      return;
    }
    setPromptList(prev => prev.filter(p => p.id !== promptId));
    // Notify WritingAreaIndex so it clears currentPromptSession if the deleted prompt is the one currently open
    window.dispatchEvent(new CustomEvent('prompt-session-deleted', { detail: { id: promptId } }));
    window.dispatchEvent(new CustomEvent('prompt-version-updated', { detail: { type: 'deleted', id: promptId } }));
  };

  const handleCreateNewPrompt = () => {
    // "New Prompt" clears the workspace WITHOUT saving to the database.
    // The user starts with a blank slate. Only "Save Template" creates a DB row.
    handleCollapse();
    window.dispatchEvent(new CustomEvent('start-new-prompt'));
  };

  const handleCollapse = () => {
    setExpandedItem(null);
    setIsExpanded(false);
  };

// Sign out icon
const LogoutIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
    <path d="M12 3h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 10h8M13 7l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

  // The Governance tab's items — Langfuse's own sections, moved into the shell's nav
  // (owner, 2026-10-09). Each writes its route onto the embed via onNavigateGovernance.
  const LANGFUSE_PROJECT_ID = '51211b35-c875-4715-8040-33fccb624279';
  const langfusePath = (suffix: string) => `/project/${LANGFUSE_PROJECT_ID}${suffix}`;
  const govStroke = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const GOVERNANCE_ITEMS: Array<{ id: string; icon: React.ReactNode; label: string; path: string; group: string | null }> = [
    { id: 'gov-home', label: 'Home', path: langfusePath(''), group: null, icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5" {...govStroke} /></svg> },
    { id: 'gov-dashboards', label: 'Dashboards', path: langfusePath('/dashboards'), group: null, icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" {...govStroke} /></svg> },
    { id: 'gov-traces', label: 'Tracing', path: langfusePath('/traces'), group: 'Observability', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M6 3v18M6 8h6M6 15h6M12 5v6M12 12v6" {...govStroke} /></svg> },
    { id: 'gov-sessions', label: 'Sessions', path: langfusePath('/sessions'), group: 'Observability', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...govStroke} /></svg> },
    { id: 'gov-users', label: 'Users', path: langfusePath('/users'), group: 'Observability', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" {...govStroke} /><circle cx="9" cy="7" r="4" {...govStroke} /><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" {...govStroke} /></svg> },
    { id: 'gov-alerts', label: 'Alerts', path: langfusePath('/alerts'), group: 'Observability', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" {...govStroke} /></svg> },
    { id: 'gov-prompts', label: 'Prompts', path: langfusePath('/prompts'), group: 'Prompt Management', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 4V6zM8 8h8M8 11h5" {...govStroke} /></svg> },
    { id: 'gov-playground', label: 'Playground', path: langfusePath('/playground'), group: 'Prompt Management', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M8 5.5v13l11-6.5z" {...govStroke} /></svg> },
    { id: 'gov-scores', label: 'Scores', path: langfusePath('/scores'), group: 'Evaluation', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" {...govStroke} /></svg> },
    { id: 'gov-evaluators', label: 'Evaluators', path: langfusePath('/evals'), group: 'Evaluation', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6zM9 12l2 2 4-4" {...govStroke} /></svg> },
    { id: 'gov-annotation', label: 'Human Annotation', path: langfusePath('/annotation-queues'), group: 'Evaluation', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><rect x="5" y="3" width="14" height="18" rx="2" {...govStroke} /><path d="M9 3a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" {...govStroke} /></svg> },
    { id: 'gov-datasets', label: 'Datasets', path: langfusePath('/datasets'), group: 'Evaluation', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" {...govStroke} /></svg> },
    { id: 'gov-experiments', label: 'Experiments', path: langfusePath('/experiments'), group: 'Evaluation', icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M9 3h6M10 3v5l-5 8a2 2 0 002 3h10a2 2 0 002-3l-5-8V3M7 14h10" {...govStroke} /></svg> },
    { id: 'gov-settings', label: 'Settings', path: langfusePath('/settings'), group: null, icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><circle cx="12" cy="12" r="3" {...govStroke} /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" {...govStroke} /></svg> },
  ];
  const isGovernance = currentTab === 'governance';

  // The section the embedded app is standing in — so the shell nav can mark it the
  // way the app's own sidebar does (detail routes keep their parent section lit).
  const activeGovId = (() => {
    if (!isGovernance || !activeGovernancePath) return null;
    const projectMatch = activeGovernancePath.match(/^\/project\/[^/]+(\/([^/?]+))?/);
    if (!projectMatch) return null; // not a project page — no section is active
    const seg = projectMatch[2];
    if (!seg) return 'gov-home';
    const sectionForSeg: Record<string, string> = {
      dashboards: 'gov-dashboards',
      traces: 'gov-traces', trace: 'gov-traces', observations: 'gov-traces',
      sessions: 'gov-sessions', session: 'gov-sessions',
      users: 'gov-users',
      alerts: 'gov-alerts',
      prompts: 'gov-prompts', prompt: 'gov-prompts',
      playground: 'gov-playground',
      scores: 'gov-scores', score: 'gov-scores',
      evals: 'gov-evaluators', evaluators: 'gov-evaluators', evaluation: 'gov-evaluators',
      'annotation-queues': 'gov-annotation',
      datasets: 'gov-datasets', dataset: 'gov-datasets',
      experiments: 'gov-experiments', experiment: 'gov-experiments',
      settings: 'gov-settings',
    };
    return sectionForSeg[seg] ?? null;
  })();

  const menuItems: MenuItem[] = isGovernance
    ? GOVERNANCE_ITEMS.map((g) => ({
        id: g.id,
        icon: g.icon,
        label: g.label,
        onClick: () => onNavigateGovernance?.(g.path),
      }))
    : [
        {
          id: "new-chat",
          icon: <ChatIcon />,
          label: "New Chat",
          onClick: onNewChat,
        },
        {
          id: "prompts",
          icon: <ListIcon />,
          label: "Saved Prompts",
        },
        {
          id: "components",
          icon: <ComponentIcon />,
          label: "Plugins",
        },
        /*
         * "INGEST DESIGN" AND "UPLOAD DOCUMENT" ARE GONE (owner, 2026-10-01: *"You should remove it
         * completely"*, then *"remove upload document"*). Ingest's home is the Design room's own rail
         * — the Figma URL field, Notes and Submit, drawn by `figma-ingest-form` — and this item was a
         * second entry point to the same modal. Nothing is left greyed here: a menu that keeps a
         * deactivated control is a menu that has to explain itself.
         */
      ].filter((item) => {
        // Saved Prompts and Plugins are console-only: on the composer they cover the
        // header, so they come off the floating strip and the flyout there.
        if (currentTab === 'console') return true;
        return item.id !== 'prompts' && item.id !== 'components';
      });

  return (
    <div
      id="left-vertical-menu"
      className="relative h-full flex-shrink-0"
      style={{ zIndex: 50, width: 0 }}
    >
      {/* THE COLLAPSED RAIL'S FILL — a full-height bar behind the R and the
          floating icons, the header color at 75% (alpha 0.75), so the app
          behind never competes with the icons. Only while collapsed. */}
      {!isNavOpen && (
        <div
          data-lit-id="nav-rail-fill"
          className="absolute left-0 top-0 w-14 h-full"
          style={{ backgroundColor: "rgba(17, 14, 31, 0.75)" }}
        />
      )}

      {/* THE R — closed state only: the square that opens the nav. Nothing else is on screen. */}
      {!isNavOpen && (
        <button
          data-lit-id="nav-toggle"
          onClick={() => setIsNavOpen(true)}
          className="absolute top-0 left-0 w-14 h-14 flex items-center justify-center"
          style={{ zIndex: 60 }}
          title="Open navigation"
          aria-label="Open navigation"
        >
          <StarburstIcon logo={raibachLogo} />
        </button>
      )}

      {/* THE FLOATING STRIP — a transparent container under the R. The icons have no boxes:
          they read as floating on the design, and the whole section opens the nav. */}
      {!isNavOpen && (
        <div
          data-lit-id="nav-strip"
          onClick={() => setIsNavOpen(true)}
          className="absolute left-0 top-14 w-14 flex flex-col items-center gap-1 py-2 cursor-pointer"
        >
          {menuItems
            .filter((item) => item.id !== "new-chat")
            .map((item) => (
            <button
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                setIsNavOpen(true);
              }}
              className={`w-9 h-9 flex items-center justify-center transition-colors ${isGovernance && item.id === activeGovId ? 'text-[#CBE6E3]' : 'text-white'}`}
              title={item.label}
              aria-label={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>
      )}

      {/* OPEN: a regular navigation panel over the design — header with the name and the X,
          then the menu items full width. Nothing empty, nothing pushed. */}
      {/* Expanded flyout panel */}
      <div
        className="h-full flex flex-col overflow-hidden transition-all duration-250 ease-out"
        style={{
          width: isNavOpen ? "310px" : "0px",
          position: "absolute",
          top: 0,
          left: "0px",
          zIndex: 55,
          backgroundColor: "#110E1F",
          borderRight: isNavOpen ? "1px solid rgba(255,255,255,0.08)" : "none",
          boxShadow: isNavOpen ? "8px 0 24px rgba(0, 0, 0, 0.45)" : "none",
          overflow: "hidden",
        }}
      >
        {isNavOpen && (
          <div className="flex flex-col" style={{ minWidth: "310px" }}>
            {/* The same R, at the same spot — the panel slides in behind it, so nothing appears to move. */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-14 h-14 flex items-center justify-center shrink-0" style={{ backgroundColor: "#110E1F" }}>
                <StarburstIcon logo={raibachLogo} />
              </div>
              <div className="flex flex-col leading-tight flex-1 min-w-0">
                <span style={{ color: "#ffffff", fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700, letterSpacing: "-0.02em", fontSize: "24px" }}>RAIBACH IDS</span>
                <span style={{ color: "#ffffff", letterSpacing: "0.06em", fontSize: "13px", fontWeight: 600 }}>Interactive Design System</span>
              </div>
              <button
                onClick={() => { setIsNavOpen(false); handleCollapse(); }}
                className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white transition-colors text-lg leading-none shrink-0 mr-3"
                title="Close navigation"
                aria-label="Close navigation"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {isNavOpen && !expandedItem && (
          <div className="flex flex-col h-full p-3 gap-1 overflow-y-auto" style={{ minWidth: "310px" }}>
            {isGovernance ? (
              <>
                {GOVERNANCE_ITEMS.map((g, i) => {
                  const prev = i > 0 ? GOVERNANCE_ITEMS[i - 1] : null;
                  const showHeader = g.group && g.group !== prev?.group;
                  return (
                    <Fragment key={g.id}>
                      {showHeader && (
                        <div className="pt-3 pb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{g.group}</div>
                      )}
                      <button
                        onClick={() => {
                          onNavigateGovernance?.(g.path);
                          setIsNavOpen(false);
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${g.id === activeGovId ? 'bg-white/15 text-white' : 'text-gray-200 hover:bg-white/10 hover:text-white'}`}
                      >
                        <span className="w-5 h-5 flex items-center justify-center">{g.icon}</span>
                        <span>{g.label}</span>
                      </button>
                    </Fragment>
                  );
                })}
              </>
            ) : (
              menuItems
                .filter((item) => item.id !== "new-chat")
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id, item.onClick)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))
            )}
          </div>
        )}
        {isExpanded && expandedItem && (
          <div className="flex flex-col h-full p-3 gap-1" style={{ minWidth: "310px" }}>
            {/* Panel header — the whole row goes back, not just the icon. */}
            <button
              onClick={handleCollapse}
              className="flex items-center gap-2 mb-2 px-1 w-full text-left text-gray-400 hover:text-white transition-colors"
              title="Back"
              aria-label="Back"
            >
              <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 shrink-0">
                <path d="M11 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-widest">
                {menuItems.find((m) => m.id === expandedItem)?.label}
              </span>
            </button>

            {/* Divider */}
            <div className="w-full h-px bg-white/10 mb-2" />

            {/* Content based on active item */}
            {expandedItem === "new-chat" && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => { onNewChat?.(); handleCollapse(); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <span className="text-base">💬</span>
                  <span>Start New Chat</span>
                </button>
                <button
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-colors text-left"
                  onClick={handleCollapse}
                >
                  <span className="text-base">📋</span>
                  <span>Recent Chats</span>
                </button>
              </div>
            )}

            {expandedItem === "prompts" && (
              <div className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden flex-1">
                <button
                  onClick={handleCreateNewPrompt}
                  className="flex items-center gap-2 px-3 py-1.5 mb-1 rounded text-xs text-white bg-[#1f1f1f] hover:bg-[#2a2a2a] transition-colors text-center justify-center font-semibold"
                >
                  + New Prompt
                </button>
                {promptsLoading ? (
                  <div className="text-xs text-gray-400 px-3 py-2 italic">Loading...</div>
                ) : promptList.length === 0 ? (
                  <div className="text-xs text-gray-400 px-3 py-2 italic">No saved prompts yet</div>
                ) : (
                  promptList.map(p => (
                    <div key={p.id} className="flex items-center gap-1 group">
                      <button
                        onClick={() => {
                          setLoadingPromptId(p.id);
                          // Only dispatch session-loaded — WritingAreaIndex handles all data fetching
                          setActiveSessionId(p.id);
                          setActiveSessionTitle(p.title || null);
                          window.dispatchEvent(new CustomEvent("prompt-session-loaded", {
                            detail: { sessionId: p.id }
                          }));
                          setLoadingPromptId(null);
                          handleCollapse();
                        }}
                        className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-left min-w-0"
                      >
                        {loadingPromptId === p.id ? (
                          <span className="animate-spin shrink-0 text-gray-400">⟳</span>
                        ) : (
                          <span className="text-gray-500 shrink-0">◆</span>
                        )}
                        <span className="truncate">{p.title || "Untitled"}</span>
                      </button>
                      {/* Delete is not offered on the demo — the server refuses it
                          (demo_policy.py), so the demo does not show the door. */}
                      {!isDemoMode() && (
                        <button
                          onClick={(e) => handleDeletePrompt(e, p.id)}
                          className="opacity-0 group-hover:opacity-100 shrink-0 text-red-400 hover:text-red-300 text-base leading-none px-1 py-0.5 transition-opacity"
                          title="Delete"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {expandedItem === "components" && (
              <div className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden flex-1">
                {componentsLoading ? (
                  <div className="text-xs text-gray-400 px-3 py-2 italic">Loading...</div>
                ) : componentList.length === 0 ? (
                  <div className="text-xs text-gray-400 px-3 py-2 italic">No components found</div>
                ) : (
                  componentList.map(comp => (
                    <button
                      key={comp.id}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("figma-component-selected", {
                          detail: { component: comp, fileKey: localStorage.getItem("figma-file-key") || "" }
                        }));
                        handleCollapse();
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-left min-w-0"
                    >
                      <span className="text-gray-500 shrink-0">◇</span>
                      <span className="truncate">{comp.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {expandedItem === "upload" && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => { onUploadDocument?.(); handleCollapse(); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <span className="text-base">📄</span>
                  <span>Upload PDF</span>
                </button>
                <button
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-colors text-left"
                  onClick={handleCollapse}
                >
                  <span className="text-base">📎</span>
                  <span>Attach File</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile hamburger + slide-out drawer (below 768px) ── */}
      {isMobile && (
        <>
          {/* Hamburger button — positioned over yellow header */}
          <button
            data-lit-id="mobile-hamburger"
            data-lit-type="navigation-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="fixed top-2 left-2 z-[60] w-10 h-10 flex items-center justify-center rounded-lg bg-[#110E1F] text-white hover:bg-[#1d1a35] transition-colors shadow-lg"
            title="Menu"
          >
            {mobileMenuOpen ? (
              <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
                <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <HamburgerIcon />
            )}
          </button>

          {/* Slide-out drawer */}
          <div
            data-lit-id="mobile-nav-drawer"
            data-lit-type="navigation-drawer"
            className="fixed top-0 left-0 h-full z-[55] flex flex-col overflow-y-auto transition-transform duration-250 ease-out shadow-2xl"
            style={{
              width: "260px",
              backgroundColor: "#110E1F",
              transform: mobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
            }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 pt-5">
              <StarburstIcon logo={raibachLogo} />
              <span className="text-xs font-bold text-white tracking-wider ml-2">RAIBACH</span>
              <div className="flex-1" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Divider */}
            <div className="mx-4 h-px bg-white/10" />

            {/* Nav tabs */}
            <div className="p-3 flex flex-col gap-0.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-2 mb-1">Navigate</p>
              {/*
                * LABELS, NOT IDS. This list used to be bare ids rendered through CSS
                * `capitalize`, which worked while every tab was one word and cannot produce
                * "Design". The six ids are the header's own (LeftColumnHeader navTabDefs) and the
                * protocol's (tag-registry.ts:201, :920).
                *
                * ONLY DESIGN AND PRODUCT DO ANYTHING HERE. The header's tabs go through
                * `handleTabChangeWithGate`, which this component is not given — it receives
                * `currentTab` and no callback — so the others close the drawer and stop, exactly
                * as they did before. Design opens the ingest tool through the `open-ingest`
                * window event the header's ingest tab uses; PRODUCT (a real room since
                * 2026-10-03) hands the switch over through `navigate-tab`, which the shell
                * routes through the same gate every header click uses.
                */}
              {[
                { id: "console", label: "Console" },
                { id: "composer", label: "Composer" },
                { id: "design", label: "Design" },
                /*
                 * ONE STUB REMAINS, AND THE FLAG IS READ, NOT THE LABEL — so the two lists
                 * cannot drift into disagreeing about which tabs exist. Product and Governance
                 * left this set on 2026-10-03 — both are real rooms now, and the drawer hands
                 * their switches over through `navigate-tab`; Development is still a compartment
                 * with nothing behind it.
                 */
                { id: "product", label: "Product" },
                { id: "development", label: "Development", disabled: true },
                { id: "governance", label: "Governance" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  disabled={(tab as { disabled?: boolean }).disabled === true}
                  aria-disabled={(tab as { disabled?: boolean }).disabled === true || undefined}
                  title={(tab as { disabled?: boolean }).disabled ? 'Not wired up yet' : undefined}
                  onClick={() => {
                    if ((tab as { disabled?: boolean }).disabled === true) return;
                    setMobileMenuOpen(false);
                    if (tab.id === "design") {
                      window.dispatchEvent(new CustomEvent("open-ingest"));
                    } else if (tab.id === "product" || tab.id === "governance") {
                      window.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tabId: tab.id } }));
                    }
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                    (tab as { disabled?: boolean }).disabled
                      ? 'text-gray-500 cursor-default'
                      : 'text-gray-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="mx-4 h-px bg-white/10" />

            {/* Actions */}
            <div className="p-3 flex flex-col gap-0.5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-2 mb-1">Actions</p>
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { handleItemClick(item.id, item.onClick); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Backdrop */}
          {mobileMenuOpen && (
            <div
              data-lit-id="mobile-nav-backdrop"
              className="fixed inset-0 bg-black/50 z-[54]"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
        </>
      )}

      {/* Ingest Modal — never mounted on the demo (see onOpenIngest above). */}
      {!isDemoMode() && (
        <IngestModal
          open={ingestModalOpen}
          onClose={() => setIngestModalOpen(false)}
          apiFetch={apiFetch}
          sessionId={activeSessionId}
          sessionTitle={activeSessionTitle}
        />
      )}
    </div>
  );
}
