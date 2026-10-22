/**
 * DesignCards — THE DESIGN CONSOLE'S OWN MOUNT, IN A FILE OF ITS OWN.
 *
 * Owner, 2026-10-18: the design console is a console like the global one — copied whole, named
 * for this room, in its own files. This file is the design console's equivalent of the shell's
 * console slot: it reads the design console's own assembly (`POST /api/design/console`), feeds
 * the returned A2UI envelope to the room's OWN `<a2ui-renderer>` instance, and puts the console
 * host states (its own `DesignConsole` duplicate) BESIDE the renderer — the same pairing the
 * primary console uses.
 *
 * WHAT IT DOES NOT DO: it does not import the primary console's page, does not branch the
 * primary console's assembly, and does not touch the Figma ingestion tool (that belongs to the
 * Tools tab and its files stay whole). A failed read is drawn with the server's own words; no
 * fallback cards, ever.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredUserId } from "@/services/authService";
import { envelopeRefusalError, readA2UIEnvelope } from "@/shared/a2ui-envelope";
import DesignConsole from "@/design/DesignConsole";

interface DesignReading {
  components: unknown[];
  dataModel: Record<string, unknown>;
}

/**
 * THE ROOM'S OWN RAIL — every button the design room had, stated here as well as by the
 * server. The design console copies the console's SURFACE, never its menu: Trace, Executions,
 * Repair and UX stay (the first copy stripped them, and the owner's UX application went with
 * them — 2026-10-18). `ux` is the one this file must also WIRE, because that tab hosts the UX
 * application in the left column (see the swap below).
 */
const DESIGN_ROOM_TABS = "chat,tools,executions,ux,settings";

