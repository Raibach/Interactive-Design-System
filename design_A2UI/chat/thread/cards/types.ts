/** The thread's turn types — shared by the cards, the turns and the seat's binding. */
export interface ChatMessage {
  role?: string;
  content?: string;
  /** Which canvas node the turn is about, when it is about one. */
  nodeId?: string;
  /** The small note above a linked turn: what part of the flow it is. */
  label?: string;
  /** An alert, not a remark — drawn with its own ring and wash. */
  alert?: boolean;
  /** A run's result, not chat — drawn as rendered markdown at its own size. */
  result?: boolean;
}

export interface ChatConversation {
  id?: string;
  title?: string;
}
