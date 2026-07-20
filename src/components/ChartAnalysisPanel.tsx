import { useRef, useState } from 'react'
import { useChartAnalysis } from '@/hooks/useChartAnalysis'

/**
 * Chart Analysis Panel
 * Upload trading chart screenshots for AI analysis
 */
export function ChartAnalysisPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { result, loading, error, analyzeImage, clearResult } = useChartAnalysis()
  const [symbol, setSymbol] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Analyze
    await analyzeImage(file, symbol || undefined, timeframe || undefined)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  if (!result) {
    return (
      <div className="flex flex-col gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-100">AI Chart Analysis</h3>

        {/* Symbol & Timeframe */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Symbol (AAPL)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 placeholder-slate-500"
          />
          <input
            type="text"
            placeholder="Timeframe (1h)"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 placeholder-slate-500"
          />
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUploadClick}
          disabled={loading}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Analyzing...
            </>
          ) : (
            <>
              📸 Upload Chart Screenshot
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 px-2 py-1.5 rounded">
            {error}
          </div>
        )}

        {/* Preview */}
        {previewUrl && (
          <div className="rounded border border-slate-600 overflow-hidden">
            <img src={previewUrl} alt="Chart preview" className="w-full h-48 object-cover" />
          </div>
        )}

        <p className="text-xs text-slate-400">
          Upload a trading chart screenshot and AI will analyze: trends, support/resistance, indicators, volume, patterns, and
          generate a trading report.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    )
  }

  // Display Results
  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between sticky top-0 bg-slate-900 py-2 border-b border-slate-700 -mx-4 px-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Analysis Results</h3>
          <p className="text-xs text-slate-400">
            {result.symbol} {result.timeframe && `• ${result.timeframe}`}
          </p>
        </div>
        <button
          onClick={clearResult}
          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-100 rounded transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Current Price */}
      {result.currentPrice && (
        <div className="flex justify-between items-center bg-slate-800/50 px-3 py-2 rounded">
          <span className="text-slate-400 text-xs">Current Price:</span>
          <span className="text-lg font-bold text-blue-400">${result.currentPrice.toFixed(2)}</span>
        </div>
      )}

      {/* Recommendation */}
      <div className={`px-3 py-2 rounded font-semibold text-xs text-center ${
        result.tradingReport.recommendation === 'strong_buy'
          ? 'bg-green-900/50 text-green-400'
          : result.tradingReport.recommendation === 'buy'
            ? 'bg-green-900/30 text-green-300'
            : result.tradingReport.recommendation === 'hold'
              ? 'bg-yellow-900/30 text-yellow-300'
              : result.tradingReport.recommendation === 'sell'
                ? 'bg-red-900/30 text-red-300'
                : 'bg-red-900/50 text-red-400'
      }`}>
        {result.tradingReport.recommendation.toUpperCase()}
      </div>

      {/* Trend */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold text-slate-300">Trend</h4>
        <div className="bg-slate-800/30 rounded p-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Direction:</span>
            <span className={result.trend.direction === 'bullish' ? 'text-green-400' : result.trend.direction === 'bearish' ? 'text-red-400' : 'text-slate-400'}>
              {result.trend.direction.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Strength:</span>
            <span className="text-slate-100">{result.trend.strength}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Duration:</span>
            <span className="text-slate-100">{result.trend.duration}</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">{result.trend.description}</p>
        </div>
      </section>

      {/* Support & Resistance */}
      {(result.support.length > 0 || result.resistance.length > 0) && (
        <section className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300">Key Levels</h4>
          <div className="bg-slate-800/30 rounded p-2 space-y-2">
            {result.support.map((s, i) => (
              <div key={`s${i}`} className="flex justify-between text-xs">
                <div>
                  <div className="text-red-400 font-bold">Support ${s.level.toFixed(2)}</div>
                  <div className="text-slate-400 text-xs">{s.touches} touches • {s.strength}% strength</div>
                </div>
              </div>
            ))}
            {result.resistance.map((r, i) => (
              <div key={`r${i}`} className="flex justify-between text-xs">
                <div>
                  <div className="text-green-400 font-bold">Resistance ${r.level.toFixed(2)}</div>
                  <div className="text-slate-400 text-xs">{r.touches} touches • {r.strength}% strength</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Candles */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold text-slate-300">Candle Analysis</h4>
        <div className="bg-slate-800/30 rounded p-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Pattern:</span>
            <span className="text-slate-100 font-bold">{result.candles.pattern}</span>
          </div>
          <p className="text-xs text-slate-300">{result.candles.description}</p>
        </div>
      </section>

      {/* Indicators */}
      {result.indicators.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300">Indicators</h4>
          <div className="bg-slate-800/30 rounded p-2 space-y-2">
            {result.indicators.map((ind, i) => (
              <div key={i} className="text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold">{ind.name}</span>
                  <span className={ind.signal === 'bullish' ? 'text-green-400' : ind.signal === 'bearish' ? 'text-red-400' : 'text-slate-400'}>
                    {ind.signal.toUpperCase()}
                  </span>
                </div>
                <div className="text-slate-300 text-xs">{ind.description}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Volume */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold text-slate-300">Volume Analysis</h4>
        <div className="bg-slate-800/30 rounded p-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Trend:</span>
            <span className="text-slate-100">{result.volume.trend}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Profile:</span>
            <span className="text-slate-100">{result.volume.volumeProfile}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Confirmation:</span>
            <span className={result.volume.trendConfirmation === 'confirming' ? 'text-green-400' : result.volume.trendConfirmation === 'diverging' ? 'text-red-400' : 'text-slate-400'}>
              {result.volume.trendConfirmation}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">{result.volume.description}</p>
        </div>
      </section>

      {/* Pattern */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold text-slate-300">Pattern Recognition</h4>
        <div className="bg-slate-800/30 rounded p-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Pattern:</span>
            <span className="text-slate-100 font-bold">{result.pattern.patternDetected || 'None'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Confidence:</span>
            <span className="text-slate-100">{result.pattern.confidence}%</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">{result.pattern.description}</p>
        </div>
      </section>

      {/* Trading Report */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold text-slate-300">Trading Report</h4>
        <div className="bg-slate-800/30 rounded p-2 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Risk Level:</span>
            <span className={
              result.tradingReport.riskLevel === 'high' ? 'text-red-400 font-bold' :
              result.tradingReport.riskLevel === 'medium' ? 'text-yellow-400' :
              'text-green-400'
            }>
              {result.tradingReport.riskLevel.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-300">{result.tradingReport.summary}</p>
          {result.tradingReport.keyPoints.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-300 mb-1">Key Points:</p>
              <ul className="space-y-1">
                {result.tradingReport.keyPoints.map((point, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-2">
                    <span className="text-slate-500">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* JSON Export */}
      <div className="flex gap-2 sticky bottom-0 bg-slate-900 py-2 border-t border-slate-700 -mx-4 px-4">
        <button
          onClick={() => {
            const jsonStr = JSON.stringify(result, null, 2)
            const blob = new Blob([jsonStr], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `chart-analysis-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
        >
          📥 Export JSON
        </button>
        <button
          onClick={() => {
            const lines: string[] = []
            lines.push('# Chart Analysis Report')
            lines.push(`**${result.symbol}** ${result.timeframe}`)
            lines.push(`Current Price: $${result.currentPrice}`)
            lines.push(`Recommendation: **${result.tradingReport.recommendation.toUpperCase()}**`)
            lines.push('')
            lines.push('## Trend')
            lines.push(`${result.trend.direction.toUpperCase()} - ${result.trend.strength}% strength`)
            lines.push('')
            lines.push('## Key Levels')
            result.support.forEach((s) => {
              lines.push(`Support: $${s.level.toFixed(2)}`)
            })
            result.resistance.forEach((r) => {
              lines.push(`Resistance: $${r.level.toFixed(2)}`)
            })
            const markdown = lines.join('\n')
            const blob = new Blob([markdown], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `chart-analysis-${Date.now()}.md`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="flex-1 py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded transition-colors"
        >
          📄 Export MD
        </button>
      </div>
    </div>
  )
}
