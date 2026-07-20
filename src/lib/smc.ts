/**
 * Smart Money Concepts Detection Engine
 *
 * Detects 11 institutional trading structures:
 *   Liquidity Sweeps, Fair Value Gaps, Order Blocks, Breaker Blocks,
 *   Mitigation Blocks, Structure Shifts, CHoCH, Premium/Discount, Equal Highs/Lows
 */

import type { OHLCVBar } from '@/types'
import { calcATR, calcSMA } from './indicators'
import { analyzeMarketStructure } from './marketStructure'
import type {
  SMCZoneType,
  SMCZone,
  SMCDetectionOptions,
  SMCDetectionResults,
  LiquiditySweep,
  FairValueGap,
  OrderBlock,
  MarketStructureShift,
  ChangeOfCharacter,
  PremiumZone,
  DiscountZone,
  EqualHighs,
  EqualLows,
} from './smcTypes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get last value from indicator array, handling null. */
function getLastValue(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null) return arr[i]
  }
  return null
}

/** Extract numeric values from IndicatorPoint array. */
function extractIndicatorValues(points: Array<{ value?: number | null } | null>): (number | null)[] {
  return points.map((p) => (p?.value ?? null))
}

/** Find all swing pivots in range. */
function findSwingPivots(
  bars: OHLCVBar[],
  startIdx: number,
  endIdx: number,
  leftBars = 2,
  rightBars = 2
) {
  const pivots: { barIndex: number; price: number; kind: 'high' | 'low' }[] = []

  for (let i = Math.max(startIdx + leftBars, leftBars); i <= Math.min(endIdx - rightBars, bars.length - rightBars - 1); i++) {
    let isHigh = true,
      isLow = true

    for (let j = 1; j <= leftBars; j++) {
      if (bars[i - j].high >= bars[i].high) isHigh = false
      if (bars[i - j].low <= bars[i].low) isLow = false
    }

    for (let j = 1; j <= rightBars; j++) {
      if (bars[i + j].high > bars[i].high) isHigh = false
      if (bars[i + j].low < bars[i].low) isLow = false
    }

    if (isHigh) pivots.push({ barIndex: i, price: bars[i].high, kind: 'high' })
    if (isLow) pivots.push({ barIndex: i, price: bars[i].low, kind: 'low' })
  }

  return pivots
}

// ─── Liquidity Sweeps ───────────────────────────────────────────────────────

