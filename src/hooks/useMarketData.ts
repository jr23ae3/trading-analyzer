import { useEffect } from 'react'
import { useChartStore } from '@/store'
import { fetchBars } from '@/services/marketDataService'

/**
 * Fetches OHLCV bars whenever the active symbol or timeframe changes.
 */
export function useMarketData() {
  const { activeSymbol, timeframe, setLoading, setBars, setError } = useChartStore()

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const bars = await fetchBars(activeSymbol, timeframe)
        if (!cancelled) setBars(bars)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [activeSymbol, timeframe, setLoading, setBars, setError])
}
