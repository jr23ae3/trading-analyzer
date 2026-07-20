/**
 * Smart Money Concepts Type Definitions
 *
 * Detects institutional trading structures:
 *   - Liquidity Sweeps
 *   - Fair Value Gaps (FVG)
 *   - Order Blocks (OB)
 *   - Breaker Blocks
 *   - Mitigation Blocks
 *   - Market Structure Shift
 *   - Change of Character (CHoCH)
 *   - Premium/Discount Zones
 *   - Equal Highs/Lows
 */

/** SMC zone type. */
export type SMCZoneType =
  | 'liquidity-sweep'
  | 'fair-value-gap'
  | 'order-block'
  | 'breaker-block'
  | 'mitigation-block'
  | 'premium-zone'
  | 'discount-zone'
  | 'equal-highs'
  | 'equal-lows'
  | 'structure-shift'
  | 'change-of-character'

/** Direction of zone bias. */
export type ZoneBias = 'bullish' | 'bearish' | 'neutral'

/** Whether a zone has been mitigated (price touched the zone). */
export type MitigationStatus = 'unmitigated' | 'partially-mitigated' | 'fully-mitigated'

/**
 * Liquidity Sweep Zone.
 * Price sweeps through recent swing high/low before reversing.
 */
export interface LiquiditySweep {
  type: 'liquidity-sweep'
  /** 'high' = swept above swing high, 'low' = swept below swing low. */
  sweepKind: 'high' | 'low'
  /** Price level that was swept. */
  sweepPrice: number
  /** How far beyond the sweep price (in ATR). */
  sweepDepth: number
  /** Bar where sweep occurred. */
  sweepBarIndex: number
  sweepTime: number
  /** Bar where liquidity was located. */
  liquidityBarIndex: number
  liquidityTime: number
  /** Pullback level (first touch after sweep). */
  pullbackPrice: number
  pullbackBarIndex: number
  pullbackTime: number
  /** Bias: bullish (bullish sweep below support), bearish (bearish sweep above resistance). */
  bias: ZoneBias
  /** How recent (lower = fresher). */
  barsAgo: number
}

/**
 * Fair Value Gap (Imbalance).
 * Gap in price action where candles do not overlap.
 */
export interface FairValueGap {
  type: 'fair-value-gap'
  /** High edge of gap. */
  gapHigh: number
  /** Low edge of gap. */
  gapLow: number
  /** Gap size (in price and % of price). */
  gapSize: number
  gapSizePercent: number
  /** Bar indices that form the gap. */
  startBarIndex: number
  endBarIndex: number
  startTime: number
  endTime: number
  /** 'bullish' if gap is above, 'bearish' if below, 'neutral' if symmetric. */
  bias: ZoneBias
  /** Current mitigation status. */
  mitigationStatus: MitigationStatus
  /** How many candles have touched/partially mitigated. */
  touchesCount: number
}

/**
 * Order Block Zone.
 * Consolidation where smart money accumulates (bullish OB) or distributes (bearish OB).
 */
export interface OrderBlock {
  type: 'order-block' | 'breaker-block' | 'mitigation-block'
  /** Price range of the block. */
  blockHigh: number
  blockLow: number
  blockHeight: number
  /** Bar indices. */
  startBarIndex: number
  endBarIndex: number
  startTime: number
  endTime: number
  blockWidth: number
  /** 'bullish' = accumulation (support), 'bearish' = distribution (resistance). */
  bias: ZoneBias
  /** Relative volume strength in this block. */
  volumeStrength: number
  /** Average candle body size in block (in ATR). */
  bodyStrengthATR: number
  /** Current mitigation (whether price re-touched). */
  mitigationStatus: MitigationStatus
  /** If mitigated, the bar index and time. */
  mitigationBarIndex?: number
  mitigationTime?: number
}

/**
 * Market Structure Shift.
 * Change in trend direction (HH/HL to LH/LL or vice versa).
 */
export interface MarketStructureShift {
  type: 'structure-shift'
  /** Bar where shift occurred. */
  shiftBarIndex: number
  shiftTime: number
  /** Prior structure: 'bull', 'bear', 'range'. */
  priorStructure: 'bull' | 'bear' | 'range'
  /** New structure. */
  newStructure: 'bull' | 'bear' | 'range'
  /** Pivot price where shift occurred. */
  pivotPrice: number
  /** Strength of shift (0-100). Based on move size, ADX. */
  shiftStrength: number
}

/**
 * Change of Character (CHoCH).
 * Shift from imbalanced to balanced market (or vice versa).
 */
export interface ChangeOfCharacter {
  type: 'change-of-character'
  /** Bar where CHoCH occurred. */
  chochBarIndex: number
  chochTime: number
  /** Prior character: 'imbalanced' or 'balanced'. */
  priorCharacter: 'imbalanced' | 'balanced'
  /** New character. */
  newCharacter: 'imbalanced' | 'balanced'
  /** Direction of new imbalance (if applicable). */
  bias: ZoneBias
  /** Strength metric (0-100). */
  strength: number
}

