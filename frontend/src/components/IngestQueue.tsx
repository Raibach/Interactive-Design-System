import { useState, useEffect, useRef } from "react";

interface QueueItem {
  id: string;
  url: string;
  notes: string;
  status: "queued" | "processing" | "done" | "error";
  result?: { tag: string } | string; // tag on success, error msg on failure
  mcp_status?: string;
  rest_status?: string;
}

interface IngestQueueProps {
  open: boolean;
  onClose: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function IngestQueue({ open, onClose, apiFetch }: IngestQueueProps) {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Poll for status changes
  useEffect(() => {
    if (!open) return;
    const hasActive = queue.some((q) => q.status === "queued" || q.status === "processing");
    if (!hasActive) return;

    pollingIntervalRef.current = setInterval(async () => {
      // Fetch status for each active item
      const updatedQueue = await Promise.all(
        queue.map(async (item) => {
          if (item.status === "queued" || item.status === "processing") {
            try {
              const res = await apiFetch(`/api/figma/ingest/${item.id}`);
              if (res.ok) {
                const data = await res.json();
                return { 
                  ...item, 
                  status: data.status, 
                  result: data.result,
                  mcp_status: data.mcp_status,
                  rest_status: data.rest_status,
                };
              }
            } catch {
              // Ignore polling errors
            }
          }
          return item;
        })
      );
      setQueue(updatedQueue);
    }, 2000);
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [open, queue, apiFetch]);

  if (!open) return null;

  const isValidUrl = (u: string) => {
    try {
      const parsed = new URL(u);
      return parsed.hostname.includes("figma.com") || parsed.hostname.includes("figma.cc");
    } catch {
      return false;
    }
  };

  const addToQueue = async () => {
    if (!isValidUrl(url)) return;
    const item: QueueItem = {
      id: crypto.randomUUID(),
      url,
      notes,
      status: "queued",
    };
    setQueue((prev) => [...prev, item]);
    setUrl("");
    setNotes("");
    inputRef.current?.focus(); // immediately ready for next

    // Fire-and-forget: tell backend to process
    const { fileKey, nodeId } = parseFigmaUrl(url);
    apiFetch("/api/figma/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: item.id, fileKey, nodeId, notes }),
    }).then((res) => {
      if (res.ok) {
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q))
        );
      } else {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "error", result: "Failed to queue" } : q
          )
        );
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addToQueue();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-5 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Ingest Queue</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Input row */}
        <div className="flex gap-2 mb-1">
          <input
            ref={inputRef}
            type="url"
            placeholder="Paste Figma link…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addToQueue}
            disabled={!isValidUrl(url)}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs mb-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Queue list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
          {queue.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Paste links and hit Enter to queue them up.
            </p>
          )}
          {queue.map((item) => {
            const isDone = item.status === "done";
            const isError = item.status === "error";
            const resultTag = isDone && item.result && typeof item.result === "object" ? item.result.tag : "";
            const resultError = isError && item.result && typeof item.result === "string" ? item.result : "";
            const resultString = isDone && item.result && typeof item.result === "string" ? item.result : "";
            
            // MCP/REST status badges
            const mcpBadge = item.mcp_status ? (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                item.mcp_status.startsWith("success") ? "bg-green-50 text-green-700" :
                item.mcp_status.startsWith("unavailable") ? "bg-amber-50 text-amber-700" :
                "bg-red-50 text-red-700"
              }`}>
                MCP: {item.mcp_status.split(":")[0]}
              </span>
            ) : null;
            
            const restBadge = item.rest_status ? (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                item.rest_status.startsWith("success") ? "bg-green-50 text-green-700" :
                "bg-red-50 text-red-700"
              }`}>
                REST: {item.rest_status.split(":")[0]}
              </span>
            ) : null;

            return (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-gray-100 px-3 py-2 text-sm"
            >
              <StatusDot status={item.status} />
              <span className="flex-1 truncate text-gray-700">{item.url}</span>
              {isDone && (resultTag || resultString) && (
                <code className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                  {resultTag || resultString}
                </code>
              )}
              {isError && resultError && (
                <span className="text-xs text-red-600 truncate max-w-[120px]">{resultError}</span>
              )}
              {mcpBadge}
              {restBadge}
            </div>
            );
          })}
        </div>

        {/* Footer */}
        {queue.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            {queue.filter((q) => q.status === "done").length} done ·{" "}
            {queue.filter((q) => q.status === "queued" || q.status === "processing").length} in progress
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: QueueItem["status"] }) {
  const colors = {
    queued: "bg-gray-300",
    processing: "bg-blue-500 animate-pulse",
    done: "bg-green-500",
    error: "bg-red-500",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

function parseFigmaUrl(url: string) {
  const parsed = new URL(url);
  const fileKey = parsed.pathname.split("/")[2];
  const nodeId = parsed.searchParams.get("node-id")?.replace("-", ":");
  return { fileKey, nodeId };
}