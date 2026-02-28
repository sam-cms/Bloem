# Groundwork V1 — Agent Design

> Reference: VC Due Diligence Prompts analysis (Feb 28, 2026)
> Source: LinkedIn viral post — 12 enterprise-grade VC prompts
> Our advantage: Context continuity from Council, real web search, pipeline metrics

---

## What Groundwork Inherits

Every Groundwork run receives the full Council context:
- **Intake brief** — structured idea, classification, assumptions, gaps
- **Catalyst analysis** — bull case, fastest path to users, dimension scores
- **Fire analysis** — bear case, risks, what must be true
- **Synthesis verdict** — decision, strengths, risks, next steps, straight talk

This is our moat vs disconnected prompts. The Groundwork agents don't start from zero.

---

## Phase A: Intelligence (research-heavy)

### Agent A1: Competitor Intelligence
**Job:** Find and profile the real competitors. Verified data, not guesses.

**Output: Battle Cards** (one per competitor, 3-5 competitors)

Each card contains:
- Company name + website (verified)
- What they do (2 sentences)
- Funding raised + investors (if known)
- Pricing model and tiers
- Key features / what they're good at
- Weaknesses / what users complain about
- Market share estimate (if available)
- How the founder's idea differs from this competitor

**Also produces:**
- Competitive positioning summary (where does the founder's idea sit?)
- White space analysis (what's nobody doing?)
- Biggest competitive threat (which one could kill this idea?)

**Search budget:** 3-5 searches (targeted: "[competitor] pricing funding 2024")
**Benchmark targets to include:** Reference pricing ranges in the space

---

### Agent A2: Market Sizing
**Job:** Calculate TAM/SAM/SOM with real methodology and sources.

**Output: Market Sizing Brief** (one page)

Contains:
- **TAM** — total market if 100% share, with methodology shown
- **SAM** — realistic serviceable market with current product scope
- **SOM** — capturable share in 3-5 years with reasoning
- **Growth rate** — CAGR (historical + projected)
- **Market drivers** — 3-5 trends expanding or contracting the market
- **Market maturity** — early / growth / mature / declining
- **Adjacent markets** — natural expansion opportunities
- **Geographic clusters** — where to focus first

**Search budget:** 3-5 searches (targeted: market reports, industry data)
**Benchmark:** Include what "good" looks like — "SaaS companies typically capture 1-5% SOM in year 1"

---

### Agent A3: Gap & Opportunity Analysis
**Job:** Synthesize A1 + A2 outputs. Where are the holes?

**Output: Opportunity Map** (one page)

Contains:
- **Underserved segments** — customer groups competitors ignore
- **Feature gaps** — what competitors don't offer that users want
- **Pricing gaps** — underserved price points
- **Geographic gaps** — markets competitors haven't entered
- **Timing opportunities** — regulatory changes, tech shifts, market events
- **The founder's wedge** — specific recommendation for where to enter

**Search budget:** 0-1 (mostly reasoning from A1 + A2 data)
**Note:** This agent bridges Phase A → Phase B. Its output shapes the Blueprint.

---

## Phase B: Blueprint (reasoning-heavy)

### Agent B1: Customer Personas
**Job:** Define exactly who to build for and where to find them.

**Output: 2-3 ICP Cards** (one page each)

Each card contains:
- **Who they are** — demographics, role, company size
- **Their pain** — specific problem they have today (not generic)
- **Current solution** — what they use now and why it sucks
- **Where to find them** — specific communities, channels, platforms
- **What they'd pay** — willingness to pay based on current spending
- **Messaging hook** — one sentence that would make them click
- **Acquisition channel** — how to reach them cost-effectively

**Search budget:** 0-1
**Benchmark:** "A strong ICP should be specific enough to write a targeted ad"

---

### Agent B2: Positioning & Go-to-Market
**Job:** How to enter the market and win against the competitors found in Phase A.

**Output: GTM Playbook** (one page)

Contains:
- **Positioning statement** — one paragraph: for [who], who [problem], [product] is a [category] that [differentiator]
- **Messaging framework** — headline, subline, 3 proof points
- **Channel strategy** — top 3 channels ranked by expected ROI, with estimated CAC
- **First 30 days** — specific actions, in order, with expected outcomes
- **First 90 days** — milestones and metrics to hit
- **Budget estimate** — what it costs to execute this plan (can be $0 for organic)
- **Key metric to watch** — the one number that tells you it's working

**Search budget:** 0-1
**Benchmark:** Include target metrics — "aim for 3-5% landing page conversion"

---

### Agent B3: MVP Scope
**Job:** Define what to build first and — equally important — what NOT to build.

**Output: MVP Blueprint** (one page)

Contains:
- **Core thesis to test** — the one assumption this MVP validates
- **Must-have features** — 3-5 features, no more
- **Explicitly NOT building** — features to resist (scope defense)
- **Technical approach** — recommended stack/tools (keep it simple)
- **Build timeline** — realistic estimate for a solo founder or small team
- **Success criteria** — specific metrics that prove the MVP worked
- **Failure signals** — what tells you to stop or pivot
- **Cost to build** — estimated $0 to launch number

**Search budget:** 0
**Benchmark:** "A good MVP can be built in 2-4 weeks by one person"

---

## Flow Diagram

```
Council Verdict (inherited context)
        ↓
┌── Phase A: Intelligence ──────────────────┐
│                                            │
│  [A1: Competitors] ←→ [A2: Market Sizing] │  (parallel)
│         ↓                    ↓             │
│         └──→ [A3: Gap Analysis] ←──┘       │  (sequential, needs A1+A2)
└────────────────────┬───────────────────────┘
                     ↓
┌── Phase B: Blueprint ─────────────────────┐
│                                            │
│  [B1: Personas]                            │
│  [B2: GTM Playbook]                        │  (can run in parallel)
│  [B3: MVP Scope]                           │
└────────────────────────────────────────────┘
                     ↓
            Execution-Ready Package
```

---

## Persona & Tone

Same master founder voice as the Council, but shifted:
- Council = **evaluating** ("should you build this?")
- Groundwork = **planning** ("here's how you build this")
- Less debate, more blueprints
- Still direct and specific — no consulting fluff
- Every deliverable should feel like a senior co-founder did the work

---

## Output Principles

1. **One page max per deliverable.** Founders don't read 30-page reports.
2. **Scannable.** Headers, bullets, tables. Not paragraphs.
3. **Actionable.** Every section should answer "so what do I do?"
4. **Benchmarked.** Include what "good" looks like — target metrics, reference points.
5. **Sourced.** Phase A cites real data. Flag when something is estimated vs verified.
6. **Screenshottable.** The kind of output you'd paste into a Notion doc or pitch deck.

---

## Technical Plan

| Aspect | Detail |
|--------|--------|
| Model | Claude Opus 4 (all agents) |
| Phase A search budget | A1: 3-5, A2: 3-5, A3: 0-1 — total ~8-10 |
| Phase B search budget | B1: 0-1, B2: 0-1, B3: 0 — total ~1-2 |
| Total runtime target | ~8-12 minutes |
| Cost estimate | ~$1-2 per run (Opus + searches) |
| API endpoint | `/prebloom/groundwork/:evaluationId` (triggers from a completed evaluation) |
| Storage | Results linked to evaluation ID in Supabase |
| Metrics | Same pattern as Council: per-agent timing, tokens, searches |

---

## Inspiration Sources

### From VC Prompt Vault (what we borrowed)
- TAM/SAM/SOM framework with methodology shown (Prompt #1)
- Competitive intelligence structure with funding + pricing + weaknesses (Prompt #2)
- Channel-by-channel CAC analysis (Prompt #9)
- "Format as [specific document]" pattern for every output
- Inline benchmarks (LTV:CAC 3:1, NPS 50+) — we adapt these for pre-seed founders

### What we do differently
- Context continuity from Council (they have disconnected prompts)
- Real web search for verified data (they rely on LLM training data)
- Pipeline metrics and quality tracking
- Master founder persona (they role-play as VC partners — wrong audience for B2C)
- One-page outputs (they produce verbose memos)

---

## V2 Additions (Coming Soon)

These build on V1 outputs:
- **Unit Economics Model** — needs pricing data from A1, market data from A2
- **Investment Memo** — synthesizes entire Groundwork into investor-ready one-pager
- **Founder/Team Fit** — needs to know what the idea requires vs what founder brings
- **Revenue Projections** — needs market sizing + pricing + personas

---

*Last updated: 2026-02-28*
