import React from 'react';
import { Mic, MicOff, Volume2, Settings2, Radio, Sparkles } from 'lucide-react';

interface VoicePanelProps {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  audioLevel: number;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceURI: string;
  setSelectedVoiceURI: (uri: string) => void;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  wakeMode: 'ptt' | 'wakeword';
  setWakeMode: (mode: 'ptt' | 'wakeword') => void;
  toggleListening: () => void;
  speak: (text: string) => void;
  isSupported: boolean;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  isListening,
  isSpeaking,
  transcript,
  audioLevel,
  availableVoices,
  selectedVoiceURI,
  setSelectedVoiceURI,
  speechRate,
  setSpeechRate,
  wakeMode,
  setWakeMode,
  toggleListening,
  speak,
  isSupported,
}) => {
  return (
    <div className="space-y-3 font-mono text-xs">
      {!isSupported && (
        <div className="p-2 bg-amber-950/40 border border-amber-800/60 rounded text-amber-300 text-[11px]">
          Web Speech API not fully available in this browser. Voice output remains active; use keyboard commands or Chrome.
        </div>
      )}

      {/* Primary Voice Action Button */}
      <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-[#0a1424]/60 border border-cyan-500/30">
        <button
          onClick={toggleListening}
          aria-label={isListening ? 'Stop listening' : 'Start microphone listening'}
          className={`relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            isListening
              ? 'bg-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_16px_rgba(6,182,212,0.4)]'
          }`}
        >
          {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          
          {/* Audio volume visual ring when listening */}
          {isListening && (
            <span
              className="absolute inset-0 rounded-full border-2 border-rose-300 transition-all duration-75 pointer-events-none"
              style={{ transform: `scale(${1 + audioLevel * 0.8})` }}
            />
          )}
        </button>

        <span className="mt-2 text-[11px] font-semibold text-slate-200">
          {isListening ? 'Listening Live... (Tap to Send)' : 'Tap to Speak'}
        </span>

        {transcript && (
          <p className="mt-1 text-[11px] text-cyan-300 italic text-center max-w-[200px] truncate">
            "{transcript}"
          </p>
        )}
      </div>

      {/* Wake Mode Selection */}
      <div className="space-y-1">
        <label className="text-[11px] text-slate-400 flex items-center gap-1">
          <Radio className="w-3.5 h-3.5 text-cyan-400" /> Wake Mode
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setWakeMode('ptt')}
            className={`py-1.5 px-2 rounded text-[11px] font-medium border transition-colors ${
              wakeMode === 'ptt'
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Push to talk
          </button>
          <div className="relative">
            <button
              disabled
              title="Coming with the Android app"
              className="w-full py-1.5 px-2 rounded text-[10px] font-medium border border-slate-800/60 bg-slate-900/30 text-slate-500 cursor-not-allowed flex flex-col items-center justify-center"
            >
              <span>"Hey JEXA"</span>
              <span className="text-[8px] text-cyan-400/80">Coming with Android app</span>
            </button>
          </div>
        </div>
      </div>

      {/* Voice Selection & Speed */}
      <div className="space-y-2 pt-1 border-t border-slate-800/80">
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Synthesis Voice</label>
          <select
            value={selectedVoiceURI}
            onChange={(e) => setSelectedVoiceURI(e.target.value)}
            className="w-full py-1.5 px-2 rounded bg-slate-900/90 border border-slate-700 text-slate-200 text-xs focus-visible:ring-1 focus-visible:ring-cyan-400"
          >
            {availableVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        {/* Speed slider */}
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Speech Speed</span>
            <span className="text-cyan-400">{speechRate.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.5"
            step="0.05"
            value={speechRate}
            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        <button
          onClick={() => speak('JEXA vocal telemetry online. Audio parameters nominal.')}
          className="w-full py-1.5 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-colors"
        >
          <Volume2 className="w-3.5 h-3.5" />
          Test Voice Output
        </button>
      </div>
    </div>
  );
};