/**
 * Premium Zone (above fair value / moving average).
 * Area where price is considered overextended.
 */
export interface PremiumZone {
  type: 'premium-zone'
  /** Reference level (e.g., 50-SMA, 200-SMA). */
  referenceLevel: number
  referenceType: '50-sma' | '200-sma' | 'vwap' | 'other'
  /** Top of premium zone. */
  zoneHigh: number
  /** Bottom (reference level). */
  zoneLow: number
  zoneHeight: number
  /** When premium zone started. */
  startBarIndex: number
  startTime: number
  /** When price exited premium. */
  endBarIndex?: number
  endTime?: number
  /** True if price is currently in premium. */
  isActive: boolean
  /** Time in premium (bars). */
  durationBars: number
}

/**
 * Discount Zone (below fair value / moving average).
 * Area where price is considered underbought.
 */
export interface DiscountZone {
  type: 'discount-zone'
  /** Reference level. */
  referenceLevel: number
  referenceType: '50-sma' | '200-sma' | 'vwap' | 'other'
  /** Top (reference level). */
  zoneHigh: number
  /** Bottom of discount zone. */
  zoneLow: number
  zoneHeight: number
  /** When discount zone started. */
  startBarIndex: number
  startTime: number
  /** When price exited discount. */
  endBarIndex?: number
  endTime?: number
  /** True if price is currently in discount. */
  isActive: boolean
  /** Time in discount (bars). */
  durationBars: number
}

/**
 * Equal Highs Zone.
 * Multiple peaks at approximately the same level.
 */
export interface EqualHighs {
  type: 'equal-highs'
  /** Price level of the equals. */
  levelPrice: number
  /** Bar indices of each high. */
  barIndices: number[]
  times: number[]
  /** Number of equal touches. */
  touchCount: number
  /** Price tolerance (±%). */
  tolerance: number
  /** Bias: 'bearish' = resistance, 'neutral' if contested. */
  bias: ZoneBias
  /** First and last touch indices. */
  firstBarIndex: number
  lastBarIndex: number
  firstTime: number
  lastTime: number
}

/**
 * Equal Lows Zone.
 * Multiple troughs at approximately the same level.
 */
export interface EqualLows {
  type: 'equal-lows'
  /** Price level of the equals. */
  levelPrice: number
  /** Bar indices of each low. */
  barIndices: number[]
  times: number[]
  /** Number of equal touches. */
  touchCount: number
  /** Price tolerance (±%). */
  tolerance: number
  /** Bias: 'bullish' = support, 'neutral' if contested. */
  bias: ZoneBias
  /** First and last touch indices. */
  firstBarIndex: number
  lastBarIndex: number
  firstTime: number
  lastTime: number
}

/** Union of all SMC zone types. */
export type SMCZone =
  | LiquiditySweep
  | FairValueGap
  | OrderBlock
  | MarketStructureShift
  | ChangeOfCharacter
  | PremiumZone
  | DiscountZone
  | EqualHighs
  | EqualLows

/** Configuration for SMC detection. */
export interface SMCDetectionOptions {
  /** Lookback window (bars). Default: 200. */
  lookback?: number
  /** Price tolerance for equal levels (%). Default: 0.3%. */
  priceTolerance?: number
  /** Minimum touches for equal highs/lows. Default: 2. */
  minEqualTouches?: number
  /** SMA periods for premium/discount zones. Default: [50, 200]. */
  smaPeriods?: number[]
  /** Minimum candle count for order block. Default: 3. */
  minOBWidth?: number
  /** Minimum body size for order block identification (% of candle). Default: 0.3. */
  minBodyPercent?: number
}

/** Aggregated SMC detection results. */
export interface SMCDetectionResults {
  /** All detected zones. */
  zones: SMCZone[]
  /** Zones grouped by type. */
  byType: Partial<Record<SMCZoneType, SMCZone[]>>
  /** Most recent/active zones. */
  activeZones: SMCZone[]
  /** Unmitigated zones (for order blocks, FVGs). */
  unmitigatedZones: SMCZone[]
  /** Summary stats. */
  summary: {
    totalZones: number
    activeZonesCount: number
    unmitigatedCount: number
    bullishZones: number
    bearishZones: number
  }
}

/** Scoring breakdown for transparency. */
export interface SMCScores {
  /** [0,30] Formation quality. */
  formation: number
  /** [0,30] Recency. */
  recency: number
  /** [0,20] Mitigation status / strength. */
  strength: number
  /** [0,20] Context (inside trend, against trend, etc). */
  context: number
  /** Sum (0-100). */
  total: number
}
