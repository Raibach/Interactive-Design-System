import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import App, { links } from "#/root";
import { server } from "#/mocks/node";
import { __resetActiveStoreForTests } from "#/api/backend-registry/active-store";
import { LOCKED_CLOUD_BACKEND_ID } from "#/api/backend-registry/default-backend";
import { __resetHealthStoreForTests } from "#/api/backend-registry/health-store";
import {
  BACKEND_HEALTH_STORAGE_KEY,
  MAX_CONSECUTIVE_FAILURES,
} from "#/api/backend-registry/health-storage";
import { CLOUD_BACKEND_LOGGED_OUT_ERROR } from "#/hooks/query/use-backends-health";
import { ActiveBackendProvider } from "#/contexts/active-backend-context";

const TRANSLATIONS: Record<string, string> = {
  BACKEND$MANAGE_TITLE: "Manage backends",
  BACKEND$RECONNECT_CLOUD_TITLE: "Reconnect to Cloud",
  BACKEND$RECONNECT_CLOUD: "Reconnect to Cloud",
  BACKEND$MANAGE_EMPTY: "No backends yet.",
  BACKEND$ADD: "+ Add Backend",
  BACKEND$LOG_BACK_IN: "Log back in",
  BACKEND$LOGGED_OUT: "Logged out",
  BACKEND$KIND_LOCAL: "Local",
  BACKEND$KIND_CLOUD: "Cloud",
  BACKEND$EDIT: "Edit",
  BACKEND$REMOVE: "Remove",
  HOME$DONE: "Done",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      let value = TRANSLATIONS[key] ?? key;
      for (const [optionKey, optionValue] of Object.entries(options ?? {})) {
        value = value.replaceAll(`{{${optionKey}}}`, String(optionValue));
      }
      return value;
    },
  }),
}));


const ORIGINAL_LOCATION = window.location;

const RouterStub = createRoutesStub([
  {
    Component: App,
    path: "/",
    children: [
      {
        Component: () => <div data-testid="app-outlet">app outlet</div>,
        path: "/",
      },
      {
        Component: () => (
          <div data-testid="conversation-outlet">conversation outlet</div>
        ),
        path: "/conversations/:conversationId",
      },
    ],
  },
]);

const renderApp = (initialEntries: string[] = ["/"]) =>
  render(<RouterStub initialEntries={initialEntries} />, {
    wrapper: ({ children }) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <ActiveBackendProvider>{children}</ActiveBackendProvider>
      </QueryClientProvider>
    ),
  });

const COOKIE_DEPLOYMENT_ORIGIN = "https://pr-254.staging.openhands.dev";

/**
 * Simulate an OHE-hosted Canvas: served from the locked Cloud host itself, so
 * the single locked backend authenticates with the main-app session cookie.
 * Returns the `window.location.assign` spy that observes login redirects.
 */
function mockLockedCookieDeployment() {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...ORIGINAL_LOCATION,
      origin: COOKIE_DEPLOYMENT_ORIGIN,
      hostname: "pr-254.staging.openhands.dev",
      pathname: "/canvas",
      search: "",
      hash: "",
      assign,
    },
  });
  vi.stubEnv("VITE_LOCK_TO_CLOUD", COOKIE_DEPLOYMENT_ORIGIN);
  vi.stubEnv("VITE_SESSION_API_KEY", "");
  delete (window as unknown as Record<string, unknown>)
    .__AGENT_CANVAS_SESSION_API_KEY__;
  __resetActiveStoreForTests();
  return assign;
}

