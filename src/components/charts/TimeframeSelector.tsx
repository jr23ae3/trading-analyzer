import { useChartStore } from '@/store'
import { cn } from '@/utils'
import type { Timeframe } from '@/types'

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M']

export function TimeframeSelector() {
  const timeframe = useChartStore((s) => s.timeframe)
  const setTimeframe = useChartStore((s) => s.setTimeframe)

  return (
    <div className="flex gap-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => setTimeframe(tf)}
          className={cn(
            'px-2 py-1 text-xs rounded font-medium transition-colors',
            timeframe === tf
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700',
          )}
        >
          {tf}
        </button>
      ))}
    </div>
  )
}
