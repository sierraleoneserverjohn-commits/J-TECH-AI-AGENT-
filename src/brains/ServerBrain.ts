import { BrainClient } from './BrainClient';
import { ApiClient } from '../api/client';
import { eventBus } from '../events/eventBus';

export class ServerBrain implements BrainClient {
  public id = 'server_brain';
  public name = 'JEXA Core Brain';
  public description = 'Single source of truth autonomous agent backend';
  private abortController: AbortController | null = null;

  public async send(
    command: string,
    singleTurnOverride?: { mode?: 'auto' | 'manual' | 'task' | 'presets'; model?: string; preset?: 'eco' | 'balanced' | 'max' }
  ): Promise<void> {
    const trimmed = command.trim();
    if (!trimmed) return;

    this.abortController = new AbortController();

    // 1. Emit real user message
    eventBus.emit('message', {
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    });

    eventBus.emit('log', {
      text: `Command dispatched: "${trimmed}"`,
      level: 'info',
    });

    if (!ApiClient.isConnected()) {
      eventBus.emit('message', {
        role: 'system',
        text: 'Backend not connected. Add your backend URL in Settings.',
      });
      eventBus.emit('log', {
        text: 'Command halted: Backend not connected. Open Settings.',
        level: 'warn',
      });
      eventBus.emit('state', { state: 'idle' });
      return;
    }

    eventBus.emit('state', {
      state: 'understanding',
      detail: `Analyzing directive: "${trimmed.slice(0, 32)}..."`,
    });

    const startTime = Date.now();

    try {
      eventBus.emit('activity', {
        id: 'agent-execution',
        label: 'Processing Directive',
        active: true,
      });

      // Read model mode config from localStorage (stateless backend)
      const storedMode = localStorage.getItem('jexa_model_mode') || 'auto';
      const storedManual = localStorage.getItem('jexa_model_manual') || '';
      const storedPreset = localStorage.getItem('jexa_model_preset') || 'balanced';
      const storedAllowFallback = localStorage.getItem('jexa_allow_fallback') !== 'false';
      const storedTaskChat = localStorage.getItem('jexa_model_task_chat') || '';

      // Allow single-turn override
      let effectiveMode = singleTurnOverride?.mode || storedMode;
      let effectiveModel: string | undefined = undefined;
      let effectivePreset: string | undefined = undefined;

      if (effectiveMode === 'presets') {
        effectivePreset = singleTurnOverride?.preset || (storedPreset as any);
      } else if (effectiveMode === 'manual') {
        effectiveModel = singleTurnOverride?.model || storedManual;
      } else if (effectiveMode === 'task') {
        effectiveModel = storedTaskChat;
      }

      const response = await ApiClient.post('/command', {
        text: trimmed,
        sessionId: `session_${Date.now()}`,
        mode: effectiveMode === 'presets' ? undefined : effectiveMode,
        preset: effectiveMode === 'presets' ? effectivePreset : undefined,
        model: effectiveModel || undefined,
        allowFallback: storedAllowFallback,
      });

      const latencyMs = response.latencyMs ?? (Date.now() - startTime);
      const replyText = response.reply || response.output || 'Command processed.';

      eventBus.emit('activity', {
        id: 'agent-execution',
        label: 'Processing Directive',
        active: false,
      });

      if (response.autoReason) {
        eventBus.emit('activity', {
          id: 'auto-model',
          label: response.autoReason,
          active: true,
        });
        setTimeout(() => {
          eventBus.emit('activity', {
            id: 'auto-model',
            label: response.autoReason,
            active: false,
          });
        }, 5000);
      }

      eventBus.emit('provider', {
        name: response.provider || 'Agent Orchestrator',
        status: 'connected',
        latencyMs,
      });

      eventBus.emit('log', {
        text: `Response completed from ${response.provider || 'Agent'} in ${latencyMs}ms`,
        level: 'success',
      });

      // Typing state briefly then speaking
      eventBus.emit('state', {
        state: 'typing',
        detail: 'Synthesizing response...',
      });

      setTimeout(() => {
        eventBus.emit('state', {
          state: 'speaking',
          detail: 'Broadcasting response...',
        });
        eventBus.emit('message', {
          role: 'assistant',
          text: replyText,
          timestamp: Date.now(),
          provider: response.provider,
          model: response.model,
          latencyMs,
          autoReason: response.autoReason,
          sources: response.sources,
        });
        eventBus.emit('speak', { text: replyText });

        // Trigger completed state
        setTimeout(() => {
          eventBus.emit('state', { state: 'completed', detail: 'Routine completed successfully' });
          setTimeout(() => eventBus.emit('state', { state: 'idle' }), 1200);
        }, 1600);
      }, 350);
    } catch (err: any) {
      eventBus.emit('activity', {
        id: 'agent-execution',
        label: 'Processing Directive',
        active: false,
      });

      const errorMsg = err?.message || 'Failed to connect to backend server.';
      eventBus.emit('message', {
        role: 'system',
        text: errorMsg,
      });
      eventBus.emit('log', {
        text: `Error: ${errorMsg}`,
        level: 'error',
      });

      eventBus.emit('state', { state: 'error', message: errorMsg });
      setTimeout(() => eventBus.emit('state', { state: 'idle' }), 2000);
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Compare prompt between two chosen models side-by-side
   */
  public async compare(text: string, modelA: string, modelB: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    eventBus.emit('message', {
      role: 'user',
      text: `${trimmed}\n\n[Comparison directive: ${modelA} vs ${modelB}]`,
      timestamp: Date.now(),
    });

    if (!ApiClient.isConnected()) {
      eventBus.emit('message', {
        role: 'system',
        text: 'Backend not connected. Configure backend in Settings first.',
      });
      return;
    }

    eventBus.emit('state', {
      state: 'thinking',
      detail: `Comparing models (${modelA} vs ${modelB})...`,
    });

    try {
      eventBus.emit('activity', {
        id: 'model-compare',
        label: 'Dual Model Comparison (2x quota)',
        active: true,
      });

      const res = await ApiClient.post('/compare', {
        text: trimmed,
        modelA,
        modelB,
      });

      eventBus.emit('activity', {
        id: 'model-compare',
        label: 'Dual Model Comparison',
        active: false,
      });

      eventBus.emit('message', {
        role: 'assistant',
        text: `Dual-model evaluation for prompt: "${trimmed.slice(0, 40)}..."`,
        timestamp: Date.now(),
        compare: {
          modelA: res.modelA?.model || modelA,
          replyA: res.modelA?.reply || 'No response',
          latencyMsA: res.modelA?.latencyMs || 0,
          modelB: res.modelB?.model || modelB,
          replyB: res.modelB?.reply || 'No response',
          latencyMsB: res.modelB?.latencyMs || 0,
        },
      });

      eventBus.emit('state', { state: 'completed', detail: 'Comparison completed' });
      setTimeout(() => eventBus.emit('state', { state: 'idle' }), 1200);
    } catch (err: any) {
      eventBus.emit('activity', {
        id: 'model-compare',
        label: 'Dual Model Comparison',
        active: false,
      });
      eventBus.emit('message', {
        role: 'system',
        text: `Comparison failed: ${err.message}`,
      });
      eventBus.emit('state', { state: 'error', message: err.message });
      setTimeout(() => eventBus.emit('state', { state: 'idle' }), 2000);
    }
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
