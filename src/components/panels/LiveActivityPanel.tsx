import React from 'react';
import { LogItem } from '../../events/useJexaStore';
import { Terminal, Shield, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface LiveActivityPanelProps {
  logs: LogItem[];
}

export const LiveActivityPanel: React.FC<LiveActivityPanelProps> = ({ logs }) => {
  const getLevelIcon = (level: LogItem['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />;
      case 'warn':
        return <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />;
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full font-mono text-xs">
      <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1.5 border-b border-cyan-950/60 mb-1.5">
        <span className="flex items-center gap-1 text-cyan-400">
          <Terminal className="w-3 h-3" /> Event Log Stream
        </span>
        <span>{logs.length} events logged</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[220px] pr-1">
        {logs.length === 0 ? (
          <p className="text-center py-4 text-slate-500 italic text-[10px]">
            No activity yet. Send a command.
          </p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-1.5 py-1 px-1.5 rounded bg-[#09111c]/60 hover:bg-[#0d1828] border border-slate-800/40 transition-colors"
            >
              {getLevelIcon(log.level)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[9px] text-slate-500">
                  <span className="uppercase text-slate-400">{log.level}</span>
                  <span>{formatTime(log.timestamp)}</span>
                </div>
                <p className="text-[11px] text-slate-200 break-words leading-tight mt-0.5">
                  {log.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
