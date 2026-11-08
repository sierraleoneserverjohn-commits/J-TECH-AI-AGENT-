import { SpeechEngine, SpeechSessionOptions } from './types';
import { getNormalizedAudioLevel } from './audioUtils';
import { eventBus } from '../events/eventBus';
import { getActiveBrain } from '../brains';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapSpeechRecognition } from '@capacitor-community/speech-recognition';

export class BrowserSpeechEngine implements SpeechEngine {
  public id = 'browser_speech' as const;
  public name = 'Speech Recognition (Capacitor/Browser Fallback)';
  public isListening = false;
  public audioLevel = 0;
  public sessionDuration = 0;

  private recognition: any = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private levelAnimFrame: number | null = null;
  private sessionTimerInterval: NodeJS.Timeout | null = null;
  private isCapacitor = false;

  public async isAvailable(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { available } = await CapSpeechRecognition.available();
        return !!available;
      } catch {
        return false;
      }
    }
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public async start(_options?: SpeechSessionOptions): Promise<void> {
    if (this.isListening) return;

    this.isCapacitor = Capacitor.isNativePlatform();

    // 1. If running natively inside Capacitor Android APK:
    if (this.isCapacitor) {
      try {
        // Check and request microphone / speech recognition permissions
        const permStatus = await CapSpeechRecognition.checkPermissions();
        if (permStatus.speechRecognition !== 'granted') {
          eventBus.emit('log', {
            text: '[Voice] Requesting microphone and speech recognition permission...',
            level: 'info',
          });
          const req = await CapSpeechRecognition.requestPermissions();
          if (req.speechRecognition !== 'granted') {
            throw new Error('Microphone permission was denied. Please allow microphone access in Android app settings.');
          }
        }

        const avail = await CapSpeechRecognition.available();
        if (!avail.available) {
          throw new Error('Native speech recognition is not available on this Android device.');
        }

        this.isListening = true;
        this.sessionDuration = 0;
        this.sessionTimerInterval = setInterval(() => {
          this.sessionDuration += 1;
        }, 1000);

        eventBus.emit('state', { state: 'listening', detail: 'Listening via Android Native Speech...' });
        eventBus.emit('log', { text: '[Voice] Listening via Android Native Speech Recognition', level: 'info' });

        // Listen for partial or final results
        CapSpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
          if (data.matches && data.matches.length > 0) {
            const transcript = data.matches[0];
            eventBus.emit('state', { state: 'listening', detail: `"${transcript}"` });
          }
        });

        // Start native listening
        await CapSpeechRecognition.start({
          language: 'en-US',
          maxResults: 2,
          prompt: 'Speak your command to JEXA',
          partialResults: true,
          popup: false,
        });

        // Mock breathing audio level while native engine listens
        const updateMockLevel = () => {
          if (!this.isListening) return;
          this.audioLevel = 0.3 + 0.3 * Math.sin(Date.now() / 200);
          this.levelAnimFrame = requestAnimationFrame(updateMockLevel);
        };
        updateMockLevel();
        return;
      } catch (err: any) {
        this.stop();
        eventBus.emit('log', {
          text: `[Voice Error] ${err.message || 'Capacitor speech recognition failed'}`,
          level: 'error',
        });
        eventBus.emit('message', {
          role: 'system',
          text: err.message || 'Microphone permission denied.',
        });
        throw err;
      }
    }

    // 2. Web Browser Fallback: Web Speech API + Web Audio Analyser
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Speech Recognition is not supported in this browser. Please use Gemini Live or Chrome.');
    }

    // Microphone Analyser for real audio levels
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

    if (this.isCapacitor) {
      try {
        await CapSpeechRecognition.stop();
        await CapSpeechRecognition.removeAllListeners();
      } catch {}
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
