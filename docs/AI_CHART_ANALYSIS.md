# AI Chart Analysis Service Documentation

## Overview

The AI Chart Analysis service uses OpenAI's Vision API (gpt-4-vision) to automatically analyze trading chart screenshots and extract technical analysis data in JSON format.

**Capabilities:**
- Extract candle patterns and OHLC prices
- Identify trend direction and strength
- Detect support and resistance levels
- Recognize technical indicators
- Analyze volume patterns
- Identify chart patterns (flags, triangles, wedges, etc.)
- Generate trading recommendations

## Setup

### 1. Get OpenAI API Key

1. Visit https://platform.openai.com/api-keys
2. Sign in with your OpenAI account
3. Click "Create new secret key"
4. Copy the key (starts with `sk_`)

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your OpenAI key
REACT_APP_OPENAI_API_KEY=sk_your_actual_key_here
```

**Important:** The key must start with `REACT_APP_` to be accessible in the browser.

### 3. Restart Dev Server

```bash
npm run dev
```

## Usage

### Web UI

1. Click the **"Analyze"** tab in the navigation
2. (Optional) Enter the symbol (e.g., "AAPL")
3. (Optional) Enter the timeframe (e.g., "1h", "4h", "daily")
4. Click **"📸 Upload Chart Screenshot"**
5. Select a chart image file
6. Wait for analysis to complete
7. Review results and export as JSON or Markdown

### Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### Export Options

**JSON Export**
- Complete analysis data structure
- Programmatic access to all fields
- Suitable for integration with other systems

**Markdown Export**
- Formatted trading report
- Human-readable summary
- Suitable for sharing or documentation

## API Reference

### ChartAnalysisService

```typescript
import { analyzeChartScreenshot, imageToBase64 } from '@/services'

// Convert image file to base64
const base64 = await imageToBase64(file)

// Analyze the chart
const result = await analyzeChartScreenshot({
  imageBase64: base64,
  imageMediaType: 'image/png',
  symbol: 'AAPL',
  timeframe: '1h'
})

console.log(result.tradingReport.recommendation) // 'buy', 'sell', 'hold', etc.
```

### Response Structure

```typescript
interface ChartAnalysisResult {
  timestamp: number
  symbol?: string
  timeframe?: string
  currentPrice: number | null

  candles: {
    count: number
    currentOpen: number | null
    currentClose: number | null
    currentHigh: number | null
    currentLow: number | null
    pattern: string // 'bullish', 'bearish', 'doji', etc.
    description: string
  }

  trend: {
    direction: 'bullish' | 'bearish' | 'sideways'
    strength: number // 0-100
    duration: string // e.g., "5 days"
    description: string
  }

  support: PriceLevel[] // array of support levels
  resistance: PriceLevel[] // array of resistance levels

  indicators: IndicatorAnalysis[] // RSI, MACD, EMA, etc.

  volume: {
    currentVolume: number | null
    averageVolume: number | null
    trend: 'increasing' | 'decreasing' | 'stable'
    volumeProfile: 'high' | 'low' | 'average'
    trendConfirmation: 'confirming' | 'diverging'
    description: string
  }

  pattern: {
    patternDetected: string | null // 'bull flag', 'head and shoulders', etc.
    patternType: 'bullish' | 'bearish' | 'neutral'
    confidence: number // 0-100
    description: string
  }

  tradingReport: {
    summary: string
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
    riskLevel: 'low' | 'medium' | 'high'
    keyPoints: string[]
  }

  rawAnalysis: string // Original AI response
}
```

## Example Response

```json
{
  "timestamp": 1724180059000,
  "symbol": "AAPL",
  "timeframe": "1h",
  "currentPrice": 195.34,
  "candles": {
    "count": 50,
    "currentOpen": 193.50,
    "currentClose": 195.34,
    "currentHigh": 196.20,
    "currentLow": 193.25,
    "pattern": "bullish_engulfing",
    "description": "Current candle is a bullish engulfing pattern, completely encompassing the previous bearish candle. Strong reversal signal."
  },
  "trend": {
    "direction": "bullish",
    "strength": 72,
    "duration": "5 days",
    "description": "Strong bullish trend established with 51 confirmed swings, consistently making higher highs and higher lows."
  },
  "support": [
    {
      "level": 178.55,
      "touches": 4,
      "strength": 92,
      "description": "Major support - multiple touches with strong reaction"
    },
    {
      "level": 185.00,
      "touches": 2,
      "strength": 65,
      "description": "Secondary support level"
    }
  ],
  "resistance": [
    {
      "level": 195.91,
      "touches": 3,
      "strength": 88,
      "description": "Key resistance - multiple touches, about to break"
    },
    {
      "level": 200.00,
      "touches": 1,
      "strength": 60,
      "description": "Psychological round number resistance"
    }
  ],
  "indicators": [
    {
      "name": "RSI (14)",
      "value": "68",
      "signal": "bullish",
      "description": "RSI at 68, approaching overbought at 70. Strong momentum but watch for pullback."
    },
    {
      "name": "MACD",
      "value": "Bullish crossover",
      "signal": "bullish",
      "description": "MACD histogram positive and expanding. Signal line above zero line."
    },
    {
      "name": "EMA (9/21/50)",
      "value": "9 > 21 > 50",
      "signal": "bullish",
      "description": "Perfect bullish alignment with proper separation between all three EMAs."
    }
  ],
  "volume": {
    "currentVolume": 42340000,
    "averageVolume": 32150000,
    "trend": "increasing",
    "volumeProfile": "high",
    "trendConfirmation": "confirming",
    "description": "Volume is 32% above average, strongly confirming the bullish move. Volume bars show consistent buying pressure."
  },
  "pattern": {
    "patternDetected": "Bull Flag",
    "patternType": "bullish",
    "confidence": 85,
    "description": "A bull flag pattern is forming with price consolidating within a flagpole. Expect breakout above $196.50 with target near $202-205."
  },
  "tradingReport": {
    "summary": "AAPL is in a strong bullish trend with excellent technical setup. The bull flag pattern, RSI momentum, and volume confirmation all align for a potential breakout above resistance.",
    "recommendation": "buy",
    "riskLevel": "low",
    "keyPoints": [
      "Bull flag pattern with 85% confidence forming",
      "RSI at 68 showing strong momentum without overextension",
      "Volume increasing on each test of resistance",
      "Next target: $202-205 resistance zone",
      "Stop loss should be placed below $190 support"
    ]
  }
}
```

## React Hook Usage

```typescript
import { useChartAnalysis } from '@/hooks'

