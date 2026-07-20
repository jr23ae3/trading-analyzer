import { useEffect, useState } from 'react'
import { useChartStore } from '@/store'
import { analyzeSetup } from '@/lib/setupRating'
import type { SetupRatingOptions, SetupRatingResults } from '@/lib/setupRatingTypes'

/**
 * Real-time setup rating hook.
 * Analyzes current chart conditions and rates the setup comprehensively.
 */
export function useSetupRating(opts?: SetupRatingOptions): SetupRatingResults {
  const bars = useChartStore((s) => s.bars)
  const [results, setResults] = useState<SetupRatingResults>({
    current: null,
    recent: [],
    summary: {
      averageGrade: 'C',
      recentWinRate: 0,
      setupFrequency: 0,
      bestCondition: 'Analyzing...',
    },
  })

  useEffect(() => {
    if (bars.length >= 50) {
      const analysis = analyzeSetup(bars, opts)
      setResults(analysis)
    }
  }, [bars, opts])

  return results
}
