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
  mode?: 'auto' | 'manual' | 'task';
  targetModel?: string; // e.g. "groq/llama-3.3-70b-versatile" or "gemini/gemini-3.8-flash"
  modelName?: string;
  preset?: 'eco' | 'balanced' | 'max';
  task?: 'chat' | 'reasoning' | 'research' | 'vision' | 'voice';
  allowFallback?: boolean;
}

export interface ModelResponse {
  reply: string;
  provider: string;
  model: string;
  latencyMs: number;
  autoReason?: string;
  tokensUsed?: { prompt: number; completion: number; total: number };
}

export class ModelGateway {
  constructor() {
    circuitBreaker.setDailyCap('Groq', config.dailyCapGroq);
    circuitBreaker.setDailyCap('Gemini', config.dailyCapGemini);
    circuitBreaker.setDailyCap('OpenRouter', config.dailyCapOpenRouter);
  }

  /**
   * Main completion method that respects Auto / Manual / Preset / Task modes
   */
  public async complete(prompt: string, options?: ModelRequestOptions): Promise<ModelResponse> {
    const mode = options?.mode || 'auto';
    let autoReason = '';

    // 1. Manual Mode
    if (mode === 'manual' && options?.targetModel) {
      const { provider, modelName } = this.parseModelString(options.targetModel);
      if (this.isProviderConfigured(provider)) {
        const check = circuitBreaker.canExecute(provider);
        if (check.allowed) {
          try {
            const startTime = Date.now();
            const res = await this.callProvider(provider, prompt, { ...options, modelName });
            const latencyMs = Date.now() - startTime;
            if (res.tokensUsed) {
              tokenTracker.recordUsage(provider, res.tokensUsed.prompt, res.tokensUsed.completion);
            }
            return { ...res, autoReason: `Manual: ${provider} (${modelName})` };
          } catch (err: any) {
            if (options.allowFallback === false) {
              throw new Error(`Manual model ${options.targetModel} failed: ${err.message}`);
            }
            sseManager.emit('log', {
              text: `[Model Gateway] Manual model ${options.targetModel} failed: ${err.message}. Engaging fallback chain...`,
              level: 'warn',
            });
          }
        }
      }
    }

    // 2. Determine Strategy & Chain
    let providerChain = ['Groq', 'Gemini', 'OpenRouter'];
    let overrideModel: string | undefined = undefined;

    if (options?.preset === 'eco') {
      // Eco preset: Pick fastest/lightest available
      if (this.isProviderConfigured('Groq') && circuitBreaker.canExecute('Groq').allowed) {
        providerChain = ['Groq', 'Gemini', 'OpenRouter'];
        autoReason = 'Preset (Eco): using Groq for low latency and zero token cost';
      } else {
        providerChain = ['Gemini', 'Groq', 'OpenRouter'];
        overrideModel = 'gemini-3.5-flash-lite';
        autoReason = 'Preset (Eco): using Gemini 3.5 Flash-Lite to conserve quota';
      }
    } else if (options?.preset === 'max') {
      // Max quality preset: Strongest multimodal reasoning
      if (this.isProviderConfigured('Gemini') && circuitBreaker.canExecute('Gemini').allowed) {
        providerChain = ['Gemini', 'OpenRouter', 'Groq'];
        overrideModel = 'gemini-3.8-flash';
        autoReason = 'Preset (Max): using Gemini 3.8 Flash for maximum reasoning depth';
      } else if (this.isProviderConfigured('OpenRouter')) {
        providerChain = ['OpenRouter', 'Gemini', 'Groq'];
        autoReason = 'Preset (Max): using OpenRouter flagship model';
      }
    } else if (mode === 'auto') {
      // Auto mode: Rules-based selection (0 tokens)
      const promptLower = prompt.toLowerCase();
      const isResearch =
        options?.chain === 'research' ||
        promptLower.includes('search') ||
        promptLower.includes('latest') ||
        promptLower.includes('research') ||
        promptLower.includes('investigate') ||
        promptLower.includes('sources');

      const isReasoning =
        promptLower.includes('why') ||
        promptLower.includes('explain') ||
        promptLower.includes('plan') ||
        promptLower.includes('analyze') ||
        promptLower.includes('code');

      const geminiCheck = circuitBreaker.canExecute('Gemini');
      const groqCheck = circuitBreaker.canExecute('Groq');

      if (isResearch && this.isProviderConfigured('Gemini') && geminiCheck.allowed) {
        providerChain = ['Gemini', 'Groq', 'OpenRouter'];
        overrideModel = 'gemini-3.8-flash';
        autoReason = 'Auto: research task, using Gemini 3.8 Flash for multimodal grounding';
      } else if (isReasoning && this.isProviderConfigured('Gemini') && geminiCheck.allowed) {
        providerChain = ['Gemini', 'Groq', 'OpenRouter'];
        overrideModel = 'gemini-3.8-flash';
        autoReason = 'Auto: reasoning directive, using Gemini 3.8 Flash';
      } else if (this.isProviderConfigured('Groq') && groqCheck.allowed) {
        providerChain = ['Groq', 'Gemini', 'OpenRouter'];
        autoReason = `Auto: conversational query, using Groq (${config.groqModel || 'llama-3.3-70b'}) for sub-300ms speed`;
      } else if (this.isProviderConfigured('Gemini') && geminiCheck.allowed) {
        providerChain = ['Gemini', 'OpenRouter', 'Groq'];
        overrideModel = 'gemini-3.5-flash-lite';
        autoReason = 'Auto: using Gemini 3.5 Flash-Lite';
      } else {
        autoReason = 'Auto: fallback routing active';
      }

      // Check if primary is low on quota / tripped
      if (!geminiCheck.allowed && this.isProviderConfigured('Gemini')) {
        autoReason = `Auto: Gemini rate limit/circuit open (${geminiCheck.reason}), switching to backup provider`;
      } else if (!groqCheck.allowed && this.isProviderConfigured('Groq')) {
        autoReason = `Auto: Groq rate limit/circuit open (${groqCheck.reason}), switching to backup provider`;
      }
    }

    if (autoReason) {
      sseManager.emit('activity', {
        id: 'auto-model',
        label: autoReason,
        active: true,
      });
      sseManager.emit('log', {
        text: `[Model Mode] ${autoReason}`,
        level: 'info',
      });
    }

    // 3. Fallback Chain Execution
    let lastError = 'No providers configured';

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
        const response = await this.callProvider(provider, prompt, {
          ...options,
          modelName: overrideModel || options?.modelName,
        });
        const latencyMs = Date.now() - startTime;

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

        return {
          ...response,
          autoReason: autoReason || undefined,
        };
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

  /**
   * Directly call a specific provider/model without fallback (for Compare feature)
   */
  public async callSpecificModel(
    modelString: string,
    prompt: string,
    options?: ModelRequestOptions
  ): Promise<ModelResponse> {
    const { provider, modelName } = this.parseModelString(modelString);
    if (!this.isProviderConfigured(provider)) {
      throw new Error(`Provider ${provider} is not configured with an API key.`);
    }
    return this.callProvider(provider, prompt, { ...options, modelName });
  }

  private parseModelString(modelStr: string): { provider: string; modelName: string } {
    if (modelStr.includes('/')) {
      const parts = modelStr.split('/');
      const prov = parts[0].toLowerCase();
      const modelName = parts.slice(1).join('/');
      if (prov === 'groq') return { provider: 'Groq', modelName };
      if (prov === 'gemini') return { provider: 'Gemini', modelName };
      if (prov === 'openrouter') return { provider: 'OpenRouter', modelName };
    }

    if (modelStr.startsWith('gemini')) return { provider: 'Gemini', modelName: modelStr };
    if (modelStr.startsWith('llama') || modelStr.startsWith('mixtral')) return { provider: 'Groq', modelName: modelStr };
    return { provider: 'Gemini', modelName: modelStr };
  }

  public isProviderConfigured(provider: string): boolean {
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
    const timeoutMs = 15000;

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
    const model = options?.modelName || config.groqModel || 'llama-3.3-70b-versatile';
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
    const model = options?.modelName || config.geminiModel || 'gemini-3.8-flash';
    const startTime = Date.now();

    const ai = new GoogleGenAI({
      apiKey: config.geminiApiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
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
    const model = options?.modelName || config.openRouterModel || 'anthropic/claude-3.5-haiku';
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
