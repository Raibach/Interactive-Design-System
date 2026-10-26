/**
 * <GovernanceRoomContainer> — THE GOVERNANCE ROOM OWNS ITS OWN STATE.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` (2026-10-24), the Product room's architecture
 * applied to this room. The container owns the layout, the seat, the evals seat, the embedded
 * application, the trace selection and its views, the grip, the evals seat, the path the left
 * nav highlights and the one navigate command the nav calls back through.
 *
 * THE SHELL KEEPS THE LEFT NAV. It receives `onPathChange` and writes the navigate command into
 * `navigateRef`; nothing else crosses. The trace selection never crosses.
 *
 * THE STAGED OPENING IS GONE (owner, 2026-10-22). The room opens on the embedded application's
 * own loader; there is no gate, no ceiling and no shell-shaped cover here.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { BuilderEmbed } from '@/components/lit/builder-embed';
import type { ChatPanel } from '@/components/lit/chat-panel';
import type { EvalsChatPanel } from '@/components/lit/evals-chat-panel';
import type { WorkspaceLayout } from '@/components/lit/workspace-layout';
import { GovernanceRoom } from '@/rooms/governance/GovernanceRoom';
import { useGovernanceChrome } from '@/rooms/governance/useGovernanceChrome';
import { useGovernanceRoom } from '@/rooms/governance/useGovernanceRoom';
import {
  useGovernanceTrace,
  type GovernanceTraceEls,
  type GovernanceTraceSel,
  type GovernanceTraceSig,
} from '@/rooms/governance/useGovernanceTrace';

const GOVERNANCE_SEAT_TABS = 'chat,sessions,tools,approvals,eval,settings';

export interface GovernanceRoomContainerProps {
  /** The shell's card door: a package a card asked to open. */
  onOpenPrompt: (sessionId: string) => void;
  /** The current path, pushed up for the shell's left navigation. */
  onPathChange: (path: string) => void;
  /** The left navigation's navigate command, held by the shell and written here. */
  navigateRef: { current: ((path: string) => void) | null };
  /** The builder's back arrow leaves the room for the Console. */
  onBackToConsole: () => void;
}

export function GovernanceRoomContainer({
  onOpenPrompt,
  onPathChange,
  navigateRef,
  onBackToConsole,
}: GovernanceRoomContainerProps) {
  const headerTab = 'governance';

  const [governanceGripActive, setGovernanceGripActive] = useState(false);
  const [governanceEvalsSeat, setGovernanceEvalsSeat] = useState(false);
  const [governanceTraceSig, setGovernanceTraceSig] = useState<GovernanceTraceSig | null>(null);
  const [governanceTraceElsTick, setGovernanceTraceElsTick] = useState(0);

  const governanceLayoutRef = useRef<WorkspaceLayout | null>(null);
  const governanceSeatRef = useRef<ChatPanel | null>(null);
  const governanceEvalsSeatRef = useRef<EvalsChatPanel | null>(null);
  const governanceEmbedRef = useRef<BuilderEmbed | null>(null);
  const governanceTraceElsRef = useRef<GovernanceTraceEls | null>(null);
  const governanceTraceSelRef = useRef<GovernanceTraceSel>({
    bundle: null,
    traceId: null,
    obsId: null,
    appliedObsId: null,
    peekId: null,
    scores: null,
    commentCounts: null,
    els: null,
  });
  const governanceComposerPackageRef = useRef('');
  const openComposerRef = useRef<((sessionId: string) => void) | null>(null);

  /* THE PANE'S WIDTH, ASSERTED WHERE IT CAN BE MEASURED — the room declares 650 and the
     layout's own requestUpdate picks the real width up once the room is measurable. */
  const assertPaneWidth = useCallback((el: WorkspaceLayout | null) => {
    try {
      el?.requestUpdate?.();
    } catch {
      /* not an upgraded element yet — the next beat asserts again */
    }
  }, []);

  useLayoutEffect(() => {
    const el = governanceLayoutRef.current;
    if (!el) return;
    el.chatLoadWidth = 650;
  }, []);

  /* THE SEATS' RAILS — the room's own list, and the evals seat's own labels. Written only
     while a seat carries no list, so the package's bound list always wins. */
  useLayoutEffect(() => {
    const seat = governanceSeatRef.current;
    if (seat && !seat.allowedTabs) seat.allowedTabs = GOVERNANCE_SEAT_TABS;
    const evalsSeatEntry = governanceEvalsSeatRef.current as (HTMLElement & {
      allowedTabs?: string;
      tabLabels?: string;
      disabledTabs?: string;
    }) | null;
    if (evalsSeatEntry && !evalsSeatEntry.allowedTabs) {
      evalsSeatEntry.allowedTabs = GOVERNANCE_SEAT_TABS;
      evalsSeatEntry.tabLabels = '{"tools":{"label":"Preview","tooltip":"Preview the selected trace detail"}}';
      evalsSeatEntry.disabledTabs = 'tools';
    }
  }, []);

  useEffect(() => {
    openComposerRef.current = (sessionId: string) => void onOpenPrompt(sessionId);
  }, [onOpenPrompt]);

  /* THE FRAME DOOR — the left nav's two facts and nothing else. */
  const { governancePath, governanceSectionPrefix, navigateGovernanceTool } = useGovernanceChrome({
    governanceEmbedRef,
    governanceLayoutRef,
    governanceSeatRef,
    governanceTraceSelRef,
    setGovernanceTraceSig,
  });

  useGovernanceRoom({
    GOVERNANCE_SEAT_TABS,
    assertPaneWidth,
    governanceComposerPackageRef,
    governanceEmbedRef,
    governanceEvalsSeatRef,
    governanceLayoutRef,
    governanceSeatRef,
    governanceSectionPrefix,
    governanceTraceElsRef,
    governanceTraceSelRef,
    headerTab,
    navigateGovernanceTool,
    openComposerRef,
    setGovernanceEvalsSeat,
    setGovernanceGripActive,
    setGovernanceTraceSig,
  });

  useGovernanceTrace({
    governanceTraceSig,
    governanceTraceElsTick,
    setGovernanceTraceElsTick,
    governanceTraceElsRef,
    governanceTraceSelRef,
    governanceSeatRef,
    governanceSectionPrefix,
    governanceComposerPackageRef,
  });

  useEffect(() => {
    onPathChange(governancePath);
  }, [governancePath, onPathChange]);

  useEffect(() => {
    navigateRef.current = navigateGovernanceTool;
    return () => {
      navigateRef.current = null;
    };
  }, [navigateRef, navigateGovernanceTool]);

  /* THE BUILDER'S BACK ARROW COMES HOME — the frame postMessages; this room opens the Console. */
  useEffect(() => {
    const onBuilderBack = () => onBackToConsole();
    window.addEventListener('builder-back', onBuilderBack);
    return () => window.removeEventListener('builder-back', onBuilderBack);
  }, [onBackToConsole]);

  return (
    <GovernanceRoom
      governanceGripActive={governanceGripActive}
      governanceEvalsSeat={governanceEvalsSeat}
      governanceLayoutRef={governanceLayoutRef}
      governanceSeatRef={governanceSeatRef}
      governanceEvalsSeatRef={governanceEvalsSeatRef}
      governanceEmbedRef={governanceEmbedRef}
    />
  );
}
