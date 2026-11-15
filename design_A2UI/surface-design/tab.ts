/**
 * THE DESIGN A2UI TAB — the seat's own navigation descriptor.
 *
 * The top bar and the mobile drawer are the shell's navigation. They no longer carry this
 * seat's label or its wait sentence: the shell composes them from this file. A change to the
 * tab's name is a change in the seat's folder, never in the universal header.
 */
export const DESIGN2_TAB = {
  id: 'design2',
  label: 'Design A2UI',
  /** Where the top bar places it: immediately after the current Design tab. */
  after: 'design',
  /**
   * THE FLAG IS THE GATE. False until the seat has its own session, container and conversation
   * keys. While it is false the tab is absent from the bar and the drawer, it is not a landable
   * tab, and nothing mounts it. The parity/test run is the only window that sets it true, and it
   * makes no save or message.
   */
  enabled: false,
  /** The shell's wait, owned by the seat because it names the seat. */
  spinner: {
    ringBorder: '3px solid rgba(240, 179, 35, 0.25)',
    ringColor: 'rgb(240, 179, 35)',
    sentence: 'Standing up the Design A2UI workspace\u2026',
    sentenceColor: '#582846',
  },
} as const;
