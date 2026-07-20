/**
 * Chart Pattern Recognition Engine
 *
 * Detects 17 chart patterns (flags, triangles, wedges, reversals, consolidations).
 * Returns probability, stop loss, target, risk/reward, and confidence.
 *
 * Algorithm:
 *   1. Find swing pivots (highs/lows) within the lookback window
 *   2. For each pattern type, validate prerequisites and geometry
 *   3. Fit support/resistance levels through pivot touchdowns
 *   4. Calculate entry, stop, target based on pattern type
 *   5. Score across shape clarity, touches, size, recency (0-100 confidence)
 */

import type { OHLCVBar } from '@/types'
import { calcATR } from './indicators'
import type {
  PatternType,
  PatternDetectionResult,
  PatternEngineResults,
  PatternDetectionOptions,
  PatternGeometry,
  PatternLevel,
  LevelTouch,
  PatternScores,
} from './patternTypes'
import { PATTERN_CATEGORIES } from './patternTypes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract last ATR value, properly typed. */
function getLastATR(bars: OHLCVBar[]): number | null {
  const atr14 = calcATR(bars, 14)
  const lastPoint = atr14[bars.length - 1]
  return lastPoint?.value ?? null
}

/** Find all significant pivot highs and lows using strict ZigZag. */
function findPivots(bars: OHLCVBar[], leftBars = 2, rightBars = 2) {
  const pivots: {
    barIndex: number
    price: number
    kind: 'high' | 'low'
    time: number
  }[] = []

  for (let i = leftBars; i < bars.length - rightBars; i++) {
    let isHigh = true,
      isLow = true

    // Check left side
    for (let j = 1; j <= leftBars; j++) {
      if (bars[i - j].high >= bars[i].high) isHigh = false
      if (bars[i - j].low <= bars[i].low) isLow = false
    }

    // Check right side
    for (let j = 1; j <= rightBars; j++) {
      if (bars[i + j].high > bars[i].high) isHigh = false
      if (bars[i + j].low < bars[i].low) isLow = false
    }

    if (isHigh) {
      pivots.push({ barIndex: i, price: bars[i].high, kind: 'high', time: bars[i].time })
    }
    if (isLow) {
      pivots.push({ barIndex: i, price: bars[i].low, kind: 'low', time: bars[i].time })
    }
  }

  return pivots
}

/** Least-squares linear regression. Returns { slope, intercept, r2 }. */
function linearRegression(
  points: { x: number; y: number }[]
): { slope: number; intercept: number; r2: number } {
  if (points.length < 2) return { slope: 0, intercept: 0, r2: 0 }

  const n = points.length
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0

  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumXY += p.x * p.y
    sumX2 += p.x * p.x
    sumY2 += p.y * p.y
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // R²
  const meanY = sumY / n
  const ssTotal = points.reduce((sum, p) => sum + (p.y - meanY) ** 2, 0)
  const ssResid = points.reduce((sum, p) => {
    const predicted = slope * p.x + intercept
    return sum + (p.y - predicted) ** 2
  }, 0)
  const r2 = ssTotal === 0 ? 0 : 1 - ssResid / ssTotal

  return { slope, intercept, r2: Math.max(0, Math.min(1, r2)) }
}

/** Price level touches within tolerance. */
function findLevelTouches(
  bars: OHLCVBar[],
  level: number,
  tolerance: number,
  startIdx = 0,
  endIdx: number | null = null
): LevelTouch[] {
  endIdx = endIdx ?? bars.length - 1
  const tolerance_amount = level * tolerance
  const touches: LevelTouch[] = []

  for (let i = startIdx; i <= endIdx && i < bars.length; i++) {
    const bar = bars[i]
    if (bar.low <= level + tolerance_amount && bar.high >= level - tolerance_amount) {
      // Find the exact price closest to the level
      let touchPrice = level
      if (Math.abs(bar.high - level) < Math.abs(bar.low - level)) {
        touchPrice = bar.high
      } else {
        touchPrice = bar.low
      }
      touches.push({ barIndex: i, price: touchPrice, time: bar.time })
    }
  }

  return touches
}

/** Fit support line through swing lows. Returns level and quality metrics. */
function fitSupportLevel(
  bars: OHLCVBar[],
  lows: { barIndex: number; price: number }[],
  tolerance: number
): PatternLevel | null {
  if (lows.length < 2) return null

  const regressionPoints = lows.map((l) => ({ x: l.barIndex, y: l.price }))
  const { slope, intercept, r2 } = linearRegression(regressionPoints)

  const levelPrice = intercept + slope * (bars.length - 1)

  const touches = findLevelTouches(bars, levelPrice, tolerance)

  return {
    price: levelPrice,
    touchCount: touches.length,
    fitQuality: r2,
    slope,
    intercept,
  }
}

/** Fit resistance line through swing highs. */
function fitResistanceLevel(
  bars: OHLCVBar[],
  highs: { barIndex: number; price: number }[],
  tolerance: number
): PatternLevel | null {
  if (highs.length < 2) return null

  const regressionPoints = highs.map((h) => ({ x: h.barIndex, y: h.price }))
  const { slope, intercept, r2 } = linearRegression(regressionPoints)

  const levelPrice = intercept + slope * (bars.length - 1)

  const touches = findLevelTouches(bars, levelPrice, tolerance)

  return {
    price: levelPrice,
    touchCount: touches.length,
    fitQuality: r2,
    slope,
    intercept,
  }
}

