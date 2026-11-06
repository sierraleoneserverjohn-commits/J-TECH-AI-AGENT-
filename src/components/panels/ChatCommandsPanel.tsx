import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../events/useJexaStore';
import { getActiveBrain } from '../../brains';
import { Send, CornerDownLeft, Sparkles, User, Bot, AlertCircle } from 'lucide-react';
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

export const ChatCommandsPanel: React.FC<ChatCommandsPanelProps> = ({ messages, orbState }) => {
  const [input, setInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
      await getActiveBrain().send(command);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickCommand = (cmd: string) => {
    setInput(cmd);
    getActiveBrain().send(cmd);
  };

  const isTyping = orbState === 'thinking' || orbState === 'reasoning' || orbState === 'typing' || orbState === 'working';

  return (
    <div className="flex flex-col h-full font-mono text-xs">
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

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 max-h-[160px] md:max-h-[190px] pr-1 pb-1"
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
                className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                  isUser
                    ? 'bg-cyan-950/80 text-cyan-100 border border-cyan-600/40'
                    : isSys
                    ? 'bg-rose-950/60 text-rose-200 border border-rose-800/50'
                    : 'bg-[#091422] text-slate-200 border border-slate-800'
                }`}
              >
                {msg.text}
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

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-slate-800/80 flex gap-1.5 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command or query..."
          className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-xs focus-visible:ring-2 focus-visible:ring-cyan-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || isSubmitting}
          aria-label="Send command"
          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium flex items-center justify-center transition-colors min-w-[40px] focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
