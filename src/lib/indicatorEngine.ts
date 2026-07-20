/**
 * Indicator Engine — incremental (streaming) indicator calculations.
 *
 * Each `Inc*` class maintains internal state so a new bar can be processed
 * in O(1) without recomputing the full history.
 *
 * The `IndicatorEngine` class bundles all requested indicators and exposes:
 *   - `initialize(bars)`  — full recompute from a batch of bars
 *   - `update(bar)`       — O(1) incremental update for a single new bar
 *   - `results`           — latest computed values
 *
 * The `useIndicatorEngine` React hook wires the engine to the Zustand
 * chart store and re-runs automatically whenever bars change.
 */

import { useEffect, useRef, useState } from 'react'
import type { OHLCVBar } from '@/types'
import type {
  IndicatorPoint,
  EngineResults,
  EngineOptions,
} from './indicatorTypes'
import {
  calcSMA,
  calcEMA,
  calcVWAP,
  calcRSI,
  calcMACD,
  calcATR,
  calcADX,
  calcBollingerBands,
  calcVolumeProfile,
  calcAnchoredVWAP,
} from './indicators'
import { useChartStore } from '@/store'

// ─── Primitive incremental building blocks ────────────────────────────────────

/** Circular ring buffer — O(1) push, maintains running sum. */
class RingBuffer {
  private readonly buf: Float64Array
  private pos   = 0
  private _sum  = 0
  private count = 0

  constructor(readonly size: number) {
    this.buf = new Float64Array(size)
  }

  push(v: number): void {
    if (this.count >= this.size) this._sum -= this.buf[this.pos]
    else this.count++
    this.buf[this.pos] = v
    this.pos  = (this.pos + 1) % this.size
    this._sum += v
  }

  get sum():  number  { return this._sum }
  get mean(): number  { return this.count >= this.size ? this._sum / this.size : NaN }
  get full(): boolean { return this.count >= this.size }
  get len():  number  { return this.count }

  /** Snapshot of all stored values in chronological order. */
  toArray(): number[] {
    const arr: number[] = []
    const start = this.full ? this.pos : 0
    for (let i = 0; i < this.count; i++) {
      arr.push(this.buf[(start + i) % this.size])
    }
    return arr
  }

  sumSquares(): number {
    let ss = 0
    for (let i = 0; i < this.count; i++) ss += this.buf[i] ** 2
    return ss
  }
}

// ─── IncEMA ───────────────────────────────────────────────────────────────────

export class IncEMA {
  private value: number | null = null
  private initBuf: number[] = []
  readonly k: number

  constructor(readonly period: number) {
    this.k = 2 / (period + 1)
  }

  next(close: number): number | null {
    if (this.value === null) {
      this.initBuf.push(close)
      if (this.initBuf.length === this.period) {
        this.value = this.initBuf.reduce((a, b) => a + b, 0) / this.period
        this.initBuf = []
      }
      return this.value
    }
    this.value = close * this.k + this.value * (1 - this.k)
    return this.value
  }

  reset(): void {
    this.value = null
    this.initBuf = []
  }
}

// ─── IncSMA ───────────────────────────────────────────────────────────────────

export class IncSMA {
  private ring: RingBuffer

  constructor(readonly period: number) {
    this.ring = new RingBuffer(period)
  }

  next(close: number): number | null {
    this.ring.push(close)
    return this.ring.full ? this.ring.mean : null
  }

  reset(): void { this.ring = new RingBuffer(this.period) }
}

// ─── IncVWAP ──────────────────────────────────────────────────────────────────

/** Session VWAP that resets each UTC calendar day. */
export class IncVWAP {
  private cumPV  = 0
  private cumVol = 0
  private lastDay = -1

  next(bar: OHLCVBar): number {
    const day = Math.floor(bar.time / 86400)
    if (day !== this.lastDay) {
      this.cumPV  = 0
      this.cumVol = 0
      this.lastDay = day
    }
    const typical = (bar.high + bar.low + bar.close) / 3
    this.cumPV  += typical * bar.volume
    this.cumVol += bar.volume
    return this.cumVol > 0 ? this.cumPV / this.cumVol : bar.close
  }

  reset(): void {
    this.cumPV  = 0
    this.cumVol = 0
    this.lastDay = -1
  }
}

// ─── IncRSI ───────────────────────────────────────────────────────────────────

