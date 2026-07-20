/**
 * Probability Engine Types
 *
 * Multi-factor probability analysis combining:
 * Trend, Volume, Momentum, Support/Resistance,
 * ATR, RSI, VWAP, EMA Alignment, Market Structure
 */

export type TradeGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'

export type ProbabilityDirection = 'bullish' | 'bearish' | 'sideways'

export interface TrendInput {
  direction: 'bullish' | 'bearish' | 'neutral'
  strength: number // 0-100
  barsInTrend: number // how long trend has persisted
}

export interface VolumeInput {
  currentVolume: number
  averageVolume: number
  spikeRatio: number // current / average
  trendConfirmation: boolean // volume confirms direction
}

export interface MomentumInput {
  RSI: number // 0-100
  MACD: {
    histogram: number | null
    direction: 'bullish' | 'bearish' | 'neutral'
  }
  ROC: number // rate of change percentage
  direction: 'bullish' | 'bearish' | 'neutral'
}

export interface SupportResistanceInput {
  nearestSupport: number
  nearestResistance: number
  currentPrice: number
  distanceToSupport: number // in ATR units
  distanceToResistance: number // in ATR units
  supportStrength: number // 0-100, based on touches
  resistanceStrength: number // 0-100, based on touches
  supportTouches: number
  resistanceTouches: number
}

export interface ATRInput {
  atr14: number
  volatility: 'low' | 'medium' | 'high'
  volatilityPercentile: number // 0-100
  priceRange: number // high - low for period
}

export interface RSIInput {
  rsi14: number // 0-100
  oversold: boolean // < 30
  overbought: boolean // > 70
  extreme: boolean // < 20 or > 80
  direction: 'bullish' | 'bearish' | 'neutral'
}

export interface VWAPInput {
  vwap: number
  currentPrice: number
  distanceFromVWAP: number // in ATR units
  aboveVWAP: boolean
  vwapTrend: 'bullish' | 'bearish' | 'neutral'
}

export interface EMAAlignmentInput {
  ema9: number
  ema21: number
  ema50: number
  aligned: boolean
  direction: 'bullish' | 'bearish' | 'neutral'
  alignmentQuality: number // 0-100
}

export interface MarketStructureInput {
  trend: 'bull' | 'bear' | 'range'
  bias: 'bullish' | 'bearish' | 'neutral'
  structureQuality: number // 0-100
  recentBOS: boolean // recent break of structure
  confidence: number // 0-100
}

export interface ProbabilityFactors {
  trend: TrendInput
  volume: VolumeInput
  momentum: MomentumInput
  supportResistance: SupportResistanceInput
  atr: ATRInput
  rsi: RSIInput
  vwap: VWAPInput
  emaAlignment: EMAAlignmentInput
  marketStructure: MarketStructureInput
}

export interface ComponentScore {
  name: string
  bullishScore: number // 0-100
  bearishScore: number // 0-100
  sidewaysScore: number // 0-100
  weight: number // 0-1, importance in overall calculation
  reasoning: string
}

export interface ProbabilityResult {
  bullProbability: number // 0-100
  bearProbability: number // 0-100
  sidewaysProbability: number // 0-100

  // Highest probability direction
  mostLikelyDirection: ProbabilityDirection
  directionConfidence: number // 0-100

  // Trade quality assessment
  grade: TradeGrade
  gradeScore: number // 0-100
  gradeReasoning: string

  // Overall analysis
  overallConfidence: number // 0-100
  timestamp: number

  // Component breakdown
  components: ComponentScore[]

  // Detailed reasoning
  analysis: {
    summary: string
    strengths: string[]
    weaknesses: string[]
    keyFactors: string[]
    riskFactors: string[]
    recommendations: string[]
  }
}

export interface ProbabilityEngineOptions {
  weights?: {
    trend?: number
    volume?: number
    momentum?: number
    supportResistance?: number
    atr?: number
    rsi?: number
    vwap?: number
    emaAlignment?: number
    marketStructure?: number
  }
  minConfidenceForGrade?: number // below this = F grade
  considerVolatility?: boolean // weight results by volatility
  useSMC?: boolean // incorporate smart money concepts if available
}

export interface ProbabilityEngineResults {
  current: ProbabilityResult | null
  history: ProbabilityResult[] // last 50 calculations
  summary: {
    averageBullProbability: number
    averageBearProbability: number
    averageSidewaysProbability: number
    mostCommonGrade: TradeGrade
    probabilityTrend: 'bullish_strengthening' | 'bearish_strengthening' | 'neutral' | 'diverging'
  }
}
