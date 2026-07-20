import { useState } from 'react'
import { useTradeJournalStore } from '@/store'
import type { TradeDirection, TradeGrade, EmotionType } from '@/types'

const EMOTIONS: EmotionType[] = ['confident', 'neutral', 'nervous', 'greedy', 'fearful', 'disciplined']
const GRADES: TradeGrade[] = ['A+', 'A', 'B', 'C', 'AVOID']

export function JournalEntryForm() {
  const addTrade = useTradeJournalStore((s) => s.addTrade)
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    symbol: '',
    direction: 'long' as TradeDirection,
    entryPrice: '',
    exitPrice: '',
    quantity: '',
    stopLoss: '',
    takeProfit: '',
    strategy: '',
    setup: '',
    grade: 'B' as TradeGrade,
    emotions: [] as EmotionType[],
    mistakes: [] as string[],
    notes: '',
    screenshot: null as File | null,
  })

  const [mistakeInput, setMistakeInput] = useState('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData({ ...formData, screenshot: file })
    }
  }

  const handleEmotionToggle = (emotion: EmotionType) => {
    setFormData((prev) => ({
      ...prev,
      emotions: prev.emotions.includes(emotion)
        ? prev.emotions.filter((e) => e !== emotion)
        : [...prev.emotions, emotion],
    }))
  }

  const handleAddMistake = () => {
    if (mistakeInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        mistakes: [...prev.mistakes, mistakeInput],
      }))
      setMistakeInput('')
    }
  }

  const handleRemoveMistake = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      mistakes: prev.mistakes.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let screenshotDataURL: string | undefined

    if (formData.screenshot) {
      try {
        const reader = new FileReader()
        screenshotDataURL = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(formData.screenshot!)
        })
      } catch (err) {
        console.error('Failed to read screenshot:', err)
      }
    }

    const trade = {
      symbol: formData.symbol.toUpperCase(),
      direction: formData.direction,
      status: 'open' as const,
      entryPrice: parseFloat(formData.entryPrice),
      quantity: parseFloat(formData.quantity),
      entryDate: new Date().toISOString(),
      stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : undefined,
      takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : undefined,
      strategy: formData.strategy || undefined,
      setup: formData.setup || undefined,
      grade: formData.grade,
      emotions: formData.emotions,
      mistakes: formData.mistakes,
      notes: formData.notes || undefined,
      screenshotDataURL,
    }

    addTrade(trade)
    setShowForm(false)
    setFormData({
      symbol: '',
      direction: 'long',
      entryPrice: '',
      exitPrice: '',
      quantity: '',
      stopLoss: '',
      takeProfit: '',
      strategy: '',
      setup: '',
      grade: 'B',
      emotions: [],
      mistakes: [],
      notes: '',
      screenshot: null,
    })
    setMistakeInput('')
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
      >
        + New Journal Entry
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">Create Journal Entry</h3>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-slate-400 hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      <div className="space-y-6">
        {/* Trade Basics */}
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Symbol (e.g., AAPL)"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
            required
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          <select
            value={formData.direction}
            onChange={(e) => setFormData({ ...formData, direction: e.target.value as TradeDirection })}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
          >
            <option value="long">LONG</option>
            <option value="short">SHORT</option>
          </select>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-4 gap-4">
          <input
            type="number"
            step="0.01"
            placeholder="Entry Price"
            value={formData.entryPrice}
            onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
            required
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Stop Loss"
            value={formData.stopLoss}
            onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Take Profit"
            value={formData.takeProfit}
            onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Quantity"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            required
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Strategy & Setup */}
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Strategy (e.g., Bull Flag, Scalp)"
            value={formData.strategy}
            onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          <select
            value={formData.grade}
            onChange={(e) => setFormData({ ...formData, grade: e.target.value as TradeGrade })}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Grade: {g}
              </option>
            ))}
          </select>
        </div>

        <textarea
          placeholder="Setup Description (confluence factors, patterns, etc.)"
          value={formData.setup}
          onChange={(e) => setFormData({ ...formData, setup: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />

        {/* Emotions */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Emotions During Trade</label>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map((emotion) => (
              <button
                key={emotion}
                type="button"
                onClick={() => handleEmotionToggle(emotion)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                  formData.emotions.includes(emotion)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {emotion}
              </button>
            ))}
          </div>
        </div>

        {/* Mistakes */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Mistakes</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Add a mistake..."
              value={mistakeInput}
              onChange={(e) => setMistakeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddMistake()
                }
              }}
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleAddMistake}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
            >
              Add
            </button>
          </div>
          <div className="space-y-1">
            {formData.mistakes.map((mistake, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-700/50 px-3 py-2 rounded">
                <span className="text-slate-300 text-sm">{mistake}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveMistake(idx)}
                  className="text-slate-400 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Screenshot */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Screenshot</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-slate-400 file:mr-3 file:px-3 file:py-2 file:rounded file:bg-blue-600 file:text-white file:hover:bg-blue-700 file:cursor-pointer"
          />
          {formData.screenshot && (
            <p className="text-xs text-slate-400 mt-2">Selected: {formData.screenshot.name}</p>
          )}
        </div>

        {/* Notes */}
        <textarea
          placeholder="General Notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />

        {/* Submit Buttons */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
          >
            Save Entry
          </button>
        </div>
      </div>
    </form>
  )
}
