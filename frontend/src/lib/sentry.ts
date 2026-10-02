/**
 * SENTRY IS OFF — and this file is why there is nothing to see.
 *
 * Owner, 2026-10-02: "you can disable sentry, I'm not really using it. And we don't
 * really need it if it's causing any delay at all — disable it."
 *
 * WHY IT COST MORE THAN IT GAVE. The @sentry/react family (replay, tracing,
 * profiling, the router integration) was the single biggest weight in the boot
 * bundle — the majority of a 723 KB vendor chunk, on the critical path the sign-in
 * gate waits for. And session replay UPLOADED continuously: 10% of all sessions,
 * and 100% of sessions that saw an error, in every open tab — measured during the
 * same hours the owner was diagnosing bandwidth spikes and slow loads. The reporter
 * was part of the noise it was meant to explain.
 *
 * WHAT THIS MODULE IS NOW. The app's single Sentry surface, with Sentry removed:
 * the same members the call sites use, as no-ops, so every `Sentry.captureException`
 * and `Sentry.setUser` in the codebase still compiles and still does the LOCAL half
 * of its job (the logger writes; the error boundary shows its fallback and calls
 * onError). Zero `@sentry/*` imports live in the frontend now — that is the point:
 * with no imports the package leaves the bundle, so no byte of it is downloaded and
 * no event, breadcrumb or replay is ever uploaded. `isSentryReady()` is false, and
 * nothing treats that as a failure any more — main.tsx's old degraded-guard is gone,
 * because off is the intended state, not a degradation.
 *
 * TO BRING IT BACK: the complete configuration (DSN, replay and tracing rates, every
 * integration) is the previous revision of this file in git history, plus the DSN
 * line in `.env.production`. Reverting that change restores both.
 */

/** The breadcrumb levels the logger maps onto; kept so `Sentry.SeverityLevel` still resolves as a type. */
export type SeverityLevel = "debug" | "info" | "warning" | "error" | "fatal";

/** False by design — Sentry is disabled, not broken. */
export const isSentryReady = (): boolean => false;

/** Local breadcrumbs are the logger's job; there is no remote scope to fill. */
export const addBreadcrumb = (..._args: unknown[]): void => {};
export const setContext = (..._args: unknown[]): void => {};
export const setUser = (..._args: unknown[]): void => {};

/** The local half of every capture already happened at the call site (console.error / logger). */
export const captureException = (..._args: unknown[]): void => {};
