import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { postJson, getJson } from '../lib/api'

// --- Types ---

type GroundworkStatus = 'idle' | 'running' | 'complete' | 'failed'

type CrawlLine = {
  id: number
  text: string
  type: 'stage' | 'headline' | 'thinking'
}

type AgentKey =
  | 'competitorIntelligence'
  | 'marketSizing'
  | 'gapAnalysis'
  | 'customerPersonas'
  | 'gtmPlaybook'
  | 'mvpScope'

type AgentOutput = {
  agent: string
  analysis: string
  metrics: {
    durationMs: number
    inputTokens: number
    outputTokens: number
    searches: number
  }
}

type GroundworkResult = {
  id: string
  evaluationId: string
  status: string
  competitorIntelligence?: AgentOutput
  marketSizing?: AgentOutput
  gapAnalysis?: AgentOutput
  customerPersonas?: AgentOutput
  gtmPlaybook?: AgentOutput
  mvpScope?: AgentOutput
  metrics?: {
    totalDurationMs: number
    totalSearches: number
  }
}

// --- Constants ---

const AGENT_META: Record<AgentKey, { label: string; phase: 'A' | 'B'; icon: string }> = {
  competitorIntelligence: { label: 'Competitor Battle Cards', phase: 'A', icon: '?' },
  marketSizing: { label: 'Market Sizing', phase: 'A', icon: '?' },
  gapAnalysis: { label: 'Gap Analysis', phase: 'A', icon: '?' },
  customerPersonas: { label: 'Customer Personas', phase: 'B', icon: '?' },
  gtmPlaybook: { label: 'GTM Playbook', phase: 'B', icon: '?' },
  mvpScope: { label: 'Focus First', phase: 'B', icon: '?' },
}

const THINKING_LINES = [
  'Analyzing market signals...',
  'Cross-referencing data...',
  'Building the picture...',
  'Connecting the dots...',
  'Digging deeper...',
  'Synthesizing insights...',
]

// --- Component ---

