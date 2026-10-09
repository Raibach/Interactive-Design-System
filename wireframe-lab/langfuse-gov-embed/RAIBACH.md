# langfuse-gov-embed — the hosted Governance room's own build

This folder is the source Northflank builds into the Governance room's web image
(the `langfuse-web` service in project `semantic-design-system`). It is the local
`governance/langfuse-main` tree (Langfuse OSS v4.55.0) carrying the owner-approved
house patches. It lives here because Northflank builds from this repository.

Why it exists: the hosted room must run **our** build, not the stock
`langfuse/langfuse` image — the stock install renders Langfuse's own sidebar and
its vendor front door; this build is the one the owner checked locally.

## The house patches (each carries its own dated comment + explicit REVERT line in place)

| file | patch |
|---|---|
| `web/src/components/nav/AppSidebar/AppSidebar.tsx` | returns null — the app's own sidebar never renders; the studio shell's `GovernanceNav` is the room's only left navigation |
| `web/src/components/ui/sidebar.tsx` | the matching governance-embed note in the sidebar blocks |
| `web/src/utils/numbers.ts` | `costFormatter` 2,2 → 2,6 — micro-dollar cost display |
| `web/src/utils/numbers.clienttest.ts` | the test updated WITH the patch — revert together |
| `web/src/features/traces/components/ObservationMetadataBadgesTooltip.tsx` | `formatMetricCost` 2,3 → 2,6 — the trace header chip |
| `web/src/components/PagedSettingsContainer.tsx` | `asPath` split on `[?#]` — the settings subnav no longer 404s when the path carries a query |

## Build settings — values live on the Northflank service, never here (THE CONFIG RULE)

- Dockerfile: `web/Dockerfile` · build context/workdir: `wireframe-lab/langfuse-gov-embed`
- Build engine: buildkit · build argument: `NEXT_IGNORE_BUILD_ERRORS=1`
- The frame proxy in front of it (frame-ancestors, session-inject, house ground):
  `wireframe-lab/langfuse-frame-proxy/`

## The authoritative working copy stays local

`governance/` (gitignored) keeps the working tree and the local wiring (compose,
the local nginx frame proxy, the local `.env`). This folder carries only what the
hosted build needs, value-free.
