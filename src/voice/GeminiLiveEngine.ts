import { SpeechEngine, SpeechSessionOptions, LiveVoiceName, VoiceMode } from './types';
import { floatTo16BitPCMBase64, base64ToAudioBuffer, getNormalizedAudioLevel } from './audioUtils';
import { eventBus } from '../events/eventBus';
import { toolRegistry } from '../tools';
import { ApiClient } from '../api/client';
import { enableKeepAwake, disableKeepAwake } from './keepAwake';

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
  public isMuted = false;
  public audioLevel = 0;
  public sessionDuration = 0;
  public mode: VoiceMode = 'tap';

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
  private activeModel: string = CONFIG_LIVE_MODEL;

  // VAD & Silence Management
  private lastSpeechTimestamp = Date.now();
  private vadSilenceTimer: NodeJS.Timeout | null = null;
  private isSpeechActive = false;
  private speechHangoverMs = 1500;
  private isModelSpeaking = false;
  private reconnectAttempts = 0;
  private isReconnecting = false;

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

  public setMode(newMode: VoiceMode): void {
    this.mode = newMode;
    localStorage.setItem('jexa_voice_mode', newMode);
    eventBus.emit('log', {
      text: `[Voice Mode] Switched to ${newMode === 'always' ? 'Always Listening (VAD active)' : newMode === 'wake' ? 'Wake Phrase ("Hey JEXA")' : 'Tap to Talk'}`,
      level: 'info',
    });
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }

    eventBus.emit('log', {
      text: this.isMuted ? '[Voice Engine] Microphone hard-muted' : '[Voice Engine] Microphone unmuted',
      level: this.isMuted ? 'warn' : 'info',
    });
    eventBus.emit('activity', {
      id: 'mic-mute',
      label: this.isMuted ? 'Mic Muted' : 'Mic Live',
      active: this.isMuted,
    });

    return this.isMuted;
  }

  public async start(options?: SpeechSessionOptions): Promise<void> {
    if (this.isListening && !this.isReconnecting) return;

    if (!ApiClient.isConnected()) {
      throw new Error('Backend not connected. Configure your backend URL in Settings.');
    }

    const savedVoice = (localStorage.getItem('jexa_live_voice') as LiveVoiceName) || 'Zephyr';
    this.selectedVoice = options?.voiceName || savedVoice;

    const savedModel = localStorage.getItem('jexa_live_model') || CONFIG_LIVE_MODEL;
    this.activeModel = options?.modelName || savedModel;

    this.mode = (localStorage.getItem('jexa_voice_mode') as VoiceMode) || 'tap';

    // Activate keep-awake if in always or wake mode
    if (this.mode === 'always' || this.mode === 'wake') {
      await enableKeepAwake();
    }

    eventBus.emit('log', {
      text: `[Gemini Live] Initiating session with voice "${this.selectedVoice}" and model "${this.activeModel}"...`,
      level: 'info',
    });

    let tokenConfig: LiveTokenResponse;
    try {
      tokenConfig = await this.getLiveToken();
    } catch (tokenErr: any) {
      throw new Error(`Failed to initialize Live token: ${tokenErr.message}`);
    }

    const modelToUse = options?.modelName || tokenConfig.model || this.activeModel;

    // 1. Setup AudioContexts (16kHz capture, 24kHz playback)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.inputAudioCtx || this.inputAudioCtx.state === 'closed') {
      this.inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
    }
    if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
      this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });
    }

    if (this.inputAudioCtx.state === 'suspended') await this.inputAudioCtx.resume();
    if (this.outputAudioCtx.state === 'suspended') await this.outputAudioCtx.resume();

    // Setup Analysers
    this.micAnalyser = this.inputAudioCtx.createAnalyser();
    this.micAnalyser.fftSize = 256;
    this.micAnalyser.smoothingTimeConstant = 0.3;

    this.outputAnalyser = this.outputAudioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputAnalyser.smoothingTimeConstant = 0.3;

    // 2. Capture Microphone Stream with echo cancellation and auto gain
    try {
      if (!this.micStream) {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
      if (this.isMuted) {
        this.micStream.getAudioTracks().forEach((track) => (track.enabled = false));
      }
    } catch (micErr: any) {
      this.cleanup();
      const msg =
        micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError'
          ? 'Microphone permission denied. Please allow microphone access in device settings.'
          : `Microphone error: ${micErr.message || 'Cannot access audio input'}`;
      eventBus.emit('log', { text: `[Gemini Live] ${msg}`, level: 'error' });
      eventBus.emit('message', { role: 'system', text: msg });
      throw new Error(msg);
    }

    const source = this.inputAudioCtx.createMediaStreamSource(this.micStream);
    this.processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);

    source.connect(this.micAnalyser);
    source.connect(this.processor);
    this.processor.connect(this.inputAudioCtx.destination);

    // 3. Connect to Gemini Multimodal Live API via WebSockets
    const token = tokenConfig.token;
    const wsUrl = token
      ? `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(token)}`
      : `${ApiClient.getBackendUrl().replace(/^http/, 'ws')}/live`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isListening = true;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      this.sessionDuration = 0;
      this.lastSpeechTimestamp = Date.now();

      if (this.sessionTimerInterval) clearInterval(this.sessionTimerInterval);
      this.sessionTimerInterval = setInterval(() => {
        this.sessionDuration += 1;
      }, 1000);

      // System instruction: concise, calm, confirms briefly ("Done, sir.")
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
                text: 'You are JEXA (JARVIS-class Executive Autonomous Intelligence), a calm, razor-sharp personal AI command centre operating in real-time voice mode. Be concise, calm, and confirm briefly ("Done, sir."). Keep answers under two short sentences unless depth is requested.',
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

    // 4. Stream 16kHz PCM audio with local VAD & self-suppression
    this.processor.onaudioprocess = (e) => {
      if (!this.isListening || this.isMuted) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Calculate Root Mean Square energy for local VAD
      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);
      const isSpeechNow = rms > 0.018;

      if (isSpeechNow) {
        this.lastSpeechTimestamp = Date.now();
        this.isSpeechActive = true;
      } else if (Date.now() - this.lastSpeechTimestamp > this.speechHangoverMs) {
        this.isSpeechActive = false;
      }

      // Barge-in: If model is currently speaking and user speaks loud, interrupt immediately
      if (this.isModelSpeaking && rms > 0.045) {
        this.stopPlayback();
        this.isModelSpeaking = false;
        eventBus.emit('state', { state: 'listening', detail: 'Barge-in interruption' });
      }

      // Suppress self-listening during model playback to prevent echo loops
      if (this.isModelSpeaking) {
        return;
      }

      // Always mode auto-pause after 60s silence to preserve free tier quota
      if (this.mode === 'always') {
        const silentSeconds = (Date.now() - this.lastSpeechTimestamp) / 1000;
        if (silentSeconds > 60 && this.isListening) {
          eventBus.emit('log', {
            text: '[Gemini Live] 60s silence elapsed in Always-Listening mode. Standby sleep active to save quota.',
            level: 'info',
          });
          this.pauseForSilence();
          return;
        }
      }

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // Send PCM chunk
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

        // Server Interruption notice
        if (msg.serverContent?.interrupted) {
          this.stopPlayback();
          this.isModelSpeaking = false;
          eventBus.emit('state', { state: 'listening', detail: 'Interrupted' });
          return;
        }

        // Audio parts in server turn
        const parts = msg.serverContent?.modelTurn?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            this.isModelSpeaking = true;
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

        // User speech transcription
        for (const part of msg.serverContent?.userTurn?.parts ?? []) {
          if (part.text) {
            eventBus.emit('message', {
              role: 'user',
              text: part.text,
              timestamp: Date.now(),
            });
          }
        }

        // Function Calls
        for (const call of msg.toolCall?.functionCalls ?? []) {
          const { id, name, args } = call;
          eventBus.emit('log', {
            text: `[Gemini Live] Invoking tool through live function calling: ${name}`,
            level: 'info',
          });
          eventBus.emit('state', { state: 'running_tools', detail: `Executing ${name}` });

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

        // Direct error from Gemini Live
        if (msg.error) {
          const errMsg = msg.error.message || JSON.stringify(msg.error);
          eventBus.emit('log', { text: `[Gemini Live Error] ${errMsg}`, level: 'error' });
          if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
            eventBus.emit('provider', { name: 'Gemini', status: 'error', error: 'Live quota reached' });
          }
        }

        // Server GoAway or session limit notification
        if (msg.goAway || (msg.serverContent && msg.serverContent.endOfTurn && this.sessionDuration > 540)) {
          this.handleReconnection();
        }
      } catch (e) {
        console.error('Error parsing live WS message:', e);
      }
    };

    this.ws.onerror = (e) => {
      console.warn('[Gemini Live] WebSocket error:', e);
      eventBus.emit('log', {
        text: '[Gemini Live] WebSocket connection encountered a transient issue.',
        level: 'warn',
      });
    };

    this.ws.onclose = (e) => {
      if (this.isReconnecting) return;

      // Auto-reconnect if session closed unexpectedly while always-listening
      if (this.mode === 'always' && !this.isMuted && this.reconnectAttempts < 3 && e.code !== 1000) {
        this.handleReconnection();
      } else {
        this.cleanup();
        eventBus.emit('state', { state: 'idle' });
        eventBus.emit('activity', { id: 'live-voice', label: 'Gemini Live Session', active: false });
      }
    };

    // 6. Monitor real audio levels using AnalyserNode
    const updateAudioLevel = () => {
      if (!this.isListening) return;

      let level = 0;
      if (this.outputAnalyser && this.activeSources.length > 0) {
        level = getNormalizedAudioLevel(this.outputAnalyser);
      } else if (this.micAnalyser && !this.isMuted) {
        level = getNormalizedAudioLevel(this.micAnalyser);
      }

      this.audioLevel = level;
      this.levelAnimFrame = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();
  }

  private handleReconnection(): void {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    this.reconnectAttempts += 1;

    eventBus.emit('state', { state: 'thinking', detail: 'Reconnecting Live session...' });
    eventBus.emit('log', {
      text: `[Gemini Live] Reconnecting session (attempt ${this.reconnectAttempts}/3)...`,
      level: 'warn',
    });

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    setTimeout(() => {
      if (this.isListening || this.mode === 'always') {
        this.start().catch((err) => {
          this.isReconnecting = false;
          console.warn('[Gemini Live] Reconnection attempt failed:', err);
        });
      }
    }, 1500);
  }

  private pauseForSilence(): void {
    if (this.ws) {
      try {
        this.ws.close(1000, 'Idle silence');
      } catch {}
      this.ws = null;
    }
    this.isListening = false;
    eventBus.emit('state', { state: 'idle', detail: 'VAD standby (listening for voice)' });
    eventBus.emit('activity', { id: 'live-voice', label: 'Gemini Live Standby', active: false });
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
        if (this.activeSources.length === 0) {
          this.isModelSpeaking = false;
          if (this.isListening) {
            eventBus.emit('state', { state: 'listening', detail: 'Listening Live...' });
          }
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
    this.isModelSpeaking = false;
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  public async stop(): Promise<void> {
    this.cleanup();
    await disableKeepAwake();
    eventBus.emit('state', { state: 'idle' });
    eventBus.emit('log', { text: '[Gemini Live] Session ended by user.', level: 'info' });
  }

  private cleanup(): void {
    this.isListening = false;
    this.isReconnecting = false;
    this.audioLevel = 0;
    this.stopPlayback();

    if (this.sessionTimerInterval) {
      clearInterval(this.sessionTimerInterval);
      this.sessionTimerInterval = null;
    }
    if (this.vadSilenceTimer) {
      clearTimeout(this.vadSilenceTimer);
      this.vadSilenceTimer = null;
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