/** Calculate pattern confidence (0-100) from shape, touches, size, recency. */
function scorePattern(
  bars: OHLCVBar[],
  geometry: PatternGeometry,
  support: PatternLevel | undefined,
  resistance: PatternLevel | undefined,
  atr14Value: number | null
): { confidence: number; scores: PatternScores } {
  const scores: PatternScores = {
    shapeClarity: 0,
    touchQuality: 0,
    sizeQuality: 0,
    recencyQuality: 0,
    total: 0,
  }

  // Shape clarity: based on R² fit (if available)
  if (support?.fitQuality ?? resistance?.fitQuality) {
    const avgR2 = (
      ((support?.fitQuality ?? 0) + (resistance?.fitQuality ?? 0)) /
      2
    )
    scores.shapeClarity = Math.min(25, avgR2 * 25)
  } else {
    scores.shapeClarity = 15 // baseline
  }

  // Touch quality: more touches = higher confidence
  const totalTouches = (support?.touchCount ?? 0) + (resistance?.touchCount ?? 0)
  scores.touchQuality = Math.min(25, totalTouches * 5)

  // Size quality: pattern height relative to ATR (not too big, not too small)
  if (atr14Value && atr14Value > 0) {
    const sizeRatio = geometry.heightToATR
    // Ideal: 1–4 ATR
    if (sizeRatio < 1) {
      scores.sizeQuality = sizeRatio * 12.5 // too small
    } else if (sizeRatio <= 4) {
      scores.sizeQuality = 25 // ideal
    } else {
      scores.sizeQuality = Math.max(0, 25 - (sizeRatio - 4) * 5) // too large
    }
  } else {
    scores.sizeQuality = 15
  }

  // Recency: more recent touches = higher confidence
  const barsAgo = bars.length - 1 - geometry.endBarIndex
  if (barsAgo <= 5) {
    scores.recencyQuality = 25
  } else if (barsAgo <= 15) {
    scores.recencyQuality = 20
  } else if (barsAgo <= 30) {
    scores.recencyQuality = 15
  } else {
    scores.recencyQuality = Math.max(0, 20 - barsAgo / 5)
  }

  scores.total = Math.min(100, Math.round(scores.shapeClarity +
    scores.touchQuality +
    scores.sizeQuality +
    scores.recencyQuality))

  return {
    confidence: scores.total,
    scores,
  }
}

// ─── Pattern Detectors ──────────────────────────────────────────────────────

/** Detect bull flag: uptrend (flagpole) followed by downsloping consolidation. */
function detectBullFlag(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 5
  const trendLookback = opts.trendLookback ?? 20

  // Find recent swing high (flagpole top)
  const recentHighs = pivots.filter(
    (p) => p.kind === 'high' && p.barIndex >= bars.length - trendLookback
  )
  if (recentHighs.length < 1) return null

  const flagpoleTop = recentHighs[recentHighs.length - 1]

  // Check prior uptrend exists (lower low before flagpole)
  const beforeFlagpole = pivots.filter((p) => p.barIndex < flagpoleTop.barIndex)
  if (beforeFlagpole.length < 2) return null

  const priorLow = beforeFlagpole.filter((p) => p.kind === 'low').pop()
  if (!priorLow || priorLow.price >= flagpoleTop.price * 0.98) return null

  // Find consolidation after flagpole
  const consolidation = pivots.filter(
    (p) =>
      p.barIndex > flagpoleTop.barIndex &&
      p.barIndex <= bars.length - 1
  )
  if (consolidation.length < 2) return null

  // Check for downsloping highs and upsloping lows (flag shape)
  const flagHighs = consolidation.filter((p) => p.kind === 'high')
  const flagLows = consolidation.filter((p) => p.kind === 'low')
  if (flagHighs.length < 2 || flagLows.length < 2) return null

  const flagStart = Math.min(flagHighs[0].barIndex, flagLows[0].barIndex)
  const flagEnd = Math.max(flagHighs[flagHighs.length - 1].barIndex,
    flagLows[flagLows.length - 1].barIndex)
  const flagWidth = flagEnd - flagStart + 1

  if (flagWidth < minWidth) return null

  // Fit resistance (downsloping) and support (upsloping)
  const resistance = fitResistanceLevel(bars, flagHighs.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)
  const support = fitSupportLevel(bars, flagLows.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)

  if (!resistance || !support || !resistance.slope || !support.slope) return null

  // Verify downsloping resistance and upsloping support
  if (resistance.slope >= 0 || support.slope <= 0) return null

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: flagpoleTop.barIndex,
    endBarIndex: flagEnd,
    entryPrice: resistance.price,
    patternHigh: Math.max(...flagHighs.map((p) => p.price)),
    patternLow: Math.min(...flagLows.map((p) => p.price)),
    patternHeight: Math.max(...flagHighs.map((p) => p.price)) - Math.min(...flagLows.map((p) => p.price)),
    patternWidth: flagWidth,
    heightToATR: atrAtEnd ? (Math.max(...flagHighs.map((p) => p.price)) - Math.min(...flagLows.map((p) => p.price))) / atrAtEnd : 1,
  }

  const { confidence } = scorePattern(bars, geometry, support, resistance, atrAtEnd)

  // Target: flagpole height projected from breakout
  const flagpoleHeight = flagpoleTop.price - (priorLow?.price ?? support.price)
  const target = resistance.price + flagpoleHeight

  const stopLoss = support.price - (atrAtEnd ?? 0.01)
  const riskReward = (target - resistance.price) / (resistance.price - stopLoss)

  return {
    pattern: 'bull-flag',
    category: PATTERN_CATEGORIES['bull-flag'],
    geometry,
    support,
    resistance,
    entry: resistance.price,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(85, confidence + 10),
    confidence,
    isActive: bars.length - 1 - flagEnd <= 3,
    bias: 'bullish',
  }
}

