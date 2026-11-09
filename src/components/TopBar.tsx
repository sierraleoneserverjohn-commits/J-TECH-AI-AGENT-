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
  Radio,
  Mic,
  MicOff,
} from 'lucide-react';
import { speechManager } from '../voice/SpeechEngineManager';

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
          second: '2-digit',
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

  return (
    <header className="h-10 px-3 md:px-4 flex items-center justify-between border-b border-cyan-950/80 bg-[#040914]/90 backdrop-blur-xl shrink-0 z-40 select-none font-mono">
      {/* Left: JEXA logo (glowing ring) with tagline */}
      <div className="flex items-center gap-2.5">
        {/* JEXA SVG Logo */}
        <div className="relative w-6 h-6 flex items-center justify-center">
          <img src="/favicon.svg" alt="JEXA" className="w-6 h-6 drop-shadow-[0_0_8px_#00f0ff]" />
        </div>

        <div className="flex flex-col">
          <span className="font-heading font-bold text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-white leading-none">
            JEXA
          </span>
          <span className="text-[8px] font-sans text-cyan-400/80 tracking-wide leading-none mt-0.5 hidden sm:inline">
            Your Intelligent Assistant
          </span>
        </div>
      </div>

      {/* Center: "Smarter • Faster • Always with you" */}
      <div className="hidden md:flex items-center justify-center">
        <span className="text-[11px] font-mono tracking-wider text-cyan-300/80 uppercase px-3 py-0.5 rounded-full bg-cyan-950/30 border border-cyan-500/20 text-glow-cyan">
          Smarter • Faster • Always with you
        </span>
      </div>

      {/* Right: Persistent Mic & Mute, Live Clock, Wi-Fi, Battery, Focus Mode, Fullscreen, Settings */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Persistent Visible Mic Indicator & One-Tap Hard Mute */}
        <button
          onClick={() => {
            const muted = speechManager.toggleMute();
            setMutedState(muted);
          }}
          title={isMuted ? 'Microphone is Hard Muted (Click to Unmute)' : 'Microphone is Active (Click to Hard Mute)'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border min-h-[36px] transition-all ${
            isMuted
              ? 'bg-rose-950/50 border-rose-500/60 text-rose-300 hover:bg-rose-900/60 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
              : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50'
          }`}
        >
          {isMuted ? (
            <MicOff className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          )}
          <span className="text-[9.5px] font-bold uppercase tracking-wider hidden sm:inline">
            {isMuted ? 'Muted' : 'Mic Live'}
          </span>
        </button>

        {/* Clock & Date */}
        <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
          <span className="text-cyan-400 font-semibold">{timeStr}</span>
          <span className="text-slate-500 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline">{dateStr}</span>
        </div>

        {/* Wi-Fi Status */}
        <div className="flex items-center gap-1 text-[11px]" title={`Network: ${deviceData.connectionType}`}>
          <Wifi className={`w-3.5 h-3.5 ${deviceData.isOnline ? 'text-cyan-400' : 'text-rose-500'}`} />
          <span className="text-slate-400 hidden lg:inline">
            {deviceData.isOnline ? deviceData.connectionType : 'Offline'}
          </span>
        </div>

        {/* Battery % */}
        <div className="flex items-center gap-1 text-[11px]" title="Device Battery">
          {deviceData.isCharging ? (
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ) : (
            <Battery className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span className="text-slate-300 font-medium">
            {deviceData.batteryLevel !== null ? `${deviceData.batteryLevel}%` : 'Not available'}
          </span>
        </div>

        {/* Focus Mode button */}
        <button
          onClick={onToggleFocusMode}
          title={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode (isolate globe)'}
          aria-label={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
          className={`p-2 rounded transition-all min-h-[44px] min-w-[44px] flex items-center justify-center border ${
            isFocusMode
              ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_12px_#00f0ff]'
              : 'text-slate-400 hover:text-cyan-300 border-slate-800 hover:bg-slate-800/60'
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={onToggleFullscreen}
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
          className="p-2 text-slate-400 hover:text-cyan-300 rounded border border-slate-800 hover:bg-slate-800/60 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Settings gear */}
        <button
          onClick={onOpenSettings}
          title="JEXA Core Settings"
          aria-label="Open Settings"
          className="p-2 text-slate-400 hover:text-cyan-300 rounded border border-slate-800 hover:bg-slate-800/60 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
