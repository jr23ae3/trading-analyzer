/**
 * Batch technical indicator functions.
 *
 * Every function is:
 *  - Pure (no side-effects, no mutation of inputs)
 *  - Index-aligned with the input array
 *  - Returns `null` at positions where the indicator has not yet warmed up
 *
 * For live/streaming usage see `indicatorEngine.ts`.
 */

import type { OHLCVBar } from '@/types'
import type {
  IndicatorPoint,
  MACDPoint,
  BollingerPoint,
  ADXPoint,
  VolumeProfileResult,
} from './indicatorTypes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wilder's smoothing (used by RSI, ATR, ADX). Initial value = SMA. */
function wilderSmooth(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length < period) return out
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  out[period - 1] = sum / period
  for (let i = period; i < values.length; i++) {
    out[i] = (out[i - 1]! * (period - 1) + values[i]) / period
  }
  return out
}

/** Population standard deviation of an array slice. */
function stdDev(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

/** Clamp a number to [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// ─── SMA ──────────────────────────────────────────────────────────────────────

/**
 * Simple Moving Average.
 * O(n) using a running sum — does not allocate intermediate arrays.
 */
export function calcSMA(bars: OHLCVBar[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = []
  let sum = 0
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close
    if (i >= period) sum -= bars[i - period].close
    out.push({
      time:  bars[i].time,
      value: i >= period - 1 ? sum / period : null,
    })
  }
  return out
}

// ─── EMA ──────────────────────────────────────────────────────────────────────

/**
 * Exponential Moving Average.
 * k = 2 / (period + 1). Seeded with the first SMA.
 */
export function calcEMA(bars: OHLCVBar[], period: number): IndicatorPoint[] {
  const k = 2 / (period + 1)
  const out: IndicatorPoint[] = []
  let prev: number | null = null
  let sum = 0

  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close
    if (i < period - 1) {
      out.push({ time: bars[i].time, value: null })
      continue
    }
    if (i === period - 1) {
      prev = sum / period
      out.push({ time: bars[i].time, value: prev })
      continue
    }
    prev = bars[i].close * k + prev! * (1 - k)
    out.push({ time: bars[i].time, value: prev })
  }
  return out
}

// ─── VWAP ─────────────────────────────────────────────────────────────────────

/**
 * Volume-Weighted Average Price.
 * Resets at UTC midnight (each calendar day boundary).
 * Typical price = (high + low + close) / 3.
 */
export function calcVWAP(bars: OHLCVBar[]): IndicatorPoint[] {
  const out: IndicatorPoint[] = []
  let cumPV  = 0
  let cumVol = 0
  let lastDay = -1

  for (const bar of bars) {
    const day = Math.floor(bar.time / 86400)
    if (day !== lastDay) {
      cumPV  = 0
      cumVol = 0
      lastDay = day
    }
    const typical = (bar.high + bar.low + bar.close) / 3
    cumPV  += typical * bar.volume
    cumVol += bar.volume
    out.push({
      time:  bar.time,
      value: cumVol > 0 ? cumPV / cumVol : bar.close,
    })
  }
  return out
}

// ─── RSI ──────────────────────────────────────────────────────────────────────

/**
 * Relative Strength Index using Wilder's smoothing.
 * Returns values in [0, 100].
 */
export function calcRSI(bars: OHLCVBar[], period = 14): IndicatorPoint[] {
  const out: IndicatorPoint[] = bars.map((b) => ({ time: b.time, value: null }))
  if (bars.length < period + 1) return out

  // Seed — simple average of first `period` up/down moves
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const d = bars[i].close - bars[i - 1].close
    if (d >= 0) avgGain += d; else avgLoss -= d
  }
  avgGain /= period
  avgLoss /= period

  const rsiAt = (g: number, l: number) =>
    l === 0 ? 100 : 100 - 100 / (1 + g / l)

  out[period].value = rsiAt(avgGain, avgLoss)

  for (let i = period + 1; i < bars.length; i++) {
    const d = bars[i].close - bars[i - 1].close
    avgGain = (avgGain * (period - 1) + Math.max(d, 0))  / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period
    out[i].value = rsiAt(avgGain, avgLoss)
  }
  return out
}

// ─── MACD ─────────────────────────────────────────────────────────────────────

/**
 * Moving Average Convergence Divergence.
 * @param fast   Fast EMA period. @default 12
 * @param slow   Slow EMA period. @default 26
 * @param signal Signal EMA period. @default 9
 */
