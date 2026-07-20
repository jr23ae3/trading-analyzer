import type { TradeEntry } from '@/types'

export interface JournalStats {
  totalTrades: number
  openTrades: number
  closedTrades: number
  totalPnL: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
}

export function calcJournalStats(trades: TradeEntry[]): JournalStats {
  const closed = trades.filter((t) => t.status === 'closed')
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0)
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0)

  const totalPnL = closed.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const totalWins = wins.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0))

  return {
    totalTrades: trades.length,
    openTrades: trades.filter((t) => t.status === 'open').length,
    closedTrades: closed.length,
    totalPnL,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    avgWin: wins.length ? totalWins / wins.length : 0,
    avgLoss: losses.length ? totalLosses / losses.length : 0,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : 0,
  }
}
