import { Response } from 'express';

export type EventType =
  | 'state'
  | 'log'
  | 'provider'
  | 'tool'
  | 'task'
  | 'memory'
  | 'health'
  | 'message'
  | 'activity';

export interface SSEClient {
  id: string;
  res: Response;
  ip: string;
  connectedAt: number;
}

class SSEManager {
  private clients = new Map<string, SSEClient>();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 20-second keepalive ping per specification
    this.pingInterval = setInterval(() => {
      this.broadcastRaw(': ping\n\n');
    }, 20000);
  }

  public addClient(id: string, res: Response, ip: string): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const client: SSEClient = { id, res, ip, connectedAt: Date.now() };
    this.clients.set(id, client);

    // Initial greeting event
    this.sendToClient(client, 'health', { key: 'sse', value: 'connected', clients: this.clients.size });

    res.on('close', () => {
      this.clients.delete(id);
    });
  }

  public emit(type: EventType, payload: Record<string, any>): void {
    const data = JSON.stringify(payload);
    const message = `event: ${type}\ndata: ${data}\n\n`;
    this.broadcastRaw(message);
  }

  private sendToClient(client: SSEClient, type: EventType, payload: Record<string, any>): void {
    try {
      const data = JSON.stringify(payload);
      client.res.write(`event: ${type}\ndata: ${data}\n\n`);
    } catch {
      this.clients.delete(client.id);
    }
  }

  private broadcastRaw(raw: string): void {
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(raw);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
