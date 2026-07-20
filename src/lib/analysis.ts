/**
 * Automatic Support & Resistance Detector
 *
 * Pipeline:
 *   1. Compute ATR14 for adaptive zone sizing
 *   2. Detect swing high / low pivots
 *   3. Cluster nearby pivots into price zones (ATR-based proximity)
 *   4. Scan all bars for zone touches and measure reactions
 *   5. Score each zone on four independent dimensions
 *   6. Return sorted levels with confidence 0–100
 */

import type { OHLCVBar } from '@/types'

// ─── Public types ──────────────────────────────────────────────────────────────

/** A single recorded touch of a support/resistance zone. */
export interface SRTouch {
  /** Bar index in the input array. */
  barIndex:     number
  /** Unix timestamp (seconds). */
  time:         number
  /** Actual price that contacted the zone (high or low). */
  touchPrice:   number
  /** Volume of the touch bar. */
  volume:       number
  /** Price approached the zone from above (support test) or below (resistance test). */
  approachFrom: 'above' | 'below'
  /**
   * Maximum favourable price move from the zone in the next `reactionLookAhead` bars.
   * Expressed as a multiple of ATR (0 = no reaction, 2 = 2×ATR bounce).
   */
  reactionATR:  number
  /** Bars until the reaction peaked (or the look-ahead window expired). */
  reactionBars: number
}

/** Breakdown of the four scoring dimensions. */
export interface SRScore {
  /** 0–40: more touches → higher score. Saturates at 5 touches. */
  touches:  number
  /** 0–20: touch-bar volume relative to the series average. */
  volume:   number
  /** 0–20: exponential decay from the most recent touch. */
  recency:  number
  /** 0–20: average bounce size from the zone in units of ATR. */
  reaction: number
  /** Sum of all dimensions (0–100). */
  total:    number
}

/** A merged support/resistance price zone with full metadata. */
export interface SRLevel {
  /** Unique identifier — `sr-{round(price*100)}`. */
  id:               string
  /** Weighted-average representative price. */
  price:            number
  /** Upper bound of the zone (price + 0.5 × zone width). */
  priceHigh:        number
  /** Lower bound of the zone (price - 0.5 × zone width). */
  priceLow:         number
  /**
   * Level role:
   *  - `support`    — price approached from above the majority of the time
   *  - `resistance` — price approached from below the majority of the time
   *  - `both`       — roughly equal, i.e. a flipped S/R zone
   */
  type:             'support' | 'resistance' | 'both'
  /** All individual touches recorded. */
  touches:          SRTouch[]
  touchCount:       number
  /** Timestamp of the first recorded touch. */
  firstSeen:        number
  /** Timestamp of the most recent touch. */
  lastSeen:         number
  /** Bar index of the first touch (for recency decay). */
  firstSeenIndex:   number
  /** Bar index of the most recent touch. */
  lastSeenIndex:    number
  /** Average volume across all touch bars. */
  avgVolume:        number
  /** Largest reaction seen from this zone (in ATR multiples). */
  maxReaction:      number
  /** Mean reaction across all touches (in ATR multiples). */
  avgReaction:      number
  /** Breakdown scores for each dimension. */
  score:            SRScore
  /** Composite confidence 0–100. */
  confidence:       number
}

/** Configuration options for `detectSupportResistance`. */
export interface SROptions {
  /**
   * Bars to the left of a pivot that must be lower (high pivot) or higher (low pivot).
   * @default 3
   */
  leftBars?:          number
  /**
   * Bars to the right (confirmed lookahead).
   * @default 3
   */
  rightBars?:         number
  /**
   * Zone half-width = `zoneAtrMultiple × ATR14`.
   * Two pivots closer than this are merged.
   * @default 0.4
   */
  zoneAtrMultiple?:   number
  /**
   * Minimum zone as a fraction of price (floor for low-volatility instruments).
   * @default 0.0015
   */
  minZonePercent?:    number
  /**
   * Minimum number of touches required to include a level in the output.
   * @default 1
   */
  minTouches?:        number
  /**
   * Bars to look ahead when measuring reaction size.
   * @default 10
   */
  reactionLookAhead?: number
  /**
   * Minimum bars between two consecutive touches of the same zone.
   * Prevents double-counting multi-bar consolidations.
   * @default 3
   */
  touchGapBars?:      number
}

// ─── Main function ─────────────────────────────────────────────────────────────

/**
 * Detect support and resistance levels from OHLCV bars.
 *
 * Returns levels sorted descending by confidence.
 *
 * @example
 * ```ts
 * const levels = detectSupportResistance(bars, { minTouches: 2 })
 * // → SRLevel[] sorted by confidence desc
 * ```
 */
