import { useCallback } from 'react'
import { useChartStore } from '@/store'
import type { Timeframe } from '@/types'

/**
 * Convenience hook for reading and updating the active symbol / timeframe.
 */
export function useSymbolTimeframe() {
  const activeSymbol = useChartStore((s) => s.activeSymbol)
  const timeframe = useChartStore((s) => s.timeframe)
  const setActiveSymbol = useChartStore((s) => s.setActiveSymbol)
  const setTimeframe = useChartStore((s) => s.setTimeframe)

  const changeSymbol = useCallback(
    (symbol: string) => setActiveSymbol(symbol.toUpperCase().trim()),
    [setActiveSymbol],
  )

  const changeTimeframe = useCallback(
    (tf: Timeframe) => setTimeframe(tf),
    [setTimeframe],
  )

  return { activeSymbol, timeframe, changeSymbol, changeTimeframe }
}
