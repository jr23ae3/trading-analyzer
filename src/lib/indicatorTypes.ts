/**
 * Shared output types for all technical indicator functions.
 * Every array is index-aligned with the input `OHLCVBar[]` array
 * (same length, same order), so `result[i]` corresponds to `bars[i]`.
 */

// ─── Shared primitives ─────────────────────────────────────────────────────────

/** A single time-stamped scalar value (or null while the indicator is warming up). */
export interface IndicatorPoint {
  /** Unix timestamp in seconds — matches `OHLCVBar.time`. */
  time:  number
  value: number | null
}

// ─── Per-indicator output types ────────────────────────────────────────────────

export interface MACDPoint {
  time:      number
  /** MACD line = fast EMA − slow EMA. */
  macd:      number | null
  /** Signal line = EMA of MACD. */
  signal:    number | null
  /** Histogram = MACD − Signal. */
  histogram: number | null
}

export interface BollingerPoint {
  time:   number
  upper:  number | null
  middle: number | null   // SMA
  lower:  number | null
  /** Bandwidth = (upper − lower) / middle — a volatility normaliser. */
  bandwidth: number | null
  /** %B = (price − lower) / (upper − lower). */
  pctB:      number | null
}

export interface ADXPoint {
  time:    number
  /** Average Directional Index (0-100). ≥ 25 = trending. */
  adx:     number | null
  /** Plus Directional Indicator. */
  plusDI:  number | null
  /** Minus Directional Indicator. */
  minusDI: number | null
}

// ─── Volume Profile ────────────────────────────────────────────────────────────

export interface VolumeProfileLevel {
  /** Upper bound of this price bin. */
  priceHigh:  number
  /** Lower bound of this price bin. */
  priceLow:   number
  /** Mid-point of the bin (used for display). */
  priceMid:   number
  /** Total volume traded at this level. */
  volume:     number
  /** Estimated buy-side volume (close ≥ open bars). */
  buyVolume:  number
  /** Estimated sell-side volume (close < open bars). */
  sellVolume: number
  /** Fraction of total volume in this level (0-1). */
  percentage: number
}

export interface VolumeProfileResult {
  levels:         VolumeProfileLevel[]
  /** Index into `levels` of the Point of Control (highest volume). */
  pocIndex:       number
  /** Price of the Point of Control. */
  pocPrice:       number
  /** Value Area High — price level above which 30% of volume lies. */
  valueAreaHigh:  number
  /** Value Area Low — price level below which 30% of volume lies. */
  valueAreaLow:   number
}

// ─── Engine output bundle ──────────────────────────────────────────────────────

export interface EngineResults {
  /** Keyed `sma-{period}`, e.g. `sma-20`. */
  sma:    Record<string, IndicatorPoint[]>
  /** Keyed `ema-{period}`, e.g. `ema-50`. */
  ema:    Record<string, IndicatorPoint[]>
  vwap:   IndicatorPoint[]
  rsi:    IndicatorPoint[]
  macd:   MACDPoint[]
  atr:    IndicatorPoint[]
  adx:    ADXPoint[]
  bb:     BollingerPoint[]
  /** Keyed by anchor Unix timestamp, e.g. `avwap-1704067200`. */
  avwap:  Record<string, IndicatorPoint[]>
  volumeProfile: VolumeProfileResult | null
}

// ─── Engine configuration ──────────────────────────────────────────────────────

export interface EngineOptions {
  /** SMA periods to compute. @default [] */
  sma?:     number[]
  /** EMA periods to compute. @default [20, 50] */
  ema?:     number[]
  /** Compute VWAP (resets each UTC day). @default false */
  vwap?:    boolean
  /** RSI period. @default 14 */
  rsi?:     number
  /** MACD params. @default { fast:12, slow:26, signal:9 } */
  macd?:    { fast: number; slow: number; signal: number }
  /** ATR period. @default 14 */
  atr?:     number
  /** ADX period. @default 14 */
  adx?:     number
  /** Bollinger Bands params. @default { period:20, stdDev:2 } */
  bb?:      { period: number; stdDev: number }
  /**
   * Volume Profile config.
   * Pass an object to enable. `levels` = number of price bins.
   * @default disabled
   */
  volumeProfile?: { levels: number }
  /**
   * Anchored VWAP anchor timestamps (Unix seconds).
   * Each timestamp becomes a separate series in `results.avwap`.
   */
  avwap?:   number[]
}