export class IncRSI {
  private avgGain: number | null = null
  private avgLoss: number | null = null
  private prevClose: number | null = null
  private seedGains: number[] = []
  private seedLosses: number[] = []
  private count = 0

  constructor(readonly period = 14) {}

  next(close: number): number | null {
    this.count++
    if (this.prevClose === null) {
      this.prevClose = close
      return null
    }
    const d = close - this.prevClose
    this.prevClose = close

    if (this.avgGain === null) {
      this.seedGains.push(Math.max(d, 0))
      this.seedLosses.push(Math.max(-d, 0))
      if (this.seedGains.length === this.period) {
        this.avgGain = this.seedGains.reduce((a, b) => a + b, 0) / this.period
        this.avgLoss = this.seedLosses.reduce((a, b) => a + b, 0) / this.period
        return this.rsi()
      }
      return null
    }

    this.avgGain = (this.avgGain * (this.period - 1) + Math.max(d, 0))  / this.period
    this.avgLoss = (this.avgLoss! * (this.period - 1) + Math.max(-d, 0)) / this.period
    return this.rsi()
  }

  private rsi(): number {
    if (!this.avgLoss) return 100
    return 100 - 100 / (1 + this.avgGain! / this.avgLoss)
  }

  reset(): void {
    this.avgGain = null; this.avgLoss = null; this.prevClose = null
    this.seedGains = []; this.seedLosses = []; this.count = 0
  }
}

// ─── IncMACD ──────────────────────────────────────────────────────────────────

export class IncMACD {
  private fastEMA:   IncEMA
  private slowEMA:   IncEMA
  private signalEMA: IncEMA

  constructor(fast = 12, slow = 26, signal = 9) {
    this.fastEMA   = new IncEMA(fast)
    this.slowEMA   = new IncEMA(slow)
    this.signalEMA = new IncEMA(signal)
  }

  next(close: number): { macd: number | null; signal: number | null; histogram: number | null } {
    const f = this.fastEMA.next(close)
    const s = this.slowEMA.next(close)
    const macd = f !== null && s !== null ? f - s : null
    const sig  = macd !== null ? this.signalEMA.next(macd) : null
    const hist = macd !== null && sig !== null ? macd - sig : null
    return { macd, signal: sig, histogram: hist }
  }

  reset(): void {
    this.fastEMA.reset()
    this.slowEMA.reset()
    this.signalEMA.reset()
  }
}

// ─── IncATR ───────────────────────────────────────────────────────────────────

export class IncATR {
  private value: number | null = null
  private prevClose: number | null = null
  private seedTRs: number[] = []

  constructor(readonly period = 14) {}

  next(bar: OHLCVBar): number | null {
    const pc = this.prevClose ?? bar.open
    const tr = Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - pc),
      Math.abs(bar.low  - pc),
    )
    this.prevClose = bar.close

    if (this.value === null) {
      this.seedTRs.push(tr)
      if (this.seedTRs.length === this.period) {
        this.value = this.seedTRs.reduce((a, b) => a + b, 0) / this.period
        this.seedTRs = []
      }
      return this.value
    }
    this.value = (this.value * (this.period - 1) + tr) / this.period
    return this.value
  }

  reset(): void { this.value = null; this.prevClose = null; this.seedTRs = [] }
}

// ─── IncADX ───────────────────────────────────────────────────────────────────

export class IncADX {
  private sTR:  number | null = null
  private sDMP: number | null = null
  private sDMM: number | null = null
  private sDX:  number | null = null
  private prevHigh:  number | null = null
  private prevLow:   number | null = null
  private prevClose: number | null = null
  private seedTRs:  number[] = []
  private seedDMPs: number[] = []
  private seedDMMs: number[] = []
  private seedDXs:  number[] = []

  constructor(readonly period = 14) {}

