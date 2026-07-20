import { useEffect, useState } from 'react'
import { useChartStore } from '@/store'
import { analyzeScalpingStrategy } from '@/lib/scalping'
import type { ScalpingEngineOptions, ScalpingEngineResults } from '@/lib/scalpingTypes'

/**
 * Real-time scalping signal detection hook.
 * Subscribes to chart bars and returns current/recent scalping signals.
 */
export function useScalpingSignals(opts?: ScalpingEngineOptions): ScalpingEngineResults {
  const bars = useChartStore((s) => s.bars)
  const [results, setResults] = useState<ScalpingEngineResults>({
    currentSignal: null,
    recentSignals: [],
    summary: { totalSignals: 0, buyCallCount: 0, buyPutCount: 0, waitCount: 0 },
  })

  useEffect(() => {
    if (bars.length >= 50) {
      const analysis = analyzeScalpingStrategy(bars, opts)
      setResults(analysis)
    }
  }, [bars, opts])

  return results
}
