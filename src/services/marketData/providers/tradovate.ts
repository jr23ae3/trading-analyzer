import type { OHLCVBar } from '@/types'
import type {
  IMarketDataAdapter,
  TradovateConfig,
  FetchBarsParams,
  QuoteData,
  TradovateRaw,
} from '../types'
import { NetworkError, ParseError, AuthError, RateLimitError } from '../errors'
import { tradovateChartDesc, defaultDateRange } from '../timeframeMap'

const BASE_URLS = {
  live: 'https://live.tradovate.com/v1',
  demo: 'https://demo.tradovate.com/v1',
} as const

/**
 * Tradovate futures market data adapter.
 *
 * Docs: https://api.tradovate.com/#tag/Market-Data
 *
 * Tradovate uses OAuth2 (username + password → bearer token).
 * The token is cached in memory and refreshed automatically on 401.
 *
 * Required env vars:
 *   VITE_TRADOVATE_USERNAME
 *   VITE_TRADOVATE_PASSWORD
 *   VITE_TRADOVATE_APP_ID
 *   VITE_TRADOVATE_APP_VERSION
 *   VITE_TRADOVATE_CID
 *   VITE_TRADOVATE_SEC
 *
 * Note: In production, proxy through your backend — never expose credentials client-side.
 */
export class TradovateAdapter implements IMarketDataAdapter {
  readonly providerId = 'tradovate' as const

  private readonly config: TradovateConfig
  private readonly baseUrl: string

  private accessToken:    string | null = null
  private tokenExpiresAt: number        = 0   // Unix ms

  constructor(config: TradovateConfig) {
    if (!config.username || !config.password) throw new AuthError('tradovate', 'username and password are required')
    if (!config.appId || !config.cid || !config.sec) throw new AuthError('tradovate', 'appId, cid and sec are required')
    this.config  = config
    this.baseUrl = BASE_URLS[config.environment ?? 'live']
  }

  // ── Fetch OHLCV bars ────────────────────────────────────────────────────────

  async fetchBars(params: FetchBarsParams): Promise<OHLCVBar[]> {
    const { symbol, timeframe, limit = 252 } = params
    const { from } = params.from
      ? { from: params.from }
      : defaultDateRange(timeframe, limit)

    await this.ensureToken()

    const chartDesc = tradovateChartDesc(timeframe)
    const body = {
      symbol,
      chartDescription: chartDesc,
      timeRange: {
        asFarAsTimestamp: new Date(from * 1000).toISOString(),
        asMuchAsElements: Math.min(limit, 5000),
      },
    }

    const raw = await this.post<TradovateRaw.ChartResponse>('/md/getchart', body)

    if (!raw.tk?.length) return []

    return raw.tk.map((tick): OHLCVBar => ({
      time:   Math.floor(new Date(tick.timestamp).getTime() / 1000),
      open:   tick.openingPrice ?? tick.openPrice ?? 0,
      high:   tick.highPrice ?? 0,
      low:    tick.lowPrice  ?? 0,
      close:  tick.closePrice ?? 0,
      volume: (tick.up ?? 0) + (tick.down ?? 0),
    }))
  }

  // ── Fetch latest quote ──────────────────────────────────────────────────────

  async fetchQuote(symbol: string): Promise<QuoteData | null> {
    await this.ensureToken()

    // Fetch the last two daily bars to compute change
    const bars = await this.fetchBars({ symbol, timeframe: '1D', limit: 2 })
    if (!bars.length) return null

    const latest = bars[bars.length - 1]
    const prev   = bars[bars.length - 2]
    const change = prev ? latest.close - prev.close : 0

    return {
      symbol,
      price:     latest.close,
      change,
      changePct: prev?.close ? (change / prev.close) * 100 : 0,
      volume:    latest.volume,
      timestamp: latest.time,
    }
  }

  // ── OAuth token management ──────────────────────────────────────────────────

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) return
    await this.authenticate()
  }

  private async authenticate(): Promise<void> {
    const { username, password, appId, appVersion, cid, sec } = this.config
    const url = `${this.baseUrl}/auth/accesstokenrequest`

    let res: Response
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body:    JSON.stringify({ name: username, password, appId, appVersion, cid, sec }),
      })
    } catch (err) {
      throw new NetworkError('tradovate', 0, url, err)
    }

    if (res.status === 401) throw new AuthError('tradovate', 'Invalid credentials')
    if (!res.ok) throw new NetworkError('tradovate', res.status, url)

    let data: TradovateRaw.AuthResponse
    try {
      data = (await res.json()) as TradovateRaw.AuthResponse
    } catch (err) {
      throw new ParseError('tradovate', 'Auth response was not valid JSON', err)
    }

    if (!data.accessToken) throw new AuthError('tradovate', 'No accessToken in auth response')

    this.accessToken    = data.accessToken
    this.tokenExpiresAt = new Date(data.expirationTime).getTime()
  }

  // ── HTTP helpers ────────────────────────────────────────────────────────────

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    let res: Response
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Accept':        'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      throw new NetworkError('tradovate', 0, url, err)
    }

    if (res.status === 401) {
      // Force re-auth on next call
      this.accessToken = null
      throw new AuthError('tradovate', 'Token expired or invalid')
    }
    if (res.status === 429) throw new RateLimitError('tradovate')
    if (!res.ok) throw new NetworkError('tradovate', res.status, url)

    try {
      return (await res.json()) as T
    } catch (err) {
      throw new ParseError('tradovate', 'Invalid JSON', err)
    }
  }
}
