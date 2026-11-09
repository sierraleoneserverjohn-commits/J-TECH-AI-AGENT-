import React, { useState, useEffect } from 'react';
import { DeviceData } from '../hooks/useDeviceData';
import {
  Wifi,
  Battery,
  BatteryCharging,
  Settings,
  Maximize2,
  Minimize2,
  Eye,
  Mic,
  MicOff,
} from 'lucide-react';
import { speechManager } from '../voice/SpeechEngineManager';
import { JexaLogo } from './JexaLogo';

interface TopBarProps {
  deviceData: DeviceData;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  deviceData,
  isFocusMode,
  onToggleFocusMode,
  onOpenSettings,
  onToggleFullscreen,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [isMuted, setMutedState] = useState<boolean>(() => speechManager.isMuted());

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      // Short date format requested: "Mon 9 Nov"
      const weekday = now.toLocaleDateString([], { weekday: 'short' });
      const day = now.getDate();
      const month = now.toLocaleDateString([], { month: 'short' });
      setDateStr(`${weekday} ${day} ${month}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-9 sm:h-10 px-2 sm:px-3 flex items-center justify-between border-b border-cyan-950/80 bg-[#040914]/95 backdrop-blur-xl shrink-0 z-40 select-none font-mono flex-nowrap overflow-hidden w-full">
      {/* Left: JEXA Logo & Title (Never shrinks, non-wrapping) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
        <JexaLogo size={22} className="shrink-0 drop-shadow-[0_0_8px_#00f0ff]" />
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="font-heading font-bold text-xs sm:text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-white leading-none">
            JEXA
          </span>
          <span className="text-[8px] font-sans text-cyan-400/80 tracking-wide leading-none hidden min-[850px]:inline">
            Command Centre
          </span>
        </div>
      </div>

      {/* Center: "Smarter • Faster • Always with you" (Hidden below 1000px width as instructed) */}
      <div className="hidden min-[1000px]:flex items-center justify-center shrink-0">
        <span className="text-[10px] font-mono tracking-wider text-cyan-300/80 uppercase px-2.5 py-0.5 rounded-full bg-cyan-950/30 border border-cyan-500/20 text-glow-cyan">
          Smarter • Faster • Always with you
        </span>
      </div>

      {/* Right: Telemetry & Controls (Clock, Date, Wi-Fi, Battery, Mic Mute, Eye, Fullscreen, Settings) */}
      {/* Must never be clipped - flex-nowrap, shrink-0, compact button sizes */}
      <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] shrink-0 flex-nowrap">
        {/* Persistent Visible Mic Indicator & One-Tap Hard Mute */}
        <button
          type="button"
          onClick={() => {
            const muted = speechManager.toggleMute();
            setMutedState(muted);
          }}
          title={isMuted ? 'Microphone is Hard Muted (Click to Unmute)' : 'Microphone is Live (Click to Hard Mute)'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`flex items-center gap-1 px-1.5 py-1 rounded border shrink-0 transition-all ${
            isMuted
              ? 'bg-rose-950/50 border-rose-500/60 text-rose-300 hover:bg-rose-900/60 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
              : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50'
          }`}
        >
          {isMuted ? (
            <MicOff className="w-3 h-3 text-rose-400 shrink-0" />
          ) : (
            <Mic className="w-3 h-3 text-cyan-400 animate-pulse shrink-0" />
          )}
          <span className="text-[9px] font-bold uppercase tracking-wider hidden min-[680px]:inline">
            {isMuted ? 'Muted' : 'Live'}
          </span>
        </button>

        {/* Live Clock & Short Date ("Mon 9 Nov") */}
        <div className="flex items-center gap-1 text-slate-300 shrink-0 px-1">
          <span className="text-cyan-400 font-semibold">{timeStr}</span>
          <span className="text-slate-500 hidden min-[580px]:inline">•</span>
          <span className="text-slate-400 hidden min-[580px]:inline text-[9.5px] whitespace-nowrap">
            {dateStr}
          </span>
        </div>

        {/* Wi-Fi Status */}
        <div
          className="flex items-center gap-0.5 shrink-0 px-0.5"
          title={`Network: ${deviceData.isOnline ? deviceData.connectionType : 'Offline'}`}
        >
          <Wifi className={`w-3 h-3 shrink-0 ${deviceData.isOnline ? 'text-cyan-400' : 'text-rose-500'}`} />
        </div>

        {/* Battery % */}
        <div
          className="flex items-center gap-0.5 shrink-0 px-0.5"
          title={`Battery: ${deviceData.batteryLevel !== null ? `${deviceData.batteryLevel}%` : 'Not available'}`}
        >
          {deviceData.isCharging ? (
            <BatteryCharging className="w-3 h-3 shrink-0 text-emerald-400 animate-pulse" />
          ) : (
            <Battery className="w-3 h-3 shrink-0 text-cyan-400" />
          )}
          <span className="text-slate-300 font-medium text-[9.5px]">
            {deviceData.batteryLevel !== null ? `${deviceData.batteryLevel}%` : ''}
          </span>
        </div>

        {/* Focus Mode button */}
        <button
          type="button"
          onClick={onToggleFocusMode}
          title={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
          aria-label={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center shrink-0 border transition-all ${
            isFocusMode
              ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_10px_#00f0ff]'
              : 'text-slate-400 hover:text-cyan-300 border-slate-800 hover:bg-slate-800/60'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center shrink-0 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Settings gear - flex-shrink-0 to guarantee it never gets pushed out */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="JEXA Settings"
          aria-label="Open Settings"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center shrink-0 border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:text-white hover:bg-cyan-900/60 shadow-[0_0_8px_rgba(0,240,255,0.25)] transition-all"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
