import { useState } from 'react'
import { useTheme } from '@/context'
import { useMarketData } from '@/hooks'
import { CandlestickChart } from '@/components/charts'
import { IndicatorPanel } from '@/components/indicators'
import { PriceDisplay } from '@/components/analysis'
import { Watchlist } from '@/components/Watchlist'
import { TradeJournal } from '@/components/TradeJournal'
import { PaperTrading } from '@/components/PaperTrading'
import { TradingReport } from '@/components/TradingReport'
import { ChartAnalysisPanel } from '@/components/ChartAnalysisPanel'
import { CoachingPanel } from '@/components/CoachingPanel'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useChartStore } from '@/store'
import { cn } from '@/utils'

type Tab = 'chart' | 'analyze' | 'report' | 'journal' | 'coaching'

export function App() {
  useMarketData()
  const { theme } = useTheme()
  const activeSymbol = useChartStore((s) => s.activeSymbol)
  const [tab, setTab] = useState<Tab>('chart')

  return (
    <div
      className={cn(
        'flex h-screen overflow-hidden font-sans',
        theme === 'dark' ? 'bg-[#0b0f1a] text-white' : 'bg-white text-slate-900',
      )}
    >
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 border-r border-slate-800 flex flex-col gap-4 py-4 overflow-y-auto">
        <div className="px-3">
          <h1 className="text-base font-bold text-blue-400 tracking-tight">Trading Analyzer</h1>
        </div>
        <Watchlist />
        <div className="mt-auto px-3">
          <IndicatorPanel />
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-base font-bold">{activeSymbol}</span>
            <PriceDisplay />
          </div>
          <ThemeToggle />
        </header>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-2 border-b border-slate-800 shrink-0 overflow-x-auto">
          {(['chart', 'analyze', 'report', 'journal', 'coaching'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-t transition-colors capitalize whitespace-nowrap',
                tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex gap-4 p-4">
          {/* Main content area */}
          <div className="flex-1 overflow-hidden">
            {tab === 'chart' && <CandlestickChart />}
            {tab === 'analyze' && (
              <div className="h-full overflow-y-auto">
                <ChartAnalysisPanel />
              </div>
            )}
            {tab === 'report' && (
              <div className="h-full overflow-y-auto">
                <TradingReport />
              </div>
            )}
            {tab === 'journal' && (
              <div className="h-full overflow-y-auto">
                <TradeJournal />
              </div>
            )}
            {tab === 'coaching' && (
              <div className="h-full overflow-y-auto">
                <CoachingPanel />
              </div>
            )}
          </div>

          {/* Paper Trading panel (only on chart tab) */}
          {tab === 'chart' && (
            <div className="w-72 overflow-y-auto">
              <PaperTrading />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
