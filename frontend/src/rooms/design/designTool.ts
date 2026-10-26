/**
 * THE DESIGN ROOM'S OWN ADDRESS FOR ITS APPLICATION.
 *
 * The room frames PostHog under the studio's own origin (`/posthog`), and it lands on the
 * seeded project's Product analytics screen. The path is the ROOM's fact: the left column and
 * the studio's warm-up both read it here, so the address the person sees and the address that
 * is started early cannot drift apart.
 */
import { posthogToolUrl } from '@/shared/appConfig';

export const DESIGN_POSTHOG_LANDING_PATH = '/project/1/insights';

/** Empty string = this build has no address; the room says so and draws nothing. */
export const designPostHogLanding = (): string =>
  `${posthogToolUrl()}${DESIGN_POSTHOG_LANDING_PATH}`;
