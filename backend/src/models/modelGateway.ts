import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { circuitBreaker } from './circuitBreaker.js';
import { tokenTracker } from './tokenTracker.js';
import { sseManager } from '../events/sseManager.js';

export interface ModelRequestOptions {
  systemPrompt?: string;
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  tools?: Array<{ name: string; description: string; inputSchema: any }>;
  chain?: 'chat' | 'research';
}

export interface ModelResponse {
  reply: string;
  provider: string;
  model: string;
  latencyMs: number;
  tokensUsed?: { prompt: number; completion: number; total: number };
}

export class ModelGateway {
  constructor() {
    // Sync daily caps from env
    circuitBreaker.setDailyCap('Groq', config.dailyCapGroq);
    circuitBreaker.setDailyCap('Gemini', config.dailyCapGemini);
    circuitBreaker.setDailyCap('OpenRouter', config.dailyCapOpenRouter);
  }

  /**
   * Main completion method that iterates through the provider fallback chain with 15s timeout
   */
  public async complete(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse> {
    const chainType = options?.chain || 'chat';
    // Fallback chains specified in requirements:
    // chat = Groq, Gemini, OpenRouter
    // research = Gemini, Groq, OpenRouter
    const providerChain =
      chainType === 'research'
        ? ['Gemini', 'Groq', 'OpenRouter']
        : ['Groq', 'Gemini', 'OpenRouter'];

    let lastError: string = 'No providers configured';

    for (const provider of providerChain) {
      const check = circuitBreaker.canExecute(provider);
      if (!check.allowed) {
        sseManager.emit('log', {
          text: `[Model Gateway] Skipping ${provider}: ${check.reason}`,
          level: 'warn',
        });
        continue;
      }

      if (!this.isProviderConfigured(provider)) {
        continue;
      }

      sseManager.emit('provider', {
        name: provider,
        status: 'active',
      });

      const startTime = Date.now();

      try {
        const response = await this.callProvider(provider, prompt, options);
        const latencyMs = Date.now() - startTime;

        // Record token usage if returned
        if (response.tokensUsed) {
          tokenTracker.recordUsage(provider, response.tokensUsed.prompt, response.tokensUsed.completion);
        }

        sseManager.emit('provider', {
          name: provider,
          status: 'ready',
          latencyMs,
          used: circuitBreaker.getState(provider)?.dailyRequests || 1,
          cap: circuitBreaker.getState(provider)?.dailyCap || 1000,
        });

        return response;
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        lastError = err.message || String(err);

        sseManager.emit('provider', {
          name: provider,
          status: 'error',
          error: lastError,
          latencyMs,
        });

        sseManager.emit('log', {
          text: `[Model Gateway] ${provider} error (${latencyMs}ms): ${lastError}. Trying next in fallback chain...`,
          level: 'warn',
        });
      }
    }

    throw new Error(`All AI model providers unavailable in chain [${providerChain.join(' -> ')}]. Last error: ${lastError}`);
  }

  private isProviderConfigured(provider: string): boolean {
    if (provider === 'Groq') return !!config.groqApiKey;
    if (provider === 'Gemini') return !!config.geminiApiKey;
    if (provider === 'OpenRouter') return !!config.openRouterApiKey;
    return false;
  }

  private async callProvider(
    provider: string,
    prompt: string,
    options?: ModelRequestOptions
  ): Promise<ModelResponse> {
    const timeoutMs = 15000; // 15-second timeout per provider specification

    if (provider === 'Groq') {
      return this.callGroq(prompt, timeoutMs, options);
    }
    if (provider === 'Gemini') {
      return this.callGemini(prompt, timeoutMs, options);
    }
    if (provider === 'OpenRouter') {
      return this.callOpenRouter(prompt, timeoutMs, options);
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  // 1. Groq Provider
  private async callGroq(prompt: string, timeoutMs: number, options?: ModelRequestOptions): Promise<ModelResponse> {
    const model = config.groqModel;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    const messages = [
      ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      ...(options?.history || []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: prompt },
    ];

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.groqApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: config.maxOutputTokens || 400,
          temperature: 0.3,
        }),
      });

