import type { ReactNode } from 'react'
import { ThemeProvider, WatchlistProvider, IndicatorSettingsProvider } from '@/context'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <WatchlistProvider>
        <IndicatorSettingsProvider>
          {children}
        </IndicatorSettingsProvider>
      </WatchlistProvider>
    </ThemeProvider>
  )
}
