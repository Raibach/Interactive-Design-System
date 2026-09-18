/**
 * VersionHistoryPanel — the Versions view's content, extracted so it can be
 * loaded into a chat output slot the same way <TraceFeed> is.
 *
 * Figma "versions-button" #40001085:2731 is the rail button; its content lands in
 * "chat-output-simple-slot-area" #40001085:2373 — the slot whose note reads
 * "holds plain text output and inserted functions".
 *
 * Pure render: it reads props and calls onDismiss. The versions belong to the
 * caller, which is also the only place that fetches them.
 */

export interface VersionEntry {
  id: string;
  version_number: number;
  change_description?: string | null;
  created_at: string;
  overall_score?: number | null;
  left_column_content?: string | null;
}

export interface VersionHistoryPanelProps {
  /** The session's versions, in the order the caller supplies them. */
  versions: VersionEntry[];
  /** The version whose detail card is open, or null. */
  selected: VersionEntry | null;
  /** Closes the detail card. */
  onDismiss: () => void;
  /** The prompt session these versions belong to; drives the empty message. */
  sessionId?: string | null;
}

export function VersionHistoryPanel({
  versions,
  selected,
  onDismiss,
  sessionId,
}: VersionHistoryPanelProps) {
  return (
    <div className="space-y-4">
      {selected && (
        <div className="rounded-xl border border-[#4066e3] bg-[#f0f4ff] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#4066e3]">
            <span className="text-white font-semibold text-[13px]">
              {selected.change_description || `Version ${selected.version_number}`}
              <span className="ml-2 opacity-70 font-medium">v{selected.version_number}</span>
            </span>
            <div className="flex items-center gap-3">
              {selected.overall_score != null && (
                <span className="text-white font-bold text-[14px]">
                  Score: {selected.overall_score.toFixed(1)}
                </span>
              )}
              <button
                onClick={onDismiss}
                className="text-white/70 hover:text-white text-[18px] leading-none"
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-wide font-semibold">
              Saved {new Date(selected.created_at).toLocaleString()}
            </p>
            {selected.left_column_content ? (
              <pre className="text-[12px] text-gray-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-gray-200 max-h-[300px] overflow-y-auto">
                {selected.left_column_content}
              </pre>
            ) : (
              <p className="text-[12px] text-gray-400 italic">No content stored for this version.</p>
            )}
          </div>
        </div>
      )}
      {versions.length > 0 ? (
        versions
          .filter((v) => v?.id)
          .map((v) => (
            <div
              key={v.id}
              className="bg-white border border-gray-200 rounded-lg p-3 text-[12px] font-['Inter']"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">v{v.version_number}</span>
                <span className="text-[10px] text-gray-400">
                  {new Date(v.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-gray-600">{v.change_description || 'No description'}</div>
              {v.overall_score != null && (
                <div className="mt-1 text-[#4066e3] font-semibold">Score: {v.overall_score}</div>
              )}
            </div>
          ))
      ) : (
        <div className="text-[12px] text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded-lg">
          {sessionId ? 'No versions yet — run a prompt to create a trace' : 'No active prompt session'}
        </div>
      )}
      <div className="h-[230px]" aria-hidden="true"></div>
    </div>
  );
}

export default VersionHistoryPanel;