export function calcMACD(
  bars: OHLCVBar[],
  fast   = 12,
  slow   = 26,
  signal = 9,
): MACDPoint[] {
  const fastEMA  = calcEMA(bars, fast)
  const slowEMA  = calcEMA(bars, slow)

  // MACD line
  const macdLine: (number | null)[] = bars.map((_, i) => {
    const f = fastEMA[i].value
    const s = slowEMA[i].value
    return f !== null && s !== null ? f - s : null
  })

  // Signal = EMA(macdLine, signal), seeded with first `signal` non-null values
  const signalLine: (number | null)[] = new Array(bars.length).fill(null)
  const k = 2 / (signal + 1)
  let sigPrev: number | null = null
  let sigCount = 0
  let sigSum   = 0
  const sigBuf: number[] = []

  for (let i = 0; i < bars.length; i++) {
    const m = macdLine[i]
    if (m === null) continue
    sigCount++
    sigSum += m
    sigBuf.push(m)
    if (sigCount < signal) continue
    if (sigCount === signal) {
      sigPrev = sigSum / signal
      signalLine[i] = sigPrev
      continue
    }
    sigPrev = m * k + sigPrev! * (1 - k)
    signalLine[i] = sigPrev
  }

  return bars.map((bar, i) => {
    const m = macdLine[i]
    const s = signalLine[i]
    return {
      time:      bar.time,
      macd:      m,
      signal:    s,
      histogram: m !== null && s !== null ? m - s : null,
    }
  })
}

// ─── ATR ──────────────────────────────────────────────────────────────────────

/**
 * Average True Range using Wilder's smoothing.
 * TR = max(high−low, |high−prevClose|, |low−prevClose|)
 */
export function calcATR(bars: OHLCVBar[], period = 14): IndicatorPoint[] {
  const trs: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const pc = i === 0 ? bars[i].open : bars[i - 1].close
    trs.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - pc),
      Math.abs(bars[i].low  - pc),
    ))
  }
  const smoothed = wilderSmooth(trs, period)
  return bars.map((bar, i) => ({ time: bar.time, value: smoothed[i] }))
}

// ─── ADX ──────────────────────────────────────────────────────────────────────

/**
 * Average Directional Index + ±DI lines.
 * All output values are in [0, 100].
 * ADX ≥ 25 generally indicates a trending market.
 */
export function calcADX(bars: OHLCVBar[], period = 14): ADXPoint[] {
  const n = bars.length
  const out: ADXPoint[] = bars.map((b) => ({
    time: b.time, adx: null, plusDI: null, minusDI: null,
  }))
  if (n < period + 1) return out

  const trs:  number[] = []
  const dmps: number[] = []
  const dmms: number[] = []

  for (let i = 1; i < n; i++) {
    const cur  = bars[i]
    const prev = bars[i - 1]
    const tr   = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low  - prev.close),
    )
    const upMove   = cur.high - prev.high
    const downMove = prev.low  - cur.low
    const dmp = upMove   > downMove && upMove   > 0 ? upMove   : 0
    const dmm = downMove > upMove   && downMove > 0 ? downMove : 0
    trs.push(tr)
    dmps.push(dmp)
    dmms.push(dmm)
  }

  const sTR  = wilderSmooth(trs,  period)
  const sDMP = wilderSmooth(dmps, period)
  const sDMM = wilderSmooth(dmms, period)

  // DX and ADX computed from smoothed values
  const dx: number[] = []
  for (let i = 0; i < sTR.length; i++) {
    const tr  = sTR[i]
    const dmp = sDMP[i]
    const dmm = sDMM[i]
    if (tr === null || dmp === null || dmm === null || tr === 0) {
      dx.push(0)
      continue
    }
    const pDI = 100 * dmp / tr
    const mDI = 100 * dmm / tr
    const sum = pDI + mDI
    dx.push(sum === 0 ? 0 : 100 * Math.abs(pDI - mDI) / sum)
  }

  const smoothDX = wilderSmooth(dx, period)

  // Map back onto bar indices (the DM arrays start at bar index 1)
  for (let i = 1; i < n; i++) {
    const j   = i - 1  // index into trs/dmps/dmms arrays
    const tr  = sTR[j]
    const dmp = sDMP[j]
    const dmm = sDMM[j]
    if (tr === null || dmp === null || dmm === null || tr === 0) continue
    out[i].plusDI  = clamp(100 * dmp / tr, 0, 100)
    out[i].minusDI = clamp(100 * dmm / tr, 0, 100)
    out[i].adx     = smoothDX[j] !== null ? clamp(smoothDX[j]!, 0, 100) : null
  }
  return out
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

/**
 * Bollinger Bands: Middle = SMA, Upper/Lower = Middle ± k×σ.
 * Also computes bandwidth and %B.
 */
export function calcBollingerBands(
  bars:    OHLCVBar[],
  period   = 20,
  kStdDev  = 2,
): BollingerPoint[] {
  const out: BollingerPoint[] = []
  for (let i = 0; i < bars.length; i++) {
    const time = bars[i].time
    if (i < period - 1) {
      out.push({ time, upper: null, middle: null, lower: null, bandwidth: null, pctB: null })
      continue
    }
    const slice  = bars.slice(i - period + 1, i + 1).map((b) => b.close)
    const middle = slice.reduce((a, b) => a + b, 0) / period
    const sd     = stdDev(slice)
    const upper  = middle + kStdDev * sd
    const lower  = middle - kStdDev * sd
    const bw     = middle !== 0 ? (upper - lower) / middle : null
    const price  = bars[i].close
    const pctB   = upper !== lower ? (price - lower) / (upper - lower) : null
    out.push({ time, upper, middle, lower, bandwidth: bw, pctB })
  }
  return out
}

