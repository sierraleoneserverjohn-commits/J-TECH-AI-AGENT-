import { config } from '../config.js';

export interface MemoryRecord {
  id: string;
  key: string;
  value: string;
  category?: string;
  created_at: string;
}

class SupabaseMemoryStore {
  // In-memory fallback store if Supabase is not configured
  private localStore: MemoryRecord[] = [];

  public isConfigured(): boolean {
    return !!(config.supabaseUrl && config.supabaseServiceKey);
  }

  public async ping(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
    if (!this.isConfigured()) {
      return { connected: false };
    }

    const start = Date.now();
    try {
      const url = `${config.supabaseUrl.replace(/\/+$/, '')}/rest/v1/`;
      const res = await fetch(url, {
        headers: {
          apikey: config.supabaseServiceKey,
          Authorization: `Bearer ${config.supabaseServiceKey}`,
        },
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

  public async save(key: string, value: string, category: string = 'general'): Promise<MemoryRecord> {
    const item: MemoryRecord = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      key,
      value,
      category,
      created_at: new Date().toISOString(),
    };

    if (!this.isConfigured()) {
      this.localStore.unshift(item);
      return item;
    }

    try {
      const url = `${config.supabaseUrl.replace(/\/+$/, '')}/rest/v1/jexa_memories`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.supabaseServiceKey,
          Authorization: `Bearer ${config.supabaseServiceKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(item),
      });

      if (!res.ok) {
        // Fallback to local
        this.localStore.unshift(item);
        return item;
      }

      const saved = await res.json();
      return Array.isArray(saved) ? saved[0] : item;
    } catch {
      this.localStore.unshift(item);
      return item;
    }
  }

  public async search(query: string, limit: number = 5): Promise<MemoryRecord[]> {
    const cleanQ = query.toLowerCase();

    if (!this.isConfigured()) {
      return this.localStore
        .filter((m) => m.key.toLowerCase().includes(cleanQ) || m.value.toLowerCase().includes(cleanQ))
        .slice(0, limit);
    }

    try {
      const url = `${config.supabaseUrl.replace(/\/+$/, '')}/rest/v1/jexa_memories?or=(key.ilike.*${encodeURIComponent(query)}*,value.ilike.*${encodeURIComponent(query)}*)&limit=${limit}`;
      const res = await fetch(url, {
        headers: {
          apikey: config.supabaseServiceKey,
          Authorization: `Bearer ${config.supabaseServiceKey}`,
        },
      });

      if (!res.ok) {
        return this.localStore
          .filter((m) => m.key.toLowerCase().includes(cleanQ) || m.value.toLowerCase().includes(cleanQ))
          .slice(0, limit);
      }

      const results = (await res.json()) as MemoryRecord[];
      return Array.isArray(results) ? results : [];
    } catch {
      return this.localStore
        .filter((m) => m.key.toLowerCase().includes(cleanQ) || m.value.toLowerCase().includes(cleanQ))
        .slice(0, limit);
    }
  }

  public getLocalCount(): number {
    return this.localStore.length;
  }
}

export const supabaseMemory = new SupabaseMemoryStore();
