import type { OHLCVBar, Timeframe } from '@/types'
import { generateSampleData } from '@/lib/sampleData'
import { createServiceFromEnv } from './marketData'

/**
 * Realistic starting prices for common symbols (for sample data generation).
 * Used when live data is unavailable.
 */
const REALISTIC_STARTING_PRICES: Record<string, number> = {
  // Stocks
  AAPL: 185,
  MSFT: 420,
  GOOGL: 180,
  AMZN: 200,
  TSLA: 250,
  NVDA: 880,
  META: 570,
  NFLX: 250,
  SPY: 600,
  QQQ: 700,
  IWM: 200,
  TLT: 85,
  GLD: 190,
  USO: 78,
  UUP: 106,
  // Crypto
  'BTC/USDT': 95000,
  'ETH/USDT': 3500,
  'SOL/USDT': 200,
}

/**
 * Get a realistic starting price for a symbol.
 * Returns the price from the mapping, or tries to fetch it live, or uses a default.
 */
async function getRealisticStartingPrice(symbol: string): Promise<number> {
  // Check if we have a mapped price
  if (REALISTIC_STARTING_PRICES[symbol]) {
    return REALISTIC_STARTING_PRICES[symbol]
  }

  // Try to fetch live price
  if (liveService) {
    try {
      const quote = await liveService.fetchQuote(symbol)
      if (quote?.price) {
        return quote.price
      }
    } catch {
      // Fall through to default
    }
  }

  // Default price
  return 185
}

/**
 * Active MarketDataService instance built from env vars.
 * Null when no provider is configured — falls back to sample data.
 */
const liveService = createServiceFromEnv()
const providerName = import.meta.env.VITE_MARKET_PROVIDER as string | undefined

// Log which data source is active on app start
if (typeof window !== 'undefined') {
  console.log(
    `[Trading Analyzer] Market Data: ${providerName ? `Live (${providerName})` : 'Demo Data (Sample)'}`,
  )
}

/**
 * Fetch OHLCV bars for a symbol and timeframe.
 *
 * - If a provider is configured via env vars, delegates to that adapter.
 * - On error, automatically falls back to realistic sample data.
 * - Returns deterministic sample data so the UI always has something to render.
 *
 * To connect a real provider, see docs/LIVE_DATA_SETUP.md
 */
export async function fetchBars(symbol: string, timeframe: Timeframe): Promise<OHLCVBar[]> {
  if (liveService) {
    try {
      const bars = await liveService.fetchBars({ symbol, timeframe, limit: 252 })
      if (bars && bars.length > 0) {
        return bars
      }
    } catch (err) {
      console.warn(`[Trading Analyzer] Live data fetch failed for ${symbol}:`, err instanceof Error ? err.message : String(err))
      console.info('[Trading Analyzer] Falling back to demo data...')
      // Fall through to sample data
    }
  }
  
  // Sample data fallback: use realistic market price as starting price
  await new Promise((r) => setTimeout(r, 150))
  const startPrice = await getRealisticStartingPrice(symbol)
  return generateSampleData(symbol, timeframe, startPrice, '2025-01-02')
}

/**
 * Fetch the latest quote for a symbol (price and change).
 * Falls back to sample data on any error.
 */
export async function fetchQuote(symbol: string): Promise<{ price: number; change: number } | null> {
  if (liveService) {
    try {
      const q = await liveService.fetchQuote(symbol)
      if (q) return { price: q.price, change: q.change }
    } catch (err) {
      // Silently fall through to sample data
    }
  }
  
  // Sample data fallback
  const startPrice = await getRealisticStartingPrice(symbol)
  const bars = generateSampleData(symbol, '1D', startPrice, '2025-01-02')
  if (bars.length < 2) return null
  return {
    price: bars[bars.length - 1].close,
    change: bars[bars.length - 1].close - bars[bars.length - 2].close,
  }
}

