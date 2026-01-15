# Product Requirements Document (PRD): Work (Local-First Kanban)

## 1. Executive Summary

**Product Name:** Trello Sync (Local-First)  
**Live URL:** https://work.moecapital.com  
**Goal:** Build the fastest possible Kanban board application that functions perfectly offline and syncs instantly when online.
**Core Value Proposition:** 0ms latency interactions via optimistic UI and edge-based synchronization.

## 2. Technical Stack

- **Frontend Framework:** SolidJS (Signal-based reactivity, no Virtual DOM).
- **Local Database:** PGlite (PostgreSQL compiled to WASM).
- **Edge Backend:** Cloudflare Workers + Durable Objects.
- **Edge Database:** Native SQLite (embedded in Durable Object).
- **Communication:** WebSockets (bidirectional sync).
- **Styling:** Tailwind CSS.

## 3. Functional Requirements

### 3.1 Board Management

- **FR-01:** System shall initialize with default lists.
- **FR-02:** User can create, rename, delete, and reorder lists (Drag & Drop).
- **FR-02B:** User can manage multiple independent boards via Home screen (Routing).

### 3.2 Card Management

- **FR-03:** User can create a card with title, description, tags, checklists, and due date.
- **FR-04:** User can move cards between lists using Drag & Drop (Touch supported).
- **FR-05:** User can delete cards.
- **FR-05B:** User can search and filter cards by metadata.
- **FR-05C:** User can undo/redo actions infinitely.

### 3.3 Synchronization

- **FR-06:** All actions must reflect immediately in the UI (Optimistic Updates).
- **FR-07:** Changes must be persisted locally to PGlite.
- **FR-08:** Changes must be synced to Cloudflare Durable Object via WebSocket.
- **FR-09:** Updates from other clients must be broadcasted and merged in real-time.

### 3.4 Platform & Export

- **FR-10:** Application is installable as PWA.
- **FR-11:** User can export board data to JSON.
- **FR-12:** Application supports Dark Mode.

## 4. Non-Functional Requirements

- **NFR-1 (Performance):** Drag & Drop must maintain 60FPS (optimized with requestAnimationFrame).
- **NFR-2 (Latency):** UI response time must be < 16ms (1 frame) for all local actions.
- **NFR-3 (Offline First):** Application must be fully functional without internet connection.
- **NFR-4 (Security):** Zero vulnerability dependencies.

## 5. Data Models

### 5.1 Card

```typescript
interface Card {
    id: string; // UUID
    title: string; // Text
    listId: string; // Foreign Key -> List
    pos: number; // Floating point for sorting
    createdAt: number; // Timestamp
    description?: string;
    tags?: string[];
    checklist?: { id: string; text: string; done: boolean }[];
    dueDate?: number;
}
```

### 5.2 List

```typescript
interface List {
    id: string;
    title: string;
    pos: number;
    board_id: string;
}
```

## 6. User Flows

1. **Add Card:** User types title -> Hits Enter -> Card appears instantly -> Background sync.
2. **Move Card:** User drags card -> Drops in new list -> Card snaps to position -> Background sync.

---

## 7. AI Prompt Engineering Module

### 7.1 Overview

A dedicated Kanban workflow for AI prompt iteration with lifecycle: **Draft → Queued → Generating → Deployed**.

### 7.2 AI Functional Requirements

- **FR-AI-01:** User can create prompt boards with 4 lifecycle columns.
- **FR-AI-02:** User can add prompts with title, system instructions, and generation parameters.
- **FR-AI-03:** User can run single or batch prompt execution ("Run All").
- **FR-AI-04:** System supports Gemini Interactions API with model fallback.
- **FR-AI-05:** User can view/edit prompts in split-view Playground modal.
- **FR-AI-06:** User can revert to previous prompt versions via timeline.

### 7.3 AI Models

| Model                               | Type     | Mode               |
| ----------------------------------- | -------- | ------------------ |
| `deep-research-pro-preview-12-2025` | Agent    | Background polling |
| `gemini-3-pro-preview`              | Standard | Synchronous        |

### 7.4 PromptCard Data Model

```typescript
interface PromptCard {
    id: string;
    title: string;
    boardId: string;
    status: 'draft' | 'queued' | 'generating' | 'deployed' | 'error';
    currentVersionId?: string;
    pos: number;
    createdAt: number;
    deployedAt?: number;
}

interface PromptVersion {
    id: string;
    promptId: string;
    content: string;
    systemInstructions?: string;
    parameters: { temperature: number; topP: number; maxTokens: number };
    output?: string;
    executionTime?: number;
    error?: string;
    createdAt: number;
}
```

