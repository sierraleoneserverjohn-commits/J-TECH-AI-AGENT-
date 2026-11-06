import React, { useState, useEffect } from 'react';
import { Terminal, X, Search, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { getActiveBrain } from '../brains';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentCommands: string[];
}

const DEFAULT_COMMANDS = [
  'System health diagnostic',
  'Search for latest AI news',
  'Execute Calculator: 128 * 4.5',
  'Inspect neural memory store',
  'Probe provider network latency',
  'Run telemetry analyzer',
  'Clear command history',
];

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  recentCommands,
}) => {
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Combine unique recent commands with default suggestions
  const allCommands = Array.from(new Set([...recentCommands, ...DEFAULT_COMMANDS]));
  const filtered = filter.trim()
    ? allCommands.filter((c) => c.toLowerCase().includes(filter.toLowerCase()))
    : allCommands;

  const handleSelectCommand = (cmd: string) => {
    onClose();
    getActiveBrain().send(cmd);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmd-palette-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] max-h-[85vh] rounded-xl hud-corner-box hud-corner-accent p-3.5 flex flex-col border border-cyan-500/40 glow-cyan-border shadow-2xl overflow-hidden font-mono text-xs"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-950/80">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h2 id="cmd-palette-title" className="font-heading font-bold text-sm tracking-wider uppercase text-slate-100">
              JEXA Command Palette
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="relative mb-2.5">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400/80" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search commands or type directive..."
            autoFocus
            className="w-full py-1.5 pl-8 pr-3 bg-[#071322] border border-cyan-500/30 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          />
        </div>

        {/* Commands List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[220px]">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-[11px] italic">
              No matching commands. Press Enter to dispatch custom command.
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const isRecent = recentCommands.includes(cmd);
              return (
                <button
                  key={`${cmd}-${i}`}
                  onClick={() => handleSelectCommand(cmd)}
                  className="w-full text-left px-2.5 py-2 rounded-lg bg-[#071424]/70 hover:bg-[#0c2038] border border-cyan-950/60 hover:border-cyan-500/50 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    {isRecent ? (
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                    )}
                    <span className="text-slate-200 group-hover:text-cyan-200 text-[11px] truncate">
                      {cmd}
                    </span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-1.5" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer tip */}
        <div className="mt-2.5 pt-2 border-t border-cyan-950/80 flex items-center justify-between text-[10px] text-slate-500">
          <span>Tip: Long-press mic anytime to summon palette</span>
          <span className="text-cyan-400/80">ESC to exit</span>
        </div>
      </div>
    </div>
  );
};
