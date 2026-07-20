import type { TradeEntry } from '@/types'

const STORAGE_KEY = 'trading-analyzer:journal'

export function saveJournal(trades: TradeEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades))
  } catch {
    console.warn('[journalService] Failed to persist trade journal')
  }
}

export function loadJournal(): TradeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TradeEntry[]) : []
  } catch {
    return []
  }
}

export function clearJournal(): void {
  localStorage.removeItem(STORAGE_KEY)
}
