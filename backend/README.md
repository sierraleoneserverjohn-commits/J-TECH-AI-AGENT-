# JEXA Autonomous Agent Backend

A strong, token-efficient, fault-tolerant agent backend built with Node.js 18+, TypeScript, and Express. Designed to power the JEXA Personal AI Command Centre and deployable on **Render's Free Web Service** tier directly from a GitHub repository.

---

## 📁 Full File Tree

```
jexa-backend/
├── .env.example                     # Reference environment variables
├── package.json                     # Dependencies, build & start scripts
├── tsconfig.json                    # Strict TypeScript build configuration
├── README.md                        # Documentation & Render deploy guide
├── test/
│   └── test.ts                      # Automated test suite (rules, auth, circuit breaker)
└── src/
    ├── index.ts                     # API Gateway (Express, CORS, Auth, Rate Limiter)
    ├── config.ts                    # Environment loader & configuration
    ├── events/
    │   └── sseManager.ts            # Server-Sent Events (SSE) broadcaster with 20s keepalive
    ├── orchestrator/
    │   ├── agentOrchestrator.ts     # Multi-stage agent planning & execution
    │   ├── rulesClassifier.ts       # Token-saving: 0-token rules & 1-3 tool classifier
    │   └── taskManager.ts           # Task lifecycle, progress tracker, and steps
    ├── models/
    │   ├── modelGateway.ts          # Unified Groq, Gemini & OpenRouter gateway (15s timeout)
    │   ├── circuitBreaker.ts        # Circuit breaker with exponential backoff & daily caps
    │   └── tokenTracker.ts          # Daily token tracking per provider
    ├── context/
    │   ├── contextManager.ts        # Upstash Redis REST + in-memory fallback (last 4 msgs)
    │   └── cacheManager.ts          # 10-minute query response cache (Upstash/local)
    ├── permissions/
    │   └── permissionEngine.ts      # Sensitive action gatekeeper (POST /confirm/:id)
    ├── verification/
    │   └── verificationEngine.ts    # Tool output quality & non-empty validator
    ├── memory/
    │   └── supabaseMemory.ts        # Long-term memory store via Supabase REST
    └── tools/
        ├── types.ts                 # Modular Tool interface
        ├── toolRegistry.ts          # Self-registering tool manager
        ├── calculator.ts            # 0-token deterministic local math evaluator
        ├── datetime.ts              # 0-token local date, time, and timezone resolver
        ├── webSearch.ts             # Tavily search (max 3 results, 300 chars each) + free fallback
        ├── githubRead.ts            # GitHub API repository and file inspector
        ├── memorySave.ts            # Save facts to Supabase long-term memory
        ├── memorySearch.ts          # Search Supabase long-term memory
        ├── documentReader.ts        # Document section extractor and parser
        ├── visionDescribe.ts        # Gemini multimodal image & screen analysis
        └── androidAction.ts         # Native intent stub (returns "needs_android_app")
```

---

## ⚡ Features & Architecture

### 1. Token Saving Strategy (Zero AI Slop)
- **Rules Before AI**: Basic math (`45 * 12`, `sqrt(144)`), date/time (`what time is it`), and system health pings are computed locally with **0 AI tokens**.
- **Rule-Based Tool Pruning**: Instead of sending all tool schemas to the model on every call, a lightweight classifier selects only the 1 to 3 relevant tools.
- **Strict Content Truncation**: Search results are capped at **3 results of 300 characters each** before reaching the model.
- **10-Minute Response Cache**: Identical queries return cached answers within 10 minutes without making duplicate provider calls.
- **Bounded Context Window**: Context Manager sends only the last 4 messages, summarizing older history into a single compact line.
- **Capped Output**: `MAX_OUTPUT_TOKENS` defaults to 400.

### 2. Fault Tolerance & Circuit Breaker
- **Provider Fallback Chains**:
  - `chat`: Groq $\rightarrow$ Gemini $\rightarrow$ OpenRouter
  - `research`: Gemini $\rightarrow$ Groq $\rightarrow$ OpenRouter
- **Circuit Breaker**: When a provider fails repeatedly, it pauses with exponential backoff (20s, 40s, 80s, up to 5 minutes). Honors HTTP 429 `Retry-After`.
- **Daily Request Caps**: Enforces `DAILY_CAP_GROQ`, `DAILY_CAP_GEMINI`, and `DAILY_CAP_OPENROUTER` to prevent overages.
- **15-Second Timeouts**: Every model call is aborted after 15 seconds to prevent hung requests.
- **Global Error Handling**: Server catches all exceptions and never crashes.

### 3. Realtime SSE Stream (`GET /events`)
Matches the JEXA Dashboard event bus format:
- `state`: `{ state: understanding | thinking | searching | running_tools | completed | error }`
- `log`: `{ text, level: info | success | warn | error }`
- `provider`: `{ name, status: ready | active | error, latencyMs, used, cap }`
- `tool`: `{ name, status: running | done | error | needs_android_app }`
- `task`: `{ id, title, steps, progress }`
- `memory`: `{ layer, delta, item }`
- Sends a `: ping\n\n` keepalive every 20 seconds.

