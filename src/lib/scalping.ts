/**
 * Scalping Strategy Analysis Engine
 *
 * Multi-factor signal detection combining:
 * EMA alignment, VWAP confirmation, volume spikes,
 * ATR filter, trend & momentum filters, price structure
 */

import type { OHLCVBar } from '@/types'
import { calcATR, calcSMA, calcRSI, calcMACD } from './indicators'
import { analyzeMarketStructure } from './marketStructure'
import type {
  ScalpingSignal,
  TrendDirection,
  EMAAlignment,
  VWAPAnalysis,
  VolumeAnalysis,
  ATRFilter,
  TrendFilter,
  MomentumFilter,
  PriceStructure,
  SignalComponent,
  ScalpingSignalResult,
  ScalpingEngineOptions,
  ScalpingEngineResults,
} from './scalpingTypes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get last value from indicator array. */
function getLastValue(arr: Array<{ value?: number | null } | null>): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const val = arr[i]?.value
    if (val != null) return val
  }
  return null
}

/** Get last numeric value. */
function getLastNumeric(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return arr[i]
  }
  return null
}

/** Calculate VWAP (Volume-Weighted Average Price). */
function calcVWAP(bars: OHLCVBar[], lookback: number = 100): number | null {
  const start = Math.max(0, bars.length - lookback)
  let cumTPV = 0 // cumulative typical price * volume
  let cumVolume = 0

  for (let i = start; i < bars.length; i++) {
    const bar = bars[i]
    const typicalPrice = (bar.high + bar.low + bar.close) / 3
    cumTPV += typicalPrice * bar.volume
    cumVolume += bar.volume
  }

  return cumVolume > 0 ? cumTPV / cumVolume : null
}

/** Analyze EMA alignment. */
function analyzeEMAAlignment(bars: OHLCVBar[], periods: number[] = [9, 21, 50]): EMAAlignment {
  const emas: Record<number, number | null> = {}
  for (const period of periods) {
    const sma = calcSMA(bars, period)
    emas[period] = getLastValue(sma)
  }

  const ema9 = emas[9] ?? 0
  const ema21 = emas[21] ?? 0
  const ema50 = emas[50] ?? 0

  const bullishAlign = ema9 > ema21 && ema21 > ema50
  const bearishAlign = ema9 < ema21 && ema21 < ema50

  let direction: TrendDirection = 'neutral'
  if (bullishAlign) direction = 'bullish'
  if (bearishAlign) direction = 'bearish'

  // Alignment strength: measure how well separated the EMAs are
  const separationRatio = bullishAlign
    ? (ema9 - ema50) / ema50
    : bearishAlign
      ? (ema50 - ema9) / ema50
      : 0

  const alignmentStrength = Math.min(100, separationRatio * 1000)

  return {
    ema9,
    ema21,
    ema50,
    aligned: bullishAlign || bearishAlign,
    direction,
    alignmentStrength,
  }
}

/** Analyze VWAP confirmation. */
function analyzeVWAP(bars: OHLCVBar[], lookback: number = 100): VWAPAnalysis {
  const vwap = calcVWAP(bars, lookback) ?? bars[bars.length - 1].close
  const currentPrice = bars[bars.length - 1].close
  const atr14 = getLastNumeric(
    calcATR(bars, 14).map((p) => (p?.value ?? null) as number | null)
  ) ?? 1

  const priceVsVWAP: 'above' | 'below' | 'at' =
    currentPrice > vwap + atr14 * 0.1
      ? 'above'
      : currentPrice < vwap - atr14 * 0.1
        ? 'below'
        : 'at'

  const distance = Math.abs(currentPrice - vwap) / atr14

  // Strength: how far from VWAP (stronger if farther)
  const strength = Math.min(100, distance * 20)

  return {
    vwap,
    priceVsVWAP,
    distance,
    strength,
  }
}

