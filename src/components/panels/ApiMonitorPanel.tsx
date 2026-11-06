import React, { useState } from 'react';
import { ProviderState } from '../../events/useJexaStore';
import { eventBus } from '../../events/eventBus';
import { RefreshCw, AlertCircle, Clock } from 'lucide-react';

interface ApiMonitorPanelProps {
  providers: Record<string, ProviderState>;
}

export const ApiMonitorPanel: React.FC<ApiMonitorPanelProps> = ({ providers }) => {
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const testProvider = async (name: string) => {
    setRefreshing(name);
    eventBus.emit('provider', { name, status: 'busy' });

    const backendUrl = localStorage.getItem('jexa_backend_url') || (typeof window !== 'undefined' ? window.location.origin : '');
    const accessToken = localStorage.getItem('jexa_access_token') || '';

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(`${backendUrl}/api/providers/ping`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider: name }),
      });
      const data = await res.json();
      eventBus.emit('provider', {
        name,
        status: data.configured ? 'connected' : 'not_configured',
        latencyMs: data.latencyMs ?? null,
      });
    } catch {
      eventBus.emit('provider', { name, status: 'error' });
    } finally {
      setRefreshing(null);
    }
  };

  const providerList = Object.values(providers);

  return (
    <div className="space-y-2 font-mono text-xs">
      <div className="text-[10px] text-slate-400 pb-1 border-b border-cyan-950/60 flex justify-between">
        <span>Provider</span>
        <span>Status</span>
      </div>

      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
        {providerList.map((p) => {
          const isError = p.status === 'error';
          const isConnected = p.status === 'connected';

          return (
            <div
              key={p.name}
              className="p-1.5 rounded bg-[#0b1422]/70 border border-slate-800/80 flex items-center justify-between"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isError
                      ? 'bg-rose-500'
                      : isConnected
                      ? 'bg-emerald-400'
                      : 'bg-slate-600'
                  }`}
                />
                <span className="font-semibold text-slate-200 text-[11px]">{p.name}</span>
              </div>

              <div className="flex items-center gap-2 text-[10px]">
                {p.latencyMs !== null && isConnected ? (
                  <span className="text-cyan-400 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {p.latencyMs}ms
                  </span>
                ) : (
                  <span className="text-slate-500">
                    {isConnected ? 'Connected' : 'Not configured'}
                  </span>
                )}
                <button
                  onClick={() => testProvider(p.name)}
                  disabled={refreshing === p.name}
                  aria-label={`Ping ${p.name}`}
                  className="p-1 text-slate-400 hover:text-cyan-300 rounded"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing === p.name ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
