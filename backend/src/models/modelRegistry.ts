import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

export interface DiscoveredModel {
  id: string; // e.g. "gemini/gemini-3.8-flash" or "groq/llama-3.3-70b-versatile"
  rawId: string; // e.g. "gemini-3.8-flash"
  provider: 'Gemini' | 'Groq' | 'OpenRouter';
  displayName: string;
  description: string;
  recommended: boolean;
  deprecated: boolean;
  supportedTasks: Array<'chat' | 'reasoning' | 'research' | 'vision' | 'voice'>;
  contextWindow?: number;
}

export interface ModelDiscoveryResult {
  models: DiscoveredModel[];
  chatModels: DiscoveredModel[];
  reasoningModels: DiscoveredModel[];
  researchModels: DiscoveredModel[];
  visionModels: DiscoveredModel[];
  voiceModels: DiscoveredModel[];
  configuredProviders: {
    Gemini: boolean;
    Groq: boolean;
    OpenRouter: boolean;
  };
  cachedAt: number;
}

// 10-minute in-memory cache
let cachedResult: ModelDiscoveryResult | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function discoverAllModels(forceRefresh = false): Promise<ModelDiscoveryResult> {
  const now = Date.now();
  if (!forceRefresh && cachedResult && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedResult;
  }

  const allModels: DiscoveredModel[] = [];

  // 1. Discover Gemini Models (Only if GEMINI_API_KEY is configured)
  if (config.geminiApiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: config.geminiApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const pager = await ai.models.list();
      for await (const m of pager) {
        const rawName = m.name || '';
        const rawId = rawName.replace(/^models\//, '');
        const desc = (m.description || '').toLowerCase();
        const actions = (m.supportedActions as string[]) || [];

        // Exclude internal testing or non-conversational models
        if (rawId.includes('embed') || rawId.includes('lyria') || rawId.includes('robotics')) {
          continue;
        }

        const isDeprecated =
          rawId.startsWith('gemini-1.5') ||
          rawId.startsWith('gemini-2.0') ||
          rawId.includes('deprecated') ||
          desc.includes('deprecat');

        const isRecommended =
          rawId === 'gemini-3.8-flash' ||
          rawId === 'gemini-3.5-flash-lite' ||
          rawId === 'gemini-3.8-live' ||
          rawId === 'gemini-3.1-flash-live-preview';

        const tasks: Array<'chat' | 'reasoning' | 'research' | 'vision' | 'voice'> = [];
        if (actions.includes('generateContent') || rawId.includes('flash') || rawId.includes('pro')) {
          tasks.push('chat');
          tasks.push('reasoning');
          tasks.push('research');
          tasks.push('vision');
        }
        if (actions.includes('bidiGenerateContent') || rawId.includes('live')) {
          tasks.push('voice');
        }

        allModels.push({
          id: `gemini/${rawId}`,
          rawId,
          provider: 'Gemini',
          displayName: m.displayName || `Gemini ${rawId}`,
          description: m.description || 'Google Gemini multimodal intelligence model',
          recommended: isRecommended,
          deprecated: isDeprecated,
          supportedTasks: tasks,
          contextWindow: (m as any).inputTokenLimit || 1048576,
        });
      }
    } catch (err: any) {
      console.warn('[modelRegistry] Gemini discovery error:', err.message);
    }
  }

  // 2. Discover Groq Models (Only if GROQ_API_KEY is configured)
  if (config.groqApiKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${config.groqApiKey}` },
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const list = data?.data || [];
        for (const m of list) {
          const rawId = m.id;
          if (!rawId || m.active === false) continue;

          // Exclude whisper/audio transcribe or guard models from general chat pickers
          if (rawId.includes('whisper') || rawId.includes('guard')) continue;

          const isDeprecated = rawId.includes('llama-2') || rawId.includes('deprecated');
          const isRecommended = rawId.includes('llama-3.3-70b') || rawId.includes('llama-3.1-8b');

          const tasks: Array<'chat' | 'reasoning' | 'research' | 'vision' | 'voice'> = ['chat'];
          if (rawId.includes('70b') || rawId.includes('mixtral')) {
            tasks.push('reasoning');
            tasks.push('research');
          }
          if (rawId.includes('vision') || rawId.includes('llava')) {
            tasks.push('vision');
          }

          allModels.push({
            id: `groq/${rawId}`,
            rawId,
            provider: 'Groq',
            displayName: `Groq / ${rawId}`,
            description: `Ultra low-latency LPU model (${m.context_window || 8192} context)`,
            recommended: isRecommended,
            deprecated: isDeprecated,
            supportedTasks: tasks,
            contextWindow: m.context_window,
          });
        }
      }
    } catch (err: any) {
      console.warn('[modelRegistry] Groq discovery error:', err.message);
    }
  }

  // 3. Discover OpenRouter Models (Only if OPENROUTER_API_KEY is configured)
  if (config.openRouterApiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${config.openRouterApiKey}` },
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const list = (data?.data || []).slice(0, 50); // Top models to keep payload lean
        for (const m of list) {
          const rawId = m.id;
          if (!rawId) continue;

          const isDeprecated = (m.description || '').toLowerCase().includes('deprecat');
          const isRecommended = rawId.includes('claude-3.5') || rawId.includes('gpt-4o') || rawId.includes('deepseek');

          const tasks: Array<'chat' | 'reasoning' | 'research' | 'vision' | 'voice'> = ['chat', 'reasoning', 'research'];
          if (rawId.includes('vision') || rawId.includes('claude') || rawId.includes('gpt-4')) {
            tasks.push('vision');
          }

          allModels.push({
            id: `openrouter/${rawId}`,
            rawId,
            provider: 'OpenRouter',
            displayName: m.name || rawId,
            description: m.description || 'OpenRouter unified model endpoint',
            recommended: isRecommended,
            deprecated: isDeprecated,
            supportedTasks: tasks,
            contextWindow: m.context_length,
          });
        }
      }
    } catch (err: any) {
      console.warn('[modelRegistry] OpenRouter discovery error:', err.message);
    }
  }

  // Categorize for convenient frontend task selection
  const chatModels = allModels.filter((m) => m.supportedTasks.includes('chat'));
  const reasoningModels = allModels.filter((m) => m.supportedTasks.includes('reasoning'));
  const researchModels = allModels.filter((m) => m.supportedTasks.includes('research'));
  const visionModels = allModels.filter((m) => m.supportedTasks.includes('vision'));
  const voiceModels = allModels.filter((m) => m.supportedTasks.includes('voice'));

  cachedResult = {
    models: allModels,
    chatModels,
    reasoningModels,
    researchModels,
    visionModels,
    voiceModels,
    configuredProviders: {
      Gemini: Boolean(config.geminiApiKey),
      Groq: Boolean(config.groqApiKey),
      OpenRouter: Boolean(config.openRouterApiKey),
    },
    cachedAt: now,
  };
  lastFetchTime = now;

  return cachedResult;
}
