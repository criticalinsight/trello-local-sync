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
    Phase 4 : Automation & Integration : Scheduled Prompts (Cron)
            : Triggered Workflows
            : Output Pipelines (Slack/Notion)
    Phase 5 : Knowledge & Visuals : RAG Integration
            : Knowledge Graphs
            : Presentation Mode
    Phase 6 : Ecosystem & Analytics : SDK/API Access
            : A/B Test Variants
            : Performance Analytics
```

## 3. Detailed Development Tracks

### 🛠 Phase 3: Resilience & Memory (Current Focus)
**Goal:** Enhance AI reliability and context preservation.
- [x] **Durable Object Polling:** Move long-running tasks to `ResearchDO` with alarms to bypass Worker limits.
- [x] **Rate Limit Fallbacks:** Automatic transition to `gemini-3-pro-preview` when agent quotas are hit.
- [ ] **Persistent Memory System:** Implement a relational knowledge graph for long-term user context.
- [ ] **Context Injection:** Automatic retrieval of relevant "memories" based on current prompt intent.

### 🔄 Phase 4: Smart Automation
**Goal:** Transition from passive prompting to active workflows.
- [ ] **Scheduled Prompts:** Cron-style execution within `BoardDO` for recurring intelligence tasks.
- [ ] **Triggered Workflows:** Webhooks that trigger prompt execution based on external events.
- [ ] **Output Pipelines:** Direct integration to route generated content to external tools (Slack, Notion, Email).

### 🧠 Phase 5: Knowledge Engine & Visuals
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
