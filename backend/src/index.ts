import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { sseManager } from './events/sseManager.js';
import { agentOrchestrator } from './orchestrator/agentOrchestrator.js';
import { toolRegistry } from './tools/toolRegistry.js';
import { permissionEngine } from './permissions/permissionEngine.js';
import { circuitBreaker } from './models/circuitBreaker.js';
import { tokenTracker } from './models/tokenTracker.js';
import { contextManager } from './context/contextManager.js';
import { supabaseMemory } from './memory/supabaseMemory.js';

// Cache for provider real health check to avoid spamming upstream APIs (60s cache)
interface ProviderPingCache {
  status: 'connected' | 'not_configured' | 'error';
  latencyMs?: number;
  lastChecked: number;
  error?: string;
}
const providerPingCache = new Map<string, ProviderPingCache>();

export async function checkProviderLive(name: string): Promise<ProviderPingCache> {
  const cached = providerPingCache.get(name);
  const now = Date.now();
  if (cached && now - cached.lastChecked < 60000) {
    return cached;
  }

  const startTime = Date.now();

  try {
    if (name === 'Gemini') {
      if (!config.geminiApiKey) {
        const res: ProviderPingCache = { status: 'not_configured', lastChecked: now };
        providerPingCache.set(name, res);
        return res;
      }
      const ai = new GoogleGenAI({
        apiKey: config.geminiApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      // Real check: lightweight model metadata check
      await ai.models.get({ model: config.geminiModel || 'gemini-2.0-flash' });
      const latencyMs = Date.now() - startTime;
      const res: ProviderPingCache = { status: 'connected', latencyMs, lastChecked: now };
      providerPingCache.set(name, res);
      return res;
    }

    if (name === 'Groq') {
      if (!config.groqApiKey) {
        const res: ProviderPingCache = { status: 'not_configured', lastChecked: now };
        providerPingCache.set(name, res);
        return res;
      }
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${config.groqApiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - startTime;
      if (!resp.ok) {
        const res: ProviderPingCache = { status: 'error', latencyMs, lastChecked: now, error: `HTTP ${resp.status}` };
        providerPingCache.set(name, res);
        return res;
      }
      const res: ProviderPingCache = { status: 'connected', latencyMs, lastChecked: now };
      providerPingCache.set(name, res);
      return res;
    }

    if (name === 'OpenRouter') {
      if (!config.openRouterApiKey) {
        const res: ProviderPingCache = { status: 'not_configured', lastChecked: now };
        providerPingCache.set(name, res);
        return res;
      }
      const resp = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${config.openRouterApiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - startTime;
      if (!resp.ok) {
        const res: ProviderPingCache = { status: 'error', latencyMs, lastChecked: now, error: `HTTP ${resp.status}` };
        providerPingCache.set(name, res);
        return res;
      }
      const res: ProviderPingCache = { status: 'connected', latencyMs, lastChecked: now };
      providerPingCache.set(name, res);
      return res;
    }

    return { status: 'not_configured', lastChecked: now };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const res: ProviderPingCache = {
      status: 'error',
      latencyMs,
      lastChecked: now,
      error: err.message || 'Connection failed',
    };
    providerPingCache.set(name, res);
    return res;
  }
}

/**
 * Creates and configures the Express application
 */
export function createApp() {
  // In production, server must refuse to start without ACCESS_TOKEN configured
  if (config.nodeEnv === 'production' && !config.accessToken) {
    console.error('FATAL: ACCESS_TOKEN environment variable is required in production mode.');
    process.exit(1);
  }

  const app = express();

  // Trust reverse proxy (Render, Cloudflare, etc.)
  app.set('trust proxy', 1);

  // 1. CORS Configuration
  app.use((req: Request, res: Response, next: NextFunction) => {
    const originHeader = req.headers.origin;
    const rawAllowed = config.allowedOrigin || '';
    const allowedList = rawAllowed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Default origins always trusted for local development & Capacitor Android app
    const defaultOrigins = [
      'https://localhost',
      'http://localhost',
      'capacitor://localhost',
      'http://localhost:3000',
    ];

    let matchOrigin = '';
    if (originHeader) {
      if (allowedList.includes('*') && config.nodeEnv !== 'production') {
        matchOrigin = originHeader;
      } else if (allowedList.includes(originHeader) || defaultOrigins.includes(originHeader)) {
        matchOrigin = originHeader;
      }
    } else {
      matchOrigin = allowedList[0] || '*';
    }

    if (matchOrigin) {
      res.setHeader('Access-Control-Allow-Origin', matchOrigin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // 2. Body limit handling:
  // 10 KB default limit on general endpoints, 5 MB allowed on vision and document endpoints
  const defaultJsonParser = express.json({ limit: '10kb' });
  const largeJsonParser = express.json({ limit: '5mb' });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/tools/vision') || req.path.startsWith('/tools/document') || req.path.startsWith('/api/tools/vision') || req.path.startsWith('/api/tools/document')) {
      return largeJsonParser(req, res, next);
    }
    return defaultJsonParser(req, res, next);
  });

  // 3. In-Memory Rate Limiter: 30 requests per minute per IP using req.ip
  interface RateLimitRecord {
    count: number;
    resetTime: number;
  }
  const rateLimitMap = new Map<string, RateLimitRecord>();

  // Cleanup expired IP records every 5 minutes to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(ip);
      }
    }
  }, 300000);

  const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + 60000 };
      rateLimitMap.set(ip, record);
      return next();
    }

    record.count += 1;
    if (record.count > 30) {
      const retrySec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retrySec);
      return res.status(429).json({
        error: 'Rate limit exceeded: max 30 requests per minute per IP.',
        retryAfterSeconds: retrySec,
      });
    }

    next();
  };

  app.use(rateLimiter);

  // 4. Bearer-Token Auth on every route EXCEPT GET /
  // Constant-time comparison using crypto.timingSafeEqual
  const checkAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && req.path === '/') {
      return next();
    }

    if (!config.accessToken) {
      return next();
    }

    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;

    const providedToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : queryToken?.trim();

    if (!providedToken) {
      return res.status(401).json({
        error: 'Unauthorized: Missing bearer access token.',
        code: 'AUTH_REQUIRED',
      });
    }

    const a = Buffer.from(providedToken);
    const b = Buffer.from(config.accessToken);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid bearer access token.',
        code: 'AUTH_REQUIRED',
      });
    }

    next();
  };

  app.use(checkAuth);

  // ==========================================
  // ROUTES
  // ==========================================

  // 1. GET / : Public Health Ping
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      name: 'JEXA Core Agent Backend',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: Date.now(),
    });
  });

  // 2. POST /command : Run Agent Command
  app.post('/command', async (req: Request, res: Response) => {
    const { text, sessionId } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Body field "text" (string) is required.' });
    }

    try {
      const response = await agentOrchestrator.executeCommand({ text, sessionId });
      res.json(response);
    } catch (err: any) {
      res.status(502).json({
        error: err.message || 'Agent execution failed.',
      });
    }
  });

  // 3. GET /events : Server-Sent Events stream
  app.get('/events', (req: Request, res: Response) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    sseManager.addClient(clientId, res, ip);
  });

  // 4. GET /status : Real Status of Providers, Usage, Caps, Latency, and Connections
  app.get('/status', async (_req: Request, res: Response) => {
    const upstashCheck = await contextManager.pingUpstash();
    const supabaseCheck = await supabaseMemory.ping();
    const circuits = circuitBreaker.getAllStates();
    const tokens = tokenTracker.getAllToday();

    // Check live provider status
    const geminiPing = await checkProviderLive('Gemini');
    const groqPing = await checkProviderLive('Groq');
    const openRouterPing = await checkProviderLive('OpenRouter');

    const providers: Record<string, any> = {
      Groq: {
        configured: !!config.groqApiKey,
        status: groqPing.status,
        latencyMs: groqPing.latencyMs,
        model: config.groqModel || '',
        dailyRequests: circuits.Groq?.dailyRequests || 0,
        dailyCap: circuits.Groq?.dailyCap || config.dailyCapGroq,
        remainingTokens: circuits.Groq?.remainingTokens,
        tokensUsedToday: tokens.Groq?.totalTokens || 0,
        lastError: groqPing.error || circuits.Groq?.lastError,
      },
      Gemini: {
        configured: !!config.geminiApiKey,
        status: geminiPing.status,
        latencyMs: geminiPing.latencyMs,
        model: config.geminiModel || '',
        liveModel: config.geminiLiveModel || '',
        dailyRequests: circuits.Gemini?.dailyRequests || 0,
        dailyCap: circuits.Gemini?.dailyCap || config.dailyCapGemini,
        tokensUsedToday: tokens.Gemini?.totalTokens || 0,
        lastError: geminiPing.error || circuits.Gemini?.lastError,
      },
      OpenRouter: {
        configured: !!config.openRouterApiKey,
        status: openRouterPing.status,
        latencyMs: openRouterPing.latencyMs,
        model: config.openRouterModel || '',
        dailyRequests: circuits.OpenRouter?.dailyRequests || 0,
        dailyCap: circuits.OpenRouter?.dailyCap || config.dailyCapOpenRouter,
        tokensUsedToday: tokens.OpenRouter?.totalTokens || 0,
        lastError: openRouterPing.error || circuits.OpenRouter?.lastError,
      },
    };

    const databases = {
      UpstashRedis: {
        configured: contextManager.isUpstashConfigured(),
        connected: upstashCheck.connected,
        latencyMs: upstashCheck.latencyMs,
        error: upstashCheck.error,
      },
      Supabase: {
        configured: supabaseMemory.isConfigured(),
        connected: supabaseCheck.connected,
        latencyMs: supabaseCheck.latencyMs,
        error: supabaseCheck.error,
      },
    };

    const registeredTools = toolRegistry.getAll().map((t) => ({
      name: t.name,
      description: t.description,
      status: t.status,
    }));

    // Dynamic model list derived only from env / configured providers
    const models: string[] = [];
    if (config.groqApiKey && config.groqModel) models.push(`groq/${config.groqModel}`);
    if (config.geminiApiKey && config.geminiModel) models.push(`gemini/${config.geminiModel}`);
    if (config.openRouterApiKey && config.openRouterModel) models.push(`openrouter/${config.openRouterModel}`);

    // System health percent calculation based on real metrics only:
    // 1. backend reachable (25%)
    // 2. database reachable (25%)
    // 3. at least one AI provider connected (25%)
    // 4. tools registered (25%)
    let healthScore = 25; // Backend is reachable since this handler executed
    if (upstashCheck.connected || supabaseCheck.connected) healthScore += 25;
    if (geminiPing.status === 'connected' || groqPing.status === 'connected' || openRouterPing.status === 'connected') healthScore += 25;
    if (registeredTools.length > 0) healthScore += 25;

    res.json({
      status: 'ok',
      backend: 'JEXA Autonomous Agent',
      backendReachable: true,
      databaseReachable: upstashCheck.connected || supabaseCheck.connected,
      healthPercent: healthScore,
      models,
      providers,
      databases,
      tools: registeredTools,
      memory: {
        workingCount: 0,
        longTermCount: 0,
        connected: upstashCheck.connected || supabaseCheck.connected,
      },
      activeSSEClients: sseManager.getConnectedClientsCount(),
      timestamp: Date.now(),
    });
  });

  // 5. GET /tools : Registered Tools with Real Status
  app.get('/tools', (_req: Request, res: Response) => {
    const tools = toolRegistry.getAll().map((t) => ({
      name: t.name,
      description: t.description,
      status: t.status,
      inputSchema: t.inputSchema,
    }));
    res.json({ tools });
  });

  // 6. POST /confirm/:id : Approve or Deny Pending Action
  app.post('/confirm/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { approve = true } = req.body;
    const result = permissionEngine.confirm(id, Boolean(approve));

    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  });

  // 7. POST /live-token : Ephemeral Token for Gemini Live API
  app.post('/live-token', async (_req: Request, res: Response) => {
    if (!config.geminiApiKey) {
      return res.status(503).json({
        error: 'Gemini is not configured on the backend server. Set GEMINI_API_KEY in environment variables.',
        configured: false,
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: config.geminiApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      // Call ai.authTokens.create to mint a real ephemeral token for the client
      // Uses the new SDK authToken creation capability
      let ephemeralToken = '';
      try {
        if ((ai as any).authTokens && typeof (ai as any).authTokens.create === 'function') {
          const authRes = await (ai as any).authTokens.create({
            config: {
              ttl: '1800s', // 30 minutes
            },
          });
          ephemeralToken = authRes.name || authRes.token || '';
        }
      } catch (tokenErr) {
        console.warn('[live-token] AuthToken creation fallback:', tokenErr);
      }

      res.json({
        token: ephemeralToken || undefined,
        model: config.geminiLiveModel || 'gemini-3.8-live',
        availableVoices: ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'],
        configured: true,
        expiresInSeconds: 1800,
      });
    } catch (err: any) {
      res.status(500).json({
        error: `Failed to issue ephemeral live token: ${err.message}`,
        configured: true,
      });
    }
  });

  // 8. Tool execution routes (for direct tool invocation)
  app.post('/tools/vision', async (req: Request, res: Response) => {
    const result = await toolRegistry.execute('vision_describe', req.body);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  });

  app.post('/tools/document', async (req: Request, res: Response) => {
    const result = await toolRegistry.execute('document_reader', req.body);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  });

  app.post('/tools/search', async (req: Request, res: Response) => {
    const result = await toolRegistry.execute('web_search', req.body);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  });

  app.post('/tools/browse', async (req: Request, res: Response) => {
    const result = await toolRegistry.execute('browser_agent', req.body);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  });

  app.post('/tools/github', async (req: Request, res: Response) => {
    const result = await toolRegistry.execute('github_read', req.body);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  });

  // 9. Global Error Handler (Sanitizes errors, never leaks raw stack traces)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Global Error Catch]:', err.message || err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error occurred.',
    });
  });

  return app;
}

// Start Server when run directly
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js')) &&
  !process.argv[1].includes('test');

if (isDirectRun) {
  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`JEXA Backend running on http://0.0.0.0:${config.port} (env: ${config.nodeEnv})`);
  });
}
