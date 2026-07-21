import type { TradeEntry } from '@/types'

export interface MistakeFrequency {
  mistake: string
  count: number
  percentage: number
  winRateWithMistake: number
  winRateWithoutMistake: number
  impact: 'critical' | 'high' | 'medium' | 'low'
}

export interface CoachingRecommendation {
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  impact: string // e.g., "Could improve win rate by 15%"
  action: string // Specific action to take
  examples: string[]
}

export interface CoachingAnalysis {
  totalTrades: number
  closedTrades: number
  winRate: number
  mistakes: MistakeFrequency[]
  recommendations: CoachingRecommendation[]
  summary: string
}

// Common trading mistakes (used for tagging trades in journal)
export const COMMON_MISTAKES = [
  'Entering too early',
  'Holding losers',
  'Ignoring trend',
  'FOMO',
  'Poor Risk/Reward',
  'Late entries',
  'Hesitated on entry',
  'Didn\'t scale out at first target',
  'Overtrading',
  'Revenge trading',
  'Position too large',
  'Ignoring support/resistance',
]

export function analyzeCoaching(trades: TradeEntry[]): CoachingAnalysis {
  const closedTrades = trades.filter((t) => t.status === 'closed')
  const closedWithPnL = closedTrades.filter((t) => t.pnl !== undefined)
  const winCount = closedWithPnL.filter((t) => (t.pnl ?? 0) > 0).length
  const winRate = closedWithPnL.length > 0 ? (winCount / closedWithPnL.length) * 100 : 0

  // Analyze mistakes
  const mistakeMap = new Map<string, { count: number; trades: TradeEntry[] }>()

  trades.forEach((trade) => {
    if (trade.mistakes && trade.mistakes.length > 0) {
      trade.mistakes.forEach((mistake) => {
        if (!mistakeMap.has(mistake)) {
          mistakeMap.set(mistake, { count: 0, trades: [] })
        }
        const entry = mistakeMap.get(mistake)!
        entry.count++
        entry.trades.push(trade)
      })
    }
  })

  // Calculate frequencies and win rates
  const mistakes: MistakeFrequency[] = Array.from(mistakeMap.entries())
    .map(([mistake, data]) => {
      const tradesWithMistake = data.trades.filter((t) => t.status === 'closed' && t.pnl !== undefined)
      const tradesWithoutMistake = closedWithPnL.filter(
        (t) => !t.mistakes?.includes(mistake),
      )

      const winsWithMistake = tradesWithMistake.filter((t) => (t.pnl ?? 0) > 0).length
      const winRateWithMistake = tradesWithMistake.length > 0 ? (winsWithMistake / tradesWithMistake.length) * 100 : 0

      const winsWithoutMistake = tradesWithoutMistake.filter((t) => (t.pnl ?? 0) > 0).length
      const winRateWithoutMistake = tradesWithoutMistake.length > 0 ? (winsWithoutMistake / tradesWithoutMistake.length) * 100 : 0

      const impact = winRateWithoutMistake - winRateWithMistake
      let impactLevel: 'critical' | 'high' | 'medium' | 'low'
      if (impact >= 20) impactLevel = 'critical'
      else if (impact >= 10) impactLevel = 'high'
      else if (impact >= 5) impactLevel = 'medium'
      else impactLevel = 'low'

      return {
        mistake,
        count: data.count,
        percentage: (data.count / trades.length) * 100,
        winRateWithMistake,
        winRateWithoutMistake,
        impact: impactLevel,
      }
    })
    .sort((a, b) => b.count - a.count)

  // Generate recommendations
  const recommendations: CoachingRecommendation[] = generateRecommendations(mistakes, trades, winRate)

  // Build summary
  const topMistake = mistakes[0]
  const summary = buildSummary(trades.length, closedTrades.length, winRate, topMistake, recommendations)

  return {
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    winRate,
    mistakes,
    recommendations,
    summary,
  }
}

