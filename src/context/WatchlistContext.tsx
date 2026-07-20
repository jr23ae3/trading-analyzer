import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { WatchlistItem, Symbol } from '@/types'

interface WatchlistContextValue {
  watchlist: WatchlistItem[]
  addSymbol: (symbol: Symbol) => void
  removeSymbol: (ticker: string) => void
  setAlertPrice: (ticker: string, price: number | undefined) => void
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null)

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([
    { symbol: { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'stock' } },
    { symbol: { ticker: 'BTC/USDT', name: 'Bitcoin', exchange: 'Binance', type: 'crypto' } },
  ])

  const addSymbol = useCallback((symbol: Symbol) => {
    setWatchlist(prev =>
      prev.some(w => w.symbol.ticker === symbol.ticker) ? prev : [...prev, { symbol }],
    )
  }, [])

  const removeSymbol = useCallback((ticker: string) => {
    setWatchlist(prev => prev.filter(w => w.symbol.ticker !== ticker))
  }, [])

  const setAlertPrice = useCallback((ticker: string, price: number | undefined) => {
    setWatchlist(prev =>
      prev.map(w => (w.symbol.ticker === ticker ? { ...w, alertPrice: price } : w)),
    )
  }, [])

  return (
    <WatchlistContext.Provider value={{ watchlist, addSymbol, removeSymbol, setAlertPrice }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext)
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider')
  return ctx
}
