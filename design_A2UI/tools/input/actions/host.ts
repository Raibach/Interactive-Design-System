/**
 * THE TOOLS INPUT PLACE'S HOST — the surface its six actions are allowed to touch.
 * The Tools seat has its own copy; only the database is shared with the other seats.
 */
export interface InputActionHost {
  _draft: string;
  _sending: boolean;
  _abort: AbortController | null;
  productTools: boolean;
  _clearDraft(): void;
  _syncBarText(): void;
  _send(text: string, opts?: { silent?: boolean; asked?: boolean }): Promise<void>;
  _forwardProductAttach(files: File[]): void;
}
