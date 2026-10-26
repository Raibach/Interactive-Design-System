/**
 * THE COMPOSER'S DECISION DIALOG — Grace asks what to do with an unsaved package when the
 * person tries to leave it. The dialog is the package's question, so it lives in the room.
 */
export interface ComposerDecisionDialogProps {
  decision: {
    show: boolean;
    message: string;
    actions: Array<{ id: string; label: string; variant: string }>;
  } | null;
  onAction: (actionId: string) => void;
}

export function ComposerDecisionDialog({ decision, onAction }: ComposerDecisionDialogProps) {
  if (!decision?.show) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
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
              onClick={() => onAction(action.id)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                action.variant === 'primary'
                  ? 'bg-[#234354] text-white hover:bg-[#1a2f3d]'
                  : action.variant === 'destructive'
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
