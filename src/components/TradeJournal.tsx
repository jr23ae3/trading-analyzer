import { JournalEntryForm } from './JournalEntryForm'
import { JournalList } from './JournalList'

export function TradeJournal() {
  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Trading Journal</h2>
          <p className="text-sm text-slate-400">Track entries, emotions, mistakes, and lessons learned</p>
        </div>
      </div>

      {/* Form */}
      <JournalEntryForm />

      {/* Journal List */}
      <JournalList />
    </div>
  )
}
