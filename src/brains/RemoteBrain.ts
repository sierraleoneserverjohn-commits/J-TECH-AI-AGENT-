import { BrainClient } from './BrainClient';
import { eventBus } from '../events/eventBus';

export class RemoteBrain implements BrainClient {
  public id = 'remote';
  public name = 'Remote Brain (WebSocket/HTTP)';
  public description = 'Connects to an external JEXA backend over WebSocket or HTTP';
  private ws: WebSocket | null = null;
  private endpointUrl: string = '';

  constructor() {
    this.endpointUrl = localStorage.getItem('jexa_remote_brain_url') || 'wss://api.jexa.ai/v1/stream';
  }

  public setEndpoint(url: string) {
    this.endpointUrl = url;
    localStorage.setItem('jexa_remote_brain_url', url);
  }

  public getEndpoint(): string {
    return this.endpointUrl;
  }

  public async send(command: string): Promise<void> {
    const trimmed = command.trim();
    if (!trimmed) return;

    eventBus.emit('message', {
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    });

    eventBus.emit('log', {
      text: `[RemoteBrain] Dispatching to ${this.endpointUrl}`,
      level: 'info',
    });

    eventBus.emit('state', { state: 'thinking' });

    // Try WebSocket if ws:// or wss://, else HTTP POST
    if (this.endpointUrl.startsWith('ws://') || this.endpointUrl.startsWith('wss://')) {
      return this.sendViaWebSocket(trimmed);
    } else {
      return this.sendViaHttp(trimmed);
    }
  }

  private sendViaWebSocket(command: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.ws = new WebSocket(this.endpointUrl);

          this.ws.onopen = () => {
            eventBus.emit('log', { text: '[RemoteBrain] WebSocket connected', level: 'success' });
            this.ws?.send(JSON.stringify({ type: 'command', command }));
          };

          this.ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type && data.payload) {
                eventBus.emit(data.type, data.payload);
              }
            } catch {
              eventBus.emit('message', { role: 'assistant', text: event.data });
            }
          };

          this.ws.onerror = (e) => {
            console.warn('[RemoteBrain] WebSocket connection issue:', e);
            this.handleConnectionFailure();
            resolve();
          };

          this.ws.onclose = () => {
            this.ws = null;
          };
        } else {
          this.ws.send(JSON.stringify({ type: 'command', command }));
          resolve();
        }
      } catch {
        this.handleConnectionFailure();
        resolve();
      }
    });
  }

  private async sendViaHttp(command: string): Promise<void> {
    try {
      const res = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      if (!res.ok) {
        throw new Error(`Remote HTTP error ${res.status}`);
      }

      const data = await res.json();
      if (data.events && Array.isArray(data.events)) {
        for (const ev of data.events) {
          eventBus.emit(ev.type, ev.payload);
        }
      } else if (data.reply) {
        eventBus.emit('message', { role: 'assistant', text: data.reply });
        eventBus.emit('speak', { text: data.reply });
        eventBus.emit('state', { state: 'idle' });
      }
    } catch {
      this.handleConnectionFailure();
    }
  }

  private handleConnectionFailure() {
    eventBus.emit('message', {
      role: 'system',
      text: 'Backend not connected. Add your backend URL in Settings.',
    });
    eventBus.emit('log', {
      text: `[RemoteBrain] Connection to ${this.endpointUrl} failed.`,
      level: 'error',
    });
    eventBus.emit('state', { state: 'idle' });
  }

  public abort(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
