# Prebloom Product Handbook

> The source of truth for what Prebloom is, how it works, and why it exists.
> Every build decision, prompt change, and feature should trace back to this doc.

---

## What Prebloom Is

Prebloom is an AI-powered startup idea validator that gives founders the honest, structured feedback they can't get anywhere else. It runs your idea through an adversarial council of AI agents — one builds the strongest case for it, one tries to kill it, and a final voice delivers a clear verdict with concrete next steps. If the idea survives, a second layer (Groundwork) builds the strategic foundation you need to execute.

**One sentence:** The mentor you wish you had — but available in 90 seconds, for any idea, any time.

---

## Who It's For

Solo founders, indie hackers, and pre-seed teams who are stuck in the "should I build this?" loop. People with ideas but no trusted advisor to pressure-test them. Not enterprise. Not VCs. Not people who already raised a Series A.

**The user we're building for:** Someone with a job, a side idea, and no co-founder to argue with at 11pm.

---

## Brand Persona

**A master founder talking to a founder.**

Not a consultant. Not an AI. Not a report generator. A seasoned founder who's been through it — the wins, the failures, the pivots — giving honest, direct advice over a coffee table.

### Tone Principles
- **Direct and warm** — says the hard truth but with care
- **Specific, not generic** — concrete examples, real numbers, named competitors
- **Convicted** — confident enough to give a verdict, humble enough to flag uncertainty
- **Founder-native** — no consulting jargon, no MBA frameworks
- **Screenshottable** — the kind of advice founders send to their co-founder at 2am

### Sounds like
> "You have maybe a 6-month window before this gets commoditized. Ship the MVP in two weeks, run the blind test, and let the data decide."

### Doesn't sound like
> "The competitive landscape analysis reveals suboptimal differentiation vectors."

---

## The Two Layers

Prebloom has two distinct layers that map to the two questions every founder asks:

| Layer | Question | Time | Cost |
|-------|----------|------|------|
| **Council** (Validation) | "Should I build this?" | ~75s | Free / cheap |
| **Groundwork** (Execution) | "How do I build this?" | ~10min | Paid |

The Council is the hook. Groundwork is the value. They're connected — Groundwork inherits everything from the Council and picks up where it left off.

---

## Layer 1: The Council (Validation)

### Purpose
Give founders a clear, honest signal on whether their idea is worth pursuing. Break the "should I build this?" loop.

### How It Works
A founder submits their idea (problem, solution, target market, business model). Four agents process it in sequence:

```
Intake → Catalyst + Fire (parallel) → Synthesis
```

### The Agents

#### 1. Intake Analyst
- **Job:** Turn messy founder input into a structured brief
- **Personality:** Precise, thorough, neutral
- **Output:** One-liner, summary, classification, value prop, implicit assumptions, gaps, red flags
- **Search:** None (pure reasoning)

#### 2. Catalyst (The Believer)
- **Job:** Build the strongest honest case FOR the idea
- **Personality:** Enthusiastic but grounded — finds genuine opportunity, doesn't inflate weak ideas
- **Output:** Why this could work, fastest path to users, dimension scores
- **Search:** 0-1 (only if genuinely needed to verify a fact)

#### 3. Firing Squad (The Skeptic)
- **Job:** Try to kill the idea. If it survives, it's probably worth building.
- **Personality:** Harsh but fair — attacks the idea, not the founder
- **Output:** Why this fails, cold water truth, top risks, what must be true
- **Search:** 0-1 (only to verify a specific competitor claim)

#### 4. Synthesis (The Final Voice)
- **Job:** Weigh both sides, deliver the verdict
- **Personality:** Decisive, warm, direct — the master founder voice
- **Output:** Verdict (STRONG_SIGNAL / CONDITIONAL_FIT / WEAK_SIGNAL / NO_MARKET_FIT), confidence, dimensions, strengths, risks, next steps, straight talk

### Verdicts
| Verdict | Meaning |
|---------|---------|
| 🟢 STRONG_SIGNAL | Clear opportunity. Risks manageable. Build this. |
| 🟡 CONDITIONAL_FIT | Something here, but specific risks need addressing first. |
| 🟠 WEAK_SIGNAL | Too many open questions. Needs rework or different angle. |
| 🔴 NO_MARKET_FIT | Fundamental problems. Move on. |

### Technical Details
- **Model:** Claude Opus 4 (all agents)
- **Total runtime:** ~75 seconds
- **Search budget:** 2 max (Catalyst 1, Fire 1)
- **Output contract:** Structured JSON from Synthesis, markdown from others

---

## Layer 2: Groundwork (Execution)

### Purpose
Turn the council's verdict into an actionable foundation. The work a strategic co-founder would do in the first 2 weeks — the stuff most solo founders skip.

### When It Triggers
After a council evaluation. Groundwork inherits the full council context: intake brief, Catalyst's bull case, Fire's risks, Synthesis verdict and next steps. It doesn't start from scratch — it picks up the thread.

### The Persona Shift
Same master founder voice, but the mode shifts. Council was *evaluating* — "should you build this?" Groundwork is *planning* — "here's how you build this." Less debate, more blueprints.

### The Flow

Two sequential phases:

#### Phase A: Intelligence (research-heavy)
**Question:** "Who am I up against and is there room?"

This phase needs deep web research — real data, verified competitors, actual numbers. Not LLM reasoning from training data.

