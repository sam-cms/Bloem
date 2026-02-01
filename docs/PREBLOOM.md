# Prebloom — Startup Idea Validator

**Status:** Active Development (prebloom-dev branch)  
**Last Updated:** 2026-02-01  
**URL:** http://192.168.68.57:8080

---

## What is Prebloom?

Prebloom is a **startup idea validation tool** built on top of Bloem (a fork of Clawdbot/Moltbot). It uses an AI "council" to evaluate business ideas through multiple lenses — bulls, bears, and synthesizers — to give founders honest, structured feedback before they commit resources.

Think of it as a brutally honest YC partner panel simulation for your startup idea.

---

## Current State

### ✅ Working Features

| Feature | Description |
|---------|-------------|
| **Idea Submission** | Text input with multi-line support |
| **Voice Input** | Local speech-to-text via Whisper (no cloud APIs) |
| **Audio Visualizer** | Real-time symmetrical waveform during recording (neon green, Web Audio API) |
| **Multi-Agent Evaluation** | 4-phase council: Intake → Catalyst (bulls) → Fire (bears) → Synthesis |
| **Dimension Scoring** | 5 dimensions rated 1-10: Problem Clarity, Market Size, Competition Risk, Execution, Business Model |
| **Verdict System** | PASS / CONDITIONAL_PASS / FAIL with confidence score |
| **TL;DR View** | Compact scorecard with ASCII-art bars |
| **Full Report View** | Expandable sections with markdown rendering |
| **Branding** | Neon green geometric tulip logo |

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│              http://localhost:8080                       │
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
│   (faster-whisper)│          │   (Claude)       │
│   Local STT       │          │   Evaluation     │
└──────────────────┘          └──────────────────┘
```

### 📁 Key Files

```
bloem-source/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Main UI (input, processing, report views)
│   │   └── components/
│   │       └── AudioVisualizer.tsx # Web Audio API frequency visualizer
│   └── public/
│       └── prebloom-logo.jpg       # Neon tulip logo (128x128)
├── src/
│   └── prebloom/
│       ├── api/
│       │   └── http-handler.ts     # REST API endpoints
│       ├── swarm/
│       │   └── orchestrator.ts     # Multi-agent evaluation logic
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
└── TODO.md                         # Backlog
```

---

## Bloem vs Upstream (Clawdbot/Moltbot)

Bloem is a fork of Clawdbot (now Moltbot). Here's what Prebloom adds vs the upstream:

| Component | Upstream (Moltbot) | Prebloom Addition |
|-----------|-------------------|-------------------|
| **Core** | Personal AI assistant, multi-channel messaging | — |
| **Prebloom API** | — | `/prebloom/*` REST endpoints for idea evaluation |
| **Multi-Agent Swarm** | — | Intake + Catalyst + Fire + Synthesis orchestration |
| **Whisper Service** | — | Local faster-whisper Docker service for STT |
| **Frontend** | WebChat UI | Custom React app with voice input + visualizer |
| **Skills System** | Bundled skills | Extended with humanizer, transcription hooks |

The upstream Moltbot has:
- Multi-channel inbox (WhatsApp, Telegram, Discord, Slack, etc.)
- Browser control
- Canvas + A2UI
- Voice Wake + Talk Mode
- Node system (iOS/Android/macOS)
- Cron + webhooks
- Full agent workspace with memory

Prebloom runs *on top of* Bloem's Gateway, using it as the backend runtime while adding the evaluation-specific logic.

---

## Evaluation Flow

1. **User submits idea** (text or voice)
2. **Intake phase** — Parse and structure the idea
3. **Catalyst Squad** — Build the bull case (opportunities, strengths)
4. **Fire Squad** — Stress-test (risks, weaknesses, market threats)
5. **Synthesis** — Combine perspectives, score dimensions, render verdict
6. **Report delivered** — TL;DR scorecard + expandable full report

---

## Running Locally

```bash
cd /home/bruce/Projects/bloem-source

# Set Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Build and run
docker compose -f docker-compose.prebloom.yml up --build

# Access
open http://localhost:8080
```

---

## Backlog

See [TODO.md](../TODO.md) for the current backlog.

### Planned Features

- [ ] **Self-learning skill** — Capture learnings, errors, corrections for continuous improvement
- [ ] **Email delivery** — Send reports to user's email
- [ ] **History** — Persist and browse past evaluations
- [ ] **Iteration mode** — Refine idea based on feedback
- [ ] **Export** — PDF/Notion/Markdown export
- [ ] **Competitive analysis** — Auto-research competitors during evaluation

---

## Voice Input Details

- **Recording:** MediaRecorder API (browser-native)
- **Visualization:** Web Audio API AnalyserNode → Canvas 2D
- **Transcription:** faster-whisper (local, no cloud)
- **Model:** Whisper `small` by default (~460MB)
- **Controls:**
  - Long-press spacebar (500ms) to start recording
  - Tap spacebar to stop
  - Click mic button to toggle

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

## Contributing

Branch: `prebloom-dev`  
Repo: `github.com:sam-cms/Bloem.git`

```bash
git checkout prebloom-dev
# Make changes
git commit -m "feat(prebloom): ..."
git push
```

Rebuild after changes:
```bash
docker compose -f docker-compose.prebloom.yml build frontend
docker compose -f docker-compose.prebloom.yml up -d frontend
```
