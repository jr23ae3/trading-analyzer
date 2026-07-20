/**
 * Chart Analysis Service
 * Uses OpenAI Vision API to analyze trading charts from screenshots
 */

export interface ChartAnalysisRequest {
  imageBase64: string
  imageMediaType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  symbol?: string
  timeframe?: string
}

export interface CandleAnalysis {
  count: number
  currentOpen: number | null
  currentClose: number | null
  currentHigh: number | null
  currentLow: number | null
  pattern: string // 'bullish' | 'bearish' | 'doji' | 'hammer' | 'shooting_star' | etc
  description: string
}

export interface TrendAnalysis {
  direction: 'bullish' | 'bearish' | 'sideways' | 'unknown'
  strength: number // 0-100
  duration: string // e.g., '5 days', '3 weeks'
  description: string
}

export interface PriceLevel {
  level: number
  touches: number
  strength: number // 0-100
  description: string
}

export interface IndicatorAnalysis {
  name: string
  value: number | string
  signal: 'bullish' | 'bearish' | 'neutral'
  description: string
}

export interface VolumeAnalysis {
  currentVolume: number | null
  averageVolume: number | null
  trend: 'increasing' | 'decreasing' | 'stable'
  volumeProfile: string // 'high' | 'low' | 'average'
  trendConfirmation: 'confirming' | 'diverging' | 'unknown'
  description: string
}

export interface PatternAnalysis {
  patternDetected: string | null
  patternType: 'bullish' | 'bearish' | 'neutral' | 'none'
  confidence: number // 0-100
  description: string
}

export interface ChartAnalysisResult {
  timestamp: number
  symbol?: string
  timeframe?: string
  currentPrice: number | null
  candles: CandleAnalysis
  trend: TrendAnalysis
  support: PriceLevel[]
  resistance: PriceLevel[]
  indicators: IndicatorAnalysis[]
  volume: VolumeAnalysis
  pattern: PatternAnalysis
  tradingReport: {
    summary: string
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
    riskLevel: 'low' | 'medium' | 'high'
    keyPoints: string[]
  }
  rawAnalysis: string // Original AI response
}

const VISION_ANALYSIS_PROMPT = `You are a professional technical analysis expert. Analyze this trading chart screenshot and extract the following information in JSON format:

{
  "currentPrice": <number or null>,
  "candles": {
    "count": <number of visible candles>,
    "currentOpen": <number or null>,
    "currentClose": <number or null>,
    "currentHigh": <number or null>,
    "currentLow": <number or null>,
    "pattern": "<bullish|bearish|doji|hammer|shooting_star|engulfing|other>",
    "description": "<brief description>"
  },
  "trend": {
    "direction": "<bullish|bearish|sideways|unknown>",
    "strength": <0-100 confidence>,
    "duration": "<e.g., '5 days', '3 weeks'>",
    "description": "<detailed trend analysis>"
  },
  "support": [
    {
      "level": <number>,
      "touches": <number>,
      "strength": <0-100>,
      "description": "<brief note>"
    }
  ],
  "resistance": [
    {
      "level": <number>,
      "touches": <number>,
      "strength": <0-100>,
      "description": "<brief note>"
    }
  ],
  "indicators": [
    {
      "name": "<indicator name>",
      "value": "<number or description>",
      "signal": "<bullish|bearish|neutral>",
      "description": "<what it indicates>"
    }
  ],
  "volume": {
    "currentVolume": <number or null>,
    "averageVolume": <number or null>,
    "trend": "<increasing|decreasing|stable>",
    "volumeProfile": "<high|low|average>",
    "trendConfirmation": "<confirming|diverging|unknown>",
    "description": "<analysis>"
  },
  "pattern": {
    "patternDetected": "<pattern name or null>",
    "patternType": "<bullish|bearish|neutral|none>",
    "confidence": <0-100>,
    "description": "<pattern analysis>"
  },
  "tradingReport": {
    "summary": "<executive summary>",
    "recommendation": "<strong_buy|buy|hold|sell|strong_sell>",
    "riskLevel": "<low|medium|high>",
    "keyPoints": ["<point 1>", "<point 2>", "<point 3>"]
  }
}

Analyze the chart carefully and provide accurate technical analysis. If you cannot determine a value, use null. Be concise but thorough.`

/**
 * Analyze a chart screenshot using OpenAI Vision API
 */
