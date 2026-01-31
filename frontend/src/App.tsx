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
type ReportView = 'tldr' | 'full'

const API_BASE = ''

export default function App() {
  const [state, setState] = useState<AppState>('input')
  const [idea, setIdea] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<string>('intake')
  const [reportView, setReportView] = useState<ReportView>('tldr')
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
          setReportView('tldr') // Start with TL;DR view
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
    setReportView('tldr')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e)
    }
  }

  if (state === 'report' && verdict) {
    return (
      <ReportContainer 
        verdict={verdict} 
        idea={idea} 
        onReset={handleReset}
        view={reportView}
        onViewChange={setReportView}
      />
    )
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

function ReportContainer({ 
  verdict, 
  idea, 
  onReset, 
  view, 
  onViewChange 
}: { 
  verdict: Verdict
  idea: string
  onReset: () => void
  view: ReportView
  onViewChange: (view: ReportView) => void
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-primary)]/95 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[var(--accent)] rounded-full" />
              <span className="label">Prebloom</span>
            </div>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-[var(--bg-secondary)] p-1">
            <button
              onClick={() => onViewChange('tldr')}
              className={`px-4 py-2 text-xs font-medium tracking-wide uppercase transition-all ${
                view === 'tldr' 
                  ? 'bg-[var(--accent)] text-black' 
                  : 'text-[var(--fg-muted)] hover:text-white'
              }`}
            >
              TL;DR
            </button>
            <button
              onClick={() => onViewChange('full')}
              className={`px-4 py-2 text-xs font-medium tracking-wide uppercase transition-all ${
                view === 'full' 
                  ? 'bg-[var(--accent)] text-black' 
                  : 'text-[var(--fg-muted)] hover:text-white'
              }`}
            >
              Full Report
            </button>
          </div>

          <button onClick={onReset} className="text-[var(--fg-subtle)] text-sm hover:text-white transition-colors">
            ← New Analysis
          </button>
        </div>
      </header>

      {view === 'tldr' ? (
        <TLDRView verdict={verdict} onExpand={() => onViewChange('full')} />
      ) : (
        <FullReportView verdict={verdict} idea={idea} onReset={onReset} />
      )}
    </div>
  )
}

