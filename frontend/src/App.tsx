import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import AudioVisualizer from './components/AudioVisualizer'
import { AgentCouncilLoader } from './components/AgentCouncilLoader'

type DimensionScores = {
  problemClarity: number
  marketSize: number
  competitionRisk: number
  execution: number
  businessModel: number
}

type Verdict = {
  decision: 'STRONG_SIGNAL' | 'CONDITIONAL_FIT' | 'WEAK_SIGNAL' | 'NO_MARKET_FIT'
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

type AppState = 'landing' | 'input' | 'processing' | 'report'
type ReportView = 'tldr' | 'full' | 'groundwork'
type RecordingState = 'idle' | 'recording' | 'transcribing'

const API_BASE = ''

export default function App() {
  const [state, setState] = useState<AppState>('landing')
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
  const spacebarTimerRef = useRef<number | null>(null)
  const [blockSpacebar, setBlockSpacebar] = useState(false)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 300) + 'px'
    }
  }, [idea])

  // Global spacebar listener for voice recording
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle spacebar
      if (e.key !== ' ' || e.repeat) return
      
      // Don't interfere if user is in the middle of typing (not at end)
      const textarea = textareaRef.current
      if (textarea && document.activeElement === textarea) {
        const isAtEnd = textarea.selectionStart === idea.length
        const isEmpty = idea.length === 0
        if (!isEmpty && !isAtEnd) return // Let normal typing happen
      }
      
      // If recording, tap to stop
      if (recordingState === 'recording') {
        e.preventDefault()
        stopRecording()
        setBlockSpacebar(true)
        return
      }
      
      // If idle on input page, long-press to start
      if (recordingState === 'idle' && state === 'input') {
        e.preventDefault()
        spacebarTimerRef.current = window.setTimeout(() => {
          startRecording()
          spacebarTimerRef.current = null
        }, 500)
      }
    }

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && spacebarTimerRef.current) {
        clearTimeout(spacebarTimerRef.current)
        spacebarTimerRef.current = null
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    window.addEventListener('keyup', handleGlobalKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
      window.removeEventListener('keyup', handleGlobalKeyUp)
    }
  }, [recordingState, state, idea.length])

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

      // Phase timing: 5s intake, 10s squads (catalyst+fire together), then synthesis
      const phases = ['intake', 'squads', 'synthesis'] as const
      const phaseTiming = { intake: 5000, squads: 10000, synthesis: 0 }
      
      let currentPhaseIdx = 0
      let phaseStartTime = Date.now()
      let attempts = 0

      setCurrentPhase('intake')

      while (attempts < 120) {
        await new Promise(r => setTimeout(r, 2000))

        // Advance phase based on timing
        const currentPhaseName = phases[currentPhaseIdx]
        const elapsed = Date.now() - phaseStartTime
        
        if (currentPhaseIdx < phases.length - 1 && elapsed >= phaseTiming[currentPhaseName]) {
          currentPhaseIdx++
          phaseStartTime = Date.now()
          setCurrentPhase(phases[currentPhaseIdx])
        }

        const pollRes = await fetch(`${API_BASE}/prebloom/evaluate/${jobId}`)
        const pollData = await pollRes.json()

        if (pollData.status === 'completed') {
          setCurrentPhase('synthesis')
          await new Promise(r => setTimeout(r, 1000))
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
    // Submit on Enter (without shift) or Cmd/Ctrl+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (idea.trim()) {
        handleSubmit(e)
      }
    }
    
    // Unblock spacebar when any other key is pressed
    if (e.key !== ' ' && blockSpacebar) {
      setBlockSpacebar(false)
    }
    
    // Block spacebar input in textarea if flag is set
    if (e.key === ' ' && blockSpacebar) {
      e.preventDefault()
      return
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
      setAudioStream(stream)
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks and clear stream
        stream.getTracks().forEach(track => track.stop())
        setAudioStream(null)

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

  if (state === 'landing') {
    return <LandingPageKronos onGetStarted={() => setState('input')} />
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
    <div className="min-h-screen flex flex-col bg-[#050505]">
      <div className="mosaic-grid" />
      <div className="light-leak light-leak-orange" />
      <div className="light-leak light-leak-blue" />
      
      {/* Same header as landing page */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-8 md:px-16 py-6 flex justify-between items-center">
          {/* Logo */}
          <a href="/" onClick={(e) => { e.preventDefault(); setState('landing'); }} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
            <span className="font-display text-2xl font-bold tracking-tight">
              Prebloom
            </span>
            <img src="/prebloom-logo.jpg" alt="" className="w-4 h-4 object-contain ml-1" />
          </a>
          
          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-12">
            <a href="/" onClick={(e) => { e.preventDefault(); setState('landing'); }} className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[var(--coral)] transition-colors">
              01. How it works
            </a>
            <a href="/" onClick={(e) => { e.preventDefault(); setState('landing'); }} className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[var(--coral)] transition-colors">
              02. Features
            </a>
            <a href="/" onClick={(e) => { e.preventDefault(); setState('landing'); }} className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[var(--coral)] transition-colors">
              03. Who it's for
            </a>
          </nav>
          
          {/* Back to home */}
          <a href="/" onClick={(e) => { e.preventDefault(); setState('landing'); }} className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">
            ← Back
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12 pt-32 relative z-10">
        <div className="w-full max-w-2xl">
          {state === 'input' && (
            <div className="reveal-up">
              <div className="mb-12 text-center">
                {recordingState === 'recording' && (
                  <div className="flex justify-center mb-6">
                    <AudioVisualizer 
                      stream={audioStream} 
                      isActive={recordingState === 'recording'}
                      width={280}
                      height={48}
                      barCount={40}
                      accentColor="#00ff88"
                      symmetrical={true}
                    />
                  </div>
                )}
                <div className="relative inline-block mb-4">
                  <h1 className="font-display text-5xl md:text-7xl uppercase leading-[0.85] tracking-tighter">
                    <span className="block text-white">Read the</span>
                    <span className="block text-white">soil.</span>
                  </h1>
                  <span className="absolute -bottom-6 right-0 text-base md:text-lg text-[var(--mint)] font-mono tracking-widest uppercase drop-shadow-[0_0_20px_rgba(158,255,191,0.4)]">
                    Pitch your seed
                  </span>
                </div>
                <p className="text-white/40 max-w-lg mx-auto mt-6 text-sm">
                  Every seed starts with an idea. Describe yours. We'll dig into the rest.
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
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={handleMouseDown}
                    onTouchEnd={handleMouseUp}
                    placeholder="e.g., I'm building an AI tool that helps photographers get feedback before submitting to galleries..."
                    rows={6}
                    disabled={recordingState === 'transcribing'}
                    className={`w-full px-5 py-4 pr-14 bg-[#0a0a0a] border-2 text-white placeholder:text-white/25 placeholder:font-light placeholder:normal-case focus:outline-none transition-colors resize-none text-base leading-relaxed disabled:opacity-50 border-white/10 focus:border-[#22c55e]/60 ${
                      recordingState === 'recording' ? 'opacity-60' : ''
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
                  <p className="text-[var(--fg-subtle)] text-xs flex items-center gap-2">
                    {recordingState === 'recording' ? (
                      <>
                        <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
                        <span>Recording... tap space to stop</span>
                      </>
                    ) : recordingState === 'transcribing' ? (
                      <>
                        <span className="spinner-small" />
                        <span>Transcribing audio...</span>
                      </>
                    ) : (
                      'Long-press space or hold click to talk'
                    )}
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
  return (
    <div className="text-center reveal-up">
      <p className="label text-[var(--accent)] mb-2">AI Squads Analyzing</p>
      <h2 className="font-display text-2xl text-white mb-4">ANALYSIS IN PROGRESS</h2>

      {/* Phase indicator - moved to top */}
      <div className="flex justify-center gap-2 mb-6">
        <div className={`relative flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wider transition-all ${phase === 'intake' ? 'text-[var(--accent)]' : 'text-[var(--fg-subtle)]'}`}>
          {phase === 'intake' && <span className="absolute inset-0 bg-[var(--accent)]/5 rounded" />}
          <span className={`relative w-1.5 h-1.5 rounded-full ${phase === 'intake' ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--fg-subtle)]/30'}`} />
          <span className="relative">intake</span>
        </div>
        <div className={`relative flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wider transition-all ${phase === 'squads' || phase === 'catalyst' ? 'text-[#4ade80]' : 'text-[var(--fg-subtle)]'}`}>
          {(phase === 'squads' || phase === 'catalyst') && <span className="absolute inset-0 bg-[#4ade80]/5 rounded" />}
          <span className={`relative w-1.5 h-1.5 rounded-full ${phase === 'squads' || phase === 'catalyst' ? 'bg-[#4ade80] animate-pulse' : 'bg-[var(--fg-subtle)]/30'}`} />
          <span className="relative">catalyst</span>
        </div>
        <div className={`relative flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wider transition-all ${phase === 'squads' || phase === 'fire' ? 'text-[#f87171]' : 'text-[var(--fg-subtle)]'}`}>
          {(phase === 'squads' || phase === 'fire') && <span className="absolute inset-0 bg-[#f87171]/5 rounded" />}
          <span className={`relative w-1.5 h-1.5 rounded-full ${phase === 'squads' || phase === 'fire' ? 'bg-[#f87171] animate-pulse' : 'bg-[var(--fg-subtle)]/30'}`} />
          <span className="relative">fire</span>
        </div>
        <div className={`relative flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wider transition-all ${phase === 'synthesis' ? 'text-[#fbbf24]' : 'text-[var(--fg-subtle)]'}`}>
          {phase === 'synthesis' && <span className="absolute inset-0 bg-[#fbbf24]/5 rounded" />}
          <span className={`relative w-1.5 h-1.5 rounded-full ${phase === 'synthesis' ? 'bg-[#fbbf24] animate-pulse' : 'bg-[var(--fg-subtle)]/30'}`} />
          <span className="relative">synthesis</span>
        </div>
      </div>

      {/* AI Squads Visualization */}
      <AgentCouncilLoader phase={phase as 'intake' | 'catalyst' | 'fire' | 'squads' | 'synthesis'} />

      <p className="text-[var(--fg-subtle)] text-xs mt-6">Full analysis takes 60-90 seconds</p>
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
            <img src="/prebloom-logo.jpg" alt="Prebloom" className="w-6 h-6 object-contain" />
            <span className="label">Prebloom</span>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1">
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
            <button
              onClick={() => onViewChange('groundwork')}
              className={`px-4 py-2 text-xs font-medium tracking-wide uppercase transition-all ${
                view === 'groundwork' 
                  ? 'bg-[var(--accent)] text-black' 
                  : 'text-[var(--fg-muted)] hover:text-white'
              }`}
            >
              Groundwork
            </button>
          </div>

          <button onClick={onReset} className="text-[var(--fg-subtle)] text-sm hover:text-white transition-colors">
            ← New Analysis
          </button>
        </div>
      </header>

      {view === 'tldr' ? (
        <TLDRView verdict={verdict} onExpand={() => onViewChange('full')} />
      ) : view === 'groundwork' ? (
        <GroundworkView />
      ) : (
        <FullReportView verdict={verdict} idea={idea} onReset={onReset} />
      )}
    </div>
  )
}

function TLDRView({ verdict, onExpand }: { verdict: Verdict; onExpand: () => void }) {
  const classificationLabels: Record<string, string> = {
    STRONG_SIGNAL: 'STRONG SIGNAL',
    CONDITIONAL_FIT: 'CONDITIONAL FIT',
    WEAK_SIGNAL: 'WEAK SIGNAL',
    NO_MARKET_FIT: 'NO MARKET FIT',
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

  // Extract first meaningful sentence(s) from analysis and humanize
  const extractSummary = (analysis: string, maxLen: number = 120) => {
    const humanized = humanizeReport(analysis)
    const lines = humanized.split('\n').filter(l => l.trim().length > 15 && !l.startsWith('#'))
    const text = lines.slice(0, 2).join(' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
    return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text
  }

  const cleanItem = (text: string) => humanizeReport(text.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim())

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

function GroundworkView() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <div className="reveal-up">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 border border-[var(--accent)] flex items-center justify-center">
              <div className="w-6 h-6 bg-[var(--accent)]" />
            </div>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white mb-4 tracking-tight">
            GROUNDWORK
          </h1>
          <p className="text-[var(--fg-muted)] max-w-lg mx-auto">
            Deep market research, competitive intelligence, and institutional-grade validation.
          </p>
        </div>

        {/* Coming Soon Card */}
        <div className="border border-[var(--border)] bg-[var(--bg-secondary)] p-12 text-center">
          <p className="label text-[var(--accent)] mb-6">Coming in V2</p>
          
          <div className="grid md:grid-cols-2 gap-6 text-left mb-12">
            <div className="p-6 border border-[var(--border)]">
              <p className="text-white font-medium mb-2">Market Intelligence</p>
              <p className="text-[var(--fg-muted)] text-sm">TAM/SAM/SOM analysis, market trends, growth projections, and timing signals.</p>
            </div>
            <div className="p-6 border border-[var(--border)]">
              <p className="text-white font-medium mb-2">Competitive Landscape</p>
              <p className="text-[var(--fg-muted)] text-sm">Deep competitor analysis, positioning maps, and differentiation opportunities.</p>
            </div>
            <div className="p-6 border border-[var(--border)]">
              <p className="text-white font-medium mb-2">Investment Thesis</p>
              <p className="text-[var(--fg-muted)] text-sm">VC-grade thesis construction with supporting evidence and risk factors.</p>
            </div>
            <div className="p-6 border border-[var(--border)]">
              <p className="text-white font-medium mb-2">Validation Signals</p>
              <p className="text-[var(--fg-muted)] text-sm">Customer discovery insights, demand indicators, and go-to-market readiness.</p>
            </div>
          </div>

          <p className="text-[var(--fg-subtle)] text-sm">
            Agentic deep research • Multi-source intelligence • Institutional-grade output
          </p>
        </div>
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

  const classificationConfig: Record<string, { label: string; color: string }> = {
    STRONG_SIGNAL: { label: 'STRONG SIGNAL', color: 'var(--accent)' },
    CONDITIONAL_FIT: { label: 'CONDITIONAL FIT', color: 'var(--accent)' },
    WEAK_SIGNAL: { label: 'WEAK SIGNAL', color: '#fbbf24' },
    NO_MARKET_FIT: { label: 'NO MARKET FIT', color: '#f87171' },
  }
  const config = classificationConfig[verdict.decision] || classificationConfig.CONDITIONAL_FIT

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
          <p className="text-[var(--fg-muted)] text-lg leading-relaxed mb-8">{humanizeReport(verdict.executiveSummary)}</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border border-[var(--border)] bg-[var(--bg-secondary)]">
              <p className="label text-[var(--accent)] mb-4">Key Strengths</p>
              <ul className="space-y-3">
                {verdict.keyStrengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[var(--fg-muted)]">
                    <span className="text-[var(--accent)]">+</span>
                    <span>{humanizeReport(cleanText(s))}</span>
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
                    <span>{humanizeReport(cleanText(r))}</span>
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
          accentColor="#4ade80"
          expanded={expandedSections.has('catalyst')}
          onToggle={() => toggleSection('catalyst')}
        />

        <ReportSection
          id="fire-squad"
          title="Fire Squad"
          subtitle="The skeptics — stress-testing"
          content={verdict.fire.analysis}
          score={dimensions.competitionRisk}
          accentColor="#f87171"
          expanded={expandedSections.has('fire')}
          onToggle={() => toggleSection('fire')}
        />

        <ReportSection
          id="committee-decision"
          title="Committee Decision"
          subtitle="Final synthesis"
          content={verdict.synthesis.analysis}
          score={verdict.confidence}
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
  score,
  accentColor = 'var(--accent)',
  expanded,
  onToggle,
}: {
  id: string
  title: string
  subtitle: string
  content: string
  score?: number
  accentColor?: string
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
                // Skip rendering tables - they don't display well
                table: () => null,
                thead: () => null,
                tbody: () => null,
                tr: () => null,
                th: () => null,
                td: () => null,
              }}
            >
              {humanizeReport(content)}
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

// Humanize AI-generated report content for professional display
function humanizeReport(text: string): string {
  if (!text) return text
  
  let result = text
  
  // Remove emojis
  result = result.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|🔴|🟠|🟡|🟢|🔥|💡|✅|❌|⚠️|📊|🎯|💪|🚀|⭐|✨|📈|📉|💰|🏆|🎉|👍|👎|❗|❓|🔍|📝|💼|🌟|⚡/gu, '')
  
  // Remove markdown table syntax and convert to prose
  result = result.replace(/\|[^\n]+\|/g, (match) => {
    // Extract cell content
    const cells = match.split('|').filter(c => c.trim() && !c.match(/^[\s-:]+$/))
    return cells.join(' — ')
  })
  result = result.replace(/^\s*\|?[\s-:|]+\|?\s*$/gm, '') // Remove separator rows
  
  // Remove excessive markdown headers (keep h1, h2, simplify)
  result = result.replace(/^#{4,}\s*/gm, '### ')
  
  // Remove inline bold headers with colons at start of lines
  result = result.replace(/^\*\*([^*]+)\*\*:\s*/gm, '$1: ')
  
  // Remove promotional/AI language
  const aiWords = [
    /\bserves as\b/gi,
    /\bstands as\b/gi,
    /\bis a testament to\b/gi,
    /\bunderscore[sd]?\b/gi,
    /\bhighlight[sd]?\b/gi,
    /\bpivotal\b/gi,
    /\bcrucial\b/gi,
    /\bgroundbreaking\b/gi,
    /\brevolutionary\b/gi,
    /\bseamless\b/gi,
    /\brobust\b/gi,
    /\bleverag(e|ing|ed)\b/gi,
    /\bdelve[sd]?\b/gi,
    /\btapestry\b/gi,
    /\blandscape\b(?!\s+analysis)/gi, // keep "landscape analysis"
    /\bvibrant\b/gi,
    /\benduring\b/gi,
    /\bfostering\b/gi,
    /\bshowcas(e|ing|ed)\b/gi,
    /\bencompass(es|ing|ed)?\b/gi,
    /\bmoreover,?\s*/gi,
    /\bfurthermore,?\s*/gi,
    /\badditionally,?\s*/gi,
    /\bin today's\b/gi,
    /\bin the realm of\b/gi,
    /\bit's worth noting that\b/gi,
    /\bit is important to note that\b/gi,
  ]
  
  for (const pattern of aiWords) {
    result = result.replace(pattern, '')
  }
  
  // Remove "It's not just X, it's Y" patterns
  result = result.replace(/it'?s not just ([^,]+),\s*it'?s/gi, 'This is')
  
  // Remove em-dash overuse (keep max 1 per sentence)
  result = result.replace(/—([^—]+)—/g, ', $1,')
  
  // Remove excessive exclamation marks
  result = result.replace(/!{2,}/g, '.')
  result = result.replace(/!\s*$/gm, '.')
  
  // Clean up double spaces and multiple newlines
  result = result.replace(/  +/g, ' ')
  result = result.replace(/\n{3,}/g, '\n\n')
  
  // Remove lines that are just dashes or equals
  result = result.replace(/^[-=]{3,}\s*$/gm, '')
  
  // Remove "Here's" and "Let's" openers
  result = result.replace(/^here'?s\s+(what|how|why|the)\b/gmi, '')
  result = result.replace(/^let'?s\s+(dive|explore|look|examine)\b/gmi, '')
  
  // Clean up any resulting double spaces or leading spaces
  result = result.replace(/  +/g, ' ')
  result = result.replace(/^\s+/gm, '')
  
  return result.trim()
}

// Score bar component - renders ████████░░ style bars
function ScoreBar({ score, max = 10, showNumber = true }: { score: number; max?: number; showNumber?: boolean }) {
  const filled = Math.round((score / max) * 10)
  const empty = 10 - filled
  
  return (
    <span className="font-mono text-sm inline-flex items-center gap-2">
      <span className="text-[var(--accent)]">
        {'█'.repeat(filled)}
        <span className="text-white/20">{'░'.repeat(empty)}</span>
      </span>
      {showNumber && <span className="text-white/40 w-4 text-right">{score}</span>}
    </span>
  )
}

// KRONOS: Technical Midnight Editorial Landing Page
function LandingPageKronos({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="min-h-screen bg-[var(--deep-black)] relative overflow-hidden">
      {/* Background Effects */}
      <div className="mosaic-grid" />
      <div className="light-leak light-leak-orange" />
      <div className="light-leak light-leak-blue" />
      
      {/* Fixed Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 nav-blend">
        <div className="max-w-7xl mx-auto px-8 md:px-16 py-6 flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-1">
            <span className="font-display text-2xl font-bold tracking-tight">
              Prebloom
            </span>
            <img src="/prebloom-logo.jpg" alt="" className="w-4 h-4 object-contain ml-1" />
          </div>
          
          {/* Nav Links - Hidden on mobile */}
          <nav className="hidden md:flex items-center gap-12">
            <a href="#how" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[var(--coral)] transition-colors">
              01. How it works
            </a>
            <a href="#features" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[var(--coral)] transition-colors">
              02. Features
            </a>
            <a href="#who" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[var(--coral)] transition-colors">
              03. Who it's for
            </a>
          </nav>
          
          {/* CTA */}
          <button
            onClick={onGetStarted}
            className="px-6 py-3 bg-[#22c55e] text-black font-mono text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-[#4ade80] transition-all shadow-[0_0_25px_rgba(34,197,94,0.4)]"
          >
            Submit idea
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center pt-24 px-8 md:px-16 relative z-10">
        <div className="max-w-7xl mx-auto w-full">
          <div className="reveal-up">
            {/* Label */}
            <div className="flex items-center gap-4 mb-8">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
                Startup idea validation
              </span>
              <div className="h-px w-16 bg-white/20"></div>
            </div>
            
            {/* Main Headline */}
            <h1 className="font-display text-[12vw] md:text-[15vw] uppercase leading-[0.85] tracking-tighter mb-8">
              <span className="block">Test the</span>
              <span className="block text-[var(--mint)] drop-shadow-[0_0_30px_rgba(158,255,191,0.4)]">ground.</span>
            </h1>
          </div>
          
          {/* Bottom metadata */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mt-12 gap-8 reveal-up stagger-2">
            <div className="flex gap-12">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-2">System</span>
                <span className="font-mono text-sm text-[var(--coral)]">Multi-Agent</span>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-2">Version</span>
                <span className="font-mono text-sm">2026.1</span>
              </div>
            </div>
            
            <p className="max-w-xs text-sm text-white/40 font-light leading-relaxed reveal-up stagger-3">
              A multi-agent system that analyzes startup ideas from multiple perspectives and delivers a structured verdict.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="stats-grid bg-black/50 backdrop-blur-sm relative z-10">
        <div className="p-8 md:p-12 reveal-up stagger-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-4">Perspectives</span>
          <span className="font-display text-3xl">4</span>
        </div>
        <div className="p-8 md:p-12 reveal-up stagger-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-4">Languages</span>
          <span className="font-display text-3xl">13+</span>
        </div>
        <div className="p-8 md:p-12 reveal-up stagger-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-4">Analysis Time</span>
          <span className="font-display text-3xl">~90s</span>
        </div>
        <div className="p-8 md:p-12 reveal-up stagger-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 block mb-4">Verdict Type</span>
          <span className="font-display text-3xl text-[var(--mint)]">STRUCTURED</span>
        </div>
      </section>

      {/* Editorial Content Block */}
      <section className="px-8 md:px-16 py-32 md:py-48 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Sticky Heading */}
          <div className="md:col-span-3 md:sticky md:top-32 h-fit">
            <span className="font-mono text-[12px] text-[var(--gold)] uppercase tracking-[0.2em] block mb-6">The Problem</span>
            <h2 className="font-display text-4xl md:text-5xl uppercase tracking-tighter leading-[0.9]">
              Ideas are<br />everywhere.
            </h2>
          </div>
          
          {/* Content Column */}
          <div className="md:col-start-6 md:col-span-7">
            <p className="text-xl md:text-2xl font-light text-white/80 leading-[1.6] mb-12">
              AI made that easy. Knowing which ones are worth building — that's the hard part. Founders waste months on the wrong thing. Investors miss signal in the noise. Incubators can't keep up.
            </p>
            <p className="text-xl md:text-2xl font-light text-white/80 leading-[1.6] mb-12">
              Everything is bubbling. You need clarity before you plant.
            </p>
            
            <a href="#how" className="group inline-flex items-center gap-4 border-b border-white/20 pb-2 hover:border-white/40 transition-colors">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]">See how it works</span>
              <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="border-t border-white/5 relative z-10">
        <div className="px-8 md:px-16 py-16">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">03. Process</span>
        </div>
        
        <div className="stats-grid">
          <div className="p-8 md:p-12">
            <span className="font-display text-6xl text-white/10 block mb-4">01</span>
            <h3 className="font-display text-2xl uppercase mb-4">Submit</h3>
            <p className="text-sm text-white/40 font-light leading-relaxed">
              Describe your idea in plain language. Problem, solution, market, model.
            </p>
          </div>
          <div className="p-8 md:p-12">
            <span className="font-display text-6xl text-white/10 block mb-4">02</span>
            <h3 className="font-display text-2xl uppercase mb-4">Analysis</h3>
            <p className="text-sm text-white/40 font-light leading-relaxed">
              Multi-perspective evaluation runs automatically across four specialized agents.
            </p>
          </div>
          <div className="p-8 md:p-12">
            <span className="font-display text-6xl text-white/10 block mb-4">03</span>
            <h3 className="font-display text-2xl uppercase mb-4">Market Fit Scan</h3>
            <p className="text-sm text-white/40 font-light leading-relaxed">
              Strong Signal, Conditional, or Weak — with strengths, risks, and next steps.
            </p>
          </div>
          <div className="p-8 md:p-12">
            <span className="font-display text-6xl text-white/10 block mb-4">04</span>
            <h3 className="font-display text-2xl uppercase mb-4">Iterate</h3>
            <p className="text-sm text-white/40 font-light leading-relaxed">
              Refine your idea based on feedback. Submit again when ready.
            </p>
          </div>
        </div>
      </section>

      {/* Bento Feature Grid */}
      <section id="features" className="px-8 md:px-16 py-32 relative z-10">
        <div className="max-w-7xl mx-auto">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] block mb-8">04. What you get</span>
          
          <div className="bento-grid grid-cols-1 md:grid-cols-2">
            <div className="p-12 accent-forest">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--forest)] font-bold block mb-4">Market Fit Scan</span>
              <h3 className="font-display text-3xl uppercase mb-6">Clear Signal</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                Strong Signal / Conditional Fit / Weak Signal — with confidence score. No ambiguity.
              </p>
            </div>
            <div className="p-12 accent-coral">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--coral)] font-bold block mb-4">Strengths</span>
              <h3 className="font-display text-3xl uppercase mb-6">Key Advantages</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                What's working in your favor. Your unfair advantages exposed.
              </p>
            </div>
            <div className="p-12 accent-mint">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--mint)] font-bold block mb-4">Risks</span>
              <h3 className="font-display text-3xl uppercase mb-6">Kill Conditions</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                What could kill this idea. Critical risks you need to address.
              </p>
            </div>
            <div className="p-12 accent-gold">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] font-bold block mb-4">Next Steps</span>
              <h3 className="font-display text-3xl uppercase mb-6">Action Plan</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                Concrete recommendations. What to do next to validate or pivot.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section id="who" className="border-t border-white/5 px-8 md:px-16 py-32 relative z-10">
        <div className="max-w-7xl mx-auto">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)] block mb-8">05. Use cases</span>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
            <div className="bg-[var(--deep-black)] p-12">
              <h3 className="font-display text-2xl uppercase mb-4">Founders</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                Get clarity before you build. Validate before you invest months of your life.
              </p>
            </div>
            <div className="bg-[var(--deep-black)] p-12">
              <h3 className="font-display text-2xl uppercase mb-4">Investors</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                Screen deal flow at scale. First-pass analysis before the meeting.
              </p>
            </div>
            <div className="bg-[var(--deep-black)] p-12">
              <h3 className="font-display text-2xl uppercase mb-4">Incubators</h3>
              <p className="text-sm text-white/40 leading-relaxed font-light">
                Evaluate applicants systematically. Consistent, structured feedback.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Form CTA */}
      <section className="py-32 px-8 flex justify-center items-center relative z-10">
        <div className="max-w-[640px] w-full p-12 border border-white/10 corner-markers relative">
          <div className="text-center mb-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--mint)] block mb-4">Ready?</span>
            <h2 className="font-display text-4xl uppercase tracking-tighter">
              Test the ground.<br />Pitch your seed.
            </h2>
          </div>
          
          <p className="text-center text-white/40 font-mono text-sm mb-12">
            Every seed starts with an idea.<br />Describe yours. We'll dig into the rest.
          </p>
          
          <button
            onClick={onGetStarted}
            className="w-full py-6 bg-[#22c55e] text-black font-display uppercase font-bold tracking-widest hover:bg-[#4ade80] transition-all shadow-[0_0_40px_rgba(34,197,94,0.5)] hover:shadow-[0_0_60px_rgba(34,197,94,0.7)]"
          >
            Submit your idea
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--vantablack)] pt-48 pb-12 px-8 md:px-16 relative overflow-hidden">
        {/* Ghost Brand Mark */}
        <div className="ghost-text">PREBLOOM</div>
        
        {/* Email CTA */}
        <a 
          href="mailto:hello@prebloom.ai" 
          className="block text-center font-display text-4xl md:text-8xl font-bold uppercase tracking-tighter border-b border-white/10 pb-4 mb-24 hover:opacity-50 transition-opacity relative z-10"
        >
          hello@prebloom.ai
        </a>
        
        {/* Footer Info */}
        <div className="border-t border-white/5 pt-12 flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
          <span className="font-mono text-[10px] text-white/40 uppercase tracking-[0.2em]">
            © 2026 Prebloom. Amsterdam 🌷
          </span>
          
          <div className="flex gap-12">
            <a href="#" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[var(--mint)] transition-colors">
              Twitter
            </a>
            <a href="#" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[var(--mint)] transition-colors">
              Github
            </a>
            <a href="#" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-[var(--mint)] transition-colors">
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
