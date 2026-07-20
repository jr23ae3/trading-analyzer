import { useChartStore } from '@/store'
import { formatPrice } from '@/utils'

export function PriceDisplay() {
  const crosshairPrice = useChartStore((s) => s.crosshairPrice)
  const bars = useChartStore((s) => s.bars)
  const lastBar = bars[bars.length - 1]
  const price = crosshairPrice ?? lastBar?.close ?? null

  if (price === null) return null

  const prevClose = bars[bars.length - 2]?.close
  const change = prevClose ? price - prevClose : 0
  const pct = prevClose ? (change / prevClose) * 100 : 0
  const isPositive = change >= 0

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-white">{formatPrice(price)}</span>
      <span className={isPositive ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
        {isPositive ? '+' : ''}{formatPrice(change)} ({pct.toFixed(2)}%)
      </span>
    </div>
  )
}
