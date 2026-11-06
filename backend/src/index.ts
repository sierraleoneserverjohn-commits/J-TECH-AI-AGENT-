import express, { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { sseManager } from './events/sseManager.js';
import { agentOrchestrator } from './orchestrator/agentOrchestrator.js';
import { toolRegistry } from './tools/toolRegistry.js';
import { permissionEngine } from './permissions/permissionEngine.js';
import { circuitBreaker } from './models/circuitBreaker.js';
import { tokenTracker } from './models/tokenTracker.js';
import { contextManager } from './context/contextManager.js';
import { supabaseMemory } from './memory/supabaseMemory.js';

const app = express();

// 1. CORS Configuration (Native, lightweight, zero dependencies)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = config.allowedOrigin === '*' ? '*' : config.allowedOrigin;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 2. Strict JSON body limit of 10 KB per specification
app.use(express.json({ limit: '10kb' }));

// 3. In-Memory Rate Limiter: 30 requests per minute per IP
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
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
const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  // Public health check exception
  if (req.method === 'GET' && req.path === '/') {
    return next();
  }

  // If no ACCESS_TOKEN configured, pass through (open mode for initial setup)
  if (!config.accessToken) {
    return next();
  }

  // Check Authorization header or query parameter ?token= (essential for SSE browser connections)
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  const providedToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : queryToken?.trim();

  if (!providedToken || providedToken !== config.accessToken) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing bearer access token.',
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
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  sseManager.addClient(clientId, res, ip);
});

// 4. GET /status : Real Status of Providers, Usage, Caps, Latency, and Connections
app.get('/status', async (_req: Request, res: Response) => {
  const upstashCheck = await contextManager.pingUpstash();
  const supabaseCheck = await supabaseMemory.ping();
  const circuits = circuitBreaker.getAllStates();
  const tokens = tokenTracker.getAllToday();

  // Honest statuses: if not configured, show "not configured". Never fake!
  const providers: Record<string, any> = {
    Groq: {
      configured: !!config.groqApiKey,
      status: !config.groqApiKey ? 'not_configured' : circuits.Groq?.failures > 2 ? 'error' : 'connected',
      model: config.groqModel,
      dailyRequests: circuits.Groq?.dailyRequests || 0,
      dailyCap: circuits.Groq?.dailyCap || config.dailyCapGroq,
      remainingTokens: circuits.Groq?.remainingTokens,
      tokensUsedToday: tokens.Groq?.totalTokens || 0,
      lastError: circuits.Groq?.lastError,
    },
    Gemini: {
      configured: !!config.geminiApiKey,
      status: !config.geminiApiKey ? 'not_configured' : circuits.Gemini?.failures > 2 ? 'error' : 'connected',
      model: config.geminiModel,
      liveModel: config.geminiLiveModel,
      dailyRequests: circuits.Gemini?.dailyRequests || 0,
      dailyCap: circuits.Gemini?.dailyCap || config.dailyCapGemini,
      tokensUsedToday: tokens.Gemini?.totalTokens || 0,
      lastError: circuits.Gemini?.lastError,
    },
    OpenRouter: {
      configured: !!config.openRouterApiKey,
      status: !config.openRouterApiKey ? 'not_configured' : circuits.OpenRouter?.failures > 2 ? 'error' : 'connected',
      model: config.openRouterModel,
      dailyRequests: circuits.OpenRouter?.dailyRequests || 0,
      dailyCap: circuits.OpenRouter?.dailyCap || config.dailyCapOpenRouter,
      tokensUsedToday: tokens.OpenRouter?.totalTokens || 0,
      lastError: circuits.OpenRouter?.lastError,
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

  res.json({
    status: 'ok',
    backend: 'JEXA Autonomous Agent',
    providers,
    databases,
    tools: registeredTools,
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
app.post('/live-token', (_req: Request, res: Response) => {
  if (!config.geminiApiKey) {
    return res.status(503).json({
      error: 'Gemini is not configured on the backend server. Set GEMINI_API_KEY in environment variables.',
      configured: false,
    });
  }

  // Returns ephemeral token payload pointing to backend WebSocket or configuration
  // Reads model strictly from GEMINI_LIVE_MODEL env per specification
  res.json({
    wsUrl: '/live',
    model: config.geminiLiveModel,
    availableVoices: ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'],
    configured: true,
    expiresInSeconds: 3600,
  });
});

// 8. Global Error Handler (Prevents server from ever crashing)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error Catch]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.',
  });
});

// Start Server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`JEXA Backend running on http://0.0.0.0:${config.port} (env: ${config.nodeEnv})`);
});