function detectLiquiditySweeps(bars: OHLCVBar[], opts: SMCDetectionOptions, atr14: number | null): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = []
  const lookback = opts.lookback ?? 200
  const startIdx = Math.max(0, bars.length - lookback)

  const pivots = findSwingPivots(bars, startIdx, bars.length - 1, 2, 2)
  const recentPivots = pivots.slice(-6)

  // Look for sweeps: price exceeds recent swing then pulls back
  for (let i = 1; i < recentPivots.length; i++) {
    const prevPivot = recentPivots[i - 1]
    const currPivot = recentPivots[i]

    if (!prevPivot || !currPivot) continue

    const prevBar = bars[prevPivot.barIndex]
    const currBar = bars[currPivot.barIndex]

    // Bullish sweep: price goes below recent low then bounces
    if (prevPivot.kind === 'low' && currPivot.barIndex > prevPivot.barIndex) {
      const lowestBar = bars.slice(prevPivot.barIndex, currPivot.barIndex).reduce((min, bar) => 
        bar.low < min.low ? bar : min
      )
      const lowestIdx = prevPivot.barIndex + bars.slice(prevPivot.barIndex, currPivot.barIndex).indexOf(lowestBar)

      if (lowestBar.low < prevPivot.price && currBar.low > prevPivot.price) {
        const sweepDepth = atr14 ? (prevPivot.price - lowestBar.low) / atr14 : 1
        if (sweepDepth > 0.5) {
          sweeps.push({
            type: 'liquidity-sweep',
            sweepKind: 'low',
            sweepPrice: prevPivot.price,
            sweepDepth,
            sweepBarIndex: lowestIdx,
            sweepTime: lowestBar.time,
            liquidityBarIndex: prevPivot.barIndex,
            liquidityTime: prevBar.time,
            pullbackPrice: currPivot.price,
            pullbackBarIndex: currPivot.barIndex,
            pullbackTime: currBar.time,
            bias: 'bullish',
            barsAgo: bars.length - 1 - lowestIdx,
          })
        }
      }
    }

    // Bearish sweep: price exceeds recent high then pulls back
    if (prevPivot.kind === 'high' && currPivot.barIndex > prevPivot.barIndex) {
      const highestBar = bars.slice(prevPivot.barIndex, currPivot.barIndex).reduce((max, bar) =>
        bar.high > max.high ? bar : max
      )
      const highestIdx = prevPivot.barIndex + bars.slice(prevPivot.barIndex, currPivot.barIndex).indexOf(highestBar)

      if (highestBar.high > prevPivot.price && currBar.high < prevPivot.price) {
        const sweepDepth = atr14 ? (highestBar.high - prevPivot.price) / atr14 : 1
        if (sweepDepth > 0.5) {
          sweeps.push({
            type: 'liquidity-sweep',
            sweepKind: 'high',
            sweepPrice: prevPivot.price,
            sweepDepth,
            sweepBarIndex: highestIdx,
            sweepTime: highestBar.time,
            liquidityBarIndex: prevPivot.barIndex,
            liquidityTime: prevBar.time,
            pullbackPrice: currPivot.price,
            pullbackBarIndex: currPivot.barIndex,
            pullbackTime: bars[currPivot.barIndex].time,
            bias: 'bearish',
            barsAgo: bars.length - 1 - highestIdx,
          })
        }
      }
    }
  }

  return sweeps.slice(-10) // Keep most recent 10
}

// ─── Fair Value Gaps ────────────────────────────────────────────────────────

function detectFairValueGaps(bars: OHLCVBar[]): FairValueGap[] {
  const gaps: FairValueGap[] = []

  for (let i = 2; i < bars.length; i++) {
    const prev2 = bars[i - 2]
    const prev1 = bars[i - 1]
    const curr = bars[i]

    // Bullish FVG: gap up (current low > prev high, no overlap)
    if (curr.low > prev1.high && prev1.high > prev2.low) {
      const gapLow = prev1.high
      const gapHigh = curr.low
      const gapSize = gapHigh - gapLow
      const gapSizePercent = (gapSize / gapLow) * 100

      // Check if mitigated (any subsequent candle closes in gap)
      let touches = 0
      for (let j = i + 1; j < Math.min(i + 20, bars.length); j++) {
        if (bars[j].low <= gapHigh && bars[j].high >= gapLow) touches++
      }

      const mitigationStatus: 'unmitigated' | 'partially-mitigated' | 'fully-mitigated' =
        touches === 0 ? 'unmitigated' : touches < 3 ? 'partially-mitigated' : 'fully-mitigated'

      gaps.push({
        type: 'fair-value-gap',
        gapHigh,
        gapLow,
        gapSize,
        gapSizePercent,
        startBarIndex: i - 1,
        endBarIndex: i,
        startTime: prev1.time,
        endTime: curr.time,
        bias: 'bullish',
        mitigationStatus,
        touchesCount: touches,
      })
    }

    // Bearish FVG: gap down (current high < prev low)
    if (curr.high < prev1.low && prev1.low < prev2.high) {
      const gapHigh = prev1.low
      const gapLow = curr.high
      const gapSize = gapHigh - gapLow
      const gapSizePercent = (gapSize / gapLow) * 100

      let touches = 0
      for (let j = i + 1; j < Math.min(i + 20, bars.length); j++) {
        if (bars[j].low <= gapHigh && bars[j].high >= gapLow) touches++
      }

      const mitigationStatus: 'unmitigated' | 'partially-mitigated' | 'fully-mitigated' =
        touches === 0 ? 'unmitigated' : touches < 3 ? 'partially-mitigated' : 'fully-mitigated'

      gaps.push({
        type: 'fair-value-gap',
        gapHigh,
        gapLow,
        gapSize,
        gapSizePercent,
        startBarIndex: i - 1,
        endBarIndex: i,
        startTime: prev1.time,
        endTime: curr.time,
        bias: 'bearish',
        mitigationStatus,
        touchesCount: touches,
      })
    }
  }

  return gaps.slice(-20)
}

