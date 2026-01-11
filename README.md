# Local-First Trello Clone

A high-performance Kanban board built with **SolidJS**, **PGlite** (Postgres WASM), and **Cloudflare Durable Objects**.

## 🚀 Live Demo

**https://work.moecapital.com**

## Features

- ⚡ **0ms Latency**: Optimistic UI updates.
- 🔄 **Real-time Sync**: WebSocket-based synchronization via Cloudflare Edge.
- 📱 **Local-First**: Full offline support using in-browser PostgreSQL (PGlite).
- 🏃 **Performance**: No Virtual DOM overhead; native drag-and-drop at 60fps.

## Architecture

- **Frontend**: SolidJS + Vite + Tailwind CSS
- **Store**: PGlite (WASM) + Solid Store
- **Backend**: Cloudflare Worker + Durable Object + Native SQLite

## Getting Started

### Prerequisites
- Node.js (v20+)
- Cloudflare Account (for deployment)

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Dev Server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Deployment

This project executes on Cloudflare Workers.

### Security Note 🔒
Never commit your `CLOUDFLARE_API_KEY` or `CLOUDFLARE_EMAIL` to the repository. Use environment variables.

### Deploy Command
```powershell
# Set credentials (session only)
$env:CLOUDFLARE_EMAIL="your-email@example.com"
$env:CLOUDFLARE_API_KEY="your-global-api-key"

# Deploy
npx wrangler deploy
```

## License
MIT
