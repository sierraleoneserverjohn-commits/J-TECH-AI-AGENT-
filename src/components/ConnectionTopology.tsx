import React, { useState } from 'react';
import { ProviderState } from '../events/useJexaStore';
import { eventBus } from '../events/eventBus';
import {
  Sparkles,
  Zap,
  Cpu,
  Globe,
  Database,
  Layers,
  GitBranch,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';

interface ConnectionTopologyProps {
  providers: Record<string, ProviderState>;
  centerSize?: number;
  radius?: number;
}

const PROVIDER_METAS = [
  { name: 'Gemini', icon: Sparkles, initial: 'G', label: 'Gemini' },
  { name: 'Groq', icon: Zap, initial: 'GQ', label: 'Groq' },
  { name: 'OpenRouter', icon: Cpu, initial: 'OR', label: 'OpenRouter' },
  { name: 'Tavily', icon: Globe, initial: 'TV', label: 'Tavily' },
  { name: 'Supabase', icon: Database, initial: 'SB', label: 'Supabase' },
  { name: 'Upstash Redis', icon: Layers, initial: 'RD', label: 'Upstash' },
  { name: 'GitHub', icon: GitBranch, initial: 'GH', label: 'GitHub' },
  { name: 'Backend server', icon: Server, initial: 'SRV', label: 'Backend' },
];

export const ConnectionTopology: React.FC<ConnectionTopologyProps> = ({
  providers,
  radius = 160,
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);

  const selectedProvider = selectedNode ? providers[selectedNode] : null;

  const handlePingNode = async (providerName: string) => {
    setIsPinging(true);
    eventBus.emit('provider', { name: providerName, status: 'busy' });
    eventBus.emit('log', { text: `Dispatching network latency probe to ${providerName}...`, level: 'info' });

    try {
      const res = await fetch('/api/providers/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerName }),
      });
      const data = await res.json();
      eventBus.emit('provider', {
        name: providerName,
        status: data.configured ? 'connected' : 'not_configured',
        latencyMs: data.latencyMs ?? null,
      });
      eventBus.emit('log', {
        text: `Ping ack from ${providerName}: ${data.latencyMs ?? 'N/A'}ms`,
        level: 'success',
      });
    } catch {
      eventBus.emit('provider', {
        name: providerName,
        status: 'error',
      });
    } finally {
      setIsPinging(false);
    }
  };

  const getStatusColor = (status: ProviderState['status']) => {
    switch (status) {
      case 'connected':
        return { ring: 'border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.5)]', dot: 'bg-emerald-400', text: 'text-emerald-400' };
      case 'busy':
        return { ring: 'border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.6)] animate-pulse', dot: 'bg-amber-400', text: 'text-amber-400' };
      case 'error':
        return { ring: 'border-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.6)]', dot: 'bg-rose-500', text: 'text-rose-400' };
      case 'not_configured':
      case 'standby':
      default:
        return { ring: 'border-slate-600 shadow-none', dot: 'bg-slate-500', text: 'text-slate-400' };
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* SVG Vector Connection lines */}
      <svg className="absolute w-full h-full inset-0 pointer-events-none overflow-visible">
        <defs>
          {/* Radial gradient line definitions */}
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.45)" />
            <stop offset="100%" stopColor="rgba(14, 165, 233, 0.08)" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {PROVIDER_METAS.map((meta, index) => {
          const angle = (index / PROVIDER_METAS.length) * Math.PI * 2 - Math.PI / 2;
          const nodeX = `calc(50% + ${Math.cos(angle) * radius}px)`;
          const nodeY = `calc(50% + ${Math.sin(angle) * (radius * 0.72)}px)`; // Slight oval for landscape aspect ratio
          const prov = providers[meta.name];
          const isBusy = prov?.status === 'busy';

          return (
            <g key={`line-${meta.name}`}>
              {/* Static hairline connector */}
              <line
                x1="50%"
                y1="50%"
                x2={nodeX}
                y2={nodeY}
                stroke={isBusy ? 'rgba(245, 158, 11, 0.6)' : 'rgba(56, 189, 248, 0.22)'}
                strokeWidth={isBusy ? '2' : '1'}
                strokeDasharray={isBusy ? '4 2' : 'none'}
              />

              {/* Data flow pulse animation */}
              {(prov?.status === 'connected' || prov?.status === 'busy') && (
                <circle r={isBusy ? '4' : '2.5'} fill={isBusy ? '#fbbf24' : '#38bdf8'} filter="url(#glow)">
                  <animateMotion
                    path={`M calc(50%),calc(50%) L ${nodeX},${nodeY}`}
                    dur={isBusy ? '0.8s' : '2.6s'}
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes positioned in ellipse around central orb */}
      {PROVIDER_METAS.map((meta, index) => {
        const angle = (index / PROVIDER_METAS.length) * Math.PI * 2 - Math.PI / 2;
        const prov = providers[meta.name] || {
          status: 'standby',
          latencyMs: 80,
          requestsToday: 0,
          lastUsedTime: Date.now(),
        };
        const colors = getStatusColor(prov.status);
        const IconComponent = meta.icon;

        // Position coordinates
        const xOffset = Math.cos(angle) * radius;
        const yOffset = Math.sin(angle) * (radius * 0.72);

        return (
          <div
            key={meta.name}
            style={{
              transform: `translate(${xOffset}px, ${yOffset}px)`,
            }}
            className="absolute pointer-events-auto"
          >
            <button
              onClick={() => setSelectedNode(meta.name)}
              aria-label={`View status of ${meta.name} node`}
              className={`relative group w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#0a121e]/90 backdrop-blur-md border-2 ${colors.ring} flex flex-col items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400`}
            >
              <IconComponent className={`w-4 h-4 md:w-5 md:h-5 ${colors.text} transition-colors`} />

              {/* Status micro-dot */}
              <span
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-[#080d15] ${colors.dot}`}
              />

              {/* Node label */}
              <span className="absolute -bottom-4 whitespace-nowrap text-[9px] font-mono tracking-wider text-slate-300 group-hover:text-cyan-300 transition-colors bg-[#080d15]/80 px-1 rounded">
                {meta.label}
              </span>
            </button>
          </div>
        );
      })}

      {/* Tapped Node Details Card Modal */}
      {selectedProvider && (
        <div className="absolute z-50 pointer-events-auto p-4 max-w-xs w-72 bg-[#09111c]/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl shadow-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-cyan-900/40">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${getStatusColor(selectedProvider.status).dot}`}
              />
              <h4 className="text-sm font-semibold text-white tracking-wide">
                {selectedProvider.name}
              </h4>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800/50"
              aria-label="Close node details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mt-2 mb-3">
            {selectedProvider.description || `${selectedProvider.name} service connection endpoint.`}
          </p>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-cyan-400" /> Status
              </span>
              <span className={`uppercase font-semibold ${getStatusColor(selectedProvider.status).text}`}>
                {selectedProvider.status}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Latency
              </span>
              <span className="text-white">
                {selectedProvider.latencyMs !== null && selectedProvider.latencyMs !== undefined
                  ? `${selectedProvider.latencyMs} ms`
                  : 'Not available'}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Requests today
              </span>
              <span className="text-white font-medium">{selectedProvider.requestsToday}</span>
            </div>

            {/* Quota bar if reported */}
            {selectedProvider.freeQuotaUsed !== undefined && selectedProvider.freeQuotaMax !== undefined && (
              <div className="pt-1">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Free Quota</span>
                  <span>{selectedProvider.freeQuotaUsed} / {selectedProvider.freeQuotaMax}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (selectedProvider.freeQuotaUsed / selectedProvider.freeQuotaMax) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {selectedProvider.lastError && (
              <div className="mt-2 p-2 bg-rose-950/40 border border-rose-800/50 rounded text-rose-300 text-[11px] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
                <span className="truncate">{selectedProvider.lastError}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-2 border-t border-slate-800 flex gap-2">
            <button
              onClick={() => handlePingNode(selectedProvider.name)}
              disabled={isPinging}
              className="flex-1 py-2 px-3 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 active:scale-95 border border-cyan-500/40 rounded-lg transition-all flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
              {isPinging ? 'Probing...' : 'Test Connection'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