// ─── Order Blocks ───────────────────────────────────────────────────────────

function detectOrderBlocks(
  bars: OHLCVBar[],
  opts: SMCDetectionOptions,
  atr14: number | null
): OrderBlock[] {
  const blocks: OrderBlock[] = []
  const minWidth = opts.minOBWidth ?? 3
  const minBodyPercent = opts.minBodyPercent ?? 0.3
  const lookback = opts.lookback ?? 200
  const startIdx = Math.max(0, bars.length - lookback)

  const pivots = findSwingPivots(bars, startIdx, bars.length - 1, 2, 2)

  // After each swing, look for consolidation blocks
  for (let i = 0; i < pivots.length - 1; i++) {
    const pivot = pivots[i]
    const nextPivot = pivots[i + 1]

    if (!pivot || !nextPivot) continue

    const blockStart = pivot.barIndex + 1
    const blockEnd = nextPivot.barIndex - 1

    if (blockEnd - blockStart + 1 < minWidth) continue

    const blockBars = bars.slice(blockStart, blockEnd + 1)
    const blockHigh = Math.max(...blockBars.map((b) => b.high))
    const blockLow = Math.min(...blockBars.map((b) => b.low))

    // Calculate body strength
    let totalBody = 0
    let fullRangeSum = 0
    for (const bar of blockBars) {
      const body = Math.abs(bar.close - bar.open)
      const range = bar.high - bar.low
      totalBody += body
      fullRangeSum += range
    }

    const avgBodyPercent = (totalBody / fullRangeSum) * 100
    if (avgBodyPercent < minBodyPercent) continue

    // Determine if bullish (support) or bearish (resistance) order block
    const bias = pivot.kind === 'low' ? 'bullish' : 'bearish'

    // Check if mitigated
    let mitigated = false
    let mitigationBarIdx: number | undefined
    let mitigationTime: number | undefined

    for (let j = blockEnd + 1; j < bars.length; j++) {
      if ((bias === 'bullish' && bars[j].low < blockLow) || 
          (bias === 'bearish' && bars[j].high > blockHigh)) {
        mitigated = true
        mitigationBarIdx = j
        mitigationTime = bars[j].time
        break
      }
    }

    const bodyStrengthATR = atr14 ? (totalBody / blockBars.length) / atr14 : 1

    blocks.push({
      type: 'order-block',
      blockHigh,
      blockLow,
      blockHeight: blockHigh - blockLow,
      startBarIndex: blockStart,
      endBarIndex: blockEnd,
      startTime: bars[blockStart].time,
      endTime: bars[blockEnd].time,
      blockWidth: blockEnd - blockStart + 1,
      bias,
      volumeStrength: 0.7, // Placeholder
      bodyStrengthATR,
      mitigationStatus: mitigated ? 'fully-mitigated' : 'unmitigated',
      mitigationBarIndex: mitigationBarIdx,
      mitigationTime: mitigationTime,
    })
  }

  return blocks.slice(-15)
}

// ─── Breaker Blocks ─────────────────────────────────────────────────────────

