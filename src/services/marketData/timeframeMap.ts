import type { Timeframe } from '@/types'

// ─── Polygon ──────────────────────────────────────────────────────────────────

export interface PolygonInterval {
  multiplier: number
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month'
}

const POLYGON_MAP: Record<Timeframe, PolygonInterval> = {
  '1m':  { multiplier: 1,  timespan: 'minute' },
  '5m':  { multiplier: 5,  timespan: 'minute' },
  '15m': { multiplier: 15, timespan: 'minute' },
  '30m': { multiplier: 30, timespan: 'minute' },
  '1h':  { multiplier: 1,  timespan: 'hour'   },
  '4h':  { multiplier: 4,  timespan: 'hour'   },
  '1D':  { multiplier: 1,  timespan: 'day'    },
  '1W':  { multiplier: 1,  timespan: 'week'   },
  '1M':  { multiplier: 1,  timespan: 'month'  },
}

export const polygonInterval = (tf: Timeframe): PolygonInterval => POLYGON_MAP[tf]

// ─── Alpaca ───────────────────────────────────────────────────────────────────

/** Alpaca TimeFrame string for bars API v2. */
export type AlpacaTimeFrame =
  | '1Min' | '5Min' | '15Min' | '30Min'
  | '1Hour' | '4Hour'
  | '1Day' | '1Week' | '1Month'

const ALPACA_MAP: Record<Timeframe, AlpacaTimeFrame> = {
  '1m':  '1Min',
  '5m':  '5Min',
  '15m': '15Min',
  '30m': '30Min',
  '1h':  '1Hour',
  '4h':  '4Hour',
  '1D':  '1Day',
  '1W':  '1Week',
  '1M':  '1Month',
}

export const alpacaTimeFrame = (tf: Timeframe): AlpacaTimeFrame => ALPACA_MAP[tf]

// ─── Tradovate ────────────────────────────────────────────────────────────────

export interface TradovateChartDesc {
  underlyingType: 'MinuteBar' | 'DailyBar' | 'WeeklyBar' | 'MonthlyBar'
  elementSize: number
  elementSizeUnit: 'UnderlyingUnits'
  withHistogram: false
}

const TRADOVATE_MAP: Record<Timeframe, TradovateChartDesc> = {
  '1m':  { underlyingType: 'MinuteBar',  elementSize: 1,   elementSizeUnit: 'UnderlyingUnits', withHistogram: false },
  '5m':  { underlyingType: 'MinuteBar',  elementSize: 5,   elementSizeUnit: 'UnderlyingUnits', withHistogram: false },
  '15m': { underlyingType: 'MinuteBar',  elementSize: 15,  elementSizeUnit: 'UnderlyingUnits', withHistogram: false },
  '30m': { underlyingType: 'MinuteBar',  elementSize: 30,  elementSizeUnit: 'UnderlyingUnits', withHistogram: false },
  '1h':  { underlyingType: 'MinuteBar',  elementSize: 60,  elementSizeUnit: 'UnderlyingUnits', withHistogram: false },
  '4h':  { underlyingType: 'MinuteBar',  elementSize: 240, elementSizeUnit: 'UnderlyingUnits', withHistogram: false },
  '1D':  { underlyingType: 'DailyBar',   elementSize: 1,   elementSizeUnit: 'UnderlyingUnits', withHistogram: false },
  '1W':  { underlyingType: 'WeeklyBar',  elementSize: 1,   elementSizeUnit: 'UnderlyingUnits', withHistogram: false },
  '1M':  { underlyingType: 'MonthlyBar', elementSize: 1,   elementSizeUnit: 'UnderlyingUnits', withHistogram: false },
}

export const tradovateChartDesc = (tf: Timeframe): TradovateChartDesc => TRADOVATE_MAP[tf]

// ─── Binance ──────────────────────────────────────────────────────────────────

export type BinanceInterval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M'

const BINANCE_MAP: Record<Timeframe, BinanceInterval> = {
  '1m':  '1m',
  '5m':  '5m',
  '15m': '15m',
  '30m': '30m',
  '1h':  '1h',
  '4h':  '4h',
  '1D':  '1d',
  '1W':  '1w',
  '1M':  '1M',
}

export const binanceInterval = (tf: Timeframe): BinanceInterval => BINANCE_MAP[tf]

// ─── Yahoo Finance ────────────────────────────────────────────────────────────

export type YahooInterval =
  | '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m'
  | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo'

/** Yahoo range string derived from how far back we're looking. */
export type YahooRange = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max'

const YAHOO_INTERVAL_MAP: Record<Timeframe, YahooInterval> = {
  '1m':  '1m',
  '5m':  '5m',
  '15m': '15m',
  '30m': '30m',
  '1h':  '1h',
  '4h':  '1h',   // Yahoo has no 4h — fall back to 1h
  '1D':  '1d',
  '1W':  '1wk',
  '1M':  '1mo',
}

/** Suggested Yahoo range string for a given timeframe and bar count. */
export function yahooInterval(tf: Timeframe): YahooInterval {
  return YAHOO_INTERVAL_MAP[tf]
}

export function yahooRange(tf: Timeframe, limit = 252): YahooRange {
  switch (tf) {
    case '1m':
    case '5m':
    case '15m':
    case '30m':
      return limit <= 300 ? '5d' : '1mo'
    case '1h':
    case '4h':
      return limit <= 100 ? '1mo' : '6mo'
    case '1D':
      return limit <= 60 ? '3mo' : limit <= 252 ? '1y' : limit <= 504 ? '2y' : '5y'
    case '1W':
    case '1M':
      return 'max'
  }
}

// ─── Utility: default date range ──────────────────────────────────────────────

/**
 * Returns a default `[from, to]` Unix-second pair for fetching `limit` bars
 * of the given timeframe, measured back from now.
 */
export function defaultDateRange(tf: Timeframe, limit: number): { from: number; to: number } {
  const now = Math.floor(Date.now() / 1000)
  const secondsPerBar: Record<Timeframe, number> = {
    '1m':  60,
    '5m':  300,
    '15m': 900,
    '30m': 1800,
    '1h':  3600,
    '4h':  14400,
    '1D':  86400,
    '1W':  604800,
    '1M':  2592000,
  }
  const lookback = secondsPerBar[tf] * limit * 1.5  // ×1.5 to account for non-trading days
  return { from: Math.floor(now - lookback), to: now }
}
