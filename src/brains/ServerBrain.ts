import { BrainClient } from './BrainClient';
import { ApiClient } from '../api/client';
import { eventBus } from '../events/eventBus';

export class ServerBrain implements BrainClient {
  public id = 'server_brain';
  public name = 'JEXA Core Brain';
  public description = 'Single source of truth autonomous agent backend';
  private abortController: AbortController | null = null;

  public async send(command: string): Promise<void> {
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

      const response = await ApiClient.post('/command', {
        text: trimmed,
        sessionId: `session_${Date.now()}`,
      });

      const latencyMs = Date.now() - startTime;
      const replyText = response.reply || response.output || 'Command processed.';

      eventBus.emit('activity', {
        id: 'agent-execution',
        label: 'Processing Directive',
        active: false,
      });

      eventBus.emit('provider', {
        name: response.provider || 'Agent Orchestrator',
        status: 'connected',
        latencyMs,
      });

      eventBus.emit('log', {
        text: `Response completed (${latencyMs}ms)`,
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

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
