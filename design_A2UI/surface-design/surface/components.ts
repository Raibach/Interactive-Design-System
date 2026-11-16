/**
 * THE SURFACE'S TREE — the frame, the containers, the slots and the tab's own rows, built from the
 * console's ONE answer.
 *
 * This is the STRUCTURE half of the A2UI rule. The door sends one root with `left`, `middle` and
 * `right`; this file selects which of the tab's parts stand in those children. It does not cut the
 * chat or the left application out of the tree: removing them is what made two drawings stand
 * beside each other instead of one surface.
 *
 * THE SEAT'S OWN ELEMENTS ARE REGISTERED HERE. A name in the surface's registry is only true if an
 * element answers it, so this module imports the seat's own component files for their side effect:
 * the frame, the console's card grid, the left foot. A surface that names a tag nothing registers
 * is a refusal the renderer reports by name, and importing the components here is what keeps that
 * from happening.
 *
 * THE KEY IS THE CHANGE TEST. The tree is rebuilt on every render, so object identity of the built
 * array says nothing; `surfaceKey` gives each SOURCE object (the console's tree, the Tools report)
 * a stable number and combines it with the facts that change the tree. The shell assigns a tree
 * only when the key changed; the data model is assigned on every draw.
 *
 * A TAB PRESS SENDS THE TAB'S ROWS. The key includes the tab because the tab's furniture differs;
 * the frame and its regions keep their ids and placements, so Lit reuses the frame element. The
 * standard has no vocabulary for selecting a subtree by a value, so the structure message is the
 * honest way to change the rows; A2UI.md states this amended rule.
 */
import { posthogToolUrl } from '@/shared/appConfig';
import { normalizeLegacyChildren } from '@/shared/a2uiChildren';
import { toolsSessionId } from '@design2/tools/session';
import { DESIGN_POSTHOG_LANDING_PATH } from './left-container/design-tool';
import './frame/workspace';
import '../../chat/left/card-grid';
import './left-container/footer';

import type { Tree } from './load';
import type { Content } from '@design2/tools/content';
import { surfaceDataModel, SURFACE_PATHS, type SurfaceState } from './data';

/** The frame's slots, as the door names them. The frame draws a slot when the tree fills it. */
export const SURFACE_FRAME_SLOTS = ['left-header', 'left', 'left-footer', 'middle', 'right'] as const;

/** The right column's five boxes. The seat draws them inside its own shadow DOM. */
export const SURFACE_RIGHT_SLOTS = ['rail', 'readout', 'view', 'input', 'tray'] as const;

/** The foot the Tools tab and the UX tab name; it draws the session's Save control. */
export const SURFACE_FOOT_ID = 'left-footer';

/** The names the surface may use for the tab's chat. One chat, whatever the tab is. */
const CHAT_COMPONENTS = new Set([
  'chat-panel',
  'design-chat-panel',
  'console-chat-panel',
  'composer-chat-panel',
  'design-chat',
]);

/** WHICH CHAT THIS TAB DRAWS. The name is the wire name; the registry turns it into the tag. */
const CHAT_NAME_BY_TAB: Record<string, string> = {
  chat: 'chat-panel',
  tools: 'tools-chat',
  ux: 'ux-chat',
  /* THE APPROVE TAB DRAWS THE ROOM'S ONE CHAT, like Home and Settings: the console's chat reading
     the console's conversation. A tab gets a name of its own here only when a real conversation
     stands behind it — a hand-written element that looks like a chat is a picture, not a seat. */
  approvals: 'chat-panel',
  executions: 'chat-panel',
  settings: 'chat-panel',
};

/** The UX tab's application frame, and the two parts of its left column. */
const UX_FRAME_ID = 'ux-app';
const UX_ERROR_ID = 'ux-error';

const UX_APP_LANDING_PATH = DESIGN_POSTHOG_LANDING_PATH;
const uxAppLanding = (): string => `${posthogToolUrl()}${UX_APP_LANDING_PATH}`;

export type SurfaceTree = {
  /** The flat component list, exactly the shape the renderer draws. */
  components: unknown[];
  /** The model the props bind against. */
  dataModel: Record<string, unknown>;
  /** The identity of what was built; unchanged means the drawn tree still stands. */
  key: string;
};

export type SurfaceTreeInput = {
  /** The console's whole tree: frame, left, middle and right. */
  tree: Tree;
  /** Is the Tools tab standing? Then its report says what the left and middle serve. */
  isTools: boolean;
  /** The Tools report, when the Tools tab has one. */
  injected?: Content | null;
  /** The surface's own values — the active item, the session and the rest of `/surface/*`. */
  surface?: Partial<SurfaceState>;
};
/* A stable number per source object. Weak, so a replaced tree is collectable; small, so a key is
   one short string. The counter never resets, so two different objects can never share a number. */
