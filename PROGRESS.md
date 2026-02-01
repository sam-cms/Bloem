# Prebloom — Progress Tracker

> **Last Updated:** 2026-02-01 04:45 UTC  
> **Current Branch:** `landing-page-kronos`  
> **Status:** 🟢 Active Development

---

## 🎯 Current Sprint Goals

1. [x] **Pipeline Flow View** — Mermaid diagram of evaluation flow ✅
2. [x] **Pricing Strategy** — Analysis and documentation ✅
3. [~] **History Persistence** — SQLite storage module created, needs integration
4. [ ] **Deep Research Tab** — Agentic market research on-demand
5. [ ] **Iterate Mode** — Refine idea based on feedback
6. [ ] **PDF Export** — Improved report export

---

## 📊 Task Status

### ✅ Completed This Session

1. **Pipeline Flow View** (Mermaid diagram)
   - New "Pipeline" tab in report view
   - Visual flow: Idea → Intake → Catalyst/Fire → Synthesis → Verdict
   - Color-coded phases by score (green/yellow/red)
   - Phase detail cards with summaries

2. **Pricing Strategy Analysis**
   - Competitive research (Torrn, ValidatorAI, IdeaProof, etc.)
   - Pricing tiers defined: Free, Founder ($19), Pro ($9/mo), Enterprise
   - Document: `docs/PRICING-STRATEGY.md`

3. **SQLite Storage Module** (partial)
   - Created `src/prebloom/storage/sqlite.ts`
   - CRUD operations for evaluations
   - Pagination, filtering, stats
   - Needs: Integration with HTTP handler

### 🔄 In Progress

- **History Persistence Integration**
  - Storage module created ✅
  - TODO: Update HTTP handler to use SQLite instead of in-memory Map
  - TODO: Add history endpoint (GET /prebloom/history)
  - TODO: Add history view in frontend

### 📋 Queued (Next Up)

1. **Complete History Integration**
   - Wire up SQLite storage to API
   - Frontend history view

2. **Deep Research Tab**
   - Design: Background agents for market research
   - Competitor analysis, market sizing, trends
   - New tab alongside TL;DR and Full Report

3. **Iterate Mode**
   - "Refine & Re-evaluate" button on report
   - Keep history of iterations
   - Compare versions

4. **PDF Export**
   - Proper formatting
   - Include all sections
   - Branding

---

## 🔬 Feature Designs

### Deep Research Tab (Next Priority)

**Concept:** A "Research" tab that triggers on-demand deep market research.

**What it does:**
- Spawns background agents to research:
  - Market size and TAM/SAM/SOM
  - Competitor analysis (who's doing this?)
  - Trend data (is this growing?)
  - Similar startups (who raised? who failed?)
- Returns structured research report
- Cached per evaluation (don't re-run)

**Implementation:**
- New endpoint: POST /prebloom/research/:jobId
- Background agent with web search capability
- Stores results in job data
- Frontend tab shows cached or triggers new

---

## 🧪 Testing Checklist

Before marking complete:
- [x] Voice input works (medium model)
- [x] Transcription cleanup works (Haiku)
- [x] Full evaluation pipeline works
- [x] TL;DR view renders correctly
- [x] Full report view renders correctly
- [x] Landing page looks correct
- [x] Pipeline Flow view renders correctly
- [ ] History persistence works
- [ ] PDF export works

---

## 📁 Key Files Modified This Session

| Feature | Files |
|---------|-------|
| Pipeline Flow | `frontend/src/App.tsx` (PipelineFlowView component) |
| Pricing | `docs/PRICING-STRATEGY.md` |
| Storage | `src/prebloom/storage/sqlite.ts`, `src/prebloom/storage/index.ts` |

---

## 🔄 Session Handoff Notes

**For next session:**

1. **Read this PROGRESS.md first**
2. Check git status and current branch (`landing-page-kronos`)
3. Run `docker compose -f docker-compose.prebloom.yml ps` to verify services
4. **Continue from "In Progress" section:**
   - Complete SQLite integration with HTTP handler
   - Add history endpoint and frontend view

**Files to update:**
- `src/prebloom/api/http-handler.ts` — Replace in-memory Map with SQLite calls
- `frontend/src/App.tsx` — Add history view

**Known issues:**
- Ollama local cleanup disabled (USE_LOCAL_CLEANUP=false)
- Cron permission error in backend (non-blocking)

---

## 📝 Changelog

### 2026-02-01 04:45 UTC
- Created SQLite storage module for history persistence
- Added better-sqlite3 dependency
- Updated pricing strategy document

### 2026-02-01 04:35 UTC
- ✅ Added Pipeline Flow view with Mermaid diagram
- Shows evaluation flow: Idea → Intake → Catalyst/Fire → Synthesis → Verdict
- Color-coded by score (green/yellow/red)
- Phase details with scores

### 2026-02-01 04:30 UTC
- ✅ Created pricing strategy analysis (docs/PRICING-STRATEGY.md)
- Competitive research: Torrn, ValidatorAI, IdeaProof, ProductGapHunt
- Defined tiers: Free, Founder ($19), Pro ($9/mo), Enterprise

### 2026-02-01 04:25 UTC
- Created PROGRESS.md
- Started sprint planning

---

## 💡 Ideas for Later

- Deep Research with web search agents
- Iterate mode with version comparison
- PDF export with branding
- Email delivery (SendGrid/Resend)
- Share links (unique URLs)
- Usage analytics dashboard
