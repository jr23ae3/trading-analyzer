/**
 * Setup Rating Engine
 *
 * Synthesizes all analysis engines into a single setup rating:
 * - Chart Patterns
 * - SMC Zones
 * - Scalping Signals
 * - Probability Analysis
 * - Market Structure
 */

import type { OHLCVBar } from '@/types'
import { detectChartPatterns } from './chartPatterns'
import { detectSMCZones } from './smc'
import { analyzeScalpingStrategy } from './scalping'
import { analyzeProbability } from './probability'
import { analyzeMarketStructure } from './marketStructure'
import { detectSupportResistance } from './analysis'
import { calcATR, calcSMA, calcRSI, calcMACD } from './indicators'
import type {
  SetupGrade,
  SetupRating,
  SetupExplanation,
  SetupMetrics,
  SetupComponent,
  SetupResult,
  SetupRatingOptions,
  SetupRatingResults,
} from './setupRatingTypes'
import type { ProbabilityFactors } from './probabilityTypes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Determine grade from confidence and component scores. */
function assignGrade(confidence: number, avgComponentScore: number): { grade: SetupGrade; rating: SetupRating } {
  const combined = (confidence * 0.6 + avgComponentScore * 0.4)

  if (combined >= 90) return { grade: 'A+', rating: 'Exceptional' }
  if (combined >= 80) return { grade: 'A', rating: 'Excellent' }
  if (combined >= 70) return { grade: 'B', rating: 'Good' }
  if (combined >= 60) return { grade: 'C', rating: 'Fair' }
  return { grade: 'AVOID', rating: 'Poor' }
}

