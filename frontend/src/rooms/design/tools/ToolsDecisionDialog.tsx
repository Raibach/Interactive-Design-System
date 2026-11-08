/**
 * THE TOOLS SEAT'S DECISION DIALOG — the question the seat asks before a save it must not make.
 *
 * Owner, 2026-11-01: *"when it's in preview, there's really nothing to save because that's
 * ephemeral. So we have to just give them a warning and say cancel or approve … three buttons
 * cancel, approve or discard."*
 *
 * A PREVIEW IS NOT WORK YET. The temporary folder dies with the preview, so a session saved while
 * one stands would be a card describing a drawing nobody can open. The seat therefore refuses that
 * save and asks this question instead.
 *
 * THE SHAPE IS THE COMPOSER'S (rooms/composer/ComposerDecisionDialog.tsx): Grace's mark, one
 * sentence, a row of actions each carrying an id, a label and a style, and the room routing by id.
 * It is a COPY in the Tools folder and not an import, because the rooms do not share components —
 * the owner's rule, 2026-10-31. The words are this room's.
 *
 * THE ROOM DRAWS IT, THE SEAT DECIDES. The seat renders nothing when it is headless, which is how
 * this room uses it, so the dialog stands here and the seat is told the answer.
 */
import { createPortal } from "react-dom";

export interface ToolsDecision {
  message: string;
  actions: Array<{ id: string; label: string; variant: "primary" | "destructive" | "plain" }>;
}

export interface ToolsDecisionDialogProps {
  decision: ToolsDecision | null;
  onAction: (actionId: string) => void;
}

export function ToolsDecisionDialog({ decision, onAction }: ToolsDecisionDialogProps) {
  if (!decision) return null;
  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md mx-4 animate-in zoom-in-95 duration-300">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#234354] flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-semibold">G</span>
          </div>
          <div>
            <p className="text-[#1a1a1a] text-sm font-medium mb-1">Grace</p>
            <p className="text-[#1a1a1a] text-base">{decision.message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end flex-wrap">
          {decision.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.id)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                action.variant === "primary"
                  ? "bg-[#234354] text-white hover:bg-[#1a2f3d]"
                  : action.variant === "destructive"
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  /*
   * THE QUESTION IS DRAWN AT THE DOCUMENT ROOT, NOT INSIDE THE ROOM.
   *
   * The room's stage is a positioned subtree with its own stacking context. A fixed overlay
   * rendered beside it is a SIBLING CONTEXT, so its `z-50` is compared with that subtree's
   * z-index — and the stage wins, whatever number the overlay carries. Measured 2026-11-07: the
   * question about the session (Save / Accept / Discard) was drawn UNDER the design stage, no
   * button could be clicked, and the tab press that asked it waited forever. A portal to the
   * body puts the question above every room, which is where a question about leaving the room
   * belongs.
   */
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}
