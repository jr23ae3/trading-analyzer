import { useEffect, useRef, useCallback, type RefObject } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useChartStore } from '@/store'
import { useTheme } from '@/context'
import type { OHLCVBar } from '@/types'

// ─── Theme palettes ────────────────────────────────────────────────────────────

const DARK_PALETTE = {
  bg:          '#0b0f1a',
  text:        '#8892a4',
  grid:        '#1a2235',
  border:      '#1f2d42',
  crosshair:   '#3b4f6b',
  labelBg:     '#1a2642',
  upColor:     '#26a69a',
  downColor:   '#ef5350',
  upBorder:    '#26a69a',
  downBorder:  '#ef5350',
  upWick:      '#26a69a',
  downWick:    '#ef5350',
  volUp:       'rgba(38, 166, 154, 0.4)',
  volDown:     'rgba(239, 83, 80, 0.4)',
} as const

const LIGHT_PALETTE = {
  bg:          '#ffffff',
  text:        '#64748b',
  grid:        '#e2e8f0',
  border:      '#cbd5e1',
  crosshair:   '#94a3b8',
  labelBg:     '#e2e8f0',
  upColor:     '#0d9488',
  downColor:   '#dc2626',
  upBorder:    '#0d9488',
  downBorder:  '#dc2626',
  upWick:      '#0d9488',
  downWick:    '#dc2626',
  volUp:       'rgba(13, 148, 136, 0.35)',
  volDown:     'rgba(220, 38, 38, 0.35)',
} as const

type Palette = {
  bg: string; text: string; grid: string; border: string; crosshair: string
  labelBg: string; upColor: string; downColor: string; upBorder: string
  downBorder: string; upWick: string; downWick: string; volUp: string; volDown: string
}

// ─── Public interface ──────────────────────────────────────────────────────────

export interface UseCandlestickChartOptions {
  onCrosshairMove?: (bar: OHLCVBar | null) => void
}

export interface UseCandlestickChartReturn {
  chartRef:   React.RefObject<IChartApi | null>
  candleRef:  React.RefObject<ISeriesApi<'Candlestick'> | null>
  volumeRef:  React.RefObject<ISeriesApi<'Histogram'> | null>
  fitContent:  () => void
  scrollToEnd: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCandlestickChart(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UseCandlestickChartOptions = {},
): UseCandlestickChartReturn {
  const chartRef  = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const barMapRef = useRef<Map<number, OHLCVBar>>(new Map())

  const { theme } = useTheme()
  const bars            = useChartStore((s) => s.bars)
  const setVisibleRange = useChartStore((s) => s.setVisibleRange)
  const setCrosshair    = useChartStore((s) => s.setCrosshair)
  const onCrosshairMove = options.onCrosshairMove

  function buildOptions(pal: Palette, width: number, height: number) {
    return {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: pal.bg },
        textColor:  pal.text,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        fontSize:   12,
      },
      grid: {
        vertLines: { color: pal.grid, style: LineStyle.Dotted },
        horzLines: { color: pal.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width:                1 as const,
          color:                pal.crosshair,
          style:                LineStyle.Dashed,
          labelBackgroundColor: pal.labelBg,
        },
        horzLine: {
          width:                1 as const,
          color:                pal.crosshair,
          style:                LineStyle.Dashed,
          labelBackgroundColor: pal.labelBg,
        },
      },
      rightPriceScale: {
        borderColor: pal.border,
        textColor:   pal.text,
        scaleMargins: { top: 0.06, bottom: 0.28 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor:    pal.border,
        textColor:      pal.text,
        timeVisible:    true,
        secondsVisible: false,
        barSpacing:     8,
        minBarSpacing:  2,
        fixLeftEdge:    true,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: {
        mouseWheel:       true,
        pressedMouseMove: true,
        horzTouchDrag:    true,
        vertTouchDrag:    false,
      },
      handleScale: {
        mouseWheel: true,
        pinch:      true,
        axisPressedMouseMove: { time: true, price: true },
      },
      kineticScroll: { touch: true, mouse: false },
    }
  }

  // ── Create / destroy chart when theme changes ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const pal   = theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
    const chart = createChart(container, buildOptions(pal, container.clientWidth, container.clientHeight))

    // Candlestick series
    const candle = chart.addSeries(CandlestickSeries, {
      upColor:         pal.upColor,
      downColor:       pal.downColor,
      borderUpColor:   pal.upBorder,
      borderDownColor: pal.downBorder,
      wickUpColor:     pal.upWick,
      wickDownColor:   pal.downWick,
      borderVisible:   true,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    })
    candle.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.28 } })

    // Volume histogram series on its own price scale
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat:  { type: 'volume' },
      priceScaleId: 'vol',
      color:        pal.volUp,
    })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    // Subscriptions
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (range) setVisibleRange({ from: range.from as number, to: range.to as number })
    })

    chart.subscribeCrosshairMove((param) => {
      const cd = param.seriesData.get(candle) as CandlestickData | undefined
      if (cd && param.time) {
        const ts = param.time as number
        setCrosshair(cd.close, ts)
        onCrosshairMove?.(barMapRef.current.get(ts) ?? null)
      } else {
        setCrosshair(null, null)
        onCrosshairMove?.(null)
      }
    })

    // ResizeObserver for responsive behaviour
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      chart.applyOptions({ width, height })
    })
    ro.observe(container)

    chartRef.current  = chart
    candleRef.current = candle
    volumeRef.current = vol

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current  = null
      candleRef.current = null
      volumeRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  // ── Push data into series whenever bars change ─────────────────────────────
  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !bars.length) return

    const pal = theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE

    barMapRef.current = new Map(bars.map((b) => [b.time, b]))

    candleRef.current.setData(
      bars.map((b) => ({
        time:  b.time as UTCTimestamp,
        open:  b.open,
        high:  b.high,
        low:   b.low,
        close: b.close,
      })) as CandlestickData[],
    )

    volumeRef.current.setData(
      bars.map((b) => ({
        time:  b.time as UTCTimestamp,
        value: b.volume,
        color: b.close >= b.open ? pal.volUp : pal.volDown,
      })) as HistogramData[],
    )

    chartRef.current?.timeScale().fitContent()
  }, [bars, theme])

  const fitContent  = useCallback(() => chartRef.current?.timeScale().fitContent(), [])
  const scrollToEnd = useCallback(() => chartRef.current?.timeScale().scrollToRealTime(), [])

  return { chartRef, candleRef, volumeRef, fitContent, scrollToEnd }
}