describe("App root agent-server availability guard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetHealthStoreForTests();
    vi.unstubAllEnvs();
    delete (window as unknown as Record<string, unknown>)
      .__AGENT_CANVAS_AUTH_REQUIRED__;
    delete (window as unknown as Record<string, unknown>)
      .__AGENT_CANVAS_LOCK_TO_CLOUD__;
    (
      window as unknown as Record<string, unknown>
    ).__AGENT_CANVAS_SESSION_API_KEY__ = "test-session-key";
    __resetActiveStoreForTests();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: ORIGINAL_LOCATION,
    });
  });

  it("shows the auth gate when public mode has no backend key", async () => {
    vi.stubEnv("VITE_AUTH_REQUIRED", "true");
    vi.stubEnv("VITE_SESSION_API_KEY", "");
    delete (window as unknown as Record<string, unknown>)
      .__AGENT_CANVAS_SESSION_API_KEY__;
    window.localStorage.clear();
    __resetActiveStoreForTests();

    renderApp(["/"]);

    await waitFor(() => {
      expect(screen.getByTestId("api-key-entry-screen")).toBeInTheDocument();
    });
  });

  it("shows the manage-backends modal when the connected server reports an old version", async () => {
    server.use(
      http.get("*/server_info", () =>
        HttpResponse.json({ uptime: 0, idle_time: 0, version: "1.27.1" }),
      ),
    );

    renderApp(["/"]);

    await waitFor(() => {
      expect(
        screen.getByTestId("agent-server-onboarding-screen"),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("manage-backends-modal")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("app-outlet")).not.toBeInTheDocument();
  });

  it("shows the manage-backends modal when the server omits a version field", async () => {
    server.use(
      http.get("*/server_info", () =>
        HttpResponse.json({ uptime: 0, idle_time: 0 }),
      ),
    );

    renderApp(["/"]);

    await waitFor(() => {
      expect(
        screen.getByTestId("agent-server-onboarding-screen"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("app-outlet")).not.toBeInTheDocument();
  });

  it("shows the manage-backends modal when the backend is unreachable", async () => {
    let serverInfoRequests = 0;

    // Use "*" prefix to match both relative paths and absolute URLs (e.g.,
    // http://127.0.0.1:8000/server_info) when VITE_BACKEND_BASE_URL is configured.
    server.use(
      http.get("*/server_info", () => {
        serverInfoRequests += 1;
        return HttpResponse.error();
      }),
    );

    renderApp(["/"]);

    await waitFor(() => {
      expect(
        screen.getByTestId("agent-server-onboarding-screen"),
      ).toBeInTheDocument();
    });

    // The onboarding placeholder now hosts the Manage Backends modal
    // directly so the user can edit/add a backend immediately. The
    // modal additionally probes /server_info per registered backend
    // for its status dot + version label, so the request count is
    // bounded but greater than the single config probe.
    await waitFor(() => {
      expect(screen.getByTestId("manage-backends-modal")).toBeInTheDocument();
    });
    expect(serverInfoRequests).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId("app-outlet")).not.toBeInTheDocument();
  });

  it("shows the manage-backends recovery modal when the active cloud backend is logged out", async () => {
    const cloudBackend = {
      id: "cloud-expired",
      name: "OpenHands Cloud",
      host: "https://app.all-hands.dev",
      apiKey: "expired-token",
      kind: "cloud",
    };
    window.localStorage.setItem(
      "openhands-backends",
      JSON.stringify([cloudBackend]),
    );
    window.localStorage.setItem(
      "openhands-active-backend",
      JSON.stringify({ backendId: cloudBackend.id, orgId: null }),
    );
    window.sessionStorage.setItem(
      "openhands-active-backend",
      JSON.stringify({ backendId: cloudBackend.id, orgId: null }),
    );
    __resetActiveStoreForTests();
    server.use(
      http.get("https://app.all-hands.dev/api/keys/current", () =>
        HttpResponse.json({ detail: "NoCredentialsError" }, { status: 401 }),
      ),
    );

    renderApp(["/"]);

    await waitFor(() => {
      expect(
        screen.getByTestId("agent-server-onboarding-screen"),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("manage-backends-modal")).toBeInTheDocument();
    expect(screen.getByText("Logged out")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Log back in" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("app-outlet")).not.toBeInTheDocument();
  });

  it("shows locked Cloud reconnect recovery without add-backend controls", async () => {
    vi.stubEnv("VITE_LOCK_TO_CLOUD", "https://app.all-hands.dev");
    const cloudBackend = {
      id: "cloud-expired",
      name: "OpenHands Cloud",
      host: "https://app.all-hands.dev",
      apiKey: "expired-token",
      kind: "cloud",
    };
    window.localStorage.setItem(
      "openhands-backends",
      JSON.stringify([cloudBackend]),
    );
    window.localStorage.setItem(
      "openhands-active-backend",
      JSON.stringify({ backendId: cloudBackend.id, orgId: null }),
    );
    window.sessionStorage.setItem(
      "openhands-active-backend",
      JSON.stringify({ backendId: cloudBackend.id, orgId: null }),
    );
    __resetActiveStoreForTests();
    server.use(
      http.get("https://app.all-hands.dev/api/keys/current", () =>
        HttpResponse.json({ detail: "NoCredentialsError" }, { status: 401 }),
      ),
    );

    renderApp(["/"]);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Reconnect to Cloud" }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("manage-backends-add")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("manage-backends-reconnect-cloud-login-button"),
    ).toHaveTextContent("Reconnect to Cloud");
    expect(screen.queryByTestId("app-outlet")).not.toBeInTheDocument();
  });

  it("renders the routed page when the agent server is reachable", async () => {

    renderApp(["/"]);

    await waitFor(() => {
      expect(screen.getByTestId("app-outlet")).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId("agent-server-onboarding-screen"),
    ).not.toBeInTheDocument();
  });

  it("redirects unauthenticated locked-cookie deployments to main app login", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...ORIGINAL_LOCATION,
        origin: "https://pr-254.staging.openhands.dev",
        hostname: "pr-254.staging.openhands.dev",
        pathname: "/canvas",
        search: "?tab=home",
        hash: "#top",
        assign,
      },
    });
    vi.stubEnv("VITE_LOCK_TO_CLOUD", "https://pr-254.staging.all-hands.dev");
    vi.stubEnv("VITE_SESSION_API_KEY", "");
    delete (window as unknown as Record<string, unknown>)
      .__AGENT_CANVAS_SESSION_API_KEY__;
    server.use(
      http.post("*/api/authenticate", () =>
        HttpResponse.json({ error: "unauthenticated" }, { status: 401 }),
      ),
    );
    __resetActiveStoreForTests();

    renderApp(["/"]);

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(
        "/login?returnTo=%2Fcanvas%3Ftab%3Dhome%23top",
      );
    });
    expect(screen.queryByTestId("app-outlet")).not.toBeInTheDocument();
  });

  it("redirects to main app login when the cookie session expires after the Canvas loaded", async () => {
    // Arrange: the session is valid at load, then expires — the Cloud probe
    // starts returning 401 and the next main-app auth check confirms it.
    const assign = mockLockedCookieDeployment();
    let sessionExpired = false;
    server.use(
      http.post("*/api/authenticate", () =>
        sessionExpired
          ? HttpResponse.json({ error: "unauthenticated" }, { status: 401 })
          : HttpResponse.json({ ok: true }),
      ),
      http.get(`${COOKIE_DEPLOYMENT_ORIGIN}/api/organizations`, () => {
        sessionExpired = true;
        return HttpResponse.json(
          { detail: "Not authenticated" },
          { status: 401 },
        );
      }),
    );

    // Act
    renderApp(["/"]);

    // Assert: main-app login, not the device-flow recovery modal.
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("/login?returnTo=%2Fcanvas");
    });
    expect(
      screen.queryByTestId("manage-backends-modal"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-outlet")).not.toBeInTheDocument();
  });

  it("keeps a valid cookie session on the app when a stale logged-out health entry is persisted", async () => {
    // Arrange: a previous visit left the locked backend persisted as disabled
    // and "Logged out", but the user has since logged back in on the main app.
    const assign = mockLockedCookieDeployment();
    window.localStorage.setItem(
      BACKEND_HEALTH_STORAGE_KEY,
      JSON.stringify({
        [LOCKED_CLOUD_BACKEND_ID]: {
          consecutiveFailures: MAX_CONSECUTIVE_FAILURES,
          lastError: CLOUD_BACKEND_LOGGED_OUT_ERROR,
          lastFailureAt: 1,
          disabled: true,
        },
      }),
    );
    __resetHealthStoreForTests();
    server.use(
      http.get(`${COOKIE_DEPLOYMENT_ORIGIN}/api/organizations`, () =>
        HttpResponse.json({ items: [], current_org_id: null }),
      ),
    );

    // Act
    renderApp(["/"]);

    // Assert: the stale health verdict must not bounce a valid session to
    // /login (which would loop back via returnTo); the app renders instead.
    await waitFor(() => {
      expect(screen.getByTestId("app-outlet")).toBeInTheDocument();
    });
    expect(assign).not.toHaveBeenCalled();
  });

});

describe("App root document links", () => {
  it("declares the SVG favicon used by the browser tab", () => {
    // Act
    const documentLinks = links();

    // Assert
    expect(documentLinks).toContainEqual({
      rel: "icon",
      type: "image/svg+xml",
      href: "/favicon.svg",
    });
  });

  it("prefixes document links when Canvas is mounted under a base path", () => {
    // Arrange
    vi.stubEnv("VITE_BASE_PATH", "/canvas");

    // Act
    const documentLinks = links();

    // Assert
    expect(documentLinks).toContainEqual({
      rel: "icon",
      type: "image/svg+xml",
      href: "/canvas/favicon.svg",
    });

    vi.unstubAllEnvs();
  });
});
