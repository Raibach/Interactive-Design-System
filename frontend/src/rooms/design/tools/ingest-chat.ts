/** One line in the ingest's conversation, persisted before it is drawn. */
import { apiFetch } from "@/shared/apiFetch";
import { API_BASE } from "@/shared/apiHelper";

export interface IngestLineResult {
  /** True only when the line exists in the conversation record. */
  stored: boolean;
  /** The reason the write failed, empty when it did not. */
  error: string;
}

/**
 * Write one line into the session's conversation. The caller gets the fact, not a console entry:
 * a line that could not be stored is a line the record does not hold.
 */
export async function persistIngestLine(
  conversationId: string,
  content: string,
  alert: boolean,
): Promise<void> {
  if (!conversationId) throw new Error("the ingest's conversation is not open");
  const response = await apiFetch(
    `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "assistant",
        content,
        metadata: { source: "host", alert },
      }),
    },
  );
  if (!response.ok) throw new Error(`the conversation answered ${response.status}`);
}

/**
 * Write the line, then hand it to the chat with `persisted` set, so the chat draws it and does not
 * write a second copy. A failed write is never silent: the line is drawn unpersisted, and a second
 * line says it was not recorded. The result is what the acceptance checks.
 */
export async function sayIngestLine(input: {
  conversationId: string;
  content: string;
  alert?: boolean;
  tab: string;
  extra?: Record<string, unknown>;
}): Promise<IngestLineResult> {
  const { conversationId, content, alert = false, tab, extra = {} } = input;
  const draw = (line: string, isAlert: boolean, persisted: boolean) => {
    window.dispatchEvent(
      new CustomEvent("a2ui:system-message", {
        detail: { role: "assistant", content: line, alert: isAlert, persisted, tab, ...extra },
      }),
    );
  };
  try {
    await persistIngestLine(conversationId, content, alert);
    draw(content, alert, true);
    return { stored: true, error: "" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    draw(content, alert, false);
    draw(`This line was not recorded: ${error}.`, true, false);
    return { stored: false, error };
  }
}