/** Detect bear flag: downtrend (flagpole) followed by upsloping consolidation. */
function detectBearFlag(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 5
  const trendLookback = opts.trendLookback ?? 20

  const recentLows = pivots.filter(
    (p) => p.kind === 'low' && p.barIndex >= bars.length - trendLookback
  )
  if (recentLows.length < 1) return null

  const flagpoleBottom = recentLows[recentLows.length - 1]

  const beforeFlagpole = pivots.filter((p) => p.barIndex < flagpoleBottom.barIndex)
  if (beforeFlagpole.length < 2) return null

  const priorHigh = beforeFlagpole.filter((p) => p.kind === 'high').pop()
  if (!priorHigh || priorHigh.price <= flagpoleBottom.price * 1.02) return null

  const consolidation = pivots.filter(
    (p) =>
      p.barIndex > flagpoleBottom.barIndex &&
      p.barIndex <= bars.length - 1
  )
  if (consolidation.length < 2) return null

  const flagHighs = consolidation.filter((p) => p.kind === 'high')
  const flagLows = consolidation.filter((p) => p.kind === 'low')
  if (flagHighs.length < 2 || flagLows.length < 2) return null

  const flagStart = Math.min(flagHighs[0].barIndex, flagLows[0].barIndex)
  const flagEnd = Math.max(flagHighs[flagHighs.length - 1].barIndex,
    flagLows[flagLows.length - 1].barIndex)
  const flagWidth = flagEnd - flagStart + 1

  if (flagWidth < minWidth) return null

  const support = fitSupportLevel(bars, flagLows.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)
  const resistance = fitResistanceLevel(bars, flagHighs.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)

  if (!support || !resistance || !support.slope || !resistance.slope) return null

  // Verify upsloping support and downsloping resistance
  if (support.slope <= 0 || resistance.slope >= 0) return null

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: flagpoleBottom.barIndex,
    endBarIndex: flagEnd,
    entryPrice: support.price,
    patternHigh: Math.max(...flagHighs.map((p) => p.price)),
    patternLow: Math.min(...flagLows.map((p) => p.price)),
    patternHeight: Math.max(...flagHighs.map((p) => p.price)) - Math.min(...flagLows.map((p) => p.price)),
    patternWidth: flagWidth,
    heightToATR: atrAtEnd ? (Math.max(...flagHighs.map((p) => p.price)) - Math.min(...flagLows.map((p) => p.price))) / atrAtEnd : 1,
  }

  const { confidence } = scorePattern(bars, geometry, support, resistance, atrAtEnd)

  const flagpoleHeight = (priorHigh?.price ?? resistance.price) - flagpoleBottom.price
  const target = support.price - flagpoleHeight

  const stopLoss = resistance.price + (atrAtEnd ?? 0.01)
  const riskReward = (support.price - target) / (stopLoss - support.price)

  return {
    pattern: 'bear-flag',
    category: PATTERN_CATEGORIES['bear-flag'],
    geometry,
    support,
    resistance,
    entry: support.price,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(85, confidence + 10),
    confidence,
    isActive: bars.length - 1 - flagEnd <= 3,
    bias: 'bearish',
  }
}

/** Detect ascending triangle: flat resistance, rising support (bullish). */
function detectAscendingTriangle(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 5

  const highs = pivots.filter((p) => p.kind === 'high')
  const lows = pivots.filter((p) => p.kind === 'low')

  if (highs.length < 2 || lows.length < 2) return null

  // Filter to recent swings
  const recentHighs = highs.slice(-4)
  const recentLows = lows.slice(-4)

  const startIdx = Math.min(
    recentHighs[0]?.barIndex ?? bars.length,
    recentLows[0]?.barIndex ?? bars.length
  )
  const endIdx = Math.max(
    recentHighs[recentHighs.length - 1]?.barIndex ?? 0,
    recentLows[recentLows.length - 1]?.barIndex ?? 0
  )

  const width = endIdx - startIdx + 1
  if (width < minWidth) return null

  // Fit resistance (should be flat/declining) and support (rising)
  const resistance = fitResistanceLevel(bars, recentHighs.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)
  const support = fitSupportLevel(bars, recentLows.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)

  if (!resistance || !support || !resistance.slope || !support.slope) return null

  // Ascending triangle: support rising, resistance flat or declining
  if (support.slope <= 0.0001 || resistance.slope > 0.0001) return null

  // Verify convergence (triangle shape)
  const currentSpread = resistance.price - support.price
  const startSpread = ((resistance.intercept ?? resistance.price) - (resistance.slope * startIdx)) - ((support.intercept ?? support.price) + (support.slope * startIdx))
  if (currentSpread >= startSpread * 0.9) return null

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: startIdx,
    endBarIndex: endIdx,
    entryPrice: resistance.price,
    patternHigh: Math.max(...recentHighs.map((p) => p.price)),
    patternLow: Math.min(...recentLows.map((p) => p.price)),
    patternHeight: Math.max(...recentHighs.map((p) => p.price)) - Math.min(...recentLows.map((p) => p.price)),
    patternWidth: width,
    heightToATR: atrAtEnd ? (Math.max(...recentHighs.map((p) => p.price)) - Math.min(...recentLows.map((p) => p.price))) / atrAtEnd : 1,
  }

  const { confidence } = scorePattern(bars, geometry, support, resistance, atrAtEnd)

  const triangleHeight = geometry.patternHeight
  const target = resistance.price + triangleHeight

  const stopLoss = support.price - (atrAtEnd ?? 0.01)
  const riskReward = (target - resistance.price) / (resistance.price - stopLoss)

  return {
    pattern: 'ascending-triangle',
    category: PATTERN_CATEGORIES['ascending-triangle'],
    geometry,
    support,
    resistance,
    entry: resistance.price,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(80, confidence + 15),
    confidence,
    isActive: bars.length - 1 - endIdx <= 3,
    bias: 'bullish',
  }
}

