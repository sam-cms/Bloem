import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

type DimensionScores = {
  problemClarity: number
  marketSize: number
  competitionRisk: number
  execution: number
  businessModel: number
}

type Verdict = {
  decision: 'PASS' | 'FAIL' | 'CONDITIONAL_PASS'
  confidence: number
  dimensions: DimensionScores
  executiveSummary: string
  keyStrengths: string[]
  keyRisks: string[]
  nextSteps: string[]
  intake: { analysis: string; score?: number }
  catalyst: { analysis: string; score?: number }
  fire: { analysis: string; score?: number }
  synthesis: { analysis: string; score?: number }
}

// Dimension display config
const DIMENSION_CONFIG: { key: keyof DimensionScores; label: string }[] = [
  { key: 'problemClarity', label: 'Problem Clarity' },
  { key: 'marketSize', label: 'Market Size' },
  { key: 'competitionRisk', label: 'Competition Risk' },
  { key: 'execution', label: 'Execution' },
  { key: 'businessModel', label: 'Business Model' },
]

type AppState = 'input' | 'processing' | 'report'
type ReportView = 'tldr' | 'full'
type RecordingState = 'idle' | 'recording' | 'transcribing'

const API_BASE = ''

export default function App() {
  const [state, setState] = useState<AppState>('input')
  const [idea, setIdea] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<string>('intake')
  const [reportView, setReportView] = useState<ReportView>('full')
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const longPressTimerRef = useRef<number | null>(null)
  const isSpaceHeldRef = useRef(false)

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
    setReportView('tldr')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e)
    }
    
    // Hold spacebar to record (only when empty or cursor at end)
    if (e.key === ' ' && !e.repeat && recordingState === 'idle') {
      const textarea = textareaRef.current
      if (textarea) {
        const isAtEnd = textarea.selectionStart === idea.length
        const isEmpty = idea.length === 0
        if (isEmpty || isAtEnd) {
          e.preventDefault()
          isSpaceHeldRef.current = true
          startRecording()
        }
      }
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent) => {
    // Release spacebar to stop recording
    if (e.key === ' ' && isSpaceHeldRef.current && recordingState === 'recording') {
      e.preventDefault()
      isSpaceHeldRef.current = false
      stopRecording()
    }
  }

  // Long-press to record (500ms)
  const handleMouseDown = () => {
    if (recordingState !== 'idle') return
    
    longPressTimerRef.current = window.setTimeout(() => {
      startRecording()
    }, 500)
  }

  const handleMouseUp = () => {
    // Clear long-press timer if not yet triggered
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    
    // Stop recording if we were recording via long-press
    if (recordingState === 'recording' && !isSpaceHeldRef.current) {
      stopRecording()
    }
  }

  const handleMouseLeave = () => {
    // Clear timer if mouse leaves textarea
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Create blob and send to transcribe endpoint
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setRecordingState('transcribing')

        try {
          const response = await fetch(`${API_BASE}/prebloom/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'audio/webm' },
            body: audioBlob,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Transcription failed' }))
            throw new Error(errorData.error || 'Transcription failed')
          }

          const result = await response.json()
          // Append transcribed text to existing idea (or replace if empty)
          setIdea(prev => prev ? `${prev}\n\n${result.text}` : result.text)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Transcription failed')
        } finally {
          setRecordingState('idle')
        }
      }

      mediaRecorder.start()
      setRecordingState('recording')
    } catch (err) {
      setError('Microphone access denied')
      setRecordingState('idle')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const toggleRecording = () => {
    if (recordingState === 'recording') {
      stopRecording()
    } else if (recordingState === 'idle') {
      startRecording()
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

                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={idea}
                    onChange={e => setIdea(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={handleMouseDown}
                    onTouchEnd={handleMouseUp}
                    placeholder="I'm building an AI-powered tool that helps photographers get brutally honest feedback on their work before submitting to galleries..."
                    rows={6}
                    disabled={recordingState === 'transcribing'}
                    className={`w-full px-5 py-4 pr-14 bg-[var(--bg-secondary)] border text-white placeholder-[var(--fg-subtle)] focus:outline-none transition-colors resize-none text-base leading-relaxed disabled:opacity-50 ${
                      recordingState === 'recording' 
                        ? 'border-red-500 bg-red-500/5' 
                        : 'border-[var(--border)] focus:border-[var(--accent-muted)]'
                    }`}
                  />
                  
                  {/* Mic Button */}
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={recordingState === 'transcribing'}
                    className={`absolute right-3 top-3 w-10 h-10 flex items-center justify-center border transition-all ${
                      recordingState === 'recording'
                        ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse'
                        : recordingState === 'transcribing'
                        ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                        : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                    }`}
                    title={
                      recordingState === 'recording' 
                        ? 'Click to stop recording' 
                        : recordingState === 'transcribing'
                        ? 'Transcribing...'
                        : 'Click to record voice input'
                    }
                  >
                    {recordingState === 'recording' ? (
                      <span className="w-3 h-3 bg-red-500 rounded-sm" />
                    ) : recordingState === 'transcribing' ? (
                      <div className="spinner" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <p className="text-[var(--fg-subtle)] text-xs">
                    {recordingState === 'recording' 
                      ? '🔴 Recording... release to stop'
                      : recordingState === 'transcribing'
                      ? '⏳ Transcribing audio...'
                      : 'Hold space or long-press to talk'
                    }
                  </p>
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
  onViewChange,
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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[var(--accent)] rounded-full" />
            <span className="label">Prebloom</span>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1">
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
  const classificationLabels = {
    PASS: 'STRONG PASS',
    CONDITIONAL_PASS: 'CONDITIONAL PASS',
    FAIL: 'HARD NO',
  }

  const dimensions = verdict.dimensions || {
    problemClarity: 5,
    marketSize: 5,
    competitionRisk: 5,
    execution: 5,
    businessModel: 5,
  }

  const pad = (str: string, len: number) => str.padEnd(len, ' ')
  const padStart = (str: string, len: number) => str.padStart(len, ' ')

  const headerText = `${classificationLabels[verdict.decision]} ${verdict.confidence}/10`
  const headerPadded = padStart(headerText, Math.floor((37 + headerText.length) / 2)).padEnd(37, ' ')

  const renderRow = (label: string, score: number) => {
    const filled = Math.round(score)
    const empty = 10 - filled
    return (
      <span>
        │  {pad(label, 18)} <span className="text-[var(--accent)]">{'█'.repeat(filled)}</span>
        <span className="text-[var(--fg-subtle)]">{'░'.repeat(empty)}</span>  {padStart(String(score), 2)}  │
      </span>
    )
  }

  // Extract first meaningful sentence(s) from analysis
  const extractSummary = (analysis: string, maxLen: number = 120) => {
    const lines = analysis.split('\n').filter(l => l.trim().length > 15 && !l.startsWith('#'))
    const text = lines.slice(0, 2).join(' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
    return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text
  }

  const cleanItem = (text: string) => text.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim()

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="reveal-up flex flex-col items-center">
        {/* Scorecard Table */}
        <pre className="font-mono text-sm md:text-base leading-relaxed select-none text-[var(--fg-muted)]">
          <span className="block">┌───────────────────────────────────────┐</span>
          <span className="block">│<span className="text-[var(--accent)]">{headerPadded}</span>  │</span>
          <span className="block">│  <span className="text-[var(--border-hover)]">═══════════════════════════════════</span>  │</span>
          <span className="block">│                                       │</span>
          <span className="block">{renderRow('Problem Clarity', dimensions.problemClarity)}</span>
          <span className="block">{renderRow('Market Size', dimensions.marketSize)}</span>
          <span className="block">{renderRow('Competition Risk', dimensions.competitionRisk)}</span>
          <span className="block">{renderRow('Execution', dimensions.execution)}</span>
          <span className="block">{renderRow('Business Model', dimensions.businessModel)}</span>
          <span className="block">│                                       │</span>
          <span className="block">└───────────────────────────────────────┘</span>
        </pre>

        {/* Text Summaries Below Table */}
        <div className="mt-8 w-full max-w-lg space-y-6 text-sm">
          {/* BULL & BEAR */}
          <div className="space-y-3">
            <p className="text-[var(--fg-muted)]">
              <span className="text-[var(--accent)] font-medium">BULL:</span>{' '}
              {extractSummary(verdict.catalyst?.analysis || 'Strong potential identified.', 80)}
            </p>
            <p className="text-[var(--fg-muted)]">
              <span className="text-[var(--fg-subtle)] font-medium">BEAR:</span>{' '}
              {extractSummary(verdict.fire?.analysis || 'Key risks require attention.', 80)}
            </p>
          </div>

          {/* Section Summaries */}
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <p className="text-[var(--fg-muted)]">
              <span className="text-[var(--accent)] font-medium">INTAKE LAB:</span>{' '}
              {extractSummary(verdict.intake?.analysis || 'Problem well-defined.', 80)}
            </p>
            <p className="text-[var(--fg-muted)]">
              <span className="text-[var(--accent)] font-medium">CATALYST LAB:</span>{' '}
              {extractSummary(verdict.catalyst?.analysis || 'Opportunities identified.', 80)}
            </p>
            <p className="text-[var(--fg-muted)]">
              <span className="text-[var(--accent)] font-medium">FIRE LAB:</span>{' '}
              {extractSummary(verdict.fire?.analysis || 'Risks assessed.', 80)}
            </p>
          </div>

          {/* Verdict Summary */}
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-[var(--fg-muted)]">
              <span className="text-[var(--accent)] font-medium">VERDICT:</span>{' '}
              {extractSummary(verdict.executiveSummary || 'Evaluation complete.', 80)}
            </p>
          </div>

          {/* Strengths & Risks */}
          <div className="border-t border-[var(--border)] pt-4 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              {verdict.keyStrengths.slice(0, 2).map((s, i) => (
                <p key={i} className="text-[var(--fg-muted)] text-xs">
                  <span className="text-[var(--accent)]">+</span> {cleanItem(s)}
                </p>
              ))}
            </div>
            <div className="space-y-1">
              {verdict.keyRisks.slice(0, 2).map((r, i) => (
                <p key={i} className="text-[var(--fg-muted)] text-xs">
                  <span className="text-[var(--fg-subtle)]">−</span> {cleanItem(r)}
                </p>
              ))}
            </div>
          </div>
        </div>
        
        <button
          onClick={onExpand}
          className="mt-10 px-6 py-3 font-mono text-sm tracking-wide transition-all border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
        >
          [ View Full Report ]
        </button>
      </div>
    </main>
  )
}

function FullReportView({ verdict, idea, onReset }: { verdict: Verdict; idea: string; onReset: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']))

  // Fallback dimensions if not present
  const dimensions = verdict.dimensions || {
    problemClarity: 5,
    marketSize: 5,
    competitionRisk: 5,
    execution: 5,
    businessModel: 5,
  }

  const classificationConfig = {
    PASS: { label: 'STRONG PASS', color: 'var(--accent)' },
    CONDITIONAL_PASS: { label: 'CONDITIONAL PASS', color: 'var(--accent)' },
    FAIL: { label: 'HARD NO', color: 'var(--accent)' },
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

  // Scorecard helpers
  const pad = (str: string, len: number) => str.padEnd(len, ' ')
  const padStart = (str: string, len: number) => str.padStart(len, ' ')
  const headerText = `${config.label} ${verdict.confidence}/10`
  const headerPadded = padStart(headerText, Math.floor((37 + headerText.length) / 2)).padEnd(37, ' ')

  const renderRow = (label: string, score: number) => {
    const filled = Math.round(score)
    const empty = 10 - filled
    return (
      <span>
        │  {pad(label, 18)} <span className="text-[var(--accent)]">{'█'.repeat(filled)}</span>
        <span className="text-[var(--fg-subtle)]">{'░'.repeat(empty)}</span>  {padStart(String(score), 2)}  │
      </span>
    )
  }

  const sections = ['Overview', 'Intake', 'Catalyst Squad', 'Fire Squad', 'Committee Decision', 'Next Steps']

  return (
    <div className="flex">
      {/* Sidebar: Scorecard + Sections Index */}
      <aside className="hidden lg:block w-72 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="sticky top-16 p-6">
          {/* Scorecard */}
          <pre className="font-mono text-[10px] leading-relaxed select-none text-[var(--fg-muted)] mb-6">
            <span className="block">┌───────────────────────────────────────┐</span>
            <span className="block">│<span className="text-[var(--accent)]">{headerPadded}</span>  │</span>
            <span className="block">│  <span className="text-[var(--border-hover)]">═══════════════════════════════════</span>  │</span>
            <span className="block">│                                       │</span>
            <span className="block">{renderRow('Problem Clarity', dimensions.problemClarity)}</span>
            <span className="block">{renderRow('Market Size', dimensions.marketSize)}</span>
            <span className="block">{renderRow('Competition Risk', dimensions.competitionRisk)}</span>
            <span className="block">{renderRow('Execution', dimensions.execution)}</span>
            <span className="block">{renderRow('Business Model', dimensions.businessModel)}</span>
            <span className="block">│                                       │</span>
            <span className="block">└───────────────────────────────────────┘</span>
          </pre>

          {/* Sections Index */}
          <p className="label mb-4">Sections</p>
          <nav className="space-y-1">
            {sections.map(section => (
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
          <div className="flex items-center justify-between mb-12">
            <div 
              className="inline-block px-4 py-2 text-lg font-display tracking-wide border border-[var(--accent)]/30 bg-[var(--accent)]/5"
              style={{ color: config.color }}
            >
              {config.label}
            </div>
            <p className="text-[var(--fg-muted)] text-lg font-mono">{verdict.confidence}/10</p>
          </div>
          <p className="text-[var(--fg-muted)] text-lg leading-relaxed mb-8">{verdict.executiveSummary}</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border border-[var(--border)] bg-[var(--bg-secondary)]">
              <p className="label text-[var(--accent)] mb-4">Key Strengths</p>
              <ul className="space-y-3">
                {verdict.keyStrengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--fg-muted)]">
                    <span className="text-[var(--accent)]">+</span>
                    <span>{cleanText(s)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 border border-[var(--border)] bg-[var(--bg-secondary)]">
              <p className="label text-[var(--fg-muted)] mb-4">Key Risks</p>
              <ul className="space-y-3">
                {verdict.keyRisks.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--fg-muted)]">
                    <span className="text-[var(--fg-subtle)]">−</span>
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
          score={dimensions.problemClarity}
          expanded={expandedSections.has('intake')}
          onToggle={() => toggleSection('intake')}
        />

        <ReportSection
          id="catalyst-squad"
          title="Catalyst Squad"
          subtitle="The believers — the bull case"
          content={verdict.catalyst.analysis}
          score={dimensions.marketSize}
          expanded={expandedSections.has('catalyst')}
          onToggle={() => toggleSection('catalyst')}
        />

        <ReportSection
          id="fire-squad"
          title="Fire Squad"
          subtitle="The skeptics — stress-testing"
          content={verdict.fire.analysis}
          score={dimensions.competitionRisk}
          expanded={expandedSections.has('fire')}
          onToggle={() => toggleSection('fire')}
        />

        <ReportSection
          id="committee-decision"
          title="Committee Decision"
          subtitle="Final synthesis"
          content={verdict.synthesis.analysis}
          score={verdict.confidence}
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
  score,
  expanded,
  onToggle,
}: {
  id: string
  title: string
  subtitle: string
  content: string
  score?: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <section id={id} className="mb-4">
      <div className="border border-[var(--border)]">
        <button 
          onClick={onToggle}
          className="w-full px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between hover:bg-[var(--bg-card)] transition-colors text-left"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <p className="font-medium text-white tracking-wide">{title}</p>
            <span className="text-[var(--fg-subtle)] text-sm hidden sm:inline">— {subtitle}</span>
            {score !== undefined && <div className="ml-auto"><ScoreBar score={score} /></div>}
          </div>
          <span className={`text-[var(--fg-muted)] transition-transform ml-4 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}>
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

// Score bar component - renders ████████░░ style bars (monochrome accent)
function ScoreBar({ score, max = 10, showNumber = true }: { score: number; max?: number; showNumber?: boolean }) {
  const filled = Math.round((score / max) * 10)
  const empty = 10 - filled
  
  return (
    <span className="font-mono text-sm inline-flex items-center gap-2">
      <span className="text-[var(--accent)]">
        {'█'.repeat(filled)}
        <span className="text-[var(--fg-subtle)]">{'░'.repeat(empty)}</span>
      </span>
      {showNumber && <span className="text-[var(--fg-muted)] w-4 text-right">{score}</span>}
    </span>
  )
}