function detectBreakerBlocks(
  bars: OHLCVBar[],
  opts: SMCDetectionOptions,
  atr14: number | null
): OrderBlock[] {
  const blocks: OrderBlock[] = []
  const lookback = opts.lookback ?? 200
  const startIdx = Math.max(0, bars.length - lookback)

  const pivots = findSwingPivots(bars, startIdx, bars.length - 1, 2, 2)
  if (pivots.length < 3) return []

  // Breaker block = consolidated block that breaks prior structure
  for (let i = 1; i < pivots.length - 1; i++) {
    const prevPivot = pivots[i - 1]
    const currPivot = pivots[i]
    const nextPivot = pivots[i + 1]

    if (!prevPivot || !currPivot || !nextPivot) continue

    // If current is higher low after lower high, then next breaks it = breaker
    if (prevPivot.kind === 'high' && currPivot.kind === 'low' && nextPivot.kind === 'high') {
      if (currPivot.price > prevPivot.price && nextPivot.price > prevPivot.price) {
        // This is a breaker block (bullish)
        const blockBars = bars.slice(currPivot.barIndex, nextPivot.barIndex + 1)
        const blockHigh = Math.max(...blockBars.map((b) => b.high))
        const blockLow = Math.min(...blockBars.map((b) => b.low))

        blocks.push({
          type: 'breaker-block',
          blockHigh,
          blockLow,
          blockHeight: blockHigh - blockLow,
          startBarIndex: currPivot.barIndex,
          endBarIndex: nextPivot.barIndex,
          startTime: bars[currPivot.barIndex].time,
          endTime: bars[nextPivot.barIndex].time,
          blockWidth: nextPivot.barIndex - currPivot.barIndex + 1,
          bias: 'bullish',
          volumeStrength: 0.75,
          bodyStrengthATR: atr14 ? (blockHigh - blockLow) / (atr14 * 2) : 1,
          mitigationStatus: 'unmitigated',
        })
      }
    }

    // Bearish breaker
    if (prevPivot.kind === 'low' && currPivot.kind === 'high' && nextPivot.kind === 'low') {
      if (currPivot.price < prevPivot.price && nextPivot.price < prevPivot.price) {
        const blockBars = bars.slice(currPivot.barIndex, nextPivot.barIndex + 1)
        const blockHigh = Math.max(...blockBars.map((b) => b.high))
        const blockLow = Math.min(...blockBars.map((b) => b.low))

        blocks.push({
          type: 'breaker-block',
          blockHigh,
          blockLow,
          blockHeight: blockHigh - blockLow,
          startBarIndex: currPivot.barIndex,
          endBarIndex: nextPivot.barIndex,
          startTime: bars[currPivot.barIndex].time,
          endTime: bars[nextPivot.barIndex].time,
          blockWidth: nextPivot.barIndex - currPivot.barIndex + 1,
          bias: 'bearish',
          volumeStrength: 0.75,
          bodyStrengthATR: atr14 ? (blockHigh - blockLow) / (atr14 * 2) : 1,
          mitigationStatus: 'unmitigated',
        })
      }
    }
  }

  return blocks.slice(-10)
}

// ─── Mitigation Blocks ──────────────────────────────────────────────────────

function detectMitigationBlocks(
  bars: OHLCVBar[],
  opts: SMCDetectionOptions,
  atr14: number | null
): OrderBlock[] {
  const blocks: OrderBlock[] = []
  const lookback = opts.lookback ?? 200
  const startIdx = Math.max(0, bars.length - lookback)

  const pivots = findSwingPivots(bars, startIdx, bars.length - 1, 2, 2)
  if (pivots.length < 4) return []

  // Mitigation block = block at prior support/resistance that gets re-tested
  for (let i = 0; i < pivots.length - 2; i++) {
    const pivot1 = pivots[i]
    const pivot2 = pivots[i + 1]
    const pivot3 = pivots[i + 2]

    if (!pivot1 || !pivot2 || !pivot3) continue

    // If price breaks and comes back to same level = mitigation
    if (pivot1.kind === pivot3.kind && Math.abs(pivot1.price - pivot3.price) / pivot1.price < 0.003) {
      const blockBars = bars.slice(pivot2.barIndex, pivot3.barIndex + 1)
      if (blockBars.length < 2) continue

      const blockHigh = Math.max(...blockBars.map((b) => b.high))
      const blockLow = Math.min(...blockBars.map((b) => b.low))

      blocks.push({
        type: 'mitigation-block',
        blockHigh,
        blockLow,
        blockHeight: blockHigh - blockLow,
        startBarIndex: pivot2.barIndex,
        endBarIndex: pivot3.barIndex,
        startTime: bars[pivot2.barIndex].time,
        endTime: bars[pivot3.barIndex].time,
        blockWidth: pivot3.barIndex - pivot2.barIndex + 1,
        bias: pivot1.kind === 'low' ? 'bullish' : 'bearish',
        volumeStrength: 0.65,
        bodyStrengthATR: atr14 ? (blockHigh - blockLow) / (atr14 * 2) : 1,
        mitigationStatus: 'partially-mitigated',
      })
    }
  }

  return blocks.slice(-10)
}

