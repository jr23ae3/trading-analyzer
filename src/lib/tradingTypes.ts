/**
 * Paper Trading Types
 *
 * Complete type definitions for paper trading engine:
 * - Trade structures (entry, stop, target)
 * - Trade status and results
 * - Risk/reward calculations
 */

export type TradeStatus = 'pending' | 'active' | 'closed' | 'cancelled'
export type TradeResult = 'win' | 'loss' | 'break-even' | 'pending'
export type TradeDirection = 'long' | 'short'

/** Trade entry/stop/target level. */
export interface TradeLevel {
  price: number
  barIndex: number
  timestamp: number
}

/** Complete trade record. */
export interface Trade {
  id: string
  symbol: string
  direction: TradeDirection
  status: TradeStatus
  result?: TradeResult

  // Price levels
  entry: TradeLevel
  stopLoss: TradeLevel
  target: TradeLevel

  // Calculated metrics
  risk: number // In price units
  reward: number // In price units
  riskRewardRatio: number // reward / risk

  // Position sizing
  positionSize: number // Number of shares/contracts
  riskAmount: number // $ amount at risk
  rewardAmount: number // $ potential reward

  // Exit (if closed)
  exitPrice?: number
  exitBarIndex?: number
  exitTimestamp?: number
  actualPL?: number // Actual profit/loss in $
  winProbability?: number // Win % based on probability engine

  // Metadata
  createdAt: number
  updatedAt: number
  notes?: string
}

/** Trade settings/options. */
export interface TradeSettings {
  accountSize: number // Total account balance ($)
  riskPerTrade: number // Risk % per trade (e.g., 2 = 2%)
  defaultPositionSize?: number // Override position calc
}

/** Trade metrics summary. */
export interface TradeMetrics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  breakEvenTrades: number
  winRate: number // percentage
  averageWin: number
  averageLoss: number
  averageRR: number
  totalPL: number
  maxDrawdown: number
}

/** Trade history response. */
export interface TradeHistory {
  trades: Trade[]
  metrics: TradeMetrics
}
