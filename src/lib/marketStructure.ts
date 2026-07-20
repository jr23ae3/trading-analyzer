/**
 * Market Structure Analyzer
 *
 * Pipeline:
 *   1. Detect swing pivots (configurable lookback)
 *   2. Label each pivot: HH / HL / LH / LL
 *   3. Classify trend: bull / bear / range
 *   4. Fit trend lines via least-squares through the relevant pivots
 *   5. Detect Break of Structure (BOS) and Change of Character (CHoCH)
 *   6. Score the structure across four independent dimensions (0–100 total)
 */

import type { OHLCVBar } from '@/types'
import { calcATR, calcADX } from './indicators'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SwingKind  = 'high' | 'low'
export type SwingLabel = 'HH' | 'HL' | 'LH' | 'LL' | 'initial-high' | 'initial-low'
export type MarketTrend = 'bull' | 'bear' | 'range'
export type MarketBias  = 'bullish' | 'bearish' | 'neutral'

/** A pivot high or low with its market-structure label. */
export interface SwingPoint {
  /** Unique id within the current analysis — `swing-{barIndex}`. */
  id:       string
  barIndex: number
  /** Unix timestamp (seconds). */
  time:     number
  price:    number
  kind:     SwingKind
  label:    SwingLabel
  /**
   * Size of this swing relative to ATR14 at the pivot bar.
   * Higher = more significant (cleaner structure).
   */
  amplitudeATR: number
}

export type TrendLineKind = 'uptrend' | 'downtrend' | 'range-high' | 'range-low'

/** Auto-fitted trend line through 2+ aligned pivot points. */
export interface TrendLineResult {
  id:           string
  kind:         TrendLineKind
  /** Price at the leftmost anchor (first pivot in the series). */
  startPrice:   number
  startTime:    number
  startBarIndex: number
  /** Price projected to the most recent bar. */
  endPrice:     number
  endTime:      number
  endBarIndex:  number
  /** Slope in price-per-bar (positive = rising). */
  slope:        number
  /**
   * R² of the least-squares fit through the pivots.
   * 1.0 = perfect line, 0 = random scatter.
   */
  fitQuality:   number
  /** Number of pivot points used to compute the regression. */
  pivotCount:   number
  color:        string
}

/** A break of a prior swing level — signals potential trend change or continuation. */
export interface StructureBreak {
  barIndex: number
  time:     number
  price:    number
  /**
   * BOS  = Break of Structure (trend continuation — expected).
   * CHoCH = Change of Character (first sign of a possible reversal).
   */
  type:     'BOS' | 'CHoCH'
  direction: 'bullish' | 'bearish'
  /** The broken swing price. */
  brokenLevel: number
}

/** Per-dimension breakdown of the confidence score. */
export interface StructureScores {
  /**
   * 0–40: what fraction of the last 8 labeled swings align with the identified trend?
   * Needs > 50% to score anything, 100% consistency = 40.
   */
  consistency: number
  /**
   * 0–20: how strong is the trend according to ADX14?
   * ADX < 15 → 0, ADX ≥ 50 → 20.
   */
  adxStrength: number
  /**
   * 0–25: average swing amplitude in ATR multiples.
   * Large clear swings score higher than tiny noisy ones.
   */
  clarity: number
  /**
   * 0–15: R² of the best-fit trend line.
   * Perfect line = 15, chaotic = 0.
   */
  trendlineQuality: number
  /** Sum of all dimensions, clamped to [0, 100]. */
  total: number
}

export interface MarketStructureResult {
  /** Identified market trend. */
  trend:          MarketTrend
  /** Overall market bias (can differ from trend during transitions). */
  bias:           MarketBias
  /** All labeled swing points in chronological order. */
  swings:         SwingPoint[]
  /** Auto-fitted trend lines. */
  trendLines:     TrendLineResult[]
  /** Recent break-of-structure / change-of-character events. */
  structureBreaks: StructureBreak[]
  /** Most recent swing high (any label). */
  lastSwingHigh:  SwingPoint | null
  /** Most recent swing low (any label). */
  lastSwingLow:   SwingPoint | null
  /** Ordered labels of the last 8 swings — shows the recent structure sequence. */
  recentPattern:  SwingLabel[]
  /** Fraction [0,1] of recent swings that are bullish (HH or HL). */
  bullRatio:      number
  /** Breakdown of score dimensions. */
  scores:         StructureScores
  /** Composite confidence in the identified trend, 0–100. */
  confidence:     number
}

