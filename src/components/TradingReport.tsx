import { useSetupRating, useProbabilityAnalysis } from '@/hooks'
import { useChartStore } from '@/store'

/**
 * Comprehensive Trading Report
 * Aggregates all analysis engines into professional report format
 */
export function TradingReport() {
  const bars = useChartStore((s) => s.bars)
  const activeSymbol = useChartStore((s) => s.activeSymbol)

  const setupRating = useSetupRating()
  const probability = useProbabilityAnalysis()

  if (!bars || bars.length === 0) {
    return (
      <div className="p-4 text-slate-400 text-sm">
        <p>Loading chart data...</p>
      </div>
    )
  }

  const current = bars[bars.length - 1]
  const setup = setupRating.current
  const prob = probability.current

  // Extract key data
  const trend = setup?.explanation?.trend || 'Unknown'
  const grade = setup?.grade || 'N/A'
  const confidence = setup?.confidence || 0
  const riskReward = setup?.metrics?.riskRewardRatio || 0

  return (
    <div className="p-4 space-y-6 text-slate-100 text-xs leading-relaxed max-w-3xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-700 pb-4">
        <h1 className="text-2xl font-bold text-blue-400">{activeSymbol} Trading Analysis Report</h1>
        <p className="text-slate-400 text-xs mt-2">
          Generated: {new Date().toLocaleString()} | Current Price: ${current?.close?.toFixed(2)}
        </p>
      </div>

      {/* Executive Summary */}
      <section>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Executive Summary</h2>
        <div className="bg-slate-800/50 rounded p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Setup Grade:</span>
            <span className={`font-bold ${grade === 'A+' || grade === 'A' ? 'text-green-400' : grade === 'B' ? 'text-yellow-400' : 'text-red-400'}`}>
              {grade}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Confidence:</span>
            <span className={confidence > 75 ? 'text-green-400' : confidence > 50 ? 'text-yellow-400' : 'text-red-400'}>
              {confidence.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Expected Direction:</span>
            <span className={trend.includes('Bull') ? 'text-green-400' : 'text-red-400'}>
              {trend}
            </span>
          </div>
        </div>
      </section>

      {/* Current Trend */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Current Trend</h3>
        <p className="text-slate-300">
          {setup?.explanation?.trend || 'Analyzing market structure and trend direction...'}
        </p>
      </section>

      {/* Momentum */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Momentum</h3>
        <div className="bg-slate-800/50 rounded p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Bull Probability:</span>
            <span className="text-green-400 font-bold">
              {prob?.bullProbability?.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Bear Probability:</span>
            <span className="text-red-400 font-bold">
              {prob?.bearProbability?.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Sideways Probability:</span>
            <span className="text-slate-400 font-bold">
              {prob?.sidewaysProbability?.toFixed(1)}%
            </span>
          </div>
        </div>
        <p className="text-slate-300 mt-2">
          {setup?.explanation?.momentum || 'Momentum analysis based on RSI, MACD, and volume patterns.'}
        </p>
      </section>

      {/* Strength */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Strength</h3>
        <ul className="space-y-1 text-slate-300">
          {prob?.analysis?.recommendations && prob.analysis.recommendations.length > 0 ? (
            prob.analysis.recommendations.map((item: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-green-400">✓</span>
                <span>{item}</span>
              </li>
            ))
          ) : (
            <li className="text-slate-400">Analyzing chart patterns and structure...</li>
          )}
        </ul>
      </section>

      {/* Weaknesses */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Weaknesses</h3>
        <ul className="space-y-1 text-slate-300">
          {prob?.analysis?.weaknesses && prob.analysis.weaknesses.length > 0 ? (
            prob.analysis.weaknesses.map((item: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-red-400">✗</span>
                <span>{item}</span>
              </li>
            ))
          ) : (
            <li className="text-slate-400">Analyzing potential risk factors...</li>
          )}
        </ul>
      </section>

      {/* Key Levels */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Key Levels</h3>
        <div className="bg-slate-800/50 rounded p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Current Price:</span>
            <span className="font-bold">${current?.close?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Support (S1):</span>
            <span className="text-red-400">${setup?.metrics?.stopLoss?.toFixed(2) || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Resistance (R1):</span>
            <span className="text-blue-400">${setup?.metrics?.priceTarget?.toFixed(2) || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Entry Level:</span>
            <span className="text-blue-400">${current?.close?.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* Expected Direction */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Expected Direction</h3>
        <p className="text-slate-300">
          {trend.includes('Bull')
            ? 'Market is expected to continue higher. Look for opportunities to buy dips or breakouts above key resistance.'
            : trend.includes('Bear')
              ? 'Market is expected to move lower. Look for opportunities to sell rallies or breakdowns below key support.'
              : 'Market is ranging. Look for breakouts from consolidation zones or reversals from key levels.'}
        </p>
      </section>

      {/* Trade Setup */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Trade Setup</h3>
        <div className="bg-slate-800/50 rounded p-3 space-y-3">
          <div>
            <div className="text-slate-400 mb-1">Entry Point</div>
            <div className="text-blue-400 font-bold text-sm">
              ${current?.close?.toFixed(2)} (Current Market Price)
            </div>
          </div>

          <div>
            <div className="text-slate-400 mb-1">Stop Loss</div>
            <div className="text-red-400 font-bold text-sm">
              ${setup?.metrics?.stopLoss?.toFixed(2) || 'N/A'}
            </div>
            {setup?.metrics?.stopLoss && (
              <div className="text-xs text-slate-400 mt-1">
                Risk: ${(setup.metrics.stopLoss - current.close).toFixed(2)}
              </div>
            )}
          </div>

          <div>
            <div className="text-slate-400 mb-1">Target Levels</div>
            <div className="space-y-1">
              <div className="text-green-400 font-bold text-sm">
                T1: ${setup?.metrics?.priceTarget?.toFixed(2) || 'N/A'}
              </div>
              {setup?.metrics?.priceTarget && (
                <div className="text-xs text-slate-400">
                  Reward: ${(setup.metrics.priceTarget - current.close).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Risk/Reward Analysis */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Risk/Reward Analysis</h3>
        <div className="bg-slate-800/50 rounded p-3 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Risk/Reward Ratio:</span>
            <span className="text-green-400 font-bold">{riskReward.toFixed(2)}:1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Risk Percentage:</span>
            <span className="text-slate-300">
              {setup?.metrics?.riskPercent?.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Reward Percentage:</span>
            <span className="text-slate-300">
              {setup?.metrics?.rewardPercent?.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Expected Move:</span>
            <span className="text-slate-300">
              {setup?.metrics?.expectedMovePercent?.toFixed(2)}%
            </span>
          </div>
        </div>
      </section>

      {/* Confidence & Action */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Trading Action</h3>
        <div className="bg-slate-800/50 rounded p-3 space-y-3">
          <div>
            <div className="text-slate-400 mb-1">Recommendation</div>
            <div className={`font-bold text-sm ${grade === 'A+' || grade === 'A' ? 'text-green-400' : grade === 'B' ? 'text-yellow-400' : 'text-red-400'}`}>
              {grade === 'A+' ? 'STRONG BUY' : grade === 'A' ? 'BUY' : grade === 'B' ? 'HOLD' : grade === 'C' ? 'SELL' : 'AVOID'}
            </div>
          </div>

          <div>
            <div className="text-slate-400 mb-1">Confidence Level</div>
            <div className="w-full bg-slate-700 rounded h-2">
              <div
                className={`h-full rounded ${confidence > 75 ? 'bg-green-500' : confidence > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(confidence, 100)}%` }}
              />
            </div>
            <div className="text-xs text-slate-400 mt-1">{confidence.toFixed(1)}%</div>
          </div>

          <div>
            <div className="text-slate-400 mb-1">Action</div>
            <p className="text-slate-300 text-xs">
              {grade === 'A+' || grade === 'A'
                ? 'Strong entry signal. Risk/reward is favorable. Consider entering position at current levels or on minor pullbacks.'
                : grade === 'B'
                  ? 'Moderate entry signal. Wait for confirmation at key support levels before entering.'
                  : 'Weak or negative signal. Avoid entering new positions. Consider exiting existing longs.'}
            </p>
          </div>
        </div>
      </section>

      {/* Risk Factors */}
      <section>
        <h3 className="text-base font-bold text-slate-100 mb-2">Key Risk Factors</h3>
        <ul className="space-y-1 text-slate-300">
          {setup?.risks && setup.risks.length > 0 ? (
            setup.risks.slice(0, 4).map((risk, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="text-red-400">⚠</span>
                <span>{risk}</span>
              </li>
            ))
          ) : (
            <li className="text-slate-400 text-xs">Analyzing potential risks...</li>
          )}
        </ul>
      </section>

      {/* Footer */}
      <div className="border-t border-slate-700 pt-4 text-xs text-slate-400">
        <p>
          This report is generated by automated technical analysis and should not be considered financial advice. Always conduct your own
          research and consult with a financial advisor before making trading decisions.
        </p>
      </div>
    </div>
  )
}
