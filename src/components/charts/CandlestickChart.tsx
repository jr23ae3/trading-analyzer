import { useChartStore } from '@/store'
import { useWatchlist } from '@/context'
import { cn } from '@/utils'
import { TradingViewWidget, toTVSymbol } from './TradingViewWidget'

export interface CandlestickChartProps {
  className?: string
}

/**
 * Chart panel — embeds the full TradingView Advanced Chart widget.
 *
 * The active symbol from the watchlist is converted to TradingView's
 * "EXCHANGE:TICKER" format so the correct instrument loads automatically.
 * TradingView provides its own built-in timeframe selector and toolbar.
 */
export function CandlestickChart({ className }: CandlestickChartProps) {
  const activeSymbol = useChartStore((s) => s.activeSymbol)
  const { watchlist } = useWatchlist()

  // Look up exchange metadata from the watchlist for proper TV symbol resolution
  const watchlistItem = watchlist.find((w) => w.symbol.ticker === activeSymbol)
  const exchange = watchlistItem?.symbol.exchange ?? ''
  const tvSymbol = toTVSymbol(activeSymbol, exchange)

  return (
    <div className={cn('flex flex-col w-full h-full', className)}>
      {/* ── TradingView chart with built-in toolbar ───────────────────────── */}
      <div className="flex-1 min-h-0">
        <TradingViewWidget symbol={tvSymbol} />
      </div>
    </div>
  )
}