/** Analyze volume spike. */
function analyzeVolumeSpike(bars: OHLCVBar[], lookback: number = 20): VolumeAnalysis {
  const start = Math.max(0, bars.length - lookback - 1)
  const end = Math.max(1, bars.length - 1)
  const recentBars = bars.slice(start, end)

  let totalVolume = 0
  for (const bar of recentBars) {
    totalVolume += bar.volume
  }
  const averageVolume = recentBars.length > 0 ? totalVolume / recentBars.length : 1

  const currentVolume = bars[bars.length - 1].volume
  const spikeRatio = averageVolume > 0 ? currentVolume / averageVolume : 1
  const isSpike = spikeRatio > 1.5

  const strength = Math.min(100, (spikeRatio - 1) * 50)

  return {
    currentVolume,
    averageVolume,
    spikeRatio,
    isSpike,
    strength,
  }
}

/** Analyze ATR for volatility. */
function analyzeATRFilter(
  bars: OHLCVBar[],
  volatilityRange: [number, number] = [20, 80]
): ATRFilter {
  const atr14Values = calcATR(bars, 14)
  const atrArray = atr14Values.map((p) => (p?.value ?? null) as number | null)
  const currentATR = getLastNumeric(atrArray) ?? 1

  // Calculate ATR percentile (how volatile is this relative to history?)
  const atrHistory = atrArray.filter((v): v is number => v != null)
  const sortedATR = [...atrHistory].sort((a, b) => a - b)
  const percentile =
    sortedATR.length > 0
      ? (sortedATR.findIndex((v) => v >= currentATR) / sortedATR.length) * 100
      : 50

  const [minVol, maxVol] = volatilityRange
  const isFiltered = percentile >= minVol && percentile <= maxVol

  let volatility: 'low' | 'medium' | 'high'
  if (percentile < 33) volatility = 'low'
  else if (percentile < 66) volatility = 'medium'
  else volatility = 'high'

  return {
    atr14: currentATR,
    volatility,
    isFiltered,
    volatilityScore: Math.abs(50 - percentile), // 0 if at edges, 50 if at center
  }
}

/** Analyze trend direction. */
function analyzeTrendFilter(bars: OHLCVBar[]): TrendFilter {
  const analysis = analyzeMarketStructure(bars)
  const trend = analysis.trend

  const direction: TrendDirection =
    trend === 'bull' ? 'bullish' : trend === 'bear' ? 'bearish' : 'neutral'

  const strength = analysis.confidence ?? 50

  const ADX = analysis.scores?.adxStrength ?? 0

  return {
    direction,
    strength,
    ADX,
    bias: direction === 'bullish' ? 'bullish' : direction === 'bearish' ? 'bearish' : 'neutral',
  }
}

/** Analyze momentum. */
function analyzeMomentumFilter(bars: OHLCVBar[]): MomentumFilter {
  const rsiArray = calcRSI(bars, 14)
  const rsi = getLastNumeric(rsiArray.map((p) => (p?.value ?? null) as number | null)) ?? 50

  const currentPrice = bars[bars.length - 1].close
  const prevPrice = bars[Math.max(0, bars.length - 5)].close
  const momentum = ((currentPrice - prevPrice) / prevPrice) * 100

  const macdPoints = calcMACD(bars)
  const lastMACD = macdPoints[macdPoints.length - 1] ?? null
  const macdValue = lastMACD?.macd ?? 0
  const macdSignal = lastMACD?.signal ?? 0
  const macdHistogram = lastMACD?.histogram ?? 0

  let direction: TrendDirection = 'neutral'
  if (rsi > 60 && momentum > 0) direction = 'bullish'
  if (rsi < 40 && momentum < 0) direction = 'bearish'

  const strengthBasis = Math.abs(rsi - 50)
  const strength = Math.min(100, strengthBasis * 2)

  return {
    RSI: rsi,
    momentum,
    MACD: {
      value: macdValue,
      signal: macdSignal,
      histogram: macdHistogram,
    },
    direction,
    strength,
  }
}

