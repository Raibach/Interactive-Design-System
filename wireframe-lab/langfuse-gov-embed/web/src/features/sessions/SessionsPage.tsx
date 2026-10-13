import React from "react";
import { useRouter } from "next/router";
import SessionsTable from "@/src/features/sessions/SessionsTable";
import Page from "@/src/components/layouts/page";
import { SessionsOnboarding } from "@/src/components/onboarding/SessionsOnboarding";
import { api } from "@/src/utils/api";
import { useReadPath } from "@/src/features/events";

export default function SessionsPage() {
  const router = useRouter();
  const projectId = router.query.projectId as string;
  const { isV4 } = useReadPath();

  const { data: hasAnySession, isLoading } = api.sessions.hasAny.useQuery(
    { projectId },
    {
      enabled: !!projectId && !isV4,
      trpc: {
        context: {
          skipBatch: true,
        },
      },
      refetchInterval: 10_000,
    },
  );

  const { data: hasAnySessionFromEvents, isLoading: isLoadingFromEvents } =
    api.sessions.hasAnyFromEvents.useQuery(
      { projectId },
      {
        enabled: !!projectId && isV4,
        trpc: {
          context: {
            skipBatch: true,
          },
        },
        refetchInterval: 10_000,
      },
    );

  const hasSessions = isV4 ? hasAnySessionFromEvents : hasAnySession;
  const isLoadingSessions = isV4 ? isLoadingFromEvents : isLoading;
  const showOnboarding = !isLoadingSessions && !hasSessions;

  return (
    <Page
      headerProps={{
        // RAIBACH IDS (2026-10-12): 20px above the section — equal top spacing
        // throughout the app (matches Home). REVERT: drop the className.
        className: "pt-5",
        title: "Sessions",
        help: {
          description: (
            <>
              A session is a collection of related traces, such as a
              conversation or thread. To begin, add a sessionId to the trace.
              See{" "}
              <a
                href="https://langfuse.com/docs/observability/features/sessions"
                target="_blank"
                rel="noopener noreferrer"
                className="decoration-primary/30 hover:decoration-primary underline"
                onClick={(e) => e.stopPropagation()}
              >
                docs
              </a>{" "}
              to learn more.
            </>
          ),
          href: "https://langfuse.com/docs/observability/features/sessions",
        },
      }}
      scrollable={showOnboarding}
    >
      {/* Show onboarding screen if user has no sessions */}
      {/* RAIBACH IDS (2026-10-12, owner's sessions pass): the time range renders
          inline in the toolbar row — the header hoist is deleted, so the strip
          above the title closes up (the homepage/traces pattern). The search
          box now sits beside the section title (searchInTitleRow): it flexes
          across the row and truncates on overflow — the box the owner wants
          the dynamic system messages to replace later.
          REVERT: restore `showControlsInPageHeader` and delete searchInTitleRow. */}
      {showOnboarding ? (
        <SessionsOnboarding />
      ) : (
        <SessionsTable projectId={projectId} isV4={isV4} searchInTitleRow />
      )}
    </Page>
  );
}
