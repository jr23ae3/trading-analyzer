import { useTradeJournalStore } from '@/store'
import { analyzeCoaching } from '@/services'
import type { MistakeFrequency, CoachingRecommendation } from '@/services'

export function CoachingPanel() {
  const trades = useTradeJournalStore((s) => s.trades)
  const analysis = analyzeCoaching(trades)

  if (trades.length < 2) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-2">Need at least 2 trades to analyze</p>
          <p className="text-slate-500 text-sm">You have {trades.length} trades so far</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Coaching Analysis</h2>
        <p className="text-slate-400">{analysis.summary}</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Trades', value: String(analysis.totalTrades), cls: 'text-white' },
          { label: 'Closed Trades', value: String(analysis.closedTrades), cls: 'text-white' },
          { label: 'Win Rate', value: `${analysis.winRate.toFixed(1)}%`, cls: analysis.winRate >= 50 ? 'text-green-400' : 'text-red-400' },
          { label: 'Unique Mistakes', value: String(analysis.mistakes.length), cls: 'text-yellow-400' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-lg font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Personalized Coaching</h3>
          {analysis.recommendations.map((rec, idx) => (
            <RecommendationCard key={idx} recommendation={rec} />
          ))}
        </div>
      )}

      {/* Recurring Mistakes */}
      {analysis.mistakes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Recurring Mistakes Analysis</h3>
          <div className="space-y-3">
            {analysis.mistakes.map((mistake, idx) => (
              <MistakeCard key={idx} mistake={mistake} idx={idx} />
            ))}
          </div>
        </div>
      )}

      {analysis.mistakes.length === 0 && analysis.recommendations.length === 0 && (
        <div className="bg-slate-800/50 rounded-lg p-6 border border-green-600/30 text-center">
          <p className="text-green-400 font-semibold mb-2">✓ Excellent Performance</p>
          <p className="text-slate-300 text-sm">No major recurring mistakes detected. Keep up your discipline!</p>
        </div>
      )}
    </div>
  )
}

function RecommendationCard({ recommendation }: { recommendation: CoachingRecommendation }) {
  const priorityColors: Record<string, string> = {
    critical: 'bg-red-600/10 border-red-600/30 text-red-400',
    high: 'bg-orange-600/10 border-orange-600/30 text-orange-400',
    medium: 'bg-yellow-600/10 border-yellow-600/30 text-yellow-400',
    low: 'bg-blue-600/10 border-blue-600/30 text-blue-400',
  }

  const priorityBgColors: Record<string, string> = {
    critical: 'bg-red-600/20 text-red-300',
    high: 'bg-orange-600/20 text-orange-300',
    medium: 'bg-yellow-600/20 text-yellow-300',
    low: 'bg-blue-600/20 text-blue-300',
  }

  return (
    <div className={`rounded-lg border p-4 ${priorityColors[recommendation.priority]}`}>
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-white">{recommendation.title}</h4>
        <span className={`text-xs px-2 py-1 rounded font-medium ${priorityBgColors[recommendation.priority]}`}>
          {recommendation.priority.toUpperCase()}
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-3">{recommendation.description}</p>

      {/* Impact */}
      <div className="mb-3 p-3 bg-slate-800/40 rounded">
        <p className="text-xs text-slate-400 font-medium mb-1">Potential Impact:</p>
        <p className="text-sm text-slate-200">{recommendation.impact}</p>
      </div>

      {/* Action */}
      <div className="mb-3">
        <p className="text-xs text-slate-400 font-medium mb-2">Your Action:</p>
        <p className="text-sm text-slate-200 bg-slate-800/40 rounded p-3">{recommendation.action}</p>
      </div>

      {/* Examples */}
      <div>
        <p className="text-xs text-slate-400 font-medium mb-2">Examples:</p>
        <ul className="space-y-1">
          {recommendation.examples.map((example, idx) => (
            <li key={idx} className="text-sm text-slate-300 flex gap-2">
              <span className="text-slate-500">•</span>
              {example}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function MistakeCard({ mistake, idx }: { mistake: MistakeFrequency; idx: number }) {
  const impactColors: Record<string, string> = {
    critical: 'bg-red-600/20 text-red-300',
    high: 'bg-orange-600/20 text-orange-300',
    medium: 'bg-yellow-600/20 text-yellow-300',
    low: 'bg-blue-600/20 text-blue-300',
  }

  const borderColors: Record<string, string> = {
    critical: 'border-red-600/30',
    high: 'border-orange-600/30',
    medium: 'border-yellow-600/30',
    low: 'border-blue-600/30',
  }

  const percentageBg = Math.min(100, Math.max(10, mistake.percentage * 3))

  return (
    <div className={`rounded-lg border border-slate-700 p-4 ${borderColors[mistake.impact]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h5 className="font-semibold text-white text-sm">
              #{idx + 1}: {mistake.mistake}
            </h5>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${impactColors[mistake.impact]}`}>
              {mistake.impact.toUpperCase()}
            </span>
          </div>

          {/* Stats Row */}
          <div className="flex gap-4 mb-3 text-sm">
            <div>
              <span className="text-slate-400 text-xs">Frequency</span>
              <p className="text-white font-semibold">{mistake.count}x ({mistake.percentage.toFixed(1)}%)</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Win Rate With This Mistake</span>
              <p className="text-red-400 font-semibold">{mistake.winRateWithMistake.toFixed(1)}%</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Win Rate Without</span>
              <p className="text-green-400 font-semibold">{mistake.winRateWithoutMistake.toFixed(1)}%</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Estimated Cost</span>
              <p className="text-yellow-400 font-semibold">{(mistake.winRateWithoutMistake - mistake.winRateWithMistake).toFixed(1)}% ↓</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                mistake.impact === 'critical'
                  ? 'bg-red-600'
                  : mistake.impact === 'high'
                    ? 'bg-orange-600'
                    : mistake.impact === 'medium'
                      ? 'bg-yellow-600'
                      : 'bg-blue-600'
              }`}
              style={{ width: `${percentageBg}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="bg-slate-800/40 rounded p-3 text-sm text-slate-300">
        <p>
          <strong>Insight:</strong> When you make this mistake, your win rate drops to{' '}
          <span className="text-red-400 font-semibold">{mistake.winRateWithMistake.toFixed(1)}%</span> compared to{' '}
          <span className="text-green-400 font-semibold">{mistake.winRateWithoutMistake.toFixed(1)}%</span> when you avoid it.
          This mistake is costing you about{' '}
          <span className="font-semibold">{(mistake.winRateWithoutMistake - mistake.winRateWithMistake).toFixed(1)}%</span> in
          win rate.
        </p>
      </div>
    </div>
  )
}
