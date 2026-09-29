/**
 * A FIGMA NODE ID IS TWO THINGS AT ONCE.
 *
 *     I40001206:3418;40001205:5529
 *     │             │
 *     │             └─ the occurrence — the LOCATION this instance sits in. It is what tells two
 *     │                instances of the same component apart, and it is deliberately not part
 *     │                of the component's identity.
 *     └─ the component reference — the same value for every instance of that component,
 *        wherever it appears in the file.
 *
 * So "is this the same component as the one already in the catalogue?" is answered by the part
 * BEFORE the semicolon and nothing after it, and "which of the several instances is this one?"
 * by what follows. Comparing whole strings answers the first question wrongly: a second instance
 * of a known component looks like a brand-new node, which is how a copy got offered an
 * "overwrite" against a DIFFERENT component's file.
 *
 * (Owner, 2026-09-29: *"That's why we use the numbers after the colon — the ability to
 * distinguish children in other areas although they share the first part of the id. Every
 * trailing four numbers are simply ids for the location, not for the component."*)
 *
 * The full string is what is stored and sent — Figma's own endpoints need it. Only the
 * COMPARISON narrows. The backend holds the same three functions in `routes/figma.py`; they must
 * agree, because a screen that decides "same component" differently from the server that writes
 * the file is how one component's code ends up in another's file.
 */

/** The component part of a node id — everything before the last `;`, lowercased. */
export function nodeIdentity(nodeId?: string | null): string {
  const raw = (nodeId ?? '').trim().toLowerCase();
  const cut = raw.lastIndexOf(';');
  return cut === -1 ? raw : raw.slice(0, cut);
}

/** The occurrence part of a node id — what follows the last `;`, lowercased. Empty when the node is not an instance. */
export function nodeLocation(nodeId?: string | null): string {
  const raw = (nodeId ?? '').trim().toLowerCase();
  const cut = raw.lastIndexOf(';');
  return cut === -1 ? '' : raw.slice(cut + 1);
}

/**
 * Whether two node ids name the same COMPONENT, whatever their occurrences.
 *
 * An empty identity on either side matches nothing: "no node recorded" must not read as
 * agreement.
 */
export function sameComponent(a?: string | null, b?: string | null): boolean {
  const identity = nodeIdentity(a);
  return !!identity && identity === nodeIdentity(b);
}

/**
 * A node id split for a reader: which component it is, and where this instance sits.
 *
 * The occurrence is the LAST segment after `;` on purpose — a longer chain (`I1:2;3:4;5:6`) is
 * still one component reference followed by one location, and only the last `;` separates them.
 */
export function describeNodeId(nodeId?: string | null): { identity: string; location: string; full: string } {
  const full = (nodeId ?? '').trim();
  return { identity: nodeIdentity(full), location: nodeLocation(full), full };
}
