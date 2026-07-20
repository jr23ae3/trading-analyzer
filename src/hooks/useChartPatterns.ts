import { useEffect, useState } from 'react'
import { detectChartPatterns } from '@/lib/chartPatterns'
import { useChartStore } from '@/store'
import type { PatternEngineResults, PatternDetectionOptions } from '@/lib/patternTypes'

/**
 * React hook for real-time chart pattern detection.
 * Automatically updates when bars change.
 */
export function useChartPatterns(opts?: PatternDetectionOptions): PatternEngineResults {
  const bars = useChartStore((state) => state.bars)
  const [patterns, setPatterns] = useState<PatternEngineResults>({
    patterns: [],
    summary: { totalPatterns: 0, activePatterns: 0, avgConfidence: 0 },
  })

  useEffect(() => {
    if (bars.length < 20) {
      setPatterns({
        patterns: [],
        summary: { totalPatterns: 0, activePatterns: 0, avgConfidence: 0 },
      })
      return
    }

    const result = detectChartPatterns(bars, opts)
    setPatterns(result)
  }, [bars, opts])

  return patterns
}
