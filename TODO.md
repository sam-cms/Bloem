# Prebloom — Backlog & Roadmap

**Last Updated:** 2026-02-01  
**Current Branch:** `landing-page-kronos`

---

## 🎯 Current Sprint

Focus: Landing page polish + prepare for beta launch

- [x] Landing page (KRONOS design)
- [x] Hero section styling ("Test the ground.")
- [x] Form page styling ("Read the soil. Pitch your seed.")
- [ ] Final landing page review
- [ ] Mobile responsiveness check

---

## 🚀 High Priority (Next Up)

### User Experience
- [ ] **Email delivery** — Send evaluation reports to user's email after completion
- [ ] **History persistence** — Store past evaluations (currently in-memory only, lost on restart)
- [ ] **Loading states** — Better progress indicators during evaluation phases
- [ ] **Error handling** — Graceful error messages when evaluation fails

### Core Product
- [ ] **Iteration mode** — Let users refine their idea based on feedback and re-evaluate
- [ ] **Share links** — Generate shareable report URLs (public or private)
- [ ] **PDF export** — Download report as formatted PDF

---

## 📋 Medium Priority

### Features
- [ ] **Competitive analysis** — Auto-research competitors during evaluation
- [ ] **Market data integration** — Pull in market size estimates, trends
- [ ] **Custom council personas** — Let users configure evaluator personalities/strictness
- [ ] **Multiple languages UI** — Frontend in Dutch, German, French (backend already supports 13 languages)
- [ ] **Notion export** — One-click export to Notion page
- [ ] **Markdown export** — Download raw markdown report

### Analytics & Learning
- [ ] **Self-learning skill** — Capture corrections and learnings for continuous improvement
- [ ] **Usage analytics** — Track evaluations, verdicts, common failure patterns
- [ ] **Feedback loop** — Let users rate report quality, capture for training

### User Management
- [ ] **User accounts** — Basic auth so users can access their history
- [ ] **API keys** — Let power users integrate programmatically
- [ ] **Rate limiting** — Prevent abuse (X evaluations per IP/day)

---

## 🎨 Nice to Have

- [ ] **Batch evaluation** — Evaluate multiple ideas in one session
- [ ] **Comparison view** — Side-by-side comparison of different ideas
- [ ] **Progress webhook** — Real-time evaluation progress via WebSocket
- [ ] **Slack/Discord bot** — Submit ideas directly from chat
- [ ] **Chrome extension** — Evaluate ideas from anywhere on the web
- [ ] **Mobile app** — React Native wrapper for voice-first experience

---

## 🔧 Technical Debt

- [ ] **Persistent job storage** — Replace in-memory Map with Redis or SQLite
- [ ] **Database** — PostgreSQL for user data, evaluations, history
- [ ] **Tests** — Unit tests for orchestrator, API endpoints
- [ ] **Error boundaries** — Better error handling in React components
- [ ] **Logging** — Structured logging for debugging evaluations
- [ ] **CI/CD** — Automated tests and deployment pipeline
- [ ] **Monitoring** — Health checks, uptime monitoring

---

## 🐛 Known Issues

- [ ] Voice recording can be choppy on slow connections
- [ ] Long evaluations (~90s) may timeout on some proxies
- [ ] Dimension scores sometimes inconsistent between runs

---

## ✅ Completed

### 2026-02-01
- [x] Landing page hero: "Read the Soil" all white, "Pitch your seed" mint glow
- [x] Positioned tagline below hero text
- [x] Project documentation and status updates
- [x] Whisper model upgraded: small → medium (better accuracy)
- [x] Cleanup model: added Ollama/Llama option with Haiku fallback
- [x] Added USE_LOCAL_CLEANUP toggle for local vs API cleanup
- [x] Pipeline Flow view with Mermaid diagram (new report tab)
- [x] Pricing strategy analysis (docs/PRICING-STRATEGY.md)
- [x] SQLite storage module for history persistence (partial)

### 2026-01-31
- [x] Voice input with local Whisper transcription
- [x] Audio visualizer (symmetrical, neon green)
- [x] Long-press spacebar to record
- [x] TL;DR view with ASCII dimension scores
- [x] Full report view with expandable sections
- [x] KRONOS landing page design
- [x] Neon tulip logo (128x128)
- [x] Language detection (13 European languages)
- [x] Skills system (humanizer + transcription cleanup)

### Earlier
- [x] Core 4-agent evaluation pipeline
- [x] Dimension scoring system
- [x] Verdict system (PASS/CONDITIONAL/FAIL)
- [x] Docker Compose setup
- [x] Whisper service container

---

## 📊 Metrics to Track (Future)

- Evaluations per day/week
- Verdict distribution (PASS/CONDITIONAL/FAIL ratio)
- Average evaluation time
- Voice vs text input ratio
- User retention (return evaluations)
- Report share rate

---

## 💡 Ideas Parking Lot

*Ideas that might be good but need more thought:*

- Integration with YC application (auto-fill?)
- "Prebloom Score" as a badge/certification
- Marketplace for custom evaluation templates
- White-label for accelerators/VCs
- Real-time collaborative evaluation (multiple founders)