export function MyComponent() {
  const { result, loading, error, analyzeImage } = useChartAnalysis()

  const handleImageSelect = async (file: File) => {
    const analysis = await analyzeImage(file, 'AAPL', '1h')
    
    if (analysis) {
      console.log('Recommendation:', analysis.tradingReport.recommendation)
      console.log('Risk Level:', analysis.tradingReport.riskLevel)
    }
  }

  return (
    <div>
      {loading && <p>Analyzing...</p>}
      {error && <p>Error: {error}</p>}
      {result && (
        <div>
          <h3>Analysis Results</h3>
          <p>Trend: {result.trend.direction}</p>
          <p>Support: ${result.support[0]?.level.toFixed(2)}</p>
          <p>Resistance: ${result.resistance[0]?.level.toFixed(2)}</p>
        </div>
      )}
    </div>
  )
}
```

## File Structure

```
src/
├── services/
│   └── chartAnalysisService.ts      # OpenAI Vision integration
├── hooks/
│   └── useChartAnalysis.ts          # React hook
├── components/
│   └── ChartAnalysisPanel.tsx       # UI component
└── types/
    └── (included in chartAnalysisService.ts)
```

## Pricing

OpenAI Vision API pricing:
- gpt-4-vision: $0.01 per 100 tokens (roughly $0.10-0.15 per chart analysis)
- Check https://openai.com/pricing for current rates

## Limitations

- Maximum image size: 20 MB
- Supported formats: PNG, JPEG, GIF, WebP
- Analysis depends on image quality and clarity
- AI may not recognize all custom indicators
- Some exotic chart types may not be recognized
- Rate limits apply (RPM limits depend on your OpenAI plan)

## Troubleshooting

### "REACT_APP_OPENAI_API_KEY environment variable not set"
- Ensure .env file exists and contains the key
- Key must start with `REACT_APP_`
- Restart dev server after changing .env

### "Could not extract JSON from OpenAI response"
- Image quality may be too poor
- Chart may contain unrecognizable elements
- Try with a clearer screenshot

### Rate limit errors
- You've exceeded your OpenAI API quota
- Check billing at https://platform.openai.com/account/billing/overview
- Wait before making more requests

## Advanced Features

### Batch Analysis

```typescript
const images = [file1, file2, file3]
const results = await Promise.all(
  images.map(img => analyzeImage(img, 'AAPL', '1h'))
)
```

### Export Analysis

```typescript
import { formatAnalysisAsMarkdown } from '@/services'

const markdown = formatAnalysisAsMarkdown(result)
console.log(markdown)
```

## Integration Examples

### Compare Multiple Timeframes

```typescript
const results = await Promise.all([
  analyzeImage(file1h, 'AAPL', '1h'),
  analyzeImage(file4h, 'AAPL', '4h'),
  analyzeImage(fileDaily, 'AAPL', 'daily')
])

// Multi-timeframe analysis
if (results[0].trend.direction === 'bullish' &&
    results[1].trend.direction === 'bullish' &&
    results[2].trend.direction === 'bullish') {
  console.log('Confirmed multi-timeframe uptrend')
}
```

### Trading Alert System

```typescript
const analysis = await analyzeImage(file, 'AAPL', '1h')

if (analysis.tradingReport.recommendation === 'strong_buy' &&
    analysis.tradingReport.riskLevel === 'low') {
  // Send alert
  sendNotification('Strong buy signal detected on AAPL')
}
```

## Future Enhancements

- [ ] Batch image analysis
- [ ] Real-time chart streaming analysis
- [ ] Custom indicator recognition training
- [ ] Multi-symbol comparative analysis
- [ ] Historical analysis trends
- [ ] Performance backtesting against recommendations
- [ ] Integration with paper trading engine
- [ ] Automated alerts system

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review OpenAI documentation: https://platform.openai.com/docs/guides/vision
3. Check API status: https://status.openai.com
4. Review your OpenAI billing: https://platform.openai.com/account/billing

## License

This feature is part of the Trading Analyzer application and follows the same license terms.