export async function analyzeChartScreenshot(
  request: ChartAnalysisRequest,
): Promise<ChartAnalysisResult> {
  const apiKey = import.meta.env.REACT_APP_OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('REACT_APP_OPENAI_API_KEY environment variable not set')
  }

  const mediaType = request.imageMediaType || 'image/jpeg'

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-vision',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${request.imageBase64}`,
                },
              },
              {
                type: 'text',
                text: VISION_ANALYSIS_PROMPT,
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string
        }
      }>
    }
    const rawAnalysis = data.choices[0].message.content

    // Parse JSON from response
    const jsonMatch = rawAnalysis.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from OpenAI response')
    }

    const analysis = JSON.parse(jsonMatch[0]) as {
      currentPrice: number | null
      candles: CandleAnalysis
      trend: TrendAnalysis
      support: PriceLevel[]
      resistance: PriceLevel[]
      indicators: IndicatorAnalysis[]
      volume: VolumeAnalysis
      pattern: PatternAnalysis
      tradingReport: {
        summary: string
        recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
        riskLevel: 'low' | 'medium' | 'high'
        keyPoints: string[]
      }
    }

    return {
      timestamp: Date.now(),
      symbol: request.symbol,
      timeframe: request.timeframe,
      currentPrice: analysis.currentPrice,
      candles: analysis.candles,
      trend: analysis.trend,
      support: analysis.support || [],
      resistance: analysis.resistance || [],
      indicators: analysis.indicators || [],
      volume: analysis.volume,
      pattern: analysis.pattern,
      tradingReport: analysis.tradingReport,
      rawAnalysis,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Chart analysis failed: ${error.message}`)
    }
    throw error
  }
}

/**
 * Convert image file to base64
 */
export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Format analysis result as markdown
 */
export function formatAnalysisAsMarkdown(result: ChartAnalysisResult): string {
  const lines: string[] = []

  lines.push('# Chart Analysis Report')
  lines.push('')
  lines.push(`**Analysis Time:** ${new Date(result.timestamp).toLocaleString()}`)
  if (result.symbol) lines.push(`**Symbol:** ${result.symbol}`)
  if (result.timeframe) lines.push(`**Timeframe:** ${result.timeframe}`)
  if (result.currentPrice) lines.push(`**Current Price:** $${result.currentPrice.toFixed(2)}`)
  lines.push('')

  // Trend
  lines.push('## Trend')
  lines.push(`**Direction:** ${result.trend.direction.toUpperCase()}`)
  lines.push(`**Strength:** ${result.trend.strength}%`)
  lines.push(`**Duration:** ${result.trend.duration}`)
  lines.push(`${result.trend.description}`)
  lines.push('')

  // Support & Resistance
  lines.push('## Key Levels')
  if (result.support.length > 0) {
    lines.push('### Support')
    result.support.forEach((s) => {
      lines.push(`- **$${s.level.toFixed(2)}** (${s.touches} touches, ${s.strength}% strength) - ${s.description}`)
    })
  }
  if (result.resistance.length > 0) {
    lines.push('### Resistance')
    result.resistance.forEach((r) => {
      lines.push(`- **$${r.level.toFixed(2)}** (${r.touches} touches, ${r.strength}% strength) - ${r.description}`)
    })
  }
  lines.push('')

  // Candles
  lines.push('## Candle Analysis')
  lines.push(`**Pattern:** ${result.candles.pattern}`)
  lines.push(`${result.candles.description}`)
  lines.push('')

  // Indicators
  if (result.indicators.length > 0) {
    lines.push('## Indicators')
    result.indicators.forEach((ind) => {
      lines.push(`- **${ind.name}:** ${ind.value} (${ind.signal}) - ${ind.description}`)
    })
    lines.push('')
  }

  // Volume
  lines.push('## Volume Analysis')
  lines.push(`**Trend:** ${result.volume.trend}`)
  lines.push(`**Profile:** ${result.volume.volumeProfile}`)
  lines.push(`**Trend Confirmation:** ${result.volume.trendConfirmation}`)
  lines.push(`${result.volume.description}`)
  lines.push('')

  // Pattern
  lines.push('## Pattern Recognition')
  lines.push(
    `**Pattern:** ${result.pattern.patternDetected || 'None'} (${result.pattern.confidence}% confidence)`,
  )
  lines.push(`${result.pattern.description}`)
  lines.push('')

  // Trading Report
  lines.push('## Trading Report')
  lines.push(`**Recommendation:** ${result.tradingReport.recommendation.toUpperCase()}`)
  lines.push(`**Risk Level:** ${result.tradingReport.riskLevel.toUpperCase()}`)
  lines.push(`${result.tradingReport.summary}`)
  lines.push('')
  lines.push('**Key Points:**')
  result.tradingReport.keyPoints.forEach((point) => {
    lines.push(`- ${point}`)
  })

  return lines.join('\n')
}