/** Configuration options. */
export interface MarketStructureOptions {
  /**
   * Bars to the left required for a swing pivot.
   * @default 3
   */
  leftBars?:       number
  /**
   * Bars to the right (confirmation lookahead).
   * @default 3
   */
  rightBars?:      number
  /**
   * How many of the most recent labeled swings to use for trend classification.
   * @default 8
   */
  lookbackSwings?: number
  /**
   * How many pivots to use when fitting a trend line.
   * @default 4
   */
  trendLinePivots?: number
}

// ─── Main function ─────────────────────────────────────────────────────────────

/**
 * Analyse market structure from OHLCV bars.
 *
 * @returns `MarketStructureResult` sorted by confidence, or a neutral result
 *          when there are insufficient bars.
 */
export function analyzeMarketStructure(
  bars:    OHLCVBar[],
  options: MarketStructureOptions = {},
): MarketStructureResult {
  const {
    leftBars        = 3,
    rightBars       = 3,
    lookbackSwings  = 8,
    trendLinePivots = 4,
  } = options

  const NEUTRAL = neutralResult()
  const n       = bars.length
  if (n < leftBars + rightBars + 2) return NEUTRAL

  // ── Step 1: Compute ATR & ADX for scoring ──────────────────────────────────
  const atrSeries = calcATR(bars, 14)
  const adxSeries = calcADX(bars, 14)
  const lastADX   = lastNonNull(adxSeries.map((p) => p.adx)) ?? 0

  // ── Step 2: Detect raw swing pivots ───────────────────────────────────────
  const rawSwings = detectPivots(bars, leftBars, rightBars, atrSeries)
  if (rawSwings.length < 3) return NEUTRAL

  // ── Step 3: Label each pivot HH / HL / LH / LL ───────────────────────────
  const swings = labelSwings(rawSwings)

  // ── Step 4: Classify trend from recent swings ─────────────────────────────
  const { trend, bias, bullRatio, recentPattern } = classifyTrend(swings, lookbackSwings)

  // ── Step 5: Fit trend lines ────────────────────────────────────────────────
  const trendLines = fitTrendLines(swings, bars, trend, trendLinePivots)

  // ── Step 6: Detect structure breaks ───────────────────────────────────────
  const structureBreaks = detectStructureBreaks(swings, bars)

  // ── Step 7: Score ──────────────────────────────────────────────────────────
  const lastSwingHigh = [...swings].reverse().find((s) => s.kind === 'high') ?? null
  const lastSwingLow  = [...swings].reverse().find((s) => s.kind === 'low')  ?? null

  const recentLabeled = swings
    .filter((s) => !s.label.startsWith('initial'))
    .slice(-lookbackSwings)

  const avgAmplitude = recentLabeled.length
    ? recentLabeled.reduce((s, p) => s + p.amplitudeATR, 0) / recentLabeled.length
    : 0

  const bestR2 = trendLines.length
    ? Math.max(...trendLines.map((l) => l.fitQuality))
    : 0

  const scores = computeScores(bullRatio, lastADX, avgAmplitude, bestR2)

  return {
    trend,
    bias,
    swings,
    trendLines,
    structureBreaks,
    lastSwingHigh,
    lastSwingLow,
    recentPattern,
    bullRatio,
    scores,
    confidence: scores.total,
  }
}

// ─── Step 2: raw pivot detection ──────────────────────────────────────────────

