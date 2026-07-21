import { useState } from 'react'
import { useTradeStore } from '@/store/tradeStore'
import { createTrade, isValidEntry, calculateTradeMetrics } from '@/lib/tradingService'
import { useChartStore } from '@/store'
import type { TradeDirection } from '@/lib/tradingTypes'

/**
 * Paper Trading UI Panel
 * Allows users to manage trades with entry/stop/target adjustment
 * Trades are filtered and displayed per active chart symbol
 */
export function PaperTrading() {
  const [direction, setDirection] = useState<TradeDirection>('long')
  const [entryPrice, setEntryPrice] = useState<string>('')
  const [stopPrice, setStopPrice] = useState<string>('')
  const [targetPrice, setTargetPrice] = useState<string>('')
  const [exitPrice, setExitPrice] = useState<string>('')
  const [error, setError] = useState<string>('')

  const bars = useChartStore((s) => s.bars)
  const activeSymbol = useChartStore((s) => s.activeSymbol)

  // Current market price = last bar's close
  const currentPrice = bars.length > 0 ? bars[bars.length - 1].close : null

  const allTrades = useTradeStore((s) => s.trades)
  const allActiveTrade = useTradeStore((s) => s.activeTrade)
  const settings = useTradeStore((s) => s.settings)

  const { setActiveTrade, addTrade, closeTrade, cancelTrade, deleteTrade } = useTradeStore()

  // Filter trades for the active symbol only
  const trades = allTrades.filter((t) => t.symbol === activeSymbol)
  const activeTrade = allActiveTrade?.symbol === activeSymbol ? allActiveTrade : null

  // Calculate metrics for the active symbol only
  const metrics = calculateTradeMetrics(trades)

  const currentBar = bars.length > 0 ? bars.length - 1 : 0

  const handleMarketOrder = (dir: TradeDirection) => {
    setError('')
    if (!currentPrice) {
      setError('No market price available')
      return
    }
    
    const stop   = stopPrice ? parseFloat(stopPrice) : null
    const target = targetPrice ? parseFloat(targetPrice) : null

    // Validate if both are provided
    if ((stop || target) && (!stop || !target)) {
      setError('Provide both Stop and Target, or leave both empty')
      return
    }
    
    // If both are provided, validate their relationship
    if (stop && target && !isValidEntry(dir, currentPrice, stop, target)) {
      setError(`Invalid levels: For ${dir} trades, stop must be ${dir === 'long' ? 'below' : 'above'} and target ${dir === 'long' ? 'above' : 'below'} entry`)
      return
    }

    const trade = createTrade(
      activeSymbol,
      dir,
      { price: currentPrice, barIndex: currentBar, timestamp: Date.now() },
      stop ? { price: stop, barIndex: currentBar, timestamp: Date.now() } : null,
      target ? { price: target, barIndex: currentBar, timestamp: Date.now() } : null,
      settings.accountSize,
      settings.riskPerTrade,
    )
    setDirection(dir)
    addTrade(trade)
    setEntryPrice('')
    setStopPrice('')
    setTargetPrice('')
    setExitPrice('')
  }

  const handlePlaceTrade = (overrideDirection?: TradeDirection) => {
    setError('')
    const dir = overrideDirection ?? direction

    const entry = parseFloat(entryPrice)
    const stop = stopPrice ? parseFloat(stopPrice) : null
    const target = targetPrice ? parseFloat(targetPrice) : null

    if (!entry) {
      setError('Please enter an entry price')
      return
    }

    // Validate if both are provided
    if ((stop || target) && (!stop || !target)) {
      setError('Provide both Stop and Target, or leave both empty')
      return
    }

    // If both are provided, validate their relationship
    if (stop && target && !isValidEntry(dir, entry, stop, target)) {
      setError(`Invalid entry: For ${dir} trades, entry must be between stop and target`)
      return
    }

    const trade = createTrade(
      activeSymbol,
      dir,
      { price: entry, barIndex: currentBar, timestamp: Date.now() },
      stop ? { price: stop, barIndex: currentBar, timestamp: Date.now() } : null,
      target ? { price: target, barIndex: currentBar, timestamp: Date.now() } : null,
      settings.accountSize,
      settings.riskPerTrade,
    )

    addTrade(trade)
    setEntryPrice('')
    setStopPrice('')
    setTargetPrice('')
    setExitPrice('')
  }

  const handleCloseTrade = (tradeId: string) => {
    const exitPriceNum = parseFloat(exitPrice)
    if (!exitPriceNum) {
      setError('Please enter exit price')
      return
    }
    closeTrade(tradeId, exitPriceNum)
    setExitPrice('')
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Paper Trading</h3>
          <p className="text-xs text-slate-400 mt-0.5">{activeSymbol}</p>
        </div>
        <div className="text-xs text-slate-400">
          Trades: {trades.length} | Win Rate: {metrics.winRate.toFixed(1)}%
        </div>
      </div>

      {/* ── Market Price + Instant Buttons ───────────────────────────────────── */}
      {!activeTrade && (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-slate-800/60 px-3 py-2 rounded">
            <span className="text-xs text-slate-400">Market Price</span>
            <span className="text-sm font-bold text-slate-100">
              {currentPrice != null ? `$${currentPrice.toFixed(2)}` : '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleMarketOrder('long')}
              disabled={!currentPrice}
              className="py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors"
            >
              Market Buy
            </button>
            <button
              onClick={() => handleMarketOrder('short')}
              disabled={!currentPrice}
              className="py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition-colors"
            >
              Market Sell
            </button>
          </div>
          <p className="text-xs text-slate-500 text-center">Stop &amp; Target Optional</p>
        </div>
      )}

      {/* ── Error Message ─────────────────────────────────────────────────────── */}
      {error && <div className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">{error}</div>}

      {/* ── If No Active Trade ────────────────────────────────────────────────── */}
      {!activeTrade && (
        <div className="space-y-2">
          {/* Trade Direction Selector */}
          <div className="flex gap-2 bg-slate-800/60 p-1 rounded">
            <button
              onClick={() => setDirection('long')}
              className={`flex-1 px-2 py-1.5 text-xs font-bold rounded transition-colors ${
                direction === 'long' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              LONG ↑
            </button>
            <button
              onClick={() => setDirection('short')}
              className={`flex-1 px-2 py-1.5 text-xs font-bold rounded transition-colors ${
                direction === 'short' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              SHORT ↓
            </button>
          </div>

          {/* Stop/Target inputs with direction-based hints */}
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                {direction === 'long' ? 'Stop Loss (must be below entry) - Optional' : 'Stop Loss (must be above entry) - Optional'}
              </label>
              <input
                type="number"
                placeholder={direction === 'long' ? 'e.g., 130 for entry 135' : 'e.g., 140 for entry 135'}
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                {direction === 'long' ? 'Target Price (must be above entry) - Optional' : 'Target Price (must be below entry) - Optional'}
              </label>
              <input
                type="number"
                placeholder={direction === 'long' ? 'e.g., 140 for entry 135' : 'e.g., 130 for entry 135'}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700/60 pt-2">
            <p className="text-xs text-slate-500 mb-2">Or place at custom entry:</p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Custom entry"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-400"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => handlePlaceTrade('long')}
                  className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs font-bold rounded transition-colors"
                  title="Limit Long"
                >
                  L
                </button>
                <button
                  onClick={() => handlePlaceTrade('short')}
                  className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded transition-colors"
                  title="Limit Short"
                >
                  S
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── If Active Trade ───────────────────────────────────────────────────── */}
      {activeTrade && (
        <div className="space-y-3">
          {/* Trade Info */}
          <div className="bg-slate-800/50 rounded p-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Direction:</span>
              <span className={activeTrade.direction === 'long' ? 'text-green-400' : 'text-red-400'}>
                {activeTrade.direction.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Entry:</span>
              <span className="text-slate-100">${activeTrade.entry.price.toFixed(2)}</span>
            </div>
            {activeTrade.stopLoss && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Stop Loss:</span>
                <span className="text-red-400">${activeTrade.stopLoss.price.toFixed(2)}</span>
              </div>
            )}
            {activeTrade.target && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Target:</span>
                <span className="text-green-400">${activeTrade.target.price.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="bg-slate-800/50 rounded p-2 space-y-1">
            {activeTrade.risk > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Risk:</span>
                <span className="text-slate-100">${activeTrade.risk.toFixed(2)}</span>
              </div>
            )}
            {activeTrade.reward > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Reward:</span>
                <span className="text-slate-100">${activeTrade.reward.toFixed(2)}</span>
              </div>
            )}
            {activeTrade.riskRewardRatio > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">R/R Ratio:</span>
                <span className="text-slate-100">{activeTrade.riskRewardRatio.toFixed(2)}:1</span>
              </div>
            )}
            {activeTrade.positionSize > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Position Size:</span>
                <span className="text-slate-100">{activeTrade.positionSize} units</span>
              </div>
            )}
            {activeTrade.riskAmount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Risk $:</span>
                <span className="text-red-400">${activeTrade.riskAmount.toFixed(2)}</span>
              </div>
            )}
            {activeTrade.rewardAmount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Reward $:</span>
                <span className="text-green-400">${activeTrade.rewardAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Close Trade */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Exit Price"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 placeholder-slate-500"
            />
            <button
              onClick={() => handleCloseTrade(activeTrade.id)}
              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded transition-colors"
            >
              Close
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTrade(null)}
              className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs rounded transition-colors"
            >
              Cancel Edit
            </button>
            <button
              onClick={() => cancelTrade(activeTrade.id)}
              className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs rounded transition-colors"
            >
              Cancel Trade
            </button>
          </div>
        </div>
      )}

      {/* ── Account Settings ──────────────────────────────────────────────────── */}
      <div className="border-t border-slate-700 pt-2 mt-2 space-y-2">
        <div className="text-xs font-semibold text-slate-300">Account</div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Account Size:</span>
          <input
            type="number"
            value={settings.accountSize}
            onChange={(e) => useTradeStore.setState((state) => ({
              settings: { ...state.settings, accountSize: parseFloat(e.target.value) },
            }))}
            className="w-20 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-100"
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Risk %:</span>
          <input
            type="number"
            value={settings.riskPerTrade}
            onChange={(e) => useTradeStore.setState((state) => ({
              settings: { ...state.settings, riskPerTrade: parseFloat(e.target.value) },
            }))}
            className="w-20 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-100"
          />
        </div>
      </div>

      {/* ── Overall Metrics ───────────────────────────────────────────────────── */}
      {trades.length > 0 && (
        <div className="border-t border-slate-700 pt-2 mt-2 space-y-1">
          <div className="text-xs font-semibold text-slate-300">Metrics</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Total P/L:</span>
              <span className={metrics.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}>
                ${metrics.totalPL.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Win Rate:</span>
              <span className="text-slate-100">{metrics.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Avg Win:</span>
              <span className="text-green-400">${metrics.averageWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Avg Loss:</span>
              <span className="text-red-400">${metrics.averageLoss.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Trade History ─────────────────────────────────────────────────────── */}
      {trades.length > 0 && (
        <div className="border-t border-slate-700 pt-2 mt-2">
          <div className="text-xs font-semibold text-slate-300 mb-2">Recent Trades</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...trades].reverse().slice(0, 5).map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between text-xs bg-slate-800/30 px-2 py-1 rounded cursor-pointer hover:bg-slate-800/60 transition-colors"
                onClick={() => setActiveTrade(trade)}
              >
                <div className="flex gap-2 items-center flex-1">
                  <span className={trade.direction === 'long' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                    {trade.direction === 'long' ? '▲' : '▼'}
                  </span>
                  <span className="text-slate-300">{trade.riskRewardRatio.toFixed(2)}:1</span>
                </div>
                <div className="flex gap-1 items-center">
                  {trade.status === 'closed' && (
                    <span
                      className={
                        trade.result === 'win'
                          ? 'text-green-400 font-bold'
                          : trade.result === 'loss'
                            ? 'text-red-400 font-bold'
                            : 'text-slate-400'
                      }
                    >
                      {trade.actualPL! >= 0 ? '+' : ''}${trade.actualPL?.toFixed(2)}
                    </span>
                  )}
                  {trade.status !== 'closed' && <span className="text-blue-400">Active</span>}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteTrade(trade.id)
                    }}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
