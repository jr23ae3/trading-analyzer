import type { OHLCVBar } from '@/types'
import type {
  IMarketDataAdapter,
  YahooConfig,
  FetchBarsParams,
  QuoteData,
  YahooRaw,
} from '../types'
import { NetworkError, ParseError, SymbolNotFoundError } from '../errors'
import { yahooInterval, yahooRange } from '../timeframeMap'

const BASE_URL = 'https://query1.finance.yahoo.com'

/**
 * Yahoo Finance market data adapter (unofficial public API).
 *
 * No API key required. Uses Yahoo's undocumented chart endpoint.
 *
 * ⚠ Caveats:
 *   - Yahoo may break or rate-limit this endpoint without notice.
 *   - In production, route requests through a backend proxy to avoid CORS and IP bans.
 *   - Set `corsProxy` in the config for local browser use if needed.
 *     e.g. corsProxy: 'https://corsproxy.io/?'
 *
 * Symbol format: stock: 'AAPL', crypto: 'BTC-USD', forex: 'EURUSD=X'
 */
export class YahooAdapter implements IMarketDataAdapter {
  readonly providerId = 'yahoo' as const

  private readonly corsProxy: string

  constructor(config: YahooConfig = { providerId: 'yahoo' }) {
    this.corsProxy = config.corsProxy ?? ''
  }

  // ── Fetch OHLCV bars ────────────────────────────────────────────────────────

  async fetchBars(params: FetchBarsParams): Promise<OHLCVBar[]> {
    const { symbol, timeframe, limit = 252 } = params

    const interval = yahooInterval(timeframe)
    const range    = yahooRange(timeframe, limit)

    const url = new URL(`${BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}`)
    url.searchParams.set('interval',            interval)
    url.searchParams.set('range',               range)
    url.searchParams.set('includeTimestamps',   'true')
    url.searchParams.set('includePrePost',      'false')
    url.searchParams.set('events',              'div,splits')
    url.searchParams.set('corsDomain',          'finance.yahoo.com')

    // Override with explicit from/to if provided
    if (params.from) url.searchParams.set('period1', String(params.from))
    if (params.to)   url.searchParams.set('period2', String(params.to))
    if (params.from || params.to) url.searchParams.delete('range')

    const finalUrl = this.corsProxy + url.toString()
    const raw = await this.get<YahooRaw.ChartResponse>(finalUrl)

    if (raw.chart?.error) {
      const err = raw.chart.error
      if (err.code === 'Not Found') throw new SymbolNotFoundError('yahoo', symbol)
      throw new ParseError('yahoo', `${err.code}: ${err.description}`)
    }

    const result = raw.chart?.result?.[0]
    if (!result) throw new ParseError('yahoo', 'No chart result in response')

    const timestamps = result.timestamp
    const quote      = result.indicators?.quote?.[0]

    if (!timestamps?.length || !quote) return []

    const bars: OHLCVBar[] = []

    for (let i = 0; i < timestamps.length; i++) {
      const open   = quote.open[i]
      const high   = quote.high[i]
      const low    = quote.low[i]
      const close  = quote.close[i]
      const volume = quote.volume[i]

      // Skip null/undefined bars (e.g. market closure gaps)
      if (open == null || high == null || low == null || close == null) continue

      bars.push({
        time:   timestamps[i],        // already Unix seconds
        open,
        high,
        low,
        close,
        volume: volume ?? 0,
      })
    }

    // Trim to requested limit
    return limit ? bars.slice(-limit) : bars
  }

  // ── Fetch latest quote ──────────────────────────────────────────────────────

  async fetchQuote(symbol: string): Promise<QuoteData | null> {
    const url = `${this.corsProxy}${BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    const raw = await this.get<YahooRaw.ChartResponse>(url)

    const result = raw.chart?.result?.[0]
    if (!result) return null

    const meta      = result.meta
    const price     = meta.regularMarketPrice ?? 0
    const prevClose = meta.previousClose ?? price
    const change    = price - prevClose

    return {
      symbol,
      price,
      change,
      changePct: prevClose !== 0 ? (change / prevClose) * 100 : 0,
      volume:    meta.regularMarketVolume ?? 0,
      timestamp: meta.regularMarketTime  ?? Math.floor(Date.now() / 1000),
    }
  }

  // ── HTTP helper ─────────────────────────────────────────────────────────────

  private async get<T>(url: string): Promise<T> {
    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          // Some Yahoo endpoints require a cookie/crumb; handled by corsProxy if needed
        },
      })
    } catch (err) {
      throw new NetworkError('yahoo', 0, url, err)
    }

    if (!res.ok) throw new NetworkError('yahoo', res.status, url)

    try {
      return (await res.json()) as T
    } catch (err) {
      throw new ParseError('yahoo', 'Invalid JSON', err)
    }
  }
}
