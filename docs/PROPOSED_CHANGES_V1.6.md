# Proposed Changes: V1.5 → V1.6 (Speed + Tone)

**Goal:** Faster first result (~60-90s), friendlier tone, less verbose output.
**No structural changes** — same 4-agent pipeline, same JSON contract.

---

## Change 1: Search Budget (orchestrator.ts)

### Before
```
Intake: maxSearches 1
Catalyst: maxSearches 3
Fire: maxSearches 3
Synthesis: maxSearches 0
Total: up to 7 searches
```

### After
```
Intake: maxSearches 0 (just structures the input, no search needed)
Catalyst: maxSearches 1 (search ONLY if genuinely needed)
Fire: maxSearches 1 (search ONLY to verify a specific claim)
Synthesis: maxSearches 0
Total: up to 2 searches (down from 7)
```

**Why:** Each search adds ~5-10s. Going from 7 → 2 max saves 30-50s.

---

## Change 2: Intake Prompt

No changes — already clean. Just loses search access.

---

## Change 3: Catalyst Prompt (tone + brevity)

**Key changes:**
- Friendly advisor tone, not consulting report
- 5 dimensions (removed Market Timing, Solution Elegance, Scalability → consolidated)
- Removed: "The 10x Version", "Hidden Gem" sections
- Added: 400 word limit
- Output: "Why This Could Work" + "Fastest Path to Users" + Scores

---

## Change 4: Fire Prompt (tone + brevity)

**Key changes:**
- Same harsh-but-fair tone, just more concise
- Top 3 risks only (not unlimited table)
- Removed: Risk severity table, Kill Conditions (moved to Synthesis)
- Added: 400 word limit
- Output: "Why This Fails" + "Cold Water" + "Top Risks" + "What Must Be True"

---

## Change 5: Synthesis Prompt (biggest change)

**Key changes:**
- Coffee-table friend tone
- Exactly 3 strengths, 3 risks, 3 next steps (ruthless prioritization)
- Removed: strongestBullCase, strongestBearCase, evidenceAssessment fields
- Added: 60-word limits on straightTalk and executiveSummary
- Simpler JSON contract

---

## Expected Impact

| Aspect | V1.5 (current) | V1.6 (proposed) |
|--------|----------------|-----------------|
| Total searches | Up to 7 | Up to 2 |
| Expected runtime | ~3 min | ~60-90s |
| Catalyst output | ~800 words | ~400 words |
| Fire output | ~800 words | ~400 words |
| Synthesis arrays | Unlimited | 3 each |
| Tone | Consulting report | Trusted friend |
| Removed | — | 10x Version, Hidden Gem, Bull/Bear quotes |

## What stays the same
- 4-agent pipeline (Intake → Catalyst + Fire → Synthesis)
- JSON output from Synthesis
- 4 verdict options
- 5 dimension scoring (1-10)
- Action items extraction
- Supabase storage
- Frontend display logic
