# Prebloom Iteration Feature — Implementation Plan

**Created:** 2026-02-20  
**Status:** In Progress  
**Branch:** `pitch-deck-visuals`

---

## Overview

Allow users to refine their idea based on feedback and re-evaluate. The system runs a full evaluation with context from previous versions, tracks progress across iterations, and caps at 3 iterations to prevent endless loops.

---

## Design Decisions

### Core Principles
1. **Full re-evaluation every time** — Adversarial dynamic (Catalyst vs Fire) must stay intact
2. **Context-aware** — Agents see previous evaluation and what the user tried to fix
3. **Guided, not free-form** — Users respond to specific action items, not rewrite everything
4. **Progress tracking** — Show what's improved, what's still a concern
5. **Iteration cap (3)** — Prevent infinite loops, encourage real-world action
6. **Keep users in the tool** — After cap, offer paths that stay in Prebloom

### Terminology
- "Market Fit Scan" (not "Verdict")
- "AI Squads" (not "Council")
- Decision levels: STRONG_SIGNAL / CONDITIONAL_FIT / WEAK_SIGNAL / NO_MARKET_FIT

---

## Technical Plan

### Phase 1: Backend — Data Model & Storage

**File:** `src/prebloom/types.ts`

Add iteration tracking to Verdict:
```typescript
interface Verdict {
  // ... existing fields ...
  
  // Iteration tracking
  version: number;                    // 1, 2, 3...
  previousId?: string;                // Link to previous version
  actionItems?: ActionItem[];         // Extracted from synthesis
  addressedConcerns?: string[];       // What user claimed to address
}

interface ActionItem {
  id: string;
  concern: string;                    // The weakness/risk
  category: 'market' | 'product' | 'execution' | 'business' | 'timing';
  severity: 'critical' | 'major' | 'minor';
  addressed?: boolean;                // Updated after re-evaluation
}
```

**File:** `src/prebloom/storage/sqlite.ts`

Add columns:
- `version` INTEGER DEFAULT 1
- `previous_id` TEXT (foreign key)
- `action_items_json` TEXT
- `addressed_concerns_json` TEXT

---

### Phase 2: Backend — Action Item Extraction

**File:** `src/prebloom/swarm/action-items.ts` (new)

Extract 3-5 actionable items from synthesis output:
```typescript
export function extractActionItems(synthesis: AgentOutput, fire: AgentOutput): ActionItem[] {
  // Parse synthesis for key risks and weaknesses
  // Parse fire output for critical concerns
  // Dedupe and prioritize
  // Return top 3-5 most actionable items
}
```

Categories to extract from:
- Key Risks section
- Kill Conditions section
- Fire Agent's critical risks
- Low-scoring dimensions

---

### Phase 3: Backend — Iteration Endpoint

**File:** `src/prebloom/api/http-handler.ts`

New endpoint: `POST /prebloom/iterate/:id`

Request body:
```json
{
  "responses": [
    { "actionItemId": "abc123", "response": "We've validated with 50 users..." },
    { "actionItemId": "def456", "response": "Revenue model is now..." }
  ],
  "updatedPitch": {
    "problem": "...",      // Optional: can update any field
    "solution": "...",
    "targetMarket": "...",
    "businessModel": "..."
  }
}
```

Response: Same as evaluate, but with version info.

Logic:
1. Load previous evaluation
2. Check iteration count (max 3)
3. Build context string for agents
4. Run full evaluation with context
5. Compare scores, mark addressed concerns
6. Store with version link

---

### Phase 4: Backend — Context Injection

**File:** `src/prebloom/swarm/orchestrator.ts`

Modify `evaluateIdea()` to accept optional context:
```typescript
interface EvaluationOptions {
  // ... existing ...
  previousEvaluation?: Verdict;
  userResponses?: { actionItemId: string; response: string }[];
}
```

Build context prompt for agents:
```
## Previous Evaluation Context

This idea was previously evaluated (Version 1) with result: CONDITIONAL_FIT (6/10)

Key concerns from previous evaluation:
1. Market timing unclear — User response: "We've validated..."
2. Revenue model weak — User response: "Now charging..."

Evaluate this refined version. Note improvements and any new concerns.
```

---

### Phase 5: Frontend — Iterate Button & Flow

