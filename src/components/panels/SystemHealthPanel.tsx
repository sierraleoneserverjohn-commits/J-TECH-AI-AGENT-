import React from 'react';
import { ShieldCheck, Activity, AlertCircle } from 'lucide-react';

interface SystemHealthPanelProps {
  backendReachable: boolean;
  healthPercent: number | null;
}

export const SystemHealthPanel: React.FC<SystemHealthPanelProps> = ({
  backendReachable,
  healthPercent,
}) => {
  return (
    <div className="space-y-2 font-mono text-xs">
      {/* Overall Status Banner */}
      <div
        className={`flex items-center justify-between p-2 rounded-lg border ${
          backendReachable
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            : 'bg-slate-900/60 border-slate-800 text-slate-400'
        }`}
      >
        <div className="flex items-center gap-2">
          {backendReachable ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-slate-500" />
          )}
          <span className="font-semibold text-[11px]">
            {backendReachable ? 'System Connected' : 'Backend: not connected'}
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider">
          {backendReachable && healthPercent !== null ? `${healthPercent}%` : '—'}
        </span>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed px-1">
        {backendReachable
          ? 'Real health diagnostics confirmed with backend telemetry server.'
          : 'Backend server is not reachable. Connect your backend URL in Settings to activate telemetry.'}
      </p>
    </div>
  );
};