/** Get price structure levels. */
function getPriceStructure(bars: OHLCVBar[]): PriceStructure {
  const currentPrice = bars[bars.length - 1].close

  // Previous day: assume roughly 1440 min = 1 day in minute bars
  const dayBarCount = Math.min(1440, Math.floor(bars.length / 2))
  const prevDayStart = Math.max(0, bars.length - dayBarCount * 2)
  const prevDayEnd = Math.max(0, bars.length - dayBarCount)

  let prevDayHigh = currentPrice
  let prevDayLow = currentPrice
  let prevDayClose = currentPrice

  for (let i = prevDayStart; i < prevDayEnd; i++) {
    prevDayHigh = Math.max(prevDayHigh, bars[i].high)
    prevDayLow = Math.min(prevDayLow, bars[i].low)
    prevDayClose = bars[i].close
  }

  // Premarket: roughly 9:30 EST open, assume first 30 bars
  const premarketEnd = Math.min(30, bars.length - 1)
  let premarketHigh = currentPrice
  let premarketLow = currentPrice

  for (let i = 0; i < premarketEnd; i++) {
    premarketHigh = Math.max(premarketHigh, bars[i].high)
    premarketLow = Math.min(premarketLow, bars[i].low)
  }

  return {
    prevDayHigh,
    prevDayLow,
    prevDayClose,
    premarketHigh,
    premarketLow,
    currentPrice,
  }
}

