import { SpeechEngine, SpeechSessionOptions } from './types';
import { getNormalizedAudioLevel } from './audioUtils';
import { eventBus } from '../events/eventBus';
import { getActiveBrain } from '../brains';

export class BrowserSpeechEngine implements SpeechEngine {
  public id = 'browser_speech' as const;
  public name = 'Browser Speech (Automatic Fallback)';
  public isListening = false;
  public audioLevel = 0;
  public sessionDuration = 0;

  private recognition: any = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private levelAnimFrame: number | null = null;
  private sessionTimerInterval: NodeJS.Timeout | null = null;

  public async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public async start(_options?: SpeechSessionOptions): Promise<void> {
    if (this.isListening) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Web Speech API is not supported in this browser.');
    }

    // 1. Microphone Analyser for real audio levels
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      source.connect(this.analyser);

      const updateLevel = () => {
        if (!this.isListening) return;
        if (this.analyser) {
          this.audioLevel = getNormalizedAudioLevel(this.analyser);
        }
        this.levelAnimFrame = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      // Audio level fallback
    }

    // 2. Speech Recognition
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.sessionDuration = 0;
      this.sessionTimerInterval = setInterval(() => {
        this.sessionDuration += 1;
      }, 1000);

      eventBus.emit('state', { state: 'listening', detail: 'Listening via Browser Speech...' });
      eventBus.emit('log', { text: '[Voice Fallback] Listening via Web Speech API', level: 'info' });
    };

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        const text = finalTranscript.trim();
        eventBus.emit('log', { text: `[Voice Recognized] "${text}"`, level: 'info' });
        this.stop();
        getActiveBrain().send(text);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.warn('[BrowserSpeech] Recognition error:', event.error);
      if (event.error !== 'no-speech') {
        eventBus.emit('log', { text: `[Voice Error] ${event.error}`, level: 'warn' });
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        this.stop();
      }
    };

    this.recognition.start();
  }

  public async stop(): Promise<void> {
    this.isListening = false;
    this.audioLevel = 0;

    if (this.sessionTimerInterval) {
      clearInterval(this.sessionTimerInterval);
      this.sessionTimerInterval = null;
    }
    if (this.levelAnimFrame) {
      cancelAnimationFrame(this.levelAnimFrame);
      this.levelAnimFrame = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    eventBus.emit('state', { state: 'idle' });
  }
}
