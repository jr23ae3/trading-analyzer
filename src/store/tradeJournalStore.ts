import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { TradeEntry } from '@/types'

export interface JournalFilters {
  dateFrom?: string       // YYYY-MM-DD
  dateTo?: string         // YYYY-MM-DD
  strategy?: string
  symbol?: string
  resultType?: 'all' | 'wins' | 'losses'
}

interface TradeJournalState {
  trades: TradeEntry[]
  filters: JournalFilters

  // ── Actions ────────────────────────────────────────────────────────────────
  addTrade: (trade: Omit<TradeEntry, 'id'>) => void
  updateTrade: (id: string, patch: Partial<TradeEntry>) => void
  closeTrade: (id: string, exitPrice: number, exitDate: string) => void
  deleteTrade: (id: string) => void

  // ── Filtering ──────────────────────────────────────────────────────────────
  setFilters: (filters: JournalFilters) => void
  clearFilters: () => void
  getFilteredTrades: () => TradeEntry[]

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

function matchesFilters(trade: TradeEntry, filters: JournalFilters): boolean {
  // Date filtering
  if (filters.dateFrom) {
    const tradeDate = trade.entryDate.split('T')[0]
    if (tradeDate < filters.dateFrom) return false
  }
  if (filters.dateTo) {
    const tradeDate = trade.entryDate.split('T')[0]
    if (tradeDate > filters.dateTo) return false
  }

  // Strategy filtering
  if (filters.strategy && trade.strategy !== filters.strategy) {
    return false
  }

  // Symbol filtering
  if (filters.symbol && trade.symbol !== filters.symbol) {
    return false
  }

  // Result type filtering (only for closed trades)
  if (filters.resultType && filters.resultType !== 'all' && trade.status === 'closed') {
    const pnl = trade.pnl ?? 0
    if (filters.resultType === 'wins' && pnl <= 0) return false
    if (filters.resultType === 'losses' && pnl >= 0) return false
  }

  return true
}

export const useTradeJournalStore = create<TradeJournalState>()(
  devtools(
    persist(
      (set, get) => ({
        trades: [],
        filters: {},

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

        setFilters: (filters) =>
          set((state) => ({ filters: { ...state.filters, ...filters } }), false, 'setFilters'),

        clearFilters: () =>
          set({ filters: {} }, false, 'clearFilters'),

        getFilteredTrades: () => {
          const { trades, filters } = get()
          return trades.filter((t) => matchesFilters(t, filters))
        },

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
