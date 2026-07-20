import { useWatchlist } from '@/context'
import { useChartStore } from '@/store'
import { cn } from '@/utils'

export function Watchlist() {
  const { watchlist, removeSymbol } = useWatchlist()
  const activeSymbol = useChartStore((s) => s.activeSymbol)
  const setActiveSymbol = useChartStore((s) => s.setActiveSymbol)

  return (
    <div className="flex flex-col gap-1">
      <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
        Watchlist
      </h3>
      {watchlist.map(({ symbol }) => (
        <div
          key={symbol.ticker}
          className={cn(
            'flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors',
            activeSymbol === symbol.ticker
              ? 'bg-blue-600/20 text-white'
              : 'text-slate-300 hover:bg-slate-700',
          )}
          onClick={() => setActiveSymbol(symbol.ticker)}
        >
          <div>
            <p className="text-sm font-medium">{symbol.ticker}</p>
            <p className="text-xs text-slate-500">{symbol.exchange}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); removeSymbol(symbol.ticker) }}
            className="text-slate-600 hover:text-red-400 text-xs"
            aria-label={`Remove ${symbol.ticker}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