/** Build probability factors from bars and analyzed data. */
function buildProbabilityFactors(bars: OHLCVBar[]): ProbabilityFactors {
  const currentPrice = bars[bars.length - 1].close
  const structure = analyzeMarketStructure(bars)

  // Trend
  const trendInput = {
    direction: structure.trend === 'bull' ? ('bullish' as const) : structure.trend === 'bear' ? ('bearish' as const) : ('neutral' as const),
    strength: structure.confidence ?? 50,
    barsInTrend: structure.swings.length > 0 ? bars.length - (structure.swings[structure.swings.length - 1]?.barIndex ?? 0) : 10,
  }

  // Volume
  const avgVolume20 = bars.slice(-20).reduce((sum, b) => sum + b.volume, 0) / 20
  const volumeInput = {
    currentVolume: bars[bars.length - 1].volume,
    averageVolume: avgVolume20,
    spikeRatio: avgVolume20 > 0 ? bars[bars.length - 1].volume / avgVolume20 : 1,
    trendConfirmation: (currentPrice > bars[Math.max(0, bars.length - 2)].close && bars[bars.length - 1].volume > avgVolume20) ||
      (currentPrice < bars[Math.max(0, bars.length - 2)].close && bars[bars.length - 1].volume > avgVolume20),
  }

  // Momentum
  const rsiArray = calcRSI(bars, 14)
  const rsiLast = rsiArray[rsiArray.length - 1]?.value ?? 50
  const macdArray = calcMACD(bars)
  const macdLast = macdArray[macdArray.length - 1]
  const rocValue = ((currentPrice - bars[Math.max(0, bars.length - 5)].close) / bars[Math.max(0, bars.length - 5)].close) * 100

  const momentumInput = {
    RSI: rsiLast,
    MACD: {
      histogram: macdLast?.histogram ?? 0,
      direction: (macdLast?.histogram ?? 0) > 0 ? ('bullish' as const) : (macdLast?.histogram ?? 0) < 0 ? ('bearish' as const) : ('neutral' as const),
    },
    ROC: rocValue,
    direction: rocValue > 0 ? ('bullish' as const) : rocValue < 0 ? ('bearish' as const) : ('neutral' as const),
  }

  // Support/Resistance
  const srLevels = detectSupportResistance(bars)
  const supportLevels = srLevels.filter((l) => l.type === 'support').sort((a, b) => b.score.total - a.score.total)
  const resistanceLevels = srLevels.filter((l) => l.type === 'resistance').sort((a, b) => b.score.total - a.score.total)
  const nearestSupport = supportLevels.length > 0 ? supportLevels[0].price : currentPrice - 100
  const nearestResistance = resistanceLevels.length > 0 ? resistanceLevels[0].price : currentPrice + 100
  const atrValue = calcATR(bars, 14)[bars.length - 1]?.value ?? 1

  const srInput = {
    nearestSupport,
    nearestResistance,
    currentPrice,
    distanceToSupport: (currentPrice - nearestSupport) / atrValue,
    distanceToResistance: (nearestResistance - currentPrice) / atrValue,
    supportStrength: supportLevels.length > 0 ? supportLevels[0].score.total : 0,
    resistanceStrength: resistanceLevels.length > 0 ? resistanceLevels[0].score.total : 0,
    supportTouches: supportLevels.length > 0 ? supportLevels[0].touches.length : 0,
    resistanceTouches: resistanceLevels.length > 0 ? resistanceLevels[0].touches.length : 0,
  }

  // ATR
  const atrArray = calcATR(bars, 14)
  const atrValues = atrArray.map((p) => (p?.value ?? 0) as number).filter((v) => v > 0)
  const atrPercentile = atrValues.length > 0 ? (atrValues.filter((v) => v <= atrValue).length / atrValues.length) * 100 : 50

  const atrInput = {
    atr14: atrValue,
    volatility: atrPercentile < 33 ? ('low' as const) : atrPercentile < 66 ? ('medium' as const) : ('high' as const),
    volatilityPercentile: atrPercentile,
    priceRange: bars[bars.length - 1].high - bars[bars.length - 1].low,
  }

  // RSI
  const rsiInput = {
    rsi14: rsiLast,
    oversold: rsiLast < 30,
    overbought: rsiLast > 70,
    extreme: rsiLast < 20 || rsiLast > 80,
    direction: rsiLast < 50 ? ('bearish' as const) : rsiLast > 50 ? ('bullish' as const) : ('neutral' as const),
  }

  // VWAP (use 100-bar SMA as proxy)
  const vwapArray = calcSMA(bars, 100)
  const vwapValue = vwapArray[vwapArray.length - 1]?.value ?? currentPrice

  const vwapInput = {
    vwap: vwapValue,
    currentPrice,
    distanceFromVWAP: Math.abs(currentPrice - vwapValue) / atrValue,
    aboveVWAP: currentPrice > vwapValue,
    vwapTrend: currentPrice > vwapValue ? ('bullish' as const) : currentPrice < vwapValue ? ('bearish' as const) : ('neutral' as const),
  }

  // EMA Alignment
  const ema9 = calcSMA(bars, 9)[bars.length - 1]?.value ?? currentPrice
  const ema21 = calcSMA(bars, 21)[bars.length - 1]?.value ?? currentPrice
  const ema50 = calcSMA(bars, 50)[bars.length - 1]?.value ?? currentPrice

  const bullishAlign = ema9 > ema21 && ema21 > ema50
  const bearishAlign = ema9 < ema21 && ema21 < ema50
  const separationRatio = bullishAlign ? (ema9 - ema50) / ema50 : bearishAlign ? (ema50 - ema9) / ema50 : 0

  const emaInput = {
    ema9,
    ema21,
    ema50,
    aligned: bullishAlign || bearishAlign,
    direction: bullishAlign ? ('bullish' as const) : bearishAlign ? ('bearish' as const) : ('neutral' as const),
    alignmentQuality: Math.min(100, separationRatio * 1000),
  }

  // Market Structure
  const structureInput = {
    trend: structure.trend,
    bias: structure.bias,
    structureQuality: structure.confidence ?? 50,
    recentBOS: structure.structureBreaks.length > 0 && (bars.length - 1 - (structure.structureBreaks[0]?.barIndex ?? 0)) < 10,
    confidence: structure.confidence ?? 50,
  }

  return {
    trend: trendInput,
    volume: volumeInput,
    momentum: momentumInput,
    supportResistance: srInput,
    atr: atrInput,
    rsi: rsiInput,
    vwap: vwapInput,
    emaAlignment: emaInput,
    marketStructure: structureInput,
  }
}

