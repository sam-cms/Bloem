import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

type Verdict = {
  decision: 'PASS' | 'FAIL' | 'CONDITIONAL_PASS'
  confidence: number
  executiveSummary: string
  keyStrengths: string[]
  keyRisks: string[]
  nextSteps: string[]
  intake: { analysis: string }
  catalyst: { analysis: string }
  fire: { analysis: string }
  synthesis: { analysis: string }
}

type AppState = 'input' | 'processing' | 'report'

const API_BASE = ''

export default function App() {
  const [state, setState] = useState<AppState>('input')
  const [idea, setIdea] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<string>('intake')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 300) + 'px'
    }
  }, [idea])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idea.trim()) return

    setState('processing')
    setError(null)
    setCurrentPhase('intake')

    try {
      const submitRes = await fetch(`${API_BASE}/prebloom/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: idea,
          solution: idea,
          targetMarket: 'Extracted from description',
          businessModel: 'Extracted from description',
          email: 'report@prebloom.ai',
          rawIdea: idea,
        }),
      })

      if (!submitRes.ok) throw new Error('Failed to submit')
      const { jobId } = await submitRes.json()

      const phases = ['intake', 'catalyst', 'fire', 'synthesis']
      let phaseIndex = 0
      let attempts = 0

      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 3000))
        phaseIndex = Math.min(phaseIndex + 1, phases.length - 1)
        setCurrentPhase(phases[phaseIndex])

        const pollRes = await fetch(`${API_BASE}/prebloom/evaluate/${jobId}`)
        const pollData = await pollRes.json()

        if (pollData.status === 'completed') {
          setVerdict(pollData.verdict)
          setState('report')
          return
        }
        if (pollData.status === 'failed') {
          throw new Error(pollData.error || 'Evaluation failed')
        }
        attempts++
      }
      throw new Error('Timed out')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setState('input')
    }
  }

  const handleReset = () => {
    setState('input')
    setIdea('')
    setVerdict(null)
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e)
    }
  }

  if (state === 'report' && verdict) {
    return <WarRoomReport verdict={verdict} idea={idea} onReset={handleReset} />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="light-leak light-leak-green w-[500px] h-[500px] -top-32 -right-32 fixed opacity-30" />
      
      <header className="px-6 py-6 border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-2 h-2 bg-[var(--accent)] rounded-full" />
          <span className="label">Prebloom</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {state === 'input' && (
            <div className="reveal-up">
              <div className="mb-12 text-center">
                <p className="label mb-4 text-[var(--accent)]">Startup Idea Validator</p>
                <h1 className="font-display text-4xl md:text-5xl text-white mb-6">
                  BRIEF THE COUNCIL
                </h1>
                <p className="text-[var(--fg-muted)] max-w-lg mx-auto">
                  Describe your startup idea. Be specific about the problem, your solution, 
                  target market, and how you'll make money.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="mb-6 p-4 border border-[var(--error)]/30 bg-[var(--error)]/10 text-[var(--error)] text-sm">
                    {error}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={idea}
                  onChange={e => setIdea(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="I'm building an AI-powered tool that helps photographers get brutally honest feedback on their work before submitting to galleries..."
                  rows={6}
                  className="w-full px-5 py-4 bg-[var(--bg-secondary)] border border-[var(--border)] text-white placeholder-[var(--fg-subtle)] focus:border-[var(--accent-muted)] focus:outline-none transition-colors resize-none text-base leading-relaxed"
                />

                <div className="mt-6 flex items-center justify-between">
                  <p className="text-[var(--fg-subtle)] text-xs">⌘+Enter to submit</p>
                  <button
                    type="submit"
                    disabled={!idea.trim()}
                    className="px-8 py-3 bg-white text-black font-medium text-sm tracking-wide uppercase transition-all hover:bg-[var(--accent)] disabled:opacity-30"
                  >
                    Submit for Review
                  </button>
                </div>
              </form>
            </div>
          )}

          {state === 'processing' && <ProcessingView phase={currentPhase} />}
        </div>
      </main>
    </div>
  )
}

function ProcessingView({ phase }: { phase: string }) {
  const phases = [
    { id: 'intake', label: 'INTAKE', desc: 'Understanding your submission' },
    { id: 'catalyst', label: 'CATALYST SQUAD', desc: 'Building the bull case' },
    { id: 'fire', label: 'FIRE SQUAD', desc: 'Stress-testing the thesis' },
    { id: 'synthesis', label: 'SYNTHESIS', desc: 'Deliberating verdict' },
  ]
  const currentIndex = phases.findIndex(p => p.id === phase)

  return (
    <div className="text-center reveal-up">
      <div className="mb-8">
        <div className="inline-block w-16 h-16 border border-[var(--accent)] relative">
          <div className="absolute inset-2 border border-[var(--accent)] animate-pulse" />
          <div className="absolute inset-4 bg-[var(--accent)]" />
        </div>
      </div>

      <p className="label text-[var(--accent)] mb-4">Council in Session</p>
      <h2 className="font-display text-3xl text-white mb-12">ANALYSIS IN PROGRESS</h2>

      <div className="space-y-3 text-left max-w-sm mx-auto">
        {phases.map((p, i) => {
          const isActive = i === currentIndex
          const isComplete = i < currentIndex
          return (
            <div 
              key={p.id}
              className={`flex items-center gap-4 p-4 border transition-all ${
                isActive ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 
                isComplete ? 'border-[var(--border)] opacity-50' : 'border-[var(--border)] opacity-30'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                isActive ? 'bg-[var(--accent)] animate-pulse' : isComplete ? 'bg-[var(--fg-subtle)]' : 'bg-[var(--border)]'
              }`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${isActive ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)]'}`}>{p.label}</p>
                <p className="text-xs text-[var(--fg-subtle)]">{p.desc}</p>
              </div>
              {isActive && <div className="spinner" />}
            </div>
          )
        })}
      </div>
      <p className="text-[var(--fg-subtle)] text-sm mt-12">Full analysis takes 60-90 seconds</p>
    </div>
  )
}

