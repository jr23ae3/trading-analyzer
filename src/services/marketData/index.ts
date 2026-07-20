import type { OHLCVBar } from '@/types'
import type {
  IMarketDataAdapter,
  ProviderId,
  ProviderConfig,
  FetchBarsParams,
  QuoteData,
} from './types'
import { MarketDataError } from './errors'
import { PolygonAdapter }   from './providers/polygon'
import { AlpacaAdapter }    from './providers/alpaca'
import { TradovateAdapter } from './providers/tradovate'
import { BinanceAdapter }   from './providers/binance'
import { YahooAdapter }     from './providers/yahoo'

// Re-export everything consumers need
export type {
  IMarketDataAdapter,
  ProviderId,
  ProviderConfig,
  FetchBarsParams,
  QuoteData,
  PolygonConfig,
  AlpacaConfig,
  TradovateConfig,
  BinanceConfig,
  YahooConfig,
  PolygonRaw,
  AlpacaRaw,
  TradovateRaw,
  BinanceRaw,
  YahooRaw,
} from './types'

export {
  MarketDataError,
  NetworkError,
  ParseError,
  AuthError,
  RateLimitError,
  SymbolNotFoundError,
} from './errors'

export { PolygonAdapter }   from './providers/polygon'
export { AlpacaAdapter }    from './providers/alpaca'
export { TradovateAdapter } from './providers/tradovate'
export { BinanceAdapter }   from './providers/binance'
export { YahooAdapter }     from './providers/yahoo'

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Construct the correct adapter from a discriminated `ProviderConfig`.
 */
export function createAdapter(config: ProviderConfig): IMarketDataAdapter {
  switch (config.providerId) {
    case 'polygon':   return new PolygonAdapter(config)
    case 'alpaca':    return new AlpacaAdapter(config)
    case 'tradovate': return new TradovateAdapter(config)
    case 'binance':   return new BinanceAdapter(config)
    case 'yahoo':     return new YahooAdapter(config)
    default: {
      const _exhaustive: never = config
      throw new MarketDataError(`Unknown provider`, (_exhaustive as ProviderConfig).providerId)
    }
  }
}

// ─── Service class ────────────────────────────────────────────────────────────

/**
 * High-level market data service.
 *
 * Wraps an `IMarketDataAdapter` and adds:
 *  - Runtime provider switching
 *  - Optional in-memory LRU cache
 *  - Consistent error surface
 *
 * @example
 * ```ts
 * const service = new MarketDataService({
 *   providerId: 'binance',
 * })
 * const bars = await service.fetchBars({ symbol: 'BTCUSDT', timeframe: '1D' })
 * ```
 *
 * @example With Polygon (requires API key):
 * ```ts
 * const service = new MarketDataService({
 *   providerId: 'polygon',
 *   apiKey: import.meta.env.VITE_POLYGON_API_KEY,
 * })
 * ```
 */
export class MarketDataService {
  private adapter: IMarketDataAdapter
  private readonly cache = new Map<string, { data: OHLCVBar[]; fetchedAt: number }>()
  private readonly cacheTtlMs: number

  /**
   * @param config         Provider configuration (discriminated by `providerId`).
   * @param cacheTtlMs     How long to cache bar results in ms. @default 60_000 (1 min)
   */
  constructor(config: ProviderConfig, cacheTtlMs = 60_000) {
    this.adapter    = createAdapter(config)
    this.cacheTtlMs = cacheTtlMs
  }

  get providerId(): ProviderId {
    return this.adapter.providerId
  }

  /**
   * Hot-swap the underlying provider without recreating the service instance.
   */
  setProvider(config: ProviderConfig): void {
    this.adapter = createAdapter(config)
    this.cache.clear()
  }

  /**
   * Fetch OHLCV bars, using the in-memory cache if available.
   */
  async fetchBars(params: FetchBarsParams): Promise<OHLCVBar[]> {
    const key    = cacheKey(this.adapter.providerId, params)
    const cached = this.cache.get(key)
    const now    = Date.now()

    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      return cached.data
    }

    const data = await this.adapter.fetchBars(params)
    this.cache.set(key, { data, fetchedAt: now })
    return data
  }

  /**
   * Fetch the latest quote for a symbol (not cached).
   */
  fetchQuote(symbol: string): Promise<QuoteData | null> {
    return this.adapter.fetchQuote(symbol)
  }

  /** Clear the in-memory cache. */
  clearCache(): void {
    this.cache.clear()
  }
}

// ─── Singleton helpers ─────────────────────────────────────────────────────────

/**
 * Build a `MarketDataService` from Vite environment variables.
 *
 * Set one of the following groups in your `.env`:
 *
 * ```
 * # Polygon
 * VITE_MARKET_PROVIDER=polygon
 * VITE_POLYGON_API_KEY=your-key
 *
 * # Alpaca
 * VITE_MARKET_PROVIDER=alpaca
 * VITE_ALPACA_API_KEY=your-key
 * VITE_ALPACA_API_SECRET=your-secret
 *
 * # Binance (no key needed for public data)
 * VITE_MARKET_PROVIDER=binance
 *
 * # Yahoo Finance (no key needed)
 * VITE_MARKET_PROVIDER=yahoo
 * ```
 */
export function createServiceFromEnv(): MarketDataService | null {
  const provider = (import.meta.env.VITE_MARKET_PROVIDER ?? '') as string

  switch (provider) {
    case 'polygon': {
      const apiKey = import.meta.env.VITE_POLYGON_API_KEY as string | undefined
      if (!apiKey) return null
      return new MarketDataService({ providerId: 'polygon', apiKey })
    }
    case 'alpaca': {
      const apiKey    = import.meta.env.VITE_ALPACA_API_KEY    as string | undefined
      const apiSecret = import.meta.env.VITE_ALPACA_API_SECRET as string | undefined
      if (!apiKey || !apiSecret) return null
      return new MarketDataService({ providerId: 'alpaca', apiKey, apiSecret })
    }
    case 'binance':
      return new MarketDataService({ providerId: 'binance' })
    case 'yahoo':
      return new MarketDataService({ providerId: 'yahoo' })
    default:
      return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cacheKey(providerId: string, params: FetchBarsParams): string {
  return `${providerId}:${params.symbol}:${params.timeframe}:${params.from ?? ''}:${params.to ?? ''}:${params.limit ?? ''}`
}
