/**
 * Setup Rating Types
 *
 * Comprehensive setup assessment synthesizing all analysis engines:
 * Patterns, SMC, Scalping Signals, Probability Analysis, Market Structure
 */

export type SetupGrade = 'A+' | 'A' | 'B' | 'C' | 'AVOID'

export type SetupRating = 'Exceptional' | 'Excellent' | 'Good' | 'Fair' | 'Poor'

export interface SetupExplanation {
  trend: string
  momentum: string
  risk: string
  reward: string
  probability: string
  marketContext: string
  expectedMove: string
}

export interface SetupMetrics {
  riskRewardRatio: number // e.g., 1:3 = 3
  priceTarget: number
  stopLoss: number
  expectedMovePercent: number
  winProbability: number // 0-100
  riskPercent: number
  rewardPercent: number
}

export interface SetupComponent {
  name: string
  score: number // 0-100
  weight: number // 0-1, importance
  status: 'bullish' | 'bearish' | 'neutral' | 'conflicting'
  description: string
}

export interface SetupResult {
  grade: SetupGrade
  rating: SetupRating
  confidence: number // 0-100
  timestamp: number

  // Metrics
  metrics: SetupMetrics

  // Explanation
  explanation: SetupExplanation

  // Component breakdown
  components: SetupComponent[]

  // Summary
  summary: string
  action: string // 'BUY_CALL' | 'BUY_PUT' | 'WAIT' | 'AVOID'
  actionReason: string

  // Risk assessment
  risks: string[]
  opportunities: string[]

  // Detailed analysis
  analysis: {
    patternQuality: {
      detected: boolean
      patterns: string[]
      strength: number
    }
    smcConfirmation: {
      detected: boolean
      zones: string[]
      bias: 'bullish' | 'bearish' | 'neutral'
    }
    scalingSignal: {
      signal: 'BUY_CALL' | 'BUY_PUT' | 'WAIT'
      confidence: number
    }
    probabilityAnalysis: {
      bullProbability: number
      bearProbability: number
      sidewaysProbability: number
    }
    marketStructure: {
      trend: 'bull' | 'bear' | 'range'
      strength: number
      quality: string
    }
  }
}

export interface SetupRatingOptions {
  minConfidence?: number // minimum confidence to rate (default 50)
  riskRewardTarget?: number // target R:R ratio (default 1:3)
  timeframe?: 'scalp' | 'swing' | 'position' // affects expectations
  usePatterns?: boolean // include chart patterns (default true)
  useSMC?: boolean // include SMC zones (default true)
  useScalping?: boolean // include scalping signals (default true)
  useProbability?: boolean // include probability analysis (default true)
}

export interface SetupRatingResults {
  current: SetupResult | null
  recent: SetupResult[] // last 10 setups
  summary: {
    averageGrade: string
    recentWinRate: number // estimated based on grades
    setupFrequency: number // setups per hour
    bestCondition: string // when we get A+ setups
  }
}