function WarRoomReport({ verdict, idea, onReset }: { verdict: Verdict; idea: string; onReset: () => void }) {
  const [activeSection, setActiveSection] = useState('overview')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']))

  const classificationConfig = {
    PASS: { label: 'APPROVED', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)' },
    CONDITIONAL_PASS: { label: 'CONDITIONAL', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
    FAIL: { label: 'REJECTED', color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' },
  }
  const config = classificationConfig[verdict.decision]

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'intake', label: 'Intake Analysis' },
    { id: 'catalyst', label: 'Catalyst Squad' },
    { id: 'fire', label: 'Fire Squad' },
    { id: 'synthesis', label: 'Committee Decision' },
    { id: 'actions', label: 'Next Steps' },
  ]

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedSections(newExpanded)
  }

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* Sidebar Navigation */}
      <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="sticky top-0 p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-2 h-2 bg-[var(--accent)] rounded-full" />
            <span className="label">Report Navigation</span>
          </div>
          
          <nav className="space-y-1">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  activeSection === section.id 
                    ? 'text-white bg-white/5 border-l-2 border-[var(--accent)]' 
                    : 'text-[var(--fg-muted)] hover:text-white'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="mt-12 pt-6 border-t border-[var(--border)] space-y-3">
            <button className="w-full px-4 py-2 text-xs text-[var(--fg-muted)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors tracking-wide uppercase">
              Export PDF
            </button>
            <button className="w-full px-4 py-2 text-xs text-[var(--fg-muted)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors tracking-wide uppercase">
              Share Report
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 px-8 py-4 border-b border-[var(--border)] bg-[var(--bg-primary)]/95 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="px-3 py-1 text-sm font-medium tracking-wide"
                style={{ color: config.color, backgroundColor: config.bg, border: `1px solid ${config.color}30` }}
              >
                {config.label}
              </div>
              <span className="text-[var(--fg-muted)] text-sm">Confidence: {verdict.confidence}/10</span>
            </div>
            <button onClick={onReset} className="text-[var(--fg-subtle)] text-sm hover:text-white transition-colors">
              ← New Analysis
            </button>
          </div>
        </header>

        <div className="px-8 py-12 max-w-4xl">
          {/* Overview Section */}
          <section id="overview" className="mb-12">
            <div className="mb-8">
              <p className="label text-[var(--accent)] mb-4">Executive Summary</p>
              <h1 className="font-display text-3xl md:text-4xl text-white mb-6">VERDICT REPORT</h1>
              <p className="text-[var(--fg-muted)] text-lg leading-relaxed">{verdict.executiveSummary}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 border border-[var(--border)] bg-[var(--bg-secondary)]">
                <p className="label text-[#4ade80] mb-4">Key Strengths</p>
                <ul className="space-y-3">
                  {verdict.keyStrengths.slice(0, 4).map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-[var(--fg-muted)]">
                      <span className="text-[#4ade80] flex-shrink-0">+</span>
                      <span>{cleanText(s)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 border border-[var(--border)] bg-[var(--bg-secondary)]">
                <p className="label text-[#f87171] mb-4">Key Risks</p>
                <ul className="space-y-3">
                  {verdict.keyRisks.slice(0, 4).map((r, i) => (
                    <li key={i} className="flex gap-3 text-sm text-[var(--fg-muted)]">
                      <span className="text-[#f87171] flex-shrink-0">−</span>
                      <span>{cleanText(r)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Intake Section */}
          <ReportSection
            id="intake"
            title="Intake Analysis"
            subtitle="How we understood your submission"
            content={verdict.intake.analysis}
            expanded={expandedSections.has('intake')}
            onToggle={() => toggleSection('intake')}
          />

          {/* Catalyst Section */}
          <ReportSection
            id="catalyst"
            title="Catalyst Squad"
            subtitle="The believers — the bull case for this idea"
            content={verdict.catalyst.analysis}
            accentColor="#4ade80"
            expanded={expandedSections.has('catalyst')}
            onToggle={() => toggleSection('catalyst')}
          />

          {/* Fire Section */}
          <ReportSection
            id="fire"
            title="Fire Squad"
            subtitle="The skeptics — stress-testing every assumption"
            content={verdict.fire.analysis}
            accentColor="#f87171"
            expanded={expandedSections.has('fire')}
            onToggle={() => toggleSection('fire')}
          />

          {/* Synthesis Section */}
          <ReportSection
            id="synthesis"
            title="Committee Decision"
            subtitle="Final synthesis weighing all arguments"
            content={verdict.synthesis.analysis}
            accentColor="var(--accent)"
            expanded={expandedSections.has('synthesis')}
            onToggle={() => toggleSection('synthesis')}
          />

          {/* Actions Section */}
          <section id="actions" className="mb-12">
            <div className="border border-[var(--border)]">
              <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                <p className="label text-[var(--accent)]">Recommended Next Steps</p>
              </div>
              <div className="p-6 space-y-4">
                {verdict.nextSteps.map((step, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <span className="w-6 h-6 flex items-center justify-center bg-[var(--accent)]/10 text-[var(--accent)] text-sm font-medium flex-shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-[var(--fg-muted)] leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Future Actions */}
          <section className="mb-12 p-6 border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/50">
            <p className="label text-[var(--fg-subtle)] mb-4">Coming Soon</p>
            <div className="grid md:grid-cols-3 gap-4">
              <button disabled className="p-4 border border-[var(--border)] text-[var(--fg-subtle)] text-sm opacity-50 cursor-not-allowed">
                🗨️ Ask Follow-up Questions
              </button>
              <button disabled className="p-4 border border-[var(--border)] text-[var(--fg-subtle)] text-sm opacity-50 cursor-not-allowed">
                📋 Generate Business Canvas
              </button>
              <button disabled className="p-4 border border-[var(--border)] text-[var(--fg-subtle)] text-sm opacity-50 cursor-not-allowed">
                📅 Create Validation Plan
              </button>
            </div>
          </section>

          {/* Footer */}
          <footer className="pt-8 border-t border-[var(--border)] flex items-center justify-between">
            <p className="label">End of Report</p>
            <button
              onClick={onReset}
              className="px-6 py-3 bg-white text-black font-medium text-sm tracking-wide uppercase transition-all hover:bg-[var(--accent)]"
            >
              Analyze Another Idea
            </button>
          </footer>
        </div>
      </main>
    </div>
  )
}

function ReportSection({
  id,
  title,
  subtitle,
  content,
  accentColor = 'var(--fg-muted)',
  expanded,
  onToggle,
}: {
  id: string
  title: string
  subtitle: string
  content: string
  accentColor?: string
  expanded: boolean
  onToggle: () => void
}) {
  // Extract first paragraph as summary
  const paragraphs = content.split('\n\n').filter(p => p.trim())
  const summary = paragraphs[0] || ''
  const hasMore = paragraphs.length > 1

  return (
    <section id={id} className="mb-8">
      <div className="border border-[var(--border)]">
        <button 
          onClick={onToggle}
          className="w-full p-6 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between hover:bg-[var(--bg-secondary)]/80 transition-colors text-left"
        >
          <div>
            <p className="font-medium text-white tracking-wide" style={{ color: accentColor }}>{title}</p>
            <p className="text-[var(--fg-subtle)] text-sm mt-1">{subtitle}</p>
          </div>
          <span className={`text-[var(--fg-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        
        <div className={`transition-all overflow-hidden ${expanded ? 'max-h-[2000px]' : 'max-h-0'}`}>
          <div className="p-6 prose-custom">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-xl font-semibold text-white mb-4 mt-6 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold text-white mb-3 mt-5 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold text-white mb-2 mt-4 first:mt-0">{children}</h3>,
                p: ({ children }) => <p className="text-[var(--fg-muted)] leading-relaxed mb-4 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="space-y-2 mb-4 last:mb-0">{children}</ul>,
                ol: ({ children }) => <ol className="space-y-2 mb-4 last:mb-0 list-decimal list-inside">{children}</ol>,
                li: ({ children }) => <li className="text-[var(--fg-muted)] leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="text-white font-medium">{children}</strong>,
                em: ({ children }) => <em className="text-[var(--fg-muted)] italic">{children}</em>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-[var(--accent)] pl-4 my-4 text-[var(--fg-muted)]">{children}</blockquote>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </section>
  )
}

function cleanText(text: string): string {
  return text
    .replace(/^\d+\.\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^\.\s*/, '')
    .trim()
}