/** Generate scalping signal from all components. */
export function analyzeScalpingSignal(
  bars: OHLCVBar[],
  opts: ScalpingEngineOptions = {}
): ScalpingSignalResult {
  const defaults: Required<ScalpingEngineOptions> = {
    lookback: 100,
    emaShorts: [9, 21, 50],
    volumeSpikeThreshold: 1.5,
    atrMultiplier: 1.5,
    targetMultiplier: 3,
    minConfidence: 65,
    volatilityRange: [20, 80],
    ADXThreshold: 25,
    RSIOverbought: 70,
    RSIOversold: 30,
    usePremarket: true,
  }
  const config = { ...defaults, ...opts }

  const barIndex = bars.length - 1
  const currentPrice = bars[barIndex].close
  const timestamp = bars[barIndex].time

  // Analyze all components
  const emaAlignment = analyzeEMAAlignment(bars, config.emaShorts)
  const vwapAnalysis = analyzeVWAP(bars, config.lookback)
  const volumeAnalysis = analyzeVolumeSpike(bars, 20)
  const atrFilter = analyzeATRFilter(bars, config.volatilityRange)
  const trendFilter = analyzeTrendFilter(bars)
  const momentumFilter = analyzeMomentumFilter(bars)
  const priceStructure = getPriceStructure(bars)

  // Score each component
  const componentScores = {
    emaAlignment: emaAlignment.aligned ? emaAlignment.alignmentStrength : 0,
    vwapConfirmation:
      vwapAnalysis.priceVsVWAP !== 'at'
        ? Math.min(100, (vwapAnalysis.distance / 2) * 100)
        : 30,
    volumeSpike: volumeAnalysis.isSpike ? volumeAnalysis.strength : Math.max(0, volumeAnalysis.strength - 30),
    atrFilter: atrFilter.isFiltered ? atrFilter.volatilityScore : 0,
    trendFilter: trendFilter.strength,
    momentumFilter: momentumFilter.strength,
    priceStructure: 50, // neutral baseline for structure
  }

  // Check structure: price relative to levels
  if (config.usePremarket) {
    // Breakout above premarket high = bullish signal
    if (currentPrice > priceStructure.premarketHigh) componentScores.priceStructure += 25
    // Breakdown below premarket low = bearish signal
    if (currentPrice < priceStructure.premarketLow) componentScores.priceStructure -= 25
  }

  // Bullish conditions
  let bullishScore = 0
  let bullishCount = 0

  if (emaAlignment.direction === 'bullish') {
    bullishScore += componentScores.emaAlignment
    bullishCount++
  }
  if (vwapAnalysis.priceVsVWAP === 'above') {
    bullishScore += componentScores.vwapConfirmation
    bullishCount++
  }
  if (volumeAnalysis.isSpike && currentPrice > bars[Math.max(0, barIndex - 1)].close) {
    bullishScore += componentScores.volumeSpike
    bullishCount++
  }
  if (atrFilter.isFiltered) {
    bullishScore += componentScores.atrFilter * 0.5
    bullishCount += 0.5
  }
  if (trendFilter.bias === 'bullish') {
    bullishScore += componentScores.trendFilter
    bullishCount++
  }
  if (momentumFilter.direction === 'bullish' && momentumFilter.RSI > config.RSIOversold) {
    bullishScore += componentScores.momentumFilter
    bullishCount++
  }
  if (componentScores.priceStructure > 50) {
    bullishScore += componentScores.priceStructure - 50
    bullishCount += 0.5
  }

  // Bearish conditions
  let bearishScore = 0
  let bearishCount = 0

  if (emaAlignment.direction === 'bearish') {
    bearishScore += componentScores.emaAlignment
    bearishCount++
  }
  if (vwapAnalysis.priceVsVWAP === 'below') {
    bearishScore += componentScores.vwapConfirmation
    bearishCount++
  }
  if (volumeAnalysis.isSpike && currentPrice < bars[Math.max(0, barIndex - 1)].close) {
    bearishScore += componentScores.volumeSpike
    bearishCount++
  }
  if (atrFilter.isFiltered) {
    bearishScore += componentScores.atrFilter * 0.5
    bearishCount += 0.5
  }
  if (trendFilter.bias === 'bearish') {
    bearishScore += componentScores.trendFilter
    bearishCount++
  }
  if (momentumFilter.direction === 'bearish' && momentumFilter.RSI < config.RSIOverbought) {
    bearishScore += componentScores.momentumFilter
    bearishCount++
  }
  if (componentScores.priceStructure < 50) {
    bearishScore += 50 - componentScores.priceStructure
    bearishCount += 0.5
  }

  // Normalize scores
  const bullish = bullishCount > 0 ? bullishScore / bullishCount : 0
  const bearish = bearishCount > 0 ? bearishScore / bearishCount : 0
  const neutral = Math.max(0, 100 - Math.max(bullish, bearish))

  // Determine signal
  let signal: ScalpingSignal = 'WAIT'
  let confidence = 0

  if (bullish > bearish && bullish >= config.minConfidence) {
    signal = 'BUY_CALL'
    confidence = bullish
  } else if (bearish > bullish && bearish >= config.minConfidence) {
    signal = 'BUY_PUT'
    confidence = bearish
  }

  // Calculate entry, stop, target
  const atr = atrFilter.atr14
  const stopLoss =
    signal === 'BUY_CALL'
      ? currentPrice - atr * config.atrMultiplier
      : signal === 'BUY_PUT'
        ? currentPrice + atr * config.atrMultiplier
        : currentPrice

  const targetPrice =
    signal === 'BUY_CALL'
      ? currentPrice + atr * config.atrMultiplier * config.targetMultiplier
      : signal === 'BUY_PUT'
        ? currentPrice - atr * config.atrMultiplier * config.targetMultiplier
        : currentPrice

  const riskReward =
    signal === 'WAIT'
      ? 0
      : Math.abs(targetPrice - currentPrice) / Math.abs(currentPrice - stopLoss)

  // Build component array
  const components: SignalComponent[] = [
    {
      name: 'EMA Alignment',
      satisfied: emaAlignment.aligned,
      confidence: componentScores.emaAlignment,
      description: `${emaAlignment.direction} (9>${emaAlignment.ema9.toFixed(2)} > 21>${emaAlignment.ema21.toFixed(2)} > 50>${emaAlignment.ema50.toFixed(2)})`,
    },
    {
      name: 'VWAP Confirmation',
      satisfied: vwapAnalysis.priceVsVWAP !== 'at',
      confidence: componentScores.vwapConfirmation,
      description: `Price ${vwapAnalysis.priceVsVWAP} VWAP by ${vwapAnalysis.distance.toFixed(2)} ATR`,
    },
    {
      name: 'Volume Spike',
      satisfied: volumeAnalysis.isSpike,
      confidence: componentScores.volumeSpike,
      description: `${volumeAnalysis.spikeRatio.toFixed(2)}x average volume`,
    },
    {
      name: 'ATR Filter',
      satisfied: atrFilter.isFiltered,
      confidence: componentScores.atrFilter,
      description: `${atrFilter.volatility} volatility (${atrFilter.atr14.toFixed(2)})`,
    },
    {
      name: 'Trend Filter',
      satisfied: trendFilter.direction !== 'neutral',
      confidence: componentScores.trendFilter,
      description: `${trendFilter.bias} trend, strength ${trendFilter.strength.toFixed(0)}`,
    },
    {
      name: 'Momentum Filter',
      satisfied: momentumFilter.direction !== 'neutral',
      confidence: componentScores.momentumFilter,
      description: `RSI ${momentumFilter.RSI.toFixed(0)}, momentum ${momentumFilter.momentum.toFixed(2)}%`,
    },
    {
      name: 'Price Structure',
      satisfied: componentScores.priceStructure !== 50,
      confidence: Math.abs(componentScores.priceStructure - 50),
      description: `Premarket: ${priceStructure.premarketHigh.toFixed(2)} - ${priceStructure.premarketLow.toFixed(2)}, Prev: ${priceStructure.prevDayHigh.toFixed(2)} - ${priceStructure.prevDayLow.toFixed(2)}`,
    },
  ]

  return {
    signal,
    confidence: Math.round(confidence),
    timestamp,
    barIndex,
    entryPrice: currentPrice,
    stopLoss,
    targetPrice,
    riskReward,
    emaAlignment,
    vwapAnalysis,
    volumeAnalysis,
    atrFilter,
    trendFilter,
    momentumFilter,
    priceStructure,
    components,
    componentScores,
    bullishScore: Math.round(bullish),
    bearishScore: Math.round(bearish),
    neutralScore: Math.round(neutral),
  }
}

