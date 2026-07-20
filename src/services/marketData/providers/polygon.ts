import type { OHLCVBar } from '@/types'
import type {
  IMarketDataAdapter,
  PolygonConfig,
  FetchBarsParams,
  QuoteData,
  PolygonRaw,
} from '../types'
import { NetworkError, ParseError, AuthError, RateLimitError } from '../errors'
import { polygonInterval, defaultDateRange } from '../timeframeMap'

const DEFAULT_BASE_URL = 'https://api.polygon.io'

/**
 * Polygon.io market data adapter.
 *
 * Docs: https://polygon.io/docs/stocks/getting-started
 *
 * Required env var: VITE_POLYGON_API_KEY
 *
 * Note: In production, proxy requests through your backend to protect the API key.
 */
export class PolygonAdapter implements IMarketDataAdapter {
  readonly providerId = 'polygon' as const

  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(config: PolygonConfig) {
    if (!config.apiKey) throw new AuthError('polygon', 'apiKey is required')
    this.apiKey  = config.apiKey
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  }

  // ── Fetch OHLCV bars ────────────────────────────────────────────────────────

  async fetchBars(params: FetchBarsParams): Promise<OHLCVBar[]> {
    const { symbol, timeframe, limit = 252 } = params
    const { from, to } = params.from && params.to
      ? { from: params.from, to: params.to }
      : defaultDateRange(timeframe, limit)

    const { multiplier, timespan } = polygonInterval(timeframe)
    const fromDate = toISODate(from)
    const toDate   = toISODate(to)

    const url = new URL(
      `${this.baseUrl}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${fromDate}/${toDate}`,
    )
    url.searchParams.set('adjusted', 'true')
    url.searchParams.set('sort', 'asc')
    url.searchParams.set('limit', String(Math.min(limit, 50000)))
    url.searchParams.set('apiKey', this.apiKey)

    const raw = await this.get<PolygonRaw.AggResponse>(url.toString())

    if (raw.status === 'ERROR') {
      throw new ParseError('polygon', raw.error ?? raw.message ?? 'Unknown error')
    }

    if (!raw.results?.length) return []

    return raw.results.map((bar): OHLCVBar => ({
      time:   Math.floor(bar.t / 1000),   // ms → s
      open:   bar.o,
      high:   bar.h,
      low:    bar.l,
      close:  bar.c,
      volume: bar.v,
    }))
  }

  // ── Fetch latest quote ──────────────────────────────────────────────────────

  async fetchQuote(symbol: string): Promise<QuoteData | null> {
    const url = `${this.baseUrl}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}?apiKey=${this.apiKey}`
    const raw = await this.get<PolygonRaw.SnapshotResponse>(url)

    const ticker = raw.ticker
    if (!ticker) return null

    const price    = ticker.day?.c ?? 0
    const prevClose = ticker.prevDay?.c ?? price
    const change   = price - prevClose
    const ts       = ticker.lastTrade?.t ? Math.floor(ticker.lastTrade.t / 1_000_000) : Math.floor(Date.now() / 1000)

    return {
      symbol,
      price,
      change,
      changePct: prevClose !== 0 ? (change / prevClose) * 100 : 0,
      volume:    ticker.day?.v ?? 0,
      timestamp: ts,
    }
  }

  // ── HTTP helper ─────────────────────────────────────────────────────────────

  private async get<T>(url: string): Promise<T> {
    let res: Response
    try {
      res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    } catch (err) {
      throw new NetworkError('polygon', 0, url, err)
    }

    if (res.status === 401 || res.status === 403) throw new AuthError('polygon', `HTTP ${res.status}`)
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10)
      throw new RateLimitError('polygon', retryAfter)
    }
    if (!res.ok) throw new NetworkError('polygon', res.status, url)

    try {
      return (await res.json()) as T
    } catch (err) {
      throw new ParseError('polygon', 'Invalid JSON', err)
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}