      clearTimeout(timeout);

      // Read rate-limit headers
      circuitBreaker.recordSuccess('Groq', res.headers);

      if (!res.ok) {
        const retryAfter = res.headers.get('retry-after');
        const retrySec = retryAfter ? parseInt(retryAfter, 10) : undefined;
        const errJson = (await res.json().catch(() => ({}))) as any;
        const errMsg = errJson?.error?.message || `Groq returned HTTP ${res.status}`;
        circuitBreaker.recordFailure('Groq', errMsg, res.status, retrySec);
        throw new Error(errMsg);
      }

      const data = (await res.json()) as any;
      const reply = data.choices?.[0]?.message?.content || 'No response from Groq.';
      const usage = data.usage;

      return {
        reply,
        provider: 'Groq',
        model,
        latencyMs: Date.now() - startTime,
        tokensUsed: usage ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens } : undefined,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        circuitBreaker.recordFailure('Groq', 'Timeout after 15s');
        throw new Error('Groq request timed out (15s limit reached)');
      }
      circuitBreaker.recordFailure('Groq', err.message);
      throw err;
    }
  }

  // 2. Gemini Provider
  private async callGemini(prompt: string, timeoutMs: number, options?: ModelRequestOptions): Promise<ModelResponse> {
    const model = config.geminiModel;
    const startTime = Date.now();

    const ai = new GoogleGenAI({
      apiKey: config.geminiApiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const contents = [
      ...(options?.history || []).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: prompt }] },
    ];

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini request timed out (15s limit reached)')), timeoutMs)
      );

      const generatePromise = ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: options?.systemPrompt || 'You are JEXA, a calm, razor-sharp personal AI command centre.',
          maxOutputTokens: config.maxOutputTokens || 400,
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      circuitBreaker.recordSuccess('Gemini');

      const reply = response.text || 'Command processed.';
      const usage = response.usageMetadata;

      return {
        reply,
        provider: 'Gemini',
        model,
        latencyMs: Date.now() - startTime,
        tokensUsed: usage ? { prompt: usage.promptTokenCount || 0, completion: usage.candidatesTokenCount || 0, total: usage.totalTokenCount || 0 } : undefined,
      };
    } catch (err: any) {
      circuitBreaker.recordFailure('Gemini', err.message);
      throw err;
    }
  }

  // 3. OpenRouter Provider
  private async callOpenRouter(prompt: string, timeoutMs: number, options?: ModelRequestOptions): Promise<ModelResponse> {
    const model = config.openRouterModel;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    const messages = [
      ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      ...(options?.history || []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: prompt },
    ];

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openRouterApiKey}`,
          'HTTP-Referer': 'https://jexa.ai',
          'X-Title': 'JEXA Command Centre',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: config.maxOutputTokens || 400,
        }),
      });

      clearTimeout(timeout);
      circuitBreaker.recordSuccess('OpenRouter', res.headers);

      if (!res.ok) {
        const retryAfter = res.headers.get('retry-after');
        const retrySec = retryAfter ? parseInt(retryAfter, 10) : undefined;
        const errJson = (await res.json().catch(() => ({}))) as any;
        const errMsg = errJson?.error?.message || `OpenRouter returned HTTP ${res.status}`;
        circuitBreaker.recordFailure('OpenRouter', errMsg, res.status, retrySec);
        throw new Error(errMsg);
      }

      const data = (await res.json()) as any;
      const reply = data.choices?.[0]?.message?.content || 'No response from OpenRouter.';
      const usage = data.usage;

      return {
        reply,
        provider: 'OpenRouter',
        model,
        latencyMs: Date.now() - startTime,
        tokensUsed: usage ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens } : undefined,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        circuitBreaker.recordFailure('OpenRouter', 'Timeout after 15s');
        throw new Error('OpenRouter request timed out (15s limit reached)');
      }
      circuitBreaker.recordFailure('OpenRouter', err.message);
      throw err;
    }
  }
}

export const modelGateway = new ModelGateway();
