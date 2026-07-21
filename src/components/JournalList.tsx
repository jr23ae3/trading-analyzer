import { useState } from 'react'
import { useTradeJournalStore, type JournalFilters } from '@/store'
import { formatPrice, formatPnL, calcJournalStats } from '@/utils'
import type { TradeEntry } from '@/types'

export function JournalList() {
  const { trades, filters, setFilters, clearFilters, getFilteredTrades, deleteTrade } = useTradeJournalStore()
  const filteredTrades = getFilteredTrades()
  const allStats = calcJournalStats(trades)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<TradeEntry | null>(null)

  // Get unique values for filter dropdowns
  const strategies = Array.from(new Set(trades.map((t) => t.strategy).filter(Boolean)))
  const symbols = Array.from(new Set(trades.map((t) => t.symbol).filter(Boolean)))

  const handleFilterChange = (key: keyof JournalFilters, value: any) => {
    setFilters({ [key]: value })
  }

  const getResultBadge = (pnl?: number, status?: string) => {
    if (status !== 'closed' || !pnl) return null
    return (
      <span
        className={`text-xs px-2 py-1 rounded ${
          pnl > 0 ? 'bg-green-600/30 text-green-300' : 'bg-red-600/30 text-red-300'
        }`}
      >
        {pnl > 0 ? '✓ WIN' : '✗ LOSS'}
      </span>
    )
  }

  const getGradeBadgeColor = (grade?: string) => {
    const colors: Record<string, string> = {
      'A+': 'bg-yellow-600/30 text-yellow-300',
      'A': 'bg-green-600/30 text-green-300',
      'B': 'bg-blue-600/30 text-blue-300',
      'C': 'bg-slate-600/30 text-slate-300',
      'AVOID': 'bg-red-600/30 text-red-300',
    }
    return colors[grade || 'B'] || 'bg-slate-600/30 text-slate-300'
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Total Trades', value: String(allStats.totalTrades), cls: 'text-white' },
          { label: 'Total P/L', value: formatPnL(allStats.totalPnL).text, cls: formatPnL(allStats.totalPnL).className },
          { label: 'Win Rate', value: `${allStats.winRate.toFixed(1)}%`, cls: 'text-white' },
          { label: 'Profit Factor', value: allStats.profitFactor.toFixed(2), cls: 'text-white' },
          { label: 'Avg Win', value: formatPrice(allStats.avgWin), cls: 'text-green-400' },
          { label: 'Avg Loss', value: formatPrice(allStats.avgLoss), cls: 'text-red-400' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-lg font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">Filters</h3>
          {Object.values(filters).some((v) => v) && (
            <button
              onClick={clearFilters}
              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="grid grid-cols-5 gap-3">
          {/* Date Range */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value || undefined)}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Strategy</label>
            <select
              value={filters.strategy || ''}
              onChange={(e) => handleFilterChange('strategy', e.target.value || undefined)}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">All</option>
              {strategies.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Symbol</label>
            <select
              value={filters.symbol || ''}
              onChange={(e) => handleFilterChange('symbol', e.target.value || undefined)}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">All</option>
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Result</label>
            <select
              value={filters.resultType || 'all'}
              onChange={(e) =>
                handleFilterChange(
                  'resultType',
                  (e.target.value as 'all' | 'wins' | 'losses') || undefined,
                )
              }
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="wins">Wins Only</option>
              <option value="losses">Losses Only</option>
            </select>
          </div>
        </div>

        {filteredTrades.length < trades.length && (
          <p className="text-xs text-slate-400">
            Showing {filteredTrades.length} of {trades.length} trades
          </p>
        )}
      </div>

      {/* Trades Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-slate-300">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-700">
              {['Date', 'Symbol', 'Dir', 'Entry', 'Exit', 'SL/TP', 'P/L', 'Grade', 'Strategy', 'Result', ''].map(
                (h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filteredTrades.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-slate-500">
                  No trades match your filters
                </td>
              </tr>
            )}
            {filteredTrades.map((trade) => {
              const { text: pnlText, className: pnlCls } = formatPnL(trade.pnl ?? 0)
              const tradeDate = new Date(trade.entryDate).toLocaleDateString()
              const isExpanded = expandedId === trade.id

              return (
                <tr
                  key={trade.id}
                  className={`border-b border-slate-800 hover:bg-slate-800/50 ${
                    isExpanded ? 'bg-slate-800/30' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-slate-400 text-xs">{tradeDate}</td>
                  <td className="px-3 py-2 font-medium text-white">{trade.symbol}</td>
                  <td className={`px-3 py-2 ${trade.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.direction.toUpperCase()}
                  </td>
                  <td className="px-3 py-2">{formatPrice(trade.entryPrice)}</td>
                  <td className="px-3 py-2">{trade.exitPrice ? formatPrice(trade.exitPrice) : '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {trade.stopLoss ? formatPrice(trade.stopLoss) : '—'} /{' '}
                    {trade.takeProfit ? formatPrice(trade.takeProfit) : '—'}
                  </td>
                  <td className={`px-3 py-2 font-semibold ${pnlCls}`}>
                    {trade.exitPrice ? pnlText : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {trade.grade && (
                      <span className={`text-xs px-2 py-1 rounded ${getGradeBadgeColor(trade.grade)}`}>
                        {trade.grade}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{trade.strategy || '—'}</td>
                  <td className="px-3 py-2">{getResultBadge(trade.pnl, trade.status)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => {
                        setExpandedId(isExpanded ? null : trade.id)
                        setSelectedTrade(isExpanded ? null : trade)
                      }}
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded Detail View */}
      {selectedTrade && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-6">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold text-white">
              {selectedTrade.symbol} {selectedTrade.direction.toUpperCase()} - {selectedTrade.strategy || 'N/A'}
            </h3>
            <button
              onClick={() => {
                setExpandedId(null)
                setSelectedTrade(null)
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Trade Details */}
              <div className="bg-slate-700/30 rounded p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Trade Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Entry Price:</span>
                    <span className="text-white font-medium">{formatPrice(selectedTrade.entryPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Exit Price:</span>
                    <span className="text-white font-medium">
                      {selectedTrade.exitPrice ? formatPrice(selectedTrade.exitPrice) : 'Open'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Stop Loss:</span>
                    <span className="text-red-400 font-medium">
                      {selectedTrade.stopLoss ? formatPrice(selectedTrade.stopLoss) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Take Profit:</span>
                    <span className="text-green-400 font-medium">
                      {selectedTrade.takeProfit ? formatPrice(selectedTrade.takeProfit) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-600">
                    <span className="text-slate-400">P/L:</span>
                    <span className={`font-bold ${formatPnL(selectedTrade.pnl ?? 0).className}`}>
                      {formatPnL(selectedTrade.pnl ?? 0).text}
                    </span>
                  </div>
                </div>
              </div>

              {/* Setup & Grade */}
              {(selectedTrade.setup || selectedTrade.grade) && (
                <div className="bg-slate-700/30 rounded p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Setup Analysis</h4>
                  <div className="space-y-2">
                    {selectedTrade.grade && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">Grade:</span>
                        <span className={`text-sm px-2 py-1 rounded font-medium ${getGradeBadgeColor(selectedTrade.grade)}`}>
                          {selectedTrade.grade}
                        </span>
                      </div>
                    )}
                    {selectedTrade.setup && (
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Setup:</p>
                        <p className="text-slate-200 text-sm">{selectedTrade.setup}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Emotions */}
              {selectedTrade.emotions && selectedTrade.emotions.length > 0 && (
                <div className="bg-slate-700/30 rounded p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Emotions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTrade.emotions.map((emotion) => (
                      <span
                        key={emotion}
                        className="text-xs px-2 py-1 rounded-full bg-blue-600/30 text-blue-300"
                      >
                        {emotion}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Mistakes */}
              {selectedTrade.mistakes && selectedTrade.mistakes.length > 0 && (
                <div className="bg-slate-700/30 rounded p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Mistakes</h4>
                  <ul className="space-y-2">
                    {selectedTrade.mistakes.map((mistake, idx) => (
                      <li key={idx} className="text-sm text-slate-300 flex gap-2">
                        <span className="text-red-400">•</span>
                        {mistake}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {selectedTrade.notes && (
                <div className="bg-slate-700/30 rounded p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Notes</h4>
                  <p className="text-sm text-slate-300">{selectedTrade.notes}</p>
                </div>
              )}

              {/* Screenshot */}
              {selectedTrade.screenshotDataURL && (
                <div className="bg-slate-700/30 rounded p-4">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Screenshot</h4>
                  <img
                    src={selectedTrade.screenshotDataURL}
                    alt="Trade screenshot"
                    className="w-full rounded border border-slate-600 max-h-64 object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Delete Button */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
            <button
              onClick={() => {
                deleteTrade(selectedTrade.id)
                setExpandedId(null)
                setSelectedTrade(null)
              }}
              className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded-lg font-medium transition"
            >
              Delete Entry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
