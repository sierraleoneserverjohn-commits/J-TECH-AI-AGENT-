import { SpeechEngine, SpeechSessionOptions, LiveVoiceName } from './types';
import { floatTo16BitPCMBase64, base64ToAudioBuffer, getNormalizedAudioLevel } from './audioUtils';
import { eventBus } from '../events/eventBus';
import { toolRegistry } from '../tools';

export const CONFIG_LIVE_MODEL = 'gemini-3.8-live';

export interface LiveTokenResponse {
  wsUrl: string;
  token?: string;
  model: string;
  availableVoices: LiveVoiceName[];
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
    try {
      const backendUrl = localStorage.getItem('jexa_backend_url') || window.location.origin;
      const res = await fetch(`${backendUrl}/api/live-token`);
      return res.ok;
    } catch {
      return false;
    }
  }

  public async getLiveToken(): Promise<LiveTokenResponse> {
    const backendUrl = localStorage.getItem('jexa_backend_url') || (typeof window !== 'undefined' ? window.location.origin : '');
    const res = await fetch(`${backendUrl}/api/live-token`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to acquire live session token (${res.status})`);
    }
    return res.json();
  }

  public async start(options?: SpeechSessionOptions): Promise<void> {
    if (this.isListening) return;

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

    // 3. Connect WebSocket to backend Live proxy
    let wsUrl = tokenConfig.wsUrl || '/live';
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${proto}//${window.location.host}${wsUrl.startsWith('/') ? '' : '/'}${wsUrl}`;
    }
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isListening = true;
      this.sessionDuration = 0;

      // Start session duration timer
      this.sessionTimerInterval = setInterval(() => {
        this.sessionDuration += 1;
      }, 1000);

      // Send initial setup payload with selected voice and model
      this.ws?.send(
        JSON.stringify({
          type: 'setup',
          model: modelToUse,
          voice: this.selectedVoice,
          token: tokenConfig.token,
        })
      );

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
      this.ws.send(JSON.stringify({ type: 'audio', audio: base64Pcm }));
    };

    // 5. Handle Live Messages & Interruption
    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Interruption: user spoke over JEXA -> stop playback immediately!
        if (msg.interrupted) {
          this.stopPlayback();
          eventBus.emit('state', { state: 'listening', detail: 'User interruption detected' });
          return;
        }

        // Live Audio playback (24kHz PCM chunk)
        if (msg.audio) {
          eventBus.emit('state', { state: 'speaking', detail: 'Gemini Live speaking...' });
          this.scheduleAudioChunk(msg.audio);
        }

        // Transcriptions
        if (msg.transcript) {
          eventBus.emit('message', {
            role: 'assistant',
            text: msg.transcript,
            timestamp: Date.now(),
          });
        }
        if (msg.inputTranscript) {
          eventBus.emit('message', {
            role: 'user',
            text: msg.inputTranscript,
            timestamp: Date.now(),
          });
        }

        // Live Function Calling Tool Trigger
        if (msg.toolCall && msg.toolCall.name) {
          const { id, name, args } = msg.toolCall;
          eventBus.emit('log', {
            text: `[Gemini Live] Invoking tool through live function calling: ${name}`,
            level: 'info',
          });

          const toolInput = typeof args === 'string' ? args : JSON.stringify(args || {});
          const toolResult = await toolRegistry.executeTool(name, toolInput);

          // Send tool result back to live session
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                type: 'toolResponse',
                id,
                name,
                response: { output: toolResult.output, success: toolResult.success },
              })
            );
          }
        }

        // Quota warning or error
        if (msg.error) {
          eventBus.emit('log', {
            text: `[Gemini Live Error] ${msg.error}`,
            level: 'error',
          });
          if (msg.code === 429 || msg.error.includes('quota') || msg.error.includes('RESOURCE_EXHAUSTED')) {
            eventBus.emit('provider', {
              name: 'Gemini',
              status: 'error',
              error: 'Live session quota exceeded',
            });
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
      // If speaking, use output analyser; otherwise use mic analyser
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

      // Gapless scheduling
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