// ─── Volume Profile ───────────────────────────────────────────────────────────

/**
 * Volume Profile — distribution of traded volume across price levels.
 *
 * Computes over the entire provided bar range.
 * The Point of Control (PoC) is the price level with the highest volume.
 * The Value Area covers the levels that account for 70% of total volume.
 *
 * @param levels  Number of price bins. @default 24
 */
export function calcVolumeProfile(
  bars:   OHLCVBar[],
  levels = 24,
): VolumeProfileResult {
  if (!bars.length) {
    return { levels: [], pocIndex: 0, pocPrice: 0, valueAreaHigh: 0, valueAreaLow: 0 }
  }

  const high  = Math.max(...bars.map((b) => b.high))
  const low   = Math.min(...bars.map((b) => b.low))
  const range = high - low
  if (range === 0) {
    const single: VolumeProfileResult = {
      levels: [{
        priceHigh: high, priceLow: low, priceMid: (high + low) / 2,
        volume: bars.reduce((s, b) => s + b.volume, 0),
        buyVolume: 0, sellVolume: 0, percentage: 1,
      }],
      pocIndex: 0, pocPrice: high, valueAreaHigh: high, valueAreaLow: low,
    }
    return single
  }

  const binSize = range / levels
  const bins: { volume: number; buyVol: number; sellVol: number }[] =
    Array.from({ length: levels }, () => ({ volume: 0, buyVol: 0, sellVol: 0 }))

  for (const bar of bars) {
    // Distribute each bar's volume linearly across the levels it spans
    const barLow  = bar.low
    const barHigh = bar.high
    const barVol  = bar.volume
    const isBuy   = bar.close >= bar.open

    for (let b = 0; b < levels; b++) {
      const binLow  = low + b * binSize
      const binHigh = binLow + binSize
      // Overlap between bar range and bin range
      const overlapLow  = Math.max(barLow,  binLow)
      const overlapHigh = Math.min(barHigh, binHigh)
      if (overlapHigh <= overlapLow) continue
      const frac = (overlapHigh - overlapLow) / (barHigh - barLow)
      const vol  = barVol * frac
      bins[b].volume  += vol
      if (isBuy) bins[b].buyVol  += vol
      else       bins[b].sellVol += vol
    }
  }

  const totalVol = bins.reduce((s, b) => s + b.volume, 0)
  const pocIndex = bins.reduce((best, b, i) => b.volume > bins[best].volume ? i : best, 0)

  // Value Area: levels around PoC that account for 70% of volume
  let vaVol     = bins[pocIndex].volume
  let vaLow     = pocIndex
  let vaHigh    = pocIndex
  const target  = totalVol * 0.7

  while (vaVol < target && (vaLow > 0 || vaHigh < levels - 1)) {
    const extendUp   = vaHigh < levels - 1 ? bins[vaHigh + 1].volume : -Infinity
    const extendDown = vaLow  > 0          ? bins[vaLow  - 1].volume : -Infinity
    if (extendUp >= extendDown) { vaHigh++; vaVol += bins[vaHigh].volume }
    else                        { vaLow--;  vaVol += bins[vaLow].volume  }
  }

  const result: VolumeProfileResult = {
    pocIndex,
    pocPrice: low + (pocIndex + 0.5) * binSize,
    valueAreaHigh: low + (vaHigh + 1) * binSize,
    valueAreaLow:  low + vaLow * binSize,
    levels: bins.map((bin, i) => ({
      priceHigh:  low + (i + 1) * binSize,
      priceLow:   low + i * binSize,
      priceMid:   low + (i + 0.5) * binSize,
      volume:     bin.volume,
      buyVolume:  bin.buyVol,
      sellVolume: bin.sellVol,
      percentage: totalVol > 0 ? bin.volume / totalVol : 0,
    })),
  }
  return result
}

// ─── Anchored VWAP ────────────────────────────────────────────────────────────

/**
 * Anchored VWAP — VWAP calculated from a specific anchor bar onwards.
 * Common use: anchor to session open, earnings, significant pivot, or swing high/low.
 *
 * Returns `null` for bars before the anchor timestamp.
 *
 * @param anchorTime  Unix timestamp (seconds) of the anchor bar.
 *                    The first bar with `time >= anchorTime` starts the accumulation.
 */
export function calcAnchoredVWAP(
  bars:       OHLCVBar[],
  anchorTime: number,
): IndicatorPoint[] {
  const out: IndicatorPoint[] = []
  let cumPV  = 0
  let cumVol = 0
  let anchored = false

  for (const bar of bars) {
    if (!anchored && bar.time >= anchorTime) anchored = true
    if (!anchored) {
      out.push({ time: bar.time, value: null })
      continue
    }
    const typical = (bar.high + bar.low + bar.close) / 3
    cumPV  += typical * bar.volume
    cumVol += bar.volume
    out.push({
      time:  bar.time,
      value: cumVol > 0 ? cumPV / cumVol : bar.close,
    })
  }
  return out
}