  next(bar: OHLCVBar): { adx: number | null; plusDI: number | null; minusDI: number | null } {
    if (this.prevHigh === null) {
      this.prevHigh  = bar.high
      this.prevLow   = bar.low
      this.prevClose = bar.close
      return { adx: null, plusDI: null, minusDI: null }
    }
    const pc = this.prevClose!
    const tr = Math.max(bar.high - bar.low, Math.abs(bar.high - pc), Math.abs(bar.low - pc))
    const upMove   = bar.high - this.prevHigh
    const downMove = this.prevLow! - bar.low
    const dmp = upMove > downMove && upMove > 0 ? upMove : 0
    const dmm = downMove > upMove && downMove > 0 ? downMove : 0

    this.prevHigh  = bar.high
    this.prevLow   = bar.low
    this.prevClose = bar.close

    // Seed phase
    if (this.sTR === null) {
      this.seedTRs.push(tr)
      this.seedDMPs.push(dmp)
      this.seedDMMs.push(dmm)
      if (this.seedTRs.length === this.period) {
        this.sTR  = this.seedTRs.reduce((a, b)  => a + b, 0)
        this.sDMP = this.seedDMPs.reduce((a, b) => a + b, 0)
        this.sDMM = this.seedDMMs.reduce((a, b) => a + b, 0)
        return this.calc()
      }
      return { adx: null, plusDI: null, minusDI: null }
    }

    // Wilder's smoothing: sTR = sTR - sTR/period + tr
    this.sTR  = this.sTR  - this.sTR  / this.period + tr
    this.sDMP = this.sDMP! - this.sDMP! / this.period + dmp
    this.sDMM = this.sDMM! - this.sDMM! / this.period + dmm
    return this.calc()
  }

  private calc(): { adx: number | null; plusDI: number | null; minusDI: number | null } {
    const tr = this.sTR!
    if (tr === 0) return { adx: this.sDX ?? null, plusDI: 0, minusDI: 0 }
    const pDI = 100 * this.sDMP! / tr
    const mDI = 100 * this.sDMM! / tr
    const sum = pDI + mDI
    const dx  = sum === 0 ? 0 : 100 * Math.abs(pDI - mDI) / sum

    if (this.sDX === null) {
      this.seedDXs.push(dx)
      if (this.seedDXs.length === this.period) {
        this.sDX = this.seedDXs.reduce((a, b) => a + b, 0) / this.period
        this.seedDXs = []
      }
    } else {
      this.sDX = (this.sDX * (this.period - 1) + dx) / this.period
    }

    return {
      adx:     this.sDX !== null ? Math.min(100, Math.max(0, this.sDX)) : null,
      plusDI:  Math.min(100, Math.max(0, pDI)),
      minusDI: Math.min(100, Math.max(0, mDI)),
    }
  }

  reset(): void {
    this.sTR = null; this.sDMP = null; this.sDMM = null; this.sDX = null
    this.prevHigh = null; this.prevLow = null; this.prevClose = null
    this.seedTRs = []; this.seedDMPs = []; this.seedDMMs = []; this.seedDXs = []
  }
}

// ─── IncBollingerBands ────────────────────────────────────────────────────────

export class IncBollingerBands {
  private ring: RingBuffer

  constructor(readonly period = 20, readonly kStdDev = 2) {
    this.ring = new RingBuffer(period)
  }

  next(close: number): { upper: number | null; middle: number | null; lower: number | null; bandwidth: number | null; pctB: number | null } {
    this.ring.push(close)
    if (!this.ring.full) return { upper: null, middle: null, lower: null, bandwidth: null, pctB: null }

    const vals = this.ring.toArray()
    const middle = this.ring.mean
    const mean   = middle
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / this.period
    const sd     = Math.sqrt(variance)
    const upper  = middle + this.kStdDev * sd
    const lower  = middle - this.kStdDev * sd
    const bw     = middle !== 0 ? (upper - lower) / middle : null
    const pctB   = upper !== lower ? (close - lower) / (upper - lower) : null
    return { upper, middle, lower, bandwidth: bw, pctB }
  }

  reset(): void { this.ring = new RingBuffer(this.period) }
}

// ─── IncAnchoredVWAP ──────────────────────────────────────────────────────────

export class IncAnchoredVWAP {
  private cumPV  = 0
  private cumVol = 0
  private active = false

  constructor(readonly anchorTime: number) {}

  next(bar: OHLCVBar): number | null {
    if (!this.active && bar.time >= this.anchorTime) this.active = true
    if (!this.active) return null
    const typical = (bar.high + bar.low + bar.close) / 3
    this.cumPV  += typical * bar.volume
    this.cumVol += bar.volume
    return this.cumVol > 0 ? this.cumPV / this.cumVol : bar.close
  }

  reset(): void { this.cumPV = 0; this.cumVol = 0; this.active = false }
}

// ─── IndicatorEngine ──────────────────────────────────────────────────────────

