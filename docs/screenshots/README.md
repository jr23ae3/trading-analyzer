# Trading Analyzer Screenshots

## Current Features

### Dashboard Overview
- **Watchlist Panel**: Multi-symbol support (AAPL, BTC/USDT, TSLA, QQQ)
- **Chart Panel**: TradingView Advanced Chart widget with real-time symbol switching
- **Paper Trading**: Simulate trades with real market prices
- **Indicators**: EMA, RSI, MACD overlays on chart

## Key Functionality

### 1. Multi-Ticker Support
- Add/remove symbols from watchlist
- Persistent storage across page reloads
- Real market prices for demo data generation
- Per-symbol trade tracking

### 2. Paper Trading Features
- **Market Orders**: Instant execution at current price
- **Limit Orders**: Custom entry price
- **Optional Risk Management**: Stop loss and target levels are optional
- **Direction Support**: Long (↑) and Short (↓) trading
- **Per-Symbol Metrics**: Win rate, P/L, average wins/losses tracked per ticker

### 3. Live Chart Integration
- TradingView Advanced Chart widget
- Real-time price updates matching paper trading
- Built-in timeframe selector (1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W, 1M)
- Technical indicators (EMA, RSI, MACD)

### 4. Realistic Market Data
- Stocks: AAPL ($185), MSFT ($420), QQQ ($700), etc.
- Crypto: BTC/USDT (~$79k), ETH/USDT (~$3.5k), SOL/USDT (~$200)
- Fallback to deterministic sample data when live providers unavailable
- Symbol-based PRNG ensures consistent demo data

## UI/UX Improvements
- Clean dark theme with blue accents
- Responsive layout with sidebar navigation
- Real-time price synchronization
- Direction-based guidance for entry/stop/target placement
- Compact paper trading controls