/** Detect descending triangle: rising support, flat resistance (bearish). */
function detectDescendingTriangle(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 5

  const highs = pivots.filter((p) => p.kind === 'high')
  const lows = pivots.filter((p) => p.kind === 'low')

  if (highs.length < 2 || lows.length < 2) return null

  const recentHighs = highs.slice(-4)
  const recentLows = lows.slice(-4)

  const startIdx = Math.min(
    recentHighs[0]?.barIndex ?? bars.length,
    recentLows[0]?.barIndex ?? bars.length
  )
  const endIdx = Math.max(
    recentHighs[recentHighs.length - 1]?.barIndex ?? 0,
    recentLows[recentLows.length - 1]?.barIndex ?? 0
  )

  const width = endIdx - startIdx + 1
  if (width < minWidth) return null

  const resistance = fitResistanceLevel(bars, recentHighs.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)
  const support = fitSupportLevel(bars, recentLows.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)

  if (!resistance || !support || !resistance.slope || !support.slope) return null

  // Descending triangle: support rising, resistance flat or declining
  if (support.slope >= -0.0001 || resistance.slope < -0.0001) return null

  const currentSpread = resistance.price - support.price
  const startSpread = ((resistance.intercept ?? resistance.price) - (resistance.slope * startIdx)) - ((support.intercept ?? support.price) + (support.slope * startIdx))
  if (currentSpread >= startSpread * 0.9) return null

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: startIdx,
    endBarIndex: endIdx,
    entryPrice: support.price,
    patternHigh: Math.max(...recentHighs.map((p) => p.price)),
    patternLow: Math.min(...recentLows.map((p) => p.price)),
    patternHeight: Math.max(...recentHighs.map((p) => p.price)) - Math.min(...recentLows.map((p) => p.price)),
    patternWidth: width,
    heightToATR: atrAtEnd ? (Math.max(...recentHighs.map((p) => p.price)) - Math.min(...recentLows.map((p) => p.price))) / atrAtEnd : 1,
  }

  const { confidence } = scorePattern(bars, geometry, support, resistance, atrAtEnd)

  const triangleHeight = geometry.patternHeight
  const target = support.price - triangleHeight

  const stopLoss = resistance.price + (atrAtEnd ?? 0.01)
  const riskReward = (support.price - target) / (stopLoss - support.price)

  return {
    pattern: 'descending-triangle',
    category: PATTERN_CATEGORIES['descending-triangle'],
    geometry,
    support,
    resistance,
    entry: support.price,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(80, confidence + 15),
    confidence,
    isActive: bars.length - 1 - endIdx <= 3,
    bias: 'bearish',
  }
}

/** Detect symmetric triangle: both support and resistance converging equally. */
function detectSymmetricTriangle(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 5

  const highs = pivots.filter((p) => p.kind === 'high')
  const lows = pivots.filter((p) => p.kind === 'low')

  if (highs.length < 2 || lows.length < 2) return null

  const recentHighs = highs.slice(-4)
  const recentLows = lows.slice(-4)

  const startIdx = Math.min(
    recentHighs[0]?.barIndex ?? bars.length,
    recentLows[0]?.barIndex ?? bars.length
  )
  const endIdx = Math.max(
    recentHighs[recentHighs.length - 1]?.barIndex ?? 0,
    recentLows[recentLows.length - 1]?.barIndex ?? 0
  )

  const width = endIdx - startIdx + 1
  if (width < minWidth) return null

  const resistance = fitResistanceLevel(bars, recentHighs.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)
  const support = fitSupportLevel(bars, recentLows.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)

  if (!resistance || !support || !resistance.slope === undefined || !support.slope === undefined) return null

  // Symmetric: resistance declining, support rising, slopes opposite/equal magnitude
  if (
    !resistance.slope ||
    !support.slope ||
    resistance.slope > -0.0001 ||
    support.slope < 0.0001
  ) {
    return null
  }

  const slopeMagnitudeRatio = Math.abs(support.slope / resistance.slope)
  if (slopeMagnitudeRatio < 0.7 || slopeMagnitudeRatio > 1.43) return null

  const currentSpread = resistance.price - support.price
  const startSpread = ((resistance.intercept ?? resistance.price) - (resistance.slope * startIdx)) - ((support.intercept ?? support.price) + (support.slope * startIdx))
  if (currentSpread >= startSpread * 0.85) return null

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: startIdx,
    endBarIndex: endIdx,
    entryPrice: (resistance.price + support.price) / 2,
    patternHigh: Math.max(...recentHighs.map((p) => p.price)),
    patternLow: Math.min(...recentLows.map((p) => p.price)),
    patternHeight: Math.max(...recentHighs.map((p) => p.price)) - Math.min(...recentLows.map((p) => p.price)),
    patternWidth: width,
    heightToATR: atrAtEnd ? (Math.max(...recentHighs.map((p) => p.price)) - Math.min(...recentLows.map((p) => p.price))) / atrAtEnd : 1,
  }

  const { confidence } = scorePattern(bars, geometry, support, resistance, atrAtEnd)

  // Neutral bias but can break either way
  const mid = (resistance.price + support.price) / 2
  const triangleHeight = geometry.patternHeight

  const bullTarget = mid + triangleHeight / 2
  const target = bullTarget // Default to bullish

  const stopLoss = support.price - (atrAtEnd ?? 0.01)
  const riskReward = (target - mid) / (mid - stopLoss)

  return {
    pattern: 'triangle',
    category: PATTERN_CATEGORIES['triangle'],
    geometry,
    support,
    resistance,
    entry: mid,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(75, confidence),
    confidence,
    isActive: bars.length - 1 - endIdx <= 3,
    bias: 'neutral',
  }
}

