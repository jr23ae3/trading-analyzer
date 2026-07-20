/**
 * Probability Engine
 *
 * Synthesizes 9 market factors into directional probabilities
 * with trade grading and detailed reasoning
 */

import type {
  TradeGrade,
  ProbabilityDirection,
  ComponentScore,
  ProbabilityResult,
  ProbabilityFactors,
  ProbabilityEngineOptions,
  ProbabilityEngineResults,
} from './probabilityTypes'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Score a single component for all three directions. */
function scoreComponent(
  name: string,
  bullBias: number, // -100 to 100, -100 = maximum bearish, 100 = maximum bullish
  _confidence: number, // 0-100, how confident is this score (used in component metadata)
  weight: number = 1
): ComponentScore {
  // Convert bias to probabilities
  const bullScore = Math.max(0, Math.min(100, (bullBias + 100) / 2))
  const bearScore = Math.max(0, Math.min(100, (100 - bullBias) / 2))

  // Sideways = low confidence in direction
  const directionConfidence = Math.abs(bullBias)
  const sidewaysScore = Math.max(0, 100 - directionConfidence)

  // Normalize the three so they sum to 100
  const total = bullScore + bearScore + sidewaysScore
  const normalized = total > 0

  return {
    name,
    bullishScore: normalized ? (bullScore / total) * 100 : 33.33,
    bearishScore: normalized ? (bearScore / total) * 100 : 33.33,
    sidewaysScore: normalized ? (sidewaysScore / total) * 100 : 33.33,
    weight,
    reasoning: '',
  }
}

/** Assign trade grade based on probability and confidence. */
function assignTradeGrade(
  probability: number, // 0-100, how confident in the most likely direction
  confidence: number, // 0-100, overall signal quality
  volumeConfirm: boolean, // volume confirms direction
  structureQuality: number // 0-100
): { grade: TradeGrade; score: number; reasoning: string } {
  // Probability weight: how clear is the directional bias
  const probWeight = probability / 100
  // Confidence weight: overall signal quality
  const confWeight = confidence / 100
  // Bonus for volume confirmation and structure
  const confirmBonus = (volumeConfirm ? 0.1 : 0) + (structureQuality / 1000)

  const gradeScore = (probWeight * 40 + confWeight * 50 + confirmBonus * 10) * 100
  const clamped = Math.max(0, Math.min(100, gradeScore))

  let grade: TradeGrade = 'F'
  let reasoning = ''

  if (clamped >= 95) {
    grade = 'A+'
    reasoning = 'Extremely strong signal with high probability and excellent confirmation'
  } else if (clamped >= 85) {
    grade = 'A'
    reasoning = 'Very strong signal with good probability and confirmation'
  } else if (clamped >= 78) {
    grade = 'B+'
    reasoning = 'Strong signal with above-average probability and confirmation'
  } else if (clamped >= 70) {
    grade = 'B'
    reasoning = 'Good signal with acceptable probability and confirmation'
  } else if (clamped >= 60) {
    grade = 'C+'
    reasoning = 'Moderate signal with some confirmation but mixed factors'
  } else if (clamped >= 50) {
    grade = 'C'
    reasoning = 'Neutral to weak signal with limited confirmation'
  } else if (clamped >= 35) {
    grade = 'D'
    reasoning = 'Weak signal with significant conflicting factors'
  } else {
    grade = 'F'
    reasoning = 'Poor signal quality, avoid trading or use strict risk management'
  }

  return { grade, score: clamped, reasoning }
}

// ─── Analysis Functions ────────────────────────────────────────────────────────

