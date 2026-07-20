import type { OHLCVBar, Timeframe } from '@/types'

// ─── Provider IDs ──────────────────────────────────────────────────────────────

export type ProviderId = 'polygon' | 'alpaca' | 'tradovate' | 'binance' | 'yahoo'

// ─── Per-provider configuration ───────────────────────────────────────────────

export interface PolygonConfig {
  providerId: 'polygon'
  apiKey: string
  /** @default 'https://api.polygon.io' */
  baseUrl?: string
}

export interface AlpacaConfig {
  providerId: 'alpaca'
  apiKey: string
  apiSecret: string
  /** @default 'https://data.alpaca.markets' */
  baseUrl?: string
  /** Data feed: 'sip' (paid) or 'iex' (free). @default 'iex' */
  feed?: 'sip' | 'iex'
}

export interface TradovateConfig {
  providerId: 'tradovate'
  username: string
  password: string
  /** Application ID registered with Tradovate. */
  appId: string
  appVersion: string
  /** CID from Tradovate developer portal. */
  cid: number
  /** Client secret from Tradovate developer portal. */
  sec: string
  /** @default 'live' */
  environment?: 'live' | 'demo'
}

export interface BinanceConfig {
  providerId: 'binance'
  /** Not required for public OHLCV endpoints. */
  apiKey?: string
  apiSecret?: string
  /** @default 'https://api.binance.com' */
  baseUrl?: string
  /** Use Binance testnet. @default false */
  testnet?: boolean
}

export interface YahooConfig {
  providerId: 'yahoo'
  /**
   * Optional CORS proxy prefix for browser environments.
   * e.g. 'https://corsproxy.io/?'
   */
  corsProxy?: string
}

export type ProviderConfig =
  | PolygonConfig
  | AlpacaConfig
  | TradovateConfig
  | BinanceConfig
  | YahooConfig

// ─── Common request / response types ──────────────────────────────────────────

export interface FetchBarsParams {
  symbol: string
  timeframe: Timeframe
  /**
   * Range start — Unix timestamp in seconds (inclusive).
   * When omitted the adapter uses a sensible default lookback.
   */
  from?: number
  /**
   * Range end — Unix timestamp in seconds (inclusive).
   * When omitted defaults to now.
   */
  to?: number
  /** Maximum number of bars to return. Some providers may cap this. */
  limit?: number
}

export interface QuoteData {
  symbol: string
  /** Latest traded price. */
  price: number
  /** Absolute change vs previous close. */
  change: number
  /** Percentage change vs previous close. */
  changePct: number
  /** Latest traded volume. */
  volume: number
  /** Unix timestamp (seconds) of the quote. */
  timestamp: number
}

// ─── Adapter interface ─────────────────────────────────────────────────────────

/**
 * Every provider adapter must implement this interface.
 * Adapters are responsible for authentication, request construction,
 * response parsing, and normalising data into `OHLCVBar[]`.
 */
export interface IMarketDataAdapter {
  readonly providerId: ProviderId

  /**
   * Fetch historical OHLCV bars and normalise them to `OHLCVBar[]`.
   * `bar.time` is always Unix seconds.
   */
  fetchBars(params: FetchBarsParams): Promise<OHLCVBar[]>

  /**
   * Fetch the latest quote for a symbol.
   * Returns `null` if the provider does not support quotes or the symbol is unknown.
   */
  fetchQuote(symbol: string): Promise<QuoteData | null>
}

// ─── Raw response shapes (namespaced per provider) ───────────────────────────
// These are used internally by adapters for safe JSON parsing.

export namespace PolygonRaw {
  export interface AggBar {
    t: number   // open timestamp ms
    o: number
    h: number
    l: number
    c: number
    v: number
    vw?: number // volume-weighted avg price
    n?: number  // number of transactions
  }
  export interface AggResponse {
    results?: AggBar[]
    status: string
    resultsCount?: number
    ticker?: string
    error?: string
    message?: string
  }
  export interface SnapshotTicker {
    day?: { c: number; v: number }
    prevDay?: { c: number }
    lastTrade?: { t: number }
    ticker?: string
  }
  export interface SnapshotResponse {
    ticker?: SnapshotTicker
    status?: string
  }
}

export namespace AlpacaRaw {
  export interface Bar {
    t: string   // ISO 8601
    o: number
    h: number
    l: number
    c: number
    v: number
    vw?: number
    n?: number
  }
  export interface BarsResponse {
    bars?: Bar[]
    symbol?: string
    next_page_token?: string | null
  }
  export interface LatestBar {
    bar?: Bar
    symbol?: string
  }
}

export namespace TradovateRaw {
  export interface AuthResponse {
    accessToken: string
    expirationTime: string
    userId: number
    userStatus: string
    name: string
    hasLive?: boolean
  }
  export interface Tick {
    id: number
    contractId?: number
    timestamp: string  // ISO 8601
    up?: number
    down?: number
    bidPrice?: number
    offerPrice?: number
    openingPrice?: number
    openPrice?: number    // alias used in some versions
    highPrice?: number
    lowPrice?: number
    closePrice?: number
  }
  export interface ChartResponse {
    id: number
    td: number
    bp?: number
    bs?: number
    ts?: number
    tk?: Tick[]
    s?: 'Success' | string
  }
}

export namespace BinanceRaw {
  /**
   * Kline array positions:
   * [0] openTime(ms), [1] open, [2] high, [3] low, [4] close,
   * [5] volume, [6] closeTime(ms), [7-11] other fields
   */
  export type Kline = [
    number,  // 0  openTime ms
    string,  // 1  open
    string,  // 2  high
    string,  // 3  low
    string,  // 4  close
    string,  // 5  volume
    number,  // 6  closeTime ms
    string,  // 7  quoteAssetVolume
    number,  // 8  numberOfTrades
    string,  // 9  takerBuyBaseVolume
    string,  // 10 takerBuyQuoteVolume
    string,  // 11 ignore
  ]
  export type KlinesResponse = Kline[]
}

export namespace YahooRaw {
  export interface Quote {
    open:   (number | null)[]
    high:   (number | null)[]
    low:    (number | null)[]
    close:  (number | null)[]
    volume: (number | null)[]
  }
  export interface ChartResult {
    meta: {
      symbol: string
      regularMarketPrice?: number
      previousClose?: number
      regularMarketVolume?: number
      regularMarketTime?: number
    }
    timestamp?: number[]
    indicators?: {
      quote?: Quote[]
      adjclose?: { adjclose?: (number | null)[] }[]
    }
  }
  export interface ChartResponse {
    chart?: {
      result?: ChartResult[] | null
      error?: { code: string; description: string } | null
    }
  }
}
