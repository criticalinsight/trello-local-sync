# Work (Local-First AI Kanban)

A high-performance AI-powered Kanban board built with **SolidJS**, **PGlite** (Postgres WASM), and **Cloudflare Durable Objects**.

## 🚀 Live Demo

**https://work.moecapital.com**

## Features

### Core

- ⚡ **0ms Latency**: Optimistic UI updates
- 🔄 **Real-time Sync**: WebSocket via Cloudflare Edge
- 📱 **Local-First**: Offline-capable with in-browser PostgreSQL
- 🏃 **60fps Performance**: Native drag-and-drop, no Virtual DOM

### AI Capabilities

- 🤖 **Autonomous Agents**: Multi-agent swarms with Coordinator/Worker orchestration
- 🔁 **Self-Correcting AI**: Recursive critique loops with automatic feedback injection
- 📅 **Scheduled Prompts**: Cron-based AI execution
- ⚡ **Triggered Workflows**: Event-driven prompt automation
- 📝 **Presentation Mode**: Export AI outputs as documents or slides

### UX Polish

- 🎛 **Agent Dashboard**: Real-time status of running agents
- 📊 **Global Agent Bar**: Persistent progress indicator
- 🔔 **Snackbar Notifications**: Success/error/info feedback
- 📱 **Mobile-Adaptive**: Responsive layouts for all devices
- 🛡 **Error Boundary**: Graceful recovery from runtime errors

### Telegram Bot 🤖

- 📱 **Mobile Command Center**: Full control from Telegram
- 🔘 **Interactive Buttons**: Tap to Run, Delete, Refine
- 🎙️ **Voice Notes**: Dictate prompts on the go
- 🔬 **Deep Research**: `/research [query]` for background AI analysis
- 📡 **Real-Time Monitoring**: Live status updates with output previews
- 🏥 **Health Check**: `/health` for system status

### Production Reliability

- 🔄 **Auto-Updating**: No hard refresh needed after deployments
- 📦 **Cache Headers**: Immutable hashed assets, no-cache HTML
- 🧹 **SW Cache Cleanup**: Automatic old cache invalidation

## Architecture

| Layer    | Technology                         |
| -------- | ---------------------------------- |
| Frontend | SolidJS + Vite + Tailwind CSS      |
| Store    | PGlite (WASM) + Solid Store        |
| Backend  | Cloudflare Worker + Durable Object |
| AI       | Gemini Interactions API            |
| CDN      | Cloudflare Assets + Service Worker |

### Bundle Optimization

| Chunk           | Size  |
| --------------- | ----- |
| index.js        | 118KB |
| solid-vendor.js | 14KB  |
| pglite.js       | 394KB |
| ai-service.js   | 4.3KB |

## Getting Started

### Prerequisites

- Node.js (v20+)
- Cloudflare Account (for deployment)

### Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deployment

```bash
npm run build
npx wrangler deploy
```

> **Security**: Never commit API keys. Use `wrangler secret put GEMINI_API_KEY`.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for current phase and future plans.

## License

MIT
<!-- Ralph Verification: System Loop Stability Test -->

<!-- Ralph verification: system active -->
<!-- Ralph System Verification: Phase 14 verified -->
-e 
<!-- Ralph verification -->

<!-- Ralph System Verification: Loop Operational -->
-e 
<!-- Ralph Verification Phase 14: System Stability Confirmed -->

<!-- Ralph System Verification -->

<!-- Ralph Verification: Graphiti MCP Active -->
