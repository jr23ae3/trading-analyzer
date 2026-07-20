import { useTradeJournalStore } from '@/store'
import { formatPrice, formatPnL, calcJournalStats } from '@/utils'

export function TradeJournal() {
  const trades = useTradeJournalStore((s) => s.trades)
  const stats = calcJournalStats(trades)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total PnL', value: formatPnL(stats.totalPnL).text, cls: formatPnL(stats.totalPnL).className },
          { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, cls: 'text-white' },
          { label: 'Profit Factor', value: stats.profitFactor.toFixed(2), cls: 'text-white' },
          { label: 'Total Trades', value: String(stats.totalTrades), cls: 'text-white' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-lg font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Trade table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-slate-300">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-700">
              {['Symbol', 'Dir', 'Entry', 'Exit', 'Qty', 'PnL', 'Status'].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                  No trades yet
                </td>
              </tr>
            )}
            {trades.map((t) => {
              const { text: pnlText, className: pnlCls } = formatPnL(t.pnl ?? 0)
              return (
                <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-2 py-2 font-medium text-white">{t.symbol}</td>
                  <td className={`px-2 py-2 ${t.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.direction.toUpperCase()}
                  </td>
                  <td className="px-2 py-2">{formatPrice(t.entryPrice)}</td>
                  <td className="px-2 py-2">{t.exitPrice ? formatPrice(t.exitPrice) : '—'}</td>
                  <td className="px-2 py-2">{t.quantity}</td>
                  <td className={`px-2 py-2 ${pnlCls}`}>{t.exitPrice ? pnlText : '—'}</td>
                  <td className="px-2 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      t.status === 'open' ? 'bg-blue-600/30 text-blue-300' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
