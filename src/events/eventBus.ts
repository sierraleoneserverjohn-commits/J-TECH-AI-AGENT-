/**
 * Typed Event Bus for JEXA Command Centre
 * All UI updates strictly flow through this bus.
 */

export type OrbState =
  | 'idle'
  | 'listening'
  | 'understanding'
  | 'thinking'
  | 'reasoning'
  | 'searching'
  | 'accessing_database'
  | 'running_tools'
  | 'calling_provider'
  | 'working'
  | 'executing'
  | 'typing'
  | 'chatting'
  | 'speaking'
  | 'completed'
  | 'error';

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface TaskStep {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  timestamp: number;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  requiresConfirmation?: boolean;
  needsAndroidApp?: boolean;
  status: 'pending' | 'confirmed' | 'cancelled' | 'executed';
  payload?: any;
}

export interface ActivityChipItem {
  id: string;
  label: string;
  active: boolean;
  type?: string;
  timestamp?: number;
}

export type JexaEventMap = {
  state: {
    state: OrbState;
    message?: string;
    detail?: string;
    provider?: string;
    latencyMs?: number;
  };
  activity: ActivityChipItem;
  log: { id?: string; text: string; level?: LogLevel; timestamp?: number };
  provider: {
    name: string;
    status: 'connected' | 'busy' | 'standby' | 'not_configured' | 'error';
    latencyMs?: number | null;
    error?: string;
    requestsToday?: number;
  };
  tool: { name: string; status: 'idle' | 'calling' | 'success' | 'failed'; detail?: string };
  task: {
    title: string;
    steps: TaskStep[];
    progress: number;
  };
  memory: {
    layer: 'working' | 'long-term';
    delta: number;
    item?: MemoryItem;
    action?: 'add' | 'clear' | 'remove';
  };
  health: {
    key: 'api' | 'database' | 'realtime' | 'voice';
    value: 'healthy' | 'warning' | 'degraded' | 'offline';
    latencyMs?: number;
    message?: string;
  };
  speak: { text: string };
  message: {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
    timestamp?: number;
  };
  action: ActionItem;
};

export type EventType = keyof JexaEventMap;
export type EventListener<T extends EventType> = (payload: JexaEventMap[T]) => void;

class EventBus {
  private listeners = new Map<EventType, Set<EventListener<any>>>();
  private history: { type: EventType; payload: any; timestamp: number }[] = [];

  public emit<T extends EventType>(type: T, payload: JexaEventMap[T]): void {
    const eventRecord = { type, payload, timestamp: Date.now() };
    this.history.push(eventRecord);
    if (this.history.length > 200) {
      this.history.shift();
    }

    const set = this.listeners.get(type);
    if (set) {
      set.forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          console.error(`Error in event listener for ${type}:`, e);
        }
      });
    }
  }

  public on<T extends EventType>(type: T, listener: EventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.off(type, listener);
  }

  public off<T extends EventType>(type: T, listener: EventListener<T>): void {
    const set = this.listeners.get(type);
    if (set) {
      set.delete(listener);
    }
  }

  public getHistory() {
    return [...this.history];
  }
}

export const eventBus = new EventBus();