function TLDRView({ verdict, onExpand }: { verdict: Verdict; onExpand: () => void }) {
  const classificationConfig = {
    PASS: { label: 'APPROVED', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)', emoji: '✓' },
    CONDITIONAL_PASS: { label: 'CONDITIONAL', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', emoji: '~' },
    FAIL: { label: 'REJECTED', color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)', emoji: '✗' },
  }
  const config = classificationConfig[verdict.decision]
  const confidencePercent = (verdict.confidence / 10) * 100

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="reveal-up">
        {/* Hero Verdict Card */}
        <div 
          className="border-2 p-8 mb-8 text-center"
          style={{ borderColor: config.color, backgroundColor: config.bg }}
        >
          <div className="mb-4">
            <span 
              className="text-5xl font-display"
              style={{ color: config.color }}
            >
              {config.emoji}
            </span>
          </div>
          
          <h1 
            className="font-display text-3xl md:text-4xl mb-4 tracking-wide"
            style={{ color: config.color }}
          >
            {config.label}
          </h1>
          
          {/* Confidence Bar */}
          <div className="max-w-xs mx-auto mb-4">
            <div className="flex justify-between text-xs text-[var(--fg-muted)] mb-1">
              <span>Confidence</span>
              <span className="font-medium text-white">{verdict.confidence}/10</span>
            </div>
            <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ 
                  width: `${confidencePercent}%`, 
                  backgroundColor: config.color 
                }}
              />
            </div>
          </div>
        </div>

        {/* One-liner Summary */}
        <div className="text-center mb-8">
          <p className="text-[var(--fg-muted)] text-lg leading-relaxed">
            "{verdict.executiveSummary}"
          </p>
        </div>

        {/* Bull vs Bear Count */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div 
            className="p-6 border border-[var(--border)] bg-[var(--bg-secondary)] cursor-pointer hover:border-[#4ade80]/50 transition-colors group"
            onClick={onExpand}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#4ade80] text-2xl font-display">+{verdict.keyStrengths.length}</span>
              <span className="text-[var(--fg-subtle)] text-xs group-hover:text-[#4ade80] transition-colors">→</span>
            </div>
            <p className="label text-[#4ade80]">Strengths</p>
            <p className="text-[var(--fg-subtle)] text-xs mt-1">Click to see details</p>
          </div>
          
          <div 
            className="p-6 border border-[var(--border)] bg-[var(--bg-secondary)] cursor-pointer hover:border-[#f87171]/50 transition-colors group"
            onClick={onExpand}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#f87171] text-2xl font-display">−{verdict.keyRisks.length}</span>
              <span className="text-[var(--fg-subtle)] text-xs group-hover:text-[#f87171] transition-colors">→</span>
            </div>
            <p className="label text-[#f87171]">Risks</p>
            <p className="text-[var(--fg-subtle)] text-xs mt-1">Click to see details</p>
          </div>
        </div>

        {/* #1 Next Step */}
        {verdict.nextSteps[0] && (
          <div className="p-6 border border-[var(--accent)]/30 bg-[var(--accent)]/5 mb-8">
            <p className="label text-[var(--accent)] mb-2">Recommended First Step</p>
            <p className="text-white leading-relaxed">{verdict.nextSteps[0]}</p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={onExpand}
            className="px-8 py-4 bg-white text-black font-medium text-sm tracking-wide uppercase transition-all hover:bg-[var(--accent)] inline-flex items-center gap-3"
          >
            <span>View Full Analysis</span>
            <span>→</span>
          </button>
          <p className="text-[var(--fg-subtle)] text-xs mt-4">
            See detailed breakdown from Catalyst Squad, Fire Squad, and Synthesis
          </p>
        </div>
      </div>
    </main>
  )
}

function FullReportView({ verdict, idea, onReset }: { verdict: Verdict; idea: string; onReset: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']))

  const classificationConfig = {
    PASS: { label: 'APPROVED', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)' },
    CONDITIONAL_PASS: { label: 'CONDITIONAL', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
    FAIL: { label: 'REJECTED', color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' },
  }
  const config = classificationConfig[verdict.decision]

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedSections(newExpanded)
  }

  return (
    <div className="flex">
      {/* Sidebar Navigation */}
      <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="sticky top-16 p-6">
          <p className="label mb-4">Sections</p>
          <nav className="space-y-1">
            {['Overview', 'Intake', 'Catalyst Squad', 'Fire Squad', 'Committee Decision', 'Next Steps'].map(section => (
              <a
                key={section}
                href={`#${section.toLowerCase().replace(' ', '-')}`}
                className="block px-3 py-2 text-sm text-[var(--fg-muted)] hover:text-white transition-colors"
              >
                {section}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 px-8 py-12 max-w-4xl">
        {/* Overview */}
        <section id="overview" className="mb-12">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div 
                className="inline-block px-4 py-2 text-lg font-display tracking-wide mb-4"
                style={{ color: config.color, backgroundColor: config.bg, border: `1px solid ${config.color}30` }}
              >
                {config.label}
              </div>
              <p className="text-[var(--fg-muted)] text-sm">Confidence: {verdict.confidence}/10</p>
            </div>
          </div>
          <p className="text-[var(--fg-muted)] text-lg leading-relaxed mb-8">{verdict.executiveSummary}</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border border-[var(--border)] bg-[var(--bg-secondary)]">
              <p className="label text-[#4ade80] mb-4">Key Strengths</p>
              <ul className="space-y-3">
                {verdict.keyStrengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--fg-muted)]">
                    <span className="text-[#4ade80]">+</span>
                    <span>{cleanText(s)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 border border-[var(--border)] bg-[var(--bg-secondary)]">
              <p className="label text-[#f87171] mb-4">Key Risks</p>
              <ul className="space-y-3">
                {verdict.keyRisks.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--fg-muted)]">
                    <span className="text-[#f87171]">−</span>
                    <span>{cleanText(r)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Agent Sections */}
        <ReportSection
          id="intake"
          title="Intake Analysis"
          subtitle="How we understood your submission"
          content={verdict.intake.analysis}
          expanded={expandedSections.has('intake')}
          onToggle={() => toggleSection('intake')}
        />

        <ReportSection
          id="catalyst-squad"
          title="Catalyst Squad"
          subtitle="The believers — the bull case"
          content={verdict.catalyst.analysis}
          accentColor="#4ade80"
          expanded={expandedSections.has('catalyst')}
          onToggle={() => toggleSection('catalyst')}
        />

        <ReportSection
          id="fire-squad"
          title="Fire Squad"
          subtitle="The skeptics — stress-testing"
          content={verdict.fire.analysis}
          accentColor="#f87171"
          expanded={expandedSections.has('fire')}
          onToggle={() => toggleSection('fire')}
        />

        <ReportSection
          id="committee-decision"
          title="Committee Decision"
          subtitle="Final synthesis"
          content={verdict.synthesis.analysis}
          accentColor="var(--accent)"
          expanded={expandedSections.has('synthesis')}
          onToggle={() => toggleSection('synthesis')}
        />

        {/* Next Steps */}
        <section id="next-steps" className="mb-12">
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
          <div className="p-6">
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