const sourceIds = new WeakMap<object, number>();
let nextSourceId = 1;
function sourceId(value: object | null | undefined): number {
  if (!value) return 0;
  const seen = sourceIds.get(value);
  if (seen) return seen;
  const id = nextSourceId++;
  sourceIds.set(value, id);
  return id;
}

/** The identity of a surface: the console's tree, the tab, the Tools report and the two children. */
export function surfaceKey(
  input: SurfaceTreeInput,
  tab: string,
  left: unknown,
  middle: unknown,
): string {
  return `${sourceId(input.tree)}:${tab}:${input.isTools ? 'tools' : 'room'}:`
    + `${sourceId(input.injected as object | null)}:${String(left ?? '')}:${String(middle ?? '')}`;
}

/**
 * BUILD THE SURFACE'S TREE.
 *
 * The root is the door's own frame node and keeps its id; what changes is its children. The tab's
 * chat is the right child, its left application is the left child, and the Tools tab's run column
 * is the middle child. The chat's own props are bindings to `/surface/*`, not values resolved here.
 */
export function buildSurfaceTree(input: SurfaceTreeInput): SurfaceTree {
  const { tree, isTools, injected } = input;
  const tab = String(input.surface?.tab ?? '');
  const lockedTools = Boolean(isTools && injected?.locked === true);

  /* THE TOOLS DATA, UNDER THE SAME ROOT — the middle column's components bind their paths against
     it. The console's own keys are kept; the tool's session wins where both speak. */
  const merged = isTools && injected
    ? {
        ...tree.dataModel,
        ...injected.dataModel,
        session: {
          ...((tree.dataModel as Record<string, unknown> | undefined)?.session as object | undefined),
          ...((injected.dataModel as Record<string, unknown> | undefined)?.session as object | undefined),
        },
        cards: (tree.dataModel as Record<string, unknown> | undefined)?.cards,
      }
    : tree.dataModel;

  /*
   * THE PAGE'S OWN PACKAGE AND ITS OWN CONVERSATION — ONE PAIR, STATED HERE, FOR EVERY TAB.
   *
   * A conversation belongs to a package AND to one tab (THE_CONVERSATION_CONTRACT §1), so the
   * two ids are one fact and this file is their one writer. The seat used to fall back to the
   * newest row of whatever list it could read, which is how Home was handed the `chat` package's
   * thread while it stood on the console's package — and the seat then refused it, correctly:
   * "This conversation is not this seat's … belongs to another tab."
   *
   * WHAT EACH TAB READS, and why (the archived room's own rule, 31b4b71c):
   *   Home / Approve / Settings  the CONSOLE package and its conversation. Home is the design
   *                              console's chat — the filter over the console cards — not the
   *                              separate `chat` design-tab row ("the separate chat package is
   *                              not a second source for it").
   *   Tools                      the working row its own answer named (`design_session_id`) and
   *                              the conversation beside it in that answer.
   *   UX                         the row a card opened, or the UX tab's own package, and the
   *                              conversation that package holds.
   */
  const packages = ((merged as Record<string, any>)?.console?.design_packages ?? {}) as Record<
    string,
    { packageId?: string; conversationId?: string }
  >;
  const sessionId =
    tab === 'tools'
      ? toolsSessionId(merged)
      : tab === 'ux'
        ? (String(input.surface?.sessionId ?? '') || String(packages.ux?.packageId ?? ''))
        : String(packages.console?.packageId ?? (merged as Record<string, any>)?.console?.session_id ?? '');
  const conversationId =
    tab === 'tools'
      ? String(((merged as Record<string, any>)?.session?.right_column?.conversation_id) ?? '')
      : tab === 'ux'
        ? String(packages.ux?.conversationId ?? '')
        : String(packages.console?.conversationId ?? (merged as Record<string, any>)?.console?.conversation_id ?? '');

  const model: Record<string, unknown> = {
    ...(merged as Record<string, unknown>),
    ux: {
      ...(((merged as Record<string, any>)?.ux as object | undefined) ?? {}),
      app_url: uxAppLanding(),
    },
  };
  const dataModel = surfaceDataModel(model, {
    ...(input.surface ?? {}),
    tab,
    sessionId,
    conversationId,
  });

  /*
   * THE DOOR'S TREE IS READ, NEVER WRITTEN. Every row this file changes is a COPY of the row it
   * read. The first version wrote into the door's own objects: a Tools visit set the root's
   * `left` and `left-footer` on the shared node, and the next tab inherited them and named two
   * components its tree did not carry — the surface drew "No component with id design-left" and
   * the rail went with it. A copy per build means a tab's children are its own.
   */
  const source = tree.components as Record<string, any>[];
  const components = source.slice();
  const rootIndex = components.findIndex((entry) => String(entry?.id) === 'root');
  const rootSource = rootIndex >= 0 ? components[rootIndex] : undefined;

  /*
   * THE ROOT'S CHILDREN AND THE REGIONS THEY STAND IN. The door sends the standard array plus a
   * `placements` map; an older answer may still send `children` as an object keyed by region, so
   * both are read here into one pair and written back only in the declared form. The array is the
   * standard's ChildList; the map names the region each id stands in, and the catalogue declares
   * the regions the frame draws.
   */
  const childIds = new Set<string>(
    Array.isArray(rootSource?.children)
      ? (rootSource.children as unknown[]).filter((id): id is string => typeof id === 'string')
      : [],
  );
  const placements: Record<string, any> = {
    ...((rootSource?.placements as Record<string, any> | undefined) ?? {}),
  };
  if (rootSource?.children && !Array.isArray(rootSource.children)) {
    for (const [region, value] of Object.entries(rootSource.children as Record<string, unknown>)) {
      placements[region] = value;
      if (typeof value === 'string') {
        childIds.add(value);
      } else if (Array.isArray(value)) {
        // A region holding a list is the older form's one hole with several children. The ids are
        // kept in `children`; the renderer reports them if the element's regions hold one child.
        for (const id of value) if (typeof id === 'string') childIds.add(id);
      }
    }
  }
  /*
   * A REGION REPLACED TAKES ITS OLD CHILD OUT OF THE LIST. The door's array names every child the
   * console drew; when a tab puts its own application in that region, the console's child is no
   * longer placed anywhere and would otherwise stay in `children` as an unplaced node the renderer
   * reports. The old object form dropped the key and the child with it; this keeps that rule.
   */
  const place = (region: string, id: string) => {
    const previous = placements[region];
    placements[region] = id;
    childIds.add(id);
    if (typeof previous === 'string' && previous !== id
      && !Object.values(placements).includes(previous)) {
      childIds.delete(previous);
    }
  };
  const unplace = (region: string) => {
    const previous = placements[region];
    delete placements[region];
    if (typeof previous === 'string' && !Object.values(placements).includes(previous)) {
      childIds.delete(previous);
    }
  };

  /* THE CHAT IS ONE NODE OF THE TREE. Its props are the door's bindings, with the session, the
     conversation and the active item read from `/surface/*` — the surface's own values. */
  const chatIndex = components.findIndex((entry) =>
    CHAT_COMPONENTS.has(String(entry?.component ?? '')),
  );
  let chat: Record<string, any> | undefined;
  if (chatIndex >= 0) {
    chat = { ...(components[chatIndex] as Record<string, any>) };
    components[chatIndex] = chat;
    place('right', String(chat.id));
    chat.component = isTools ? 'tools-chat' : (CHAT_NAME_BY_TAB[tab] ?? 'chat-panel');
    chat.sessionId = { path: '/surface/session_id' };
    chat.conversationId = { path: '/surface/conversation_id' };
    chat.activeTab = { path: '/surface/tab' };
    chat.dataModel = { path: '/' };
    chat.railOwnedByHost = true;
    if (chat.graceLiveContext === undefined) chat.graceLiveContext = false;
    delete chat.collapsed;
    if (isTools && injected?.chat) {
      for (const [key, value] of Object.entries(injected.chat as Record<string, unknown>)) {
        if (
          key === 'id'
          || key === 'component'
          || key === 'children'
          || key === 'props'
          || key === 'sessionId'
          || key === 'conversationId'
          || key === 'activeTab'
          || key === 'dataModel'
          || key === 'collapsed'
        ) continue;
        chat[key] = value;
      }
    }
    if (tab === 'chat') {
      chat.instructions = { path: '/console/chat_tab_grace_instructions' };
    }
    if (isTools) {
      delete chat.designPackages;
      delete chat.conversations;
    }
  }

  /* THE UX TAB'S LEFT COLUMN IS THE APPLICATION FRAME. Its address comes from the surface's own
     data; a build with no address draws the sentence instead of an empty frame. */
  if (tab === 'ux') {
    const url = uxAppLanding();
    if (url) {
      place('left', UX_FRAME_ID);
      components.push({
        id: UX_FRAME_ID,
        component: 'ux-app-frame',
        src: { path: '/ux/app_url' },
      });
    } else {
      place('left', UX_ERROR_ID);
      components.push({
        id: UX_ERROR_ID,
        component: 'Text',
        text: 'The UX program has no address configured for this build, so this column draws nothing.',
      });
    }
  }

  /*
   * THE APPROVE TAB IS THE GATE, AND NOTHING ELSE (owner, 2026-11-16).
   *
   * *"let's remove the fake approval cards that are inside of the chat and just replace it with a
   * standard conversation … I've added cards to the left that need approval."* So the left column
   * is the console's OWN card grid, bound to the cards waiting for an answer
   * (`/approval_cards` — Figma cards in Pending_Approval), and the right column is the ordinary
   * chat. The review list that used to fill the chat's view slot is gone from this tab: it drew
   * `design_records` sample rows, not the person's cards.
   *
   * The console remains the catch-all (`/cards`): a pending card is drawn there too, with its
   * state and its lock, so no work ever vanishes from the room that made it.
   */
  if (tab === 'approvals') {
    const gridIndex = components.findIndex(
      (entry) => String(entry?.id) === String(placements.left)
        || String(entry?.component ?? '') === 'ConsoleCardGrid',
    );
    if (gridIndex >= 0) {
      const grid = { ...(components[gridIndex] as Record<string, any>) };
      grid.items = { path: '/approval_cards' };
      components[gridIndex] = grid;
    }
    /* THE CHAT DRAWS ITS OWN CONVERSATION. The door names a findings view for its view slot; on
       this tab the person asked for the conversation and nothing beside it. */
    if (chat) {
      delete chat.children;
      delete chat.placements;
    }
  }

  /* THE TOOLS TAB'S OWN COLUMNS, AND NOT THE CONSOLE'S. */
  if (isTools) {
    if (injected?.leftId && !lockedTools) {
      place('left', injected.leftId);
      for (const entry of injected.components ?? []) components.push(entry);
    } else {
      unplace('left');
    }
    if (injected?.middleId && !lockedTools) {
      place('middle', injected.middleId);
      for (const entry of injected.middleComponents ?? []) components.push(entry);
    } else {
      unplace('middle');
    }
    if (injected && !lockedTools) {
      place('left-footer', SURFACE_FOOT_ID);
      components.push({
        id: SURFACE_FOOT_ID,
        component: 'design-left-footer',
        busy: { path: '/session/saving' },
        result: { path: '/session/save_result' },
        /* THE COMPONENT THE TREE HAS OPEN — the Delete control stands beside Save only while one
           is selected (owner, 2026-11-16). The tree writes `design_selected` on every row press. */
        selected: { path: '/session/design_selected' },
      });
    } else {
      unplace('left-footer');
    }
  }

  /* THE UX TAB'S FOOT IS THE SAME FURNITURE, WITHOUT THE NEXT-SESSION CONTROL. */
  if (tab === 'ux') {
    place('left-footer', SURFACE_FOOT_ID);
    components.push({
      id: SURFACE_FOOT_ID,
      component: 'design-left-footer',
      hideNew: true,
    });
  }

  /* The old region-keyed child maps become the standard array + placements before the tree
     leaves this file. The same conversion runs in the official Lit drop-in for every room. */
  normalizeLegacyChildren(components);

  /*
   * A REGION NAMES A COMPONENT THE TREE CARRIES. The array and its placements are composed here,
   * in the browser, from the door's answer and the tab's own rows — so a region that names nothing
   * is this file's own error, and it used to reach the renderer as "No component with id …
   * Referenced by root", which drew its error panel in place of the whole room. A region with
   * nothing behind it is empty, and an empty column is what that tab actually has.
   */
  const carried = new Set(components.map((entry) => String(entry?.id)));
  const rootChildren = [...childIds].filter((id) => carried.has(String(id)));
  for (const [region, value] of Object.entries(placements)) {
    if (typeof value === 'string' && !carried.has(value)) delete placements[region];
  }

  if (rootIndex >= 0 && rootSource) {
    components[rootIndex] = {
      ...rootSource,
      children: rootChildren,
      placements,
      /* THE LEFT COLUMN'S TWO TOOLS FACTS ARE VALUES, NOT HOST WRITES. The shell used to reach
         into the drawn frame and set these two properties; they now travel on the channel every
         other fact uses, and the frame's own binding carries them to the element. */
      leftLedgerText: { path: SURFACE_PATHS.leftLedgerText },
      leftAssembling: { path: SURFACE_PATHS.leftAssembling },
    };
  }
  const unique = components.filter(
    (entry, index, all) =>
      all.findIndex((row) => String(row?.id) === String(entry?.id)) === index,
  );

  return {
    components: unique,
    dataModel,
    key: surfaceKey(input, tab, placements.left, placements.middle),
  };
}
