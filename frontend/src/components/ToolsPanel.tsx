/**
 * ToolsPanel — the Tools view's content, extracted so it can be loaded into a
 * chat output slot the same way <TraceFeed> is.
 *
 * Figma "tools-button" #40001085:2634 is the rail button; its content lands in
 * "chat-output-simple-slot-area" #40001085:2373 — the slot whose note reads
 * "holds plain text output and inserted functions".
 *
 * Pure render: the extraction of tools and variables from the prompt belongs to
 * the caller.
 */

export interface DetectedTool {
  name: string;
  content: string;
}

export interface DetectedVariable {
  name: string;
  section: string;
  value: string;
}

export interface ToolsPanelProps {
  /** Tools detected in the open prompt. */
  tools: DetectedTool[];
  /** Variables detected in the open prompt. */
  variables: DetectedVariable[];
}

export function ToolsPanel({ tools, variables }: ToolsPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[12px] font-['Inter'] font-semibold text-[#1c2f4e] mb-2">
          Detected Tools
        </h3>
        {tools.length > 0 ? (
          <div className="space-y-2">
            {tools.map((tool, i) => (
              <div
                key={`${tool.name}-${i}`}
                className="bg-white border border-gray-200 rounded-lg p-3 text-[12px] font-['Inter']"
              >
                <div className="font-semibold text-[#1c2f4e]">{tool.name}</div>
                <pre className="mt-1 text-[11px] text-gray-600 whitespace-pre-wrap font-mono">
                  {tool.content}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded-lg">
            0 tools
          </div>
        )}
      </div>
      <div>
        <h3 className="text-[12px] font-['Inter'] font-semibold text-[#1c2f4e] mb-2">
          Detected Variables
        </h3>
        {variables.length > 0 ? (
          variables.map((v, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-3 text-[12px] font-['Inter']"
            >
              <span className="font-mono text-[#507274] font-semibold">{'{{'}{v.name}{'}}'}</span>
              <span className="ml-2 text-gray-400">from {v.section}</span>
              {v.value && <div className="mt-1 text-gray-600">Value: {v.value}</div>}
            </div>
          ))
        ) : (
          <div className="text-[12px] text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded-lg">
            0 variables
          </div>
        )}
      </div>
      <div className="h-[230px]" aria-hidden="true"></div>
    </div>
  );
}

export default ToolsPanel;
