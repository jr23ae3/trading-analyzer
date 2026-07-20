import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { TradeEntry } from '@/types'

interface TradeJournalState {
  trades: TradeEntry[]

  // ── Actions ────────────────────────────────────────────────────────────────
  addTrade: (trade: Omit<TradeEntry, 'id'>) => void
  updateTrade: (id: string, patch: Partial<TradeEntry>) => void
  closeTrade: (id: string, exitPrice: number, exitDate: string) => void
  deleteTrade: (id: string) => void

  // ── Derived helpers ────────────────────────────────────────────────────────
  getTradesBySymbol: (symbol: string) => TradeEntry[]
  getOpenTrades: () => TradeEntry[]
  getTotalPnL: () => number
  getWinRate: () => number
}

function calcPnL(trade: TradeEntry): number {
  if (!trade.exitPrice) return 0
  const diff = trade.direction === 'long'
    ? trade.exitPrice - trade.entryPrice
    : trade.entryPrice - trade.exitPrice
  return diff * trade.quantity
}

export const useTradeJournalStore = create<TradeJournalState>()(
  devtools(
    persist(
      (set, get) => ({
        trades: [],

        addTrade: (trade) =>
          set(
            (state) => ({
              trades: [
                ...state.trades,
                { ...trade, id: `trade-${Date.now()}` },
              ],
            }),
            false,
            'addTrade',
          ),

        updateTrade: (id, patch) =>
          set(
            (state) => ({
              trades: state.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)),
            }),
            false,
            'updateTrade',
          ),

        closeTrade: (id, exitPrice, exitDate) =>
          set(
            (state) => ({
              trades: state.trades.map((t) => {
                if (t.id !== id) return t
                const closed: TradeEntry = { ...t, exitPrice, exitDate, status: 'closed' }
                return { ...closed, pnl: calcPnL(closed) }
              }),
            }),
            false,
            'closeTrade',
          ),

        deleteTrade: (id) =>
          set(
            (state) => ({ trades: state.trades.filter((t) => t.id !== id) }),
            false,
            'deleteTrade',
          ),

        getTradesBySymbol: (symbol) =>
          get().trades.filter((t) => t.symbol === symbol),

        getOpenTrades: () =>
          get().trades.filter((t) => t.status === 'open'),

        getTotalPnL: () =>
          get().trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0),

        getWinRate: () => {
          const closed = get().trades.filter((t) => t.status === 'closed')
          if (!closed.length) return 0
          const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length
          return (wins / closed.length) * 100
        },
      }),
      { name: 'trade-journal' },
    ),
    { name: 'TradeJournalStore' },
  ),
)
