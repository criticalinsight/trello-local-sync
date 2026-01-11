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
  id: string;        // UUID
  title: string;     // Text
  listId: string;    // Foreign Key -> List
  pos: number;       // Floating point for sorting
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
