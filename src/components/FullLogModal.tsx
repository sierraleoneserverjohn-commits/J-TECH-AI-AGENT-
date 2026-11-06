import React, { useState } from 'react';
import { LogItem } from '../events/useJexaStore';
import { Terminal, X, Search, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface FullLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogItem[];
}

export const FullLogModal: React.FC<FullLogModalProps> = ({ isOpen, onClose, logs }) => {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (search && !log.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getLevelIcon = (level: LogItem['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'warn':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'error':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 font-mono animate-in fade-in duration-150">
      <div className="bg-[#060d19] border border-cyan-500/40 rounded-xl max-w-2xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-950 bg-[#091426]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold font-heading text-white tracking-widest uppercase">
              JEXA System Event Log Stream
            </h3>
            <span className="text-[10px] text-cyan-400 font-mono">({logs.length} entries)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            aria-label="Close logs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 border-b border-slate-800/80 bg-[#07101f] flex flex-wrap gap-2 items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            {['all', 'info', 'warn', 'error', 'success'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-2 py-1 rounded text-[10px] uppercase font-semibold transition-colors ${
                  filter === lvl
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div className="relative min-w-[180px]">
            <input
              type="text"
              placeholder="Filter logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-1 pl-7 pr-2 rounded bg-slate-950 border border-slate-700 text-[11px] text-white"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          </div>
        </div>

        {/* Log Entries */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-slate-500 py-8 italic">No activity yet. Send a command.</div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2 p-1.5 rounded bg-[#091322]/80 border border-slate-800/50 hover:border-cyan-500/30 transition-colors"
              >
                {getLevelIcon(log.level)}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span className="uppercase text-slate-400 font-semibold">{log.level}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-200 mt-0.5 break-words leading-tight">{log.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-[#07101f] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
