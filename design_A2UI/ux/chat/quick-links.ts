/**
 * THE UX TAB'S QUICK LINKS.
 *
 * ROLLED BACK 2026-10-19 ("undo everything, take it all back to the beginning"). The file the
 * previous AI had written — `UX_QUICK_LINKS`, a list of invented chips — was deleted and
 * recreated during the session, and the deleted copy was not kept anywhere, so its exact labels
 * could not be restored. Rather than invent new ones, this carries only the two commands the
 * chat actually runs: /new and /download.
 */
export interface UxQuickLink {
  label: string;
  command: string;
}

export const UX_QUICK_LINKS: UxQuickLink[] = [
  { label: 'New chat', command: '/new' },
  { label: 'Download this chat', command: '/download' },
];
