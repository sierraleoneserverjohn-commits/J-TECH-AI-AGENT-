import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../events/useJexaStore';
import { getActiveBrain } from '../../brains';
import { ApiClient } from '../../api/client';
import { Send, User, Bot, AlertCircle, ChevronDown, GitCompare, ExternalLink, X, Check } from 'lucide-react';
import { OrbState } from '../../events/eventBus';

interface ChatCommandsPanelProps {
  messages: ChatMessage[];
  orbState: OrbState;
}

const QUICK_COMMANDS = [
  'Analyze system health',
  'Search latest tech news',
  'Plan task: database migration',
  'Message Sana',
  'Open WhatsApp',
  'Wipe working memory',
];

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  isRecommended?: boolean;
}

export const ChatCommandsPanel: React.FC<ChatCommandsPanelProps> = ({ messages, orbState }) => {
  const [input, setInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Single-turn override state
  const [overrideChoice, setOverrideChoice] = useState<{
    label: string;
    mode?: 'auto' | 'manual' | 'task' | 'presets';
    model?: string;
    preset?: 'eco' | 'balanced' | 'max';
  } | null>(null);

  const [showOverrideMenu, setShowOverrideMenu] = useState<boolean>(false);
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [compareModelA, setCompareModelA] = useState<string>('gemini/gemini-3.8-flash');
  const [compareModelB, setCompareModelB] = useState<string>('groq/llama-3.3-70b-versatile');

  // Load models from real /models endpoint for override & compare pickers
  useEffect(() => {
    let isMounted = true;
    const fetchModels = async () => {
      try {
        if (!ApiClient.isConnected()) return;
        const res = await ApiClient.get('/models');
        if (!isMounted) return;
        const list: ModelOption[] = (res.models || res.chatModels || []).map((m: any) => ({
          id: m.id || m.rawId,
          name: m.displayName || m.id,
          provider: m.provider || 'AI',
          isRecommended: m.recommended,
        }));
        if (list.length > 0) {
          setAvailableModels(list);
          setCompareModelA(list[0]?.id || 'gemini/gemini-3.8-flash');
          setCompareModelB(list[1]?.id || list[0]?.id || 'groq/llama-3.3-70b-versatile');
        }
      } catch {
        // Fallback options if offline
        setAvailableModels([
          { id: 'gemini/gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'Gemini', isRecommended: true },
          { id: 'gemini/gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', provider: 'Gemini', isRecommended: true },
          { id: 'groq/llama-3.3-70b-versatile', name: 'Groq Llama 3.3 70B', provider: 'Groq', isRecommended: true },
        ]);
      }
    };
    fetchModels();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, orbState]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const command = input.trim();
    if (!command || isSubmitting) return;

    setInput('');
    setIsSubmitting(true);
    try {
      const brain = getActiveBrain();
      if (isCompareMode && brain.compare) {
        await brain.compare(command, compareModelA, compareModelB);
        setIsCompareMode(false);
      } else {
        await brain.send(command, overrideChoice ? {
          mode: overrideChoice.mode,
          model: overrideChoice.model,
          preset: overrideChoice.preset,
        } : undefined);
      }
    } finally {
      setIsSubmitting(false);
      setOverrideChoice(null); // Reset single-turn override after sending
    }
  };

  const handleQuickCommand = (cmd: string) => {
    setInput(cmd);
    getActiveBrain().send(cmd);
  };

  const isTyping = orbState === 'thinking' || orbState === 'reasoning' || orbState === 'typing' || orbState === 'working';
  const chipLabel = overrideChoice?.label || 'Auto ▾';

  return (
    <div className="flex flex-col h-full font-mono text-xs relative">
      {/* Quick Prompts Bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none shrink-0">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            onClick={() => handleQuickCommand(cmd)}
            className="whitespace-nowrap px-2 py-1 rounded-md bg-[#0a1524] hover:bg-[#11233d] border border-cyan-500/30 text-cyan-300 text-[10px] transition-colors active:scale-95 shrink-0"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Compare Mode Setup Bar */}
      {isCompareMode && (
        <div className="mb-2 p-2 rounded-lg bg-amber-950/40 border border-amber-500/50 text-[10px] shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-amber-300 flex items-center gap-1">
              <GitCompare className="w-3.5 h-3.5" />
              Compare Mode (uses double quota)
            </span>
            <button
              type="button"
              onClick={() => setIsCompareMode(false)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <span className="text-[9px] text-cyan-400 block mb-0.5">Model A:</span>
              <select
                value={compareModelA}
                onChange={(e) => setCompareModelA(e.target.value)}
                className="w-full py-1 px-1.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-200 text-[10px] focus:outline-none"
              >
                {availableModels.map((m) => (
                  <option key={`a-${m.id}`} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-[9px] text-purple-400 block mb-0.5">Model B:</span>
              <select
                value={compareModelB}
                onChange={(e) => setCompareModelB(e.target.value)}
                className="w-full py-1 px-1.5 rounded bg-slate-900 border border-purple-500/40 text-purple-200 text-[10px] focus:outline-none"
              >
                {availableModels.map((m) => (
                  <option key={`b-${m.id}`} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2.5 max-h-[160px] md:max-h-[190px] pr-1 pb-1"
      >
        {messages.length === 0 ? (
          <div className="text-center py-6 text-slate-500 italic text-[11px]">
            No messages yet. Send a command to begin.
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSys = msg.role === 'system';

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-1.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isUser
                      ? 'bg-cyan-600 text-white'
                      : isSys
                      ? 'bg-rose-900 text-rose-300'
                      : 'bg-slate-800 text-cyan-400 border border-cyan-500/40'
                  }`}
                >
                  {isUser ? <User className="w-3 h-3" /> : isSys ? <AlertCircle className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                </div>

                <div
                  className={`max-w-[88%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                    isUser
                      ? 'bg-cyan-950/80 text-cyan-100 border border-cyan-600/40'
                      : isSys
                      ? 'bg-rose-950/60 text-rose-200 border border-rose-800/50'
                      : 'bg-[#091422] text-slate-200 border border-slate-800'
                  }`}
                >
                  <div>{msg.text}</div>

                  {/* Dual Model Compare Card */}
                  {msg.compare && (
                    <div className="mt-2 space-y-1.5 pt-1 border-t border-slate-700/60">
                      <div className="flex items-center gap-1.5 text-[9px] text-amber-400 font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600/40 uppercase tracking-wider">
                          Compare Result • 2x quota used
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                        <div className="p-2 rounded bg-slate-900/90 border border-cyan-500/40">
                          <div className="flex items-center justify-between text-[10px] text-cyan-300 font-mono mb-1 pb-1 border-b border-slate-800">
                            <span className="font-semibold truncate">{msg.compare.modelA}</span>
                            <span className="text-slate-400 text-[9px]">{msg.compare.latencyMsA}ms</span>
                          </div>
                          <div className="text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {msg.compare.replyA}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-slate-900/90 border border-purple-500/40">
                          <div className="flex items-center justify-between text-[10px] text-purple-300 font-mono mb-1 pb-1 border-b border-slate-800">
                            <span className="font-semibold truncate">{msg.compare.modelB}</span>
                            <span className="text-slate-400 text-[9px]">{msg.compare.latencyMsB}ms</span>
                          </div>
                          <div className="text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {msg.compare.replyB}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sources citation */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex flex-wrap gap-1">
                      <span className="text-[9px] text-slate-400">Sources:</span>
                      {msg.sources.map((s, idx) => (
                        <a
                          key={idx}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[9px] text-cyan-400 hover:underline px-1 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/40"
                        >
                          {s.title || s.url}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Caption under each assistant response: Provider • Model • Latency + autoReason */}
                  {msg.role === 'assistant' && (msg.provider || msg.model || msg.latencyMs !== undefined) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1 border-t border-slate-800/60 text-[9px] text-slate-400 font-sans">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700/60 text-cyan-300 font-mono">
                        <span>{msg.provider || 'AI'}</span>
                        {msg.model && <span>• {msg.model.replace(/^.*\//, '')}</span>}
                        {msg.latencyMs !== undefined && <span>• {msg.latencyMs}ms</span>}
                      </span>
                      {msg.autoReason && (
                        <span className="text-[9px] text-emerald-400/90 italic truncate max-w-[260px]" title={msg.autoReason}>
                          {msg.autoReason}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] py-1 px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
            <span className="ml-1 uppercase text-slate-400 font-mono">JEXA is synthesizing...</span>
          </div>
        )}
      </div>

      {/* Override Dropdown Modal / Popover */}
      {showOverrideMenu && (
        <div className="absolute bottom-12 left-0 z-30 w-64 p-2 bg-[#091422] border border-cyan-500/50 rounded-xl shadow-2xl backdrop-blur-md text-[11px] font-mono space-y-1.5">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <span className="font-semibold text-cyan-300 text-[10px] uppercase tracking-wider">
              One-Request Model Override
            </span>
            <button onClick={() => setShowOverrideMenu(false)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => {
                setOverrideChoice(null);
                setShowOverrideMenu(false);
              }}
              className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-300 flex items-center justify-between"
            >
              <span>Auto (Default System Choice)</span>
              {!overrideChoice && <Check className="w-3 h-3 text-cyan-400" />}
            </button>

            <div className="pt-1 text-[9px] text-slate-400 uppercase tracking-wider">Presets</div>
            <button
              type="button"
              onClick={() => {
                setOverrideChoice({ label: 'Eco ▾', mode: 'presets', preset: 'eco' });
                setShowOverrideMenu(false);
              }}
              className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-emerald-300 flex items-center justify-between"
            >
              <span>Preset: Eco (Fastest / Saves Quota)</span>
              {overrideChoice?.preset === 'eco' && <Check className="w-3 h-3 text-emerald-400" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setOverrideChoice({ label: 'Balanced ▾', mode: 'presets', preset: 'balanced' });
                setShowOverrideMenu(false);
              }}
              className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-cyan-300 flex items-center justify-between"
            >
              <span>Preset: Balanced</span>
              {overrideChoice?.preset === 'balanced' && <Check className="w-3 h-3 text-cyan-400" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setOverrideChoice({ label: 'Max ▾', mode: 'presets', preset: 'max' });
                setShowOverrideMenu(false);
              }}
              className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-purple-300 flex items-center justify-between"
            >
              <span>Preset: Max Quality</span>
              {overrideChoice?.preset === 'max' && <Check className="w-3 h-3 text-purple-400" />}
            </button>

            {availableModels.length > 0 && (
              <>
                <div className="pt-1 text-[9px] text-slate-400 uppercase tracking-wider">Specific Models</div>
                {availableModels.slice(0, 8).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setOverrideChoice({ label: `${m.name.slice(0, 10)}... ▾`, mode: 'manual', model: m.id });
                      setShowOverrideMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-300 flex items-center justify-between truncate"
                  >
                    <span className="truncate">{m.name}</span>
                    {overrideChoice?.model === m.id && <Check className="w-3 h-3 text-cyan-400 shrink-0" />}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 shrink-0">
        {/* Single-turn override chip */}
        <button
          type="button"
          onClick={() => setShowOverrideMenu(!showOverrideMenu)}
          title="Override model for one request"
          className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono flex items-center gap-1 transition-colors shrink-0 ${
            overrideChoice
              ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
              : 'bg-slate-900/90 border-slate-700/80 hover:border-cyan-500/50 text-slate-300'
          }`}
        >
          <span>{chipLabel}</span>
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isCompareMode ? "Enter prompt to compare between models..." : "Enter command or query..."}
          className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-xs focus-visible:ring-2 focus-visible:ring-cyan-400"
        />

        {/* Compare Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCompareMode(!isCompareMode)}
          title="Compare prompt across 2 models (uses double quota)"
          className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
            isCompareMode
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-slate-900/90 border-slate-700/80 hover:border-amber-500/50 text-slate-400 hover:text-amber-300'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
        </button>

        <button
          type="submit"
          disabled={!input.trim() || isSubmitting}
          aria-label={isCompareMode ? "Compare models" : "Send command"}
          className={`px-3 py-1.5 rounded-lg font-medium flex items-center justify-center transition-colors min-w-[40px] focus-visible:ring-2 shrink-0 ${
            isCompareMode
              ? 'bg-amber-600 hover:bg-amber-500 text-white focus-visible:ring-amber-400'
              : 'bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white focus-visible:ring-cyan-400'
          }`}
        >
          {isCompareMode ? <GitCompare className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </form>
    </div>
  );
};
