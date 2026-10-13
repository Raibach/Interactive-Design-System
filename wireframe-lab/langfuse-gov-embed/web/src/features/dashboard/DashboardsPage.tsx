import { useRouter } from "next/router";
import Page from "@/src/components/layouts/page";
import { ConnectedDashboardTable } from "@/src/features/dashboard/components/DashboardTable/ConnectedDashboardTable";
import { getDashboardTabs, DASHBOARD_TABS } from "@/src/features/navigation";

export default function DashboardsPage() {
  const router = useRouter();
  const { projectId } = router.query as { projectId: string };

  return (
    <Page
      headerProps={{
        className: "border-b-0",
        // RAIBACH IDS (2026-10-12, owner's red-line pass): the title row and its
        // \"New dashboard\" button are removed — the tab strip is the header, and
        // \"New dashboard\" rides the tabs as a link next to Widgets.
        // REVERT: restore title + help + the ActionButton (with hasCUDAccess).
        tabsProps: {
          tabs: [
            ...getDashboardTabs(projectId),
            {
              value: "new-dashboard",
              label: "New dashboard",
              href: `/project/${projectId}/dashboards/new`,
            },
          ],
          activeTab: DASHBOARD_TABS.DASHBOARDS,
        },
      }}
    >
      <ConnectedDashboardTable />
    </Page>
  );
}
