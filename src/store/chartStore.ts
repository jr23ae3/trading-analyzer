import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Timeframe, OHLCVBar } from '@/types'

interface ChartState {
  // ── Active symbol & timeframe ──────────────────────────────────────────────
  activeSymbol: string
  timeframe: Timeframe

  // ── OHLCV data ─────────────────────────────────────────────────────────────
  bars: OHLCVBar[]
  isLoading: boolean
  error: string | null

  // ── Chart viewport ─────────────────────────────────────────────────────────
  visibleRange: { from: number; to: number } | null
  crosshairPrice: number | null
  crosshairTime: number | null

  // ── Actions ────────────────────────────────────────────────────────────────
  setActiveSymbol: (symbol: string) => void
  setTimeframe: (timeframe: Timeframe) => void
  setBars: (bars: OHLCVBar[]) => void
  appendBar: (bar: OHLCVBar) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setVisibleRange: (range: { from: number; to: number } | null) => void
  setCrosshair: (price: number | null, time: number | null) => void
  reset: () => void
}

const initialState = {
  activeSymbol: 'AAPL',
  timeframe: '1D' as Timeframe,
  bars: [],
  isLoading: false,
  error: null,
  visibleRange: null,
  crosshairPrice: null,
  crosshairTime: null,
}

export const useChartStore = create<ChartState>()(
  devtools(
    (set) => ({
      ...initialState,

      setActiveSymbol: (symbol) =>
        set({ activeSymbol: symbol, bars: [], error: null }, false, 'setActiveSymbol'),

      setTimeframe: (timeframe) =>
        set({ timeframe, bars: [], error: null }, false, 'setTimeframe'),

      setBars: (bars) =>
        set({ bars }, false, 'setBars'),

      appendBar: (bar) =>
        set(
          (state) => ({
            bars: state.bars.some((b) => b.time === bar.time)
              ? state.bars.map((b) => (b.time === bar.time ? bar : b))
              : [...state.bars, bar],
          }),
          false,
          'appendBar',
        ),

      setLoading: (isLoading) =>
        set({ isLoading }, false, 'setLoading'),

      setError: (error) =>
        set({ error }, false, 'setError'),

      setVisibleRange: (visibleRange) =>
        set({ visibleRange }, false, 'setVisibleRange'),

      setCrosshair: (crosshairPrice, crosshairTime) =>
        set({ crosshairPrice, crosshairTime }, false, 'setCrosshair'),

      reset: () =>
        set(initialState, false, 'reset'),
    }),
    { name: 'ChartStore' },
  ),
)
