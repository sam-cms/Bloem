# Prebloom Product Handbook

> The source of truth for what Prebloom is, how it works, and why it exists.
> Every build decision, prompt change, and feature should trace back to this doc.

---

## What Prebloom Is

Prebloom is an AI-powered startup idea validator that gives founders the honest, structured feedback they can't get anywhere else. It runs your idea through an adversarial council of AI agents — one builds the strongest case for it, one tries to kill it, and a final voice delivers a clear verdict with concrete next steps. If the idea survives, a second layer (Groundwork) builds the strategic foundation you need to execute.

**One sentence:** The mentor you wish you had — but available in 90 seconds, for any idea, any time.

---

## Who It's For

### B2C (Phase 1 — now)
Solo founders, indie hackers, side hustlers, aspiring creators, and pre-seed teams who are stuck in the "should I build this?" loop. People with ideas but no trusted advisor to pressure-test them.

| Segment | Description |
|---------|-------------|
| Tech founders | Startup builders, AI/SaaS |
| Non-tech founders | Entrepreneurs with an idea, non-technical |
| Side hustlers | Building on the side of a 9-5 |
| Aspiring creators | YouTubers, Instagrammers wanting a business |

**The common thread:** Has an idea, unsure if it's good, about to invest time and money, needs objectivity before they commit.

### B2B (Phase 2 — after traction)
Institutions that screen startup ideas at volume.

| Segment | Description |
|---------|-------------|
| Accelerators & incubators | Screen applicants at scale |
| Early-stage VCs | Filter deal flow faster |
| Banks with startup programs | Innovation teams, lending decisions |

**Why B2B later:** They can't have enough expert analysts. Volume is exploding, headcount isn't. But we need B2C traction and case studies first.

**Strategy:** B2C builds the product, the brand, and the numbers. B2B is the scale play — enterprise licenses + API access. Land with free pilots at 3 accelerators, expand with case studies into banks and VCs.

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

### Groundwork Roadmap

#### V1 — Build Now
These are the core Groundwork deliverables. Ship these first.

| Deliverable | Phase | Description |
|-------------|-------|-------------|
| Competitor Battle Cards | A: Intelligence | Top 3-5 competitors side by side: pricing, features, funding, weaknesses |
| Market Sizing (TAM/SAM/SOM) | A: Intelligence | With methodology and real sources, not hallucinated numbers |
| Gap Analysis | A: Intelligence | Where are the holes nobody is filling? |
| Customer Personas | B: Blueprint | 2-3 ICPs: who, where to find them, pain points, what they pay for |
| Positioning & Go-to-Market | B: Blueprint | How to position vs competitors, first 90-day plan |
| MVP Scope | B: Blueprint | What to build first, what NOT to build, stack recommendations |

#### V2 — Coming Soon
Higher-value deliverables. Build after V1 proves traction.

| Deliverable | Description | Why valuable |
|-------------|-------------|--------------|
| Unit Economics Model | CAC, LTV, payback period, burn rate projections | Founders need this for any investor conversation |
| Investment Memo / One-Pager | Investor-ready summary with key metrics and thesis | Bridge between "I validated" and "I'm pitching" |
| Founder/Team Fit Assessment | Evaluate team strengths, gaps, hiring priorities | Solo founders need to know what co-founder to seek |
| Retention & Traction Analysis | Growth trajectory modeling, retention curves | For founders who already have early users |
| Comparable Exits Analysis | Similar companies that exited, valuations, acquirers | Context for what success looks like in this space |
| Revenue Projections | Monthly/annual projections with scenario modeling | Required for any serious funding conversation |

#### B2B Extensions — Future
Available when B2B layer launches.

| Deliverable | Description |
|-------------|-------------|
| Portfolio Screening API | Bulk idea evaluation for accelerator intake |
| Deal Flow Filter | VC-grade scoring and ranking |
| IC Presentation Generator | Investment committee-ready memos |
| Risk & Cap Table Analysis | For VCs doing due diligence |

### Technical Details (TBD)
- **Model:** TBD (Opus for reasoning, potentially Gemini for deep research)
- **Search budget:** 8-10+ per Phase A agent
- **Total runtime target:** ~10 minutes
- **API endpoint:** `/prebloom/groundwork/research` (exists, needs rework)

---

## Pricing Model

### B2C Tiers (from V6 pitch deck)

| Tier | What | Price | Maps to |
|------|------|-------|---------|
| **Free** | 2 evaluations | €0 | "Is this tool worth my time?" |
| **Basic** | 10 evaluations/month | €14/month | "Should I build this?" |
| **Plus** | Unlimited evaluations + Groundwork | €30/month | "How do I build this?" |
| **Overage** | Extra reports beyond tier | €2/report | Power users |

### B2B Tiers (Phase 2 — after traction)

| Tier | What | Price |
|------|------|-------|
| **Enterprise** | Unlimited portfolio screening + API | €50K-200K/year |

