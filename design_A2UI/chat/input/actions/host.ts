/**
 * THE INPUT PLACE'S HOST — the surface its six actions are allowed to touch.
 *
 * Each action is its own file and receives the seat through this interface. The seat passes
 * itself with a cast, the same bridge the frame uses: the fields are private on the element and
 * public on the contract, and the cast is the one place that difference is stated.
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
