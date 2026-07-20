import { useEffect, useState } from 'react'
import { detectSMCZones } from '@/lib/smc'
import { useChartStore } from '@/store'
import type { SMCDetectionOptions, SMCDetectionResults } from '@/lib/smcTypes'

/**
 * React hook for real-time smart money concepts detection.
 * Automatically updates when bars change.
 */
export function useSMCZones(opts?: SMCDetectionOptions): SMCDetectionResults {
  const bars = useChartStore((state) => state.bars)
  const [zones, setZones] = useState<SMCDetectionResults>({
    zones: [],
    byType: {},
    activeZones: [],
    unmitigatedZones: [],
    summary: { totalZones: 0, activeZonesCount: 0, unmitigatedCount: 0, bullishZones: 0, bearishZones: 0 },
  })

  useEffect(() => {
    if (bars.length < 20) {
      setZones({
        zones: [],
        byType: {},
        activeZones: [],
        unmitigatedZones: [],
        summary: { totalZones: 0, activeZonesCount: 0, unmitigatedCount: 0, bullishZones: 0, bearishZones: 0 },
      })
      return
    }

    const result = detectSMCZones(bars, opts)
    setZones(result)
  }, [bars, opts])

  return zones
}
