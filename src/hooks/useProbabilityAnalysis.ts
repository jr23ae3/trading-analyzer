import { useEffect, useState } from 'react'
import { useChartStore } from '@/store'
import { calcATR, calcSMA, calcRSI, calcMACD } from '@/lib/indicators'
import { analyzeMarketStructure } from '@/lib/marketStructure'
import { detectSupportResistance } from '@/lib/analysis'
import { analyzeProbability } from '@/lib/probability'
import type { ProbabilityFactors, ProbabilityEngineOptions, ProbabilityEngineResults } from '@/lib/probabilityTypes'

/**
 * Real-time probability analysis hook.
 * Gathers all market factors and calculates directional probabilities.
 */
export function useProbabilityAnalysis(opts?: ProbabilityEngineOptions): ProbabilityEngineResults {
  const bars = useChartStore((s) => s.bars)
  const [results, setResults] = useState<ProbabilityEngineResults>({
    current: null,
    history: [],
    summary: {
      averageBullProbability: 0,
      averageBearProbability: 0,
      averageSidewaysProbability: 0,
      mostCommonGrade: 'C',
      probabilityTrend: 'neutral',
    },
  })

  useEffect(() => {
    if (bars.length < 50) return

    try {
      // Gather all input factors
      const currentBar = bars[bars.length - 1]
      const currentPrice = currentBar.close

      // Trend analysis
      const structure = analyzeMarketStructure(bars)
      const trendInput = {
        direction: structure.trend === 'bull' ? 'bullish' as const : structure.trend === 'bear' ? 'bearish' as const : 'neutral' as const,
        strength: structure.confidence ?? 50,
        barsInTrend: structure.swings.length > 0 ? bars.length - (structure.swings[structure.swings.length - 1]?.barIndex ?? 0) : 10,
      }

      // Volume analysis
      const avgVolume20 = bars.slice(-20).reduce((sum, b) => sum + b.volume, 0) / 20
      const volumeInput = {
        currentVolume: currentBar.volume,
        averageVolume: avgVolume20,
        spikeRatio: avgVolume20 > 0 ? currentBar.volume / avgVolume20 : 1,
        trendConfirmation: (currentPrice > bars[Math.max(0, bars.length - 2)].close && currentBar.volume > avgVolume20) ||
          (currentPrice < bars[Math.max(0, bars.length - 2)].close && currentBar.volume > avgVolume20),
      }

      // Momentum analysis
      const rsiArray = calcRSI(bars, 14)
      const rsiLast = rsiArray[rsiArray.length - 1]?.value ?? 50
      const macdArray = calcMACD(bars)
      const macdLast = macdArray[macdArray.length - 1]
      const rocValue = ((currentPrice - bars[Math.max(0, bars.length - 5)].close) / bars[Math.max(0, bars.length - 5)].close) * 100
      
      const momentumInput = {
        RSI: rsiLast,
        MACD: {
          histogram: macdLast?.histogram ?? 0,
          direction: (macdLast?.histogram ?? 0) > 0 ? 'bullish' as const : (macdLast?.histogram ?? 0) < 0 ? 'bearish' as const : 'neutral' as const,
        },
        ROC: rocValue,
        direction: rocValue > 0 ? 'bullish' as const : rocValue < 0 ? 'bearish' as const : 'neutral' as const,
      }

      // Support/Resistance
      const srLevels = detectSupportResistance(bars)
      const supportLevels = srLevels.filter((l) => l.type === 'support').sort((a, b) => b.score.total - a.score.total)
      const resistanceLevels = srLevels.filter((l) => l.type === 'resistance').sort((a, b) => b.score.total - a.score.total)
      const nearestSupport = supportLevels.length > 0 ? supportLevels[0].price : currentPrice - 100
      const nearestResistance = resistanceLevels.length > 0 ? resistanceLevels[0].price : currentPrice + 100
      const atrValue = calcATR(bars, 14)[bars.length - 1]?.value ?? 1
      
      const srInput = {
        nearestSupport,
        nearestResistance,
        currentPrice,
        distanceToSupport: (currentPrice - nearestSupport) / atrValue,
        distanceToResistance: (nearestResistance - currentPrice) / atrValue,
        supportStrength: supportLevels.length > 0 ? supportLevels[0].score.total : 0,
        resistanceStrength: resistanceLevels.length > 0 ? resistanceLevels[0].score.total : 0,
        supportTouches: supportLevels.length > 0 ? supportLevels[0].touches.length : 0,
        resistanceTouches: resistanceLevels.length > 0 ? resistanceLevels[0].touches.length : 0,
      }

      // ATR/Volatility
      const atrArray = calcATR(bars, 14)
      const atrValues = atrArray.map((p) => p?.value ?? 0).filter((v) => v > 0)
      const atrPercentile = atrValues.length > 0
        ? (atrValues.filter((v) => v <= atrValue).length / atrValues.length) * 100
        : 50
      const priceRange = currentBar.high - currentBar.low

      const atrInput = {
        atr14: atrValue,
        volatility: atrPercentile < 33 ? 'low' as const : atrPercentile < 66 ? 'medium' as const : 'high' as const,
        volatilityPercentile: atrPercentile,
        priceRange,
      }

      // RSI
      const rsiInput = {
        rsi14: rsiLast,
        oversold: rsiLast < 30,
        overbought: rsiLast > 70,
        extreme: rsiLast < 20 || rsiLast > 80,
        direction: rsiLast < 50 ? 'bearish' as const : rsiLast > 50 ? 'bullish' as const : 'neutral' as const,
      }

      // VWAP
      const vwapArray = calcSMA(bars, 100) // Use 100-bar SMA as proxy for VWAP
      const vwapValue = vwapArray[vwapArray.length - 1]?.value ?? currentPrice
      
      const vwapInput = {
        vwap: vwapValue,
        currentPrice,
        distanceFromVWAP: Math.abs(currentPrice - vwapValue) / atrValue,
        aboveVWAP: currentPrice > vwapValue,
        vwapTrend: currentPrice > vwapValue ? 'bullish' as const : currentPrice < vwapValue ? 'bearish' as const : 'neutral' as const,
      }

      // EMA Alignment
      const ema9 = calcSMA(bars, 9)[bars.length - 1]?.value ?? currentPrice
      const ema21 = calcSMA(bars, 21)[bars.length - 1]?.value ?? currentPrice
      const ema50 = calcSMA(bars, 50)[bars.length - 1]?.value ?? currentPrice

      const bullishAlign = ema9 > ema21 && ema21 > ema50
      const bearishAlign = ema9 < ema21 && ema21 < ema50
      const separationRatio = bullishAlign
        ? (ema9 - ema50) / ema50
        : bearishAlign
          ? (ema50 - ema9) / ema50
          : 0

      const emaInput = {
        ema9,
        ema21,
        ema50,
        aligned: bullishAlign || bearishAlign,
        direction: bullishAlign ? 'bullish' as const : bearishAlign ? 'bearish' as const : 'neutral' as const,
        alignmentQuality: Math.min(100, separationRatio * 1000),
      }

      // Market Structure
      const structureInput = {
        trend: structure.trend,
        bias: structure.bias,
        structureQuality: structure.confidence ?? 50,
        recentBOS: structure.structureBreaks.length > 0 && (bars.length - 1 - (structure.structureBreaks[0]?.barIndex ?? 0)) < 10,
        confidence: structure.confidence ?? 50,
      }

      // Combine all factors
      const factors: ProbabilityFactors = {
        trend: trendInput,
        volume: volumeInput,
        momentum: momentumInput,
        supportResistance: srInput,
        atr: atrInput,
        rsi: rsiInput,
        vwap: vwapInput,
        emaAlignment: emaInput,
        marketStructure: structureInput,
      }

      const analysis = analyzeProbability(factors, opts)
      setResults(analysis)
    } catch (error) {
      console.error('Probability analysis error:', error)
    }
  }, [bars, opts])

  return results
}
