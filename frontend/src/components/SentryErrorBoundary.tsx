/**
 * Error Boundary
 *
 * A production-grade error boundary that:
 *   - Catches rendering crashes anywhere in its child tree
 *   - Logs the full component stack locally (logger → DebugPanel + localStorage)
 *   - Shows a clean, user-friendly fallback UI with a "Try Again" action
 *   - Calls the optional `onError` prop
 *
 * THE NAME STAYS, SENTRY DOES NOT (2026-10-02). This boundary used to be Sentry's
 * `ErrorBoundary` with a `beforeCapture` that tagged a Sentry scope; Sentry is
 * disabled (owner's call — see `lib/sentry.ts`), so the boundary is its own small
 * class component now: catch, log locally, call onError, show the fallback. The
 * name is kept because every import site says `SentryErrorBoundary` and renaming it
 * would touch them all for no behaviour; the file's job never was Sentry — it is
 * that a rendering crash shows a fallback instead of a blank tree.
 */

import { Component, type ErrorInfo, type FC, type ReactNode, useCallback } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

// ── Props ────────────────────────────────────────────────────────────────────

interface SentryErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback; if omitted, the built-in UI is used. */
  fallback?: ReactNode;
  /** Called when an error is caught, after the local log line. */
  onError?: (error: Error, componentStack: string) => void;
  /** Optional label identifying the boundary in the local log. */
  scope?: string;
}

// ── Default fallback UI ──────────────────────────────────────────────────────

const DefaultFallback: FC<{
  error: Error;
  componentStack?: string;
  resetError: () => void;
}> = ({ error, componentStack, resetError }) => {
  return (
    <div
      role="alert"
      className="flex min-h-[320px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-950/20"
    >
      {/* Icon */}
      <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/40">
        <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>

      {/* Message */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
          Something went wrong
        </h2>
        <p className="mt-1 max-w-md text-sm text-red-600 dark:text-red-400">
          {error.message || "An unexpected rendering error occurred."}
        </p>
      </div>

      {/* Retry button */}
      <button
        onClick={resetError}
        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>

      {/* Dev-only: show component stack */}
      {import.meta.env.DEV && componentStack && (
        <details className="mt-2 w-full max-w-lg">
          <summary className="cursor-pointer text-xs text-red-500">
            Component Stack (dev only)
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-red-100 p-3 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">
            {componentStack}
          </pre>
        </details>
      )}

      {/* Dev-only: reload page link */}
      {import.meta.env.DEV && (
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-red-500 underline hover:text-red-700"
        >
          Reload page
        </button>
      )}
    </div>
  );
};

// ── The boundary itself ──────────────────────────────────────────────────────
//
// THE STATE LIVES HERE AND NOWHERE ELSE. `componentDidCatch` runs AFTER the
// fallback render (React calls getDerivedStateFromError first to draw it), so the
// stack recorded for the fallback's dev panel arrives in the same commit and the
// onError callback fires once per crash.

interface BoundaryProps {
  children: ReactNode;
  onError: (error: Error, componentStack: string) => void;
  renderFallback: (error: Error, componentStack: string, resetError: () => void) => ReactNode;
}

interface BoundaryState {
  error: Error | null;
  componentStack: string;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentStack = info.componentStack || "";
    this.setState({ componentStack });
    this.props.onError(error, componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null, componentStack: "" });
  };

  render(): ReactNode {
    if (this.state.error) {
      return this.props.renderFallback(this.state.error, this.state.componentStack, this.reset);
    }
    return this.props.children;
  }
}

// ── The exported boundary ────────────────────────────────────────────────────

export const SentryErrorBoundary: FC<SentryErrorBoundaryProps> = ({
  children,
  fallback,
  onError,
  scope = "app",
}) => {
  const handleError = useCallback(
    (error: Error, componentStack: string) => {
      // Log locally (visible in DebugPanel + localStorage)
      logger.error(`[ErrorBoundary:${scope}] ${error.message}`, {
        stack: error.stack,
        componentStack: componentStack.slice(0, 1000),
      });

      // Call the optional prop callback
      onError?.(error, componentStack);
    },
    [scope, onError],
  );

  return (
    <Boundary
      onError={handleError}
      renderFallback={(error, componentStack, resetError) => {
        if (fallback) return <>{fallback}</>;
        const err = error instanceof Error ? error : new Error(String(error));
        return (
          <DefaultFallback
            error={err}
            componentStack={componentStack}
            resetError={resetError}
          />
        );
      }}
    >
      {children}
    </Boundary>
  );
};

export default SentryErrorBoundary;
