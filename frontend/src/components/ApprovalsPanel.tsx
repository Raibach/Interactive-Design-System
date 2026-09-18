/**
 * ApprovalsPanel — the Approvals view's content, extracted so it can load into a
 * chat output slot the same way <TraceFeed> does.
 *
 * Figma "approval-button" #40001088:2795 is the CONSOLE rail's fourth button; its
 * content lands in "chat-output-simple-slot-area" #40001085:2373.
 *
 * WHAT IS NOT HERE, AND WHY: the React seat this came from rendered a stat block —
 * "10 PENDING", "24,847" tokens, "$3.14", a priority and a risk breakdown — as
 * LITERAL TEXT in the JSX, with the queue itself a hardcoded array beside it. No
 * source supplied any of those numbers, so carrying them over would have printed
 * figures nothing stands behind. The count below is derived from `items`; the rest
 * returns when there is something to compute it from.
 */

import { ApprovalQueueItem, type ApprovalItem } from './ApprovalQueueItem';

export type { ApprovalItem };

export interface ApprovalsPanelProps {
  /** The pending approvals. Empty renders an honest empty state. */
  items: ApprovalItem[];
  /** Picking one — the seat loaded it into the composer. */
  onLoadToComposer: (item: ApprovalItem) => void;
}

export function ApprovalsPanel({ items, onLoadToComposer }: ApprovalsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef] border-l-4 border-[#1c2f4e] rounded-lg p-5 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="font-['Inter'] font-bold text-[20px] text-[#1c2f4e] mb-1">
              Approval Queue
            </h2>
            <p className="font-['Inter'] text-[13px] text-[#6c757d] leading-relaxed">
              Review and approve prompts submitted by your team.
            </p>
          </div>
          <div className="bg-[#1c2f4e] text-white px-4 py-1.5 rounded-full text-[11px] font-['Inter'] font-semibold min-w-[80px] text-center flex-shrink-0 ml-4">
            {items.length} PENDING
          </div>
        </div>
      </div>
      {items.length > 0 ? (
        items.map((item, index) => (
          <ApprovalQueueItem
            key={item.id}
            item={item}
            index={index}
            onLoadToComposer={onLoadToComposer}
          />
        ))
      ) : (
        <div className="text-[12px] text-gray-400 italic p-4 text-center border border-dashed border-gray-300 rounded-lg">
          Nothing to approve. The queue has no source yet — it rendered a literal array
          in the retired React seat.
        </div>
      )}
      <div className="h-[230px]" aria-hidden="true"></div>
    </div>
  );
}

export default ApprovalsPanel;
