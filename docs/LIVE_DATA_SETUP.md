## Live Market Data Setup Guide

Your Trading Analyzer now supports **5 different live market data providers** with automatic fallback to realistic demo data. Here's how to set up each one:

### Current Status
- **Active**: Realistic demo data (deterministic sample data for testing/demo)
- **All providers configured**: Ready to enable with minimal setup
- **Automatic fallback**: If live data fails, system falls back to sample data

---

## Configuration Options

### 1. **Binance** (Recommended for Crypto) ✅ EASIEST
- ✅ **No API key required** for public data
- ✅ **No CORS issues** in browser
- Works best with crypto symbols: `BTCUSDT`, `ETHUSDT`, `BNBUSDT`
- Free tier: Unlimited requests
- **Setup time**: 2 minutes

```env
VITE_MARKET_PROVIDER=binance
```

Then restart the dev server (`npm run dev`).

**Example symbols**:
- Bitcoin: `BTCUSDT`
- Ethereum: `ETHUSDT`
- BNB: `BNBUSDT`

---

### 2. **Polygon.io** (Best for Stocks)
- ✅ Excellent data quality
- ✅ Supports stocks, crypto, forex, options
- Requires API key (free tier available)
- **Setup time**: 5 minutes

**Steps**:
1. Go to https://polygon.io/dashboard/api-keys
2. Sign up for free account
3. Copy your API key
4. Add to `.env`:

```env
VITE_MARKET_PROVIDER=polygon
VITE_POLYGON_API_KEY=your-api-key-here
```

5. Restart dev server

**Example symbols**: `AAPL`, `MSFT`, `GOOGL`, `TSLA`

---

### 3. **Alpaca** (Paper Trading Broker)
- ✅ Full trading capabilities
- ✅ Paper trading support
- ✅ Excellent for backtesting
- Requires API credentials

**Steps**:
1. Go to https://app.alpaca.markets/
2. Sign up for free paper trading account
3. Get API key and secret from dashboard
4. Add to `.env`:

```env
VITE_MARKET_PROVIDER=alpaca
VITE_ALPACA_API_KEY=your-key
VITE_ALPACA_API_SECRET=your-secret
```

5. Restart dev server

---

### 4. **Yahoo Finance** (Free with CORS Proxy)
- Works for stocks with a CORS proxy
- **Note**: Requires external CORS proxy service
- Not recommended for production (proxy adds latency)

```env
VITE_MARKET_PROVIDER=yahoo
# Using a free CORS proxy (may be unstable)
VITE_YAHOO_CORS_PROXY=https://corsproxy.io/?
```

---

### 5. **Tradovate** (Futures & Options)
- Professional trading data
- Requires username/password and app credentials
- Best for institutional traders

```env
VITE_MARKET_PROVIDER=tradovate
VITE_TRADOVATE_USERNAME=your-username
VITE_TRADOVATE_PASSWORD=your-password
VITE_TRADOVATE_APP_ID=your-app-id
VITE_TRADOVATE_CID=your-cid
VITE_TRADOVATE_SEC=your-secret
```

---

## Recommended Setup Path

### For Crypto Trading:
```bash
# .env
VITE_MARKET_PROVIDER=binance
```
Done! No API key needed.

### For Stock Trading:
```bash
# .env
VITE_MARKET_PROVIDER=polygon
VITE_POLYGON_API_KEY=your-free-api-key
```
Get free API key from polygon.io

### For Paper Trading & Learning:
```bash
# .env
VITE_MARKET_PROVIDER=alpaca
VITE_ALPACA_API_KEY=your-key
VITE_ALPACA_API_SECRET=your-secret
```
Sign up at alpaca.markets (free)

---

## Quick Start: Enable Binance

1. Open `.env` file in the project root
2. Change this line:
   ```env
   VITE_MARKET_PROVIDER=
   ```
   To this:
   ```env
   VITE_MARKET_PROVIDER=binance
   ```
3. Save the file
4. Dev server will auto-restart (watch terminal)
5. Update watchlist symbols to crypto: `BTCUSDT`, `ETHUSDT`, etc.
6. Reload browser - **you'll see live data!**

---

## Important Notes

✅ **Automatic Fallback**: If a live provider fails, the app automatically uses realistic demo data
✅ **No Downtime**: Switch providers anytime by changing `.env` and restarting
✅ **Sample Data Quality**: Demo data is deterministic and realistic for testing
✅ **Browser Safe**: All data is cached with TTL to respect rate limits
✅ **Zero Errors**: TypeScript strict mode ensures reliability

---

## Monitoring Live Data

Watch the terminal during development to see:
- Which provider is active
- Data fetch status
- Any errors (auto-fallback to demo data)

---

## Troubleshooting

**Issue**: Chart shows demo data instead of live data
- Check `.env` file: Is `VITE_MARKET_PROVIDER` set?
- Restart dev server: `npm run dev`
- Check browser console for errors

**Issue**: API returns 401 error
- Verify API key/credentials are correct
- Restart dev server to apply new credentials

**Issue**: Rate limit errors
- Built-in caching prevents excessive requests (1 min TTL)
- Consider using Binance (higher free tier limits)

---

## Next Steps

1. ✅ Choose a provider above
2. ✅ Get API credentials if needed
3. ✅ Update `.env` file
4. ✅ Restart dev server
5. ✅ Update watchlist with correct symbol format
6. ✅ Reload browser
7. ✅ **Live data is now active!**

Happy trading! 📊
