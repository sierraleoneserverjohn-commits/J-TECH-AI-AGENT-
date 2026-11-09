import React, { useState, useEffect } from 'react';
import { BackendSystemStatus } from '../../events/useJexaStore';
import { eventBus } from '../../events/eventBus';
import { getActiveBrain } from '../../brains';
import { toolRegistry, Tool } from '../../tools';
import {
  ShieldCheck,
  Cpu,
  Layers,
  Database,
  Terminal,
  ChevronRight,
  ChevronDown,
  Minimize2,
  Maximize2,
  Circle,
  Play,
  Camera,
  ExternalLink,
  X,
  Loader2,
  Sparkles,
  Settings,
} from 'lucide-react';

interface LeftColumnProps {
  systemStatus: BackendSystemStatus;
  activeModel: string;
  setActiveModel: (model: string) => void;
  collapsedPanels: Record<string, boolean>;
  toggleCollapse: (panelId: string) => void;
  onOpenVision?: () => void;
  onOpenSettings?: () => void;
}

export const LeftColumn: React.FC<LeftColumnProps> = ({
  systemStatus,
  activeModel,
  setActiveModel,
  collapsedPanels,
  toggleCollapse,
  onOpenVision,
  onOpenSettings,
}) => {
  const isBackendConnected = systemStatus.backendReachable;

  // Real modular tool registry list
  const [toolsList, setToolsList] = useState<Tool[]>(() => toolRegistry.getAll());
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [toolInput, setToolInput] = useState<string>('');
  const [toolRunning, setToolRunning] = useState<boolean>(false);
  const [toolOutput, setToolOutput] = useState<{ text: string; sources?: Array<{ title: string; url: string }>; success?: boolean } | null>(null);

  // Sync tools list when registry or events change
  useEffect(() => {
    const updateTools = () => {
      setToolsList([...toolRegistry.getAll()]);
    };
    const unsub = eventBus.on('tool', updateTools);
    return unsub;
  }, []);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setActiveModel(newModel);
    localStorage.setItem('jexa_active_model', newModel);
    eventBus.emit('log', {
      text: `Active model switched to: ${newModel}`,
      level: 'info',
    });
  };

  const handleOpenToolCard = (tool: Tool) => {
    setSelectedTool(tool);
    setToolInput('');
    setToolOutput(null);
  };

  const handleExecuteTool = async () => {
    if (!selectedTool) return;
    setToolRunning(true);
    setToolOutput(null);

    try {
      const res = await toolRegistry.executeTool(selectedTool.id, toolInput);
      setToolOutput({
        text: res.output,
        sources: res.sources,
        success: res.success,
      });
    } catch (err: any) {
      setToolOutput({
        text: `Execution failed: ${err.message || 'Unknown error'}`,
        success: false,
      });
    } finally {
      setToolRunning(false);
    }
  };

  const handleRunCommand = (cmd: string) => {
    getActiveBrain().send(cmd);
  };

  const getStatusBadge = (status: Tool['status']) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-emerald-950/70 text-emerald-400 border border-emerald-500/40">
            READY
          </span>
        );
      case 'active':
        return (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-cyan-950/70 text-cyan-300 border border-cyan-400/50 animate-pulse">
            ACTIVE
          </span>
        );
      case 'planned':
        return (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-slate-900 text-slate-400 border border-slate-700">
            PLANNED
          </span>
        );
      case 'needs_android_app':
        return (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-amber-950/70 text-amber-300 border border-amber-500/40">
            NEEDS ANDROID
          </span>
        );
      case 'error':
        return (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-rose-950/70 text-rose-300 border border-rose-500/40">
            ERROR
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full h-full overflow-y-auto pr-0.5 font-mono text-[11px] select-none">
      {/* 0. Quick Access Settings Item (Always reachable from Left Drawer) */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full py-1.5 px-2.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 flex items-center justify-between shrink-0 shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-all active:scale-98"
        >
          <div className="flex items-center gap-1.5 font-heading text-[10px] uppercase font-bold tracking-wider">
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span>JEXA Settings</span>
          </div>
          <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-mono">Open ⚙</span>
        </button>
      )}

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

            {/* Real Checklist */}
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
                    toolsList.length > 0 ? 'text-emerald-400 fill-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span className={toolsList.length > 0 ? 'text-slate-200' : 'text-slate-500'}>
                  {toolsList.length > 0 ? `${toolsList.length} tools active` : 'Tools: none registered'}
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
            <div className="grid grid-cols-3 gap-1 text-[9px]">
              {['Gemini', 'Groq', 'OpenRouter'].map((name) => {
                const prov = systemStatus.providers[name];
                const isOnline = isBackendConnected && prov?.status === 'connected';

                return (
                  <div key={name} className="flex items-center gap-1 bg-[#050e1c] p-1 rounded border border-slate-800">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-600'
                      }`}
                    />
                    <div className="truncate">
                      <span className={`block font-medium ${isOnline ? 'text-slate-200' : 'text-slate-500'}`}>
                        {name}
                      </span>
                      <span className="text-[8px] text-slate-500 block leading-tight">
                        {isOnline ? 'Online' : 'Not configured'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

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

      {/* 4. Modular Tools Center (Reads Registry with Live Status Badges & Run Cards) */}
      <div className="hud-corner-box hud-corner-accent rounded-lg p-2 shrink-0">
        <div className="flex items-center justify-between pb-1 border-b border-cyan-950/70">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-heading font-semibold text-slate-100 uppercase text-[10px] tracking-wider">
              Tools Center ({toolsList.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onOpenVision && (
              <button
                onClick={onOpenVision}
                title="Launch Vision Studio"
                className="px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/40 text-cyan-300 text-[8.5px] flex items-center gap-1"
              >
                <Camera className="w-2.5 h-2.5" />
                <span>Vision</span>
              </button>
            )}
            <button
              onClick={() => toggleCollapse('tools_center')}
              className="p-0.5 text-slate-400 hover:text-cyan-300"
              aria-label="Collapse Tools Center"
            >
              {collapsedPanels['tools_center'] ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {!collapsedPanels['tools_center'] && (
          <div className="pt-1.5 space-y-1">
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
              {toolsList.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleOpenToolCard(tool)}
                  className="w-full text-left p-1.5 rounded bg-[#061120] hover:bg-[#0a1e38] border border-cyan-900/40 hover:border-cyan-500/50 flex items-center justify-between transition-colors group active:scale-98"
                >
                  <div className="min-w-0 pr-1">
                    <div className="font-heading font-medium text-cyan-200 group-hover:text-cyan-100 text-[10px] truncate">
                      {tool.name}
                    </div>
                    <div className="text-[8.5px] text-slate-400 truncate max-w-[140px]">
                      {tool.description}
                    </div>
                  </div>
                  <div className="shrink-0">{getStatusBadge(tool.status)}</div>
                </button>
              ))}
            </div>
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
              { label: 'Search AI breakthroughs', cmd: 'Search AI breakthroughs' },
              { label: 'Inspect GitHub repository', cmd: 'Inspect GitHub repo' },
              { label: 'Analyze web page', cmd: 'Browse URL' },
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

      {/* MODAL / CARD: TOOL RUN DRAWER CARD */}
      {selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-xl bg-[#050f1d] border border-cyan-500/50 shadow-[0_0_30px_rgba(0,240,255,0.25)] p-3 text-slate-200 font-mono flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="font-heading font-semibold text-xs text-cyan-200">{selectedTool.name}</span>
                {getStatusBadge(selectedTool.status)}
              </div>
              <button
                onClick={() => setSelectedTool(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[10px] text-slate-300">{selectedTool.description}</p>

            {selectedTool.id === 'vision_engine' && onOpenVision && (
              <button
                onClick={() => {
                  setSelectedTool(null);
                  onOpenVision();
                }}
                className="w-full py-1.5 px-3 rounded bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400 text-cyan-200 text-[10px] flex items-center justify-center gap-1.5 transition-all"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Launch Interactive Vision Studio</span>
              </button>
            )}

            {/* Run Input Field */}
            <div>
              <label className="text-[9px] uppercase tracking-wider text-slate-400 block mb-1">
                Run Parameter / Query
              </label>
              <textarea
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                placeholder={
                  selectedTool.id === 'web_search'
                    ? 'Enter query (e.g. quantum computing 2026)'
                    : selectedTool.id === 'browser_agent'
                    ? 'Enter URL (e.g. https://news.ycombinator.com)'
                    : selectedTool.id === 'code_intelligence'
                    ? 'Enter repo or owner/repo'
                    : 'Enter input arguments...'
                }
                rows={2}
                className="w-full p-1.5 rounded bg-[#030913] border border-cyan-900 focus-visible:border-cyan-400 focus-visible:outline-none text-[10px] text-cyan-100 font-mono resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedTool(null)}
                className="px-2.5 py-1 rounded text-[10px] text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
              <button
                onClick={handleExecuteTool}
                disabled={toolRunning}
                className="px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold text-[10px] flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.4)] active:scale-95 transition-all"
              >
                {toolRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-black" />}
                <span>{toolRunning ? 'Executing...' : 'Run Tool'}</span>
              </button>
            </div>

            {/* Tool Output Box */}
            {toolOutput && (
              <div className="mt-1 p-2 rounded bg-[#020710] border border-cyan-950 text-[9.5px] max-h-36 overflow-y-auto space-y-1">
                <div className="text-slate-400 text-[8.5px] uppercase tracking-wider">Output Result:</div>
                <div className={toolOutput.success !== false ? 'text-cyan-100' : 'text-rose-300'}>
                  {toolOutput.text}
                </div>
                {toolOutput.sources && toolOutput.sources.length > 0 && (
                  <div className="pt-1 border-t border-slate-800">
                    <span className="text-[8.5px] text-slate-400 block mb-0.5">Sources:</span>
                    <div className="flex flex-col gap-0.5">
                      {toolOutput.sources.map((s, idx) => (
                        <a
                          key={idx}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] text-cyan-400 hover:underline flex items-center gap-1 truncate"
                        >
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{s.title || s.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
