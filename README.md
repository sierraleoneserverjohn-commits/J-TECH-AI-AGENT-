# JEXA Autonomous AI Command Centre & Agent Backend

JEXA (JARVIS-class Executive Autonomous Intelligence) is a landscape Sci-Fi HUD Command Centre powered by a fault-tolerant, token-efficient agent backend and available as a Progressive Web App and native Android APK via Capacitor.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│              JEXA HUD Frontend (React + Vite + Capacitor)               │
│  • Edge Drawers • Live Holographic Globe • Voice HUD • Native Android   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ SSE /events & HTTP REST (/command, /tools, /status)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    JEXA Core Backend (Express + TS)                     │
│  • Single Source of Truth (/backend runs independently)                 │
│  • Zero-Token Rules Classifier                                          │
│  • Multi-Provider Gateway (Groq, Gemini, OpenRouter)                   │
│  • Circuit Breakers & Daily Caps                                        │
│  • Modular Tools (SSRF-Guarded Search, GitHub, Vision)                  │
│  • Context Manager (Upstash REST) & Supabase Memory                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Local Development

### Prerequisites
- Node.js 18+ (tested on Node 20 / 22)
- npm

### Installation & Run
```bash
# Install root dependencies and automatically apply Capacitor patches
npm install

# Run backend test suite (27 tests)
npm --prefix backend test

# Run type check across root and backend
npm run check

# Start development server on http://localhost:3000
npm run dev
```

---

## 2. Deployment

### A. Deploying Frontend to GitHub Pages

1. In GitHub repository settings, navigate to **Settings** > **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (do NOT use "Deploy from a branch").
3. Push changes to the `main` branch. The `.github/workflows/deploy.yml` workflow will automatically run `npm install`, build the static web application (`npm run build`), and deploy the `/dist` directory.
4. Note on secrets: `npm run build` requires zero build-time secrets or backend connection. All settings and tokens are configured client-side in the runtime HUD Settings modal.
5. Open your deployed GitHub Pages URL (e.g., `https://<your-username>.github.io/<repo>/`).
6. Tap **Settings** (gear icon in the top right) in JEXA:
   - Enter your Render Backend URL.
   - Enter your `ACCESS_TOKEN`.
   - Click **Test Connection** -> **Save**.

### B. Deploying Backend to Render (Free Tier)

The `/backend` folder runs completely standalone with zero imports from the repository root.

#### Option 1: Automatic Blueprint (Recommended)
1. Fork or push this repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** -> **Blueprint**.
3. Select your repository. Render will automatically detect `render.yaml`.
4. Fill in the environment variables and click **Apply**.

#### Option 2: Manual Web Service Setup
If creating the Web Service manually via the Render dashboard:
- **Type**: Web Service
- **Runtime**: Node
- **Plan**: Free
- **Root Directory**: `backend`
- **Build Command**: `npm install --include=dev && npm run build` *(the `--include=dev` flag is essential so Render installs TypeScript and the compiler)*
- **Start Command**: `npm start` *(runs `node dist/index.js` on host `0.0.0.0` listening on `PORT`)*
- **Health Check Path**: `/`

#### Environment Variables
Set these variables in the Render Dashboard (**Environment** tab):
- `NODE_ENV`: `production`
- `NODE_VERSION`: `20`
- `ACCESS_TOKEN`: A strong secret Bearer token (required in production).
- `ALLOWED_ORIGIN`: Comma-separated list of allowed origins, including your GitHub Pages domain and Capacitor origins:
  ```
  https://<your-username>.github.io,https://localhost,capacitor://localhost
  ```
- `GEMINI_API_KEY`: Google AI Studio Gemini API Key.
- `GEMINI_MODEL`: Chat model name. **Recommended**: `gemini-3.8-flash` (or `gemini-3.5-flash-lite` for ultra-fast execution). *Note: `gemini-2.0-flash` and `gemini-1.5-*` are deprecated.*
- `GEMINI_LIVE_MODEL`: Real-time bidirectional voice model. **Recommended**: `gemini-3.8-live` (fallback: `gemini-3.1-flash-live-preview`).
- `GROQ_API_KEY`: Groq API Key.
- `GROQ_MODEL`: Model name (e.g. `llama-3.3-70b-versatile`).
- `OPENROUTER_API_KEY`: OpenRouter API Key.
- `OPENROUTER_MODEL`: Model name (e.g. `anthropic/claude-3.5-haiku`).
- `DAILY_CAP_GROQ`: `14400`
- `DAILY_CAP_GEMINI`: `1500`
- `DAILY_CAP_OPENROUTER`: `500`
- `MAX_OUTPUT_TOKENS`: `400`
- `TAVILY_API_KEY`: (Optional) Tavily search API key for live web grounding.
- `GITHUB_TOKEN`: (Optional) GitHub personal access token for repo inspections.
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: (Optional) Upstash Redis for serverless context memory.
- `SUPABASE_URL` & `SUPABASE_SERVICE_KEY`: (Optional) Supabase credentials for long-term memory.

### C. Building & Downloading the Android APK (Capacitor)

The repository includes an automated GitHub Actions pipeline (`.github/workflows/android-apk.yml`) to build an installable Debug APK without requiring Android signing keys.

1. **Triggering the Build**:
   - Push to `main`, or navigate to **Actions** in GitHub > **Build JEXA Android Debug APK** > **Run workflow**.
2. **Workflow Execution**:
   - Sets up Node.js 20 and Java 21 (Zulu).
   - Installs dependencies (`npm install`) and builds web assets (`npm run build`).
   - Syncs assets into the Android native wrapper (`npx cap sync android`).
   - Automatically patches `AndroidManifest.xml` with:
     - `android:screenOrientation="sensorLandscape"` for locked HUD orientation.
     - `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, and `INTERNET` permissions.
   - Compiles debug APK via Gradle (`./gradlew assembleDebug --no-daemon`).
3. **Downloading the APK**:
   - Click on the completed workflow run.
   - Under the **Artifacts** section at the bottom, click **jexa-debug-apk** to download the zip file containing `app-debug.apk`.
   - Transfer `app-debug.apk` to your Android device, allow installation from unknown sources, and launch JEXA in fullscreen landscape mode.
4. **Voice in Android APK**:
   - Primary: Gemini Live via `navigator.mediaDevices.getUserMedia` streams real-time PCM audio directly.
   - Fallback: Uses `@capacitor-community/speech-recognition` to interface with native Android speech recognition instead of unsupported WebView WebSpeech APIs.
   - The app asks for microphone permissions on first launch and handles denials gracefully.

---

## 3. Security Architecture

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
