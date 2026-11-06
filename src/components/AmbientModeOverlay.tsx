import React, { useEffect, useState } from 'react';

interface AmbientModeOverlayProps {
  isAmbient: boolean;
  onWake: () => void;
}

export const AmbientModeOverlay: React.FC<AmbientModeOverlayProps> = ({
  isAmbient,
  onWake,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setDateStr(
        now.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isAmbient) return null;

  return (
    <div
      onClick={onWake}
      onTouchStart={onWake}
      className="fixed inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-between py-6 px-4 cursor-pointer select-none animate-in fade-in duration-700"
    >
      {/* Top Ambient Clock */}
      <div className="flex flex-col items-center pt-2">
        <span className="font-mono text-3xl sm:text-4xl font-bold tracking-widest text-cyan-300 drop-shadow-[0_0_16px_rgba(0,240,255,0.7)]">
          {timeStr}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-400 mt-1">
          {dateStr} • JEXA STANDBY
        </span>
      </div>

      {/* Middle indicator */}
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full border border-cyan-500/30 flex items-center justify-center animate-pulse">
          <div className="w-8 h-8 rounded-full bg-cyan-400/20 blur-sm" />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-400/80 mt-3 animate-pulse">
          Ambient Standby Active
        </span>
      </div>

      {/* Bottom hint */}
      <div className="text-[11px] font-mono text-slate-500 uppercase tracking-widest pb-2">
        Tap anywhere or press any key to wake
      </div>
    </div>
  );
};
