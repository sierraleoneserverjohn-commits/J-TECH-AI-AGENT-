import React, { useState } from 'react';
import { getActiveBrainId, setActiveBrain, remoteBrain } from '../brains';
import { eventBus } from '../events/eventBus';
import { Settings, Cpu, Globe, Server, Check, X, Shield, Activity, Key, RefreshCw, AlertCircle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackendUpdated?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onBackendUpdated }) => {
  const [activeBrain, setBrain] = useState<string>(getActiveBrainId());

  // Backend URL (defaults to window.location.origin)
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    return localStorage.getItem('jexa_backend_url') ?? (typeof window !== 'undefined' ? window.location.origin : '');
  });

  // Access Token
  const [accessToken, setAccessToken] = useState<string>(() => {
    return localStorage.getItem('jexa_access_token') || '';
  });

  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
    latencyMs?: number;
  }>({ status: 'idle', message: '' });

  if (!isOpen) return null;

  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = backendUrl.trim().replace(/\/+$/, '');
    localStorage.setItem('jexa_backend_url', cleanUrl);
    localStorage.setItem('jexa_access_token', accessToken.trim());

    eventBus.emit('log', {
      text: `Settings updated: Backend URL set to ${cleanUrl || '(empty)'}`,
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

    setTestResult({ status: 'testing', message: 'Testing connection to backend...' });
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {};
      if (accessToken.trim()) {
        headers['Authorization'] = `Bearer ${accessToken.trim()}`;
      }

      const res = await fetch(`${cleanUrl}/api/health`, {
        method: 'GET',
        headers,
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('401 Unauthorized: Access token rejected by backend.');
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setTestResult({
        status: 'success',
        latencyMs,
        message: `Connected (${latencyMs}ms) • ${data.system || 'JEXA Core'} online • Gemini: ${data.geminiConfigured ? 'Configured' : 'Not configured'}`,
      });

      // Save valid settings
      handleSaveSettings();
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      setTestResult({
        status: 'error',
        latencyMs,
        message: `Connection failed: ${err.message || 'Server unreachable'}`,
      });
    }
  };

  const handleSelectBrain = (id: string) => {
    setBrain(id);
    setActiveBrain(id);
    eventBus.emit('log', {
      text: `Brain client switched to: ${id === 'gemini' ? 'Gemini Brain' : 'Remote Brain'}`,
      level: 'info',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 font-mono animate-in fade-in duration-150 select-none">
      <div className="bg-[#070e1c] border border-cyan-500/40 rounded-xl p-4 max-w-md w-full shadow-2xl text-slate-100 max-h-[92dvh] overflow-y-auto">
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
          {/* 1. Backend URL & Access Token Configuration */}
          <div className="p-3 rounded-lg bg-[#050b16] border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Backend Configuration</span>
            </div>

            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1">
                Backend URL
              </label>
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://localhost:3000 or https://api.jexa.ai"
                className="w-full py-1.5 px-2 rounded bg-[#030712] border border-slate-700 text-xs text-white placeholder-slate-600 focus-visible:ring-1 focus-visible:ring-cyan-400 font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1 flex items-center gap-1">
                <Key className="w-3 h-3 text-cyan-400" />
                <span>Access Token (Optional)</span>
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Bearer access token"
                className="w-full py-1.5 px-2 rounded bg-[#030712] border border-slate-700 text-xs text-white placeholder-slate-600 focus-visible:ring-1 focus-visible:ring-cyan-400 font-mono"
              />
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

          {/* 2. Swappable Brain Client */}
          <div className="p-3 rounded-lg bg-[#050b16] border border-slate-800 space-y-2">
            <label className="text-slate-300 font-semibold block flex items-center gap-1.5 text-xs">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Swappable Brain
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectBrain('gemini')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  activeBrain === 'gemini'
                    ? 'bg-cyan-950/70 border-cyan-400 text-cyan-100 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                    : 'bg-[#030712] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-[10.5px] mb-0.5">
                  <span>Gemini Core</span>
                  {activeBrain === 'gemini' && <Check className="w-3 h-3 text-cyan-400" />}
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">
                  Server proxy with Google Gemini 3.8 Flash.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectBrain('remote')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  activeBrain === 'remote'
                    ? 'bg-cyan-950/70 border-cyan-400 text-cyan-100 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                    : 'bg-[#030712] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-[10.5px] mb-0.5">
                  <span>Remote Brain</span>
                  {activeBrain === 'remote' && <Check className="w-3 h-3 text-cyan-400" />}
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">
                  Connects via custom WebSocket/HTTP protocol.
                </p>
              </button>
            </div>
          </div>

          {/* 3. Accent Theme Selection */}
          <div className="p-3 rounded-lg bg-[#050b16] border border-slate-800 space-y-2">
            <label className="text-slate-300 font-semibold block text-xs">
              HUD Accent Theme
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
                      // Trigger state re-render
                      setBrain((b) => b);
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
          </div>

          {/* 4. Haptic Feedback & Sound Cues */}
          <div className="p-3 rounded-lg bg-[#050b16] border border-slate-800 space-y-2 text-slate-300">
            <span className="font-semibold text-slate-200 block text-xs">Feedback & Audio</span>
            
            {/* Haptics */}
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-[11px] text-slate-300 block">Haptic Feedback</span>
                <span className="text-[9px] text-slate-500">Vibrate on listen, finish & error</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const current = localStorage.getItem('jexa_haptics_enabled') !== 'false';
                  localStorage.setItem('jexa_haptics_enabled', String(!current));
                  setBrain((b) => b);
                }}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  localStorage.getItem('jexa_haptics_enabled') !== 'false'
                    ? 'bg-cyan-600'
                    : 'bg-slate-800'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    localStorage.getItem('jexa_haptics_enabled') !== 'false'
                      ? 'left-5'
                      : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Sound Cues */}
            <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
              <div>
                <span className="text-[11px] text-slate-300 block">Sci-Fi Sound Cues</span>
                <span className="text-[9px] text-slate-500">Synthesized audio cues (off by default)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const current = localStorage.getItem('jexa_sound_enabled') === 'true';
                  localStorage.setItem('jexa_sound_enabled', String(!current));
                  setBrain((b) => b);
                }}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  localStorage.getItem('jexa_sound_enabled') === 'true'
                    ? 'bg-cyan-600'
                    : 'bg-slate-800'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    localStorage.getItem('jexa_sound_enabled') === 'true'
                      ? 'left-5'
                      : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 5. Voice & Wake Word */}
          <div className="p-2.5 rounded-lg bg-[#050b16] border border-slate-800 space-y-1.5 text-slate-300 text-[10px]">
            <span className="font-semibold text-slate-200 block text-xs">Voice & Wake Word</span>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400">Wake word: "Hey Jexa"</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-[8.5px] text-cyan-300">
                Wake word: coming with Android app
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Speech mode</span>
              <span className="text-emerald-400 font-semibold">Web Speech API</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs tracking-wider uppercase transition-colors min-h-[40px]"
        >
          Close
        </button>
      </div>
    </div>
  );
};
