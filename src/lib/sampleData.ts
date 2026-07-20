import type { OHLCVBar, Timeframe } from '@/types'

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
 * Get the time increment in seconds for a given timeframe.
 */
function getTimeIncrement(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m': return 60
    case '5m': return 300
    case '15m': return 900
    case '30m': return 1800
    case '1h': return 3600
    case '4h': return 14400
    case '1D': return 86400
    case '1W': return 604800 // 7 days
    case '1M': return 2592000 // 30 days
    default: return 86400
  }
}

/**
 * Get the initial bar count for a given timeframe to ensure sufficient history.
 */
function getBarCount(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m': return 390 // ~1 trading day in 1m
    case '5m': return 78  // ~1 trading day in 5m
    case '15m': return 26 // ~1 trading day in 15m
    case '30m': return 13 // ~1 trading day in 30m
    case '1h': return 6   // ~1 trading day in 1h
    case '4h': return 60  // ~2.5 months in 4h
    case '1D': return 252 // ~1 year in 1D
    case '1W': return 52  // ~1 year in 1W
    case '1M': return 24  // ~2 years in 1M
    default: return 252
  }
}

/**
 * Generate realistic-looking OHLCV bars using a correlated random walk.
 * @param symbol  Used to seed the PRNG so results are deterministic per symbol.
 * @param timeframe Timeframe for bar generation (1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W, 1M).
 * @param startPrice  Opening price of the first bar.
 * @param startDate   ISO date string for the first bar (YYYY-MM-DD).
 */
export function generateSampleData(
  symbol = 'AAPL',
  timeframe: Timeframe = '1D',
  startPrice = 185,
  startDate = '2025-01-02',
): OHLCVBar[] {
  const rand = seededPrng(symbol + timeframe)
  const increment = getTimeIncrement(timeframe)
  const count = getBarCount(timeframe)

  // Skip weekends for daily+ timeframes
  function nextTime(ts: number): number {
    if (increment >= 86400) {
      // For daily and higher timeframes, skip weekends
      let next = ts + increment
      const dow = new Date(next * 1000).getUTCDay()
      if (dow === 6) next += 86400 * 2 // Saturday → Monday
      if (dow === 0) next += 86400     // Sunday → Monday
      return next
    }
    return ts + increment
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
    time = nextTime(time)
  }

  return bars
}
