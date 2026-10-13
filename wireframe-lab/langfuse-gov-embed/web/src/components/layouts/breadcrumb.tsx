// RAIBACH IDS (2026-10-12): the shell owns navigation — the in-content
// org/project/page breadcrumb strip is removed at the source; nothing renders,
// on any page (the same treatment the app sidebar got before it). The body was
// deleted with the removal — no dead code, no disabled checks, no fallback: if
// something here ever needs to come back, restore the full component (imports
// included) from the pre-2026-10-12 revision.
// REVERT: restore the full component above this stub.
type BreadcrumbComponentProps = {
  items?: { name: string; href?: string }[];
  className?: string;
};

const BreadcrumbComponent = (_props: BreadcrumbComponentProps) => {
  return null;
};

export default BreadcrumbComponent;