// ─── Main Rating Engine ────────────────────────────────────────────────────────

/** Rate the current setup comprehensively. */
export function rateSetup(bars: OHLCVBar[], opts: SetupRatingOptions = {}): SetupResult {
  if (bars.length < 50) {
    return {
      grade: 'AVOID',
      rating: 'Poor',
      confidence: 0,
      timestamp: Date.now(),
      metrics: { riskRewardRatio: 0, priceTarget: 0, stopLoss: 0, expectedMovePercent: 0, winProbability: 0, riskPercent: 0, rewardPercent: 0 },
      explanation: {
        trend: 'Insufficient data',
        momentum: 'Insufficient data',
        risk: 'Insufficient data',
        reward: 'Insufficient data',
        probability: 'Insufficient data',
        marketContext: 'Insufficient data',
        expectedMove: 'Insufficient data',
      },
      components: [],
      summary: 'Not enough bars to analyze',
      action: 'WAIT',
      actionReason: 'Minimum 50 bars required',
      risks: [],
      opportunities: [],
      analysis: {
        patternQuality: { detected: false, patterns: [], strength: 0 },
        smcConfirmation: { detected: false, zones: [], bias: 'neutral' },
        scalingSignal: { signal: 'WAIT', confidence: 0 },
        probabilityAnalysis: { bullProbability: 0, bearProbability: 0, sidewaysProbability: 0 },
        marketStructure: { trend: 'range', strength: 0, quality: 'Insufficient' },
      },
    }
  }

  const defaults: Required<SetupRatingOptions> = {
    minConfidence: 50,
    riskRewardTarget: 3,
    timeframe: 'scalp',
    usePatterns: true,
    useSMC: true,
    useScalping: true,
    useProbability: true,
  }

  const config = { ...defaults, ...opts }
  const currentBar = bars[bars.length - 1]
  const currentPrice = currentBar.close
  const components: SetupComponent[] = []

  // ─── Analyze Chart Patterns ───────────────────────────────────────────

  let patternScore = 50
  let patternDescriptions: string[] = []
  let patternBias: 'bullish' | 'bearish' | 'neutral' = 'neutral'

  if (config.usePatterns) {
    const patternResults = detectChartPatterns(bars)
    const allPatterns = patternResults.patterns ?? []
    if (allPatterns.length > 0) {
      const topPattern = allPatterns[0]
      patternScore = topPattern.confidence
      patternDescriptions = [topPattern.pattern]
      patternBias = topPattern.bias

      components.push({
        name: 'Chart Patterns',
        score: patternScore,
        weight: 0.8,
        status: patternBias,
        description: `${topPattern.pattern} with ${patternScore}% confidence, target ${(topPattern.riskReward * 100).toFixed(1)}:1 R/R`,
      })
    }
  }

  // ─── Analyze SMC Zones ────────────────────────────────────────────────

  let smcScore = 50
  let smcZones: string[] = []
  let smcBias: 'bullish' | 'bearish' | 'neutral' = 'neutral'

  if (config.useSMC) {
    const smcResults = detectSMCZones(bars)
    if (smcResults.activeZones.length > 0) {
      smcScore = 60 + Math.min(20, smcResults.activeZones.length * 5)
      smcZones = smcResults.activeZones.map((z) => z.type)
      const bullishZones = smcResults.activeZones.filter((z) => 'bias' in z && z.bias === 'bullish').length
      const bearishZones = smcResults.activeZones.filter((z) => 'bias' in z && z.bias === 'bearish').length
      smcBias = bullishZones > bearishZones ? 'bullish' : bearishZones > bullishZones ? 'bearish' : 'neutral'

      components.push({
        name: 'SMC Zones',
        score: Math.min(100, smcScore),
        weight: 0.7,
        status: smcBias,
        description: `${smcResults.activeZones.length} active zones (${smcResults.summary.bullishZones} bullish, ${smcResults.summary.bearishZones} bearish)`,
      })
    }
  }

  // ─── Analyze Scalping Signals ──────────────────────────────────────────

  let scalpingScore = 50
  let scalpingSignal: 'BUY_CALL' | 'BUY_PUT' | 'WAIT' = 'WAIT'
  let scalpingConfidence = 0

  if (config.useScalping) {
    const scalpResults = analyzeScalpingStrategy(bars, { minConfidence: 50 })
    if (scalpResults.currentSignal) {
      scalpingSignal = scalpResults.currentSignal.signal
      scalpingConfidence = scalpResults.currentSignal.confidence
      scalpingScore = scalpingConfidence

      components.push({
        name: 'Scalping Signal',
        score: scalpingScore,
        weight: 0.9,
        status: scalpingSignal === 'BUY_CALL' ? 'bullish' : scalpingSignal === 'BUY_PUT' ? 'bearish' : 'neutral',
        description: `${scalpingSignal} (${scalpingConfidence}% confidence, R/R: ${scalpResults.currentSignal.riskReward.toFixed(2)}:1)`,
      })
    }
  }

  // ─── Analyze Probability ──────────────────────────────────────────────

  let probScore = 50
  let bullProb = 0
  let bearProb = 0
  let sidewaysProb = 0

  if (config.useProbability) {
    const factors = buildProbabilityFactors(bars)
    const probResults = analyzeProbability(factors)
    const current = probResults.current
    if (current) {
      bullProb = current.bullProbability
      bearProb = current.bearProbability
      sidewaysProb = current.sidewaysProbability
      probScore = Math.max(bullProb, bearProb)
    }

    if (current) {
      components.push({
        name: 'Probability Analysis',
        score: probScore,
        weight: 1.0,
        status: bullProb > bearProb ? 'bullish' : bearProb > bullProb ? 'bearish' : 'neutral',
        description: `Bull ${bullProb}% / Bear ${bearProb}% / Sideways ${sidewaysProb}% (Grade: ${current.grade})`,
      })
    }
  }

  // ─── Market Structure ──────────────────────────────────────────────────

  const structure = analyzeMarketStructure(bars)
  const structureScore = structure.confidence ?? 50

  components.push({
    name: 'Market Structure',
    score: structureScore,
    weight: 1.1,
    status: structure.trend === 'bull' ? 'bullish' : structure.trend === 'bear' ? 'bearish' : 'neutral',
    description: `${structure.trend.toUpperCase()} trend with ${structureScore}% confidence, ${structure.swings.length} swings identified`,
  })

  // ─── Calculate Metrics ────────────────────────────────────────────────

  const atrValue = bars.length >= 14 ? (calcATR(bars, 14)[bars.length - 1]?.value ?? 1) : 1
  const srAllLevels = detectSupportResistance(bars)
  const supportLevel = srAllLevels
    .filter((l) => l.type === 'support')
    .sort((a, b) => b.score.total - a.score.total)[0]
  const resistanceLevel = srAllLevels
    .filter((l) => l.type === 'resistance')
    .sort((a, b) => b.score.total - a.score.total)[0]

  const support = supportLevel?.price ?? currentPrice - atrValue * 2
  const resistance = resistanceLevel?.price ?? currentPrice + atrValue * 2

  const stopLoss = bullProb > bearProb ? support : resistance
  const targetPrice = bullProb > bearProb ? resistance : support
  const risk = Math.abs(currentPrice - stopLoss)
  const reward = Math.abs(targetPrice - currentPrice)
  const riskRewardRatio = risk > 0 ? reward / risk : 0
  const expectedMovePercent = (reward / currentPrice) * 100
  const riskPercent = (risk / currentPrice) * 100

  const metrics: SetupMetrics = {
    riskRewardRatio,
    priceTarget: targetPrice,
    stopLoss,
    expectedMovePercent,
    winProbability: bullProb > bearProb ? bullProb : bearProb,
    riskPercent,
    rewardPercent: expectedMovePercent,
  }

  // ─── Calculate Overall Confidence ─────────────────────────────────────

  const avgComponentScore = components.length > 0 ? components.reduce((sum, c) => sum + c.score * c.weight, 0) / components.reduce((sum, c) => sum + c.weight, 0) : 50
  const trendConfidence = structure.confidence ?? 50
  const volumeConfirm = bars[bars.length - 1].volume > (bars.slice(-20).reduce((s, b) => s + b.volume, 0) / 20)
  const expectedTrendStatus = structure.trend === 'bull' ? 'bullish' : structure.trend === 'bear' ? 'bearish' : 'neutral'
  const alignmentBonus = components.some((c) => c.status === expectedTrendStatus) ? 10 : 0

  const overallConfidence = Math.min(100, (trendConfidence + avgComponentScore) / 2 + (volumeConfirm ? 5 : 0) + alignmentBonus)

  // ─── Assign Grade ──────────────────────────────────────────────────────

  const { grade, rating } = assignGrade(overallConfidence, avgComponentScore)

  // ─── Build Explanations ───────────────────────────────────────────────

  const explanation: SetupExplanation = {
    trend: structure.trend === 'bull'
      ? `Strong bullish trend (${structure.confidence}% confidence) with ${structure.swings.length} confirmed swings`
      : structure.trend === 'bear'
        ? `Strong bearish trend (${structure.confidence}% confidence) with ${structure.swings.length} confirmed swings`
        : `Range-bound market with mixed structure`,

    momentum: scalpingSignal !== 'WAIT'
      ? `${scalpingSignal} signal detected with ${scalpingConfidence}% confidence`
      : bullProb > bearProb
        ? `Bullish momentum building (${bullProb}% probability)`
        : bearProb > bullProb
          ? `Bearish momentum building (${bearProb}% probability)`
          : 'Neutral momentum - mixed signals',

    risk: `Stop loss at ${stopLoss.toFixed(4)} (${riskPercent.toFixed(2)}% risk)`,

    reward: `Target at ${targetPrice.toFixed(4)} (${expectedMovePercent.toFixed(2)}% reward)`,

    probability: `${Math.max(bullProb, bearProb)}% probability of ${bullProb > bearProb ? 'upside' : 'downside'} move. ${sidewaysProb}% sideways risk.`,

    marketContext: `${smcZones.length > 0 ? `Active SMC zones (${smcZones.join(', ')}) provide ${smcBias} bias. ` : ''}${patternDescriptions.length > 0 ? `${patternDescriptions[0]} pattern identified.` : ''}`,

    expectedMove: `${Math.abs(reward / atrValue).toFixed(2)} ATR expected move (${atrValue.toFixed(4)} ATR value)`,
  }

  // ─── Action and Reasoning ──────────────────────────────────────────────

  let action: 'BUY_CALL' | 'BUY_PUT' | 'WAIT' | 'AVOID' = 'WAIT'
  let actionReason = ''

  if (grade === 'A+') {
    action = bullProb > bearProb ? 'BUY_CALL' : 'BUY_PUT'
    actionReason = `Exceptional ${action === 'BUY_CALL' ? 'bullish' : 'bearish'} setup with ${grade} rating. Multiple confirmations aligned.`
  } else if (grade === 'A') {
    action = bullProb > bearProb ? 'BUY_CALL' : 'BUY_PUT'
    actionReason = `Excellent ${action === 'BUY_CALL' ? 'bullish' : 'bearish'} setup with ${grade} rating. Strong probability of success.`
  } else if (grade === 'B') {
    action = bullProb > bearProb ? 'BUY_CALL' : 'BUY_PUT'
    actionReason = `Good ${action === 'BUY_CALL' ? 'bullish' : 'bearish'} setup with ${grade} rating. Use proper risk management.`
  } else if (grade === 'C') {
    action = 'WAIT'
    actionReason = `Fair setup (${grade} rating). Wait for better confirmation or use minimal position size.`
  } else {
    action = 'AVOID'
    actionReason = `Poor setup (${grade} rating). Avoid trade or look for alternative setups.`
  }

  // ─── Risk and Opportunities ───────────────────────────────────────────

  const risks: string[] = []
  const opportunities: string[] = []

  if (sidewaysProb > 30) risks.push(`Sideways probability ${sidewaysProb}% - range risk`)
  if (riskRewardRatio < 1) risks.push(`Unfavorable risk/reward (${riskRewardRatio.toFixed(2)}:1) - avoid entry`)
  if (structure.structureBreaks.length > 0 && bars.length - 1 - (structure.structureBreaks[0]?.barIndex ?? 0) < 3)
    risks.push(`Recent break of structure - trend reversal possible`)
  if (!volumeConfirm) risks.push(`Volume divergence - weak confirmation`)

  if (riskRewardRatio > config.riskRewardTarget) opportunities.push(`Excellent reward potential (${riskRewardRatio.toFixed(2)}:1 R/R)`)
  if (patternDescriptions.length > 0) opportunities.push(`${patternDescriptions[0]} pattern provides setup structure`)
  if (structure.confidence && structure.confidence > 75) opportunities.push(`High confidence market structure`)
  if (scalpingConfidence > 75) opportunities.push(`High-confidence scalping signal`)

  // ─── Final Summary ────────────────────────────────────────────────────

  const summary = `${rating} setup (${grade}). ${bullProb > bearProb ? 'Bullish' : 'Bearish'} bias with ${overallConfidence.toFixed(0)}% confidence. R/R: ${riskRewardRatio.toFixed(2)}:1. ${action === 'WAIT' ? 'Monitor for confirmation.' : 'Ready for entry.'}`

  return {
    grade,
    rating,
    confidence: Math.round(overallConfidence),
    timestamp: Date.now(),
    metrics,
    explanation,
    components,
    summary,
    action,
    actionReason,
    risks,
    opportunities,
    analysis: {
      patternQuality: { detected: patternDescriptions.length > 0, patterns: patternDescriptions, strength: patternScore },
      smcConfirmation: { detected: smcZones.length > 0, zones: smcZones, bias: smcBias },
      scalingSignal: { signal: scalpingSignal, confidence: scalpingConfidence },
      probabilityAnalysis: { bullProbability: bullProb, bearProbability: bearProb, sidewaysProbability: sidewaysProb },
      marketStructure: {
        trend: structure.trend,
        strength: structure.confidence ?? 0,
        quality: structure.confidence && structure.confidence > 75 ? 'Strong' : structure.confidence && structure.confidence > 50 ? 'Moderate' : 'Weak',
      },
    },
  }
}

/** Run setup rating analysis. */
export function analyzeSetup(bars: OHLCVBar[], opts: SetupRatingOptions = {}): SetupRatingResults {
  const current = rateSetup(bars, opts)

  return {
    current,
    recent: [current],
    summary: {
      averageGrade: current.grade,
      recentWinRate: current.grade === 'A+' ? 85 : current.grade === 'A' ? 75 : current.grade === 'B' ? 60 : current.grade === 'C' ? 40 : 20,
      setupFrequency: 0.5, // placeholder
      bestCondition: `${current.analysis.marketStructure.trend === 'bull' ? 'Bullish' : 'Bearish'} market with confirmed SMC zones`,
    },
  }
}
