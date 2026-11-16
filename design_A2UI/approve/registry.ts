/**
 * THE APPROVE TAB'S REGISTRY ENTRIES — the review list.
 *
 * The Approve tab draws no seat of its own yet. It names `chat-panel`, the room's one chat, and
 * this file declares only the reviewer's surface beside it. An entry here is a promise that an
 * element answers the tag; a name with no element behind it is a silent empty column.
 */
import type { SurfaceRegistryEntry } from '../surface-design/registry';

export const APPROVE_REGISTRY: Record<string, SurfaceRegistryEntry> = {
  'review-view': {
    tag: 'design2-review-view',
    surface: 'design',
    description:
      'THE APPROVALS SURFACE: the sessions sent for review, the detail and the queue.',
    props: {
      sessionId: { type: 'string', optional: true },
      reviewId: { type: 'string', optional: true },
    },
    events: ['design-approval-count'],
  },
};
