/**
 * The Tools greeting's inventory line — pure, so adding a tool is a data change and a test.
 *
 * The registry is server-side (`backend/console_tools.py`); the seat receives it as
 * `consoleTools`. This formatter never invents a tool: an empty inventory says so, and a tool's
 * own status travels with its label.
 */
export interface ConsoleToolEntry {
  label?: unknown;
  status?: unknown;
}

export function formatToolInventory(tools: ConsoleToolEntry[] | null | undefined): string {
  const entries = (tools ?? [])
    .map((tool) => ({
      label: String(tool?.label ?? '').trim(),
      status: String(tool?.status ?? '').trim(),
    }))
    .filter((tool) => tool.label)
    .map((tool) => (tool.status && tool.status !== 'available' ? `${tool.label} (${tool.status})` : tool.label));
  return entries.length ? entries.join('; ') : 'no tool is available yet';
}