/** Run scalping strategy engine. */
export function analyzeScalpingStrategy(
  bars: OHLCVBar[],
  opts: ScalpingEngineOptions = {}
): ScalpingEngineResults {
  if (bars.length < 50) {
    return {
      currentSignal: null,
      recentSignals: [],
      summary: { totalSignals: 0, buyCallCount: 0, buyPutCount: 0, waitCount: 0 },
    }
  }

  // Generate signal for current bar
  const currentSignal = analyzeScalpingSignal(bars, opts)

  // Track recent signals (analyze every 5 bars for performance)
  const recentSignals: ScalpingSignalResult[] = []
  const interval = 5
  const lookback = Math.min(50, bars.length) // last 50 bars = 250 signal points

  for (let i = Math.max(50, bars.length - lookback); i < bars.length; i += interval) {
    const slicedBars = bars.slice(0, i + 1)
    const signal = analyzeScalpingSignal(slicedBars, opts)
    if (signal.signal !== 'WAIT') {
      recentSignals.push(signal)
    }
  }

  // Include current signal
  if (currentSignal.signal !== 'WAIT' && recentSignals.length === 0) {
    recentSignals.push(currentSignal)
  }

  recentSignals.sort((a, b) => b.barIndex - a.barIndex).slice(0, 10)

  // Summary
  const summary = {
    totalSignals: recentSignals.length,
    buyCallCount: recentSignals.filter((s) => s.signal === 'BUY_CALL').length,
    buyPutCount: recentSignals.filter((s) => s.signal === 'BUY_PUT').length,
    waitCount: 0,
  }

  return {
    currentSignal: currentSignal.signal !== 'WAIT' ? currentSignal : null,
    recentSignals,
    summary,
  }
}
