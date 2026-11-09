import { SpeechEngine, VoiceProviderType, LiveVoiceName, VoiceMode } from './types';
import { GeminiLiveEngine } from './GeminiLiveEngine';
import { BrowserSpeechEngine } from './BrowserSpeechEngine';
import { eventBus } from '../events/eventBus';

export class SpeechEngineManager {
  private geminiLive = new GeminiLiveEngine();
  private browserSpeech = new BrowserSpeechEngine();
  private preferredProvider: VoiceProviderType = 'gemini_live';
  private selectedVoice: LiveVoiceName = 'Zephyr';
  private voiceMode: VoiceMode = 'tap';

  constructor() {
    if (typeof window !== 'undefined') {
      const savedVoice = localStorage.getItem('jexa_live_voice') as LiveVoiceName;
      if (savedVoice) this.selectedVoice = savedVoice;

      const savedMode = (localStorage.getItem('jexa_voice_mode') as VoiceMode) || 'tap';
      this.voiceMode = savedMode;
      this.geminiLive.setMode(savedMode);
    }
  }

  public getActiveEngine(): SpeechEngine {
    return this.preferredProvider === 'gemini_live' ? this.geminiLive : this.browserSpeech;
  }

  public getGeminiLiveEngine(): GeminiLiveEngine {
    return this.geminiLive;
  }

  public getPreferredProvider(): VoiceProviderType {
    return this.preferredProvider;
  }

  public setPreferredProvider(provider: VoiceProviderType): void {
    this.preferredProvider = provider;
  }

  public getSelectedVoice(): LiveVoiceName {
    return this.selectedVoice;
  }

  public setSelectedVoice(voice: LiveVoiceName): void {
    this.selectedVoice = voice;
    if (typeof window !== 'undefined') {
      localStorage.setItem('jexa_live_voice', voice);
    }
    eventBus.emit('log', { text: `[Voice Config] Live voice set to ${voice}`, level: 'info' });
  }

  public getVoiceMode(): VoiceMode {
    return this.voiceMode;
  }

  public setVoiceMode(mode: VoiceMode): void {
    this.voiceMode = mode;
    this.geminiLive.setMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('jexa_voice_mode', mode);
    }
  }

  public isMuted(): boolean {
    return this.geminiLive.isMuted;
  }

  public toggleMute(): boolean {
    return this.geminiLive.toggleMute();
  }

  public getAudioLevel(): number {
    return this.getActiveEngine().audioLevel;
  }

  public async testVoice(voiceName: LiveVoiceName): Promise<void> {
    eventBus.emit('log', {
      text: `[Voice Preview] Testing voice timbre for "${voiceName}"...`,
      level: 'info',
    });

    // Provide natural acoustic test pitch for prebuilt voice audition
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance('JEXA vocal telemetry online. Standing by for command.');
      utter.rate = 1.0;
      utter.pitch = voiceName === 'Puck' ? 1.2 : voiceName === 'Fenrir' ? 0.8 : voiceName === 'Charon' ? 0.85 : voiceName === 'Kore' ? 1.15 : 1.0;
      window.speechSynthesis.speak(utter);
    }
  }

  public async toggleListening(): Promise<void> {
    const active = this.getActiveEngine();
    if (active.isListening) {
      await active.stop();
      return;
    }

    try {
      if (this.preferredProvider === 'gemini_live') {
        const available = await this.geminiLive.isAvailable();
        if (!available) {
          throw new Error('Gemini Live backend session unavailable. Switching to fallback.');
        }
        await this.geminiLive.start({ voiceName: this.selectedVoice });
      } else {
        await this.browserSpeech.start();
      }
    } catch (err: any) {
      console.warn('[SpeechEngineManager] Preferred engine failed, engaging fallback:', err);
      eventBus.emit('log', {
        text: `[Voice Notice] ${err.message || 'Gemini Live unavailable'}. Engaging browser speech fallback.`,
        level: 'warn',
      });

      // Switch to browser speech fallback
      this.preferredProvider = 'browser_speech';
      try {
        await this.browserSpeech.start();
      } catch (fallbackErr: any) {
        eventBus.emit('log', {
          text: `[Voice Error] Fallback speech failed: ${fallbackErr.message}`,
          level: 'error',
        });
        eventBus.emit('state', { state: 'error', message: fallbackErr.message });
      }
    }
  }
}

export const speechManager = new SpeechEngineManager();
