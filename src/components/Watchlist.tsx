import { useState, useMemo } from 'react'
import { useWatchlist } from '@/context'
import { useChartStore } from '@/store'
import { cn } from '@/utils'
import type { Symbol } from '@/types'

// Popular stocks with TradingView-compatible symbols
const POPULAR_STOCKS = [
  { ticker: 'AAPL', exchange: 'NASDAQ', name: 'Apple' },
  { ticker: 'MSFT', exchange: 'NASDAQ', name: 'Microsoft' },
  { ticker: 'GOOGL', exchange: 'NASDAQ', name: 'Alphabet' },
  { ticker: 'AMZN', exchange: 'NASDAQ', name: 'Amazon' },
  { ticker: 'TSLA', exchange: 'NASDAQ', name: 'Tesla' },
  { ticker: 'NVDA', exchange: 'NASDAQ', name: 'NVIDIA' },
  { ticker: 'META', exchange: 'NASDAQ', name: 'Meta' },
  { ticker: 'NFLX', exchange: 'NASDAQ', name: 'Netflix' },
  { ticker: 'SPY', exchange: 'NASDAQ', name: 'S&P 500 ETF' },
  { ticker: 'QQQ', exchange: 'NASDAQ', name: 'Nasdaq ETF' },
  { ticker: 'IWM', exchange: 'NYSE', name: 'Russell 2000' },
  { ticker: 'TLT', exchange: 'NASDAQ', name: '20+ Year Treasury' },
  { ticker: 'GLD', exchange: 'NASDAQ', name: 'Gold ETF' },
  { ticker: 'USO', exchange: 'NYSE', name: 'Oil ETF' },
  { ticker: 'UUP', exchange: 'NYSE', name: 'Dollar ETF' },
]

export function Watchlist() {
  const { watchlist, addSymbol, removeSymbol } = useWatchlist()
  const activeSymbol = useChartStore((s) => s.activeSymbol)
  const setActiveSymbol = useChartStore((s) => s.setActiveSymbol)

  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  // Filter popular stocks to show suggestions (excluding already added ones)
  const suggestions = useMemo(() => {
    const addedTickers = new Set(watchlist.map(w => w.symbol.ticker))
    return POPULAR_STOCKS.filter(stock => 
      !addedTickers.has(stock.ticker) && 
      (search === '' || stock.ticker.includes(search.toUpperCase()) || stock.name.toUpperCase().includes(search.toUpperCase()))
    ).slice(0, 5)
  }, [search, watchlist])

  const handleAddSuggestion = (stock: typeof POPULAR_STOCKS[0]) => {
    const newSymbol: Symbol = {
      ticker: stock.ticker,
      name: stock.name,
      exchange: stock.exchange,
      type: 'stock',
    }
    addSymbol(newSymbol)
    setActiveSymbol(stock.ticker)
    setSearch('')
    setShowForm(false)
  }

  const handleCustomAdd = () => {
    if (search.trim()) {
      const ticker = search.toUpperCase()
      const newSymbol: Symbol = {
        ticker,
        name: ticker,
        exchange: 'NASDAQ',
        type: 'stock',
      }
      addSymbol(newSymbol)
      setActiveSymbol(ticker)
      setSearch('')
      setShowForm(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Watchlist
      </h3>

      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {watchlist.map(({ symbol }) => (
          <div
            key={symbol.ticker}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors text-xs',
              activeSymbol === symbol.ticker
                ? 'bg-blue-600/20 text-white'
                : 'text-slate-300 hover:bg-slate-700',
            )}
            onClick={() => setActiveSymbol(symbol.ticker)}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{symbol.ticker}</p>
              <p className="text-slate-500 text-xs truncate">{symbol.exchange}</p>
            </div>
            <button
              onClick={(e) => { 
                e.stopPropagation()
                removeSymbol(symbol.ticker) 
              }}
              className="ml-2 text-slate-600 hover:text-red-400 flex-shrink-0"
              aria-label={`Remove ${symbol.ticker}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="mx-3 px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded transition-colors"
        >
          + Add Symbol
        </button>
      ) : (
        <div className="px-3 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                if (suggestions.length > 0) {
                  handleAddSuggestion(suggestions[0])
                } else {
                  handleCustomAdd()
                }
              }
            }}
            placeholder="Search stocks..."
            className="w-full px-2 py-1 text-xs bg-slate-700 text-white placeholder-slate-500 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
          
          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="bg-slate-800 border border-slate-600 rounded overflow-hidden max-h-32 overflow-y-auto">
              {suggestions.map((stock) => (
                <button
                  key={stock.ticker}
                  onClick={() => handleAddSuggestion(stock)}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-700 border-b border-slate-700 last:border-b-0 text-xs transition-colors"
                >
                  <div className="font-medium text-white">{stock.ticker}</div>
                  <div className="text-slate-400 text-xs">{stock.name}</div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1">
            <button
              onClick={() => {
                if (suggestions.length > 0) {
                  handleAddSuggestion(suggestions[0])
                } else {
                  handleCustomAdd()
                }
              }}
              disabled={!search.trim()}
              className="flex-1 px-2 py-1 text-xs bg-green-600/30 hover:bg-green-600/40 disabled:bg-slate-700 disabled:cursor-not-allowed text-green-300 disabled:text-slate-500 rounded transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowForm(false)
                setSearch('')
              }}
              className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
