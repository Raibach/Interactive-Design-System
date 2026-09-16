import { API_BASE } from "@/shared/apiHelper";
import { fetchCatalogHealth, badgeState, badgeCount, sortByUrgency, type CatalogHealth } from "@/shared/catalogHealth";
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import * as Sentry from "@sentry/react";
import { motion, AnimatePresence } from 'motion/react';
import { getImageUrl, getImageAlt } from '@/components/lit/a2ui-image-catalog';
import gripperChatBarHorizontal from 'figma:asset/84b716f5030a9e09ce034d9d633efe23a4440f3d.png';
// import { TraceTree } from './TraceTree'; // replaced with live version data
// import { traceMessages } from './tabMessagesData';
import { groundingMetricsSample, groundingMetricsDrifting, buildMetricBars } from './tabMessagesData';
import type { GroundingMetrics, MetricBar } from './types';
import { ApprovalQueueItem, type ApprovalItem } from './ApprovalQueueItem';
// SidebarNavigation replaced by Lit A2UI <chat-navigation-bar> web component
import '@/components/lit/chat-navigation-bar';
import type { ChatNavigationBar, TabChangeEventDetail, CollapseToggleEventDetail, TabId } from '@/components/lit/chat-navigation-bar';
import { TraceFeed } from './TraceFeed';
import { neuralNetworkService } from '@/services/neuralNetworkService';
import { conversationStorage, type Conversation } from '@/services/conversationStorage';
import { eventBus } from '@/shared/event-bus';
import { asPlainText } from '@/shared/plainText';
import { catalogBrief } from '@/shared/catalogBrief';
import { useChatSeat, setChatSeatConversation, setChatSeatPersister } from '@/shared/chatSeat';
import { isAtBottom, isFollowingNewest, appendTarget, messageTop } from '@/shared/chatScroll';
import { parseFillFieldAction } from '@/shared/actionLink';
import { getAuthState } from '@/services/authService';