/** Calculate probability result from all input factors. */
export function calculateProbability(
  factors: ProbabilityFactors,
  opts: ProbabilityEngineOptions = {}
): ProbabilityResult {
  const defaults: Required<ProbabilityEngineOptions> = {
    weights: {
      trend: 1.2,
      volume: 0.8,
      momentum: 1.0,
      supportResistance: 1.0,
      atr: 0.6,
      rsi: 0.9,
      vwap: 0.9,
      emaAlignment: 1.1,
      marketStructure: 1.3,
    },
    minConfidenceForGrade: 40,
    considerVolatility: true,
    useSMC: false,
  }

  const config = {
    ...defaults,
    weights: { ...defaults.weights, ...(opts.weights || {}) },
  }

  const components: ComponentScore[] = []

  // ─── 1. Trend Analysis ─────────────────────────────────────────────────

  let trendBias = 0
  if (factors.trend.direction === 'bullish') {
    trendBias = Math.min(100, factors.trend.strength + factors.trend.barsInTrend)
  } else if (factors.trend.direction === 'bearish') {
    trendBias = Math.max(-100, -factors.trend.strength - factors.trend.barsInTrend)
  }

  const trendComponent = scoreComponent(
    'Trend',
    trendBias,
    factors.trend.strength,
    config.weights.trend
  )
  trendComponent.reasoning =
    factors.trend.direction === 'bullish'
      ? `Strong ${factors.trend.direction} trend (strength: ${factors.trend.strength})`
      : factors.trend.direction === 'bearish'
        ? `Strong ${factors.trend.direction} trend (strength: ${factors.trend.strength})`
        : 'Neutral/ranging market'
  components.push(trendComponent)

  // ─── 2. Volume Analysis ────────────────────────────────────────────────

  let volumeBias = 0
  const volumeBoost = factors.volume.spikeRatio > 1.5 ? 20 : factors.volume.spikeRatio > 1.2 ? 10 : 0

  if (factors.volume.trendConfirmation) {
    volumeBias = volumeBoost
  } else {
    volumeBias = -volumeBoost
  }

  const volumeComponent = scoreComponent(
    'Volume',
    volumeBias,
    Math.min(100, factors.volume.spikeRatio * 50),
    config.weights.volume
  )
  volumeComponent.reasoning = `Volume ${factors.volume.trendConfirmation ? 'confirms' : 'diverges from'} trend (${factors.volume.spikeRatio.toFixed(2)}x avg)`
  components.push(volumeComponent)

  // ─── 3. Momentum Analysis ──────────────────────────────────────────────

  let momentumBias = 0
  if (factors.momentum.direction === 'bullish') {
    momentumBias = factors.momentum.ROC > 0 ? 60 : 30
  } else if (factors.momentum.direction === 'bearish') {
    momentumBias = factors.momentum.ROC < 0 ? -60 : -30
  }

  // MACD histogram confirms
  if (factors.momentum.MACD.direction === 'bullish') momentumBias += 15
  if (factors.momentum.MACD.direction === 'bearish') momentumBias -= 15

  const momentumComponent = scoreComponent(
    'Momentum',
    momentumBias,
    Math.abs(factors.momentum.ROC) * 2,
    config.weights.momentum
  )
  momentumComponent.reasoning = `${factors.momentum.direction} momentum with MACD ${factors.momentum.MACD.direction} (ROC: ${factors.momentum.ROC.toFixed(2)}%)`
  components.push(momentumComponent)

  // ─── 4. Support/Resistance Analysis ────────────────────────────────────

  let srBias = 0
  const { distanceToSupport, distanceToResistance, supportStrength, resistanceStrength } = factors.supportResistance

  // Close to support = bullish bias, close to resistance = bearish bias
  const supportProximity = Math.max(0, 1 - distanceToSupport / 2) * supportStrength
  const resistanceProximity = Math.max(0, 1 - distanceToResistance / 2) * resistanceStrength

  srBias = (supportProximity - resistanceProximity) * 2

  const srComponent = scoreComponent(
    'Support/Resistance',
    srBias,
    Math.max(supportStrength, resistanceStrength),
    config.weights.supportResistance
  )
  srComponent.reasoning = `Support ${distanceToSupport.toFixed(2)} ATR away (strength: ${supportStrength}), Resistance ${distanceToResistance.toFixed(2)} ATR away (strength: ${resistanceStrength})`
  components.push(srComponent)

  // ─── 5. ATR Analysis ──────────────────────────────────────────────────

  let atrBias = 0
  // Low volatility = less risky for trades
  if (factors.atr.volatility === 'low') atrBias = 0 // neutral
  if (factors.atr.volatility === 'medium') atrBias = 20 // slightly favor trades
  if (factors.atr.volatility === 'high') atrBias = -20 // caution, higher risk

  const atrComponent = scoreComponent(
    'ATR/Volatility',
    atrBias,
    100 - factors.atr.volatilityPercentile, // lower volatility = higher confidence
    config.weights.atr
  )
  atrComponent.reasoning = `${factors.atr.volatility} volatility (percentile: ${factors.atr.volatilityPercentile.toFixed(0)}, ATR: ${factors.atr.atr14.toFixed(4)})`
  components.push(atrComponent)

  // ─── 6. RSI Analysis ──────────────────────────────────────────────────

  let rsiBias = 0
  const rsi = factors.rsi.rsi14

  if (rsi < 30) {
    // Oversold = potential bullish reversal
    rsiBias = 50
  } else if (rsi > 70) {
    // Overbought = potential bearish reversal
    rsiBias = -50
  } else if (rsi < 50) {
    rsiBias = 20 // slight bullish bias in lower half
  } else {
    rsiBias = -20 // slight bearish bias in upper half
  }

  // Extreme conditions get lower confidence (potential reversal)
  const rsiConfidence = factors.rsi.extreme ? 60 : 80

  const rsiComponent = scoreComponent('RSI', rsiBias, rsiConfidence, config.weights.rsi)
  rsiComponent.reasoning = `RSI: ${rsi.toFixed(0)}${factors.rsi.oversold ? ' (oversold)' : factors.rsi.overbought ? ' (overbought)' : ''}`
  components.push(rsiComponent)

  // ─── 7. VWAP Analysis ─────────────────────────────────────────────────

  let vwapBias = 0
  if (factors.vwap.vwapTrend === 'bullish') {
    vwapBias = factors.vwap.aboveVWAP ? 60 : 20
  } else if (factors.vwap.vwapTrend === 'bearish') {
    vwapBias = factors.vwap.aboveVWAP ? -20 : -60
  }

  const vwapComponent = scoreComponent(
    'VWAP',
    vwapBias,
    Math.min(100, factors.vwap.distanceFromVWAP * 30),
    config.weights.vwap
  )
  vwapComponent.reasoning = `Price ${factors.vwap.aboveVWAP ? 'above' : 'below'} VWAP (distance: ${factors.vwap.distanceFromVWAP.toFixed(2)} ATR), trend: ${factors.vwap.vwapTrend}`
  components.push(vwapComponent)

  // ─── 8. EMA Alignment Analysis ─────────────────────────────────────────

  let emaBias = 0
  if (factors.emaAlignment.direction === 'bullish') {
    emaBias = factors.emaAlignment.alignmentQuality
  } else if (factors.emaAlignment.direction === 'bearish') {
    emaBias = -factors.emaAlignment.alignmentQuality
  }

  const emaComponent = scoreComponent(
    'EMA Alignment',
    emaBias,
    factors.emaAlignment.aligned ? factors.emaAlignment.alignmentQuality : 40,
    config.weights.emaAlignment
  )
  emaComponent.reasoning = `EMA ${factors.emaAlignment.direction} ${factors.emaAlignment.aligned ? 'aligned' : 'misaligned'} (quality: ${factors.emaAlignment.alignmentQuality.toFixed(0)})`
  components.push(emaComponent)

  // ─── 9. Market Structure Analysis ──────────────────────────────────────

  let structureBias = 0
  if (factors.marketStructure.trend === 'bull') {
    structureBias = factors.marketStructure.confidence + (factors.marketStructure.recentBOS ? -30 : 0)
  } else if (factors.marketStructure.trend === 'bear') {
    structureBias = -factors.marketStructure.confidence - (factors.marketStructure.recentBOS ? 30 : 0)
  }

  const structureComponent = scoreComponent(
    'Market Structure',
    structureBias,
    factors.marketStructure.confidence,
    config.weights.marketStructure
  )
  structureComponent.reasoning = `${factors.marketStructure.trend} market structure ${factors.marketStructure.recentBOS ? '(recent BOS)' : '(stable)'} (confidence: ${factors.marketStructure.confidence.toFixed(0)})`
  components.push(structureComponent)

  // ─── Calculate Weighted Probabilities ──────────────────────────────────

  let bullScore = 0
  let bearScore = 0
  let sidewaysScore = 0
  let totalWeight = 0

  for (const comp of components) {
    bullScore += comp.bullishScore * comp.weight
    bearScore += comp.bearishScore * comp.weight
    sidewaysScore += comp.sidewaysScore * comp.weight
    totalWeight += comp.weight
  }

  const bullProbability = totalWeight > 0 ? (bullScore / totalWeight) * (1 + (1 - factors.atr.volatilityPercentile / 100) * 0.1) : 33.33
  const bearProbability = totalWeight > 0 ? (bearScore / totalWeight) * (1 + (1 - factors.atr.volatilityPercentile / 100) * 0.1) : 33.33
  const sidewaysProbability = totalWeight > 0 ? (sidewaysScore / totalWeight) * (factors.atr.volatilityPercentile / 100) * 1.5 : 33.33

  // Normalize to 100
  const total = bullProbability + bearProbability + sidewaysProbability
  const normBull = Math.round((bullProbability / total) * 100)
  const normBear = Math.round((bearProbability / total) * 100)
  const normSideways = 100 - normBull - normBear

  // ─── Determine Most Likely Direction ───────────────────────────────────

  const probabilities = [
    { dir: 'bullish' as ProbabilityDirection, prob: normBull },
    { dir: 'bearish' as ProbabilityDirection, prob: normBear },
    { dir: 'sideways' as ProbabilityDirection, prob: normSideways },
  ]
  probabilities.sort((a, b) => b.prob - a.prob)
  const mostLikelyDirection = probabilities[0].dir
  const directionConfidence = probabilities[0].prob

  // ─── Overall Confidence ───────────────────────────────────────────────

  // Based on how much higher the top probability is vs others
  const confidenceGap = probabilities[0].prob - probabilities[1].prob
  const overallConfidence = Math.min(100, 50 + confidenceGap / 2)

  // ─── Trade Grade ──────────────────────────────────────────────────────

  const { grade, score: gradeScore, reasoning: gradeReasoning } = assignTradeGrade(
    directionConfidence,
    overallConfidence,
    factors.volume.trendConfirmation,
    factors.marketStructure.structureQuality
  )

  // ─── Build Analysis ───────────────────────────────────────────────────

  const analysis = {
    summary: `${mostLikelyDirection.toUpperCase()} probability ${directionConfidence}% (${grade} grade). ${gradeReasoning}.`,
    strengths: [] as string[],
    weaknesses: [] as string[],
    keyFactors: [] as string[],
    riskFactors: [] as string[],
    recommendations: [] as string[],
  }

  // Identify strongest components
  const sorted = [...components].sort((a, b) => {
    const aBias = Math.max(a.bullishScore, a.bearishScore)
    const bBias = Math.max(b.bullishScore, b.bearishScore)
    return bBias - aBias
  })

  // Top 3 components
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    const comp = sorted[i]
    const topDir = comp.bullishScore > comp.bearishScore ? 'bullish' : 'bearish'
    analysis.keyFactors.push(`${comp.name}: ${topDir} (${Math.max(comp.bullishScore, comp.bearishScore).toFixed(0)}%)`)
  }

  // Identify strengths
  if (normBull > 60) {
    analysis.strengths.push('Strong bullish consensus across multiple indicators')
  } else if (normBear > 60) {
    analysis.strengths.push('Strong bearish consensus across multiple indicators')
  } else {
    analysis.strengths.push('Balanced market with mixed signals')
  }

  if (factors.volume.trendConfirmation) {
    analysis.strengths.push('Volume confirms price direction')
  }

  if (factors.emaAlignment.aligned) {
    analysis.strengths.push('EMA alignment provides structural support')
  }

  // Identify weaknesses
  if (normSideways > 40) {
    analysis.weaknesses.push('Sideways probability is significant - unclear direction')
  }

  if (factors.atr.volatility === 'high') {
    analysis.weaknesses.push('High volatility increases risk and reduces signal reliability')
  }

  if (factors.rsi.extreme) {
    analysis.weaknesses.push('RSI at extremes - potential reversal risk')
  }

  if (factors.supportResistance.distanceToResistance < 1 && mostLikelyDirection === 'bullish') {
    analysis.weaknesses.push('Price near major resistance - watch for rejection')
  }

  if (factors.supportResistance.distanceToSupport < 1 && mostLikelyDirection === 'bearish') {
    analysis.weaknesses.push('Price near major support - watch for bounce')
  }

  // Risk factors
  if (factors.atr.volatilityPercentile > 75) {
    analysis.riskFactors.push('High volatility environment - use wider stops')
  }

  if (normSideways > 30) {
    analysis.riskFactors.push('Sideways risk is significant')
  }

  if (factors.momentum.MACD.direction !== factors.momentum.direction) {
    analysis.riskFactors.push('MACD and RSI diverging - mixed momentum signals')
  }

  // Recommendations
  if (grade === 'A+' || grade === 'A') {
    analysis.recommendations.push('High-confidence trade setup - consider entering on breakout confirmation')
  } else if (grade === 'B+' || grade === 'B') {
    analysis.recommendations.push('Good trade setup - enter with proper risk management')
  } else if (grade === 'C+' || grade === 'C') {
    analysis.recommendations.push('Moderate setup - use tighter stops and reduced position size')
  } else {
    analysis.recommendations.push('Poor setup - wait for better entry or skip trade')
  }

  if (factors.rsi.oversold && mostLikelyDirection === 'bullish') {
    analysis.recommendations.push('RSI oversold - strong recovery potential')
  } else if (factors.rsi.overbought && mostLikelyDirection === 'bearish') {
    analysis.recommendations.push('RSI overbought - strong reversal potential')
  }

  return {
    bullProbability: normBull,
    bearProbability: normBear,
    sidewaysProbability: normSideways,
    mostLikelyDirection,
    directionConfidence,
    grade,
    gradeScore,
    gradeReasoning,
    overallConfidence,
    timestamp: Date.now(),
    components,
    analysis,
  }
}

/** Run probability engine on factors. */
export function analyzeProbability(
  factors: ProbabilityFactors,
  opts: ProbabilityEngineOptions = {}
): ProbabilityEngineResults {
  const current = calculateProbability(factors, opts)

  return {
    current,
    history: [current],
    summary: {
      averageBullProbability: current.bullProbability,
      averageBearProbability: current.bearProbability,
      averageSidewaysProbability: current.sidewaysProbability,
      mostCommonGrade: current.grade,
      probabilityTrend: 'neutral',
    },
  }
}
