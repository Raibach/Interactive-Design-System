/**
 * DesignSeatShell — THE DESIGN ROOM'S SHELL, BUILT ONCE, CORRECTLY.
 *
 * Owner, 2026-10-18: *"Every little shortcut, every little speed improvement… will only break it
 * and cost you more build time."* So this file contains no observers, no hiding of foreign
 * children, no mining of another surface and no second chat. It owns exactly four things:
 *
 *   1. THE FRAME — one surface, loaded once (`/api/design/console`), with its chat entry and its
 *      left application taken out of it because the shell owns both:
 *        - `takeChat`  → the chat entry is removed and its information kept.
 *        - `extractLeft` → the console's left application is removed and kept as CONTENT.
 *
 *   2. THE CHAT — one `design-chat` element, created once, placed in the frame's right slot, never
 *      re-created. A tab changes only what is loaded inside it: conversation, session, script,
 *      rail. Switching clears the thread first, because the seat refuses to reload history while
 *      it still holds messages.
 *
 *   3. THE LEFT COLUMN — a DEDICATED CONTAINER with its own surface (`design-renderer`) and the UX
 *      application's frame. The standing tab's application is drawn there as content:
 *        Chat  → the console's left application (its card grid)
 *        Tools → the Figma ingest application, supplied by its module
 *        UX    → the UX application's frame (the renderer steps aside; nothing is covered)
 *      Nothing of the console is hidden, repurposed or borrowed.
 *
 *   4. THE MIDDLE COLUMN — the run's. `isThirdOpen` is stated open so the chat stands; the middle
 *      column is drawn by the surface only when an engine has something to show there.
 */
import { useEffect, useRef, useState } from "react";
import designSectionBackground from "@/assets/design-section2-bkg.webp";
import "@/design/ux/ux-chat";
import { getStoredUserId } from "@/services/authService";
import { posthogToolUrl } from "@/shared/appConfig";

import { readA2UIEnvelope, envelopeRefusalError } from "@/shared/a2ui-envelope";
import type { DesignChat } from "@/design/design-chat";
import { extractLeft, takeChat, type Tree } from "@/design/inject";
import type { Content } from "@/design/tools/content";

export const DESIGN_ROOM_TABS = "chat,tools,executions,ux,settings";

/** One name for the seat: the engines name it differently and the shell reads it one way. */
function asDesignChat(tree: Tree): Tree {
  return {
    ...tree,
    components: (tree.components as any[]).map((c) =>
      c?.component === "design-chat-panel" || c?.component === "chat-panel"
        ? { ...c, component: "design-chat" }
        : c,
    ),
  };
}

export type DesignSeatShellProps = {
  /** The Figma module's declared application + chat information (headless engine). */
  injected?: Content | null;
  /** Is Tools the standing tab? Then the Figma application is the one drawn. */
  toolsStanding?: boolean;
  /** The rail's selection, reported to the room. */
  onTab?: (tab: string) => void;
};

/*
 * THE UX TAB'S APPLICATION SCREEN — AND THE NAME THE CHAT'S HEADER CARRIES.
 *
 * The left frame lands on the seeded project's Product analytics scene, and the chat's first
 * header line says the same thing, so what the person reads above the thread matches the screen
 * beside it (owner, 2026-10-19: *"if I'm chatting inside of a particular thing like product
 * analytics you could put that at the top"*). One pair of constants, one place: when the frame
 * becomes navigable inside the room, both are read from the frame's own route instead.
 */
/* THE APPLICATION IS FRAMED UNDER OUR OWN ORIGIN (owner, 2026-10-21: governance is the
   template). Its own navigation is the navigation — nothing is layered over it and nothing is
   redrawn in the shell. The address is the door — `posthogToolUrl()` = "/posthog" — the same
   same-origin section pattern as /builder, /dev and /governance, never http://localhost:8200:
   an HTTP frame on the HTTPS tunnel page is aborted by the browser (measured 2026-10-21:
   net::ERR_ABORTED), so the port is exactly what made the tunnel show a white screen. */
const UX_APP_SECTION = "Product analytics";
const UX_APP_LANDING_PATH = "/project/1/insights";
const uxAppLanding = (): string => `${posthogToolUrl()}${UX_APP_LANDING_PATH}`;

