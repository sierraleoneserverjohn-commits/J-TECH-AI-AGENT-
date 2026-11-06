import { config } from '../config.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export class ContextManager {
  // In-memory fallback map of session history
  private memorySessions = new Map<string, ChatMessage[]>();

  public isUpstashConfigured(): boolean {
    return !!(config.upstashUrl && config.upstashToken);
  }

  public async pingUpstash(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
    if (!this.isUpstashConfigured()) {
      return { connected: false };
    }

    const start = Date.now();
    try {
      const url = `${config.upstashUrl.replace(/\/+$/, '')}/ping`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.upstashToken}` },
      });
      return {
        connected: res.ok,
        latencyMs: Date.now() - start,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  public async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    if (this.isUpstashConfigured()) {
      try {
        const key = `jexa:session:${sessionId}`;
        const url = `${config.upstashUrl.replace(/\/+$/, '')}/rpush/${encodeURIComponent(key)}`;
        await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.upstashToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(JSON.stringify(message)),
        });

        // Set 24 hour expiry on session
        await fetch(`${config.upstashUrl.replace(/\/+$/, '')}/expire/${encodeURIComponent(key)}/86400`, {
          headers: { Authorization: `Bearer ${config.upstashToken}` },
        });
        return;
      } catch {
        // Fallback to in-memory below
      }
    }

    // In-memory fallback
    const list = this.memorySessions.get(sessionId) || [];
    list.push(message);
    if (list.length > 20) {
      list.shift(); // Keep bounded in memory
    }
    this.memorySessions.set(sessionId, list);
  }

  public async getRecentContext(sessionId: string): Promise<{ messages: ChatMessage[]; summary?: string }> {
    let history: ChatMessage[] = [];

    if (this.isUpstashConfigured()) {
      try {
        const key = `jexa:session:${sessionId}`;
        // Fetch last 12 messages from Upstash Redis
        const url = `${config.upstashUrl.replace(/\/+$/, '')}/lrange/${encodeURIComponent(key)}/-12/-1`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${config.upstashToken}` },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.result)) {
            history = data.result
              .map((raw: any) => {
                try {
                  return typeof raw === 'string' ? JSON.parse(raw) : raw;
                } catch {
                  return null;
                }
              })
              .filter(Boolean);
          }
        }
      } catch {
        history = this.memorySessions.get(sessionId) || [];
      }
    } else {
      history = this.memorySessions.get(sessionId) || [];
    }

    // Token Saving Strategy: Send ONLY the last 4 messages to the model
    const last4 = history.slice(-4);

    // If there is older history, create a 1-line compact summary instead of resending tokens
    let summary: string | undefined = undefined;
    if (history.length > 4) {
      const older = history.slice(0, -4);
      const userQueries = older.filter((m) => m.role === 'user').map((m) => m.content).slice(-3);
      if (userQueries.length > 0) {
        summary = `Earlier context: user previously asked about ${userQueries.join('; ')}`;
      }
    }

    return { messages: last4, summary };
  }

  public getSessionCount(): number {
    return this.memorySessions.size;
  }
}

export const contextManager = new ContextManager();
