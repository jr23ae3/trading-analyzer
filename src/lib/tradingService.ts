/**
 * Paper Trading Service
 *
 * Handles trade calculations, position sizing, and metrics
 */

import type { Trade, TradeLevel, TradeMetrics, TradeDirection } from './tradingTypes'

/**
 * Calculate risk (distance from entry to stop loss in price units)
 */
export function calculateRisk(entry: number, stopLoss: number): number {
  return Math.abs(entry - stopLoss)
}

/**
 * Calculate reward (distance from entry to target in price units)
 */
export function calculateReward(entry: number, target: number): number {
  return Math.abs(target - entry)
}

/**
 * Calculate risk/reward ratio
 */
export function calculateRiskRewardRatio(risk: number, reward: number): number {
  if (risk === 0) return 0
  return reward / risk
}

/**
 * Calculate position size based on account risk
 */
export function calculatePositionSize(
  entry: number,
  stopLoss: number,
  accountSize: number,
  riskPercentage: number,
): number {
  const risk = calculateRisk(entry, stopLoss)
  if (risk === 0) return 0

  const riskAmount = accountSize * (riskPercentage / 100)
  const positionSize = riskAmount / risk

  return Math.round(positionSize * 100) / 100 // Round to 2 decimals
}

/**
 * Calculate PL based on exit price
 */
export function calculatePL(
  direction: TradeDirection,
  entry: number,
  exitPrice: number,
  positionSize: number,
): number {
  const priceDiff = exitPrice - entry
  const pl = direction === 'long' ? priceDiff * positionSize : -priceDiff * positionSize
  return Math.round(pl * 100) / 100
}

/**
 * Determine if entry point is valid for long/short
 */
export function isValidEntry(
  direction: TradeDirection,
  entry: number,
  stopLoss: number,
  target: number,
): boolean {
  if (direction === 'long') {
    // For long: entry > stop, target > entry
    return entry > stopLoss && target > entry
  } else {
    // For short: entry < stop, target < entry
    return entry < stopLoss && target < entry
  }
}

/**
 * Create a new trade object
 */
export function createTrade(
  symbol: string,
  direction: TradeDirection,
  entry: TradeLevel,
  stopLoss: TradeLevel,
  target: TradeLevel,
  accountSize: number,
  riskPercentage: number,
): Trade {
  const risk = calculateRisk(entry.price, stopLoss.price)
  const reward = calculateReward(entry.price, target.price)
  const riskRewardRatio = calculateRiskRewardRatio(risk, reward)
  const positionSize = calculatePositionSize(entry.price, stopLoss.price, accountSize, riskPercentage)
  const riskAmount = accountSize * (riskPercentage / 100)
  const rewardAmount = (reward / risk) * riskAmount

  return {
    id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    symbol,
    direction,
    status: 'pending',
    entry,
    stopLoss,
    target,
    risk,
    reward,
    riskRewardRatio,
    positionSize,
    riskAmount,
    rewardAmount,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * Update trade with exit information
 */
export function updateTradeExit(
  trade: Trade,
  exitPrice: number,
  exitBarIndex: number,
  winProbability?: number,
): Trade {
  const actualPL = calculatePL(trade.direction, trade.entry.price, exitPrice, trade.positionSize)

  let result: 'win' | 'loss' | 'break-even' = 'break-even'
  if (actualPL > 0) result = 'win'
  else if (actualPL < 0) result = 'loss'

  return {
    ...trade,
    status: 'closed',
    result,
    exitPrice,
    exitBarIndex,
    exitTimestamp: Date.now(),
    actualPL,
    winProbability,
    updatedAt: Date.now(),
  }
}

/**
 * Calculate trade metrics from trade array
 */
export function calculateTradeMetrics(trades: Trade[]): TradeMetrics {
  const closedTrades = trades.filter((t) => t.status === 'closed')

  if (closedTrades.length === 0) {
    return {
      totalTrades: trades.length,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      averageRR: 0,
      totalPL: 0,
      maxDrawdown: 0,
    }
  }

  const wins = closedTrades.filter((t) => t.result === 'win')
  const losses = closedTrades.filter((t) => t.result === 'loss')
  const breakEven = closedTrades.filter((t) => t.result === 'break-even')

  const totalPL = closedTrades.reduce((sum, t) => sum + (t.actualPL ?? 0), 0)
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.actualPL ?? 0), 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + (t.actualPL ?? 0), 0) / losses.length : 0
  const avgRR = trades.reduce((sum, t) => sum + t.riskRewardRatio, 0) / trades.length

  // Calculate max drawdown
  let maxDrawdown = 0
  let runningPL = 0
  let peakPL = 0

  for (const trade of closedTrades.sort((a, b) => a.createdAt - b.createdAt)) {
    runningPL += trade.actualPL ?? 0
    if (runningPL > peakPL) peakPL = runningPL
    const drawdown = peakPL - runningPL
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: breakEven.length,
    winRate: (wins.length / closedTrades.length) * 100,
    averageWin: Math.round(avgWin * 100) / 100,
    averageLoss: Math.round(avgLoss * 100) / 100,
    averageRR: Math.round(avgRR * 100) / 100,
    totalPL: Math.round(totalPL * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
  }
}
