import { useState } from 'react'

type FormData = {
  problem: string
  solution: string
  targetMarket: string
  businessModel: string
  whyYou: string
  email: string
}

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

type AppState = 'form' | 'loading' | 'result'

const API_BASE = import.meta.env.PROD ? '' : ''

export default function App() {
  const [state, setState] = useState<AppState>('form')
  const [formData, setFormData] = useState<FormData>({
    problem: '',
    solution: '',
    targetMarket: '',
    businessModel: '',
    whyYou: '',
    email: '',
  })
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setState('loading')

    try {
      // Submit idea
      const submitRes = await fetch(`${API_BASE}/prebloom/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!submitRes.ok) {
        throw new Error('Failed to submit idea')
      }

      const { jobId } = await submitRes.json()

      // Poll for result
      let attempts = 0
      const maxAttempts = 60 // 5 minutes max

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000)) // Poll every 5s
        
        const pollRes = await fetch(`${API_BASE}/prebloom/evaluate/${jobId}`)
        const pollData = await pollRes.json()

        if (pollData.status === 'completed') {
          setVerdict(pollData.verdict)
          setState('result')
          return
        }

        if (pollData.status === 'failed') {
          throw new Error(pollData.error || 'Evaluation failed')
        }

        attempts++
      }

      throw new Error('Evaluation timed out')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setState('form')
    }
  }

  const resetForm = () => {
    setState('form')
    setVerdict(null)
    setFormData({
      problem: '',
      solution: '',
      targetMarket: '',
      businessModel: '',
      whyYou: '',
      email: '',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-prebloom-50 to-white">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-prebloom-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xl">🌱</span>
          </div>
          <h1 className="text-2xl font-bold text-prebloom-800">Prebloom</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {state === 'form' && (
          <FormView 
            formData={formData} 
            setFormData={setFormData} 
            onSubmit={handleSubmit}
            error={error}
          />
        )}

        {state === 'loading' && <LoadingView />}

        {state === 'result' && verdict && (
          <ResultView verdict={verdict} onReset={resetForm} />
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-gray-500 text-sm">
        <p>© 2026 Prebloom. Validate before you build.</p>
      </footer>
    </div>
  )
}

function FormView({ 
  formData, 
  setFormData, 
  onSubmit,
  error 
}: { 
  formData: FormData
  setFormData: (data: FormData) => void
  onSubmit: (e: React.FormEvent) => void
  error: string | null
}) {
  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Will your idea bloom?
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Get expert AI feedback on your startup idea. Our council of specialized agents 
          will stress-test your concept and deliver a clear verdict.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Tell us about your idea</h3>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What problem are you solving? *
          </label>
          <textarea
            required
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-prebloom-500 focus:border-transparent"
            placeholder="Describe the pain point your target customers face..."
            value={formData.problem}
            onChange={e => setFormData({ ...formData, problem: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What's your solution? *
          </label>
          <textarea
            required
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-prebloom-500 focus:border-transparent"
            placeholder="Describe your product or service..."
            value={formData.solution}
            onChange={e => setFormData({ ...formData, solution: e.target.value })}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target market *
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-prebloom-500 focus:border-transparent"
              placeholder="Who are your customers?"
              value={formData.targetMarket}
              onChange={e => setFormData({ ...formData, targetMarket: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business model *
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-prebloom-500 focus:border-transparent"
              placeholder="How will you make money?"
              value={formData.businessModel}
              onChange={e => setFormData({ ...formData, businessModel: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Why you? (optional)
          </label>
          <input
            type="text"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-prebloom-500 focus:border-transparent"
            placeholder="What makes you the right person to build this?"
            value={formData.whyYou}
            onChange={e => setFormData({ ...formData, whyYou: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <input
            required
            type="email"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-prebloom-500 focus:border-transparent"
            placeholder="We'll send your results here"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-prebloom-600 hover:bg-prebloom-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
        >
          Get Your Verdict — €29
        </button>

        <p className="text-center text-sm text-gray-500">
          Your idea will be evaluated by our AI council: Intake, Catalyst, Fire, and Synthesis agents.
        </p>
      </form>
    </div>
  )
}

function LoadingView() {
  return (
    <div className="text-center py-20">
      <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-prebloom-500 border-t-transparent mb-6"></div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">The Council is deliberating...</h2>
      <p className="text-gray-600 max-w-md mx-auto">
        Our AI agents are analyzing your idea from every angle. This usually takes 1-2 minutes.
      </p>
      <div className="mt-8 space-y-2 text-sm text-gray-500">
        <p>🔍 Intake Agent: Understanding your idea...</p>
        <p>💪 Catalyst Agent: Building the bull case...</p>
        <p>🔥 Fire Agent: Stress-testing ruthlessly...</p>
        <p>⚖️ Synthesis Agent: Weighing the verdict...</p>
      </div>
    </div>
  )
}

function ResultView({ verdict, onReset }: { verdict: Verdict; onReset: () => void }) {
  const decisionColors = {
    PASS: 'bg-green-100 text-green-800 border-green-300',
    CONDITIONAL_PASS: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    FAIL: 'bg-red-100 text-red-800 border-red-300',
  }

  const decisionLabels = {
    PASS: '✅ PASS',
    CONDITIONAL_PASS: '⚠️ CONDITIONAL PASS',
    FAIL: '❌ FAIL',
  }

  return (
    <div className="space-y-8">
      {/* Verdict Header */}
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className={`inline-block px-6 py-3 rounded-full text-2xl font-bold border-2 ${decisionColors[verdict.decision]}`}>
          {decisionLabels[verdict.decision]}
        </div>
        <div className="mt-4 text-4xl font-bold text-gray-800">
          {verdict.confidence}/10
        </div>
        <p className="text-gray-500">Confidence Score</p>
        <p className="mt-6 text-lg text-gray-700 max-w-2xl mx-auto">
          {verdict.executiveSummary}
        </p>
      </div>

      {/* Strengths & Risks */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-green-700 mb-4">🟢 Key Strengths</h3>
          <ul className="space-y-2">
            {verdict.keyStrengths.map((s, i) => (
              <li key={i} className="text-gray-700">• {s}</li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-4">🔴 Key Risks</h3>
          <ul className="space-y-2">
            {verdict.keyRisks.map((r, i) => (
              <li key={i} className="text-gray-700">• {r}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-prebloom-700 mb-4">📋 Recommended Next Steps</h3>
        <ol className="space-y-2">
          {verdict.nextSteps.map((n, i) => (
            <li key={i} className="text-gray-700">{i + 1}. {n}</li>
          ))}
        </ol>
      </div>

      {/* Agent Details (Collapsible) */}
      <details className="bg-white rounded-xl shadow-lg p-6">
        <summary className="text-lg font-semibold text-gray-700 cursor-pointer">
          📊 Full Agent Analyses
        </summary>
        <div className="mt-4 space-y-6">
          <AgentSection title="Intake Agent" content={verdict.intake.analysis} />
          <AgentSection title="Catalyst Agent (Bull Case)" content={verdict.catalyst.analysis} />
          <AgentSection title="Fire Agent (Bear Case)" content={verdict.fire.analysis} />
          <AgentSection title="Synthesis Agent (Final Verdict)" content={verdict.synthesis.analysis} />
        </div>
      </details>

      {/* Actions */}
      <div className="text-center space-x-4">
        <button
          onClick={onReset}
          className="bg-prebloom-600 hover:bg-prebloom-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          Evaluate Another Idea
        </button>
      </div>
    </div>
  )
}

function AgentSection({ title, content }: { title: string; content: string }) {
  return (
    <div className="border-t pt-4">
      <h4 className="font-semibold text-gray-800 mb-2">{title}</h4>
      <div className="text-gray-600 whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
        {content}
      </div>
    </div>
  )
}