function emptyResults(): EngineResults {
  return { sma: {}, ema: {}, vwap: [], rsi: [], macd: [], atr: [], adx: [], bb: [], avwap: {}, volumeProfile: null }
}

/**
 * Bundles all indicator calculators for a given configuration.
 *
 * @example
 * ```ts
 * const engine = new IndicatorEngine({ ema: [20, 50], rsi: 14, macd: {} })
 * engine.initialize(bars)
 * // New bar arrives:
 * engine.update(newBar)
 * const { ema, rsi, macd } = engine.results
 * ```
 */
export class IndicatorEngine {
  private readonly opts: Required<EngineOptions>

  // Incremental state
  private smaInc:   Map<number, IncSMA>    = new Map()
  private emaInc:   Map<number, IncEMA>    = new Map()
  private vwapInc   = new IncVWAP()
  private rsiInc    = new IncRSI(14)
  private macdInc   = new IncMACD(12, 26, 9)
  private atrInc    = new IncATR(14)
  private adxInc    = new IncADX(14)
  private bbInc     = new IncBollingerBands(20, 2)
  private avwapInc: Map<number, IncAnchoredVWAP> = new Map()

  // Result accumulators
  results: EngineResults = emptyResults()

  constructor(opts: EngineOptions = {}) {
    this.opts = {
      sma:           opts.sma           ?? [],
      ema:           opts.ema           ?? [20, 50],
      vwap:          opts.vwap          ?? false,
      rsi:           opts.rsi           ?? 14,
      macd:          opts.macd          ?? { fast: 12, slow: 26, signal: 9 },
      atr:           opts.atr           ?? 14,
      adx:           opts.adx           ?? 14,
      bb:            opts.bb            ?? { period: 20, stdDev: 2 },
      volumeProfile: opts.volumeProfile ?? { levels: 24 },
      avwap:         opts.avwap         ?? [],
    }
    this.buildCalcs()
  }

  private buildCalcs(): void {
    const o = this.opts
    for (const p of o.sma)  this.smaInc.set(p, new IncSMA(p))
    for (const p of o.ema)  this.emaInc.set(p, new IncEMA(p))
    this.rsiInc  = new IncRSI(o.rsi)
    this.macdInc = new IncMACD(o.macd.fast, o.macd.slow, o.macd.signal)
    this.atrInc  = new IncATR(o.atr)
    this.adxInc  = new IncADX(o.adx)
    this.bbInc   = new IncBollingerBands(o.bb.period, o.bb.stdDev)
    for (const ts of o.avwap) this.avwapInc.set(ts, new IncAnchoredVWAP(ts))
  }

  /** Full recompute — use when the bar series changes completely. */
  initialize(bars: OHLCVBar[]): void {
    if (!bars.length) { this.results = emptyResults(); return }
    const o = this.opts

    // Use batch functions for accuracy on full history
    const smaRes: Record<string, IndicatorPoint[]> = {}
    for (const p of o.sma) smaRes[`sma-${p}`] = calcSMA(bars, p)

    const emaRes: Record<string, IndicatorPoint[]> = {}
    for (const p of o.ema) emaRes[`ema-${p}`] = calcEMA(bars, p)

    const avwapRes: Record<string, IndicatorPoint[]> = {}
    for (const ts of o.avwap) avwapRes[`avwap-${ts}`] = calcAnchoredVWAP(bars, ts)

    this.results = {
      sma:   smaRes,
      ema:   emaRes,
      vwap:  o.vwap          ? calcVWAP(bars)               : [],
      rsi:   calcRSI(bars,  o.rsi),
      macd:  calcMACD(bars,  o.macd.fast, o.macd.slow, o.macd.signal),
      atr:   calcATR(bars,  o.atr),
      adx:   calcADX(bars,  o.adx),
      bb:    calcBollingerBands(bars, o.bb.period, o.bb.stdDev),
      avwap: avwapRes,
      volumeProfile: o.volumeProfile ? calcVolumeProfile(bars, o.volumeProfile.levels) : null,
    }

    // Sync incremental state to end of history so subsequent update() calls are correct
    this.resetCalcs()
    for (const bar of bars) this.advanceCalcs(bar)
  }

