import React, { useState } from 'react';
import { Server, Key, Eye, EyeOff, Clipboard, Activity, AlertCircle, Check, ArrowRight, Shield } from 'lucide-react';
import logoSvg from '../assets/logo.svg';

interface FirstLaunchModalProps {
  isOpen: boolean;
  onConnected: () => void;
  onDismiss: () => void;
}

export const FirstLaunchModal: React.FC<FirstLaunchModalProps> = ({
  isOpen,
  onConnected,
  onDismiss,
}) => {
  const [backendUrl, setBackendUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setAccessToken(text.trim());
    } catch {
      // Fallback
      const promptText = window.prompt('Paste your Access Token:');
      if (promptText) setAccessToken(promptText.trim());
    }
  };

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = backendUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      setTestResult({
        status: 'error',
        message: 'Please enter your backend URL (e.g. https://your-jexa.onrender.com).',
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
          throw new Error('Server may be waking up (Render free plan spins down). Please wait about 60 seconds and try again.');
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json().catch(() => ({}));

      localStorage.setItem('jexa_backend_url', cleanUrl);
      localStorage.setItem('jexa_access_token', accessToken.trim());
      localStorage.setItem('jexa_setup_dismissed', 'true');

      setTestResult({
        status: 'success',
        message: `Connected (${latencyMs}ms) • ${data.system || 'JEXA Core'} online • Gemini: ${data.geminiConfigured ? 'Active' : 'Not configured'}`,
      });

      setTimeout(() => {
        onConnected();
      }, 800);
    } catch (err: any) {
      let friendlyMsg = err.message || 'Server unreachable';
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        friendlyMsg = 'Server may be waking up, wait about 60 seconds and try again.';
      } else if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        friendlyMsg = 'Connection blocked by CORS or server unreachable. Ensure ALLOWED_ORIGIN on your backend includes this domain.';
      }

      setTestResult({
        status: 'error',
        message: friendlyMsg,
      });
    }
  };

  const handleSkip = () => {
    localStorage.setItem('jexa_setup_dismissed', 'true');
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-[#050b16] border border-cyan-500/50 rounded-2xl p-6 max-w-lg w-full shadow-[0_0_50px_rgba(0,240,255,0.15)] text-slate-100 max-h-[95dvh] overflow-y-auto">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-cyan-950/80">
          <img src={logoSvg} alt="JEXA Logo" className="w-14 h-14 mb-2 drop-shadow-[0_0_15px_#00f0ff]" />
          <h2 className="text-base font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-white uppercase font-heading">
            Initialize JEXA Core
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Connect to your autonomous backend to activate Gemini Live voice, multi-provider models, and intelligent tools.
          </p>
        </div>

        <form onSubmit={handleConnect} className="space-y-4 my-4 text-xs">
          {/* Backend URL */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-cyan-300 font-semibold block mb-1.5 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Backend Service URL</span>
            </label>
            <input
              type="url"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="https://jexa-backend.onrender.com or http://localhost:3000"
              required
              className="w-full py-2 px-3 rounded-lg bg-[#02050c] border border-cyan-950 text-white placeholder-slate-600 focus-visible:outline-none focus-visible:border-cyan-400 focus-visible:ring-1 focus-visible:ring-cyan-400 font-mono text-xs"
            />
            <span className="text-[10px] text-slate-400 block mt-1">
              The public URL of your deployed Render web service or local Express server.
            </span>
          </div>

          {/* Access Token */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] uppercase tracking-wider text-cyan-300 font-semibold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <span>Access Token</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {accessToken.length} chars
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Matches ACCESS_TOKEN on your backend"
                className="w-full py-2 pl-3 pr-20 rounded-lg bg-[#02050c] border border-cyan-950 text-white placeholder-slate-600 focus-visible:outline-none focus-visible:border-cyan-400 focus-visible:ring-1 focus-visible:ring-cyan-400 font-mono text-xs"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  aria-label={showToken ? 'Hide access token' : 'Show access token'}
                  className="p-1 text-slate-400 hover:text-cyan-300 rounded transition-colors"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handlePaste}
                  title="Paste from clipboard"
                  className="py-1 px-1.5 text-[10px] bg-cyan-950 hover:bg-cyan-900 text-cyan-300 rounded border border-cyan-800 transition-colors flex items-center gap-0.5"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Paste</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
              <Shield className="w-3 h-3 text-cyan-400" />
              <span>Stored only on this device. Never sent to third parties.</span>
            </div>
          </div>

          {/* Diagnostic Result */}
          {testResult.status !== 'idle' && (
            <div
              className={`p-3 rounded-lg text-xs border flex items-start gap-2 ${
                testResult.status === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : testResult.status === 'error'
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  : 'bg-slate-900 border-cyan-800 text-slate-300'
              }`}
            >
              {testResult.status === 'success' ? (
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              ) : testResult.status === 'error' ? (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              ) : (
                <Activity className="w-4 h-4 mt-0.5 shrink-0 animate-spin text-cyan-400" />
              )}
              <span className="leading-snug">{testResult.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={testResult.status === 'testing'}
              className="flex-1 py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-98 min-h-[42px]"
            >
              <Activity className={`w-4 h-4 ${testResult.status === 'testing' ? 'animate-spin' : ''}`} />
              <span>{testResult.status === 'testing' ? 'Connecting...' : 'Connect to JEXA'}</span>
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs uppercase tracking-wider transition-colors min-h-[42px]"
            >
              Explore Offline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