export function detectSupportResistance(
  bars:    OHLCVBar[],
  options: SROptions = {},
): SRLevel[] {
  const {
    leftBars          = 3,
    rightBars         = 3,
    zoneAtrMultiple   = 0.4,
    minZonePercent    = 0.0015,
    minTouches        = 1,
    reactionLookAhead = 10,
    touchGapBars      = 3,
  } = options

  const n = bars.length
  if (n < leftBars + rightBars + 2) return []

  // ── Step 1: Adaptive zone size ─────────────────────────────────────────────
  const atrs   = computeATR14(bars)
  const medATR = median(atrs.filter((v) => v > 0))
  const medPrice = median(bars.map((b) => b.close))
  const globalAvgVol = bars.reduce((s, b) => s + b.volume, 0) / n

  // Half-width of each zone
  const zoneHalf = Math.max(medATR * zoneAtrMultiple, medPrice * minZonePercent)

  // ── Step 2: Find swing pivots ──────────────────────────────────────────────
  const pivots = findSwingPivots(bars, leftBars, rightBars)

  if (!pivots.length) return []

  // ── Step 3: Cluster pivots into zones ──────────────────────────────────────
  const clusters = clusterPivots(pivots, zoneHalf * 2)

  // ── Step 4: Scan for touches & reactions ──────────────────────────────────
  const levels: SRLevel[] = []

  for (const cluster of clusters) {
    const price = weightedMeanPrice(cluster)
    const ph    = price + zoneHalf
    const pl    = price - zoneHalf

    const touches = scanTouches(bars, price, pl, ph, touchGapBars, reactionLookAhead, atrs)
    if (touches.length < minTouches) continue

    const type      = classifyType(touches)
    const avgVol    = touches.reduce((s, t) => s + t.volume, 0) / touches.length
    const maxRxn    = Math.max(...touches.map((t) => t.reactionATR))
    const avgRxn    = touches.reduce((s, t) => s + t.reactionATR, 0) / touches.length
    const firstIdx  = touches[0].barIndex
    const lastIdx   = touches[touches.length - 1].barIndex

    const score = computeScore({
      touchCount:  touches.length,
      avgVol,
      globalAvgVol,
      lastTouchIndex: lastIdx,
      totalBars:   n,
      avgReaction: avgRxn,
    })

    levels.push({
      id:             `sr-${Math.round(price * 100)}`,
      price,
      priceHigh:      ph,
      priceLow:       pl,
      type,
      touches,
      touchCount:     touches.length,
      firstSeen:      bars[firstIdx].time,
      lastSeen:       bars[lastIdx].time,
      firstSeenIndex: firstIdx,
      lastSeenIndex:  lastIdx,
      avgVolume:      avgVol,
      maxReaction:    maxRxn,
      avgReaction:    avgRxn,
      score,
      confidence:     score.total,
    })
  }

  // Sort descending by confidence
  return levels.sort((a, b) => b.confidence - a.confidence)
}

// ─── Step 2 helper: swing pivot detection ─────────────────────────────────────

interface Pivot {
  barIndex: number
  price:    number
  kind:     'high' | 'low'
  volume:   number
}

function findSwingPivots(bars: OHLCVBar[], left: number, right: number): Pivot[] {
  const pivots: Pivot[] = []
  const n = bars.length

  for (let i = left; i < n - right; i++) {
    const bar = bars[i]

    // Pivot high: strictly highest high on the left, >= on the right (handles ties)
    let isHigh = true
    for (let j = 1; j <= left;  j++) if (bars[i - j].high >= bar.high) { isHigh = false; break }
    if (isHigh) for (let j = 1; j <= right; j++) if (bars[i + j].high >  bar.high) { isHigh = false; break }

    if (isHigh) pivots.push({ barIndex: i, price: bar.high, kind: 'high', volume: bar.volume })

    // Pivot low
    let isLow = true
    for (let j = 1; j <= left;  j++) if (bars[i - j].low <= bar.low) { isLow = false; break }
    if (isLow)  for (let j = 1; j <= right; j++) if (bars[i + j].low  <  bar.low)  { isLow = false; break }

    if (isLow) pivots.push({ barIndex: i, price: bar.low, kind: 'low', volume: bar.volume })
  }

  return pivots
}

// ─── Step 3 helper: cluster nearby pivots ─────────────────────────────────────

function clusterPivots(pivots: Pivot[], mergeWidth: number): Pivot[][] {
  // Sort by price ascending
  const sorted = [...pivots].sort((a, b) => a.price - b.price)
  const clusters: Pivot[][] = []
  let current: Pivot[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i]
    const clusterMid = current.reduce((s, c) => s + c.price, 0) / current.length
    if (Math.abs(p.price - clusterMid) <= mergeWidth) {
      current.push(p)
    } else {
      clusters.push(current)
      current = [p]
    }
  }
  clusters.push(current)
  return clusters
}

// ─── Step 4 helper: scan bar history for touches ──────────────────────────────