  /**
   * Incremental update — O(1) per indicator.
   * Appends a new point to each result array.
   */
  update(bar: OHLCVBar): void {
    const o   = this.opts
    const r   = this.results
    const pt  = (v: number | null): IndicatorPoint => ({ time: bar.time, value: v })

    for (const [p, calc] of this.smaInc)  r.sma[`sma-${p}`].push(pt(calc.next(bar.close)))
    for (const [p, calc] of this.emaInc)  r.ema[`ema-${p}`].push(pt(calc.next(bar.close)))
    if (o.vwap)  r.vwap.push(pt(this.vwapInc.next(bar)))
    r.rsi.push(pt(this.rsiInc.next(bar.close)))
    const m = this.macdInc.next(bar.close)
    r.macd.push({ time: bar.time, ...m })
    r.atr.push(pt(this.atrInc.next(bar)))
    const adxPt = this.adxInc.next(bar)
    r.adx.push({ time: bar.time, ...adxPt })
    const bbPt = this.bbInc.next(bar.close)
    r.bb.push({ time: bar.time, ...bbPt })
    for (const [ts, calc] of this.avwapInc) r.avwap[`avwap-${ts}`].push(pt(calc.next(bar)))

    // Volume profile always recomputes (fast for typical bar counts)
    // We can't do this without access to full history — handled in hook
  }

  /** Update the latest bar in-place (e.g., partial/live bar). */
  updateLast(_bar: OHLCVBar, allBars: OHLCVBar[]): void {
    // Simply reinitialize from full history — the batched path is fast
    this.initialize(allBars)
  }

  private resetCalcs(): void {
    for (const c of this.smaInc.values())   c.reset()
    for (const c of this.emaInc.values())   c.reset()
    this.vwapInc.reset()
    this.rsiInc.reset()
    this.macdInc.reset()
    this.atrInc.reset()
    this.adxInc.reset()
    this.bbInc.reset()
    for (const c of this.avwapInc.values()) c.reset()
  }

  private advanceCalcs(bar: OHLCVBar): void {
    for (const calc of this.smaInc.values())   calc.next(bar.close)
    for (const calc of this.emaInc.values())   calc.next(bar.close)
    this.vwapInc.next(bar)
    this.rsiInc.next(bar.close)
    this.macdInc.next(bar.close)
    this.atrInc.next(bar)
    this.adxInc.next(bar)
    this.bbInc.next(bar.close)
    for (const calc of this.avwapInc.values()) calc.next(bar)
  }
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * Subscribe to chart bars and compute all requested indicators automatically.
 *
 * - Full recompute when the symbol/timeframe changes (new bar series).
 * - O(1) incremental update when a single new bar is appended (live trading).
 *
 * @example
 * ```tsx
 * const { ema, rsi, macd } = useIndicatorEngine({
 *   ema: [20, 50, 200],
 *   rsi: 14,
 *   macd: { fast: 12, slow: 26, signal: 9 },
 *   bb: { period: 20, stdDev: 2 },
 * })
 * ```
 */
export function useIndicatorEngine(opts: EngineOptions = {}): EngineResults {
  const bars = useChartStore((s) => s.bars)

  const engineRef  = useRef<IndicatorEngine | null>(null)
  const prevBarsRef = useRef<OHLCVBar[]>([])

  const [results, setResults] = useState<EngineResults>(emptyResults)

  useEffect(() => {
    if (!bars.length) {
      setResults(emptyResults())
      prevBarsRef.current = []
      return
    }

    // Lazily create or re-create engine when options change
    if (!engineRef.current) {
      engineRef.current = new IndicatorEngine(opts)
    }

    const engine   = engineRef.current
    const prevBars = prevBarsRef.current

    const isFullReset =
      prevBars.length === 0 ||
      bars[0]?.time !== prevBars[0]?.time   // different symbol / timeframe

    const isSingleAppend =
      !isFullReset &&
      bars.length === prevBars.length + 1 &&
      bars[bars.length - 1]?.time !== prevBars[prevBars.length - 1]?.time

    if (isFullReset || !isSingleAppend) {
      engine.initialize(bars)
    } else {
      // Live: only process the newly appended bar
      engine.update(bars[bars.length - 1])
      // Volume profile needs full history; refresh it inline
      if (opts.volumeProfile) {
        engine.results.volumeProfile = calcVolumeProfile(bars, opts.volumeProfile.levels)
      }
    }

    prevBarsRef.current = bars
    // Spread to create a new object reference so React re-renders
    setResults({ ...engine.results })
  // opts is intentionally excluded from deps — engine is recreated on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars])

  return results
}
