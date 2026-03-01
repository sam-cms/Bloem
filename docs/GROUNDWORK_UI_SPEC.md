# Groundwork UI Spec — "Reverse Star Wars Crawl"

**Date:** March 1, 2026
**Status:** Approved by Sam, ready to build

---

## Overview

After a user receives their Council verdict, they see a "Groundwork" section with a single
"Run Groundwork" button. When clicked, a cinematic reverse Star Wars text crawl plays,
showing live agent progress and key findings as they arrive. When complete, the crawl
fades into the full Groundwork report with expandable agent cards.

---

## The Reverse Crawl Animation

**Direction:** Text appears small in the distance (top of viewport) and flows TOWARD
the viewer (grows larger, moves down). Opposite of the classic Star Wars crawl.

**What each line shows:**
- Stage announcements: "Finding your competitors..." / "Sizing your market..."
- Live key findings from each agent as they complete, e.g.:
  - "DimeADozen — $49/report, 85K users"
  - "TAM: $1.08B across 5M founders"
  - "Gap found: No adversarial mode exists anywhere"

**Visual style:**
- Dark background (matches Prebloom KRONOS theme)
- Neo-green text (#00FF88 or similar from existing palette)
- 3D CSS perspective: text has depth, starts small/faded, grows as it approaches
- Smooth continuous scroll, not jumpy
- Lines fade out as they pass the viewer (bottom of viewport)

**Timing:**
- New lines appear as each agent produces output (~every 30-60s)
- Between agent outputs, show subtle "thinking" lines: "Analyzing gaps..." / "Building personas..."
- Total duration: ~6 minutes (matches pipeline runtime)

---

## Backend: Server-Sent Events (SSE)

### New endpoint: `POST /prebloom/groundwork/run`

Accepts: `{ evaluationId: string }`
Returns: SSE stream with events:

```
event: stage
data: {"agent": "competitorIntelligence", "status": "running", "label": "Finding your competitors..."}

event: headline
data: {"agent": "competitorIntelligence", "text": "DimeADozen — $49/report, 85K users"}

event: headline
data: {"agent": "competitorIntelligence", "text": "ValidatorAI — rated 4.85/5, 200K+ users"}

event: stage
data: {"agent": "competitorIntelligence", "status": "complete"}

event: stage
data: {"agent": "marketSizing", "status": "running", "label": "Sizing your market..."}

event: headline
data: {"agent": "marketSizing", "text": "TAM: $1.08B — 5M founders globally"}

... (continues for all 6 agents)

event: complete
data: {"groundworkId": "uuid", "evaluationId": "uuid"}
```

### How headlines are extracted

After each agent completes, a lightweight extraction step pulls 2-3 key
headlines from the agent output. Options:
1. **Regex/heuristic:** Pull first bold line, first number, first competitor name
2. **Cheap LLM call (Haiku):** "Extract 2-3 key headlines from this analysis" (~$0.001)
3. **Structured output:** Add headline extraction to agent prompts themselves

Recommendation: Option 1 (regex) for V1 — no extra cost, fast.

### Groundwork result retrieval

After `event: complete`, frontend calls:
`GET /prebloom/groundwork/:evaluationId`
Returns full GroundworkResult JSON.

---

## Frontend Components

### 1. Groundwork CTA Section (after verdict)

Shows below the verdict/TL;DR:

```
┌─────────────────────────────────────────┐
│  Your idea scored. Now let's build.     │
│                                         │
│  The Council told you IF your idea has  │
│  potential. Groundwork tells you HOW    │
│  to move forward.                       │
│                                         │
│  Phase A: Intelligence                  │
│  • Competitor Battle Cards              │
│  • Market Sizing                        │
│  • Gap Analysis                         │
│                                         │
│  Phase B: Blueprint                     │
│  • Customer Personas                    │
│  • GTM Playbook                         │
│  • Focus First                          │
│                                         │
│       [ Run Groundwork →  ]             │
│                                         │
└─────────────────────────────────────────┘
```

### 2. Crawl Animation (while running)

Full-screen overlay with the reverse Star Wars crawl.
- CSS perspective + transform for 3D depth
- Lines flow from distance toward viewer
- Semi-transparent dark overlay on top of existing UI

### 3. Groundwork Report (after complete)

6 expandable cards, organized by phase:

```
Phase A: Intelligence
├── Competitor Battle Cards  [▼ expand]
├── Market Sizing            [▼ expand]
└── Gap Analysis             [▼ expand]

Phase B: Blueprint
├── Customer Personas        [▼ expand]
├── GTM Playbook             [▼ expand]
└── Focus First              [▼ expand]
```

Each card:
- Collapsed: agent name + icon + 1-line summary
- Expanded: full markdown-rendered output

---

## Groundwork Tab Replacement

The current "Groundwork" tab with static "COMING IN V2" cards gets replaced with:
- If Groundwork hasn't been run: show the CTA section (point 1 above)
- If Groundwork is running: show the crawl animation (point 2)
- If Groundwork is complete: show the report cards (point 3)

---

## Brand Tone

The CTA text and stage labels should match the Prebloom persona:
"A master founder talking to a founder."

Not: "Initiating competitive analysis module..."
Yes: "Finding your competitors..."

Not: "Market sizing computation in progress"
Yes: "Let's see how big this market really is..."

---

## Future: Pricing Gate

For now: Groundwork runs free (testing phase).
Later: The CTA section shows locked cards with "Upgrade to Plus" or "Buy this run — €X"
for non-Plus users. Architecture should support this (check user tier before allowing run).

---

## Dependencies

- Backend: SSE streaming from orchestrator, headline extraction
- Frontend: 3D CSS crawl component, SSE client, report cards
- No new npm packages needed (CSS perspective is native, EventSource is native)
