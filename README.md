# Trading Analyzer

A professional trading analysis application built with React, TypeScript, Vite, Tailwind CSS, Zustand, and Lightweight Charts.

## Tech Stack

| Concern | Library |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 |
| Chart | Lightweight Charts v5 |
| Global chart state | Zustand 5 |
| Settings / theme | React Context |

## Project Structure

```
src/
├── components/
│   ├── analysis/          # PriceDisplay and analysis UI
│   ├── charts/            # CandlestickChart, TimeframeSelector
│   ├── indicators/        # IndicatorPanel
│   ├── ThemeToggle.tsx
│   ├── TradeJournal.tsx
│   └── Watchlist.tsx
├── context/               # React Context (Theme, Watchlist, IndicatorSettings)
├── hooks/                 # useMarketData, useSymbolTimeframe, useCandlestickChart
├── lib/                   # Pure indicator math (SMA, EMA, RSI) & analysis helpers
├── services/              # marketDataService, journalService
├── store/                 # Zustand stores (chartStore, tradeJournalStore)
├── types/                 # Shared TypeScript types
├── utils/                 # Formatting helpers, journal stats
├── App.tsx
├── main.tsx
└── Providers.tsx
```

## State Architecture

### React Context (Settings)
| Context | Manages |
|---|---|
| `ThemeContext` | Dark / light theme |
| `WatchlistContext` | Symbol watchlist & alert prices |
| `IndicatorSettingsContext` | Indicator list, enabled state, params |

### Zustand Stores (Chart State)
| Store | Manages |
|---|---|
| `chartStore` | Active symbol, timeframe, OHLCV bars, viewport, crosshair |
| `tradeJournalStore` | Trade entries, stats — persisted to `localStorage` |

## Getting Started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

## Connect Market Data

Replace the stub in [src/services/marketDataService.ts](src/services/marketDataService.ts) with your broker or exchange API (Alpaca, Binance, Yahoo Finance, etc.).
