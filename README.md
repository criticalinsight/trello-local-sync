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

### UX Polish
- 🎛 **Agent Dashboard**: Real-time status of running agents
- 📊 **Global Agent Bar**: Persistent progress indicator
- 🔔 **Snackbar Notifications**: Success/error/info feedback
- 📱 **Mobile-Adaptive**: Responsive layouts for all devices

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | SolidJS + Vite + Tailwind CSS |
| Store | PGlite (WASM) + Solid Store |
| Backend | Cloudflare Worker + Durable Object |
| AI | Gemini Interactions API |

### Bundle Optimization
| Chunk | Size |
|-------|------|
| index.js | 114KB |
| solid-vendor.js | 13.5KB |
| pglite.js | 393KB |
| ai-service.js | 4.3KB |

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
npx wrangler deploy
```

> **Security**: Never commit API keys. Use environment variables.

## License
MIT
