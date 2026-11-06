/**
 * Speech Engine Types for JEXA Voice System
 */

export type VoiceProviderType = 'gemini_live' | 'browser_speech';

export type LiveVoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

export interface SpeechSessionOptions {
  voiceName?: LiveVoiceName;
  modelName?: string;
}

export interface SpeechEngine {
  id: VoiceProviderType;
  name: string;
  isAvailable: () => Promise<boolean>;
  start: (options?: SpeechSessionOptions) => Promise<void>;
  stop: () => Promise<void>;
  isListening: boolean;
  audioLevel: number;
  sessionDuration: number;
}
