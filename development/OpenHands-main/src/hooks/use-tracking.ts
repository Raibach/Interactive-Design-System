/**
 * Shared onboarding-link vocabulary. Kept as plain types for the sidebar
 * checklist and onboarding surfaces; the `useTracking` hook that used to live
 * here is removed (no vendor analytics in this tree).
 */

/** Stable semantic identifier for an onboarding link or CTA. */
export type OnboardingLinkId =
  | "configure_llm"
  | "start_conversation"
  | "schedule_task"
  | "customize_agent"
  | "connect_mcp"
  | "join_slack"
  | "open_docs";

/** Controlled destination category for an onboarding link. */
export type OnboardingLinkDestinationType =
  | "community"
  | "integration"
  | "documentation"
  | "settings"
  | "conversation"
  | "automation";

/** Onboarding surface that presented the link. */
export type OnboardingLinkSurface = "landing_checklist" | "onboarding_modal";
