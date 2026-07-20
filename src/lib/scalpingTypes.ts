/**
 * Scalping Strategy Engine Types
 *
 * Multi-factor signal detection for intraday scalping:
 *   EMA Alignment, VWAP Confirmation, Volume Spike,
 *   ATR Filter, Trend Filter, Momentum Filter,
 *   Previous Day High/Low, Premarket High/Low
 */

export type ScalpingSignal = 'BUY_CALL' | 'BUY_PUT' | 'WAIT'

export type TrendDirection = 'bullish' | 'bearish' | 'neutral'

export interface EMAAlignment {
  ema9: number
  ema21: number
  ema50: number
  aligned: boolean
  direction: TrendDirection
  alignmentStrength: number // 0-100, how well aligned
}

export interface VWAPAnalysis {
  vwap: number
  priceVsVWAP: 'above' | 'below' | 'at'
  distance: number // in ATR units
  strength: number // 0-100
}

export interface VolumeAnalysis {
  currentVolume: number
  averageVolume: number // last 20 bars
  spikeRatio: number // current / average
  isSpike: boolean // > 1.5x average
  strength: number // 0-100
}

export interface ATRFilter {
  atr14: number
  volatility: 'low' | 'medium' | 'high'
  isFiltered: boolean // true if volatility within acceptable range
  volatilityScore: number // 0-100
}

export interface TrendFilter {
  direction: TrendDirection
  strength: number // 0-100, based on structure
  ADX?: number // optional ADX value
  bias: 'bullish' | 'bearish' | 'neutral'
}

export interface MomentumFilter {
  RSI: number // 0-100
  momentum: number // rate of change
  MACD?: {
    value: number
    signal: number
    histogram: number
  }
  direction: TrendDirection
  strength: number // 0-100
}

export interface PriceStructure {
  prevDayHigh: number
  prevDayLow: number
  prevDayClose: number
  premarketHigh: number
  premarketLow: number
  currentPrice: number
}

export interface SignalComponent {
  name: string
  satisfied: boolean
  confidence: number // 0-100
  description: string
}

export interface ScalpingSignalResult {
  signal: ScalpingSignal
  confidence: number // 0-100, overall signal confidence
  timestamp: number
  barIndex: number
  entryPrice: number
  stopLoss: number
  targetPrice: number
  riskReward: number

  // Component analysis
  emaAlignment: EMAAlignment
  vwapAnalysis: VWAPAnalysis
  volumeAnalysis: VolumeAnalysis
  atrFilter: ATRFilter
  trendFilter: TrendFilter
  momentumFilter: MomentumFilter
  priceStructure: PriceStructure

  // Component scores
  components: SignalComponent[]
  componentScores: {
    emaAlignment: number
    vwapConfirmation: number
    volumeSpike: number
    atrFilter: number
    trendFilter: number
    momentumFilter: number
    priceStructure: number
  }

  // Aggregated metrics
  bullishScore: number // 0-100
  bearishScore: number // 0-100
  neutralScore: number // 0-100
}

export interface ScalpingEngineOptions {
  lookback?: number // bars to analyze (default 100)
  emaShorts?: number[] // EMA periods for alignment (default [9, 21, 50])
  volumeSpikeThreshold?: number // multiplier (default 1.5)
  atrMultiplier?: number // for stop loss (default 1.5)
  targetMultiplier?: number // for take profit (default 3)
  minConfidence?: number // minimum confidence to signal (default 65)
  volatilityRange?: [number, number] // acceptable ATR range as percentile (default [20, 80])
  ADXThreshold?: number // for trend filter (default 25)
  RSIOverbought?: number // RSI threshold (default 70)
  RSIOversold?: number // RSI threshold (default 30)
  usePremarket?: boolean // include premarket levels (default true)
}

export interface ScalpingEngineResults {
  currentSignal: ScalpingSignalResult | null
  recentSignals: ScalpingSignalResult[] // last 10
  summary: {
    totalSignals: number
    buyCallCount: number
    buyPutCount: number
    waitCount: number
    winRate?: number // if tracked
  }
}
