import { useRef, useState } from 'react'
import { useCandlestickChart } from '@/hooks'
import { ChartLegend } from './ChartLegend'
import { TimeframeSelector } from './TimeframeSelector'
import { ChartOverlays } from './ChartOverlays'
import { useChartStore } from '@/store'
import { cn } from '@/utils'
import type { OHLCVBar } from '@/types'

export interface CandlestickChartProps {
  /** Displayed in the legend overlay. Defaults to the active symbol from the store. */
  symbol?: string
  /** Extra CSS classes applied to the outer wrapper. */
  className?: string
}

/**
 * Fully self-contained candlestick chart component.
 *
 * Features:
 *  - Dark / light theme (follows ThemeContext)
 *  - Mouse-wheel & pinch zoom
 *  - Full crosshair with price + time labels
 *  - Right price scale + bottom time scale
 *  - Volume histogram pane (bottom 18%)
 *  - OHLCV legend overlay
 *  - Auto-resize via ResizeObserver
 */
export function CandlestickChart({ symbol, className }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredBar, setHoveredBar] = useState<OHLCVBar | null>(null)

  const activeSymbol = useChartStore((s) => s.activeSymbol)
  const isLoading    = useChartStore((s) => s.isLoading)
  const error        = useChartStore((s) => s.error)

  const { fitContent, scrollToEnd } = useCandlestickChart(containerRef, {
    onCrosshairMove: setHoveredBar,
  })

  const label = symbol ?? activeSymbol

  return (
    <div className={cn('relative flex flex-col w-full h-full', className)}>
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/60 shrink-0 z-10">
        <TimeframeSelector />
        <div className="flex items-center gap-1">
          <ToolbarBtn onClick={fitContent}  title="Fit all data">⊡</ToolbarBtn>
          <ToolbarBtn onClick={scrollToEnd} title="Scroll to latest">⇥</ToolbarBtn>
        </div>
      </div>

      {/* ── Chart area ──────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        {/* OHLCV legend */}
        <ChartLegend symbol={label} hoveredBar={hoveredBar} />

        {/* The chart canvas container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Chart overlays (support/resistance, trend lines, etc.) */}
        <ChartOverlays />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b0f1a]/70 z-20">
            <Spinner />
          </div>
        )}

        {/* Error overlay */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b0f1a]/70 z-20">
            <p className="text-red-400 text-sm bg-slate-800 px-4 py-2 rounded">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors text-sm"
    >
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <div className="w-8 h-8 rounded-full border-2 border-slate-600 border-t-blue-400 animate-spin" />
  )
}

