/**
 * Pattern Recognition Type Definitions
 *
 * Supports:
 *   - Trend Continuation: Bull Flag, Bear Flag, Pennant, Channel
 *   - Triangles: Ascending, Descending, Symmetric
 *   - Wedges: Rising, Falling
 *   - Reversals: Head & Shoulders, Inverse H&S, Double Top, Double Bottom, Rectangle
 *   - Consolidation: Cup & Handle
 */

/** Pattern category for organization. */
export type PatternCategory = 'continuation' | 'reversal' | 'consolidation' | 'triangle' | 'other'

/** All recognized pattern types. */
export type PatternType =
  | 'bull-flag'
  | 'bear-flag'
  | 'pennant'
  | 'triangle'
  | 'ascending-triangle'
  | 'descending-triangle'
  | 'wedge-up'
  | 'wedge-down'
  | 'channel-up'
  | 'channel-down'
  | 'channel-sideways'
  | 'head-shoulders'
  | 'inverse-head-shoulders'
  | 'double-top'
  | 'double-bottom'
  | 'cup-handle'
  | 'rectangle'

export const PATTERN_CATEGORIES: Record<PatternType, PatternCategory> = {
  'bull-flag': 'continuation',
  'bear-flag': 'continuation',
  'pennant': 'continuation',
  'triangle': 'triangle',
  'ascending-triangle': 'triangle',
  'descending-triangle': 'triangle',
  'wedge-up': 'other',
  'wedge-down': 'other',
  'channel-up': 'continuation',
  'channel-down': 'continuation',
  'channel-sideways': 'consolidation',
  'head-shoulders': 'reversal',
  'inverse-head-shoulders': 'reversal',
  'double-top': 'reversal',
  'double-bottom': 'reversal',
  'cup-handle': 'consolidation',
  'rectangle': 'consolidation',
}

/** Geometry of a detected pattern. */
export interface PatternGeometry {
  /** Leftmost bar index (start of pattern). */
  startBarIndex: number
  /** Rightmost bar index (end of pattern or current breakout attempt). */
  endBarIndex: number
  /** Pattern entry price — typically breakout level. */
  entryPrice: number
  /** Highest price touched in pattern. */
  patternHigh: number
  /** Lowest price touched in pattern. */
  patternLow: number
  /** Pattern height (high - low). */
  patternHeight: number
  /** Pattern width (bars). */
  patternWidth: number
  /** Pattern height / ATR ratio — size relative to market volatility. */
  heightToATR: number
}

/** Support or resistance line with quantified touch count and regression fit. */
export interface PatternLevel {
  /** Price level. */
  price: number
  /** How many times price touched within tolerance. */
  touchCount: number
  /** Least-squares R² (0–1). */
  fitQuality: number
  /** Slope if applicable (price/bar). */
  slope?: number
  /** Y-intercept of regression line (for calculating price at any bar index). */
  intercept?: number
}

/** Single S/R level touch in the pattern. */
export interface LevelTouch {
  barIndex: number
  time: number
  price: number
}

/** Configuration for pattern detection. */
export interface PatternDetectionOptions {
  /** Minimum pattern width (bars). Default: 5. */
  minPatternWidth?: number
  /** Maximum pattern width (bars). Default: 50. */
  maxPatternWidth?: number
  /** Price tolerance for level touches (% of price). Default: 0.3%. */
  priceTolerance?: number
  /** Minimum touch count for a level. Default: 2. */
  minTouches?: number
  /** Recent lookback (bars) for active pattern detection. Default: 200. */
  recentLookback?: number
  /** Lookback for prior trend (flags, wedges). Default: 20. */
  trendLookback?: number
}

/**
 * Complete pattern detection result.
 *
 * Probability: [0,100] — likelihood pattern completes per its signal.
 * Confidence: [0,100] — reliability of the pattern (formation clarity, touches, fit).
 * Risk/Reward: Target / StopLoss distance.
 */
export interface PatternDetectionResult {
  /** Pattern identifier. */
  pattern: PatternType
  /** Category for filtering. */
  category: PatternCategory
  /** Pattern geometry. */
  geometry: PatternGeometry
  /** Support level (breakout downside). */
  support?: PatternLevel
  /** Resistance level (breakout upside). */
  resistance?: PatternLevel
  /** Entry price (typically the breakout level). */
  entry: number
  /** Calculated stop loss (typically just beyond pattern). */
  stopLoss: number
  /** Calculated price target. */
  target: number
  /** Target / StopLoss distance (risk/reward multiple). */
  riskReward: number
  /** [0,100] Pattern probability — likelihood it completes. */
  probability: number
  /** [0,100] Confidence in the detected pattern. Based on: shape clarity, touch count, fit quality, size. */
  confidence: number
  /** When true, pattern is at or near breakout. */
  isActive: boolean
  /** Bullish, bearish, or neutral bias. */
  bias: 'bullish' | 'bearish' | 'neutral'
  /** Optional: Specific touches on support/resistance for debugging. */
  supportTouches?: LevelTouch[]
  resistanceTouches?: LevelTouch[]
}

/** Aggregated pattern engine output. */
export interface PatternEngineResults {
  /** All detected patterns, sorted by confidence (high to low). */
  patterns: PatternDetectionResult[]
  /** Highest-confidence active pattern (at breakout). */
  activePattern?: PatternDetectionResult
  /** Strongest reversal pattern, if any. */
  reversalPattern?: PatternDetectionResult
  /** Strongest continuation pattern, if any. */
  continuationPattern?: PatternDetectionResult
  /** Summary: total patterns, active count, avg confidence. */
  summary: {
    totalPatterns: number
    activePatterns: number
    avgConfidence: number
  }
}

/** Scoring breakdown for transparency. */
export interface PatternScores {
  /** [0,25] Shape clarity (fit quality, symmetry, convergence). */
  shapeClarity: number
  /** [0,25] Touch count and level quality. */
  touchQuality: number
  /** [0,25] Size relative to ATR (not too large, not too small). */
  sizeQuality: number
  /** [0,25] Recent activity (touches near end). */
  recencyQuality: number
  /** Sum of above (0-100). */
  total: number
}
