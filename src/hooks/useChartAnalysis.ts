import { useState } from 'react'
import { analyzeChartScreenshot, imageToBase64, type ChartAnalysisResult } from '@/services/chartAnalysisService'

export interface UseChartAnalysisState {
  result: ChartAnalysisResult | null
  loading: boolean
  error: string | null
  analyzing: boolean
}

/**
 * Hook to analyze chart screenshots using OpenAI Vision
 */
export function useChartAnalysis() {
  const [result, setResult] = useState<ChartAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const analyzeImage = async (
    file: File,
    symbol?: string,
    timeframe?: string,
  ): Promise<ChartAnalysisResult | null> => {
    try {
      setLoading(true)
      setError(null)
      setAnalyzing(true)

      // Convert file to base64
      const base64 = await imageToBase64(file)

      // Determine media type
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
      if (file.type === 'image/png') mediaType = 'image/png'
      if (file.type === 'image/gif') mediaType = 'image/gif'
      if (file.type === 'image/webp') mediaType = 'image/webp'

      // Analyze using OpenAI Vision
      const analysis = await analyzeChartScreenshot({
        imageBase64: base64,
        imageMediaType: mediaType,
        symbol,
        timeframe,
      })

      setResult(analysis)
      return analysis
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Chart analysis error:', errorMessage)
      return null
    } finally {
      setLoading(false)
      setAnalyzing(false)
    }
  }

  const clearResult = () => {
    setResult(null)
    setError(null)
  }

  return {
    result,
    loading,
    error,
    analyzing,
    analyzeImage,
    clearResult,
  }
}