### 7.5 API Endpoint

- **Route:** `POST /api/ai/interact`
- **Endpoint:** Gemini Interactions API (`/v1beta/interactions`)
- **Features:** Model fallback, background polling, error handling

---

## 8. Product Roadmap (Alternative Ideas)

### Track A: AI Agent Ecosystem 🤖

| Feature                       | Description                                                                     | Priority |
| ----------------------------- | ------------------------------------------------------------------------------- | -------- |
| **Agent Templates**           | Pre-built prompt chains for common tasks (summarization, code review, research) | High     |
| **Multi-Agent Orchestration** | Chain prompts together with conditional logic                                   | Medium   |
| **Custom Tool Calling**       | Let prompts call external APIs/webhooks                                         | Medium   |
| **Agent Marketplace**         | Share/import community-built agents                                             | Low      |

### Track B: Smart Automation 🔄

| Feature                 | Description                                     | Priority |
| ----------------------- | ----------------------------------------------- | -------- |
| **Scheduled Prompts**   | Cron-style execution for recurring AI tasks     | High     |
| **Triggered Workflows** | Webhooks that trigger prompt execution          | High     |
| **Output Pipelines**    | Auto-route outputs to Slack, email, Notion      | Medium   |
| **Watch Folders**       | Monitor file changes → run prompts on new files | Low      |

### Track C: Knowledge & Context 🧠

| Feature              | Description                                   | Priority  |
| -------------------- | --------------------------------------------- | --------- |
| **RAG Integration**  | Upload docs, build vector indexes for context | High      |
| **Memory System**    | Persistent context across prompt sessions     | High ✅   |
| **Knowledge Graphs** | Visual relationship mapping between concepts  | Medium ✅ |
| **Source Citations** | Track which docs influenced outputs           | Low       |

### Track D: Developer Experience 💻

| Feature               | Description                            | Priority |
| --------------------- | -------------------------------------- | -------- |
| **CLI Tool**          | `work prompt run my-prompt.yaml`       | High     |
| **SDK/API**           | Programmatic access to prompt boards   | High     |
| **Git Sync**          | Version prompts in repo, sync on push  | Medium   |
| **CI/CD Integration** | Run prompts as part of build pipelines | Low      |

### Track E: Visual & Creative 🎨

| Feature                | Description                                | Priority  |
| ---------------------- | ------------------------------------------ | --------- |
| **Image Generation**   | Integrate Imagen/DALL-E for visual outputs | High      |
| **Diagram Generation** | Auto-generate Mermaid/PlantUML from text   | Medium    |
| **Presentation Mode**  | Turn outputs into slides/documents         | Medium ✅ |
| **Asset Library**      | Store generated images for reuse           | Low       |

### Track F: Analytics & Optimization 📊

| Feature                 | Description                          | Priority |
| ----------------------- | ------------------------------------ | -------- |
| **A/B Testing**         | Compare prompt variants side-by-side | High     |
| **Quality Scoring**     | Auto-rate outputs with rubrics       | Medium   |
| **Cost Dashboard**      | Track token usage, estimate costs    | High     |
| **Performance Heatmap** | Visualize which prompts perform best | Low      |

---

## 9. Key Performance Indicators (KPIs)

| Metric                  | Target | Current |
| ----------------------- | ------ | ------- |
| UI Latency              | < 16ms | ✅      |
| Offline Capability      | 100%   | ✅      |
| Test Coverage           | 80%+   | 🔲      |
| Lighthouse Performance  | 95+    | 🔲      |
| AI Response Time (sync) | < 3s   | ✅      |
| AI Response Time (deep) | < 2min | ✅      |

---

## 10. Dependencies & Risks

### Current Dependencies

| Dependency         | Version | Purpose            |
| ------------------ | ------- | ------------------ |
| SolidJS            | 1.8.x   | Frontend framework |
| PGlite             | 0.2.x   | Local PostgreSQL   |
| Cloudflare Workers | -       | Edge compute       |
| Gemini API         | v1beta  | AI generation      |

### Risk Mitigation

- **API Rate Limits**: Model fallback chain implemented
- **Offline Storage**: PGlite with IndexedDB backend
- **Build Size**: Code splitting for large chunks
- **Security**: No hardcoded secrets, env-based config
