import { useEffect, useRef } from 'react'
import { useTheme } from '@/context'
import type { Timeframe } from '@/types'

// ─── TradingView global type ──────────────────────────────────────────────────

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: TVConfig) => void
    }
  }
}

interface TVConfig {
  container_id: string
  symbol: string
  interval: string
  timezone: string
  theme: 'dark' | 'light'
  style: string
  locale: string
  enable_publishing: boolean
  withdateranges: boolean
  hide_side_toolbar: boolean
  allow_symbol_change: boolean
  save_image: boolean
  autosize: boolean
  studies: string[]
  show_popup_button: boolean
  hide_volume: boolean
  support_host: string
}

// ─── Timeframe → TradingView interval ────────────────────────────────────────

const TV_INTERVAL: Record<Timeframe, string> = {
  '1m':  '1',
  '5m':  '5',
  '15m': '15',
  '30m': '30',
  '1h':  '60',
  '4h':  '240',
  '1D':  'D',
  '1W':  'W',
  '1M':  'M',
}

// ─── Symbol → TradingView format ─────────────────────────────────────────────

/**
 * Converts our internal symbol + exchange to TradingView's "EXCHANGE:TICKER" format.
 *
 * Examples:
 *   AAPL  / NASDAQ  → NASDAQ:AAPL
 *   BTC/USDT / Binance → BINANCE:BTCUSDT
 *   SPY  / NYSE     → AMEX:SPY   (SPY trades on ARCA/AMEX in TV)
 */
export function toTVSymbol(ticker: string, exchange = ''): string {
  // Crypto: normalize BTC/USDT → BTCUSDT
  const cleanTicker = ticker.replace('/', '')

  const exch = exchange.toUpperCase()

  if (exch === 'BINANCE') return `BINANCE:${cleanTicker}`
  if (exch === 'COINBASE') return `COINBASE:${cleanTicker}`
  if (exch === 'KRAKEN') return `KRAKEN:${cleanTicker}`
  if (exch === 'AMEX')   return `AMEX:${cleanTicker}`
  if (exch === 'NYSE')   return `NYSE:${cleanTicker}`
  if (exch === 'NASDAQ') return `NASDAQ:${cleanTicker}`

  // Auto-detect crypto by presence of "/" in original ticker
  if (ticker.includes('/')) return `BINANCE:${cleanTicker}`

  // Default: let TradingView auto-resolve the best exchange
  return cleanTicker
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface TradingViewWidgetProps {
  /** TradingView-format symbol, e.g. "NASDAQ:AAPL" or "BINANCE:BTCUSDT" */
  symbol: string
  /** Initial timeframe (TradingView user can change it) */
  timeframe?: Timeframe
}

let scriptLoaded = false
const pendingCallbacks: Array<() => void> = []

function loadTVScript(onReady: () => void) {
  if (window.TradingView) {
    onReady()
    return
  }
  pendingCallbacks.push(onReady)
  if (scriptLoaded) return // Script already loading
  scriptLoaded = true
  const script = document.createElement('script')
  script.src = 'https://s3.tradingview.com/tv.js'
  script.async = true
  script.onload = () => {
    pendingCallbacks.forEach((cb) => cb())
    pendingCallbacks.length = 0
  }
  document.head.appendChild(script)
}

export function TradingViewWidget({ symbol, timeframe = '1D' }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear previous widget DOM
    container.innerHTML = ''

    // Create a fresh inner div with a unique ID each time
    const uid = `tv_${Math.random().toString(36).slice(2, 10)}`
    const inner = document.createElement('div')
    inner.id = uid
    inner.style.cssText = 'width:100%;height:100%'
    container.appendChild(inner)

    const interval = TV_INTERVAL[timeframe] ?? 'D'
    const isDark = theme === 'dark'

    function initWidget() {
      if (!window.TradingView || !document.getElementById(uid)) return
      new window.TradingView.widget({
        container_id: uid,
        symbol,
        interval,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC',
        theme: isDark ? 'dark' : 'light',
        style: '1',          // candlesticks
        locale: 'en',
        enable_publishing: false,
        withdateranges: true,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        save_image: false,
        autosize: true,
        studies: [
          'STD;EMA',         // EMA
          'STD;RSI',         // RSI
          'STD;MACD',        // MACD
        ],
        show_popup_button: false,
        hide_volume: false,
        support_host: 'https://www.tradingview.com',
      })
    }

    loadTVScript(initWidget)

    return () => {
      if (container) container.innerHTML = ''
    }
  }, [symbol, timeframe, theme])

  return <div ref={containerRef} className="w-full h-full" />
}