/** Detect double top: two peaks at similar heights (bearish reversal). */
function detectDoubleTop(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 10

  const highs = pivots.filter((p) => p.kind === 'high').slice(-5)
  if (highs.length < 2) return null

  // Find two similar highs
  const first = highs[highs.length - 2]
  const second = highs[highs.length - 1]

  if (!first || !second) return null

  const heightDiff = Math.abs(first.price - second.price)
  const heightRatio = heightDiff / first.price

  if (heightRatio > tolerance || second.barIndex - first.barIndex < minWidth) return null

  // Find the low between the two tops
  const betweenLows = pivots.filter(
    (p) => p.kind === 'low' && p.barIndex > first.barIndex && p.barIndex < second.barIndex
  )
  if (betweenLows.length === 0) return null

  const necklineLow = betweenLows[0]

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: first.barIndex,
    endBarIndex: second.barIndex,
    entryPrice: (first.price + second.price) / 2,
    patternHigh: Math.max(first.price, second.price),
    patternLow: necklineLow.price,
    patternHeight: Math.max(first.price, second.price) - necklineLow.price,
    patternWidth: second.barIndex - first.barIndex + 1,
    heightToATR: atrAtEnd ? (Math.max(first.price, second.price) - necklineLow.price) / atrAtEnd : 1,
  }

  const confidence = Math.min(75, 50 + Math.round((1 - heightRatio / tolerance) * 25))

  const breakLevel = necklineLow.price
  const target = breakLevel - geometry.patternHeight

  const stopLoss = geometry.patternHigh + (atrAtEnd ?? 0.01)
  const riskReward = (breakLevel - target) / (stopLoss - breakLevel)

  return {
    pattern: 'double-top',
    category: PATTERN_CATEGORIES['double-top'],
    geometry,
    entry: breakLevel,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(75, confidence + 10),
    confidence,
    isActive: bars.length - 1 - second.barIndex <= 3,
    bias: 'bearish',
  }
}

/** Detect double bottom: two troughs at similar depths (bullish reversal). */
function detectDoubleBottom(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 10

  const lows = pivots.filter((p) => p.kind === 'low').slice(-5)
  if (lows.length < 2) return null

  const first = lows[lows.length - 2]
  const second = lows[lows.length - 1]

  if (!first || !second) return null

  const depthDiff = Math.abs(first.price - second.price)
  const depthRatio = depthDiff / first.price

  if (depthRatio > tolerance || second.barIndex - first.barIndex < minWidth) return null

  const betweenHighs = pivots.filter(
    (p) => p.kind === 'high' && p.barIndex > first.barIndex && p.barIndex < second.barIndex
  )
  if (betweenHighs.length === 0) return null

  const necklineHigh = betweenHighs[0]

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: first.barIndex,
    endBarIndex: second.barIndex,
    entryPrice: (first.price + second.price) / 2,
    patternHigh: necklineHigh.price,
    patternLow: Math.min(first.price, second.price),
    patternHeight: necklineHigh.price - Math.min(first.price, second.price),
    patternWidth: second.barIndex - first.barIndex + 1,
    heightToATR: atrAtEnd ? (necklineHigh.price - Math.min(first.price, second.price)) / atrAtEnd : 1,
  }

  const confidence = Math.min(75, 50 + Math.round((1 - depthRatio / tolerance) * 25))

  const breakLevel = necklineHigh.price
  const target = breakLevel + geometry.patternHeight

  const stopLoss = geometry.patternLow - (atrAtEnd ?? 0.01)
  const riskReward = (target - breakLevel) / (breakLevel - stopLoss)

  return {
    pattern: 'double-bottom',
    category: PATTERN_CATEGORIES['double-bottom'],
    geometry,
    entry: breakLevel,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(75, confidence + 10),
    confidence,
    isActive: bars.length - 1 - second.barIndex <= 3,
    bias: 'bullish',
  }
}

/** Detect rectangle: horizontal consolidation. */
function detectRectangle(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 8

  const highs = pivots.filter((p) => p.kind === 'high').slice(-6)
  const lows = pivots.filter((p) => p.kind === 'low').slice(-6)

  if (highs.length < 2 || lows.length < 2) return null

  const resistance = fitResistanceLevel(bars, highs.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)
  const support = fitSupportLevel(bars, lows.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)

  if (!resistance || !support || !resistance.slope || !support.slope) return null

  // Rectangle: both lines nearly flat
  if (Math.abs(resistance.slope) > 0.001 || Math.abs(support.slope) > 0.001) return null

  const startIdx = Math.min(highs[0]?.barIndex ?? bars.length, lows[0]?.barIndex ?? bars.length)
  const endIdx = Math.max(highs[highs.length - 1]?.barIndex ?? 0, lows[lows.length - 1]?.barIndex ?? 0)

  const width = endIdx - startIdx + 1
  if (width < minWidth) return null

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: startIdx,
    endBarIndex: endIdx,
    entryPrice: (resistance.price + support.price) / 2,
    patternHigh: resistance.price,
    patternLow: support.price,
    patternHeight: resistance.price - support.price,
    patternWidth: width,
    heightToATR: atrAtEnd ? (resistance.price - support.price) / atrAtEnd : 1,
  }

  const { confidence } = scorePattern(bars, geometry, support, resistance, atrAtEnd)

  const mid = (resistance.price + support.price) / 2
  const rectHeight = geometry.patternHeight

  // Can break either way
  const bullTarget = resistance.price + rectHeight
  const bearTarget = support.price - rectHeight
  const target = mid > bars[bars.length - 1].close ? bearTarget : bullTarget
  const bias = target > mid ? 'bullish' : 'bearish'

  const stopLoss = bias === 'bullish' ? support.price - (atrAtEnd ?? 0.01) : resistance.price + (atrAtEnd ?? 0.01)
  const riskReward = Math.abs(target - mid) / Math.abs(mid - stopLoss)

  return {
    pattern: 'rectangle',
    category: PATTERN_CATEGORIES['rectangle'],
    geometry,
    support,
    resistance,
    entry: mid,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(70, confidence + 5),
    confidence,
    isActive: bars.length - 1 - endIdx <= 3,
    bias,
  }
}

