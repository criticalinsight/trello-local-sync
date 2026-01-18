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
- [ ] Authenticate with Cloudflare and Deploy <!-- id: p16_2 -->
- [ ] Verify `moecapital.com/r` in production <!-- id: p16_3 -->

## 🛡️ Comprehensive QA & Refactor Loop (Phase 17)
- [x] **Core Logic QA** (`promptStore`, `aiService`) <!-- id: p17_0 -->
    - [x] Test `promptStore.ts` coverage & refactor <!-- id: p17_0_0 -->
    - [x] Test `aiService.ts` coverage & refactor <!-- id: p17_0_1 -->
- [ ] **Backend Agents QA** (Durable Objects) <!-- id: p17_1 -->
    - [ ] Refactor `ContentDO.ts` (Robustness) <!-- id: p17_1_0 -->
    - [ ] Refactor `BoardDO.ts` (Logic) <!-- id: p17_1_1 -->
    - [ ] Refactor `ResearchDO.ts` (Agent) <!-- id: p17_1_2 -->
- [ ] **Frontend QA** (Components) <!-- id: p17_2 -->
    - [ ] Refactor `RefineryDashboard.tsx` <!-- id: p17_2_0 -->
    - [ ] Refactor `AgentDashboard.tsx` <!-- id: p17_2_1 -->
- [ ] **End-to-End Verification** <!-- id: p17_3 -->
    - [ ] Fix `final_simulation.spec.ts` <!-- id: p17_3_0 -->
    - [ ] Fix `live_simulation_v2.spec.ts` <!-- id: p17_3_1 -->
