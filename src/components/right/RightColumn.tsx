import React, { useEffect, useRef } from 'react';
import { LogItem } from '../../events/useJexaStore';
import { DeviceData } from '../../hooks/useDeviceData';
import { eventBus } from '../../events/eventBus';
import { getActiveBrain } from '../../brains';
import {
  Activity,
  Smartphone,
  Wifi,
  Zap,
  Music,
  Grid,
  Home,
  MoreHorizontal,
  ExternalLink,
  Minimize2,
  Maximize2,
} from 'lucide-react';

interface RightColumnProps {
  logs: LogItem[];
  deviceData: DeviceData;
  onViewAllLogs: () => void;
  collapsedPanels: Record<string, boolean>;
  toggleCollapse: (panelId: string) => void;
}

export const RightColumn: React.FC<RightColumnProps> = ({
  logs,
  deviceData,
  onViewAllLogs,
  collapsedPanels,
  toggleCollapse,
}) => {
  const sparklineRef = useRef<HTMLCanvasElement | null>(null);

  // Live mini sparkline graph for network telemetry
  useEffect(() => {
    const canvas = sparklineRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;
    const points: number[] = [10, 14, 18, 16, 22, 19, 25, 20, 24, 28, 22, 26, 30, 25];

    const render = () => {
      offset += 0.04;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();

      const step = w / (points.length - 1);
      for (let i = 0; i < points.length; i++) {
        const val = points[i] + Math.sin(offset + i * 0.7) * 3;
        const x = i * step;
        const y = h - (val / 35) * (h - 3);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, 'rgba(0, 240, 255, 0.2)');
      fillGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = fillGrad;
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleQuickAction = (actionName: string) => {
    eventBus.emit('log', { text: `Triggering action: [${actionName}]`, level: 'info' });

    if (actionName === 'Play music' || actionName === 'Open apps' || actionName === 'Go home') {
      eventBus.emit('action', {
        id: `act-${Date.now()}`,
        title: actionName,
        description: `Action "${actionName}" cannot run from a web page.`,
        needsAndroidApp: true,
        status: 'pending',
      });
      eventBus.emit('speak', { text: `Commander, ${actionName} requires the JEXA Android app.` });
    } else {
      getActiveBrain().send('Show all available quick tools and capabilities');
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
    <div className="flex flex-col gap-1.5 w-full h-full overflow-y-auto pl-0.5 font-mono text-[11px] select-none">
      {/* 1. Live Activity */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              Live Activity
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onViewAllLogs}
              className="text-[9px] text-cyan-400 hover:text-cyan-200 underline flex items-center gap-0.5"
            >
              <span>View all</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => toggleCollapse('live_act')}
              className="p-0.5 text-slate-400 hover:text-cyan-300"
              aria-label="Collapse Live Activity"
            >
              {collapsedPanels['live_act'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {!collapsedPanels['live_act'] && (
          <div className="pt-1.5 space-y-1 max-h-[105px] overflow-y-auto pr-0.5">
            {logs.length === 0 ? (
              <p className="text-center py-2.5 text-slate-500 italic text-[10px]">
                No activity yet. Send a command.
              </p>
            ) : (
              logs.slice(0, 4).map((log) => (
                <div key={log.id} className="flex items-start gap-1.5 text-[9.5px]">
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                      log.level === 'error'
                        ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                        : log.level === 'warn'
                        ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                        : log.level === 'success'
                        ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                        : 'bg-cyan-400 shadow-[0_0_6px_#00f0ff]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[8.5px] text-slate-500">{formatTime(log.timestamp)}</div>
                    <p className="text-slate-300 truncate leading-tight">{log.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 2. Device and System */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              Device and System
            </span>
          </div>
          <button
            onClick={() => toggleCollapse('dev_sys')}
            className="p-0.5 text-slate-400 hover:text-cyan-300"
            aria-label="Collapse Device and System"
          >
            {collapsedPanels['dev_sys'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>

        {!collapsedPanels['dev_sys'] && (
          <div className="pt-1.5 space-y-1.5 text-[9.5px]">
            {/* Device Name */}
            <div className="flex justify-between text-slate-400 pb-0.5 border-b border-slate-800/60">
              <span>Client:</span>
              <span className="text-cyan-300 font-semibold">{deviceData.deviceName}</span>
            </div>

            {/* Battery */}
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Battery</span>
                <span className="text-cyan-300 font-semibold">
                  {deviceData.batteryLevel !== null ? `${deviceData.batteryLevel}%` : 'Not available'}
                  {deviceData.isCharging && ' ⚡'}
                </span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400"
                  style={{ width: `${deviceData.batteryLevel ?? 0}%` }}
                />
              </div>
            </div>

            {/* Storage */}
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>App storage</span>
                <span className="text-cyan-300 font-semibold">
                  {deviceData.storagePercent !== null ? `${deviceData.storagePercent}%` : 'Not available'}
                </span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${deviceData.storagePercent ?? 0}%` }}
                />
              </div>
            </div>

            {/* RAM */}
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>System RAM</span>
                <span className="text-cyan-300 font-semibold">
                  {deviceData.deviceMemoryGB !== null ? `≈ ${deviceData.deviceMemoryGB} GB` : 'Not available'}
                </span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400"
                  style={{ width: `${deviceData.deviceMemoryGB ? Math.min(100, deviceData.deviceMemoryGB * 12) : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Network Status */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              Network Status
            </span>
          </div>
          <button
            onClick={() => toggleCollapse('net_status')}
            className="p-0.5 text-slate-400 hover:text-cyan-300"
            aria-label="Collapse Network Status"
          >
            {collapsedPanels['net_status'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>

        {!collapsedPanels['net_status'] && (
          <div className="pt-1.5 space-y-1 text-[9.5px]">
            <div className="flex justify-between text-slate-300">
              <span>Quality:</span>
              <span className="text-emerald-400 font-semibold">
                {deviceData.isOnline ? `Online (${deviceData.connectionType})` : 'Offline'}
              </span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Speed:</span>
              <span className="text-cyan-300 font-semibold">
                {deviceData.downlinkSpeedMbps !== null ? `${deviceData.downlinkSpeedMbps} Mbps` : 'Not available'}
              </span>
            </div>

            {/* Live Sparkline Graph */}
            <div className="mt-1 pt-1 border-t border-slate-800/80">
              <span className="text-[8.5px] uppercase tracking-wider text-slate-400 block mb-0.5">
                Bandwidth Telemetry
              </span>
              <canvas
                ref={sparklineRef}
                width={180}
                height={24}
                className="w-full h-6 rounded bg-[#040a16] border border-cyan-500/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. Quick Actions */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              Quick Actions
            </span>
          </div>
          <button
            onClick={() => toggleCollapse('quick_actions')}
            className="p-0.5 text-slate-400 hover:text-cyan-300"
            aria-label="Collapse Quick Actions"
          >
            {collapsedPanels['quick_actions'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>

        {!collapsedPanels['quick_actions'] && (
          <div className="pt-1.5 grid grid-cols-2 gap-1">
            <button
              onClick={() => handleQuickAction('Play music')}
              className="py-1 px-1.5 rounded bg-[#061120] hover:bg-[#0b1f3b] border border-cyan-500/30 text-cyan-300 text-[9.5px] flex items-center gap-1 transition-colors active:scale-95 truncate"
            >
              <Music className="w-3 h-3 shrink-0" />
              <span>Play music</span>
            </button>
            <button
              onClick={() => handleQuickAction('Open apps')}
              className="py-1 px-1.5 rounded bg-[#061120] hover:bg-[#0b1f3b] border border-cyan-500/30 text-cyan-300 text-[9.5px] flex items-center gap-1 transition-colors active:scale-95 truncate"
            >
              <Grid className="w-3 h-3 shrink-0" />
              <span>Open apps</span>
            </button>
            <button
              onClick={() => handleQuickAction('Go home')}
              className="py-1 px-1.5 rounded bg-[#061120] hover:bg-[#0b1f3b] border border-cyan-500/30 text-cyan-300 text-[9.5px] flex items-center gap-1 transition-colors active:scale-95 truncate"
            >
              <Home className="w-3 h-3 shrink-0" />
              <span>Go home</span>
            </button>
            <button
              onClick={() => handleQuickAction('More')}
              className="py-1 px-1.5 rounded bg-[#061120] hover:bg-[#0b1f3b] border border-cyan-500/30 text-cyan-300 text-[9.5px] flex items-center gap-1 transition-colors active:scale-95 truncate"
            >
              <MoreHorizontal className="w-3 h-3 shrink-0" />
              <span>More</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
