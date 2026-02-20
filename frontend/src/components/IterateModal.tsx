import { useState } from 'react'

type ActionItem = {
  id: string
  concern: string
  category: 'market' | 'product' | 'execution' | 'business' | 'timing'
  severity: 'critical' | 'major' | 'minor'
  source: 'synthesis' | 'fire' | 'dimension'
  addressed?: boolean
}

type Verdict = {
  version?: number
  actionItems?: ActionItem[]
  decision: string
  confidence: number
}

interface IterateModalProps {
  verdict: Verdict
  onSubmit: (responses: { actionItemId: string; response: string }[]) => void
  onClose: () => void
}

export function IterateModal({ verdict, onSubmit, onClose }: IterateModalProps) {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const actionItems = verdict.actionItems || []
  const version = verdict.version || 1
  const nextVersion = version + 1

  const severityColors = {
    critical: 'text-red-400 bg-red-400/10 border-red-400/30',
    major: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    minor: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  }

  const categoryLabels = {
    market: '🎯 Market',
    product: '🔧 Product',
    execution: '⚡ Execution',
    business: '💰 Business',
    timing: '⏰ Timing',
  }

  const handleSubmit = () => {
    const responseArray = Object.entries(responses)
      .filter(([_, value]) => value.trim().length > 0)
      .map(([actionItemId, response]) => ({ actionItemId, response }))

    if (responseArray.length === 0) {
      alert('Please respond to at least one concern before re-evaluating.')
      return
    }

    setIsSubmitting(true)
    onSubmit(responseArray)
  }

  const filledCount = Object.values(responses).filter(r => r.trim().length >= 10).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-[#0a0a0a] border border-white/10 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-display uppercase tracking-wide text-white">
                Refine Your Idea
              </h2>
              <p className="text-sm text-white/50 mt-1">
                Version {nextVersion} of 3 • Address the concerns below
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-white/50 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <p className="text-sm text-white/60">
            The AI Squads identified these concerns. Explain how you've addressed each one, 
            or provide new information that changes the assessment.
          </p>

          {actionItems.map((item, index) => (
            <div key={item.id} className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-white/30 font-mono text-sm mt-1">
                  {(index + 1).toString().padStart(2, '0')}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded border ${severityColors[item.severity]}`}>
                      {item.severity}
                    </span>
                    <span className="text-xs text-white/40">
                      {categoryLabels[item.category]}
                    </span>
                  </div>
                  <p className="text-white/90 text-sm leading-relaxed">
                    {item.concern}
                  </p>
                </div>
              </div>
              
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
                rows={3}
                placeholder="How have you addressed this concern?"
                value={responses[item.id] || ''}
                onChange={(e) => setResponses({ ...responses, [item.id]: e.target.value })}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-[#080808]">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">
              {filledCount} of {actionItems.length} concerns addressed
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || filledCount === 0}
                className={`px-6 py-2 text-sm font-medium uppercase tracking-wide transition-all ${
                  isSubmitting || filledCount === 0
                    ? 'bg-white/10 text-white/30 cursor-not-allowed'
                    : 'bg-[var(--accent)] text-black hover:bg-[var(--accent)]/80'
                }`}
              >
                {isSubmitting ? 'Evaluating...' : `Re-evaluate (V${nextVersion})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
