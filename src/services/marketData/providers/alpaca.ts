import type { OHLCVBar } from '@/types'
import type {
  IMarketDataAdapter,
  AlpacaConfig,
  FetchBarsParams,
  QuoteData,
  AlpacaRaw,
} from '../types'
import { NetworkError, ParseError, AuthError, RateLimitError } from '../errors'
import { alpacaTimeFrame, defaultDateRange } from '../timeframeMap'

const DEFAULT_BASE_URL = 'https://data.alpaca.markets'

/**
 * Alpaca market data adapter (Stocks & Crypto).
 *
 * Docs: https://docs.alpaca.markets/reference/stockbars
 *
 * Required env vars:
 *   VITE_ALPACA_API_KEY
 *   VITE_ALPACA_API_SECRET
 *
 * Note: Alpaca requires both key + secret in request headers.
 *       In production, proxy requests through your backend to protect secrets.
 */
export class AlpacaAdapter implements IMarketDataAdapter {
  readonly providerId = 'alpaca' as const

  private readonly apiKey:    string
  private readonly apiSecret: string
  private readonly baseUrl:   string
  private readonly feed:      'sip' | 'iex'

  constructor(config: AlpacaConfig) {
    if (!config.apiKey)    throw new AuthError('alpaca', 'apiKey is required')
    if (!config.apiSecret) throw new AuthError('alpaca', 'apiSecret is required')
    this.apiKey    = config.apiKey
    this.apiSecret = config.apiSecret
    this.baseUrl   = config.baseUrl ?? DEFAULT_BASE_URL
    this.feed      = config.feed    ?? 'iex'
  }

  // ── Fetch OHLCV bars ────────────────────────────────────────────────────────

  async fetchBars(params: FetchBarsParams): Promise<OHLCVBar[]> {
    const { symbol, timeframe, limit = 252 } = params
    const { from, to } = params.from && params.to
      ? { from: params.from, to: params.to }
      : defaultDateRange(timeframe, limit)

    // Alpaca uses different endpoints for stocks vs crypto
    const isCrypto = isCryptoSymbol(symbol)
    const endpoint = isCrypto
      ? `${this.baseUrl}/v1beta3/crypto/us/bars`
      : `${this.baseUrl}/v2/stocks/${encodeURIComponent(symbol)}/bars`

    const url = new URL(endpoint)
    if (isCrypto) url.searchParams.set('symbols', symbol)
    url.searchParams.set('timeframe',  alpacaTimeFrame(timeframe))
    url.searchParams.set('start',      new Date(from * 1000).toISOString())
    url.searchParams.set('end',        new Date(to   * 1000).toISOString())
    url.searchParams.set('limit',      String(Math.min(limit, 10000)))
    url.searchParams.set('adjustment', 'raw')
    if (!isCrypto) url.searchParams.set('feed', this.feed)
    url.searchParams.set('sort', 'asc')

    const raw = await this.get<AlpacaRaw.BarsResponse>(url.toString())
    const bars = Array.isArray(raw.bars) ? raw.bars : []

    return bars.map((bar): OHLCVBar => ({
      time:   Math.floor(new Date(bar.t).getTime() / 1000),
      open:   bar.o,
      high:   bar.h,
      low:    bar.l,
      close:  bar.c,
      volume: bar.v,
    }))
  }

  // ── Fetch latest quote ──────────────────────────────────────────────────────

  async fetchQuote(symbol: string): Promise<QuoteData | null> {
    const isCrypto = isCryptoSymbol(symbol)
    const endpoint = isCrypto
      ? `${this.baseUrl}/v1beta3/crypto/us/latest/bars?symbols=${encodeURIComponent(symbol)}`
      : `${this.baseUrl}/v2/stocks/${encodeURIComponent(symbol)}/bars/latest`

    const raw = await this.get<AlpacaRaw.LatestBar>(endpoint)
    const bar = raw.bar
    if (!bar) return null

    return {
      symbol,
      price:     bar.c,
      change:    0,       // Alpaca latest bar doesn't include prev close
      changePct: 0,
      volume:    bar.v,
      timestamp: Math.floor(new Date(bar.t).getTime() / 1000),
    }
  }

  // ── HTTP helper ─────────────────────────────────────────────────────────────

  private async get<T>(url: string): Promise<T> {
    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID':     this.apiKey,
          'APCA-API-SECRET-KEY': this.apiSecret,
          'Accept': 'application/json',
        },
      })
    } catch (err) {
      throw new NetworkError('alpaca', 0, url, err)
    }

    if (res.status === 401 || res.status === 403) throw new AuthError('alpaca', `HTTP ${res.status}`)
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10)
      throw new RateLimitError('alpaca', retryAfter)
    }
    if (!res.ok) throw new NetworkError('alpaca', res.status, url)

    try {
      return (await res.json()) as T
    } catch (err) {
      throw new ParseError('alpaca', 'Invalid JSON', err)
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detect crypto pairs like BTC/USD, ETH-USDT, BTCUSDT. */
function isCryptoSymbol(symbol: string): boolean {
  return /[/\-]/.test(symbol) || /^[A-Z]{3,6}(USD|USDT|BTC|ETH)$/.test(symbol)
}
