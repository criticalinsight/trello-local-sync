# Tasks

## ✅ Completed

- [x] Phase 7: Autonomous Agents
- [x] Phase 8: UX Polish
- [x] Phase 9: Observability
- [x] Phase 10: Production Reliability
    - [x] Error boundary component
    - [x] Visible-first Playground layout
    - [x] Immediate lane transition
    - [x] Presentation skeleton loader
    - [x] Auto-updating service worker
    - [x] Cache-control headers

## 🚀 Refactoring & Deployment (Phase 11)

- [x] /test @[/refactor] @[/test] - Comprehensive refactor and verification <!-- id: p11_0 -->
    - [x] Stabilize unit tests and environment types
    - [x] Integrate Workflow & Schedule UI in Playground
- [x] Update documentation after refactor <!-- id: p11_1 -->
- [x] @[/c] with authlogin - Production deployment <!-- id: p11_2 -->

## 🤖 Automation Upgrades (Phase 13)
- [x] Integrate Graphiti MCP into Ralph Autonomous Loop <!-- id: p13_0 -->
    - [x] Install `mcp` in `.ralph_venv`
    - [x] Update `ralph_driver.py` to query memories
    - [x] Inject memories into system prompt

## 🛠 System Verification (Phase 14)
- [x] Verify Ralph loop stability and MCP responsiveness <!-- id: p14_0 -->
    - [x] Resolve "Bad file descriptor" error in `ralph.log`
    - [x] Confirm `search_memories` works within `ralph_driver.py`
    - [x] Perform a simple code modification via Ralph (e.g., update README.md)

## 🏗 AI Refinery Optimization (Phase 15)
- [x] Improve ContentDO robustness and reliability <!-- id: p15_0 -->
- [x] Migrate Refinery Dashboard to dedicated `/r` route <!-- id: p15_1 -->
- [x] Implement source-level health metrics and retries <!-- id: p15_2 -->

## 🌐 Production Domain & Routing (Phase 16)
- [x] Configure SPA routing fallback in Worker <!-- id: p16_0 -->
- [x] Add custom domain `moecapital.com` to `wrangler.toml` <!-- id: p16_1 -->
- [x] Authenticate with Cloudflare and Deploy (to `work.moecapital.com`) <!-- id: p16_2 -->
- [x] Verify `/r` in production (apex domain removed due to DNS conflict) <!-- id: p16_3 -->

## 🛡️ Comprehensive QA & Refactor Loop (Phase 17)
- [x] **Core Logic QA** (`promptStore`, `aiService`) <!-- id: p17_0 -->
    - [x] Test `promptStore.ts` coverage & refactor <!-- id: p17_0_0 -->
    - [x] Test `aiService.ts` coverage & refactor <!-- id: p17_0_1 -->
- [x] **Backend Agents QA** (Durable Objects) <!-- id: p17_1 -->
    - [x] Refactor `ContentDO.ts` (Robustness) <!-- id: p17_1_0 -->
    - [x] Refactor `BoardDO.ts` (Logic) <!-- id: p17_1_1 -->
    - [x] Refactor `ResearchDO.ts` (Agent) <!-- id: p17_1_2 -->
- [x] **Frontend QA** (Components) <!-- id: p17_2 -->
    - [x] Refactor `RefineryDashboard.tsx` <!-- id: p17_2_0 -->
    - [x] Refactor `AgentDashboard.tsx` <!-- id: p17_2_1 -->
- [x] **End-to-End Verification** <!-- id: p17_3 -->
    - [x] Fix `final_simulation.spec.ts` <!-- id: p17_3_0 -->
    - [x] Fix `live_simulation_v2.spec.ts` <!-- id: p17_3_1 -->

## 🧠 Epistemic Analyst & Deep Research (Phase 18)
- [ ] **Epistemic Analyst Agent** <!-- id: p18_0 -->
    - [ ] Formalize `EPISTEMIC_ANALYST_PROMPT` in `data/prompts.ts` <!-- id: p18_0_0 -->
    - [ ] Enhance `ResearchDO.ts` with structured reasoning (CoT) <!-- id: p18_0_1 -->
    - [ ] Integrate with Telegram `/insight` command logic <!-- id: p18_0_2 -->
- [ ] **Deep Research Capabilities** <!-- id: p18_1 -->
    - [ ] Implement multi-step research loop (search -> analyze -> synthesize) <!-- id: p18_1_0 -->
    - [ ] Add source citation and reliability scoring <!-- id: p18_1_1 -->
- [ ] **Frontend Integration** <!-- id: p18_2 -->
    - [ ] Create `EpistemicView` for displaying deep reasoning chains <!-- id: p18_2_0 -->
    - [ ] Add "Deep Research" mode to Prompt Playground <!-- id: p18_2_1 -->
