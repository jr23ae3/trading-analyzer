import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Trade, TradeMetrics, TradeSettings } from '@/lib/tradingTypes'
import { calculateTradeMetrics } from '@/lib/tradingService'

interface TradeStore {
  // State
  trades: Trade[]
  activeTrade: Trade | null
  settings: TradeSettings
  metrics: TradeMetrics

  // Settings
  updateSettings: (settings: Partial<TradeSettings>) => void

  // Trade management
  setActiveTrade: (trade: Trade | null) => void
  addTrade: (trade: Trade) => void
  updateTrade: (tradeId: string, updates: Partial<Trade>) => void
  closeTrade: (tradeId: string, exitPrice: number) => void
  deleteTrade: (tradeId: string) => void
  cancelTrade: (tradeId: string) => void

  // Queries
  getTradeHistory: () => Trade[]
  getTrade: (tradeId: string) => Trade | undefined
  getMetrics: () => TradeMetrics

  // Import/Export
  exportTrades: () => string
  importTrades: (json: string) => void
  clearAllTrades: () => void
}

const DEFAULT_SETTINGS: TradeSettings = {
  accountSize: 10000,
  riskPerTrade: 2,
}

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      trades: [],
      activeTrade: null,
      settings: DEFAULT_SETTINGS,
      metrics: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        averageRR: 0,
        totalPL: 0,
        maxDrawdown: 0,
      },

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }))
      },

      setActiveTrade: (trade) => {
        set({ activeTrade: trade })
      },

      addTrade: (trade) => {
        set((state) => {
          const trades = [...state.trades, trade]
          const metrics = calculateTradeMetrics(trades)
          return { trades, metrics, activeTrade: trade }
        })
      },

      updateTrade: (tradeId, updates) => {
        set((state) => {
          const trades = state.trades.map((t) => (t.id === tradeId ? { ...t, ...updates, updatedAt: Date.now() } : t))
          const metrics = calculateTradeMetrics(trades)
          return { trades, metrics }
        })
      },

      closeTrade: (tradeId, exitPrice) => {
        set((state) => {
          const trades = state.trades.map((t) => {
            if (t.id === tradeId) {
              const result = exitPrice > t.entry.price ? 'win' : exitPrice < t.entry.price ? 'loss' : 'break-even'
              const actualPL = (exitPrice - t.entry.price) * t.positionSize * (t.direction === 'long' ? 1 : -1)
              return {
                ...t,
                status: 'closed' as const,
                result: result as 'win' | 'loss' | 'break-even',
                exitPrice,
                exitBarIndex: state.activeTrade?.entry.barIndex ?? 0,
                exitTimestamp: Date.now(),
                actualPL: Math.round(actualPL * 100) / 100,
                updatedAt: Date.now(),
              }
            }
            return t
          })
          const metrics = calculateTradeMetrics(trades)
          return { trades, metrics, activeTrade: null }
        })
      },

      deleteTrade: (tradeId) => {
        set((state) => {
          const trades = state.trades.filter((t) => t.id !== tradeId)
          const metrics = calculateTradeMetrics(trades)
          const activeTrade = state.activeTrade?.id === tradeId ? null : state.activeTrade
          return { trades, metrics, activeTrade }
        })
      },

      cancelTrade: (tradeId) => {
        set((state) => {
          const trades = state.trades.map((t) =>
            t.id === tradeId ? { ...t, status: 'cancelled' as const, updatedAt: Date.now() } : t,
          )
          const metrics = calculateTradeMetrics(trades)
          return { trades, metrics }
        })
      },

      getTradeHistory: () => {
        return get().trades
      },

      getTrade: (tradeId) => {
        return get().trades.find((t) => t.id === tradeId)
      },

      getMetrics: () => {
        return get().metrics
      },

      exportTrades: () => {
        const state = get()
        return JSON.stringify({
          trades: state.trades,
          settings: state.settings,
          exportedAt: Date.now(),
        })
      },

      importTrades: (json) => {
        try {
          const data = JSON.parse(json)
          if (data.trades && Array.isArray(data.trades)) {
            set((state) => {
              const trades = [...state.trades, ...data.trades]
              const metrics = calculateTradeMetrics(trades)
              return { trades, metrics }
            })
          }
        } catch (e) {
          console.error('Failed to import trades:', e)
        }
      },

      clearAllTrades: () => {
        set({
          trades: [],
          activeTrade: null,
          metrics: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            breakEvenTrades: 0,
            winRate: 0,
            averageWin: 0,
            averageLoss: 0,
            averageRR: 0,
            totalPL: 0,
            maxDrawdown: 0,
          },
        })
      },
    }),
    {
      name: 'trade-store',
    },
  ),
)
