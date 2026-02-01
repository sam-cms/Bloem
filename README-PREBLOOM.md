# 🌷 Prebloom — AI Startup Idea Validator

<p align="center">
  <img src="frontend/public/prebloom-logo.jpg" alt="Prebloom" width="128">
</p>

<p align="center">
  <strong>Test the ground. Pitch your seed.</strong>
</p>

<p align="center">
  <em>A multi-agent AI system that stress-tests startup ideas before you commit.</em>
</p>

---

## What is Prebloom?

Prebloom evaluates your startup idea through a "Council" of AI agents:

- **Intake** — Understands and structures your idea
- **Catalyst Squad** — Builds the bull case (opportunities, strengths)
- **Fire Squad** — Stress-tests the thesis (risks, weaknesses)
- **Synthesis** — Delivers a verdict with actionable next steps

**Output:** PASS / CONDITIONAL / FAIL with dimension scores and detailed analysis.

---

## Current Status

| Component | Status |
|-----------|--------|
| Core evaluation pipeline | ✅ Working |
| Voice input (local Whisper) | ✅ Working |
| Landing page (KRONOS) | ✅ Complete |
| TL;DR + Full report views | ✅ Complete |
| 13 language support | ✅ Complete |
| Email delivery | 🔲 Planned |
| History persistence | 🔲 Planned |
| User accounts | 🔲 Planned |

**Branch:** `landing-page-kronos`  
**Full roadmap:** [TODO.md](TODO.md)

---

## Quick Start

```bash
# Clone
git clone git@github.com:sam-cms/Bloem.git
cd Bloem
git checkout landing-page-kronos

# Set API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Run
docker compose -f docker-compose.prebloom.yml up --build

# Open
open http://localhost:8080
```

---

## Features

### 🎤 Voice Input
Record your idea by voice. Local Whisper transcription — no cloud APIs, no data leaves your machine.

### 📊 Dimension Scoring
Five dimensions rated 1-10:
- Problem Clarity
- Market Size
- Competition Risk
- Execution Feasibility
- Business Model Viability

### 🎯 Clear Verdict
- **PASS** — Strong idea, proceed with confidence
- **CONDITIONAL** — Promising but needs work on specific areas
- **FAIL** — Critical issues, pivot or iterate first

### 📋 Detailed Reports
- TL;DR view with ASCII scorecard
- Full report with expandable sections
- Key strengths, risks, and next steps

---

## Architecture

```
Frontend (React) → nginx → Backend (Node.js) → Claude API
                              ↓
                        Whisper Service (local STT)
```

See [docs/PREBLOOM.md](docs/PREBLOOM.md) for full architecture details.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js, TypeScript (Bloem Gateway fork)
- **AI:** Anthropic Claude
- **STT:** faster-whisper (local)
- **Infra:** Docker Compose, nginx

---

## Docs

- **Full documentation:** [docs/PREBLOOM.md](docs/PREBLOOM.md)
- **Backlog & roadmap:** [TODO.md](TODO.md)
- **UI design notes:** [docs/UI-NOTES-2026-01-31.md](docs/UI-NOTES-2026-01-31.md)

---

## Why "Prebloom"?

🇳🇱 Netherlands = tulip heritage, birthplace of the stock market.

Prebloom is a Dutch tool for Europe's startup ecosystem. Every great company was once a seed. We help you check the soil before you plant.

---

<p align="center">
  <strong>Amsterdam 🌷</strong>
</p>
