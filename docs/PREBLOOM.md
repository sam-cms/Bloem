# Prebloom — Startup Idea Validator

> **Status:** Active Development  
> **Branch:** `landing-page-kronos`  
> **Last Updated:** 2026-02-01  
> **URL:** http://192.168.68.57:8080

---

## What is Prebloom?

Prebloom is an **AI-powered startup idea validation tool**. Founders submit their idea (text or voice), and a "Council" of AI agents evaluates it from multiple perspectives — bulls, bears, and synthesizers — delivering a structured verdict with actionable feedback.

**Think:** A brutally honest YC partner panel simulation for your startup idea.

**Macro thesis:** Europe needs more startups to catch up in AI. Prebloom is the filter before the bloom — helping founders separate signal from noise before resources are burned.

---

## Current State

### ✅ What's Working

| Feature | Description |
|---------|-------------|
| **Idea Submission** | Text input with multi-line support |
| **Voice Input** | Local speech-to-text via Whisper (no cloud APIs) |
| **Audio Visualizer** | Real-time symmetrical waveform during recording |
| **Multi-Agent Evaluation** | 4-phase council: Intake → Catalyst (bulls) → Fire (bears) → Synthesis |
| **Dimension Scoring** | 5 dimensions rated 1-10: Problem Clarity, Market Size, Competition Risk, Execution, Business Model |
| **Verdict System** | PASS / CONDITIONAL_PASS / FAIL with confidence score |
| **TL;DR View** | Compact scorecard with ASCII-art bars |
| **Full Report View** | Expandable sections with markdown rendering |
| **Landing Page** | KRONOS design (dark, editorial, neo green accent) |
| **Language Support** | 13 European languages (auto-detect or explicit) |
| **Skills System** | Humanizer + transcription cleanup |

### 🏗️ What's Not Done Yet

See [TODO.md](../TODO.md) for full backlog. Key items:

- Email delivery of reports
- Persistent history (currently in-memory)
- Iteration mode (refine and re-evaluate)
- Share links / PDF export
- User accounts

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│              http://localhost:8080                       │
│  • Landing page (KRONOS design)                         │
│  • Voice recording with visualizer                       │
│  • Idea submission form                                  │
│  • Report display (TL;DR + Full)                        │
└────────────────────────┬────────────────────────────────┘
                         │ nginx reverse proxy
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend (Bloem Gateway)                 │
│              http://localhost:3001                       │
│  • POST /prebloom/evaluate — Submit idea                │
│  • GET  /prebloom/evaluate/:id — Poll results           │
│  • POST /prebloom/transcribe — Voice → text             │
│  • GET  /prebloom/skills — List available skills        │
│  • GET  /prebloom/health — Health check                 │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                              ▼
┌──────────────────┐          ┌──────────────────┐
│  Whisper Service │          │   Anthropic API  │
│  (faster-whisper)│          │   (Claude)       │
│   Local STT      │          │   Evaluation     │
└──────────────────┘          └──────────────────┘
```

---

## Evaluation Flow

1. **User submits idea** (text or voice)
2. **Intake phase** — Parse and structure the idea
3. **Catalyst Squad** — Build the bull case (opportunities, strengths)
4. **Fire Squad** — Stress-test (risks, weaknesses, market threats)
5. **Synthesis** — Combine perspectives, score dimensions, render verdict
6. **Report delivered** — TL;DR scorecard + expandable full report

---

## Key Files

```
bloem-source/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Main UI (landing, input, processing, report)
│   │   └── components/
│   │       └── AudioVisualizer.tsx # Web Audio API frequency visualizer
│   └── public/
│       └── prebloom-logo.jpg       # Neon tulip logo
├── src/
│   └── prebloom/
│       ├── api/
│       │   └── http-handler.ts     # REST API endpoints
│       ├── swarm/
│       │   ├── orchestrator.ts     # Multi-agent evaluation logic
│       │   └── agents/             # Individual agent prompts
│       ├── skills/
│       │   ├── registry.ts         # Skill registration
│       │   ├── loader.ts           # Skill loading
│       │   └── apply.ts            # Skill application
│       ├── audio/
│       │   └── transcribe.ts       # Whisper integration
│       └── types.ts                # TypeScript types
├── whisper-service/
│   ├── Dockerfile                  # Python + faster-whisper
│   ├── app.py                      # FastAPI transcription server
│   └── requirements.txt            # Python deps
├── docker-compose.prebloom.yml     # Full stack compose
├── TODO.md                         # Backlog & roadmap
└── docs/
    └── PREBLOOM.md                 # This file
```

---

## Running Locally

```bash
cd ~/Projects/bloem-source

# Set Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Build and run
docker compose -f docker-compose.prebloom.yml up --build

# Access
open http://localhost:8080
```

### Quick Commands

```bash
# Rebuild frontend only
docker compose -f docker-compose.prebloom.yml build frontend
docker compose -f docker-compose.prebloom.yml up -d frontend

# View logs
docker logs bloem-source-backend-1 -f

# Check health
curl http://localhost:8080/prebloom/health

# List skills
curl http://localhost:8080/prebloom/skills
```

---

## Branding

| Element | Value |
|---------|-------|
| **Name** | Prebloom |
| **Tagline (hero)** | "Test the ground." |
| **Tagline (form)** | "Read the soil. Pitch your seed." |
| **Colors** | Deep black (#050505), Neo green (#22c55e), Mint, Coral, Gold |
| **Fonts** | Clash Display, General Sans, JetBrains Mono |
| **Logo** | Neon geometric tulip |
| **Theme** | Dutch tulip heritage, startup ecosystem as garden |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, TypeScript, Bloem Gateway |
| AI | Anthropic Claude (via API) |
| STT | faster-whisper (Python, local) |
| Containerization | Docker Compose |
| Proxy | nginx |

---

## Bloem vs Upstream (Moltbot)

Bloem is a fork of Moltbot (formerly Clawdbot). Prebloom adds:

| Component | Upstream (Moltbot) | Prebloom Addition |
|-----------|-------------------|-------------------|
| Core | Personal AI assistant | — |
| Prebloom API | — | `/prebloom/*` REST endpoints |
| Multi-Agent Swarm | — | Intake + Catalyst + Fire + Synthesis |
| Whisper Service | — | Local faster-whisper container |
| Frontend | WebChat UI | Custom React app with voice + visualizer |
| Skills | Bundled skills | Extended with humanizer, transcription |

---

## Contributing

```bash
git checkout landing-page-kronos
# Make changes
git commit -m "feat(prebloom): ..."
git push
```

---

## Links

- **Repo:** github.com/sam-cms/Bloem
- **Backlog:** [TODO.md](../TODO.md)
- **Name validation:** [memory/prebloom-validation.md](../../clawd/memory/prebloom-validation.md)
