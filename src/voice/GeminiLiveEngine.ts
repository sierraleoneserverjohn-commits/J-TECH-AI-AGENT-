import { SpeechEngine, SpeechSessionOptions, LiveVoiceName } from './types';
import { floatTo16BitPCMBase64, base64ToAudioBuffer, getNormalizedAudioLevel } from './audioUtils';
import { eventBus } from '../events/eventBus';
import { toolRegistry } from '../tools';
import { ApiClient } from '../api/client';

export const CONFIG_LIVE_MODEL = 'gemini-3.8-live';

export interface LiveTokenResponse {
  token?: string;
  model: string;
  availableVoices: LiveVoiceName[];
  configured: boolean;
  expiresInSeconds?: number;
}

export class GeminiLiveEngine implements SpeechEngine {
  public id = 'gemini_live' as const;
  public name = 'Gemini Live (Real-Time Voice)';
  public isListening = false;
  public audioLevel = 0;
  public sessionDuration = 0;

  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;

  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private sessionTimerInterval: NodeJS.Timeout | null = null;
  private levelAnimFrame: number | null = null;
  private selectedVoice: LiveVoiceName = 'Zephyr';

  public async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.WebSocket) return false;
    if (!ApiClient.isConnected()) return false;
    try {
      const res = await ApiClient.post<LiveTokenResponse>('/live-token');
      return !!res.configured;
    } catch {
      return false;
    }
  }

  public async getLiveToken(): Promise<LiveTokenResponse> {
    return ApiClient.post<LiveTokenResponse>('/live-token');
  }

  public async start(options?: SpeechSessionOptions): Promise<void> {
    if (this.isListening) return;

    if (!ApiClient.isConnected()) {
      throw new Error('Backend not connected. Configure your backend URL in Settings.');
    }

    if (options?.voiceName) {
      this.selectedVoice = options.voiceName;
    }

    eventBus.emit('log', {
      text: `[Gemini Live] Requesting ephemeral session for voice "${this.selectedVoice}"...`,
      level: 'info',
    });

    const tokenConfig = await this.getLiveToken();
    const modelToUse = options?.modelName || tokenConfig.model || CONFIG_LIVE_MODEL;

    // 1. Setup AudioContexts (16kHz capture, 24kHz playback)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
    this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });

    if (this.inputAudioCtx.state === 'suspended') await this.inputAudioCtx.resume();
    if (this.outputAudioCtx.state === 'suspended') await this.outputAudioCtx.resume();

    // Setup Analysers
    this.micAnalyser = this.inputAudioCtx.createAnalyser();
    this.micAnalyser.fftSize = 256;

    this.outputAnalyser = this.outputAudioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 256;

    // 2. Capture Microphone Stream
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const source = this.inputAudioCtx.createMediaStreamSource(this.micStream);
    this.processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

    source.connect(this.micAnalyser);
    source.connect(this.processor);
    this.processor.connect(this.inputAudioCtx.destination);

    // 3. Connect directly to Gemini Multimodal Live API via WebSockets using ephemeral token
    // If an ephemeral token was created by the backend, connect directly to Google's live endpoint
    // otherwise fallback to backend proxy if available
    const token = tokenConfig.token;
    const wsUrl = token
      ? `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(token)}`
      : `${ApiClient.getBackendUrl().replace(/^http/, 'ws')}/live`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isListening = true;
      this.sessionDuration = 0;

      this.sessionTimerInterval = setInterval(() => {
        this.sessionDuration += 1;
      }, 1000);

      // Direct client setup payload matching Gemini Live API
      const setupMsg = {
        setup: {
          model: `models/${modelToUse}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: this.selectedVoice,
                },
              },
            },
          },
          systemInstruction: {
            parts: [
              {
                text: 'You are JEXA (JARVIS-class Executive Autonomous Intelligence), a calm, razor-sharp personal AI command centre operating in real-time voice mode. Keep responses concise and conversational.',
              },
            ],
          },
        },
      };

      this.ws?.send(JSON.stringify(setupMsg));

      eventBus.emit('state', { state: 'listening', detail: `Gemini Live active (${this.selectedVoice})` });
      eventBus.emit('log', {
        text: `[Gemini Live] Real-time session opened on ${modelToUse} (${this.selectedVoice})`,
        level: 'success',
      });
      eventBus.emit('activity', { id: 'live-voice', label: 'Gemini Live Session', active: true });
    };

    // 4. Stream 16kHz PCM audio
    this.processor.onaudioprocess = (e) => {
      if (!this.isListening || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const base64Pcm = floatTo16BitPCMBase64(inputData);

      const audioMsg = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Pcm,
            },
          ],
        },
      };

      this.ws.send(JSON.stringify(audioMsg));
    };

    // 5. Handle Live Messages & Interruption
    this.ws.onmessage = async (event) => {
      try {
        let msg: any;
        if (event.data instanceof Blob) {
          const text = await event.data.text();
          msg = JSON.parse(text);
        } else {
          msg = JSON.parse(event.data);
        }

        // Interruption
        if (msg.serverContent?.interrupted) {
          this.stopPlayback();
          eventBus.emit('state', { state: 'listening', detail: 'User interruption detected' });
          return;
        }

        // Audio parts in server turn
        const parts = msg.serverContent?.modelTurn?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            eventBus.emit('state', { state: 'speaking', detail: 'Gemini Live speaking...' });
            this.scheduleAudioChunk(part.inlineData.data);
          }
          if (part.text) {
            eventBus.emit('message', {
              role: 'assistant',
              text: part.text,
              timestamp: Date.now(),
            });
          }
        }

        // User speech transcription if present
        for (const part of msg.serverContent?.userTurn?.parts ?? []) {
          if (part.text) {
            eventBus.emit('message', {
              role: 'user',
              text: part.text,
              timestamp: Date.now(),
            });
          }
        }

        // Tool function calls
        for (const call of msg.toolCall?.functionCalls ?? []) {
          const { id, name, args } = call;
          eventBus.emit('log', {
            text: `[Gemini Live] Invoking tool through live function calling: ${name}`,
            level: 'info',
          });

          const toolInput = typeof args === 'string' ? args : JSON.stringify(args || {});
          const toolResult = await toolRegistry.executeTool(name, toolInput);

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                toolResponse: {
                  functionResponses: [
                    {
                      id,
                      name,
                      response: { output: toolResult.output, success: toolResult.success },
                    },
                  ],
                },
              })
            );
          }
        }

        // Direct error
        if (msg.error) {
          const errMsg = msg.error.message || JSON.stringify(msg.error);
          eventBus.emit('log', { text: `[Gemini Live Error] ${errMsg}`, level: 'error' });
          if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
            eventBus.emit('provider', { name: 'Gemini', status: 'error', error: 'Live quota reached' });
          }
        }
      } catch (e) {
        console.error('Error parsing live WS message:', e);
      }
    };

    this.ws.onerror = (e) => {
      console.warn('[Gemini Live] WebSocket error:', e);
      eventBus.emit('log', {
        text: '[Gemini Live] WebSocket connection encountered an issue.',
        level: 'warn',
      });
    };

    this.ws.onclose = () => {
      this.cleanup();
      eventBus.emit('state', { state: 'idle' });
      eventBus.emit('activity', { id: 'live-voice', label: 'Gemini Live Session', active: false });
    };

    // 6. Monitor real audio levels using AnalyserNode
    const updateAudioLevel = () => {
      if (!this.isListening) return;

      let level = 0;
      if (this.outputAnalyser && this.activeSources.length > 0) {
        level = getNormalizedAudioLevel(this.outputAnalyser);
      } else if (this.micAnalyser) {
        level = getNormalizedAudioLevel(this.micAnalyser);
      }

      this.audioLevel = level;
      this.levelAnimFrame = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();
  }

  private scheduleAudioChunk(base64: string): void {
    if (!this.outputAudioCtx) return;

    try {
      const buffer = base64ToAudioBuffer(base64, this.outputAudioCtx, 24000);
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;

      if (this.outputAnalyser) {
        source.connect(this.outputAnalyser);
        this.outputAnalyser.connect(this.outputAudioCtx.destination);
      } else {
        source.connect(this.outputAudioCtx.destination);
      }

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.04;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      this.activeSources.push(source);

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) this.activeSources.splice(index, 1);
        if (this.activeSources.length === 0 && this.isListening) {
          eventBus.emit('state', { state: 'listening', detail: 'Listening Live...' });
        }
      };
    } catch (e) {
      console.error('Error scheduling audio chunk:', e);
    }
  }

  private stopPlayback(): void {
    this.activeSources.forEach((s) => {
      try {
        s.stop();
        s.disconnect();
      } catch {}
    });
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  public async stop(): Promise<void> {
    this.cleanup();
    eventBus.emit('state', { state: 'idle' });
    eventBus.emit('log', { text: '[Gemini Live] Session ended by user.', level: 'info' });
  }

  private cleanup(): void {
    this.isListening = false;
    this.audioLevel = 0;
    this.stopPlayback();

    if (this.sessionTimerInterval) {
      clearInterval(this.sessionTimerInterval);
      this.sessionTimerInterval = null;
    }
    if (this.levelAnimFrame) {
      cancelAnimationFrame(this.levelAnimFrame);
      this.levelAnimFrame = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
