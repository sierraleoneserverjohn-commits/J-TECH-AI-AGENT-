import React, { useState, useEffect } from 'react';
import { getActiveBrainId } from '../brains';
import { eventBus } from '../events/eventBus';
import { ApiClient } from '../api/client';
import { speechManager } from '../voice/SpeechEngineManager';
import { LiveVoiceName, VoiceMode } from '../voice/types';
import {
  Settings,
  Server,
  Check,
  X,
  Shield,
  Activity,
  Key,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Clipboard,
  Mic,
  Volume2,
  Sparkles,
  Info,
  Star,
  Zap,
  Sliders,
  Layers,
  Cpu,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackendUpdated?: () => void;
}

interface DiscoveredModel {
  id: string;
  rawId: string;
  provider: 'Gemini' | 'Groq' | 'OpenRouter';
  displayName: string;
  description: string;
  recommended: boolean;
  deprecated: boolean;
  supportedTasks: Array<'chat' | 'reasoning' | 'research' | 'vision' | 'voice'>;
  contextWindow?: number;
}

export type ModelMode = 'auto' | 'manual' | 'task' | 'presets';
export type ModelPreset = 'eco' | 'balanced' | 'max';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onBackendUpdated,
}) => {
  const [, setRerender] = useState<number>(0);

  // Backend URL (defaults to stored or window origin)
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    return localStorage.getItem('jexa_backend_url') ?? (typeof window !== 'undefined' ? window.location.origin : '');
  });

  // Access Token
  const [accessToken, setAccessToken] = useState<string>(() => {
    return localStorage.getItem('jexa_access_token') || '';
  });
  const [showToken, setShowToken] = useState(false);

  // Connection Test State
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
    latencyMs?: number;
  }>({ status: 'idle', message: '' });

  // AI Model Mode State
  const [modelMode, setModelMode] = useState<ModelMode>(() => {
    return (localStorage.getItem('jexa_model_mode') as ModelMode) || 'auto';
  });

  const [selectedManualModel, setSelectedManualModel] = useState<string>(() => {
    return localStorage.getItem('jexa_model_manual') || 'gemini/gemini-3.8-flash';
  });

  const [allowFallback, setAllowFallback] = useState<boolean>(() => {
    return localStorage.getItem('jexa_allow_fallback') !== 'false';
  });

  const [selectedPreset, setSelectedPreset] = useState<ModelPreset>(() => {
    return (localStorage.getItem('jexa_model_preset') as ModelPreset) || 'balanced';
  });

  // Per Task Models
  const [taskChatModel, setTaskChatModel] = useState<string>(() => {
    return localStorage.getItem('jexa_model_task_chat') || 'gemini/gemini-3.8-flash';
  });
  const [taskReasoningModel, setTaskReasoningModel] = useState<string>(() => {
    return localStorage.getItem('jexa_model_task_reasoning') || 'gemini/gemini-3.8-flash';
  });
  const [taskResearchModel, setTaskResearchModel] = useState<string>(() => {
    return localStorage.getItem('jexa_model_task_research') || 'gemini/gemini-3.8-flash';
  });
  const [taskVisionModel, setTaskVisionModel] = useState<string>(() => {
    return localStorage.getItem('jexa_model_task_vision') || 'gemini/gemini-3.8-flash';
  });
  const [taskVoiceModel, setTaskVoiceModel] = useState<string>(() => {
    return localStorage.getItem('jexa_model_task_voice') || 'gemini/gemini-3.8-live';
  });

  // Pinned Favorites State
  const [favoriteModels, setFavoriteModels] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('jexa_favorite_models');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Discovered Models Cache
  const [allModels, setAllModels] = useState<DiscoveredModel[]>([]);
  const [chatModels, setChatModels] = useState<DiscoveredModel[]>([]);
  const [voiceModels, setVoiceModels] = useState<DiscoveredModel[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<{
    Gemini: boolean;
    Groq: boolean;
    OpenRouter: boolean;
  }>({ Gemini: false, Groq: false, OpenRouter: false });
  const [loadingModels, setLoadingModels] = useState(false);

  // Voice Settings
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => speechManager.getVoiceMode());
  const [selectedVoice, setSelectedVoice] = useState<LiveVoiceName>(() => speechManager.getSelectedVoice());
  const [testingVoice, setTestingVoice] = useState(false);

  // Fetch real discovered models on open
  const loadModels = async (forceRefresh = false) => {
    if (!ApiClient.isConnected()) return;
    setLoadingModels(true);
    try {
      const data = await ApiClient.get<{
        models: DiscoveredModel[];
        chatModels: DiscoveredModel[];
        voiceModels: DiscoveredModel[];
        configuredProviders: { Gemini: boolean; Groq: boolean; OpenRouter: boolean };
      }>(`/models${forceRefresh ? '?refresh=true' : ''}`);

      if (data.models && data.models.length > 0) {
        setAllModels(data.models);
        setChatModels(data.chatModels || data.models);
        setVoiceModels(data.voiceModels || []);
        setConfiguredProviders(data.configuredProviders || { Gemini: true, Groq: false, OpenRouter: false });
      }
    } catch (err) {
      console.warn('[Settings] Failed to fetch models list:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadModels(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleFavorite = (modelId: string) => {
    setFavoriteModels((prev) => {
      const next = prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId];
      localStorage.setItem('jexa_favorite_models', JSON.stringify(next));
      return next;
    });
  };

  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setAccessToken(text.trim());
    } catch {
      const promptText = window.prompt('Paste your Access Token:');
      if (promptText) setAccessToken(promptText.trim());
    }
  };

  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = backendUrl.trim().replace(/\/+$/, '');
    localStorage.setItem('jexa_backend_url', cleanUrl);
    localStorage.setItem('jexa_access_token', accessToken.trim());

    // Save Model Mode Configuration
    localStorage.setItem('jexa_model_mode', modelMode);
    localStorage.setItem('jexa_model_manual', selectedManualModel);
    localStorage.setItem('jexa_allow_fallback', String(allowFallback));
    localStorage.setItem('jexa_model_preset', selectedPreset);
    localStorage.setItem('jexa_model_task_chat', taskChatModel);
    localStorage.setItem('jexa_model_task_reasoning', taskReasoningModel);
    localStorage.setItem('jexa_model_task_research', taskResearchModel);
    localStorage.setItem('jexa_model_task_vision', taskVisionModel);
    localStorage.setItem('jexa_model_task_voice', taskVoiceModel);

    // Save Voice Configuration
    localStorage.setItem('jexa_voice_mode', voiceMode);
    localStorage.setItem('jexa_live_voice', selectedVoice);

    speechManager.setVoiceMode(voiceMode);
    speechManager.setSelectedVoice(selectedVoice);

    eventBus.emit('log', {
      text: `Settings saved: AI Model Mode set to "${modelMode}" (stateless sync)`,
      level: 'info',
    });

    if (onBackendUpdated) {
      onBackendUpdated();
    }
  };

  const handleTestConnection = async () => {
    const cleanUrl = backendUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      setTestResult({
        status: 'error',
        message: 'Please enter a valid Backend URL.',
      });
      return;
    }

    setTestResult({ status: 'testing', message: 'Testing backend connection and verifying token...' });
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (accessToken.trim()) {
        headers['Authorization'] = `Bearer ${accessToken.trim()}`;
      }

      const res = await fetch(`${cleanUrl}/api/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Access token rejected (401 Unauthorized). Verify your ACCESS_TOKEN matches the backend.');
        }
        if (res.status === 503) {
          throw new Error('Server may be waking up, wait about 60 seconds and try again.');
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json().catch(() => ({}));
      setTestResult({
        status: 'success',
        latencyMs,
        message: `Connected (${latencyMs}ms) • ${data.system || 'JEXA Core'} online • Providers: Gemini ${data.geminiConfigured ? '✓' : '✗'}, Groq ${data.groqConfigured ? '✓' : '✗'}, OpenRouter ${data.openRouterConfigured ? '✓' : '✗'}`,
      });

      handleSaveSettings();
      loadModels(true);
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      let friendlyMsg = err.message || 'Server unreachable';
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        friendlyMsg = 'Server may be waking up, wait about 60 seconds and try again.';
      } else if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        friendlyMsg = 'Connection blocked by CORS or server unreachable. Ensure ALLOWED_ORIGIN on your backend includes this domain.';
      }

      setTestResult({
        status: 'error',
        latencyMs,
        message: friendlyMsg,
      });
    }
  };

  const handleTestVoice = async (voice: LiveVoiceName) => {
    setTestingVoice(true);
    await speechManager.testVoice(voice);
    setTimeout(() => setTestingVoice(false), 1200);
  };

  // Helper to sort models with pinned favorites at top
  const sortModelsWithFavorites = (models: DiscoveredModel[]) => {
    return [...models].sort((a, b) => {
      const aFav = favoriteModels.includes(a.id);
      const bFav = favoriteModels.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  };

  const sortedAllModels = sortModelsWithFavorites(allModels);
  const currentManualModelObj = allModels.find((m) => m.id === selectedManualModel);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 font-mono animate-in fade-in duration-150 select-none">
      <div className="bg-[#050b16] border border-cyan-500/40 rounded-xl p-4 max-w-xl w-full shadow-2xl text-slate-100 max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-cyan-950">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white tracking-widest uppercase font-heading">
              JEXA System Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 my-3 text-[11px]">
          {/* 1. Backend URL & Access Token */}
          <div className="p-3 rounded-lg bg-[#02050c] border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Backend Connection</span>
            </div>

            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1">
                Backend URL
              </label>
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://localhost:3000 or https://jexa-backend.onrender.com"
                className="w-full py-1.5 px-2 rounded bg-[#030712] border border-slate-700 text-xs text-white placeholder-slate-600 focus-visible:ring-1 focus-visible:ring-cyan-400 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase text-slate-400 flex items-center gap-1">
                  <Key className="w-3 h-3 text-cyan-400" />
                  <span>Access Token</span>
                </label>
                <span className="text-[9.5px] text-slate-500 font-mono">
                  {accessToken.length} chars
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Bearer access token"
                  className="w-full py-1.5 pl-2 pr-20 rounded bg-[#030712] border border-slate-700 text-xs text-white placeholder-slate-600 focus-visible:ring-1 focus-visible:ring-cyan-400 font-mono"
                />
                <div className="absolute right-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    aria-label={showToken ? 'Hide access token' : 'Show access token'}
                    className="p-1 text-slate-400 hover:text-cyan-300 rounded transition-colors"
                  >
                    {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteToken}
                    title="Paste from clipboard"
                    className="py-0.5 px-1.5 text-[9px] bg-cyan-950 hover:bg-cyan-900 text-cyan-300 rounded border border-cyan-800 transition-colors flex items-center gap-0.5"
                  >
                    <Clipboard className="w-2.5 h-2.5" />
                    <span>Paste</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400">
                <Shield className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                <span>Stored only on this device.</span>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testResult.status === 'testing'}
                className="flex-1 py-1.5 px-3 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors active:scale-98 min-h-[36px]"
              >
                <Activity className={`w-3.5 h-3.5 ${testResult.status === 'testing' ? 'animate-spin' : ''}`} />
                <span>{testResult.status === 'testing' ? 'Testing...' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveSettings()}
                className="py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] uppercase font-semibold transition-colors"
              >
                Save
              </button>
            </div>

            {/* Test Result Banner */}
            {testResult.status !== 'idle' && (
              <div
                className={`p-2 rounded text-[10px] border flex items-start gap-1.5 ${
                  testResult.status === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : testResult.status === 'error'
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                {testResult.status === 'success' ? (
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
                ) : testResult.status === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin text-cyan-400" />
                )}
                <span className="leading-tight">{testResult.message}</span>
              </div>
            )}
          </div>

          {/* 2. AI MODEL MODE (Item E Specification) */}
          <div className="p-3 rounded-lg bg-[#02050c] border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>AI Model Mode</span>
              </div>
              <button
                type="button"
                onClick={() => loadModels(true)}
                disabled={loadingModels}
                title="Refresh models cache (10 min cache)"
                className="text-[9.5px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${loadingModels ? 'animate-spin' : ''}`} />
                <span>Refresh models</span>
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
              {[
                { id: 'auto', label: 'Auto', icon: Zap },
                { id: 'manual', label: 'Manual', icon: Sliders },
                { id: 'task', label: 'Per Task', icon: Layers },
                { id: 'presets', label: 'Presets', icon: Sparkles },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = modelMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setModelMode(tab.id as ModelMode)}
                    className={`py-1.5 px-1 rounded-md text-center transition-all flex flex-col sm:flex-row items-center justify-center gap-1 text-[10.5px] ${
                      isSelected
                        ? 'bg-cyan-600 text-white font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 2a. AUTO MODE */}
            {modelMode === 'auto' && (
              <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-cyan-300 font-semibold">
                  <span>Intelligent 0-Token Rule Selection</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Backend selects the optimal model per request without consuming LLM tokens, then emits a live explanation to the Live activity chip:
                </p>
                <ul className="space-y-1 text-[9.5px] text-slate-400 font-sans">
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Voice interactions:</strong> Uses Gemini Live bidi streaming model.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Conversational chat:</strong> Uses fastest low-latency provider (Groq LPU or Gemini Flash-Lite).</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Deep reasoning & research:</strong> Routes to Gemini 3.8 Flash for multimodal grounding.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Rate limits & circuit breaker:</strong> Seamlessly trips to healthy backup provider.</span>
                  </li>
                </ul>
              </div>
            )}

            {/* 2b. MANUAL MODE */}
            {modelMode === 'manual' && (
              <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase text-slate-400">
                      Target Model (All tasks)
                    </label>
                    {currentManualModelObj && (
                      <button
                        type="button"
                        onClick={() => toggleFavorite(selectedManualModel)}
                        className="text-[9px] text-amber-400 flex items-center gap-0.5 hover:underline"
                      >
                        <Star className={`w-2.5 h-2.5 ${favoriteModels.includes(selectedManualModel) ? 'fill-amber-400' : ''}`} />
                        <span>{favoriteModels.includes(selectedManualModel) ? 'Pinned' : 'Pin Favorite'}</span>
                      </button>
                    )}
                  </div>

                  <select
                    value={selectedManualModel}
                    onChange={(e) => setSelectedManualModel(e.target.value)}
                    className="w-full py-1.5 px-2 rounded bg-[#030712] border border-slate-700 text-xs text-white focus-visible:ring-1 focus-visible:ring-cyan-400 font-mono"
                  >
                    {sortedAllModels.length > 0 ? (
                      sortedAllModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {favoriteModels.includes(m.id) ? '★ ' : ''}
                          [{m.provider}] {m.displayName} {m.recommended ? '(Recommended)' : ''} {m.deprecated ? '⚠ (Retired/Retiring)' : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="gemini/gemini-3.8-flash">Gemini / Gemini 3.8 Flash ★</option>
                        <option value="gemini/gemini-3.5-flash-lite">Gemini / Gemini 3.5 Flash-Lite</option>
                        <option value="groq/llama-3.3-70b-versatile">Groq / Llama 3.3 70B</option>
                      </>
                    )}
                  </select>

                  {currentManualModelObj?.deprecated && (
                    <p className="text-[9px] text-amber-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" />
                      <span>Warning: This model is deprecated or retiring by the provider.</span>
                    </p>
                  )}
                </div>

                {/* Fallback Toggle */}
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowFallback}
                    onChange={(e) => setAllowFallback(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-cyan-400"
                  />
                  <span className="text-[10px] text-slate-300">
                    Allow fallback to secondary provider if manual model fails or trips quota
                  </span>
                </label>
              </div>
            )}

            {/* 2c. PER TASK MODE */}
            {modelMode === 'task' && (
              <div className="space-y-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-1">
                  Assign specific models to each capability:
                </span>

                <div className="space-y-2">
                  <div>
                    <label className="text-[9.5px] uppercase text-cyan-400 block mb-0.5">Chat</label>
                    <select
                      value={taskChatModel}
                      onChange={(e) => setTaskChatModel(e.target.value)}
                      className="w-full py-1 px-1.5 rounded bg-[#030712] border border-slate-700 text-[10.5px] text-white font-mono"
                    >
                      {sortedAllModels.map((m) => (
                        <option key={`chat-${m.id}`} value={m.id}>
                          [{m.provider}] {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9.5px] uppercase text-cyan-400 block mb-0.5">Reasoning</label>
                    <select
                      value={taskReasoningModel}
                      onChange={(e) => setTaskReasoningModel(e.target.value)}
                      className="w-full py-1 px-1.5 rounded bg-[#030712] border border-slate-700 text-[10.5px] text-white font-mono"
                    >
                      {sortedAllModels.map((m) => (
                        <option key={`reason-${m.id}`} value={m.id}>
                          [{m.provider}] {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9.5px] uppercase text-cyan-400 block mb-0.5">Research & Grounding</label>
                    <select
                      value={taskResearchModel}
                      onChange={(e) => setTaskResearchModel(e.target.value)}
                      className="w-full py-1 px-1.5 rounded bg-[#030712] border border-slate-700 text-[10.5px] text-white font-mono"
                    >
                      {sortedAllModels.map((m) => (
                        <option key={`res-${m.id}`} value={m.id}>
                          [{m.provider}] {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9.5px] uppercase text-cyan-400 block mb-0.5">Vision & Multimodal</label>
                    <select
                      value={taskVisionModel}
                      onChange={(e) => setTaskVisionModel(e.target.value)}
                      className="w-full py-1 px-1.5 rounded bg-[#030712] border border-slate-700 text-[10.5px] text-white font-mono"
                    >
                      {sortedAllModels.map((m) => (
                        <option key={`vis-${m.id}`} value={m.id}>
                          [{m.provider}] {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9.5px] uppercase text-cyan-400 block mb-0.5">Voice (Live Stream)</label>
                    <select
                      value={taskVoiceModel}
                      onChange={(e) => setTaskVoiceModel(e.target.value)}
                      className="w-full py-1 px-1.5 rounded bg-[#030712] border border-slate-700 text-[10.5px] text-white font-mono"
                    >
                      {(voiceModels.length > 0 ? voiceModels : sortedAllModels).map((m) => (
                        <option key={`voc-${m.id}`} value={m.id}>
                          [{m.provider}] {m.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 2d. PRESETS */}
            {modelMode === 'presets' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: 'eco',
                    title: 'Eco Preset',
                    badge: 'Fastest',
                    desc: 'Uses high-speed lightweight models (Groq LPU or Gemini Flash-Lite). Minimizes quota usage.',
                    color: 'emerald',
                  },
                  {
                    id: 'balanced',
                    title: 'Balanced',
                    badge: 'Recommended',
                    desc: 'Adaptive balance of sub-second conversational response and high-speed multimodal reasoning.',
                    color: 'cyan',
                  },
                  {
                    id: 'max',
                    title: 'Max Quality',
                    badge: 'Deep Reasoning',
                    desc: 'Flags highest-tier reasoning models (Gemini 3.8 Flash / Claude flagship) for maximum depth.',
                    color: 'purple',
                  },
                ].map((p) => {
                  const isSelected = selectedPreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPreset(p.id as ModelPreset)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_12px_rgba(0,240,255,0.25)] text-white'
                          : 'border-slate-800 bg-[#030712] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[10.5px] text-cyan-300">{p.title}</span>
                        <span className="text-[8.5px] px-1 py-0.5 rounded bg-slate-800 text-slate-300">
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-tight">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Voice Engine & Always-Listening */}
          <div className="p-3 rounded-lg bg-[#02050c] border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
              <Mic className="w-3.5 h-3.5 text-cyan-400" />
              <span>Voice Engine & Always-Listening</span>
            </div>

            {/* Voice Mode Selector */}
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1">
                Voice Trigger Mode
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'tap', label: 'Tap to Talk', desc: 'Manual mic toggle' },
                  { id: 'always', label: 'Always Listening', desc: 'VAD auto-open + 60s silence sleep' },
                  { id: 'wake', label: 'Hey JEXA', desc: 'Wake phrase (uses more quota)' },
                ].map((m) => {
                  const isSelected = voiceMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setVoiceMode(m.id as VoiceMode);
                        speechManager.setVoiceMode(m.id as VoiceMode);
                      }}
                      className={`p-2 rounded border text-left transition-all ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/70 text-cyan-200 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                          : 'border-slate-800 bg-[#030712] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-[10px] mb-0.5">{m.label}</div>
                      <div className="text-[8px] text-slate-400 leading-tight">{m.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Voice Profile & Test Voice */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase text-slate-400">
                  Prebuilt Gemini Live Voice
                </label>
                <button
                  type="button"
                  onClick={() => handleTestVoice(selectedVoice)}
                  disabled={testingVoice}
                  className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[9.5px] flex items-center gap-1"
                >
                  <Volume2 className={`w-2.5 h-2.5 ${testingVoice ? 'animate-bounce' : ''}`} />
                  <span>{testingVoice ? 'Auditioning...' : 'Test voice'}</span>
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {(['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'] as const).map((voiceName) => {
                  const isSelected = selectedVoice === voiceName;
                  return (
                    <button
                      key={voiceName}
                      type="button"
                      onClick={() => {
                        setSelectedVoice(voiceName);
                        speechManager.setSelectedVoice(voiceName);
                      }}
                      className={`py-1.5 px-1 rounded border text-center transition-all ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/70 text-cyan-200 font-bold shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                          : 'border-slate-800 bg-[#030712] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="block text-[9.5px] truncate">{voiceName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. HUD Accent Theme & Battery Saver */}
          <div className="p-3 rounded-lg bg-[#02050c] border border-slate-800 space-y-2">
            <label className="text-slate-300 font-semibold block text-xs">
              HUD Accent Theme & Power
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'cyan', label: 'Cyan', color: '#00f0ff' },
                { id: 'purple', label: 'Purple', color: '#c084fc' },
                { id: 'green', label: 'Green', color: '#34d399' },
                { id: 'red', label: 'Red', color: '#f87171' },
              ].map((th) => {
                const isSelected = (localStorage.getItem('jexa_accent_theme') || 'cyan') === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      localStorage.setItem('jexa_accent_theme', th.id);
                      document.documentElement.style.setProperty('--jexa-accent', th.color);
                      setRerender((v) => v + 1);
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_10px_rgba(0,240,255,0.3)] text-white'
                        : 'border-slate-800 bg-[#030712] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full mb-1"
                      style={{ backgroundColor: th.color }}
                    />
                    <span className="block text-[10px] font-medium">{th.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Battery Saver Mode */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-[10.5px] text-slate-300 block">Battery Saver (30 fps Orb & Background)</span>
                <span className="text-[8.5px] text-slate-500">Limits WebGL particle density and frame rate</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const current = localStorage.getItem('jexa_battery_saver') === 'true';
                  localStorage.setItem('jexa_battery_saver', String(!current));
                  setRerender((v) => v + 1);
                }}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  localStorage.getItem('jexa_battery_saver') === 'true'
                    ? 'bg-cyan-600'
                    : 'bg-slate-800'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    localStorage.getItem('jexa_battery_saver') === 'true'
                      ? 'left-5'
                      : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-1 border-t border-cyan-950">
          <button
            onClick={() => {
              handleSaveSettings();
              onClose();
            }}
            className="flex-1 py-2 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs tracking-wider uppercase transition-colors min-h-[40px]"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
