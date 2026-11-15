/**
 * CLEAR THE SESSIONS LANE — the feed's own clear. The rows, the receipt and the refusal go; the
 * feed redraws its empty state. Nothing is written to a conversation.
 */
export interface SessionsLaneHost {
  _laneRows: unknown;
  _laneReceipt: string;
  _laneError: string;
  requestUpdate(): void;
}

export const sessionsLaneClearAction = (host: SessionsLaneHost): void => {
  host._laneRows = null;
  host._laneReceipt = '';
  host._laneError = '';
  host.requestUpdate();
};
