import { SpeechEngine, VoiceProviderType, LiveVoiceName } from './types';
import { GeminiLiveEngine } from './GeminiLiveEngine';
import { BrowserSpeechEngine } from './BrowserSpeechEngine';
import { eventBus } from '../events/eventBus';

export class SpeechEngineManager {
  private geminiLive = new GeminiLiveEngine();
  private browserSpeech = new BrowserSpeechEngine();
  private preferredProvider: VoiceProviderType = 'gemini_live';
  private selectedVoice: LiveVoiceName = 'Zephyr';

  constructor() {
    if (typeof window !== 'undefined') {
      const savedVoice = localStorage.getItem('jexa_live_voice') as LiveVoiceName;
      if (savedVoice) this.selectedVoice = savedVoice;
    }
  }

  public getActiveEngine(): SpeechEngine {
    return this.preferredProvider === 'gemini_live' ? this.geminiLive : this.browserSpeech;
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
