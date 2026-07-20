// ─── Timeframe ────────────────────────────────────────────────────────────────
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M'

// ─── Theme ────────────────────────────────────────────────────────────────────
export type Theme = 'dark' | 'light'

// ─── Symbol ───────────────────────────────────────────────────────────────────
export interface Symbol {
  ticker: string
  name: string
  exchange: string
  type: 'stock' | 'crypto' | 'forex' | 'futures' | 'index'
}

// ─── OHLCV ────────────────────────────────────────────────────────────────────
export interface OHLCVBar {
  time: number   // Unix timestamp (seconds)
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ─── Indicators ───────────────────────────────────────────────────────────────
export type IndicatorType =
  | 'SMA' | 'EMA' | 'VWAP' | 'RSI' | 'MACD'
  | 'ATR' | 'ADX' | 'BB' | 'VP' | 'AVWAP'

export interface IndicatorSetting {
  id: string
  type: IndicatorType
  enabled: boolean
  params: Record<string, number | string | boolean>
  color?: string
}

// ─── Watchlist ─────────────────────────────────────────────────────────────────
export interface WatchlistItem {
  symbol: Symbol
  alertPrice?: number
}

// ─── Trade Journal ────────────────────────────────────────────────────────────
export type TradeDirection = 'long' | 'short'
export type TradeStatus = 'open' | 'closed' | 'cancelled'
export type TradeGrade = 'A+' | 'A' | 'B' | 'C' | 'AVOID'
export type EmotionType = 'confident' | 'neutral' | 'nervous' | 'greedy' | 'fearful' | 'disciplined'

export interface TradeEntry {
  id: string
  symbol: string
  direction: TradeDirection
  status: TradeStatus
  entryPrice: number
  exitPrice?: number
  quantity: number
  entryDate: string   // ISO 8601
  exitDate?: string
  stopLoss?: number
  takeProfit?: number
  pnl?: number
  notes?: string
  tags?: string[]
  
  // ── Journal Extensions ────────────────────────────────────────────────────
  screenshotBase64?: string     // Base64 encoded image
  screenshotDataURL?: string    // Data URL for img src
  setup?: string                // Setup description
  grade?: TradeGrade            // Trade grade A+ to AVOID
  emotions?: EmotionType[]      // Emotions during trade
  mistakes?: string[]           // What went wrong
  strategy?: string             // Strategy name/type
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

/** @deprecated Use SRLevel from lib/analysis instead. */
export interface SupportResistanceLevel {
  price: number
  strength: 'weak' | 'moderate' | 'strong'
  touches: number
}

export interface TrendLine {
  id: string
  startTime: number
  startPrice: number
  endTime: number
  endPrice: number
  color: string
}