---

## 🚀 How to Deploy on Render's Free Plan

### Step 1: Create a GitHub Repository
1. Initialize a Git repository with the `backend/` files:
   ```bash
   git init
   git add .
   git commit -m "feat: initial JEXA backend release"
   git remote add origin https://github.com/your-username/jexa-backend.git
   git push -u origin main
   ```

### Step 2: Create a Web Service on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** $\rightarrow$ **Web Service**.
3. Connect your `jexa-backend` GitHub repository.
4. Fill in the service settings:
   - **Name**: `jexa-backend` (or your preferred name)
   - **Region**: Choose the region closest to you (e.g. Frankfurt, Oregon, Singapore)
   - **Branch**: `main`
   - **Root Directory**: Leave blank if the repo root is the backend, or `backend` if in a monorepo
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free** ($0/month)

### Step 3: Configure Environment Variables on Render
Under the **Environment Variables** section on Render, add:
| Key | Value / Description | Required? |
| :--- | :--- | :--- |
| `ACCESS_TOKEN` | A strong random token (e.g. `jexa_sec_98f4a2b1`) | Recommended |
| `ALLOWED_ORIGIN` | `*` or your frontend JEXA URL | Recommended |
| `GROQ_API_KEY` | Your free Groq API key from [groq.com](https://console.groq.com/) | Recommended |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Recommended |
| `GEMINI_API_KEY` | Google Gemini API key from [Google AI Studio](https://aistudio.google.com/) | Recommended |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Recommended |
| `GEMINI_LIVE_MODEL` | `gemini-3.8-live` | Recommended |
| `OPENROUTER_API_KEY` | OpenRouter API key from [openrouter.ai](https://openrouter.ai/) | Optional |
| `OPENROUTER_MODEL` | `anthropic/claude-3.5-haiku` | Optional |
| `TAVILY_API_KEY` | Tavily search API key (free tier available at [tavily.com](https://tavily.com)) | Optional |
| `GITHUB_TOKEN` | Personal GitHub token for repository inspection | Optional |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (free tier at [upstash.com](https://upstash.com)) | Optional |
| `UPSTASH_REDIS_REST_TOKEN`| Upstash Redis REST Token | Optional |
| `SUPABASE_URL` | Supabase project URL (free tier at [supabase.com](https://supabase.com)) | Optional |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Optional |

*Note: All database and external tool services have automatic in-memory fallbacks if not provided!*

### Step 4: Deploy and Connect JEXA Frontend
1. Click **Deploy Web Service**. Render will build and start the service in ~60 seconds.
2. Once deployed, copy your Render URL (e.g. `https://jexa-backend.onrender.com`).
3. Open your JEXA Dashboard $\rightarrow$ Click **Settings (Gear Icon)**:
   - **Backend URL**: Paste your Render URL.
   - **Access Token**: Enter the `ACCESS_TOKEN` you set in Render.
   - Click **Test Connection**. You should see a green **Connected** confirmation badge!

---

## 🛠️ Local Development & Testing

```bash
# Install dependencies
npm install

# Run the automated test suite
npm test

# Run in development mode with live watch
npm run dev

# Build TypeScript to dist/
npm run build

# Start production server
npm start
```

---

## 📡 API Reference

### 1. `GET /`
Public health ping (No authentication required).
```json
{
  "status": "ok",
  "name": "JEXA Core Agent Backend",
  "version": "1.0.0",
  "uptimeSeconds": 124,
  "timestamp": 1793977000000
}
```

### 2. `POST /command`
Executes an autonomous agent directive.
- **Headers**: `Authorization: Bearer <ACCESS_TOKEN>`, `Content-Type: application/json`
- **Body**: `{"text": "Search for latest breakthroughs in fusion energy"}`
- **Response**:
```json
{
  "reply": "Recent fusion energy experiments achieved a sustained net energy gain exceeding Q=1.5...",
  "provider": "Groq",
  "model": "llama-3.3-70b-versatile",
  "taskId": "task_1793977012_x81",
  "sources": [
    { "title": "Fusion Breakthrough", "url": "https://..." }
  ]
}
```

### 3. `GET /events`
Server-Sent Events (SSE) live telemetry stream.
- **Auth**: Pass via `Authorization: Bearer <TOKEN>` or `?token=<TOKEN>`.
- Emits real events: `state`, `task`, `tool`, `provider`, `log`, `message`, `health`.
- Keeps connection alive with a `: ping\n\n` comment every 20 seconds.

### 4. `GET /status`
Real-time telemetry and health diagnostics of all configured providers, daily caps, rate limits, latency, tools, and databases.

### 5. `GET /tools`
List of all 9 registered modular tools and their operational status.

### 6. `POST /confirm/:id`
Approve or deny a pending sensitive action card (e.g. GitHub write, outbound notification).
- **Body**: `{"approve": true}`

### 7. `POST /live-token`
Generates an ephemeral session descriptor for real-time Gemini Live audio streaming without ever exposing the API key to client code.
