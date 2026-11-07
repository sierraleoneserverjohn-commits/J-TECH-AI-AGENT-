import { useState, useEffect, useCallback, useRef } from 'react';
import {
  eventBus,
  OrbState,
  LogLevel,
  TaskStep,
  MemoryItem,
  ActionItem,
} from './eventBus';
import { ApiClient } from '../api/client';

export interface ProviderState {
  name: string;
  status: 'connected' | 'busy' | 'standby' | 'not_configured' | 'error';
  latencyMs: number | null;
  lastUsedTime: number | null;
  requestsToday: number;
  description?: string;
  freeQuotaUsed?: number;
  freeQuotaMax?: number;
  lastError?: string;
}

export interface BackendSystemStatus {
  backendReachable: boolean;
  databaseReachable: boolean;
  models: string[];
  tools: { name: string; description: string; status?: string }[];
  providers: Record<string, { configured: boolean; status: 'connected' | 'not_configured' | 'error'; latencyMs?: number; model?: string }>;
  memoryConnected: boolean;
  workingCount: number;
  longTermCount: number;
  healthPercent: number | null; // null if backend not reachable -> displayed as "—"
  sseStatus: 'connected' | 'reconnecting' | 'disconnected';
}

export interface LogItem {
  id: string;
  text: string;
  level: LogLevel;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
}

export interface ActiveTask {
  title: string;
  steps: TaskStep[];
  progress: number;
  active: boolean;
}

export interface ActivityChip {
  id: string;
  label: string;
  active: boolean;
  timestamp: number;
}

export interface ActiveProviderUsage {
  name: string;
  latencyMs?: number;
  active: boolean;
}

