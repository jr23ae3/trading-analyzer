import type { OHLCVBar } from '@/types'
import { formatPrice } from '@/utils'
import { useChartStore } from '@/store'
import { cn } from '@/utils'

interface ChartLegendProps {
  symbol: string
  /** Hovered bar from crosshair; falls back to latest bar when null. */
  hoveredBar: OHLCVBar | null
}

function StatCell({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider select-none">{label}</span>
      <span className={cn('text-xs font-semibold tabular-nums', className)}>{value}</span>
    </div>
  )
}

export function ChartLegend({ symbol, hoveredBar }: ChartLegendProps) {
  const bars = useChartStore((s) => s.bars)
  const bar  = hoveredBar ?? bars[bars.length - 1] ?? null

  if (!bar) return null

  const change  = bar.close - bar.open
  const changePct = (change / bar.open) * 100
  const isUp    = change >= 0
  const changeColor = isUp ? 'text-[#26a69a]' : 'text-[#ef5350]'
  const prefix  = isUp ? '+' : ''

  const volume =
    bar.volume >= 1_000_000
      ? `${(bar.volume / 1_000_000).toFixed(2)}M`
      : `${(bar.volume / 1_000).toFixed(0)}K`

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 pointer-events-none select-none">
      {/* Symbol */}
      <span className="text-sm font-bold text-slate-200 mr-1">{symbol}</span>

      {/* OHLCV */}
      <StatCell label="O" value={formatPrice(bar.open)}  className="text-slate-300" />
      <StatCell label="H" value={formatPrice(bar.high)}  className="text-[#26a69a]" />
      <StatCell label="L" value={formatPrice(bar.low)}   className="text-[#ef5350]" />
      <StatCell label="C" value={formatPrice(bar.close)} className={changeColor} />
      <StatCell label="V" value={volume}                 className="text-slate-400" />

      {/* Change */}
      <span className={cn('text-xs font-semibold tabular-nums', changeColor)}>
        {prefix}{formatPrice(change)} ({prefix}{changePct.toFixed(2)}%)
      </span>
    </div>
  )
}
