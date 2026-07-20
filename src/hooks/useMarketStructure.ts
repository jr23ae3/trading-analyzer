import { useEffect, useState } from 'react'
import { useChartStore } from '@/store'
import {
  analyzeMarketStructure,
  _neutralMarketStructure,
  type MarketStructureResult,
  type MarketStructureOptions,
} from '@/lib/marketStructure'

/**
 * Subscribe to chart bars and recompute market structure automatically.
 *
 * Full recompute triggers when the bar series is replaced (new symbol / timeframe).
 *
 * @example
 * ```tsx
 * const { trend, swings, trendLines, confidence, scores } = useMarketStructure()
 * ```
 */
export function useMarketStructure(
  options: MarketStructureOptions = {},
): MarketStructureResult {
  const bars = useChartStore((s) => s.bars)
  const [result, setResult] = useState<MarketStructureResult>(_neutralMarketStructure)

  useEffect(() => {
    if (!bars.length) {
      setResult(_neutralMarketStructure())
      return
    }
    setResult(analyzeMarketStructure(bars, options))
  // options intentionally excluded — stable on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars])

  return result
}
