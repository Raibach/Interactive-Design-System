/** The designer's acceptance of an ingest preview: record it before the step stands, and refuse the step when the record fails. */
import { apiFetch } from "@/shared/apiFetch";
import { API_BASE } from "@/shared/apiHelper";

import { sayIngestLine } from "./ingest-chat";

/**
 * The layer name is the identity this act carries. A design that did not name its layer is not
 * accepted, because there would be nothing for the approval queue to match. No node id is read.
 */
export async function acceptIngestPreview(input: {
  preview: Record<string, any> | null;
  conversationId: string;
  tab: string;
  setPreview: (preview: Record<string, any>) => void;
}): Promise<boolean> {
  const { preview, conversationId, tab, setPreview } = input;
  if (!preview?.jobId) return false;

  const layer = String(preview?.name ?? "").trim();
  if (!layer) {
    await sayIngestLine({
      conversationId,
      tab,
      alert: true,
      content: "The acceptance was not recorded: the ingest did not name the layer it read.",
    });
    return false;
  }

  const acceptedLine = await sayIngestLine({
    conversationId,
    tab,
    content:
      "**Accepted.** The drawing is held for approval. " +
      "[Approve & add to catalogue](action:preview-approve) or " +
      "[Discard](action:preview-discard).",
  });
  // No stored line means no accepted state. The failure was said by the line module.
  if (!acceptedLine.stored) return false;

  try {
    const response = await apiFetch(`${API_BASE}/design/acceptance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: String(preview?.sessionId ?? ""),
        layer,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `the server answered ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ""}`,
      );
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await sayIngestLine({
      conversationId,
      tab,
      alert: true,
      content: `The acceptance was not recorded: ${error}. The drawing is not accepted.`,
    });
    return false;
  }

  setPreview({
    ...preview,
    accepted: true,
    status: "Accepted — ready for approval",
    noteLines: ["Accepted. Approve to add it and its children to the catalogue."],
    note: "Accepted. Approve to add it and its children to the catalogue.",
  });
  return true;
}