### Why This Works
- Free tier = lead gen, let them experience the verdict
- €14/month = Netflix pricing, no-brainer for serious founders
- Plus tier = power users who want Groundwork
- 99% gross margin (LLM API costs only)
- Overage ensures power users pay more, unit economics stay healthy

### Open Questions
- Free cap: 2 total or 2/month?
- Gate iteration mode behind Basic or Plus?
- Groundwork: only in Plus, or available as one-time purchase?

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

---

## Handbook Rules

1. **Every new feature must fit this document.** If a proposed feature, change, or direction doesn't align with the vision, persona, flow, or architecture defined here — Bruce flags it to Sam before any work begins.

2. **If it doesn't fit, it doesn't ship.** Not without an explicit decision to update the handbook first. The handbook changes, THEN the code changes. Never the other way around.

3. **Bruce enforces this automatically.** No need for Sam to ask "does this fit?" — Bruce checks against the handbook on every feature, prompt change, or architectural decision and raises conflicts proactively.

---

## Deep Search Architecture — Rate Limit & Token Optimization

> Added: 2026-03-01 | Status: Implemented in Groundwork V1
> ⚠️ REVIEW WITH SAM: The articles below need a joint deep-dive session

### The Problem
Native web search (`web_search_20250305`) is token-heavy — Claude pulls full HTML from websites server-side. A single agent can consume 50-80k input tokens. Running agents in parallel spikes past the org rate limit (30k ITPM on Tier 1).

### Three Optimization Techniques

#### 1. Prompt Caching (biggest win for rate limits)
- **What:** Mark shared context (system prompt, Council verdict) with `cache_control: { type: "ephemeral" }`
- **Why:** Cached input tokens **don't count toward ITPM rate limits**
- **Impact:** Council context (~4k tokens) shared across 6 agents = effectively free after first cache write
- **Also saves money:** Cache reads cost 10% of normal input token price
- **TTL options:** 5 minutes (default) or 1 hour (costs more)
- **Docs:** https://platform.claude.com/docs/en/build-with-claude/prompt-caching

#### 2. Dynamic Filtering (`web_search_20260209`)
- **What:** Newer web search tool version — Claude writes code to filter search results BEFORE loading into context
- **Why:** Basic web search loads full HTML pages (~50-80k tokens). Dynamic filtering keeps only relevant snippets.
- **Impact:** Estimated 50-70% reduction in input tokens per search-heavy agent
- **Requires:** Opus 4.6 or Sonnet 4.6 + code execution tool enabled
- **Docs:** https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool

#### 3. Smart Retry with Token Bucket Awareness
- **What:** Anthropic uses token bucket algorithm — capacity replenishes continuously, not at fixed intervals
- **Why:** Instead of arbitrary 60s waits, read the `retry-after` header from 429 responses and wait exactly that long
- **Impact:** Minimizes idle time while respecting limits
- **Also:** Ramp up traffic gradually to avoid acceleration limits (sharp spikes get throttled even within limits)
- **Docs:** https://platform.claude.com/docs/en/api/rate-limits

### Implementation Strategy
1. Cache Council context across all 6 Groundwork agents
2. Use `web_search_20260209` for dynamic filtering on search-heavy agents (A1, A2)
3. Smart retry: on 429, read `retry-after`, wait, retry (max 3 attempts)
4. Run agents sequentially when on Tier 1 (30k ITPM); switch to parallel when tier upgrades
5. Monitor: track actual input tokens per agent to find optimization opportunities

### Rate Limit Tiers (Anthropic)
| Tier | Deposit | ITPM (Sonnet) | ITPM (Opus) |
|------|---------|---------------|-------------|
| Tier 1 | $5 | 30,000 | 30,000 |
| Tier 2 | $40 | 80,000 | 40,000 |
| Tier 3 | $200 | 200,000 | 100,000 |
| Tier 4 | $400 | 400,000 | 200,000 |

**Note:** Moving to Tier 2 ($40 deposit) would nearly 3x our capacity and likely allow parallel execution again.

### Articles & Resources for Deep-Dive with Sam
> 📌 TODO: Review these together — Sam wants to understand token buckets, caching mechanics, and optimization patterns

1. **Anthropic Rate Limits (official docs)** — Token bucket algorithm, tier system, cache-aware ITPM
   https://platform.claude.com/docs/en/api/rate-limits

2. **Prompt Caching (official docs)** — How to implement, TTL options, cost savings math
   https://platform.claude.com/docs/en/build-with-claude/prompt-caching

3. **Web Search Tool (official docs)** — Basic vs dynamic filtering, max_uses, domain filtering
   https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool

4. **Prompt Caching: 10x Cheaper LLM Tokens (ngrok blog)** — Real benchmarks on latency reduction
   https://ngrok.com/blog/prompt-caching

5. **Anthropic API Pricing & Optimization (Finout)** — Rate limits explained, cost strategies
   https://www.finout.io/blog/anthropic-api-pricing

6. **Token Bucket Algorithm (Wikipedia)** — How continuous replenishment works vs fixed windows
   https://en.wikipedia.org/wiki/Token_bucket