// ─── Premium / Discount Zones ──────────────────────────────────────────────

function detectPremiumDiscountZones(bars: OHLCVBar[], opts: SMCDetectionOptions): (PremiumZone | DiscountZone)[] {
  const zones: (PremiumZone | DiscountZone)[] = []
  const smaPeriods = opts.smaPeriods ?? [50, 200]

  for (const period of smaPeriods) {
    const smaIndicators = calcSMA(bars, period)
    const smaValues = extractIndicatorValues(smaIndicators)
    const referenceType = period === 50 ? '50-sma' : period === 200 ? '200-sma' : 'other'

    let inPremium = false
    let premiumStart = 0
    let discountStart = 0
    let inDiscount = false

    for (let i = 0; i < bars.length; i++) {
      const smaVal = smaValues[i]
      if (smaVal === null) continue

      const isAbove = bars[i].close > smaVal
      const isBelow = bars[i].close < smaVal

      // Premium zone: price above SMA
      if (isAbove && !inPremium) {
        inPremium = true
        premiumStart = i
        inDiscount = false
      } else if (!isAbove && inPremium) {
        // Exit premium
        zones.push({
          type: 'premium-zone',
          referenceLevel: smaVal,
          referenceType,
          zoneHigh: Math.max(...bars.slice(premiumStart, i).map((b) => b.high)),
          zoneLow: smaVal,
          zoneHeight: Math.max(...bars.slice(premiumStart, i).map((b) => b.high)) - smaVal,
          startBarIndex: premiumStart,
          endBarIndex: i - 1,
          startTime: bars[premiumStart].time,
          endTime: bars[i - 1].time,
          isActive: false,
          durationBars: i - premiumStart,
        })
        inPremium = false
      }

      // Discount zone: price below SMA
      if (isBelow && !inDiscount) {
        inDiscount = true
        discountStart = i
        inPremium = false
      } else if (!isBelow && inDiscount) {
        zones.push({
          type: 'discount-zone',
          referenceLevel: smaVal,
          referenceType,
          zoneHigh: smaVal,
          zoneLow: Math.min(...bars.slice(discountStart, i).map((b) => b.low)),
          zoneHeight: smaVal - Math.min(...bars.slice(discountStart, i).map((b) => b.low)),
          startBarIndex: discountStart,
          endBarIndex: i - 1,
          startTime: bars[discountStart].time,
          endTime: bars[i - 1].time,
          isActive: false,
          durationBars: i - discountStart,
        })
        inDiscount = false
      }
    }

    // Handle active zones at end
    if (inPremium) {
      const smaVal = smaValues[bars.length - 1]
      if (smaVal !== null) {
        zones.push({
          type: 'premium-zone',
          referenceLevel: smaVal,
          referenceType,
          zoneHigh: Math.max(...bars.slice(premiumStart).map((b) => b.high)),
          zoneLow: smaVal,
          zoneHeight: Math.max(...bars.slice(premiumStart).map((b) => b.high)) - smaVal,
          startBarIndex: premiumStart,
          startTime: bars[premiumStart].time,
          isActive: true,
          durationBars: bars.length - premiumStart,
        })
      }
    }

    if (inDiscount) {
      const smaVal = smaValues[bars.length - 1]
      if (smaVal !== null) {
        zones.push({
          type: 'discount-zone',
          referenceLevel: smaVal,
          referenceType,
          zoneHigh: smaVal,
          zoneLow: Math.min(...bars.slice(discountStart).map((b) => b.low)),
          zoneHeight: smaVal - Math.min(...bars.slice(discountStart).map((b) => b.low)),
          startBarIndex: discountStart,
          startTime: bars[discountStart].time,
          isActive: true,
          durationBars: bars.length - discountStart,
        })
      }
    }
  }

  return zones.slice(-20)
}