/** Detect channel: parallel support and resistance. */
function detectChannel(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 8

  const highs = pivots.filter((p) => p.kind === 'high').slice(-6)
  const lows = pivots.filter((p) => p.kind === 'low').slice(-6)

  if (highs.length < 2 || lows.length < 2) return null

  const resistance = fitResistanceLevel(bars, highs.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)
  const support = fitSupportLevel(bars, lows.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)

  if (!resistance || !support || !resistance.slope || !support.slope) return null

  // Channel: slopes similar magnitude and direction
  const slopeDiff = Math.abs(resistance.slope - support.slope)
  if (slopeDiff > 0.001) return null

  const startIdx = Math.min(highs[0]?.barIndex ?? bars.length, lows[0]?.barIndex ?? bars.length)
  const endIdx = Math.max(highs[highs.length - 1]?.barIndex ?? 0, lows[lows.length - 1]?.barIndex ?? 0)

  const width = endIdx - startIdx + 1
  if (width < minWidth) return null

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: startIdx,
    endBarIndex: endIdx,
    entryPrice: (resistance.price + support.price) / 2,
    patternHigh: resistance.price,
    patternLow: support.price,
    patternHeight: resistance.price - support.price,
    patternWidth: width,
    heightToATR: atrAtEnd ? (resistance.price - support.price) / atrAtEnd : 1,
  }

  const { confidence } = scorePattern(bars, geometry, support, resistance, atrAtEnd)

  // Determine channel direction
  let channelType: PatternType = 'channel-sideways'
  let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral'

  if (support.slope > 0.0001) {
    channelType = 'channel-up'
    bias = 'bullish'
  } else if (support.slope < -0.0001) {
    channelType = 'channel-down'
    bias = 'bearish'
  }

  const mid = (resistance.price + support.price) / 2
  const channelHeight = geometry.patternHeight
  const target = bias === 'bullish' ? resistance.price + channelHeight / 2 : support.price - channelHeight / 2

  const stopLoss = bias === 'bullish' ? support.price - (atrAtEnd ?? 0.01) : resistance.price + (atrAtEnd ?? 0.01)
  const riskReward = Math.abs(target - mid) / Math.abs(mid - stopLoss)

  return {
    pattern: channelType,
    category: PATTERN_CATEGORIES[channelType],
    geometry,
    support,
    resistance,
    entry: mid,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(75, confidence + 10),
    confidence,
    isActive: bars.length - 1 - endIdx <= 3,
    bias,
  }
}

/** Detect pennant: small convergent triangle after strong trend. */
function detectPennant(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003
  const minWidth = opts.minPatternWidth ?? 4
  const maxWidth = opts.maxPatternWidth ?? 15
  const trendLookback = opts.trendLookback ?? 15

  const highs = pivots.filter((p) => p.kind === 'high')
  const lows = pivots.filter((p) => p.kind === 'low')

  if (highs.length < 2 || lows.length < 2) return null

  // Look for recent trend
  const recentHighs = highs.filter((p) => p.barIndex >= bars.length - trendLookback)
  const recentLows = lows.filter((p) => p.barIndex >= bars.length - trendLookback)

  if (recentHighs.length < 2 || recentLows.length < 2) return null

  const pennantHighs = recentHighs.slice(-3)
  const pennantLows = recentLows.slice(-3)

  const startIdx = Math.min(pennantHighs[0]?.barIndex ?? bars.length, pennantLows[0]?.barIndex ?? bars.length)
  const endIdx = Math.max(pennantHighs[pennantHighs.length - 1]?.barIndex ?? 0, pennantLows[pennantLows.length - 1]?.barIndex ?? 0)

  const width = endIdx - startIdx + 1
  if (width < minWidth || width > maxWidth) return null

  const resistance = fitResistanceLevel(bars, pennantHighs.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)
  const support = fitSupportLevel(bars, pennantLows.map((p) => ({ barIndex: p.barIndex, price: p.price })), tolerance)

  if (!resistance || !support || !resistance.slope || !support.slope) return null

  // Pennant: both converging (forming triangle)
  if (resistance.slope >= -0.0001 || support.slope <= 0.0001) return null

  const currentSpread = resistance.price - support.price
  const startSpread = ((resistance.intercept ?? resistance.price) - (resistance.slope * startIdx)) - ((support.intercept ?? support.price) + (support.slope * startIdx))
  if (currentSpread >= startSpread * 0.85) return null

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: startIdx,
    endBarIndex: endIdx,
    entryPrice: (resistance.price + support.price) / 2,
    patternHigh: Math.max(...pennantHighs.map((p) => p.price)),
    patternLow: Math.min(...pennantLows.map((p) => p.price)),
    patternHeight: Math.max(...pennantHighs.map((p) => p.price)) - Math.min(...pennantLows.map((p) => p.price)),
    patternWidth: width,
    heightToATR: atrAtEnd ? (Math.max(...pennantHighs.map((p) => p.price)) - Math.min(...pennantLows.map((p) => p.price))) / atrAtEnd : 1,
  }

  const { confidence } = scorePattern(bars, geometry, support, resistance, atrAtEnd)

  // Pennants are typically continuation; assume same direction as pre-pennant trend
  const priorHighs = highs.filter((p) => p.barIndex < startIdx)
  const priorTrend = priorHighs.length > 0 && priorHighs[priorHighs.length - 1].price < geometry.patternHigh ? 'bullish' : 'bearish'

  const pennantHeight = geometry.patternHeight
  const breakLevel = priorTrend === 'bullish' ? resistance.price : support.price
  const target = priorTrend === 'bullish' ? breakLevel + pennantHeight : breakLevel - pennantHeight

  const stopLoss = priorTrend === 'bullish' ? support.price - (atrAtEnd ?? 0.01) : resistance.price + (atrAtEnd ?? 0.01)
  const riskReward = Math.abs(target - breakLevel) / Math.abs(breakLevel - stopLoss)

  return {
    pattern: 'pennant',
    category: PATTERN_CATEGORIES['pennant'],
    geometry,
    support,
    resistance,
    entry: breakLevel,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(80, confidence + 15),
    confidence,
    isActive: bars.length - 1 - endIdx <= 3,
    bias: priorTrend,
  }
}