function detectPivots(
  bars:      OHLCVBar[],
  left:      number,
  right:     number,
  atrSeries: ReturnType<typeof calcATR>,
): Omit<SwingPoint, 'label'>[] {
  const pivots: Omit<SwingPoint, 'label'>[] = []
  const n = bars.length

  for (let i = left; i < n - right; i++) {
    const bar = bars[i]
    const atr = atrSeries[i].value ?? 1

    let isHigh = true
    for (let j = 1; j <= left;  j++) if (bars[i - j].high >= bar.high) { isHigh = false; break }
    if (isHigh) for (let j = 1; j <= right; j++) if (bars[i + j].high > bar.high) { isHigh = false; break }

    let isLow = true
    for (let j = 1; j <= left;  j++) if (bars[i - j].low <= bar.low) { isLow = false; break }
    if (isLow)  for (let j = 1; j <= right; j++) if (bars[i + j].low < bar.low)  { isLow = false; break }

    if (isHigh) {
      // Amplitude = distance from the nearest preceding low pivot
      const prevLow = [...pivots].reverse().find((p) => p.kind === 'low')
      const amp = prevLow ? (bar.high - prevLow.price) / atr : 0
      pivots.push({ id: `swing-${i}`, barIndex: i, time: bar.time, price: bar.high, kind: 'high', amplitudeATR: amp })
    }
    if (isLow) {
      const prevHigh = [...pivots].reverse().find((p) => p.kind === 'high')
      const amp = prevHigh ? (prevHigh.price - bar.low) / atr : 0
      pivots.push({ id: `swing-${i}`, barIndex: i, time: bar.time, price: bar.low, kind: 'low', amplitudeATR: amp })
    }
  }

  return pivots
}

// ─── Step 3: HH / HL / LH / LL labeling ──────────────────────────────────────

function labelSwings(
  raw: Omit<SwingPoint, 'label'>[],
): SwingPoint[] {
  const result: SwingPoint[] = []
  let lastHigh: SwingPoint | null = null
  let lastLow:  SwingPoint | null = null

  for (const p of raw) {
    let label: SwingLabel

    if (p.kind === 'high') {
      if (!lastHigh) {
        label = 'initial-high'
      } else {
        label = p.price > lastHigh.price ? 'HH' : 'LH'
      }
      const sp: SwingPoint = { ...p, label }
      lastHigh = sp
      result.push(sp)
    } else {
      if (!lastLow) {
        label = 'initial-low'
      } else {
        label = p.price > lastLow.price ? 'HL' : 'LL'
      }
      const sp: SwingPoint = { ...p, label }
      lastLow = sp
      result.push(sp)
    }
  }

  return result
}

// ─── Step 4: trend classification ─────────────────────────────────────────────

function classifyTrend(
  swings:         SwingPoint[],
  lookbackSwings: number,
): { trend: MarketTrend; bias: MarketBias; bullRatio: number; recentPattern: SwingLabel[] } {
  const labeled  = swings.filter((s) => !s.label.startsWith('initial'))
  const recent   = labeled.slice(-lookbackSwings)
  const recentPattern = recent.map((s) => s.label)

  if (!recent.length) return { trend: 'range', bias: 'neutral', bullRatio: 0.5, recentPattern }

  const bullCount = recent.filter((s) => s.label === 'HH' || s.label === 'HL').length
  const bearCount = recent.filter((s) => s.label === 'LH' || s.label === 'LL').length
  const total     = bullCount + bearCount
  const bullRatio = total > 0 ? bullCount / total : 0.5

  let trend: MarketTrend
  let bias:  MarketBias

  if      (bullRatio >= 0.65) { trend = 'bull'; bias = 'bullish' }
  else if (bullRatio <= 0.35) { trend = 'bear'; bias = 'bearish' }
  else                         { trend = 'range'; bias = 'neutral' }

  // Bias can diverge from trend on transitions
  // Look at only the last 4 swings for immediate bias
  const immediate = labeled.slice(-4)
  const immBull   = immediate.filter((s) => s.label === 'HH' || s.label === 'HL').length
  const immBear   = immediate.filter((s) => s.label === 'LH' || s.label === 'LL').length
  if      (immBull > immBear) bias = 'bullish'
  else if (immBear > immBull) bias = 'bearish'

  return { trend, bias, bullRatio, recentPattern }
}

// ─── Step 5: trend line fitting ───────────────────────────────────────────────

