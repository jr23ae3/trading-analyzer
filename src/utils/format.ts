import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a price number to a readable string */
export function formatPrice(price: number, decimals = 2): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Format a PnL value with + / - prefix and colour class */
export function formatPnL(pnl: number): { text: string; className: string } {
  const text = `${pnl >= 0 ? '+' : ''}${formatPrice(pnl)}`
  const className = pnl >= 0 ? 'text-green-400' : 'text-red-400'
  return { text, className }
}

/** Format a Unix timestamp (seconds) to a short date string */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