// Sample approval queue items
const approvalQueueItems: ApprovalItem[] = [
  { id: 'appr-001', promptName: 'Customer Onboarding Automation', version: '3.2', submittedBy: 'Sarah Chen', submittedAt: '2 hours ago', priority: 'high', riskLevel: 'medium', category: 'Sales', estimatedCost: '$0.15/exec', status: 'pending', description: 'Automated onboarding sequence with personalized welcome messages and product recommendations based on customer segment.' },
  { id: 'appr-002', promptName: 'Contract Risk Analysis', version: '2.1', submittedBy: 'Marcus Rodriguez', submittedAt: '4 hours ago', priority: 'high', riskLevel: 'high', category: 'Legal', estimatedCost: '$0.42/exec', status: 'flagged', description: 'AI-powered contract review that identifies potential risks, missing clauses, and suggests modifications for compliance.' },
  { id: 'appr-003', promptName: 'Product FAQ Generator', version: '1.8', submittedBy: 'Emily Watson', submittedAt: '5 hours ago', priority: 'medium', riskLevel: 'low', category: 'Support', estimatedCost: '$0.08/exec', status: 'pending', description: 'Generates comprehensive FAQ entries from product documentation and customer support tickets.' },
  { id: 'appr-004', promptName: 'Code Review Assistant', version: '4.0', submittedBy: 'Dev Team', submittedAt: '7 hours ago', priority: 'medium', riskLevel: 'low', category: 'Engineering', estimatedCost: '$0.22/exec', status: 'in-review', description: 'Reviews pull requests for security vulnerabilities, code quality issues, and suggests improvements with examples.' },
  { id: 'appr-005', promptName: 'Competitive Intelligence Report', version: '2.5', submittedBy: 'John Park', submittedAt: '1 day ago', priority: 'low', riskLevel: 'medium', category: 'Strategy', estimatedCost: '$0.65/exec', status: 'pending', description: 'Analyzes competitor websites, product announcements, and market positioning to generate strategic insights.' },
  { id: 'appr-006', promptName: 'Email Campaign Optimizer', version: '1.3', submittedBy: 'Marketing Ops', submittedAt: '1 day ago', priority: 'medium', riskLevel: 'low', category: 'Marketing', estimatedCost: '$0.12/exec', status: 'pending', description: 'Optimizes email subject lines, body copy, and CTAs based on historical performance data and A/B test results.' },
  { id: 'appr-007', promptName: 'Financial Forecasting Model', version: '3.1', submittedBy: 'Finance Team', submittedAt: '2 days ago', priority: 'high', riskLevel: 'high', category: 'Finance', estimatedCost: '$0.88/exec', status: 'flagged', description: 'Generates quarterly revenue forecasts using historical data, market trends, and economic indicators.' },
  { id: 'appr-008', promptName: 'Customer Sentiment Analysis', version: '2.0', submittedBy: 'CX Team', submittedAt: '2 days ago', priority: 'low', riskLevel: 'low', category: 'Support', estimatedCost: '$0.06/exec', status: 'pending', description: 'Analyzes customer feedback from surveys, reviews, and support tickets to identify trends and actionable insights.' },
  { id: 'appr-009', promptName: 'Product Naming Assistant', version: '1.0', submittedBy: 'Product Team', submittedAt: '3 days ago', priority: 'low', riskLevel: 'low', category: 'Product', estimatedCost: '$0.18/exec', status: 'in-review', description: 'Generates creative product names with trademark availability checks and brand alignment scoring.' },
  { id: 'appr-010', promptName: 'Incident Response Guide', version: '2.3', submittedBy: 'Security Team', submittedAt: '3 days ago', priority: 'high', riskLevel: 'medium', category: 'Security', estimatedCost: '$0.34/exec', status: 'pending', description: 'Provides step-by-step incident response guidance based on threat type, severity, and organizational protocols.' },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SessionVersion {
  id: string;
  version_number: number;
  change_description: string;
  change_type: string;
  created_at: string;
  overall_score?: number | null;
  left_column_content?: string;
  source?: 'postgres' | 'milvus';
}

interface PostgresVersionResponse {
  versions?: SessionVersion[];
}

interface MilvusVersionRecord {
  id: string | number;
  version_number: number;
  saved_at?: string;
  content_full?: string;
  content?: string;
}

interface MilvusVersionsResponse {
  status?: string;
  versions?: MilvusVersionRecord[];
}

interface InteractiveChatInterfaceProps {
  onConversationChange?: (conversationId: string | null) => void;
  /** Active prompt session (package) ID — conversations are package-owned and scoped to this */
  sessionId?: string | null;
  /** Latest output from the Run pipeline — assistant auto-analyzes on change */
  compiledOutput?: string;
  /** Whether a Run is currently streaming */
  isRunning?: boolean;
  /** Live left-column sections (includes unsaved edits) — reads the Lit editor ref */
  getLeftColumnSections?: () => any[];
  /** Persisted left-column content (JSON `{ sections: [...] }`) — fallback when the editor isn't mounted */
  leftColumnContent?: string;
  /**
   * When the host owns the column width, it also owns "collapsed". The console
   * column's width lives in WritingAreaIndex, so without this the nav bar's own
   * collapsed flag drifts out of sync with the real column — and the bar's click
   * logic ("already collapsed → expand") takes the wrong branch, so clicking the
   * Chat tab collapses instead of opening.
   */
  columnCollapsed?: boolean;
  /** Fired when the operator clicks the nav bar to bring the column back. */
  onColumnExpand?: () => void;
  /**
   * Fired when the operator clicks the already-active tab to put the column
   * away. Without this the bar's collapse toggle is a no-op: `columnCollapsed`
   * takes precedence over the internal state, so only the host can narrow it.
   */
  onColumnCollapse?: () => void;
  /**
   * Findings from the catalog check, as Grace assembled them into the data model.
   * They render INSIDE her seat: the list is about the packages in the console
   * grid, so it belongs to the conversation, not to the grid.
   */
  catalogFindings?: Array<{
    id: string;
    check?: string;
    component?: string | null;
    nodeId?: string | null;
    file?: string | null;
    what?: string;
    /** Severity and owner, as the checker resolved them — carried so the closed
     *  header can say the shape of the problem (N blocking, N pipeline). */
    level?: string;
    owner?: string;
    stage?: string;
  }> | null;
  /**
   * Components ON SCREEN RIGHT NOW that carry an open annotation finding.
   *
   * Set by the host, which is the only place that can see both halves: the catalog
   * check and the components the surface actually contains. Non-empty means
   * something was generated without its metadata, and that gets a red alert — the
   * person who answers for the catalogue sees it on arrival, not in an audit later.
   */
  unannotatedInUse?: string[];
  /**
   * Where each finding's repair stands, by finding id — 'repair' from the click until
   * a fresh check stops deriving it, 'done' after that. Absent means nothing has been
   * done about it, and that is the only state that offers the Repair button: a finding
   * already queued or already settled is not something to queue twice.
   *
   * The stages are the host's, not this component's. It cannot know whether a finding
   * is fixed — only the check that raised it can (shared/catalogHealth.ts).
   */
  repairStages?: Record<string, 'repair' | 'done'>;
  /** Fired when a finding's call to action is clicked. The host opens a composer. */
  onRepairFinding?: (findingId: string) => void;
  /**
   * The console's prompt packages — the index on the left.
   *
   * She could already ACT on the console (filter it, sort it) but could not SEE
   * it, so "check the index of cards" / "find me a prompt about X" had no answer
   * and she said so — correctly, and uselessly. These are the same objects the
   * grid is built from.
   */
  consoleCards?: Array<Record<string, any>> | null;
}

export function InteractiveChatInterface({ onConversationChange, sessionId, compiledOutput, isRunning, getLeftColumnSections, leftColumnContent, columnCollapsed, onColumnExpand, onColumnCollapse, catalogFindings, unannotatedInUse, repairStages, onRepairFinding, consoleCards }: InteractiveChatInterfaceProps = {}) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [inputHeight, setInputHeight] = useState(180);
  const [isDragging, setIsDragging] = useState(false);
  const [isRightColumnCollapsed, setIsRightColumnCollapsed] = useState(false);
  // The host's flag wins when the host owns the column width (the console
  // column lives in WritingAreaIndex). Otherwise fall back to local state.
  const isColumnCollapsed = columnCollapsed ?? isRightColumnCollapsed;
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const [chatInput, setChatInput] = useState('');
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  /** The view is touching the bottom, so growth keeps it pinned there. */
  const isAtBottomRef = useRef(true);
  /**
   * The newest message is still in front of the person, so an arriving message
   * may move the view. Distinct from the flag above, and that distinction is the
   * bug fix: the app's own read-from-the-start scroll leaves the view above the
   * bottom, and reading that as "the person scrolled away" is what stopped every
   * later reply from ever being scrolled into view (shared/chatScroll.ts).
   */
  const followingNewestRef = useRef(true);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // ONE conversation, held ABOVE this component — see shared/chatSeat.ts.
  //
  // It was `useState` here, and this component is mounted twice: the console's resizable
  // pane and the composer's `workspace-layout` right slot. So a message posted into one
  // instance died when a tab switch unmounted it — measured, on a repair ask that the log
  // said had been posted and the DOM did not contain. The seat is persistent now, and a
  // layout swap cannot take her voice with it.
  const [chatMessages, setChatMessages] = useChatSeat<ChatMessage>();

  // ── THE SEAT IS TOLD WHICH CONVERSATION BELONGS TO THIS PACKAGE ────────────────
  // `conversations.session_id` is NOT NULL: the conversation belongs to the prompt
  // package, and its messages cascade from it. So the package on screen names the
  // conversation her history is written to, and a reload of that package brings it back.
  useEffect(() => {
    setChatSeatConversation(currentConversationId || null);
  }, [currentConversationId]);

  // …and how to write one down. Messages that arrive through the seat — every surface
  // greeting she writes, and the repair guidance — were previously held in React state and
  // never persisted, so the database kept only the typed exchange and lost everything she
  // had said about the work. The two paths that already persist themselves (the person's
  // turn, her LLM reply) are NOT routed through here, so nothing is written twice.
  useEffect(() => {
    setChatSeatPersister((conversationId, content) => {
      void conversationStorage
        .addMessage(conversationId, 'response', content)
        .catch((err) => console.error('[Chat] the seat could not write her message down:', err));
    });
    return () => setChatSeatPersister(null);
  }, []);
  const [isSending, setIsSending] = useState(false);
  const [showConvDropdown, setShowConvDropdown] = useState(false);
  const handleSendRef = useRef<(overrideText?: string, opts?: { silent?: boolean }) => void>(() => {});
  // ── Request deduplication: prevent conversation fetch storms ──
  const isConversationsLoadingRef = useRef(false);
  const conversationsLoadedRef = useRef(false); // Track if we've loaded at least once
  // ── Prevent infinite loop: track last reported conversation ID + throttle ──
  const lastReportedConvIdRef = useRef<string | null>(null);
  const convChangeThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ── Live values for the once-bound listeners below. They bind with an empty
  //    dep list, so reading state directly inside them captures first-render
  //    values — which is how a handler ends up acting on the wrong conversation.
  const currentConversationIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  /** The newest message's offset from the top of the scrollable content. */
  const newestMessageTop = (container: HTMLDivElement): number | null => {
    const idx = chatMessages.length - 1;
    if (idx < 0) return null;
    const el = container.querySelector<HTMLElement>(`[data-msg-idx="${idx}"]`);
    return el ? messageTop(container, el) : null;
  };

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    // Two questions that only looked like one. "At the bottom" decides whether
    // GROWTH keeps the view pinned (a panel resizing, a surface expanding).
    // "Following the newest message" decides whether an ARRIVING message may move
    // it — and a reply too tall for the viewport is never at the bottom while it
    // is being read from its first line. Only the person leaving the newest
    // message behind turns following off.
    // At the bottom the second question answers itself — the newest message's
    // start is always above the fold when the view is at the end of the thread —
    // so the element is measured only when that is actually in doubt. A scroll
    // event fires per frame; one forced layout read per frame is not free.
    isAtBottomRef.current = isAtBottom(container);
    followingNewestRef.current = isAtBottomRef.current
      || isFollowingNewest(container, newestMessageTop(container));
  };

  // ── Auto-analyze output when Run completes ────────────────────────
  const prevRunningRef = useRef(isRunning);
  useEffect(() => {
    // Detect transition: was running → now stopped, and output exists
    if (prevRunningRef.current && !isRunning && compiledOutput?.trim()) {
      // Auto-send an analysis prompt to the assistant
      const analysisPrompt = `The user just ran a prompt and got this output. Analyze it and give feedback — what's good, what could be improved, any issues:

${compiledOutput.slice(0, 3000)}`;
      handleSendRef.current(analysisPrompt);
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, compiledOutput]);

  // ── Notify parent of conversation changes (with loop prevention + throttle) ──
  useEffect(() => {
    // Only notify if the conversation ID actually changed
    if (currentConversationId !== lastReportedConvIdRef.current) {
      // Clear any pending throttled call
      if (convChangeThrottleRef.current) {
        clearTimeout(convChangeThrottleRef.current);
      }
      // Throttle: wait 100ms before notifying parent (debounce rapid changes)
      convChangeThrottleRef.current = setTimeout(() => {
        lastReportedConvIdRef.current = currentConversationId;
        onConversationChange?.(currentConversationId);
      }, 100);
    }
    // Cleanup on unmount
    return () => {
      if (convChangeThrottleRef.current) {
        clearTimeout(convChangeThrottleRef.current);
      }
    };
    // Note: intentionally omitting onConversationChange from deps to prevent
    // infinite loops when parent creates a new callback reference on each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);

/**
 * THE PROMPT THAT WAKES HER when the chat is opened.
 *
 * It is a real turn sent to the model, not a canned line. The panel shows her
 * thinking and then shows her answer — whatever she actually says.
 *
 * This REVERSES a rule that used to live here: "NO STARTUP GREETING (owner
 * directive: no welcome messages). The AI speaks only when the user initiates.
 * No automatic LLM calls on mount." The result was a person clicking the chat
 * and finding an empty panel with nothing happening, which reads as broken, not
 * as restrained.
 */
// REWRITTEN 2026-09-15, from her reply to the old sentence. It read:
//   "[WAKE] The person just opened this package's conversation. Greet them in your own
//    voice — brief, warm, aware of the hour. Do not explain yourself, and do not ask a
//    list of questions."
// Three things in it produced the greeting she gave, which was not a greeting:
//   · "The person", third person, inside a turn the model reads as its own interlocutor,
//     so it wrote ABOUT the situation instead of greeting someone in it;
//   · two PROHIBITIONS. `grace_gui.py:647` records the measurement on this model:
//     it answers what is in front of it, and forbidding a word is still saying the word.
//     "Do not explain yourself" produced "It's Grace, your personal prompt engineer.
//     I'm here to help you build prompts for AI models.";
//   · "[WAKE]" is a machine token, and a silent turn is still a persisted message — so
//     the package's own history opened with a stage direction the person never wrote.
// The hour is interpolated below: "aware of the hour" asked her to know something the
// app already knew, and she filled that hole the way she filled the missing name —
// with a placeholder, "[User's Name]".
const wakePrompt = (): string => {
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return (
    `The package has just been opened and there is someone at the desk, waiting on you. It is ${partOfDay}. ` +
    'Say hello the way you would to a colleague who just walked in — one or two sentences, ' +
    'in your own voice: the hour, and the work the two of you have in front of you here.'
  );
};

  const scrollToLatest = () => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'auto' });
    isAtBottomRef.current = true;
    // Asking for the latest is also the person re-engaging with the conversation,
    // so what arrives next is shown rather than held.
    followingNewestRef.current = true;
  };

  // ResizeObserver: auto-scroll during streaming, freezes on manual scroll-up
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── NO AUTO-LOAD (owner directive): conversations load COLLAPSED.
  // The user picks one from the dropdown — nothing opens automatically.
  const [selectedNav, setSelectedNav] = useState('chat');

  // ══════════════════════════════════════════════════════════════════════════
  // WAKE — opening the chat is the turn.
  //
  // Clicking the chat hands her ONE real prompt, the panel shows her thinking,
  // and what appears is her answer. Before this, the chat opened on dead air:
  // a person clicked and nothing happened.
  //
  // Fires ONCE per conversation, so reopening shows what she already said
  // rather than greeting again every time the tab is touched.
  // ══════════════════════════════════════════════════════════════════════════
  const wokeForRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedNav !== 'chat') return;
    if (!currentConversationId) return;
    if (chatMessages.length > 0 || isSending) return;
    if (wokeForRef.current === currentConversationId) return;
    wokeForRef.current = currentConversationId;
    handleSendRef.current(wakePrompt(), { silent: true });
  }, [selectedNav, currentConversationId, chatMessages.length, isSending]);

  const [showApprovalQueue, setShowApprovalQueue] = useState(false);
  const [currentGroundingMetrics, setCurrentGroundingMetrics] = useState<GroundingMetrics>(groundingMetricsSample);
  const metricBars = useMemo<MetricBar[]>(() => buildMetricBars(currentGroundingMetrics), [currentGroundingMetrics]);
  const [traceHistoryCollapsed, setTraceHistoryCollapsed] = useState(true);

  // ── Catalog findings: open the list, or keep it out of the way ────────────
  // The catalog is red with 40-plus findings, and the list sits ABOVE the
  // conversation in the same scroll, so leaving it open makes the report taller
  // than the column and pushes her replies out of the viewport. Collapsed is the
  // default; the header carries the counts, so the shape of the problem is still
  // readable with the list closed. It is a state in here, not a stored
  // preference: nothing about it is worth remembering between sessions, and a
  // preference that outlives its reason is one more thing that lies.
  const [findingsCollapsed, setFindingsCollapsed] = useState(true);
  // ── Catalog check — the console reports the catalog's condition on arrival ──
  // Alert, don't block: nothing here stops the app. It tells the truth on load
  // so a design user can see what is wrong and go correct it in Figma.
  const [catalogHealth, setCatalogHealth] = useState<CatalogHealth>({ state: 'loading' });

  // The findings the drop-down shows. Grace's surface is the first source; when she
  // has not assembled one (provider down, or no Figma), the shell falls back to the
  // report it can fetch itself — the findings are machine data, not her opinion, and
  // must not disappear because the model or Figma is unavailable.
  const effectiveFindings = useMemo(() => {
    if (catalogFindings && catalogFindings.length > 0) return catalogFindings;
    if (catalogHealth.state === 'ok') {
      return catalogHealth.report.findings.filter((f) => f.level !== 'pass');
    }
    return [];
  }, [catalogFindings, catalogHealth]);

  const findingCounts = useMemo(() => {
    const count = (pred: (f: { level?: string; owner?: string }) => boolean) =>
      effectiveFindings.filter(pred).length;
    return {
      blocking: count((f) => f.level === 'blocking'),
      pipeline: count((f) => f.owner === 'pipeline'),
      designer: count((f) => f.owner === 'designer'),
    };
  }, [effectiveFindings]);

  // ── The order the report is read in: most urgent first ────────────────────
  // The check reports in the order its checks ran, which is a fact about the
  // checker. On 2026-09-14 that put the single blocking finding at item 43 of 43,
  // below forty-two advisories, in a list that is closed by default — so the one
  // item that blocks the pipeline was the last row of a report nobody opens, and
  // nothing in the markup said which row it was. Order is urgency (the same
  // comparator her brief sorts with, shared/catalogHealth.ts), and the standing
  // header names the blocking finding, so "which one is blocking" is answerable
  // with the list closed.
  const orderedFindings = useMemo(() => sortByUrgency(effectiveFindings), [effectiveFindings]);
  const mostUrgent = useMemo(
    () => orderedFindings.find((f) => f.level === 'blocking') || null,
    [orderedFindings],
  );

  // ── ROLE-BASED ACCESS: fetch user's departmental role + capability set ──
  // Drives which tabs are visible in <chat-navigation-bar> and which
  // governance views are accessible. Falls back to 'basic' on error.
  // See frontend/src/shared/role-caps.ts for the persona matrix.
  const [allowedTabs, setAllowedTabs] = useState<string>('chat,trace,tools');
  const [userRole, setUserRole] = useState<string>('basic');
  const [roleCaps, setRoleCaps] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { userId } = getAuthState();
        const res = await fetch(`${API_BASE}/ai/role-capabilities`, {
          headers: { 'X-User-ID': userId || '' },
        });
        if (res.ok) {
          const data = await res.json();
          const caps = data.capabilities || {};
          setUserRole(data.role || 'basic');
          setRoleCaps(caps);
          const tabs = caps.tabs || ['chat'];
          setAllowedTabs(tabs.join(','));
          // If the current tab isn't in the allowed list, snap to 'chat'
          if (!tabs.includes(selectedNav)) {
            setSelectedNav('chat');
          }
        }
      } catch (e) {
        // Fall back to dev defaults — don't block rendering
        console.warn('[RoleCaps] Could not fetch role, using dev defaults', e);
      }
    };
    fetchRole();
  }, []);

  // ── Ref to the Lit <chat-navigation-bar> element ──────────────────────
  const navBarRef = useRef<ChatNavigationBar | null>(null);

  /**
   * Hand the conversation we are in back to the list before we leave it.
   *
   * Selecting New Chat used to just CLEAR the panel: the conversation was never
   * written back, so the default conversation could not be reopened — it stayed
   * reachable only until you looked away. This saves it first, under a real name
   * derived from what was actually asked, then refreshes the list so the
   * conversation we just left is sitting there to reopen.
   */
  const endCurrentConversation = async () => {
    const id = currentConversationIdRef.current;
    if (id) {
      // autosaveConversation renames only a conversation still carrying a
      // default title; one the user has already named is left exactly as it is.
      await conversationStorage.autosaveConversation(id).catch((err) => {
        console.error('[Chat] Could not save the conversation before leaving it:', err);
      });
    }

    const sid = sessionIdRef.current;
    if (!sid || isConversationsLoadingRef.current) return;

    isConversationsLoadingRef.current = true;
    try {
      const all = await conversationStorage.getSessionConversations(sid);
      setConversations((all || []).filter(Boolean).sort((a: Conversation, b: Conversation) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ));
      conversationsLoadedRef.current = true;
    } catch (error) {
      console.error('[Chat] Could not refresh conversations after ending one:', error);
    } finally {
      isConversationsLoadingRef.current = false;
    }
  };

  /**
   * New Chat — start a fresh conversation in this window. Whatever we are
   * leaving is saved first, so starting a new chat never costs you the one you
   * were in. (This event had no listener at all: the button dispatched it and
   * nothing answered.)
   */
  useEffect(() => {
    const handler = async () => {
      await endCurrentConversation();
      setChatMessages([]);
      setCurrentConversationId(null);
      setChatInput('');
    };
    window.addEventListener('new-chat', handler);
    return () => window.removeEventListener('new-chat', handler);
    // endCurrentConversation reads refs only, so the first-render closure is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for collapse-chat event — save closes into list item ──
  useEffect(() => {
    const handler = async () => {
      // SAVE FIRST. This handler's own comment said "save closes into list item",
      // but it only ever reloaded the list — the conversation being closed was
      // never written back, so it dropped out of reach instead of into the list.
      await endCurrentConversation();
      // Collapse: clear messages and reset conversation
      setChatMessages([]);
      setCurrentConversationId(null);
    };
    window.addEventListener('collapse-chat', handler);
    return () => window.removeEventListener('collapse-chat', handler);
  }, []);
  useEffect(() => {
    const handler = (e: Event) => {
      const { emptySections, sectionList } = (e as CustomEvent).detail;
      const sectionNames: string[] = emptySections || [];
      // Build message with remove buttons
      const buttonLines = sectionNames.map((s: string) => `[Remove "${s}"](action:remove_role:${encodeURIComponent(s)})`).join('  ');
      const msg = `**Run blocked.** ${sectionNames.length > 1 ? 'These sections are' : 'This section is'} empty: ${sectionList}.\n\nFill ${sectionNames.length > 1 ? 'them' : 'it'} in, or click below to remove:\n\n${buttonLines}\n\nReply with "remove [section name]" or click a button.`;
      setChatMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    };
    window.addEventListener('run-blocked', handler);
    return () => window.removeEventListener('run-blocked', handler);
  }, []);

  // ── System messages (save errors, etc.) routed to chat instead of toasts ──
  // NOT listened for HERE any more. The seat owns this listener (shared/chatSeat.ts) so
  // that it is installed exactly once — two instances would each append the same message —
  // and so that it keeps HEARING while no seat is mounted. That second part is the repair
  // case: the ask is posted while one view is on screen, and it has to still be there when
  // the other replaces it.

  // ── A write into the prompt that landed nowhere ───────────────────────────
  // `<prompt-section-editor>` names a seat on every write, and a name it cannot
  // resolve used to be dropped in silence: the column did not change and nothing said
  // why, which reads as a surface that ignores you. It dispatches `section-write-failed`
  // instead, and this is where that becomes a sentence — with the seats the column DOES
  // have, so the next attempt can name one that exists.
  useEffect(() => {
    const handler = (e: Event) => {
      const { target, why, names } = (e as CustomEvent).detail || {};
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content:
          `Nothing written — no section "${target || 'that section'}" (${why}). ` +
          `Sections here: ${(names || []).join(', ') || 'none'}.`,
      }]);
    };
    window.addEventListener('section-write-failed', handler);
    return () => window.removeEventListener('section-write-failed', handler);
  }, []);

  /**
   * Her token usage, as she reports it — measured by the backend from the
   * provider's own usage report, never estimated.
   *
   * `last` is the most recent call. `total` is every call this session added
   * up — the tally. Each call is counted once, keyed on the backend's `call_id`,
   * so a surface that gets applied twice cannot inflate the number.
   */
  const [usage, setUsage] = useState<{
    last: {
      total_tokens?: number;
      prompt_tokens?: number;
      completion_tokens?: number;
      mode?: string;
      model?: string;
      provider?: string;
      call_id?: number;
    } | null;
    total: {
      total_tokens: number;
      prompt_tokens: number;
      completion_tokens: number;
      calls: number;
    };
  }>({
    last: null,
    total: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, calls: 0 },
  });

  useEffect(() => {
    sessionIdRef.current = sessionId ?? null;
  }, [sessionId]);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    // Which calls are already in the tally. A plain Set, not state — it is a
    // guard against double-counting, not render data.
    const counted = new Set<number>();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || typeof detail.total_tokens !== 'number') return;
      // Strictly scoped: this call's spend belongs to the conversation it came
      // from, so it cannot be pulled into another one. The contract binds a chat
      // panel to its own conversationId — a number from a different session is
      // not this session's number. An unscoped panel still takes what arrives.
      if (sessionIdRef.current && detail.sessionId !== sessionIdRef.current) return;
      if (typeof detail.call_id === 'number') {
        if (counted.has(detail.call_id)) return; // already counted
        counted.add(detail.call_id);
      }
      setUsage(prev => ({
        last: detail,
        total: {
          total_tokens: prev.total.total_tokens + (detail.total_tokens || 0),
          prompt_tokens: prev.total.prompt_tokens + (detail.prompt_tokens || 0),
          completion_tokens: prev.total.completion_tokens + (detail.completion_tokens || 0),
          calls: prev.total.calls + 1,
        },
      }));
    };
    window.addEventListener('a2ui:usage', handler);
    return () => window.removeEventListener('a2ui:usage', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const apply = (health: CatalogHealth) => {
      if (cancelled) return;
      setCatalogHealth(health);
      // The shell no longer writes the report. The LIST is Grace's — she
      // assembles the surface and says her piece via `ai_message` →
      // `a2ui:system-message`. What remains here is the indicator's count,
      // which is the only part of this the shell should own.
    };

    const poll = () => { fetchCatalogHealth().then(apply); };

    poll();
    // Live: poll, and re-check the moment the operator comes back to the window.
    const id = setInterval(poll, 30_000);
    window.addEventListener('focus', poll);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', poll);
    };
  }, []);

  // ── The red alert: components generated without their annotation ──────────
  // Held as a dismissal keyed on WHICH alert was dismissed, not as a boolean. A
  // boolean would silence the next one too, and the next one is a different
  // incident — the whole point is that nobody gets to stop being told.
  const alertKey = (unannotatedInUse || []).join(',');
  const [dismissedAlert, setDismissedAlert] = useState<string>('');

  /**
   * The banner's own two affordances.
   *
   * Both events bubble and compose off the element, so a window listener hears
   * them across the shadow boundary — the same route `a2ui-event` takes out of the
   * renderer. Dismiss hides THIS alert; Retry re-runs the catalog check the alert
   * is derived from, because the likeliest reason it is still up is that the
   * designer has just annotated the variant and nothing has re-read the catalog.
   */
  useEffect(() => {
    const onDismiss = () => setDismissedAlert(alertKey);
    const onRetry = () => { fetchCatalogHealth().then(setCatalogHealth); };
    window.addEventListener('error-dismiss', onDismiss);
    window.addEventListener('error-retry', onRetry);
    return () => {
      window.removeEventListener('error-dismiss', onDismiss);
      window.removeEventListener('error-retry', onRetry);
    };
  }, [alertKey]);

  // ── Edit activity log (circular buffer of last 10 actions) ──────────
  const editLogRef = useRef<Array<{ts: number; action: string; section: string; preview: string}>>([]);
  const trackEdit = (action: string, section: string, preview: string) => {
    editLogRef.current.push({ts: Date.now(), action, section, preview: preview.slice(0, 80)});
    if (editLogRef.current.length > 10) editLogRef.current.shift();
  };

  // Listen for textarea edits on the left column
  useEffect(() => {
    const handleInput = (e: Event) => {
      const ta = e.target as HTMLTextAreaElement;
      const section = ta.getAttribute('placeholder') || ta.getAttribute('aria-label') || ta.closest('[data-section-name]')?.getAttribute('data-section-name') || 'prompt';
      trackEdit('edited', section, ta.value.slice(-50));
    };
    const textareas = document.querySelectorAll('[data-section-container] textarea, [data-section-name] textarea');
    textareas.forEach(ta => ta.addEventListener('input', handleInput));
    return () => { textareas.forEach(ta => ta.removeEventListener('input', handleInput)); };
  }, []);

  const [selectedVersionEntry, setSelectedVersionEntry] = useState<{ id: string; version_number: number; change_description: string; created_at: string; overall_score?: number | null; left_column_content?: string } | null>(null);

  // Real data scoped to the current prompt session
  const [sessionVersions, setSessionVersions] = useState<SessionVersion[]>([]);
  const [promptVariables, setPromptVariables] = useState<Array<{ name: string; section: string; value: string }>>([]);
  const [promptTools, setPromptTools] = useState<Array<{ name: string; content: string }>>([]);

  // Scan left column for {variable} tokens and tool section content
  const scanPromptContent = () => {
    const sections = document.querySelectorAll('[data-section-name]');
    const vars: Array<{ name: string; section: string; value: string }> = [];
    const tools: Array<{ name: string; content: string }> = [];
    const seen = new Set<string>();

    sections.forEach(el => {
      const sectionName = el.getAttribute('data-section-name') || '';
      const content = (el as HTMLElement).textContent || (el as HTMLTextAreaElement).value || '';
      // Extract {token} and {{token}} variable patterns
      const matches = content.matchAll(/\{+([a-zA-Z_][a-zA-Z0-9_ ]*)\}+/g);
      for (const m of matches) {
        const name = m[1].trim();
        if (!seen.has(name)) {
          seen.add(name);
          vars.push({ name, section: sectionName, value: '' });
        }
      }
      // Tool Call section → extract tool definitions
      if (sectionName.toLowerCase().includes('tool')) {
        const toolNameMatch = content.match(/Tool Name:\s*(.+)/i);
        if (toolNameMatch) {
          tools.push({ name: toolNameMatch[1].trim(), content });
        }
      }
    });

    setPromptVariables(vars);
    setPromptTools(tools);
  };

  // Load version history from PostgreSQL + Milvus
  const loadSessionVersions = () => {
    
    // PostgreSQL versions
    if (sessionId) {
      fetch(`${API_BASE}/prompt-sessions/${sessionId}/versions`)
        .then(r => r.json())
        .then((d: PostgresVersionResponse) => {
          const pgVersions: SessionVersion[] = (d.versions || []).map((v) => ({
            ...v,
            source: 'postgres',
          }));
          setSessionVersions(prev => {
            const milvusOnly = prev.filter((v) => v.source === 'milvus');
            return [...pgVersions, ...milvusOnly];
          });
        })
        .catch((error) => {
          console.error('Failed to load PostgreSQL session versions:', error);
        });
    }
    
    // Milvus versions
    fetch('/api/milvus/versions')
      .then(r => r.json())
      .then((d: MilvusVersionsResponse) => {
        if (d.status === 'ok' && d.versions) {
          const mvVersions: SessionVersion[] = d.versions.map((v) => ({
            id: `mv-${v.id}`,
            version_number: v.version_number,
            change_description: `Milvus snapshot — ${v.saved_at ? new Date(v.saved_at).toLocaleString() : 'unknown'}`,
            change_type: 'milvus-snapshot',
            created_at: v.saved_at,
            overall_score: null,
            left_column_content: v.content_full || v.content,
            source: 'milvus',
          }));
          setSessionVersions(prev => {
            const pgOnly = prev.filter((v) => v.source !== 'milvus');
            return [...pgOnly, ...mvVersions];
          });
        }
      })
      .catch((error) => {
        console.error('Failed to load Milvus versions:', error);
      });
  };

  // Listen for version-selected events from VersionManager or ScoreDropdown
  useEffect(() => {
    const handler = (e: Event) => {
      const version = (e as CustomEvent).detail;
      if (!version) return;
      setSelectedVersionEntry(version);
      setSelectedNav('trace');
    };
    window.addEventListener('version-selected', handler);
    return () => window.removeEventListener('version-selected', handler);
  }, []);

  // Scan prompt content and load versions when a tab is opened
  useEffect(() => {
    if (selectedNav === 'variables' || selectedNav === 'tools') {
      scanPromptContent();
    }
    if (selectedNav === 'trace') {
      loadSessionVersions();
    }
  }, [selectedNav]);

  // Listen for figma-component-selected — pre-fill chat input with component prompt
  useEffect(() => {
    const handler = (e: Event) => {
      const { prompt } = (e as CustomEvent).detail || {};
      if (prompt) setChatInput(prompt);
    };
    window.addEventListener('figma-component-selected', handler);
    return () => window.removeEventListener('figma-component-selected', handler);
  }, []);

  // Load the package's conversations — PACKAGE-SCOPED (conversations belong to
  // the open prompt_session). No session = no conversations (console view).
  // Loads COLLAPSED: list only, nothing auto-opens.
  useEffect(() => {
    // ✅ DEDUP: Skip if already loading
    if (isConversationsLoadingRef.current) {
      console.log('[Chat] Skipping duplicate conversation fetch');
      return;
    }

    if (!sessionId) {
      setConversations([]);
      conversationsLoadedRef.current = true;
      return;
    }

    isConversationsLoadingRef.current = true;

    conversationStorage.getSessionConversations(sessionId).then(all => {
      const filtered = (all || []).filter(Boolean);
      setConversations(filtered.sort((a: Conversation, b: Conversation) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ));
      conversationsLoadedRef.current = true;
    }).catch((error) => {
      console.error('Failed to load package conversations:', error);
    }).finally(() => {
      isConversationsLoadingRef.current = false;
    });
  }, [sessionId]);

  /**
   * The chat column IS a conversation.
   *
   * Everything in this column hangs off one conversation id: the messages, the
   * trace, the tab's buttons, the spend. With no id every persistence path below
   * is a silent no-op — the question is not stored, the reply is not stored, the
   * title cannot be read — so the column looks dead even though it renders.
   *
   * On mount we therefore take the package's most recent conversation, or open
   * one if the package has none, and bind to it. This ADOPTS an id; it does not
   * auto-open history. What the user reads is still governed by the dropdown —
   * the column simply gains the id it cannot work without.
   */
  useEffect(() => {
    if (!sessionId || currentConversationId) return;
    let cancelled = false;

    (async () => {
      try {
        const all = await conversationStorage.getSessionConversations(sessionId);
        if (cancelled) return;

        const list = (all || [])
          .filter((c) => c?.id)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        if (list.length > 0) {
          setCurrentConversationId(list[0].id);
          return;
        }

        // The package has no conversation yet — open one, so the column has an id.
        const project = await conversationStorage.getUnassignedProject();
        const created = await conversationStorage.createConversation(
          project?.id || '', 'New Conversation', 'grace', 'general', sessionId,
        );
        if (!cancelled && created?.id) setCurrentConversationId(created.id);
      } catch (error) {
        console.error(
          `[Chat] NO CONVERSATION ID FOR THIS COLUMN\n` +
          `  sessionId: ${sessionId}\n` +
          `  error: ${error instanceof Error ? error.message : String(error)}\n` +
          `  timestamp: ${new Date().toISOString()}\n` +
          `  CAUSE: this package's conversations could not be read, and one could not be opened.\n` +
          `  EFFECT: nothing in this column persists — messages, trace and spend all hang off the id.\n` +
          `  FIX: check GET/POST /api/conversations, and that the id matches a prompt_sessions row.`
        );
      }
    })();

    return () => { cancelled = true; };
  }, [sessionId, currentConversationId]);

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
      await fetch('/api/conversations/' + convId, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c?.id !== convId));
      if (currentConversationId === convId) {
        setCurrentConversationId(null);
        setChatMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleLoadConversation = async (conv: Conversation) => {
    if (!conv?.id) return;
    setCurrentConversationId(conv.id);
    setShowConvDropdown(false);
    try {
      const found = await conversationStorage.getConversation(conv.id);
      if (found?.messages) {
        setChatMessages(found.messages.map((m) => ({
          role: m.type === 'question' ? 'user' : 'assistant',
          content: m.content
        })));
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  // ── Multi-column context awareness ──────────────────────────────────
  // Reads the authoritative workspace state from props, NOT from DOM scraping.
  // The left column lives inside <prompt-section-editor>'s shadow DOM, so
  // querySelectorAll() can't reach its textareas — which is why Grace reported
  // an empty workspace. Prefer the live editor state (unsaved edits included),
  // fall back to the persisted leftColumnContent.
  const buildWorkspaceContext = (): string => {
    const parts: string[] = [];

    // Left column: live sections via the callback, else the persisted JSON.
    let sections: any[] = [];
    try {
      if (getLeftColumnSections) sections = getLeftColumnSections() || [];
      if (!sections.length && leftColumnContent) {
        const parsed = JSON.parse(leftColumnContent);
        sections = Array.isArray(parsed?.sections)
          ? parsed.sections
          : Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      sections = [];
    }

    const leftParts = sections
      .filter((s) => s && (s.name || s.section || s.role || s.type))
      .map((s) => {
        const name = s.name || s.section || s.role || s.type || 'Section';
        const content = String(s.content || '').trim();
        // THE SEAT NAME GETS ITS OWN LINE, and its body is indented under it.
        //
        // It used to be `${name}: ${content}`, one line, which FUSES the seat name with
        // the first line of the body. A repair's User seat begins with the bare field
        // label `Data:`, so the block rendered as "User Role: Data:" — and the model read
        // `Data:` as the VALUE of the User Role seat. Measured 2026-09-15, her own words:
        // "User Role: Data: This is where you provide the input data for the prompt."
        // The form's own label was invisible as a label. This shape cannot be misread.
        return content
          ? `### ${name}\n${content.split('\n').map((l) => `  ${l}`).join('\n')}`
          : `### ${name}\n  (empty)`;
      });

    if (leftParts.length > 0) {
      parts.push('=== PROMPT INPUT AREA (what the user is building) ===');
      parts.push(...leftParts);
    }

    // Middle column: compiled output from the Run pipeline (authoritative prop).
    if (compiledOutput && compiledOutput.trim()) {
      parts.push('');
      parts.push('=== OUTPUT PANEL ===');
      parts.push(compiledOutput.trim());
    }

    // Grounding & evaluation metrics — always available for AI discussion
    if (selectedNav === 'trace') {
      parts.push('');
      parts.push('=== EVALUATION METRICS (current session) ===');
      parts.push(`Groundedness: ${(currentGroundingMetrics.groundedness * 100).toFixed(0)}% — how well claims are anchored to sources`);
      parts.push(`Faithfulness: ${(currentGroundingMetrics.faithfulness * 100).toFixed(0)}% — whether claims can be inferred from retrieved context`);
      parts.push(`Hallucination Rate: ${(currentGroundingMetrics.hallucinationRate * 100).toFixed(0)}% — fraction of claims that are verifiably false`);
      parts.push(`Context Recall: ${(currentGroundingMetrics.contextRecall * 100).toFixed(0)}% — how much relevant source material was captured`);
      parts.push(`Context Precision: ${(currentGroundingMetrics.contextPrecision * 100).toFixed(0)}% — how much retrieved context was actually relevant`);
      if (currentGroundingMetrics.driftWarning) {
        parts.push('⚠️ DRIFT WARNING: Hallucination rate is elevated or groundedness is low. The model may be losing context accuracy.');
      }
    }

    // The console's prompt packages — the index she could not see.
    //
    // She could act on the console (filter, sort) but had no view of it, so
    // "check the index of cards" was unanswerable. One block per package: an id so
    // she can name one exactly, then the fields that identify it. The description
    // is truncated because the job here is recognition, not reading.
    if (consoleCards && consoleCards.length > 0) {
      parts.push('');
      parts.push(`=== CONSOLE — PROMPT LIBRARY (${consoleCards.length} packages) ===`);
      consoleCards.filter(Boolean).forEach((c: any, i: number) => {
        const facts = [
          c.category ? `category: ${c.category}` : null,
          (c.team_name || c.team) ? `team: ${c.team_name || c.team}` : null,
          (c.model_name || c.model) ? `model: ${c.model_name || c.model}` : null,
          c.status ? `status: ${c.status}` : null,
          typeof c.version === 'number' ? `v${c.version}` : null,
          c.message_count ? `${c.message_count} messages` : null,
          c.likes ? `${c.likes} likes` : null,
          c.lastUsed ? `last used ${String(c.lastUsed).slice(0, 10)}` : null,
        ].filter(Boolean);
        parts.push(`${i + 1}. "${c.title || '(untitled)'}"${facts.length ? ` — ${facts.join(', ')}` : ''}`);
        const desc = String(c.description || '').trim().replace(/\s+/g, ' ').slice(0, 120);
        parts.push(`   id: ${c.id || '(no id)'}${desc ? ` | ${desc}` : ''}`);
      });
    }

    // The catalog check's findings — the list drawn in her own seat, which her
    // prompt did not carry.
    //
    // Measured live: asked to name the blocking finding, she named
    // `provenance-missing:prompt-container`, which had been fixed earlier the same
    // day and is no longer derived, in a sentence that read like a fact. She was
    // not lying about the report; she had never been given it. The list is on
    // screen next to her words, so a person reasonably expects her to know it.
    // shared/catalogBrief.ts builds the block and carries the three things the list
    // itself cannot say (fixed means REMOVED, app marks are not the check's
    // verdict, and no report means no list).
    const brief = catalogBrief(catalogHealth, catalogFindings);
    if (brief.length) {
      parts.push('');
      parts.push(...brief);
    }

    return parts.join('\n');
  };

  // Send content to the left column via custom events
  const applyTextToLeftColumn = (content: string, targetPlaceholder?: string) => {
    window.dispatchEvent(new CustomEvent('set-left-column-text', {
      detail: { content, target: targetPlaceholder || '' }
    }));
  };

  // Clear all left column textareas via custom events that React listens for
  const clearLeftColumn = () => {
    window.dispatchEvent(new CustomEvent('clear-left-column'));
  };

  const handleSend = async (overrideText?: string, opts?: { silent?: boolean }) => {
    const text = (overrideText ?? chatInput).trim();
    if (!text || isSending) return;
    if (!overrideText) setChatInput('');
    // `silent` is the WAKE turn: she is handed a prompt by the app rather than by
    // the person, so it must not appear as if they typed it. The turn is still
    // real and still sent; only the bubble is withheld.
    if (!opts?.silent) {
      setChatMessages(prev => [...prev, { role: 'user', content: text }]);
    }
    // Persist user message to backend
    if (currentConversationId) {
      conversationStorage.addMessage(currentConversationId, 'question', text).catch(err => {
        console.error('[Chat] Failed to persist user message:', err);
      });
    }
    setIsSending(true);
    scrollToLatest();

    // Build full workspace context so the model knows all columns
    const workspaceContext = buildWorkspaceContext();

    // Hardcoded baseline identity — MUST be at the very top of the payload.
    //
    // Written as plain lines on purpose, and that is not cosmetic: this string was
    // written in markdown (# headings, a pipe table, **weight**), the model answered
    // in markdown, and the chat panel draws text (whitespace-pre-wrap, no parser) —
    // so people read the markers. The shape of the instructions is the shape of the
    // answer. The same was true of the button block below: asking for a "fallback
    // line" got one printed under a row of buttons that already said it.
    const systemInstructions = `You are Grace, the Agentic Flow Architect. You help users build multi-step agentic prompt pipelines. Each prompt entry field in the workspace represents a STEP in an agentic flow — they are not arbitrary text boxes. Your job is to map the user's ideas onto the correct steps in the flow.

HOW YOU WRITE TO A PERSON — they read every character you type:
1. Plain sentences. No headings and no number-sign characters, no asterisks or underscores for weight, no tables, no bullet stars, no backticks or code fences, no lines of dashes or equals signs.
2. Short. Say it the way you would say it out loud, then stop.
3. One sentence on which step you chose and where the content went.
4. When you had to decide something the user did not tell you, name the decision in one short sentence so they can change it: "I set the lock to 24 hours — tell me if that is wrong." Never label it, never explain how you know, never describe your reasoning. A value you did not get from the user is your own choice, and saying what you chose is the whole of it.
5. Never write out the choices of a button, and never ask the user to reply with a word. The buttons are the ask.

AGENTIC FLOW STEPS — choose from these seven; do not invent new ones:
1. System Role — <update_agent> — the AI's identity, expertise and behavioural rules.
2. User Role — <update_user> — the user's request, task or query template.
3. Agent Role — <update_agent_role> — what THIS agent is and does, as distinct from the
   standing rules above. The workspace SEEDS this seat on open, so it is always present.
4. Tool Call — <update_tool> — functions, APIs or tools the agent can invoke.
5. Few Shot — <update_few_shot> — examples of the input and the output wanted.
6. Context — <update_context> — background, domain knowledge, reference material.
7. Constraints — <update_constraints> — hard rules the agent must never violate.

HOW YOU WORK:
1. ANALYZE the user's intent. MAP it to ONE of the seven steps above.
2. STATE your choice in ONE sentence. Example: "This belongs in Constraints — it's a hard rule the agent must follow."
3. EMIT the tag IMMEDIATELY — same message, right after your sentence. Write the content INSIDE the tag.
   Correct: "I'll put this in Constraints. <update_constraints>Never suggest removing error boundaries.</update_constraints>"
   Wrong: "I'll put this in Constraints. The content would say: never suggest removing error boundaries."
4. SUGGEST which step to fill next. Stay within the seven steps above.
5. USER has veto — if they say move it to a different step, do it.

CONFIRMATION BUTTONS

When you need a decision from the user, put the buttons on their own line, in this exact form:

[Confirm](action:confirm) [Refuse](action:refuse) [Cancel](action:cancel)

Supported actions: confirm, refuse, cancel, proceed, yes, no, log, flag.

That line is the whole ask. Do not print the options underneath it, and do not ask the user to reply with a word — "Reply with one of: confirm, refuse, cancel." is the line that must never be written. Use the buttons when the choice is real; do not attach them to a message that is not asking for anything.

Never proceed with a destructive or irreversible action (save, clear, delete) without explicit user confirmation. If the user has not confirmed, ask again.

# CONTROL SURFACE (XML COMMAND TAGS)

WRITE TO STEPS:
<update_agent>text</update_agent>
<update_user>text</update_user>
<update_agent_role>text</update_agent_role>
<update_tool>text</update_tool>
<update_few_shot>text</update_few_shot>
<update_context>text</update_context>
<update_constraints>text</update_constraints>

THE COLUMN THOSE TAGS WRITE INTO
Each of those seven tags writes ONE seat of the prompt in the left column. A seat is found by its name, and one seat answers to several spellings: System Role and System are the same seat, User Role and User, Agent Role and Agent, Tool Call both ways. A repair prompt — the one the app builds when a finding is repaired — has four seats named System, User, Tool Call and Agent. Context, Few Shot and Constraints are not in it, so a tag for one of those has nowhere to land; the column reports that instead of changing silently.
Never write an instruction, a question, or a list of possible answers into a prompt. A prompt is the text the model reads: a question you put in it is answered by the model, not by the person, who never opens that box. Everything you want to say TO the person — what is still missing, what you are about to do, a choice you need — goes in your reply, with buttons. When the app's prompt is waiting on a person it already names the value it wants on the field's own label; your sentence is what asks for it, and when they answer, you write it.

MEMORY COMMANDS:
<save/>
<get_versions/>
<load_version>N</load_version>

DESTRUCTIVE:
<clear_all/> — ONLY if user says "clear", "reset", "wipe", or "nuke". MUST ask for confirmation with buttons first.

CURRENT WORKSPACE
${workspaceContext}
</system_instructions>

<execution_context>
You are in the chat panel. Follow the rules above. Use XML tags silently — they are stripped from the visible chat. Never ask the user to copy-paste or manually click UI. Stay within the seven agentic flow steps — do not invent new section types unless the user explicitly asks for a custom step.
</execution_context>`;

    try {
      // ── Sentry AI monitoring: tag span with conversation ID ──
      if (currentConversationId) {
        Sentry.setTag("gen_ai.conversation.id", currentConversationId);
      }
      const response = await neuralNetworkService.query(text, systemInstructions, {
        conversationId: currentConversationId,
        sessionId: sessionId || undefined,
        tab: selectedNav === 'trace' || selectedNav === 'tools' ? selectedNav : 'chat',
      });
      if (response.conversation_id && !currentConversationId) {
        setCurrentConversationId(response.conversation_id);
        // New conversation was created under this package — refresh the dropdown list
        if (sessionId) {
          conversationStorage.getSessionConversations(sessionId).then(all => {
            setConversations((all || []).filter(Boolean).sort((a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            ));
          }).catch(err => console.error('Failed to refresh conversation list:', err));
        }
      }
      if (response.error) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${response.error}` }]);
      } else {
        let responseContent = response.content;

        // NOTE the naming hazard, deliberately left in place: <update_agent> writes
        // SYSTEM Role, not Agent Role. The word reads the other way, and there is a
        // real "Agent Role" section below it — so a model reasoning from the tag
        // name would overwrite a different seat and nothing would warn anyone.
        // Renaming it would break every prompt already emitting it, so it is
        // disambiguated in Grace's own tag list instead ("Write to the System Role
        // section") — see grace_gui.py _build_chat_system.
        const xmlTags: Array<{ regex: RegExp; target: string }> = [
          { regex: /<update_agent>([\s\S]*?)<\/update_agent>/g, target: 'System Role' },
          { regex: /<update_user>([\s\S]*?)<\/update_user>/g, target: 'User Role' },
          // Agent Role is one of the three SEEDED sections — prompt-section-editor
          // seeds System Role, User Role, Agent Role — and it had NO tag at all, so
          // the most-used seat in the product was the one Grace could not write.
          { regex: /<update_agent_role>([\s\S]*?)<\/update_agent_role>/g, target: 'Agent Role' },
          { regex: /<update_tool_call>([\s\S]*?)<\/update_tool_call>/g, target: 'Tool Call' },
          { regex: /<update_tool>([\s\S]*?)<\/update_tool>/g, target: 'Tool Call' },
          { regex: /<update_few_shot>([\s\S]*?)<\/update_few_shot>/g, target: 'Few Shot' },
          { regex: /<update_context>([\s\S]*?)<\/update_context>/g, target: 'Context' },
          { regex: /<update_constraints>([\s\S]*?)<\/update_constraints>/g, target: 'Constraints' },
        ];

        for (const { regex, target } of xmlTags) {
          let match;
          while ((match = regex.exec(responseContent)) !== null) {
            applyTextToLeftColumn(match[1].trim(), target);
          }
          responseContent = responseContent.replace(regex, '');
        }

        // ── Dynamic panel management ──
        // <add_role name="Role Name">placeholder</add_role>
        const addRoleRegex = /<add_role\s+name="([^"]+)">([\s\S]*?)<\/add_role>/g;
        let addMatch;
        while ((addMatch = addRoleRegex.exec(responseContent)) !== null) {
          window.dispatchEvent(new CustomEvent('add-prompt-role', {
            detail: { roleName: addMatch[1].trim(), placeholder: addMatch[2].trim() }
          }));
        }
        responseContent = responseContent.replace(addRoleRegex, '');

        // <remove_role name="Role Name"/>
        const removeRoleRegex = /<remove_role\s+name="([^"]+)"\s*\/>/g;
        let remMatch;
        while ((remMatch = removeRoleRegex.exec(responseContent)) !== null) {
          window.dispatchEvent(new CustomEvent('remove-prompt-role', {
            detail: { roleName: remMatch[1].trim() }
          }));
        }
        responseContent = responseContent.replace(removeRoleRegex, '');

        // Self-closing tags
        if (/<clear_all\s*\/>/.test(responseContent)) {
          clearLeftColumn();
          responseContent = responseContent.replace(/<clear_all\s*\/>/g, '');
        }

        // ── AI Control Surface tags ──

        // <switch_tab>trace|variables|chat</switch_tab>
        const switchTabRegex = /<switch_tab>(trace|variables|chat|tools|data)<\/switch_tab>/g;
        let tabMatch;
        while ((tabMatch = switchTabRegex.exec(responseContent)) !== null) {
          setSelectedNav(tabMatch[1]);
        }
        responseContent = responseContent.replace(switchTabRegex, '');

        // <run_prompt/>
        if (/<run_prompt\s*\/>/.test(responseContent)) {
          window.dispatchEvent(new CustomEvent('ai-run-prompt'));
          responseContent = responseContent.replace(/<run_prompt\s*\/>/g, '');
        }

        // <save/>
        if (/<save\s*\/>/.test(responseContent)) {
          eventBus.emit({ command: 'save-button' } as any);
          responseContent = responseContent.replace(/<save\s*\/>/g, '');
        }

        // <show_version>N</show_version>
        const showVersionRegex = /<show_version>(\d+)<\/show_version>/g;
        let verMatch;
        while ((verMatch = showVersionRegex.exec(responseContent)) !== null) {
          window.dispatchEvent(new CustomEvent('ai-show-version', {
            detail: { version: parseInt(verMatch[1]) }
          }));
        }
        responseContent = responseContent.replace(showVersionRegex, '');

        // <eval_grounding/>
        if (/<eval_grounding\s*\/>/.test(responseContent)) {
          window.dispatchEvent(new CustomEvent('ai-eval-grounding'));
          responseContent = responseContent.replace(/<eval_grounding\s*\/>/g, '');
        }

        // ── A2UI Console surface tags ──

        // <reassemble-console sort="category|title" />  or  <reassemble-console filter="Design System" />
        const reassembleRegex = /<reassemble-console\s+([^>]*?)\s*\/?>/g;
        let reassembleMatch;
        while ((reassembleMatch = reassembleRegex.exec(responseContent)) !== null) {
          const attrs = reassembleMatch[1];
          const sortMatch = attrs.match(/sort="([^"]*)"/);
          const filterMatch = attrs.match(/filter="([^"]*)"/);
          window.dispatchEvent(new CustomEvent('a2ui:console-command', {
            detail: {
              sort: sortMatch ? sortMatch[1] : undefined,
              filter: filterMatch ? filterMatch[1] : undefined,
            }
          }));
        }
        responseContent = responseContent.replace(reassembleRegex, '');

        // ── A2UI Surface tags → eventBus (Lit components in third column) ──

        // <project-card-element id="..." name="..." description="..."/>
        const projectCardRegex = /<project-card-element\s+([^>]*?)\s*\/?>/g;
        let cardMatch;
        while ((cardMatch = projectCardRegex.exec(responseContent)) !== null) {
          const attrs = cardMatch[1];
          const props: Record<string, string> = {};
          const attrRegex = /(\w+)="([^"]*)"/g;
          let attrMatch;
          while ((attrMatch = attrRegex.exec(attrs)) !== null) {
            props[attrMatch[1]] = attrMatch[2];
          }
          eventBus.emit({
            tag: 'project-card-element',
            sessionId: 'default',
            command: 'project-card-element',
            timestamp: new Date().toISOString(),
            props,
          });
        }
        responseContent = responseContent.replace(projectCardRegex, '');

        // <add-button label="..." onclick="..."/>
        const addButtonRegex = /<add-button\s+([^>]*?)\s*\/?>/g;
        let btnMatch;
        while ((btnMatch = addButtonRegex.exec(responseContent)) !== null) {
          const attrs = btnMatch[1];
          const props: Record<string, string> = {};
          const attrRegex = /(\w+)="([^"]*)"/g;
          let attrMatch;
          while ((attrMatch = attrRegex.exec(attrs)) !== null) {
            props[attrMatch[1]] = attrMatch[2];
          }
          eventBus.emit({
            tag: 'add-button',
            sessionId: 'default',
            command: 'add-button',
            timestamp: new Date().toISOString(),
            props,
          });
        }
        responseContent = responseContent.replace(addButtonRegex, '');

        // <set-html content="..."/>
        const setHtmlRegex = /<set-html\s+content="([^"]*)"\s*\/?>/g;
        let htmlMatch;
        while ((htmlMatch = setHtmlRegex.exec(responseContent)) !== null) {
          eventBus.emit({
            tag: 'set-html',
            sessionId: 'default',
            command: 'set-html',
            timestamp: new Date().toISOString(),
            props: { content: htmlMatch[1] },
          });
        }
        responseContent = responseContent.replace(setHtmlRegex, '');

        // <clear-surface/>
        if (/<clear-surface\s*\/>/.test(responseContent)) {
          eventBus.emit({
            tag: 'clear-surface',
            sessionId: 'default',
            command: 'clear-surface',
            timestamp: new Date().toISOString(),
            props: {},
          });
          responseContent = responseContent.replace(/<clear-surface\s*\/>/g, '');
        }

        responseContent = responseContent.trim();
        setChatMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
        if (currentConversationId && responseContent) {
          conversationStorage.addMessage(currentConversationId, 'response', responseContent).catch(err => {
            console.error('[Chat] Failed to persist assistant response:', err);
          });
        }
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Unknown error'}` }]);
    } finally {
      setIsSending(false);
    }
  };

  handleSendRef.current = (overrideText?: string) => {
    void handleSend(overrideText);
  };

  // ── Render message content with action buttons ────────────────────
  const renderMessageContent = (content: string, role: ChatMessage['role']) => {
    // Grace's words are made plain here, at the edge where a person reads them
    // (shared/plainText.ts says why here and nowhere else). The user's own words are
    // left exactly as typed — those are theirs. The XML control tags are already
    // extracted by the time this runs, so what is stripped is only the prose, and
    // the prompt content she wrote into a section is never touched.
    const shown = role === 'assistant' ? asPlainText(content) : content;
    // Split on action: patterns like [Confirm](action:confirm)
    const parts = shown.split(/(\[.*?\]\(action:[^)]+\))/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(.*?)\]\(action:([^)]+)\)$/);
      if (match) {
        const label = match[1];
        const action = match[2];
        return (
          <button
            key={i}
            onClick={() => {
              // Catalog repair — the button next to a finding in the health report.
              // Starts the repair by turning the finding into an explicit, recorded
              // request. Applying an edit from inside the app is not wired yet, and
              // this says so rather than implying the fix happened.
              if (action.startsWith('catalog-repair:')) {
                const findingId = decodeURIComponent(action.slice('catalog-repair:'.length));
                const f = catalogHealth.state === 'ok'
                  ? catalogHealth.report.findings.find((x) => x.id === findingId)
                  : undefined;
                if (!f) {
                  setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `⚠️ Repair not started. Finding ${findingId} is no longer in the report — the catalog changed since this was posted. Re-run the check.`,
                  }]);
                  return;
                }
                const owner = f.owner === 'designer'
                  ? 'designer — needs a note written in Figma'
                  : 'pipeline — needs a code change';
                setChatMessages(prev => [...prev,
                  { role: 'user', content: `Repair: ${f.check}` },
                  {
                    role: 'assistant',
                    content: [
                      `Repair requested — ${f.check}`,
                      '',
                      `component   ${f.component || '—'}`,
                      `figma node  ${f.nodeId || '—'}`,
                      `file        ${f.file || '—'}`,
                      `owner       ${owner}`,
                      '',
                      `What's wrong:  ${f.what}`,
                      f.fix ? `The fix:  ${f.fix}` : '',
                      '',
                      'NOT YET APPLIED. Editing the catalog from inside the app is not wired. This request is recorded as a turn so it can be handed off.',
                    ].filter(Boolean).join('\n'),
                  },
                ]);
                return;
              }
              // Handle remove_role actions directly — dispatch DOM event
              if (action.startsWith('remove_role:')) {
                const roleName = decodeURIComponent(action.replace('remove_role:', ''));
                window.dispatchEvent(new CustomEvent('remove-prompt-role', {
                  detail: { roleName }
                }));
                setChatMessages(prev => [...prev, { role: 'assistant', content: `Removed "${roleName}". You can run now.` }]);
                return;
              }
              // An answer to a repair field — the button under a repair ask. The value is
              // carried in the action itself (`fill-field`), so this is one dispatch and
              // one confirmation: nothing is asked of the model, and nothing is guessed.
              // The editor reports back if the write could not be placed; the
              // `section-write-failed` listener below is what says so.
              const fill = parseFillFieldAction(action);
              if (fill) {
                window.dispatchEvent(new CustomEvent('fill-field', {
                  detail: { section: fill.section, field: fill.field, value: fill.value },
                }));
                setChatMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Written — ${fill.field} in the ${fill.section} section now reads: ${fill.value}`,
                }]);
                return;
              }
              // Advice buttons
              if (action === 'accept_advice') {
                setChatMessages(prev => [...prev, { role: 'assistant', content: '✅ Applying optimization now...' }]);
                handleSend(`[ACCEPT_ADVICE] You just gave optimization advice. APPLY IT NOW using XML tags. Do NOT describe the changes — EMIT the tags. Use <update_agent>, <update_user>, <update_tool>, <update_few_shot>, <update_context>, <update_constraints> for existing sections. Use <add_role name="NAME">CONTENT</add_role> for new sections. WRITE the improved content into the workspace immediately. Do not explain what you changed until after the tags are emitted.`);
                return;
              }
              if (action === 'reject_advice') {
                setChatMessages(prev => [...prev, { role: 'assistant', content: '❌ Advice rejected. Continuing with current prompt.' }]);
                return;
              }
              if (action === 'explain_more') {
                setChatMessages(prev => [...prev, { role: 'assistant', content: '💡 Requesting more detail...' }]);
                handleSend(`[EXPLAIN_MORE] Explain your optimization advice in more detail. Why is this approach better? What specific improvements will it make?`);
                return;
              }
              // Other actions: send as chat message
              handleSend(`[${action}]`);
            }}
            className="inline-block px-3 py-1 mx-0.5 my-0.5 rounded-md bg-[#4066e3] text-white text-xs font-semibold hover:bg-[#3051c0] transition-colors cursor-pointer"
          >
            {label}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const motionPresets = useMemo(() => {
    if (prefersReducedMotion) {
      return {
        content: { duration: 0, ease: 'linear' as const, opacity: { duration: 0 }, y: { duration: 0, ease: 'linear' as const }, filter: { duration: 0 } },
        header: { duration: 0, delay: 0, ease: 'linear' as const },
      };
    }
    return {
      content: { duration: 0.42, ease: 'easeOut' as const, opacity: { duration: 0.28 }, y: { duration: 0.42, ease: 'easeOut' as const }, filter: { duration: 0.24 } },
      header: { duration: 0.48, delay: 0, ease: 'easeOut' as const },
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showConvDropdown && !(e.target as HTMLElement).closest('.relative')) {
        setShowConvDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showConvDropdown]);

  useEffect(() => {    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => { mediaQuery.removeEventListener('change', updatePreference); };
  }, []);

  /**
   * The hero header names WHERE WE ARE NOW — and where we are is the last call.
   *
   * This is NOT a fixed string. It is whatever `mode` the backend reported for
   * the most recent LLM call, taken straight off the `a2ui:usage` detail —
   * whatever ran last IS the name. Nothing in this file names a mode.
   *
   * Before any call there is no last call, so it says '—'. Same rule as the
   * tally directly below it: no label, no number, until something real is there.
   */
  // The hero is the NUMBERS, and nothing printed above them.
  //
  // It used to carry a heading and a subtitle here. Since the heading became the
  // last call's mode, both lines printed the same word twice — and the grid
  // below already names the mode in its own "Last Call" cell. So the headers and
  // the little CHAT badge are gone, and the mode is read where it belongs.

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = inputHeight;
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startYRef.current - e.clientY;
      // Clamp to the panel's real height so the input can never push the
      // gripper (58px) + bottom bar (52px) + a minimum chat area below the viewport
      const panel = chatContainerRef.current?.parentElement;
      const dynamicMax = panel ? Math.max(100, panel.clientHeight - 58 - 52 - 80) : 600;
      setInputHeight(Math.max(100, Math.min(Math.min(600, dynamicMax), startHeightRef.current + deltaY)));
    };
    const handleMouseUp = () => { setIsDragging(false); };
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Don't change cursor during drag - let the user see what's under their cursor
      // This prevents jerky motion
      // document.body.style.cursor = 'ns-resize';
      // document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, inputHeight]);

  // `handleNavClick` used to live here: it set `selectedNav` and closed the approval queue, for a
  // React nav bar. The bar is <chat-navigation-bar> now and reports through `tab-change`, so the
  // callback was called by nothing and only its `setShowApprovalQueue(false)` was load-bearing —
  // that line moved into the `tab-change` listener above, where the event actually arrives.

  // ── Wire Lit <chat-navigation-bar> events → React state ───────────────
  useEffect(() => {
    const el = navBarRef.current;
    if (!el) return;

    const onTabChange = (e: Event) => {
      const detail = (e as CustomEvent<TabChangeEventDetail>).detail;
      if (detail?.tab !== undefined) {
        setSelectedNav(detail.tab);
        // THE CHAT TAB IS ALSO THE WAY OUT OF THE APPROVAL QUEUE.
        //
        // `setShowApprovalQueue(false)` was in `handleNavClick`, a callback that is now referenced
        // NOWHERE — it was written for a React nav bar and the bar is a Lit element now, which
        // reports through `tab-change` instead. So the queue opened from "(10) Approve" and had no
        // exit at all: the chat icon set `selectedNav` and the queue body stayed where it was.
        // Measured 2026-09-15 in the running app; it is not this session's change (HEAD defines
        // `handleNavClick` and never calls it either), and it is the whole of "there is no way
        // back to the chat".
        setShowApprovalQueue(false);
        // Clicking the Chat tab is the operator asking for the column back.
        // The bar only emits this on the expand path, so when the column is
        // already open this is a no-op.
        if (detail.tab === 'chat') onColumnExpand?.();
      }
    };

    const onCollapseToggle = (e: Event) => {
      const detail = (e as CustomEvent<CollapseToggleEventDetail>).detail;
      if (typeof detail?.collapsed === 'boolean') {
        setIsRightColumnCollapsed(detail.collapsed);
        if (detail.collapsed) {
          setSelectedNav('');
          onColumnCollapse?.();
        } else {
          // Expanding FROM the rail. The bar only emits this on that path (it
          // fires when the previous tab was ''), so this is the icon click that
          // asks for the column back.
          //
          // The WIDTH is the page's, not ours: without this the bar flips its own
          // state to open while the column stays a 75px rail — the toggle looks
          // dead because half of it moved.
          onColumnExpand?.();
        }
      }
    };

    el.addEventListener('tab-change', onTabChange);
    el.addEventListener('collapse-toggle', onCollapseToggle);

    return () => {
      el.removeEventListener('tab-change', onTabChange);
      el.removeEventListener('collapse-toggle', onCollapseToggle);
    };
  }, [onColumnExpand, onColumnCollapse]);

  // ── Push initial React state → Lit component on mount ─────────────────
  // The Lit component defaults to collapsed=false, activeTab=''.
  // React defaults to selectedNav='chat', isRightColumnCollapsed=false.
  // Sync once on mount, then Lit is the source of truth afterward.
  useEffect(() => {
    const el = navBarRef.current;
    if (!el) return;
    // Only set if not already synced (Lit has no previousTab on first render)
    if (!el.activeTab && !el.collapsed) {
      el.activeTab = 'chat';
    }
  }, []);

  const handleLoadToComposer = (item: ApprovalItem) => {
    console.log('Loading prompt to composer:', item);
    alert(`Loading "${item.promptName}" v${item.version} to composer...`);
  };

  // Scroll whenever chatMessages change (new message added).
  // What the view does is decided by shared/chatScroll.appendTarget:
  //   · the person's own turn — always the bottom. They typed, so it and the reply
  //     it asks for are what is on screen now, whatever the view was doing before.
  //     This is the reset: without it a reply read from its own start left the view
  //     above the bottom and every later message was appended out of sight.
  //   · a reply — its first line aligned to the top, so it is read from the start,
  //     and only while the newest message is still in front of the person.
  //   · otherwise — hold. They have scrolled back into older turns; nothing moves.
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const id = requestAnimationFrame(() => {
      const container = chatContainerRef.current;
      if (!container) return;
      const lastIdx = chatMessages.length - 1;
      const last = chatMessages[lastIdx];
      const el = container.querySelector<HTMLElement>(`[data-msg-idx="${lastIdx}"]`);
      const top = el ? messageTop(container, el) : null;
      const target = appendTarget(last.role, { following: followingNewestRef.current, newestTop: top });
      if (target === 'hold') return;
      if (target === 'newest-top' && top !== null) {
        container.scrollTo({ top: Math.max(0, top - 12), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        return;
      }
      container.scrollTop = container.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [chatMessages.length]);

  // Scroll to top when switching to any tab — show header first
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = 0;
        isAtBottomRef.current = false;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [selectedNav]);

  return (
    <div className="bg-[rgba(255,255,255,0)] content-stretch flex items-start justify-center relative shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-full w-full min-h-0 min-w-0 overflow-hidden">
      {/* Lit A2UI chat navigation bar — replaces React SidebarNavigation */}
      <chat-navigation-bar
        ref={navBarRef}
        active-tab={isColumnCollapsed ? '' : (selectedNav === 'trace' || selectedNav === 'tools' || selectedNav === 'evaluation' || selectedNav === 'variables' || selectedNav === 'metadata' ? selectedNav : 'chat')}
        collapsed={isColumnCollapsed}
        allowed-tabs={allowedTabs}
        health-count={badgeCount(catalogHealth)}
        health-state={badgeState(catalogHealth)}
      >
        <img slot="logo" alt={getImageAlt('card-img-default')} loading="lazy" data-a2ui-id="card-img-default" src={getImageUrl('card-img-default')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </chat-navigation-bar>

      <div
        data-tag="chat-panel"
        className="flex flex-col h-full min-h-0 min-w-0"
        style={{
          flex: '1 1 0%',
          opacity: isColumnCollapsed ? 0 : 1,
          transform: isColumnCollapsed ? 'translateX(14px)' : 'translateX(0)',
          pointerEvents: isColumnCollapsed ? 'none' : 'auto',
          overflow: 'hidden',
          transition: prefersReducedMotion ? 'none' : 'opacity 400ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        aria-hidden={isColumnCollapsed}
      >
        {/* Chat messages area */}
        <div 
          className={`flex-1 min-h-0 rounded-tr-[10px] shadow-[inset_5px_5px_10px_0px_rgba(0,0,0,0.25)] border border-[#8e98a8] overflow-y-auto overflow-x-hidden p-6 transition-colors duration-200 ease-out [&::-webkit-scrollbar]:w-[14px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#dadee4] [&::-webkit-scrollbar-thumb]:rounded-[10px] ${showApprovalQueue ? 'bg-[#B5C3C6]' : 'bg-white'}`}
          ref={chatContainerRef}
          onScroll={handleScroll}
        >
          <div
            className="flex flex-col min-h-full"
          >
          <AnimatePresence mode="wait">
            {showApprovalQueue ? (
              <motion.div key="approval-queue" initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }} transition={motionPresets.content} className="space-y-4">
                <motion.div initial={{ opacity: 0, y: -15, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={motionPresets.header} className="bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef] border-l-4 border-[#1c2f4e] rounded-lg p-5 shadow-md">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h2 className="font-['Inter'] font-bold text-[20px] text-[#1c2f4e] mb-1">Approval Queue</h2>
                      <p className="font-['Inter'] text-[13px] text-[#6c757d] leading-relaxed">Review and approve prompts submitted by your team.</p>
                    </div>
                    <div className="bg-[#1c2f4e] text-white px-4 py-1.5 rounded-full text-[11px] font-['Inter'] font-semibold min-w-[80px] text-center flex-shrink-0 ml-4">10 PENDING</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#dee2e6]">
                    <div className="space-y-3">
                      <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">Last Submitted</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e]">2 hours ago</div></div>
                      <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">Oldest Pending</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e]">3 days ago</div></div>
                    </div>
                    <div className="space-y-3">
                      <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">Total Est. Tokens</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e]">24,847</div></div>
                      <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">Total Est. Cost</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e]">$3.14</div></div>
                    </div>
                    <div className="space-y-3">
                      <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">Priority Breakdown</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e]"><span className="text-red-600">4 High</span> · <span className="text-yellow-600">4 Med</span> · <span className="text-green-600">2 Low</span></div></div>
                      <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">Risk Status</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e]"><span className="text-red-600">3 High</span> · <span className="text-yellow-600">2 Med</span> · <span className="text-green-600">5 Low</span></div></div>
                    </div>
                  </div>
                </motion.div>
                {approvalQueueItems.map((item, index) => (
                  <ApprovalQueueItem key={item.id} item={item} index={index} onLoadToComposer={handleLoadToComposer} />
                ))}
              </motion.div>
            ) : (
              <motion.div key={selectedNav} initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }} transition={motionPresets.content} className="space-y-6">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-['Inter'] font-medium bg-[#f0f0f0] text-[#666] border border-[#ccc]">
                    <span className="w-2 h-2 rounded-full bg-[#999]" />
                    Standard — new content loads at bottom
                  </div>
                  {/* Conversation Selector */}
                  <div className="relative">
                    <button
                      onClick={() => setShowConvDropdown(!showConvDropdown)}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[11px] font-['Inter'] font-medium bg-white border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      <span className="truncate">
                        {currentConversationId 
                          ? ((conversations || []).find(c => c?.id === currentConversationId)?.title || 'Untitled')
                          : 'Select a conversation...'}
                      </span>
                      <svg className="w-3 h-3 ml-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showConvDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
                        <button
                          onClick={() => { setCurrentConversationId(null); setChatMessages([]); setShowConvDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-[11px] font-['Inter'] hover:bg-gray-50 border-b border-gray-100"
                        >
                          + New conversation
                        </button>
                        {conversations.slice(0, 20).map(conv => (
                          <div key={conv.id} className="group">
                          <button
                            onClick={() => handleLoadConversation(conv)}
                            className={`w-full text-left px-3 py-2 text-[11px] font-['Inter'] hover:bg-gray-50 ${
                              currentConversationId === conv?.id ? 'bg-[#e8f0f1]' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="truncate font-medium">{conv.title || 'Untitled'}</div>
                              <div className="flex items-center gap-1 shrink-0">
                                {conv.tab && conv.tab !== 'chat' && (
                                  <span className="text-[9px] uppercase tracking-wide bg-[#507274] text-white rounded px-1 py-[1px]">{conv.tab}</span>
                                )}
                                <button 
                                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                                  className="opacity-0 group-hover:opacity-100 shrink-0 text-red-400 hover:text-red-300 text-sm leading-none px-1 transition-opacity"
                                  title="Delete conversation"
                                >×</button>
                              </div>
                            </div>
                            <div className="text-gray-400 text-[10px]">{new Date(conv.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                          </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* ── ALERT — components generated WITHOUT their annotation ───────
                    The gate is not a suggestion. When a surface is built that
                    contains a component the catalogue says has no annotation, the
                    person who answers for that catalogue finds out HERE, on
                    arrival — not in an audit next week, by which time whatever was
                    invented downstream is load-bearing.

                    Deliberately NOT gated on selectedNav: the findings LIST below
                    is a filter and belongs to the chat view, but an alert is not a
                    list item — it belongs to whoever is looking, whatever tab they
                    are on. Alert, don't block: the surface renders underneath. */}
                {unannotatedInUse && unannotatedInUse.length > 0 && dismissedAlert !== alertKey && (
                  <error-banner
                    code="UNANNOTATED-IN-USE"
                    message={
                      `${unannotatedInUse.length} component${unannotatedInUse.length === 1 ? '' : 's'} `
                      + `generated WITHOUT an annotation: ${unannotatedInUse.join(', ')}. `
                      + 'Their behaviour is being invented downstream, on every surface that places them. '
                      + 'Annotate the VARIANT in Figma — the set holds one note and reaches nobody, and an instance is not where the contract lives.'
                    }
                  ></error-banner>
                )}

                {/* The chat hero — ABOVE the repairs, so it reads first and the
                    conversation flows down from it. Grace reports her own spend
                    here: TOTAL first, because that is the number that adds up
                    over the session. All of it is MEASURED by the backend from
                    the provider's usage report; where there is no number yet it
                    says so rather than showing a placeholder. */}
                <motion.div initial={{ opacity: 0, y: -15, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={motionPresets.header} className="bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef] border-l-4 border-[#507274] rounded-lg p-5 shadow-md">
                  <div className="grid grid-cols-4 gap-4" style={{ minWidth: 300 }}>
                    <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">Total Tokens</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e] tabular-nums">{usage.total.calls > 0 ? usage.total.total_tokens.toLocaleString() : '—'}</div></div>
                    <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">In / Out</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e] tabular-nums">{usage.total.calls > 0 ? `${usage.total.prompt_tokens.toLocaleString()} / ${usage.total.completion_tokens.toLocaleString()}` : '—'}</div></div>
                    <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">Calls</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e] tabular-nums">{usage.total.calls > 0 ? usage.total.calls.toLocaleString() : '—'}</div></div>
                    <div><div className="text-[11px] font-['Inter'] text-[#6c757d] uppercase tracking-wide mb-1">Last Call</div><div className="text-[13px] font-['Inter'] font-semibold text-[#1c2f4e] tabular-nums">{usage.last ? `${usage.last.total_tokens?.toLocaleString()} · ${usage.last.mode || '—'}` : '—'}</div></div>
                  </div>
                </motion.div>

                {/* Catalog findings — Grace's report, under the hero, IN the chat's
                    own flow. It scrolls with the conversation because it belongs to
                    it; what changed is that it can be put away. The list is 40-plus
                    rows when the catalog is red — taller than the column — and it
                    sits ABOVE the thread in the same scroll, so leaving it open is
                    what pushed her replies below the fold. */}
                {/* Repair items belong to the CHAT view only. Trace, Tools,
                    Variables and Metadata each report their own thing, and an open
                    catalog finding is not part of what any of them is showing —
                    the tab is a filter, and this is what it filters out. */}
                {selectedNav === 'chat' && effectiveFindings.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    {/* The header is the whole standing report when closed: the
                        count, and what kind of work the open ones are. */}
                    <button
                      type="button"
                      onClick={() => setFindingsCollapsed((collapsed) => !collapsed)}
                      aria-expanded={!findingsCollapsed}
                      aria-controls="catalog-findings-body"
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <span className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                        <span className="flex items-center gap-2 min-w-0 w-full">
                          <span className="font-['Inter'] text-[12px] font-semibold text-[#1c2f4e] truncate">
                            Catalog check — {effectiveFindings.length} open
                          </span>
                          {findingCounts.blocking > 0 && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#fdeaea] text-[#b02a2a] text-[10px] font-semibold">
                              {findingCounts.blocking} blocking
                            </span>
                          )}
                          <span className="shrink-0 font-['Inter'] text-[10px] text-[#6c757d]">
                            {findingCounts.pipeline} pipeline · {findingCounts.designer} designer
                          </span>
                        </span>
                        {/* The chip says HOW MANY are blocking; this says WHICH.
                            It belongs to the standing header and not only to the
                            list, because the list is closed by default: the one
                            item that stops the pipeline has to be nameable without
                            opening forty-three rows to find it. */}
                        {mostUrgent && (
                          <span
                            className="max-w-full truncate font-['Inter'] text-[10px] font-semibold text-[#b02a2a]"
                            title={mostUrgent.id}
                          >
                            blocking: {mostUrgent.id}
                            {findingCounts.blocking > 1 ? ` (+${findingCounts.blocking - 1} more)` : ''}
                          </span>
                        )}
                      </span>
                      <span className={`shrink-0 text-[14px] text-gray-400 transition-transform ${findingsCollapsed ? '' : 'rotate-90'}`}>
                        ▶
                      </span>
                    </button>
                    {!findingsCollapsed && (
                      <div id="catalog-findings-body" className="p-2">
                      <ul className="space-y-1.5">
                        {orderedFindings.map((f) => (
                          <li key={f.id} className="flex items-start gap-2">
                            {repairStages?.[f.id] === 'done' ? (
                              // Settled: a report fetched after the repair stopped
                              // deriving it. Nothing left to queue — the fix is in.
                              <span className="shrink-0 px-2 py-0.5 rounded bg-[#e7f4ea] text-[#1e7a34] text-[10px] font-semibold">
                                done
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onRepairFinding?.(f.id)}
                                className="shrink-0 px-2 py-0.5 rounded bg-[#4066e3] text-white text-[10px] font-semibold hover:bg-[#3051c0] transition-colors cursor-pointer"
                              >
                                Repair
                              </button>
                            )}
                            {/* The level, on the row. Without it the list is
                                forty-three identical-looking lines and the one
                                blocking finding cannot be seen even while it is on
                                screen — which is exactly what was reported. Only
                                the urgent level is marked: a chip on every row is
                                a chip that means nothing. */}
                            {f.level === 'blocking' && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#fdeaea] text-[#b02a2a] text-[10px] font-semibold">
                                blocking
                              </span>
                            )}
                            <span className="font-['Inter'] text-[13px] text-gray-800 leading-snug">
                              <span className="font-semibold">{f.component || f.file || '(catalog)'}</span>
                              {f.nodeId ? ` ${f.nodeId}` : ''}
                              {f.what ? ` — ${f.what.slice(0, 110)}` : ''}
                            </span>
                            {repairStages?.[f.id] === 'repair' && (
                              // Queued: the prompt is in the left column and the Run that
                              // answers it has not settled yet. The button stays, because a
                              // failed run is a repair that still has to happen.
                              <span className="shrink-0 font-['Inter'] text-[10px] font-semibold text-[#6c757d]">
                                in repair
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      </div>
                    )}
                  </div>
                )}

                {chatMessages.length > 0 && (
                  <div className="space-y-3">
                    {chatMessages.map((msg, i) => (
                      <div key={i} data-msg-idx={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 text-[13px] font-['Inter'] font-medium whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#4066e3] text-white' : 'bg-gray-100 text-gray-800 border border-gray-200'}`}>
                          {renderMessageContent(msg.content, msg.role)}
                        </div>
                      </div>
                    ))}
                    {isSending && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 text-[13px] font-['Inter'] text-gray-400 italic">
                          Thinking...
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(() => {
                  switch (selectedNav) {
                    case 'trace': return (
                      <div className="space-y-2">
                        {/* ── Grounding & Evaluation Metrics ── */}
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className={`rounded-xl border-2 p-4 ${
                            currentGroundingMetrics.driftWarning
                              ? 'border-red-300 bg-red-50'
                              : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="font-['Inter'] font-bold text-[14px] text-[#1c2f4e]">Evaluation Scores</h3>
                              <p className="text-[11px] text-gray-500">
                                Model: {currentGroundingMetrics.model} · Evaluated {new Date(currentGroundingMetrics.evaluatedAt).toLocaleTimeString()}
                              </p>
                            </div>
                            {currentGroundingMetrics.driftWarning && (
                              <span className="bg-red-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold animate-pulse">
                                ⚠ DRIFT DETECTED
                              </span>
                            )}
                          </div>

                          <div className="space-y-2">
                            {metricBars.map(bar => (
                              <div
                                key={bar.key}
                                className="group cursor-pointer"
                                onClick={() => {
                                  const q = bar.key === 'hallucinationRate'
                                    ? `My hallucination rate is ${(bar.value * 100).toFixed(0)}%. ${bar.value > 0.1 ? 'This seems high — why might the model be hallucinating and how can I reduce it?' : 'Is this considered acceptable? What threshold should I aim for?'}`
                                    : `My ${bar.label.toLowerCase()} score is ${(bar.value * 100).toFixed(0)}%. ${bar.value < 0.7 ? 'How can I improve this metric?' : 'What does this metric tell me about response quality?'}`;
                                  setChatInput(q);
                                }}
                                title={`Click to ask about ${bar.label}`}
                              >
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[11px] font-['Inter'] font-semibold text-[#1c2f4e]">{bar.label}</span>
                                  <span className="text-[11px] font-['Inter'] font-bold text-[#1c2f4e]">{(bar.value * 100).toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${bar.color} group-hover:opacity-80`}
                                    style={{ width: `${bar.key === 'hallucinationRate' ? (1 - bar.value) * 100 : bar.value * 100}%` }}
                                  />
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {bar.description} — click to discuss
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Drift simulator — toggle between healthy and drifting for testing */}
                          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2">
                            <span className="text-[10px] text-gray-400">Simulate:</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setCurrentGroundingMetrics(groundingMetricsSample); }}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                                !currentGroundingMetrics.driftWarning ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-emerald-100'
                              }`}
                            >Healthy</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setCurrentGroundingMetrics(groundingMetricsDrifting); }}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                                currentGroundingMetrics.driftWarning ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-red-100'
                              }`}
                            >Drifting</button>
                          </div>
                        </motion.div>

                        {/* ── Live AI Trace Feed ── */}
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                          className="rounded-xl border border-gray-200 bg-white overflow-hidden h-[280px]"
                        >
                          <TraceFeed />
                        </motion.div>

                        {/* ── Collapsible Chat History ── */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setTraceHistoryCollapsed(!traceHistoryCollapsed)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-[12px] font-['Inter'] font-semibold text-[#1c2f4e]">
                              All Conversations ({conversations.filter(c => c?.id).length})
                            </span>
                            <span className={`text-[14px] text-gray-400 transition-transform ${traceHistoryCollapsed ? '' : 'rotate-90'}`}>
                              ▶
                            </span>
                          </button>
                          {!traceHistoryCollapsed && (
                            <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
                              {(() => {
                                const labelMap: Record<string, string> = { trace: '[Trace]', variables: '[Variables]', tools: '[Variables]', general: '[General]' };
                                const filtered = conversations.filter(c => c?.id);
                                return filtered.length > 0 ? (
                                  filtered.map(conv => (
                                    <div
                                      key={conv.id}
                                      onClick={() => handleLoadConversation(conv)}
                                      className={`bg-white border rounded-lg p-3 text-[12px] font-['Inter'] cursor-pointer hover:border-[#4066e3] transition-colors ${currentConversationId === conv.id ? 'border-[#4066e3] bg-[#f0f4ff]' : 'border-gray-200'}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold truncate">
                                          <span className="text-[10px] text-[#507274] mr-1">{labelMap[conv.tag || 'general'] || '[General]'}</span>
                                          {conv.title || 'Untitled'}
                                        </span>
                                        <button
                                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                                          className="text-gray-400 hover:text-red-500 text-[10px] ml-2 shrink-0"
                                        >Delete</button>
                                      </div>
                                      <div className="text-[10px] text-gray-400 mt-1">
                                        {new Date(conv.updatedAt).toLocaleString()}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-[12px] text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded-lg">
                                    No conversations yet — start chatting below
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                        <div className="h-[230px]" aria-hidden="true"></div>
                      </div>
                    );
                    case 'variables': return (
                      <div className="space-y-4">
                        {selectedVersionEntry && (
                          <div className="rounded-xl border border-[#4066e3] bg-[#f0f4ff] overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-[#4066e3]">
                              <span className="text-white font-semibold text-[13px]">
                                {selectedVersionEntry.change_description || `Version ${selectedVersionEntry.version_number}`}
                                <span className="ml-2 opacity-70 font-normal">v{selectedVersionEntry.version_number}</span>
                              </span>
                              <div className="flex items-center gap-3">
                                {selectedVersionEntry.overall_score != null && (
                                  <span className="text-white font-bold text-[14px]">
                                    Score: {(selectedVersionEntry.overall_score as number).toFixed(1)}
                                  </span>
                                )}
                                <button onClick={() => setSelectedVersionEntry(null)} className="text-white/70 hover:text-white text-[18px] leading-none" title="Dismiss">×</button>
                              </div>
                            </div>
                            <div className="px-4 py-3">
                              <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-wide font-semibold">
                                Saved {new Date(selectedVersionEntry.created_at).toLocaleString()}
                              </p>
                              {selectedVersionEntry.left_column_content ? (
                                <pre className="text-[12px] text-gray-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-gray-200 max-h-[300px] overflow-y-auto">{selectedVersionEntry.left_column_content}</pre>
                              ) : (
                                <p className="text-[12px] text-gray-400 italic">No content stored for this version.</p>
                              )}
                            </div>
                          </div>
                        )}
                        {sessionVersions.length > 0 ? (
                          sessionVersions.filter(v => v?.id).map(v => (
                            <div key={v.id} className="bg-white border border-gray-200 rounded-lg p-3 text-[12px] font-['Inter']">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold">v{v.version_number}</span>
                                <span className="text-[10px] text-gray-400">{new Date(v.created_at).toLocaleString()}</span>
                              </div>
                              <div className="text-gray-600">{v.change_description || 'No description'}</div>
                              {v.overall_score != null && <div className="mt-1 text-[#4066e3] font-semibold">Score: {v.overall_score}</div>}
                            </div>
                          ))
                        ) : (
                          <div className="text-[12px] text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded-lg">
                            {sessionId ? 'No versions yet — run a prompt to create a trace' : 'No active prompt session'}
                          </div>
                        )}
                        <div className="h-[230px]" aria-hidden="true"></div>
                      </div>
                    );
                    case 'tools': return (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-[12px] font-['Inter'] font-semibold text-[#1c2f4e] mb-2">Detected Tools</h3>
                          {promptTools.length > 0 ? (
                            <div className="space-y-2">
                              {promptTools.map((tool, i) => (
                                <div key={`${tool.name}-${i}`} className="bg-white border border-gray-200 rounded-lg p-3 text-[12px] font-['Inter']">
                                  <div className="font-semibold text-[#1c2f4e]">{tool.name}</div>
                                  <pre className="mt-1 text-[11px] text-gray-600 whitespace-pre-wrap font-mono">{tool.content}</pre>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[12px] text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded-lg">
                              0 tools
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-[12px] font-['Inter'] font-semibold text-[#1c2f4e] mb-2">Detected Variables</h3>
                        {promptVariables.length > 0 ? (
                          promptVariables.map((v, i) => (
                            <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 text-[12px] font-['Inter']">
                              <span className="font-mono text-[#507274] font-semibold">{'{{'}{v.name}{'}}'}</span>
                              <span className="ml-2 text-gray-400">from {v.section}</span>
                              {v.value && <div className="mt-1 text-gray-600">Value: {v.value}</div>}
                            </div>
                          ))
                        ) : (
                          <div className="text-[12px] text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded-lg">
                            0 variables
                          </div>
                        )}
                        </div>
                        <div className="h-[230px]" aria-hidden="true"></div>
                      </div>
                    );
                    case 'data': return (
                      <div className="text-[12px] text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded-lg">
                        Data view coming soon. Use the Variables tab for variable extraction and the Tools tab for tool definitions.
                        <div className="h-[230px]" aria-hidden="true"></div>
                      </div>
                    );
                    case 'evaluation': return (
                      <div className="space-y-3">
                        <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                          <h3 className="font-['Inter'] font-bold text-[14px] text-[#1c2f4e] mb-1">A/B Testing & Model Comparison</h3>
                          <p className="text-[11px] text-gray-500 mb-3">Compare prompt versions across different models and configurations.</p>
                          <div className="text-[12px] text-gray-400 italic p-3 text-center border border-dashed border-gray-300 rounded-lg">
                            A/B test runner — design pending.
                            <br/>Will show: variant comparison, confidence intervals, statistical significance, model performance deltas.
                          </div>
                        </div>
                        <div className="h-[230px]" aria-hidden="true"></div>
                      </div>
                    );
                    case 'metadata': return (
                      <div className="space-y-3">
                        <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
                          <h3 className="font-['Inter'] font-bold text-[14px] text-[#1c2f4e] mb-1">Governance & Cost</h3>
                          <p className="text-[11px] text-gray-500 mb-3">Cost per invocation, change history, hallucination rates, audit trail.</p>
                          <div className="text-[12px] text-gray-400 italic p-3 text-center border border-dashed border-gray-300 rounded-lg">
                            Governance dashboard — design pending.
                            <br/>Will pull from: grace_decisions, grace_health_metrics, usage_metrics, data_dignity_ledger, audit_logs.
                          </div>
                        </div>
                        <div className="h-[230px]" aria-hidden="true"></div>
                      </div>
                    );
                    default: return null;
                  }
                })()}
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>

        {/* Action bar - draggable gripper */}
        <div 
          onMouseDown={handleMouseDown}
          className={`bg-[#e5e1dd] h-[58px] shrink-0 flex items-center px-2 gap-[15px] cursor-ns-resize hover:bg-[#d5d1cd] transition-colors duration-200 ease-out ${isDragging ? 'bg-[#c5c1bd]' : ''}`}
          title="Drag to resize input area"
        >
          <div className={`h-[40px] w-[25px] rounded transition-colors duration-200 ease-out flex items-center justify-center pointer-events-none ${isDragging ? 'bg-black/10' : ''}`} aria-hidden="true">
            <img src={gripperChatBarHorizontal} alt="" className="w-full h-auto object-contain" />
          </div>

          <button 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => handleSend()}
            disabled={isSending}
            onMouseEnter={() => setHoveredButton('send')}
            onMouseLeave={() => setHoveredButton(null)}
            aria-label="Send"
            className={`bg-[#507274] flex items-center justify-center px-[5px] py-[7px] rounded-[6px] h-[40px] w-[44px] border border-[#758e87] hover:bg-[#5e8486] transition-colors duration-200 ease-out relative ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="rotate-[-88.53deg] skew-x-[0.82deg]">
              <svg className="w-[23px] h-[29px]" fill="none" viewBox="0 0 17.494 21.5167">
                <path d="M0 0L17.494 10.758L0 21.517L0 13.514L12.495 10.758L0 8.003L0 0Z" fill={isSending ? '#ccc' : '#FFDE30'} />
              </svg>
            </div>
            {hoveredButton === 'send' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#BCCBCE] text-black p-[3px] rounded shadow-[0px_2px_8px_rgba(0,0,0,0.25)] whitespace-nowrap text-[10pt] font-['Inter'] font-normal z-50">
                Send
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#BCCBCE]"></div>
              </div>
            )}
          </button>

          <button 
            onClick={() => setShowApprovalQueue(true)}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={() => setHoveredButton('approve')}
            onMouseLeave={() => setHoveredButton(null)}
            aria-label="Open approval queue"
            className="bg-[#1c2f4e] flex items-center justify-center px-[10px] py-[7px] rounded-[6px] h-[40px] border border-[#758e87] hover:bg-[#243a5d] transition-colors duration-200 ease-out relative"
          >
            <p className="font-['Inter'] font-bold text-[16px] text-white leading-[20px]"><span className="font-medium">(10) </span><span>Approve</span></p>
            {hoveredButton === 'approve' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#BCCBCE] text-black px-3 py-2 rounded shadow-[0px_2px_8px_rgba(0,0,0,0.25)] whitespace-nowrap text-[10pt] font-['Inter'] font-normal z-50">
                Approval queue for submitted prompts
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#BCCBCE]"></div>
              </div>
            )}
          </button>

          <button 
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={() => setHoveredButton('create')}
            onMouseLeave={() => setHoveredButton(null)}
            aria-label="Create new prompt"
            className="bg-[#507274] flex items-center justify-center px-[5px] py-[7px] rounded-[6px] h-[40px] w-[44px] border border-[#758e87] hover:bg-[#5e8486] transition-colors duration-200 ease-out relative"
          >
            <p className="font-['Inter'] font-medium text-[36px] text-white leading-[20px]">+</p>
            {hoveredButton === 'create' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#BCCBCE] text-black p-[3px] rounded shadow-[0px_2px_8px_rgba(0,0,0,0.25)] whitespace-nowrap text-[10pt] font-['Inter'] font-normal z-50">
                Create new prompt
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#BCCBCE]"></div>
              </div>
            )}
          </button>

          <button 
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={() => setHoveredButton('console')}
            onMouseLeave={() => setHoveredButton(null)}
            aria-label="Open prompt console"
            className="bg-[#1c2f4e] flex items-center justify-center px-[10px] py-[7px] rounded-[6px] h-[40px] border border-[#758e87] hover:bg-[#243a5d] transition-colors duration-200 ease-out relative"
          >
            <p className="font-['Inter'] font-bold text-[16px] text-white leading-[20px]">Console</p>
            {hoveredButton === 'console' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#BCCBCE] text-black px-3 py-2 rounded shadow-[0px_2px_8px_rgba(0,0,0,0.25)] whitespace-nowrap text-[10pt] font-['Inter'] font-normal z-50">
                Main prompt repository
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#BCCBCE]"></div>
              </div>
            )}
          </button>
        </div>

        <div 
          className={`shrink-0 shadow-[inset_5px_5px_10px_0px_rgba(0,0,0,0.25)] transition-[height,background-color] duration-200 ease-out ${showApprovalQueue ? 'bg-[#B5C3C6]' : 'bg-[#b5ccce]'}`}
          style={{ height: `${inputHeight}px`, transitionDuration: isDragging || prefersReducedMotion ? '0ms' : '180ms', transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className="p-4 h-full flex flex-col gap-2">
            <textarea
              className="w-full flex-1 bg-white border border-[#8e98a8] rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#507274] font-['Inter'] text-[14px]"
              placeholder="Type your message here..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        <div className={`h-[52px] rounded-br-[10px] shrink-0 flex items-center justify-between px-5 transition-colors duration-200 ease-out ${showApprovalQueue ? 'bg-[#B5C3C6]' : 'bg-[#b5ccce]'}`}>
          <button onMouseEnter={() => setHoveredButton('gpt')} onMouseLeave={() => setHoveredButton(null)} className="bg-[#e5f1ec] border border-[#bcbcbc] h-[34px] px-5 rounded-[4px] shadow-[2px_3px_10px_0px_rgba(0,0,0,0.15)] font-['Inter'] font-bold text-[18px] text-[#10455f] hover:bg-[#d5e1dc] transition-colors duration-200 ease-out relative">
            GPT-4.1
            {hoveredButton === 'gpt' && (<div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#BCCBCE] text-black p-[3px] rounded shadow-[0px_2px_8px_rgba(0,0,0,0.25)] whitespace-nowrap text-[10pt] font-['Inter'] font-normal z-50">Select AI model<div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#BCCBCE]"></div></div>)}
          </button>
          {/* The readout — bottom-right, under the input, where no button goes.
              The running total leads, because that is the number that adds up.
              Every value is MEASURED by the backend from the provider's own
              usage report. No estimate, no placeholder, no fake counter. */}
          <div className="text-[#10455f] text-[11px] opacity-70 font-['Inter'] tabular-nums text-right leading-tight">
            {isDragging ? (
              `${inputHeight}px`
            ) : usage.last ? (
              <>
                <div className="font-semibold">{usage.total.total_tokens.toLocaleString()} tokens total</div>
                <div className="opacity-70">
                  +{usage.last.total_tokens?.toLocaleString()} this call · {usage.total.calls.toLocaleString()} {usage.total.calls === 1 ? 'call' : 'calls'}
                </div>
              </>
            ) : (
              ''
            )}
          </div>
        </div>
      </div>
    </div>
  );
}