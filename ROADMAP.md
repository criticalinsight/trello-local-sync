# Strategic Roadmap: Work (Local-First AI Engine)

## 1. Vision & Strategy
Our mission is to build the world's most responsive, reliable, and intelligent productivity engine. By combining **local-first architecture** with **agentic AI capabilities**, we provide a professional workspace that works offline, syncs instantly at the edge, and automates complex cognitive tasks.

## 2. Visual Timeline
```mermaid
timeline
    title Project Journey & Future
    Phase 1 : Foundation (Complete) : Local-first PGlite
            : Optimistic UI (SolidJS)
            : Edge Sync (Durable Objects)
    Phase 2 : AI Lifecycle (Complete) : Draft-Deploy Workflow
            : Gemini Interactions API
            : Background Research Agent
    Phase 3 : Resilience & Memory (Current) : ResearchDO (Long Polling)
            : Rate Limit Fallbacks
            : Persistence Context (Memory)
    Phase 4 : Automation & Integration (Complete) : Scheduled Prompts (Cron)
            : Triggered Workflows
    Phase 5 : Knowledge & Visuals (Skipped)
    Phase 6 : Ecosystem & Analytics : SDK/API Access
            : A/B Test Variants
            : Performance Analytics
```

## 3. Detailed Development Tracks

### 🛠 Phase 4: Smart Automation (Complete)
**Goal:** Transition from passive prompting to active workflows.
- [x] **Scheduled Prompts:** Cron-style execution within `BoardDO` for recurring intelligence tasks.
- [x] **Triggered Workflows:** Automated prompt execution based on board events.
- [s] **Output Pipelines:** (Skipped per user request)

### ⏩ Phase 5: Knowledge Engine & Visuals (Skipped)
**Goal:** Deepen the utility of AI outputs and visual representation.
- [ ] **RAG Integration:** Vector-based search over user-uploaded documents for high-accuracy context.
- [ ] **Knowledge Graphs:** Visual mapping of relationships between prompts, memories, and outputs.
- [ ] **Presentation Mode:** Convert AI outputs directly into slide decks or structured documents.
- [ ] **Multimodal Visuals:** Integrated image generation (Imagen) and diagram creation (Mermaid).

### 🚀 Phase 6: Strategic Scale
**Goal:** Open the platform for developers and enterprise optimization.
- [ ] **Work SDK:** Programmatic access to boards and agents for external application integration.
- [ ] **A/B Testing:** Side-by-side comparison of prompt variants with quality score tracking.
- [ ] **Cost Dashboard:** Real-time visibility into token usage and compute costs across projects.

## 4. Current Progress (KPIs)

| Metric | Status | Target |
|--------|--------|--------|
| **UI Latency** | ✅ < 16ms | < 16ms |
| **Offline Sync** | ✅ Robust | 100% |
| **AI Reliability** | 🟡 Improving | 99.9% Success |
| **Agent Support** | ✅ 1-hour Tasks | Support Hour+ Polling |
| **Context Retention**| 🔲 In Dev | Cross-session Memory |

---

> [!TIP]
> This roadmap is dynamic and evolves based on user feedback and advancements in the Gemini model ecosystem. We prioritize **performance** and **privacy** in every feature.