function scanTouches(
  bars:           OHLCVBar[],
  price:          number,
  priceLow:       number,
  priceHigh:      number,
  gapBars:        number,
  lookAhead:      number,
  atrs:           number[],
): SRTouch[] {
  const touches: SRTouch[] = []
  let lastTouchIdx = -Infinity

  for (let i = 3; i < bars.length; i++) {
    const bar = bars[i]
    // The bar's range must overlap the zone
    if (bar.high < priceLow || bar.low > priceHigh) continue
    // Enforce gap between touches
    if (i - lastTouchIdx < gapBars) continue

    // Determine touch price (closer of high/low to zone centre)
    const touchPrice = Math.abs(bar.high - price) < Math.abs(bar.low - price)
      ? bar.high
      : bar.low

    // Approach direction: look 3 bars back for the pre-touch context
    const lookBackBar = bars[Math.max(0, i - 3)]
    const approachFrom: 'above' | 'below' = lookBackBar.close > price ? 'above' : 'below'

    // Reaction: max favourable excursion in next `lookAhead` bars
    const { reactionATR, reactionBars } = measureReaction(
      bars, i, price, approachFrom, lookAhead, atrs[i] || 1,
    )

    touches.push({ barIndex: i, time: bar.time, touchPrice, volume: bar.volume, approachFrom, reactionATR, reactionBars })
    lastTouchIdx = i
  }

  return touches
}

function measureReaction(
  bars:         OHLCVBar[],
  touchIdx:     number,
  levelPrice:   number,
  approachFrom: 'above' | 'below',
  lookAhead:    number,
  atr:          number,
): { reactionATR: number; reactionBars: number } {
  let bestMove    = 0
  let bestBar     = 0
  const end       = Math.min(touchIdx + lookAhead, bars.length - 1)

  for (let j = touchIdx + 1; j <= end; j++) {
    const bar = bars[j]
    // Favourable move = away from the level in the expected bounce direction
    const move = approachFrom === 'above'
      ? bar.high - levelPrice   // support bounce: price moves up
      : levelPrice - bar.low    // resistance rejection: price moves down

    if (move > bestMove) { bestMove = move; bestBar = j - touchIdx }
  }

  return {
    reactionATR:  atr > 0 ? bestMove / atr : 0,
    reactionBars: bestBar,
  }
}

// ─── Step 5 helper: classify type ─────────────────────────────────────────────

function classifyType(touches: SRTouch[]): 'support' | 'resistance' | 'both' {
  const above = touches.filter((t) => t.approachFrom === 'above').length
  const below = touches.filter((t) => t.approachFrom === 'below').length
  const total = touches.length
  if (above / total >= 0.65) return 'support'
  if (below / total >= 0.65) return 'resistance'
  return 'both'
}

// ─── Step 5 helper: compute scores ────────────────────────────────────────────

function computeScore(p: {
  touchCount:     number
  avgVol:         number
  globalAvgVol:   number
  lastTouchIndex: number
  totalBars:      number
  avgReaction:    number
}): SRScore {
  // Touch score: 8 pts per touch, max 40 (5 touches = max)
  const touchScore = Math.min(40, p.touchCount * 8)

  // Volume score: how elevated was touch-bar volume vs series average
  const volRatio   = p.globalAvgVol > 0 ? p.avgVol / p.globalAvgVol : 1
  const volumeScore = Math.min(20, volRatio * 10)

  // Recency score: exponential decay; half-life = 30% of total bars
  const barsSinceLast  = p.totalBars - 1 - p.lastTouchIndex
  const halfLifeBars   = Math.max(1, p.totalBars * 0.30)
  const recencyScore   = 20 * Math.exp(-barsSinceLast / halfLifeBars)

  // Reaction score: avg reaction in ATR multiples; 4 ATRs = max
  const reactionScore = Math.min(20, p.avgReaction * 5)

  const total = Math.round(
    Math.min(100, touchScore + volumeScore + recencyScore + reactionScore),
  )

  return {
    touches:  Math.round(touchScore),
    volume:   Math.round(volumeScore),
    recency:  Math.round(recencyScore),
    reaction: Math.round(reactionScore),
    total,
  }
}

// ─── ATR computation ──────────────────────────────────────────────────────────

/** Returns ATR14 array, index-aligned with bars. Null entries filled with last known value. */
function computeATR14(bars: OHLCVBar[]): number[] {
  const period = 14
  const trs: number[] = bars.map((b, i) => {
    const pc = i === 0 ? b.open : bars[i - 1].close
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc))
  })

  const atrs: number[] = new Array(bars.length).fill(0)
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  atrs[period - 1] = atr
  for (let i = period; i < bars.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
    atrs[i] = atr
  }
  // Back-fill initial zeroes with the first computed ATR
  for (let i = 0; i < period - 1; i++) atrs[i] = atrs[period - 1]
  return atrs
}

// ─── Statistical helpers ──────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function weightedMeanPrice(pivots: Pivot[]): number {
  const totalVol = pivots.reduce((s, p) => s + p.volume, 0)
  if (totalVol === 0) return pivots.reduce((s, p) => s + p.price, 0) / pivots.length
  return pivots.reduce((s, p) => s + p.price * p.volume, 0) / totalVol
}

