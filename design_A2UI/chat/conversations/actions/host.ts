/**
 * THE CONVERSATIONS PLACE'S HOST — the surface its actions are allowed to touch.
 *
 * One file per action; each receives the seat through this contract and the seat passes itself
 * with the same cast the frame uses. The create and the remove processes stay on the seat until
 * the conversation step; these files hold the presses.
 */
export interface ConversationsActionHost {
  _conversationsOpen: boolean;
  _listNote: string;
  _armedDelete: string | null;
  _deleteTimer: ReturnType<typeof setTimeout> | null;
  _creatingConversation: boolean;
  sessionId: string;
  _conversationModule: {
    selectConversation(this: unknown, id: string): void;
    removeConversation(this: unknown, id: string, userId: string): Promise<void>;
  };
  _conv(): unknown;
  _userId(): string;
  _readPackageConversations(userId: string): Promise<void>;
  _createConversation(): Promise<void>;
  _removeConversation(id: string, userId: string): Promise<void>;
  requestUpdate(): void;
}