// ─── Equal Highs / Lows ─────────────────────────────────────────────────────

function detectEqualHighsAndLows(bars: OHLCVBar[], opts: SMCDetectionOptions): (EqualHighs | EqualLows)[] {
  const zones: (EqualHighs | EqualLows)[] = []
  const tolerance = opts.priceTolerance ?? 0.003
  const minTouches = opts.minEqualTouches ?? 2
  const lookback = opts.lookback ?? 200
  const startIdx = Math.max(0, bars.length - lookback)

  const pivots = findSwingPivots(bars, startIdx, bars.length - 1, 2, 2)

  const highs = pivots.filter((p) => p.kind === 'high')
  const lows = pivots.filter((p) => p.kind === 'low')

  // Find equal highs
  for (let i = 0; i < highs.length; i++) {
    const group = [highs[i]]

    for (let j = i + 1; j < highs.length; j++) {
      const priceDiff = Math.abs(highs[i].price - highs[j].price)
      if (priceDiff / highs[i].price < tolerance) {
        group.push(highs[j])
      }
    }

    if (group.length >= minTouches) {
      zones.push({
        type: 'equal-highs',
        levelPrice: group.reduce((sum, p) => sum + p.price, 0) / group.length,
        barIndices: group.map((p) => p.barIndex),
        times: group.map((p) => bars[p.barIndex].time),
        touchCount: group.length,
        tolerance,
        bias: 'bearish',
        firstBarIndex: group[0].barIndex,
        lastBarIndex: group[group.length - 1].barIndex,
        firstTime: bars[group[0].barIndex].time,
        lastTime: bars[group[group.length - 1].barIndex].time,
      })
    }
  }

  // Find equal lows
  for (let i = 0; i < lows.length; i++) {
    const group = [lows[i]]

    for (let j = i + 1; j < lows.length; j++) {
      const priceDiff = Math.abs(lows[i].price - lows[j].price)
      if (priceDiff / lows[i].price < tolerance) {
        group.push(lows[j])
      }
    }

    if (group.length >= minTouches) {
      zones.push({
        type: 'equal-lows',
        levelPrice: group.reduce((sum, p) => sum + p.price, 0) / group.length,
        barIndices: group.map((p) => p.barIndex),
        times: group.map((p) => bars[p.barIndex].time),
        touchCount: group.length,
        tolerance,
        bias: 'bullish',
        firstBarIndex: group[0].barIndex,
        lastBarIndex: group[group.length - 1].barIndex,
        firstTime: bars[group[0].barIndex].time,
        lastTime: bars[group[group.length - 1].barIndex].time,
      })
    }
  }

  return zones
}

// ─── Market Structure Shift & CHoCH ─────────────────────────────────────────

