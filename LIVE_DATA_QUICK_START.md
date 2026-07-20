# 🚀 Live Market Data: Quick Start Guide

Your Trading Analyzer is now equipped with **professional-grade market data** that can switch between realistic demo data and 5 different live providers with a single configuration change.

## Current Status: ✅ Ready for Live Data

**Today's Setup:**
- ✅ Demo data enabled (realistic OHLCV data for testing)
- ✅ All 5 providers configured and ready
- ✅ Automatic fallback system active
- ✅ Zero errors, production-ready

---

## 🎯 Enable Live Data in 2 Minutes

### Option 1: Binance (Crypto) - EASIEST ⭐
**Best for**: Bitcoin, Ethereum, and other cryptocurrencies

```bash
# 1. Open .env file
# 2. Change this line:
VITE_MARKET_PROVIDER=

# 3. To this:
VITE_MARKET_PROVIDER=binance

# 4. Save and dev server will auto-restart
# 5. Update watchlist: Change "AAPL" to "BTCUSDT"
# 6. Reload browser → Live data!
```

**No API key needed!** Just restart the server and reload.

### Option 2: Polygon (Stocks) - RECOMMENDED 
**Best for**: Apple, Microsoft, Tesla, etc.

```bash
# 1. Sign up free at https://polygon.io/dashboard/api-keys
# 2. Copy your API key
# 3. Update .env:

VITE_MARKET_PROVIDER=polygon
VITE_POLYGON_API_KEY=your-api-key-here

# 4. Restart server & reload browser → Live stock data!
```

### Option 3: Alpaca (Paper Trading)
**Best for**: Learning and paper trading

```bash
# 1. Go to https://app.alpaca.markets/
# 2. Sign up (free)
# 3. Get API key & secret
# 4. Update .env:

VITE_MARKET_PROVIDER=alpaca
VITE_ALPACA_API_KEY=your-key
VITE_ALPACA_API_SECRET=your-secret

# 5. Restart and reload → Live data with paper trading!
```

---

## 📊 System Architecture

```
┌─────────────────────────────────────┐
│      Trading Analyzer               │
│   (Chart, Journal, Analysis)        │
└────────────────┬────────────────────┘
                 │
        ┌────────▼────────┐
        │  Market Data    │
        │   Service       │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌─────────────┐
│ Binance│  │Polygon │  │Demo Data    │
│ (Crypto)   │(Stocks)    │(Fallback)   │
└────────┘  └────────┘  └─────────────┘

✅ Smart Fallback: If live data fails → automatic demo data
✅ Error Handling: All errors handled gracefully
✅ Performance: Built-in caching (1 min TTL)
```

---

## 🔄 How It Works

1. **Live Data Enabled** → Fetches from configured provider
2. **Provider Works** ✅ → Uses live data, user sees real prices
3. **Provider Fails** ⚠️ → Automatically falls back to demo data
4. **Demo Data Active** → User still sees realistic trading environment

**Result**: Your app never crashes, always shows data.

---

## 🛠️ How to Switch Providers

```bash
# Any time, any provider:
1. Edit .env file
2. Change VITE_MARKET_PROVIDER=
3. Save (server auto-restarts)
4. Reload browser
5. Done! Live data is now active

# No configuration, no code changes needed!
```

---

## 📈 What You Get with Each Provider

### Binance ⭐ CRYPTO
- Symbols: `BTCUSDT`, `ETHUSDT`, `BNBUSDT`, etc.
- Real-time updates
- No API key needed
- ✅ Recommended for crypto traders

### Polygon 📊 STOCKS  
- Symbols: `AAPL`, `MSFT`, `GOOGL`, `TSLA`, etc.
- Professional data quality
- Free tier: 5 calls/min, 2M/month
- ✅ Recommended for stock traders

### Alpaca 🎓 PAPER TRADING
- Paper trading account
- Same symbols as stocks
- Free for learning
- ✅ Recommended for learning traders

### Tradovate 🎯 FUTURES
- Futures & options data
- Professional traders
- Paid subscription

### Yahoo Finance 📡 MIXED
- Works with CORS proxy
- Multiple asset classes
- May be slow/unreliable
- Use as last resort

---

## ✅ Verification Checklist

After enabling live data:

- [ ] `.env` file updated with provider and credentials
- [ ] Dev server restarted (`npm run dev`)
- [ ] Browser page reloaded (Ctrl+R or Cmd+R)
- [ ] Chart shows data (either live or demo fallback)
- [ ] Browser console shows: `"Market Data: Live (provider-name)"`
- [ ] Watchlist symbols match provider format:
  - Binance: `BTCUSDT`, `ETHUSDT`
  - Polygon: `AAPL`, `MSFT`
  - Alpaca: `AAPL`, `MSFT`

---

## 🐛 Troubleshooting

### Chart shows demo data instead of live data
```bash
# Check:
1. Is VITE_MARKET_PROVIDER set in .env?
2. Did you restart the dev server?
3. Did you reload the browser?
4. Open browser console (F12) to see if there are errors

# Most common fix:
npm run dev  # Restart server
```

### API returns 401 error (Unauthorized)
```bash
# Fix:
1. Verify API key/credentials are correct
2. Check if they're pasted exactly (no spaces)
3. Restart dev server
4. Try a different symbol
```

### Rate limit errors
```bash
# This means: Too many requests
# Built-in caching helps (1 min per symbol)
# Switch to Binance (much higher free tier)
```

---

## 📚 Resources

- **Binance Symbols**: https://www.binance.com/en/trade
- **Polygon Docs**: https://polygon.io/docs
- **Alpaca Docs**: https://docs.alpaca.markets
- **Symbol Formats**: See `docs/LIVE_DATA_SETUP.md`

---

## 🎉 Next Steps

Choose your provider:
1. ⭐ **Fastest**: Binance (2 min setup, no key needed)
2. 🏆 **Best**: Polygon (5 min setup, free API key)
3. 🎓 **Learning**: Alpaca (free paper trading)

Then follow the 2-minute setup above!

---

**Happy Trading!** 📊🚀

*Need help? Check `docs/LIVE_DATA_SETUP.md` for detailed provider guides.*
