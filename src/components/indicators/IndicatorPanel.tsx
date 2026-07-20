import { useIndicatorSettings } from '@/context'
import { cn } from '@/utils'

export function IndicatorPanel() {
  const { indicators, toggleIndicator } = useIndicatorSettings()

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-800 rounded-lg">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Indicators</h3>
      {indicators.map((ind) => (
        <div key={ind.id} className="flex items-center justify-between">
          <span className="text-sm text-slate-300">
            {ind.type}
            {ind.params.period ? ` (${ind.params.period})` : ''}
          </span>
          <button
            onClick={() => toggleIndicator(ind.id)}
            className={cn(
              'w-8 h-4 rounded-full transition-colors',
              ind.enabled ? 'bg-blue-600' : 'bg-slate-600',
            )}
            aria-label={`Toggle ${ind.type}`}
          />
        </div>
      ))}
    </div>
  )
}
