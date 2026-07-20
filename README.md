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

## Analysis Features

The Trading Analyzer includes **8 powerful analysis engines**:

1. **Chart Pattern Recognition** (17 patterns)
   - Bull Flag, Bear Flag, Triangle, Wedge, Head & Shoulders, Double Top/Bottom, etc.
   - Confidence scoring and risk/reward calculation

2. **Smart Money Concepts** (11 zone types)
   - Liquidity Sweeps, Fair Value Gaps, Order Blocks, Mitigation Blocks
   - Structure Shifts, Change of Character, Premium/Discount Zones

3. **Scalping Signals** (7-factor analysis)
   - EMA Alignment, VWAP Analysis, Volume Spikes, ATR Volatility
   - Real-time BUY_CALL/BUY_PUT/WAIT signals

4. **Probability Analysis** (9-factor synthesis)
   - Trend, Volume, Momentum, Support/Resistance, RSI, VWAP, EMA, Market Structure
   - Bull/Bear/Sideways probabilities with trade grading (A+/A/B/C/F)

5. **Setup Rating** (5-engine synthesis)
   - Comprehensive setup assessment combining all prior engines
   - A+/A/B/C/AVOID grades with 8-section explanations

6. **Chart Overlays** (9 visual elements)
   - Real-time drawing: Support, Resistance, Trend Lines, Swing Points, VWAP
   - Fair Value Gaps, Order Blocks, Liquidity Sweeps

7. **Paper Trading** (Live simulation)
   - Place trades with entry/stop/target
   - Automatic position sizing, P/L calculation
   - Trade history with win rate, metrics
   - localStorage persistence

8. **AI Chart Analysis** (OpenAI Vision) ⭐ **NEW**
   - Upload chart screenshots for automated analysis
   - Extract: Candles, Trend, Support/Resistance, Indicators, Volume, Patterns
   - Generate trading reports with recommendations
   - Export as JSON or Markdown
   - [Full documentation](docs/AI_CHART_ANALYSIS.md)

## AI Chart Analysis

Analyze trading charts using OpenAI Vision API:

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Add your OpenAI API key
REACT_APP_OPENAI_API_KEY=sk_your_key_here

# 3. Upload chart screenshots in the "Analyze" tab
```

The AI automatically extracts:
- Current price and candle patterns
- Trend direction and strength
- Support and resistance levels with confidence scores
- Technical indicators (RSI, MACD, EMA, etc.)
- Volume analysis with trend confirmation
- Chart pattern recognition
- Trading recommendation and risk assessment

**Result Format:** Complete JSON response with all analysis data

See [AI_CHART_ANALYSIS.md](docs/AI_CHART_ANALYSIS.md) for detailed API documentation and examples.

## Connect Market Data

Replace the stub in [src/services/marketDataService.ts](src/services/marketDataService.ts) with your broker or exchange API (Alpaca, Binance, Yahoo Finance, etc.).