/** Detect head and shoulders: left shoulder, head (higher), right shoulder (lower). */
function detectHeadAndShoulders(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003

  const highs = pivots.filter((p) => p.kind === 'high').slice(-5)
  if (highs.length < 3) return null

  const leftShoulder = highs[0]
  const head = highs[1]
  const rightShoulder = highs[2]

  if (!leftShoulder || !head || !rightShoulder) return null

  // Validate pattern
  if (head.price <= leftShoulder.price * 1.01 || head.price <= rightShoulder.price * 1.01) {
    return null
  }

  const shoulderRatio = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price
  if (shoulderRatio > tolerance * 2) return null

  // Find neckline (support formed between shoulders)
  const betweenLS_H = pivots.filter((p) => p.kind === 'low' && p.barIndex > leftShoulder.barIndex && p.barIndex < head.barIndex)
  const betweenH_RS = pivots.filter((p) => p.kind === 'low' && p.barIndex > head.barIndex && p.barIndex < rightShoulder.barIndex)

  const neckline1 = betweenLS_H[betweenLS_H.length - 1]
  const neckline2 = betweenH_RS[0]

  if (!neckline1 || !neckline2) return null

  const necklineAvg = (neckline1.price + neckline2.price) / 2

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: leftShoulder.barIndex,
    endBarIndex: rightShoulder.barIndex,
    entryPrice: necklineAvg,
    patternHigh: head.price,
    patternLow: Math.min(neckline1.price, neckline2.price),
    patternHeight: head.price - Math.min(neckline1.price, neckline2.price),
    patternWidth: rightShoulder.barIndex - leftShoulder.barIndex + 1,
    heightToATR: atrAtEnd ? (head.price - Math.min(neckline1.price, neckline2.price)) / atrAtEnd : 1,
  }

  const confidence = Math.min(80, 55 + Math.round((1 - shoulderRatio / (tolerance * 2)) * 25))

  const target = necklineAvg - (head.price - necklineAvg)
  const stopLoss = head.price + (atrAtEnd ?? 0.01)
  const riskReward = (necklineAvg - target) / (stopLoss - necklineAvg)

  return {
    pattern: 'head-shoulders',
    category: PATTERN_CATEGORIES['head-shoulders'],
    geometry,
    entry: necklineAvg,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(80, confidence + 10),
    confidence,
    isActive: bars.length - 1 - rightShoulder.barIndex <= 5,
    bias: 'bearish',
  }
}

/** Detect inverse head and shoulders: left shoulder, head (lower), right shoulder (higher). */
function detectInverseHeadAndShoulders(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003

  const lows = pivots.filter((p) => p.kind === 'low').slice(-5)
  if (lows.length < 3) return null

  const leftShoulder = lows[0]
  const head = lows[1]
  const rightShoulder = lows[2]

  if (!leftShoulder || !head || !rightShoulder) return null

  if (head.price >= leftShoulder.price * 0.99 || head.price >= rightShoulder.price * 0.99) {
    return null
  }

  const shoulderRatio = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price
  if (shoulderRatio > tolerance * 2) return null

  const betweenLS_H = pivots.filter((p) => p.kind === 'high' && p.barIndex > leftShoulder.barIndex && p.barIndex < head.barIndex)
  const betweenH_RS = pivots.filter((p) => p.kind === 'high' && p.barIndex > head.barIndex && p.barIndex < rightShoulder.barIndex)

  const neckline1 = betweenLS_H[betweenLS_H.length - 1]
  const neckline2 = betweenH_RS[0]

  if (!neckline1 || !neckline2) return null

  const necklineAvg = (neckline1.price + neckline2.price) / 2

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: leftShoulder.barIndex,
    endBarIndex: rightShoulder.barIndex,
    entryPrice: necklineAvg,
    patternHigh: Math.max(neckline1.price, neckline2.price),
    patternLow: head.price,
    patternHeight: Math.max(neckline1.price, neckline2.price) - head.price,
    patternWidth: rightShoulder.barIndex - leftShoulder.barIndex + 1,
    heightToATR: atrAtEnd ? (Math.max(neckline1.price, neckline2.price) - head.price) / atrAtEnd : 1,
  }

  const confidence = Math.min(80, 55 + Math.round((1 - shoulderRatio / (tolerance * 2)) * 25))

  const target = necklineAvg + (necklineAvg - head.price)
  const stopLoss = head.price - (atrAtEnd ?? 0.01)
  const riskReward = (target - necklineAvg) / (necklineAvg - stopLoss)

  return {
    pattern: 'inverse-head-shoulders',
    category: PATTERN_CATEGORIES['inverse-head-shoulders'],
    geometry,
    entry: necklineAvg,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(80, confidence + 10),
    confidence,
    isActive: bars.length - 1 - rightShoulder.barIndex <= 5,
    bias: 'bullish',
  }
}

