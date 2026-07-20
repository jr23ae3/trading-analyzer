import type { OHLCVBar } from '@/types'

/**
 * Deterministic pseudo-random seeded by a string.
 * Uses a simple mulberry32 PRNG so the same symbol always produces the same data.
 */
function seededPrng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let s = h >>> 0
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return ((s >>> 0) / 4294967296)
  }
}

/**
 * Generate realistic-looking OHLCV bars using a correlated random walk.
 * @param symbol  Used to seed the PRNG so results are deterministic per symbol.
 * @param count   Number of daily bars to generate.
 * @param startPrice  Opening price of the first bar.
 * @param startDate   ISO date string for the first bar (YYYY-MM-DD).
 */
export function generateSampleData(
  symbol = 'AAPL',
  count = 252,
  startPrice = 185,
  startDate = '2025-01-02',
): OHLCVBar[] {
  const rand = seededPrng(symbol)

  // Skip weekends — advance date by 1 day at a time
  function nextTradingDay(ts: number): number {
    let next = ts + 86400
    const dow = new Date(next * 1000).getUTCDay()
    if (dow === 6) next += 86400  // Saturday → Monday
    if (dow === 0) next += 86400  // Sunday → Monday
    return next
  }

  const bars: OHLCVBar[] = []
  let time = Math.floor(new Date(startDate).getTime() / 1000)
  let prevClose = startPrice

  for (let i = 0; i < count; i++) {
    // Overnight gap ±0.5%
    const gap = prevClose * (0.005 * (rand() * 2 - 1))
    const open = Math.max(0.01, prevClose + gap)

    // Intraday drift ±1.5%
    const drift = open * (0.015 * (rand() * 2 - 1))
    const close = Math.max(0.01, open + drift)

    // Range: 0.5% – 2.5% of open
    const range = open * (0.005 + rand() * 0.02)
    const high = Math.max(open, close) + range * rand()
    const low = Math.min(open, close) - range * rand()

    // Volume: 20M – 120M shares with occasional spikes
    const baseVol = 40_000_000 + rand() * 60_000_000
    const volume = rand() > 0.95 ? baseVol * (2 + rand() * 3) : baseVol

    bars.push({
      time,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +Math.max(0.01, low).toFixed(2),
      close: +close.toFixed(2),
      volume: Math.round(volume),
    })

    prevClose = close
    time = nextTradingDay(time)
  }

  return bars
}
