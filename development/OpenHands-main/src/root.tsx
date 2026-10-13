import {
  Links,
  LinksFunction,
  Meta,
  MetaFunction,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import "./tailwind.css";
import "./index.css";
import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import {
  clearCachedAgentServerInfo,
  isAgentServerUnavailableError,
  isAgentServerAuthError,
} from "#/api/agent-server-compatibility";
import { isAuthRequiredAndMissing } from "#/api/agent-server-config";
import {
  authenticateWithMainAppCookie,
  redirectToMainAppLogin,
  shouldUseMainAppCookieAuth,
} from "#/api/main-app-auth";
import { getEffectiveLocalBackend } from "#/api/backend-registry/active-store";
import { useActiveBackendContext } from "#/contexts/active-backend-context";
import {
  isCloudBackendApiKeyOrNetworkHealthError,
  isCloudBackendLoggedOutHealthError,
  useBackendsHealth,
} from "#/hooks/query/use-backends-health";
import { TOAST_OPTIONS } from "#/utils/custom-toast-handlers";
import { LoadingSpinner } from "#/components/shared/loading-spinner";
import { useConfig } from "#/hooks/query/use-config";
import { QUERY_KEYS } from "#/hooks/query/query-keys";
import { AgentServerUIRoot } from "#/components/providers";
import { buildAgentCanvasPath } from "#/utils/base-path";
import {
  applyColorTheme,
  COLOR_THEME_BOOTSTRAP_SCRIPT,
  readPersistedColorTheme,
} from "#/themes/color-themes";

/** Applies the persisted palette before paint; useEffect lands a frame late. */
function ColorThemeApplier() {
  React.useLayoutEffect(() => {
    applyColorTheme(readPersistedColorTheme());
  }, []);
  return null;
}

// Only rendered when the active backend is unreachable; keep the modal out of
// the default root graph.
const ManageBackendsModal = React.lazy(() =>
  import("#/components/features/backends/manage-backends-modal").then((m) => ({
    default: m.ManageBackendsModal,
  })),
);

// Rendered when the backend returns 401 (public mode — user must paste key).
const ApiKeyEntryScreen = React.lazy(
  () => import("#/components/features/backends/api-key-entry-screen"),
);

// THE FIRST-RUN ONBOARDING IS DELETED, NOT HIDDEN (owner, 2026-10-11: "the
// onboarding I guess can be removed deleted"). The OnboardingModal lazy and
// the locked-to-Cloud first-run screen that rendered BackendFormModal are both
// gone from this tree, together with the `openhands-onboarded` flag they keyed
// off. A first run now boots straight into the tool.

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{ __html: COLOR_THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body data-agent-server-ui="" className="m-0">
        <AgentServerUIRoot contentClassName="min-h-screen">
          <ColorThemeApplier />
          {children}
          <Toaster toastOptions={TOAST_OPTIONS} />
          <div id="modal-portal-exit" />
        </AgentServerUIRoot>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AgentServerBootstrapLoading() {
  return (
    <main className="min-h-screen px-6 py-10 text-contrast">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center">
        <div className="rounded-3xl border border-contrast/10 bg-base/80 px-8 py-10 shadow-2xl">
          <LoadingSpinner size="large" />
        </div>
      </div>
    </main>
  );
}

/**
 * When the active backend is unreachable, the rest of the app cannot
 * render (most queries chain off of `/server_info`). Drop a minimal
 * placeholder behind the Manage Backends modal so the user can edit,
 * add, or pick another backend right away.
 */
function MissingAgentServerScreen() {
  const queryClient = useQueryClient();

  // The modal is the no-backend gate. Selecting or adding a reachable
  // backend must re-run the /server_info probe; otherwise the app stays
  // behind the recovery screen because the failed bootstrap query will not
  // re-fire on its own. Re-fetch only when a backend now exists.
  const handleClose = React.useCallback(() => {
    if (getEffectiveLocalBackend()) {
      clearCachedAgentServerInfo();
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.WEB_CLIENT_CONFIG,
      });
    }
  }, [queryClient]);

  return (
    <main
      data-testid="agent-server-onboarding-screen"
      className="min-h-screen"
    >
      <React.Suspense fallback={null}>
        <ManageBackendsModal onClose={handleClose} recoveryMode />
      </React.Suspense>
    </main>
  );
}
export const links: LinksFunction = () => [
  {
    rel: "icon",
    type: "image/svg+xml",
    href: buildAgentCanvasPath("/favicon.svg"),
  },
];

export const meta: MetaFunction = () => [
  { title: "Raibach — Agent Canvas" },
  { name: "description", content: "Let's Start Building!" },
];

