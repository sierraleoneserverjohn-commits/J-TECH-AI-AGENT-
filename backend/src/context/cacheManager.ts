import { config } from '../config.js';

interface CachedEntry {
  reply: string;
  provider: string;
  sources?: any[];
  timestamp: number;
}

export class CacheManager {
  private localCache = new Map<string, CachedEntry>();

  public isUpstashConfigured(): boolean {
    return !!(config.upstashUrl && config.upstashToken);
  }

  private normalizeKey(query: string): string {
    return `jexa:cache:${query.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 80)}`;
  }

  public async get(query: string): Promise<CachedEntry | null> {
    const key = this.normalizeKey(query);

    // 1. Check Upstash Redis
    if (this.isUpstashConfigured()) {
      try {
        const url = `${config.upstashUrl.replace(/\/+$/, '')}/get/${encodeURIComponent(key)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${config.upstashToken}` },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.result) {
            return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          }
        }
      } catch {
        // Fallback to local cache below
      }
    }

    // 2. In-memory fallback
    const entry = this.localCache.get(key);
    if (!entry) return null;

    // 10-minute expiry (600,000 ms)
    if (Date.now() - entry.timestamp > 600000) {
      this.localCache.delete(key);
      return null;
    }

    return entry;
  }

  public async set(query: string, value: { reply: string; provider: string; sources?: any[] }): Promise<void> {
    const key = this.normalizeKey(query);
    const entry: CachedEntry = {
      ...value,
      timestamp: Date.now(),
    };

    // 1. Save to Upstash Redis with 600 seconds (10 min) TTL
    if (this.isUpstashConfigured()) {
      try {
        const url = `${config.upstashUrl.replace(/\/+$/, '')}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(entry))}/ex/600`;
        await fetch(url, {
          headers: { Authorization: `Bearer ${config.upstashToken}` },
        });
        return;
      } catch {
        // Fallback to local cache below
      }
    }

    // 2. In-memory cache
    this.localCache.set(key, entry);

    // Clean old entries if memory grows
    if (this.localCache.size > 200) {
      const now = Date.now();
      for (const [k, v] of this.localCache.entries()) {
        if (now - v.timestamp > 600000) {
          this.localCache.delete(k);
        }
      }
    }
  }
}

export const cacheManager = new CacheManager();
