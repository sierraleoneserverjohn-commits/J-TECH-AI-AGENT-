import React from 'react';
import { BackendSystemStatus } from '../../events/useJexaStore';
import { eventBus } from '../../events/eventBus';
import { getActiveBrain } from '../../brains';
import {
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Layers,
  Database,
  Search,
  Calculator,
  BarChart3,
  Terminal,
  ChevronRight,
  ChevronDown,
  Minimize2,
  Maximize2,
  Circle,
} from 'lucide-react';

interface LeftColumnProps {
  systemStatus: BackendSystemStatus;
  activeModel: string;
  setActiveModel: (model: string) => void;
  collapsedPanels: Record<string, boolean>;
  toggleCollapse: (panelId: string) => void;
}

export const LeftColumn: React.FC<LeftColumnProps> = ({
  systemStatus,
  activeModel,
  setActiveModel,
  collapsedPanels,
  toggleCollapse,
}) => {
  const isBackendConnected = systemStatus.backendReachable;

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setActiveModel(newModel);
    localStorage.setItem('jexa_active_model', newModel);
    eventBus.emit('log', {
      text: `Active model switched to: ${newModel}`,
      level: 'info',
    });
  };

  const handleRunTool = (toolName: string) => {
    eventBus.emit('tool', { name: toolName, status: 'calling', detail: `Running tool [${toolName}]` });
    eventBus.emit('activity', { id: `tool-${toolName}`, label: `Tool: ${toolName}`, active: true });
    eventBus.emit('state', { state: 'running_tools', detail: `Executing routine: ${toolName}...` });
    eventBus.emit('log', { text: `Running tool [${toolName}]...`, level: 'info' });
    getActiveBrain().send(`Execute tool: ${toolName}`);
  };

  const handleRunCommand = (cmd: string) => {
    getActiveBrain().send(cmd);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full h-full overflow-y-auto pr-0.5 font-mono text-[11px] select-none">
      {/* 1. System Overview */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              System Overview
            </span>
          </div>
          <button
            onClick={() => toggleCollapse('sys_overview')}
            className="p-0.5 text-slate-400 hover:text-cyan-300"
            aria-label="Collapse System Overview"
          >
            {collapsedPanels['sys_overview'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>

        {!collapsedPanels['sys_overview'] && (
          <div className="pt-1.5 flex items-center gap-2.5">
            {/* Circular Health Gauge */}
            <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="24" cy="24" r="20" stroke="#0a1829" strokeWidth="3.5" fill="none" />
                {isBackendConnected && systemStatus.healthPercent !== null && (
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#00f0ff"
                    strokeWidth="3.5"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - (125.6 * systemStatus.healthPercent) / 100}
                    strokeLinecap="round"
                    fill="none"
                    className="transition-all duration-300"
                  />
                )}
              </svg>
              <span className={`absolute font-heading font-bold text-xs ${isBackendConnected ? 'text-cyan-300' : 'text-slate-500'}`}>
                {isBackendConnected && systemStatus.healthPercent !== null ? `${systemStatus.healthPercent}%` : '—'}
              </span>
            </div>

            {/* Checklist */}
            <div className="flex-1 space-y-0.5 text-[9.5px]">
              <div className="flex items-center gap-1.5">
                <Circle
                  className={`w-2.5 h-2.5 shrink-0 ${
                    isBackendConnected ? 'text-emerald-400 fill-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span className={isBackendConnected ? 'text-slate-200' : 'text-slate-500'}>
                  {isBackendConnected ? 'Backend online' : 'Backend: not connected'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Circle
                  className={`w-2.5 h-2.5 shrink-0 ${
                    systemStatus.databaseReachable ? 'text-emerald-400 fill-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span className={systemStatus.databaseReachable ? 'text-slate-200' : 'text-slate-500'}>
                  {systemStatus.databaseReachable ? 'Database ready' : 'Database: not connected'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Circle
                  className={`w-2.5 h-2.5 shrink-0 ${
                    systemStatus.models.length > 0 ? 'text-emerald-400 fill-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span className={systemStatus.models.length > 0 ? 'text-slate-200' : 'text-slate-500'}>
                  {systemStatus.models.length > 0 ? 'AI models connected' : 'AI models: not connected'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Circle
                  className={`w-2.5 h-2.5 shrink-0 ${
                    systemStatus.tools.length > 0 ? 'text-emerald-400 fill-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span className={systemStatus.tools.length > 0 ? 'text-slate-200' : 'text-slate-500'}>
                  {systemStatus.tools.length > 0 ? 'Tools active' : 'Tools: none registered'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. AI Network */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              AI Network
            </span>
          </div>
          <button
            onClick={() => toggleCollapse('ai_network')}
            className="p-0.5 text-slate-400 hover:text-cyan-300"
            aria-label="Collapse AI Network"
          >
            {collapsedPanels['ai_network'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>

        {!collapsedPanels['ai_network'] && (
          <div className="pt-1.5 space-y-1.5">
            {/* Providers with Online/Not configured dots & Quota Warning */}
            <div className="grid grid-cols-3 gap-1 text-[9px]">
              {['Gemini', 'Groq', 'OpenRouter'].map((name) => {
                const prov = systemStatus.providers[name];
                const isOnline = isBackendConnected && prov?.status === 'connected';
                const hasQuotaWarning = (prov as any)?.quotaWarning || ((prov as any)?.remainingQuotaPercent !== undefined && (prov as any).remainingQuotaPercent < 20);

                return (
                  <div key={name} className={`flex items-center gap-1 bg-[#050e1c] p-1 rounded border ${hasQuotaWarning ? 'border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]' : 'border-slate-800'}`}>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        hasQuotaWarning
                          ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse'
                          : isOnline
                          ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                          : 'bg-slate-600'
                      }`}
                    />
                    <div className="truncate">
                      <span className={`block font-medium ${hasQuotaWarning ? 'text-amber-300' : isOnline ? 'text-slate-200' : 'text-slate-500'}`}>
                        {name}
                      </span>
                      <span className="text-[8px] text-slate-500 block leading-tight">
                        {hasQuotaWarning ? 'Quota <20%' : isOnline ? 'Online' : 'Not configured'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Switch Model Dropdown */}
            <div>
              <label className="text-[8.5px] uppercase tracking-wider text-slate-400 block mb-0.5">
                Active Model
              </label>
              <div className="relative">
                <select
                  value={activeModel}
                  onChange={handleModelChange}
                  disabled={!isBackendConnected || systemStatus.models.length === 0}
                  className="w-full py-1 px-1.5 pr-5 rounded bg-[#071322] border border-cyan-500/30 text-[9.5px] text-cyan-200 disabled:text-slate-600 disabled:border-slate-800 disabled:bg-slate-950 focus-visible:ring-1 focus-visible:ring-cyan-400 appearance-none font-mono"
                >
                  {isBackendConnected && systemStatus.models.length > 0 ? (
                    systemStatus.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))
                  ) : (
                    <option value="">No models available</option>
                  )}
                </select>
                <ChevronDown className="w-3 h-3 text-cyan-400 absolute right-1.5 top-1.5 pointer-events-none" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Memory Status */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              Memory Status
            </span>
          </div>
          <button
            onClick={() => toggleCollapse('mem_status')}
            className="p-0.5 text-slate-400 hover:text-cyan-300"
            aria-label="Collapse Memory Status"
          >
            {collapsedPanels['mem_status'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>

        {!collapsedPanels['mem_status'] && (
          <div className="pt-1.5 space-y-1.5 text-[9.5px]">
            {isBackendConnected && systemStatus.memoryConnected ? (
              <>
                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>Working Memory</span>
                    <span className="text-cyan-300 font-semibold">{systemStatus.workingCount} items</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400"
                      style={{ width: `${Math.min(100, systemStatus.workingCount > 0 ? systemStatus.workingCount * 20 : 0)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>Long-Term Memory</span>
                    <span className="text-emerald-300 font-semibold">{systemStatus.longTermCount} records</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${Math.min(100, systemStatus.longTermCount > 0 ? systemStatus.longTermCount * 20 : 0)}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-1 text-slate-500 italic">
                {isBackendConnected ? 'Memory store not configured' : 'Not connected'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Tools Center */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              Tools Center
            </span>
          </div>
          <button
            onClick={() => toggleCollapse('tools_center')}
            className="p-0.5 text-slate-400 hover:text-cyan-300"
            aria-label="Collapse Tools Center"
          >
            {collapsedPanels['tools_center'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>

        {!collapsedPanels['tools_center'] && (
          <div className="pt-1.5">
            {isBackendConnected && systemStatus.tools.length > 0 ? (
              <div className="grid grid-cols-2 gap-1">
                {systemStatus.tools.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleRunTool(t.name)}
                    className="py-1 px-1.5 rounded bg-[#061120] hover:bg-[#0b1f3b] border border-cyan-500/30 text-cyan-300 text-[9.5px] flex items-center gap-1 transition-colors active:scale-95 truncate"
                  >
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-1 text-slate-500 italic text-[9.5px]">
                No tools registered
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. JEXA Commands */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              JEXA Commands
            </span>
          </div>
          <button
            onClick={() => toggleCollapse('jexa_cmds')}
            className="p-0.5 text-slate-400 hover:text-cyan-300"
            aria-label="Collapse JEXA Commands"
          >
            {collapsedPanels['jexa_cmds'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>

        {!collapsedPanels['jexa_cmds'] && (
          <div className="pt-1.5 space-y-1">
            {[
              { label: 'Open WhatsApp', cmd: 'Open WhatsApp' },
              { label: 'Search for AI news', cmd: 'Search for AI news' },
              { label: 'Show my calendar', cmd: 'Show my calendar' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => handleRunCommand(item.cmd)}
                className="w-full py-1 px-1.5 rounded bg-[#061120]/90 hover:bg-[#0d2342] border border-cyan-500/25 hover:border-cyan-400/60 text-slate-200 hover:text-cyan-200 text-[9.5px] text-left flex items-center justify-between transition-colors group active:scale-98"
              >
                <span className="truncate">"{item.label}"</span>
                <ChevronRight className="w-3 h-3 text-cyan-400/60 group-hover:text-cyan-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
