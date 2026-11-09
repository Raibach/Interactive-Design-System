/**
 * useDesignConsole — THE DESIGN CONSOLE'S ONE READ.
 *
 * The room's frame is the design console's answer: its left application (the card grid), its tree,
 * and the chat entry the shell removes and keeps for itself. This hook owns that request and the
 * facts its answer produces:
 *
 *   - `frame`        the console's tree without its left column (the chat is taken out in the shell);
 *   - `consoleApp`   the console's own left application, ready to place;
 *   - `error`        the door's refusal, in the door's words;
 *   - `coverDown`    the room's cover fact: true once the tree or an error has arrived, or once the
 *                    ten-second dead stop has passed.
 *
 * Nothing here draws. `DesignSeatShell` composes this with the chat and the left column.
 */
import { useCallback, useEffect, useState } from 'react';
import { getStoredUserId } from '@/services/authService';
import { readA2UIEnvelope, envelopeRefusalError } from '@/shared/a2ui-envelope';
import { extractLeft, type Tree } from '@/rooms/design/inject';
import { isCardLocked } from '@/rooms/design/cardLifecycle';

/** The console and the Figma surface name the seat differently; the room reads one name. */
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

export type DesignConsoleApp = {
  leftId?: string;
  components: any[];
};

export type DesignConsoleState = {
  frame: Tree | null;
  consoleApp: DesignConsoleApp | null;
  error: string | null;
  coverDown: boolean;
  /** The shell's own failure — a frame that never drew its layout — is stated through the same door. */
  setError: (message: string) => void;
  /** A saved session's card, placed in the console's own list without re-reading the console. */
  upsertCard: (card: Record<string, any>) => void;
  /** A removed card leaves the console's own list without re-reading the console. */
  removeCard: (cardId: string) => void;
};

export function useDesignConsole(): DesignConsoleState {
  const [frame, setFrame] = useState<Tree | null>(null);
  const [consoleApp, setConsoleApp] = useState<DesignConsoleApp | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* THE COVER IS UP FROM THE ROOM'S FIRST FRAME. `gateDown` means the cover is down, so it starts
     FALSE. It is set by the real facts below, never by a guessed delay. */
  const [gateDown, setGateDown] = useState(false);
  /* THE COVER IS DERIVED, NOT DRIVEN. A state write alone was not reliable: the shell remounts
     while the room's surface settles, and a remount cancels the in-flight effect before its
     `setGateDown(true)` can run. These two facts are the same values the JSX draws from, so either
     one lowers the cover whatever happened to the effect. */
  const coverDown = gateDown || frame !== null || error !== null;
  useEffect(() => {
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/design/console", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-ID": getStoredUserId() },
        });
        const raw = await res.json().catch(() => null);
        /* THE DOOR IS NAMED WHEN IT REFUSES. A bare "Not Found" reads as the room being broken;
           the truth is usually the server not carrying this door yet, and that must be legible
           without reading a log. */
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
        /* THE COVER COMES DOWN ON THE REAL FACT: the assembler's tree has landed. */
        setGateDown(true);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        /* A FAILED LOAD LOWERS THE COVER TOO, so the room's error branch is what the person reads.
           A spinner held over a failure would be the cover outliving the truth. */
        setGateDown(true);
      }
    })();
    /* THE DEAD STOP (the house's ten seconds): if the door never answers, the cover comes down
       anyway and the room shows its real state. A cover may never outlive the truth it stands
       over, and a room must never be left holding a blank. */
    const deadStop = window.setTimeout(() => {
      if (!cancelled) setGateDown(true);
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearTimeout(deadStop);
    };
  }, []);

  /*
   * A SAVED CARD JOINS THE CONSOLE'S LIST IN PLACE. The alternative was to re-read the console on
   * the Home press, which re-runs the console's assembly and redraws the grid the person is about
   * to press — a card that is being pressed can be replaced by the redraw, and the press answers
   * nothing. The save already knows the card; the list is updated from that record, and the grid
   * is not rebuilt. The systems stay first; the kept session is the newest of the sessions.
   */
  const upsertCard = useCallback((card: Record<string, any>) => {
    if (!card || !card.id) return;
    /*
     * A QUEUED CARD IS NOT THE DESIGNER'S WORKSPACE CARD. The console's own read omits
     * Pending_Approval and Queued_For_Share, and a save's answer must follow the same bound:
     * placing it here would make the grid contradict the read it came from. The card is still
     * in the Supervisor Queue; nothing is lost.
     */
    if (card.locked === true || isCardLocked(card.state)) return;
    setFrame((prev) => {
      if (!prev) return prev;
      const model = (prev.dataModel ?? {}) as Record<string, any>;
      const cards = Array.isArray(model.cards) ? (model.cards as Record<string, any>[]) : [];
      const isSystem = (row: Record<string, any>) =>
        String(row?.element_key ?? "").startsWith("system:");
      const systems = cards.filter(isSystem);
      const others = cards.filter(
        (row) => !isSystem(row) && String(row?.id ?? "") !== String(card.id),
      );
      return {
        ...prev,
        dataModel: { ...model, cards: [...systems, card, ...others] },
      };
    });
  }, []);

  const removeCard = useCallback((cardId: string) => {
    if (!cardId) return;
    setFrame((prev) => {
      if (!prev) return prev;
      const model = (prev.dataModel ?? {}) as Record<string, any>;
      const cards = Array.isArray(model.cards) ? (model.cards as Record<string, any>[]) : [];
      const next = cards.filter((row) => String(row?.id ?? "") !== String(cardId));
      if (next.length === cards.length) return prev;
      return { ...prev, dataModel: { ...model, cards: next } };
    });
  }, []);

  return { frame, consoleApp, error, coverDown, setError, upsertCard, removeCard };
}
