import type { OHLCVBar, Timeframe } from '@/types'
import { generateSampleData } from '@/lib/sampleData'
import { createServiceFromEnv } from './marketData'

/**
 * Active MarketDataService instance built from env vars.
 * Null when no provider is configured — falls back to sample data.
 */
const liveService = createServiceFromEnv()

/**
 * Fetch OHLCV bars for a symbol and timeframe.
 *
 * - If a provider is configured via env vars, delegates to that adapter.
 * - Otherwise returns deterministic sample data so the UI always has something to render.
 *
 * To connect a real provider, copy `.env.example` to `.env`, set
 * `VITE_MARKET_PROVIDER` and the relevant key variables, then restart the dev server.
 */
export async function fetchBars(symbol: string, timeframe: Timeframe): Promise<OHLCVBar[]> {
  if (liveService) {
    return liveService.fetchBars({ symbol, timeframe, limit: 252 })
  }
  // Sample data fallback
  await new Promise((r) => setTimeout(r, 150))
  return generateSampleData(symbol, 252, 185, '2025-01-02')
}

/**
 * Fetch the latest quote for a symbol.
 */
export async function fetchQuote(symbol: string): Promise<{ price: number; change: number } | null> {
  if (liveService) {
    const q = await liveService.fetchQuote(symbol)
    if (q) return { price: q.price, change: q.change }
  }
  const bars = generateSampleData(symbol, 2)
  if (bars.length < 2) return null
  return { price: bars[1].close, change: bars[1].close - bars[0].close }
}