function detectStructureShiftsAndCHoCH(
  bars: OHLCVBar[]
): { shifts: MarketStructureShift[]; chochs: ChangeOfCharacter[] } {
  const shifts: MarketStructureShift[] = []
  const chochs: ChangeOfCharacter[] = []

  if (bars.length < 50) {
    return { shifts, chochs }
  }

  // Use existing market structure analyzer
  const msResult = analyzeMarketStructure(bars)

  // Detect structure breaks
  if (msResult.structureBreaks && msResult.structureBreaks.length > 0) {
    for (const brk of msResult.structureBreaks) {
      if (brk.type === 'BOS') {
        shifts.push({
          type: 'structure-shift',
          shiftBarIndex: brk.barIndex,
          shiftTime: brk.time,
          priorStructure: brk.direction === 'bullish' ? 'bear' : 'bull',
          newStructure: brk.direction === 'bullish' ? 'bull' : 'bear',
          pivotPrice: brk.price,
          shiftStrength: 65,
        })
      }

      if (brk.type === 'CHoCH') {
        chochs.push({
          type: 'change-of-character',
          chochBarIndex: brk.barIndex,
          chochTime: brk.time,
          priorCharacter: 'imbalanced',
          newCharacter: 'balanced',
          bias: brk.direction === 'bullish' ? 'bullish' : 'bearish',
          strength: 70,
        })
      }
    }
  }

  return { shifts, chochs }
}

// ─── Main Engine ───────────────────────────────────────────────────────────

/**
 * Main SMC detection engine.
 * Scans for all 11 smart money concepts and returns aggregated results.
 */
export function detectSMCZones(bars: OHLCVBar[], opts: SMCDetectionOptions = {}): SMCDetectionResults {
  if (bars.length < 20) {
    return {
      zones: [],
      byType: {},
      activeZones: [],
      unmitigatedZones: [],
      summary: { totalZones: 0, activeZonesCount: 0, unmitigatedCount: 0, bullishZones: 0, bearishZones: 0 },
    }
  }

  const atr14 = calcATR(bars, 14)
  const atrValues = extractIndicatorValues(atr14)
  const atrAtEnd = getLastValue(atrValues)

  // Detect all zone types
  const liquiditySweeps = detectLiquiditySweeps(bars, opts, atrAtEnd)
  const fvgs = detectFairValueGaps(bars)
  const orderBlocks = detectOrderBlocks(bars, opts, atrAtEnd)
  const breakerBlocks = detectBreakerBlocks(bars, opts, atrAtEnd)
  const mitigationBlocks = detectMitigationBlocks(bars, opts, atrAtEnd)
  const premiumDiscount = detectPremiumDiscountZones(bars, opts)
  const equalsHighsLows = detectEqualHighsAndLows(bars, opts)

  const { shifts, chochs } = detectStructureShiftsAndCHoCH(bars)

  // Combine all zones
  const allZones: SMCZone[] = [
    ...liquiditySweeps,
    ...fvgs,
    ...orderBlocks,
    ...breakerBlocks,
    ...mitigationBlocks,
    ...premiumDiscount,
    ...equalsHighsLows,
    ...shifts,
    ...chochs,
  ]

  // Group by type
  const byType: Partial<Record<SMCZoneType, SMCZone[]>> = {}
  for (const zone of allZones) {
    if (!byType[zone.type]) {
      byType[zone.type] = []
    }
    byType[zone.type]!.push(zone)
  }

  // Active zones (recent)
  const activeZones = allZones.filter((z) => {
    if ('barsAgo' in z) return z.barsAgo <= 10
    if ('isActive' in z) return z.isActive === true
    if ('endBarIndex' in z) return bars.length - 1 - z.endBarIndex <= 5
    return true
  })

  // Unmitigated zones
  const unmitigatedZones = allZones.filter((z) => {
    if ('mitigationStatus' in z) return z.mitigationStatus === 'unmitigated'
    return false
  })

  // Count bias
  let bullishCount = 0,
    bearishCount = 0
  for (const z of allZones) {
    if ('bias' in z) {
      if (z.bias === 'bullish') bullishCount++
      else if (z.bias === 'bearish') bearishCount++
    }
  }

  return {
    zones: allZones,
    byType,
    activeZones,
    unmitigatedZones,
    summary: {
      totalZones: allZones.length,
      activeZonesCount: activeZones.length,
      unmitigatedCount: unmitigatedZones.length,
      bullishZones: bullishCount,
      bearishZones: bearishCount,
    },
  }
}
