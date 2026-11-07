# JEXA Autonomous AI Command Centre & Agent Backend

JEXA (JARVIS-class Executive Autonomous Intelligence) is a landscape Sci-Fi HUD Command Centre powered by a fault-tolerant, token-efficient agent backend.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│             JEXA HUD Frontend (React + Vite)           │
│  • Edge Drawers • Live Holographic Globe • Voice HUD  │
└──────────────────────────┬─────────────────────────────┘
                           │ SSE /events & HTTP REST (/command, /tools, /status)
                           ▼
┌────────────────────────────────────────────────────────┐
│            JEXA Core Backend (Express + TS)            │
│  • Single Source of Truth (/backend)                   │
│  • Zero-Token Rules Classifier                         │
│  • Multi-Provider Gateway (Groq, Gemini, OpenRouter)   │
│  • Circuit Breakers & Daily Caps                       │
│  • Modular Tools (SSRF-Guarded Search, GitHub, Vision) │
│  • Context Manager (Upstash REST) & Supabase Memory   │
└────────────────────────────────────────────────────────┘
```

---

## 1. Local Development

### Prerequisites
- Node.js 18+ (tested on Node 20+)
- npm

### Installation & Run
```bash
# Install root dependencies
npm install

# Run backend test suite
npm --prefix backend test

# Run type check across root and backend
npm run check

# Start development server on http://localhost:3000
npm run dev
```

---

## 2. Deploying Backend to Render (Free Plan)

1. Fork or push this repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** -> **Blueprint**.
3. Select your repository. Render will automatically detect `render.yaml`.
4. Configure the environment variables in Render:
   - `ACCESS_TOKEN`: A strong random string for Bearer authentication.
   - `ALLOWED_ORIGIN`: Your frontend URL (e.g. `https://<your-username>.github.io` or `*` for initial testing).
   - `GEMINI_API_KEY`: Google AI Studio Gemini API Key.
   - `GEMINI_MODEL`: (e.g. `gemini-2.0-flash`).
   - `GEMINI_LIVE_MODEL`: (e.g. `gemini-3.8-live`).
   - `GROQ_API_KEY`: Groq API Key.
   - `GROQ_MODEL`: (e.g. `llama-3.3-70b-versatile`).
   - `OPENROUTER_API_KEY`: OpenRouter API Key.
   - `OPENROUTER_MODEL`: (e.g. `anthropic/claude-3.5-haiku`).
   - `TAVILY_API_KEY`: (Optional) Tavily search key for live web search.
   - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: (Optional) Upstash Redis for serverless context cache.
   - `SUPABASE_URL` & `SUPABASE_SERVICE_KEY`: (Optional) Supabase for long-term memory.
5. Click **Apply**. Render will run:
   ```bash
   npm install --include=dev && npm run build
   npm start
   ```

---

## 3. Deploying Frontend to GitHub Pages

1. In GitHub repository settings, navigate to **Settings** > **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`. The `.github/workflows/deploy.yml` workflow will automatically build and publish the frontend.
4. Open the deployed GitHub Pages URL in your browser.
5. Tap **Settings** (top right) in the JEXA Command Centre:
   - Enter your Render backend URL (e.g. `https://jexa-backend.onrender.com`).
   - Enter your `ACCESS_TOKEN`.
   - Click **Test Connection** -> **Save**.

---

## 4. Security Architecture

- **Timing-Safe Auth**: Access tokens are compared with `crypto.timingSafeEqual` in constant time.
- **Production Guard**: In `NODE_ENV=production`, the backend refuses to start without an `ACCESS_TOKEN`.
- **SSRF Protection**: Web fetch and search tools resolve DNS before making requests and block:
  - `127.0.0.0/8` (loopback)
  - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (private networks)
  - `169.254.0.0/16` (link-local and cloud metadata like `169.254.169.254`)
  - `::1`, `fc00::/7`, `fe80::/10` (IPv6 private ranges)
  - Manual redirect tracking up to 3 hops with re-validation on every hop.
  - 10-second timeout and 1 MB streaming limit.
- **Safe GitHub Tool**: Strict repository regex validation (`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`) and path traversal protection rejecting `..`.
- **Zero Raw Error Leaks**: Errors are sanitized before transmission; raw internal stack traces are never sent to clients.