function generateRecommendations(
  mistakes: MistakeFrequency[],
  trades: TradeEntry[],
  winRate: number,
): CoachingRecommendation[] {
  const recommendations: CoachingRecommendation[] = []

  // Recommendation 1: Top recurring mistake
  if (mistakes.length > 0) {
    const topMistake = mistakes[0]
    if (topMistake.percentage >= 30) {
      const impactGain = topMistake.winRateWithoutMistake - topMistake.winRateWithMistake
      recommendations.push({
        title: `Fix: ${topMistake.mistake}`,
        description: `This mistake appears in ${topMistake.percentage.toFixed(0)}% of your trades and is a major performance blocker.`,
        priority: topMistake.impact === 'critical' ? 'critical' : 'high',
        impact: `Eliminating this could improve your win rate by ${impactGain.toFixed(1)}% (from ${winRate.toFixed(1)}% to ${(winRate + impactGain).toFixed(1)}%)`,
        action: `Before each trade, pause and explicitly check: Have I made this mistake before? What's the specific trigger for this mistake?`,
        examples: buildMistakeExamples(topMistake.mistake),
      })
    }
  }

  // Recommendation 2: Pattern recognition
  const mistakesBySymbol = groupMistakesBySymbol(trades)
  if (mistakesBySymbol.size > 0) {
    const symbolWithMostMistakes = Array.from(mistakesBySymbol.entries()).sort((a, b) => b[1].length - a[1].length)[0]
    if (symbolWithMostMistakes && symbolWithMostMistakes[1].length > 2) {
      recommendations.push({
        title: `Symbol-Specific Pattern: ${symbolWithMostMistakes[0]}`,
        description: `You consistently make mistakes trading ${symbolWithMostMistakes[0]} - likely due to volatility or volatility mismatch.`,
        priority: 'high',
        impact: 'Recognizing symbol-specific patterns allows you to adjust strategy per-symbol',
        action: `Trade ${symbolWithMostMistakes[0]} with different settings: wider stops, smaller size, or only on confirmed setups.`,
        examples: [
          `Only trade ${symbolWithMostMistakes[0]} on clear trend confirmation`,
          `Use 2x wider stops on ${symbolWithMostMistakes[0]} due to higher volatility`,
          `Scale size down 50% on ${symbolWithMostMistakes[0]} until pattern is fixed`,
        ],
      })
    }
  }

  // Recommendation 3: Risk Management
  const avgRiskRewardRatio = calculateAvgRiskReward(trades)
  if (avgRiskRewardRatio < 1.5 && trades.length >= 5) {
    recommendations.push({
      title: 'Poor Risk/Reward Ratio',
      description: `Your average risk/reward ratio is ${avgRiskRewardRatio.toFixed(2)}:1, meaning you're risking too much for potential reward.`,
      priority: 'high',
      impact: 'Improving to 2:1 ratio with same win rate would double your profitability',
      action: 'Move your take profit further out. If the pattern doesn\'t reach 2:1 risk/reward, skip the trade.',
      examples: [
        'Risk $100 to make $200 minimum',
        'If stop is 50 pips away, target must be 100+ pips',
        'Skip trades with less than 1.5:1 reward potential',
      ],
    })
  }

  // Recommendation 4: Win rate
  if (winRate < 50 && trades.length >= 10) {
    recommendations.push({
      title: 'Low Win Rate - Focus on Entry Quality',
      description: `Your win rate is ${winRate.toFixed(1)}%, below the 50-55% breakeven threshold.`,
      priority: 'critical',
      impact: 'You need either higher accuracy OR better risk/reward to be profitable',
      action: 'Implement a trade grading system. Only take A+ and A grade setups for the next 20 trades.',
      examples: [
        'A+: Perfect confluence (trend + SMC + pattern + volume)',
        'A: 3/4 factors aligned with clear support/resistance',
        'Skip B, C, AVOID grades until you prove consistency',
      ],
    })
  }

  // Recommendation 5: Overtrading
  const tradesPerDay = calculateTradesPerDay(trades)
  if (tradesPerDay > 4) {
    recommendations.push({
      title: 'Overtrading Risk',
      description: `You're averaging ${tradesPerDay.toFixed(1)} trades per day. High frequency increases emotional bias.`,
      priority: 'medium',
      impact: 'Reducing to 1-2 high-quality trades/day could improve win rate by 5-10%',
      action: 'Set a hard limit: 2 trades/day maximum. After 2 trades, step away from the screen.',
      examples: [
        'Pre-market: identify 1 primary setup',
        'Wait for it to trigger, take trade',
        'Walk away until next market session',
        'No revenge trading on losses',
      ],
    })
  }

  // Recommendation 6: Emotional discipline
  const emotionTrades = trades.filter((t) => t.emotions && t.emotions.length > 0)
  const negativeEmotionTrades = emotionTrades.filter((t) =>
    t.emotions?.some((e) => ['nervous', 'greedy', 'fearful'].includes(e)),
  )

  if (negativeEmotionTrades.length > emotionTrades.length * 0.5) {
    const negativeWinRate =
      negativeEmotionTrades
        .filter((t) => t.status === 'closed' && t.pnl !== undefined)
        .filter((t) => (t.pnl ?? 0) > 0).length / negativeEmotionTrades.filter((t) => t.status === 'closed').length * 100 || 0

    recommendations.push({
      title: 'Emotional Trading Hurting Performance',
      description: `${(negativeEmotionTrades.length / emotionTrades.length * 100).toFixed(0)}% of your trades show negative emotions (nervous, greedy, fearful).`,
      priority: 'high',
      impact: `Trading with negative emotions: ${negativeWinRate.toFixed(1)}% win rate vs baseline ${winRate.toFixed(1)}%`,
      action: 'Before entering, pause 30 seconds. Assess emotional state. If nervous/greedy/fearful, skip the trade.',
      examples: [
        'FOMO leads to breakout chasing = high loss rate',
        'Nervous trades often miss full move = premature exits',
        'Greedy trading ignores stops = large losses',
      ],
    })
  }

  return recommendations.slice(0, 5) // Return top 5 recommendations
}

