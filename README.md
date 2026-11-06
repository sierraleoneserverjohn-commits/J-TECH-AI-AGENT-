# JEXA — Personal AI Command Centre

JEXA is a landscape-first, JARVIS-style personal AI command centre built with React, TypeScript, and Tailwind CSS. It is engineered with a real working event bus architecture, an animated multi-state voice orb, real-time node topology map, and a swappable brain engine.

---

## Key Features

- **Landscape-First Command HUD**: Optimized for mobile phones in landscape mode, with automated orientation lock overlay and full-screen controls.
- **Central Voice Orb**: A real-time reactive canvas orb rendering 11 dedicated operational states:
  - `idle`: Slow breathing ice-blue glow
  - `listening`: Reacts to live microphone volume via Web Audio API (`AnalyserNode`)
  - `thinking`: Swirling inner particle vortex
  - `reasoning`: Rotating concentric geometric rings with outward pulse
  - `searching`: 360° radar sweep
  - `working` / `executing`: Fast segmented ring with active progress arc
  - `typing`: Bouncing status dots
  - `chatting` / `speaking`: Live waveform equalizer bars
  - `completed`: Expanding green ripple shockwave
  - `error`: Red glitch flicker and diagnostic message
- **Connection Topology Map**: Interactive circular node graph linking 8 providers (Gemini, Groq, OpenRouter, Tavily, Supabase, Upstash Redis, GitHub, Backend server) with live pulse animations and latency probes.
- **Strict Typed Event Bus**: All UI updates strictly follow the centralized event bus (`state`, `log`, `provider`, `tool`, `task`, `memory`, `health`, `speak`, `message`, `action`).
- **Swappable Brain Client**:
  - `GeminiBrain` (default): Uses server-side `@google/genai` proxying `gemini-3.8-flash`.
  - `RemoteBrain`: Connects to custom backend WebSocket (`ws://` / `wss://`) or HTTP endpoints.
- **7 Collapsible HUD Panels**: API Monitor, Live Activity stream, Voice controls, Commands & Chat, Tasks progress, Dual-tier Memory (Working & Long-Term), and System Health.
- **Zero Client Secrets**: No secret keys embedded in browser bundles.
- **Capacitor Mobile Bridge Stub**: Handles device-specific commands (e.g. WhatsApp, phone messaging) with clear UX cards explaining native requirements.

---

## Getting Started Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment** (optional):
   Copy `.env.example` to `.env`:
   ```bash
   GEMINI_API_KEY="your-gemini-api-key"
   ```
   *(Note: In AI Studio, `GEMINI_API_KEY` is injected automatically via user secrets).*

3. **Start the full-stack dev server**:
   ```bash
   npm run dev
   ```
   The application runs on `http://localhost:3000`.

---

## How to Deploy Frontend to GitHub Pages

GitHub Pages is a static file hosting service. You can deploy the JEXA frontend SPA directly:

### 1. Update `vite.config.ts` Base Path
Ensure your `vite.config.ts` includes the relative or repository base path:
```ts
export default defineConfig({
  base: './', // or '/<repository-name>/'
  // ... rest of config
});
```

### 2. Build Static Bundle
Run the production build:
```bash
npm run build
```
This produces optimized production assets inside the `dist/` directory.

### 3. Deploy via GitHub Actions
Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy JEXA to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build frontend
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 4. Remote Backend Setup for GitHub Pages
Since GitHub Pages hosts static files without a Node.js server:
1. Deploy the `server.ts` Express backend to any free container host (e.g., Cloud Run, Render, Railway, or Fly.io).
2. In the deployed JEXA frontend, open **Settings (Gear icon)**.
3. Switch the Brain to **Remote Brain** and paste your backend WebSocket (`wss://...`) or HTTP endpoint.
4. Settings are persisted automatically in `localStorage`.

---

## Android App Packaging (Capacitor)

To compile JEXA into a native Android APK:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init JEXA com.jexa.ai --web-dir dist
npm run build
npx cap add android
npx cap copy
npx cap open android
```
The included `src/plugins/capacitorStub.ts` provides native hooks for telephony, SMS, and deep links.