export default function DesignCards() {
  const rendererRef = useRef<any>(null);
  const [reading, setReading] = useState<DesignReading | null>(null);
  const [cards, setCards] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/design/console", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The package is the person's own; the shell's identity is the one the app already uses.
          "X-User-ID": getStoredUserId(),
        },
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        const detail =
          raw && typeof raw === "object" && "detail" in raw
            ? String((raw as { detail: unknown }).detail)
            : `the design console door answered ${res.status}`;
        throw new Error(detail);
      }
      const read = readA2UIEnvelope(raw);
      if (read.ok === false) {
        throw envelopeRefusalError(read.refusal);
      }
      const next = {
        // ONE CHAT FOR DESIGN (owner, 2026-10-18). The console's surface still names its seat
        // `design-chat-panel`; the room draws `design-chat` — the same element class under the
        // room's own tag. This is the only rename applied to the surface, and it touches no
        // binding: every prop path lands on the same property names.
        components: (read.reading.components as any[]).map((c) =>
          c?.component === "design-chat-panel" ? { ...c, component: "design-chat" } : c,
        ),
        dataModel: read.reading.dataModel,
      };
      setReading(next);
      const nextCards = (next.dataModel as { cards?: unknown }).cards;
      setCards(Array.isArray(nextCards) ? (nextCards as any[]) : []);
    } catch (e) {
      setError((e as Error).message);
      setReading(null);
      setCards(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // THE ASSEMBLY LANDS ON THE ROOM'S OWN RENDERER — assigned as properties, the renderer's
  // documented channel (the same one the shell uses for the console and composer). Once the
  // tree has drawn, this file also wires THE ROOM'S OWN BEHAVIOUR: the rail's full button list
  // and the UX application's host in the left column. That wiring used to live in the shell's
  // design-surface effect; it belongs to this room's file now, and losing it is how the UX
  // application vanished when the console took the room (owner, 2026-10-18).
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !reading) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    /* THE SURFACE IS DRAWN AS ASSEMBLED. The chat is a SURFACE SEAT emitted by this engine's own
       envelope (design-chat, catalogued and registered), and the renderer assembles it in the
       layout. Nothing is lifted out and nothing is bound by hand — that was my interpretation,
       and the architecture's rule is that a surface seat is never interchangeable with a host
       seat (AGENTS-instructions/Core-Concept.md). */
    void (async () => {
      /* THE CHAT COLUMN IS OPEN. `workspace-layout._syncRightPanel` writes `el.collapsed =
         !isThirdOpen` on the seat it hosts (workspace-layout.ts:656), so a surface that arrives
         with `isThirdOpen: false` collapses the chat to its rail. Design's chat stands open in
         every engine; only its middle column waits for a run. */
      renderer.components = (reading.components as any[]).map((c) =>
        c?.id === "root" ? { ...c, isThirdOpen: true } : c,
      );
      renderer.dataModel = reading.dataModel;
      try {
        await renderer.updateComplete;
      } catch {
        // `updateComplete` does not reject in Lit; if it ever does, the query below still runs
        // and reports nothing rather than taking the room down with it.
      }
      if (cancelled) return;
      /* THE ROOM IS QUERIED AFTER ITS OWN RENDER, AND THE QUERY RETRIES: `updateComplete`
         covers the renderer's update, but the layout is a custom element inside its shadow tree
         that upgrades a beat later. The loop is bounded and a miss is SAID, never silent. */
      let roomEl: HTMLElement | null = null;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        roomEl = (renderer.shadowRoot?.querySelector("workspace-layout") as HTMLElement | null) ?? null;
        if (roomEl) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (cancelled) return;
      }
      if (!roomEl) {
        console.warn(
          "[design console] the engine's layout never appeared, so the room's chat was not placed " +
            "and the UX application's host was not wired. The room is on screen but incomplete.",
        );
        return;
      }

      /* THE LINK THE ARCHITECTURE DEFINES: the seat is part of the surface, and the room asserts
         the rail list the room owns. */
      const seat = roomEl.querySelector("design-chat") as
        | (HTMLElement & { allowedTabs?: string; activeTab?: string })
        | null;
      if (seat) {
        seat.allowedTabs = DESIGN_ROOM_TABS;
      }

      /* THE UX APPLICATION OWNS THE LEFT COLUMN WHEN ITS TAB IS SELECTED — driven by the ROOM'S
         chat, whose rail is the room's, so the host lives in this engine's layout and follows the
         room's selection. The swap is BY HIDING, never by removing. */
      const natives = Array.from(
        roomEl.querySelectorAll(':scope > [slot="left"]:not([data-ux-tool-host])'),
      ) as HTMLElement[];
      let uxHost = roomEl.querySelector(':scope > [data-ux-tool-host]') as HTMLElement | null;
      let uxSignInRequested = false;
      /* THE TOOLS ENTRY IS A LAUNCHER, NOT A VIEW OF THIS SEAT (owner, 2026-10-18). It asks the
         room for the Figma engine and hands the selection back to Chat, so returning to the
         console finds the console looking like itself. */
      let toolsRequested = false;
      const syncUxTool = (tab: string) => {
        const inUx = tab === "ux";
        if (tab !== "tools") toolsRequested = false;
        if (tab === "tools" && !toolsRequested && seat) {
          toolsRequested = true;
          window.dispatchEvent(new CustomEvent("design-tools-open"));
          seat.activeTab = "chat";
          return;
        }
        if (inUx && !uxSignInRequested) {
          uxSignInRequested = true;
          /* THE SEAT NEVER SHOWS A LOGIN (the room's rule): the framed application is signed in
             SERVER-SIDE — our backend logs the demo account in and hands the browser the session
             cookie. Asked once per room entry; a refusal is said in the console, never hidden. */
          void fetch("/api/ux/posthog-login", { method: "POST" })
            .then(async (r) => {
              if (!r.ok) {
                console.warn(
                  "[ux] the framed application could not be signed in:",
                  r.status,
                  await r.text(),
                );
              }
            })
            .catch((err) => console.warn("[ux] the sign-in call failed:", err));
        }
        if (inUx && !uxHost) {
          uxHost = document.createElement("div");
          uxHost.setAttribute("slot", "left");
          uxHost.setAttribute("data-ux-tool-host", "");
          uxHost.style.cssText = "display:block;height:100%;min-height:0;width:100%;";
          const frame = document.createElement("ux-app-frame");
          frame.style.cssText = "display:block;height:100%;width:100%;min-height:0;";
          uxHost.appendChild(frame);
          roomEl.appendChild(uxHost);
        }
        if (uxHost) uxHost.style.display = inUx ? "block" : "none";
        for (const native of natives) native.style.display = inUx ? "none" : "";
      };
      const onRoomTab = (event: Event) => {
        syncUxTool(String((event as CustomEvent<{ tab?: string }>).detail?.tab || ""));
      };
      syncUxTool("chat");
      if (seat) {
        seat.addEventListener("tab-change", onRoomTab);
        cleanups.push(() => seat.removeEventListener("tab-change", onRoomTab));
      }
    })();
    return () => {
      cancelled = true;
      for (const off of cleanups) off();
    };
  }, [reading]);

  return (
    <div
      style={{
        display: "flex",
        flex: "1 1 0%",
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* THE ROOM'S OWN RENDERER — `design-renderer`, a tag of Design's own (design/design-renderer.ts).
          Its own instance; the composer's `<a2ui-renderer>` is never drawn here. */}
      <div style={{ flex: "1 1 0%", minWidth: 0, minHeight: 0, height: "100%", overflow: "hidden", position: "relative" }}>
        <design-renderer ref={rendererRef}></design-renderer>
      </div>
      <DesignConsole
        aiAssembledCards={cards}
        isParentLoading={loading && cards === null}
        loadingMessage="Loading the design console…"
        errorMessage={error}
        refreshKey={cards ? 1 : 0}
        onRetry={() => void load()}
        onOpenPrompt={(sessionId) => {
          // A design card opens the design room on that element — never the primary console's
          // package path. The event is the catalogue's own; the room decides what it means.
          window.dispatchEvent(new CustomEvent("design-card-open", { detail: { sessionId } }));
        }}
      />
    </div>
  );
}
