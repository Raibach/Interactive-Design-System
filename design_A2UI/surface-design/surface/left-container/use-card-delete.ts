/** The design room's card delete: archive the card and leave its row, conversations, and activity in place. */
import { useCallback } from "react";

import { apiFetch } from "@/shared/apiFetch";
import { API_BASE } from "@/shared/apiHelper";

/**
 * The route archives the session; the conversations are never touched first. The request carries
 * no permanent flag, because the design room has no permanent delete: the row and its record stay.
 */
export function useCardDelete({
  removeCard,
  tab,
}: {
  removeCard: (cardId: string) => void;
  /** The tab the failure is said in: the console's own, or Tools when that page stands. */
  tab: string;
}) {
  return useCallback(
    async (cardId: string) => {
      try {
        const response = await apiFetch(
          `${API_BASE}/prompt-sessions/${encodeURIComponent(cardId)}`,
          { method: "DELETE" },
        );
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            `the server answered ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ""}`,
          );
        }
        removeCard(cardId);
      } catch (e) {
        window.dispatchEvent(
          new CustomEvent("a2ui:system-message", {
            detail: {
              role: "assistant",
              content: `The card could not be removed: ${
                e instanceof Error ? e.message : String(e)
              }. It is still on the console.`,
              alert: true,
              tab,
            },
          }),
        );
      }
    },
    [removeCard, tab],
  );
}
