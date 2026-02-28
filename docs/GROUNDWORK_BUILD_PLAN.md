# Groundwork V1 — Build Plan

> Status: 🔨 IN PROGRESS
> Started: 2026-02-28 21:13
> Branch: feature/agentic-v2

---

## Build Order

### Step 1: Agent Prompts ⬜
Create 6 agent prompt files in `src/prebloom/groundwork/agents/`:
- [ ] `competitor-intelligence.ts` (A1)
- [ ] `market-sizing.ts` (A2)
- [ ] `gap-analysis.ts` (A3)
- [ ] `customer-personas.ts` (B1)
- [ ] `gtm-playbook.ts` (B2)
- [ ] `mvp-scope.ts` (B3)

### Step 2: Groundwork Orchestrator ⬜
Create `src/prebloom/groundwork/orchestrator.ts`:
- [ ] Accept evaluation ID + council verdict as input
- [ ] Phase A: Run A1 + A2 in parallel, then A3 with their outputs
- [ ] Phase B: Run B1 + B2 + B3 in parallel with all prior context
- [ ] Collect metrics per agent (same pattern as Council)
- [ ] Return structured result with all 6 deliverables

### Step 3: Types ⬜
Update `src/prebloom/groundwork/types.ts`:
- [ ] GroundworkResult interface
- [ ] Per-agent output interfaces (BattleCard, MarketSizing, etc.)
- [ ] GroundworkMetrics

### Step 4: API Endpoints ⬜
Update `src/prebloom/api/http-handler.ts`:
- [ ] POST `/prebloom/groundwork/:evaluationId` — trigger Groundwork from a completed eval
- [ ] GET `/prebloom/groundwork/:evaluationId` — poll for results
- [ ] Return metrics + served flag

### Step 5: Storage ⬜
- [ ] Store Groundwork results (linked to evaluation ID)
- [ ] In-memory cache (same pattern as Council metrics)

### Step 6: Test ⬜
- [ ] Run Groundwork on a completed evaluation
- [ ] Verify all 6 deliverables produced
- [ ] Check metrics (time, tokens, searches per agent)
- [ ] Compare output quality against design doc expectations

---

## Technical Notes
- Reuse `runAgent()` from Council orchestrator (same Anthropic API pattern)
- Same Brave web search tool
- Model: claude-opus-4-6 (same as Council)
- Council context passed as `<documents>` block in user message

## Resume Point
If context is lost, read this file + `docs/GROUNDWORK_DESIGN.md` + current code state.