export default function App() {
  // Flag-based gate: in public mode (VITE_AUTH_REQUIRED=true) with no
  // session key yet, show the auth screen immediately — no network
  // round-trip needed.
  //
  // `isAuthRequiredAndMissing()` only checks for a *baked-in* session
  // key (env var / window global). In public mode the baked key is
  // intentionally absent — the user enters it through the auth screen,
  // which persists it to the backend registry (localStorage). After a
  // reload the baked key is still null, but the registry has the key.
  // So: skip the instant gate when a registered backend already carries
  // an API key — let the normal /server_info probe validate it instead.
  const { active } = useActiveBackendContext();
  const bakedKeyMissing = isAuthRequiredAndMissing();
  const hasRegisteredKey = Boolean(getEffectiveLocalBackend()?.apiKey);
  // When the active backend is cloud, local session-key auth is irrelevant —
  // the cloud backend uses its own bearer token. Skip the API-key entry screen
  // in that case so Docker/public mode doesn't block cloud-only sessions.
  const isActiveCloudBackend = active.backend.kind === "cloud";
  const authMissing =
    bakedKeyMissing && !hasRegisteredKey && !isActiveCloudBackend;
  const queryClient = useQueryClient();
  // THE FIRST-RUN GATE IS DELETED (owner, 2026-10-11). The `openhands-onboarded`
  // flag, the locked-to-Cloud first-run branch and the wizard they selected are
  // all gone from this tree. A first run boots straight into the tool; the
  // auth-required screen and the Manage Backends recovery modal below are what
  // a boot with no usable backend still shows.
  const shouldCheckMainAppAuth = shouldUseMainAppCookieAuth();
  const mainAppAuth = useQuery({
    queryKey: QUERY_KEYS.MAIN_APP_COOKIE_AUTH,
    queryFn: authenticateWithMainAppCookie,
    enabled: shouldCheckMainAppAuth,
    retry: false,
    staleTime: 1000 * 60 * 5,
    meta: { disableToast: true },
  });
  const waitingForMainAppAuth =
    shouldCheckMainAppAuth && mainAppAuth.isPending && !mainAppAuth.isError;
  const redirectingToMainAppLogin =
    shouldCheckMainAppAuth && mainAppAuth.data === false;
  const mainAppAuthAllowsBackendQueries =
    !shouldCheckMainAppAuth || mainAppAuth.data === true || mainAppAuth.isError;

  React.useEffect(() => {
    if (redirectingToMainAppLogin) redirectToMainAppLogin();
  }, [redirectingToMainAppLogin]);

  // Skip the /server_info probe entirely when we already know auth is
  // required and missing — it would just 401 and waste time. (The first-run
  // onboarding that used to suppress this probe as well is deleted.)
  const config = useConfig({
    enabled: !authMissing && mainAppAuthAllowsBackendQueries,
  });
  const activeCloudHealth = useBackendsHealth(
    active.backend.kind === "cloud" && mainAppAuthAllowsBackendQueries
      ? [active.backend]
      : [],
  )[active.backend.id];
  const activeCloudLoggedOut =
    active.backend.kind === "cloud" &&
    activeCloudHealth?.isConnected === false &&
    isCloudBackendLoggedOutHealthError(activeCloudHealth.lastError);
  // Cookie-auth (OHE-hosted) deployments: a logged-out Cloud backend means the
  // main-app session likely expired. Re-run the main-app auth probe and let its
  // verdict drive the /login redirect above; never redirect off the health
  // verdict itself — it can be a stale persisted entry that the recovery
  // modal's one-shot re-probe clears.
  const cookieSessionMaybeExpired =
    shouldCheckMainAppAuth && activeCloudLoggedOut;
  React.useEffect(() => {
    if (!cookieSessionMaybeExpired) return;
    void queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.MAIN_APP_COOKIE_AUTH,
    });
  }, [cookieSessionMaybeExpired, queryClient]);
  // A cloud backend the health probe has given up on (disabled after repeated
  // CORS/network failures) is unreachable from this origin — most commonly a
  // self-hosted OHE that doesn't allow this frontend's origin. Route to the
  // same recovery screen as a logged-out backend so the user sees the real
  // connectivity error, not a misleading "LLM not configured" home page.
  const activeCloudUnreachable =
    active.backend.kind === "cloud" &&
    activeCloudHealth?.disabled === true &&
    isCloudBackendApiKeyOrNetworkHealthError(activeCloudHealth.lastError);

  if (
    waitingForMainAppAuth ||
    redirectingToMainAppLogin ||
    (cookieSessionMaybeExpired && mainAppAuth.isFetching)
  ) {
    return <AgentServerBootstrapLoading />;
  }

  // No key at all → auth screen.
  // Stale key → /server_info 401 → auth screen (public mode only).
  if (authMissing || isAgentServerAuthError(config.error)) {
    return (
      <React.Suspense fallback={<AgentServerBootstrapLoading />}>
        <ApiKeyEntryScreen />
      </React.Suspense>
    );
  }

  if (config.isPending || config.isLoading) {
    return <AgentServerBootstrapLoading />;
  }

  if (
    activeCloudLoggedOut ||
    activeCloudUnreachable ||
    isAgentServerUnavailableError(config.error)
  ) {
    return <MissingAgentServerScreen />;
  }

  return <Outlet />;
}
