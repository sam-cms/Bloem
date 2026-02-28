# Prebloom Pipeline Changelog

Engineering log of pipeline changes, experiments, and performance data.

---

## V1.5 → V1.6 (2026-02-28)

### Changes
- **Prompts:** Shorter, "trusted advisor" tone, 400-word caps on Catalyst/Fire
- **Search budget:** 7 → 2 max (Intake 0, Catalyst 1, Fire 1)
- **Metrics:** Per-agent duration, tokens, searches added to API response
- **Served flag:** Track if result was delivered to client

### Why
- V1.5 was too slow (~192s) and verbose (consulting report tone)
- V2 (multi-persona councils, XML tags) was even slower and more expensive — shelved
- Prompt engineering skill applied selectively (structure + guardrails only, not full framework)

### Performance (V1.5 baseline → V1.6)
| Metric | V1.5 | V1.6 |
|--------|------|------|
| Total time | 192s | 75-90s |
| Total tokens | ~20k | ~17k |
| Searches | 7 | 2 |
| Cost estimate | ~$0.08 | ~$0.05 |

### V1.6 Run Data (all claude-sonnet-4-6)
| Run | Total | Intake | Catalyst | Fire | Synthesis | Verdict |
|-----|-------|--------|----------|------|-----------|---------|
| Freelancer tracker | 81s | 31s/1159out | 25s/834out | 25s/798out | 24s/938out | CONDITIONAL_FIT 5/10 |
| Prebloom self-test | 85s | 35s/1285out | 24s/868out | 27s/872out | 29s/1009out | CONDITIONAL_FIT 6/10 |
| Restaurant orders | ~90s | ~36s | ~25s | ~27s | ~23s | CONDITIONAL_FIT 5/10 |
| Smart plant pot | 75s | 30s/1149out | 24s/770out | 24s/839out | 21s/808out | WEAK_SIGNAL 7/10 |
| Dog camera | 80s | 34s/1212out | 24s/746out | 23s/825out | 23s/854out | CONDITIONAL_FIT 4/10 |
| Prebloom (Sam's run) | 90s | 40s/1498out | 25s/820out | 27s/829out | 23s/878out | CONDITIONAL_FIT 6/10 |

### Observations
- Intake is the bottleneck: ~30-40s, always the longest stage
- Intake slowness correlates with output token count (not input)
- Catalyst+Fire run in parallel — wall time is max(Catalyst, Fire)
- Catalyst/Fire/Synthesis all cluster around 22-27s with 750-900 output tokens
- Model: claude-sonnet-4-6 for all stages, no variation

### Known Issues
- `straightTalk` field sometimes None in API (parser mapping issue)
- Supabase has no `metrics` or `served` columns — stored in-memory only
- Supabase write failures silently swallow results (error logging added)

---

## V1.6.1 — Intake Optimization (2026-02-28, in progress)

### Hypothesis
Trimming Intake output verbosity (not content) will cut Intake time by ~10-15s without affecting verdict quality.

### Changes
- Keep all "juicy" assumptions, gaps, red flags — don't cap the count
- Compress each to one line (drop paragraph explanations)
- Target: ~800 output tokens (down from 1,100-1,500)

### Test Plan
- Run same Prebloom idea with trimmed Intake
- Compare: Intake time, total time, and Synthesis verdict against V1.6 baseline
- If verdict quality drops → revert
- If time drops without quality loss → keep

### Results — PASS ✅
| Metric | V1.6 (baseline) | V1.6.1 (trimmed) | Delta |
|--------|-----------------|-------------------|-------|
| Total time | 90.9s | 70.7s | -22% |
| Intake time | 40.5s | 25.1s | -38% |
| Intake tokens out | 1,498 | 937 | -37% |
| Total tokens | ~17k | ~16k | -6% |
| Decision | CONDITIONAL_FIT 6/10 | CONDITIONAL_FIT 6/10 | same |
| Quality | Solid | Solid (actually scored higher on 2 dims) | no loss |

**Conclusion:** Trimming Intake verbosity cut 20s from the pipeline with no quality loss. Keeping.

---

## Shelved Approaches

### V2 Multi-Persona Councils (shelved 2026-02-27)
- Each agent contained 3 internal personas (Visionary/Hacker/Strategist for Catalyst)
- XML tag structure, few-shot examples, extensive guardrails
- **Why shelved:** Too slow, too expensive, output too verbose
- **Files:** `src/prebloom/swarm/agents/backup-v2/`

### Full Prompt Engineering Skill (shelved 2026-02-28)
- Applied Anthropic best practices at full intensity
- XML tags for everything, few-shot examples per agent
- **Why shelved:** Added tokens to every call, made prompts heavy
- **Lesson:** Use selectively — structure + guardrails yes, full framework no
