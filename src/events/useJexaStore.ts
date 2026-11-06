import { useState, useEffect, useCallback } from 'react';
import {
  eventBus,
  OrbState,
  LogLevel,
  TaskStep,
  MemoryItem,
  ActionItem,
} from './eventBus';

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
  tools: { id: string; name: string; description: string }[];
  providers: Record<string, { configured: boolean; status: 'connected' | 'not_configured' | 'error'; latencyMs?: number }>;
  memoryConnected: boolean;
  workingCount: number;
  longTermCount: number;
  healthPercent: number | null; // null if backend not reachable
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

  // 1. Live activity starts EMPTY - only real events from the event bus appear!
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
      Supabase: { configured: false, status: 'not_configured' },
      'Upstash Redis': { configured: false, status: 'not_configured' },
      'Backend server': { configured: false, status: 'not_configured' },
    },
    memoryConnected: false,
    workingCount: 0,
    longTermCount: 0,
    healthPercent: null, // Shows "—" when backend is not connected
  });

  // Actions requiring confirmation or mobile app
  const [currentAction, setCurrentAction] = useState<ActionItem | null>(null);

  // Real sync with configured backend URL
  const refreshBackendStatus = useCallback(async () => {
    const backendUrl = localStorage.getItem('jexa_backend_url') || (typeof window !== 'undefined' ? window.location.origin : '');
    const accessToken = localStorage.getItem('jexa_access_token') || '';

    if (!backendUrl) {
      setSystemStatus((prev) => ({
        ...prev,
        backendReachable: false,
        databaseReachable: false,
        models: [],
        tools: [],
        memoryConnected: false,
        healthPercent: null,
      }));
      return;
    }

    try {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch(`${backendUrl}/api/system/status`, {
        headers,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // Calculate health percent strictly from real checks:
      // 1. backend reachable (25%)
      // 2. database reachable (25%)
      // 3. at least one AI provider connected (25%)
      // 4. tools registered (25%)
      let score = 0;
      if (data.backendReachable) score += 25;
      if (data.databaseReachable) score += 25;
      if (data.models && data.models.length > 0) score += 25;
      if (data.tools && data.tools.length > 0) score += 25;

      setSystemStatus({
        backendReachable: true,
        databaseReachable: !!data.databaseReachable,
        models: data.models || [],
        tools: data.tools || [],
        providers: data.providers || {},
        memoryConnected: !!data.memory?.connected,
        workingCount: data.memory?.workingCount || 0,
        longTermCount: data.memory?.longTermCount || 0,
        healthPercent: score,
      });

      eventBus.emit('health', {
        key: 'api',
        value: data.backendReachable ? 'healthy' : 'offline',
        message: 'Backend synchronized',
      });
    } catch {
      setSystemStatus({
        backendReachable: false,
        databaseReachable: false,
        models: [],
        tools: [],
        providers: {
          Gemini: { configured: false, status: 'not_configured' },
          Groq: { configured: false, status: 'not_configured' },
          OpenRouter: { configured: false, status: 'not_configured' },
          Supabase: { configured: false, status: 'not_configured' },
          'Upstash Redis': { configured: false, status: 'not_configured' },
          'Backend server': { configured: false, status: 'not_configured' },
        },
        memoryConnected: false,
        workingCount: 0,
        longTermCount: 0,
        healthPercent: null, // "—" when backend not connected
      });
    }
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
          // Fade out chip
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
      if (payload.status === 'calling') {
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
      if (payload.status === 'busy') {
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