export function useJexaStore() {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [orbMessage, setOrbMessage] = useState<string>('');
  const [reasoningLine, setReasoningLine] = useState<string>('');
  const [activityChips, setActivityChips] = useState<ActivityChip[]>([]);
  const [activeProviderUsage, setActiveProviderUsage] = useState<ActiveProviderUsage | null>(null);

  // 1. Live activity starts EMPTY - only real events appear!
  const [logs, setLogs] = useState<LogItem[]>([]);

  // Messages starts empty
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Active task starts null
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);

  // Real memories from backend (starts empty)
  const [workingMemory, setWorkingMemory] = useState<MemoryItem[]>([]);
  const [longTermMemory, setLongTermMemory] = useState<MemoryItem[]>([]);

  // Real system status from backend health checks
  const [systemStatus, setSystemStatus] = useState<BackendSystemStatus>({
    backendReachable: false,
    databaseReachable: false,
    models: [],
    tools: [],
    providers: {
      Gemini: { configured: false, status: 'not_configured' },
      Groq: { configured: false, status: 'not_configured' },
      OpenRouter: { configured: false, status: 'not_configured' },
    },
    memoryConnected: false,
    workingCount: 0,
    longTermCount: 0,
    healthPercent: null, // "—" when backend is not connected
    sseStatus: 'disconnected',
  });

  const [currentAction, setCurrentAction] = useState<ActionItem | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Real sync with backend /status
  const refreshBackendStatus = useCallback(async () => {
    if (!ApiClient.isConnected()) {
      setSystemStatus((prev) => ({
        ...prev,
        backendReachable: false,
        databaseReachable: false,
        models: [],
        tools: [],
        providers: {
          Gemini: { configured: false, status: 'not_configured' },
          Groq: { configured: false, status: 'not_configured' },
          OpenRouter: { configured: false, status: 'not_configured' },
        },
        memoryConnected: false,
        healthPercent: null,
      }));
      return;
    }

    try {
      const data = await ApiClient.get('/status');

      setSystemStatus((prev) => ({
        ...prev,
        backendReachable: true,
        databaseReachable: !!data.databaseReachable,
        models: data.models || [],
        tools: data.tools || [],
        providers: data.providers || {},
        memoryConnected: !!data.memory?.connected,
        workingCount: data.memory?.workingCount || 0,
        longTermCount: data.memory?.longTermCount || 0,
        healthPercent: typeof data.healthPercent === 'number' ? data.healthPercent : 25,
      }));

      eventBus.emit('health', {
        key: 'api',
        value: 'healthy',
        message: 'Backend synchronized',
      });
    } catch {
      setSystemStatus((prev) => ({
        ...prev,
        backendReachable: false,
        databaseReachable: false,
        models: [],
        tools: [],
        providers: {
          Gemini: { configured: false, status: 'not_configured' },
          Groq: { configured: false, status: 'not_configured' },
          OpenRouter: { configured: false, status: 'not_configured' },
        },
        memoryConnected: false,
        workingCount: 0,
        longTermCount: 0,
        healthPercent: null,
      }));
    }
  }, []);

  // Server-Sent Events (SSE) connection with auto-reconnect and exponential backoff
  useEffect(() => {
    let isMounted = true;

    const connectSSE = () => {
      if (!ApiClient.isConnected()) {
        setSystemStatus((prev) => ({ ...prev, sseStatus: 'disconnected' }));
        return;
      }

      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }

      const backendUrl = ApiClient.getBackendUrl();
      const token = ApiClient.getAccessToken();
      const sseUrl = `${backendUrl}/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;

      try {
        const es = new EventSource(sseUrl);
        sseRef.current = es;

        es.onopen = () => {
          if (!isMounted) return;
          reconnectAttemptsRef.current = 0;
          setSystemStatus((prev) => ({ ...prev, sseStatus: 'connected' }));
          eventBus.emit('log', { text: '[SSE] Real-time event stream connected.', level: 'info' });
        };

        // Listen for specific typed SSE events from backend:
        // state, log, provider, tool, task, memory, health, message
        es.addEventListener('state', (e) => {
          try {
            const data = JSON.parse(e.data);
            eventBus.emit('state', data);
          } catch {}
        });

        es.addEventListener('log', (e) => {
          try {
            const data = JSON.parse(e.data);
            eventBus.emit('log', data);
          } catch {}
        });

        es.addEventListener('provider', (e) => {
          try {
            const data = JSON.parse(e.data);
            eventBus.emit('provider', data);
          } catch {}
        });

        es.addEventListener('tool', (e) => {
          try {
            const data = JSON.parse(e.data);
            eventBus.emit('tool', data);
          } catch {}
        });

        es.addEventListener('task', (e) => {
          try {
            const data = JSON.parse(e.data);
            eventBus.emit('task', data);
          } catch {}
        });

        es.addEventListener('memory', (e) => {
          try {
            const data = JSON.parse(e.data);
            eventBus.emit('memory', data);
          } catch {}
        });

        es.addEventListener('health', (e) => {
          try {
            const data = JSON.parse(e.data);
            eventBus.emit('health', data);
          } catch {}
        });

        es.addEventListener('message', (e) => {
          try {
            const data = JSON.parse(e.data);
            eventBus.emit('message', data);
          } catch {}
        });

        es.onerror = () => {
          if (!isMounted) return;
          setSystemStatus((prev) => ({ ...prev, sseStatus: 'reconnecting' }));
          es.close();
          sseRef.current = null;

          // Exponential backoff reconnect
          const backoff = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(connectSSE, backoff);
        };
      } catch {
        setSystemStatus((prev) => ({ ...prev, sseStatus: 'reconnecting' }));
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (sseRef.current) {
        sseRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Poll backend health real data once on mount and every 30s
  useEffect(() => {
    refreshBackendStatus();
    const interval = setInterval(refreshBackendStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshBackendStatus]);

  // Event bus subscriptions
  useEffect(() => {
    let idCounter = 0;

    const unsubState = eventBus.on('state', (payload) => {
      setOrbState(payload.state);
      setOrbMessage(payload.message || '');
      if (payload.detail !== undefined) {
        setReasoningLine(payload.detail);
      } else if (payload.state === 'idle') {
        setReasoningLine('');
      }

      if (payload.provider) {
        setActiveProviderUsage({
          name: payload.provider,
          latencyMs: payload.latencyMs,
          active: true,
        });
      } else if (payload.state === 'idle' || payload.state === 'completed' || payload.state === 'error') {
        setTimeout(() => {
          setActiveProviderUsage(null);
        }, 1200);
      }
    });

    const unsubActivity = eventBus.on('activity', (payload) => {
      setActivityChips((prev) => {
        const existing = prev.find((c) => c.id === payload.id);
        if (payload.active) {
          if (existing) {
            return prev.map((c) =>
              c.id === payload.id ? { ...c, label: payload.label, active: true } : c
            );
          }
          return [...prev, { id: payload.id, label: payload.label, active: true, timestamp: Date.now() }];
        } else {
          return prev.map((c) => (c.id === payload.id ? { ...c, active: false } : c));
        }
      });

      if (!payload.active) {
        setTimeout(() => {
          setActivityChips((prev) => prev.filter((c) => c.id !== payload.id));
        }, 450);
      }
    });

    const unsubTool = eventBus.on('tool', (payload) => {
      const chipId = `tool-${payload.name}`;
      if (payload.status === 'calling' || payload.status === 'running') {
        setActivityChips((prev) => {
          const filtered = prev.filter((c) => c.id !== chipId);
          return [
            ...filtered,
            { id: chipId, label: payload.detail || `Tool [${payload.name}]`, active: true, timestamp: Date.now() },
          ];
        });
      } else {
        setActivityChips((prev) => prev.map((c) => (c.id === chipId ? { ...c, active: false } : c)));
        setTimeout(() => {
          setActivityChips((prev) => prev.filter((c) => c.id !== chipId));
        }, 450);
      }
    });

    const unsubProvider = eventBus.on('provider', (payload) => {
      if (payload.status === 'busy' || payload.status === 'active') {
        setActiveProviderUsage({
          name: payload.name,
          latencyMs: payload.latencyMs ?? undefined,
          active: true,
        });
      } else {
        setActiveProviderUsage((prev) =>
          prev && prev.name === payload.name
            ? { ...prev, latencyMs: payload.latencyMs ?? prev.latencyMs, active: false }
            : prev
        );
        setTimeout(() => {
          setActiveProviderUsage(null);
        }, 1500);
      }
    });

    const unsubLog = eventBus.on('log', (payload) => {
      idCounter += 1;
      const newLog: LogItem = {
        id: payload.id || `log-${Date.now()}-${idCounter}`,
        text: payload.text,
        level: payload.level || 'info',
        timestamp: payload.timestamp || Date.now(),
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 99)]);
    });

    const unsubMessage = eventBus.on('message', (payload) => {
      idCounter += 1;
      const newMsg: ChatMessage = {
        id: payload.id || `msg-${Date.now()}-${idCounter}`,
        role: payload.role,
        text: payload.text,
        timestamp: payload.timestamp || Date.now(),
      };
      setMessages((prev) => [...prev, newMsg]);
    });

    const unsubTask = eventBus.on('task', (payload) => {
      setActiveTask({
        title: payload.title,
        steps: payload.steps,
        progress: payload.progress,
        active: payload.progress < 100,
      });
    });

    const unsubMemory = (payload: any) => {
      if (payload.item) {
        if (payload.layer === 'long-term') {
          setLongTermMemory((prev) => [payload.item, ...prev]);
        } else {
          setWorkingMemory((prev) => [payload.item, ...prev]);
        }
      }
    };
    const unsubMem = eventBus.on('memory', unsubMemory);

    const unsubAction = eventBus.on('action', (payload) => {
      setCurrentAction(payload);
    });

    return () => {
      unsubState();
      unsubActivity();
      unsubTool();
      unsubProvider();
      unsubLog();
      unsubMessage();
      unsubTask();
      unsubMem();
      unsubAction();
    };
  }, []);

  return {
    orbState,
    orbMessage,
    reasoningLine,
    activityChips,
    activeProviderUsage,
    logs,
    messages,
    activeTask,
    workingMemory,
    longTermMemory,
    systemStatus,
    currentAction,
    setCurrentAction,
    refreshBackendStatus,
  };
}