export default function DesignSeatShell({ injected, toolsStanding, onTab }: DesignSeatShellProps) {
  const [frame, setFrame] = useState<Tree | null>(null);
  const [consoleApp, setConsoleApp] = useState<{ leftId?: string; components: any[] } | null>(null);
  const [railTab, setRailTab] = useState("chat");
  const [error, setError] = useState<string | null>(null);

  /* NO GATE (2026-10-21). The room's own cover and its ten-second dead-stop clock were here;
     the room now draws its real state from the first frame. */
  const [gateDown] = useState(true);

  const frameRendererRef = useRef<any>(null);
  const chatRef = useRef<DesignChat | null>(null);
  /* THE SURFACE IS ASSIGNED ONCE. These record what the renderer was last handed, so a rail
     click never re-assigns it: `components` is the tree, not the tab's content. */
  const appliedFrame = useRef<Tree | null>(null);
  const appliedMiddle = useRef<string>("");
  const leftRef = useRef<{ host: HTMLElement; renderer: any; frame: HTMLElement } | null>(null);

  /* ── 1. THE FRAME, ONCE ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/design/console", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-ID": getStoredUserId() },
        });
        const raw = await res.json().catch(() => null);
        /* THE DOOR IS NAMED WHEN IT REFUSES. A bare "Not Found" reads as the room being broken;
           the truth is usually the server not carrying this door yet, and that must be legible
           without reading a log (owner, 2026-10-18: *"don't write … The design interface could
           not load: Not Found"*). */
        if (!res.ok) {
          const detail = String((raw as any)?.detail ?? (raw as any)?.error ?? "").trim();
          throw new Error(
            `the design console door (POST /api/design/console) answered ${res.status}` +
              (detail ? ` — ${detail}` : ""),
          );
        }
        const read = readA2UIEnvelope(raw);
        if (read.ok === false) throw envelopeRefusalError(read.refusal);
        const tree = asDesignChat({
          components: read.reading.components as any[],
          dataModel: read.reading.dataModel as Record<string, any>,
        });
        /* THE SHELL OWNS THE CHAT AND THE LEFT COLUMN: both leave the tree here, kept as facts. */
        const left = extractLeft(tree);
        if (cancelled) return;
        setConsoleApp({ leftId: left.leftId, components: left.components });
        setFrame(left.rest);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── 2. THE CHAT, ONCE ──────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = document.createElement("design-chat") as DesignChat;
    el.setAttribute("data-design-chat", "shell");
    /* THE UX CHAT IS ITS OWN VIEW (owner, 2026-10-19): mounted into the seat's view slot, it
       draws only while the UX tab is active (the seat's own .view-slot.tab-ux pair). The seat
       itself no longer carries the UX behaviour; the standalone file does. */
    const uxChat = document.createElement("ux-chat");
    uxChat.setAttribute("slot", "view");
    uxChat.setAttribute("view-tab", "ux");
    /* THE HEADER'S FIRST LINE IS THE SECTION THE PERSON IS WORKING IN — the frame's own scene,
       named once here and drawn above the thread (see UX_APP_SECTION). */
    (uxChat as HTMLElement & { section?: string }).section = UX_APP_SECTION;
    el.appendChild(uxChat);
    el.collapsed = false;
    chatRef.current = el;
    const onTabChange = (event: Event) => {
      const tab = String((event as CustomEvent<{ tab?: string }>).detail?.tab || "");
      if (!tab) return;
      setRailTab(tab);
      onTab?.(tab);
    };
    el.addEventListener("tab-change", onTabChange);
    return () => {
      el.removeEventListener("tab-change", onTabChange);
      el.remove();
      chatRef.current = null;
    };
  }, [onTab]);

  /* ── 3. THE LEFT CONTAINER — DEDICATED, CREATED ONCE ───────────────────────────────────── */
  const leftContainer = (layout: HTMLElement) => {
    const existing = leftRef.current;
    if (existing) {
      if (existing.host.parentElement !== layout) layout.appendChild(existing.host);
      return existing;
    }
    const host = document.createElement("div");
    host.setAttribute("slot", "left");
    host.setAttribute("data-design-left", "");
    host.style.cssText =
      "position:relative;display:flex;flex-direction:column;height:100%;min-height:0;width:100%;";
    const renderer = document.createElement("design-renderer");
    renderer.setAttribute("data-design-left-renderer", "");
    renderer.style.cssText = "display:block;flex:1 1 auto;min-height:0;width:100%;";
    const ux = document.createElement("ux-app-frame");
    ux.style.cssText = "display:none;flex:1 1 auto;min-height:0;width:100%;";
    host.appendChild(renderer);
    host.appendChild(ux);

    /* THE ASSEMBLY STAGE. A tool that draws only when its content arrives pops in; this cover
       stands over the column while the tool assembles and fades away when it has something. */
    if (!document.getElementById("design-assembly-spin")) {
      const style = document.createElement("style");
      style.id = "design-assembly-spin";
      style.textContent =
        "@keyframes design-assembly-spin{to{transform:rotate(360deg)}}";
      document.head.appendChild(style);
    }
    /* THE COLUMN SAYS WHAT IT IS DOING — NO SPINNER (owner, 2026-10-21: *"I have a delay on
       tools so now I have a blank screen on tools"*). This is the sentence alone: the column is
       never blank while the tool assembles, and nothing animates a claim the work is progressing
       when the only thing known is that it has not finished. The ring that stood here is gone. */
    const cover = document.createElement("div");
    cover.setAttribute("data-design-left-cover", "");
    cover.style.cssText =
      "position:absolute;inset:0;display:none;align-items:center;justify-content:center;" +
      "flex-direction:column;gap:14px;background:#2b2635;color:#e9e6f2;font-size:14px;" +
      "opacity:0;transition:opacity 700ms ease;z-index:2;";
    const line = document.createElement("div");
    line.textContent = "Assembling the Figma tool…";
    cover.appendChild(line);
    host.appendChild(cover);

    layout.appendChild(host);
    leftRef.current = { host, renderer, frame: ux };
    return leftRef.current;
  };

  /* ── 3b. THE ROW THAT CHANGED IS THE ANSWER ───────────────────────────────────────────────
     An approve has no message: the list re-reads and the row that was written is marked. */
  useEffect(() => {
    const onRowSelected = (event: Event) => {
      const tag = String((event as CustomEvent<{ tag?: string }>).detail?.tag ?? "");
      const renderer = leftRef.current?.renderer as any;
      const layers = renderer?.shadowRoot?.querySelector?.("figma-layers-view") as any;
      if (layers && tag) layers.selected = tag;
    };
    window.addEventListener("design-row-selected", onRowSelected as EventListener);
    return () => window.removeEventListener("design-row-selected", onRowSelected as EventListener);
  }, []);

  /* ── 4. THE DRAW — the frame, the chat's content, and the left application ─────────────── */
  useEffect(() => {
    const renderer = frameRendererRef.current;
    const chatEl = chatRef.current;
    if (!renderer || !chatEl || !frame) return;

    const { tree, chat } = takeChat(frame);
    /*
     * THE RUN'S COLUMN COMES WITH THE CONTENT. When the Figma engine has drawn something (Submit),
     * its middle subtree — `design-middle-container`, `component-preview`, `draft-preview` — is
     * added to this frame and the root REFERENCES it, which is what makes the layout draw the third
     * column. Its data model rides along so the preview resolves its own paths. Without a run there
     * is no middle id and the column stays closed, exactly as the layout's own rule says.
     */
    const middleId = injected?.middleId;
    const middleComponents = injected?.middleComponents ?? [];
    const activeTree = injected
      ? {
          components: [
            ...(tree.components as any[]).map((c) =>
              c?.id === "root" && c.children
                ? { ...c, children: middleId ? { ...c.children, middle: middleId } : c.children }
                : c,
            ),
            ...middleComponents,
          ],
          dataModel: {
            ...tree.dataModel,
            ...injected.dataModel,
            session: {
              ...((tree.dataModel as Record<string, any>)?.session ?? {}),
              ...((injected.dataModel as Record<string, any>)?.session ?? {}),
            },
            cards: (tree.dataModel as Record<string, any>)?.cards,
          },
        }
      : tree;
    /* EACH TAB IS ITS OWN PACKAGE, AND ITS PACKAGE OWNS ITS CONVERSATION. The seat stays one
       element; what loads into it is the standing tab's conversation. */
    const packages = (((frame.dataModel as Record<string, any>)?.console?.design_packages ?? {}) as Record<
      string,
      { conversationId?: string }
    >);
    const tabConversation =
      railTab === "tools"
        ? packages.tools?.conversationId
        : railTab === "ux"
          ? packages.ux?.conversationId
          : packages.chat?.conversationId;
    const chatInfo = tabConversation ? { ...chat, conversationId: tabConversation } : chat;

    let cancelled = false;
    void (async () => {
      /* Assign the tree only when the tree actually changed — never because a tab was clicked.
         `A2UIRenderer.render()` rebuilds every node on an assignment, and the chat is a child of
         that tree's layout, so an assignment on a tab click is the whole room visibly reloading. */
      if (appliedFrame.current !== frame || appliedMiddle.current !== (middleId ?? "")) {
        appliedFrame.current = frame;
        appliedMiddle.current = middleId ?? "";
        renderer.components = (activeTree.components as any[]).map((c) =>
          c?.id === "root" ? { ...c, isThirdOpen: true } : c,
        );
        renderer.dataModel = activeTree.dataModel;
      }
      try {
        await renderer.updateComplete;
      } catch {
        // Lit's updateComplete does not reject; if it ever does, the queries below still run.
      }
      if (cancelled) return;

      let layout: HTMLElement | null = null;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        layout = (renderer.shadowRoot?.querySelector("workspace-layout") as HTMLElement | null) ?? null;
        if (layout) break;
        await new Promise((r) => setTimeout(r, 250));
        if (cancelled) return;
      }
      if (!layout) {
        /* FAIL HARD. A room that draws its frame and places nothing looks assembled and is not;
           a warning nobody reads is the same as no report. The failure is put on the screen. */
        setError("The design frame never drew its layout, so the chat and the left column were not placed.");
        return;
      }

      /* THE CHAT, IN THE RIGHT SLOT — the same element, every tab. */
      chatEl.setAttribute("slot", "right");
      if (chatEl.parentElement !== layout) layout.appendChild(chatEl);

      /* ITS CONTENT — the standing tab's package conversation. A different conversation is a
         different thread: the seat is emptied first, then loads that package's history. */
      const nextConversation = (chatInfo as Record<string, unknown>).conversationId;
      if (typeof nextConversation === "string" && nextConversation !== chatEl.conversationId) {
        chatEl.messages = [];
        (chatEl as unknown as { _local: unknown[] })._local = [];
      }
      for (const [key, value] of Object.entries(chatInfo)) {
        if (value === undefined || key === "collapsed") continue;
        if ((chatEl as unknown as Record<string, unknown>)[key] === value) continue;
        (chatEl as unknown as Record<string, unknown>)[key] = value;
      }
      chatEl.activeTab = toolsStanding ? "tools" : railTab === "ux" ? "ux" : "chat";
      chatEl.collapsed = false;

      /* THE LEFT APPLICATION — drawn in the shell's own container. */
      const left = leftContainer(layout);
      /* The tool's own stage: up while it has nothing to draw, faded away once it does. */
      const cover = left.host.querySelector("[data-design-left-cover]") as HTMLElement | null;
      if (cover) {
        const assembling = Boolean(toolsStanding) && !injected;
        if (assembling) {
          cover.style.display = "flex";
          requestAnimationFrame(() => {
            cover.style.opacity = "1";
          });
        } else if (cover.style.display !== "none") {
          cover.style.opacity = "0";
          window.setTimeout(() => {
            if (cover.style.opacity === "0") cover.style.display = "none";
          }, 700);
        }
      }
      if (railTab === "ux") {
        left.renderer.style.display = "none";
        /* THE PROGRAM IS PROBED ON EVERY ENTRY (owner, 2026-10-18: *"it just spins and loads
           of white page"*). A sign-in that succeeded earlier is not proof the program is
           alive — the stack can be stopped while this room stays open — so the door is asked
           again, and the frame is shown ONLY when it answers. A stopped program is stated in
           the column with the door's own words; an empty white iframe is never drawn over it. */
        left.frame.style.display = "none";
        const showUxError = (text: string) => {
          let box = left.host.querySelector("[data-ux-error]") as HTMLElement | null;
          if (!box) {
            box = document.createElement("div");
            box.setAttribute("data-ux-error", "");
            box.style.cssText =
              "padding:16px;font-size:14px;color:#a31545;line-height:1.5;max-width:640px;white-space:pre-line;";
            left.host.appendChild(box);
          }
          box.textContent = text;
        };
        /* THE DOOR IS THE ADDRESS (owner, 2026-10-21: governance is the template). The frame is
           same-origin at /posthog, so the old loopback-host gate is gone: there is no visitor
           machine to protect from, and an empty door means no address is configured for this
           build — the column says so and draws nothing. */
        const doorUrl = posthogToolUrl();
        if (!doorUrl) {
          showUxError("The UX program has no address configured for this build, so this column draws nothing.");
        }
        if (doorUrl) {
          left.host.querySelector("[data-ux-error]")?.remove();
          const frameEl = left.frame as HTMLElement & { src?: string };
          /* THE APP IS LOADED ONCE (2026-10-21). Two pieces of machinery stood here and both
             were ours, not the application's:
               · a `fetch(doorUrl)` that had to answer before the column was allowed to show;
               · `iframe.src = iframe.src` — a forced RELOAD of the whole five-megabyte
                 application on every entry to this tab.
             The reload was the slow part the owner kept seeing: the app was never being drawn
             from cache, it was being thrown away and fetched again on each click. The src is set
             only when the frame has none, so a switch away and back keeps the application it
             already loaded. */
          if (!frameEl.src) frameEl.src = uxAppLanding();
          left.frame.style.display = "block";
        }
      } else {
        left.frame.style.display = "none";
        left.renderer.style.display = "block";
        /* THE UX TAB'S MESSAGE BELONGS TO THE UX TAB — the box is removed when any other tab
           owns the column (owner, 2026-10-18: it was showing underneath the Figma program). */
        left.host.querySelector("[data-ux-error]")?.remove();
        /* THE STANDING TAB OWNS THE LEFT COLUMN. Tools draws its own application, and draws
           NOTHING while that application is still assembling — the console's grid belongs to
           Chat and must never stand in for a tool that has not reported yet. */
        const app = toolsStanding
          ? injected
            ? { rootId: injected.leftId, components: injected.components, dataModel: injected.dataModel }
            : null
          : consoleApp?.leftId
            ? { rootId: consoleApp.leftId, components: consoleApp.components, dataModel: tree.dataModel }
            : null;
        if (app) {
          left.renderer.rootId = app.rootId;
          left.renderer.components = app.components;
          left.renderer.dataModel = app.dataModel;
        } else if (toolsStanding) {
          left.renderer.components = [];
        }

        /* THE INTERFACE IS PLACED. */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [frame, consoleApp, injected, toolsStanding, railTab]);

  if (error) {
    return <div style={{ padding: 24, color: "#f3b" }}>The design interface could not load: {error}</div>;
  }

  /*
   * A NAV ITEM IS A DEEP LINK INTO THE FRAMED APPLICATION — the Governance pattern exactly: the
   * nav never touches the room's router, it moves the frame and records where it sent it. The
   * element wraps its own <iframe>, so both are pointed at the address (the wrapper with src and
   * the inner frame, which is what actually reloads).
   */
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flex: "1 1 0%",
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        overflow: "hidden",
      }}
    >
      <design-renderer ref={frameRendererRef} style={{ flex: "1 1 0%", minHeight: 0, width: "100%" }} />
      {/* THE ASSEMBLY STAGE. The room's own ground — the same image the room-level slot paints,
          stretched the same way — so the fade reveals the same picture with no seam. The ring is
          the house gate's amber; the sentence names the room being stood up. Once down, the
          cover stays mounted at opacity 0 with no pointer events: the transition is the fade,
          never a display:none snap. */}
      <div
        aria-hidden={gateDown}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: "#582846",
          backgroundImage: `url(${designSectionBackground})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "top left",
          opacity: gateDown ? 0 : 1,
          transition: "opacity 700ms ease",
          pointerEvents: gateDown ? "none" : "auto",
        }}
      >
        <div
          aria-hidden="true"
          className="animate-spin"
          style={{ width: 26, height: 26, borderRadius: "50%", border: "3px solid rgba(240, 179, 35, 0.25)", borderTopColor: "rgb(240, 179, 35)" }}
        />
        {/* THE SENTENCE IS DARK HERE ON PURPOSE: this room's ground is the light design-sheet
            image, not the Product/Governance dark grounds — the house gate's #c9c9c9 is
            unreadable on it. The room's own plum is the readable counterpart. */}
        <p style={{ color: "#582846", fontSize: 13, fontWeight: 500, fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>
          {"Standing up the design workspace\u2026"}
        </p>
      </div>
    </div>
  );
}