function buildMistakeExamples(mistake: string): string[] {
  const examples: Record<string, string[]> = {
    'Entering too early': [
      'Wait for pattern completion before entry',
      'Confirm breakout with volume before entering',
      'Wait for candle close, not just price touch',
    ],
    'Holding losers': [
      'Set stops BEFORE entering trade',
      'Use alerts to avoid watching (emotional attachment)',
      'Accept loss quickly, move to next opportunity',
    ],
    'Ignoring trend': [
      'Check 4h timeframe trend before trading 1h',
      'Only go LONG in uptrend, SHORT in downtrend',
      'Use EMA 50/200 as trend filter',
    ],
    FOMO: [
      'Keep trade journal of FOMO trades - review win rate',
      'If missed entry on a move, wait for pullback',
      'Close trading platform if FOMO triggers',
    ],
    'Poor Risk/Reward': [
      'Calculate R:R BEFORE entering',
      'Minimum 2:1 risk/reward ratio',
      'If R:R < 1.5:1, skip the trade',
    ],
    'Late entries': [
      'Set alarms on key price levels (don\'t watch chart)',
      'Pre-plan entry zones the night before',
      'Understand that early entries have higher win rate',
    ],
    'Hesitated on entry': [
      'Pre-plan entry logic with exact trigger',
      'Use alerts/notifications to avoid chart-watching',
      'Execute immediately when alert triggers',
    ],
    'Didn\'t scale out at first target': [
      'Set take profit orders BEFORE entering',
      'Scale out 50% at first target, let rest run',
      'Remove emotion from profit taking',
    ],
    Overtrading: [
      'Plan max 2 trades per day',
      'After 2 trades, close trading platform',
      'Only trade when setup is "A" grade or better',
    ],
  }
  return examples[mistake] || [
    'Recognize the pattern',
    'Set specific rules to prevent it',
    'Review past trades where this happened',
  ]
}

function groupMistakesBySymbol(trades: TradeEntry[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  trades.forEach((trade) => {
    if (trade.mistakes && trade.mistakes.length > 0) {
      if (!map.has(trade.symbol)) {
        map.set(trade.symbol, [])
      }
      map.get(trade.symbol)!.push(...trade.mistakes)
    }
  })
  return map
}

function calculateAvgRiskReward(trades: TradeEntry[]): number {
  const tradesWithLevels = trades.filter((t) => t.stopLoss && t.takeProfit && t.entryPrice)
  if (tradesWithLevels.length === 0) return 0

  const ratios = tradesWithLevels.map((t) => {
    const risk = Math.abs(t.entryPrice! - t.stopLoss!)
    const reward = Math.abs(t.takeProfit! - t.entryPrice!)
    return reward / risk
  })

  return ratios.reduce((a, b) => a + b, 0) / ratios.length
}

function calculateTradesPerDay(trades: TradeEntry[]): number {
  if (trades.length === 0) return 0

  // Group by date
  const dateMap = new Map<string, number>()
  trades.forEach((trade) => {
    const date = trade.entryDate.split('T')[0]
    dateMap.set(date, (dateMap.get(date) ?? 0) + 1)
  })

  const avgPerDay = Array.from(dateMap.values()).reduce((a, b) => a + b, 0) / dateMap.size
  return avgPerDay
}

function buildSummary(totalTrades: number, closedTrades: number, winRate: number, topMistake: MistakeFrequency | undefined, recommendations: CoachingRecommendation[]): string {
  let summary = `Based on ${totalTrades} trades (${closedTrades} closed), your win rate is ${winRate.toFixed(1)}%. `

  if (topMistake && topMistake.percentage >= 20) {
    const potentialGain = topMistake.winRateWithoutMistake - topMistake.winRateWithMistake
    summary += `Your biggest bottleneck is "${topMistake.mistake}" (${topMistake.percentage.toFixed(0)}% of trades), which costs you ${potentialGain.toFixed(1)}% win rate. `
  }

  if (recommendations.length === 0) {
    summary += `You're doing great! Keep tracking your trades.`
  } else {
    summary += `Focus on: ${recommendations
      .slice(0, 2)
      .map((r) => r.title)
      .join(', ')}.`
  }

  return summary
}