export function GroundworkView({ evaluationId }: { evaluationId: string | null }) {
  const [status, setStatus] = useState<GroundworkStatus>('idle')
  const [crawlLines, setCrawlLines] = useState<CrawlLine[]>([])
  const [result, setResult] = useState<GroundworkResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lineIdRef = useRef(0)
  const thinkingTimerRef = useRef<number | null>(null)

  // Check if groundwork already exists for this evaluation
  useEffect(() => {
    if (!evaluationId) return
    getJson(`/prebloom/groundwork/${evaluationId}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'completed') {
            setResult(data)
            setStatus('complete')
          } else if (data.status === 'running') {
            setStatus('running')
          }
        }
      })
      .catch(() => {})
  }, [evaluationId])

  const addCrawlLine = useCallback((text: string, type: CrawlLine['type']) => {
    const id = ++lineIdRef.current
    setCrawlLines((prev) => [...prev, { id, text, type }])
  }, [])

  const startThinkingLines = useCallback(() => {
    let idx = 0
    const tick = () => {
      addCrawlLine(THINKING_LINES[idx % THINKING_LINES.length], 'thinking')
      idx++
      thinkingTimerRef.current = window.setTimeout(tick, 8000 + Math.random() * 4000)
    }
    thinkingTimerRef.current = window.setTimeout(tick, 5000)
  }, [addCrawlLine])

  const stopThinkingLines = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current)
      thinkingTimerRef.current = null
    }
  }, [])

  const handleRun = useCallback(async () => {
    if (!evaluationId) return

    setStatus('running')
    setError(null)
    setCrawlLines([])
    lineIdRef.current = 0

    startThinkingLines()

    try {
      const res = await postJson('/prebloom/groundwork/run', { evaluationId })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to start Groundwork')
      }

      // Read SSE stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6))
              if (eventType === 'stage' && data.status === 'running' && data.label) {
                stopThinkingLines()
                addCrawlLine(data.label, 'stage')
                startThinkingLines()
              } else if (eventType === 'headline') {
                addCrawlLine(data.text, 'headline')
              } else if (eventType === 'stage' && data.status === 'complete') {
                // Agent complete — thinking lines continue until next stage
              } else if (eventType === 'complete') {
                stopThinkingLines()
                addCrawlLine('Groundwork complete.', 'stage')
              } else if (eventType === 'error') {
                throw new Error(data.error || 'Pipeline failed')
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue
              throw e
            }
            eventType = ''
          }
        }
      }

      // Fetch full result
      stopThinkingLines()
      const resultRes = await getJson(`/prebloom/groundwork/${evaluationId}`)
      if (resultRes.ok) {
        const data = await resultRes.json()
        setResult(data)
        // Brief delay to let the last crawl lines settle before transitioning
        await new Promise((r) => setTimeout(r, 2000))
        setStatus('complete')
      } else {
        throw new Error('Failed to fetch Groundwork results')
      }
    } catch (err) {
      stopThinkingLines()
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('failed')
    }
  }, [evaluationId, addCrawlLine, startThinkingLines, stopThinkingLines])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopThinkingLines()
  }, [stopThinkingLines])

  if (status === 'complete' && result) {
    return <GroundworkReport result={result} onRerun={handleRun} />
  }

  if (status === 'running') {
    return <CrawlAnimation lines={crawlLines} />
  }

  if (status === 'failed') {
    return (
      <CTASection onRun={handleRun}>
        <div className="mt-6 p-4 border border-[var(--error)]/30 bg-[var(--error)]/5 text-[var(--error)] text-sm">
          {error || 'Something went wrong. Try again.'}
        </div>
      </CTASection>
    )
  }

  return <CTASection onRun={handleRun} />
}

// --- CTA Section ---

function CTASection({
  onRun,
  children,
}: {
  onRun: () => void
  children?: React.ReactNode
}) {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="reveal-up">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4 tracking-tight">
            Your idea scored. Now let's build.
          </h2>
          <p className="text-[var(--fg-muted)] max-w-lg mx-auto text-lg">
            The Council told you <span className="text-white">if</span> your idea has potential.
            Groundwork tells you <span className="text-white">how</span> to move forward.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-[var(--border)] border border-[var(--border)] mb-12">
          <div className="bg-[var(--bg-primary)] p-8">
            <p className="label text-[var(--accent)] mb-6">Phase A: Intelligence</p>
            <ul className="space-y-3 text-sm text-[var(--fg-muted)]">
              <li className="flex gap-3"><span className="text-[var(--accent)]">?</span> Competitor Battle Cards</li>
              <li className="flex gap-3"><span className="text-[var(--accent)]">?</span> Market Sizing</li>
              <li className="flex gap-3"><span className="text-[var(--accent)]">?</span> Gap Analysis</li>
            </ul>
          </div>
          <div className="bg-[var(--bg-primary)] p-8">
            <p className="label text-[var(--accent)] mb-6">Phase B: Blueprint</p>
            <ul className="space-y-3 text-sm text-[var(--fg-muted)]">
              <li className="flex gap-3"><span className="text-[var(--accent)]">?</span> Customer Personas</li>
              <li className="flex gap-3"><span className="text-[var(--accent)]">?</span> GTM Playbook</li>
              <li className="flex gap-3"><span className="text-[var(--accent)]">?</span> Focus First</li>
            </ul>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onRun}
            className="px-8 py-4 bg-[var(--accent)] text-black font-medium tracking-wide uppercase text-sm hover:bg-[var(--accent)]/80 transition-colors"
          >
            Run Groundwork
          </button>
          <p className="mt-4 text-xs text-[var(--fg-subtle)]">
            6 AI agents &middot; Deep web research &middot; ~6 minutes
          </p>
        </div>

        {children}
      </div>
    </main>
  )
}

// --- Crawl Animation ---

function CrawlAnimation({ lines }: { lines: CrawlLine[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to show newest lines at the bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  return (
    <div className="crawl-overlay">
      <div className="crawl-container" ref={containerRef}>
        <div className="crawl-perspective">
          <div className="crawl-content">
            {lines.map((line) => (
              <div
                key={line.id}
                className={`crawl-line crawl-line-enter ${
                  line.type === 'stage'
                    ? 'crawl-stage'
                    : line.type === 'headline'
                      ? 'crawl-headline'
                      : 'crawl-thinking'
                }`}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="crawl-fade-top" />
      <div className="crawl-fade-bottom" />
    </div>
  )
}

// --- Report View ---

function GroundworkReport({
  result,
  onRerun,
}: {
  result: GroundworkResult
  onRerun: () => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const phaseA: AgentKey[] = ['competitorIntelligence', 'marketSizing', 'gapAnalysis']
  const phaseB: AgentKey[] = ['customerPersonas', 'gtmPlaybook', 'mvpScope']

  const renderCard = (key: AgentKey) => {
    const meta = AGENT_META[key]
    const output = result[key] as AgentOutput | undefined
    if (!output) return null
    const isOpen = expanded.has(key)

    // Extract first meaningful line as summary
    const firstLine =
      output.analysis
        .split('\n')
        .map((l) => l.replace(/^[\s#*\->]+/, '').trim())
        .find((l) => l.length > 20) || ''
    const summary = firstLine.slice(0, 120) + (firstLine.length > 120 ? '...' : '')

    return (
      <div key={key} className="border border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          onClick={() => toggle(key)}
          className="w-full flex items-center justify-between p-6 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-lg flex-shrink-0">{meta.icon}</span>
            <div className="min-w-0">
              <p className="text-white font-medium">{meta.label}</p>
              {!isOpen && summary && (
                <p className="text-[var(--fg-subtle)] text-sm truncate mt-1">{summary}</p>
              )}
            </div>
          </div>
          <span className="text-[var(--fg-subtle)] flex-shrink-0 ml-4">{isOpen ? '−' : '+'}</span>
        </button>
        {isOpen && (
          <div className="px-6 pb-6 border-t border-[var(--border)]">
            <div className="prose prose-invert prose-sm max-w-none mt-4 text-[var(--fg-muted)] leading-relaxed [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_strong]:text-white [&_a]:text-[var(--accent)]">
              <ReactMarkdown>{output.analysis}</ReactMarkdown>
            </div>
            {output.metrics && (
              <div className="mt-4 pt-4 border-t border-[var(--border)] flex gap-6 text-xs text-[var(--fg-subtle)] font-mono">
                <span>{(output.metrics.durationMs / 1000).toFixed(0)}s</span>
                <span>
                  {output.metrics.inputTokens + output.metrics.outputTokens} tokens
                </span>
                {output.metrics.searches > 0 && (
                  <span>{output.metrics.searches} searches</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 reveal-up">
      <div className="flex items-center justify-between mb-12">
        <div>
          <p className="label text-[var(--accent)] mb-2">Groundwork Complete</p>
          <h2 className="font-display text-3xl text-white tracking-tight">Your Blueprint</h2>
        </div>
        {result.metrics && (
          <div className="text-right text-xs text-[var(--fg-subtle)] font-mono space-y-1">
            <p>{(result.metrics.totalDurationMs / 1000 / 60).toFixed(1)} min</p>
            <p>{result.metrics.totalSearches} web searches</p>
          </div>
        )}
      </div>

      {/* Phase A */}
      <div className="mb-10">
        <p className="label text-[var(--fg-muted)] mb-4">Phase A: Intelligence</p>
        <div className="space-y-px">{phaseA.map(renderCard)}</div>
      </div>

      {/* Phase B */}
      <div className="mb-10">
        <p className="label text-[var(--fg-muted)] mb-4">Phase B: Blueprint</p>
        <div className="space-y-px">{phaseB.map(renderCard)}</div>
      </div>

      <div className="text-center mt-12">
        <button
          onClick={onRerun}
          className="text-xs text-[var(--fg-subtle)] hover:text-white transition-colors uppercase tracking-wide"
        >
          Re-run Groundwork
        </button>
      </div>
    </main>
  )
}
