import React, { useState, useEffect } from 'react';
import { LucideIcon, ChevronDown, ChevronRight, Minimize2, Maximize2 } from 'lucide-react';

interface HudPanelProps {
  id: string;
  title: string;
  icon: LucideIcon;
  badge?: string | number;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
  edgePlacement?: 'left' | 'right' | 'bottom';
}

export const HudPanel: React.FC<HudPanelProps> = ({
  id,
  title,
  icon: Icon,
  badge,
  children,
  defaultCollapsed = false,
  className = '',
  edgePlacement = 'left',
}) => {
  const storageKey = `jexa_panel_collapsed_${id}`;
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? saved === 'true' : defaultCollapsed;
  });

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem(storageKey, String(next));
  };

  if (isCollapsed) {
    return (
      <button
        onClick={toggleCollapse}
        title={`Expand ${title}`}
        aria-label={`Expand ${title} panel`}
        className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0b1320]/85 hover:bg-[#111e33] border border-cyan-500/30 text-cyan-400 shadow-md backdrop-blur-md transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 min-h-[44px] min-w-[44px] ${className}`}
      >
        <Icon className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 hidden sm:inline">
          {title}
        </span>
        {badge !== undefined && (
          <span className="text-[9px] px-1 py-0.2 bg-cyan-950 border border-cyan-500/40 text-cyan-300 rounded font-mono">
            {badge}
          </span>
        )}
        <Maximize2 className="w-3 h-3 text-slate-400 group-hover:text-cyan-300" />
      </button>
    );
  }

  return (
    <div
      className={`flex flex-col bg-[#09111c]/90 backdrop-blur-xl border border-cyan-500/25 rounded-xl shadow-lg overflow-hidden transition-all duration-200 ${className}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-950/80 bg-[#0c1626]/60 select-none">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
            {title}
          </h3>
          {badge !== undefined && (
            <span className="text-[10px] px-1.5 py-0.2 bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 rounded font-mono">
              {badge}
            </span>
          )}
        </div>

        <button
          onClick={toggleCollapse}
          title={`Collapse ${title}`}
          aria-label={`Collapse ${title}`}
          className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/40 min-h-[32px] min-w-[32px] flex items-center justify-center transition-colors"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-2.5">{children}</div>
    </div>
  );
};
