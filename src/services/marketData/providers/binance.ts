import type { OHLCVBar } from '@/types'
import type {
  IMarketDataAdapter,
  BinanceConfig,
  FetchBarsParams,
  QuoteData,
  BinanceRaw,
} from '../types'
import { NetworkError, ParseError, RateLimitError, SymbolNotFoundError } from '../errors'
import { binanceInterval } from '../timeframeMap'

const DEFAULT_BASE_URL     = 'https://api.binance.com'
const TESTNET_BASE_URL     = 'https://testnet.binance.vision'
const MAX_BARS_PER_REQUEST = 1000

/**
 * Binance spot / perpetual futures market data adapter.
 *
 * OHLCV uses the public Klines endpoint — no API key required.
 * An API key is only needed for private endpoints.
 *
 * Docs: https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
 *
 * Symbol format: 'BTCUSDT', 'ETHUSDT', etc.
 *
 * Note: Binance supports CORS from browsers for public endpoints.
 */
export class BinanceAdapter implements IMarketDataAdapter {
  readonly providerId = 'binance' as const

  private readonly baseUrl: string
  private readonly apiKey?: string

  constructor(config: BinanceConfig) {
    this.apiKey  = config.apiKey
    this.baseUrl = config.testnet
      ? TESTNET_BASE_URL
      : (config.baseUrl ?? DEFAULT_BASE_URL)
  }

  // ── Fetch OHLCV bars ────────────────────────────────────────────────────────

  async fetchBars(params: FetchBarsParams): Promise<OHLCVBar[]> {
    const { symbol, timeframe, limit = 500 } = params
    const binanceSymbol = normalizeBinanceSymbol(symbol)
    const interval      = binanceInterval(timeframe)
    const cappedLimit   = Math.min(limit, MAX_BARS_PER_REQUEST)

    const url = new URL(`${this.baseUrl}/api/v3/klines`)
    url.searchParams.set('symbol',   binanceSymbol)
    url.searchParams.set('interval', interval)
    url.searchParams.set('limit',    String(cappedLimit))

    if (params.from) url.searchParams.set('startTime', String(params.from * 1000))
    if (params.to)   url.searchParams.set('endTime',   String(params.to   * 1000))

    const raw = await this.get<BinanceRaw.KlinesResponse>(url.toString())

    return raw.map((kline): OHLCVBar => ({
      time:   Math.floor(kline[0] / 1000),   // ms → s
      open:   parseFloat(kline[1]),
      high:   parseFloat(kline[2]),
      low:    parseFloat(kline[3]),
      close:  parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
    }))
  }

  // ── Fetch latest quote ──────────────────────────────────────────────────────

  async fetchQuote(symbol: string): Promise<QuoteData | null> {
    const binanceSymbol = normalizeBinanceSymbol(symbol)

    // GET /api/v3/ticker/24hr returns 24h stats including price change
    const url = new URL(`${this.baseUrl}/api/v3/ticker/24hr`)
    url.searchParams.set('symbol', binanceSymbol)

    interface Ticker24h {
      symbol:             string
      lastPrice:          string
      priceChange:        string
      priceChangePercent: string
      volume:             string
      closeTime:          number
    }

    let ticker: Ticker24h
    try {
      ticker = await this.get<Ticker24h>(url.toString())
    } catch {
      return null
    }

    return {
      symbol,
      price:     parseFloat(ticker.lastPrice),
      change:    parseFloat(ticker.priceChange),
      changePct: parseFloat(ticker.priceChangePercent),
      volume:    parseFloat(ticker.volume),
      timestamp: Math.floor(ticker.closeTime / 1000),
    }
  }

  // ── HTTP helper ─────────────────────────────────────────────────────────────

  private async get<T>(url: string): Promise<T> {
    const headers: HeadersInit = { 'Accept': 'application/json' }
    if (this.apiKey) headers['X-MBX-APIKEY'] = this.apiKey

    let res: Response
    try {
      res = await fetch(url, { headers })
    } catch (err) {
      throw new NetworkError('binance', 0, url, err)
    }

    if (res.status === 429 || res.status === 418) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10)
      throw new RateLimitError('binance', retryAfter)
    }
    if (res.status === 400) {
      // Binance returns 400 for invalid symbols
      interface BinanceError { code: number; msg: string }
      const body = await res.json().catch(() => ({})) as BinanceError
      if (body?.code === -1121) throw new SymbolNotFoundError('binance', url)
      throw new ParseError('binance', body?.msg ?? 'Bad request')
    }
    if (!res.ok) throw new NetworkError('binance', res.status, url)

    try {
      return (await res.json()) as T
    } catch (err) {
      throw new ParseError('binance', 'Invalid JSON', err)
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise common symbol formats to Binance's uppercase-no-slash format.
 * 'BTC/USDT' → 'BTCUSDT',  'btcusdt' → 'BTCUSDT'
 */
function normalizeBinanceSymbol(symbol: string): string {
  return symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}
