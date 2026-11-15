/**
 * THE CHAT TAB'S COMPONENT TREE, FOR THE MODEL.
 *
 * The first extraction of the behavior split named in RULES.md: the slot names and the element
 * tags the Chat tab binds to them. It is structure only — no drawing, no data, no handlers — so
 * the model, and the next engineer, can read what the tab is made of without opening the
 * 5,000-line seat.
 *
 * The five slots are the frame's and they never move: HEADER, CONVERSATIONS, OUTPUT, INPUT,
 * FOOTER. The tags are the seat's own copies (`design2-*`), so the duplicate and the current
 * Design can never share an element.
 */
export const CHAT_SLOT_TAGS: Record<string, string> = {
  HEADER: 'design2-output-header',
  CONVERSATIONS: 'design2-chat-header',
  OUTPUT: 'design2-chat-header',
  INPUT: 'design2-chat-action-bar',
  FOOTER: 'design2-chat-plugin-tray',
};
