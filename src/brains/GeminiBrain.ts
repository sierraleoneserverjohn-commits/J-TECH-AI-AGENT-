import { BrainClient } from './BrainClient';
import { eventBus } from '../events/eventBus';

export class GeminiBrain implements BrainClient {
  public id = 'gemini';
  public name = 'Gemini Brain';
  public description = 'Google Gemini API via JEXA backend proxy';
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

    // 2. Read configured backend URL and access token from localStorage
    const backendUrl = localStorage.getItem('jexa_backend_url') || (typeof window !== 'undefined' ? window.location.origin : '');
    const accessToken = localStorage.getItem('jexa_access_token') || '';

    if (!backendUrl) {
      eventBus.emit('message', {
        role: 'system',
        text: 'Backend not connected. Add your backend URL in Settings.',
      });
      eventBus.emit('log', {
        text: 'Command halted: Backend not connected.',
        level: 'warn',
      });
      eventBus.emit('state', { state: 'idle' });
      return;
    }

    // 3. Begin real execution on backend: understanding directive
    eventBus.emit('state', {
      state: 'understanding',
      detail: `Analyzing directive: "${trimmed.slice(0, 32)}..."`,
    });

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const activeModel = localStorage.getItem('jexa_active_model') || undefined;

      eventBus.emit('activity', {
        id: 'gemini-call',
        label: 'Connecting to Gemini',
        active: true,
      });

      eventBus.emit('state', {
        state: 'calling_provider',
        provider: 'Gemini',
        detail: `Dispatching to ${activeModel || 'Gemini Core'}...`,
      });

      const response = await fetch(`${backendUrl}/api/gemini/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: trimmed, model: activeModel }),
        signal: this.abortController.signal,
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Invalid or missing access token.');
        }
        if (response.status === 429) {
          throw new Error(errJson.error || 'Gemini Free Tier quota reached. Please retry in a few hours or select a billing-enabled key in Settings > Secrets.');
        }
        if (response.status === 503) {
          throw new Error(errJson.error || 'Backend AI service unavailable. Check GEMINI_API_KEY on the server.');
        }
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.reply || '';

      eventBus.emit('activity', {
        id: 'gemini-call',
        label: 'Connecting to Gemini',
        active: false,
      });

      eventBus.emit('provider', {
        name: 'Gemini',
        status: 'connected',
        latencyMs,
      });

      eventBus.emit('log', {
        text: `Response received (${latencyMs}ms)`,
        level: 'success',
      });

      // Typing state briefly then speaking
      eventBus.emit('state', {
        state: 'typing',
        detail: 'Synthesizing voice synthesis...',
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

        // Trigger completed shockwave
        setTimeout(() => {
          eventBus.emit('state', { state: 'completed', detail: 'Routine completed successfully' });
          setTimeout(() => eventBus.emit('state', { state: 'idle' }), 1200);
        }, 1600);
      }, 350);
    } catch (err: any) {
      eventBus.emit('activity', {
        id: 'gemini-call',
        label: 'Connecting to Gemini',
        active: false,
      });
      if (err.name === 'AbortError') {
        eventBus.emit('log', { text: 'Command aborted by user.', level: 'warn' });
        eventBus.emit('state', { state: 'idle' });
        return;
      }

      const errorMsg = err?.message || 'Failed to connect to backend server.';
      
      // If server could not be reached at all:
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('Connection refused')) {
        eventBus.emit('message', {
          role: 'system',
          text: 'Backend not connected. Add your backend URL in Settings.',
        });
        eventBus.emit('log', {
          text: `Backend connection error: ${errorMsg}`,
          level: 'error',
        });
      } else {
        eventBus.emit('message', {
          role: 'system',
          text: errorMsg,
        });
        eventBus.emit('log', {
          text: `Error: ${errorMsg}`,
          level: 'error',
        });
      }

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