function fitTrendLines(
  swings:    SwingPoint[],
  bars:      OHLCVBar[],
  trend:     MarketTrend,
  maxPivots: number,
): TrendLineResult[] {
  const lines: TrendLineResult[] = []
  const lastBarIndex = bars.length - 1
  const lastTime     = bars[lastBarIndex].time

  if (trend === 'bull' || trend === 'range') {
    // Uptrend line: through last N HL (Higher Low) pivots
    const hlPivots = swings.filter((s) => s.label === 'HL').slice(-maxPivots)
    if (hlPivots.length >= 2) {
      const line = regressionLine(hlPivots, lastBarIndex, lastTime, 'uptrend', '#22c55e')
      if (line) lines.push(line)
    }
  }

  if (trend === 'bear' || trend === 'range') {
    // Downtrend line: through last N LH (Lower High) pivots
    const lhPivots = swings.filter((s) => s.label === 'LH').slice(-maxPivots)
    if (lhPivots.length >= 2) {
      const line = regressionLine(lhPivots, lastBarIndex, lastTime, 'downtrend', '#ef4444')
      if (line) lines.push(line)
    }
  }

  if (trend === 'range') {
    // Horizontal range bounds: median of recent swing highs and lows
    const highs = swings.filter((s) => s.kind === 'high').slice(-4)
    const lows  = swings.filter((s) => s.kind === 'low').slice(-4)
    if (highs.length >= 2) {
      const price = median(highs.map((h) => h.price))
      lines.push(horizontalLine(highs[0], highs[highs.length - 1], price, lastBarIndex, lastTime, 'range-high', '#f59e0b'))
    }
    if (lows.length >= 2) {
      const price = median(lows.map((l) => l.price))
      lines.push(horizontalLine(lows[0], lows[lows.length - 1], price, lastBarIndex, lastTime, 'range-low', '#3b82f6'))
    }
  }

  // Also draw HH trendline in bull trend (through HH pivots)
  if (trend === 'bull') {
    const hhPivots = swings.filter((s) => s.label === 'HH').slice(-maxPivots)
    if (hhPivots.length >= 2) {
      const line = regressionLine(hhPivots, lastBarIndex, lastTime, 'downtrend', '#16a34a')
      if (line) { line.kind = 'uptrend'; line.color = '#16a34a80'; lines.push(line) }
    }
  }

  // And LL trendline in bear trend (through LL pivots)
  if (trend === 'bear') {
    const llPivots = swings.filter((s) => s.label === 'LL').slice(-maxPivots)
    if (llPivots.length >= 2) {
      const line = regressionLine(llPivots, lastBarIndex, lastTime, 'uptrend', '#dc2626')
      if (line) { line.kind = 'downtrend'; line.color = '#dc262680'; lines.push(line) }
    }
  }

  return lines
}

function regressionLine(
  pivots:       SwingPoint[],
  lastBarIndex: number,
  lastTime:     number,
  kind:         TrendLineKind,
  color:        string,
): TrendLineResult | null {
  if (pivots.length < 2) return null
  const { slope, intercept, r2 } = linearRegression(
    pivots.map((p) => p.barIndex),
    pivots.map((p) => p.price),
  )

  const first = pivots[0]
  const id    = `tl-${kind}-${first.barIndex}`

  return {
    id,
    kind,
    startPrice:    slope * first.barIndex + intercept,
    startTime:     first.time,
    startBarIndex: first.barIndex,
    endPrice:      slope * lastBarIndex + intercept,
    endTime:       lastTime,
    endBarIndex:   lastBarIndex,
    slope,
    fitQuality:    r2,
    pivotCount:    pivots.length,
    color,
  }
}

function horizontalLine(
  first:        SwingPoint,
  _last:        SwingPoint,
  price:        number,
  lastBarIndex: number,
  lastTime:     number,
  kind:         TrendLineKind,
  color:        string,
): TrendLineResult {
  return {
    id:            `tl-${kind}-${first.barIndex}`,
    kind,
    startPrice:    price,
    startTime:     first.time,
    startBarIndex: first.barIndex,
    endPrice:      price,
    endTime:       lastTime,
    endBarIndex:   lastBarIndex,
    slope:         0,
    fitQuality:    1,
    pivotCount:    2,
    color,
  }
}

// ─── Step 6: Break of Structure / Change of Character ─────────────────────────

