import React from 'react';
import { ActionItem, eventBus } from '../events/eventBus';
import { JexaNativeBridge } from '../plugins/capacitorStub';
import { AlertTriangle, Smartphone, Check, X, ShieldAlert, ExternalLink } from 'lucide-react';

interface ActionConfirmCardProps {
  action: ActionItem | null;
  onClose: () => void;
}

export const ActionConfirmCard: React.FC<ActionConfirmCardProps> = ({ action, onClose }) => {
  if (!action) return null;

  const handleConfirm = async () => {
    eventBus.emit('log', {
      text: `Action confirmed by Commander: "${action.title}"`,
      level: 'warn',
    });

    if (action.payload?.action === 'clear_working_memory') {
      eventBus.emit('memory', { layer: 'working', delta: 0, action: 'clear' });
      eventBus.emit('state', { state: 'idle' });
    } else {
      eventBus.emit('state', { state: 'idle' });
    }

    onClose();
  };

  const handleCancel = () => {
    eventBus.emit('log', {
      text: `Operation cancelled: "${action.title}"`,
      level: 'info',
    });
    eventBus.emit('state', { state: 'idle' });
    onClose();
  };

  const isAndroidRequirement = action.needsAndroidApp;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 font-mono animate-in fade-in duration-150">
      <div className="bg-[#09111c] border-2 border-cyan-500/50 rounded-2xl p-5 max-w-sm w-full shadow-[0_0_30px_rgba(6,182,212,0.35)] text-slate-100">
        <div className="flex items-center gap-2.5 pb-3 border-b border-cyan-950">
          {isAndroidRequirement ? (
            <div className="w-9 h-9 rounded-full bg-cyan-950/80 border border-cyan-400 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-amber-950/80 border border-amber-400 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              {action.title}
            </h3>
            <span className="text-[10px] text-cyan-400 uppercase tracking-wider">
              {isAndroidRequirement ? 'Native Device Capability' : 'Security Clearance Required'}
            </span>
          </div>
        </div>

        <div className="my-4 text-xs text-slate-300 leading-relaxed bg-[#060c14] p-3 rounded-xl border border-slate-800">
          <p>{action.description}</p>

          {isAndroidRequirement && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-cyan-300/90 flex items-start gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-400" />
              <span>
                Needs the Android app. Native Capacitor SMS and AppLauncher plugins are prepared in JEXA mobile bundle.
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 pt-1">
          {isAndroidRequirement ? (
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs tracking-wider uppercase transition-colors min-h-[44px] flex items-center justify-center"
            >
              Acknowledged
            </button>
          ) : (
            <>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors min-h-[44px] shadow-[0_0_15px_rgba(244,63,94,0.4)]"
              >
                <Check className="w-4 h-4" />
                Authorize
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
