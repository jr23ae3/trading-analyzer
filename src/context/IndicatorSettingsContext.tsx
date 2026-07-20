import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { IndicatorSetting, IndicatorType } from '@/types'

const DEFAULT_INDICATORS: IndicatorSetting[] = [
  { id: 'ema-20', type: 'EMA', enabled: true, params: { period: 20 }, color: '#3b82f6' },
  { id: 'ema-50', type: 'EMA', enabled: true, params: { period: 50 }, color: '#f59e0b' },
  { id: 'rsi-14', type: 'RSI', enabled: false, params: { period: 14 }, color: '#8b5cf6' },
  { id: 'macd-default', type: 'MACD', enabled: false, params: { fast: 12, slow: 26, signal: 9 } },
]

interface IndicatorSettingsContextValue {
  indicators: IndicatorSetting[]
  toggleIndicator: (id: string) => void
  updateIndicator: (id: string, patch: Partial<IndicatorSetting>) => void
  addIndicator: (type: IndicatorType) => void
  removeIndicator: (id: string) => void
}

const IndicatorSettingsContext = createContext<IndicatorSettingsContextValue | null>(null)

export function IndicatorSettingsProvider({ children }: { children: ReactNode }) {
  const [indicators, setIndicators] = useState<IndicatorSetting[]>(DEFAULT_INDICATORS)

  const toggleIndicator = useCallback((id: string) => {
    setIndicators(prev =>
      prev.map(ind => (ind.id === id ? { ...ind, enabled: !ind.enabled } : ind)),
    )
  }, [])

  const updateIndicator = useCallback((id: string, patch: Partial<IndicatorSetting>) => {
    setIndicators(prev =>
      prev.map(ind => (ind.id === id ? { ...ind, ...patch } : ind)),
    )
  }, [])

  const addIndicator = useCallback((type: IndicatorType) => {
    const id = `${type.toLowerCase()}-${Date.now()}`
    setIndicators(prev => [
      ...prev,
      { id, type, enabled: true, params: {}, color: '#6b7280' },
    ])
  }, [])

  const removeIndicator = useCallback((id: string) => {
    setIndicators(prev => prev.filter(ind => ind.id !== id))
  }, [])

  return (
    <IndicatorSettingsContext.Provider
      value={{ indicators, toggleIndicator, updateIndicator, addIndicator, removeIndicator }}
    >
      {children}
    </IndicatorSettingsContext.Provider>
  )
}

export function useIndicatorSettings(): IndicatorSettingsContextValue {
  const ctx = useContext(IndicatorSettingsContext)
  if (!ctx) throw new Error('useIndicatorSettings must be used within IndicatorSettingsProvider')
  return ctx
}