function detectStructureBreaks(
  swings: SwingPoint[],
  _bars:  OHLCVBar[],
): StructureBreak[] {
  const breaks: StructureBreak[] = []
  const labeled = swings.filter((s) => !s.label.startsWith('initial'))

  for (let i = 1; i < labeled.length; i++) {
    const cur  = labeled[i]
    const prev = labeled[i - 1]

    // BOS bullish: a new HH confirms continuation of bull move
    if (cur.label === 'HH') {
      breaks.push({
        barIndex:     cur.barIndex,
        time:         cur.time,
        price:        cur.price,
        type:         'BOS',
        direction:    'bullish',
        brokenLevel:  prev.kind === 'high' ? prev.price : cur.price,
      })
    }
    // BOS bearish: a new LL confirms continuation of bear move
    if (cur.label === 'LL') {
      breaks.push({
        barIndex:     cur.barIndex,
        time:         cur.time,
        price:        cur.price,
        type:         'BOS',
        direction:    'bearish',
        brokenLevel:  prev.kind === 'low' ? prev.price : cur.price,
      })
    }
    // CHoCH bearish: first LH after a series of HHs (bull→bear transition)
    if (cur.label === 'LH') {
      const prevHighs = labeled.slice(Math.max(0, i - 4), i).filter((s) => s.kind === 'high')
      const wasRising = prevHighs.some((s) => s.label === 'HH')
      if (wasRising) {
        breaks.push({
          barIndex:     cur.barIndex,
          time:         cur.time,
          price:        cur.price,
          type:         'CHoCH',
          direction:    'bearish',
          brokenLevel:  prev.kind === 'high' ? prev.price : cur.price,
        })
      }
    }
    // CHoCH bullish: first HL after a series of LLs (bear→bull transition)
    if (cur.label === 'HL') {
      const prevLows = labeled.slice(Math.max(0, i - 4), i).filter((s) => s.kind === 'low')
      const wasFalling = prevLows.some((s) => s.label === 'LL')
      if (wasFalling) {
        breaks.push({
          barIndex:     cur.barIndex,
          time:         cur.time,
          price:        cur.price,
          type:         'CHoCH',
          direction:    'bullish',
          brokenLevel:  prev.kind === 'low' ? prev.price : cur.price,
        })
      }
    }
  }

  return breaks
}

// ─── Step 7: scoring ──────────────────────────────────────────────────────────

function computeScores(
  bullRatio:    number,
  adx:          number,
  avgAmplATR:   number,
  bestR2:       number,
): StructureScores {
  // Consistency: dominant fraction > 50% starts scoring; 100% = 40 pts
  const dominantFrac = Math.max(bullRatio, 1 - bullRatio)
  const consistency  = Math.round(Math.max(0, (dominantFrac - 0.5) / 0.5) * 40)

  // ADX strength: linearly maps ADX[15,50] → [0,20]
  const adxStrength  = Math.round(Math.min(20, Math.max(0, (adx - 15) / 35 * 20)))

  // Clarity: avg swing amplitude in ATRs → [0,25], 5 ATRs = max
  const clarity      = Math.round(Math.min(25, avgAmplATR * 5))

  // Trend line quality: R² × 15
  const trendlineQuality = Math.round(Math.min(15, bestR2 * 15))

  const total = Math.min(100, consistency + adxStrength + clarity + trendlineQuality)

  return { consistency, adxStrength, clarity, trendlineQuality, total }
}

// ─── Maths helpers ────────────────────────────────────────────────────────────

function linearRegression(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number; r2: number } {
  const n    = xs.length
  const sumX  = xs.reduce((a, b) => a + b, 0)
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const denom = n * sumX2 - sumX * sumX

  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 }

  const slope     = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  const yMean  = sumY / n
  const ssTot  = ys.reduce((s, y) => s + (y - yMean) ** 2, 0)
  const ssRes  = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0)
  const r2     = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)

  return { slope, intercept, r2 }
}

function median(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function lastNonNull<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i]
  return null
}

function neutralResult(): MarketStructureResult {
  return {
    trend: 'range', bias: 'neutral',
    swings: [], trendLines: [], structureBreaks: [],
    lastSwingHigh: null, lastSwingLow: null,
    recentPattern: [], bullRatio: 0.5,
    scores: { consistency: 0, adxStrength: 0, clarity: 0, trendlineQuality: 0, total: 0 },
    confidence: 0,
  }
}

export { neutralResult as _neutralMarketStructure }
