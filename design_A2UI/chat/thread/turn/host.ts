/**
 * THE HOST'S WORDS TO THE THREAD — the four announcements the seat answers.
 *
 * `a2ui:system-message` draws a line without asking her anything; `section-write-failed` says a
 * prompt write landed nowhere, as an alert; `a2ui:ask-grace` asks her to interpret something (a
 * silent turn, whose answer is the reply); `a2ui:grace-status` is the build's own stage, scoped to
 * this seat's conversation. None of them is a person's press.
 */
export interface HostTurnHost {
  _local: unknown[];
  activeTab: string;
  _workStage: string;
  _workActive: boolean;
  _offerOnly: boolean;
  _reviewingRun: boolean;
  _hasResultTurns: boolean;
  _pendingRun: 'asked' | 'approved' | null;
  conversationId?: string | null;
  _releaseQueuedRun(): void;
  _send(text: string, opts?: { silent?: boolean; asked?: boolean }): Promise<void>;
  _scrollThreadToBottom(): void;
  _endWork(): void;
  requestUpdate(): void;
}

/** A2UI:SYSTEM-MESSAGE — a display line in the thread, with the host's own marks carried through. */
export const hostSayAction = (host: HostTurnHost, e: Event): void => {
  const detail = ((e as CustomEvent).detail || {}) as {
    role?: string; content?: string; nodeId?: string; label?: string; alert?: boolean; result?: boolean;
    messageType?: string | null; tab?: string;
  };
  if (!detail.content) return;
  if (detail.tab && detail.tab !== host.activeTab) return;
  host._local = [
    ...host._local,
    {
      role: detail.role === 'user' ? 'user' : 'assistant',
      content: String(detail.content),
      nodeId: detail.nodeId,
      label: detail.label,
      alert: detail.alert === true,
      result: detail.result === true,
      messageType: detail.messageType ?? null,
    },
  ];
  host.requestUpdate();
  host._scrollThreadToBottom();
};

/** SECTION-WRITE-FAILED — the prompt did not change, said as an alert. */
export const writeFailedAction = (host: HostTurnHost, e: Event): void => {
  const detail = ((e as CustomEvent).detail || {}) as {
    target?: string; why?: string; names?: string[];
  };
  const target = String(detail.target ?? 'that');
  const why = String(detail.why ?? 'the write could not be placed');
  const names = (detail.names ?? []).filter(Boolean);
  const held = names.length ? ` The prompt has: ${names.join(', ')}.` : '';
  host._local = [
    ...host._local,
    {
      role: 'assistant',
      content: `⚠️ Nothing was written to "${target}" — ${why}.${held} The prompt is unchanged.`,
      alert: true,
    },
  ];
  host.requestUpdate();
};

/** A2UI:ASK-GRACE — something happened; ask her what it means, silently for the person. */
export const hostAskAction = (host: HostTurnHost, e: Event): void => {
  const detail = ((e as CustomEvent).detail || {}) as { request?: unknown; review?: unknown };
  const request = String(detail.request ?? '');
  if (!request) return;
  host._offerOnly = true;
  // A PACKAGE THAT HAS ALREADY RUN IS NOT REVIEWED AGAIN: the Run is released, no call is made.
  if (detail.review === 'run' && host._hasResultTurns) {
    host._pendingRun = 'approved';
    host._releaseQueuedRun();
    return;
  }
  host._reviewingRun = detail.review === 'run';
  void host._send(request, { silent: true, asked: true });
};

/** A2UI:GRACE-STATUS — the build's stage, scoped to this seat's conversation. */
export const graceStatusAction = (host: HostTurnHost, event: Event): void => {
  const detail = ((event as CustomEvent).detail || {}) as { state?: unknown; conversationId?: unknown };
  const cid = String(detail.conversationId || '');
  if (cid && host.conversationId && cid !== String(host.conversationId)) return;
  const state = String(detail.state || '');
  if (state === 'building') {
    host._workStage = 'building';
    host.requestUpdate();
  } else if (state === 'idle') {
    host._endWork();
  }
};