/** Detect cup and handle: U-shaped cup followed by flag/rectangle handle. */
function detectCupAndHandle(
  bars: OHLCVBar[],
  pivots: ReturnType<typeof findPivots>,
  opts: PatternDetectionOptions
): PatternDetectionResult | null {
  const tolerance = opts.priceTolerance ?? 0.003

  const highs = pivots.filter((p) => p.kind === 'high')
  const lows = pivots.filter((p) => p.kind === 'low')

  if (highs.length < 3 || lows.length < 2) return null

  // Find cup: three recent highs with middle low
  const recentHighs = highs.slice(-5)
  const recentLows = lows.slice(-5)

  const cupLeft = recentHighs[0]
  const cupBottom = recentLows[0]
  const cupRight = recentHighs[1]
  const handleHigh = recentHighs[2]

  if (!cupLeft || !cupBottom || !cupRight || !handleHigh) return null

  // Cup validation
  const cupLeftRightRatio = Math.abs(cupLeft.price - cupRight.price) / cupLeft.price
  if (cupLeftRightRatio > tolerance * 2 || cupBottom.price >= cupLeft.price * 0.95) {
    return null
  }

  const handleWidth = handleHigh.barIndex - cupRight.barIndex + 1
  if (handleWidth < 3 || handleWidth > 15) return null

  const atrAtEnd = getLastATR(bars)

  const geometry: PatternGeometry = {
    startBarIndex: cupLeft.barIndex,
    endBarIndex: handleHigh.barIndex,
    entryPrice: (cupLeft.price + cupRight.price) / 2,
    patternHigh: Math.max(cupLeft.price, cupRight.price),
    patternLow: cupBottom.price,
    patternHeight: Math.max(cupLeft.price, cupRight.price) - cupBottom.price,
    patternWidth: handleHigh.barIndex - cupLeft.barIndex + 1,
    heightToATR: atrAtEnd ? (Math.max(cupLeft.price, cupRight.price) - cupBottom.price) / atrAtEnd : 1,
  }

  const { confidence } = scorePattern(bars, geometry, undefined, undefined, atrAtEnd)

  const rimPrice = (cupLeft.price + cupRight.price) / 2
  const cupHeight = geometry.patternHeight
  const target = rimPrice + cupHeight

  const stopLoss = cupBottom.price - (atrAtEnd ?? 0.01)
  const riskReward = (target - rimPrice) / (rimPrice - stopLoss)

  return {
    pattern: 'cup-handle',
    category: PATTERN_CATEGORIES['cup-handle'],
    geometry,
    entry: rimPrice,
    stopLoss,
    target,
    riskReward: Math.max(0.1, riskReward),
    probability: Math.min(80, confidence + 15),
    confidence,
    isActive: bars.length - 1 - handleHigh.barIndex <= 3,
    bias: 'bullish',
  }
}

// ─── Pattern Engine ────────────────────────────────────────────────────────────

/**
 * Main pattern detection engine.
 * Scans bars for all pattern types and returns ranked results.
 */
export function detectChartPatterns(
  bars: OHLCVBar[],
  opts: PatternDetectionOptions = {}
): PatternEngineResults {
  if (bars.length < 20) {
    return {
      patterns: [],
      summary: { totalPatterns: 0, activePatterns: 0, avgConfidence: 0 },
    }
  }

  const lookback = opts.recentLookback ?? 200
  const startIdx = Math.max(0, bars.length - lookback)
  const recentBars = bars.slice(startIdx)

  const pivots = findPivots(recentBars, 2, 2)

  // Adjust pivot indices to full array
  for (const p of pivots) {
    p.barIndex += startIdx
  }

  const detectors = [
    () => detectBullFlag(bars, pivots, opts),
    () => detectBearFlag(bars, pivots, opts),
    () => detectAscendingTriangle(bars, pivots, opts),
    () => detectDescendingTriangle(bars, pivots, opts),
    () => detectSymmetricTriangle(bars, pivots, opts),
    () => detectDoubleTop(bars, pivots, opts),
    () => detectDoubleBottom(bars, pivots, opts),
    () => detectRectangle(bars, pivots, opts),
    () => detectChannel(bars, pivots, opts),
    () => detectPennant(bars, pivots, opts),
    () => detectHeadAndShoulders(bars, pivots, opts),
    () => detectInverseHeadAndShoulders(bars, pivots, opts),
    () => detectCupAndHandle(bars, pivots, opts),
  ]

  const detected: PatternDetectionResult[] = []

  for (const detector of detectors) {
    const result = detector()
    if (result) {
      detected.push(result)
    }
  }

  // Sort by confidence (high to low)
  detected.sort((a, b) => b.confidence - a.confidence)

  // Find active, reversal, continuation
  const activePattern = detected.find((p) => p.isActive)
  const reversalPattern = detected.find((p) => p.category === 'reversal')
  const continuationPattern = detected.find((p) => p.category === 'continuation')

  const avgConfidence = detected.length > 0 ? Math.round(detected.reduce((sum, p) => sum + p.confidence, 0) / detected.length) : 0

  return {
    patterns: detected,
    activePattern,
    reversalPattern,
    continuationPattern,
    summary: {
      totalPatterns: detected.length,
      activePatterns: detected.filter((p) => p.isActive).length,
      avgConfidence,
    },
  }
}