**File:** `frontend/src/App.tsx`

Add to report view:
```tsx
// After report loads, if version < 3
<button onClick={() => setShowIterateModal(true)}>
  Refine & Re-evaluate
</button>

// If version === 3
<div>
  <p>You've refined 3 times. Choose your path:</p>
  <button>Proceed with current assessment</button>
  <button>Start fresh with a new idea</button>
  <button>Pivot to a related concept</button>
</div>
```

---

### Phase 6: Frontend — Action Items UI

**File:** `frontend/src/components/IterateModal.tsx` (new)

```tsx
function IterateModal({ verdict, onSubmit, onClose }) {
  const [responses, setResponses] = useState({});
  
  return (
    <div className="modal">
      <h2>Refine Your Idea</h2>
      <p>Address these concerns to strengthen your pitch:</p>
      
      {verdict.actionItems.map(item => (
        <div key={item.id} className="action-item">
          <div className="concern">
            <span className={`severity ${item.severity}`} />
            {item.concern}
          </div>
          <textarea
            placeholder="How have you addressed this?"
            value={responses[item.id] || ''}
            onChange={e => setResponses({...responses, [item.id]: e.target.value})}
          />
        </div>
      ))}
      
      <button onClick={() => onSubmit(responses)}>
        Re-evaluate (Version {verdict.version + 1}/3)
      </button>
    </div>
  );
}
```

---

### Phase 7: Frontend — Progress View

**File:** `frontend/src/components/VersionProgress.tsx` (new)

Show iteration history:
```
V1: 52/100 → V2: 64/100 → V3: 71/100
    ↑            ↑
  Market       Revenue
  Timing       Model
```

Concerns tracker:
```
✓ Market timing — addressed in V2
✓ Revenue model — addressed in V3
○ Competitive moat — still a concern
```

---

## API Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/prebloom/evaluate` | Initial evaluation (V1) |
| GET | `/prebloom/evaluate/:id` | Get evaluation status/result |
| POST | `/prebloom/iterate/:id` | Submit iteration (V2, V3) |
| GET | `/prebloom/history/:id` | Get full version chain |

---

## Implementation Order

1. [x] Design complete
2. [x] **Backend: Types & Storage** — Add iteration fields to Verdict (ActionItem, version, previousId)
3. [x] **Backend: Action Item Extraction** — Parse synthesis/fire for actionable items (`action-items.ts`)
4. [x] **Backend: Iteration Endpoint** — POST /prebloom/iterate/:id + GET /prebloom/history/:id
5. [x] **Backend: Context Injection** — Modify orchestrator for context-aware evaluation
6. [x] **Frontend: Iterate Button** — Add to report header with version badge
7. [x] **Frontend: Iterate Modal** — Action items response UI (`IterateModal.tsx`)
8. [x] **Frontend: Cap Handling** — 3-iteration limit message in header
9. [ ] **Frontend: Progress View** — Version history visualization (optional, can add later)
10. [ ] **Testing** — End-to-end iteration flow

---

## Open Questions

- Should we allow editing the original pitch fields during iteration, or only respond to action items?
  - **Decision:** Allow both — responses to action items + optional pitch updates
  
- How long to retain iteration history?
  - **Decision:** Indefinitely (for now), user can start fresh anytime

- Should iteration 2-3 be cheaper (fewer tokens)?
  - **Decision:** No — full evaluation needed for adversarial dynamic

---

## Files to Modify/Create

**Backend:**
- `src/prebloom/types.ts` — Add ActionItem, iteration fields
- `src/prebloom/storage/sqlite.ts` — Schema updates
- `src/prebloom/swarm/action-items.ts` — NEW: extraction logic
- `src/prebloom/swarm/orchestrator.ts` — Context injection
- `src/prebloom/api/http-handler.ts` — Iterate endpoint

**Frontend:**
- `frontend/src/App.tsx` — Iterate button, flow control
- `frontend/src/components/IterateModal.tsx` — NEW: action items UI
- `frontend/src/components/VersionProgress.tsx` — NEW: history view

---

## Notes

- Keep terminology consistent: "Market Fit Scan", "AI Squads", decision levels
- Wording matters: encourage without being sycophantic, clear without being harsh
- After 3 iterations: "Proceed / Pivot / Fresh Start" — all paths stay in Prebloom