**Deliverables:**
1. **Competitor Battle Cards** — Top 3-5 competitors, side by side: pricing, features, funding, weaknesses, positioning. One page per competitor. Verified with real web data.
2. **Market Sizing** — TAM/SAM/SOM with methodology and sources. Not hallucinated numbers — sourced from real reports, articles, data.
3. **Gap Analysis** — Where are the holes? What's nobody doing? What are competitors bad at? This is where the founder's opportunity lives.

**Characteristics:**
- Heavy web search (8-10+ searches)
- Verification matters — cite sources, flag uncertainty
- Can parallelize: one agent per competitor
- Takes longer (~5-8 min)

#### Phase B: Blueprint (reasoning-heavy)
**Question:** "What do I do first?"

This phase synthesizes everything — council verdict + Phase A intelligence — into an actionable plan. Minimal search, heavy reasoning.

**Deliverables:**
4. **Customer Personas** — 2-3 ideal customer profiles: who they are, where to find them, what they pay for today, what pain they have. Specific enough to write an ad targeting them.
5. **Positioning & Go-to-Market** — How to position against the competitors found in Phase A. First 90 days: channels, tactics, metrics, budget estimate.
6. **MVP Scope** — What to build first. What NOT to build. The absolute minimum to test the core thesis from the council verdict. Technical stack recommendations if relevant.

**Characteristics:**
- Uses all prior context (council + Phase A)
- Reasoning-heavy, minimal search
- Sequential (needs Phase A output)
- Faster (~3-5 min)

### Output Format
Not a 30-page report. Founders don't read those. Each deliverable: **one page max**, scannable, actionable. The kind of thing you pin on a wall or paste into a Notion doc. Battle cards, not business plans.

### Technical Details (TBD)
- **Model:** TBD (Opus for reasoning, potentially Gemini for deep research)
- **Search budget:** 8-10+ per Phase A agent
- **Total runtime target:** ~10 minutes
- **API endpoint:** `/prebloom/groundwork/research` (exists, needs rework)

---

## Pricing Model

Three tiers mapping to the founder's journey:

| Tier | What | Price | Maps to |
|------|------|-------|---------|
| **Free** | 2-3 council evaluations | €0 | "Is this tool worth my time?" |
| **Paid Validation** | Unlimited council + iteration mode | TBD (~€19/mo or €7-9/report) | "Should I build this?" |
| **Paid Groundwork** | Full intelligence + blueprint package | TBD (~€49-99/report) | "How do I build this?" |

### Open Questions
- Free cap: per month or lifetime?
- Validation: subscription vs pay-per-report?
- Groundwork: per-report or bundled?
- Gate iteration mode behind paid?

---

## Pipeline Performance

Current V1.6.2 benchmarks (Council layer):

| Metric | Value |
|--------|-------|
| Model | Claude Opus 4 |
| Total runtime | ~75s |
| Intake | ~25-28s |
| Catalyst + Fire (parallel) | ~25s |
| Synthesis | ~22s |
| Searches | 2 max |
| Tokens per run | ~16k in / ~3.5k out |
| Cost per run | ~$0.25 |

See `docs/CHANGELOG_PIPELINE.md` for full history of changes and experiments.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                 PREBLOOM                      │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  LAYER 1: COUNCIL (Validation)          │ │
│  │                                          │ │
│  │  Founder Input                           │ │
│  │       ↓                                  │ │
│  │  [Intake] → [Catalyst] + [Fire] → [Syn] │ │
│  │       ↓                                  │ │
│  │  Verdict + Next Steps                    │ │
│  └──────────────┬──────────────────────────┘ │
│                 ↓ (if founder proceeds)       │
│  ┌──────────────┴──────────────────────────┐ │
│  │  LAYER 2: GROUNDWORK (Execution)        │ │
│  │                                          │ │
│  │  Phase A: Intelligence                   │ │
│  │  [Competitors] [Market] [Gaps]           │ │
│  │       ↓                                  │ │
│  │  Phase B: Blueprint                      │ │
│  │  [Personas] [GTM] [MVP Scope]            │ │
│  │       ↓                                  │ │
│  │  Execution-Ready Foundation              │ │
│  └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## Key Decisions Log

| Date | Decision | Why |
|------|----------|-----|
| 2026-02-28 | V2 multi-persona prompts shelved | Too slow, too expensive |
| 2026-02-28 | Prompt engineering skill: use selectively | Full framework adds bloat |
| 2026-02-28 | V1.6 prompts: advisor tone, 400-word caps | Speed + readability |
| 2026-02-28 | Intake optimization: concise one-liners | Cut 15s from pipeline |
| 2026-02-28 | Upgraded to Opus | Same speed, much better quality |
| 2026-02-28 | Brand persona: master founder voice | Emerged from Opus output testing |
| 2026-02-28 | Two-phase Groundwork design | Intelligence (research) → Blueprint (reasoning) |

---

## Change Control

**Rule:** Any change that could break or alter product behavior → check with Sam first.

**Safe (do freely):** Formatting, docs, tests, logging, non-functional changes.

**Needs approval:** Prompts, agent logic, API contracts, schema, pricing, model changes.

---

## Related Documents

- `docs/BRAND_PERSONA.md` — Detailed brand voice and persona
- `docs/CHANGELOG_PIPELINE.md` — Engineering log of all pipeline changes
- `docs/PROPOSED_CHANGES_V1.6.md` — V1.6 change proposal (historical)
- Trello board: https://trello.com/b/AuhfrcHQ/prebloom
